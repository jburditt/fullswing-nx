# Quickstart: CMS Admin Content Management Validation

## Prerequisites


 Node.js 22.12 or later and npm dependencies installed at the workspace root. The Azure host and deployment workflow use Node 24 LTS.

Run from the workspace root:

```bash
npm exec nx run fullswing-cms:compile
npm exec nx run fullswing-cms:test
node --test scripts/sync-blog-content.test.mjs
```

Expected result: TypeScript compilation succeeds and the native Node test runner reports passing CMS, provider-contract, authentication, mocked-Graph, Blob content/runtime persistence, configuration, GitHub dispatch, local-file provider, page-route, and MCP tests.

## Validation Scenarios

1. **Application composition and access control**: `bootstrap.test.ts` verifies routes are mounted; `auth-routes.test.ts`, `dashboard.test.ts`, `blog-editor.test.ts`, `configuration.test.ts`, and `github-dispatch-route.test.ts` verify protected endpoints and CSRF enforcement.
2. **Provider independence and switching**: `content-storage-provider.test.ts` and `provider-selection.test.ts` exercise the storage contract, invalid-candidate preservation, and non-migrating valid switches using fakes.
3. **OneDrive listing**: `onedrive-list.test.ts` verifies nested folders, continuation links, matched pairs, malformed metadata, orphaned sidecars, and duplicate routes.
4. **OneDrive concurrency and partial writes**: `onedrive-save.test.ts` verifies stale versions, Graph 412 eTag races, successful pair updates, first/second-write failures, compensation, and explicit partial-write errors.
5. **Delegated access and errors**: `onedrive-configuration.test.ts` verifies the signed-in session token-cache reference reaches the OneDrive gateway factory; `onedrive-errors.test.ts` checks authorization, throttling, conflict, and sanitized provider errors.
6. **GitHub dispatch**: `github-workflow-dispatch.test.ts` and `github-dispatch-route.test.ts` verify saved-target-only requests, masked credentials, accepted status/run details, authorization, CSRF, and safe API failures without claiming workflow completion.
7. **Page source handling**: `page-placeholder.test.ts` and `page-listing.test.ts` verify read-only providers expose no edit/save controls and never render stored HTML; `file-content-provider.test.ts` verifies local HTML/metadata save and readback.
8. **Local file storage**: `file-content-provider.test.ts` verifies blog and page sidecar pairs are stored under the configured public directory and metadata year, duplicate blog basenames remain addressable, stale versions are rejected, and changing years moves the pair.
9. **Preview and metadata safety**: `markdown-preview.test.ts`, `blog-editor.test.ts`, and the content-model metadata tests cover sanitizer behavior, valid metadata, invalid dates, duplicate routes, and rejection before writes.
10. **Blob runtime persistence**: `blob-stores.test.ts` verifies configuration round-trips, stale-revision conflicts, encrypted secret round-trips, deletion, tamper rejection, and wrong-key rejection using an in-memory Blob fake.
11. **Blob content provider**: `blob-content-provider.test.ts` verifies blog and page pair round-trips, year-prefixed routing, ETag conflict detection, and rejection of orphaned or malformed pairs. Bootstrap and Entra tests verify the Azure composition can exclude OneDrive and use identity-only scopes.
12. **MCP authentication and tools**: `mcp.test.ts` verifies public protected-resource metadata, Entra scope/tenant/allowlist rejection, authenticated Streamable HTTP initialization, tool discovery, filtered blog search, retrieval, and mandatory bearer authentication on session requests.

## Optional Local File Smoke Test

From the repository root, select the local file composition and start the CMS:

```powershell
$env:CMS_BOOTSTRAP_MODULE = './file-composition.mjs'
npm --workspace=fullswing-cms run start
```

The local composition defaults to `apps/fullswing-blog/public`; the Configuration page can select another existing writable public directory. Blogs are written to `blog/<year>/<basename>.md` and `.json`. Pages are written to `pages/<year>/<basename>.html` and `.json`. The composition's configuration, session, and secret stores are in memory, so provider settings reset when the process restarts. The CMS does not render stored HTML, and the static blog generator does not publish local page pairs.

## Optional Azure Blob Composition Smoke Test

Build the CMS, then run it with `CMS_BOOTSTRAP_MODULE=./blob-composition.mjs`. Configure `CMS_BLOB_CONNECTION_STRING`, optional `CMS_BLOB_CONTAINER_NAME`, `CMS_SECRET_ENCRYPTION_KEY`, `CMS_ENTRA_TENANT_ID`, `CMS_ENTRA_CLIENT_ID`, `CMS_ENTRA_CLIENT_SECRET`, `CMS_ENTRA_REDIRECT_URI`, `CMS_MCP_RESOURCE_URL`, `CMS_ADMIN_OBJECT_IDS`, and `CMS_SESSION_COOKIE_SECRET` in the host environment. `CMS_MCP_RESOURCE_URL` must be the HTTPS public `/mcp` URL; the Azure Bicep template supplies it for App Service. Generate a fresh encryption key with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the key outside the Blob container and back it up securely. Verify the container is private, sign in as an allowlisted administrator, select Azure Blob Storage, and configure the GitHub workflow. Create and edit a blog and an HTML page; confirm the pairs appear under `content/blog/<year>/` and `content/pages/<year>/`, then force a stale edit and confirm it is rejected. Restart the CMS: content, configuration, and credentials remain stored, while the administrator must sign in again because sessions are in memory. Confirm OneDrive is not offered or called. This local smoke test covers CMS persistence; use the First Azure Deployment steps below to verify Blob content is synced into the static build. The composition itself does not provision the App Service or storage account.

