import { test, expect } from '@playwright/test';

const reg = (page, n) => page.locator('#registers .cell').nth(n).locator('.cell-value');
const mem = (page, a) => page.locator('#memory .cell').nth(a).locator('.cell-value');
const openSettings = async (page) => {
  if (await page.locator('#settings-menu').isHidden()) await page.click('#settings-toggle');
};

test.describe('home page', () => {
  // Zenodo is reached live from the page; the tests answer for it so they don't depend on the internet.
  test.beforeEach(async ({ page }) => {
    await page.route('https://zenodo.org/**', (route) => route.abort());
  });

  test('shows each area, with areas inside areas, and a menu to jump to them', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle('Groundwork');
    await expect(page.locator('h1')).toHaveText('Groundwork');
    for (const name of ['Featured', 'Research', 'Learning', 'Libraries', 'Games and interactive']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    const learning = page.locator('.area.learning');
    await expect(learning.getByRole('heading', { level: 3, name: 'A-level Computer Science' })).toBeVisible();
    await expect(learning.getByRole('heading', { level: 3, name: 'Machine learning' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Sections' });
    for (const id of ['featured', 'research', 'learning', 'libraries', 'games']) {
      await expect(nav.locator(`a[href="#${id}"]`)).toHaveCount(1);
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.locator('.site-header').getByRole('link', { name: 'See more' })).toHaveCount(0);
  });

  test('lists the papers and projects, external ones opening in a new tab', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.research a.card')).toHaveCount(5);
    await expect(page.locator('.research').getByText('Answers to some recent conjectures')).toBeVisible();
    const external = page.locator('a.card[href^="https://"]');
    await expect(external).toHaveCount(11);
    for (const link of await external.all()) await expect(link).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: /Learn ML/ })).toHaveAttribute('href', 'https://jacobgoodchild.github.io/learn-ml/');
    await expect(page.locator('#penguin-forms-install')).toHaveCount(1);
    await expect(page.getByRole('img', { name: /Apex Ring/ })).toBeVisible();
    await expect(page.locator('.tag', { hasText: 'Early Access – Still Under Construction' })).toHaveCount(1);
  });

  test('shows the real figures from data/stats.json', async ({ page }) => {
    await page.route('**/data/stats.json', (route) => route.fulfill({ json: {
      updated: '2026-11-13T05:00:00Z',
      plugin: { downloads: 1234, ratings: 0, rating: null, version: '0.1.0', updated: '2026-11-11' },
      papers: { 23919117: { views: 38, downloads: 1 }, 23136851: { views: 60, downloads: 27 } },
    } }));
    await page.goto('./');
    await expect(page.locator('#plugin-stats')).toBeVisible();
    await expect(page.locator('#plugin-downloads')).toHaveText('1,234');
    await expect(page.locator('#plugin-rating')).toHaveText('No ratings yet');
    await expect(page.locator('#plugin-version')).toHaveText('0.1.0');
    await expect(page.locator('[data-zenodo="23919117"] .paper-stats')).toHaveText('38 views1 download');
    await expect(page.locator('[data-zenodo="23010606"] .paper-stats')).toBeEmpty();
    await expect(page.locator('#research-totals')).toHaveText('5 preprints · 98 views · 28 downloads');
    await expect(page.locator('#stats-updated')).toContainText('13 November 2026');
  });

  test('live Zenodo figures replace the saved ones', async ({ page }) => {
    await page.unroute('https://zenodo.org/**');
    await page.route('https://zenodo.org/api/records/*', (route) => {
      const id = route.request().url().split('/').pop();
      return id === '23919117'
        ? route.fulfill({ json: { stats: { unique_views: 500, unique_downloads: 40 } }, headers: { 'Access-Control-Allow-Origin': '*' } })
        : route.abort();
    });
    await page.route('**/data/stats.json', (route) => route.fulfill({ json: {
      updated: '2026-11-13T05:00:00Z', plugin: null,
      papers: { 23919117: { views: 38, downloads: 1 }, 23136851: { views: 60, downloads: 27 } },
    } }));
    await page.goto('./');
    await expect(page.locator('[data-zenodo="23919117"] .paper-stats')).toHaveText('500 views40 downloads');
    await expect(page.locator('[data-zenodo="23136851"] .paper-stats')).toHaveText('60 views27 downloads');
    await expect(page.locator('#research-totals')).toHaveText('5 preprints · 560 views · 67 downloads');
    await expect(page.locator('#plugin-stats')).toBeHidden();
  });

  test('a real rating is shown as stars', async ({ page }) => {
    await page.route('**/data/stats.json', (route) => route.fulfill({ json: {
      plugin: { downloads: 10, ratings: 3, rating: 4.7, version: '0.2.0' }, papers: {},
    } }));
    await page.goto('./');
    await expect(page.locator('#plugin-rating')).toHaveText('4.7 from 3 ratings');
    await expect(page.locator('#plugin-rating .star.on')).toHaveCount(5);
    await expect(page.locator('#research-totals')).toBeHidden();
  });

  test('without the figures, nothing made up is shown', async ({ page }) => {
    await page.route('**/data/stats.json', (route) => route.fulfill({ status: 404, body: 'Not found' }));
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 3, name: 'Penguin Forms' })).toBeVisible();
    await expect(page.locator('#plugin-stats')).toBeHidden();
    await expect(page.locator('#research-totals')).toBeHidden();
    await expect(page.locator('.paper-stats').first()).toBeEmpty();
    await expect(page.locator('#stats-updated')).toBeHidden();
  });

  test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('./');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(360);
  });

  test('the tools open from their cards', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('link', { name: /Assembly simulator/ }).click();
    await expect(page.locator('h1')).toHaveText('Assembly simulator');
  });

  test('the old See more address goes to the home page', async ({ page }) => {
    await page.goto('projects/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('h1')).toHaveText('Groundwork');
    await expect(page.locator('.area.featured')).toBeVisible();
  });
});

