# Fullswing Workspace

An npm workspaces + Nx monorepo containing:

- `apps/fullswing-blog` — a standalone Node.js + TypeScript static-site generator (no Angular CLI dependency).
- `apps/fullswing-cms` — a CMS skeleton for managing enhanced markdown/HTML/Svelte pages with OneDrive integration (scaffold only so far).
- `libs/content-model` — shared `@fullswing/content-model` content metadata types and validation, consumed by both apps.

## Install

From the repository root:

```bash
npm install
```

## Build

```bash
npm --workspace=fullswing-blog run build
```

The build compiles the generator to `apps/fullswing-blog/.build/`, discovers content, validates metadata, copies non-content assets, and writes static HTML into `apps/fullswing-blog/dist/`.

## Verify in CI

```bash
npm --workspace=fullswing-blog run verify
```

`verify` runs the focused test suite and then performs a full static build. Prefer `nx run fullswing-blog:verify` / `nx run-many -t compile,test,build` so Nx caching applies.

## Local preview

```bash
npm --workspace=fullswing-blog run preview
```

Opening `dist/index.html` directly via `file://` shows a raw directory listing for friendly URLs like `/blog/<id>/`, because browsers don't resolve `index.html` for directories without a server. `preview` builds the site and serves `dist/` over HTTP on `http://localhost:5173/` (override with the `PORT` env var), resolving friendly URLs to their `index.html` without redirecting. Use `npm --workspace=fullswing-blog run serve` to serve an existing `dist/` without rebuilding.

Run `npm --workspace=fullswing-blog run start` to build and serve the site while watching `src/` and `public/`. After each successful rebuild, open preview tabs refresh automatically at `http://localhost:5173/` (override with the `PORT` env var).

## Azure deployment

The `azd` project (`azure.yaml`, service `web`) deploys only `apps/fullswing-blog` and is pinned to the Azure resource group `rg-fullswing-blog`.

- `azd up` reuses that resource group when it already exists and creates it first when it does not.
- `azd down` tears down the application resources and then deletes `rg-fullswing-blog`.
- `.github/workflows/deploy.yml` applies the same lifecycle non-interactively for CI deploy and destroy runs.

## Output structure

```text
dist/
  index.html
  sitemap/index.html
  blog/<id>/index.html
  page/<name>/index.html
  assets/site.css
  assets/site.js
```

## Content authoring

### Markdown blog posts

Place Markdown and metadata sidecars in a year folder beneath `public/blog/`:

```text
public/blog/2025/my-post.md
public/blog/2025/my-post.json
```

Metadata must include:

- `route` — must match `/blog/<basename>` regardless of the source year folder
- `title`
- `categories`
- `author`
- `date` — ISO format `YYYY-MM-DD`

The build recursively discovers year folders and fails fast if a Markdown file or metadata file is missing its same-basename partner.

### Page renderers

Place renderers and metadata sidecars in `src/pages/`:

```text
src/pages/my-page.ts
src/pages/my-page.json
```

Each renderer must export:

```ts
export const renderPage = (context) => '<p>HTML</p>';
```

The sidecar JSON must use route `/page/<basename>`.

## Features

- Automatic discovery of blog posts and page renderers
- In-memory repository API with `getBlog`, `getPage`, `getBlogs`, `getPages`, `getAll`, and `getCategories`
- GFM Markdown rendering
- Prism-based syntax highlighting
- Server-rendered line numbers and line highlighting for fenced code blocks using info-string directives such as `line=2-4 lineOffset=10`
- Remote source code blocks using `source=https://raw.githubusercontent.com/...` fence directives; use version-specific URLs when reproducible output matters
- Minimal client-side category filtering and copy-to-clipboard behavior
- Header social navigation uses accessible GitHub and LinkedIn SVG icons with lighter resting fills and darker hover/focus states
- Mermaid diagrams: Pages containing Mermaid blocks load the pinned Mermaid CDN runtime and initialize it with restrictive defaults. Blocks render from escaped `<pre class="mermaid">...</pre>` source, while `assets/site.js` auto-runs `window.mermaid.run({ nodes })` or exposes `window.typescriptBlog.enhanceMermaid(enhancer)` for a host that loads Mermaid later. Enhancement failures leave the source readable and are isolated per block.

## Limitations

- Mermaid is loaded from a pinned CDN URL rather than bundled into the generator. If the runtime is unavailable, the generated HTML remains readable source. Hosts control any alternate loading, configuration, security policy, and CSP. Authors should add Mermaid `accTitle` and `accDescr` entries when a diagram conveys important information.
- Syntax highlighting supports the Prism languages imported in `apps/fullswing-blog/src/lib/markdown.ts`. Additional languages can be added there if needed.
- Remote code sources are retrieved during the build from approved HTTPS hosts, rendered into the static page, and exposed with a source link. Unavailable, unsafe, non-text, or oversized sources fail the build rather than producing an incomplete block.

## Azure Deployments

- To destroy the Azure resources run `azd down --force --purge`
- To provision the Azure resources run `azd provision`

## Spec-Kit

### Shorter path — for smaller features:

- `/speckit-specify`
- `/speckit-plan`
- `/speckit-tasks`
- `/speckit-implement`
- `/speckit-converge`

### Full path — for production features, adding /speckit-clarify, /speckit-checklist, and /speckit-analyze as quality gates:

- `/speckit-constitution` (once per project)
- `/speckit-specify`
- `/speckit-clarify`
- `/speckit-plan`
- `/speckit-checklist`
- `/speckit-tasks`
- `/speckit-analyze`
- `/speckit-implement`
- `/speckit-converge`

## To-Do

- Determine if assets should be copied to dist but instead should be pre-rendered static html e.g. assets.js should not be needed and markdowns should be pre-rendered to html
- Implement pages e.g. angular-blog.html and azure-static-app.html OR use the existing pageRenderers
- Handle cases where blog filenames are the same in different year folders
- Remove route from blog.json files
- Add spec-kit
- Add unit and Playwright tests with Axe
- Add best practices instructions and documentation
- Add TypeScript skills
- Add AI category and tag relevant blogs
- Deploy to Azure static web app, preferably using Terraform or similar
- Add the ability to link/preview OneDrive files
- Consider moving the markdown and html files to OneDrive, which would require syncing folders
- Remove category "Bicep" and replace with Azure
- Make the cateogory pills collapsible, add a Filter icon right aligned on the same row as "Latest Content"
- Dark theme, match system theme?
- OneDrive CMS
- Templating and theming
- File and database support for content
- Trigger Github action run by API
- OAuth for CMS
- Github action syncs OneDrive folder for content
- Create npm package for rendering enhanced markdowns
- Update angular-blog readme and reference this repository
- Add blog comments
- Run AI performance check, verify everything is static html, minimize typescript, and cache/bundle

## Roadmap

- fullswing-blog: render sitemap, and blog posts
- fullswing-blog-file: load blogs from file
- fullswing-blog-db: load blogs from database
- fullswing-cms: manage enhanced markdown, html, and typescript pages; trigger Github action run. OAuth, static
- fullswing-cms-template
- fullswing-blog-template