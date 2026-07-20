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
    artifactLibrary,
    artifactIo,
    confirmRemove = title => globalThis.confirm?.(`Remove ${title} from the Ember artifact library?`) ?? true,
}) {
    let root = null;

    function update() {
        if (!root) return;
        root.querySelector('[data-ember-v4-status]').textContent = runtime.phase;
        root.querySelector('[data-ember-v4-sessions]').textContent = String(runtime.sessions.size);
        root.querySelector('[data-ember-v4-decisions]').textContent = String(Object.keys(settings.permissionDecisions ?? {}).length);
        root.querySelector('[data-ember-v4-events]').textContent = String(observability.size);
        root.querySelector('[data-ember-v4-library-count]').textContent = String(artifactLibrary.list().length);
    }

    function setLibraryStatus(message, failed = false) {
        const status = root?.querySelector('[data-ember-v4-library-status]');
        if (!status) return;
        status.textContent = message;
        status.dataset.state = failed ? 'error' : 'ok';
    }

    function renderLibrary() {
        const target = root?.querySelector('[data-ember-v4-library-list]');
        if (!target) return;
        target.replaceChildren();
        const records = artifactLibrary.list();
        if (!records.length) {
            const empty = document.createElement('p');
            empty.className = 'description';
            empty.textContent = 'No reusable artifacts saved yet.';
            target.appendChild(empty);
            return;
        }
        for (const record of records) {
            const row = document.createElement('div');
            row.className = 'ember-v4-library-entry';
            const title = document.createElement('strong');
            title.textContent = record.title;
            const digest = document.createElement('code');
            digest.textContent = record.package.digest.slice(0, 19);
            const reuse = document.createElement('button');
            reuse.type = 'button';
            reuse.className = 'menu_button';
            reuse.textContent = 'Add to composer';
            reuse.addEventListener('click', () => {
                artifactIo.addToComposer(artifactLibrary.fence(record.id));
                setLibraryStatus(`Added ${record.title} to the composer. Send it when ready.`);
            });
            const download = document.createElement('button');
            download.type = 'button';
            download.className = 'menu_button';
            download.textContent = 'Export';
            download.addEventListener('click', () => artifactIo.download(artifactLibrary.exportText(record.id)));
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'menu_button';
            remove.textContent = 'Remove';
            remove.addEventListener('click', async () => {
                if (!confirmRemove(record.title)) return;
                await artifactLibrary.remove(record.id);
                setLibraryStatus(`Removed ${record.title}.`);
                renderLibrary();
                update();
            });
            row.append(title, digest, reuse, download, remove);
            target.appendChild(row);
        }
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
                    <span>Reusable artifacts</span><strong data-ember-v4-library-count></strong>
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
                    <div class="description">Sanitizes complete static HTML messages with SillyTavern DOMPurify. Disabling restores SillyTavern's normal formatter; it never enables legacy script execution.</div>
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
                    <label>Secure HTML processing</label>
                    <select class="text_pole" data-ember-v4-html-mode>
                        <option value="responses">AI responses only</option>
                        <option value="both">User and AI messages</option>
                    </select>
                </div>
                <div class="setting-row">
                    <h4>Reusable artifact library</h4>
                    <div class="flex-container">
                        <button type="button" class="menu_button" data-ember-v4-import>Import .ember.json</button>
                        <input type="file" accept=".json,.ember.json,application/json" hidden data-ember-v4-import-file>
                    </div>
                    <div class="ember-v4-library-status" data-ember-v4-library-status></div>
                    <div class="ember-v4-library-list" data-ember-v4-library-list></div>
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
            const importButton = root.querySelector('[data-ember-v4-import]');
            const importFile = root.querySelector('[data-ember-v4-import-file]');
            importButton.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', async () => {
                try {
                    const text = await artifactIo.readFile(importFile.files?.[0]);
                    const record = await artifactLibrary.importText(text);
                    setLibraryStatus(`Imported ${record.title}. Review and add it to the composer when ready.`);
                    observability.record('artifact.imported', { libraryId: record.id });
                    renderLibrary();
                    update();
                } catch (error) {
                    setLibraryStatus(`Import failed: ${error.message}`, true);
                    observability.record('artifact.import_failed', { error: error.message });
                } finally {
                    importFile.value = '';
                }
            });
            observability.subscribe(update);
            artifactLibrary.subscribe(() => {
                renderLibrary();
                update();
            });
            renderLibrary();
            update();
            return true;
        },
        update,
    });
}
