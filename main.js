// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 AI Assistant & User Collaborator

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { messageFormatting, addCopyToCodeBlocks } from '../../../../script.js';

const { eventSource, event_types } = getContext();
const MODULE_NAME = 'Ember';
const BUILT_IN_LIBRARIES = [
    { alias: 'd3', file: 'd3.v7.min.js' },
    { alias: 'three', file: 'three.r128.min.js' },
    { alias: 'p5', file: 'p5.v1.4.0.min.js' },
    { alias: 'anime', file: 'anime.v3.2.1.min.js' },
    { alias: 'chartjs', file: 'chart.umd.js' },
    { alias: 'matter', file: 'matter.v0.18.0.min.js' }
];

const HEALER_SYSTEM_PROMPT = `[System Directive: You are an Ember JS Code Healer]
You are an expert JavaScript debugger and code refactorer specializing in the Ember interactive environment.
Your task is to analyze the provided JavaScript code, which has failed to execute correctly, and provide a fixed, complete, and runnable version.

**CRITICAL INSTRUCTIONS:**
1.  **OUTPUT FORMAT:** Your response MUST contain ONLY the complete, corrected JavaScript code inside a single \`javascript\` markdown block. Do NOT add any explanations, apologies, or conversational text before or after the code block.
2.  **CODE STRUCTURE:** The corrected script MUST adhere to the Ember format. This means it MUST start with a frontmatter section.

**EMBER ENVIRONMENT RULES (CHECK FOR THESE ERRORS):**
*   **Frontmatter is Mandatory:** The script MUST begin with a frontmatter block enclosed in \`---\`. If it's missing, add it.
    *   Example:
        \`\`\`
        ---
        libs:
          - d3
          - anime
        ---
        \`\`\`
*   **Use the 'root' Element:** A \`div\` with the id \`root\` is provided. All visual output (canvases, divs, svgs, etc.) MUST be appended to this \`root\` element. This is the most common error.
*   **Available Libraries:** Only request libraries from this list: \`d3\`, \`three\`, \`p5\`, \`anime\`, \`chartjs\`, \`matter\`.

**YOUR TASK:**
1.  **Debug:** Analyze the user's broken script and the associated error/symptom. Identify the bug. This could be a syntax error, a logic error, or a violation of the Ember rules.
2.  **Fix & Format:** Correct the bug and ensure the entire script is properly formatted according to the rules above.
3.  **Improve (If No Obvious Error):** If the code seems syntactically correct but failed (e.g., "produced no output"), the error is likely a rule violation (e.g., not using \`root\`). If you cannot find any error, improve the code's efficiency, readability, or visual appeal, while still following all rules.
4.  **Respond:** Return ONLY the complete, corrected code in a single block.

**User's Broken Script & Error:**
The script and error are provided below. Analyze them and provide the corrected code now.`;

const emberMaxHeights = {};

