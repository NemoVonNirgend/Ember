// SPDX-License-Identifier: AGPL-3.0-or-later

export function createSettingsController({
    document,
    runtime,
    settings,
    permissionPolicy,
    observability,
    secureHtmlController,
    persist,
    promptController,
}) {
    let root = null;

    function update() {
        if (!root) return;
        root.querySelector('[data-ember-v4-status]').textContent = runtime.phase;
        root.querySelector('[data-ember-v4-sessions]').textContent = String(runtime.sessions.size);
        root.querySelector('[data-ember-v4-decisions]').textContent = String(Object.keys(settings.permissionDecisions ?? {}).length);
        root.querySelector('[data-ember-v4-events]').textContent = String(observability.size);
    }

    return Object.freeze({
        install() {
            if (root?.isConnected) return true;
            const parent = document.querySelector('#ember-settings-content');
            if (!parent) return false;
            root = document.createElement('section');
            root.className = 'ember-v4-settings';
            root.innerHTML = `
                <hr>
                <h4>Ember 4 Secure Artifacts</h4>
                <div class="ember-v4-settings-grid">
                    <span>Runtime</span><strong data-ember-v4-status></strong>
                    <span>Mounted sessions</span><strong data-ember-v4-sessions></strong>
                    <span>Remembered decisions</span><strong data-ember-v4-decisions></strong>
                    <span>Runtime events</span><strong data-ember-v4-events></strong>
                </div>
                <div class="flex-container">
                    <button type="button" class="menu_button" data-ember-v4-clear-decisions>Clear permission decisions</button>
                    <button type="button" class="menu_button" data-ember-v4-clear-events>Clear runtime events</button>
                </div>
                <div class="setting-row">
                    <label class="checkbox_label">
                        <input type="checkbox" data-ember-v4-secure-html>
                        Use Ember 4 secure HTML renderer
                    </label>
                    <div class="description">Sanitizes complete HTML messages with SillyTavern DOMPurify and updates them with morphdom. Reload after disabling if you want Ember 3 to process existing HTML messages.</div>
                </div>
                <div class="setting-row">
                    <label class="checkbox_label">
                        <input type="checkbox" data-ember-v4-prompt-enabled>
                        Inject compact Ember v2 instructions
                    </label>
                    <textarea class="text_pole" rows="10" data-ember-v4-prompt></textarea>
                    <button type="button" class="menu_button" data-ember-v4-prompt-restore>Restore compact prompt</button>
                    <div class="description">Uses one prompt slot. When enabled, the older multi-slot Ember instructions are cleared.</div>
                </div>
                <div class="setting-row">
                    <label class="checkbox_label">
                        <input type="checkbox" data-ember-v4-migrate-legacy-js>
                        Run legacy JavaScript blocks through Ember 4
                    </label>
                    <div class="description">Converts legacy frontmatter, infers required libraries and permissions, and executes the block in the secure runtime. Reload after changing this setting.</div>
                </div>
                <div class="setting-row">
                    <label>Secure HTML processing</label>
                    <select class="text_pole" data-ember-v4-html-mode>
                        <option value="responses">AI responses only</option>
                        <option value="both">User and AI messages</option>
                    </select>
                </div>
                <p class="description">Ember v2 artifacts run in unique-origin frames and must receive explicit permission before using SillyTavern actions.</p>`;
            parent.appendChild(root);
            root.querySelector('[data-ember-v4-clear-decisions]').addEventListener('click', () => {
                permissionPolicy.clear();
                update();
            });
            root.querySelector('[data-ember-v4-clear-events]').addEventListener('click', () => {
                observability.clear();
                update();
            });
            const secureHtmlToggle = root.querySelector('[data-ember-v4-secure-html]');
            const htmlMode = root.querySelector('[data-ember-v4-html-mode]');
            secureHtmlToggle.checked = settings.secureHtmlRendererEnabled;
            htmlMode.value = settings.secureHtmlMode;
            secureHtmlToggle.addEventListener('change', () => {
                settings.secureHtmlRendererEnabled = secureHtmlToggle.checked;
                if (settings.secureHtmlRendererEnabled) secureHtmlController.processExisting();
                else secureHtmlController.restoreAll();
                persist?.();
            });
            htmlMode.addEventListener('change', () => {
                settings.secureHtmlMode = htmlMode.value;
                secureHtmlController.processExisting();
                persist?.();
            });
            const promptEnabled = root.querySelector('[data-ember-v4-prompt-enabled]');
            const promptText = root.querySelector('[data-ember-v4-prompt]');
            const promptRestore = root.querySelector('[data-ember-v4-prompt-restore]');
            promptEnabled.checked = settings.artifactPromptEnabled;
            promptText.value = settings.artifactPrompt;
            promptText.disabled = !settings.artifactPromptEnabled;
            promptEnabled.addEventListener('change', () => {
                settings.artifactPromptEnabled = promptEnabled.checked;
                promptText.disabled = !settings.artifactPromptEnabled;
                promptController.apply();
                persist?.();
            });
            promptText.addEventListener('change', () => {
                settings.artifactPrompt = promptText.value;
                promptController.apply();
                persist?.();
            });
            promptRestore.addEventListener('click', () => {
                promptController.restore();
                promptText.value = settings.artifactPrompt;
                persist?.();
            });
            const migrateLegacy = root.querySelector('[data-ember-v4-migrate-legacy-js]');
            migrateLegacy.checked = settings.migrateLegacyJavascript;
            migrateLegacy.addEventListener('change', () => {
                settings.migrateLegacyJavascript = migrateLegacy.checked;
                persist?.();
            });
            observability.subscribe(update);
            update();
            return true;
        },
        update,
    });
}
