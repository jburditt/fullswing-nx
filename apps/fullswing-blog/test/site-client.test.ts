import test from 'node:test';
import assert from 'node:assert/strict';

class FakeButton {
  hidden = false;
  textContent = 'Copy';
  dataset: Record<string, string> = {};
  private readonly attributes = new Map<string, string>();
  private clickHandler?: () => Promise<void> | void;
  private preElement?: FakePreElement;

  constructor(category: string, pressed: boolean) {
    this.attributes.set('data-category-toggle', category);
    this.attributes.set('aria-pressed', String(pressed));
  }

  addEventListener(_eventName: string, handler: () => void): void {
    this.clickHandler = handler;
  }

  click(): Promise<void> | void {
    return this.clickHandler?.();
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  setPreElement(preElement: FakePreElement): void {
    this.preElement = preElement;
  }

  closest(selector: string): FakePreElement | null {
    return selector === 'pre' ? this.preElement ?? null : null;
  }
}

class FakeItem {
  hidden = false;
  private readonly attributes = new Map<string, string>();

  constructor(categories: string) {
    this.attributes.set('data-categories', categories);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeCodeLine {
  constructor(readonly textContent: string) {}
}

class FakePreElement {
  constructor(private readonly lines: FakeCodeLine[]) {}

  querySelectorAll(selector: string): FakeCodeLine[] {
    return selector === '.code-line' ? this.lines : [];
  }
}

class FakeStatus {
  textContent = '';
}

class FakeDocument {
  constructor(
    private readonly buttons: FakeButton[],
    private readonly items: FakeItem[],
    private readonly status?: FakeStatus,
  ) {}

  querySelectorAll(selector: string): Array<FakeButton | FakeItem> {
    if (selector === '[data-category-toggle]') {
      return this.buttons;
    }
    if (selector === '[data-categories]') {
      return this.items;
    }
    if (selector === '[data-copy-code]') {
      return this.buttons;
    }
    return [];
  }

  getElementById(identifier: string): FakeStatus | null {
    return identifier === 'copy-status' ? this.status ?? null : null;
  }
}

class FakeWindow {
  private callback?: () => void;

  clearTimeout(): void {
    this.callback = undefined;
  }

  setTimeout(handler: () => void): number {
    this.callback = handler;
    return 1;
  }

  flush(): void {
    this.callback?.();
    this.callback = undefined;
  }
}

test('setupCategoryFilters should toggle pressed state and hide non-matching items', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupCategoryFilters } = await import(moduleUrl);

  const angularButton = new FakeButton('angular', true);
  const javascriptButton = new FakeButton('javascript', true);
  const angularItem = new FakeItem('angular typescript');
  const javascriptItem = new FakeItem('javascript');
  const document = new FakeDocument([angularButton, javascriptButton], [angularItem, javascriptItem]);

  setupCategoryFilters(document);
  javascriptButton.click();

  assert.equal(javascriptButton.getAttribute('aria-pressed'), 'false');
  assert.equal(angularItem.hidden, false);
  assert.equal(javascriptItem.hidden, true);
});

test('setupCategoryFilters should keep at least one category active', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupCategoryFilters } = await import(moduleUrl);

  const angularButton = new FakeButton('angular', true);
  const angularItem = new FakeItem('angular');
  const document = new FakeDocument([angularButton], [angularItem]);

  setupCategoryFilters(document);
  angularButton.click();

  assert.equal(angularButton.getAttribute('aria-pressed'), 'true');
  assert.equal(angularItem.hidden, false);
});

test('setupCopyButtons should announce successful copy actions', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupCopyButtons } = await import(moduleUrl);

  const button = new FakeButton('typescript', true);
  const preElement = new FakePreElement([new FakeCodeLine('const title = 1;')]);
  const status = new FakeStatus();
  const runtimeWindow = new FakeWindow();
  button.setPreElement(preElement);

  let copiedText = '';
  const clipboard = {
    async writeText(value: string) {
      copiedText = value;
    },
  };

  setupCopyButtons(new FakeDocument([button], [], status), clipboard, runtimeWindow);
  await button.click();

  assert.equal(copiedText, 'const title = 1;');
  assert.equal(button.textContent, 'Copied');
  assert.equal(status.textContent, 'Code copied to clipboard.');
  runtimeWindow.flush();
  assert.equal(button.textContent, 'Copy');
  assert.equal(status.textContent, '');
});

