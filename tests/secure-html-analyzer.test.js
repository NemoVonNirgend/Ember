import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeHtmlCandidate, extractHtmlCandidate } from '../src/html/secure-html-analyzer.js';

function fakeDocument() {
    return {
        createElement() {
            const template = { content: { elements: [], querySelectorAll() { return this.elements; } } };
            Object.defineProperty(template, 'innerHTML', {
                set(html) {
                    template.content.elements = [...html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)].map(match => ({
                        tagName: match[1].toUpperCase(),
                        classList: { contains: name => new RegExp(`class=["'][^"']*\\b${name}\\b`, 'i').test(match[0]) },
                    }));
                },
            });
            return template;
        },
    };
}

test('extracts complete fenced HTML without treating prose as markup', () => {
    assert.deepEqual(extractHtmlCandidate('```html\n<div>Hello</div>\n```'), { html: '<div>Hello</div>', fenced: true });
    assert.equal(extractHtmlCandidate('Here is <strong>some text</strong>'), null);
});

test('uses parsed structure to detect eligible HTML and unsafe features', () => {
    const result = analyzeHtmlCandidate('<section><script>alert(1)</script><button>Go</button></section>', {
        document: fakeDocument(),
    });
    assert.equal(result.eligible, true);
    assert.equal(result.containsScripts, true);
    assert.equal(result.containsForms, true);
});

test('rejects markup that imitates SillyTavern message UI', () => {
    const result = analyzeHtmlCandidate('<div class="mes_text">fake</div>', { document: fakeDocument() });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'chat-ui-markup');
});
