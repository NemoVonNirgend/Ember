// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 AI Assistant & User Collaborator

import { getContext, renderExtensionTemplateAsync, extension_settings as global_extension_settings } from '../../../extensions.js';
import { messageFormatting, addCopyToCodeBlocks, setExtensionPrompt, extension_prompt_types, sendMessageAsUser, Generate } from '../../../../script.js';

const { eventSource, event_types, SlashCommands } = getContext();
const MODULE_NAME = 'Ember'; // Used for loading settings HTML and lib paths
const BUILT_IN_LIBRARIES = [
    { alias: 'd3', file: 'd3.v7.min.js' },
    { alias: 'three', file: 'three.r128.min.js' },
    { alias: 'p5', file: 'p5.v1.4.0.min.js' },
    { alias: 'anime', file: 'anime.v3.2.1.min.js' },
    { alias: 'chartjs', file: 'chart.umd.js' },
    { alias: 'matter', file: 'matter.v0.18.0.min.js' }
];

// Instructions for the AI to generate correct Ember JS blocks and use APIs
const DEFAULT_EMBER_JS_INSTRUCTIONS = `### [System Directive: Interactive Code with Ember]

You have two ways to create interactive content: full JavaScript blocks for complex applications, and simple raw HTML for basic inputs and buttons.

---

### Part 1: Ember JavaScript Blocks

To generate complex interactive elements (like charts, games, or dynamic API-driven content), use a standard \`javascript\` code block.

**To make the code interactive, you MUST include a frontmatter section at the top.** This section starts and ends with \`---\`.

**Execution Environment:**
*   Your code will run in a secure sandbox.
*   A \`div\` element named \`root\` is provided. **You MUST append all your created elements to \`root\`** for them to be visible.
*   If you need libraries, request them by alias in the \`libs:\` section of the frontmatter.

**Available Libraries:** \`d3\`, \`three\`, \`p5\`, \`anime\`, \`chartjs\`, \`matter\`.

**Context Injection from JavaScript:**
*   Your script can inject information directly into the chat's context using the global \`ember.inject()\` function. This is useful for updating story state or recording player actions.
*   **Function Signature:** \`ember.inject({ id: '...', depth: 0, content: '...', ephemeral: false });\`
    *   \`content\`: (Required) The text string to inject.
    *   \`id\`: (Optional, defaults to 'ember_js_block') A unique identifier for the injection.
    *   \`depth\`: (Optional, defaults to 0) The injection depth.
    *   \`ephemeral\`: (Optional, defaults to false) Set to \`true\` to make the injection temporary.
*   **Example (Chart with Context Injection):**
    \`\`\`javascript
    ---
    libs:
      - chartjs
    ---
    const canvas = document.createElement('canvas');
    root.appendChild(canvas);

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Red', 'Blue', 'Yellow'],
        datasets: [{
          label: '# of Votes',
          data: [12, 19, 3],
          backgroundColor: ['red', 'blue', 'yellow']
        }]
      }
    });

    // Inject context after creating the chart
    ember.inject({ content: 'A chart of poll results has been displayed.' });
    \`\`\`

**Available APIs within JavaScript Blocks:**

**A. Text Generation (LLM):**
*   **Endpoint:** \`https://text.pollinations.ai/\`
*   **Method:** \`POST\`
*   **Example Implementation:**
    \`\`\`javascript
    async function generateText(prompt) {
      try {
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4.1',
              messages: [{ role: 'user', content: prompt }],
              private: true
            })
        });
        if (!response.ok) throw new Error('API request failed');
        return await response.text();
      } catch (error) {
        console.error("Text generation error:", error);
        return "Error: Could not generate response.";
      }
    }
    \`\`\`

**B. Text-to-Speech (TTS):**
*   **Endpoint:** A \`GET\` request to \`https://text.pollinations.ai/{URL_ENCODED_TEXT}?model=openai-audio&voice={VOICE_NAME}\`
*   **Available Voices:** \`onyx\`, \`nova\`, \`shimmer\`, \`echo\`, \`fable\`, \`alloy\`.
*   **Example Implementation:**
    \`\`\`javascript
    function playSpeech(text, voice = 'nova') {
      const encodedText = encodeURIComponent(text);
      const ttsApiUrl = \`https://text.pollinations.ai/\${encodedText}?model=openai-audio&voice=\${voice}\`;
      const audio = new Audio(ttsApiUrl);
      audio.play();
    }
    \`\`\`

**C. Image Generation:**
*   You can dynamically create \`<img src="...">\` elements and append them to the \`root\` element.
*   **URL Format:** \`https://image.pollinations.ai/prompt/{PROMPT_STRING}?width=...&height=...&model=...\`
*   **Example Implementation:**
    \`\`\`javascript
    function displayGeneratedImage(prompt) {
      const img = document.createElement('img');
      const encodedPrompt = encodeURIComponent(prompt);
      img.src = \`https://image.pollinations.ai/prompt/\${encodedPrompt}?width=512&height=512&model=illustrious&nologo=true\`;
      root.appendChild(img);
    }
    \`\`\`

---

### Part 2: Interactive Raw HTML (When Not Using JS Blocks)

For simple choices, forms, or controls, you can generate raw HTML directly in your response. Ember will make these elements interactive.
If you provide HTML for rendering (e.g., an SCP document), provide it as raw HTML, not inside a markdown code block unless the entire message is that block.

**1. Use Standard HTML:**
*   Use \`<button>\`, \`<input>\`, \`<select>\`, \`<textarea>\`, and \`<label>\`.
*   Always associate labels with inputs using \`<label for="inputId">\`.

**2. Clickable Buttons & Form Submission:**
*   The text inside a \`<button>\` is what the user clicks and sends as a message.
*   To make a button gather values from nearby inputs and submit them all, add the \`data-submit\` attribute.

**3. Context Injection from Buttons:**
*   To make a button inject information into context when clicked, add the \`data-inject-content="Text to inject"\` attribute. This can be combined with \`data-submit\`.
*   **Optional Attributes:** \`data-inject-id="custom_id"\`, \`data-inject-depth="1"\`, \`data-inject-ephemeral="true"\`.
*   **Examples:**
    \`\`\`html
    <!-- A simple choice button that also injects context -->
    <button data-inject-content="The player chose the path of courage.">Choose Path of Courage</button>

    <!-- A form with a submit button that also injects context -->
    <div>
        <label for="char_name">Character Name:</label>
        <input type="text" id="char_name" name="name">
        <button data-submit data-inject-content="Quest updated: The player has created their character." data-inject-id="quest_log">
            Create Character
        </button>
    </div>
    \`\`\`
Use these tools to enhance any HTML you are asked to generate. Be creative.`;


