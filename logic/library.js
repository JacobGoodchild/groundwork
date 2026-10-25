// The component library: components the user has made, kept in the browser
// on this device. No DOM code; `storage` is anything with getItem and setItem.

import { isValidCircuit } from './logic.js';

export const LIBRARY_KEY = 'groundwork.logic.components.v1';
export const LIBRARY_LIMIT = 12;

const isDef = (d) => d && typeof d.id === 'string' && typeof d.name === 'string'
  && Array.isArray(d.inputs) && Array.isArray(d.outputs) && isValidCircuit(d.circuit);

export function readLibrary(storage) {
  try {
    const data = JSON.parse(storage.getItem(LIBRARY_KEY));
    return Array.isArray(data) ? data.filter(isDef) : [];
  } catch {
    return [];
  }
}

function write(storage, list) {
  try {
    storage.setItem(LIBRARY_KEY, JSON.stringify(list));
    return { ok: true };
  } catch {
    return { error: 'The browser would not let this page save. Saving may be turned off, for example in a private window.' };
  }
}

// Add a component definition. A component with the same name is replaced.
export function addToLibrary(storage, def) {
  const list = readLibrary(storage);
  const sameName = list.findIndex((d) => d.name.toLowerCase() === def.name.toLowerCase());
  if (sameName === -1 && list.length >= LIBRARY_LIMIT) {
    return { error: `You can keep up to ${LIBRARY_LIMIT} components. Delete one first.` };
  }
  if (sameName !== -1) list[sameName] = def;
  else list.push(def);
  return { ...write(storage, list), replaced: sameName !== -1 };
}

export function removeFromLibrary(storage, id) {
  return write(storage, readLibrary(storage).filter((d) => d.id !== id));
}
