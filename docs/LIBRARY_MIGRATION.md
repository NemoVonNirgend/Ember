# Library migration

Ember 4 separates trusted host dependencies from artifact visualization libraries.

## Reused from SillyTavern

The trusted Ember host imports these directly from SillyTavern `/lib.js`:

- DOMPurify;
- YAML;
- Highlight.js;
- morphdom;
- diff-match-patch.

The host catalogue also records other ST exports such as lodash, Fuse, localforage, Handlebars, seedrandom, Showdown, CSS Tools, compression, and hashing for future host features.

These objects are not passed directly into unique-origin artifact frames. Doing so would either fail across the origin boundary or weaken isolation.

## Legacy visualization libraries

SillyTavern 1.18 does not ship D3, Three.js, p5.js, Anime.js, Chart.js, or Matter.js. Existing Ember artifacts may depend on them, so their files remain temporarily as compatibility assets.

Ember 4 changes their behavior:

- they are never loaded by default;
- legacy frontmatter requests are parsed;
- common globals are detected from source when frontmatter is absent;
- only requested aliases are fetched;
- source is cached after the first request;
- reviewed library source is embedded into the unique-origin frame before artifact execution;
- unknown aliases are rejected.

Supported compatibility aliases are `d3`, `three`, `p5`, `anime`, `chartjs`, and `matter`.

## Removal criteria

A compatibility asset can be removed when all of the following are true:

1. repository and user fixtures no longer depend on the alias;
2. migration documentation provides a browser-native or approved alternative;
3. usage telemetry is not required—Ember can instead report requested aliases locally in its Inspector;
4. removal is announced as a breaking Ember 4 change.

New Ember v2 examples should prefer browser-native HTML, CSS, SVG, Canvas, and WebGL. The compact prompt does not encourage compatibility libraries.
