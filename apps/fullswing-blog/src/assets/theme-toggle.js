const root = document.documentElement;
const toggle = document.querySelector('[data-theme-toggle]');

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (toggle) {
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

toggle?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
});
