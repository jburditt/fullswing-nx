# Spec-driven development with AI — onboarding guide

**TLDR; version:**

- Copy the ticket description from Jira or a requirements document from Confluence. Verify and edit the context is machine understandable, link any relevant information needed to understand the context
- Plan with AI to update or add the new requirement
- Add as many acceptance criteria as you can, think of edge cases, performance concerns, cross-cutting concerns, etc. Ask AI to add any acceptance criteria it can think of
- Plan to implement one of the features in the spec, one at a time is easier to manage. Use your best judgement.
- Review and modify the plan
- Implement the feature
- Update instructions or skills if there are missed conventions or patterns you want to use in future sessions
- Repeat the last 4 until the spec is fully implemented
- (optional) Add unit tests to cover the acceptance criteria
- (optional) Add playwright tests to cover the acceptance criteria

**AI’s long version:**

Welcome! This document explains how we plan and build features in `civilprecourts-admin` by working with an AI coding assistant (e.g. GitHub Copilot CLI) through a **spec-driven** process. The spec is the source of truth for what a feature should do; the AI is a collaborator that helps write it, challenge it, and then implement it against it — never the other way around (code driving an after-the-fact spec).

## 1. Why we do this

- **Requirements from Jira/Confluence are written for humans, not for implementation.** They're often ambiguous, assume context the reader already has, or skip edge cases entirely. An AI that starts implementing straight from a ticket will silently fill those gaps with assumptions — sometimes wrong ones.
- **A numbered spec with explicit acceptance criteria (AC) is unambiguous and testable.** Every AC maps to at least one test. When a test fails later, you can trace it straight back to the sentence that justifies it (see `spec/guideline-form.md` / `spec/checklist-page.md` for the existing format: numbered sections, an `AC#`/`T#` table, and a "Known issues" list).
- **Large features are safer built one slice at a time.** Implementing an entire spec in one shot makes review hard and failures expensive. Planning and implementing one feature/AC-group at a time, then re-checking against the spec, keeps each step small and reversible.

## 2. The workflow

Work through these steps in order. Steps 4–6 repeat until the whole spec is implemented.

### Step 1 — Bring in the source requirement, and make it machine-understandable

Copy the Jira ticket description or Confluence requirements doc into the conversation (or a scratch file). Before asking the AI to plan anything from it, **read it back critically**:

- Does it name concrete fields, states, routes, and components, or does it gesture vaguely ("update the form", "handle errors")? Tighten vague language yourself where you can.
- Are there implicit assumptions a machine reader wouldn't have (e.g. "like the existing guideline form" — the AI needs to be pointed at that file explicitly)?
- Strip or clarify anything that's presentation-only for humans (screenshots with no captions, Jira formatting artifacts, links that require login) — either describe what they show in text, or attach/paste the relevant content directly.
- Add file/component pointers if you already know roughly where the work lands (e.g. "this extends `add-checklist-page.ts`") — this saves the AI a costly discovery pass and reduces the chance it edits the wrong thing.

Only move to planning once you'd trust a new teammate to read the same text and not get it wrong.

### Step 2 — Plan the spec with AI; AI must not assume, it must ask

Ask the AI to draft or extend a `spec/<feature>.md` file from the requirement, explicitly instructing it **not to guess at unclear behavior** — it should ask you a clarifying question instead of picking a plausible default. Good prompts:

> "Draft/update `spec/<feature>.md` from this requirement. Follow the existing format in `spec/checklist-page.md`. Do not assume any behavior that isn't stated or obviously implied by the existing code — ask me before deciding."

Expect (and want) a back-and-forth: the AI should surface questions like "should this field be required in create mode, edit mode, or both?" or "what happens if the API call fails here?" before it writes the spec prose. Answer those questions rather than telling it to "just pick something reasonable" — that's the whole point of this step.

### Step 3 — Push for acceptance criteria, including edge cases and non-functional concerns

Once the core spec reads correctly, explicitly ask the AI to enumerate acceptance criteria — don't assume the first pass is complete. Ask it to think about:

- **Edge cases**: empty/zero states, boundary values (min/max length, zero items), invalid or missing data, concurrent edits, rapid user interaction (double-clicks, fast tab-switching).
- **Error paths**: failed API calls, partial data, navigation away mid-edit.
- **Performance/UX concerns**: large lists, slow network, loading states, debouncing.
- **Cross-cutting behavior**: what does this interact with (routing guards, other forms, shared components) that could break in a non-obvious way?

