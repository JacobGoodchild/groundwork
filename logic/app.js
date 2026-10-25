// Logic gates tool. The circuit logic is in logic.js; this file draws the
// circuit as SVG and handles editing.

import {
  GATE_TYPES, GATES, emptyCircuit, clone, addNode, removeNode, removeWire, connect, rename,
  simulate, truthTable, expression, needsBrackets, SYMBOLS, getNode, pinCount, outCount,
  inputs, outputs, describe, isValidCircuit, normalise, wireInto, nameParts, definitionOf,
  makeComponent, addComponent, check,
} from './logic.js';
import { EXAMPLES } from './examples.js';
import { TARGETS } from './targets.js';
import { readLibrary, addToLibrary, removeFromLibrary } from './library.js';
import { gateShape, gateSymbolSVG, componentBoxSVG, GATE_WIDTH, GATE_HEIGHT } from './shapes.js';
import {
  WORLD, SCALE, LOCAL, SIZE, nodeSize, localInPin, localOutPin, inPinPos, outPinPos, curvedPath,
} from './geometry.js';
import { route, pathData, WIRE_STYLES } from './wiring.js';
import { readSlots, writeSlot, clearSlot, summary, savedWhen } from './slots.js';
import { thumbnailSVG, componentBox } from './thumbnail.js';
import { setupSettingsMenu } from '../assets/settings-menu.js';

const STORAGE_KEY = 'groundwork.logic.v1';
const HISTORY_LENGTH = 20;
const UNDO_LIMIT = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';
// Limits for this page, so the truth table stays readable. The logic core
// itself has no limit (the workshop needs bigger circuits).
const MAX_INPUTS = 5;
const MAX_OUTPUTS = 4;

const $ = (id) => document.getElementById(id);
const ui = {
  palette: $('palette'), undo: $('undo'), redo: $('redo'), del: $('delete'),
  examples: $('examples'), showLabels: $('show-labels'), wireStyle: $('wire-style'), clear: $('clear'),
  expressions: $('expressions'), canvas: $('canvas'), wrap: $('canvas-wrap'),
  wires: $('wires'), nodes: $('nodes'), pending: $('pending-wire'),
  truth: $('truth'), explanation: $('explanation'), history: $('history'),
  gateRef: $('gate-ref').querySelector('tbody'),
  slotList: $('slot-list'), saveOpen: $('save-open'), saveDialog: $('save-dialog'),
  saveClose: $('save-close'), slotCards: $('slot-cards'),
  check: $('check'), target: $('target'), back: $('back'), canvasTitle: $('canvas-title'),
  componentsOpen: $('components-open'), componentsDialog: $('components-dialog'),
  componentsClose: $('components-close'), componentForm: $('component-form'),
  componentName: $('component-name'), componentError: $('component-error'), componentList: $('component-list'),
};

const settings = setupSettingsMenu($('settings-toggle'), $('settings-menu'));

const state = {
  circuit: emptyCircuit(),
  selected: null,       // { type: 'node', id } | { type: 'wire', to, pin } | null
  pending: null,        // a wire being drawn: { from, fromPin } or { to, pin }
  view: [],             // component node ids, when looking inside components
  target: '',           // id from TARGETS, or '' for none
  pointer: null,        // last pointer position in circuit coordinates
  drag: null,           // { id, dx, dy, startX, startY, before, moved }
  lastTap: null,        // { id, time } of the last click on a part, to spot double-clicks
  undo: [],
  redo: [],
  log: [],
  labels: true,
  wireStyle: 'curved',
};

// ---------- Saving ----------

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      circuit: state.circuit, labels: state.labels, wireStyle: state.wireStyle, target: state.target,
    }));
  } catch {
    // Storage may be unavailable; the tool still works.
  }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- Log ----------

function say(text, { error = false, log = true } = {}) {
  ui.explanation.textContent = text;
  ui.explanation.classList.toggle('is-error', error);
  if (log) {
    state.log.unshift(text);
    if (state.log.length > HISTORY_LENGTH) state.log.length = HISTORY_LENGTH;
  }
  ui.history.replaceChildren(...state.log.slice(1).map((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    return li;
  }));
}

// The value on output pin `pin` of node `id` in a simulation.
const val = (sim, id, pin = 0) => sim.out.get(id)?.[pin] ?? null;

function outputSummary(sim) {
  return outputs(state.circuit)
    .map((o) => `${o.name} is ${val(sim, o.id) ?? '?'}`)
    .join(', ');
}

// ---------- Looking inside components ----------

const inside = () => state.view.length > 0;

// The circuit on screen: the main circuit, or the inside of a component.
// Returns { circuit, sim, trail } where trail lists the component names.
function shown(sim) {
  let circuit = state.circuit;
  let s = sim;
  const trail = [];
  for (const id of state.view) {
    const node = getNode(circuit, id);
    const def = node && definitionOf(circuit, node);
    const innerSim = s.inner.get(id);
    if (!def || !innerSim) {
      state.view = [];
      return { circuit: state.circuit, sim, trail: [] };
    }
    trail.push(def.name);
    circuit = def.circuit;
    s = innerSim;
  }
  return { circuit, sim: s, trail };
}

function openComponent(id) {
  const { circuit } = shown(simulate(state.circuit));
  const node = getNode(circuit, id);
  if (!node || node.kind !== 'component') return;
  state.view.push(id);
  state.selected = null;
  state.pending = null;
  say(`Inside ${definitionOf(circuit, node).name}. Its inputs come from the circuit outside, so the values here are live.`);
  render();
  ui.back.focus();
}

function closeComponent() {
  if (!inside()) return;
  const id = state.view.pop();
  say(inside() ? `Back to ${shown(simulate(state.circuit)).trail.at(-1)}.` : 'Back to the main circuit.', { log: false });
  render();
  ui.canvas.querySelector(`[data-key="node:${id}"]`)?.focus();
}

// ---------- Changes and undo ----------

// Make a change that can be undone. `fn` edits state.circuit and returns a
// log message, or { error } to cancel.
function change(fn) {
  ui.check.dataset.result = '';
  const before = clone(state.circuit);
  const result = fn();
  if (result && result.error) {
    state.circuit = before;
    say(result.error, { error: true });
    render();
    return false;
  }
  if (JSON.stringify(before) !== JSON.stringify(state.circuit)) {
    state.undo.push(before);
    if (state.undo.length > UNDO_LIMIT) state.undo.shift();
    state.redo = [];
    save();
  }
  if (result) say(result);
  render();
  return true;
}

