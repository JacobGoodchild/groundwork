// Fetches the real numbers shown on the home page and writes them to data/stats.json:
// Penguin Forms' downloads, ratings and version from JetBrains Marketplace, and each preprint's
// views and downloads from Zenodo. Run it before pushing to refresh the figures. The page also
// fetches the Zenodo figures live in the browser; JetBrains Marketplace doesn't allow that, so the
// plugin's figures are only as fresh as the last run of this script.
//
//   node scripts/fetch-stats.js
//
// The papers are found from the data-zenodo attributes in index.html, so adding a paper there is
// enough. If a request fails, the last good figure for that item is kept and the script still
// succeeds, so a slow API never stops the site being published.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { summarisePlugin, summariseRecord } from '../assets/stats.js';

const root = new URL('..', import.meta.url);
const out = new URL('data/stats.json', root);
const PLUGIN_ID = 35992;

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'groundwork-site-stats' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

async function readOld() {
  try {
    return JSON.parse(await readFile(out, 'utf8'));
  } catch {
    return {};
  }
}

const html = await readFile(new URL('index.html', root), 'utf8');
const paperIds = [...new Set([...html.matchAll(/data-zenodo="(\d+)"/g)].map((m) => m[1]))];
const old = await readOld();
const result = { updated: new Date().toISOString(), plugin: old.plugin ?? null, papers: {} };
let failures = 0;

try {
  const base = `https://plugins.jetbrains.com/api/plugins/${PLUGIN_ID}`;
  const [plugin, rating, updates] = await Promise.all([
    getJson(base), getJson(`${base}/rating`), getJson(`${base}/updates?size=1`),
  ]);
  result.plugin = summarisePlugin(plugin, rating, updates);
} catch (error) {
  failures++;
  console.warn(`Penguin Forms: kept the previous figures (${error.message})`);
}

for (const id of paperIds) {
  try {
    result.papers[id] = summariseRecord(await getJson(`https://zenodo.org/api/records/${id}`));
  } catch (error) {
    failures++;
    if (old.papers?.[id]) result.papers[id] = old.papers[id];
    console.warn(`Zenodo record ${id}: kept the previous figures (${error.message})`);
  }
}

await mkdir(new URL('data/', root), { recursive: true });
await writeFile(out, JSON.stringify(result, null, 2) + '\n');
console.log(`Wrote ${fileURLToPath(out)}: plugin ${JSON.stringify(result.plugin)}, ${paperIds.length} papers, ${failures} failed.`);