test('setupCopyButtons should announce copy failures', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupCopyButtons } = await import(moduleUrl);

  const button = new FakeButton('typescript', true);
  const preElement = new FakePreElement([new FakeCodeLine('const title = 1;')]);
  const status = new FakeStatus();
  const runtimeWindow = new FakeWindow();
  button.setPreElement(preElement);

  const clipboard = {
    async writeText() {
      throw new Error('clipboard unavailable');
    },
  };

  setupCopyButtons(new FakeDocument([button], [], status), clipboard, runtimeWindow);
  await button.click();

  assert.equal(button.textContent, 'Copy failed');
  assert.equal(status.textContent, 'Unable to copy code to the clipboard.');
  assert.equal(button.dataset.copied, 'false');
  runtimeWindow.flush();
  assert.equal(button.textContent, 'Copy');
  assert.equal(status.textContent, '');
});

test('setupMermaidExtensionPoint should expose a hook and auto-run Mermaid when available', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupMermaidExtensionPoint } = await import(moduleUrl);

  const mermaidBlock = { textContent: 'graph TD;' };
  let enhancedNodes: unknown;
  let runNodes: unknown;
  const fakeWindow = {
    mermaid: {
      run({ nodes }: { nodes: unknown }) {
        runNodes = nodes;
      },
    },
    typescriptBlog: undefined as
      | undefined
      | { enhanceMermaid?: (enhancer: (nodes: unknown) => void) => void },
  };
  const document = {
    querySelectorAll(selector: string) {
      return selector === 'pre.mermaid' ? [mermaidBlock] : [];
    },
  };

  setupMermaidExtensionPoint(document, fakeWindow);
  fakeWindow.typescriptBlog?.enhanceMermaid?.(nodes => {
    enhancedNodes = nodes;
  });

  assert.deepEqual(runNodes, [mermaidBlock]);
  assert.deepEqual(enhancedNodes, [mermaidBlock]);
});

test('setupMermaidExtensionPoint should support a late asynchronous host enhancer', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupMermaidExtensionPoint } = await import(moduleUrl);

  const mermaidBlock = { textContent: 'graph TD;' };
  const fakeWindow = { typescriptBlog: undefined as
    | undefined
    | { enhanceMermaid?: (enhancer: (nodes: unknown[]) => Promise<void>) => Promise<void> } };
  const document = {
    querySelectorAll(selector: string) {
      return selector === 'pre.mermaid' ? [mermaidBlock] : [];
    },
  };

  setupMermaidExtensionPoint(document, fakeWindow);
  await fakeWindow.typescriptBlog?.enhanceMermaid?.(async nodes => {
    await Promise.resolve();
    (nodes[0] as { textContent: string }).textContent = '<svg />';
  });

  assert.equal(mermaidBlock.textContent, '<svg />');
});

test('setupMermaidExtensionPoint should isolate failed Mermaid blocks and preserve fallback source', async () => {
  const moduleUrl = new URL('../../src/assets/site.js', import.meta.url).href;
  const { setupMermaidExtensionPoint } = await import(moduleUrl);

  const successfulBlock = { textContent: 'graph TD; success' };
  const failedBlock = { textContent: 'graph TD; failure' };
  let attempts = 0;
  const fakeWindow = {
    mermaid: {
      async run({ nodes }: { nodes: unknown[] }) {
        attempts += 1;
        if (nodes.length > 1) {
          throw new Error('one malformed diagram');
        }

        const block = nodes[0] as { textContent: string };
        if (block === failedBlock) {
          throw new Error('malformed diagram');
        }

        block.textContent = '<svg />';
      },
    },
    typescriptBlog: undefined as undefined,
  };
  const document = {
    querySelectorAll(selector: string) {
      return selector === 'pre.mermaid' ? [successfulBlock, failedBlock] : [];
    },
  };

  setupMermaidExtensionPoint(document, fakeWindow);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(successfulBlock.textContent, '<svg />');
  assert.equal(failedBlock.textContent, 'graph TD; failure');
  assert.equal(attempts, 3);
});
