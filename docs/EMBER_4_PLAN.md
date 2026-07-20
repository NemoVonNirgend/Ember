# Ember 4 modernization plan

## Product direction

Ember 4 is a secure interactive-artifact runtime for SillyTavern. A response may contain a visual or interactive artifact, but generated code receives no direct authority over SillyTavern. All host actions cross a versioned, authenticated, permission-checked bridge.

The existing Ember 3 renderer remains available through a compatibility layer while features move to the new runtime.

## Design principles

1. Generated content is untrusted.
2. Artifacts run in unique-origin iframes without `allow-same-origin`.
3. Host actions use structured messages, never constructed slash-command strings.
4. Every artifact declares its capabilities before execution.
5. State and actions are scoped to the originating message and chat.
6. SillyTavern-provided libraries are reused in the trusted host where possible.
7. Host library availability does not grant sandboxed artifacts parent-window access.
8. Legacy parsing is isolated from the Ember 4 grammar.
9. Message rendering is idempotent and tied to message revisions.
10. Important behavior is covered by Node tests without requiring a live ST page.

## SillyTavern library strategy

SillyTavern 1.18 exports a client bundle from `/lib.js`. Ember can directly import host utilities including DOMPurify, YAML, Chevrotain, morphdom, localforage, Handlebars, Fuse, lodash, seedrandom, Showdown, Highlight.js, Adobe CSS Tools, diff-match-patch, fflate, and SHA-256.

These are host-runtime dependencies. They cannot simply be copied into an untrusted iframe as live objects. Each artifact-facing library requires one of:

- a narrow parent-side capability adapter;
- a reviewed same-server asset that can load in a unique-origin frame;
- a small, purpose-built runtime implementation;
- an explicit declaration that it is unavailable to artifacts.

The old bundled D3, Three.js, p5.js, Anime.js, Chart.js, and Matter.js files remain compatibility assets until equivalent safe loading is proven. They should not be eagerly loaded and should eventually be removable.

## Delivery phases

### Phase 1 — foundation and containment

- Add a modular bootstrap and public runtime surface.
- Add an artifact registry and lifecycle state.
- Define the Ember v2 artifact manifest.
- Define permissions and a versioned bridge protocol.
- Catalogue reusable SillyTavern host libraries.
- Add parsing and protocol tests.
- Preserve Ember 3 through a compatibility import.

### Phase 2 — secure iframe runtime

- [x] Create unique-origin frames using `sandbox="allow-scripts"`.
- [x] Register `event.source`, artifact ID, capability token, message ID, chat ID, and revision.
- [x] Validate every incoming message and enforce payload limits.
- [x] Add mount, resize, error, message-dispose, and chat-dispose lifecycle primitives.
- [x] Separate requested permissions from permissions granted by the host.
- [ ] Implement permission prompts and remembered decisions.
- [ ] Mount v2 artifacts from the SillyTavern message lifecycle.

### Phase 3 — structured host capabilities

- [x] Add explicit submit, inject, generate, and state services.
- [x] Replace slash-command string construction for Ember v2 artifacts.
- [x] Store artifact state through chat metadata.
- [x] Keep network access disabled by default through the frame CSP.
- [x] Mount and dispose Ember v2 artifacts through SillyTavern message events.
- [x] Prompt for permissions and optionally remember decisions by permission signature.
- [ ] Add revision-aware state migrations when an artifact ID changes shape.
- [ ] Add an artifact inspector showing source, permissions, state, and events.

### Phase 4 — rendering migration

- [x] Replace regex HTML parsing with template parsing and DOMPurify.
- [x] Separate static generic HTML from executable Ember v2 artifacts.
- [x] Keep automatic input authority out of sanitized generic HTML.
- [x] Stop rewriting `.mes_text.innerHTML` after SillyTavern formatting.
- [x] Add handling for edits, swipes, rerenders, chat loads, and chat switches.
- [ ] Add optional CSS scoping for generic HTML documents.
- [ ] Remove the Ember 3 HTML implementation after the compatibility period.

### Phase 5 — intelligent generation and repair

- [x] Replace the always-on large prompt with a compact single-slot artifact guide.
- [x] Support YAML manifests through SillyTavern's YAML parser.
- [x] Run deterministic compatibility diagnostics before requesting model help.
- [x] Request repair proposals through the current SillyTavern generation connection.
- [x] Preview manual or model-assisted source changes with diff-match-patch.
- [x] Keep repair proposals non-executing and non-persistent by default.
- [ ] Capture the complete iframe console stream in addition to runtime errors.
- [ ] Add confirmed, revision-checked repair application with provenance.

## Checkpoint 4 — visible product layer

- [x] Replace the two-popup permission flow with one capability dialog.
- [x] Add per-artifact title, status, and Inspector controls.
- [x] Show source, ownership, revisions, requested/granted permissions, and events.
- [x] Add secure-runtime and permission-decision controls to Ember settings.
- [x] Add bounded session-local observability.
- [x] Reuse SillyTavern's Highlight.js through the trusted host library facade.
- [ ] Use DOMPurify and morphdom during the legacy HTML renderer migration.
- [ ] Use diff-match-patch for repair previews.

### Phase 6 — compatibility retirement

- [x] Add import/conversion for legacy JavaScript frontmatter.
- [x] Infer legacy library aliases and Ember host permissions.
- [x] Route legacy JavaScript fences through the Ember 4 sandbox by default.
- [x] Stop loading all bundled libraries for every legacy block.
- [x] Lazy-load and cache only requested compatibility assets.
- [x] Add revision-checked repair application, provenance, and rollback.
- [ ] Gather local compatibility-alias usage through fixtures and the Inspector.
- [ ] Disable or remove the remaining Ember 3 JavaScript implementation after live validation.
- [ ] Remove individual bundled assets only after their migration criteria are met.

### Phase 7 — zero-ceremony interactive output

- [x] Promote ordinary `javascript` and `js` fences without a manifest.
- [x] Promote ordinary `html` fences containing inline scripts.
- [x] Preserve source order when a response contains multiple artifact types.
- [x] Infer permissions and supported library aliases from ordinary source.
- [x] Keep static HTML on the sanitized renderer path.
- [x] Replace the manifest-first model prompt with ordinary HTML/JavaScript guidance.
- [x] Add the permission-controlled network and media broker.
- [ ] Add the permanent artifact registry and portable package format.

## Initial success criteria

- Ember 3 behavior still loads through `bootstrap.js`.
- Ember 4 modules import in Node without a DOM.
- Artifact manifests reject unknown versions, runtimes, and permissions.
- Bridge messages require a known type and capability token.
- The library catalogue clearly separates host reuse from artifact exposure.
- All foundation tests pass on Node 20 or newer.
