import test from 'node:test';
import assert from 'node:assert/strict';

import { createSecureHtmlRenderer } from '../src/html/secure-html-renderer.js';

test('sanitizes before morphing the existing message node', () => {
    const calls = [];
    const document = {
        createElement: tagName => ({ tagName: tagName.toUpperCase(), innerHTML: '' }),
    };
    const libraries = {
        sanitize(html, options) {
            calls.push(['sanitize', html, options]);
            return '<div>Safe</div>';
        },
        morphdom(target, desired, options) {
            calls.push(['morphdom', target, desired, options]);
        },
    };
    const renderer = createSecureHtmlRenderer({ document, libraries });
    const target = { tagName: 'DIV', dataset: {} };
    renderer.render(target, '<script>bad()</script><div>Safe</div>');
    assert.equal(calls[0][0], 'sanitize');
    assert.equal(calls[0][2].FORBID_TAGS.includes('style'), true);
    assert.equal(calls[0][2].FORBID_TAGS.includes('form'), true);
    assert.equal(calls[0][2].FORBID_TAGS.includes('a'), true);
    assert.equal(calls[0][2].FORBID_TAGS.includes('button'), true);
    assert.equal(calls[0][2].FORBID_TAGS.includes('textarea'), true);
    assert.equal(calls[0][2].FORBID_ATTR.includes('style'), true);
    assert.equal(calls[0][2].FORBID_ATTR.includes('id'), true);
    assert.equal(calls[0][2].FORBID_ATTR.includes('name'), true);
    assert.equal(calls[1][0], 'morphdom');
    assert.equal(calls[1][1], target);
    assert.equal(calls[1][3].childrenOnly, true);
    assert.equal(target.dataset.emberV4SecureHtml, 'true');
});
