import test from 'node:test';
import assert from 'node:assert/strict';

import { createPermissionPolicy } from '../src/core/permission-policy.js';

const artifact = (permissions, source = 'root.textContent = "safe";') => ({
    manifest: {
        version: 2, id: 'test', title: 'Test', runtime: 'javascript', permissions, libraries: [],
    },
    source,
});

test('does not grant requested permissions without approval', async () => {
    const settings = {};
    const policy = createPermissionPolicy({
        settings,
        confirm: async () => ({ allowed: false, remember: false }),
    });
    assert.deepEqual(await policy.resolve({ artifact: artifact(['host.submit']) }), []);
});

test('remembers an approved permission signature', async () => {
    const settings = {};
    let prompts = 0;
    const policy = createPermissionPolicy({
        settings,
        persist: async () => {},
        confirm: async () => { prompts += 1; return { allowed: true, remember: true }; },
    });
    assert.deepEqual(await policy.resolve({ artifact: artifact(['host.submit']) }), ['host.submit']);
    assert.deepEqual(await policy.resolve({ artifact: artifact(['host.submit']) }), ['host.submit']);
    assert.equal(Object.keys(settings.permissionDecisions).length, 1);
    assert.match(Object.keys(settings.permissionDecisions)[0], /^v3:sha256:/);
    assert.equal(prompts, 1);
});

test('changed source cannot inherit a remembered permission grant', async () => {
    const settings = {};
    let prompts = 0;
    const policy = createPermissionPolicy({
        settings,
        persist: async () => {},
        confirm: async () => { prompts += 1; return { allowed: true, remember: true }; },
    });
    await policy.resolve({ artifact: artifact(['host.submit'], 'ember.submit({ text: "safe" });') });
    await policy.resolve({ artifact: artifact(['host.submit'], 'ember.submit({ text: document.cookie });') });
    assert.equal(prompts, 2);
    assert.equal(Object.keys(settings.permissionDecisions).length, 2);
});

test('deduplicates concurrent permission prompts for the same source', async () => {
    let release;
    let prompts = 0;
    const confirmation = new Promise(resolve => { release = resolve; });
    const policy = createPermissionPolicy({
        settings: {},
        confirm: async () => {
            prompts += 1;
            return confirmation;
        },
    });
    const first = policy.resolve({ artifact: artifact(['host.submit']) });
    const second = policy.resolve({ artifact: artifact(['host.submit']) });
    for (let attempt = 0; attempt < 20 && prompts === 0; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }
    assert.equal(prompts, 1);
    release({ allowed: true, remember: false });
    assert.deepEqual(await first, ['host.submit']);
    assert.deepEqual(await second, ['host.submit']);
});

test('a reused artifact in a new message receives a fresh permission review', async () => {
    let prompts = 0;
    const policy = createPermissionPolicy({
        settings: {},
        confirm: async () => { prompts += 1; return { allowed: true, remember: true }; },
    });
    const value = artifact(['host.submit']);
    await policy.resolve({ artifact: value, ownership: { chatId: 'chat', messageId: '1' } });
    await policy.resolve({ artifact: value, ownership: { chatId: 'chat', messageId: '1' } });
    await policy.resolve({ artifact: value, ownership: { chatId: 'chat', messageId: '2' } });
    assert.equal(prompts, 2);
});
