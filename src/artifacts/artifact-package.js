// SPDX-License-Identifier: AGPL-3.0-or-later

import { normalizePermissions } from '../core/permissions.js';

export const ARTIFACT_PACKAGE_KIND = 'ember-artifact-package';
export const ARTIFACT_PACKAGE_VERSION = 1;
export const MAX_ARTIFACT_SOURCE_BYTES = 1_000_000;
const MAX_PACKAGE_BYTES = MAX_ARTIFACT_SOURCE_BYTES + 65_536;
const MAX_LIBRARIES = 32;
const encoder = new TextEncoder();

function byteLength(value) {
    return encoder.encode(String(value)).byteLength;
}

function normalizeId(value) {
    if (value == null || value === '') return null;
    const id = String(value);
    if (!/^[a-z0-9][a-z0-9_.-]{0,127}$/i.test(id)) {
        throw new Error('Artifact package id contains unsupported characters.');
    }
    return id;
}

function normalizeLibraries(value = []) {
    if (!Array.isArray(value) || value.length > MAX_LIBRARIES) {
        throw new Error('Artifact package libraries must be a bounded array.');
    }
    const libraries = [...new Set(value.map(item => String(item)))];
    if (libraries.some(item => !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(item))) {
        throw new Error('Artifact package contains an invalid library alias.');
    }
    return Object.freeze(libraries);
}

export function normalizePortableArtifact(artifact) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
        throw new TypeError('Artifact package requires an artifact object.');
    }
    const source = String(artifact.source ?? '');
    if (!source.trim()) throw new Error('Artifact package source cannot be empty.');
    if (byteLength(source) > MAX_ARTIFACT_SOURCE_BYTES) {
        throw new Error('Artifact package source exceeds the allowed size.');
    }
    const manifest = artifact.manifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error('Artifact package requires a manifest.');
    }
    if (!['html', 'javascript'].includes(manifest.runtime)) {
        throw new Error(`Unsupported Ember runtime: ${manifest.runtime}`);
    }
    const title = String(manifest.title ?? 'Untitled artifact').trim().slice(0, 120) || 'Untitled artifact';
    return Object.freeze({
        manifest: Object.freeze({
            version: 2,
            id: normalizeId(manifest.id),
            title,
            runtime: manifest.runtime,
            permissions: normalizePermissions(manifest.permissions ?? []),
            libraries: normalizeLibraries(manifest.libraries ?? []),
        }),
        source,
    });
}

function canonicalArtifact(artifact) {
    return JSON.stringify({ manifest: artifact.manifest, source: artifact.source });
}

export async function sha256Text(value, crypto = globalThis.crypto) {
    if (!crypto?.subtle?.digest) throw new Error('Secure artifact hashing is unavailable.');
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function artifactDigest(artifact, options = {}) {
    const normalized = normalizePortableArtifact(artifact);
    return `sha256:${await sha256Text(canonicalArtifact(normalized), options.crypto)}`;
}

export async function createArtifactPackage(artifact, options = {}) {
    const normalized = normalizePortableArtifact(artifact);
    return Object.freeze({
        kind: ARTIFACT_PACKAGE_KIND,
        version: ARTIFACT_PACKAGE_VERSION,
        digest: await artifactDigest(normalized, options),
        artifact: normalized,
    });
}

export function serializeArtifactPackage(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

export async function parseArtifactPackage(input, options = {}) {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    if (byteLength(text) > MAX_PACKAGE_BYTES) throw new Error('Artifact package exceeds the allowed size.');
    let value;
    try {
        value = typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
        throw new Error('Artifact package is not valid JSON.');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        value.kind !== ARTIFACT_PACKAGE_KIND || value.version !== ARTIFACT_PACKAGE_VERSION) {
        throw new Error('Unsupported Ember artifact package.');
    }
    const artifact = normalizePortableArtifact(value.artifact);
    const digest = await artifactDigest(artifact, options);
    if (value.digest !== digest) throw new Error('Artifact package integrity check failed.');
    return Object.freeze({ kind: ARTIFACT_PACKAGE_KIND, version: ARTIFACT_PACKAGE_VERSION, digest, artifact });
}

function fenceDelimiterFor(body) {
    const runs = String(body).match(/`+/g) ?? [];
    const longest = runs.reduce((length, run) => Math.max(length, run.length), 0);
    return '`'.repeat(Math.max(3, longest + 1));
}

export function artifactToFence(artifact) {
    const normalized = normalizePortableArtifact(artifact);
    const body = `${JSON.stringify(normalized.manifest, null, 2)}\n---\n${normalized.source}`;
    const delimiter = fenceDelimiterFor(body);
    return `${delimiter}ember\n${body}\n${delimiter}`;
}

export function artifactPackageFileName(artifact, digest = '') {
    const normalized = normalizePortableArtifact(artifact);
    const base = String(normalized.manifest.id || normalized.manifest.title || 'artifact')
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'artifact';
    const suffix = String(digest).replace(/^sha256:/, '').slice(0, 12);
    return `${base}${suffix ? `-${suffix}` : ''}.ember.json`;
}
