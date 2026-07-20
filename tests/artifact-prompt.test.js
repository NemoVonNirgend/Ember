import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_ARTIFACT_PROMPT, createArtifactPromptController } from '../src/prompt/artifact-prompt.js';

test('uses one prompt slot and clears it when disabled', () => {
    const calls = [];
    const settings = { artifactPromptEnabled: true, artifactPrompt: DEFAULT_ARTIFACT_PROMPT };
    const controller = createArtifactPromptController({
        settings,
        setPrompt: (...args) => calls.push(args),
        position: 1,
        role: 0,
    });
    controller.apply();
    settings.artifactPromptEnabled = false;
    controller.apply();
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'ember4-artifacts');
    assert.match(calls[0][1], /no manifest or special wrapper is required/i);
    assert.match(calls[0][1], /```html/);
    assert.equal(calls[1][1], '');
});