## MCP Endpoint Verification

The CMS test target includes `test/integration/mcp.test.ts`. It starts the CMS on a dynamic loopback HTTP port and exercises MCP initialize, tool listing, `search_blogs`, and `get_blog` using an in-memory content provider and fake Entra token verifier. It also verifies that the advertised tools are read-only and that attempted `create_blog`, `save_blog`, and `update_blog` calls are rejected. Run it with the regular test command above; this validates the protocol locally without tenant credentials or Azure access, but does not validate live Entra OAuth or Blob connectivity.

The Azure Blob composition exposes `POST /mcp` and `GET /.well-known/oauth-protected-resource/mcp`. Configure the CMS Entra application with Application ID URI `api://<CMS_ENTRA_CLIENT_ID>`, access token version 2, and delegated scope `mcp.read`; configure the MCP client application in the same tenant to request `api://<CMS_ENTRA_CLIENT_ID>/mcp.read`. The CMS README's [Blog MCP endpoint](../../README.md#blog-mcp-endpoint) section covers the complete registration and hosted endpoint setup. Only allowlisted administrators with a valid bearer token can use it; a CMS browser login cookie is not sufficient. The available tools search all valid Blob blog pairs, including unpublished blogs, and retrieve a blog by its search result ID. They do not expose pages, CMS settings, secrets, or writes. There is no MCP operation or capability to create a blog, save content, or update an existing blog. Creating and editing through `/blogs/new` and `/blogs/:id/edit` are separate browser CMS features and are not available to MCP clients.

The current `.vscode/mcp.json` entry points to `https://localhost:3000/mcp`. The file composition does not mount `/mcp`; local live testing requires the Blob composition and a trusted HTTPS certificate. When `CMS_MCP_ALLOW_ANONYMOUS=true` is set in `.env`, the endpoint accepts unauthenticated local MCP connections directly without prompting for Entra client IDs or OAuth authentication. If anonymous access is disabled, local live testing also requires Entra app registrations and an OAuth client ID. See the CMS README's [local HTTPS testing steps](../../README.md#run-the-mcp-locally-over-https). With the certificate paths configured, `npm --workspace=fullswing-cms run start` serves HTTPS directly on the configured local port. The automated integration test still uses an in-memory source and fake token verifier, so it does not substitute for the live Blob smoke test.

## Azure Deployment

1. Configure GitHub repository variables `AZURE_CLIENT_ID`, `AZURE_CLIENT_OBJECT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `CMS_APP_NAME`, `CMS_ENTRA_CLIENT_ID`, and `CMS_ADMIN_OBJECT_IDS`.
2. Configure GitHub secrets `CMS_ENTRA_CLIENT_SECRET`, `CMS_SECRET_ENCRYPTION_KEY` (base64-encoded random 32-byte key), and `CMS_SESSION_COOKIE_SECRET` (at least 32 random characters).
3. Register `https://<CMS_APP_NAME>.azurewebsites.net/auth/callback` in the CMS Entra application as a web redirect URI. Use a separate CMS Entra app from the GitHub deployment principal.
4. Grant the GitHub deployment principal permission to create `rg-fullswing-cms` and `rg-fullswing-content`, and assign `Storage Blob Data Reader` on the private container. The existing `rg-fullswing-blog` remains independent.
5. Run `.github/workflows/deploy-cms.yml` manually. On the first run, enable `seed_initial_content` to copy `apps/fullswing-blog/public/blog/` into an empty `content/blog/` prefix. Later runs do not overwrite or reseed content.
6. Set up the CMS through its Configuration page, then deploy the static blog. Its workflow syncs Blob blogs into `apps/fullswing-blog/public/blog/` before the existing static build. The sync removes stale local files and fails closed if Blob returns an empty or incomplete set.

The deployment workflow intentionally has no CMS/content destroy action. Blob is persistent; App Service F1 is limited and may cold-start or restart. Blob's advertised 5 GB allowance is free for the first 12 months only for eligible new Azure accounts; review current pricing before and after that period.

## Optional OneDrive Adapter Smoke Test

Only for a non-Azure composition that registers OneDrive: configure a test tenant and folder outside source control, sign in as an allowlisted administrator, edit one test Markdown/metadata pair, and verify save/readback and stale-edit rejection. Remove test content manually after validation; provider switching never performs migration or cleanup.

## First Azure Deployment

Follow the GitHub repository variables/secrets and Entra callback setup in the [CMS README](../../README.md#first-azure-deployment). Ensure the Azure federated principal can deploy the App Service in `rg-fullswing-cms`, storage in `rg-fullswing-content`, and assign the container-scoped `Storage Blob Data Reader` role. Run **Deploy Fullswing CMS to Azure App Service** manually with `seed_initial_content` enabled for the initial migration; later deployments must leave it disabled. The workflow has no destroy action; both app groups remain separate from persistent content.

After the CMS smoke test passes, run the static-blog deployment. It discovers the storage account in `rg-fullswing-content`, downloads Blob blog pairs before the existing build, and fails closed when the Blob prefix is empty or incomplete. The blog deployment's existing `down` action affects only `rg-fullswing-blog`.

See [the storage contract](contracts/content-storage-provider.md), [the admin UI contract](contracts/admin-ui.md), and [the GitHub dispatch contract](contracts/github-workflow-dispatch.md) for integration and route behavior.