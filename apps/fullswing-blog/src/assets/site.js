export function updateCategoryVisibility(buttons, items) {
  const active = new Set(
    buttons
      .filter(button => button.getAttribute('aria-pressed') !== 'false')
      .map(button => button.getAttribute('data-category-toggle'))
      .filter(Boolean)
  );

  items.forEach(item => {
    const categories = (item.getAttribute('data-categories') ?? '').split(/\s+/).filter(Boolean);
    const isVisible = categories.length === 0 || categories.some(category => active.has(category));
    item.hidden = !isVisible;
  });
}

export function setupCategoryFilters(doc = document) {
  const buttons = [...doc.querySelectorAll('[data-category-toggle]')];
  const items = [...doc.querySelectorAll('[data-categories]')];

  if (buttons.length === 0 || items.length === 0) {
    return;
  }

  const update = () => {
    updateCategoryVisibility(buttons, items);
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const isPressed = button.getAttribute('aria-pressed') !== 'false';
      const activeButtonCount = buttons.filter(entry => entry.getAttribute('aria-pressed') !== 'false').length;
      if (isPressed && activeButtonCount === 1) {
        return;
      }
      button.setAttribute('aria-pressed', String(!isPressed));
      update();
    });
  });

  update();
}

const resetTimers = new WeakMap();

function scheduleReset(button, status, runtimeWindow) {
  const existingTimer = resetTimers.get(button);
  if (existingTimer) {
    runtimeWindow.clearTimeout(existingTimer);
  }

  const timer = runtimeWindow.setTimeout(() => {
    button.dataset.copied = 'false';
    button.textContent = 'Copy';
    if (status) {
      status.textContent = '';
    }
    resetTimers.delete(button);
  }, 1500);

  resetTimers.set(button, timer);
}

export function setupCopyButtons(
  doc = document,
  clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
  runtimeWindow = window
) {
  const status = doc.getElementById('copy-status');

  doc.querySelectorAll('[data-copy-code]').forEach(button => {
    button.addEventListener('click', async () => {
      const container = button.closest('pre');
      const lines = container?.querySelectorAll('.code-line');
      const text = [...(lines ?? [])].map(line => line.textContent ?? '').join('\n');

      if (!text) {
        return;
      }

      if (!clipboard?.writeText) {
        button.dataset.copied = 'false';
        button.textContent = 'Copy unavailable';
        if (status) {
          status.textContent = 'Clipboard access is unavailable in this browser.';
        }
        scheduleReset(button, status, runtimeWindow);
        return;
      }

      try {
        await clipboard.writeText(text);
        button.dataset.copied = 'true';
        button.textContent = 'Copied';
        if (status) {
          status.textContent = 'Code copied to clipboard.';
        }
        scheduleReset(button, status, runtimeWindow);
      } catch (error) {
        button.dataset.copied = 'false';
        button.textContent = 'Copy failed';
        if (status) {
          status.textContent = 'Unable to copy code to the clipboard.';
        }
        scheduleReset(button, status, runtimeWindow);
        return;
      }
    });
  });
}

export function setupMermaidExtensionPoint(doc = document, win = window) {
  const mermaidBlocks = [...doc.querySelectorAll('pre.mermaid')];
  if (mermaidBlocks.length === 0) {
    return;
  }

  const enhanceMermaidBlocks = async enhancer => {
    const sources = mermaidBlocks.map(block => block.textContent);

    try {
      await enhancer(mermaidBlocks);
      return;
    } catch (error) {
      mermaidBlocks.forEach((block, index) => {
        block.textContent = sources[index];
      });
    }

    await Promise.all(mermaidBlocks.map(async (block, index) => {
      try {
        await enhancer([block]);
      } catch (error) {
        block.textContent = sources[index];
      }
    }));
  };

  const runtime = win.typescriptBlog ?? {};
  runtime.enhanceMermaid = enhancer => {
    if (typeof enhancer === 'function') {
      return enhanceMermaidBlocks(enhancer);
    }
  };
  win.typescriptBlog = runtime;

  if (win.mermaid?.run) {
    void enhanceMermaidBlocks(nodes => win.mermaid.run({ nodes }));
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  setupCategoryFilters();
  setupCopyButtons();
  setupMermaidExtensionPoint();
}
