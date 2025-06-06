// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 AI Assistant & User Collaborator

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';

const { eventSource, event_types } = getContext();

const MODULE_NAME = 'Ember';
const FENCED_CODE_BLOCK_LANG_SUBSTRING = 'javascript-live';

const BUILT_IN_LIBRARIES = [
    { alias: 'd3',      file: 'd3.v7.min.js' },
    { alias: 'three',   file: 'three.r128.min.js' },
    { alias: 'p5',      file: 'p5.v1.4.0.min.js' },
    { alias: 'anime',   file: 'anime.v3.2.1.min.js' },
    { alias: 'chartjs', file: 'chart.umd.js' },
    { alias: 'matter',  file: 'matter.v0.18.0.min.js' }
];

function createSandboxedFrame(code, libraryCodes = [], frameId) {
    const iframe = document.createElement('iframe');
    iframe.className = 'ember-iframe';
    iframe.sandbox = 'allow-scripts';
    iframe.dataset.frameId = frameId;

    const iframeContent = `
        <html>
            <head>
                <style>
                    body { 
                        font-family: var(--mainFontFamily, sans-serif); 
                        color: var(--text-color, #000); 
                        background-color: transparent; 
                        margin: 0; 
                        padding: 5px; 
                        overflow: hidden; 
                    }
                </style>
            </head>
            <body>
                <div id="ember-root"></div>
                <script>
                    (() => {
                        const frameId = "${frameId}";
                        const postLog = (message) => window.parent.postMessage({ type: 'ember-log', frameId, message }, '*');
                        const postError = (message) => window.parent.postMessage({ type: 'ember-error', frameId, message }, '*');
                        const postSuccess = () => window.parent.postMessage({ type: 'ember-success', frameId }, '*');

                        let debounceTimer;
                        let lastHeight = 0;
                        const postResize = () => {
                            clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(() => {
                                const newHeight = Math.ceil(document.documentElement.scrollHeight);
                                if (newHeight > 0 && newHeight !== lastHeight) {
                                    lastHeight = newHeight;
                                    window.parent.postMessage({ type: 'ember-resize', frameId, height: newHeight }, '*');
                                }
                            }, 100); // 100ms is a safe and stable value
                        };

                        try {
                            const libraryCodes = ${JSON.stringify(libraryCodes)};
                            
                            if (libraryCodes.length > 0) {
                                for (const libCode of libraryCodes) {
                                    const script = document.createElement('script');
                                    script.textContent = libCode;
                                    document.head.appendChild(script);
                                }
                            }

                            const render = () => { ${code} };
                            const result = render();
                            
                            if (result instanceof HTMLElement) {
                                document.getElementById('ember-root').appendChild(result);
                                postSuccess();
                                const resizeObserver = new ResizeObserver(postResize);
                                resizeObserver.observe(document.body);
                                postResize();

                            } else {
                                postError('Ember Warning: User code did not return an HTMLElement. This is required.');
                            }
                        } catch (err) {
                            postError('Ember Execution Error: ' + (err.stack || err.message));
                        }
                    })();
                <\/script>
            </body>
        </html>`;
    
    const blob = new Blob([iframeContent], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
    
    return iframe;
}

async function processMessage(messageId) {
    const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
    if (!messageElement) return;

    const selector = `pre code[class*="${FENCED_CODE_BLOCK_LANG_SUBSTRING}"]`;
    for (const codeBlock of messageElement.querySelectorAll(selector)) {
        const parentPre = codeBlock.parentElement;
        if (parentPre.dataset.emberProcessed === 'true') continue;
        parentPre.dataset.emberProcessed = 'true';

        const frameId = `ember-frame-${messageId}-${Date.now()}`;

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'ember-loading-container';
        loadingContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Ember is preparing the environment...</span>`;
        loadingContainer.dataset.frameId = frameId;
        
        const finalContainer = document.createElement('div');
        finalContainer.className = 'ember-container';
        finalContainer.dataset.frameId = frameId;
        finalContainer.style.display = 'none';

        parentPre.after(loadingContainer, finalContainer);

        let rawCode = '';
        for (const node of codeBlock.childNodes) { if (node.nodeType === Node.TEXT_NODE) rawCode += node.textContent; }

        let finalCode = rawCode;
        let frontmatter = '';
        const requestedLibs = [], approvedLibraryUrls = [];

        const separator = '---';
        const parts = rawCode.split(separator);

        if (parts.length > 1) {
            frontmatter = parts[0];
            finalCode = parts.slice(1).join(separator).trim();
            
            try {
                const lines = frontmatter.trim().split('\n');
                let inLibs = false;
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('libs:')) inLibs = true;
                    else if (inLibs && trimmedLine.startsWith('-')) requestedLibs.push(trimmedLine.substring(1).trim());
                }
            } catch (e) { console.error('[Ember] Could not parse frontmatter:', e); }
        } else {
            finalCode = rawCode.trim();
        }
        
        requestedLibs.forEach(alias => {
            const foundLib = BUILT_IN_LIBRARIES.find(lib => lib.alias === alias);
            if (foundLib) {
                const localUrl = `${window.location.origin}/scripts/extensions/third-party/${MODULE_NAME}/lib/${foundLib.file}`;
                approvedLibraryUrls.push(localUrl);
            } else {
                console.warn(`[Ember] LLM requested an unknown library: '${alias}'. It will be ignored.`);
            }
        });

        try {
            loadingContainer.querySelector('span').textContent = 'Ember is downloading libraries...';
            const libraryPromises = approvedLibraryUrls.map(url => fetch(url).then(res => {
                if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
                return res.text();
            }));
            const libraryCodes = await Promise.all(libraryPromises);
            
            loadingContainer.querySelector('span').textContent = 'Ember is building the sandbox...';
            const iframe = createSandboxedFrame(finalCode, libraryCodes, frameId);
            finalContainer.appendChild(iframe);
            parentPre.style.display = 'none';

        } catch (error) {
            console.error('[Ember] Critical error fetching libraries:', error);
            const errorContainer = document.querySelector(`.ember-loading-container[data-frame-id="${frameId}"]`);
            if(errorContainer) {
                errorContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember Error:</b> Could not download required libraries. Check console.</span>`;
            }
        }
    }
}

