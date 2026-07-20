// SPDX-License-Identifier: AGPL-3.0-or-later

import { artifactDigest } from '../artifacts/artifact-package.js';

export function revisionOf(message) {
    const text = `${message?.swipe_id ?? 0}:${message?.mes ?? ''}`;
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

export function createMessageController({
    eventSource,
    events,
    getChat,
    getChatId,
    document,
    parseArtifact,
    iframeRuntime,
    openInspector = () => {},
    observe = () => {},
    includeLegacy = () => false,
    artifactRegistry = null,
}) {
    const mountedByMessage = new Map();
    const processVersions = new Map();
    const listeners = [];
    let installed = false;

    function key(chatId, messageId) {
        return `${chatId}:${messageId}`;
    }

    function disposeMessage(chatId, messageId) {
        const messageKey = key(chatId, messageId);
        for (const id of mountedByMessage.get(messageKey) ?? []) {
            artifactRegistry?.remove(id);
            iframeRuntime.dispose(id);
        }
        mountedByMessage.delete(messageKey);
        const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
        messageElement?.querySelectorAll('.ember-v4-artifact-container').forEach(element => element.remove());
        messageElement?.querySelectorAll('[data-ember-v4-source]').forEach(element => {
            element.style.display = '';
            delete element.dataset.emberV4Source;
        });
        messageElement?.querySelectorAll('[data-ember-v4-source-wrapper]').forEach(wrapper => {
            while (wrapper.firstChild) wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
            wrapper.remove();
        });
    }

    async function processMessage(messageId) {
        const chatId = String(getChatId() ?? '');
        const messageKey = key(chatId, messageId);
        const processVersion = (processVersions.get(messageKey) ?? 0) + 1;
        processVersions.set(messageKey, processVersion);
        disposeMessage(chatId, messageId);
        const message = getChat()?.[messageId];
        if (!chatId || !message?.mes) return;
        const revision = revisionOf(message);
        const isCurrent = () => processVersions.get(messageKey) === processVersion &&
            String(getChatId() ?? '') === chatId &&
            revisionOf(getChat()?.[messageId]) === revision;
        let artifacts;
        try {
            artifacts = parseArtifact(message.mes).filter(artifact => (
                artifact.format === 'ember-v2' || artifact.format === 'automatic-html' ||
                (artifact.format === 'legacy-javascript' && includeLegacy())
            ));
        } catch (error) {
            observe('artifact.parse_failed', { chatId, messageId: String(messageId), error: error.message });
            return;
        }
        if (!artifacts.length) return;

        const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
        const textElement = messageElement?.querySelector('.mes_text');
        if (!textElement) return;
        const sourceBlocks = [...textElement.querySelectorAll('pre')].filter(pre => (
            /language-(?:ember|javascript|js)|lang-(?:ember|javascript|js)/.test(pre.querySelector('code')?.className ?? '') ||
            (/(?:language|lang)-html/.test(pre.querySelector('code')?.className ?? '') && /<script\b/i.test(pre.textContent ?? '')) ||
            pre.textContent?.trimStart().startsWith('{"version":2')
        ));
        if (!sourceBlocks.length && artifacts.length === 1 && artifacts[0].format === 'automatic-html' &&
            message.mes.trimStart().startsWith('<')) {
            const sourceWrapper = document.createElement('div');
            sourceWrapper.dataset.emberV4SourceWrapper = 'true';
            sourceWrapper.style.display = 'none';
            while (textElement.firstChild) sourceWrapper.appendChild(textElement.firstChild);
            textElement.appendChild(sourceWrapper);
        }
        const mounted = [];

        for (let index = 0; index < artifacts.length; index += 1) {
            if (!isCurrent()) break;
            const artifact = artifacts[index];
            const container = document.createElement('div');
            container.className = 'ember-v4-artifact-container';
            const toolbar = document.createElement('div');
            toolbar.className = 'ember-v4-artifact-toolbar';
            const title = document.createElement('strong');
            title.textContent = artifact.manifest.title;
            const status = document.createElement('span');
            status.className = 'ember-v4-artifact-status';
            status.textContent = 'Requesting permission…';
            const inspect = document.createElement('button');
            inspect.type = 'button';
            inspect.className = 'menu_button ember-v4-inspect-button';
            inspect.textContent = 'Inspect';
            inspect.disabled = true;
            toolbar.append(title, status, inspect);
            const mountTarget = document.createElement('div');
            mountTarget.className = 'ember-v4-artifact-mount';
            container.append(toolbar, mountTarget);
            textElement.appendChild(container);
            try {
                const digest = await artifactDigest(artifact);
                if (!isCurrent()) throw new Error('Artifact mount was superseded.');
                const session = await iframeRuntime.mount(mountTarget, artifact, {
                    chatId,
                    messageId,
                    revision,
                    artifactKey: `${artifact.manifest.id || `${messageId}:${index}`}:${digest}`,
                });
                if (!isCurrent()) {
                    iframeRuntime.dispose(session.id);
                    container.remove();
                    break;
                }
                mounted.push(session.id);
                artifactRegistry?.register({ id: session.id, artifact, session });
                status.textContent = 'Active';
                status.dataset.state = 'active';
                inspect.disabled = false;
                inspect.addEventListener('click', () => openInspector({ artifact, session }));
                observe('artifact.mounted', {
                    artifactId: session.id,
                    chatId,
                    messageId: String(messageId),
                    runtime: artifact.manifest.runtime,
                });
                if (sourceBlocks[index]) {
                    sourceBlocks[index].dataset.emberV4Source = 'true';
                    sourceBlocks[index].style.display = 'none';
                }
            } catch (error) {
                if (!isCurrent()) {
                    container.remove();
                    break;
                }
                status.textContent = 'Failed';
                status.dataset.state = 'error';
                mountTarget.textContent = `Ember could not mount this artifact: ${error.message}`;
                container.classList.add('ember-v4-artifact-error');
                observe('artifact.mount_failed', { chatId, messageId: String(messageId), error: error.message });
            }
        }
        if (mounted.length && isCurrent()) mountedByMessage.set(messageKey, mounted);
        else for (const id of mounted) {
            artifactRegistry?.remove(id);
            iframeRuntime.dispose(id);
        }
    }

    function listen(event, handler) {
        if (!event) return;
        eventSource.on(event, handler);
        listeners.push([event, handler]);
    }

    function processSafely(messageId) {
        processMessage(messageId).catch(error => observe('artifact.process_failed', {
            chatId: String(getChatId() ?? ''),
            messageId: String(messageId),
            error: error.message,
        }));
    }

    function processExisting() {
        const chat = getChat() ?? [];
        chat.forEach((message, messageId) => {
            if (message?.mes) processSafely(messageId);
        });
    }

    function disposeAll() {
        processVersions.clear();
        for (const ids of mountedByMessage.values()) {
            for (const id of ids) {
                artifactRegistry?.remove(id);
                iframeRuntime.dispose(id);
            }
        }
        document.querySelectorAll('.ember-v4-artifact-container').forEach(element => element.remove());
        document.querySelectorAll('[data-ember-v4-source]').forEach(element => {
            element.style.display = '';
            delete element.dataset.emberV4Source;
        });
        document.querySelectorAll('[data-ember-v4-source-wrapper]').forEach(wrapper => {
            while (wrapper.firstChild) wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
            wrapper.remove();
        });
        mountedByMessage.clear();
    }

    return Object.freeze({
        install() {
            if (installed) return false;
            installed = true;
            listen(events.USER_MESSAGE_RENDERED, processSafely);
            listen(events.CHARACTER_MESSAGE_RENDERED, processSafely);
            listen(events.MESSAGE_EDITED, processSafely);
            listen(events.MESSAGE_SWIPED, processSafely);
            listen(events.MESSAGE_DELETED, messageId => disposeMessage(String(getChatId() ?? ''), messageId));
            listen(events.CHAT_LOADED, processExisting);
            listen(events.CHAT_CHANGED, disposeAll);
            processExisting();
            return true;
        },
        uninstall() {
            if (!installed) return false;
            for (const [event, handler] of listeners.splice(0)) {
                if (typeof eventSource.removeListener === 'function') eventSource.removeListener(event, handler);
                else eventSource.off?.(event, handler);
            }
            disposeAll();
            installed = false;
            return true;
        },
        disposeMessage,
        processMessage,
        processExisting,
        get mountedCount() {
            return [...mountedByMessage.values()].reduce((sum, ids) => sum + ids.length, 0);
        },
    });
}
