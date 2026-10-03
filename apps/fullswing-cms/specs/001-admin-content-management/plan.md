# Implementation Plan: Fullswing CMS Admin Content Management

**Branch**: `001-admin-content-management` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `apps/fullswing-cms/specs/001-admin-content-management/spec.md`

## Summary

Build the CMS as a server-rendered Node.js application whose use cases depend on a CMS-owned content-storage port. The Azure composition uses Blob Storage as the sole content authority and runtime-state store; other compositions may register OneDrive, and local-file and in-memory demo compositions support development. Validate provider configuration before activation; switching sources does not copy or change content in the previous source. Local files follow the publisher's year-based blog layout and support HTML page source editing without rendering or publishing those page files. Reuse shared Fullswing metadata validation and a shared Markdown renderer. Provide an authenticated administrator action to dispatch the saved GitHub workflow target, reporting dispatch acceptance separately from workflow completion.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=20.19, NodeNext ESM

**Primary Dependencies**: `@fullswing/content-model`; Fastify HTTP host; `@azure/msal-node` for Microsoft Entra authentication; `@azure/storage-blob` for content, configuration, and encrypted secret persistence; Microsoft Graph JavaScript SDK inside the optional OneDrive adapter; `@octokit/rest` inside the GitHub workflow adapter; `marked` and Prism in the shared Markdown renderer; `sanitize-html` at the CMS preview boundary

**Storage**: The Azure composition uses one private Blob container for content, CMS configuration, and encrypted secrets. Content uses `content/blog/<YYYY>/<basename>.md` plus `.json`, and `content/pages/<YYYY>/<basename>.html` plus `.json`; CMS configuration uses Blob ETag conditional writes, and `SecretStore` values use AES-256-GCM with a separately configured environment key. Sessions remain in memory. Other compositions may register OneDrive; development also supports local files and an in-memory demo provider. All stores and content providers remain behind CMS-owned ports.

**Testing**: TypeScript compile plus native `node:test` through Nx; CMS service tests, storage-provider contract tests, mocked Graph integration tests, and Entra/session tests with test doubles

**Target Platform**: Node.js 20.19+ server with browser-accessible, server-rendered HTML. The Azure deployment uses Linux App Service F1 in `rg-fullswing-cms`, with content storage isolated in `rg-fullswing-content`; the existing static blog remains in `rg-fullswing-blog`.

**Project Type**: Server-rendered web application in the existing `apps/fullswing-cms` workspace project

**Performance Goals**: No latency or throughput SLO is specified. Blob and OneDrive enumeration must return complete collections; the optional OneDrive adapter follows all Graph continuation links. Dashboard filtering and pagination operate on normalized metadata.

**Constraints**: Protect all routes except Login and OAuth callbacks; keep tokens server-side; preserve matched Markdown/JSON and HTML/JSON pairs; never report a partial pair write as successful; require provider compare-and-save for edits; use Blob conditional writes for configuration revisions; never persist plaintext secrets in Blob Storage; keep the encryption key outside Blob Storage; sessions are volatile across process restarts; static publishing must stage Blob blogs before the repository-based build and fail closed on empty or incomplete content; no automatic provider migration; never render or execute stored HTML; local HTML pages are not published by the current static blog generator.

**Scale/Scope**: One Fullswing content collection and one selected provider per deployment. Azure selects Blob as its sole content provider; OneDrive is optional in other compositions; local-file and demo providers are intended for development. No content-count or concurrent-user target is specified.

**Identity/Storage Access**: Microsoft Entra ID authenticates each administrator. The Azure Blob composition uses OIDC identity scopes only and accesses Blob with its configured storage credential; it does not request Microsoft Graph file permissions. When another composition registers OneDrive, operations use the signed-in administrator's delegated permissions; app-only fallback is prohibited.

**Deployment**: A manual GitHub Actions workflow provisions the F1 CMS host and persistent Blob account into separate resource groups using federated Azure login. A separate existing blog workflow uses its federated principal with container-scoped Blob read access to stage Markdown/JSON pairs into `apps/fullswing-blog/public/blog/` before the static build. Initial content seeding is an explicit opt-in, guarded to an empty prefix.

