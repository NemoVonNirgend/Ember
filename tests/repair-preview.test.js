import test from 'node:test';
import assert from 'node:assert/strict';

import { createRepairPreviewService } from '../src/repair/repair-preview-service.js';

test('creates structured reviewable diff chunks', () => {
    const libraries = {
        createDiff: () => ({
            diff_main: () => [[0, 'const x = '], [-1, '1'], [1, '2'], [0, ';']],
            diff_cleanupSemantic: () => {},
        }),
    };
    const service = createRepairPreviewService({ libraries });
    const preview = service.compare('const x = 1;', 'const x = 2;');
    assert.equal(preview.changed, true);
    assert.deepEqual(preview.chunks.map(chunk => chunk.operation), [0, -1, 1, 0]);
});
