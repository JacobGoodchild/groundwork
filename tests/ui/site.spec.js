import { test, expect } from '@playwright/test';

const reg = (page, n) => page.locator('#registers .cell').nth(n).locator('.cell-value');
const mem = (page, a) => page.locator('#memory .cell').nth(a).locator('.cell-value');

test.describe('home page', () => {
  test('shows the site name, a description and the tool list', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle('Groundwork');
    await expect(page.locator('h1')).toHaveText('Groundwork');
    await expect(page.getByText('Interactive tools for learning how computers work')).toBeVisible();
    await page.getByRole('link', { name: 'Assembly simulator' }).click();
    await expect(page.locator('h1')).toHaveText('Assembly simulator');
  });

  test('every page has a See more link in the header', async ({ page }) => {
    for (const path of ['./', 'assembly/', 'projects/']) {
      await page.goto(path);
      const link = page.locator('.site-header').getByRole('link', { name: 'See more' });
      await expect(link).toBeVisible();
    }
    await page.goto('./');
    await page.locator('.site-header').getByRole('link', { name: 'See more' }).click();
    await expect(page.locator('h1')).toHaveText('Other projects');
  });
});

test.describe('see more page', () => {
  test('lists all 9 projects, each opening in a new tab', async ({ page }) => {
    await page.goto('projects/');
    const links = page.locator('#project-list a');
    await expect(links).toHaveCount(9);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('href', /^https:\/\//);
    }
    for (const name of ['Papers', 'Libraries', 'Games and interactive projects']) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
    await expect(page.locator('.tag', { hasText: 'Early Access – Still Under Construction' })).toHaveCount(1);
    await expect(page.getByRole('img', { name: /Apex Ring/ })).toBeVisible();
    await expect(page.getByText('They have not been peer reviewed.')).toBeVisible();
  });
});

test.describe('assembly simulator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('assembly/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens ready to use with the first example loaded', async ({ page }) => {
    await expect(page.locator('#code')).toHaveValue(/Load two values from memory/);
    await expect(page.locator('#registers .cell')).toHaveCount(13);
    await expect(page.locator('#memory .cell')).toHaveCount(26);
    await expect(page.locator('#comparison')).toHaveText('No comparison yet');
    await expect(page.locator('#gutter .is-current')).toHaveText('3');
  });

  test('typing a program and stepping updates registers, memory and the explanation', async ({ page }) => {
    await page.fill('#code', 'MOV R1, #7\nADD R3, R1, #5\nSTR R3, 4\nCMP R3, #20\nHALT');
    await page.click('#memory-zero');

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
    await page.selectOption('#examples', 'multiply');
    await page.fill('#speed', '10');
    await page.click('#run');
    await expect(mem(page, 2)).toHaveText('42');
    await expect(page.locator('#explanation')).toHaveText('HALT: the program has stopped.');
    await expect(page.locator('#run')).toHaveText('Run');
  });

  test('an endless loop is stopped after 10,000 instructions', async ({ page }) => {
    await page.fill('#code', 'loop: B loop');
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
