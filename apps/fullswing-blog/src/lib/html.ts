const HTML_ESCAPE_LOOKUP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => HTML_ESCAPE_LOOKUP[character]);
}

export interface CategoryColor {
  background: string;
  text: string;
}

// Soft badge palette matched to each category's brand color where one exists.
const CATEGORY_COLOR_MAP: Record<string, CategoryColor> = {
  Angular: { background: '#fdecee', text: '#b3261e' },
  Azure: { background: '#e8f1fc', text: '#0f62b3' },
  GitHub: { background: '#f1f2f4', text: '#24292f' },
  TypeScript: { background: '#e8edfb', text: '#2f4a9e' },
  JavaScript: { background: '#fff8e1', text: '#8a6d00' },
  CSharp: { background: '#f1ecfc', text: '#5b3ec8' },
  Bicep: { background: '#e6f7f5', text: '#0f7a6a' },
  Document: { background: '#eef1f5', text: '#475569' },
  Philosophy: { background: '#f5eef0', text: '#8a4b57' },
};

function hashCategory(category: string): number {
  let hash = 0;
  for (let index = 0; index < category.length; index += 1) {
    hash = (hash << 5) - hash + category.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % 360;
}

export function getCategoryColors(category: string): CategoryColor {
  const mapped = CATEGORY_COLOR_MAP[category];
  if (mapped) {
    return mapped;
  }

  const hue = hashCategory(category);
  return {
    background: `hsl(${hue}, 45%, 94%)`,
    text: `hsl(${hue}, 55%, 30%)`,
  };
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
