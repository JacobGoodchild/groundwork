import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratingFromVotes, summarisePlugin, summariseRecord, countText, formatDate, totals } from '../../assets/stats.js';

test('a plugin nobody has rated has no rating, whatever the Marketplace average says', () => {
  const plugin = summarisePlugin({ downloads: 2 }, { votes: {}, meanVotes: 2, meanRating: 4.06553 }, [{ version: '0.1.0', cdate: '1794389595000' }]);
  assert.deepEqual(plugin, { downloads: 2, ratings: 0, rating: null, version: '0.1.0', updated: '2026-11-11' });
});

test('the rating is the average of the real votes', () => {
  assert.deepEqual(ratingFromVotes({ 5: 2, 4: 1 }), { count: 3, average: 4.7 });
  assert.deepEqual(ratingFromVotes({ 3: 1 }), { count: 1, average: 3 });
  assert.deepEqual(ratingFromVotes({ 9: 4, 0: 2, 5: 0 }), { count: 0, average: null });
  assert.deepEqual(ratingFromVotes(undefined), { count: 0, average: null });
});

test('missing plugin data gives empty values rather than made-up ones', () => {
  assert.deepEqual(summarisePlugin({}, null, []), { downloads: null, ratings: 0, rating: null, version: null, updated: null });
});

test('Zenodo records give the unique views and downloads, as Zenodo shows them', () => {
  const record = {
    stats: { downloads: 13, unique_downloads: 12, views: 75, unique_views: 66 },
    metadata: { publication_date: '2026-10-04' },
  };
  assert.deepEqual(summariseRecord(record), { views: 66, downloads: 12, published: '2026-10-04' });
  assert.deepEqual(summariseRecord({ stats: { views: 5, downloads: 1 } }), { views: 5, downloads: 1, published: null });
  assert.deepEqual(summariseRecord({}), { views: null, downloads: null, published: null });
});

test('counts and dates are written out in British English', () => {
  assert.equal(countText(1, 'view'), '1 view');
  assert.equal(countText(1234, 'download'), '1,234 downloads');
  assert.equal(countText(0, 'rating'), '0 ratings');
  assert.equal(countText(null, 'view'), '');
  assert.equal(formatDate('2026-11-03T19:22:46.145Z'), '3 November 2026');
  assert.equal(formatDate('2026-11-03', true), 'Nov 2026');
  assert.equal(formatDate('soon'), '');
});

test('totals add up the papers that have figures', () => {
  assert.deepEqual(totals({ a: { views: 10, downloads: 2 }, b: { views: 5, downloads: 1 }, c: { views: null } }), { views: 15, downloads: 3 });
  assert.deepEqual(totals(undefined), { views: 0, downloads: 0 });
});