**Runtime Packaging**: CI installs the workspace, tests the CMS, compiles `content-model`, `markdown-renderer`, and the CMS, then creates a production-only package containing workspace symlink targets, public assets, compiled output, and `blob-composition.mjs`. App Service starts the compiled entry point directly and receives required configuration through app settings; `.env` is not deployed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content Contract Compatibility**: PASS. Keep Markdown and JSON sidecars as a logical blog pair and use shared metadata validation. Introduce a pure JSON parser in `@fullswing/content-model`; retain `loadMetadata()` as the static blog filesystem wrapper.
- **II. Secure Administration by Default**: PASS. Entra authentication, allowlist checks, server-side session/token cache, delegated OneDrive access, CSRF protection on writes and dispatch, a repository-scoped GitHub credential, and secret redaction are cross-cutting gates.
- **III. Selected Provider Is the Content Authority**: PASS. The Azure composition registers Blob as its sole content provider; it does not register or fall back to OneDrive. Other compositions may explicitly register OneDrive.
- **IV. Isolated, Testable Integrations**: PASS. Authentication and provider operations are behind typed ports; fake providers and mocked Graph responses cover success, validation, auth, conflict, and provider failure.
- **V. Accessible, Progressive Authoring Experience**: PASS. Core forms and status feedback work without Svelte web components; Markdown preview is sanitized before display and remains keyboard accessible.
- **Implementation Constraints**: PASS. Keep CMS-only code in `apps/fullswing-cms`, and place only behavior genuinely shared with the static blog in root libraries.
- **Development Workflow**: PASS. Planning precedes implementation; add focused tests and run CMS compile/test Nx targets.

**Post-design gate recheck**: PASS. The provider port remains CMS-local, Blob is the Azure composition's sole content authority, OneDrive is optional in other compositions, local files are development-only, every provider/auth integration stays behind testable boundaries, and both Markdown preview and HTML source handling have safety boundaries. The constitution amendment is recorded at version 2.0.0.

## Project Structure

### Documentation (this feature)

```text
apps/fullswing-cms/specs/001-admin-content-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code

```text
apps/fullswing-cms/
├── src/
│   ├── auth/                 # Entra login, callback, allowlist, sessions
│   ├── config/               # Provider/workflow settings, store ports, and Blob adapters
│   ├── content/
│   │   ├── application/      # Dashboard, validation, and authoring use cases
│   │   ├── domain/           # CMS normalized records and errors
│   │   └── storage/          # Port, provider registry, Blob, OneDrive, and local-file adapters
│   ├── integrations/
│   │   └── github/           # Workflow-dispatch port and Octokit adapter
│   ├── server/               # Fastify routes and request guards
│   ├── views/                # Server-rendered pages and forms
│   ├── assets/               # Progressive-enhancement client assets
│   └── index.ts
└── test/
    ├── unit/
    ├── contract/
    └── integration/

apps/fullswing-cms/blob-composition.mjs  # Azure Blob content/runtime state, Entra identity, in-memory sessions

libs/content-model/src/
├── metadata.ts               # Pure metadata parsing plus filesystem wrapper
└── ...                       # Existing shared content-domain types/repository

libs/markdown-renderer/src/
└── ...                       # Extracted shared Marked/Prism rendering behavior
```

**Structure Decision**: Keep request handling, auth, configuration, use cases, and every storage adapter inside the CMS application. Route and application services receive providers through startup composition and never import Azure or Graph types. The local-file adapter uses filesystem APIs only behind the provider contract. Put GitHub REST calls behind a CMS-local dispatch port, and keep configured target/secret loading in server-only configuration and secret stores. Extract metadata parsing and Markdown rendering into shared library boundaries because both apps consume those behaviors. `@fullswing/content-model`'s `ContentRepository` remains a normalized in-memory read model, not a persistence adapter.

## Complexity Tracking

No constitution violations are proposed. The new Markdown renderer library is justified by the need for the CMS preview and static publisher to share one rendering implementation; provider adapters remain CMS-local.
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
