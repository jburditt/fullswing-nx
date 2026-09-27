# Implementation Plan: Mermaid Diagram Rendering

**Branch**: `005-enhance-reader-experience` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-enhance-reader-experience/spec.md`, with the
planning focus `mermaid diagram rendering`.

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Preserve Mermaid fence source as escaped, readable HTML while allowing a host page to provide a
Mermaid runtime for optional visual enhancement. Keep Mermaid out of the generator dependencies;
make the shared client extension point safe for missing, late, asynchronous, or failing Mermaid
enhancement; and verify both rendered output and fallback behavior with focused native tests.

## Technical Context

**Language/Version**: TypeScript on Node.js >=20.19.0; ESM NodeNext modules

**Primary Dependencies**: Existing `marked`, Prism, and native browser APIs; Mermaid remains a
host-provided optional runtime and is not added to `package.json`

**Storage**: Markdown and JSON content files; generated static HTML and copied assets

**Testing**: Native `node:test` tests compiled to `.build/test/`, plus `npm run build` for generated
site validation

**Target Platform**: Static hosting and modern browsers with optional host script integration

**Project Type**: ESM Node/TypeScript static-site generator with progressive browser enhancement

**Performance Goals**: No additional build-time runtime cost; discover Mermaid blocks once per page
and invoke a host enhancer only when blocks exist

**Constraints**: Reading must work without Mermaid; authored source must remain escaped and
readable; one enhancement failure must not break other content; route-safe static output is
required; host controls Mermaid loading, version, configuration, and CSP

**Scale/Scope**: All generated blog and rich-page routes containing Mermaid fences; multiple
diagram blocks per page; no dynamic post-load content discovery in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / plan |
|-----------|--------|-----------------|
| I. Static-Site Generation | PASS | Mermaid remains optional browser enhancement; Markdown rendering and static output remain server/build responsibilities. |
| II. Validated Content Pairs | PASS | No change to discovery or content-pair validation. |
| III. Route-Safe Rendering | PASS | Existing layout asset handling remains in use; no route-relative Mermaid URLs are introduced. |
| IV. Verifiable Changes | PASS | Update focused Markdown/client tests and run `npm test`; run `npm run build` because generated HTML is affected. |
| V. Guarded Deployment | PASS | No Azure or deployment configuration changes. |

No violations or exceptions require complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-enhance-reader-experience/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── mermaid-extension.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── assets/
│   └── site.js              # Optional Mermaid discovery and host extension point
├── lib/
│   └── markdown.ts          # Mermaid fence to escaped preformatted HTML
└── pages/                   # Existing rich-page renderers

test/
├── rendering.test.ts        # Markdown and generated HTML behavior
└── site-client.test.ts      # Browser extension-point behavior

public/blog/
└── <year>/*.md              # Mermaid-authored content examples
```

**Structure Decision**: Keep the existing single-project static-site generator structure. The
server-side Mermaid fence handling belongs in `src/lib/markdown.ts`; optional browser behavior
belongs in `src/assets/site.js`; focused tests remain in the existing `test/` files. The design
artifacts under this feature directory document the host contract and validation scenarios without
introducing a new runtime or project boundary.

## Phase 0: Research Summary

See [research.md](research.md). Decisions are to retain the escaped `pre.mermaid` fallback, use
the modern host-provided `mermaid.run({ nodes })` API when available, expose the existing manual
hook for late loading, and isolate asynchronous enhancement failures.

## Phase 1: Design Summary

See [data-model.md](data-model.md), [contracts/mermaid-extension.md](contracts/mermaid-extension.md),
and [quickstart.md](quickstart.md). The design models a diagram block and its enhancement states,
defines the `window.typescriptBlog.enhanceMermaid` host contract, and provides compile, test, build,
and browser-level checks.

## Implementation Approach

1. Preserve server-side escaping and the exact `pre.mermaid` markup contract.
2. Make client enhancement non-blocking and failure-safe for missing runtimes, rejected promises,
   malformed diagrams, and multiple blocks.
3. Preserve the manual hook for hosts that load Mermaid after the shared script.
4. Add focused tests for source escaping, automatic/manual enhancement, late loading, and failure
   isolation, then validate the generated static site.

## Complexity Tracking

No constitution violations were identified; no additional complexity is justified.
