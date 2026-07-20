import test from 'node:test';
import assert from 'node:assert/strict';

import { revisionOf } from '../src/integration/message-controller.js';
import { createRepairApplicationService } from '../src/repair/repair-application-service.js';

function harness() {
    const message = { mes: 'before\nroot.textContent = "old";\nafter', extra: {} };
    const chat = [message];
    let saves = 0;
    let edits = 0;
    const service = createRepairApplicationService({
        getChat: () => chat,
        getChatId: () => 'chat',
        saveChat: async () => { saves += 1; },
        emitEdited: async () => { edits += 1; },
        now: () => 100,
    });
    return { message, service, counts: () => ({ saves, edits }) };
}

test('applies a revision-checked repair and preserves rollback provenance', async () => {
    const { message, service, counts } = harness();
    const result = await service.apply({
        session: { chatId: 'chat', messageId: '0', artifactKey: 'demo', revision: revisionOf(message) },
        originalSource: 'root.textContent = "old";',
        candidate: 'root.textContent = "new";',
    });
    assert.match(message.mes, /"new"/);
    assert.equal(message.extra.ember4Repairs[0].id, result.id);
    assert.deepEqual(counts(), { saves: 1, edits: 1 });

    await service.rollback({ chatId: 'chat', messageId: '0' });
    assert.match(message.mes, /"old"/);
    assert.equal(message.extra.ember4Repairs[0].rolledBackAt, 100);
});

test('refuses a repair after the message revision changes', async () => {
    const { message, service } = harness();
    const revision = revisionOf(message);
    message.mes += 'changed';
    await assert.rejects(() => service.apply({
        session: { chatId: 'chat', messageId: '0', artifactKey: 'demo', revision },
        originalSource: 'root.textContent = "old";',
        candidate: 'root.textContent = "new";',
    }), /message changed/);
});
