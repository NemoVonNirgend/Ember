import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArtifact } from '../src/parser/artifact-parser.js';

test('parses an Ember v2 artifact', () => {
    const [artifact] = parseArtifact(`\`\`\`ember
{"version":2,"title":"Tracker","runtime":"html","permissions":["host.state.write"],"libraries":[]}
---
<div>Tracker</div>
\`\`\``);

    assert.equal(artifact.format, 'ember-v2');
    assert.equal(artifact.manifest.title, 'Tracker');
    assert.deepEqual(artifact.manifest.permissions, ['host.state.write']);
});

test('preserves legacy JavaScript blocks for compatibility', () => {
    const [artifact] = parseArtifact('```javascript\nroot.textContent = "hello";\n```');
    assert.equal(artifact.format, 'legacy-javascript');
    assert.match(artifact.source, /root\.textContent/);
});

test('promotes ordinary scripted HTML without a manifest', () => {
    const [artifact] = parseArtifact(`\`\`\`html
<main><button id="battle">Battle</button></main>
<script>
document.getElementById('battle').onclick = () => ember.submit({ text: 'Attack', generate: true });
</script>
\`\`\``);

    assert.equal(artifact.format, 'automatic-html');
    assert.equal(artifact.manifest.runtime, 'html');
    assert.deepEqual(artifact.manifest.permissions, ['host.submit']);
    assert.match(artifact.source, /<button/);
});

test('infers network access from ordinary fetch and dynamic media code', () => {
    const artifacts = parseArtifact(`\`\`\`js
const pokemon = await fetch('https://pokeapi.co/api/v2/pokemon/25').then(response => response.json());
const image = document.createElement('img');
image.src = pokemon.sprites.front_default;
root.append(image);
\`\`\``);
    assert.deepEqual(artifacts[0].manifest.permissions, ['network.fetch']);
});

test('leaves ordinary static HTML on the safe formatting path', () => {
    assert.deepEqual(parseArtifact('```html\n<section>Character card</section>\n```'), []);
});

test('promotes a raw complete HTML response containing scripts', () => {
    const [artifact] = parseArtifact('<!doctype html><html><body><h1>Tracker</h1><script>root.dataset.ready = "yes";</script></body></html>');
    assert.equal(artifact.format, 'automatic-html');
    assert.equal(artifact.manifest.runtime, 'html');
});

test('collects modern and legacy artifacts from the same message', () => {
    const artifacts = parseArtifact(`\`\`\`ember
{"version":2,"title":"Modern","runtime":"html","permissions":[],"libraries":[]}
---
<div>Modern</div>
\`\`\`
\`\`\`javascript
root.textContent = "Legacy";
\`\`\``);

    assert.deepEqual(artifacts.map(artifact => artifact.format), [
        'ember-v2',
        'legacy-javascript',
    ]);
});

test('preserves source order across ordinary HTML and JavaScript blocks', () => {
    const artifacts = parseArtifact(`\`\`\`html
<button>First</button><script>root.dataset.order = 'first';</script>
\`\`\`
\`\`\`js
root.dataset.order = 'second';
\`\`\``);

    assert.deepEqual(artifacts.map(artifact => artifact.format), [
        'automatic-html',
        'legacy-javascript',
    ]);
});

test('rejects unknown permissions', () => {
    assert.throws(() => parseArtifact(`\`\`\`ember
{"version":2,"runtime":"html","permissions":["host.everything"]}
---
<div></div>
\`\`\``), /Unknown artifact permission/);
});

test('accepts YAML manifests through the SillyTavern parser adapter', () => {
    const parseManifest = text => {
        assert.match(text, /version: 2/);
        return {
            version: 2,
            id: 'yaml-choice',
            title: 'YAML choice',
            runtime: 'html',
            permissions: ['host.submit'],
            libraries: [],
        };
    };
    const [artifact] = parseArtifact(`\`\`\`ember
version: 2
id: yaml-choice
title: YAML choice
runtime: html
permissions:
  - host.submit
libraries: []
---
<button>Go</button>
\`\`\``, { parseManifest });
    assert.equal(artifact.manifest.id, 'yaml-choice');
});

test('migrates legacy frontmatter and infers used libraries and permissions', () => {
    const parseManifest = () => ({ libs: ['three'], id: 'legacy-scene' });
    const [artifact] = parseArtifact(`\`\`\`javascript
---
libs:
  - three
id: legacy-scene
---
const chart = new Chart(root, {});
ember.inject({ content: 'ready' });
\`\`\``, { parseManifest });
    assert.equal(artifact.format, 'legacy-javascript');
    assert.equal(artifact.manifest.id, 'legacy-scene');
    assert.deepEqual(artifact.manifest.libraries, ['three', 'chartjs']);
    assert.deepEqual(artifact.manifest.permissions, ['host.inject']);
    assert.doesNotMatch(artifact.source, /^---/);
});
