import { createHash } from 'node:crypto';
import { escapeHtml } from './html.js';

export interface MermaidPrerenderer {
  render(source: string): Promise<string>;
  close(): Promise<void>;
}

export type MermaidTheme = 'default' | 'dark';

type MermaidSvgRenderer = (source: string, svgId: string, theme: MermaidTheme) => Promise<{ svg: string; title: string | null; desc: string | null }>;

export function wrapDiagram(svg: string, label: string | null): string {
  const labelAttribute = label ? ` aria-label="${escapeHtml(label)}"` : '';
  return `<figure class="mermaid-diagram" role="img"${labelAttribute}>${svg}</figure>`;
}

/**
 * Renders each diagram once, in the given theme. Caches by source hash and gives every diagram a
 * unique SVG id so inlined styles do not collide. When site dark mode ships, pass the active theme.
 */
export function createMermaidPrerenderer(
  renderSvg: MermaidSvgRenderer,
  onClose: () => Promise<void> = async () => {},
  theme: MermaidTheme = 'default',
): MermaidPrerenderer {
  const cache = new Map<string, Promise<string>>();

  return {
    render(source) {
      const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
      let result = cache.get(hash);
      if (!result) {
        result = renderSvg(source, `mermaid-${hash}`, theme)
          .then(({ svg, title }) => wrapDiagram(svg, title))
          .catch(error => {
            throw new Error(`Unable to prerender Mermaid diagram: ${error instanceof Error ? error.message : String(error)}\n${source}`);
          });
        cache.set(hash, result);
      }
      return result;
    },
    close: onClose,
  };
}

export async function launchMermaidPrerenderer(theme: MermaidTheme = 'default'): Promise<MermaidPrerenderer> {
  const [{ renderMermaid }, puppeteer] = await Promise.all([
    import('@mermaid-js/mermaid-cli'),
    import('puppeteer'),
  ]);
  const browser = await puppeteer.default.launch({
    headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  const decoder = new TextDecoder();

  return createMermaidPrerenderer(async (source, svgId, theme) => {
    const { data, title, desc } = await renderMermaid(browser, source, 'svg', {
      svgId,
      backgroundColor: 'transparent',
      mermaidConfig: { securityLevel: 'strict', theme, htmlLabels: false, flowchart: { htmlLabels: false } },
    });
    return { svg: decoder.decode(data), title, desc };
  }, () => browser.close(), theme);
}