function undo() {
  if (inside()) return;
  const previous = state.undo.pop();
  if (!previous) return;
  state.redo.push(clone(state.circuit));
  state.circuit = previous;
  state.selected = null;
  state.pending = null;
  save();
  say('Undid the last change.');
  render();
}

function redo() {
  if (inside()) return;
  const next = state.redo.pop();
  if (!next) return;
  state.undo.push(clone(state.circuit));
  state.circuit = next;
  state.selected = null;
  state.pending = null;
  save();
  say('Redid the change.');
  render();
}

// ---------- Geometry ----------

const wirePath = curvedPath;

// The wire that follows the pointer while you draw one, in the chosen style.
function previewPath(a, b) {
  if (state.wireStyle === 'straight') return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  if (state.wireStyle === 'right-angle') {
    const mid = Math.round((a.x + b.x) / 2);
    return `M${a.x} ${a.y} H${mid} V${b.y} H${b.x}`;
  }
  return wirePath(a, b);
}

function clamp(node, x, y) {
  const { w, h } = nodeSize(node);
  const left = node.kind === 'output' ? 16 : 4;
  const right = node.kind === 'gate' || node.kind === 'component' ? 4 : node.kind === 'input' ? 18 : 50;
  return {
    x: Math.round(Math.min(Math.max(x, left), WORLD.width - w - right)),
    y: Math.round(Math.min(Math.max(y, node.kind === 'component' ? 18 : 4), WORLD.height - h - 4)),
  };
}

function toCircuitPoint(event) {
  const pt = ui.canvas.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const p = pt.matrixTransform(ui.canvas.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}

// Find an empty spot for a new node of the given size.
function freeSpot(kind, size = SIZE[kind]) {
  const columns = kind === 'input' ? [30] : kind === 'output' ? [830] : [200, 340, 480, 620];
  const overlaps = (x, y) => state.circuit.nodes.some((n) => {
    const s = nodeSize(n);
    return x < n.x + s.w + 30 && x + size.w + 30 > n.x && y < n.y + s.h + 20 && y + size.h + 20 > n.y;
  });
  for (let y = 40; y < WORLD.height - size.h - 4; y += 90) {
    for (const x of columns) if (!overlaps(x, y)) return { x, y };
  }
  return { x: columns[0], y: 40 };
}

// ---------- Drawing ----------

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}

function valueClass(v) {
  if (v === 1) return 'is-on';
  if (v === 0) return 'is-off';
  return 'is-unknown';
}

function isSelectedNode(id) {
  return state.selected?.type === 'node' && state.selected.id === id;
}

function pinKey(id, side, pin = 0) {
  return `pin:${id}:${side}:${pin}`;
}

function drawPin(group, circuit, node, side, pin, pos, value) {
  const name = describe(circuit, node);
  let label;
  if (side === 'out') {
    const which = node.kind === 'component' ? `Output ${node.outs[pin]} of ` : 'Output of ';
    label = `${which}${name}.${inside() ? '' : ' Press to start a wire.'}`;
  } else {
    let which = 'Input of ';
    if (node.kind === 'component') which = `Input ${node.ins[pin]} of `;
    else if (pinCount(node) > 1) which = `Input ${pin + 1} of `;
    label = `${which}${name}.${inside() ? '' : ' Press to end a wire here.'}`;
  }
  const isPending = state.pending && (
    (side === 'out' && state.pending.from === node.id && state.pending.fromPin === pin)
    || (side === 'in' && state.pending.to === node.id && state.pending.pin === pin));
  return el('circle', {
    cx: pos.x, cy: pos.y, r: 4.5,
    class: `pin pin-${side} ${valueClass(value)}${isPending ? ' is-pending' : ''}`,
    tabindex: inside() ? -1 : 0, role: 'button', 'aria-label': label,
    'data-key': pinKey(node.id, side, pin), 'data-id': node.id, 'data-side': side, 'data-pin': pin,
  }, group);
}

function drawNode(circuit, sim, node) {
  const v = val(sim, node.id);
  const outer = el('g', {
    class: `node node-${node.kind}${isSelectedNode(node.id) ? ' is-selected' : ''}`,
    transform: `translate(${node.x} ${node.y})`,
    'data-id': node.id,
  }, ui.nodes);
  const g = el('g', { transform: `scale(${SCALE})` }, outer);

  const name = describe(circuit, node);
  const edit = inside() ? '' : ' Arrow keys move it, Delete removes it.';
  let bodyLabel;
  if (node.kind === 'gate') {
    const shape = gateShape(node.type);
    const hit = el('rect', { x: 0, y: 0, width: GATE_WIDTH, height: GATE_HEIGHT, class: 'hit' }, g);
    hit.dataset.role = 'body';
    for (const d of shape.leads) el('path', { d, class: 'lead' }, g);
    shape.body.forEach((d, i) => el('path', { d, class: i === 0 ? 'body' : 'back' }, g));
    if (shape.bubble) el('circle', { cx: shape.bubble.cx, cy: 22, r: shape.bubble.r, class: 'bubble' }, g);
    const label = el('text', { x: GATE_WIDTH / 2, y: GATE_HEIGHT + 10, class: 'gate-label' }, g);
    label.textContent = node.type;
    bodyLabel = `${name}, output ${v ?? 'unknown'}.${edit}`;
  } else if (node.kind === 'component') {
    g.innerHTML = componentBoxSVG(componentBox(circuit, node));
    const outsText = node.outs.map((o, i) => `${o} ${val(sim, node.id, i) ?? 'unknown'}`).join(', ');
    bodyLabel = `${name} component, outputs ${outsText}. Press Enter or double-click to look inside.${edit}`;
  } else if (node.kind === 'input') {
    el('path', { d: `M${LOCAL.input.w} 16 H${LOCAL.input.w + 10}`, class: 'lead' }, g);
    el('rect', { x: 0, y: 0, width: LOCAL.input.w, height: LOCAL.input.h, rx: 4, class: `switch ${valueClass(v)}` }, g);
    const nameText = el('text', { x: 7, y: 20.5, class: 'node-name' }, g);
    setSvgName(nameText, node.name);
    const valueText = el('text', { x: LOCAL.input.w - 10, y: 20.5, class: 'node-value' }, g);
    valueText.textContent = v ?? '?';
    bodyLabel = inside()
      ? `Input ${node.name}, value ${v ?? 'unknown'}, set by the circuit outside.`
      : `Input ${node.name}, value ${v}. Press Enter to switch it, F2 to rename.`;
  } else {
    el('path', { d: 'M-10 16 H4', class: 'lead' }, g);
    el('circle', { cx: 20, cy: 16, r: 16, class: `lamp ${valueClass(v)}` }, g);
    const valueText = el('text', { x: 20, y: 20.5, class: 'node-value centred' }, g);
    valueText.textContent = v ?? '?';
    const nameText = el('text', { x: 41, y: 20.5, class: 'node-name' }, g);
    setSvgName(nameText, node.name);
    bodyLabel = `Output ${node.name}, value ${v ?? 'unknown'}.${inside() ? '' : ' F2 renames it.'}`;
  }
  outer.setAttribute('tabindex', '0');
  outer.setAttribute('role', 'group');
  outer.setAttribute('aria-label', bodyLabel);
  outer.dataset.key = `node:${node.id}`;

  for (let pin = 0; pin < pinCount(node); pin++) {
    const w = wireInto(circuit, node.id, pin);
    drawPin(g, circuit, node, 'in', pin, localInPin(node, pin), w ? val(sim, w.from, w.fromPin) : null);
  }
  for (let pin = 0; pin < outCount(node); pin++) {
    drawPin(g, circuit, node, 'out', pin, localOutPin(node, pin), val(sim, node.id, pin));
  }
}

