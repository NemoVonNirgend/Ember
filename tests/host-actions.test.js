import test from 'node:test';
import assert from 'node:assert/strict';

import { createSillyTavernHostActions } from '../src/integration/sillytavern-host-actions.js';

function createHarness() {
    const calls = [];
    const actions = createSillyTavernHostActions({
        sendMessage: async text => calls.push(['message', text]),
        generate: async type => calls.push(['generate', type]),
        setPrompt: (...args) => calls.push(['prompt', ...args]),
        promptPosition: 1,
        promptRole: 0,
        stateStore: {
            read: () => ({ hp: 10 }),
            write: async () => ({ saved: true }),
        },
    });
    return { actions, calls };
}

test('submits an explicit message and optionally generates', async () => {
    const { actions, calls } = createHarness();
    await actions.submit({ session: {}, payload: { text: 'Go left', generate: true } });
    assert.deepEqual(calls, [['message', 'Go left'], ['generate', 'normal']]);
});

test('namespaces injections to their artifact session', async () => {
    const { actions, calls } = createHarness();
    const session = { id: 's1', chatId: 'chat', messageId: '2', artifactKey: 'tracker' };
    await actions.inject({ session, payload: { id: 'choice', content: 'Left', depth: 2, ephemeral: false } });
    assert.equal(calls[0][1], 'ember4:chat:2:tracker:choice');
    actions.disposeSession(session);
    assert.equal(calls[1][2], '');
});
