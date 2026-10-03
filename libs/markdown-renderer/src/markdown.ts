import Prism from 'prismjs';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-csharp.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-bash.js';
import { Marked, Tokens } from 'marked';
import { escapeHtml } from './html.js';

const DEFAULT_ALLOWED_HOSTS = new Set(['raw.githubusercontent.com']);
const DEFAULT_MAX_SOURCE_BYTES = 1_000_000;
const DEFAULT_SOURCE_TIMEOUT_MS = 10_000;

export interface MarkdownRenderOptions {
  fetchImpl?: typeof fetch;
  sourceCache?: Map<string, Promise<string>>;
  allowedSourceHosts?: ReadonlySet<string>;
  maxSourceBytes?: number;
  sourceTimeoutMs?: number;
  articleRoute?: string;
  /** Prerenders a Mermaid diagram to static HTML (e.g. inline SVG). When omitted, source is emitted for client rendering. */
  renderMermaid?: (source: string) => Promise<string>;
}

interface CodeFenceOptions {
  language: string;
  lineNumbers: boolean;
  lineOffset: number;
  highlightedLines: Set<number>;
  sourceUrl?: string;
}

export class RemoteSourceError extends Error {
  constructor(readonly sourceUrl: string, reason: string, articleRoute?: string) {
    const articleContext = articleRoute ? ` while rendering ${articleRoute}` : '';
    super(`Unable to load remote code source ${sourceUrl}${articleContext}: ${reason}`);
    this.name = 'RemoteSourceError';
  }
}

function parseHighlightedLines(value: string): Set<number> {
  const result = new Set<number>();

  for (const segment of value.split(',')) {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) {
      continue;
    }

    const [rawStart, rawEnd] = trimmedSegment.split('-');
    const start = Number.parseInt(rawStart, 10);
    const end = rawEnd ? Number.parseInt(rawEnd, 10) : start;

    if (Number.isNaN(start) || Number.isNaN(end) || start <= 0 || end < start) {
      continue;
    }

    for (let current = start; current <= end; current += 1) {
      result.add(current);
    }
  }

  return result;
}

function parseCodeFenceInfo(rawInfo: string | undefined): CodeFenceOptions {
  const tokens = (rawInfo ?? '').split(/\s+/).filter(Boolean);
  const [language = '', ...directives] = tokens;

  let lineNumbers = true;
  let lineOffset = 1;
  let highlightedLines = new Set<number>();
  let sourceUrl: string | undefined;

  for (const directive of directives) {
    if (directive === 'lineNumbers') {
      lineNumbers = true;
      continue;
    }

    const separatorIndex = directive.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = directive.slice(0, separatorIndex);
    const value = directive.slice(separatorIndex + 1);
    if (!value) {
      continue;
    }

    if (key === 'line') {
      highlightedLines = parseHighlightedLines(value);
      lineNumbers = true;
    } else if (key === 'lineOffset') {
      const parsedOffset = Number.parseInt(value, 10);
      if (!Number.isNaN(parsedOffset) && parsedOffset > 0) {
        lineOffset = parsedOffset;
        lineNumbers = true;
      }
    } else if (key === 'source') {
      sourceUrl = value;
    }
  }

  return {
    language,
    lineNumbers,
    lineOffset,
    highlightedLines,
    sourceUrl,
  };
}

function highlightCode(code: string, language: string): string {
  const prismLanguage = Prism.languages[language];
  if (!prismLanguage) {
    return escapeHtml(code);
  }

  return Prism.highlight(code, prismLanguage, language);
}

function validateSourceUrl(sourceUrl: string, allowedHosts: ReadonlySet<string>): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new RemoteSourceError(sourceUrl, 'the URL is malformed');
  }

  if (parsedUrl.protocol !== 'https:' || !allowedHosts.has(parsedUrl.hostname)) {
    throw new RemoteSourceError(sourceUrl, 'the protocol or host is not approved');
  }

  return parsedUrl;
}