function drawWires(circuit, sim) {
  const ends = circuit.wires.map((w) => ({
    key: `${w.to}:${w.pin}`,
    source: `${w.from}:${w.fromPin}`,
    a: outPinPos(getNode(circuit, w.from), w.fromPin),
    b: inPinPos(getNode(circuit, w.to), w.pin),
  }));
  // Curved wires are drawn as before; the straight styles are routed, with
  // hops where different signals cross and dots where one signal splits.
  const routed = state.wireStyle === 'curved' ? null : route(ends, state.wireStyle);

  const items = circuit.wires.map((w, i) => {
    const { key, a, b } = ends[i];
    const d = routed ? pathData(routed.wires.get(key)) : wirePath(a, b);
    const selected = state.selected?.type === 'wire' && state.selected.to === w.to && state.selected.pin === w.pin;
    const g = el('g', { class: `wire-group${selected ? ' is-selected' : ''}`, 'data-to': w.to, 'data-pin': w.pin });
    el('path', { d, class: 'wire-hit' }, g);
    el('path', { d, class: `wire ${valueClass(val(sim, w.from, w.fromPin))}` }, g);
    return g;
  });
  const dots = (routed?.junctions ?? []).map((j) => {
    const [id, pin] = j.source.split(':');
    return el('circle', { cx: j.x, cy: j.y, r: 4, class: `junction ${valueClass(val(sim, id, Number(pin)))}` });
  });
  ui.wires.replaceChildren(...items, ...dots);
}

function drawPending() {
  if (!state.pending || !state.pointer) {
    ui.pending.setAttribute('d', '');
    return;
  }
  if (state.pending.from) {
    ui.pending.setAttribute('d', previewPath(outPinPos(getNode(state.circuit, state.pending.from), state.pending.fromPin), state.pointer));
  } else {
    ui.pending.setAttribute('d', previewPath(state.pointer, inPinPos(getNode(state.circuit, state.pending.to), state.pending.pin)));
  }
}

// ---------- Names with subscripts ----------

// A name for HTML: Cin becomes C<sub>in</sub>. The screen reader text stays "Cin".
function nameHTML(name) {
  const { main, sub } = nameParts(name);
  if (!sub) return document.createTextNode(name);
  const span = document.createElement('span');
  span.className = 'name';
  const subEl = document.createElement('sub');
  subEl.textContent = sub;
  span.append(main, subEl);
  return span;
}

// A name for SVG text: the ending is drawn smaller and lower.
function setSvgName(textEl, name) {
  const { main, sub } = nameParts(name);
  textEl.textContent = main;
  if (sub) el('tspan', { class: 'name-sub', dy: '0.3em' }, textEl).textContent = sub;
}

// ---------- Expressions and truth table ----------

function expressionDOM(tree) {
  const span = document.createElement('span');
  if (tree.missing) {
    span.className = 'expr-missing';
    span.textContent = '?';
  } else if (tree.var) {
    span.append(nameHTML(tree.var));
  } else if (tree.not) {
    span.className = 'overbar';
    span.append(expressionDOM(tree.not));
  } else {
    const side = (t) => {
      const inner = expressionDOM(t);
      if (!needsBrackets(t, tree.op)) return [inner];
      return ['(', inner, ')'];
    };
    const symbol = tree.op === 'AND' ? '.' : ` ${SYMBOLS[tree.op]} `;
    span.append(...side(tree.left), symbol, ...side(tree.right));
  }
  return span;
}

function targetBox() {
  const t = TARGETS.find((x) => x.id === state.target);
  if (!t || inside()) return [];
  const box = document.createElement('div');
  box.className = 'status-box target-box';
  const label = document.createElement('span');
  label.className = 'cell-label';
  label.textContent = `Target: ${t.name}`;
  const value = document.createElement('span');
  value.className = 'status-value target-goal';
  value.textContent = t.goal;
  box.append(label, value);
  return [box];
}

function renderExpressions(circuit) {
  const outs = outputs(circuit);
  if (outs.length === 0) {
    const box = document.createElement('div');
    box.className = 'status-box';
    box.innerHTML = '<span class="cell-label">Boolean expression</span><span class="status-value muted">No outputs</span>';
    ui.expressions.replaceChildren(...targetBox(), box);
    return;
  }
  ui.expressions.replaceChildren(...targetBox(), ...outs.map((o) => {
    const box = document.createElement('div');
    box.className = 'status-box';
    const label = document.createElement('span');
    label.className = 'cell-label';
    label.append('Output ', nameHTML(o.name));
    const value = document.createElement('span');
    value.className = 'status-value expr';
    value.append(nameHTML(o.name), ' = ', expressionDOM(expression(circuit, o.id)));
    box.append(label, value);
    return box;
  }));
}

