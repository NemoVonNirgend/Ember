import test from 'node:test';
import assert from 'node:assert/strict';

import { createArtifactSessionStore } from '../src/runtime/artifact-session-store.js';

function fakeCrypto() {
    let value = 0;
    return { getRandomValues(array) { array.fill(value++); return array; } };
}

test('authenticates only the registered frame source and token', () => {
    const sessions = createArtifactSessionStore({ crypto: fakeCrypto(), now: () => 42 });
    const created = sessions.create({
        chatId: 'chat', messageId: 4, revision: 'abc',
        requestedPermissions: ['host.submit'], grantedPermissions: ['host.submit'],
    });
    const frameWindow = {};
    sessions.attach(created.id, { frameWindow });

    assert.equal(sessions.authenticate({ artifactId: created.id, token: created.token, source: frameWindow }).ok, true);
    assert.equal(sessions.authenticate({ artifactId: created.id, token: created.token, source: {} }).ok, false);
    assert.equal(sessions.authenticate({ artifactId: created.id, token: 'x'.repeat(64), source: frameWindow }).ok, false);
});

test('disposal removes the iframe and invalidates the session', () => {
    const sessions = createArtifactSessionStore({ crypto: fakeCrypto() });
    const created = sessions.create({ chatId: 'chat', messageId: 4, revision: 'abc' });
    let removed = false;
    sessions.attach(created.id, { iframe: { remove() { removed = true; } }, frameWindow: {} });
    assert.equal(sessions.dispose(created.id), true);
    assert.equal(removed, true);
    assert.equal(sessions.get(created.id), null);
});

test('cannot grant a permission the artifact did not request', () => {
    const sessions = createArtifactSessionStore({ crypto: fakeCrypto() });
    assert.throws(() => sessions.create({
        requestedPermissions: [],
        grantedPermissions: ['host.inject'],
    }), /Cannot grant undeclared/);
});
