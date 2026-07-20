// SPDX-License-Identifier: AGPL-3.0-or-later

function scriptJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function trustedScript(source) {
    return `<script>${String(source).replace(/<\/script/gi, '<\\/script')}</script>`;
}

export function buildFrameDocument({
    artifactId,
    token,
    source,
    runtime = 'javascript',
    title = 'Ember artifact',
    librarySources = [],
}) {
    const config = scriptJson({ artifactId, token, source, runtime });
    const safeTitle = String(title).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>html,body{margin:0;min-height:1px}body{font:inherit;color:inherit}#root{box-sizing:border-box;min-height:1px}</style>
</head>
<body>
<div id="root"></div>
${librarySources.map(library => trustedScript(library.source)).join('\n')}
<script>
'use strict';
const config = ${config};
const pending = new Map();
let requestSequence = 0;
const send = (type, payload = {}, expectResponse = false) => {
    const requestId = expectResponse ? 'request-' + (++requestSequence) : undefined;
    parent.postMessage({
        protocol: 1,
        type,
        artifactId: config.artifactId,
        token: config.token,
        requestId,
        payload,
    }, '*');
    if (!expectResponse) return undefined;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error('Ember host request timed out.'));
        }, 15000);
        pending.set(requestId, { resolve, reject, timeout });
    });
};
addEventListener('message', event => {
    const message = event.data;
    if (event.source !== parent || message?.type !== 'ember.response' ||
        message.artifactId !== config.artifactId || message.token !== config.token) return;
    const request = pending.get(message.requestId);
    if (!request) return;
    pending.delete(message.requestId);
    clearTimeout(request.timeout);
    if (message.ok) request.resolve(message.result);
    else request.reject(new Error(String(message.error || 'Ember host request failed.')));
});
const ember = Object.freeze({
    submit: payload => send('host.submit', payload, true),
    inject: payload => send('host.inject', payload, true),
    generate: payload => send('host.generate', payload, true),
    state: Object.freeze({
        read: payload => send('state.read', payload, true),
        write: payload => send('state.write', payload, true),
    }),
});
const encodeBase64 = bytes => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
};
const decodeBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const requestBody = async request => {
    if (request.method === 'GET' || request.method === 'HEAD') return null;
    const bytes = new Uint8Array(await request.clone().arrayBuffer());
    return bytes.byteLength ? encodeBase64(bytes) : null;
};
const brokerFetch = async (input, init) => {
    const request = input instanceof Request && init === undefined ? input : new Request(input, init);
    if (request.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const result = await send('network.fetch', {
        url: request.url,
        method: request.method,
        headers: [...request.headers.entries()],
        body: await requestBody(request),
    }, true);
    if (request.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const response = new Response(decodeBase64(result.body), {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
    });
    Object.defineProperty(response, 'url', { value: result.url, configurable: true });
    return response;
};
globalThis.fetch = brokerFetch;

const mediaUrls = new Set();
const isRemoteMedia = value => /^https?:\/\//i.test(String(value || ''));
const loadExternalMedia = async (element, value) => {
    if (!isRemoteMedia(value)) {
        if (value != null) element.setAttribute('src', value);
        return;
    }
    element.removeAttribute('src');
    try {
        const response = await brokerFetch(value);
        if (!response.ok) throw new Error('Media request failed with status ' + response.status + '.');
        const objectUrl = URL.createObjectURL(await response.blob());
        mediaUrls.add(objectUrl);
        element.setAttribute('src', objectUrl);
        element.parentElement?.tagName === 'VIDEO' && element.parentElement.load();
        element.parentElement?.tagName === 'AUDIO' && element.parentElement.load();
    } catch (error) {
        element.dispatchEvent(new ErrorEvent('error', { error, message: String(error?.message || error) }));
    }
};
const brokerSourceProperty = prototype => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'src');
    if (!descriptor?.get || !descriptor?.set) return;
    Object.defineProperty(prototype, 'src', {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
            if (isRemoteMedia(value)) loadExternalMedia(this, value);
            else descriptor.set.call(this, value);
        },
    });
};
brokerSourceProperty(HTMLImageElement.prototype);
brokerSourceProperty(HTMLMediaElement.prototype);
const hydrateMedia = node => {
    if (node?.nodeType !== Node.ELEMENT_NODE) return;
    const elements = [node, ...node.querySelectorAll('img[src],audio[src],video[src],source[src]')];
    for (const element of elements) {
        if (!['IMG', 'AUDIO', 'VIDEO', 'SOURCE'].includes(element.tagName)) continue;
        const value = element.getAttribute('src');
        if (isRemoteMedia(value)) loadExternalMedia(element, value);
    }
};
const NativeAudio = globalThis.Audio;
globalThis.Audio = function EmberAudio(source) {
    const element = new NativeAudio();
    if (source != null) loadExternalMedia(element, source);
    return element;
};
globalThis.Audio.prototype = NativeAudio.prototype;
const NativeImage = globalThis.Image;
globalThis.Image = function EmberImage(width, height) {
    const element = new NativeImage(width, height);
    return element;
};
globalThis.Image.prototype = NativeImage.prototype;
addEventListener('unload', () => {
    for (const url of mediaUrls) URL.revokeObjectURL(url);
    mediaUrls.clear();
});
const root = document.getElementById('root');
new MutationObserver(records => {
    for (const record of records) {
        if (record.type === 'attributes') hydrateMedia(record.target);
        for (const node of record.addedNodes || []) hydrateMedia(node);
    }
}).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
const reportSize = () => send('artifact.resize', {
    height: Math.max(1, Math.ceil(document.documentElement.scrollHeight)),
});
new ResizeObserver(reportSize).observe(document.documentElement);
addEventListener('error', event => send('artifact.error', {
    message: String(event.message || 'Artifact execution failed.'),
    line: Number(event.lineno || 0),
    column: Number(event.colno || 0),
}));
addEventListener('unhandledrejection', event => send('artifact.error', {
    message: String(event.reason?.message || event.reason || 'Unhandled promise rejection.'),
}));
try {
    const executions = [];
    if (config.runtime === 'html') {
        const template = document.createElement('template');
        template.innerHTML = config.source;
        const scripts = [...template.content.querySelectorAll('script')];
        for (const script of scripts) {
            if (script.src) throw new Error('External scripts are not allowed in Ember HTML artifacts.');
            executions.push(script.textContent || '');
            script.remove();
        }
        root.appendChild(template.content.cloneNode(true));
        hydrateMedia(root);
    } else {
        executions.push(config.source);
    }
    const run = async () => {
        const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
        for (const source of executions) {
            const execute = new AsyncFunction('root', 'ember', '"use strict";\\n' + source);
            await execute(root, ember);
        }
    };
    Promise.resolve(run())
        .then(() => { send('artifact.ready'); reportSize(); })
        .catch(error => send('artifact.error', { message: String(error?.stack || error) }));
} catch (error) {
    send('artifact.error', { message: String(error?.stack || error) });
}
</script>
</body>
</html>`;
}
