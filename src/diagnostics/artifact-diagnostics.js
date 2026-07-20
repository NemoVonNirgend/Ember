// SPDX-License-Identifier: AGPL-3.0-or-later

import { LEGACY_ARTIFACT_LIBRARIES } from '../libraries/artifact-library-registry.js';

function diagnostic(severity, code, message) {
    return Object.freeze({ severity, code, message });
}

export function diagnoseArtifact(artifact) {
    const results = [];
    const { manifest, source } = artifact;

    if (!manifest.id) {
        results.push(diagnostic('info', 'missing-stable-id', 'Add a stable manifest id if state should survive message rerenders.'));
    }
    const unknownLibraries = manifest.libraries.filter(alias => !LEGACY_ARTIFACT_LIBRARIES[alias]);
    if (unknownLibraries.length) {
        results.push(diagnostic('error', 'unknown-artifact-library', `Unknown artifact libraries: ${unknownLibraries.join(', ')}.`));
    }
    if (/\b(?:window\.)?(?:parent|top|opener)\b/.test(source)) {
        results.push(diagnostic('error', 'parent-access', 'Artifacts cannot access the SillyTavern parent window. Use the ember host API.'));
    }
    if (/\bfetch\s*\(/.test(source) && !manifest.permissions.includes('network.fetch')) {
        results.push(diagnostic('error', 'network-permission', 'The artifact uses fetch() but does not request network.fetch.'));
    }
    if (/\b(?:XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(source)) {
        results.push(diagnostic('error', 'network-api-unavailable', 'Use fetch(); streaming network APIs are not available to artifacts.'));
    }
    if (/^\s*(?:import|export)\s/m.test(source)) {
        results.push(diagnostic('error', 'module-syntax', 'Static import/export syntax is unavailable inside an Ember artifact.'));
    }
    if (/\/inject\b|SlashCommands|sendMessageAsUser|\bGenerate\s*\(/.test(source)) {
        results.push(diagnostic('warning', 'legacy-host-api', 'Use ember.submit(), ember.inject(), or ember.generate() instead of legacy host APIs.'));
    }
    if (manifest.runtime === 'javascript' && !/\broot\b/.test(source)) {
        results.push(diagnostic('warning', 'unused-root', 'JavaScript artifacts should normally render visible output into root.'));
    }
    if (manifest.runtime === 'html' && /<script\b[^>]+src\s*=/i.test(source)) {
        results.push(diagnostic('error', 'external-script', 'External script elements are rejected. Use inline artifact code.'));
    }
    for (const permission of manifest.permissions) {
        const api = {
            'host.submit': /ember\.submit\s*\(/,
            'host.inject': /ember\.inject\s*\(/,
            'host.generate': /ember\.generate\s*\(/,
            'host.state.read': /ember\.state\.read\s*\(/,
            'host.state.write': /ember\.state\.write\s*\(/,
            'network.fetch': /\b(?:fetch\s*\(|new\s+(?:Audio|Image)\s*\(|https?:\/\/)/i,
        }[permission];
        if (api && !api.test(source)) {
            results.push(diagnostic('info', 'unused-permission', `The artifact requests ${permission} but no matching API call was detected.`));
        }
    }
    return Object.freeze(results);
}
