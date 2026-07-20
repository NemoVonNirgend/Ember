import test from 'node:test';
import assert from 'node:assert/strict';

import { createTrustedHostLibraries } from '../src/libraries/trusted-host-libraries.js';

test('wraps SillyTavern libraries behind a small trusted-host surface', () => {
    class Diff {}
    const libraries = createTrustedHostLibraries({
        DOMPurify: { sanitize: html => `safe:${html}` },
        yaml: { parse: text => ({ text }) },
        hljs: { highlightElement: element => { element.highlighted = true; } },
        morphdom: () => {},
        DiffMatchPatch: Diff,
    });
    assert.equal(libraries.sanitize('<b>x</b>'), 'safe:<b>x</b>');
    assert.deepEqual(libraries.parseYaml('id: one'), { text: 'id: one' });
    assert.ok(libraries.createDiff() instanceof Diff);
});
