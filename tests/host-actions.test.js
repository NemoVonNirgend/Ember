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
        isSessionCurrent: session => session.chatId !== 'stale',
        hasUserActivation: request => request.event?.trusted === true,
    });
    return { actions, calls };
}

test('submits an explicit message and optionally generates', async () => {
    const { actions, calls } = createHarness();
    await actions.submit({ session: { id: 's1', chatId: 'chat' }, payload: { text: 'Go left', generate: true }, event: { trusted: true } });
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

test('rejects automatic actions and stale chat sessions', async () => {
    const { actions, calls } = createHarness();
    await assert.rejects(() => actions.submit({
        session: { id: 's1', chatId: 'chat' },
        payload: { text: 'automatic', generate: false },
        event: { trusted: false },
    }), /user interaction/);
    await assert.rejects(() => actions.submit({
        session: { id: 's2', chatId: 'stale' },
        payload: { text: 'stale', generate: false },
        event: { trusted: true },
    }), /no longer active/);
    assert.deepEqual(calls, []);
});

test('serializes rapid artifact interactions', async () => {
    const calls = [];
    let release;
    const actions = createSillyTavernHostActions({
        sendMessage: () => new Promise(resolve => { release = resolve; }),
        generate: async () => {},
        setPrompt: () => {},
        stateStore: { read: () => null, write: async () => ({ saved: true }) },
        hasUserActivation: () => true,
    });
    const first = actions.submit({ session: { id: 's1' }, payload: { text: 'first', generate: false } });
    await assert.rejects(() => actions.submit({
        session: { id: 's1' }, payload: { text: 'second', generate: false },
    }), /already in progress/);
    release();
    await first;
    assert.deepEqual(calls, []);
});
