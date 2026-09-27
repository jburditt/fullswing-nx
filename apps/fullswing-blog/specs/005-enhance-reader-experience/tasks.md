---

description: "Executable task list for Mermaid diagram rendering and the Enhance Reader Experience feature"
---

# Tasks: Mermaid Diagram Rendering

**Input**: Design documents from `/specs/005-enhance-reader-experience/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/mermaid-extension.md](contracts/mermaid-extension.md),
and [quickstart.md](quickstart.md)

**Organization**: Tasks are grouped by the three feature user stories in priority order. The
Mermaid-specific work is in User Story 3, with shared validation in the final phase.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the existing static-site generator surfaces used by this feature.

- [X] T001 [P] Confirm Node.js `>=20.19.0`, installed dependencies, and existing native `node:test` commands in `package.json`
- [X] T002 [P] Review the current Markdown, layout, renderer, and browser-client entry points in `src/lib/markdown.ts`, `src/lib/layout.ts`, `src/lib/renderers.ts`, and `src/assets/site.js`
- [X] T003 [P] Identify representative catalogue, code, social, and Mermaid fixtures in `public/blog/2026/demo-features.md`, `public/blog/2025/doc-template.md`, and existing test files

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Preserve the repository-wide static-site and verification constraints before story work.

- [X] T004 Add a focused feature validation matrix covering FR-001 through FR-010 and SC-001 through SC-006 in `specs/005-enhance-reader-experience/quickstart.md`
- [X] T005 [P] Confirm generated client assets remain route-safe at nested output paths through an assertion in `test/rendering.test.ts`
- [X] T006 [P] Confirm all behavioral changes use native `node:test` coverage and compile-to-`.build/test/` commands documented in `specs/005-enhance-reader-experience/quickstart.md`

**Checkpoint**: Shared project constraints and validation entry points are documented; user stories can be implemented independently.

## Phase 3: User Story 1 - Find Relevant Content (Priority: P1) [MVP]

**Goal**: Expose all discovered blogs and rich pages in deterministic date/title order with usable category summaries and filtering.

**Independent Test**: Build content spanning multiple types, dates, and categories; verify the catalogue contains all metadata, category filtering updates visibility, and the final active category cannot be disabled.

### Tests for User Story 1

- [X] T007 [P] [US1] Add repository ordering and category-summary assertions for blogs, pages, combined content, equal dates, normalized identifiers, and counts in `test/repository.test.ts`
- [X] T008 [P] [US1] Add catalogue rendering assertions for content type, title, date, author, categories, and links in `test/rendering.test.ts`
- [X] T009 [P] [US1] Add browser assertions for category visibility, `aria-pressed` state, and protection against disabling the final active category in `test/site-client.test.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implement or correct deterministic repository sorting and category summaries in `src/lib/repository.ts` so blogs, pages, and combined content sort by descending date then title
- [X] T011 [US1] Render complete catalogue metadata and category filter controls in `src/lib/renderers.ts`, preserving normalized category identifiers and item counts
- [X] T012 [US1] Implement category filtering and final-active-category protection in `src/assets/site.js`, including assistive-technology state updates

**Checkpoint**: User Story 1 is independently testable through the catalogue and its native repository/client tests.

## Phase 4: User Story 2 - Read and Reuse Technical Content (Priority: P2)

**Goal**: Render formatted technical content with safe unsupported-language fallback, line annotations, and accessible code-copy feedback.

**Independent Test**: Publish an article with formatted text and annotated code, open it, verify language styling and line annotations, then verify successful and failed copy announcements.

### Tests for User Story 2

