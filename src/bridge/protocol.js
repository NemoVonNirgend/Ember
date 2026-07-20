// SPDX-License-Identifier: AGPL-3.0-or-later

export const BRIDGE_PROTOCOL_VERSION = 1;
export const BRIDGE_MESSAGE_TYPES = Object.freeze([
    'artifact.ready',
    'artifact.error',
    'artifact.resize',
    'host.submit',
    'host.inject',
    'host.generate',
    'network.fetch',
    'state.read',
    'state.write',
]);

const messageTypes = new Set(BRIDGE_MESSAGE_TYPES);
const MAX_ACTION_TEXT = 20_000;
const MAX_STATE_BYTES = 100_000;
const MAX_NETWORK_BODY_BYTES = 1_000_000;
const BLOCKED_NETWORK_HEADERS = new Set(['cookie', 'host', 'origin', 'referer']);

export const MESSAGE_PERMISSIONS = Object.freeze({
    'host.submit': 'host.submit',
    'host.inject': 'host.inject',
    'host.generate': 'host.generate',
    'network.fetch': 'network.fetch',
    'state.read': 'host.state.read',
    'state.write': 'host.state.write',
});

export function validateBridgeMessage(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, error: 'Bridge message must be an object.' };
    }
    if (value.protocol !== BRIDGE_PROTOCOL_VERSION) {
        return { ok: false, error: 'Unsupported bridge protocol.' };
    }
    if (!messageTypes.has(value.type)) {
        return { ok: false, error: 'Unknown bridge message type.' };
    }
    if (typeof value.artifactId !== 'string' || !value.artifactId) {
        return { ok: false, error: 'Bridge message requires an artifactId.' };
    }
    if (typeof value.token !== 'string' || value.token.length < 32) {
        return { ok: false, error: 'Bridge message requires a capability token.' };
    }
    if (value.payload !== undefined && (!value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload))) {
        return { ok: false, error: 'Bridge payload must be an object.' };
    }
    if (value.requestId !== undefined && (typeof value.requestId !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(value.requestId))) {
        return { ok: false, error: 'Bridge requestId is invalid.' };
    }
    return { ok: true, value };
}

export function requiredPermissionForMessage(type) {
    return MESSAGE_PERMISSIONS[type] ?? null;
}

function jsonSize(value) {
    try {
        return new TextEncoder().encode(JSON.stringify(value)).length;
    } catch {
        return Infinity;
    }
}

export function validateActionPayload(type, payload = {}) {
    switch (type) {
        case 'host.submit':
            if (typeof payload.text !== 'string' || !payload.text.trim()) {
                return { ok: false, error: 'Submit action requires non-empty text.' };
            }
            if (payload.text.length > MAX_ACTION_TEXT) {
                return { ok: false, error: 'Submit text exceeds the allowed size.' };
            }
            return { ok: true, value: { text: payload.text, generate: payload.generate === true } };
        case 'host.inject': {
            if (typeof payload.content !== 'string' || !payload.content.trim()) {
                return { ok: false, error: 'Inject action requires non-empty content.' };
            }
            if (payload.content.length > MAX_ACTION_TEXT) {
                return { ok: false, error: 'Injection content exceeds the allowed size.' };
            }
            const id = String(payload.id ?? 'default');
            if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
                return { ok: false, error: 'Injection id contains unsupported characters.' };
            }
            const depth = Number(payload.depth ?? 0);
            if (!Number.isInteger(depth) || depth < 0 || depth > 100) {
                return { ok: false, error: 'Injection depth must be an integer from 0 to 100.' };
            }
            return { ok: true, value: { id, content: payload.content, depth, ephemeral: payload.ephemeral === true } };
        }
        case 'host.generate':
            return { ok: true, value: {} };
        case 'network.fetch': {
            if (typeof payload.url !== 'string' || payload.url.length > 4_096) {
                return { ok: false, error: 'Network request requires a valid URL.' };
            }
            const method = String(payload.method ?? 'GET').toUpperCase();
            if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
                return { ok: false, error: 'Network request method is not allowed.' };
            }
            if (!Array.isArray(payload.headers) || payload.headers.length > 64) {
                return { ok: false, error: 'Network request headers are invalid.' };
            }
            const headers = [];
            for (const entry of payload.headers) {
                if (!Array.isArray(entry) || entry.length !== 2) {
                    return { ok: false, error: 'Network request header is invalid.' };
                }
                const name = String(entry[0]).toLowerCase();
                const value = String(entry[1]);
                if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(name) || value.length > 8_192 || BLOCKED_NETWORK_HEADERS.has(name)) {
                    return { ok: false, error: `Network request header is not allowed: ${name}` };
                }
                headers.push([name, value]);
            }
            const body = payload.body == null ? null : String(payload.body);
            if (body && body.length > Math.ceil(MAX_NETWORK_BODY_BYTES * 4 / 3) + 8) {
                return { ok: false, error: 'Network request body exceeds the allowed size.' };
            }
            if ((method === 'GET' || method === 'HEAD') && body) {
                return { ok: false, error: `${method} requests cannot include a body.` };
            }
            return { ok: true, value: { url: payload.url, method, headers, body } };
        }
        case 'state.read': {
            const key = String(payload.key ?? 'default');
            return /^[a-z0-9][a-z0-9_.-]{0,127}$/i.test(key)
                ? { ok: true, value: { key } }
                : { ok: false, error: 'State key contains unsupported characters.' };
        }
        case 'state.write':
            if (jsonSize(payload.value) > MAX_STATE_BYTES) {
                return { ok: false, error: 'Artifact state exceeds the allowed size.' };
            }
            return validateActionPayload('state.read', payload).ok
                ? { ok: true, value: { key: String(payload.key ?? 'default'), value: payload.value } }
                : validateActionPayload('state.read', payload);
        default:
            return { ok: true, value: payload };
    }
}