function renderTruthTable(circuit, sim) {
  const t = truthTable(circuit);
  if (t.inputs.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted small';
    p.textContent = 'No inputs';
    ui.truth.replaceChildren(p);
    return;
  }
  const current = inputs(circuit).map((n) => val(sim, n.id)).join('');
  const table = document.createElement('table');
  table.className = `truth-table${inside() ? ' is-readonly' : ''}`;
  const head = table.createTHead().insertRow();
  t.inputs.forEach((name) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.append(nameHTML(name));
    head.append(th);
  });
  t.outputs.forEach((name, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.append(nameHTML(name));
    if (i === 0) th.className = 'first-output';
    head.append(th);
  });
  const body = table.createTBody();
  t.rows.forEach((row) => {
    const tr = body.insertRow();
    const bits = row.inputs.join('');
    if (bits === current) tr.className = 'is-current';
    if (!inside()) {
      tr.tabIndex = 0;
      tr.dataset.bits = bits;
      tr.setAttribute('aria-label', `Set inputs to ${t.inputs.map((n, i) => `${n} = ${row.inputs[i]}`).join(', ')}`);
    }
    row.inputs.forEach((b) => { tr.insertCell().textContent = b; });
    row.outputs.forEach((b, i) => {
      const td = tr.insertCell();
      td.textContent = b ?? '?';
      if (i === 0) td.className = 'first-output';
    });
  });
  ui.truth.replaceChildren(table);
}

// ---------- Rendering ----------

function render() {
  const active = document.activeElement?.dataset?.key;
  const { circuit, sim, trail } = shown(simulate(state.circuit));
  drawWires(circuit, sim);
  ui.nodes.replaceChildren();
  circuit.nodes.forEach((n) => drawNode(circuit, sim, n));
  drawPending();
  ui.canvas.classList.toggle('show-labels', state.labels);
  ui.canvas.classList.toggle('is-wiring', Boolean(state.pending));
  ui.wrap.classList.toggle('is-inside', inside());
  ui.canvasTitle.textContent = ['Circuit', ...trail].join(' › ');
  ui.back.hidden = !inside();
  renderExpressions(circuit);
  renderTruthTable(circuit, sim);
  ui.undo.disabled = inside() || state.undo.length === 0;
  ui.redo.disabled = inside() || state.redo.length === 0;
  ui.del.disabled = inside() || !state.selected;
  ui.check.hidden = !state.target;
  ui.palette.querySelectorAll('button').forEach((b) => { b.disabled = inside(); });
  if (active) ui.canvas.querySelector(`[data-key="${active}"]`)?.focus();
}

// ---------- Actions ----------

function addFromPalette(kind, type) {
  if (inside()) return;
  if (kind === 'input' && inputs(state.circuit).length >= MAX_INPUTS) {
    say(`This tool allows up to ${MAX_INPUTS} inputs, so the truth table stays readable.`, { error: true });
    return;
  }
  if (kind === 'output' && outputs(state.circuit).length >= MAX_OUTPUTS) {
    say(`This tool allows up to ${MAX_OUTPUTS} outputs.`, { error: true });
    return;
  }
  const spot = freeSpot(kind);
  change(() => {
    const r = addNode(state.circuit, { kind, type, ...spot });
    if (r.error) return r;
    state.selected = { type: 'node', id: r.node.id };
    return `Added ${describe(state.circuit, r.node)}.`;
  });
  ui.canvas.querySelector(`[data-key="node:${state.selected?.id}"]`)?.focus();
}

function deleteSelected() {
  const sel = state.selected;
  if (!sel || inside()) return;
  change(() => {
    if (sel.type === 'node') {
      const node = getNode(state.circuit, sel.id);
      if (!node) return null;
      const name = describe(state.circuit, node);
      removeNode(state.circuit, sel.id);
      return `Removed ${name}.`;
    }
    removeWire(state.circuit, sel.to, sel.pin);
    return 'Removed a wire.';
  });
  state.selected = null;
  render();
}

function toggleInput(id) {
  const node = getNode(state.circuit, id);
  if (inside() || !node || node.kind !== 'input') return;
  node.value = 1 - node.value;
  save();
  const sim = simulate(state.circuit);
  say(`Set ${node.name} to ${node.value}.${outputs(state.circuit).length ? ` ${outputSummary(sim)}.` : ''}`);
  render();
}

function setInputs(bits) {
  if (inside()) return;
  inputs(state.circuit).forEach((n, i) => { n.value = Number(bits[i]); });
  save();
  const sim = simulate(state.circuit);
  say(`Set ${inputs(state.circuit).map((n) => `${n.name} = ${n.value}`).join(', ')}.${outputs(state.circuit).length ? ` ${outputSummary(sim)}.` : ''}`);
  render();
}

// "AND gate" or "HALF ADDER (output C)": which pin a wire leaves from or goes to.
function pinName(node, side, pin) {
  const name = describe(state.circuit, node);
  if (node.kind === 'component') return `${name} (${side === 'out' ? 'output' : 'input'} ${side === 'out' ? node.outs[pin] : node.ins[pin]})`;
  if (side === 'in' && pinCount(node) > 1) return `${name} (input ${pin + 1})`;
  return name;
}

// Start or finish a wire at a pin.
function pinPressed(id, side, pin) {
  if (inside()) return;
  const p = state.pending;
  if (p && side === 'in' && p.from) return finishWire(p.from, p.fromPin, id, pin);
  if (p && side === 'out' && p.to) return finishWire(id, pin, p.to, p.pin);
  state.pending = side === 'out' ? { from: id, fromPin: pin } : { to: id, pin };
  const node = getNode(state.circuit, id);
  say(`Wiring from ${side === 'out' ? 'the output of' : 'an input of'} ${pinName(node, side, pin)}. Choose where it goes, or press Escape.`, { log: false });
  render();
}

function finishWire(from, fromPin, to, pin) {
  state.pending = null;
  change(() => {
    const r = connect(state.circuit, from, to, pin, fromPin);
    if (r.error) return r;
    const a = pinName(getNode(state.circuit, from), 'out', fromPin);
    const b = pinName(getNode(state.circuit, to), 'in', pin);
    return `Connected ${a} to ${b}.${r.replaced ? ' This replaced the wire that was there.' : ''}`;
  });
}

function cancelWire() {
  if (!state.pending) return;
  state.pending = null;
  say('Wire cancelled.', { log: false });
  render();
}

