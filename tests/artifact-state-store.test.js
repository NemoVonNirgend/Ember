import test from 'node:test';
import assert from 'node:assert/strict';

import { createArtifactStateStore } from '../src/integration/artifact-state-store.js';

test('persists state under the chat-scoped artifact key', async () => {
    const metadata = {};
    let saves = 0;
    const store = createArtifactStateStore({
        getMetadata: () => metadata,
        save: async () => { saves += 1; },
    });
    const session = { artifactKey: 'tracker', chatId: 'chat', messageId: '2' };
    await store.write(session, 'selection', { value: 4 });
    assert.deepEqual(store.read(session, 'selection'), { value: 4 });
    assert.equal(metadata.emberV4.artifacts.tracker.messageId, '2');
    assert.equal(saves, 1);
});

test('rejects aggregate state overflow atomically', async () => {
    const metadata = {};
    const store = createArtifactStateStore({ getMetadata: () => metadata });
    const session = { artifactKey: 'tracker', chatId: 'chat', messageId: '2' };
    await store.write(session, 'safe', 'kept');
    await assert.rejects(() => store.write(session, 'tooLarge', 'x'.repeat(500_000)), /aggregate storage limit/);
    assert.deepEqual(metadata.emberV4.artifacts.tracker.state, { safe: 'kept' });
});

test('rejects unbounded state keys and cross-chat ownership', async () => {
    const metadata = {};
    const store = createArtifactStateStore({ getMetadata: () => metadata });
    const session = { artifactKey: 'tracker', chatId: 'chat', messageId: '2' };
    for (let index = 0; index < 100; index += 1) {
        await store.write(session, `key-${index}`, index);
    }
    await assert.rejects(() => store.write(session, 'overflow', true), /limited to 100 keys/);
    await assert.rejects(() => store.write(
        { artifactKey: 'tracker', chatId: 'another-chat', messageId: '2' },
        'key-0',
        'changed',
    ), /another chat/);
    assert.equal(metadata.emberV4.artifacts.tracker.state['key-0'], 0);
});
