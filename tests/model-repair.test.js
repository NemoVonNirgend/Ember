import test from 'node:test';
import assert from 'node:assert/strict';

import { createModelRepairService } from '../src/repair/model-repair-service.js';

test('uses the current generation adapter and extracts only repaired source', async () => {
    let request = null;
    const service = createModelRepairService({
        generate: async value => {
            request = value;
            return '```javascript\nroot.textContent = "fixed";\n```';
        },
        diagnose: () => [{ severity: 'error', message: 'Example error' }],
    });
    const candidate = await service.propose({
        manifest: { runtime: 'javascript', permissions: [] },
        source: 'broken()',
    });
    assert.equal(candidate, 'root.textContent = "fixed";');
    assert.match(request.prompt, /Example error/);
    assert.match(request.prompt, /Do not return a manifest/);
});