function loadCircuit(circuit, message) {
  state.circuit = normalise(circuit);
  state.view = [];
  state.selected = null;
  state.pending = null;
  save();
  say(message);
  render();
}

// ---------- Renaming ----------

function beginRename(id) {
  const node = getNode(state.circuit, id);
  if (inside() || !node || (node.kind !== 'input' && node.kind !== 'output')) return;
  const target = ui.canvas.querySelector(`[data-key="node:${id}"]`);
  const box = target.getBoundingClientRect();
  const wrap = ui.wrap.getBoundingClientRect();
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename';
  input.value = node.name;
  input.maxLength = 4;
  input.setAttribute('aria-label', `New name for ${describe(state.circuit, node)}`);
  input.style.left = `${box.left - wrap.left}px`;
  input.style.top = `${box.top - wrap.top}px`;
  ui.wrap.append(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (commit) => {
    if (done) return;
    if (commit && input.value.trim() !== node.name) {
      const old = node.name;
      const ok = change(() => {
        const r = rename(state.circuit, id, input.value);
        return r.error ? r : `Renamed ${old} to ${input.value.trim()}.`;
      });
      if (!ok) { input.focus(); return; }
    }
    done = true;
    input.remove();
    ui.canvas.querySelector(`[data-key="node:${id}"]`)?.focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); done = true; input.remove(); }
  });
  input.addEventListener('blur', () => { if (!done) { done = true; input.remove(); } });
}

// ---------- Pointer input on the canvas ----------

ui.canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || inside()) return; // the inside of a component is read-only
  const pinEl = e.target.closest('.pin');
  const nodeEl = e.target.closest('.node');
  const wireEl = e.target.closest('.wire-group');
  state.pointer = toCircuitPoint(e);

  if (pinEl) {
    e.preventDefault();
    const { id, side, pin } = pinEl.dataset;
    if (!state.pending) {
      pinPressed(id, side, Number(pin));
      state.pending.dragStart = true;
      ui.canvas.setPointerCapture(e.pointerId);
    } else {
      pinPressed(id, side, Number(pin));
    }
    return;
  }
  if (nodeEl) {
    e.preventDefault();
    const node = getNode(state.circuit, nodeEl.dataset.id);
    state.selected = { type: 'node', id: node.id };
    state.drag = {
      id: node.id, dx: state.pointer.x - node.x, dy: state.pointer.y - node.y,
      startX: state.pointer.x, startY: state.pointer.y, before: clone(state.circuit), moved: false,
    };
    ui.canvas.setPointerCapture(e.pointerId);
    showSelection();
    nodeEl.focus({ preventScroll: true });
    return;
  }
  if (wireEl) {
    state.selected = { type: 'wire', to: wireEl.dataset.to, pin: Number(wireEl.dataset.pin) };
    cancelWire();
    render();
    return;
  }
  state.selected = null;
  cancelWire();
  render();
});

ui.canvas.addEventListener('pointermove', (e) => {
  state.pointer = toCircuitPoint(e);
  if (state.drag) {
    const d = state.drag;
    if (!d.moved && Math.hypot(state.pointer.x - d.startX, state.pointer.y - d.startY) < 4) return;
    d.moved = true;
    const node = getNode(state.circuit, d.id);
    Object.assign(node, clamp(node, state.pointer.x - d.dx, state.pointer.y - d.dy));
    render();
  } else if (state.pending) {
    if (state.pending.dragStart) state.pending.dragged = true;
    drawPending();
  }
});

ui.canvas.addEventListener('pointerup', (e) => {
  if (state.drag) {
    const d = state.drag;
    state.drag = null;
    if (d.moved) {
      state.lastTap = null;
      state.undo.push(d.before);
      state.redo = [];
      save();
      render();
      return;
    }
    // A click. Two quick clicks on the same part count as a double-click.
    // (The browser's own dblclick event is unreliable here, because the
    // first click on an input redraws the circuit, and on touch screens.)
    const node = getNode(state.circuit, d.id);
    const now = Date.now();
    const double = state.lastTap?.id === d.id && now - state.lastTap.time < 350;
    state.lastTap = double ? null : { id: d.id, time: now };
    if (!double) {
      if (node?.kind === 'input') toggleInput(d.id);
      return;
    }
    if (node?.kind === 'component') {
      openComponent(d.id);
    } else if (node?.kind === 'input' || node?.kind === 'output') {
      if (node.kind === 'input') {
        // Undo the first click's switch, so a double-click only renames.
        node.value = 1 - node.value;
        state.log.shift();
        save();
        say(`Renaming ${node.name}.`, { log: false });
        render();
      }
      beginRename(d.id);
    }
    return;
  }
  if (state.pending?.dragged) {
    // A wire dragged from a pin: finish it on whatever pin is under the pointer.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pin');
    const p = state.pending;
    if (target && target.dataset.id !== (p.from ?? p.to)) {
      pinPressed(target.dataset.id, target.dataset.side, Number(target.dataset.pin));
    } else {
      cancelWire();
    }
  } else if (state.pending) {
    state.pending.dragStart = false;
  }
});

// Inside a component nothing can be edited, so pressing a part does nothing
// and the browser's dblclick is reliable: use it to open a nested component.
ui.canvas.addEventListener('dblclick', (e) => {
  if (!inside()) return; // the main circuit spots double-clicks in pointerup
  const nodeEl = (document.elementFromPoint(e.clientX, e.clientY) ?? e.target).closest('.node-component');
  if (nodeEl) openComponent(nodeEl.dataset.id);
});

// ---------- Keyboard ----------

// Update the selection highlight without redrawing the whole circuit.
function showSelection() {
  ui.canvas.querySelectorAll('.node').forEach((n) => n.classList.toggle('is-selected', isSelectedNode(n.dataset.id)));
  ui.canvas.querySelectorAll('.wire-group').forEach((w) => w.classList.toggle('is-selected',
    state.selected?.type === 'wire' && state.selected.to === w.dataset.to && state.selected.pin === Number(w.dataset.pin)));
  ui.del.disabled = !state.selected;
}

ui.canvas.addEventListener('focusin', (e) => {
  const key = e.target.dataset?.key;
  if (key?.startsWith('node:') && !isSelectedNode(key.slice(5))) {
    state.selected = { type: 'node', id: key.slice(5) };
    showSelection();
  }
});