const HEALER_SYSTEM_PROMPT = `[System Directive: You are an Ember JS Code Healer]
You are an expert JavaScript debugger and code refactorer specializing in the Ember interactive environment.
Your task is to analyze the provided JavaScript code, which has failed to execute correctly, and provide a fixed, complete, and runnable version.

**CRITICAL INSTRUCTIONS:**
1.  **OUTPUT FORMAT:** Your response MUST contain ONLY the complete, corrected JavaScript code inside a single \`javascript\` markdown block. Do NOT add any explanations, apologies, or conversational text before or after the code block.
2.  **CODE STRUCTURE:** The corrected script MUST adhere to the Ember format. This means it MUST start with a frontmatter section.

**EMBER JS ENVIRONMENT RULES (CHECK FOR THESE ERRORS):**
*   **Frontmatter is Mandatory:** The script MUST begin with a frontmatter block enclosed in \`---\`. If it's missing, add it. Example: \`---\nlibs:\n  - d3\n---\`
*   **Use the 'root' Element:** A \`div\` with the id \`root\` is provided. All visual output (canvases, divs, svgs, etc.) MUST be appended to this \`root\` element.
*   **Available Libraries:** Only request libraries from this list: \`d3\`, \`three\`, \`p5\`, \`anime\`, \`chartjs\`, \`matter\`.
*   **Context Injection:** Your script can inject information into SillyTavern's context using the global \`ember.inject()\` function.
    *   Call \`ember.inject({ id: 'your_id', depth: 0, content: 'Your information here', ephemeral: false });\`
    *   \`id\`: (Optional, defaults to 'ember_js_block') The ID for the injection.
    *   \`depth\`: (Optional, defaults to 0) The injection depth.
    *   \`content\`: (Required) The text string to inject.
    *   \`ephemeral\`: (Optional, defaults to false) Set to true to make the injection temporary.
    *   Example: \`ember.inject({ content: 'The player has found the hidden key.' });\`
*   **API Access:** JavaScript blocks can use \`fetch()\` to interact with external APIs like Pollinations for Text Generation, TTS, or Image Generation, provided the sandbox allows (\`allow-same-origin\` is enabled). Use \`encodeURIComponent()\` for URL parameters.

**YOUR TASK:**
Analyze the user's broken script and the associated error/symptom. Identify the bug. Correct it, ensure the entire script is properly formatted, and return ONLY the complete, corrected code in a single block.`;


const ELEMENT_CLICKABLE_ATTRIBUTE = "data-ember-clickable";
const ELEMENT_LLM_SUBMIT_ATTRIBUTE = "data-submit";
const ELEMENT_INJECT_CONTENT_ATTRIBUTE = "data-inject-content";

const emberMaxHeights = {};
let emberSettings = {
    directHtmlEnabled: true,
    directHtmlProcessingMode: 'both',
    clickableInputsEnabled: true,
    clickableInputsPromptEnabled: true,
    clickableInputsPrompt: DEFAULT_EMBER_JS_INSTRUCTIONS,
};

function updateEmberPromptInjection() {
    const promptId = "emberinstructions";
    const promptDepth = 4;

    if (emberSettings.clickableInputsEnabled && emberSettings.clickableInputsPromptEnabled) {
        setExtensionPrompt(promptId, emberSettings.clickableInputsPrompt, extension_prompt_types.IN_PROMPT, promptDepth);
    } else {
        setExtensionPrompt(promptId, "");
    }
}


function findLabelForInput(inputElement, parentScope) {
    if (!inputElement.id) return "";
    const label = parentScope.querySelector(`label[for="${inputElement.id}"]`);
    return label ? label.textContent.trim() : "";
}

function getLogicalParentDiv(element) {
    let current = element;
    while (current && current.parentElement) {
        if (current.parentElement.classList.contains('mes_text')) return current;
        if (current.classList.contains('ember-container') || current.classList.contains('ember-generic-html-iframe')) return element.parentElement;
        current = current.parentElement;
    }
    return element.parentElement;
}

function inputToString(inputElement, logicalParent) {
    const type = inputElement.getAttribute("type") ? inputElement.getAttribute("type").toLowerCase() : inputElement.tagName.toLowerCase();
    if (type === "radio" && !inputElement.checked) return "";
    let modifier = type === "range" ? "/" + (inputElement.getAttribute("max") || "100") : "";
    let value = inputElement.value;
    if (inputElement.tagName === "SELECT") value = inputElement.options[inputElement.selectedIndex].text;
    if (type === "checkbox") value = inputElement.checked ? "on" : "off";
    const labelForInput = findLabelForInput(inputElement, logicalParent);
    if (!labelForInput && !['button', 'submit', 'reset'].includes(type)) return "";
    const labelPrefix = labelForInput ? `${labelForInput}${labelForInput.endsWith(":") ? "" : ":"} ` : "";
    return `${labelPrefix}${value}${modifier}\n`;
}