async function readResponseText(response: Response, sourceUrl: string, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw new RemoteSourceError(sourceUrl, `the response exceeds the ${maxBytes}-byte limit`);
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new RemoteSourceError(sourceUrl, `the response exceeds the ${maxBytes}-byte limit`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new RemoteSourceError(sourceUrl, `the response exceeds the ${maxBytes}-byte limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(bytes);
}

async function fetchRemoteSource(
  sourceUrl: string,
  options: Required<Pick<MarkdownRenderOptions, 'allowedSourceHosts' | 'maxSourceBytes' | 'sourceTimeoutMs'>> & {
    fetchImpl: typeof fetch;
    articleRoute?: string;
  },
): Promise<string> {
  validateSourceUrl(sourceUrl, options.allowedSourceHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.sourceTimeoutMs);

  try {
    const response = await options.fetchImpl(sourceUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new RemoteSourceError(sourceUrl, `the server returned HTTP ${response.status}`, options.articleRoute);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType || (!contentType.startsWith('text/') && !contentType.includes('json') && !contentType.includes('javascript'))) {
      throw new RemoteSourceError(sourceUrl, `the response content type ${contentType || '(missing)'} is not text`, options.articleRoute);
    }

    return await readResponseText(response, sourceUrl, options.maxSourceBytes);
  } catch (error) {
    if (error instanceof RemoteSourceError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RemoteSourceError(sourceUrl, `the request timed out after ${options.sourceTimeoutMs}ms`, options.articleRoute);
    }
    throw new RemoteSourceError(sourceUrl, error instanceof Error ? error.message : 'the request failed', options.articleRoute);
  } finally {
    clearTimeout(timeout);
  }
}

function getSourceText(
  sourceUrl: string,
  options: MarkdownRenderOptions,
  sourceCache: Map<string, Promise<string>>,
): Promise<string> {
  const existing = sourceCache.get(sourceUrl);
  if (existing) {
    return existing;
  }

  const allowedSourceHosts = options.allowedSourceHosts ?? DEFAULT_ALLOWED_HOSTS;
  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const sourceTimeoutMs = options.sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  const articleRoute = options.articleRoute;
  validateSourceUrl(sourceUrl, allowedSourceHosts);
  const request = fetchRemoteSource(sourceUrl, {
    allowedSourceHosts,
    maxSourceBytes,
    sourceTimeoutMs,
    fetchImpl: options.fetchImpl ?? fetch,
    articleRoute,
  }).catch(error => {
    if (error instanceof RemoteSourceError) {
      throw error;
    }
    throw new RemoteSourceError(sourceUrl, error instanceof Error ? error.message : 'the request failed', articleRoute);
  });
  sourceCache.set(sourceUrl, request);
  return request;
}

function renderCodeBlock(code: string, rawInfo: string | undefined): string {
  const fenceOptions = parseCodeFenceInfo(rawInfo);
  const sourceCode = code;

  if (fenceOptions.language === 'mermaid') {
    return `<pre class="mermaid">${escapeHtml(sourceCode.trimEnd())}</pre>`;
  }

  const normalizedCode = sourceCode.replace(/\r\n/g, '\n').replace(/\n$/, '');
  const highlighted = highlightCode(normalizedCode, fenceOptions.language);
  const lines = highlighted.split('\n');
  const codeLines = lines.map((line, index) => {
    const lineNumber = fenceOptions.lineOffset + index;
    const attributes = [`class="code-line${fenceOptions.highlightedLines.has(index + 1) ? ' is-highlighted' : ''}"`];
    if (fenceOptions.lineNumbers) {
      attributes.push(`data-line-number="${lineNumber}"`);
    }

    return `<span ${attributes.join(' ')}>${line || ' '}</span>`;
  }).join('');

  const languageClass = fenceOptions.language ? ` language-${escapeHtml(fenceOptions.language)}` : '';
  const preClass = fenceOptions.lineNumbers ? 'code-block has-line-numbers' : 'code-block';
  const attribution = fenceOptions.sourceUrl
    ? `<a class="code-source" href="${escapeHtml(fenceOptions.sourceUrl)}" rel="noreferrer">Source</a>`
    : '';

  return [
    `<pre class="${preClass}" data-language="${escapeHtml(fenceOptions.language || 'plain-text')}">`,
    '<button type="button" class="copy-code" data-copy-code aria-label="Copy code" title="Copy">',
    '<svg class="copy-code__icon" aria-hidden="true" focusable="false" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">',
    '<path d="M0 6.75C0 5.784.784 5 1.75 5h8.5C11.216 5 12 5.784 12 6.75v10.5A1.75 1.75 0 0 1 10.25 19h-8.5A1.75 1.75 0 0 1 0 17.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V6.75a.25.25 0 0 0-.25-.25Z"></path>',
    '<path d="M5 3.25A1.75 1.75 0 0 1 6.75 1.5h8.5A1.75 1.75 0 0 1 17 3.25v10.5a1.75 1.75 0 0 1-1.75 1.75h-.5a.75.75 0 0 1 0-1.5h.5a.25.25 0 0 0 .25-.25V3.25a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25v.5a.75.75 0 0 1-1.5 0Z"></path>',
    '</svg>',
    '<span class="copy-code__label" aria-hidden="true">Copied!</span>',
    '</button>',
    attribution,
    `<code class="${languageClass.trim()}">`,
    codeLines,
    '</code>',
    '</pre>',
  ].join('');
}

export async function renderMarkdown(source: string, options: MarkdownRenderOptions = {}): Promise<string> {
  const sourceCache = options.sourceCache ?? new Map<string, Promise<string>>();
  const marked = new Marked({
    gfm: true,
  });

  const prerenderedDiagrams = new WeakMap<object, string>();

  marked.use({
    async: true,
    walkTokens: async token => {
      if (token.type === 'code') {
        if (options.renderMermaid && parseCodeFenceInfo(token.lang).language === 'mermaid') {
          prerenderedDiagrams.set(token, await options.renderMermaid(token.text.trimEnd()));
          return;
        }
        const sourceUrl = parseCodeFenceInfo(token.lang).sourceUrl;
        if (sourceUrl) {
          token.text = await getSourceText(sourceUrl, options, sourceCache);
        }
      }
    },
    renderer: {
      checkbox({ checked }: Tokens.Checkbox): string {
        return `<input type="checkbox"${checked ? ' checked' : ''}>`;
      },
      code(token: Tokens.Code): string {
        const diagram = prerenderedDiagrams.get(token);
        if (diagram !== undefined) {
          return diagram;
        }
        return renderCodeBlock(token.text, token.lang);
      },
    },
  });

  return await marked.parse(source, { async: true }) as string;
}