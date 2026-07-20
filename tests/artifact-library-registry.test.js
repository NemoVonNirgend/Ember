import test from 'node:test';
import assert from 'node:assert/strict';

import { createArtifactLibraryResolver } from '../src/libraries/artifact-library-registry.js';

test('lazy-loads requested compatibility libraries once', async () => {
    const requests = [];
    const resolver = createArtifactLibraryResolver({
        baseUrl: '/ember',
        fetch: async url => {
            requests.push(url);
            return { ok: true, text: async () => 'window.d3 = {};' };
        },
    });
    const first = await resolver.resolve(['d3']);
    const second = await resolver.resolve(['d3']);
    assert.equal(first[0].global, 'd3');
    assert.equal(second[0].source, 'window.d3 = {};');
    assert.deepEqual(requests, ['/ember/lib/d3.v7.min.js']);
});

test('rejects unknown artifact libraries', async () => {
    const resolver = createArtifactLibraryResolver({ baseUrl: '/ember', fetch: async () => null });
    await assert.rejects(() => resolver.resolve(['unknown']), /Unknown Ember artifact library/);
});
