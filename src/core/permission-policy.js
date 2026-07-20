// SPDX-License-Identifier: AGPL-3.0-or-later

function decisionKey(permissions) {
    return [...permissions].sort().join('|');
}

export function createPermissionPolicy({ settings, persist, confirm }) {
    if (!settings.permissionDecisions) settings.permissionDecisions = {};
    const sessionDecisions = new Map();

    return Object.freeze({
        async resolve({ artifact }) {
            const requested = artifact.manifest.permissions;
            if (!requested.length) return [];
            const key = decisionKey(requested);
            const remembered = settings.permissionDecisions[key];
            if (remembered === 'allow') return [...requested];
            if (remembered === 'deny') return [];
            if (sessionDecisions.has(key)) return sessionDecisions.get(key) ? [...requested] : [];

            const result = await confirm({
                title: artifact.manifest.title,
                permissions: [...requested],
            });
            const allowed = result?.allowed === true;
            sessionDecisions.set(key, allowed);
            if (result?.remember === true) {
                settings.permissionDecisions[key] = allowed ? 'allow' : 'deny';
                await persist?.();
            }
            return allowed ? [...requested] : [];
        },
        clear() {
            settings.permissionDecisions = {};
            sessionDecisions.clear();
            persist?.();
        },
    });
}
