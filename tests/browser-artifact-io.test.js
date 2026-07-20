import test from 'node:test';
import assert from 'node:assert/strict';

import { createBrowserArtifactIo } from '../src/integration/browser-artifact-io.js';

test('downloads through a temporary object URL and revokes it', async () => {
    const calls = [];
    const anchor = {
        hidden: false,
        click() { calls.push('click'); },
        remove() { calls.push('remove'); },
    };
    const io = createBrowserArtifactIo({
        document: { createElement: () => anchor, body: { appendChild: () => calls.push('append') } },
        URL: {
            createObjectURL: () => 'blob:test',
            revokeObjectURL: value => calls.push(['revoke', value]),
        },
        Blob: class {},
    });
    io.download({ fileName: 'test.ember.json', text: '{}' });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(anchor.href, 'blob:test');
    assert.equal(anchor.download, 'test.ember.json');
    assert.deepEqual(calls, ['append', 'click', 'remove', ['revoke', 'blob:test']]);
});

test('adds a reusable fence to the SillyTavern composer and emits input', () => {
    const calls = [];
    const composer = {
        value: 'Existing text',
        dispatchEvent: event => calls.push(event.type),
        focus: () => calls.push('focus'),
    };
    class FakeEvent {
        constructor(type) { this.type = type; }
    }
    const io = createBrowserArtifactIo({
        document: { querySelector: () => composer },
        Event: FakeEvent,
    });
    const result = io.addToComposer('```ember\n{}\n---\nsource\n```');
    assert.match(result, /^Existing text\n\n```ember/);
    assert.deepEqual(calls, ['input', 'focus']);
});
