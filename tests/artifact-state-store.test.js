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
