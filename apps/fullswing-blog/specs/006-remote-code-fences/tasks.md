---

description: "Task list for remote code fence implementation"
---

# Tasks: Remote Code Fences

**Input**: Design documents from `/specs/006-remote-code-fences/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and `quickstart.md`

**Tests**: Included because the repository constitution requires focused native `node:test`
coverage for rendering behavior.

**Organization**: Tasks are grouped by user story to support independent implementation and
validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the authoring example and test fixture shape without changing existing
rendering behavior.

- [X] T001 [P] Add a documented remote code fence example using a version-specific raw source URL in `public/blog/2026/demo-features.md`
- [X] T002 [P] Add local HTTP fixture helpers for successful, oversized, non-text, and failed source responses in `test/rendering.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide the shared source-resolution contract required by all user stories.

**Checkpoint**: The source resolver contract and asynchronous build path are ready before story work begins.

- [X] T003 Define remote source reference and publication snapshot types with URL, text, cache, and failure constraints in `src/lib/markdown.ts`
- [X] T004 Implement approved HTTPS URL validation, request timeout, response-size limit, text-content validation, and actionable source errors in `src/lib/markdown.ts`
- [X] T005 Update the build orchestration to create and pass one publication-scoped source cache while awaiting Markdown rendering in `src/build.ts`
- [X] T006 Preserve synchronous authored-fence output through the asynchronous Markdown path and verify existing language, Mermaid, line-number, range, and offset behavior in `test/rendering.test.ts`

---

## Phase 3: User Story 1 - Publish Referenced Source Code (Priority: P1) [MVP]

**Goal**: Authors can reference an approved remote text file and publish it as a fully rendered code block.

**Independent Test**: Render a Markdown source containing a valid remote fence against a local HTTP
fixture and verify retrieved text, language styling, line annotations, and generated static output.

### Tests for User Story 1

- [X] T007 [P] [US1] Add rendering tests for valid source replacement, language selection, line numbers, highlights, offsets, and exact retrieved text in `test/rendering.test.ts`
- [X] T008 [P] [US1] Add build-level coverage proving a valid remote fence is emitted in the generated route HTML in `test/rendering.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Parse `source=` fence directives without breaking the existing language and line directive parser in `src/lib/markdown.ts`
- [X] T010 [US1] Resolve the remote source before code highlighting and feed the retrieved text through the existing escaped code-block renderer in `src/lib/markdown.ts`

**Checkpoint**: A valid remote source reference is independently publishable with the existing code presentation features.

---

## Phase 4: User Story 2 - Understand Referenced Code (Priority: P2)

**Goal**: Visitors can identify the source and copy the retrieved code from the article.

**Independent Test**: Render a successful remote block and verify escaped source attribution and copy
content contain the source URL and retrieved code in their intended locations.

### Tests for User Story 2

- [X] T011 [P] [US2] Add rendering assertions for escaped source attribution links and copy-code content based on retrieved text in `test/rendering.test.ts`

### Implementation for User Story 2

- [X] T012 [US2] Add escaped source attribution markup to remote code blocks while preserving route-safe external URL handling in `src/lib/markdown.ts`
- [X] T013 [US2] Verify the existing client copy behavior copies retrieved source text and does not copy attribution or fence metadata in `src/assets/site.js` and `test/site-client.test.ts`

**Checkpoint**: Visitors can inspect the source origin and reuse the retrieved code without leaving the article.

---

## Phase 5: User Story 3 - Correct Invalid References (Priority: P3)

**Goal**: Authors receive actionable publication failures for unsafe or unusable remote references.

**Independent Test**: Exercise each invalid source category against local fixtures and assert the
error identifies the source and reason while no successful article output is produced.

### Tests for User Story 3

- [X] T014 [P] [US3] Add failure tests for malformed URLs, disallowed hosts, unsupported protocols, unsuccessful responses, non-text responses, oversized bodies, and timeouts in `test/rendering.test.ts`
- [X] T015 [P] [US3] Add repeated-reference coverage proving one URL is fetched once and produces identical contents for every occurrence in `test/rendering.test.ts`

### Implementation for User Story 3

- [X] T016 [US3] Make source retrieval failures include the article rendering context, validated URL, and specific failure reason in `src/lib/markdown.ts` and `src/build.ts`
- [X] T017 [US3] Ensure repeated references share one in-flight or completed publication-scoped snapshot without changing authored fence behavior in `src/lib/markdown.ts`

**Checkpoint**: Unsafe, unavailable, and invalid references fail publication clearly and consistently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete author documentation and run the repository's required validation.

- [X] T018 [P] Document approved hosts, version-specific URL guidance, directive syntax, limits, and failure behavior in `README.md`
- [X] T019 Run the focused compiled rendering and client tests described in `specs/006-remote-code-fences/quickstart.md`
- [X] T020 Run the full test suite and generated-site build with `npm run verify` and record any unrelated baseline failures in `specs/006-remote-code-fences/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; fixture and content-example preparation can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user-story work.
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational and the remote block output from US1.
- **User Story 3 (Phase 5)**: Depends on Foundational; can begin alongside US1, but its repeated-reference assertion uses the US1 source shape.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Foundational only; MVP can be delivered independently.
- **US2 (P2)**: Foundational plus the successful remote block contract from US1.
- **US3 (P3)**: Foundational; invalid-source handling can be implemented independently of visitor attribution.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T007 and T008 can run in parallel after the foundational path exists.
- T011 can run in parallel with T014 and T015 because they extend separate test concerns.
- T018 can run in parallel with completed implementation work once the syntax is stable.
- Different story phases can be assigned to separate contributors after Phase 2, with coordination around `src/lib/markdown.ts`.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete US1 and run its independent tests.
3. Validate generated output before adding attribution and expanded failure coverage.

### Incremental Delivery

1. Add valid remote source rendering as the MVP.
2. Add source attribution and visitor copy verification.
3. Add complete failure handling and duplicate-fetch protection.
4. Finish documentation and full repository validation.

## Independent Test Criteria

- **US1**: A valid remote fence renders retrieved source text with language styling and existing line directives in generated HTML.
- **US2**: A visitor-facing remote block exposes an escaped source link and copies retrieved code text only.
- **US3**: Every invalid source category stops publication with an actionable URL-specific error, and repeated references remain consistent.

## Notes

- All implementation tasks include exact repository paths.
- Every task follows the required `- [ ] T### [P?] [US?] description` checklist format.
- Version-specific raw URLs are preferred for reproducible publications; branch URLs remain supported if they pass validation.

## Phase 7: Convergence

- [X] T021 Enforce successful text-response, size-limit, and timeout validation for every remote source path and add response-level tests for HTTP failures, missing or non-text content types, oversized bodies, and timeouts per FR-008 (partial)
- [X] T022 Pass the current blog route into Markdown rendering and include the article identity in remote-source publication errors per FR-008 and US3/AC1 (partial)
- [X] T023 Replace callback-only remote-source fixtures with deterministic local HTTP-server scenarios covering response status, content type, size, and timeout behavior per plan: local HTTP validation (partial)
