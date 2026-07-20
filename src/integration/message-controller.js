// SPDX-License-Identifier: AGPL-3.0-or-later

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
}) {
    const mountedByMessage = new Map();
    const listeners = [];

    function key(chatId, messageId) {
        return `${chatId}:${messageId}`;
    }

    function disposeMessage(chatId, messageId) {
        const messageKey = key(chatId, messageId);
        for (const id of mountedByMessage.get(messageKey) ?? []) iframeRuntime.dispose(id);
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
        const message = getChat()?.[messageId];
        if (!chatId || !message?.mes) return;
        const artifacts = parseArtifact(message.mes).filter(artifact => (
            artifact.format === 'ember-v2' || artifact.format === 'automatic-html' ||
            (artifact.format === 'legacy-javascript' && includeLegacy())
        ));
        disposeMessage(chatId, messageId);
        if (!artifacts.length) return;

        const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
        const textElement = messageElement?.querySelector('.mes_text');
        if (!textElement) return;
        const sourceBlocks = [...textElement.querySelectorAll('pre')].filter(pre => (
            /language-(?:ember|html|javascript|js)|lang-(?:ember|html|javascript|js)/.test(pre.querySelector('code')?.className ?? '') ||
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
            if (String(getChatId() ?? '') !== chatId || getChat()?.[messageId] !== message) break;
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
                const session = await iframeRuntime.mount(mountTarget, artifact, {
                    chatId,
                    messageId,
                    revision: revisionOf(message),
                    artifactKey: artifact.manifest.id || `${messageId}:${index}`,
                });
                if (String(getChatId() ?? '') !== chatId || getChat()?.[messageId] !== message) {
                    iframeRuntime.dispose(session.id);
                    container.remove();
                    break;
                }
                mounted.push(session.id);
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
                status.textContent = 'Failed';
                status.dataset.state = 'error';
                mountTarget.textContent = `Ember could not mount this artifact: ${error.message}`;
                container.classList.add('ember-v4-artifact-error');
                observe('artifact.mount_failed', { chatId, messageId: String(messageId), error: error.message });
            }
        }
        if (mounted.length) mountedByMessage.set(key(chatId, messageId), mounted);
    }

    function listen(event, handler) {
        if (!event) return;
        eventSource.on(event, handler);
        listeners.push([event, handler]);
    }

    function processExisting() {
        const chat = getChat() ?? [];
        chat.forEach((message, messageId) => {
            if (message?.mes) processMessage(messageId);
        });
    }

    return Object.freeze({
        install() {
            listen(events.USER_MESSAGE_RENDERED, processMessage);
            listen(events.CHARACTER_MESSAGE_RENDERED, processMessage);
            listen(events.MESSAGE_EDITED, processMessage);
            listen(events.MESSAGE_SWIPED, processMessage);
            listen(events.MESSAGE_DELETED, messageId => disposeMessage(String(getChatId() ?? ''), messageId));
            listen(events.CHAT_LOADED, processExisting);
            listen(events.CHAT_CHANGED, () => {
                for (const ids of mountedByMessage.values()) {
                    for (const id of ids) iframeRuntime.dispose(id);
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
            });
            processExisting();
        },
        disposeMessage,
        processMessage,
        processExisting,
        get mountedCount() {
            return [...mountedByMessage.values()].reduce((sum, ids) => sum + ids.length, 0);
        },
    });
}
