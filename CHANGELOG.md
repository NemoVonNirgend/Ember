# Changelog

## 4.0.0-rc.1 - 2026-07-20

### Added

- Portable, integrity-checked `.ember.json` packages and a persistent reusable artifact library.
- Inspector actions for save, export, canonical-fence copy, and reviewed repair workflows.
- Real SillyTavern staging coverage for JavaScript, scripted HTML, buttons, state, context injection, CYOA submission, PokeAPI, reloads, and repeated initialization.

### Changed

- Routed all executable legacy JavaScript and scripted HTML through the authenticated Ember 4 sandbox.
- Scoped remembered permissions and state ownership to artifact source and message identity.
- Hardened message lifecycle handling against stale sessions, duplicate mounts, malformed edits, and repeated listener installation.
- Added bounded request concurrency, timeouts, streaming response limits, and stricter private-target checks to the network broker.
- Restricted parent-rendered static HTML to non-interactive, sanitized markup.

### Fixed

- Allowed the sandbox's reviewed inline artifact runner under CSP while retaining a unique origin and blocked direct network access.
- Prevented the Ember 3 bridge from accepting unauthenticated host-action messages while Ember 4 is active.
- Prevented legacy executable frames from receiving `allow-same-origin`.
- Preserved UTF-8 source, package, composer, and runtime text across export/import/reload.
- Removed stale artifact sessions and duplicate listeners after edits, reloads, and reinitialization.

### Security

- Operational bridge payloads are schema-validated and size-bounded.
- Imported packages never carry permission decisions, state, capability tokens, or chat ownership.
- Submit and generation actions require a current source revision and parent-page user activation.

### Verification

- Node suite: 86 tests passed.
- SillyTavern staging 1.18.0 (`380e31e8c58d196969b6a0da74f431ba999c7e0a`).
- Chromium 149 real-browser smoke: zero page errors, console errors, and rejected bridge messages.
