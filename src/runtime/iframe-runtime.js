// SPDX-License-Identifier: AGPL-3.0-or-later

import { createMessageRouter } from '../bridge/message-router.js';
import { buildFrameDocument } from './frame-document.js';

const DEFAULT_MAX_HEIGHT = 800;

export function createIframeRuntime({
    window,
    document,
    sessions,
    actions = {},
    maxHeight = DEFAULT_MAX_HEIGHT,
    onError = () => {},
    onRejected = () => {},
    resolvePermissions = () => [],
    resolveLibraries = async () => [],
}) {
    if (!window || !document || !sessions) {
        throw new Error('Iframe runtime requires window, document, and sessions.');
    }

    const handlers = {
        'artifact.resize': ({ session, payload }) => {
            const height = Math.max(1, Math.min(maxHeight, Number(payload.height) || 1));
            const iframe = document.querySelector(`[data-ember-artifact-id="${session.id}"]`);
            if (iframe) iframe.style.height = `${height}px`;
        },
        'artifact.error': ({ session, payload }) => onError({ session, error: payload }),
        'host.submit': actions.submit,
        'host.inject': actions.inject,
        'host.generate': actions.generate,
        'network.fetch': actions.fetchNetwork,
        'state.read': actions.readState,
        'state.write': actions.writeState,
    };
    const router = createMessageRouter({ sessions, handlers, onRejected });
    let installed = false;

    return Object.freeze({
        install() {
            if (installed) return false;
            window.addEventListener('message', router);
            installed = true;
            return true;
        },
        uninstall() {
            if (!installed) return false;
            window.removeEventListener('message', router);
            installed = false;
            for (const session of sessions.list()) sessions.dispose(session.id);
            return true;
        },
        async mount(container, artifact, ownership) {
            if (!container?.appendChild) throw new Error('Artifact mount requires a container.');
            const grantedPermissions = await resolvePermissions({ artifact, ownership });
            const librarySources = await resolveLibraries(artifact.manifest.libraries);
            const created = sessions.create({
                ...ownership,
                requestedPermissions: artifact.manifest.permissions,
                grantedPermissions,
            });
            const iframe = document.createElement('iframe');
            iframe.className = 'ember-v4-artifact-frame';
            iframe.dataset.emberArtifactId = created.id;
            iframe.setAttribute('sandbox', 'allow-scripts');
            iframe.setAttribute('title', artifact.manifest.title);
            iframe.setAttribute('loading', 'lazy');
            iframe.style.width = '100%';
            iframe.style.height = '1px';
            iframe.style.border = '0';
            iframe.srcdoc = buildFrameDocument({
                artifactId: created.id,
                token: created.token,
                source: artifact.source,
                runtime: artifact.manifest.runtime,
                title: artifact.manifest.title,
                librarySources,
            });
            container.appendChild(iframe);
            sessions.attach(created.id, { iframe, frameWindow: iframe.contentWindow });
            return sessions.get(created.id);
        },
        dispose(id) {
            actions.disposeSession?.(sessions.get(id));
            return sessions.dispose(id);
        },
        disposeMessage(chatId, messageId) {
            let count = 0;
            for (const session of sessions.list()) {
                if (session.chatId === String(chatId) && session.messageId === String(messageId)) {
                    this.dispose(session.id);
                    count += 1;
                }
            }
            return count;
        },
        disposeChat(chatId) {
            let count = 0;
            for (const session of sessions.list()) {
                if (session.chatId === String(chatId)) {
                    this.dispose(session.id);
                    count += 1;
                }
            }
            return count;
        },
        routeMessage: router,
        get installed() {
            return installed;
        },
    });
}