function extractDataFromInputs(logicalParent) {
    let output = "";
    logicalParent.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea').forEach(el => {
        if (el.closest('iframe')) return;
        output += inputToString(el, logicalParent);
    });
    return output.trim();
}

async function handleInteractiveElementChangeEvent(event) {
    const element = event.target;
    const logicalParent = getLogicalParentDiv(element);
    if (logicalParent.querySelector(`button[${ELEMENT_LLM_SUBMIT_ATTRIBUTE}]`)) return;
    const output = inputToString(element, logicalParent).trim();
    if (output) {
        await sendMessageAsUser(output);
        await Generate("normal");
    }
}

async function handleInteractiveButtonClickEvent(event) {
    const button = event.currentTarget;
    const logicalParent = getLogicalParentDiv(button);
    let messageToSend = "";
    if (button.hasAttribute(ELEMENT_LLM_SUBMIT_ATTRIBUTE)) {
        messageToSend = extractDataFromInputs(logicalParent);
    }
    const buttonText = button.getAttribute('data-title') || button.textContent.trim();
    messageToSend += (messageToSend ? "\n" : "") + buttonText;


    await sendMessageAsUser(messageToSend);

    if (button.hasAttribute(ELEMENT_INJECT_CONTENT_ATTRIBUTE)) {
        const injectContent = button.getAttribute(ELEMENT_INJECT_CONTENT_ATTRIBUTE);
        if (injectContent) {
            const injectId = button.getAttribute('data-inject-id') || 'ember_clickable_button';
            const injectDepth = parseInt(button.getAttribute('data-inject-depth') || '0', 10);
            const injectEphemeral = button.getAttribute('data-inject-ephemeral') === 'true';

            let commandString = `/inject id="${injectId.replace(/"/g, '\\"')}" depth=${injectDepth} content="${injectContent.replace(/"/g, '\\"')}"`;
            if (injectEphemeral) commandString += " ephemeral=true";

            console.log("[Ember Clickable Inject] Executing:", commandString);
            try { await SlashCommands.executeCommand(commandString); }
            catch (ex) { console.error("[Ember Clickable Inject] Failed:", ex); }
        }
    }
    await Generate("normal");
    event.preventDefault();
}

function makeElementInteractive(element) {
    if (element.hasAttribute(ELEMENT_CLICKABLE_ATTRIBUTE)) return;
    const tagName = element.tagName.toLowerCase();
    const inputType = tagName === 'input' ? element.getAttribute('type')?.toLowerCase() : null;

    if (tagName === 'button' || (tagName === 'input' && ['button', 'submit', 'reset'].includes(inputType))) {
        element.addEventListener('click', handleInteractiveButtonClickEvent);
    } else if ((tagName === 'input' && !['button', 'submit', 'reset', 'text', 'password', 'search', 'file', 'image', 'color'].includes(inputType)) || tagName === 'select') {
        element.addEventListener('change', handleInteractiveElementChangeEvent);
    } else if (tagName === 'textarea' || (tagName === 'input' && ['text', 'password', 'search'].includes(inputType))) {
        element.addEventListener('input', () => { /* Simply acknowledge input occurred */ });
        element.addEventListener('keypress', (e) => {
            const logicalParent = getLogicalParentDiv(element);
            if (e.key === 'Enter' && !e.shiftKey && !(element.tagName === 'textarea' && element.closest('form')) && !logicalParent.querySelector(`button[${ELEMENT_LLM_SUBMIT_ATTRIBUTE}]`)) {
                handleInteractiveElementChangeEvent({ target: element });
                e.preventDefault();
            }
        });
    } else { return; }
    element.setAttribute(ELEMENT_CLICKABLE_ATTRIBUTE, 'true');
}

function processClickableInputs(messageTextElement) {
    if (!emberSettings.clickableInputsEnabled) return;
    messageTextElement.querySelectorAll('button, input, select, textarea').forEach(el => {
        if (!el.closest('.ember-iframe, .ember-generic-html-iframe, .ember-container')) {
            makeElementInteractive(el);
        }
    });
}

