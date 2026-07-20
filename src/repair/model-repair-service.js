// SPDX-License-Identifier: AGPL-3.0-or-later

function extractSource(text, runtime) {
    const language = runtime === 'html' ? 'html' : '(?:javascript|js)';
    const fenced = text.match(new RegExp(`\`\`\`(?:${language})\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'i'));
    return (fenced?.[1] ?? text).trim();
}

export function createModelRepairService({ generate, diagnose }) {
    return Object.freeze({
        async propose(artifact) {
            const diagnostics = diagnose(artifact);
            const constraints = diagnostics.length
                ? diagnostics.map(entry => `- [${entry.severity}] ${entry.message}`).join('\n')
                : '- No deterministic errors were detected; preserve behavior and make only necessary corrections.';
            const language = artifact.manifest.runtime === 'html' ? 'html' : 'javascript';
            const prompt = `You repair code for an isolated Ember v2 artifact.

Return only the complete corrected artifact source in one ${language} code fence. Do not return a manifest, explanations, or commentary.

Runtime rules:
- The artifact cannot access parent, top, opener, SillyTavern globals, external scripts, or the network.
- JavaScript receives root and ember and supports top-level await.
- HTML is mounted before its inline scripts execute.
- Host actions use ember.submit, ember.inject, ember.generate, ember.state.read, and ember.state.write.
- Preserve the artifact's intended behavior and requested permission boundary.

Deterministic diagnostics:
${constraints}

Current source:
\`\`\`${language}
${artifact.source}
\`\`\``;
            const response = await generate({ prompt, responseLength: 4096 });
            const candidate = extractSource(String(response ?? ''), artifact.manifest.runtime);
            if (!candidate) throw new Error('The repair model returned no source.');
            return candidate;
        },
    });
}
