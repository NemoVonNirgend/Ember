// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Libraries exported by SillyTavern 1.18's /lib.js bundle.
 *
 * `host` means Ember may import the dependency in its trusted parent runtime.
 * It does not mean generated artifacts receive the parent object. Unique-origin
 * artifact frames need a separately reviewed adapter or asset strategy.
 */
const host = (id, exportName, purpose) => Object.freeze({
    id,
    source: 'sillytavern',
    surface: 'host',
    exportName,
    purpose,
});

export const HOST_LIBRARY_CATALOG = Object.freeze([
    host('dompurify', 'DOMPurify', 'Sanitize untrusted markup before rendering.'),
    host('yaml', 'yaml', 'Parse Ember artifact manifests and legacy frontmatter.'),
    host('chevrotain', 'chevrotain', 'Build strict parsers if the artifact grammar grows.'),
    host('morphdom', 'morphdom', 'Apply controlled DOM updates without replacing message roots.'),
    host('localforage', 'localforage', 'Persist host-managed artifact state.'),
    host('handlebars', 'Handlebars', 'Render trusted Ember UI templates.'),
    host('fuse', 'Fuse', 'Fuzzy-search artifacts, diagnostics, and capabilities.'),
    host('lodash', 'lodash', 'Use established collection helpers in the host runtime.'),
    host('seedrandom', 'seedrandom', 'Create reproducible seeds for artifact sessions.'),
    host('showdown', 'showdown', 'Convert Markdown inside trusted host UI.'),
    host('highlightjs', 'hljs', 'Highlight artifact source and diagnostics.'),
    host('css-tools', 'css', 'Parse and inspect artifact CSS.'),
    host('diff-match-patch', 'DiffMatchPatch', 'Preview model-assisted repairs.'),
    host('fflate', 'gzipSync', 'Compress exported artifact state.'),
    host('sha256', 'sha256', 'Hash source and state for revision checks.'),
]);

export function findHostLibrary(id) {
    return HOST_LIBRARY_CATALOG.find(entry => entry.id === id) ?? null;
}
