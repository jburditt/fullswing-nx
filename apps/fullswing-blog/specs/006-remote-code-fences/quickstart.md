# Quickstart: Remote Code Fences

## Prerequisites

- Node.js >=20.19.0
- Dependencies installed with `npm install`
- A local checkout of this repository

## Authoring Shape

Use the existing fenced-code directives with a `source=` value:

````markdown
```html source=https://raw.githubusercontent.com/example/project/<commit>/file.html line=1-10
```
````

The source URL should identify a version-specific text file. Authored code fences without
`source=` remain unchanged.

## Focused Validation

Compile and run the rendering tests:

```bash
npm run compile && node --test .build/test/rendering.test.js
```

The focused tests should cover:

- valid remote source replacement and language rendering;
- existing line numbers, ranges, and offsets on retrieved text;
- escaped source text and escaped attribution;
- copy content containing source text only;
- duplicate URL caching within one publication;
- malformed, disallowed, unsuccessful, non-text, oversized, and timed-out sources.

## Full Validation

```bash
npm test
npm run build
```

The build should publish valid content and fail clearly when a remote source reference cannot be
retrieved safely. No test should require GitHub availability; local HTTP fixtures should provide
controlled success and failure responses.

## Validation Note

The feature-focused rendering and client tests pass, and `npm run build` publishes the real remote
source example successfully. `npm run verify` currently remains red because the unrelated
`test/deployment-config.test.ts` expects an older `azd up` workflow while the repository workflow
uses separate provision and deploy steps.
