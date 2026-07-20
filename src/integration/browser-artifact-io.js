// SPDX-License-Identifier: AGPL-3.0-or-later

export function createBrowserArtifactIo({
    document,
    navigator = globalThis.navigator,
    URL = globalThis.URL,
    Blob = globalThis.Blob,
    Event = globalThis.Event,
}) {
    return Object.freeze({
        download({ fileName, text }) {
            const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            anchor.hidden = true;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        },
        async copy(text) {
            if (!navigator?.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
            await navigator.clipboard.writeText(String(text));
        },
        addToComposer(text) {
            const composer = document.querySelector('#send_textarea');
            if (!composer) throw new Error('SillyTavern message composer was not found.');
            const before = String(composer.value ?? '').trimEnd();
            composer.value = before ? `${before}\n\n${text}` : String(text);
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            composer.focus();
            return composer.value;
        },
        async readFile(file) {
            if (!file || typeof file.text !== 'function') throw new Error('No artifact package file was selected.');
            return file.text();
        },
    });
}