test.describe('assembly simulator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('assembly/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens ready to use with the first example loaded', async ({ page }) => {
    await expect(page.locator('#code')).toHaveValue(/^  LDR R0, 0\n/);
    await expect(page.locator('#code')).not.toHaveValue(/\/\//);
    await expect(page.locator('#registers .cell')).toHaveCount(13);
    await expect(page.locator('#memory .cell')).toHaveCount(13);
    await expect(page.locator('#comparison')).toHaveText('No comparison yet');
    await expect(page.locator('#gutter .is-current')).toHaveText('1');
    await expect(page.locator('#explanation')).toBeEmpty();
  });

  test('typing a program and stepping updates registers, memory and the explanation', async ({ page }) => {
    await page.fill('#code', 'MOV R1, #7\nADD R3, R1, #5\nSTR R3, 4\nCMP R3, #20\nHALT');
    await openSettings(page);
    await page.click('#memory-zero');
    await page.keyboard.press('Escape');

    await page.click('#step');
    await expect(reg(page, 1)).toHaveText('7');
    await expect(page.locator('#explanation')).toHaveText('Copied 7 into R1.');
    await expect(page.locator('#registers .cell').nth(1)).toHaveClass(/is-written/);
    await expect(page.locator('#gutter .is-current')).toHaveText('2');

    await page.click('#step');
    await expect(reg(page, 3)).toHaveText('12');
    await expect(page.locator('#explanation')).toHaveText('Added 5 to R1 (7) and stored the result (12) in R3.');
    await expect(page.locator('#registers .cell').nth(1)).toHaveClass(/is-read/);

    await page.click('#step');
    await expect(mem(page, 4)).toHaveText('12');

    await page.click('#step');
    await expect(page.locator('#comparison')).toHaveText('R3 (12) compared with #20: less than');

    await page.click('#step');
    await expect(page.locator('#explanation')).toHaveText('HALT: the program has stopped.');
    await expect(page.locator('#step')).toBeDisabled();
    // Four earlier steps plus the "memory set to 0" message.
    await expect(page.locator('#history li')).toHaveCount(5);

    await page.click('#step-back');
    await page.click('#step-back');
    await page.click('#step-back');
    await expect(mem(page, 4)).toHaveText('0');
    await expect(page.locator('#comparison')).toHaveText('No comparison yet');

    await page.click('#reset');
    await expect(reg(page, 1)).toHaveText('0');
    await expect(reg(page, 3)).toHaveText('0');
    await expect(page.locator('#gutter .is-current')).toHaveText('1');
  });

  test('errors are listed under the editor and marked on their lines', async ({ page }) => {
    await page.fill('#code', 'MOV R1, #1\nADD #1, R2, R3\nMUL R1, R2, R3\nHALT');
    await page.click('#step');
    const errors = page.locator('#errors li');
    await expect(errors).toHaveCount(2);
    await expect(errors.nth(0)).toHaveText('Line 2: ADD needs a register as its first operand, for example ADD R1, R2, #5.');
    await expect(errors.nth(1)).toHaveText('Line 3: MUL is not part of the AQA instruction set. Multiply using repeated addition or LSL.');
    await expect(page.locator('#gutter .has-error')).toHaveText(['2', '3']);
    await expect(page.locator('#explanation')).toHaveClass(/is-error/);
    await expect(reg(page, 1)).toHaveText('0');
  });

  test('Run reaches HALT and shows the result', async ({ page }) => {
    await openSettings(page);
    await page.selectOption('#examples', 'multiply');
    await expect(page.locator('#settings-menu')).toBeHidden();
    await openSettings(page);
    await page.fill('#speed', '10');
    await page.keyboard.press('Escape');
    await page.click('#run');
    await expect(mem(page, 2)).toHaveText('42');
    await expect(page.locator('#explanation')).toHaveText('HALT: the program has stopped.');
    await expect(page.locator('#run')).toHaveAttribute('aria-label', 'Run');
  });

  test('an endless loop is stopped after 10,000 instructions', async ({ page }) => {
    await page.fill('#code', 'loop: B loop');
    await openSettings(page);
    await page.fill('#speed', '10');
    await page.click('#run');
    await expect(page.locator('#explanation')).toHaveText('Stopped after 10,000 instructions. Your program may be stuck in a loop.');
  });

  test('a register can be edited by clicking it', async ({ page }) => {
    await page.locator('#registers .cell').nth(5).click();
    const input = page.locator('#registers .cell').nth(5).locator('input');
    await input.fill('99');
    await input.press('Enter');
    await expect(reg(page, 5)).toHaveText('99');
  });

  test('number format and word size change how values are shown', async ({ page }) => {
    await page.click('#step');
    await expect(reg(page, 0)).toHaveText('12');
    await openSettings(page);
    await page.selectOption('#format', 'bin');
    await expect(reg(page, 0)).toHaveText('0000 1100');
    await page.selectOption('#format', 'hex');
    await expect(reg(page, 0)).toHaveText('0C');
    await page.selectOption('#word-size', '16');
    await expect(reg(page, 0)).toHaveText('0000');
    await expect(mem(page, 0)).toHaveText('000C');
  });

  test('the program is saved and comes back after a refresh', async ({ page }) => {
    await page.fill('#code', 'MOV R0, #3\nHALT');
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('#code')).toHaveValue('MOV R0, #3\nHALT');
  });

  test('the instruction reference opens', async ({ page }) => {
    await page.getByText('Instruction reference').click();
    await expect(page.locator('table.ref tbody tr')).toHaveCount(15);
  });
});

test.describe('simulator settings menu', () => {
  test('the cog opens and closes the settings menu', async ({ page }) => {
    await page.goto('assembly/');
    const toggle = page.locator('#settings-toggle');
    await expect(page.locator('#settings-menu')).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Speed')).toBeVisible();
    await expect(page.getByLabel('Word size')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-menu')).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('the Log is collapsible and the reference uses the AQA wording', async ({ page }) => {
    await page.goto('assembly/');
    await expect(page.locator('#log')).toHaveAttribute('open', '');
    await page.locator('#log summary').click();
    await expect(page.locator('#log')).not.toHaveAttribute('open', '');
    await page.getByText('Instruction reference').click();
    await expect(page.getByText('Stops the execution of the program.')).toBeVisible();
    await expect(page.getByText('The available general purpose registers that the programmer can use are numbered 0 to 12.')).toBeVisible();
  });
});

