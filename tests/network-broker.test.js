import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetworkBroker, validateExternalUrl } from '../src/integration/network-broker.js';

test('blocks SillyTavern, loopback, private, and credential-bearing URLs', () => {
    const options = { origin: 'http://127.0.0.1:8000' };
    assert.throws(() => validateExternalUrl('http://127.0.0.1:8000/api/chats', options), /SillyTavern|private/);
    assert.throws(() => validateExternalUrl('http://192.168.1.10/data', options), /private/);
    assert.throws(() => validateExternalUrl('http://100.64.0.1/data', options), /private/);
    assert.throws(() => validateExternalUrl('http://[::ffff:127.0.0.1]/data', options), /private/);
    assert.throws(() => validateExternalUrl('http://224.0.0.1/data', options), /private/);
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

test('cancels a chunked response as soon as it crosses the size limit', async () => {
    let cancelled = false;
    const body = new ReadableStream({
        start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            controller.enqueue(new Uint8Array([3, 4]));
        },
        cancel() { cancelled = true; },
    });
    const broker = createNetworkBroker({
        maxResponseBytes: 3,
        fetch: async () => new Response(body),
    });
    await assert.rejects(() => broker.request({
        session: { id: 'artifact-1' },
        payload: { url: 'https://example.com/data', method: 'GET', headers: [], body: null },
    }), /size limit/);
    assert.equal(cancelled, true);
});

test('aborts hanging requests at the broker timeout', async () => {
    const broker = createNetworkBroker({
        timeoutMs: 5,
        fetch: async (_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    });
    await assert.rejects(() => broker.request({
        session: { id: 'artifact-1' },
        payload: { url: 'https://example.com/data', method: 'GET', headers: [], body: null },
    }), /timed out/);
});

test('limits concurrent requests per artifact session', async () => {
    const releases = [];
    const broker = createNetworkBroker({
        maxConcurrentPerSession: 1,
        fetch: async () => new Promise(resolve => releases.push(() => resolve(new Response('ok')))),
    });
    const first = broker.request({
        session: { id: 'artifact-1' },
        payload: { url: 'https://example.com/one', method: 'GET', headers: [], body: null },
    });
    await assert.rejects(() => broker.request({
        session: { id: 'artifact-1' },
        payload: { url: 'https://example.com/two', method: 'GET', headers: [], body: null },
    }), /concurrency limit/);
    releases[0]();
    assert.equal(Buffer.from((await first).body, 'base64').toString(), 'ok');
});

test('invalid requests do not consume a session concurrency slot', async () => {
    const broker = createNetworkBroker({
        maxConcurrentPerSession: 1,
        origin: 'http://127.0.0.1:8000',
        fetch: async () => new Response('ok'),
    });
    const session = { id: 'artifact-1' };
    const request = url => broker.request({
        session,
        payload: { url, method: 'GET', headers: [], body: null },
    });

    await assert.rejects(() => request('http://127.0.0.1/private'), /private/);
    assert.equal(Buffer.from((await request('https://example.com/data')).body, 'base64').toString(), 'ok');
});
