# Code Review Checklist — fullswing-cms

Full read-only review (not diff-only) of `apps/fullswing-cms`: `src/` (bootstrap, server/routes/guards, auth, config, content domain/application/storage incl. file, blob, OneDrive, demo providers, GitHub integration, views), `public/assets/cms.js`, `test/`, package/tsconfig. Includes the user's in-progress changes in `src/bootstrap.ts`, `src/server/routes/blog-editor.ts`, `test/integration/bootstrap.test.ts` as present (reviewed, unmodified; no defects found in them). Excludes `.build/`, `node_modules/`. `infra/*.bicep` (cross-checked against `blob-composition.mjs` env vars and `.github/workflows/deploy-cms.yml` packaging) and `public/assets/cms.css` were reviewed in a follow-up pass with no additional findings.

Validation: `nx run fullswing-cms:test --skip-nx-cache` → 97/97 pass. Finding 1 reproduced empirically with a script against the compiled `FileContentStorageProvider` (temp dir, removed).

- [ ] **Medium — Saved blog metadata JSON gets an unintended `dateValue` field** — `src/content/application/validate-blog-draft.ts:72,92-98`; persisted at `src/content/storage/file-content-provider.ts:82`, `src/content/storage/blob-content-provider.ts:113,116`, `src/content/storage/onedrive/onedrive-provider.ts:88,134,177`
  - Issue: `validateBlogDraft` returns the `ParsedMetadata` (includes `dateValue: Date`) as `metadata`; providers `JSON.stringify` it verbatim. Reproduced output: `{"title":"T","author":"A","date":"2026-01-02","categories":["x"],"dateValue":"2026-01-02T00:00:00.000Z"}`. `ContentMetadata` has no such field, so the type system hides it.
  - Impact: every CMS-saved blog writes a derived, redundant field to the source-of-truth JSON; it can drift from `date` on manual edits and pollutes the blog repo's content files. (Page saves are unaffected: `routes/pages.ts` passes plain metadata.)
  - Fix: in `validateBlogDraft` return plain `{ title, author, date, categories }` (strip `dateValue`), or have providers serialize only `title/author/date/categories`. Add a test asserting the saved JSON keys.

- [ ] **Low — Basename validation inconsistent across layers** — `src/content/application/validate-blog-draft.ts:26-31,56-58` vs `file-content-provider.ts:279`, `blob-content-provider.ts:280`, `demo-content-provider.ts:92`
  - Issue: the validator only rejects `/ ? # \` and whitespace, while file/blob/demo providers require `^[a-z0-9]+(-[a-z0-9]+)*$`. Inputs like `My_Post` pass validation and Preview, then fail on Save with a provider 400 raised outside the field-level issue flow.
  - Impact: users get a generic error instead of an inline basename message after previewing a "valid" draft; OneDrive (permissive) vs other providers diverge on what is allowed.
  - Fix: enforce the strict slug pattern in `parseBasename` and update the message accordingly.

- [ ] **Low — 403 responses use a different error shape than the central handler** — `src/server/request-guards.ts:80,93`, `src/server/routes/auth.ts:85`
  - Issue: guards return `{ error: 'Access denied.' }` or plain strings while `error-handler.ts` emits `{ error: { code, message } }`.
  - Impact: clients (e.g. `/blogs/preview` fetch) cannot rely on one error contract.
  - Fix: throw `CmsError('access-denied', …, 403)` from the guards so the handler formats it uniformly.

Checked and not reported: `safeReturnTo` open-redirect handling (correct), CSRF/session ordering, secret encryption (AES-GCM with AAD), config optimistic concurrency, OneDrive compensation logic, the user's `getConfigRevision` change returning `undefined` with redirect to `/configuration?setup=required`.

