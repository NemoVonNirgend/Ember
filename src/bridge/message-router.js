// SPDX-License-Identifier: AGPL-3.0-or-later

import { validateBridgeMessage, requiredPermissionForMessage, validateActionPayload } from './protocol.js';

export function createMessageRouter({ sessions, handlers = {}, onRejected = () => {} }) {
    return async function routeMessage(event) {
        const parsed = validateBridgeMessage(event?.data);
        if (!parsed.ok) {
            onRejected(parsed.error, event);
            return { ok: false, error: parsed.error };
        }

        const message = parsed.value;
        const authenticated = sessions.authenticate({
            artifactId: message.artifactId,
            token: message.token,
            source: event.source,
        });
        if (!authenticated.ok) {
            onRejected(authenticated.error, event);
            return authenticated;
        }

        const permission = requiredPermissionForMessage(message.type);
        if (permission && !sessions.hasPermission(message.artifactId, permission)) {
            const error = `Artifact lacks permission: ${permission}`;
            onRejected(error, event);
            return { ok: false, error };
        }

        const payload = validateActionPayload(message.type, message.payload ?? {});
        if (!payload.ok) {
            onRejected(payload.error, event);
            return payload;
        }

        const handler = handlers[message.type];
        if (!handler) return { ok: true, handled: false };

        try {
            const result = await handler({
                session: authenticated.session,
                payload: payload.value,
                event,
            });
            if (message.requestId && event.source?.postMessage) {
                event.source.postMessage({
                    protocol: 1,
                    type: 'ember.response',
                    artifactId: message.artifactId,
                    token: message.token,
                    requestId: message.requestId,
                    ok: true,
                    result: result ?? null,
                }, '*');
            }
            return { ok: true, handled: true };
        } catch (error) {
            if (message.requestId && event.source?.postMessage) {
                event.source.postMessage({
                    protocol: 1,
                    type: 'ember.response',
                    artifactId: message.artifactId,
                    token: message.token,
                    requestId: message.requestId,
                    ok: false,
                    error: String(error?.message ?? error),
                }, '*');
            }
            return { ok: false, error: String(error?.message ?? error) };
        }
    };
}
