import { PROJECT_GROUPS } from './projects.js';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

const container = document.getElementById('project-list');
container.replaceChildren();

for (const group of PROJECT_GROUPS) {
  container.append(el('h2', { class: 'section-label' }, group.heading));
  const list = el('ul', { class: 'entry-list' });
  for (const item of group.items) {
    const link = el('a', { class: 'entry-title', href: item.url, target: '_blank', rel: 'noopener' }, item.title);
    const heading = el('div', {}, link);
    if (item.label) heading.append(el('span', { class: 'tag' }, item.label));
    list.append(el('li', {},
      heading,
      el('p', {}, item.description),
      el('p', { class: 'entry-meta' }, item.type ?? group.type),
    ));
  }
  container.append(list);
  if (group.note) container.append(el('p', { class: 'small muted' }, group.note));
}
