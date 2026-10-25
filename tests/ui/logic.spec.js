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
    await expect(page.locator('#back')).toBeHidden();
    await expect(page.locator('#check')).toBeHidden();
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

  test('inputs can be renamed by double-clicking', async ({ page }) => {
    await switchFor(page, 'B').dblclick();
    await expect(switchFor(page, 'B').locator('.node-value')).toHaveText('0'); // not switched
    await page.locator('input.rename').fill('Y');
    await page.keyboard.press('Enter');
    await expect(page.locator('#expressions')).toContainText('S = A ⊕ Y');
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

  test('save a circuit to a slot, then load it back', async ({ page }) => {
    await expect(page.locator('.slot:not([disabled])')).toHaveCount(0);
    await openSettings(page);
    await page.click('#save-open');
    const dialog = page.locator('#save-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.slot-card')).toHaveCount(6);
    await expect(page.locator('.slot')).toHaveCount(6);
    await dialog.getByRole('button', { name: /Slot 2: empty/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#explanation')).toHaveText('Saved in slot 2.');
    await expect(page.locator('[data-load="1"] svg.thumb')).toBeVisible();

    // Change the circuit, then load the slot: the half adder comes back.
    await openSettings(page);
    await page.selectOption('#examples', 'full-adder');
    await expect(page.locator('.node-gate')).toHaveCount(5);
    await page.locator('[data-load="1"]').click();
    await expect(page.locator('.node-gate')).toHaveCount(2);
    await expect(page.locator('#explanation')).toContainText('Loaded slot 2');
    await page.click('#undo');
    await expect(page.locator('.node-gate')).toHaveCount(5);

    // Slots survive a refresh.
    await page.reload();
    await expect(page.locator('[data-load="1"]')).toBeEnabled();
  });

  test('saving over a filled slot asks first', async ({ page }) => {
    await openSettings(page);
    await page.click('#save-open');
    await page.locator('#slot-cards [data-slot="0"]').click();

    await openSettings(page);
    await page.selectOption('#examples', 'nand-not');
    await openSettings(page);
    await page.click('#save-open');
    await page.locator('#slot-cards [data-slot="0"]').click();
    await expect(page.getByText('Replace the circuit in slot 1? It will be lost.')).toBeVisible();
    await page.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByText('Replace the circuit in slot 1?')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#save-dialog')).toBeHidden();
    await expect(page.locator('[data-load="0"]')).toHaveAttribute('aria-label', /2 inputs, 2 gates/);

    await openSettings(page);
    await page.click('#save-open');
    await page.locator('#slot-cards [data-slot="0"]').click();
    await page.getByRole('button', { name: 'Replace', exact: true }).click();
    await expect(page.locator('[data-load="0"]')).toHaveAttribute('aria-label', /1 input, 1 gate/);
  });

  test('a slot can be deleted from the side strip or the save overlay, after a question', async ({ page }) => {
    for (const n of ['0', '1']) {
      await openSettings(page);
      await page.click('#save-open');
      await page.locator(`#slot-cards [data-slot="${n}"]`).click();
    }
    await expect(page.locator('.slot-delete')).toHaveCount(2);

    // Side strip: ask, keep, then ask again and delete.
    await page.getByRole('button', { name: 'Delete slot 1' }).click();
    await expect(page.getByText('Delete slot 1?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await expect(page.locator('[data-load="0"]')).toBeEnabled();
    await page.getByRole('button', { name: 'Delete slot 1' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('[data-load="0"]')).toBeDisabled();
    await expect(page.locator('#explanation')).toHaveText('Deleted the circuit in slot 1.');

    // Save overlay.
    await openSettings(page);
    await page.click('#save-open');
    await page.locator('#slot-cards').getByRole('button', { name: 'Delete slot 2' }).click();
    await expect(page.getByText('Delete the circuit in slot 2? It will be lost.')).toBeVisible();
    await page.locator('#slot-cards').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('#slot-cards [data-slot="1"]')).toContainText('Save here');
    await expect(page.locator('[data-load="1"]')).toBeDisabled();
    await expect(page.locator('.slot-delete')).toHaveCount(0);
  });

  test('box up a half adder, build a full adder from two of them, check it and look inside', async ({ page }) => {
    // 1. The half adder (loaded by default) becomes a component.
    await openSettings(page);
    await page.click('#components-open');
    await page.fill('#component-name', 'HALF ADDER');
    await page.getByRole('button', { name: 'Make component from this circuit' }).click();
    await expect(page.locator('#components-dialog')).toBeHidden();
    await expect(page.locator('#explanation')).toContainText('Made the HALF ADDER component (inputs A, B; outputs S, C)');
    const addHalfAdder = page.getByRole('button', { name: 'Add a HALF ADDER component' });
    await expect(addHalfAdder).toBeVisible();

    // 2. A full adder from two HALF ADDERs and an OR gate.
    await openSettings(page);
    await page.click('#clear');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add an input' }).click();
    await switchFor(page, 'C').focus();
    await page.keyboard.press('F2');
    await page.locator('input.rename').fill('Cin');
    await page.keyboard.press('Enter');
    await addHalfAdder.click();
    await addHalfAdder.click();
    await page.getByRole('button', { name: 'Add a OR gate' }).click();
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Add an output' }).click();
    for (const [from, to] of [['Q', 'S'], ['R', 'Cout']]) {
      await page.locator('.node-output', { has: page.locator('.node-name', { hasText: new RegExp(`^${from}$`) }) }).focus();
      await page.keyboard.press('F2');
      await page.locator('input.rename').fill(to);
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.node-component')).toHaveCount(2);

    // Half adder pins: in 0 = A, in 1 = B; out 0 = S, out 1 = C.
    const wire = async (a, b) => { await page.locator(`[data-key="${a}"]`).click(); await page.locator(`[data-key="${b}"]`).click(); };
    await wire('pin:in1:out:0', 'pin:c1:in:0');
    await wire('pin:in2:out:0', 'pin:c1:in:1');
    await wire('pin:c1:out:0', 'pin:c2:in:0');
    await wire('pin:in3:out:0', 'pin:c2:in:1');
    await wire('pin:c2:out:0', 'pin:out1:in:0');
    await wire('pin:c1:out:1', 'pin:g1:in:0');
    await expect(page.locator('#explanation')).toHaveText('Connected HALF ADDER 1 (output C) to OR gate (input 1).');
    await wire('pin:c2:out:1', 'pin:g1:in:1');
    await wire('pin:g1:out:0', 'pin:out2:in:0');
    await expect(page.locator('#expressions')).toContainText('S = (A ⊕ B) ⊕ Cin');

    // 3. Check against the full adder target.
    await openSettings(page);
    await page.selectOption('#target', 'full-adder');
    await page.keyboard.press('Escape');
    await expect(page.locator('#expressions')).toContainText('Target: Full adder');
    await page.click('#check');
    await expect(page.locator('#explanation')).toHaveText('Check passed: all 8 rows of the truth table match Full adder.');
    await expect(page.locator('#check')).toHaveAttribute('data-result', 'pass');

    // 4. Look inside the first half adder, with live values, then come back.
    await switchFor(page, 'A').click();
    await page.locator('.node-component').first().dblclick();
    await expect(page.locator('#canvas-title')).toHaveText('Circuit › HALF ADDER');
    await expect(page.locator('#back')).toBeVisible();
    await expect(page.locator('.node-gate')).toHaveCount(2);
    await expect(lamp(page, 'S')).toHaveText('1');
    await expect(page.locator('#palette button').first()).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('#canvas-title')).toHaveText('Circuit');
    await expect(page.locator('#back')).toBeHidden();
    await expect(page.locator('.node-component')).toHaveCount(2);
  });

  test('a failed check explains the first wrong row and sets the inputs to it', async ({ page }) => {
    await openSettings(page);
    await page.selectOption('#target', 'and');
    await page.keyboard.press('Escape');
    await page.click('#check');
    await expect(page.locator('#explanation')).toHaveText('Your circuit needs an output called Q. Add it, or rename an output with F2.');
    await expect(page.locator('#check')).toHaveAttribute('data-result', 'fail');

    await openSettings(page);
    await page.selectOption('#target', 'half-adder');
    await page.keyboard.press('Escape');
    // Swap the XOR for an OR: wrong when A = 1 and B = 1.
    await page.locator('.node-gate').first().click();
    await page.click('#delete');
    await page.getByRole('button', { name: 'Add a OR gate' }).click();
    const wire = async (a, b) => { await page.locator(`[data-key="${a}"]`).click(); await page.locator(`[data-key="${b}"]`).click(); };
    await wire('pin:in1:out:0', 'pin:g1:in:0');
    await wire('pin:in2:out:0', 'pin:g1:in:1');
    await wire('pin:g1:out:0', 'pin:out1:in:0');
    await page.click('#check');
    await expect(page.locator('#explanation')).toHaveText('When A = 1 and B = 1, your circuit outputs S = 1. It should be 0.');
    await expect(switchFor(page, 'A').locator('.node-value')).toHaveText('1');
    await expect(switchFor(page, 'B').locator('.node-value')).toHaveText('1');
  });

  test('the tool allows up to five inputs', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add an input' }).click();
    await expect(page.locator('.node-input')).toHaveCount(5);
    await page.getByRole('button', { name: 'Add an input' }).click();
    await expect(page.locator('.node-input')).toHaveCount(5);
    await expect(page.locator('#explanation')).toHaveText('This tool allows up to 5 inputs, so the truth table stays readable.');
  });

  test('the gate reference lists all six gates', async ({ page }) => {
    await page.getByText('Gate reference').click();
    await expect(page.locator('#gate-ref > tbody > tr')).toHaveCount(6);
  });
});
