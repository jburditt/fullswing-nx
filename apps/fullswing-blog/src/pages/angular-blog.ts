import type { PageRenderFunction } from '../lib/types.js';

export const renderPage: PageRenderFunction = ({ metadata, escapeHtml }) => `
  <p>This page demonstrates the renderer convention for richer content that is not authored in Markdown.</p>
  <p>The sidecar metadata file controls the route, heading metadata, and sitemap discovery for <strong>${escapeHtml(metadata.title)}</strong>.</p>
  <section>
    <h2>Renderer contract</h2>
    <ul>
      <li>Place a <code>.ts</code> renderer and same-basename <code>.json</code> metadata file in <code>src/pages</code>.</li>
      <li>Export <code>renderPage(context)</code> and return an HTML string.</li>
      <li>Use the provided <code>escapeHtml</code> helper for dynamic values.</li>
    </ul>
  </section>
  <section>
    <h2>Example snippet</h2>
    <pre class="code-block"><code><span class="code-line">export const renderPage = ({ metadata }) =&gt; \`&lt;h2&gt;\${escapeHtml(metadata.title)}&lt;/h2&gt;\`;</span></code></pre>
  </section>
`;
