// SPDX-License-Identifier: AGPL-3.0-or-later

import { analyzeHtmlCandidate } from './secure-html-analyzer.js';

export function createSecureHtmlController({
    document,
    eventSource,
    events,
    getChat,
    settings,
    renderer,
    formatMessage,
    observe = () => {},
}) {
    const processed = new Set();
    const listeners = [];
    let installed = false;

    function shouldRender(message) {
        if (!settings.secureHtmlRendererEnabled) return false;
        if (settings.secureHtmlMode === 'both') return true;
        return settings.secureHtmlMode === 'responses' && !message.is_user;
    }

    function restore(messageId) {
        const target = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
        const message = getChat()?.[messageId];
        if (!target || !message || !processed.has(String(messageId))) return false;
        renderer.restore(target, formatMessage(message, messageId));
        processed.delete(String(messageId));
        observe('html.restored', { messageId: String(messageId) });
        return true;
    }

    function process(messageId) {
        const message = getChat()?.[messageId];
        const target = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
        if (!message?.mes || !target) return false;
        if (!shouldRender(message)) return restore(messageId);
        if (/```ember\b/i.test(message.mes)) return restore(messageId);

        const analysis = analyzeHtmlCandidate(message.mes, { document });
        if (!analysis.eligible) return restore(messageId);
        // Scripted HTML belongs to the isolated artifact runtime. Leaving the
        // formatted source intact here also prevents this controller from
        // racing the asynchronous artifact mount.
        if (analysis.containsScripts) return restore(messageId);
        const sanitized = renderer.render(target, analysis.html);
        processed.add(String(messageId));
        observe('html.rendered', {
            messageId: String(messageId),
            fenced: analysis.fenced,
            elementCount: analysis.elementCount,
            removedUnsafeContent: sanitized !== analysis.html,
        });
        return true;
    }

    function processExisting() {
        (getChat() ?? []).forEach((message, id) => {
            if (message?.mes) process(id);
        });
    }

    function listen(event, handler) {
        if (!event) return;
        eventSource.on(event, handler);
        listeners.push([event, handler]);
    }

    return Object.freeze({
        install() {
            if (installed) return false;
            installed = true;
            listen(events.USER_MESSAGE_RENDERED, process);
            listen(events.CHARACTER_MESSAGE_RENDERED, process);
            listen(events.MESSAGE_EDITED, process);
            listen(events.MESSAGE_SWIPED, process);
            listen(events.CHAT_LOADED, processExisting);
            listen(events.CHAT_CHANGED, () => processed.clear());
            processExisting();
            return true;
        },
        uninstall() {
            if (!installed) return false;
            for (const [event, handler] of listeners.splice(0)) {
                if (typeof eventSource.removeListener === 'function') eventSource.removeListener(event, handler);
                else eventSource.off?.(event, handler);
            }
            for (const id of [...processed]) restore(Number(id));
            processed.clear();
            installed = false;
            return true;
        },
        process,
        processExisting,
        restoreAll() {
            for (const id of [...processed]) restore(Number(id));
        },
        get processedCount() {
            return processed.size;
        },
    });
}
