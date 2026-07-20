// SPDX-License-Identifier: AGPL-3.0-or-later

const FENCED_HTML = /^```html\s*\n([\s\S]*?)\n```\s*$/i;

export function extractHtmlCandidate(message) {
    if (typeof message !== 'string') return null;
    const fenced = message.match(FENCED_HTML);
    if (fenced) return { html: fenced[1].trim(), fenced: true };
    const trimmed = message.trim();
    if (!trimmed.startsWith('<')) return null;
    return { html: trimmed, fenced: false };
}

export function analyzeHtmlCandidate(message, { document }) {
    const candidate = extractHtmlCandidate(message);
    if (!candidate) return { eligible: false, reason: 'not-html' };

    const template = document.createElement('template');
    template.innerHTML = candidate.html;
    const elements = [...template.content.querySelectorAll('*')];
    if (!elements.length) return { eligible: false, reason: 'no-elements' };
    if (elements.some(element => element.classList?.contains('mes') || element.classList?.contains('mes_text'))) {
        return { eligible: false, reason: 'chat-ui-markup' };
    }

    return {
        eligible: true,
        html: candidate.html,
        fenced: candidate.fenced,
        elementCount: elements.length,
        containsScripts: elements.some(element => element.tagName === 'SCRIPT'),
        containsForms: elements.some(element => ['FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(element.tagName)),
    };
}