async function renderGenericHtmlInFrame(targetElement, htmlString, messageId) {
    if (!targetElement || targetElement.dataset.genericHtmlRendered === 'true') return;
    console.log(`[Ember HTML] Rendering generic HTML for message ${messageId}`);
    const originalHtmlInDom = targetElement.innerHTML; // Store current DOM content for potential restore
    targetElement.innerHTML = ''; // Clear target for iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'ember-generic-html-iframe';
    Object.assign(iframe.style, { width: '100%', border: 'none', display: 'block', overflow: 'hidden' });
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    const loadingSpinner = Object.assign(document.createElement('div'), {
        className: 'ember-loading-container',
        innerHTML: `<i class="fa-solid fa-spinner fa-spin"></i> <span>Loading HTML...</span>`,
        style: 'min-height: 50px; border: none; opacity: 0.7;'
    });
    targetElement.appendChild(loadingSpinner);

    const resizeIframe = () => {
        if (!iframe.contentWindow?.document?.body) return;
        // Use scrollHeight of documentElement for more robust height calculation
        iframe.style.height = Math.max(1, iframe.contentWindow.document.documentElement.scrollHeight) + 'px';
    };
    let resizeObserverInstance = null;
    iframe.addEventListener('load', () => {
        if (!iframe.contentWindow?.document?.body) { console.error("[Ember HTML] Iframe body not found on load for", messageId); return; }
        const body = iframe.contentWindow.document.body;
        const htmlEl = iframe.contentWindow.document.documentElement;

        // Ensure internal body/html don't cause double scrollbars and have no margin
        body.style.margin = '0';
        body.style.padding = '0'; // Often good to zero out padding too
        // body.style.overflow = 'hidden'; // Let content dictate scrollHeight, parent iframe handles clipping via height
        // htmlEl.style.overflow = 'hidden'; // Same for html element

        resizeIframe();
        if (!resizeObserverInstance) {
            resizeObserverInstance = new ResizeObserver(resizeIframe);
            // Observe both body and documentElement for size changes
            resizeObserverInstance.observe(body);
            resizeObserverInstance.observe(htmlEl);
        }
        loadingSpinner.style.display = 'none';
        iframe.style.display = 'block';
    });

    new MutationObserver((_, obs) => {
        if (!targetElement.contains(iframe) && resizeObserverInstance) {
            resizeObserverInstance.disconnect(); resizeObserverInstance = null; obs.disconnect();
        }
        if (!targetElement.contains(iframe)) {
            delete targetElement.dataset.genericHtmlRendered;
        }
    }).observe(targetElement, { childList: true });

    const computedParentStyle = window.getComputedStyle(targetElement);
    const iframeContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><base target="_blank"><style>
        html { margin:0; padding:0; /* overflow:hidden; --- Let content dictate height */ }
        body {
            font-family:${computedParentStyle.fontFamily};
            color:${computedParentStyle.color};
            background-color:transparent;
            margin:0;padding:0;
            /* overflow:hidden; --- Let content dictate height */
            word-wrap:break-word;
            overflow-wrap:break-word;
        }
        a{color:${computedParentStyle.getPropertyValue('--primary-color')||'dodgerblue'};}
        img,video,iframe{max-width:100%;height:auto;display:block;}
        h1, h2, h3, h4, h5, h6 { color: var(--text-color); margin-top: 0.5em; margin-bottom: 0.5em; }
        p { margin-top: 0.5em; margin-bottom: 0.5em; }
        ul, ol { margin-top: 0.5em; margin-bottom: 0.5em; padding-left: 20px; }
        li { margin-bottom: 0.2em; }
        table { border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid var(--SmartThemeBorderColor, #ccc); padding: 8px; text-align: left; }
        th { background-color: var(--background-color-hightlight, #f0f0f0); }
        pre, code { background-color: var(--background-color, #eee); padding: 2px 4px; border-radius: 4px; }
        pre { display: block; margin: 1em 0; padding: 10px; overflow-x: auto; }
        blockquote { margin: 1em 40px; padding: 0 15px; border-left: 4px solid var(--SmartThemeBorderColor, #ccc); opacity: 0.8; }
    </style></head><body>${htmlString}</body></html>`;
    try {
        targetElement.appendChild(iframe); // Append iframe *before* writing to it
        if (iframe.contentWindow) { // Check again just before use
             iframe.contentWindow.document.open();
             iframe.contentWindow.document.write(iframeContent);
             iframe.contentWindow.document.close();
        } else { throw new Error("iframe.contentWindow not available for generic HTML rendering just before write."); }
    } catch (e) {
        console.error(`[Ember HTML] Error writing to iframe for message ${messageId}:`, e);
        targetElement.innerHTML = originalHtmlInDom; // Restore original DOM content if iframe fails
        delete targetElement.dataset.genericHtmlRendered;
        loadingSpinner.remove();
    }
    targetElement.dataset.genericHtmlRendered = 'true';
}


function addGenericHtmlRunButton(messageDomElement, messageId, htmlContentToRenderOnClick) {
    if (!messageDomElement || messageDomElement.querySelector('.ember-run-html-button')) return;
    const buttonContainer = messageDomElement.querySelector('.extraMesButtons');
    if (buttonContainer) {
        const button = Object.assign(document.createElement('div'), {
            className: 'mes_button ember-run-html-button fa-solid fa-code interactable', title: 'Render HTML Content'
        });
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const mesTextEl = messageDomElement.querySelector('.mes_text');
            if (mesTextEl && htmlContentToRenderOnClick) { // Use the passed HTML content
                 mesTextEl.querySelectorAll(`[${ELEMENT_CLICKABLE_ATTRIBUTE}]`).forEach(el => {
                     el.removeAttribute(ELEMENT_CLICKABLE_ATTRIBUTE);
                 });
                renderGenericHtmlInFrame(mesTextEl, htmlContentToRenderOnClick, messageId);
            }
            button.remove();
        });
        buttonContainer.prepend(button);
    }
}

async function attemptSelfHeal(messageId, codeElement, errorMessage) {
    const healButton = document.querySelector(`.mes[mesid="${messageId}"] .ember-heal-button`);
    if (healButton?.classList.contains('fa-spin')) return;
    if (healButton) healButton.classList.add('fa-spin');
    const originalCode = codeElement.innerText;
    const promptText = `${HEALER_SYSTEM_PROMPT}\n\nError/Symptom: "${errorMessage}"\n\n\`\`\`javascript\n${originalCode}\n\`\`\``;
    try {
        const res = await fetch('https://text.pollinations.ai/', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4.1', messages: [{ role: 'user', content: promptText }], private: true })
        });
        if (!res.ok) throw new Error(`AI Heal API failed: ${res.status}`);
        const correctedText = await res.text();
        const codeMatch = correctedText.match(/```javascript\s*([\s\S]*?)\s*```/);
        const correctedCode = codeMatch ? codeMatch[1].trim() : correctedText.trim();

        if (correctedCode && correctedCode.trim() !== originalCode.trim()) {
            const core = getContext(); const msg = core.chat[messageId];
            if (!msg) throw new Error(`Message ${messageId} not found in chat context.`);

            let preElement = document.querySelector(`.mes[mesid="${messageId}"] pre[data-ember-processed="true"]`);
            if (!preElement) {
                 console.warn(`[Ember Self-Heal] Could not find pre element with data-ember-processed="true" for message ${messageId}. Searching by content.`);
                 const allPre = document.querySelectorAll(`.mes[mesid="${messageId}"] pre`);
                 for(const pre of allPre) {
                      if (pre.querySelector('code')?.innerText.trim() === originalCode.trim()) {
                           preElement = pre;
                           break;
                      }
                 }
                 if (!preElement) {
                      throw new Error(`Could not find the original code block for message ${messageId} to replace.`);
                 }
            }

            const originalFrontmatterMatch = originalCode.match(/^---\s*([\s\S]*?)\s*---/);
            const correctedMarkdown = `${originalFrontmatterMatch ? originalFrontmatterMatch[0].trim() + '\n' : '---\n---\n'}\n\`\`\`javascript\n${correctedCode}\n\`\`\``;
            const originalMarkdownBlockMatch = msg.mes.match(new RegExp(`(\`\`\`javascript\\s*${escapeRegExp(originalCode)}\\s*\`\`\`)`, 's'));

            if (originalMarkdownBlockMatch) {
                 const fullOriginalBlock = originalMarkdownBlockMatch[1];
                 const fullOriginalMarkdownWithFrontmatterMatch = msg.mes.match(new RegExp(`(---\\s*[\\s\\S]*?\\s*---\\s*)?${escapeRegExp(fullOriginalBlock)}`, 's'));

                 if (fullOriginalMarkdownWithFrontmatterMatch) {
                      const fullOriginalMarkdown = fullOriginalMarkdownWithFrontmatterMatch[0];
                      msg.mes = msg.mes.replace(fullOriginalMarkdown, correctedMarkdown);
                      const msgEl = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
                       if (msgEl) {
                           cleanupEmberElements(messageId);
                           msgEl.innerHTML = messageFormatting(msg.mes, msg.is_user ? core.name2 : msg.name, msg.is_system, msg.is_user, Number(messageId));
                           addCopyToCodeBlocks(msgEl);
                           handleMessageRender(Number(messageId), msg.is_user);
                           eventSource.emit(event_types.MESSAGE_EDITED, Number(messageId));
                      } else {
                          console.error(`[Ember Self-Heal] Could not find message text element for message ${messageId} after editing.`);
                          alert('Ember: Message content updated in chat, but DOM element not found to re-render.');
                      }
                 } else { throw new Error("Could not find original markdown block structure in message text."); }
            } else { throw new Error("Could not find the original code block markdown in message text."); }
        } else { console.log('[Ember Self-Heal] AI provided identical or empty code. No fix applied.'); }
    } catch (err) {
        console.error('[Ember Self-Heal] Failed:', err);
        alert(`Ember Self-Heal failed for message ${messageId}: ${err.message}`);
    }
    finally { if (healButton) healButton.classList.remove('fa-spin'); }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function createSandboxedFrame(code, libraryCodes = [], frameId) {
    const iframe = Object.assign(document.createElement('iframe'), {
        className: 'ember-iframe', sandbox: 'allow-scripts allow-same-origin', dataset: { frameId }
    });
    const safeCodeString = JSON.stringify(code);
    const iframeContent = `<html><head><style>body{font-family:var(--mainFontFamily,sans-serif);color:var(--text-color,#000);background-color:transparent;margin:0;padding:5px}#root{width:100%;height:100%;box-sizing:border-box}</style></head><body><div id="root"></div><script>(()=>{
        const e="${frameId}";
        const t=o=>window.parent.postMessage({type:"ember-error",frameId:e,message:o},"*");
        const n=()=>window.parent.postMessage({type:"ember-success",frameId:e},"*");

        window.ember = {
            inject: function(options) {
                if (!options || typeof options.content !== 'string') {
                    t("Ember Internal Error: ember.inject called with invalid options. 'content' (string) is required.");
                    return;
                }
                const injectionData = {
                    id: typeof options.id === 'string' ? options.id : 'ember_js_block',
                    depth: typeof options.depth === 'number' ? options.depth : 0,
                    content: options.content,
                    ephemeral: typeof options.ephemeral === 'boolean' ? options.ephemeral : false
                };
                window.parent.postMessage({ type: "ember-inject-js", frameId: e, injection: injectionData }, "*");
            }
        };

        let o=!1;
        const s=()=>{if(o)return;o=!0,clearTimeout(d),i&&i.disconnect(), setTimeout(n, 50);};
        const d=setTimeout(()=>{o||t("Ember Warning: Script produced no visual output within 7 seconds.")},7000);
        const i=new MutationObserver(()=>{ if(document.getElementById("root")?.hasChildNodes()){ s(); } });
        const rootElementForObserver = document.getElementById("root");
        if(rootElementForObserver) {
             i.observe(rootElementForObserver,{childList:!0,subtree:!0});
             if (rootElementForObserver.hasChildNodes()) { s(); }
        } else {
            t("Ember Internal Error: #root element not found in iframe for MutationObserver.");
        }

        new ResizeObserver(()=>{
            const o=Math.ceil(document.documentElement.scrollHeight);
            if(o>0) window.parent.postMessage({type:"ember-resize",frameId:e,height:o},"*");
        }).observe(document.documentElement);

        try{
            const libraryScripts = ${JSON.stringify(libraryCodes)};
            for(const scriptContent of libraryScripts){
                const scriptEl = document.createElement("script");
                scriptEl.textContent = scriptContent;
                document.head.appendChild(scriptEl);
            }
            const userCodeToRun = ${safeCodeString};
            const rootElement = document.getElementById("root");
            if (!rootElement) { t("Ember Internal Error: #root element not found in iframe."); return; }
            new Function('root', userCodeToRun)(rootElement);
             setTimeout(s, 1000);
        }catch(err){
            t("Ember Execution Error: "+(err.stack||err.message));
        }})();<\/script></body></html>`;
    iframe.src = URL.createObjectURL(new Blob([iframeContent], { type: 'text/html' }));
    return iframe;
}

async function processMessage(messageId, isUserMessage = false) {
    const messageDomElement = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (!messageDomElement) return;
    const messageTextElement = messageDomElement.querySelector('.mes_text');
    if (!messageTextElement || messageTextElement.querySelector('.ember-iframe, .ember-generic-html-iframe, .edit_textarea')) {
        return;
    }

    let processedByEmberJs = false;
    for (const codeBlock of messageTextElement.querySelectorAll(`pre > code[class*="language-javascript"], pre > code[class*="lang-javascript"]`)) {
        const parentPre = codeBlock.parentElement;
        if (parentPre.dataset.emberProcessed === 'true') { processedByEmberJs = true; continue; }
        const rawCode = codeBlock.innerText.trim();
        let frontmatter = '';
        let codeWithoutFrontmatter = rawCode;
        const frontmatterMatch = rawCode.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
        if (frontmatterMatch) {
            frontmatter = frontmatterMatch[1];
            codeWithoutFrontmatter = frontmatterMatch[2] || '';
        } else {
            continue;
        }
        if (!codeWithoutFrontmatter.trim()) {
             parentPre.dataset.emberProcessed = 'skipped';
             continue;
        }
        processedByEmberJs = true; parentPre.dataset.emberProcessed = 'true';
        const requestedLibs = [];
        try {
            frontmatter.trim().split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.toLowerCase().startsWith('libs:')) return;
                if (trimmedLine.startsWith('-')) {
                    const libAlias = trimmedLine.substring(1).trim();
                    if (libAlias) requestedLibs.push(libAlias);
                }
            });
        } catch (e) { console.error('[Ember JS] Error parsing frontmatter libs:', e); }

        const frameId = `ember-frame-${messageId}-${Date.now()}`;
        const loadingContainer = Object.assign(document.createElement('div'), { className: 'ember-loading-container', innerHTML: `<i class="fa-solid fa-spinner fa-spin"></i> <span>Ember JS preparing...</span>`, dataset: { frameId } });
        const finalContainer = Object.assign(document.createElement('div'), { className: 'ember-container', style: 'display:none;', dataset: { frameId } });
        parentPre.insertAdjacentElement('afterend', finalContainer);
        parentPre.insertAdjacentElement('afterend', loadingContainer);

        try {
            const libUrls = requestedLibs.map(alias => BUILT_IN_LIBRARIES.find(lib=>lib.alias===alias)).filter(Boolean).map(libDef=>`${location.origin}/scripts/extensions/third-party/${MODULE_NAME}/lib/${libDef.file}`);
            const libCodes = await Promise.all(libUrls.map(url => fetch(url).then(res => res.ok ? res.text() : Promise.reject(`Failed to fetch library ${url}`))));
            finalContainer.appendChild(createSandboxedFrame(codeWithoutFrontmatter, libCodes, frameId));
            parentPre.style.display = 'none';
        } catch (error) {
            console.error('[Ember JS] Critical error creating sandbox or fetching libs:', error);
            loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember JS Error:</b> Could not create sandbox or load libraries. Check console.</span>`;
            loadingContainer.style.color = 'var(--text-color-error)';
            parentPre.dataset.emberProcessed = 'false';
            if (finalContainer) finalContainer.remove();
        }
    }
    if (processedByEmberJs) return;

    // Direct HTML Rendering Logic
    let genericHtmlShouldBeHandled = false;
    let rawMessageContent = getContext().chat[messageId]?.mes;
    let htmlForProcessing = rawMessageContent; // Default to original raw content

    if (htmlForProcessing) {
        // Check if the entire raw message content is an HTML markdown code block
        const htmlCodeBlockMatch = htmlForProcessing.match(/^```html\s*\n([\s\S]*?)\n```\s*$/im);
        if (htmlCodeBlockMatch && htmlCodeBlockMatch[1]) {
            htmlForProcessing = htmlCodeBlockMatch[1].trim(); // Use the extracted HTML
            console.log(`[Ember HTML] Extracted HTML from code block for message ${messageId}`);
        }
    }

    if (emberSettings.directHtmlEnabled && !messageTextElement.querySelector('.ember-generic-html-iframe')) {
        if (htmlForProcessing) { // Ensure there's content to process
            const complexHtmlRegex = /<\s*(div|table|form|canvas|svg|section|article|header|footer|nav|aside|dl|dt|dd|figure|figcaption|summary|dialog|menu|input|select|button|textarea)\b|<[a-z]+\s+[^>]*style=["']/i;
            if (complexHtmlRegex.test(htmlForProcessing)) {
                genericHtmlShouldBeHandled = true;
                const autoActivateUser = emberSettings.directHtmlProcessingMode === 'both';
                const autoActivateResponse = emberSettings.directHtmlProcessingMode === 'responses' || autoActivateUser;

                if ((isUserMessage && autoActivateUser) || (!isUserMessage && autoActivateResponse)) {
                    await renderGenericHtmlInFrame(messageTextElement, htmlForProcessing, messageId);
                    return;
                } else {
                    addGenericHtmlRunButton(messageDomElement, messageId, htmlForProcessing);
                }
            }
        }
    }

    if (!messageTextElement.querySelector('.ember-iframe, .ember-generic-html-iframe') && !genericHtmlShouldBeHandled) {
        if (emberSettings.clickableInputsEnabled) {
            processClickableInputs(messageTextElement);
        }
    }
}

window.addEventListener('message', async (event) => {
    if (!event.data || !event.data.type?.startsWith('ember-')) return;
    const { type, frameId, message, height, injection } = event.data;
    const loadingContainer = document.querySelector(`.ember-loading-container[data-frame-id="${frameId}"]`);
    const finalContainer = document.querySelector(`.ember-container[data-frame-id="${frameId}"]`);

    switch (type) {
        case 'ember-error':
            if (!loadingContainer) return;
            console.error(`[Ember JS Iframe Error: ${frameId}] ${message}`);
            loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember JS Error:</b> ${message.split('\n')[0]}</span>`;
            loadingContainer.style.color = 'var(--text-color-error)'; loadingContainer.style.display = 'flex';
            if (finalContainer) finalContainer.style.display = 'none';
            const msgIdErr = frameId.split('-')[2];
            const codeElErr = document.querySelector(`.mes[mesid="${msgIdErr}"] pre[data-ember-processed="true"] > code`);
            if (codeElErr && message.startsWith('Ember Execution Error:')) {
                attemptSelfHeal(msgIdErr, codeElErr, message);
            }
            break;
        case 'ember-success':
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (finalContainer) finalContainer.style.display = 'block';
            break;
        case 'ember-resize':
            if (!finalContainer || height <= 0) break;
            const currentMax = emberMaxHeights[frameId] || 0;
            const newHeight = height + 15;
            if (newHeight > currentMax) {
                 emberMaxHeights[frameId] = newHeight;
                 finalContainer.style.height = newHeight + 'px';
            }
            break;
        case 'ember-inject-js':
            if (injection && typeof injection.content === 'string') {
                let commandString = `/inject id="${injection.id.replace(/"/g, '\\"')}" depth=${injection.depth} content="${injection.content.replace(/"/g, '\\"')}"`;
                if (injection.ephemeral) commandString += " ephemeral=true";
                console.log(`[Ember JS Inject via ${frameId}] Executing: ${commandString}`);
                try {
                    await SlashCommands.executeCommand(commandString);
                }
                catch (ex) { console.error(`[Ember JS Inject via ${frameId}] Failed:`, ex); }
            } else { console.error(`[Ember JS Inject via ${frameId}] Invalid data received for injection:`, injection); }
            break;
    }
});

function cleanupEmberElements(messageId) {
    const msgEl = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (msgEl) {
        msgEl.querySelectorAll('.ember-container, .ember-loading-container, .ember-generic-html-iframe, .ember-run-html-button').forEach(el => el.remove());
        msgEl.querySelectorAll('pre[data-ember-processed]').forEach(pre => {
            pre.style.display = '';
            delete pre.dataset.emberProcessed;
        });
        const mesText = msgEl.querySelector('.mes_text');
        if (mesText) {
             delete mesText.dataset.genericHtmlRendered;
        }
        msgEl.querySelectorAll(`[${ELEMENT_CLICKABLE_ATTRIBUTE}]`).forEach(el => {
            el.removeAttribute(ELEMENT_CLICKABLE_ATTRIBUTE);
        });
        Object.keys(emberMaxHeights).forEach(key => {
             if (key.startsWith(`ember-frame-${messageId}-`)) {
                 delete emberMaxHeights[key];
             }
        });
    }
}

function initializeHealButton() {
    const healButtonHtml = `<div class="mes_button ember-heal-button fa-solid fa-bolt interactable" title="Attempt to fix Ember JavaScript with AI"></div>`;
    if ($('#message_template .extraMesButtons .ember-heal-button').length === 0) {
        $('#message_template .extraMesButtons').prepend(healButtonHtml);
    }
}

function loadSettings() {
    if (global_extension_settings && global_extension_settings[MODULE_NAME]) {
        emberSettings = {
            ...emberSettings,
            ...global_extension_settings[MODULE_NAME]
        };
    }
    emberSettings.clickableInputsPrompt = emberSettings.clickableInputsPrompt || DEFAULT_EMBER_JS_INSTRUCTIONS;

    $('#ember-direct-html-enabled').prop('checked', emberSettings.directHtmlEnabled);
    $('#ember-direct-html-processing-mode').val(emberSettings.directHtmlProcessingMode);
    $('#ember-clickable-inputs-enabled').prop('checked', emberSettings.clickableInputsEnabled);
    $('#ember-clickable-inputs-prompt-enabled').prop('checked', emberSettings.clickableInputsPromptEnabled);
    $('#ember-clickable-inputs-prompt').val(emberSettings.clickableInputsPrompt);

    const rawHtmlFeatureEnabled = emberSettings.clickableInputsEnabled;
    const promptInjectionEnabled = emberSettings.clickableInputsPromptEnabled;
    $('#ember-clickable-inputs-prompt-enabled').prop('disabled', !rawHtmlFeatureEnabled);
    const promptTextareaDisabled = !rawHtmlFeatureEnabled || !promptInjectionEnabled;
    $('#ember-clickable-inputs-prompt').prop('disabled', promptTextareaDisabled);
    $('#ember-clickable-inputs-prompt-restore').css({ 'pointer-events': promptTextareaDisabled ? 'none' : '', opacity: promptTextareaDisabled ? '0.5' : '' });

    updateEmberPromptInjection();
}

function saveSettings() {
    if (!global_extension_settings[MODULE_NAME]) global_extension_settings[MODULE_NAME] = {};
    Object.assign(global_extension_settings[MODULE_NAME], emberSettings);
    getContext().saveSettingsDebounced();
    updateEmberPromptInjection();
}

const handleMessageRender = (id, isUser) => {
    setTimeout(() => {
        const messageData = getContext().chat[id];
        if (messageData) {
             processMessage(id, isUser);
        }
    }, 50);
};

function processExistingMessages() {
    document.querySelectorAll('#chat .mes').forEach(mes => {
        const id = Number(mes.getAttribute('mesid'));
        cleanupEmberElements(id);
        const messageData = getContext().chat[id];
        if (messageData) {
             handleMessageRender(id, mes.classList.contains('user_mes'));
        }
    });
}

$(document).ready(async function () {
    try {
        const settingsHtmlPath = `scripts/extensions/third-party/${MODULE_NAME}/settings.html`;
        const response = await fetch(settingsHtmlPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${settingsHtmlPath}: ${response.status} ${response.statusText}`);
        }
        const settingsHtmlContent = await response.text();
        $('#extensions_settings').append(settingsHtmlContent);
        console.log(`[Ember] Settings HTML loaded from "${settingsHtmlPath}" and appended.`);
    } catch (err) {
        console.error(`[Ember] Failed to load or append settings HTML. Please check if settings.html exists at the correct path: scripts/extensions/third-party/${MODULE_NAME}/settings.html. Error:`, err);
    }

    loadSettings();
    initializeHealButton();

    $('#ember-direct-html-enabled').on('change', function() {
        emberSettings.directHtmlEnabled = $(this).is(':checked');
        saveSettings();
        processExistingMessages();
    });

    $('#ember-direct-html-processing-mode').on('change', function() {
        emberSettings.directHtmlProcessingMode = $(this).val();
        saveSettings();
        processExistingMessages();
    });

    $('#ember-clickable-inputs-enabled').on('change', function() {
        emberSettings.clickableInputsEnabled = $(this).is(':checked');
        const rawHtmlFeatureEnabled = emberSettings.clickableInputsEnabled;
        $('#ember-clickable-inputs-prompt-enabled').prop('disabled', !rawHtmlFeatureEnabled);
        const promptInjectionEnabled = $('#ember-clickable-inputs-prompt-enabled').is(':checked');
        const promptTextareaDisabled = !rawHtmlFeatureEnabled || !promptInjectionEnabled;
        $('#ember-clickable-inputs-prompt').prop('disabled', promptTextareaDisabled);
        $('#ember-clickable-inputs-prompt-restore').css({ 'pointer-events': promptTextareaDisabled ? 'none' : '', opacity: promptTextareaDisabled ? '0.5' : '' });
         if (!rawHtmlFeatureEnabled) {
             $('#ember-clickable-inputs-prompt-enabled').prop('checked', false);
             emberSettings.clickableInputsPromptEnabled = false;
         }
        saveSettings();
        processExistingMessages();
    });

    $('#ember-clickable-inputs-prompt-enabled').on('change', function() {
        emberSettings.clickableInputsPromptEnabled = $(this).is(':checked');
        const rawHtmlFeatureEnabled = emberSettings.clickableInputsEnabled;
        const promptInjectionEnabled = emberSettings.clickableInputsPromptEnabled;
        const promptTextareaDisabled = !rawHtmlFeatureEnabled || !promptInjectionEnabled;
        $('#ember-clickable-inputs-prompt').prop('disabled', promptTextareaDisabled);
        $('#ember-clickable-inputs-prompt-restore').css({ 'pointer-events': promptTextareaDisabled ? 'none' : '', opacity: promptTextareaDisabled ? '0.5' : '' });
        saveSettings();
    });

    $('#ember-clickable-inputs-prompt').on('input', function() {
        emberSettings.clickableInputsPrompt = $(this).val();
        saveSettings();
    });

    $('#ember-clickable-inputs-prompt-restore').on('click', function() {
        if (!emberSettings.clickableInputsEnabled || !emberSettings.clickableInputsPromptEnabled) return;
        $('#ember-clickable-inputs-prompt').val(DEFAULT_EMBER_JS_INSTRUCTIONS);
        emberSettings.clickableInputsPrompt = DEFAULT_EMBER_JS_INSTRUCTIONS;
        saveSettings();
    });

    eventSource.on(event_types.USER_MESSAGE_RENDERED, (id) => handleMessageRender(id, true));
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (id) => handleMessageRender(id, false));
    eventSource.on(event_types.MESSAGE_EDITED, (id) => {
        cleanupEmberElements(id);
        const msg = getContext().chat[id];
        if (msg) handleMessageRender(id, msg.is_user);
    });
    eventSource.on(event_types.CHAT_LOADED, processExistingMessages);
    eventSource.on(event_types.CHAT_CHANGED, (data) => {
         if (data?.type === 'new') {
             data.ids.forEach(id => { const msg = getContext().chat[id]; if(msg) handleMessageRender(id, msg.is_user); });
         } else if (!data || !data?.type) {
             processExistingMessages();
         }
     });

    $(document).on('click', '.ember-heal-button', function() {
        const messageId = $(this).closest('.mes').attr('mesid');
        const codeElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text pre[data-ember-processed="true"] > code`);
        const errorMessageElement = $(this).closest('.mes').find('.ember-loading-container[style*="color: var(--text-color-error)"]');
        const errorMessage = errorMessageElement.length > 0 ? errorMessageElement.text().replace('Ember JS Error:', '').trim() : 'Manual heal requested.';

        if (codeElement) {
             attemptSelfHeal(messageId, codeElement, errorMessage);
        } else {
            alert('Ember: No active Ember JS code block (with frontmatter) found in this message to heal.');
        }
    });

    console.log('Ember (Enhanced with JS Injection) extension loaded.');
});