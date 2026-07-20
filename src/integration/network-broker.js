// SPDX-License-Identifier: AGPL-3.0-or-later

const DEFAULT_MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168);
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
        hostname === '::1' || hostname === '0:0:0:0:0:0:0:1' || hostname.startsWith('fc') ||
        hostname.startsWith('fd') || /^fe[89ab]/.test(hostname) || isPrivateIpv4(hostname)) {
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

export function createNetworkBroker({
    fetch,
    origin = globalThis.location?.origin,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    observe = () => {},
}) {
    if (typeof fetch !== 'function') throw new Error('Network broker requires fetch.');

    return Object.freeze({
        async request({ session, payload }) {
            const url = validateExternalUrl(payload.url, { origin });
            const startedAt = Date.now();
            const response = await fetch(url.href, {
                method: payload.method,
                headers: payload.headers,
                body: payload.body ? Uint8Array.from(atob(payload.body), character => character.charCodeAt(0)) : undefined,
                credentials: 'omit',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
            });
            validateExternalUrl(response.url || url.href, { origin });
            const declaredLength = Number(response.headers.get('content-length'));
            if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
                throw new Error('Network response exceeds Ember’s size limit.');
            }
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.byteLength > maxResponseBytes) throw new Error('Network response exceeds Ember’s size limit.');
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
        },
    });
}
