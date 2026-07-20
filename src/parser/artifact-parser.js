// SPDX-License-Identifier: AGPL-3.0-or-later

import { normalizePermissions } from '../core/permissions.js';

const EMBER_FENCE = /```ember\s*\n([\s\S]*?)\n```/gi;
const LEGACY_JS_FENCE = /```(?:javascript|js)\s*\n([\s\S]*?)\n```/gi;
const HTML_FENCE = /```html\s*\n([\s\S]*?)\n```/gi;
const LEGACY_FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

function inferLegacyLibraries(source) {
    const patterns = {
        d3: /\bd3\./,
        three: /\bTHREE\./,
        p5: /\b(?:new\s+p5|createCanvas\s*\()/,
        anime: /\banime\s*\(/,
        chartjs: /\b(?:new\s+Chart|Chart\.)/,
        matter: /\bMatter\./,
    };
    return Object.entries(patterns).filter(([, pattern]) => pattern.test(source)).map(([alias]) => alias);
}

function inferLegacyPermissions(source) {
    const permissions = [];
    if (/ember\.submit\s*\(/.test(source)) permissions.push('host.submit');
    if (/ember\.inject\s*\(/.test(source)) permissions.push('host.inject');
    if (/ember\.generate\s*\(/.test(source)) permissions.push('host.generate');
    if (/ember\.state\.read\s*\(/.test(source)) permissions.push('host.state.read');
    if (/ember\.state\.write\s*\(/.test(source)) permissions.push('host.state.write');
    if (/\b(?:fetch\s*\(|new\s+(?:Audio|Image)\s*\(|https?:\/\/)|\.src\s*=|setAttribute\s*\(\s*['"]src['"]/i.test(source)) {
        permissions.push('network.fetch');
    }
    return permissions;
}

function automaticManifest(source, runtime, title) {
    return Object.freeze({
        version: 1,
        id: null,
        title,
        runtime,
        permissions: normalizePermissions(inferLegacyPermissions(source)),
        libraries: Object.freeze(inferLegacyLibraries(source)),
    });
}

function normalizeAutomaticHtml(source) {
    return Object.freeze({
        format: 'automatic-html',
        manifest: automaticManifest(source, 'html', 'Interactive HTML'),
        source,
    });
}

function normalizeLegacyArtifact(raw, parseManifest) {
    const frontmatter = raw.match(LEGACY_FRONTMATTER);
    const options = frontmatter ? parseManifest(frontmatter[1]) ?? {} : {};
    const source = frontmatter ? raw.slice(frontmatter[0].length) : raw;
    const libraries = [...new Set([...(Array.isArray(options.libs) ? options.libs : []), ...inferLegacyLibraries(source)])];
    return Object.freeze({
        format: 'legacy-javascript',
        manifest: Object.freeze({
            version: 1,
            id: options.id ? String(options.id).replace(/[^a-z0-9_.-]/gi, '-').slice(0, 128) : null,
            title: String(options.title ?? 'Legacy Ember artifact').slice(0, 120),
            runtime: 'javascript',
            permissions: normalizePermissions(inferLegacyPermissions(source)),
            libraries: Object.freeze(libraries),
        }),
        source,
    });
}

function parseManifestBlock(raw, parseManifest) {
    const separator = raw.indexOf('\n---\n');
    if (separator < 0) {
        throw new Error('Ember artifacts require a manifest/content separator.');
    }
    const manifestText = raw.slice(0, separator).trim();
    const source = raw.slice(separator + 5);
    const manifest = parseManifest(manifestText);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error('Ember artifact manifest must be an object.');
    }

    if (manifest.version !== 2) {
        throw new Error(`Unsupported Ember artifact version: ${manifest.version}`);
    }
    if (!['html', 'javascript'].includes(manifest.runtime)) {
        throw new Error(`Unsupported Ember runtime: ${manifest.runtime}`);
    }

    return Object.freeze({
        format: 'ember-v2',
        manifest: Object.freeze({
            version: 2,
            id: manifest.id === undefined ? null : String(manifest.id).replace(/[^a-z0-9_.-]/gi, '-').slice(0, 128),
            title: String(manifest.title ?? 'Untitled artifact').slice(0, 120),
            runtime: manifest.runtime,
            permissions: normalizePermissions(manifest.permissions ?? []),
            libraries: Object.freeze([...new Set(manifest.libraries ?? [])]),
        }),
        source,
    });
}

export function parseArtifact(message, { parseManifest = JSON.parse } = {}) {
    if (typeof message !== 'string') return Object.freeze([]);
    const matches = [];

    for (const match of message.matchAll(EMBER_FENCE)) {
        matches.push({ index: match.index, artifact: parseManifestBlock(match[1], parseManifest) });
    }

    for (const match of message.matchAll(LEGACY_JS_FENCE)) {
        matches.push({ index: match.index, artifact: normalizeLegacyArtifact(match[1], parseManifest) });
    }

    for (const match of message.matchAll(HTML_FENCE)) {
        if (/<script\b/i.test(match[1])) {
            matches.push({ index: match.index, artifact: normalizeAutomaticHtml(match[1]) });
        }
    }

    if (!matches.length) {
        const trimmed = message.trim();
        if (trimmed.startsWith('<') && /<script\b/i.test(trimmed)) {
            matches.push({ index: 0, artifact: normalizeAutomaticHtml(trimmed) });
        }
    }

    matches.sort((left, right) => left.index - right.index);
    return Object.freeze(matches.map(match => match.artifact));
}
