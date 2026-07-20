// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    artifactPackageFileName,
    artifactToFence,
    createArtifactPackage,
    parseArtifactPackage,
    serializeArtifactPackage,
} from '../artifacts/artifact-package.js';

const LIBRARY_SCHEMA_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_MAX_BYTES = 5_000_000;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function serializedBytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function ensureLibrary(settings) {
    if (!settings.artifactLibrary || settings.artifactLibrary.schemaVersion !== LIBRARY_SCHEMA_VERSION ||
        !Array.isArray(settings.artifactLibrary.entries)) {
        settings.artifactLibrary = { schemaVersion: LIBRARY_SCHEMA_VERSION, entries: [] };
    }
    return settings.artifactLibrary;
}

function recordId(artifactPackage) {
    const base = String(artifactPackage.artifact.manifest.id || artifactPackage.artifact.manifest.title || 'artifact')
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'artifact';
    return `${base}-${artifactPackage.digest.replace(/^sha256:/, '').slice(0, 12)}`;
}

export function createArtifactLibraryStore({
    settings,
    persist,
    crypto = globalThis.crypto,
    now = () => Date.now(),
    maxEntries = DEFAULT_MAX_ENTRIES,
    maxBytes = DEFAULT_MAX_BYTES,
}) {
    const library = ensureLibrary(settings);
    const listeners = new Set();

    function notify() {
        for (const listener of listeners) listener();
    }

    async function savePackage(artifactPackage) {
        const parsed = await parseArtifactPackage(artifactPackage, { crypto });
        const id = recordId(parsed);
        const existing = library.entries.find(entry => entry.id === id);
        if (existing) return clone(existing);
        const record = {
            id,
            title: parsed.artifact.manifest.title,
            savedAt: now(),
            package: parsed,
        };
        const next = [...library.entries, record];
        if (next.length > maxEntries) throw new Error(`Artifact library is limited to ${maxEntries} entries.`);
        if (serializedBytes(next) > maxBytes) throw new Error('Artifact library exceeds its storage limit.');
        library.entries.push(clone(record));
        await persist?.();
        notify();
        return clone(record);
    }

    return Object.freeze({
        async saveArtifact(artifact) {
            return savePackage(await createArtifactPackage(artifact, { crypto }));
        },
        async importText(text) {
            return savePackage(await parseArtifactPackage(text, { crypto }));
        },
        async exportArtifact(artifact) {
            const artifactPackage = await createArtifactPackage(artifact, { crypto });
            return {
                fileName: artifactPackageFileName(artifactPackage.artifact, artifactPackage.digest),
                text: serializeArtifactPackage(artifactPackage),
            };
        },
        fenceForArtifact(artifact) {
            return artifactToFence(artifact);
        },
        list() {
            return library.entries.map(clone);
        },
        get(id) {
            const entry = library.entries.find(item => item.id === id);
            return entry ? clone(entry) : null;
        },
        async remove(id) {
            const index = library.entries.findIndex(item => item.id === id);
            if (index < 0) return false;
            library.entries.splice(index, 1);
            await persist?.();
            notify();
            return true;
        },
        exportText(id) {
            const entry = library.entries.find(item => item.id === id);
            if (!entry) throw new Error('Artifact library entry was not found.');
            return {
                fileName: artifactPackageFileName(entry.package.artifact, entry.package.digest),
                text: serializeArtifactPackage(entry.package),
            };
        },
        fence(id) {
            const entry = library.entries.find(item => item.id === id);
            if (!entry) throw new Error('Artifact library entry was not found.');
            return artifactToFence(entry.package.artifact);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    });
}
