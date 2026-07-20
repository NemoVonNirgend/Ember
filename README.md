# Ember

Ember is a secure interactive-artifact runtime for SillyTavern. It turns ordinary JavaScript blocks and scripted HTML blocks into isolated apps inside chat messages, while requiring explicit permission for actions that affect SillyTavern or access the network.

Ember 4 keeps compatibility with existing Ember content, but executable artifacts always run in unique-origin `sandbox="allow-scripts"` frames. They cannot directly access the SillyTavern page, cookies, storage, or API credentials.

## Installation

Install from SillyTavern's Extensions panel using:

```text
https://github.com/NemoVonNirgend/Ember
```

For a manual install, clone this repository as `public/scripts/extensions/third-party/Ember` inside a current SillyTavern checkout, then reload SillyTavern. The Ember settings section should report runtime status `ready`.

Development requires Node.js 20 or newer:

```sh
npm test
npm run test:smoke
```

## Zero-ceremony apps

Ordinary JavaScript fences run as apps. Append visible content to the provided `root` element:

````markdown
```javascript
const button = document.createElement('button');
let count = 0;
button.textContent = 'Count: 0';
button.addEventListener('click', () => {
  count += 1;
  button.textContent = `Count: ${count}`;
});
root.appendChild(button);
```
````

An `html` fence containing inline `<script>` is also promoted to an isolated app. External `<script src>` elements are rejected. Static HTML without scripts uses Ember's sanitized parent renderer when that setting is enabled.

For stable IDs, explicit permissions, or declared compatibility libraries, use the advanced [Ember v2 format](docs/ARTIFACT_FORMAT.md).

## Artifact API

Artifacts receive `root` and `ember`. Permissioned operations are:

- `ember.submit({ text, generate })`: add an actual user message and optionally start normal generation. This is the CYOA/impersonation-style action for choice buttons.
- `ember.inject({ id, content, depth, ephemeral })`: add namespaced SYSTEM context to SillyTavern's in-chat prompt at the requested depth.
- `ember.generate()`: start normal generation without submitting text.
- `ember.state.read({ key })` and `ember.state.write({ key, value })`: persist chat-scoped artifact state.
- Standard `fetch(url, init)`: call an external HTTP(S) API through Ember's credential-free network broker.

Submitting or generating requires a current artifact session and a real user activation in the parent page. State, context, and network requests are rejected after the source message changes or the user switches chats.

### CYOA example

```js
const left = document.createElement('button');
left.textContent = 'Take the left path';
left.addEventListener('click', async () => {
  await ember.inject({
    id: 'route-choice',
    content: 'The user chose the left path.',
    depth: 0,
    ephemeral: false,
  });
  await ember.submit({ text: 'I take the left path.', generate: true });
});
root.appendChild(left);
```

Context contributions remain owned by their artifact session and are removed when that session is disposed. Persistent artifact data belongs in `ember.state`.

## External APIs and media

With `network.fetch` permission, ordinary `fetch()` works with public APIs such as PokeAPI:

```js
const response = await fetch('https://pokeapi.co/api/v2/pokemon/pikachu');
const pokemon = await response.json();
root.textContent = `${pokemon.name} #${pokemon.id}`;
```

Remote image, audio, video, and source URLs use the same broker. Requests omit credentials and referrers, fail closed on redirects, reject local/private targets, and enforce concurrency, timeout, request-size, and response-size limits. Browser CORS rules still apply. See [Network broker](docs/NETWORK_BROKER.md).

## Permissions and reusable artifacts

Ember asks before granting host or network capabilities. A remembered decision is scoped to the exact source digest, chat, message, and requested permission set; editing, moving, or importing code does not inherit authority.

Use an artifact's Inspector to:

- review source, ownership, permissions, diagnostics, and runtime events;
- save it to the reusable library;
- export a verified `.ember.json` package;
- copy a canonical Ember v2 fence;
- preview, apply, or roll back a source repair.

The settings drawer can import packages and add saved artifacts to the composer. Importing validates integrity and stores the artifact, but never executes it automatically. Packages exclude runtime state, permission grants, capability tokens, and chat ownership.

## Settings

- **Use Ember 4 secure HTML renderer** sanitizes complete static HTML messages. Disabling it returns static content to SillyTavern's formatter; it never re-enables legacy script authority.
- **Inject compact Ember v2 instructions** controls the single model-facing artifact guide.
- **Secure HTML processing** selects AI-only or AI-and-user static HTML handling.
- **Reusable artifact library** imports, exports, reuses, and removes portable artifacts.
- Permission decisions and bounded runtime events can be cleared independently.

## Migration notes

- Existing `javascript`/`js` blocks continue to work without a manifest, but now run through Ember 4's isolated runtime.
- Scripted HTML is isolated; static HTML is sanitized.
- Legacy D3, Three.js, p5.js, Anime.js, Chart.js, and Matter.js aliases are inferred and lazy-loaded only when requested.
- The unauthenticated Ember 3 message bridge and same-origin executable frames are disabled whenever Ember 4 owns the content.
- Imported artifacts always require fresh permission review in their new message.

## Troubleshooting

- **No Ember settings section:** confirm the directory name is exactly `Ember`, reload, and check that `globalThis.Ember.phase` is `ready` in the browser console.
- **Permission dialog repeats:** remembered grants intentionally stop matching when source, message, chat, or permissions change.
- **A public API fails:** confirm `network.fetch` was granted, the endpoint supports browser CORS, uses HTTP(S), and does not redirect or resolve to a local/private address.
- **An app disappears after an edit or swipe:** Ember disposes the old revision and mounts the current source. Reopen the Inspector for current diagnostics.
- **A package will not import:** only versioned `.ember.json` packages with a valid SHA-256 digest and source under 1 MB are accepted.
- **Static HTML lost a control or global style:** parent-rendered static HTML deliberately rejects forms, controls, links, IDs/names, and global styling. Use an isolated scripted HTML artifact for interactive UI.

## Verified compatibility

The `4.0.0-rc.1` release candidate was exercised end to end against SillyTavern staging `1.18.0` at commit `380e31e8c58d196969b6a0da74f431ba999c7e0a`, including reload persistence, duplicate-listener checks, final prompt assembly, CYOA submission, PokeAPI access, and portable artifact round trips.
