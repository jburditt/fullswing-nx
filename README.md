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
  assets/category-filters.js   (home/sitemap only)
  assets/copy-code.js          (pages with code blocks only)
  assets/theme-toggle.js       (every page)
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
- Light/dark theme toggle (header, after the LinkedIn icon): defaults to light, saved in `localStorage`, applied before first paint via a small inline script, and styled with CSS variables under `:root[data-theme="dark"]`
- Collapsible sections (accordions): write native `<details class="accordion-item">` with a `<summary>` in Markdown (add `open` to start expanded). They are styled with a right-aligned plus/minus indicator and a theme-accent vertical line on hover/focus; no JavaScript is needed
- Mermaid diagrams: ```mermaid fences are prerendered at build time to a single inline SVG (`<figure class="mermaid-diagram">`) in the light Mermaid theme using headless Chromium via `@mermaid-js/mermaid-cli`; under the dark site theme the figure is shown on a light panel. `launchMermaidPrerenderer` accepts a theme for future per-build theming. The deployed site ships no Mermaid runtime or JavaScript for diagrams, and an invalid diagram fails the build.
- Optional build optimization: set `BLOG_OPTIMIZE=1` to minify HTML plus the site's own CSS/JS and write `.br`/`.gz` copies; it is off locally and enabled in `.github/workflows/deploy-blog.yml`. For example, in PowerShell: `$env:BLOG_OPTIMIZE='1'; npm run build`. The preview server serves the pre-compressed files when present

## Limitations

- Building articles with Mermaid diagrams requires a Chromium install for Puppeteer (`npx puppeteer browsers install chrome`; on CI `--no-sandbox` is used when `CI` is set). Authors should add Mermaid `accTitle` and `accDescr` entries when a diagram conveys important information.
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

## Set Encryption Key for Github Token stored on Storage instead of Secret Vault
- Run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` to generate the secret
- Run `gh secret set CMS_SECRET_ENCRYPTION_KEY` to set the secret in Github
- Save the secret in your password manager

## To-Do

- Root route should redirect to dashboard
- Redirect all pages to configuration if no provider found? Or wizard
- Deploy CMS to Azure App Service and Blob Storage using Bicep
- Add image e.g. screenshot
- Trigger Github action run by API
- OAuth for CMS
- Cleanup CMS UI and update spec docs
- Update angular-blog readme and reference this repository
- Add blocks with header e.g. https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli
```
> \[!NOTE]
> If you have `ignore-scripts=true` in your `~/.npmrc` file, you must use the command:
>
> ```shell copy
> npm_config_ignore_scripts=false npm install -g @github/copilot
> ```
```
- Check if I should consolidate javascript files or leave separate depending on blog use

# Future Roadmap

- Implement pages e.g. angular-blog.html and azure-static-app.html OR use the existing pageRenderers
- Add unit and Playwright tests with Axe
- Add best practices instructions and documentation
- Add TypeScript AI skills
- Add the ability to link/preview OneDrive files with file extension icon
- Consider moving the markdown and html files to OneDrive, which would require syncing folders
- Make the cateogory pills collapsible, add a Filter icon right aligned on the same row as "Latest Content"
- The current theme should match OS system setting
- OneDrive CMS
- Templating and theming
- File and database support for content
- Github action syncs OneDrive folder for content (currently syncs blob storage)
- Create npm package for rendering enhanced markdowns, move towards framework, so other devs can build their own blog
- Add blog comments (require auth?)
- Run AI performance check, verify everything is static html, minimize typescript, and cache/bundle

## Roadmap Architecture

- fullswing-blog: render sitemap, and blog posts
- fullswing-blog-file: load blogs from file
- fullswing-blog-db: load blogs from database
- fullswing-blog-onedrive: load blogs from onedrive
- fullswing-cms: manage enhanced markdown, html, and typescript pages; trigger Github action run. OAuth, static
- fullswing-cms-template
- fullswing-blog-template

# Image Creation

- Copy an [Gemini API key](https://aistudio.google.com/api-keys)
- 