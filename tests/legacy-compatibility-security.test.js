import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Ember 4 cannot fall back to same-origin legacy execution', async () => {
    const [bootstrap, legacy, settings] = await Promise.all([
        readFile(new URL('../bootstrap.js', import.meta.url), 'utf8'),
        readFile(new URL('../main.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/settings-controller.js', import.meta.url), 'utf8'),
    ]);
    assert.doesNotMatch(legacy, /allow-scripts allow-same-origin/);
    assert.match(legacy, /globalThis\.Ember\?\.version\?\.startsWith\('4\.'\)/);
    assert.match(legacy, /legacyFrame\.contentWindow !== event\.source/);
    assert.match(bootstrap, /get legacyJavascriptOwned\(\) \{\s*return true;/);
    assert.match(bootstrap, /get secureHtmlOwned\(\) \{\s*return true;/);
    assert.match(bootstrap, /get modernPromptOwned\(\) \{\s*return true;/);
    assert.equal(legacy.includes('const modernRuntimeOwnsMessage = /```(?:ember|javascript|js)\\b/i'), true);
    assert.match(legacy, /\(\?:script\|codeblock\)/);
    assert.doesNotMatch(settings, /data-ember-v4-migrate-legacy-js/);
});

test('trusted-parent static HTML forbids CSS, forms, and navigation', async () => {
    const source = await readFile(new URL('../src/html/secure-html-renderer.js', import.meta.url), 'utf8');
    assert.match(source, /'style', 'form', 'a'/);
    assert.match(source, /'srcdoc', 'style', 'action', 'formaction', 'target'/);
});
