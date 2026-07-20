// SPDX-License-Identifier: AGPL-3.0-or-later

export function createObservabilityService({ limit = 100, now = () => Date.now() } = {}) {
    const events = [];
    const subscribers = new Set();

    function notify() {
        for (const subscriber of subscribers) subscriber();
    }

    return Object.freeze({
        record(type, detail = {}) {
            events.push(Object.freeze({ type, detail: structuredClone(detail), timestamp: now() }));
            if (events.length > limit) events.splice(0, events.length - limit);
            notify();
        },
        list() {
            return [...events];
        },
        clear() {
            events.length = 0;
            notify();
        },
        subscribe(listener) {
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        },
        get size() {
            return events.length;
        },
    });
}
