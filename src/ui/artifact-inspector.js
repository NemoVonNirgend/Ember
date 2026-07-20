// SPDX-License-Identifier: AGPL-3.0-or-later

function addField(document, target, label, value) {
    const row = document.createElement('div');
    row.className = 'ember-v4-inspector-row';
    const name = document.createElement('strong');
    name.textContent = `${label}: `;
    const content = document.createElement('span');
    content.textContent = String(value ?? '—');
    row.append(name, content);
    target.appendChild(row);
}

export function createArtifactInspector({
    document,
    callPopup,
    displayType,
    libraries,
    observability,
    diagnose,
    repairPreview,
    modelRepair,
    repairApplication,
    confirmType,
    artifactLibrary,
    artifactIo,
}) {
    return async function openInspector({ artifact, session }) {
        const content = document.createElement('div');
        content.className = 'ember-v4-inspector';
        const heading = document.createElement('h3');
        heading.textContent = artifact.manifest.title;
        content.appendChild(heading);
        addField(document, content, 'Artifact ID', session?.id);
        addField(document, content, 'Stable key', session?.artifactKey);
        addField(document, content, 'Runtime', artifact.manifest.runtime);
        addField(document, content, 'Chat', session?.chatId);
        addField(document, content, 'Message', session?.messageId);
        addField(document, content, 'Revision', session?.revision);
        addField(document, content, 'Status', session?.status);
        addField(document, content, 'Requested', artifact.manifest.permissions.join(', ') || 'None');
        addField(document, content, 'Granted', session?.permissions.join(', ') || 'None');

        const portableActions = document.createElement('div');
        portableActions.className = 'flex-container ember-v4-portable-actions';
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'menu_button';
        saveButton.textContent = 'Save to library';
        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.className = 'menu_button';
        exportButton.textContent = 'Export .ember.json';
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'menu_button';
        copyButton.textContent = 'Copy reusable fence';
        const portableStatus = document.createElement('div');
        portableStatus.className = 'ember-v4-portable-status';
        const runPortableAction = async (button, action) => {
            button.disabled = true;
            try {
                portableStatus.textContent = await action();
            } catch (error) {
                portableStatus.textContent = `Artifact action failed: ${error.message}`;
            } finally {
                button.disabled = false;
            }
        };
        saveButton.addEventListener('click', () => runPortableAction(saveButton, async () => {
            const record = await artifactLibrary.saveArtifact(artifact);
            observability.record('artifact.saved', { artifactId: session?.id, libraryId: record.id });
            return `Saved ${record.title} to the reusable artifact library.`;
        }));
        exportButton.addEventListener('click', () => runPortableAction(exportButton, async () => {
            const exported = await artifactLibrary.exportArtifact(artifact);
            artifactIo.download(exported);
            observability.record('artifact.exported', { artifactId: session?.id, fileName: exported.fileName });
            return `Exported ${exported.fileName}.`;
        }));
        copyButton.addEventListener('click', () => runPortableAction(copyButton, async () => {
            await artifactIo.copy(artifactLibrary.fenceForArtifact(artifact));
            observability.record('artifact.copied', { artifactId: session?.id });
            return 'Copied a reusable Ember fence to the clipboard.';
        }));
        portableActions.append(saveButton, exportButton, copyButton);
        content.append(portableActions, portableStatus);

        const sourceHeading = document.createElement('h4');
        sourceHeading.textContent = 'Source';
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = artifact.manifest.runtime === 'html' ? 'language-html' : 'language-javascript';
        code.textContent = artifact.source;
        pre.appendChild(code);
        content.append(sourceHeading, pre);
        libraries.highlightElement(code);

        const diagnostics = diagnose(artifact);
        const diagnosticHeading = document.createElement('h4');
        diagnosticHeading.textContent = `Diagnostics (${diagnostics.length})`;
        const diagnosticList = document.createElement('ul');
        diagnosticList.className = 'ember-v4-diagnostics';
        if (!diagnostics.length) {
            const item = document.createElement('li');
            item.textContent = 'No deterministic issues detected.';
            diagnosticList.appendChild(item);
        } else {
            for (const entry of diagnostics) {
                const item = document.createElement('li');
                item.dataset.severity = entry.severity;
                item.textContent = `${entry.severity.toUpperCase()}: ${entry.message}`;
                diagnosticList.appendChild(item);
            }
        }
        content.append(diagnosticHeading, diagnosticList);

        const repairDetails = document.createElement('details');
        const repairSummary = document.createElement('summary');
        repairSummary.textContent = 'Draft and preview a repair';
        const repairHelp = document.createElement('p');
        repairHelp.textContent = 'Edit a candidate below to preview the exact source diff. This does not change the chat message.';
        const candidate = document.createElement('textarea');
        candidate.className = 'text_pole ember-v4-repair-candidate';
        candidate.rows = 12;
        candidate.value = artifact.source;
        const previewButton = document.createElement('button');
        previewButton.type = 'button';
        previewButton.className = 'menu_button';
        previewButton.textContent = 'Preview source diff';
        const modelButton = document.createElement('button');
        modelButton.type = 'button';
        modelButton.className = 'menu_button';
        modelButton.textContent = 'Ask current ST model for repair';
        const diffTarget = document.createElement('pre');
        diffTarget.className = 'ember-v4-repair-diff';
        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'menu_button';
        applyButton.textContent = 'Apply reviewed repair';
        const rollbackButton = document.createElement('button');
        rollbackButton.type = 'button';
        rollbackButton.className = 'menu_button';
        rollbackButton.textContent = 'Roll back latest repair';
        const repairStatus = document.createElement('div');
        repairStatus.className = 'ember-v4-repair-status';
        previewButton.addEventListener('click', () => {
            const preview = repairPreview.compare(artifact.source, candidate.value);
            diffTarget.replaceChildren();
            if (!preview.changed) {
                diffTarget.textContent = 'No source changes.';
                return;
            }
            for (const chunk of preview.chunks) {
                const span = document.createElement('span');
                span.dataset.operation = String(chunk.operation);
                span.textContent = chunk.text;
                diffTarget.appendChild(span);
            }
        });
        modelButton.addEventListener('click', async () => {
            modelButton.disabled = true;
            modelButton.textContent = 'Generating repair…';
            try {
                candidate.value = await modelRepair.propose(artifact);
                previewButton.click();
                observability.record('repair.proposed', { artifactId: session?.id });
            } catch (error) {
                diffTarget.textContent = `Repair request failed: ${error.message}`;
                observability.record('repair.failed', { artifactId: session?.id, error: error.message });
            } finally {
                modelButton.disabled = false;
                modelButton.textContent = 'Ask current ST model for repair';
            }
        });
        applyButton.addEventListener('click', async () => {
            const preview = repairPreview.compare(artifact.source, candidate.value);
            if (!preview.changed) {
                repairStatus.textContent = 'There are no source changes to apply.';
                return;
            }
            const confirmed = await callPopup(
                'Apply this reviewed source change to the chat message? Ember will preserve rollback provenance.',
                confirmType,
                '',
                { okButton: 'Apply repair', cancelButton: 'Cancel' },
            );
            if (!confirmed) return;
            applyButton.disabled = true;
            try {
                const result = await repairApplication.apply({
                    session,
                    originalSource: artifact.source,
                    candidate: candidate.value,
                });
                repairStatus.textContent = `Repair ${result.id} applied. The message has been rerendered.`;
                observability.record('repair.applied', { artifactId: session?.id, repairId: result.id });
            } catch (error) {
                repairStatus.textContent = `Repair was not applied: ${error.message}`;
                observability.record('repair.apply_failed', { artifactId: session?.id, error: error.message });
            } finally {
                applyButton.disabled = false;
            }
        });
        rollbackButton.addEventListener('click', async () => {
            const confirmed = await callPopup(
                'Roll back the latest Ember repair on this message?',
                confirmType,
                '',
                { okButton: 'Roll back', cancelButton: 'Cancel' },
            );
            if (!confirmed) return;
            rollbackButton.disabled = true;
            try {
                const result = await repairApplication.rollback({
                    chatId: session.chatId,
                    messageId: session.messageId,
                });
                repairStatus.textContent = `Repair ${result.id} was rolled back.`;
                observability.record('repair.rolled_back', { artifactId: session?.id, repairId: result.id });
            } catch (error) {
                repairStatus.textContent = `Rollback was not performed: ${error.message}`;
            } finally {
                rollbackButton.disabled = false;
            }
        });
        repairDetails.append(
            repairSummary,
            repairHelp,
            candidate,
            modelButton,
            previewButton,
            applyButton,
            rollbackButton,
            diffTarget,
            repairStatus,
        );
        content.appendChild(repairDetails);

        const recent = observability.list().filter(event => event.detail?.artifactId === session?.id).slice(-10);
        if (recent.length) {
            const eventsHeading = document.createElement('h4');
            eventsHeading.textContent = 'Recent events';
            const list = document.createElement('ul');
            for (const event of recent) {
                const item = document.createElement('li');
                item.textContent = `${new Date(event.timestamp).toLocaleTimeString()} — ${event.type}`;
                list.appendChild(item);
            }
            content.append(eventsHeading, list);
        }

        return callPopup(content, displayType, '', { wide: true, large: true, allowVerticalScrolling: true });
    };
}