window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type?.startsWith('ember-')) return;
    
    const { type, frameId, message } = event.data;
    const loadingContainer = document.querySelector(`.ember-loading-container[data-frame-id="${frameId}"]`);
    const finalContainer = document.querySelector(`.ember-container[data-frame-id="${frameId}"]`);

    if (type === 'ember-log') {
        console.log(`[Ember Iframe: ${frameId}] ${message}`);
    } else if (type === 'ember-error') {
        if (!loadingContainer) return;
        console.error(`[Ember Iframe Error: ${frameId}] ${message}`);
        loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i><span><b>Ember Error:</b> ${message.split('\n')[0]}</span>`;
        loadingContainer.style.color = 'var(--text-color-error)';
        loadingContainer.style.justifyContent = 'flex-start';
    } else if (type === 'ember-success') {
        console.log(`[Ember Iframe: ${frameId}] Execution successful.`);
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (finalContainer) finalContainer.style.display = 'block';
    } else if (type === 'ember-resize') {
        // --- THE FINAL FIX ---
        // We set the height of the CONTAINER, not the iframe.
        // The iframe's "height: 100%" CSS will handle the rest.
        if (finalContainer) {
            finalContainer.style.height = (event.data.height + 15) + 'px'; // +15px buffer for padding and borders
        }
    }
});


async function setupSettingsUI() {
    const settingsHtml = await renderExtensionTemplateAsync(`third-party/${MODULE_NAME}`, 'settings');
    $('#extensions_settings').append(settingsHtml);
}

$(document).ready(function () {
    setupSettingsUI();
    
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, (id) => processMessage(id));
    eventSource.makeLast(event_types.MESSAGE_EDITED, (id) => {
        setTimeout(() => processMessage(id), 100);
    });
    
    console.log('Ember extension loaded with bundled libraries and corrected auto-resizing.');
});