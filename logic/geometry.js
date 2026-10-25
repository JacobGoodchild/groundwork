// Sizes and pin positions of circuit nodes, shared by the canvas and the
// saved-circuit thumbnails. No DOM code.

import { pinCount, outCount } from './logic.js';
import { GATE_WIDTH, GATE_HEIGHT, PIN_Y, OUT_Y } from './shapes.js';

export const WORLD = { width: 960, height: 540 };

// Nodes are drawn in their own small coordinates (LOCAL) and scaled up by
// SCALE on the canvas. Positions (node.x, node.y) are the top-left corner.
export const SCALE = 1.4;
export const LOCAL = {
  gate: { w: GATE_WIDTH, h: GATE_HEIGHT },
  input: { w: 52, h: 32 },
  output: { w: 40, h: 32 },
};
export const SIZE = Object.fromEntries(Object.entries(LOCAL).map(([k, v]) => [k, { w: v.w * SCALE, h: v.h * SCALE }]));

// A component is a box: pins 20 apart down each side, at least two rows high.
export const BOX = { w: 70, pitch: 20, pad: 8, lead: 10 };

export function localSize(node) {
  if (node.kind !== 'component') return LOCAL[node.kind];
  const rows = Math.max(2, pinCount(node), outCount(node));
  return { w: BOX.w, h: rows * BOX.pitch + BOX.pad };
}

export function nodeSize(node) {
  const s = localSize(node);
  return { w: s.w * SCALE, h: s.h * SCALE };
}

// y of pin i of n, spread evenly about the middle of a box of height h.
const boxPinY = (i, n, h) => h / 2 - ((n - 1) * BOX.pitch) / 2 + i * BOX.pitch;

// Pin positions in the node's own (unscaled) coordinates.
export function localInPin(node, pin) {
  if (node.kind === 'output') return { x: -10, y: 16 };
  if (node.kind === 'component') return { x: 0, y: boxPinY(pin, pinCount(node), localSize(node).h) };
  return { x: 0, y: PIN_Y[pinCount(node)][pin] };
}

export function localOutPin(node, pin = 0) {
  if (node.kind === 'input') return { x: LOCAL.input.w + 10, y: 16 };
  if (node.kind === 'component') return { x: BOX.w, y: boxPinY(pin, outCount(node), localSize(node).h) };
  return { x: GATE_WIDTH, y: OUT_Y };
}

const toWorld = (node, p) => ({ x: node.x + p.x * SCALE, y: node.y + p.y * SCALE });
export const inPinPos = (node, pin) => toWorld(node, localInPin(node, pin));
export const outPinPos = (node, pin = 0) => toWorld(node, localOutPin(node, pin));

export function curvedPath(a, b) {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  return `M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
