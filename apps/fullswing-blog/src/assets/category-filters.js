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

if (typeof document !== 'undefined') {
  setupCategoryFilters();
}
