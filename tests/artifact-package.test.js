import test from 'node:test';
import assert from 'node:assert/strict';

import {
    artifactToFence,
    createArtifactPackage,
    parseArtifactPackage,
    serializeArtifactPackage,
} from '../src/artifacts/artifact-package.js';
import { parseArtifact } from '../src/parser/artifact-parser.js';

const artifact = {
    manifest: {
        version: 1,
        id: 'route-choice',
        title: 'Choose a route',
        runtime: 'html',
        permissions: ['host.submit'],
        libraries: [],
    },
    source: '<button>Left</button><script>ember.submit({ text: "Left" });</script>',
};

test('round-trips a portable artifact package without runtime authority', async () => {
    const packageValue = await createArtifactPackage({
        ...artifact,
        token: 'must-not-export',
        permissions: ['host.generate'],
        state: { secret: true },
    });
    const parsed = await parseArtifactPackage(serializeArtifactPackage(packageValue));
    assert.equal(parsed.artifact.manifest.version, 2);
    assert.equal(parsed.artifact.source, artifact.source);
    assert.equal(JSON.stringify(parsed).includes('must-not-export'), false);
    assert.equal('state' in parsed, false);
});

test('rejects tampered and oversized packages', async () => {
    const packageValue = await createArtifactPackage(artifact);
    const tampered = structuredClone(packageValue);
    tampered.artifact.source = '<p>changed</p>';
    await assert.rejects(() => parseArtifactPackage(tampered), /integrity check failed/);
    await assert.rejects(() => createArtifactPackage({ ...artifact, source: 'x'.repeat(1_000_001) }), /allowed size/);
});

test('rejects unsafe portable manifest values', async () => {
    await assert.rejects(() => createArtifactPackage({
        ...artifact,
        manifest: { ...artifact.manifest, id: '../escape' },
    }), /unsupported characters/);
    await assert.rejects(() => createArtifactPackage({
        ...artifact,
        manifest: { ...artifact.manifest, runtime: 'module' },
    }), /Unsupported Ember runtime/);
});

test('creates a canonical reusable fence accepted by the normal parser', () => {
    const fence = artifactToFence(artifact);
    const [reused] = parseArtifact(fence);
    assert.equal(reused.format, 'ember-v2');
    assert.equal(reused.manifest.id, 'route-choice');
    assert.equal(reused.source, artifact.source);
});

test('uses a longer fence when portable source contains triple backticks', () => {
    const source = '<pre>before\n```\nafter</pre><script>root.dataset.ready = "true";</script>';
    const fence = artifactToFence({
        ...artifact,
        source,
    });
    const [reused] = parseArtifact(fence);
    assert.match(fence, /^````ember/);
    assert.equal(reused.source, source);
});
