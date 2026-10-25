// Sizes and pin positions of circuit nodes, shared by the canvas and the
// saved-circuit thumbnails. No DOM code.

import { pinCount } from './logic.js';
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

// Pin positions in the node's own (unscaled) coordinates.
export function localInPin(node, pin) {
  if (node.kind === 'output') return { x: -10, y: 16 };
  return { x: 0, y: PIN_Y[pinCount(node)][pin] };
}

export function localOutPin(node) {
  if (node.kind === 'input') return { x: LOCAL.input.w + 10, y: 16 };
  return { x: GATE_WIDTH, y: OUT_Y };
}

const toWorld = (node, p) => ({ x: node.x + p.x * SCALE, y: node.y + p.y * SCALE });
export const inPinPos = (node, pin) => toWorld(node, localInPin(node, pin));
export const outPinPos = (node) => toWorld(node, localOutPin(node));

export function curvedPath(a, b) {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  return `M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
