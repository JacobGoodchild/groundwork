import { test, expect } from '@playwright/test';

const lamp = (page, name) => page.locator('.node-output', { has: page.locator('.node-name', { hasText: new RegExp(`^${name}$`) }) }).locator('.node-value');
const switchFor = (page, name) => page.locator('.node-input', { has: page.locator('.node-name', { hasText: new RegExp(`^${name}$`) }) });
const pin = (page, id, side, n = 0) => page.locator(`[data-key="pin:${id}:${side}:${n}"]`);
const openSettings = async (page) => {
  if (await page.locator('#settings-menu').isHidden()) await page.click('#settings-toggle');
};

test.describe('logic gates tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('logic/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens with a half adder ready to use', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Logic gates');
    await expect(page.locator('.node-gate')).toHaveCount(2);
    await expect(page.locator('#expressions')).toContainText('S = A ⊕ B');
    await expect(page.locator('#expressions')).toContainText('C = A.B');
    await expect(page.locator('#truth .truth-table tbody tr')).toHaveCount(4);
  });

  test('clicking inputs switches them and updates the outputs', async ({ page }) => {
    await expect(lamp(page, 'S')).toHaveText('0');
    await switchFor(page, 'A').click();
    await expect(lamp(page, 'S')).toHaveText('1');
    await expect(lamp(page, 'C')).toHaveText('0');
    await switchFor(page, 'B').click();
    await expect(lamp(page, 'S')).toHaveText('0');
    await expect(lamp(page, 'C')).toHaveText('1');
    await expect(page.locator('#truth tr.is-current td').first()).toHaveText('1');
    await expect(page.locator('#explanation')).toHaveText('Set B to 1. C is 1, S is 0.');
  });

  test('clicking a truth table row sets the inputs', async ({ page }) => {
    await page.locator('#truth .truth-table tbody tr').nth(2).click();
    await expect(switchFor(page, 'A').locator('.node-value')).toHaveText('1');
    await expect(switchFor(page, 'B').locator('.node-value')).toHaveText('0');
    await expect(lamp(page, 'S')).toHaveText('1');
  });

  test('build a NOT circuit from scratch by clicking pins', async ({ page }) => {
    await openSettings(page);
    await page.click('#clear');
    await expect(page.locator('.node')).toHaveCount(0);

    await page.getByRole('button', { name: 'Add an input' }).click();
    await page.getByRole('button', { name: 'Add a NOT gate' }).click();
    await page.getByRole('button', { name: 'Add an output' }).click();
    await expect(page.locator('.node')).toHaveCount(3);
    await expect(page.locator('#expressions')).toContainText('Q = ?');

    await pin(page, 'in1', 'out').click();
    await pin(page, 'g1', 'in').click();
    await pin(page, 'g1', 'out').click();
    await pin(page, 'out1', 'in').click();
    await expect(page.locator('.wire-group')).toHaveCount(2);
    await expect(page.locator('#explanation')).toHaveText('Connected NOT gate to output Q.');
    await expect(page.locator('#expressions .overbar')).toHaveText('A');
    await expect(lamp(page, 'Q')).toHaveText('1');
    await switchFor(page, 'A').click();
    await expect(lamp(page, 'Q')).toHaveText('0');
  });

  test('a wire can be dragged from pin to pin', async ({ page }) => {
    await openSettings(page);
    await page.click('#clear');
    await page.getByRole('button', { name: 'Add an input' }).click();
    await page.getByRole('button', { name: 'Add an output' }).click();
    const from = await pin(page, 'in1', 'out').boundingBox();
    const to = await pin(page, 'out1', 'in').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('.wire-group')).toHaveCount(1);
    await expect(page.locator('#expressions')).toContainText('Q = A');
  });

  test('a loop is refused with an explanation', async ({ page }) => {
    await openSettings(page);
    await page.click('#clear');
    await page.getByRole('button', { name: 'Add an input' }).click();
    await page.getByRole('button', { name: 'Add a AND gate' }).click();
    await pin(page, 'in1', 'out').click();
    await pin(page, 'g1', 'in', 0).click();
    await pin(page, 'g1', 'out').click();
    await pin(page, 'g1', 'in', 1).click();
    await expect(page.locator('#explanation')).toHaveClass(/is-error/);
    await expect(page.locator('#explanation')).toContainText('back into itself');
    await expect(page.locator('.wire-group')).toHaveCount(1);
  });

  test('delete, undo and redo', async ({ page }) => {
    await page.locator('.node-gate').first().click();
    await page.click('#delete');
    await expect(page.locator('.node-gate')).toHaveCount(1);
    await expect(page.locator('#expressions')).toContainText('S = ?');
    await page.click('#undo');
    await expect(page.locator('.node-gate')).toHaveCount(2);
    await page.click('#redo');
    await expect(page.locator('.node-gate')).toHaveCount(1);
  });

  test('gates can be moved with the arrow keys', async ({ page }) => {
    const gate = page.locator('.node-gate').first();
    const before = await gate.getAttribute('transform');
    await gate.focus();
    await page.keyboard.press('ArrowDown');
    await expect(gate).not.toHaveAttribute('transform', before);
  });

  test('inputs can be renamed with F2', async ({ page }) => {
    await switchFor(page, 'A').focus();
    await page.keyboard.press('F2');
    await page.locator('input.rename').fill('X');
    await page.keyboard.press('Enter');
    await expect(page.locator('#expressions')).toContainText('S = X ⊕ B');
  });

  test('examples load from the settings menu', async ({ page }) => {
    await openSettings(page);
    await page.selectOption('#examples', 'full-adder');
    await expect(page.locator('#settings-menu')).toBeHidden();
    await expect(page.locator('#truth .truth-table tbody tr')).toHaveCount(8);
    await expect(page.locator('#expressions')).toContainText('Cout = (A ⊕ B).Cin + A.B');
  });

  test('the circuit is saved and comes back after a refresh', async ({ page }) => {
    await switchFor(page, 'A').click();
    await page.getByRole('button', { name: 'Add a NOR gate' }).click();
    await page.reload();
    await expect(page.locator('.node-gate')).toHaveCount(3);
    await expect(lamp(page, 'S')).toHaveText('1');
  });

  test('wires can be drawn with right angles or straight, with hops and junction dots', async ({ page }) => {
    await expect(page.locator('.wire').first()).toHaveAttribute('d', / C/);
    await openSettings(page);
    await page.selectOption('#wire-style', 'right-angle');
    for (const d of await page.locator('.wire').evaluateAll((els) => els.map((e) => e.getAttribute('d')))) {
      expect(d).not.toMatch(/ C/);
    }
    await expect(page.locator('.junction')).not.toHaveCount(0);
    await expect(page.locator('.wire[d*=" A"]')).not.toHaveCount(0);

    await page.selectOption('#wire-style', 'straight');
    await expect(page.locator('.junction')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#wire-style')).toHaveValue('straight');
  });

  test('the gate reference lists all six gates', async ({ page }) => {
    await page.getByText('Gate reference').click();
    await expect(page.locator('#gate-ref > tbody > tr')).toHaveCount(6);
  });
});