- [X] T013 [P] [US2] Add Markdown rendering assertions for supported languages, unsupported-language escaping, `lineNumbers`, `line`, `lineOffset`, and inclusive ranges in `test/rendering.test.ts`
- [X] T014 [P] [US2] Add browser assertions for full code extraction, successful clipboard feedback, unavailable clipboard feedback, and denied-copy feedback in `test/site-client.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Implement or correct fenced-code parsing and rendering in `src/lib/markdown.ts` so line highlights are 1-based, ranges are inclusive, and `lineOffset` changes displayed numbers without shifting highlights
- [X] T016 [US2] Implement or correct accessible copy controls and status announcements in `src/lib/renderers.ts` and `src/assets/site.js` without altering the source code text
- [X] T017 [US2] Preserve readable, safely escaped output for unsupported languages in `src/lib/markdown.ts` and add the corresponding fixture case to `test/rendering.test.ts`

**Checkpoint**: User Stories 1 and 2 remain independently functional, and the article reading/copying workflow passes its focused tests.

## Phase 5: User Story 3 - Navigate and View Enhanced Diagrams (Priority: P3)

**Goal**: Provide accessible social navigation and optional, failure-safe Mermaid enhancement while preserving readable diagram source.

**Independent Test**: Open a page with social links and multiple Mermaid blocks with no runtime, a preloaded runtime, a late-loaded manual enhancer, and a failing enhancer; verify focus behavior, enhancement, and readable fallback.

### Tests for User Story 3

- [X] T018 [P] [US3] Add social-navigation assertions for accessible names, lighter resting fills, and distinct hover/focus styling in `test/rendering.test.ts`
- [X] T019 [P] [US3] Add Mermaid Markdown assertions for exact `<pre class="mermaid">` output, source escaping, multiple blocks, and no code-copy control in `test/rendering.test.ts`
- [X] T020 [P] [US3] Add Mermaid client contract tests for no runtime, automatic `window.mermaid.run({ nodes })`, manual late loading, multiple blocks, asynchronous completion, rejected enhancement, and failed-source preservation in `test/site-client.test.ts`

### Implementation for User Story 3

- [X] T021 [US3] Preserve exact escaped Mermaid block markup and readable fallback behavior in `src/lib/markdown.ts` for every `mermaid` fence
- [X] T022 [US3] Make `setupMermaidExtensionPoint` in `src/assets/site.js` expose the documented `window.typescriptBlog.enhanceMermaid(enhancer)` contract, support late/asynchronous hosts, and contain thrown or rejected enhancement failures
- [X] T023 [US3] Isolate Mermaid enhancement failure per block in `src/assets/site.js` so a malformed diagram preserves its source and does not affect other blocks or article behavior
- [X] T024 [US3] Preserve accessible GitHub and LinkedIn labels, focus states, and resting/interactive icon fills in `src/lib/layout.ts` and `src/assets/site.css`
- [X] T025 [US3] Update Mermaid extension documentation and host usage guidance in `README.md` to describe optional runtime loading, `mermaid.run`, the manual hook, safe source fallback, and `accTitle`/`accDescr`

**Checkpoint**: All three user stories are independently functional; Mermaid remains optional and no article becomes unreadable when enhancement is absent or fails.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete static output and ensure the implementation matches the design contract.

- [X] T026 [P] Run the focused rendering and client tests from `specs/005-enhance-reader-experience/quickstart.md` after compiling to `.build/`
- [X] T027 [P] Run `npm test` and resolve only feature-related regressions in `test/`
- [X] T028 Run `npm run build` and verify generated Mermaid markup, nested asset references, and route output under `dist/`
- [X] T029 [P] Run `git diff --check` and review changed files against `specs/005-enhance-reader-experience/contracts/mermaid-extension.md`
- [X] T030 Run the browser validation in `specs/005-enhance-reader-experience/quickstart.md` with Mermaid absent, available, late-loaded, and failing

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; tasks T001-T003 can run in parallel.
- **Phase 2 Foundational**: Depends on Phase 1; T005-T006 can run in parallel after the shared entry points are confirmed.
- **Phase 3 User Story 1**: Depends on Phase 2; T007-T009 can run in parallel, followed by T010-T012.
- **Phase 4 User Story 2**: Depends on Phase 2 only; T013-T014 can run in parallel, followed by T015-T017. It does not require US1 completion.
- **Phase 5 User Story 3**: Depends on Phase 2 only; T018-T020 can run in parallel, followed by T021-T025. It does not require US1 or US2 completion.
- **Phase 6 Polish**: Depends on the desired user story phases; T026-T029 can run in parallel after implementation, while T030 requires a built site and host/browser access.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2; suggested MVP.
- **US2 (P2)**: Independent after Phase 2; shares generated article surfaces but has no logical dependency on US1 behavior.
- **US3 (P3)**: Independent after Phase 2; Mermaid and social navigation use existing layout/client surfaces and do not require US1 or US2 completion.

### Parallel Opportunities

- T001-T003 during setup.
- T005-T006 during foundational validation.
- T007-T009, T013-T014, and T018-T020 are parallel test tasks because each targets a separate test concern or file region.
- After Phase 2, separate contributors can implement US1, US2, and US3 in parallel, provided changes to shared files are coordinated.
- T026-T029 are parallel validation tasks once the implementation is complete.

## Parallel Example: User Story 1

```text
Task: T007 repository ordering and category-summary tests in test/repository.test.ts
Task: T008 catalogue rendering tests in test/rendering.test.ts
Task: T009 category-filter client tests in test/site-client.test.ts
```

## Parallel Example: User Story 2

```text
Task: T013 Markdown annotation tests in test/rendering.test.ts
Task: T014 copy feedback tests in test/site-client.test.ts
```

## Parallel Example: User Story 3

```text
Task: T018 social-navigation tests in test/rendering.test.ts
Task: T019 Mermaid markup tests in test/rendering.test.ts
Task: T020 Mermaid extension-point tests in test/site-client.test.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup and Phase 2 foundational validation.
2. Complete Phase 3 User Story 1.
3. Run the independent catalogue tests and stop for an MVP review.

### Incremental Delivery

1. Add User Story 2 for technical reading and code reuse.
2. Add User Story 3 for social navigation and optional Mermaid enhancement.
3. Complete Phase 6 build, browser, and contract validation.

### Mermaid-Focused Delivery

For the requested Mermaid work, implement T019-T025 after the foundational tasks, then run T026,
T028, and T030. This delivers the optional extension contract without adding Mermaid as a mandatory
build dependency.

## Notes

- Every task uses the required `- [ ] T###` checklist format.
- `[P]` appears only where tasks target independent files or validation concerns.
- Story tasks carry exactly one `[US#]` label and include an exact repository path.
- No Azure deployment files are in scope.

## Phase 7: Convergence

- [X] T031 Align `test/deployment-config.test.ts` with the current pinned `rg-typescript-blog` lifecycle contract in `azure.yaml` and `.github/workflows/deploy.yml`, then make `npm test` pass per Constitution IV (partial)