ui.canvas.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target.classList.contains('pin') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    pinPressed(target.dataset.id, target.dataset.side, Number(target.dataset.pin));
    return;
  }
  const key = target.dataset?.key;
  if (!key?.startsWith('node:')) return;
  const id = key.slice(5);
  if (target.classList.contains('node-component') && e.key === 'Enter') {
    e.preventDefault();
    openComponent(id);
    return;
  }
  if (inside()) return;
  const node = getNode(state.circuit, id);
  const step = e.shiftKey ? 40 : 10;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dx, dy] = moves[e.key];
    change(() => { Object.assign(node, clamp(node, node.x + dx, node.y + dy)); return null; });
  } else if ((e.key === 'Enter' || e.key === ' ') && node.kind === 'input') {
    e.preventDefault();
    toggleInput(id);
  } else if (e.key === 'F2') {
    e.preventDefault();
    beginRename(id);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && !inside() && state.selected && ui.canvas.contains(document.activeElement)) {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape') {
    // Menus and dialogs handle their own Escape.
    if (!$('settings-menu').hidden || document.querySelector('dialog[open]')) return;
    if (state.pending) cancelWire();
    else closeComponent();
  }
});

// ---------- Truth table clicks ----------

ui.truth.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-bits]');
  if (tr) setInputs(tr.dataset.bits);
});
ui.truth.addEventListener('keydown', (e) => {
  const tr = e.target.closest('tr[data-bits]');
  if (tr && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    setInputs(tr.dataset.bits);
    ui.truth.querySelector(`tr[data-bits="${tr.dataset.bits}"]`)?.focus();
  }
});

// ---------- Tool bar and settings ----------

function paletteButton(label, svg, onClick, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'palette-button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = `${svg}<span>${label}</span>`;
  b.addEventListener('click', onClick);
  return b;
}

const INPUT_ICON = '<svg class="gate-symbol" viewBox="-1 -1 66 46" width="28" height="20" aria-hidden="true" stroke-width="3"><rect x="6" y="8" width="40" height="28" rx="4" class="body"/><path d="M46 22 H64" class="lead"/></svg>';
const OUTPUT_ICON = '<svg class="gate-symbol" viewBox="-1 -1 66 46" width="28" height="20" aria-hidden="true" stroke-width="3"><path d="M0 22 H20" class="lead"/><circle cx="40" cy="22" r="18" class="body"/></svg>';

const COMPONENT_ICON = '<svg class="gate-symbol" viewBox="-1 -1 66 46" width="28" height="20" aria-hidden="true" stroke-width="3"><path d="M0 14 H12 M0 30 H12 M52 14 H64 M52 30 H64" class="lead"/><rect x="12" y="4" width="40" height="36" rx="3" class="body"/></svg>';

// localStorage can be missing or blocked; the library and slot modules cope
// with a storage that throws, and report it when saving.
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => { throw new Error('No storage'); } };
  }
})();

// Inputs, outputs, the six gates, then the user's own components.
function renderPalette() {
  const base = [
    paletteButton('Input', INPUT_ICON, () => addFromPalette('input'), 'Add an input'),
    paletteButton('Output', OUTPUT_ICON, () => addFromPalette('output'), 'Add an output'),
    ...GATE_TYPES.map((type) => paletteButton(type, gateSymbolSVG(type, { width: 28, height: 20, strokeWidth: 3 }), () => addFromPalette('gate', type), `Add a ${type} gate`)),
  ];
  const own = readLibrary(store).map((def) => {
    const b = paletteButton(def.name, COMPONENT_ICON, () => addComponentFromLibrary(def.id), `Add a ${def.name} component`);
    b.classList.add('palette-component');
    return b;
  });
  ui.palette.replaceChildren(...base, ...own);
  ui.palette.querySelectorAll('button').forEach((b) => { b.disabled = inside(); });
}

function addComponentFromLibrary(id) {
  const def = readLibrary(store).find((d) => d.id === id);
  if (!def || inside()) return;
  const probe = { kind: 'component', ins: def.inputs, outs: def.outputs };
  const spot = freeSpot('component', nodeSize(probe));
  change(() => {
    const { node } = addComponent(state.circuit, def, spot);
    state.selected = { type: 'node', id: node.id };
    return `Added ${describe(state.circuit, node)}.`;
  });
  ui.canvas.querySelector(`[data-key="node:${state.selected?.id}"]`)?.focus();
}

ui.back.addEventListener('click', closeComponent);
ui.undo.addEventListener('click', undo);
ui.redo.addEventListener('click', redo);
ui.del.addEventListener('click', deleteSelected);

for (const ex of EXAMPLES) {
  const opt = document.createElement('option');
  opt.value = ex.id;
  opt.textContent = ex.title;
  ui.examples.append(opt);
}
ui.examples.addEventListener('change', () => {
  const ex = EXAMPLES.find((x) => x.id === ui.examples.value);
  ui.examples.value = '';
  settings.close(false);
  if (!ex) return;
  state.undo.push(clone(state.circuit));
  state.redo = [];
  loadCircuit(ex.circuit, `Loaded example: ${ex.title}.`);
});

for (const [value, label] of Object.entries(WIRE_STYLES)) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  ui.wireStyle.append(opt);
}
ui.wireStyle.addEventListener('change', () => {
  state.wireStyle = ui.wireStyle.value;
  save();
  render();
  renderSlots();
});

ui.showLabels.addEventListener('change', () => {
  state.labels = ui.showLabels.checked;
  save();
  render();
});

ui.clear.addEventListener('click', () => {
  settings.close(false);
  if (state.circuit.nodes.length === 0) return;
  change(() => {
    state.circuit = emptyCircuit();
    state.selected = null;
    return 'Cleared the circuit. Undo brings it back.';
  });
});

// ---------- Components dialog ----------

function renderComponentList() {
  const list = readLibrary(store);
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'None yet.';
    ui.componentList.replaceChildren(li);
    return;
  }
  ui.componentList.replaceChildren(...list.map((def) => {
    const li = document.createElement('li');
    li.className = 'component-item';
    const info = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = def.name;
    const pins = document.createElement('span');
    pins.className = 'muted small';
    pins.append(' Inputs ');
    def.inputs.forEach((n, i) => pins.append(i ? ', ' : '', nameHTML(n)));
    pins.append('; outputs ');
    def.outputs.forEach((n, i) => pins.append(i ? ', ' : '', nameHTML(n)));
    info.append(name, pins);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'button';
    del.textContent = 'Delete';
    del.dataset.remove = def.id;
    del.setAttribute('aria-label', `Delete the ${def.name} component`);
    li.append(info, del);
    return li;
  }));
}

