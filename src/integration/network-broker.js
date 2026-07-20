// SPDX-License-Identifier: AGPL-3.0-or-later

const DEFAULT_MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_CONCURRENT_PER_SESSION = 4;

function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && (parts[1] === 0 || parts[1] === 168)) ||
        (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || parts[1] === 51)) ||
        (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
        parts[0] >= 224;
}

export function validateExternalUrl(value, { origin } = {}) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Network URL is invalid.');
    }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS network URLs are allowed.');
    if (url.username || url.password) throw new Error('Credentials are not allowed in network URLs.');
    if (origin && url.origin === origin) throw new Error('Artifacts cannot request SillyTavern endpoints.');
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
        hostname.includes(':') || isPrivateIpv4(hostname)) {
        throw new Error('Local and private network addresses are not allowed.');
    }
    return url;
}

function encodeBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

async function readBoundedBody(response, maxResponseBytes) {
    if (!response.body?.getReader) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > maxResponseBytes) throw new Error('Network response exceeds Ember\'s size limit.');
        return bytes;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            total += chunk.byteLength;
            if (total > maxResponseBytes) {
                await reader.cancel('Ember response size limit exceeded.');
                throw new Error('Network response exceeds Ember\'s size limit.');
            }
            chunks.push(chunk);
        }
    } finally {
        reader.releaseLock?.();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

export function createNetworkBroker({
    fetch,
    origin = globalThis.location?.origin,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxConcurrentPerSession = DEFAULT_MAX_CONCURRENT_PER_SESSION,
    observe = () => {},
}) {
    if (typeof fetch !== 'function') throw new Error('Network broker requires fetch.');
    const activeBySession = new Map();

    return Object.freeze({
        async request({ session, payload }) {
            const url = validateExternalUrl(payload.url, { origin });
            const active = activeBySession.get(session.id) ?? 0;
            if (active >= maxConcurrentPerSession) throw new Error('Artifact network concurrency limit reached.');
            activeBySession.set(session.id, active + 1);
            const startedAt = Date.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(new Error('Artifact network request timed out.')), timeoutMs);
            try {
                const response = await fetch(url.href, {
                    method: payload.method,
                    headers: payload.headers,
                    body: payload.body ? Uint8Array.from(atob(payload.body), character => character.charCodeAt(0)) : undefined,
                    credentials: 'omit',
                    redirect: 'error',
                    referrerPolicy: 'no-referrer',
                    signal: controller.signal,
                });
                validateExternalUrl(response.url || url.href, { origin });
                const declaredLength = Number(response.headers.get('content-length'));
                if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
                    throw new Error("Network response exceeds Ember's size limit.");
                }
                const bytes = await readBoundedBody(response, maxResponseBytes);
                const headers = [...response.headers.entries()].filter(([name]) => name.toLowerCase() !== 'set-cookie');
                observe('network.fetch', {
                    artifactId: session.id,
                    origin: url.origin,
                    method: payload.method,
                    status: response.status,
                    bytes: bytes.byteLength,
                    durationMs: Date.now() - startedAt,
                });
                return {
                    url: response.url || url.href,
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                    body: encodeBase64(bytes),
                };
            } finally {
                clearTimeout(timeout);
                const remaining = (activeBySession.get(session.id) ?? 1) - 1;
                if (remaining > 0) activeBySession.set(session.id, remaining);
                else activeBySession.delete(session.id);
            }
        },
    });
}
