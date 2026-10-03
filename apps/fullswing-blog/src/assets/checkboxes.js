const key = `checkboxes:${location.pathname}`;
const boxes = [...document.querySelectorAll('.page-content input[type="checkbox"]')];

function load() {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? [];
  } catch {
    return [];
  }
}

const saved = new Set(load());
boxes.forEach((box, index) => {
  if (saved.has(index)) box.checked = true;
});

document.querySelector('.page-content').addEventListener('change', event => {
  if (!boxes.includes(event.target)) return;
  const checked = boxes.flatMap((box, index) => (box.checked ? [index] : []));
  try {
    localStorage.setItem(key, JSON.stringify(checked));
  } catch {}
});
