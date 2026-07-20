// SPDX-License-Identifier: AGPL-3.0-or-later

export const DEFAULT_ARTIFACT_PROMPT = `## Interactive responses

When an interactive interface materially improves the response, write ordinary HTML in an \`html\` code fence or ordinary JavaScript in a \`js\` code fence. Ember runs it automatically; no manifest or special wrapper is required. Do not create an interface merely to decorate ordinary prose.

HTML may include CSS and inline scripts:

\`\`\`html
<button id="go">Continue</button>
<script>
document.getElementById('go').addEventListener('click', () => {
  ember.submit({ text: 'I continue.', generate: true });
});
</script>
\`\`\`

JavaScript receives \`root\` and \`ember\` and may use top-level \`await\`. Available calls are \`ember.submit({ text, generate })\`, \`ember.inject({ id, content, ephemeral })\`, \`ember.generate()\`, \`ember.state.read({ key })\`, and \`ember.state.write({ key, value })\`. Standard \`fetch()\` works for CORS-enabled public APIs, and remote image/audio URLs are loaded through Ember. Ember infers required capabilities from source. Host calls return promises. External scripts and streaming network APIs are unavailable.`;

export function createArtifactPromptController({ settings, setPrompt, position, role, promptId = 'ember4-artifacts' }) {
    return Object.freeze({
        apply() {
            const content = settings.artifactPromptEnabled
                ? String(settings.artifactPrompt || DEFAULT_ARTIFACT_PROMPT)
                : '';
            setPrompt(promptId, content, position, 4, false, role);
            return content;
        },
        restore() {
            settings.artifactPrompt = DEFAULT_ARTIFACT_PROMPT;
            return this.apply();
        },
        clear() {
            setPrompt(promptId, '', position, 4, false, role);
        },
    });
}
