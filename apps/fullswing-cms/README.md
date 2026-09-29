Fullswing CMS

The CMS is a server-rendered Node.js application for managing Fullswing Markdown blogs and discovering HTML pages. It provides Entra sign-in, an administrator dashboard, Markdown editing and sanitized preview, OneDrive-backed content storage, configuration management, and a GitHub Actions dispatch action. HTML page authoring and rendering are intentionally unavailable.

## Workspace Commands

Run from the repository root with Node.js 20.19 or later:

```bash
npm exec nx run fullswing-cms:compile
npm exec nx run fullswing-cms:test
```

The tests use fakes and mocked Graph/GitHub clients; no tenant credentials or network access are needed.

## Application Composition

`createCmsApp()` and `startCms()` are exported from `src/bootstrap.ts`. The deployment host supplies implementations of `ConfigurationStore`, `SecretStore`, and `SessionStore`, an Entra `IdentityProvider`, an immutable-ID administrator allowlist, and a `ContentProviderRegistry`. The bootstrap registers OneDrive when the registry does not already contain it, mounts the protected routes, and obtains delegated Graph access from each authenticated session.

There is no built-in production persistence adapter or deployment-specific Entra composition in this package. The host is responsible for durable, access-controlled configuration and secret storage, session lifecycle, network policy, HTTPS termination, and provisioning the CMS settings. Do not use the test fakes as production stores.

For local development, `composition.mjs` uses a hard-coded `Local Developer` identity, a seeded in-memory demo content provider, and in-memory configuration, secret, and session stores. Run `npm --workspace=fullswing-cms run start` from the workspace root, then open `http://localhost:3000/dashboard`. The dashboard includes sample blog drafts and a sample page; edits are lost when the process restarts. This bypass is only for local testing; OneDrive still requires Entra authentication, and the local composition refuses to start when `NODE_ENV=production`. This composition is not suitable for production: configuration, content, sessions, and token caches are lost on restart and are not shared across instances.

For deployment, provide a separate `CMS_BOOTSTRAP_MODULE` ESM module exporting `createCmsDependencies()` and use durable, access-controlled adapters as described above. Startup fails with a generic message if the composition is missing or invalid; adapter errors and credential values are not printed.

## Required Settings

- Entra: tenant ID, application/client ID, client secret, redirect URI, and an allowlist keyed by immutable tenant and object IDs. The application requests delegated Microsoft Graph `Files.ReadWrite` access.
- OneDrive: a drive ID and root folder ID accessible to every allowlisted administrator. Each request uses that administrator's delegated Graph token; there is no app-only fallback.
- Configuration and secrets: a durable `ConfigurationStore` for non-secret provider/workflow settings and a server-side `SecretStore` for Entra cache data and GitHub credentials. Secret reads must never be returned to routes or page views.
- GitHub: owner, repository, workflow file or ID, ref, and bounded non-secret input values. Store a fine-grained credential in the `SecretStore`, scoped to the selected repository with Actions write permission. The workflow must support `workflow_dispatch`.
- Session security: a high-entropy cookie signing secret of at least 32 characters, secure cookies behind HTTPS, and an administrator session store with expiry.

The Configuration page displays saved non-secret values and only whether the GitHub credential exists. A replacement token is accepted on save; its value is never read back. Workflow dispatch uses only the saved target and reports acceptance, not workflow or deployment completion.

## Routes

- `/login` and `/auth/callback`: Microsoft Entra sign-in.
- `/dashboard`: searchable and paginated blog/page summaries.
- `/blogs/new` and `/blogs/:id/edit`: Markdown draft validation, preview, and save.
- `/pages` and `/pages/:id`: page summaries and a read-only authoring placeholder; stored HTML is not rendered or executed.
- `/configuration`: provider and GitHub workflow settings.
- `POST /github/dispatch`: CSRF-protected dispatch of the saved workflow target.

See the feature [quickstart](specs/001-admin-content-management/quickstart.md) and contracts for detailed checks and route behavior.
Add/Edit markdown file - A page with a form to add/edit metadata for the .json sidecar files and a textarea for adding/editing markdown files. The textarea should validate the markdown and have a status bar with green checkbox or red x when validation changes. At the top there is a tab to switch from markdown editing or markdown preview. The preview shows the markdown formatted. There should be a toolbar above the textarea that applies the markdown syntax to the selected text. The toolbar should also have a button to add a file, it uploads to OneDrive with a progress bar to display the upload progress and inserts a link to the file in the textarea cursor position. Ideally, there would be an icon by the file hyperlink that shows the file type e.g. Word icon for .doc and .docx files.
Add/Edit html file - A blank page for now.
Configuration - A page to define the configuration values needed for GitHub action run by API, and the OneDrive integration

Layout:
The layout should include:
- the fullswing logo, same logo used in fullswing-blog
- logout icon link, use a logout icon
- A navigation bar with links for dashboard, add blog/page
- Horizontally centered content that will display the page contents depeneding on the route

Database:
- the database will be a OneDrive folder that contains the blogs and html pages

Technology:
- typescript, Node, svelte web components, OneDrive integration, latest OAuth
- Azure entra id for authentication
- Bicep for infra deploy resources
- Github action for CI/CD

Plan:
Analyze fullswing-blog/src/lib folder and verify what code should be moved to shared libs/ folder in root folder

TODO
- check fullswing-blog and fullswing-cms for code redundancy and candidates for moving to shared lib folder