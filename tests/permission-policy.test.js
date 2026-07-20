import test from 'node:test';
import assert from 'node:assert/strict';

import { createPermissionPolicy } from '../src/core/permission-policy.js';

const artifact = permissions => ({ manifest: { title: 'Test', permissions } });

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
    assert.equal(settings.permissionDecisions['host.submit'], 'allow');
    assert.equal(prompts, 1);
});