async function attemptSelfHeal(messageId, codeElement, errorMessage = 'The script failed to render or produced no output.') {
    const healButton = document.querySelector(`.mes[mesid="${messageId}"] .ember-heal-button`);
    if (healButton && healButton.classList.contains('fa-spin')) return;
    if (healButton) healButton.classList.add('fa-spin');

    const originalCode = codeElement.innerText;
    const promptText = `${HEALER_SYSTEM_PROMPT}\n\nError/Symptom: "${errorMessage}"\n\n\`\`\`javascript\n${originalCode}\n\`\`\``;

    try {
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // *** MODEL CHANGED HERE ***
                model: 'gpt-4.1',
                messages: [{ role: 'user', content: promptText }],
                private: true
            })
        });

        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

        const correctedText = await response.text();
        const codeMatch = correctedText.match(/```javascript\s*([\s\S]*?)\s*```/);
        const correctedCode = codeMatch ? codeMatch[1].trim() : correctedText.trim();

        if (correctedCode && correctedCode.trim() !== originalCode.trim()) {
            console.log('[Ember Self-Heal] AI provided a fix. Updating message.');
            const core = getContext();
            const messageToUpdate = core.chat[messageId];

            if (!messageToUpdate) {
                throw new Error(`Message with ID ${messageId} not found in chat context.`);
            }

            const originalMessageContent = messageToUpdate.mes;
            const newMessageContent = originalMessageContent.replace(originalCode, correctedCode);
            
            messageToUpdate.mes = newMessageContent;

            const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
            if (messageElement) {
                const speakerName = messageToUpdate.is_user ? core.name2 : messageToUpdate.name;
                
                messageElement.innerHTML = messageFormatting(
                    newMessageContent,
                    speakerName,
                    messageToUpdate.is_system,
                    messageToUpdate.is_user,
                    messageId
                );
                addCopyToCodeBlocks(messageElement);
                
                eventSource.emit(event_types.MESSAGE_EDITED, Number(messageId));

            } else {
                console.warn(`[Ember] Could not find message element for ID ${messageId} to re-render.`);
            }

        } else {
            throw new Error("AI did not provide a new or valid code block.");
        }
    } catch (healError) {
        console.error('[Ember Self-Heal] Failed to fix the script:', healError);
    } finally {
        if (healButton) healButton.classList.remove('fa-spin');
    }
}

function createSandboxedFrame(code, libraryCodes = [], frameId) {
    const iframe = document.createElement('iframe');
    iframe.className = 'ember-iframe';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    iframe.dataset.frameId = frameId;
    const safeCodeString = JSON.stringify(code);
    const iframeContent = `<html><head><style>body{font-family:var(--mainFontFamily,sans-serif);color:var(--text-color,#000);background-color:transparent;margin:0;padding:5px}#root{width:100%;height:100%;box-sizing:border-box}</style></head><body><div id="root"></div><script>(()=>{const e="${frameId}",t=o=>window.parent.postMessage({type:"ember-error",frameId:e,message:o},"*"),n=()=>window.parent.postMessage({type:"ember-success",frameId:e},"*");let o=!1;const s=()=>{if(o)return;o=!0,clearTimeout(d),i&&i.disconnect(),n()},d=setTimeout(()=>{o||t("Ember Warning: Script produced no visual output.")},7000),i=new MutationObserver(()=>{document.getElementById("root")?.hasChildNodes()&&s()});i.observe(document.body,{childList:!0,subtree:!0}),new ResizeObserver(()=>{const o=Math.ceil(document.documentElement.scrollHeight);o>0&&window.parent.postMessage({type:"ember-resize",frameId:e,height:o},"*")}).observe(document.documentElement);try{const o=${JSON.stringify(libraryCodes)};for(const r of o){const c=document.createElement("script");c.textContent=r,document.head.appendChild(c)}const r=${safeCodeString};new Function('const root = document.getElementById("root");'+r)()}catch(o){t("Ember Execution Error: "+(o.stack||o.message))}})();<\/script></body></html>`;
    const blob = new Blob([iframeContent], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
    return iframe;
}

async function processMessage(messageId) {
    const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
    if (!messageElement) return;

    for (const codeBlock of messageElement.querySelectorAll(`pre > code[class*="javascript"]`)) {
        const parentPre = codeBlock.parentElement;
        if (parentPre.dataset.emberProcessed === 'true') continue;

        const rawCode = codeBlock.innerText.trim();
        let match = rawCode.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
        if (!match) {
            const fallbackMatch = rawCode.match(/^([\s\S]+?)\s*---\s*([\s\S]*)$/);
            if (fallbackMatch && fallbackMatch[1] && fallbackMatch[1].trim().startsWith('libs:')) {
                match = fallbackMatch;
            }
        }
        if (!match) continue;
        
        parentPre.dataset.emberProcessed = 'true';
        const finalCode = match[2] || '';
        if (!finalCode) {
             parentPre.dataset.emberProcessed = 'false';
             continue;
        }

        const requestedLibs = [];
        try {
            const lines = (match[1] || '').trim().split('\n');
            let inLibsSection = false;
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('libs:')) inLibsSection = true;
                if (inLibsSection && trimmedLine.startsWith('-')) requestedLibs.push(trimmedLine.replace('-', '').trim());
            }
        } catch (e) { console.error('[Ember] Could not parse frontmatter:', e); }

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

        try {
            const approvedLibraryUrls = [];
            requestedLibs.forEach(alias => {
                const foundLib = BUILT_IN_LIBRARIES.find(lib => lib.alias === alias);
                if (foundLib) approvedLibraryUrls.push(`${window.location.origin}/scripts/extensions/third-party/${MODULE_NAME}/lib/${foundLib.file}`);
            });
            const libraryCodes = await Promise.all(
                approvedLibraryUrls.map(url => fetch(url).then(res => res.ok ? res.text() : Promise.reject(`Failed to fetch ${url}`)))
            );
            const iframe = createSandboxedFrame(finalCode, libraryCodes, frameId);
            finalContainer.appendChild(iframe);
            parentPre.style.display = 'none';
        } catch (error) {
            console.error('[Ember] Critical error creating sandbox:', error);
            loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember Error:</b> Could not create sandbox. Check console.</span>`;
            loadingContainer.style.color = 'var(--text-color-error)';
        }
    }
}

window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type?.startsWith('ember-')) return;
    
    const { type, frameId, message, height } = event.data;
    const loadingContainer = document.querySelector(`.ember-loading-container[data-frame-id="${frameId}"]`);
    const finalContainer = document.querySelector(`.ember-container[data-frame-id="${frameId}"]`);

    switch (type) {
        case 'ember-error': {
            if (!loadingContainer) return;
            console.error(`[Ember Iframe Error: ${frameId}] ${message}`);
            
            loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember Error:</b> ${message.split('\n')[0]}</span>`;
            loadingContainer.style.color = 'var(--text-color-error)';
            loadingContainer.style.display = 'flex';
            if (finalContainer) finalContainer.style.display = 'none';

            if (message.startsWith('Ember Execution Error:')) {
                const messageId = frameId.split('-')[2];
                const codeElement = document.querySelector(`.mes[mesid="${messageId}"] pre[data-ember-processed] code`);
                if (codeElement) {
                    attemptSelfHeal(messageId, codeElement, message);
                }
            }
            break;
        }
        case 'ember-success':
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (finalContainer) finalContainer.style.display = 'block';
            break;
        case 'ember-resize': {
            if (!finalContainer) break;
            if (height <= 0) break;
            const currentMax = emberMaxHeights[frameId] || 0;
            const newHeight = height + 15;
            if (newHeight > currentMax) {
                emberMaxHeights[frameId] = newHeight;
                finalContainer.style.height = newHeight + 'px';
            }
            break;
        }
    }
});

