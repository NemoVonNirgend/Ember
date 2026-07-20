# Secure HTML migration

Ember 4 replaces the legacy generic-HTML path when **Use Ember 4 secure HTML renderer** is enabled.

## Eligibility

The secure renderer handles only complete HTML messages:

- a message whose trimmed content starts with an HTML element; or
- a message consisting entirely of one fenced `html` block.

Ordinary prose containing an inline tag is left to SillyTavern formatting. Scripted HTML and Ember v2 artifact blocks are handled by the isolated artifact runtime instead. Markup imitating SillyTavern's `.mes` or `.mes_text` UI is rejected.

## Rendering process

1. Parse the candidate with a browser `<template>` element.
2. Reject non-HTML and SillyTavern UI lookalikes.
3. Sanitize through the DOMPurify instance exported by SillyTavern `/lib.js`.
4. Remove scripts, iframes, objects, embeds, base elements, and `srcdoc`.
5. Reconcile the sanitized children into the existing `.mes_text` element with SillyTavern's morphdom export.
6. Mark the message as owned by the Ember 4 HTML renderer so Ember 3 does not attach its direct HTML or clickable-input behavior.

The `.mes_text` node is retained. Ember no longer assigns generated HTML directly to its `innerHTML` in this path.

## Interactive content

Secure generic HTML without scripts is deliberately static. An ordinary `html` fence containing inline scripts is automatically promoted to the isolated runtime; it does not require an Ember manifest. Host capabilities and supported compatibility libraries are inferred from its source.

This separates presentation from execution:

- generic HTML: sanitized static document;
- ordinary scripted HTML or Ember v2 HTML: isolated interactive artifact;
- ordinary JavaScript blocks: isolated Ember 4 compatibility runtime.

## Settings and rollback

The default mode processes AI responses only. An optional mode also processes user messages.

Disabling the secure renderer restores currently processed messages using SillyTavern's normal formatter. It does not restore Ember 3 script execution or parent-DOM form behavior.

## Known limits

- Mixed Markdown and complex HTML is intentionally left to SillyTavern.
- External scripts are never part of the generic HTML path.
- Inline scripts are supported in interactive HTML; external script sources remain blocked.
- Parent-rendered static HTML rejects style, form, link, form-control, `id`, and `name` content to prevent global CSS, DOM clobbering, or deceptive host-page interactions. Use an isolated scripted HTML artifact for interactive documents.
