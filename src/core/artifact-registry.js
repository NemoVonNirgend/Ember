// SPDX-License-Identifier: AGPL-3.0-or-later

export function createArtifactRegistry() {
    const records = new Map();

    return Object.freeze({
        register(record) {
            if (!record?.id || typeof record.id !== 'string') {
                throw new TypeError('Artifact records require a string id.');
            }
            if (records.has(record.id)) {
                throw new Error(`Artifact already registered: ${record.id}`);
            }
            records.set(record.id, Object.freeze({ ...record }));
            return records.get(record.id);
        },
        get(id) {
            return records.get(id) ?? null;
        },
        remove(id) {
            return records.delete(id);
        },
        clear() {
            records.clear();
        },
        list() {
            return [...records.values()];
        },
        get size() {
            return records.size;
        },
    });
}
