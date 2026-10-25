// ANSI/IEEE 91-1984 distinctive-shape gate symbols, as SVG path data, and
// the box drawn for a component.

import { nameParts } from './logic.js';
// Every gate is drawn in a 64 x 44 box: input leads come in from the left
// at the pin positions below, and the output lead leaves at (64, 22).

export const GATE_WIDTH = 64;
export const GATE_HEIGHT = 44;

export const PIN_Y = { 1: [22], 2: [12, 32] };
export const OUT_Y = 22;

const AND_BODY = 'M10 2 H30 A20 20 0 0 1 30 42 H10 Z';
const OR_BODY = 'M10 2 Q24 22 10 42 Q38 42 52 22 Q38 2 10 2 Z';
const XOR_BODY = 'M16 2 Q30 22 16 42 Q42 42 54 22 Q42 2 16 2 Z';
const XOR_BACK = 'M9 2 Q23 22 9 42';
const NOT_BODY = 'M12 4 L46 22 L12 40 Z';

// x where each input lead meets the body, for 2-input gates at y = 12 and 32.
const OR_BACK_X = 15;

// Returns { body: [path data], bubble: {cx, r} | null, leads: [path data] }
export function gateShape(type) {
  const twoIn = [`M0 12 H${type === 'AND' || type === 'NAND' ? 10 : OR_BACK_X}`, `M0 32 H${type === 'AND' || type === 'NAND' ? 10 : OR_BACK_X}`];
  switch (type) {
    case 'AND': return { body: [AND_BODY], bubble: null, leads: [...twoIn, 'M50 22 H64'] };
    case 'NAND': return { body: [AND_BODY], bubble: { cx: 54, r: 4 }, leads: [...twoIn, 'M58 22 H64'] };
    case 'OR': return { body: [OR_BODY], bubble: null, leads: [...twoIn, 'M52 22 H64'] };
    case 'NOR': return { body: [OR_BODY], bubble: { cx: 56, r: 4 }, leads: [...twoIn, 'M60 22 H64'] };
    case 'XOR': return { body: [XOR_BODY, XOR_BACK], bubble: null, leads: ['M0 12 H14', 'M0 32 H14', 'M54 22 H64'] };
    case 'NOT': return { body: [NOT_BODY], bubble: { cx: 50, r: 4 }, leads: ['M0 22 H12', 'M54 22 H64'] };
    default: return { body: [], bubble: null, leads: [] };
  }
}

// The whole symbol as an SVG string (for icons and the reference table).
export function gateSymbolSVG(type, { width = 64, height = 44, strokeWidth = 2 } = {}) {
  const s = gateShape(type);
  const parts = [
    ...s.leads.map((d) => `<path d="${d}" class="lead"/>`),
    ...s.body.map((d, i) => `<path d="${d}" class="${i === 0 ? 'body' : 'back'}"/>`),
  ];
  if (s.bubble) parts.push(`<circle cx="${s.bubble.cx}" cy="22" r="${s.bubble.r}" class="bubble"/>`);
  return `<svg class="gate-symbol" viewBox="-1 -1 66 46" width="${width}" height="${height}" aria-hidden="true" stroke-width="${strokeWidth}">${parts.join('')}</svg>`;
}

// ---------------------------------------------------------------------------
// Component boxes
// ---------------------------------------------------------------------------

const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// A name as SVG text content: Cin becomes C with a smaller, lower "in".
export function svgNameMarkup(name) {
  const { main, sub } = nameParts(name);
  return sub ? `${escape(main)}<tspan class="name-sub" dy="0.3em">${escape(sub)}</tspan>` : escape(name);
}

/**
 * SVG markup for a component box, in the node's own coordinates:
 * the box, its pin leads, pin names inside the edges and its name above.
 * box = { w, h, lead, ins: [{ name, y }], outs: [{ name, y }], name }
 */
export function componentBoxSVG(box) {
  const { w, h, lead, ins, outs, name } = box;
  const parts = [`<rect class="body box" x="${lead}" y="0" width="${w - 2 * lead}" height="${h}" rx="3"/>`];
  for (const p of ins) {
    parts.push(`<path class="lead" d="M0 ${p.y} H${lead}"/>`);
    parts.push(`<text class="pin-name" x="${lead + 3}" y="${p.y + 3}">${svgNameMarkup(p.name)}</text>`);
  }
  for (const p of outs) {
    parts.push(`<path class="lead" d="M${w - lead} ${p.y} H${w}"/>`);
    parts.push(`<text class="pin-name end" x="${w - lead - 3}" y="${p.y + 3}">${svgNameMarkup(p.name)}</text>`);
  }
  parts.push(`<text class="box-name" x="${w / 2}" y="-4">${escape(name)}</text>`);
  return parts.join('');
}
