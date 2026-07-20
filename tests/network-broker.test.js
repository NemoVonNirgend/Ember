import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetworkBroker, validateExternalUrl } from '../src/integration/network-broker.js';

test('blocks SillyTavern, loopback, private, and credential-bearing URLs', () => {
    const options = { origin: 'http://127.0.0.1:8000' };
    assert.throws(() => validateExternalUrl('http://127.0.0.1:8000/api/chats', options), /SillyTavern|private/);
    assert.throws(() => validateExternalUrl('http://192.168.1.10/data', options), /private/);
    assert.throws(() => validateExternalUrl('https://user:pass@example.com/data', options), /Credentials/);
    assert.equal(validateExternalUrl('https://pokeapi.co/api/v2/pokemon/25', options).hostname, 'pokeapi.co');
});

test('fetches without credentials and returns a bounded base64 response', async () => {
    const calls = [];
    const broker = createNetworkBroker({
        origin: 'http://127.0.0.1:8000',
        fetch: async (url, init) => {
            calls.push([url, init]);
            return new Response('{"name":"pikachu"}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        },
    });
    const result = await broker.request({
        session: { id: 'artifact-1' },
        payload: { url: 'https://pokeapi.co/api/v2/pokemon/25', method: 'GET', headers: [], body: null },
    });
    assert.equal(calls[0][1].credentials, 'omit');
    assert.equal(calls[0][1].referrerPolicy, 'no-referrer');
    assert.equal(calls[0][1].redirect, 'error');
    assert.equal(Buffer.from(result.body, 'base64').toString(), '{"name":"pikachu"}');
});

test('rejects responses over the configured size limit', async () => {
    const broker = createNetworkBroker({
        maxResponseBytes: 3,
        fetch: async () => new Response('oversized'),
    });
    await assert.rejects(() => broker.request({
        session: { id: 'artifact-1' },
        payload: { url: 'https://example.com/data', method: 'GET', headers: [], body: null },
    }), /size limit/);
});