function openComponentsDialog() {
  settings.close(false);
  ui.componentError.textContent = '';
  ui.componentName.value = '';
  renderComponentList();
  ui.componentsDialog.showModal();
  ui.componentName.focus();
}

ui.componentsOpen.addEventListener('click', openComponentsDialog);
ui.componentsClose.addEventListener('click', () => ui.componentsDialog.close());
ui.componentsDialog.addEventListener('click', (e) => {
  if (e.target === ui.componentsDialog) { ui.componentsDialog.close(); return; }
  const remove = e.target.closest('[data-remove]');
  if (!remove) return;
  const def = readLibrary(store).find((d) => d.id === remove.dataset.remove);
  const r = removeFromLibrary(store, remove.dataset.remove);
  if (r.error) { ui.componentError.textContent = r.error; return; }
  say(`Deleted the ${def?.name ?? ''} component from your list. Circuits already using it keep their copy.`);
  renderComponentList();
  renderPalette();
});
ui.componentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const made = makeComponent(state.circuit, ui.componentName.value, `comp-${Date.now().toString(36)}`);
  if (made.error) { ui.componentError.textContent = made.error; return; }
  const r = addToLibrary(store, made.def);
  if (r.error) { ui.componentError.textContent = r.error; return; }
  ui.componentsDialog.close();
  renderPalette();
  const { def } = made;
  say(`Made the ${def.name} component (inputs ${def.inputs.join(', ')}; outputs ${def.outputs.join(', ')}).${r.replaced ? ' It replaces the one with the same name.' : ''} It is now in the tool bar.`);
});

// ---------- Targets and checks ----------

for (const t of TARGETS) {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.name;
  ui.target.append(opt);
}
ui.target.addEventListener('change', () => {
  state.target = ui.target.value;
  ui.check.dataset.result = '';
  save();
  const t = TARGETS.find((x) => x.id === state.target);
  say(t ? `Target: ${t.name}. ${t.goal} Press Check when it's ready.` : 'No target.', { log: Boolean(t) });
  render();
});

function runCheck() {
  const t = TARGETS.find((x) => x.id === state.target);
  if (!t) return;
  state.view = [];
  const r = check(state.circuit, t);
  if (r.values) {
    // Show the failing case: set the inputs to it, so the wrong value is on screen.
    for (const n of inputs(state.circuit)) if (n.name in r.values) n.value = r.values[n.name];
    save();
  }
  ui.check.dataset.result = r.pass ? 'pass' : 'fail';
  say(r.message, { error: !r.pass });
  render();
}
ui.check.addEventListener('click', runCheck);

// ---------- Gate reference ----------

