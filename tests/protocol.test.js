import test from 'node:test';
import assert from 'node:assert/strict';

import { validateActionPayload, validateBridgeMessage } from '../src/bridge/protocol.js';

const token = 'a'.repeat(32);

test('accepts a well-formed bridge message', () => {
    const result = validateBridgeMessage({
        protocol: 1,
        type: 'artifact.ready',
        artifactId: 'artifact-1',
        token,
        payload: {},
    });
    assert.equal(result.ok, true);
});

test('rejects unauthenticated bridge messages', () => {
    const result = validateBridgeMessage({
        protocol: 1,
        type: 'host.inject',
        artifactId: 'artifact-1',
        token: 'short',
        payload: {},
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /capability token/);
});

test('rejects unknown bridge actions', () => {
    const result = validateBridgeMessage({
        protocol: 1,
        type: 'host.arbitrary',
        artifactId: 'artifact-1',
        token,
        payload: {},
    });
    assert.equal(result.ok, false);
});

test('normalizes safe injection payloads', () => {
    const result = validateActionPayload('host.inject', {
        id: 'quest_log',
        content: 'The key was found.',
        depth: 2,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
        id: 'quest_log',
        content: 'The key was found.',
        depth: 2,
        ephemeral: false,
    });
});

test('normalizes safe network requests and rejects ambient credential headers', () => {
    const safe = validateActionPayload('network.fetch', {
        url: 'https://pokeapi.co/api/v2/pokemon/pikachu',
        method: 'get',
        headers: [['accept', 'application/json']],
    });
    assert.equal(safe.ok, true);
    assert.equal(safe.value.method, 'GET');

    const unsafe = validateActionPayload('network.fetch', {
        url: 'https://example.com',
        headers: [['cookie', 'session=secret']],
    });
    assert.equal(unsafe.ok, false);
    assert.match(unsafe.error, /not allowed/);
});
