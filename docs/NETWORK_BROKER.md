# Artifact network and media broker

Ember artifacts retain a `default-src 'none'` Content Security Policy. They never receive direct network access. When an artifact is granted `network.fetch`, Ember replaces the sandbox's standard `fetch()` with an authenticated bridge implementation and returns a normal browser `Response`.

Ordinary model code does not need an Ember-specific networking API:

```js
const response = await fetch('https://pokeapi.co/api/v2/pokemon/pikachu');
const pokemon = await response.json();
```

Remote `img`, `audio`, `video`, and `source` URLs are fetched through the same broker and converted to sandbox-local blob URLs. This covers markup attributes, dynamic `src` assignments, `new Image()`, and `new Audio(url)`.

## Boundary

- Only HTTP and HTTPS are accepted.
- SillyTavern's own origin, loopback, private IPv4 ranges, link-local hosts, local names, and local/private IPv6 ranges are rejected.
- URL-embedded credentials and ambient cookie, host, origin, and referrer headers are rejected.
- Requests use `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`.
- Redirects fail closed.
- Request bodies are capped at 1 MB and responses at 12 MB.
- Allowed methods are GET, POST, PUT, PATCH, DELETE, and HEAD.
- The browser still enforces CORS. Ember does not operate a server-side open proxy.
- WebSocket, EventSource, XMLHttpRequest, external scripts, CSS background URLs, and streaming response delivery are not supported in this checkpoint.

The model-facing parser infers `network.fetch` from standard `fetch()`, remote URLs, and common media constructors. The user still controls the capability through Ember's permission dialog.
