// SPDX-License-Identifier: AGPL-3.0-or-later

import { normalizePermissions } from '../core/permissions.js';

function randomHex(crypto, bytes = 32) {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    return [...values].map(value => value.toString(16).padStart(2, '0')).join('');
}

function defaultCrypto() {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('A cryptographically secure random source is required.');
    }
    return globalThis.crypto;
}

function publicSnapshot(session) {
    return Object.freeze({
        id: session.id,
        chatId: session.chatId,
        messageId: session.messageId,
        revision: session.revision,
        artifactKey: session.artifactKey,
        status: session.status,
        permissions: session.permissions,
        requestedPermissions: session.requestedPermissions,
        createdAt: session.createdAt,
    });
}

export function createArtifactSessionStore({ crypto = defaultCrypto(), now = () => Date.now() } = {}) {
    const sessions = new Map();

    return Object.freeze({
        create({ chatId, messageId, revision, artifactKey, requestedPermissions = [], grantedPermissions = [] }) {
            const requested = normalizePermissions(requestedPermissions);
            const granted = normalizePermissions(grantedPermissions);
            const undeclared = granted.filter(permission => !requested.includes(permission));
            if (undeclared.length) {
                throw new Error(`Cannot grant undeclared permission(s): ${undeclared.join(', ')}`);
            }
            const id = `ember-${randomHex(crypto, 12)}`;
            const session = {
                id,
                token: randomHex(crypto),
                chatId: String(chatId ?? ''),
                messageId: String(messageId ?? ''),
                revision: String(revision ?? ''),
                artifactKey: String(artifactKey ?? messageId ?? ''),
                permissions: granted,
                requestedPermissions: requested,
                status: 'created',
                frameWindow: null,
                iframe: null,
                createdAt: now(),
            };
            sessions.set(id, session);
            return Object.freeze({ ...publicSnapshot(session), token: session.token });
        },
        attach(id, { iframe, frameWindow }) {
            const session = sessions.get(id);
            if (!session) throw new Error(`Unknown artifact session: ${id}`);
            if (!frameWindow) throw new Error('Artifact session requires a frame window.');
            session.iframe = iframe ?? null;
            session.frameWindow = frameWindow;
            session.status = 'mounted';
            return publicSnapshot(session);
        },
        get(id) {
            const session = sessions.get(id);
            return session ? publicSnapshot(session) : null;
        },
        authenticate({ artifactId, token, source }) {
            const session = sessions.get(artifactId);
            if (!session || session.status === 'disposed') {
                return { ok: false, error: 'Unknown or disposed artifact session.' };
            }
            if (session.token !== token) {
                return { ok: false, error: 'Invalid artifact capability token.' };
            }
            if (!session.frameWindow || session.frameWindow !== source) {
                return { ok: false, error: 'Message source does not own this artifact session.' };
            }
            return { ok: true, session: publicSnapshot(session) };
        },
        hasPermission(id, permission) {
            const session = sessions.get(id);
            return Boolean(session?.permissions.includes(permission));
        },
        dispose(id) {
            const session = sessions.get(id);
            if (!session) return false;
            session.status = 'disposed';
            session.iframe?.remove?.();
            session.iframe = null;
            session.frameWindow = null;
            sessions.delete(id);
            return true;
        },
        disposeWhere(predicate) {
            let count = 0;
            for (const session of [...sessions.values()]) {
                if (predicate(publicSnapshot(session))) {
                    this.dispose(session.id);
                    count += 1;
                }
            }
            return count;
        },
        list() {
            return [...sessions.values()].map(publicSnapshot);
        },
        get size() {
            return sessions.size;
        },
    });
}
