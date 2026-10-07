Fullswing CMS

The CMS is a server-rendered Node.js application for managing Fullswing Markdown blogs and HTML page source. It provides Entra sign-in, an administrator dashboard, Markdown editing and sanitized preview, Blob content storage for the Azure composition, optional OneDrive storage for other compositions, configuration management, and a GitHub Actions dispatch action. Local-file storage supports development. The CMS does not render or execute stored HTML.

## Workspace Commands

Run from the repository root with Node.js 22.12 or later (Node 24 LTS is used for Azure deployment):

```bash
npm exec nx run fullswing-cms:compile
npm exec nx run fullswing-cms:test
```

The tests use fakes and mocked Graph/GitHub clients; no tenant credentials or network access are needed.

## Application Composition

`createCmsApp()` and `startCms()` are exported from `src/bootstrap.ts`. A composition supplies implementations of `ConfigurationStore`, `SecretStore`, and `SessionStore`, an Entra `IdentityProvider`, an immutable-ID administrator allowlist, and a `ContentProviderRegistry`. OneDrive registration can be disabled per composition.

`blob-composition.mjs` is the Azure composition. It registers Blob Storage as its only content provider and stores content under `content/blog/<year>/` and `content/pages/<year>/` in a private container. The same container stores CMS configuration and AES-256-GCM-encrypted `SecretStore` values. The encryption key and Entra application credentials come from host environment settings, so the secret backend can later be replaced without changing CMS application services. This composition requests Entra identity scopes only, not Graph file permissions. Sessions remain in memory and are lost when the process restarts; administrators will need to sign in again. Before each static build, the blog workflow syncs Blob blog pairs into `apps/fullswing-blog/public/blog/`; the CMS does not render or publish HTML page pairs. The host must provide HTTPS and restrict Blob access to the CMS.

For local development, `memory-composition.mjs` uses a hard-coded `Local Developer` identity, a seeded in-memory demo content provider, and in-memory configuration, secret, and session stores. Run `npm --workspace=fullswing-cms run start` from the workspace root with `CMS_BOOTSTRAP_MODULE=./memory-composition.mjs`, then open `http://localhost:3000/dashboard`. The dashboard includes sample blog drafts and a sample page; edits are lost when the process restarts. This bypass is only for local testing; OneDrive still requires Entra authentication, and the local composition refuses to start when `NODE_ENV=production`.

To save content into the blog workspace, start the CMS with the file composition selected. In PowerShell, from the repository root:

```powershell
$env:CMS_BOOTSTRAP_MODULE = './file-composition.mjs'
npm --workspace=fullswing-cms run start
```

The initial website public directory is `apps/fullswing-blog/public` and can be changed on the Configuration page. Blogs are stored as Markdown/JSON pairs in `blog/<year>/`; HTML pages are stored as HTML/JSON pairs in `pages/<year>/`, with the year taken from the metadata date. The CMS can edit those HTML pages, but the current blog generator does not discover or publish HTML page pairs from `public/pages/`. Configuration, sessions, and secrets in this local composition remain in memory and reset when the process restarts.

To use the Azure Blob composition, set `CMS_BOOTSTRAP_MODULE=./blob-composition.mjs` and configure these host settings:

- `CMS_BLOB_CONNECTION_STRING` and optionally `CMS_BLOB_CONTAINER_NAME` (defaults to `fullswing-cms-state`). The composition creates the container as private if it does not exist.
- `CMS_SECRET_ENCRYPTION_KEY`: base64-encoded 32-byte key. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`; keep a protected backup because losing or rotating this key without re-encrypting the blobs makes saved secrets unreadable.
- `CMS_ENTRA_TENANT_ID`, `CMS_ENTRA_CLIENT_ID`, `CMS_ENTRA_CLIENT_SECRET`, and `CMS_ENTRA_REDIRECT_URI`.
- `CMS_ADMIN_OBJECT_IDS`: comma-separated immutable Entra object IDs in the configured tenant.
- `CMS_SESSION_COOKIE_SECRET`: random secret of at least 32 characters.

The Configuration page is persisted in Blob Storage. GitHub credentials and the delegated MSAL token cache are encrypted before storage. Sessions are deliberately not persisted. The App Service host runs the compiled CMS with Node 24 LTS and provides HTTPS. Infrastructure is defined in `infra/content-storage.bicep` and `infra/cms-host.bicep`; `.github/workflows/deploy-cms.yml` provisions and deploys these resources without a destroy path. Startup fails if required settings are missing or invalid.

### First Azure Deployment

Configure these GitHub repository variables before manually running **Deploy Fullswing CMS to Azure App Service**:

- `AZURE_CLIENT_ID`, `AZURE_CLIENT_OBJECT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for the GitHub Actions federated principal.
- `CMS_APP_NAME`, a globally unique App Service name.
- `CMS_ENTRA_CLIENT_ID` and `CMS_ADMIN_OBJECT_IDS` for a separate Entra web-app registration and the allowlisted administrators.

