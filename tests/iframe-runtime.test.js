import test from 'node:test';
import assert from 'node:assert/strict';

import { createArtifactSessionStore } from '../src/runtime/artifact-session-store.js';
import { createIframeRuntime } from '../src/runtime/iframe-runtime.js';

const crypto = { getRandomValues(array) { array.fill(3); return array; } };

function fakeBrowser() {
    const listeners = new Map();
    const window = {
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type) { listeners.delete(type); },
    };
    const document = {
        createElement(tag) {
            assert.equal(tag, 'iframe');
            return {
                attributes: {},
                className: '',
                dataset: {},
                style: {},
                contentWindow: {},
                setAttribute(name, value) { this.attributes[name] = value; },
                remove() { this.removed = true; },
            };
        },
        querySelector() { return null; },
    };
    return { window, document, listeners };
}

const artifact = {
    manifest: {
        title: 'Test artifact',
        permissions: ['host.submit'],
    },
    source: 'root.textContent = "ready";',
};

test('mounts an artifact with scripts but never same-origin authority', async () => {
    const browser = fakeBrowser();
    const sessions = createArtifactSessionStore({ crypto });
    const runtime = createIframeRuntime({ ...browser, sessions });
    const container = { appendChild(node) { this.child = node; } };

    runtime.install();
    const session = await runtime.mount(container, artifact, { chatId: 'chat', messageId: 1, revision: 'r1' });

    assert.equal(container.child.attributes.sandbox, 'allow-scripts');
    assert.doesNotMatch(container.child.attributes.sandbox, /same-origin/);
    assert.deepEqual(session.requestedPermissions, ['host.submit']);
    assert.deepEqual(session.permissions, []);
    assert.equal(browser.listeners.has('message'), true);
});

test('grants only permissions returned by the host resolver', async () => {
    const browser = fakeBrowser();
    const sessions = createArtifactSessionStore({ crypto });
    const runtime = createIframeRuntime({
        ...browser,
        sessions,
        resolvePermissions: () => ['host.submit'],
    });
    const container = { appendChild(node) { this.child = node; } };
    const session = await runtime.mount(container, artifact, { chatId: 'chat', messageId: 1, revision: 'r1' });
    assert.deepEqual(session.permissions, ['host.submit']);
});