Number each criterion (`AC1`, `AC2`, …, continuing from the highest existing number in the file if you're extending a spec) and phrase each as a testable scenario → expected result, matching the table style already used in `spec/guideline-form.md`. These acceptance criteria are what later drive both the unit tests and the Playwright tests — do not skip this step or keep it vague, since a fuzzy AC produces a fuzzy (or missing) test.

### Step 4 — Plan implementation of one feature/AC-group at a time

Do not ask the AI to implement the entire spec in one pass. Pick one feature, one AC, or one tightly related group of ACs, and ask the AI to produce an implementation plan for just that slice: which files it will touch, what it will add/change, and how it fits the existing patterns (e.g. NGXS action/service/state trio, `goab-*` components, etc.). Use your judgement on how to slice the work — usually by UI section, by form, or by a single user-facing behavior; smaller slices are easier to review and roll back if wrong.

### Step 5 — Review and modify the plan

Read the plan before any code is written. Check that it:

- Matches the AC(s) it claims to implement, with nothing missing or extra.
- Reuses existing components/services/patterns rather than duplicating them (check for something similar elsewhere first — see the repo conventions in `.github/copilot-instructions.md`).
- Doesn't quietly expand scope into unrelated files.

Push back and ask for changes if anything looks off. Don't let the AI start coding against a plan you haven't actually read.

### Step 6 — Implement the feature

Once the plan looks right, have the AI implement it. Review the resulting diff against both the plan and the AC(s) it targets — not just "does it look reasonable" but "does it actually satisfy the acceptance criteria as written."

### Repeat steps 4–6

Go back to Step 4 for the next feature/AC-group, until every acceptance criterion in the spec has a corresponding implementation. Keep slices small; it's fine (expected) for this loop to run many times on a non-trivial spec.

NOTE - If any AI code written could be updated to follow a more modern approach e.g. form signals instead of form directive, update the AI instructions or skills. Same for repeatable patterns that should be adhered to e.g. use goab design components instead of custom material design. This will allow future AI implemented code to follow this convention for all future work.

### (Optional) Step 7 — Add unit tests to cover the acceptance criteria

Once the relevant slice of the spec is implemented, add Vitest unit tests (colocated `*.spec.ts` files) for component/service logic that doesn't need a full browser — form validity, computed signals, mapping/transform helpers, guard logic, etc. Each test should cite the AC it proves, so failures can be traced back to the spec.

### (Optional) Step 8 — Add Playwright tests to cover the acceptance criteria

Add end-to-end tests under `tests/<feature-area>/` for the same acceptance criteria, following the existing convention: one `.spec.ts` file per logical grouping, a file-level comment citing the spec section(s) covered (e.g. `// Spec §6 Paragraphs section (AC10-AC16)`), and test titles that start with their AC number (e.g. `test('AC12: duplicating a paragraph inserts an identical copy directly below it', ...)`).

NOTE - We do not follow TDD and tests are not enforced. Recommend adding and fixing tests as background AI tasks unless time for sanity checking tests is allotted on your team. There is value in AI maintaining and writing tests, it has uncovered bugs that were missed by manual testing.

## 3. Spec file conventions (for reference)

Existing examples: `spec/checklist-page.md`, `spec/guideline-form.md`, `spec/preview/checklist-page.md`.

- **Header** — source component file(s) the spec describes.
- **Purpose** — a short paragraph on what the feature is for and who uses it.
- **Numbered sections (`## 1.`, `## 2.`, …)** — one per logical area, using tables for field-by-field behavior where clearer than prose.
- **Acceptance criteria, numbered `AC1`, `AC2`, … (older specs use `T1`, `T2`, …)** — a table of `AC# | Scenario | Expected result`. Numbering is permanent within a file — don't renumber ACs just because one was removed; leave the gap or note it was merged elsewhere.
- **Known issues** — a numbered list of intentional-but-imperfect behavior or accepted bugs, each with a one-line reason. If you fix one, remove it and renumber the list, then fix any `see Known issue #N` cross-references elsewhere in the same file.

## 4. Running the suites

From `apps/frontend/civilprecourts-admin`:

```powershell
npm test               # Vitest unit tests (ng test)
npm run ui-test        # Playwright e2e tests (msedge project), requires `npm start` running separately
```

Run a single Playwright file/test while iterating:

```powershell
npx playwright test tests/guideline-form/save-cancel.spec.ts --project=msedge
```

Run a single Vitest spec via the underlying builder rather than `npm test`:

```powershell
npx vitest run src/app/components/protected/files-library/files-library.spec.ts
```

Playwright runs in parallel locally by default; CI always runs serially with retries. If you hit an intermittent local timeout you can't reproduce in isolation, try `--workers=1` before assuming it's a real bug — parallel runs share one dev server and can starve each other.

## 5. Quick checklist for a spec-driven PR

- [ ] Source ticket/requirement reviewed and tightened for machine-understandability
- [ ] Spec drafted/updated collaboratively — AI asked clarifying questions instead of assuming
- [ ] Acceptance criteria enumerated, including edge cases, error paths, and performance concerns
- [ ] Feature implemented in reviewed, judgement-sized slices (plan → review → implement, repeated)
- [ ] (Optional) Every AC has a Vitest and/or Playwright test citing it by number
- [ ] `npm test` and `npm run ui-test` both pass locally
- [ ] No stale spec text describing behavior the code no longer has

**NOTES**

- It would be worth exploring spec-kit, a more standardized approach to spec-driven development
