// Turns the raw JetBrains Marketplace and Zenodo responses into the few numbers the home page shows,
// and formats them. No DOM here, so it is unit-tested (tests/unit/stats.test.js) and shared by
// scripts/fetch-stats.js (which writes data/stats.json) and assets/home.js (which shows it).

const toCount = (value) => (Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value)) : null);

// The Marketplace's own "meanRating" is a site-wide starting guess that is shown even when nobody
// has rated the plugin, so the rating here is worked out from the real votes only.
// votes looks like { "5": 2, "4": 1 }: two people gave 5 stars and one gave 4.
export function ratingFromVotes(votes) {
  let count = 0;
  let total = 0;
  for (const [stars, people] of Object.entries(votes ?? {})) {
    const s = Number(stars);
    const n = Number(people);
    if (!(s >= 1 && s <= 5) || !(n > 0)) continue;
    count += n;
    total += s * n;
  }
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null };
}

export function summarisePlugin(plugin, rating, updates) {
  const latest = Array.isArray(updates) ? updates[0] : null;
  const { count, average } = ratingFromVotes(rating?.votes);
  const released = latest?.cdate ? new Date(Number(latest.cdate)) : null;
  return {
    downloads: toCount(plugin?.downloads),
    ratings: count,
    rating: average,
    version: typeof latest?.version === 'string' ? latest.version : null,
    updated: released && !Number.isNaN(released.getTime()) ? released.toISOString().slice(0, 10) : null,
  };
}

// Zenodo's record page shows unique views and downloads (one per visitor per hour), so these match it.
export function summariseRecord(record) {
  const stats = record?.stats ?? {};
  return {
    views: toCount(stats.unique_views ?? stats.views),
    downloads: toCount(stats.unique_downloads ?? stats.downloads),
    published: typeof record?.metadata?.publication_date === 'string' ? record.metadata.publication_date : null,
  };
}

export function formatCount(n) {
  return Number.isFinite(n) ? n.toLocaleString('en-GB') : '';
}

// "1 view", "54 views".
export function countText(n, word) {
  if (!Number.isFinite(n)) return '';
  return `${formatCount(n)} ${n === 1 ? word : word + 's'}`;
}

// "2026-11-03" -> "3 November 2026" (or "Nov 2026" in short form).
export function formatDate(iso, short = false) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const date = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', short
    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Adds up views and downloads across papers, skipping any whose numbers are missing.
export function totals(papers) {
  let views = 0;
  let downloads = 0;
  for (const p of Object.values(papers ?? {})) {
    if (Number.isFinite(p?.views)) views += p.views;
    if (Number.isFinite(p?.downloads)) downloads += p.downloads;
  }
  return { views, downloads };
}
