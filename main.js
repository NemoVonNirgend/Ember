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
const DEFAULT_EMBER_JS_INSTRUCTIONS = `### [System Directive: Interactive JavaScript Code with Ember]

**IMPORTANT: Write JavaScript code in standard \`\`\`javascript code blocks. No special formatting required!**

**Execution Environment:**
*   Your code runs in a secure sandbox with a \`root\` element available
*   **ALWAYS append elements to \`root\`:** \`root.appendChild(yourElement)\`
*   All libraries are automatically loaded: \`d3\`, \`three\`, \`p5\`, \`anime\`, \`Chart\`, \`Matter\`
*   No imports needed - libraries are globally available

**How to Write Code:**
1. Use regular \`\`\`javascript code blocks (NOT HTML with embedded JS)
2. Create elements with \`document.createElement()\`
3. Always append to \`root\`: \`root.appendChild(element)\`
4. All libraries work immediately (no imports needed)

**Available Libraries:** \`d3\`, \`three\`, \`p5\`, \`anime\`, \`Chart\` (from chartjs), \`Matter\`.

**Context Injection from JavaScript:**
*   Your script can inject information directly into the chat's context using the global \`ember.inject()\` function.
*   **Function Signature:** \`ember.inject({ id: '...', depth: 0, content: '...', ephemeral: false });\`

*   **Example (Simple Chart):**
    \`\`\`javascript
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

**EMBER JS ENVIRONMENT RULES (CHECK FOR THESE ERRORS):**
*   **Use the 'root' Element:** A \`div\` with the id \`root\` is provided. All visual output (canvases, divs, svgs, etc.) MUST be appended to this \`root\` element.
*   **Available Libraries:** \`d3\`, \`three\`, \`p5\`, \`anime\`, \`Chart\`, \`Matter\` are automatically loaded and ready to use.
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

    console.log(`[Ember Debug] Updating prompt injection...`);
    console.log(`[Ember Debug] clickableInputsEnabled: ${emberSettings.clickableInputsEnabled}`);
    console.log(`[Ember Debug] clickableInputsPromptEnabled: ${emberSettings.clickableInputsPromptEnabled}`);

    if (emberSettings.clickableInputsEnabled && emberSettings.clickableInputsPromptEnabled) {
        console.log(`[Ember Debug] Setting extension prompt with ID: ${promptId}`);
        console.log(`[Ember Debug] Prompt content length: ${emberSettings.clickableInputsPrompt.length} chars`);
        console.log(`[Ember Debug] extension_prompt_types.IN_PROMPT value:`, extension_prompt_types.IN_PROMPT);
        console.log(`[Ember Debug] Available prompt types:`, extension_prompt_types);
        
        // Try multiple prompt types to see which one works
        console.log(`[Ember Debug] Attempting to set prompt with IN_PROMPT type...`);
        setExtensionPrompt(promptId, emberSettings.clickableInputsPrompt, extension_prompt_types.IN_PROMPT, promptDepth);
        console.log(`[Ember Debug] Extension prompt set with IN_PROMPT successfully`);
        
        // Also try SYSTEM_PROMPT as backup
        if (extension_prompt_types.SYSTEM_PROMPT !== undefined) {
            console.log(`[Ember Debug] Also setting with SYSTEM_PROMPT type as backup...`);
            setExtensionPrompt(promptId + "_system", emberSettings.clickableInputsPrompt, extension_prompt_types.SYSTEM_PROMPT, promptDepth);
            console.log(`[Ember Debug] Extension prompt set with SYSTEM_PROMPT successfully`);
        }
        
        // Also try BEFORE_PROMPT as backup
        if (extension_prompt_types.BEFORE_PROMPT !== undefined) {
            console.log(`[Ember Debug] Also setting with BEFORE_PROMPT type as backup...`);
            setExtensionPrompt(promptId + "_before", emberSettings.clickableInputsPrompt, extension_prompt_types.BEFORE_PROMPT, promptDepth);
            console.log(`[Ember Debug] Extension prompt set with BEFORE_PROMPT successfully`);
        }
        
        console.log(`[Ember Debug] All prompt injection attempts completed`);
    } else {
        console.log(`[Ember Debug] Clearing extension prompt (settings disabled)`);
        setExtensionPrompt(promptId, "");
        setExtensionPrompt(promptId + "_system", "");
        setExtensionPrompt(promptId + "_before", "");
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

// Unicode-safe hash function for deduplication
function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}


// WeatherPack-inspired comprehensive JavaScript detection function
function detectJavaScriptContent(className, codeContent) {
    console.log(`[Ember Debug] Analyzing content for JavaScript patterns...`);
    
    // Check if it's a JavaScript code block by class name first
    const isDirectJavaScript = className.includes('javascript') || className.includes('lang-js') || className.includes('js');
    
    // Check if it's HTML containing JavaScript (script tags OR ES6 imports OR JS code patterns)
    const hasScriptTags = /<script\b[^>]*>[\s\S]*?<\/script>/i.test(codeContent);
    const hasES6Imports = /\bimport\s+.*\s+from\s+['"][^'"]+['"]/.test(codeContent);
    const hasJSInHTML = /\b(const|let|var|function|=>\||addEventListener|document\.)\b/.test(codeContent);
    
    const isHtmlWithJavaScript = (className.includes('html') || className.includes('xml')) &&
                               (hasScriptTags || hasES6Imports || hasJSInHTML);
    
    // Enhanced content-based detection inspired by WeatherPack's thorough analysis
    const hasJSKeywords = /\b(const|let|var|function|class|if|else|for|while|return|new|this|try|catch|finally|async|await|export|import)\b/.test(codeContent);
    const hasDOMManipulation = /\b(document\.|window\.|\.getElementById|\.querySelector|\.createElement|\.appendChild|\.addEventListener)\b/.test(codeContent);
    const hasJSMethods = /\b(\.push|\.pop|\.map|\.filter|\.forEach|\.reduce|\.find|\.some|\.every|console\.log|JSON\.|Math\.)\b/.test(codeContent);
    const hasArrowFunctions = /=>\s*[\{\(]/.test(codeContent);
    const hasJSOperators = /[=!]==|&&|\|\||\.\.\.|\?\?|\?\./.test(codeContent);
    const hasRegexLiterals = /\/[^\/\n]+\/[gimuy]*/.test(codeContent);
    const hasTemplateLiterals = /`[^`]*\$\{[^}]*\}[^`]*`/.test(codeContent);
    
    console.log(`[Ember Debug] JS Detection Analysis:`);
    console.log(`[Ember Debug] - Direct JS class: ${isDirectJavaScript}`);
    console.log(`[Ember Debug] - HTML with JS: ${isHtmlWithJavaScript}`);
    console.log(`[Ember Debug] - Has JS keywords: ${hasJSKeywords}`);
    console.log(`[Ember Debug] - Has DOM manipulation: ${hasDOMManipulation}`);
    console.log(`[Ember Debug] - Has JS methods: ${hasJSMethods}`);
    console.log(`[Ember Debug] - Has arrow functions: ${hasArrowFunctions}`);
    console.log(`[Ember Debug] - Has JS operators: ${hasJSOperators}`);
    
    if (className.includes('html') || className.includes('xml')) {
        console.log(`[Ember Debug] HTML block has script tags: ${hasScriptTags}`);
        console.log(`[Ember Debug] HTML block has ES6 imports: ${hasES6Imports}`);
        console.log(`[Ember Debug] HTML block has JS patterns: ${hasJSInHTML}`);
    }
    
    // Content-based detection with multiple criteria
    const contentBasedScore = [
        hasJSKeywords,
        hasDOMManipulation, 
        hasJSMethods,
        hasArrowFunctions,
        hasJSOperators,
        hasRegexLiterals,
        hasTemplateLiterals
    ].filter(Boolean).length;
    
    // Consider it JavaScript if it has multiple JavaScript indicators
    // and doesn't start with obvious HTML/CSS
    const isContentBasedJavaScript = !className.includes('html') && !className.includes('xml') && !className.includes('css') &&
                                    !isDirectJavaScript && !isHtmlWithJavaScript &&
                                    contentBasedScore >= 2 && // At least 2 JavaScript indicators
                                    !/^\s*<[a-zA-Z]/.test(codeContent) && // Doesn't start with HTML tag
                                    !/^\s*[a-zA-Z#.][^{]*\{/.test(codeContent); // Doesn't start with CSS rule
    
    const isJavaScript = isDirectJavaScript || isHtmlWithJavaScript || isContentBasedJavaScript;
    
    console.log(`[Ember Debug] Content-based score: ${contentBasedScore}/7, Is content-based JS: ${isContentBasedJavaScript}`);
    console.log(`[Ember Debug] Final determination - Is JavaScript: ${isJavaScript}`);
    
    return {
        isJavaScript,
        isDirectJavaScript,
        isHtmlWithJavaScript,
        isContentBasedJavaScript,
        hasScriptTags,
        contentBasedScore
    };
}

// WeatherPack-inspired function to process script tags directly from HTML
async function processScriptTagsInHTML(messageId, htmlContent, messageTextElement, processedScriptHashes = new Set()) {
    console.log(`[Ember Debug] Processing script tags in HTML for message ${messageId}`);
    
    // Parse HTML safely using DOMParser to avoid script execution during parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Extract all script elements from the parsed document
    const scripts = doc.querySelectorAll('script');
    console.log(`[Ember Debug] Found ${scripts.length} script tags in raw HTML`);
    
    if (scripts.length === 0) {
        return false; // No scripts found
    }
    
    let processedAnyScripts = false;
    
    for (const script of scripts) {
        const scriptContent = script.innerHTML.trim();
        const scriptSrc = script.getAttribute('src');
        
        // Create a hash of the script content to avoid duplicates (Unicode-safe)
        const scriptHash = simpleHash(scriptContent).toString().substring(0, 10);
        if (processedScriptHashes.has(scriptHash)) {
            console.log(`[Ember Debug] Skipping duplicate script (hash: ${scriptHash})`);
            continue;
        }
        
        // Skip empty scripts and external scripts for security
        if (!scriptContent && !scriptSrc) {
            console.log(`[Ember Debug] Skipping empty script tag`);
            continue;
        }
        
        if (scriptSrc) {
            console.log(`[Ember Debug] Skipping external script source for security: ${scriptSrc}`);
            continue;
        }
        
        if (!scriptContent.trim()) {
            console.log(`[Ember Debug] Skipping script with empty content`);
            continue;
        }
        
        console.log(`[Ember Debug] Processing inline script content (${scriptContent.length} chars)`);
        
        // Mark this script as processed
        processedScriptHashes.add(scriptHash);
        
        // Validate JavaScript syntax before execution
        try {
            new Function(scriptContent);
            console.log(`[Ember Debug] Script syntax validation passed`);
        } catch (syntaxError) {
            console.error(`[Ember Debug] Script syntax error:`, syntaxError);
            console.log(`[Ember Debug] Problematic script content:`, scriptContent);
            continue;
        }
        
        // Create iframe execution environment for this script
        const frameId = `ember-frame-${messageId}-script-${Date.now()}`;
        console.log(`[Ember Debug] Creating iframe for script tag execution`);
        
        // Load all libraries by default
        const requestedLibs = ['d3', 'three', 'p5', 'anime', 'chartjs', 'matter'];
        
        try {
            console.log(`[Ember Debug] Loading libraries for script execution: ${requestedLibs.join(', ')}`);
            
            const libMap = requestedLibs.map(alias => BUILT_IN_LIBRARIES.find(lib=>lib.alias===alias)).filter(Boolean);
            const libUrls = libMap.map(libDef=>`${location.origin}/scripts/extensions/third-party/${MODULE_NAME}/lib/${libDef.file}`);
            
            const libCodes = await Promise.all(libUrls.map(async (url) => {
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    return await res.text();
                } catch (err) {
                    console.error(`[Ember Debug] Failed to fetch ${url}:`, err);
                    throw new Error(`Failed to fetch library ${url}: ${err.message}`);
                }
            }));
            
            // Create loading and final containers
            const loadingContainer = document.createElement('div');
            loadingContainer.className = 'ember-loading-container';
            loadingContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Ember JS preparing script...</span>`;
            loadingContainer.dataset.frameId = frameId;
            
            const finalContainer = document.createElement('div');
            finalContainer.className = 'ember-container';
            finalContainer.style.display = 'none';
            finalContainer.dataset.frameId = frameId;
            
            // Insert containers into the message
            messageTextElement.appendChild(loadingContainer);
            messageTextElement.appendChild(finalContainer);
            
            console.log(`[Ember Debug] Creating sandboxed iframe for script execution`);
            const iframe = createSandboxedFrame(scriptContent, libCodes, frameId);
            finalContainer.appendChild(iframe);
            
            processedAnyScripts = true;
            console.log(`[Ember Debug] Successfully set up script execution for ${scriptContent.length} chars of code`);
            
        } catch (error) {
            console.error('[Ember JS] Critical error creating sandbox for script tag:', error);
            // Create error display
            const errorContainer = document.createElement('div');
            errorContainer.className = 'ember-loading-container';
            errorContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember JS Error:</b> Could not create sandbox for script. Check console.</span>`;
            errorContainer.style.color = 'var(--text-color-error)';
            messageTextElement.appendChild(errorContainer);
        }
    }
    
    return processedAnyScripts;
}

function createSandboxedFrame(code, libraryCodes = [], frameId) {
    const iframe = document.createElement('iframe');
    iframe.className = 'ember-iframe';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    iframe.dataset.frameId = frameId;
    iframe.style.cssText = 'width: 100%; border: none; display: block; overflow: hidden; max-height: 600px; min-height: 200px;';
    const safeCodeString = JSON.stringify(code);
    const iframeContent = `<html><head><style>
        html, body { 
            font-family: var(--mainFontFamily, sans-serif); 
            color: var(--text-color, #000); 
            background-color: transparent; 
            margin: 0; 
            padding: 8px; 
            overflow: auto;
            max-height: 600px;
            box-sizing: border-box;
        }
        #root { 
            width: 100%; 
            max-width: 100%; 
            box-sizing: border-box;
            overflow: auto;
            max-height: 580px;
        }
        /* Ensure form elements fit properly */
        input, button, textarea, select {
            max-width: 100%;
            box-sizing: border-box;
        }
    </style></head><body><div id="root"></div><script>(()=>{
        const e="${frameId}";
        const t=o=>window.parent.postMessage({type:"ember-error",frameId:e,message:o},"*");
        const n=()=>window.parent.postMessage({type:"ember-success",frameId:e},"*");

        // Smart DOM redirection - intercept common DOM operations and redirect to root
        const rootElement = document.getElementById("root");
        const createdElements = {}; // Track elements we create
        
        // Smart element creation - create missing elements on demand
        function createMissingElement(id) {
            if (createdElements[id]) {
                return createdElements[id];
            }
            
            console.log("[Ember Smart Create] Creating missing element with ID: " + id);
            let element;
            
            // Create appropriate element types based on common ID patterns
            if (id.toLowerCase().includes('input') || id.toLowerCase().includes('text') || id.toLowerCase().includes('field')) {
                element = document.createElement('input');
                element.type = 'text';
                element.placeholder = 'Enter text...';
                element.style.cssText = 'padding: 8px; margin: 4px; border: 1px solid #ccc; border-radius: 4px; width: 200px;';
            } else if (id.toLowerCase().includes('button') || id.toLowerCase().includes('btn')) {
                element = document.createElement('button');
                element.textContent = id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                element.style.cssText = 'padding: 8px 16px; margin: 4px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
            } else if (id.toLowerCase().includes('display') || id.toLowerCase().includes('output') || id.toLowerCase().includes('result')) {
                element = document.createElement('div');
                element.textContent = 'Output will appear here...';
                element.style.cssText = 'padding: 12px; margin: 8px; border: 1px dashed #ccc; background: #f9f9f9; border-radius: 4px; min-height: 30px;';
            } else if (id.toLowerCase().includes('message') || id.toLowerCase().includes('msg')) {
                element = document.createElement('div');
                element.style.cssText = 'padding: 8px; margin: 4px; border: 1px solid #ddd; border-radius: 4px; min-height: 20px;';
            } else {
                // Default to div for unknown elements
                element = document.createElement('div');
                element.style.cssText = 'padding: 4px; margin: 2px; border: 1px solid #eee; border-radius: 2px;';
            }
            
            element.id = id;
            createdElements[id] = element;
            rootElement.appendChild(element);
            console.log("[Ember Smart Create] Created and appended " + element.tagName + " with ID: " + id);
            return element;
        }
        
        // Override document.getElementById to create missing elements
        const originalGetElementById = document.getElementById;
        document.getElementById = function(id) {
            const element = originalGetElementById.call(document, id);
            if (!element && id !== 'root') {
                console.log("[Ember Smart Redirect] Element '" + id + "' not found, creating it...");
                return createMissingElement(id);
            }
            return element;
        };
        
        // Override document.querySelector to create missing elements for ID selectors
        const originalQuerySelector = document.querySelector;
        document.querySelector = function(selector) {
            const element = originalQuerySelector.call(document, selector);
            if (!element && selector !== '#root' && selector !== 'body' && selector !== 'html') {
                console.log("[Ember Smart Redirect] Selector '" + selector + "' not found");
                // If it's an ID selector (#something), create the element
                if (selector.startsWith('#')) {
                    const id = selector.substring(1);
                    console.log("[Ember Smart Redirect] Creating element for ID selector: " + id);
                    return createMissingElement(id);
                }
                // For other selectors, return root as fallback
                console.log("[Ember Smart Redirect] Using root as fallback for selector: " + selector);
                return rootElement;
            }
            return element;
        };
        
        // Override document.body to redirect appendChild calls to root
        const originalBodyAppendChild = document.body.appendChild;
        document.body.appendChild = function(element) {
            console.log("[Ember Smart Redirect] Redirecting document.body.appendChild to root.appendChild");
            return rootElement.appendChild(element);
        };
        
        // Override document.appendChild to redirect to root (if it exists)
        if (document.appendChild) {
            const originalDocAppendChild = document.appendChild;
            document.appendChild = function(element) {
                console.log("[Ember Smart Redirect] Redirecting document.appendChild to root.appendChild");
                return rootElement.appendChild(element);
            };
        }

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
            console.log("[Ember Iframe] Starting execution...");
            
            // Load all libraries automatically
            const libraryScripts = ${JSON.stringify(libraryCodes)};
            console.log("[Ember Iframe] Loading", libraryScripts.length, "libraries...");
            for(const scriptContent of libraryScripts){
                const scriptEl = document.createElement("script");
                scriptEl.textContent = scriptContent;
                document.head.appendChild(scriptEl);
            }
            console.log("[Ember Iframe] Libraries loaded");
            
            // Make libraries available globally for easy access
            if (window.Chart) { window.Chart = window.Chart; }
            
            const userCodeToRun = ${safeCodeString};
            console.log("[Ember Iframe] User code length:", userCodeToRun.length);
            console.log("[Ember Iframe] User code preview:", userCodeToRun.substring(0, 200) + "...");
            
            const rootElement = document.getElementById("root");
            if (!rootElement) { t("Ember Internal Error: #root element not found in iframe."); return; }
            console.log("[Ember Iframe] Root element found:", rootElement);
            
            // Execute user code with root element available
            console.log("[Ember Iframe] Executing user code...");
            new Function('root', userCodeToRun)(rootElement);
            console.log("[Ember Iframe] User code executed successfully");
            setTimeout(s, 1000);
        }catch(err){
            console.error("[Ember Iframe] Execution error:", err);
            t("Ember Execution Error: "+(err.stack||err.message));
        }})();<\/script></body></html>`;
    iframe.src = URL.createObjectURL(new Blob([iframeContent], { type: 'text/html' }));
    return iframe;
}

async function processMessage(messageId, isUserMessage = false) {
    console.log(`[Ember Debug] Processing message ${messageId}, isUser: ${isUserMessage}`);
    const messageDomElement = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (!messageDomElement) {
        console.log(`[Ember Debug] No DOM element found for message ${messageId}`);
        return;
    }
    const messageTextElement = messageDomElement.querySelector('.mes_text');
    if (!messageTextElement || messageTextElement.querySelector('.ember-iframe, .ember-generic-html-iframe, .edit_textarea')) {
        console.log(`[Ember Debug] No text element or already processed for message ${messageId}`);
        return;
    }

    let processedByEmberJs = false;
    let processedScriptHashes = new Set(); // Track processed scripts to avoid duplicates
    
    // WeatherPack-inspired approach: Also check raw message content for script tags
    const rawMessageContent = getContext().chat[messageId]?.mes;
    if (rawMessageContent) {
        console.log(`[Ember Debug] Checking raw message content for script tags...`);
        if (await processScriptTagsInHTML(messageId, rawMessageContent, messageTextElement, processedScriptHashes)) {
            processedByEmberJs = true;
            console.log(`[Ember Debug] Processed script tags from raw HTML for message ${messageId}`);
            
            // Hide any HTML code blocks that contain the same JavaScript
            console.log(`[Ember Debug] Looking for HTML code blocks to hide after processing script tags...`);
            const codeBlocks = messageTextElement.querySelectorAll(`pre > code`);
            for (const codeBlock of codeBlocks) {
                const className = codeBlock.className || '';
                if (className.includes('html') || className.includes('xml')) {
                    const codeContent = codeBlock.innerText.trim();
                    // Check if this HTML block contains script tags with processed JavaScript
                    if (/<script\b[^>]*>[\s\S]*?<\/script>/i.test(codeContent)) {
                        const parentPre = codeBlock.parentElement;
                        console.log(`[Ember Debug] Hiding HTML code block that contains processed script tags`);
                        parentPre.style.display = 'none';
                        parentPre.dataset.emberProcessed = 'hidden-after-script-processing';
                    }
                }
            }
        }
    }
    // Look for JavaScript code blocks with more flexible detection
    const codeBlocks = messageTextElement.querySelectorAll(`pre > code`);
    console.log(`[Ember Debug] Found ${codeBlocks.length} code blocks in message ${messageId}`);
    
    for (const codeBlock of codeBlocks) {
        // Check if it's a JavaScript code block by class name or content pattern
        const className = codeBlock.className || '';
        const codeContent = codeBlock.innerText.trim();
        
        console.log(`[Ember Debug] Code block class: "${className}", content preview: "${codeContent.substring(0, 100)}..."`);
        
        // WeatherPack-inspired comprehensive JavaScript detection
        const jsDetection = detectJavaScriptContent(className, codeContent);
        
        console.log(`[Ember Debug] Detection result:`, jsDetection);
        
        if (!jsDetection.isJavaScript) continue;
        
        console.log(`[Ember Debug] Processing JavaScript code block for message ${messageId}`);
        
        const parentPre = codeBlock.parentElement;
        if (parentPre.dataset.emberProcessed === 'true') { 
            console.log(`[Ember Debug] Code block already processed`);
            processedByEmberJs = true; 
            continue; 
        }
        
        if (!codeContent.trim()) {
             console.log(`[Ember Debug] Empty code content, skipping`);
             parentPre.dataset.emberProcessed = 'skipped';
             continue;
        }
        
        // Extract JavaScript code based on content type
        let javascriptCode;
        if (jsDetection.isHtmlWithJavaScript) {
            // Extract JS from HTML content (this will be the actual JS code)
            javascriptCode = extractJavaScriptFromHTML(codeContent, jsDetection);
        } else {
            // Use the code content directly, but clean up any HTML entities
            javascriptCode = codeContent
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');
        }
        
        // Check for duplicate code using same hash system (Unicode-safe)
        const codeHash = simpleHash(javascriptCode.trim()).toString().substring(0, 10);
        if (processedScriptHashes.has(codeHash)) {
            console.log(`[Ember Debug] Hiding duplicate code block (hash: ${codeHash})`);
            parentPre.dataset.emberProcessed = 'duplicate';
            parentPre.style.display = 'none'; // Hide the duplicate code block
            continue;
        }
        
        // Mark this code as processed
        processedScriptHashes.add(codeHash);
        
        // Validate JavaScript syntax before execution
        try {
            new Function(javascriptCode);
            console.log(`[Ember Debug] JavaScript syntax validation passed`);
        } catch (syntaxError) {
            console.error(`[Ember Debug] JavaScript syntax error:`, syntaxError);
            console.log(`[Ember Debug] Problematic code:`, javascriptCode);
            parentPre.dataset.emberProcessed = 'syntax-error';
            continue;
        }
        
        console.log(`[Ember Debug] Creating iframe for JavaScript execution`);
        processedByEmberJs = true; 
        parentPre.dataset.emberProcessed = 'true';
        
        // Load all libraries by default - no frontmatter parsing needed
        const requestedLibs = ['d3', 'three', 'p5', 'anime', 'chartjs', 'matter'];

        const frameId = `ember-frame-${messageId}-codeblock-${Date.now()}`;
        console.log(`[Ember Debug] Creating iframe execution environment for ${jsDetection.isHtmlWithJavaScript ? 'HTML with JavaScript' : jsDetection.isContentBasedJavaScript ? 'content-based JavaScript' : 'direct JavaScript'}`);
        
        // Declare containers in outer scope so they're available to both try blocks
        let loadingContainer, finalContainer;
        
        try {
            loadingContainer = document.createElement('div');
            loadingContainer.className = 'ember-loading-container';
            loadingContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Ember JS preparing...</span>`;
            loadingContainer.dataset.frameId = frameId;
            
            finalContainer = document.createElement('div');
            finalContainer.className = 'ember-container';
            finalContainer.style.display = 'none';
            finalContainer.dataset.frameId = frameId;
            
            parentPre.insertAdjacentElement('afterend', finalContainer);
            parentPre.insertAdjacentElement('afterend', loadingContainer);
            
        } catch (domError) {
            console.error(`[Ember Debug] DOM Error:`, domError);
            continue; // Skip this iteration if DOM setup fails
        }

        try {
            console.log(`[Ember Debug] ENTERED TRY BLOCK - Loading libraries: ${requestedLibs.join(', ')}`);
            
            const libMap = requestedLibs.map(alias => BUILT_IN_LIBRARIES.find(lib=>lib.alias===alias)).filter(Boolean);
            console.log(`[Ember Debug] Found ${libMap.length} library definitions:`, libMap);
            
            const libUrls = libMap.map(libDef=>`${location.origin}/scripts/extensions/third-party/${MODULE_NAME}/lib/${libDef.file}`);
            console.log(`[Ember Debug] Library URLs: ${libUrls.join(', ')}`);
            
            console.log(`[Ember Debug] Starting to fetch libraries...`);
            const libCodes = await Promise.all(libUrls.map(async (url, index) => {
                console.log(`[Ember Debug] Fetching ${url}...`);
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    const code = await res.text();
                    console.log(`[Ember Debug] Successfully loaded ${url} (${code.length} chars)`);
                    return code;
                } catch (err) {
                    console.error(`[Ember Debug] Failed to fetch ${url}:`, err);
                    throw new Error(`Failed to fetch library ${url}: ${err.message}`);
                }
            }));
            console.log(`[Ember Debug] Successfully loaded ${libCodes.length} libraries`);
            
            console.log(`[Ember Debug] Creating sandboxed iframe...`);
            console.log(`[Ember Debug] JavaScript code to execute (${javascriptCode.length} chars):`, javascriptCode);
            const iframe = createSandboxedFrame(javascriptCode, libCodes, frameId);
            console.log(`[Ember Debug] Created iframe:`, iframe);
            finalContainer.appendChild(iframe);
            console.log(`[Ember Debug] Appended iframe to container, hiding original pre`);
            parentPre.style.display = 'none';
        } catch (error) {
            console.error('[Ember JS] Critical error creating sandbox or fetching libs:', error);
            loadingContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember JS Error:</b> Could not create sandbox or load libraries. Check console.</span>`;
            loadingContainer.style.color = 'var(--text-color-error)';
            parentPre.dataset.emberProcessed = 'false';
            if (finalContainer) finalContainer.remove();
        }
    }
    
    // Add the missing extractJavaScriptFromHTML function
    function extractJavaScriptFromHTML(codeContent, jsDetection) {
        if (jsDetection.hasScriptTags) {
            // Extract JavaScript from script tags
            const scriptMatches = codeContent.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);
            if (scriptMatches) {
                const javascriptCode = scriptMatches
                    .map(match => {
                        // Extract content between script tags
                        let content = match.replace(/<script\b[^>]*>|<\/script>/gi, '');
                        
                        // Decode HTML entities that might be present
                        content = content
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#x27;/g, "'")
                            .replace(/&#39;/g, "'")
                            .replace(/&nbsp;/g, ' ');
                        
                        return content.trim();
                    })
                    .filter(content => content.length > 0) // Remove empty scripts
                    .join('\n\n');
                console.log(`[Ember Debug] Extracted ${scriptMatches.length} script blocks from HTML`);
                return javascriptCode;
            }
        } else {
            // For HTML with embedded JS, extract just the JavaScript parts more carefully
            // First, try to extract content between <script> tags even if they're not properly formed
            let scriptContent = '';
            
            // Look for script-like sections (between <script and </script> or at end)
            const scriptSectionMatch = codeContent.match(/<script[^>]*>([\s\S]*?)(?:<\/script>|$)/i);
            if (scriptSectionMatch) {
                scriptContent = scriptSectionMatch[1];
            } else {
                // If no script tags, look for the first import statement and take everything from there
                const lines = codeContent.split('\n');
                let jsStartIndex = -1;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    // Look for clear JavaScript start indicators
                    if (/^\s*(import\s+.*from|\/\/\s*Import|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|function\s+\w+|class\s+\w+)/.test(line)) {
                        jsStartIndex = i;
                        break;
                    }
                }
                
                if (jsStartIndex >= 0) {
                    // Take everything from the first JS line to the end
                    scriptContent = lines.slice(jsStartIndex).join('\n');
                } else {
                    // Fallback: filter lines more carefully to avoid CSS
                    const jsLines = lines.filter(line => {
                        const trimmedLine = line.trim();
                        // Exclude CSS-like lines
                        if (/^\s*[a-zA-Z#.][^{]*\{[\s\S]*\}?\s*$/.test(trimmedLine)) return false; // CSS rules
                        if (/^\s*[a-zA-Z-]+\s*:\s*[^;]+;\s*$/.test(trimmedLine)) return false; // CSS properties
                        if (/^\s*<\/?[a-zA-Z]/.test(trimmedLine)) return false; // HTML tags
                        
                        // Include clear JavaScript lines
                        return /\b(import|export|const|let|var|function|class|if|for|while|return|=>\||\.addEventListener|\.querySelector|new\s+\w+|console\.|document\.|window\.)\b/.test(trimmedLine) ||
                               /^\s*\/\//.test(trimmedLine) || // Comments
                               /^\s*\}[,;]?\s*$/.test(trimmedLine); // Closing braces
                    });
                    scriptContent = jsLines.join('\n');
                }
            }
            
            const cleanedContent = scriptContent
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');
            
            console.log(`[Ember Debug] Extracted JavaScript content from mixed HTML`);
            return cleanedContent;
        }
        
        return codeContent; // Fallback
    }
    if (processedByEmberJs) {
        console.log(`[Ember Debug] Finished processing JS blocks for message ${messageId}, returning`);
        return;
    }

    // Direct HTML Rendering Logic
    let genericHtmlShouldBeHandled = false;
    let messageContent = getContext().chat[messageId]?.mes;
    let htmlForProcessing = messageContent; // Default to original raw content

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
    console.log(`[Ember Debug] Received message from iframe: ${type}, frameId: ${frameId}`);
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
            let newHeight = height + 15;
            
            // Cap the maximum height to prevent excessive scrolling
            const maxAllowedHeight = 600;
            if (newHeight > maxAllowedHeight) {
                newHeight = maxAllowedHeight;
                console.log(`[Ember Debug] Capping iframe height at ${maxAllowedHeight}px`);
            }
            
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

    // Debug extension prompt types availability
    console.log(`[Ember Debug] setExtensionPrompt function available:`, typeof setExtensionPrompt);
    console.log(`[Ember Debug] extension_prompt_types object:`, extension_prompt_types);
    console.log(`[Ember Debug] extension_prompt_types keys:`, Object.keys(extension_prompt_types || {}));
    console.log(`[Ember Debug] extension_prompt_types values:`, Object.values(extension_prompt_types || {}));

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

    console.log('[Ember] Extension loaded successfully! Ready to process JavaScript code blocks.');
    
    // Test if the extension is working by processing existing messages
    processExistingMessages();
});