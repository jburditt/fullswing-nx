import sanitizeHtml from 'sanitize-html';
import {
  renderMarkdown,
  type MarkdownRenderOptions,
} from '@fullswing/markdown-renderer';

export async function renderSafeMarkdownPreview(
  source: string,
  options: MarkdownRenderOptions = {},
): Promise<string> {
  const rendered = await renderMarkdown(source, options);

  return sanitizeHtml(rendered, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'button'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'rel'],
      button: ['type', 'class', 'data-copy-code'],
      code: ['class'],
      pre: ['class', 'data-language'],
      span: ['class', 'data-line-number'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}