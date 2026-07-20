import test from 'node:test';
import assert from 'node:assert/strict';

import { createObservabilityService } from '../src/observability/observability-service.js';

test('keeps a bounded copy of runtime events', () => {
    const service = createObservabilityService({ limit: 2, now: () => 10 });
    const detail = { artifactId: 'one' };
    service.record('one', detail);
    detail.artifactId = 'mutated';
    service.record('two');
    service.record('three');
    assert.deepEqual(service.list().map(event => event.type), ['two', 'three']);
    assert.equal(service.size, 2);
});

test('notifies settings surfaces when runtime events change', () => {
    const service = createObservabilityService();
    let updates = 0;
    const unsubscribe = service.subscribe(() => { updates += 1; });
    service.record('one');
    service.clear();
    unsubscribe();
    service.record('two');
    assert.equal(updates, 2);
});
