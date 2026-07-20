// SPDX-License-Identifier: AGPL-3.0-or-later

import { createArtifactRegistry } from './artifact-registry.js';
import { HOST_LIBRARY_CATALOG } from '../libraries/host-library-catalog.js';
import { parseArtifact } from '../parser/artifact-parser.js';
import { validateBridgeMessage } from '../bridge/protocol.js';
import { createArtifactSessionStore } from '../runtime/artifact-session-store.js';
import { createIframeRuntime } from '../runtime/iframe-runtime.js';

export function createEmberRuntime({ iframeOptions = {}, observability = null, compatibility = {} } = {}) {
    const state = {
        phase: 'created',
        compatibilityLoaded: false,
    };
    const artifacts = createArtifactRegistry();
    const sessions = createArtifactSessionStore();
    const sessionInspector = Object.freeze({
        get: id => sessions.get(id),
        list: () => sessions.list(),
        get size() {
            return sessions.size;
        },
    });
    let iframeRuntime = null;

    const publicApi = Object.freeze({
        version: '4.0.0-dev.1',
        get phase() {
            return state.phase;
        },
        artifacts,
        sessions: sessionInspector,
        libraries: HOST_LIBRARY_CATALOG,
        observability,
        compatibility,
        parseArtifact,
        validateBridgeMessage,
        get iframeRuntime() {
            return iframeRuntime;
        },
    });

    return Object.freeze({
        publicApi,
        async start() {
            if (state.phase !== 'created') return;
            state.phase = 'starting';
            if (globalThis.window && globalThis.document) {
                iframeRuntime = createIframeRuntime({
                    window: globalThis.window,
                    document: globalThis.document,
                    sessions,
                    ...iframeOptions,
                });
                iframeRuntime.install();
            }
            state.phase = 'ready';
        },
        markCompatibilityLoaded() {
            state.compatibilityLoaded = true;
        },
    });
}
