// Fills in the real figures on the home page.
// - Penguin Forms: from data/stats.json, written by scripts/fetch-stats.js. JetBrains Marketplace
//   doesn't let other websites read its figures from the browser, so they are fetched in advance.
// - Papers: shown from the same file straight away, then replaced with live figures from Zenodo,
//   which does allow it.
// Anything that can't be read simply stays hidden; nothing is made up.
import { countText, formatCount, formatDate, summariseRecord, totals } from './stats.js';

const ICONS = {
  views: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3C4.4 3 1.7 5.6 1 8c.7 2.4 3.4 5 7 5s6.3-2.6 7-5c-.7-2.4-3.4-5-7-5Zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>',
  downloads: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2v7.6l2.8-2.8 1.4 1.4L8 12.4 2.8 7.2l1.4-1.4L7 8.6V1ZM2 13h12v2H2v-2Z"/></svg>',
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1.2 2.1 4.4 4.8.6-3.5 3.3.9 4.8L8 12l-4.3 2.3.9-4.8-3.5-3.3 4.8-.6Z"/></svg>',
};

function stat(kind, n, word) {
  const span = document.createElement('span');
  span.className = `stat stat-${kind}`;
  span.innerHTML = ICONS[kind];
  span.append(countText(n, word));
  return span;
}

function showPlugin(plugin) {
  if (!plugin || !Number.isFinite(plugin.downloads)) return;
  document.getElementById('plugin-downloads').textContent = formatCount(plugin.downloads);

  const rating = document.getElementById('plugin-rating');
  if (plugin.ratings > 0 && Number.isFinite(plugin.rating)) {
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.setAttribute('aria-hidden', 'true');
    const filled = Math.round(plugin.rating);
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = i <= filled ? 'star on' : 'star';
      star.innerHTML = ICONS.star;
      stars.append(star);
    }
    rating.replaceChildren(stars, ` ${plugin.rating.toFixed(1)} from ${countText(plugin.ratings, 'rating')}`);
  } else {
    rating.textContent = 'No ratings yet';
  }

  const version = document.getElementById('plugin-version');
  version.textContent = plugin.version ?? '';
  version.parentElement.hidden = !plugin.version;
  document.getElementById('plugin-stats').hidden = false;
}

function showPapers(papers) {
  if (!papers) return;
  let shown = 0;
  for (const card of document.querySelectorAll('[data-zenodo]')) {
    const paper = papers[card.dataset.zenodo];
    const box = card.querySelector('.paper-stats');
    if (!paper || !box || !Number.isFinite(paper.views)) continue;
    box.replaceChildren(stat('views', paper.views, 'view'), stat('downloads', paper.downloads, 'download'));
    shown++;
  }
  if (!shown) return;
  const sum = totals(papers);
  const count = document.querySelectorAll('[data-zenodo]').length;
  const summary = document.getElementById('research-totals');
  summary.textContent = `${countText(count, 'preprint')} · ${countText(sum.views, 'view')} · ${countText(sum.downloads, 'download')}`;
  summary.hidden = false;
}

async function getJson(url, options) {
  try {
    const response = await fetch(url, options);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function liveZenodo(papers) {
  const ids = [...document.querySelectorAll('[data-zenodo]')].map((card) => card.dataset.zenodo);
  const records = await Promise.all(ids.map((id) => getJson(`https://zenodo.org/api/records/${id}`)));
  let changed = false;
  records.forEach((record, i) => {
    const paper = record && summariseRecord(record);
    if (paper && Number.isFinite(paper.views)) {
      papers[ids[i]] = paper;
      changed = true;
    }
  });
  return changed;
}

async function load() {
  const data = (await getJson('data/stats.json', { cache: 'no-cache' })) ?? {};
  const papers = { ...(data.papers ?? {}) };
  showPlugin(data.plugin);
  showPapers(papers);
  const when = formatDate(data.updated ?? '');
  if (when) {
    const note = document.getElementById('stats-updated');
    note.textContent = `Plugin figures from JetBrains Marketplace, updated ${when}. Paper figures from Zenodo.`;
    note.hidden = false;
  }
  if (await liveZenodo(papers)) showPapers(papers);
}

load();
