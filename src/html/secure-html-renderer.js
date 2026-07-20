// SPDX-License-Identifier: AGPL-3.0-or-later

const SANITIZE_OPTIONS = Object.freeze({
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: true,
});

export function createSecureHtmlRenderer({ document, libraries }) {
    function updateChildren(target, sanitizedHtml) {
        const desired = document.createElement(target.tagName.toLowerCase());
        desired.innerHTML = sanitizedHtml;
        libraries.morphdom(target, desired, {
            childrenOnly: true,
            onBeforeElUpdated(fromElement, toElement) {
                if (fromElement.dataset?.emberV4Preserve === 'true') return false;
                return true;
            },
        });
    }

    return Object.freeze({
        sanitize(html) {
            return libraries.sanitize(html, SANITIZE_OPTIONS);
        },
        render(target, html) {
            const sanitized = this.sanitize(html);
            updateChildren(target, sanitized);
            target.dataset.emberV4SecureHtml = 'true';
            return sanitized;
        },
        restore(target, formattedHtml) {
            updateChildren(target, formattedHtml);
            delete target.dataset.emberV4SecureHtml;
        },
    });
}
