import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { BlogContent } from '../content/domain/content-entry.js';
import { filterContentEntries } from '../content/application/list-content.js';

export interface BlogSearchSource {
  listBlogs(): Promise<BlogContent[]>;
  readBlog(id: string): Promise<BlogContent | undefined>;
}

export interface McpBlogServer {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
}

const searchInput = {
  query: z.string().trim().min(1).max(160).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  author: z.string().trim().min(1).max(100).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(50).optional(),
};

function hasSearchCriteria(input: {
  query?: string;
  title?: string;
  category?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
}): boolean {
  return Boolean(
    input.query || input.title || input.category || input.author || input.dateFrom || input.dateTo,
  );
}

function searchableText(blog: BlogContent): string {
  return [
    blog.metadata.title,
    blog.metadata.author,
    blog.metadata.categories.join(' '),
    blog.metadata.date,
    blog.markdown,
  ].join('\n').toLocaleLowerCase('en-US');
}

function isRealDate(value: string | undefined): boolean {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function excerpt(markdown: string, query: string | undefined): string {
  const normalized = markdown.replace(/\s+/g, ' ').trim();
  if (!query) return normalized.slice(0, 280);

  const index = normalized.toLocaleLowerCase('en-US').indexOf(query.toLocaleLowerCase('en-US'));
  if (index < 0) return normalized.slice(0, 280);
  const start = Math.max(0, index - 100);
  return `${start > 0 ? '…' : ''}${normalized.slice(start, start + 280)}${start + 280 < normalized.length ? '…' : ''}`;
}

function metadataForTool(blog: BlogContent): object {
  return {
    title: blog.metadata.title,
    author: blog.metadata.author,
    date: blog.metadata.date,
    categories: blog.metadata.categories,
  };
}

export function createMcpBlogServer(
  source: BlogSearchSource,
  onSessionInitialized: (sessionId: string) => void,
  onSessionClosed: (sessionId: string) => void,
): McpBlogServer {
  const server = new McpServer(
    { name: 'fullswing-blog', version: '1.0.0' },
    { maxToolInputElements: 20 },
  );

  server.registerTool('search_blogs', {
    title: 'Search Fullswing blogs',
    description: 'Search blog Markdown and metadata by keyword, title, category, author, or date range.',
    inputSchema: searchInput,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async input => {
    if (!hasSearchCriteria(input)) {
      throw new Error('Provide at least one keyword or filter.');
    }
    if (!isRealDate(input.dateFrom) || !isRealDate(input.dateTo)) {
      throw new Error('dateFrom and dateTo must be real calendar dates in YYYY-MM-DD format.');
    }
    if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) {
      throw new Error('dateTo must not be earlier than dateFrom.');
    }

    const blogs = await source.listBlogs();
    const filtered = filterContentEntries(blogs, {
      kind: 'blog',
      title: input.title,
      category: input.category,
      author: input.author,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    }).filter((entry): entry is BlogContent => 'markdown' in entry);
    const terms = input.query?.toLocaleLowerCase('en-US').split(/\s+/).filter(Boolean) ?? [];
    const matches = filtered.filter(blog => {
      const text = searchableText(blog);
      return terms.every(term => text.includes(term));
    });
    const limit = input.limit ?? 10;
    const results = matches.slice(0, limit).map(blog => ({
      id: blog.id,
      route: blog.route,
      metadata: metadataForTool(blog),
      excerpt: excerpt(blog.markdown, input.query),
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ total: matches.length, results }) }],
    };
  });

  server.registerTool('get_blog', {
    title: 'Retrieve a Fullswing blog',
    description: 'Retrieve a blog post by the opaque id returned by search_blogs.',
    inputSchema: { id: z.string().trim().min(1).max(200) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ id }) => {
    const blog = await source.readBlog(id);
    if (!blog) throw new Error('The requested blog was not found.');
    if (blog.markdown.length > 300_000) {
      throw new Error('The blog exceeds the MCP response size limit and cannot be returned in one response.');
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: blog.id,
          route: blog.route,
          metadata: metadataForTool(blog),
          markdown: blog.markdown,
        }),
      }],
    };
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: onSessionInitialized,
    onsessionclosed: onSessionClosed,
    enableJsonResponse: true,
    maxRequestBodySize: 64 * 1024,
  });

  return { server, transport };
}
