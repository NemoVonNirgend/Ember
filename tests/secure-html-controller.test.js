import test from 'node:test';
import assert from 'node:assert/strict';

import { createSecureHtmlController } from '../src/html/secure-html-controller.js';

test('secure HTML controller installs and uninstalls listeners exactly once', () => {
    const listeners = new Map();
    const eventSource = {
        on(event, handler) { listeners.set(event, [...(listeners.get(event) ?? []), handler]); },
        removeListener(event, handler) {
            listeners.set(event, (listeners.get(event) ?? []).filter(value => value !== handler));
        },
    };
    const controller = createSecureHtmlController({
        document: { querySelector: () => null },
        eventSource,
        events: {
            USER_MESSAGE_RENDERED: 'user',
            CHARACTER_MESSAGE_RENDERED: 'character',
            MESSAGE_EDITED: 'edited',
            MESSAGE_SWIPED: 'swiped',
            CHAT_LOADED: 'loaded',
            CHAT_CHANGED: 'changed',
        },
        getChat: () => [],
        settings: { secureHtmlRendererEnabled: true, secureHtmlMode: 'responses' },
        renderer: { render: () => '', restore: () => {} },
        formatMessage: () => '',
    });
    assert.equal(controller.install(), true);
    assert.equal(controller.install(), false);
    assert.equal([...listeners.values()].reduce((sum, values) => sum + values.length, 0), 6);
    assert.equal(controller.uninstall(), true);
    assert.equal(controller.uninstall(), false);
    assert.equal([...listeners.values()].reduce((sum, values) => sum + values.length, 0), 0);
});
