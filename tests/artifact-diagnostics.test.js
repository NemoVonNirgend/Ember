import test from 'node:test';
import assert from 'node:assert/strict';

import { diagnoseArtifact } from '../src/diagnostics/artifact-diagnostics.js';

test('detects blocked and legacy artifact behavior before execution', () => {
    const diagnostics = diagnoseArtifact({
        manifest: {
            id: null,
            runtime: 'javascript',
            permissions: ['host.inject'],
            libraries: [],
        },
        source: 'fetch("https://example.com"); window.parent.postMessage({}); /inject old;',
    });
    const codes = diagnostics.map(entry => entry.code);
    assert.ok(codes.includes('network-permission'));
    assert.ok(codes.includes('parent-access'));
    assert.ok(codes.includes('legacy-host-api'));
    assert.ok(codes.includes('unused-permission'));
});

test('returns no issues for a minimal well-formed artifact', () => {
    const diagnostics = diagnoseArtifact({
        manifest: {
            id: 'choice',
            runtime: 'html',
            permissions: ['host.submit'],
            libraries: [],
        },
        source: '<button onclick="ember.submit({ text: \'Go\' })">Go</button>',
    });
    assert.deepEqual(diagnostics, []);
});
