// SPDX-License-Identifier: AGPL-3.0-or-later

export const LEGACY_ARTIFACT_LIBRARIES = Object.freeze({
    d3: Object.freeze({ alias: 'd3', global: 'd3', path: 'lib/d3.v7.min.js' }),
    three: Object.freeze({ alias: 'three', global: 'THREE', path: 'lib/three.r128.min.js' }),
    p5: Object.freeze({ alias: 'p5', global: 'p5', path: 'lib/p5.v1.4.0.min.js' }),
    anime: Object.freeze({ alias: 'anime', global: 'anime', path: 'lib/anime.v3.2.1.min.js' }),
    chartjs: Object.freeze({ alias: 'chartjs', global: 'Chart', path: 'lib/chart.umd.js' }),
    matter: Object.freeze({ alias: 'matter', global: 'Matter', path: 'lib/matter.v0.18.0.min.js' }),
});

export function createArtifactLibraryResolver({ fetch, baseUrl }) {
    const cache = new Map();

    async function load(alias) {
        const definition = LEGACY_ARTIFACT_LIBRARIES[alias];
        if (!definition) throw new Error(`Unknown Ember artifact library: ${alias}`);
        if (!cache.has(alias)) {
            cache.set(alias, (async () => {
                const response = await fetch(`${baseUrl}/${definition.path}`);
                if (!response.ok) throw new Error(`Failed to load Ember library ${alias}: HTTP ${response.status}`);
                return Object.freeze({ ...definition, source: await response.text() });
            })());
        }
        return cache.get(alias);
    }

    return Object.freeze({
        async resolve(aliases = []) {
            return Promise.all([...new Set(aliases)].map(load));
        },
        definitions: LEGACY_ARTIFACT_LIBRARIES,
        clearCache() {
            cache.clear();
        },
    });
}
