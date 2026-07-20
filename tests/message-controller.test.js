import test from 'node:test';
import assert from 'node:assert/strict';

import { createMessageController } from '../src/integration/message-controller.js';

function element(tagName = 'div') {
    return {
        tagName: tagName.toUpperCase(),
        children: [],
        dataset: {},
        style: {},
        classList: { add() {} },
        append(...nodes) { this.children.push(...nodes); },
        appendChild(node) { this.children.push(node); return node; },
        addEventListener() {},
        remove() { this.removed = true; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
}

function harness({ parser, mount } = {}) {
    const chat = [{ mes: '```js\nroot.textContent = "ready";\n```', swipe_id: 0 }];
    const text = element('div');
    const message = element('div');
    message.querySelector = selector => selector === '.mes_text' ? text : null;
    message.querySelectorAll = () => [];
    const document = {
        createElement: element,
        querySelector: () => message,
        querySelectorAll: () => [],
    };
    const listeners = new Map();
    const eventSource = {
        on(event, handler) { listeners.set(event, [...(listeners.get(event) ?? []), handler]); },
        removeListener(event, handler) {
            listeners.set(event, (listeners.get(event) ?? []).filter(value => value !== handler));
        },
    };
    const disposed = [];
    let session = 0;
    const iframeRuntime = {
        mount: mount ?? (async () => ({ id: `session-${++session}` })),
        dispose(id) { disposed.push(id); return true; },
    };
    const artifact = {
        format: 'legacy-javascript',
        manifest: { id: 'test', title: 'Test', runtime: 'javascript', permissions: [], libraries: [] },
        source: 'root.textContent = "ready";',
    };
    const observations = [];
    const controller = createMessageController({
        eventSource,
        events: {
            USER_MESSAGE_RENDERED: 'user',
            CHARACTER_MESSAGE_RENDERED: 'character',
            MESSAGE_EDITED: 'edited',
            MESSAGE_SWIPED: 'swiped',
            MESSAGE_DELETED: 'deleted',
            CHAT_LOADED: 'loaded',
            CHAT_CHANGED: 'changed',
        },
        getChat: () => chat,
        getChatId: () => 'chat',
        document,
        parseArtifact: parser ?? (() => [artifact]),
        iframeRuntime,
        includeLegacy: () => true,
        observe: (type, detail) => observations.push([type, detail]),
    });
    return { chat, controller, disposed, listeners, observations, text };
}

test('controller installation is idempotent and uninstall removes listeners', () => {
    const { controller, listeners } = harness({ parser: () => [] });
    assert.equal(controller.install(), true);
    assert.equal(controller.install(), false);
    assert.equal([...listeners.values()].reduce((sum, values) => sum + values.length, 0), 7);
    assert.equal(controller.uninstall(), true);
    assert.equal(controller.uninstall(), false);
    assert.equal([...listeners.values()].reduce((sum, values) => sum + values.length, 0), 0);
});

test('malformed and empty edits dispose the previous artifact session', async () => {
    let malformed = false;
    const setup = harness({ parser: () => {
        if (malformed) throw new Error('bad manifest');
        return [{
            format: 'legacy-javascript',
            manifest: { id: 'test', title: 'Test', runtime: 'javascript', permissions: [], libraries: [] },
            source: 'root.textContent = "ready";',
        }];
    } });
    await setup.controller.processMessage(0);
    assert.equal(setup.controller.mountedCount, 1);
    malformed = true;
    setup.chat[0].mes = '```ember\ninvalid\n```';
    await setup.controller.processMessage(0);
    assert.deepEqual(setup.disposed, ['session-1']);
    assert.equal(setup.controller.mountedCount, 0);
    assert.equal(setup.observations.at(-1)[0], 'artifact.parse_failed');

    setup.chat[0].mes = '';
    await setup.controller.processMessage(0);
    assert.equal(setup.controller.mountedCount, 0);
});

test('a superseded async mount is disposed instead of leaking a session', async () => {
    const releases = [];
    let sequence = 0;
    const setup = harness({ mount: () => new Promise(resolve => {
        const id = `session-${++sequence}`;
        releases.push(() => resolve({ id }));
    }) });
    const first = setup.controller.processMessage(0);
    for (let attempt = 0; attempt < 20 && releases.length < 1; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }
    const second = setup.controller.processMessage(0);
    for (let attempt = 0; attempt < 20 && releases.length < 2; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }
    releases[0]();
    await new Promise(resolve => setTimeout(resolve, 0));
    releases[1]();
    await Promise.all([first, second]);
    assert.deepEqual(setup.disposed, ['session-1']);
    assert.equal(setup.controller.mountedCount, 1);
});
