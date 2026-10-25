import { PROJECT_GROUPS } from './projects.js';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function card(item, group) {
  const link = el('a', { class: 'project-card', href: item.url, target: '_blank', rel: 'noopener' });
  if (item.image) {
    link.classList.add('has-image');
    link.append(el('img', { src: item.image, alt: item.imageAlt ?? '', loading: 'lazy', width: '840', height: '667' }));
  }
  const title = el('span', { class: 'project-title' }, item.title);
  const heading = el('span', { class: 'project-heading' }, title);
  if (item.label) heading.append(el('span', { class: 'tag' }, item.label));
  const body = el('span', { class: 'project-body' }, heading);
  if (item.description) body.append(el('span', { class: 'project-description' }, item.description));
  body.append(
    el('span', { class: 'project-meta' }, item.type ?? group.type),
    el('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
  );
  link.append(body);
  return link;
}

const columns = {
  left: document.getElementById('projects-left'),
  right: document.getElementById('projects-right'),
};
document.getElementById('project-list').querySelector('noscript')?.remove();

for (const group of PROJECT_GROUPS) {
  const section = el('section', { class: 'project-group' });
  section.append(el('h2', { class: 'section-label' }, group.heading));
  const list = el('ul', { class: 'project-cards' });
  for (const item of group.items) list.append(el('li', {}, card(item, group)));
  section.append(list);
  if (group.note) section.append(el('p', { class: 'small muted project-note' }, group.note));
  columns[group.column ?? 'left'].append(section);
}
