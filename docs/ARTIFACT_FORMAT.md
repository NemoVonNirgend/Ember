# Ember artifact format v2

Normal model output does not require this format. Ember automatically promotes ordinary `javascript`/`js` fences and `html` fences containing inline scripts into isolated interactive artifacts. It infers host permissions and supported compatibility libraries from their source.

The v2 format below is an optional advanced format for authors who need a stable ID, explicit title, declared capabilities, or durable state ownership. It uses a fenced `ember` block containing a YAML manifest, a separator line, and artifact source. JSON remains valid because it is a subset of YAML.

## Static or interactive HTML

````markdown
```ember
version: 2
id: route-choice
title: Choose a route
runtime: html
permissions:
  - host.submit
libraries: []
---
<style>
  .routes { display: flex; gap: 8px; padding: 12px; }
</style>
<div class="routes">
  <button id="left">Take the left path</button>
  <button id="right">Take the right path</button>
</div>
<script>
  document.getElementById('left').addEventListener('click', () => {
    ember.submit({ text: 'I take the left path.', generate: true });
  });
  document.getElementById('right').addEventListener('click', () => {
    ember.submit({ text: 'I take the right path.', generate: true });
  });
</script>
```
````

External `<script src>` elements are rejected. Inline scripts run after the non-script HTML has been mounted into `root`.

## JavaScript

````markdown
```ember
version: 2
id: scene-counter
title: Scene counter
runtime: javascript
permissions:
  - host.state.read
  - host.state.write
libraries: []
---
const button = document.createElement('button');
const saved = await ember.state.read({ key: 'count' });
let count = Number(saved?.value ?? 0);
button.textContent = `Count: ${count}`;
button.addEventListener('click', async () => {
  count += 1;
  button.textContent = `Count: ${count}`;
  await ember.state.write({ key: 'count', value: count });
});
root.appendChild(button);
```
````

## Permissions

| Permission | Capability |
| --- | --- |
| `host.submit` | Send an explicit user message, with optional generation. |
| `host.inject` | Add a namespaced prompt contribution. |
| `host.generate` | Start a normal generation without submitting text. |
| `host.state.read` | Read this artifact's chat-scoped state. |
| `host.state.write` | Write this artifact's chat-scoped state. |
| `network.fetch` | Make credential-free requests to external HTTP(S) APIs and load remote media through the host broker. |

Declaring a permission only requests it. The host must grant it separately. Remembered decisions are scoped to the exact source digest, chat, message, and requested permission set. Editing, moving, or importing an artifact requires fresh review.

## Portable packages

The Inspector can save an artifact to Ember's reusable library or export a versioned `.ember.json` package. A package contains only:

- `kind` and package `version`;
- a SHA-256 digest;
- the normalized v2 manifest;
- UTF-8 artifact source.

Packages never contain permission decisions, capability tokens, runtime state, chat IDs, message IDs, or source ownership. Import verifies the schema, the 1 MB source limit, supported permissions and libraries, and the digest. A valid import is stored for review; it is not executed.

Choosing **Add to composer** produces a canonical `ember` fence. The normal message lifecycle and permission dialog apply after the user sends it.

## Security boundary

- Frames use `sandbox="allow-scripts"` without `allow-same-origin`.
- The frame CSP blocks direct network access and external scripts. Standard `fetch()` and remote image/audio URLs are mediated by the host broker.
- Host requests require an artifact ID, capability token, exact frame source, declared permission, granted permission, and valid payload.
- State is stored by the host rather than in the frame's origin.
- Host actions are rejected when the originating chat, message revision, or frame is no longer current.
- Submit and generate require parent-page user activation.
