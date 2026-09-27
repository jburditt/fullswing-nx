# Implementation Plan: Remote Code Fences

**Branch**: `006-remote-code-fences` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-remote-code-fences/spec.md`, with the planning
focus `add raw markdown file URL to code block fence directives`.

## Summary

Extend the existing fenced-code authoring contract with a `source=<approved-URL>` directive.
During static publication, retrieve each referenced text file once, pass its contents through the
existing language highlighting, line annotation, escaping, and copy behavior, and expose the
source URL as attribution. Reject unsafe, unavailable, non-text, or oversized sources with
actionable publication errors.

## Technical Context

**Language/Version**: TypeScript on Node.js >=20.19.0; ESM NodeNext modules

**Primary Dependencies**: Existing `marked`, Prism, and Node.js `fetch`; no new dependency

**Storage**: Markdown and JSON content files; generated static HTML; in-memory per-publication
source cache

**Testing**: Native `node:test` tests compiled to `.build/test/`, plus `npm run build`

**Target Platform**: Node.js static publication and modern browsers

**Project Type**: ESM Node/TypeScript static-site generator with progressive browser enhancement

**Performance Goals**: Fetch each distinct source URL at most once per publication; avoid network
access for ordinary authored fences; bound remote response size and request duration

**Constraints**: Static output must remain self-contained; only approved HTTPS source hosts are
allowed; retrieved text must be escaped; existing authored Markdown behavior and fence directives
must remain compatible; publication errors must identify the source

**Scale/Scope**: All generated blog Markdown routes; remote text code blocks only; no private
repository authentication or browser-side source fetching

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / plan |
|-----------|--------|-----------------|
| I. Static-Site Generation | PASS | Sources are retrieved during publication and emitted into static HTML; no required browser fetch is added. |
| II. Validated Content Pairs | PASS | Discovery and Markdown/JSON pairing remain unchanged. |
| III. Route-Safe Rendering | PASS | Source attribution is escaped and rendered as a safe external link; no route-relative output is introduced. |
| IV. Verifiable Changes | PASS | Add focused rendering and fetch-error tests, run `npm test`, and run `npm run build` for generated output. |
| V. Guarded Deployment | PASS | No deployment configuration changes. |

No violations or exceptions require complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-remote-code-fences/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and constraints
├── quickstart.md        # Phase 1 validation guide
└── tasks.md             # Phase 2 task list
```

### Source Code (repository root)

```text
src/
├── build.ts                 # Passes a per-publication source cache to Markdown rendering
└── lib/
    └── markdown.ts          # Parses source directives, fetches and validates remote text,
                              # then renders the existing code-block HTML

test/
└── rendering.test.ts        # Remote source rendering, caching, escaping, and failure behavior

public/blog/
└── <year>/*.md              # Source-reference fence authoring examples
```

**Structure Decision**: Keep the existing single-project static-site generator. The remote source
directive belongs beside the existing fence parser in `src/lib/markdown.ts`; `src/build.ts` owns
the publication-scoped cache and awaits Markdown rendering. Existing rendering tests remain the
focused verification surface.

## Phase 0: Research Summary

See [research.md](research.md). Decisions are to use Node's built-in `fetch`, permit the initial
raw GitHub host over HTTPS, enforce response and timeout bounds, cache by URL within one
publication, and use version-specific URLs for reproducible content.

## Phase 1: Design Summary

See [data-model.md](data-model.md) and [quickstart.md](quickstart.md). The design models source
references and publication snapshots, defines the rendering and failure contracts, and provides
local HTTP-server validation without depending on GitHub availability.

## Implementation Approach

1. Add a small publication-scoped remote source resolver with URL validation, timeout and size
   limits, text response checks, and actionable errors.
2. Make Markdown rendering await source resolution while preserving all existing authored-fence
   behavior and escaping rules.
3. Add escaped source attribution to remote blocks and preserve code copying of retrieved text.
4. Update build orchestration and focused native tests, then validate the generated site.

## Complexity Tracking

No constitution violations were identified; no additional complexity is justified.
