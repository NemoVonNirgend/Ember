import test from 'node:test';
import assert from 'node:assert/strict';

import { hasPermission, normalizePermissions } from '../src/core/permissions.js';

test('deduplicates known permissions', () => {
    const permissions = normalizePermissions(['host.submit', 'host.submit']);
    assert.deepEqual(permissions, ['host.submit']);
});

test('checks granted permissions', () => {
    assert.equal(hasPermission(['host.inject'], 'host.inject'), true);
    assert.equal(hasPermission(['host.inject'], 'network.fetch'), false);
});