Configure these GitHub repository secrets:

- `CMS_ENTRA_CLIENT_SECRET` for the CMS Entra app.
- `CMS_SECRET_ENCRYPTION_KEY`, a base64-encoded random 32-byte key.
- `CMS_SESSION_COOKIE_SECRET`, a random string of at least 32 characters.

Register `https://<CMS_APP_NAME>.azurewebsites.net/auth/callback` as a Web redirect URI in the CMS Entra application. The GitHub deployment principal needs permission to create `rg-fullswing-cms` and `rg-fullswing-content`, deploy App Service and Storage resources, and create a scoped Blob data role assignment. Use an owner or delegate role-assignment permission before running the workflow.

On the first workflow run, set `seed_initial_content` to `true` to copy the repository's current blog pairs into an empty `content/blog/` Blob prefix. It refuses to overwrite a non-empty prefix. After that, CMS edits in Blob become authoritative. The Static Web App workflow reads that prefix with its federated identity and stages the files into `apps/fullswing-blog/public/blog/` before building.

After the first CMS deployment, sign in and save the content-provider and GitHub workflow settings on `/configuration` before using the dashboard. Until a provider configuration has been saved, visiting `/dashboard` redirects to that setup form.

The CMS host uses `rg-fullswing-cms`; persistent Blob content uses `rg-fullswing-content`; the static site remains in `rg-fullswing-blog`. Neither deployment workflow deletes `rg-fullswing-content`. The host uses App Service Linux F1, which has strict CPU and bandwidth quotas, no custom domain or SLA, and may cold-start or restart. The Blob free allowance is only for the first 12 months for eligible new Azure accounts; storage and transaction charges may apply afterward.

## Required Settings

- Entra: tenant ID, application/client ID, client secret, redirect URI, and an allowlist keyed by immutable tenant and object IDs. The Azure Blob composition requests `openid`, `profile`, and `email` only. A composition that enables OneDrive additionally requests delegated Microsoft Graph `Files.ReadWrite` access.
- Azure Blob: the Azure composition uses the configured private container for content, runtime configuration, and encrypted secrets. Blog/page pairs use `content/blog/<year>/` and `content/pages/<year>/`.
- OneDrive (optional): a drive ID and root folder ID accessible to every allowlisted administrator. Each request uses that administrator's delegated Graph token; there is no app-only fallback.
- Configuration and secrets: a durable `ConfigurationStore` for non-secret provider/workflow settings and a server-side `SecretStore` for Entra cache data and GitHub credentials. Secret reads must never be returned to routes or page views.
- GitHub: owner, repository, workflow file or ID, ref, and bounded non-secret input values. Store a fine-grained credential in the `SecretStore`, scoped to the selected repository with Actions write permission. The workflow must support `workflow_dispatch`.
- Session security: a high-entropy cookie signing secret of at least 32 characters, secure cookies behind HTTPS, and an administrator session store with expiry.

The Configuration page displays saved non-secret values and only whether the GitHub credential exists. A replacement token is accepted on save; its value is never read back. Workflow dispatch uses only the saved target and reports acceptance, not workflow or deployment completion.

## Routes

- `/login` and `/auth/callback`: Microsoft Entra sign-in.
- `/dashboard`: searchable and paginated blog/page summaries.
- `/blogs/new` and `/blogs/:id/edit`: Markdown draft validation, preview, and save.
- `/pages` and `/pages/:id`: page summaries; file-backed storage supports HTML and metadata editing, while other providers may remain read-only. Stored HTML is not rendered or executed in the CMS.
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

Content storage:
- Azure deployments use Blob Storage for blogs, HTML pages, configuration, and encrypted secrets
- OneDrive is an optional content provider for compositions that register it

Technology:
- TypeScript, Node, optional Svelte web components, Azure Blob Storage, optional OneDrive integration, Entra OAuth
- Azure entra id for authentication
- Bicep for infra deploy resources
- Github action for CI/CD

Plan:
Analyze fullswing-blog/src/lib folder and verify what code should be moved to shared libs/ folder in root folder

TODO
- check fullswing-blog and fullswing-cms for code redundancy and candidates for moving to shared lib folder