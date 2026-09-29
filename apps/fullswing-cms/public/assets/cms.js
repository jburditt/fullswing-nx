const form = document.getElementById('blog-editor-form');
const markdown = document.getElementById('blog-markdown');
const preview = document.querySelector('[data-markdown-preview]');

if (form && preview) {
  const title = form.querySelector('[data-preview-title]');
  const author = form.querySelector('[data-preview-author]');
  const date = form.querySelector('[data-preview-date]');
  const categories = form.querySelector('[data-preview-categories]');
  let previewTimer;
  let requestNumber = 0;

  const syncText = (inputSelector, previewNode, fallback, transform = value => value) => {
    const input = form.querySelector(inputSelector);
    if (!input || !previewNode) return;
    const update = () => {
      previewNode.textContent = transform(input.value.trim()) || fallback;
    };
    input.addEventListener('input', update);
    update();
  };

  syncText('[data-preview-title-input]', title, 'Untitled story');
  syncText('[data-preview-author-input]', author, 'Author');
  syncText('[data-preview-date-input]', date, '', value => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });
  syncText('[data-preview-categories-input]', categories, 'Draft', value => value.split(',').map(item => item.trim()).filter(Boolean).join(' · '));

  if (markdown) {
    markdown.addEventListener('input', () => {
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(async () => {
        const currentRequest = ++requestNumber;
        preview.setAttribute('aria-busy', 'true');
        const body = new URLSearchParams({
          _csrf: form.querySelector('[name="_csrf"]')?.value ?? '',
          markdown: markdown.value,
        });
        try {
          const response = await fetch('/blogs/preview', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
          });
          if (!response.ok) throw new Error('Preview unavailable');
          const result = await response.json();
          if (currentRequest === requestNumber && typeof result.html === 'string') {
            preview.innerHTML = result.html;
          }
        } catch {
          if (currentRequest === requestNumber) {
            preview.textContent = 'Live preview is unavailable. Use Preview to validate this draft.';
          }
        } finally {
          if (currentRequest === requestNumber) preview.removeAttribute('aria-busy');
        }
      }, 220);
    });

    form.querySelectorAll('[data-markdown-action]').forEach(button => {
      button.addEventListener('click', () => {
        const start = markdown.selectionStart;
        const end = markdown.selectionEnd;
        const selected = markdown.value.slice(start, end);
        const action = button.getAttribute('data-markdown-action');
        let before = '';
        let after = '';

        if (action === 'bold') {
          before = '**';
          after = '**';
        } else if (action === 'italic') {
          before = '*';
          after = '*';
        } else if (action === 'heading') {
          const lineStart = markdown.value.lastIndexOf('\n', start - 1) + 1;
          markdown.setRangeText('## ', lineStart, lineStart, 'end');
          markdown.dispatchEvent(new Event('input', { bubbles: true }));
          markdown.focus();
          return;
        } else if (action === 'list') {
          const lineStart = markdown.value.lastIndexOf('\n', start - 1) + 1;
          markdown.setRangeText('- ', lineStart, lineStart, 'end');
          markdown.dispatchEvent(new Event('input', { bubbles: true }));
          markdown.focus();
          return;
        } else if (action === 'link') {
          const url = window.prompt('Link URL');
          if (!url) return;
          before = '[';
          after = `](${url})`;
        } else {
          return;
        }

        markdown.setRangeText(`${before}${selected || 'text'}${after}`, start, end, 'select');
        markdown.dispatchEvent(new Event('input', { bubbles: true }));
        markdown.focus();
      });
    });
  }
}
