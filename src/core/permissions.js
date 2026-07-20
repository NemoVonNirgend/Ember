// SPDX-License-Identifier: AGPL-3.0-or-later

export const ARTIFACT_PERMISSIONS = Object.freeze([
    'host.submit',
    'host.inject',
    'host.generate',
    'host.state.read',
    'host.state.write',
    'network.fetch',
]);

const permissionSet = new Set(ARTIFACT_PERMISSIONS);

export function normalizePermissions(input = []) {
    if (!Array.isArray(input)) {
        throw new TypeError('Artifact permissions must be an array.');
    }

    const permissions = [...new Set(input)];
    const unknown = permissions.filter(value => !permissionSet.has(value));
    if (unknown.length) {
        throw new Error(`Unknown artifact permission(s): ${unknown.join(', ')}`);
    }
    return Object.freeze(permissions);
}

export function hasPermission(granted, requested) {
    return Array.isArray(granted) && granted.includes(requested);
}
