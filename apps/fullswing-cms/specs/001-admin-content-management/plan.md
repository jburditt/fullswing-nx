# Implementation Plan: Fullswing CMS Admin Content Management

**Branch**: `001-admin-content-management` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `apps/fullswing-cms/specs/001-admin-content-management/spec.md`

## Summary

Build the CMS as a server-rendered Node.js application whose use cases depend on a CMS-owned content-storage port. Use OneDrive as the production provider and provide local-file and in-memory demo compositions for development. Validate provider configuration before activation; switching sources does not copy or change content in the previous source. Local files follow the publisher's year-based blog layout and support HTML page source editing without rendering or publishing those page files. Reuse shared Fullswing metadata validation and a shared Markdown renderer. Provide an authenticated administrator action to dispatch the saved GitHub workflow target, reporting dispatch acceptance separately from workflow completion.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=20.19, NodeNext ESM

**Primary Dependencies**: `@fullswing/content-model`; planned Fastify HTTP host; `@azure/msal-node` for Microsoft Entra authentication; Microsoft Graph JavaScript SDK inside the OneDrive adapter; `@octokit/rest` inside the GitHub workflow adapter; `marked` and Prism in the shared Markdown renderer; `sanitize-html` at the CMS preview boundary

**Storage**: OneDrive via Microsoft Graph is the production content store. Development compositions also support local files under a configured website public directory and an in-memory demo provider. Local blog/page sidecars use year-based folders derived from metadata date. Local composition configuration, sessions, and secrets are in memory; production store implementations are supplied by deployment composition and must never return secret values to browser code.

**Testing**: TypeScript compile plus native `node:test` through Nx; CMS service tests, storage-provider contract tests, mocked Graph integration tests, and Entra/session tests with test doubles

**Target Platform**: Node.js server with browser-accessible, server-rendered HTML. Hosting and deployment are outside this feature.

**Project Type**: Server-rendered web application in the existing `apps/fullswing-cms` workspace project

**Performance Goals**: No latency or throughput SLO is specified. OneDrive enumeration must follow all Graph continuation links; dashboard filtering and pagination operate on normalized metadata.

**Constraints**: Protect all routes except Login and OAuth callbacks; keep tokens server-side; preserve matched Markdown/JSON and HTML/JSON pairs; never report a partial pair write as successful; require provider compare-and-save for edits; no automatic provider migration; never render or execute stored HTML; local HTML pages are not published by the current static blog generator.

**Scale/Scope**: One Fullswing content collection and one selected provider per deployment. OneDrive is the production provider; local-file and demo providers are development-only. No content-count or concurrent-user target is specified.

**Identity/Storage Access**: Microsoft Entra ID authenticates each administrator; OneDrive operations use that signed-in administrator's delegated permissions. Every allowlisted administrator must have permission to the configured folder; app-only fallback is prohibited.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content Contract Compatibility**: PASS. Keep Markdown and JSON sidecars as a logical blog pair and use shared metadata validation. Introduce a pure JSON parser in `@fullswing/content-model`; retain `loadMetadata()` as the static blog filesystem wrapper.
- **II. Secure Administration by Default**: PASS. Entra authentication, allowlist checks, server-side session/token cache, delegated OneDrive access, CSRF protection on writes and dispatch, a repository-scoped GitHub credential, and secret redaction are cross-cutting gates.
- **III. OneDrive Is the Content Authority**: PASS. OneDrive remains the only production content authority. The local-file provider is restricted to the local development composition and does not change the constitution's production authority statement.
- **IV. Isolated, Testable Integrations**: PASS. Authentication and provider operations are behind typed ports; fake providers and mocked Graph responses cover success, validation, auth, conflict, and provider failure.
- **V. Accessible, Progressive Authoring Experience**: PASS. Core forms and status feedback work without Svelte web components; Markdown preview is sanitized before display and remains keyboard accessible.
- **Implementation Constraints**: PASS. Keep CMS-only code in `apps/fullswing-cms`, and place only behavior genuinely shared with the static blog in root libraries.
- **Development Workflow**: PASS. Planning precedes implementation; add focused tests and run CMS compile/test Nx targets.

**Post-design gate recheck**: PASS. The provider port remains CMS-local, OneDrive remains the production content authority, local files are development-only, every provider/auth integration stays behind testable boundaries, delegated folder access is explicit, and both Markdown preview and HTML source handling have safety boundaries. No constitution amendment or complexity exception is required.

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
│   ├── config/               # Provider/workflow settings and persistence ports
│   ├── content/
│   │   ├── application/      # Dashboard, validation, and authoring use cases
│   │   ├── domain/           # CMS normalized records and errors
│   │   └── storage/          # Port, provider registry, OneDrive and local-file adapters
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

libs/content-model/src/
├── metadata.ts               # Pure metadata parsing plus filesystem wrapper
└── ...                       # Existing shared content-domain types/repository

libs/markdown-renderer/src/
└── ...                       # Extracted shared Marked/Prism rendering behavior
```

**Structure Decision**: Keep request handling, auth, configuration, use cases, and every storage adapter inside the CMS application. Route and application services receive providers through startup composition and never import OneDrive or Graph types. The local-file adapter uses filesystem APIs only behind the provider contract. Put GitHub REST calls behind a CMS-local dispatch port, and keep configured target/secret loading in server-only configuration and secret stores. Extract metadata parsing and Markdown rendering into shared library boundaries because both apps consume those behaviors. `@fullswing/content-model`'s `ContentRepository` remains a normalized in-memory read model, not a persistence adapter.

## Complexity Tracking

No constitution violations are proposed. The new Markdown renderer library is justified by the need for the CMS preview and static publisher to share one rendering implementation; provider adapters remain CMS-local.
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
