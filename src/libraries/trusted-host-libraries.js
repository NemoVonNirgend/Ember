// SPDX-License-Identifier: AGPL-3.0-or-later

export function createTrustedHostLibraries({ DOMPurify, yaml, hljs, morphdom, DiffMatchPatch }) {
    return Object.freeze({
        sanitize: (html, options) => DOMPurify.sanitize(html, options),
        parseYaml: text => yaml.parse(text),
        highlightElement: element => hljs.highlightElement(element),
        morphdom,
        createDiff: () => new DiffMatchPatch(),
    });
}
