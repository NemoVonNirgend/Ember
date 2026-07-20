// SPDX-License-Identifier: AGPL-3.0-or-later

const PERMISSION_DESCRIPTIONS = Object.freeze({
    'host.submit': 'Send a user message from an explicit interaction.',
    'host.inject': 'Add information to future model context.',
    'host.generate': 'Start a new model response.',
    'host.state.read': 'Read this artifact’s saved chat state.',
    'host.state.write': 'Update this artifact’s saved chat state.',
    'network.fetch': 'Load data, images, audio, or video from external websites without sharing SillyTavern cookies.',
});

export function createPermissionDialog({ document, callPopup, confirmType }) {
    return async function requestPermission({ title, permissions }) {
        const content = document.createElement('div');
        content.className = 'ember-v4-permission-dialog';

        const heading = document.createElement('h3');
        heading.textContent = 'Allow Ember artifact?';
        content.appendChild(heading);

        const introduction = document.createElement('p');
        introduction.textContent = `${title} is requesting the following capabilities:`;
        content.appendChild(introduction);

        const list = document.createElement('ul');
        for (const permission of permissions) {
            const item = document.createElement('li');
            const code = document.createElement('code');
            code.textContent = permission;
            const description = document.createElement('span');
            description.textContent = ` — ${PERMISSION_DESCRIPTIONS[permission] ?? 'Unknown capability.'}`;
            item.append(code, description);
            list.appendChild(item);
        }
        content.appendChild(list);

        const rememberLabel = document.createElement('label');
        rememberLabel.className = 'checkbox_label';
        const remember = document.createElement('input');
        remember.type = 'checkbox';
        const rememberText = document.createElement('span');
        rememberText.textContent = 'Remember this decision for the same permission set';
        rememberLabel.append(remember, rememberText);
        content.appendChild(rememberLabel);

        const result = await callPopup(content, confirmType, '', {
            okButton: 'Allow',
            cancelButton: 'Deny',
            wide: true,
        });
        return { allowed: Boolean(result), remember: remember.checked };
    };
}
