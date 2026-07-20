import test from 'node:test';
import assert from 'node:assert/strict';

import { createArtifactPackage, serializeArtifactPackage } from '../src/artifacts/artifact-package.js';
import { createArtifactLibraryStore } from '../src/integration/artifact-library-store.js';

const artifact = source => ({
    manifest: {
        version: 2,
        id: 'counter',
        title: 'Counter',
        runtime: 'javascript',
        permissions: ['host.state.write'],
        libraries: [],
    },
    source,
});

test('persists, deduplicates, exports, and reloads portable artifacts', async () => {
    const settings = {};
    let saves = 0;
    const store = createArtifactLibraryStore({ settings, persist: async () => { saves += 1; }, now: () => 42 });
    const first = await store.saveArtifact(artifact('root.textContent = "one";'));
    const duplicate = await store.saveArtifact(artifact('root.textContent = "one";'));
    assert.equal(first.id, duplicate.id);
    assert.equal(store.list().length, 1);
    assert.equal(saves, 1);
    assert.match(store.exportText(first.id).fileName, /^counter-[a-f0-9]{12}\.ember\.json$/);
    assert.match(store.fence(first.id), /^```ember/);

    const reloaded = createArtifactLibraryStore({ settings });
    assert.equal(reloaded.get(first.id).title, 'Counter');
});

test('keeps source revisions as distinct reusable entries', async () => {
    const store = createArtifactLibraryStore({ settings: {} });
    await store.saveArtifact(artifact('root.textContent = "one";'));
    await store.saveArtifact(artifact('root.textContent = "two";'));
    assert.equal(store.list().length, 2);
});

test('imports only validated packages without executing their source', async () => {
    let executed = false;
    const source = 'globalThis.__shouldNotRun = true;';
    Object.defineProperty(globalThis, '__shouldNotRun', {
        configurable: true,
        set() { executed = true; },
    });
    try {
        const packageValue = await createArtifactPackage(artifact(source));
        const store = createArtifactLibraryStore({ settings: {} });
        const record = await store.importText(serializeArtifactPackage(packageValue));
        assert.equal(record.package.artifact.source, source);
        assert.equal(executed, false);
    } finally {
        delete globalThis.__shouldNotRun;
    }
});
