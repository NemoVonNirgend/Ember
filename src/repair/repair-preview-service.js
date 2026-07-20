// SPDX-License-Identifier: AGPL-3.0-or-later

export function createRepairPreviewService({ libraries }) {
    return Object.freeze({
        compare(original, candidate) {
            const engine = libraries.createDiff();
            const diff = engine.diff_main(String(original), String(candidate));
            engine.diff_cleanupSemantic(diff);
            return Object.freeze({
                changed: diff.some(([operation]) => operation !== 0),
                chunks: Object.freeze(diff.map(([operation, text]) => Object.freeze({ operation, text }))),
            });
        },
    });
}
