<!--
Sync Impact Report
- Version change: unversioned scaffold -> 1.0.0
- Modified principles: scaffold placeholders -> I. Static-Site Generation; II. Validated Content
  Pairs; III. Route-Safe Rendering; IV. Verifiable Changes; V. Guarded Deployment
- Added sections: Content and Rendering Constraints; Development Workflow
- Removed sections: none
- Follow-up TODOs: TODO(RATIFICATION_DATE): original adoption date is unknown.
-->
# TypeScript Blog Constitution

## Core Principles

### I. Static-Site Generation
The site MUST remain an ESM Node.js and TypeScript static-site generator. `src/build.ts` MUST
discover content, render every route, and write directory-style output to `dist/`; browser-side
code MUST be limited to optional progressive enhancement. This preserves a build artifact that can
be served without a client framework or runtime renderer.

### II. Validated Content Pairs
Every blog post MUST use same-basename Markdown and JSON metadata files beneath `public/blog/`;
every rich page MUST use same-basename TypeScript and JSON metadata files in `src/pages/`.
Metadata MUST provide a non-empty route, title, author, categories, and a real `YYYY-MM-DD` date.
The route MUST match the content kind and basename exactly. Build failures for missing pairs or
invalid metadata MUST remain explicit, because discovery is the source of generated routes.

### III. Route-Safe Rendering
All generated pages MUST preserve directory-style routes. Internal links MUST use
`getRelativeHref`, static asset URLs MUST use `getAssetPrefix`, and output paths MUST use
`getOutputPath`. Page renderers MUST export `renderPage(context)`, return HTML, and escape every
interpolated value with `context.escapeHtml`; rendered body HTML is deliberately accepted by the
layout. These rules ensure pages work at every nesting depth without exposing unescaped values.

### IV. Verifiable Changes
Changes to generator behavior, content discovery, rendering, client enhancement, or deployment
configuration MUST include or update focused native `node:test` coverage. `npm test` MUST pass for
behavioral changes, and `npm run build` MUST pass when the generated site or its inputs change.
Tests execute from `.build/test/`, so a targeted test MUST compile first and run its generated
JavaScript file. Verification protects the compile-to-build boundary that production uses.

### V. Guarded Deployment
Azure lifecycle automation MUST remain pinned to resource group `rg-typescript-blog`.
`azure.yaml`, `.github/workflows/deploy.yml`, the resource-group lifecycle scripts, and
deployment tests MUST remain aligned. Lifecycle scripts MUST refuse a different resource group.
This prevents deployment or teardown from affecting unintended Azure resources.

## Content and Rendering Constraints

Relative TypeScript imports MUST use `.js` specifiers under NodeNext ESM, including type-only
imports. Page renderers MUST remain within `tsconfig.json` compilation coverage because build
dynamically imports their emitted `.build/src/pages/*.js` modules.

Markdown fenced-code directives are part of the authoring contract: `lineNumbers`, `line=2-4`,
and `lineOffset=10` are parsed from the fence info string. Supporting a new highlighted language
MUST include its Prism import in `src/lib/markdown.ts`. `public/` assets are published except
`.md`, `.json`, and `.html`; generated assets originate in `src/assets/`.

## Development Workflow

Use Node.js `>=20.19.0` and install dependencies with `npm install`. Run `npm run compile` for
type checking and emitted output, `npm test` for all tests, `npm run build` for the static site,
and `npm run verify` for tests plus a build. For one test, run `npm run compile && node --test
--test-name-pattern="<name>" .build/test/<file>.test.js`.

Use `npm run preview` to build and serve `dist/` at `http://localhost:5173/`, or `npm start` to
watch `src/` and `public/` with live reload. The repository has no lint script.

## Governance

This constitution supersedes conflicting development guidance for this repository. Amendments MUST
document the affected principles, rationale, and resulting version increment. Remove the temporary
Sync Impact Report before committing an amendment.

Constitution versions use semantic versioning: MAJOR for incompatible principle removal or
redefinition, MINOR for a new principle or material expansion, and PATCH for clarification or
non-semantic wording changes. Reviews and implementation plans MUST check applicable work against
these principles and identify any intentional exception before implementation or deployment.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date is unknown |
**Last Amended**: 2026-09-25
