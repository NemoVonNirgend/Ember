import test from 'node:test';
import assert from 'node:assert/strict';

import { createArtifactSessionStore } from '../src/runtime/artifact-session-store.js';
import { createMessageRouter } from '../src/bridge/message-router.js';

const crypto = { getRandomValues(array) { array.fill(7); return array; } };

function setup(permissions = []) {
    const sessions = createArtifactSessionStore({ crypto });
    const created = sessions.create({
        chatId: 'chat', messageId: 1, revision: 'r1',
        requestedPermissions: permissions,
        grantedPermissions: permissions,
    });
    const source = {};
    sessions.attach(created.id, { frameWindow: source });
    return { sessions, created, source };
}

function message(created, type, payload = {}) {
    return {
        protocol: 1,
        type,
        artifactId: created.id,
        token: created.token,
        payload,
    };
}

test('routes an authenticated and permitted host action', async () => {
    const { sessions, created, source } = setup(['host.submit']);
    let received = null;
    const route = createMessageRouter({
        sessions,
        handlers: { 'host.submit': ({ payload }) => { received = payload; } },
    });
    const result = await route({ source, data: message(created, 'host.submit', { text: 'go' }) });
    assert.equal(result.ok, true);
    assert.deepEqual(received, { text: 'go', generate: false });
});

test('rejects a valid token sent by the wrong frame', async () => {
    const { sessions, created } = setup(['host.submit']);
    const route = createMessageRouter({ sessions });
    const result = await route({ source: {}, data: message(created, 'host.submit') });
    assert.equal(result.ok, false);
    assert.match(result.error, /does not own/);
});

test('rejects actions without declared permission', async () => {
    const { sessions, created, source } = setup([]);
    const route = createMessageRouter({ sessions });
    const result = await route({ source, data: message(created, 'host.inject') });
    assert.equal(result.ok, false);
    assert.match(result.error, /lacks permission/);
});

test('rejects malformed host action payloads', async () => {
    const { sessions, created, source } = setup(['host.submit']);
    const route = createMessageRouter({ sessions });
    const result = await route({ source, data: message(created, 'host.submit', { text: '' }) });
    assert.equal(result.ok, false);
    assert.match(result.error, /non-empty text/);
});

test('returns successful request results to the owning frame', async () => {
    const { sessions, created, source } = setup(['host.state.read']);
    const replies = [];
    source.postMessage = message => replies.push(message);
    const route = createMessageRouter({
        sessions,
        handlers: { 'state.read': () => ({ value: 12 }) },
    });
    const data = message(created, 'state.read', { key: 'score' });
    data.requestId = 'request-1';
    const result = await route({ source, data });
    assert.equal(result.ok, true);
    assert.equal(replies[0].type, 'ember.response');
    assert.deepEqual(replies[0].result, { value: 12 });
});
