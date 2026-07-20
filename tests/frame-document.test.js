import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFrameDocument } from '../src/runtime/frame-document.js';

test('builds a unique-origin compatible frame without same-origin permission', () => {
    const html = buildFrameDocument({
        artifactId: 'artifact-1',
        token: 'a'.repeat(64),
        source: 'root.textContent = "ready";',
    });
    assert.match(html, /default-src 'none'/);
    assert.doesNotMatch(html, /allow-same-origin/);
    assert.match(html, /new AsyncFunction/);
});

test('prevents artifact source from closing the runtime script element', () => {
    const html = buildFrameDocument({
        artifactId: 'artifact-1',
        token: 'a'.repeat(64),
        source: '</script><script>parent.attack()</script>',
    });
    assert.doesNotMatch(html, /config = .*<\/script>/);
    assert.match(html, /\\u003c\/script>/);
});

test('renders HTML artifacts before running their inline scripts', () => {
    const html = buildFrameDocument({
        artifactId: 'artifact-1',
        token: 'a'.repeat(64),
        runtime: 'html',
        source: '<button id="go">Go</button><script>root.dataset.ready = "true";</script>',
    });
    assert.match(html, /config\.runtime === 'html'/);
    assert.match(html, /template\.content\.querySelectorAll\('script'\)/);
    assert.match(html, /External scripts are not allowed/);
});

test('embeds reviewed compatibility libraries before the artifact runtime', () => {
    const html = buildFrameDocument({
        artifactId: 'artifact-1',
        token: 'a'.repeat(64),
        source: 'root.textContent = String(window.Chart);',
        librarySources: [{ source: 'window.Chart = function Chart() {};' }],
    });
    assert.ok(html.indexOf('window.Chart = function Chart() {};') < html.indexOf("'use strict';"));
});

test('replaces direct fetch and remote media with authenticated broker requests', () => {
    const html = buildFrameDocument({
        artifactId: 'artifact-1',
        token: 'a'.repeat(64),
        runtime: 'html',
        source: '<img src="https://example.com/pokemon.png"><script>await fetch("https://example.com/data")</script>',
    });
    assert.match(html, /globalThis\.fetch = brokerFetch/);
    assert.match(html, /send\('network\.fetch'/);
    assert.match(html, /URL\.createObjectURL/);
    assert.match(html, /brokerSourceProperty\(HTMLImageElement\.prototype\)/);
    assert.match(html, /hydrateMedia\(root\)/);
});
