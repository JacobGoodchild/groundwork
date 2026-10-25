// A small picture of a circuit as an SVG string, for the saved-circuit slots.
// No DOM code. Colours come from the page's CSS classes.

import { getNode, definitionOf } from './logic.js';
import { gateShape, componentBoxSVG, svgNameMarkup } from './shapes.js';
import {
  SCALE, BOX, nodeSize, localSize, localInPin, localOutPin, inPinPos, outPinPos, curvedPath,
} from './geometry.js';
import { route, pathData } from './wiring.js';

// The box for a component node, with its pin names and its name above.
export function componentBox(circuit, node) {
  const { w, h } = localSize(node);
  return {
    w, h, lead: BOX.lead,
    ins: node.ins.map((name, i) => ({ name, y: localInPin(node, i).y })),
    outs: node.outs.map((name, i) => ({ name, y: localOutPin(node, i).y })),
    name: definitionOf(circuit, node)?.name ?? 'COMPONENT',
  };
}

export function thumbnailSVG(circuit, { wireStyle = 'curved', padding = 24 } = {}) {
  if (circuit.nodes.length === 0) return '';

  // Fit the picture to the parts of the canvas that are used.
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const n of circuit.nodes) {
    const s = nodeSize(n);
    left = Math.min(left, n.x - (n.kind === 'output' ? 16 : 0));
    top = Math.min(top, n.y - (n.kind === 'component' ? 16 : 0));
    right = Math.max(right, n.x + s.w + (n.kind === 'output' ? 50 : 16));
    bottom = Math.max(bottom, n.y + s.h + (n.kind === 'gate' ? 14 : 0));
  }
  const box = [left - padding, top - padding, right - left + 2 * padding, bottom - top + 2 * padding].map(Math.round);

  const ends = circuit.wires.map((w) => ({
    key: `${w.to}:${w.pin}`,
    source: `${w.from}:${w.fromPin ?? 0}`,
    a: outPinPos(getNode(circuit, w.from), w.fromPin ?? 0),
    b: inPinPos(getNode(circuit, w.to), w.pin),
  }));
  const routed = wireStyle === 'curved' ? null : route(ends, wireStyle);
  const wires = ends.map((e) => `<path class="thumb-wire" d="${routed ? pathData(routed.wires.get(e.key)) : curvedPath(e.a, e.b)}"/>`);
  const dots = (routed?.junctions ?? []).map((j) => `<circle class="thumb-junction" cx="${j.x}" cy="${j.y}" r="4"/>`);

  const nodes = circuit.nodes.map((n) => {
    const at = `translate(${n.x} ${n.y}) scale(${SCALE})`;
    if (n.kind === 'gate') {
      const s = gateShape(n.type);
      const parts = [
        ...s.leads.map((d) => `<path class="lead" d="${d}"/>`),
        ...s.body.map((d, i) => `<path class="${i === 0 ? 'body' : 'back'}" d="${d}"/>`),
      ];
      if (s.bubble) parts.push(`<circle class="bubble" cx="${s.bubble.cx}" cy="22" r="${s.bubble.r}"/>`);
      return `<g transform="${at}">${parts.join('')}</g>`;
    }
    if (n.kind === 'component') return `<g transform="${at}">${componentBoxSVG(componentBox(circuit, n))}</g>`;
    if (n.kind === 'input') {
      return `<g transform="${at}"><path class="lead" d="M52 16 H62"/><rect class="switch" width="52" height="32" rx="4"/><text class="node-name" x="7" y="20.5">${svgNameMarkup(n.name)}</text></g>`;
    }
    return `<g transform="${at}"><path class="lead" d="M-10 16 H4"/><circle class="lamp" cx="20" cy="16" r="16"/><text class="node-name" x="41" y="20.5">${svgNameMarkup(n.name)}</text></g>`;
  });

  return `<svg class="thumb" viewBox="${box.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${wires.join('')}${dots.join('')}${nodes.join('')}</svg>`;
}
