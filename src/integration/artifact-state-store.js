// SPDX-License-Identifier: AGPL-3.0-or-later

function ensureRoot(metadata) {
    metadata.emberV4 ??= { schemaVersion: 1, artifacts: {} };
    metadata.emberV4.artifacts ??= {};
    return metadata.emberV4.artifacts;
}

export function createArtifactStateStore({ getMetadata, save }) {
    return Object.freeze({
        read(session, key) {
            const artifacts = ensureRoot(getMetadata());
            return artifacts[session.artifactKey]?.state?.[key] ?? null;
        },
        async write(session, key, value) {
            const artifacts = ensureRoot(getMetadata());
            const record = artifacts[session.artifactKey] ??= {
                chatId: session.chatId,
                messageId: session.messageId,
                state: {},
            };
            record.state[key] = structuredClone(value);
            record.updatedAt = Date.now();
            await save?.();
            return { saved: true };
        },
    });
}
