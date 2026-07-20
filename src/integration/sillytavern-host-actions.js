// SPDX-License-Identifier: AGPL-3.0-or-later

export function createSillyTavernHostActions({
    sendMessage,
    generate,
    setPrompt,
    promptPosition,
    promptRole,
    stateStore,
    fetchNetwork,
    observe = () => {},
    isSessionCurrent = () => true,
    hasUserActivation = () => true,
}) {
    const injectionKeys = new Map();
    const ephemeralKeys = new Set();

    let interactionInFlight = false;
    function injectionKey(session, id) {
        return `ember4:${session.chatId}:${session.messageId}:${session.artifactKey}:${id}`;
    }

    function clearKey(key) {
        setPrompt(key, '', promptPosition, 0, false, promptRole);
        ephemeralKeys.delete(key);
    }

    function requireCurrentSession(session) {
        if (!session || !isSessionCurrent(session)) {
            throw new Error('Artifact session is no longer active in the current chat.');
        }
    }

    async function runInteraction(request, action) {
        requireCurrentSession(request.session);
        if (!hasUserActivation(request)) throw new Error('Artifact action requires a user interaction.');
        if (interactionInFlight) throw new Error('Another artifact interaction is already in progress.');
        interactionInFlight = true;
        try {
            return await action();
        } finally {
            interactionInFlight = false;
        }
    }

    return Object.freeze({
        async submit(request) {
            return runInteraction(request, async () => {
                const { session, payload } = request;
                await sendMessage(payload.text);
                if (payload.generate) await generate('normal');
                observe('host.submit', { artifactId: session.id, generated: payload.generate });
                return { submitted: true, generated: payload.generate };
            });
        },
        async generate(request = {}) {
            return runInteraction(request, async () => {
                await generate('normal');
                observe('host.generate', { artifactId: request.session.id });
                return { generated: true };
            });
        },
        async inject({ session, payload }) {
            requireCurrentSession(session);
            const key = injectionKey(session, payload.id);
            setPrompt(key, payload.content, promptPosition, payload.depth, false, promptRole);
            if (!injectionKeys.has(session.id)) injectionKeys.set(session.id, new Set());
            injectionKeys.get(session.id).add(key);
            if (payload.ephemeral) ephemeralKeys.add(key);
            observe('host.inject', { artifactId: session.id, injectionId: payload.id, ephemeral: payload.ephemeral });
            return { injected: true, id: payload.id };
        },
        async readState({ session, payload }) {
            requireCurrentSession(session);
            observe('state.read', { artifactId: session.id, key: payload.key });
            return { key: payload.key, value: stateStore.read(session, payload.key) };
        },
        async writeState({ session, payload }) {
            requireCurrentSession(session);
            observe('state.write', { artifactId: session.id, key: payload.key });
            return stateStore.write(session, payload.key, payload.value);
        },
        async fetchNetwork(request) {
            requireCurrentSession(request.session);
            if (typeof fetchNetwork !== 'function') throw new Error('Artifact networking is unavailable.');
            return fetchNetwork(request);
        },
        clearEphemeral() {
            for (const key of [...ephemeralKeys]) clearKey(key);
        },
        disposeSession(session) {
            if (!session) return;
            for (const key of injectionKeys.get(session.id) ?? []) clearKey(key);
            injectionKeys.delete(session.id);
        },
    });
}