for (const type of GATE_TYPES) {
  const tr = document.createElement('tr');
  const two = GATES[type].inputs === 2;
  const exprText = {
    NOT: '<span class="overbar">A</span>',
    AND: 'A.B',
    OR: 'A + B',
    XOR: 'A ⊕ B',
    NAND: '<span class="overbar">A.B</span>',
    NOR: '<span class="overbar">A + B</span>',
  }[type];
  const rows = two
    ? [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td><td class="first-output">${GATES[type].fn([a, b])}</td></tr>`).join('')
    : [0, 1].map((a) => `<tr><td>${a}</td><td class="first-output">${GATES[type].fn([a])}</td></tr>`).join('');
  const head = two ? '<th>A</th><th>B</th><th class="first-output">Q</th>' : '<th>A</th><th class="first-output">Q</th>';
  tr.innerHTML = `<td>${type}</td><td>${gateSymbolSVG(type, { width: 64, height: 44 })}</td><td class="expr">Q = ${exprText}</td><td><table class="truth-table mini"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></td>`;
  ui.gateRef.append(tr);
}

// ---------- Saved circuits ----------

const slotStorage = store;

const DELETE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>';

// A question waiting for an answer: { slot, action: 'replace' | 'delete', where: 'strip' | 'dialog' }
let asking = null;

function describeSlot(i, slot) {
  return slot ? `Slot ${i + 1}: ${summary(slot.circuit)}, saved ${savedWhen(slot.savedAt)}` : `Slot ${i + 1}: empty`;
}

const picture = (slot) => thumbnailSVG(slot.circuit, { wireStyle: state.wireStyle });

// The slots beside the circuit. A filled slot loads when pressed and has a
// small delete button in its corner.
function renderSlots() {
  const slots = readSlots(slotStorage);
  ui.slotList.replaceChildren(...slots.map((slot, i) => {
    const li = document.createElement('li');
    li.className = 'slot-item';
    if (asking?.where === 'strip' && asking.slot === i) {
      li.innerHTML = `<div class="slot slot-asking" role="group" aria-label="Delete slot ${i + 1}?">
          <span class="slot-question">Delete slot ${i + 1}?</span>
          <span class="slot-question-buttons">
            <button type="button" class="button" data-strip-delete="${i}">Delete</button>
            <button type="button" class="button" data-strip-keep="${i}">Keep</button>
          </span>
        </div>`;
      return li;
    }
    const label = describeSlot(i, slot);
    li.innerHTML = `<button type="button" class="slot" data-load="${i}" ${slot ? '' : 'disabled'}>
        <span class="slot-number">${i + 1}</span>${slot ? picture(slot) : '<span class="slot-empty-label">Empty</span>'}
      </button>${slot ? `<button type="button" class="slot-delete" data-strip-ask="${i}" aria-label="Delete slot ${i + 1}" title="Delete slot ${i + 1}">${DELETE_ICON}</button>` : ''}`;
    const b = li.querySelector('.slot');
    b.setAttribute('aria-label', slot ? `${label}. Press to load.` : label);
    b.title = slot ? `${label}. Click to load.` : label;
    return li;
  }));
}

function deleteSlot(i) {
  const r = clearSlot(slotStorage, i);
  asking = null;
  if (r.error) say(r.error, { error: true });
  else say(`Deleted the circuit in slot ${i + 1}.`);
  renderSlots();
  if (ui.saveDialog.open) renderSlotCards();
}

ui.slotList.addEventListener('click', (e) => {
  const load = e.target.closest('[data-load]');
  const ask = e.target.closest('[data-strip-ask]');
  const yes = e.target.closest('[data-strip-delete]');
  const no = e.target.closest('[data-strip-keep]');
  if (ask) {
    const i = Number(ask.dataset.stripAsk);
    asking = { slot: i, action: 'delete', where: 'strip' };
    renderSlots();
    ui.slotList.querySelector(`[data-strip-keep="${i}"]`)?.focus();
  } else if (yes) {
    const i = Number(yes.dataset.stripDelete);
    deleteSlot(i);
    ui.slotList.querySelector(`[data-load="${i}"]`)?.focus();
  } else if (no) {
    const i = Number(no.dataset.stripKeep);
    asking = null;
    renderSlots();
    ui.slotList.querySelector(`[data-strip-ask="${i}"]`)?.focus();
  } else if (load && !load.disabled) {
    const i = Number(load.dataset.load);
    const slot = readSlots(slotStorage)[i];
    if (!slot) return;
    state.undo.push(clone(state.circuit));
    state.redo = [];
    loadCircuit(slot.circuit, `Loaded slot ${i + 1} (saved ${savedWhen(slot.savedAt)}). Undo goes back to the previous circuit.`);
  }
});

// The save overlay: a large card for each slot, with a picture of what it holds.
function renderSlotCards() {
  const slots = readSlots(slotStorage);
  ui.slotCards.replaceChildren(...slots.map((slot, i) => {
    const li = document.createElement('li');
    const art = `<span class="slot-card-picture">${slot ? picture(slot) : 'Empty'}</span>`;
    const q = asking?.where === 'dialog' && asking.slot === i ? asking.action : null;
    li.className = `slot-card${q ? ' is-confirming' : ''}`;
    if (q) {
      const question = q === 'replace'
        ? `Replace the circuit in slot ${i + 1}? It will be lost.`
        : `Delete the circuit in slot ${i + 1}? It will be lost.`;
      li.innerHTML = `<div class="slot-confirm">
          <span class="slot-card-title">Slot ${i + 1}</span>
          ${art}
          <span>${question}</span>
          <span class="slot-confirm-buttons">
            <button type="button" class="button" data-yes="${i}">${q === 'replace' ? 'Replace' : 'Delete'}</button>
            <button type="button" class="button" data-no="${i}">Keep it</button>
          </span>
        </div>`;
      return li;
    }
    li.innerHTML = `<button type="button" class="slot-card-pick" data-slot="${i}">
        <span class="slot-card-title">Slot ${i + 1}</span>
        ${art}
        <span class="slot-card-meta">${slot ? `${summary(slot.circuit)}<br>Saved ${savedWhen(slot.savedAt)}` : ''}</span>
        <span class="slot-card-action">${slot ? 'Replace…' : 'Save here'}</span>
      </button>${slot ? `<div class="slot-card-foot"><button type="button" class="button slot-card-delete" data-ask-delete="${i}">Delete</button></div>` : ''}`;
    li.querySelector('.slot-card-pick').setAttribute('aria-label', `${describeSlot(i, slot)}. ${slot ? 'Press to replace it.' : 'Press to save here.'}`);
    li.querySelector('.slot-card-delete')?.setAttribute('aria-label', `Delete slot ${i + 1}`);
    return li;
  }));
}

function openSaveDialog() {
  settings.close(false);
  if (state.circuit.nodes.length === 0) {
    say('The circuit is empty, so there is nothing to save.', { error: true });
    return;
  }
  asking = null;
  renderSlots();
  renderSlotCards();
  ui.saveDialog.showModal();
  ui.slotCards.querySelector('button')?.focus();
}

function saveTo(i) {
  const r = writeSlot(slotStorage, i, state.circuit);
  asking = null;
  ui.saveDialog.close();
  if (r.error) {
    say(r.error, { error: true });
    return;
  }
  renderSlots();
  say(`Saved in slot ${i + 1}.`);
}

ui.saveOpen.addEventListener('click', openSaveDialog);
ui.saveClose.addEventListener('click', () => ui.saveDialog.close());
ui.saveDialog.addEventListener('click', (e) => {
  if (e.target === ui.saveDialog) { ui.saveDialog.close(); return; } // the backdrop
  const pick = e.target.closest('[data-slot]');
  const askDelete = e.target.closest('[data-ask-delete]');
  const yes = e.target.closest('[data-yes]');
  const no = e.target.closest('[data-no]');
  if (pick) {
    const i = Number(pick.dataset.slot);
    if (readSlots(slotStorage)[i]) {
      asking = { slot: i, action: 'replace', where: 'dialog' };
      renderSlotCards();
      ui.slotCards.querySelector(`[data-no="${i}"]`)?.focus();
    } else {
      saveTo(i);
    }
  } else if (askDelete) {
    const i = Number(askDelete.dataset.askDelete);
    asking = { slot: i, action: 'delete', where: 'dialog' };
    renderSlotCards();
    ui.slotCards.querySelector(`[data-no="${i}"]`)?.focus();
  } else if (yes) {
    const i = Number(yes.dataset.yes);
    if (asking?.action === 'delete') {
      deleteSlot(i);
      ui.slotCards.querySelector(`[data-slot="${i}"]`)?.focus();
    } else {
      saveTo(i);
    }
  } else if (no) {
    const i = Number(no.dataset.no);
    asking = null;
    renderSlotCards();
    ui.slotCards.querySelector(`[data-slot="${i}"]`)?.focus();
  }
});
ui.saveDialog.addEventListener('close', () => { asking = null; });

// ---------- Start-up ----------

function start() {
  const saved = loadSaved();
  if (saved && isValidCircuit(saved.circuit)) {
    state.circuit = normalise(saved.circuit);
    state.labels = saved.labels !== false;
    if (WIRE_STYLES[saved.wireStyle]) state.wireStyle = saved.wireStyle;
    if (TARGETS.some((t) => t.id === saved.target)) state.target = saved.target;
  } else {
    state.circuit = normalise(EXAMPLES[0].circuit);
  }
  ui.showLabels.checked = state.labels;
  ui.wireStyle.value = state.wireStyle;
  ui.target.value = state.target;
  renderPalette();
  render();
  renderSlots();
}

start();
