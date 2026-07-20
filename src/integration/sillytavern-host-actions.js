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
}) {
    const injectionKeys = new Map();
    const ephemeralKeys = new Set();

    function injectionKey(session, id) {
        return `ember4:${session.chatId}:${session.messageId}:${session.artifactKey}:${id}`;
    }

    function clearKey(key) {
        setPrompt(key, '', promptPosition, 0, false, promptRole);
        ephemeralKeys.delete(key);
    }

    return Object.freeze({
        async submit({ session, payload }) {
            await sendMessage(payload.text);
            if (payload.generate) await generate('normal');
            observe('host.submit', { artifactId: session.id, generated: payload.generate });
            return { submitted: true, generated: payload.generate };
        },
        async generate({ session } = {}) {
            await generate('normal');
            observe('host.generate', { artifactId: session?.id });
            return { generated: true };
        },
        async inject({ session, payload }) {
            const key = injectionKey(session, payload.id);
            setPrompt(key, payload.content, promptPosition, payload.depth, false, promptRole);
            if (!injectionKeys.has(session.id)) injectionKeys.set(session.id, new Set());
            injectionKeys.get(session.id).add(key);
            if (payload.ephemeral) ephemeralKeys.add(key);
            observe('host.inject', { artifactId: session.id, injectionId: payload.id, ephemeral: payload.ephemeral });
            return { injected: true, id: payload.id };
        },
        async readState({ session, payload }) {
            observe('state.read', { artifactId: session.id, key: payload.key });
            return { key: payload.key, value: stateStore.read(session, payload.key) };
        },
        async writeState({ session, payload }) {
            observe('state.write', { artifactId: session.id, key: payload.key });
            return stateStore.write(session, payload.key, payload.value);
        },
        async fetchNetwork(request) {
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
