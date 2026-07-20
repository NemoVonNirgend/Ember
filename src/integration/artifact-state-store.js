// SPDX-License-Identifier: AGPL-3.0-or-later

const MAX_ARTIFACT_STATE_KEYS = 100;
const MAX_ARTIFACT_STATE_BYTES = 500_000;
const encoder = new TextEncoder();

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
            const current = artifacts[session.artifactKey] ?? {
                chatId: session.chatId,
                messageId: session.messageId,
                state: {},
            };
            if (current.chatId !== session.chatId) throw new Error('Artifact state belongs to another chat.');
            const nextState = structuredClone(current.state ?? {});
            nextState[key] = structuredClone(value);
            if (Object.keys(nextState).length > MAX_ARTIFACT_STATE_KEYS) {
                throw new Error(`Artifact state is limited to ${MAX_ARTIFACT_STATE_KEYS} keys.`);
            }
            const bytes = encoder.encode(JSON.stringify(nextState)).byteLength;
            if (bytes > MAX_ARTIFACT_STATE_BYTES) {
                throw new Error('Artifact state exceeds its aggregate storage limit.');
            }
            const record = artifacts[session.artifactKey] = {
                ...current,
                chatId: session.chatId,
                messageId: session.messageId,
                state: nextState,
            };
            record.updatedAt = Date.now();
            await save?.();
            return { saved: true };
        },
    });
}
