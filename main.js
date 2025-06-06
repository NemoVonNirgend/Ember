// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 AI Assistant & User Collaborator

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';

const { eventSource, event_types } = getContext();

const MODULE_NAME = 'Ember';
const FENCED_CODE_BLOCK_LANG_SUBSTRING = 'javascript-live';

// Define the built-in libraries. The 'file' property points to the local file in the /lib/ folder.
const BUILT_IN_LIBRARIES = [
    { alias: 'd3',      file: 'd3.v7.min.js' },
    { alias: 'three',   file: 'three.r128.min.js' },
    { alias: 'p5',      file: 'p5.v1.4.0.min.js' },
    { alias: 'anime',   file: 'anime.v3.2.1.min.js' },
    { alias: 'chartjs', file: 'chart.umd.js' },
    { alias: 'matter',  file: 'matter.v0.18.0.min.js' }
];

function createSandboxedFrame(code, scriptUrls = [], frameId) {
    const iframe = document.createElement('iframe');
    iframe.className = 'ember-iframe';
    // This sandbox policy is the most secure and functional for our use case.
    // It prevents access to the parent but allows the iframe to run its scripts.
    iframe.sandbox = 'allow-scripts';
    iframe.dataset.frameId = frameId;

    // The logic inside the iframe remains the same: load libraries sequentially, then run the code.
    const iframeContent = `
        <html>
            <head>
                <style>body { font-family: var(--mainFontFamily, sans-serif); color: var(--text-color, #000); background-color: transparent; margin: 0; padding: 5px; overflow: hidden; }</style>
            </head>
            <body>
                <div id="ember-root"></div>
                <script>
                    (async () => {
                        const frameId = "${frameId}";
                        const postLog = (message) => window.parent.postMessage({ type: 'ember-log', frameId, message }, '*');
                        const postError = (message) => window.parent.postMessage({ type: 'ember-error', frameId, message }, '*');
                        const postSuccess = () => window.parent.postMessage({ type: 'ember-success', frameId }, '*');

                        try {
                            const libraryUrls = ${JSON.stringify(scriptUrls)};
                            
                            for (const url of libraryUrls) {
                                postLog('Loading local library: ' + url);
                                await new Promise((resolve, reject) => {
                                    const script = document.createElement('script');
                                    script.src = url;
                                    script.onload = resolve;
                                    script.onerror = () => reject(new Error('Failed to load script: ' + url));
                                    document.head.appendChild(script);
                                });
                                postLog('Successfully loaded: ' + url);
                            }

                            postLog('All libraries loaded. Executing user code.');
                            const render = () => { ${code} };
                            const result = render();
                            
                            if (result instanceof HTMLElement) {
                                document.getElementById('ember-root').appendChild(result);
                                postSuccess();
                            } else {
                                postError('Ember Warning: User code did not return an HTMLElement.');
                            }
                        } catch (err) {
                            postError('Ember Execution Error: ' + (err.stack || err.message));
                        }
                    })();
                <\/script>
            </body>
        </html>`;
    
    // Using a Blob URL is a robust way to create a unique-origin iframe.
    const blob = new Blob([iframeContent], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
    
    return iframe;
}

function processMessage(messageId) {
    const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
    if (!messageElement) return;

    const selector = `pre code[class*="${FENCED_CODE_BLOCK_LANG_SUBSTRING}"]`;
    messageElement.querySelectorAll(selector).forEach(codeBlock => {
        const parentPre = codeBlock.parentElement;
        if (parentPre.dataset.emberProcessed === 'true') return;
        parentPre.dataset.emberProcessed = 'true';

        const frameId = `ember-frame-${messageId}-${Date.now()}`;

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'ember-loading-container';
        loadingContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Ember is initializing the environment...</span>`;
        loadingContainer.dataset.frameId = frameId;
        
        const finalContainer = document.createElement('div');
        finalContainer.className = 'ember-container';
        finalContainer.dataset.frameId = frameId;
        finalContainer.style.display = 'none';

        parentPre.after(loadingContainer, finalContainer);

        let rawCode = '';
        for (const node of codeBlock.childNodes) { if (node.nodeType === Node.TEXT_NODE) rawCode += node.textContent; }

        let finalCode = rawCode;
        const requestedLibs = [], approvedLibraryUrls = [];

        if (rawCode.trim().startsWith('---')) {
            const parts = rawCode.split('---');
            if (parts.length >= 3) {
                const frontmatter = parts[1];
                finalCode = parts.slice(2).join('---').trim();
                try {
                    const lines = frontmatter.trim().split('\n');
                    let inLibs = false;
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine === 'libs:') inLibs = true;
                        else if (inLibs && trimmedLine.startsWith('-')) requestedLibs.push(trimmedLine.substring(1).trim());
                        else if (inLibs && !trimmedLine.startsWith(' ')) inLibs = false;
                    }
                } catch (e) { console.error('[Ember] Could not parse frontmatter:', e); }
            }
        }
        
        // NEW LOGIC: Build local URLs instead of using external ones.
        requestedLibs.forEach(alias => {
            const foundLib = BUILT_IN_LIBRARIES.find(lib => lib.alias === alias);
            if (foundLib) {
                // Construct the correct path to the local library file.
                const localUrl = `/extensions/third-party/${MODULE_NAME}/lib/${foundLib.file}`;
                approvedLibraryUrls.push(localUrl);
            } else {
                console.warn(`[Ember] LLM requested an unknown library: '${alias}'. It will be ignored.`);
            }
        });

        const iframe = createSandboxedFrame(finalCode, approvedLibraryUrls, frameId);
        finalContainer.appendChild(iframe);
        parentPre.style.display = 'none';
    });
}

// This listener for iframe messages remains the same and is crucial for debugging.
window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type?.startsWith('ember-')) return;
    
    const { type, frameId, message } = event.data;
    const loadingContainer = document.querySelector(`.ember-loading-container[data-frame-id="${frameId}"]`);
    if (!loadingContainer) return;

    if (type === 'ember-log') {
        console.log(`[Ember Iframe: ${frameId}] ${message}`);
    } else if (type === 'ember-error') {
        console.error(`[Ember Iframe Error: ${frameId}] ${message}`);
        loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i><span>Ember Error: ${message.split('\n')[0]}</span>`;
        loadingContainer.style.color = 'var(--text-color-error)';
        loadingContainer.style.justifyContent = 'flex-start';
    } else if (type === 'ember-success') {
        console.log(`[Ember Iframe: ${frameId}] Execution successful.`);
        const finalContainer = document.querySelector(`.ember-container[data-frame-id="${frameId}"]`);
        if (finalContainer) {
            loadingContainer.style.display = 'none';
            finalContainer.style.display = 'block';

            const iframe = finalContainer.querySelector('iframe');
            if (iframe.contentWindow) {
                const body = iframe.contentWindow.document.body;
                const html = iframe.contentWindow.document.documentElement;
                if (body && html) {
                    const resizeObserver = new ResizeObserver(() => {
                        const newHeight = Math.max(body.scrollHeight, html.scrollHeight);
                        iframe.style.height = (newHeight + 5) + 'px';
                    });
                    resizeObserver.observe(body);
                    iframe.style.height = (Math.max(body.scrollHeight, html.scrollHeight) + 5) + 'px';
                }
            }
        }
    }
});


async function setupSettingsUI() {
    // The new settings UI is static, so we just need to render it.
    const settingsHtml = await renderExtensionTemplateAsync(`third-party/${MODULE_NAME}`, 'settings');
    $('#extensions_settings').append(settingsHtml);
}

$(document).ready(function () {
    // No longer need to load settings for libraries.
    setupSettingsUI();
    
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, (id) => processMessage(id));
    eventSource.makeLast(event_types.MESSAGE_EDITED, (id) => {
        setTimeout(() => processMessage(id), 100);
    });
    
    console.log('Ember extension loaded with bundled libraries for reliability.');
});