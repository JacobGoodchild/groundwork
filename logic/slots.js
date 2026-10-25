// Saved circuits: six numbered slots kept in the browser on this device.
// No DOM code. `storage` is anything with getItem and setItem
// (localStorage on the page, a simple stand-in in the tests).

import { isValidCircuit, clone, inputs, outputs } from './logic.js';

export const SLOT_COUNT = 6;
export const SLOTS_KEY = 'groundwork.logic.slots.v1';

// Returns an array of SLOT_COUNT entries: { circuit, savedAt } or null.
// Anything unreadable or damaged counts as empty.
export function readSlots(storage) {
  let data = null;
  try {
    data = JSON.parse(storage.getItem(SLOTS_KEY));
  } catch {
    data = null;
  }
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const slot = Array.isArray(data) ? data[i] : null;
    if (!slot || !isValidCircuit(slot.circuit) || typeof slot.savedAt !== 'number') return null;
    return { circuit: slot.circuit, savedAt: slot.savedAt };
  });
}

// Save a circuit into slot `index` (0 to SLOT_COUNT - 1). Returns { ok } or { error }.
export function writeSlot(storage, index, circuit, now = Date.now()) {
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) return { error: 'There is no slot with that number.' };
  if (circuit.nodes.length === 0) return { error: 'The circuit is empty, so there is nothing to save.' };
  const slots = readSlots(storage);
  slots[index] = { circuit: clone(circuit), savedAt: now };
  try {
    storage.setItem(SLOTS_KEY, JSON.stringify(slots));
  } catch {
    return { error: 'The browser would not let this page save. Saving may be turned off, for example in a private window.' };
  }
  return { ok: true };
}

// Empty slot `index`. Returns { ok } or { error }.
export function clearSlot(storage, index) {
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) return { error: 'There is no slot with that number.' };
  const slots = readSlots(storage);
  slots[index] = null;
  try {
    storage.setItem(SLOTS_KEY, JSON.stringify(slots));
  } catch {
    return { error: 'The browser would not let this page change its saved circuits.' };
  }
  return { ok: true };
}

// A short description of a circuit: "2 inputs, 3 gates, 1 output".
export function summary(circuit) {
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const gates = circuit.nodes.filter((n) => n.kind === 'gate').length;
  return [count(inputs(circuit).length, 'input'), count(gates, 'gate'), count(outputs(circuit).length, 'output')].join(', ');
}

// When a slot was saved, for example "25 Oct, 16:40".
export function savedWhen(savedAt) {
  return new Date(savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