function cleanupEmberElements(messageId) {
    const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (messageElement) {
        messageElement.querySelectorAll('.ember-container, .ember-loading-container').forEach(el => el.remove());
        messageElement.querySelectorAll('pre[data-ember-processed="true"]').forEach(pre => {
            pre.style.display = '';
            delete pre.dataset.emberProcessed;
        });
    }
}

function initializeHealButton() {
    const healButtonHtml = `
        <div class="mes_button ember-heal-button fa-solid fa-bolt interactable" title="Attempt to fix JavaScript with AI"></div>
    `;
    $('#message_template .extraMesButtons').prepend(healButtonHtml);
}


$(document).ready(function () {
    initializeHealButton();

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (id) => {
        processMessage(id);
    });
    
    eventSource.on(event_types.MESSAGE_EDITED, (id) => {
        cleanupEmberElements(id);
        setTimeout(() => processMessage(id), 100);
    });

    $(document).on('click', '.ember-heal-button', function() {
        const messageId = $(this).closest('.mes').attr('mesid');
        const codeElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text pre > code`);

        if (codeElement) {
            attemptSelfHeal(messageId, codeElement, 'Manual heal triggered by user.');
        } else {
            alert('Ember: No code block found to heal in this message.');
        }
    });
    
    console.log('Ember extension loaded. Heal button initialized.');
});