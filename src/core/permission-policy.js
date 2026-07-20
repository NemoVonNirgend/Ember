// SPDX-License-Identifier: AGPL-3.0-or-later

import { artifactDigest } from '../artifacts/artifact-package.js';

async function decisionKey(artifact, ownership, crypto) {
    const permissions = [...artifact.manifest.permissions].sort().join('|');
    const digest = await artifactDigest(artifact, { crypto });
    const scope = `${String(ownership?.chatId ?? 'unknown')}:${String(ownership?.messageId ?? 'unknown')}`;
    return `v3:${digest}:${scope}:${permissions}`;
}

export function createPermissionPolicy({ settings, persist, confirm, crypto = globalThis.crypto }) {
    if (!settings.permissionDecisions) settings.permissionDecisions = {};
    const sessionDecisions = new Map();
    const pendingDecisions = new Map();

    return Object.freeze({
        async resolve({ artifact, ownership }) {
            const requested = artifact.manifest.permissions;
            if (!requested.length) return [];
            const key = await decisionKey(artifact, ownership, crypto);
            const remembered = settings.permissionDecisions[key];
            if (remembered === 'allow') return [...requested];
            if (remembered === 'deny') return [];
            if (sessionDecisions.has(key)) return sessionDecisions.get(key) ? [...requested] : [];

            if (!pendingDecisions.has(key)) {
                pendingDecisions.set(key, (async () => {
                    const result = await confirm({
                        title: artifact.manifest.title,
                        permissions: [...requested],
                        digest: await artifactDigest(artifact, { crypto }),
                    });
                    const allowed = result?.allowed === true;
                    sessionDecisions.set(key, allowed);
                    if (result?.remember === true) {
                        settings.permissionDecisions[key] = allowed ? 'allow' : 'deny';
                        await persist?.();
                    }
                    return allowed;
                })().finally(() => pendingDecisions.delete(key)));
            }
            const allowed = await pendingDecisions.get(key);
            return allowed ? [...requested] : [];
        },
        clear() {
            settings.permissionDecisions = {};
            sessionDecisions.clear();
            pendingDecisions.clear();
            persist?.();
        },
    });
}
