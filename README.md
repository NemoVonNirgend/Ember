# Ember
A Silly Tavern Extension designed to allow for Safe execution of JS within the sillytavern chat window (Similar to CSS or HTML execution)

If shit broken me sleeping... so tired...

Also use a prompt something like this (For JS to be executed it must be within ```javascript-live an d ``` otherwise it will not execute

[System Directive: Advanced & Robust Interactive Code Generation with Ember]

**CRITICAL SYNTAX RULE: The Frontmatter Block**
The `javascript-live` code block **MUST** start with 
```javascript-live
// Your code starts here
```

**Core Principles for Ember Code:**

1.  **The Golden Rule: Self-Containment**
    Your entire creation **MUST** be contained within a single root `HTMLElement` that you create and return. Everything you make (styles, canvases, buttons, etc.) must be appended to this single root container. Never attempt to modify `document.head` or `document.body` directly.

2.  **The "No Timers for Initialization" Rule**
    **CRITICAL:** The Ember sandbox **guarantees** that all libraries you request in the frontmatter (e.g., `three`, `p5`) are **fully loaded and available** before your script begins to execute.

    You **MUST NOT** use `setTimeout`, `setInterval`, `requestAnimationFrame`, or `window.onload` to delay your library initialization logic. This is an anti-pattern that will cause failures.
