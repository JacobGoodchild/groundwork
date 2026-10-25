// Logic gate circuits: model, evaluation, truth tables and Boolean expressions.
// No DOM code, so it can be unit-tested with Node and reused later (adders,
// the ALU and the build-a-computer workshop).

export const GATES = {
  NOT: { inputs: 1, fn: ([a]) => 1 - a, name: 'NOT' },
  AND: { inputs: 2, fn: ([a, b]) => a & b, name: 'AND' },
  OR: { inputs: 2, fn: ([a, b]) => a | b, name: 'OR' },
  XOR: { inputs: 2, fn: ([a, b]) => a ^ b, name: 'XOR' },
  NAND: { inputs: 2, fn: ([a, b]) => 1 - (a & b), name: 'NAND' },
  NOR: { inputs: 2, fn: ([a, b]) => 1 - (a | b), name: 'NOR' },
};
export const GATE_TYPES = Object.keys(GATES);

export const MAX_INPUTS = 5;
export const MAX_OUTPUTS = 4;
const INPUT_NAMES = 'ABCDEFGHIJKLMNOP'.split('');
const OUTPUT_NAMES = 'QRSTUVWXYZ'.split('');
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,3}$/;

// ---------------------------------------------------------------------------
// Circuit model
//
// A circuit is plain data, so it can be saved, copied and compared:
// {
//   nodes: [{ id, kind: 'input'|'output'|'gate', type?, name?, x, y, value? }],
//   wires: [{ from: nodeId, to: nodeId, pin: inputIndex }],
// }
// Inputs have a value (0 or 1). Gates have a type from GATES. Outputs have
// one input pin. Each input pin takes at most one wire; an output (of an
// input switch or a gate) can feed any number of pins.
// ---------------------------------------------------------------------------

export function emptyCircuit() {
  return { nodes: [], wires: [] };
}

export function clone(circuit) {
  return JSON.parse(JSON.stringify(circuit));
}

export function pinCount(node) {
  if (node.kind === 'input') return 0;
  if (node.kind === 'output') return 1;
  return GATES[node.type].inputs;
}

export function hasOutput(node) {
  return node.kind !== 'output';
}

export function getNode(circuit, id) {
  return circuit.nodes.find((n) => n.id === id) ?? null;
}

function nextId(circuit, prefix) {
  let i = 1;
  while (circuit.nodes.some((n) => n.id === `${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

function freeName(circuit, names) {
  const used = new Set(circuit.nodes.map((n) => n.name));
  return names.find((n) => !used.has(n)) ?? null;
}

export function inputs(circuit) {
  return circuit.nodes.filter((n) => n.kind === 'input').sort((a, b) => a.name.localeCompare(b.name));
}

export function outputs(circuit) {
  return circuit.nodes.filter((n) => n.kind === 'output').sort((a, b) => a.name.localeCompare(b.name));
}

// A short human label for a node, used in the log and for screen readers:
// "input A", "output Q", "AND gate 2".
export function describe(circuit, node) {
  if (node.kind === 'input') return `input ${node.name}`;
  if (node.kind === 'output') return `output ${node.name}`;
  const same = circuit.nodes.filter((n) => n.kind === 'gate' && n.type === node.type);
  const number = same.indexOf(node) + 1;
  return same.length > 1 ? `${node.type} gate ${number}` : `${node.type} gate`;
}

/**
 * Add a node. Returns { node } or { error }.
 * kind 'gate' needs `type`. Inputs and outputs are named automatically
 * (A, B, C… and Q, R, S…) unless a name is given.
 */
export function addNode(circuit, { kind, type, name, x = 0, y = 0 }) {
  let node;
  if (kind === 'gate') {
    if (!GATES[type]) return { error: `${type} is not a gate this tool knows.` };
    node = { id: nextId(circuit, 'g'), kind, type, x, y };
  } else if (kind === 'input') {
    if (inputs(circuit).length >= MAX_INPUTS) {
      return { error: `A circuit can have up to ${MAX_INPUTS} inputs, so the truth table stays readable.` };
    }
    node = { id: nextId(circuit, 'in'), kind, name: name ?? freeName(circuit, INPUT_NAMES), x, y, value: 0 };
  } else if (kind === 'output') {
    if (outputs(circuit).length >= MAX_OUTPUTS) {
      return { error: `A circuit can have up to ${MAX_OUTPUTS} outputs.` };
    }
    node = { id: nextId(circuit, 'out'), kind, name: name ?? freeName(circuit, OUTPUT_NAMES), x, y };
  } else {
    return { error: `Unknown kind of node: ${kind}.` };
  }
  circuit.nodes.push(node);
  return { node };
}

export function removeNode(circuit, id) {
  circuit.nodes = circuit.nodes.filter((n) => n.id !== id);
  circuit.wires = circuit.wires.filter((w) => w.from !== id && w.to !== id);
}

export function removeWire(circuit, to, pin) {
  circuit.wires = circuit.wires.filter((w) => !(w.to === to && w.pin === pin));
}

export function wireInto(circuit, to, pin) {
  return circuit.wires.find((w) => w.to === to && w.pin === pin) ?? null;
}

// Rename an input or output. Returns { ok } or { error }.
export function rename(circuit, id, name) {
  const node = getNode(circuit, id);
  if (!node || node.kind === 'gate') return { error: 'Only inputs and outputs have names.' };
  const clean = name.trim();
  if (!NAME_PATTERN.test(clean)) {
    return { error: 'A name starts with a letter and has at most 4 letters or digits, for example A or Cin.' };
  }
  if (circuit.nodes.some((n) => n.id !== id && n.name === clean)) {
    return { error: `${clean} is already used. Each input and output needs a different name.` };
  }
  node.name = clean;
  return { ok: true };
}

// Would a wire from `from` into `to` create a loop (feedback)?
function reaches(circuit, start, target) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const w of circuit.wires) if (w.from === id) stack.push(w.to);
  }
  return false;
}

/**
 * Connect the output of node `from` to input `pin` of node `to`.
 * Replaces any wire already in that pin. Returns { ok, replaced } or { error }.
 */
export function connect(circuit, from, to, pin) {
  const a = getNode(circuit, from);
  const b = getNode(circuit, to);
  if (!a || !b) return { error: 'Both ends of a wire must be on the circuit.' };
  if (!hasOutput(a)) return { error: 'A wire must start from an input or a gate output.' };
  if (pin < 0 || pin >= pinCount(b)) return { error: 'A wire must end at a gate input or an output.' };
  if (from === to || reaches(circuit, to, from)) {
    return { error: 'That wire would feed a gate\'s output back into itself. Circuits here must flow one way, from inputs to outputs.' };
  }
  const existing = wireInto(circuit, to, pin);
  if (existing && existing.from === from) return { ok: true, replaced: false };
  if (existing) removeWire(circuit, to, pin);
  circuit.wires.push({ from, to, pin });
  return { ok: true, replaced: Boolean(existing) };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Work out the value at every node. `values` maps input names to 0 or 1;
 * any input not in `values` uses its own `value`.
 * Returns a Map of node id -> 0 | 1 | null. null means "not known", because
 * a pin somewhere upstream has no wire.
 */
export function evaluate(circuit, values = {}) {
  const result = new Map();
  const visit = (node) => {
    if (result.has(node.id)) return result.get(node.id);
    result.set(node.id, null); // guards against loops in hand-edited data
    let v;
    if (node.kind === 'input') {
      v = node.name in values ? values[node.name] : (node.value ?? 0);
    } else {
      const ins = [];
      for (let pin = 0; pin < pinCount(node); pin++) {
        const w = wireInto(circuit, node.id, pin);
        ins.push(w ? visit(getNode(circuit, w.from)) : null);
      }
      if (ins.some((x) => x === null)) v = null;
      else v = node.kind === 'output' ? ins[0] : GATES[node.type].fn(ins);
    }
    result.set(node.id, v);
    return v;
  };
  circuit.nodes.forEach(visit);
  return result;
}

/**
 * Truth table for the whole circuit.
 * Returns { inputs: [names], outputs: [names], rows: [{ inputs: [0|1], outputs: [0|1|null] }] }
 * Rows count up in binary with the first input as the most significant bit,
 * the order AQA uses.
 */
export function truthTable(circuit) {
  const ins = inputs(circuit);
  const outs = outputs(circuit);
  const rows = [];
  for (let r = 0; r < 2 ** ins.length; r++) {
    const values = {};
    const bits = ins.map((node, i) => {
      const bit = (r >> (ins.length - 1 - i)) & 1;
      values[node.name] = bit;
      return bit;
    });
    const v = evaluate(circuit, values);
    rows.push({ inputs: bits, outputs: outs.map((o) => v.get(o.id)) });
  }
  return { inputs: ins.map((n) => n.name), outputs: outs.map((n) => n.name), rows };
}

// ---------------------------------------------------------------------------
// Boolean expressions (AQA notation)
//
// expression() returns a tree:
//   { var: 'A' } | { not: tree } | { op: 'AND'|'OR'|'XOR', left, right } | { missing: true }
// NAND and NOR become NOT over AND and OR, which is how AQA writes them:
// an overbar across the whole term.
// ---------------------------------------------------------------------------

export function expression(circuit, outputId) {
  const build = (id, depth) => {
    const node = getNode(circuit, id);
    if (depth > circuit.nodes.length + 1) return { missing: true };
    if (node.kind === 'input') return { var: node.name };
    const args = [];
    for (let pin = 0; pin < pinCount(node); pin++) {
      const w = wireInto(circuit, node.id, pin);
      args.push(w ? build(w.from, depth + 1) : { missing: true });
    }
    if (node.kind === 'output') return args[0];
    switch (node.type) {
      case 'NOT': return { not: args[0] };
      case 'AND': return { op: 'AND', left: args[0], right: args[1] };
      case 'OR': return { op: 'OR', left: args[0], right: args[1] };
      case 'XOR': return { op: 'XOR', left: args[0], right: args[1] };
      case 'NAND': return { not: { op: 'AND', left: args[0], right: args[1] } };
      case 'NOR': return { not: { op: 'OR', left: args[0], right: args[1] } };
      default: return { missing: true };
    }
  };
  return build(outputId, 0);
}

export const SYMBOLS = { AND: '.', OR: '+', XOR: '⊕' };
const PRECEDENCE = { AND: 2, OR: 1, XOR: 1 };

// Does `child` need brackets when it is an operand of `parentOp`?
// An overbar already groups what is under it, so NOT never needs brackets.
export function needsBrackets(child, parentOp) {
  if (!child.op) return false;
  if (child.op === parentOp && parentOp !== 'XOR') return false;
  if (parentOp === 'XOR' || child.op === 'XOR') return true;
  return PRECEDENCE[child.op] < PRECEDENCE[parentOp];
}

/**
 * Plain-text form for logs and tests. NOT is written as ¬ before a single
 * letter and as ¬(…) before anything longer; on the page it is drawn as an
 * overbar instead. A missing wire shows as ?.
 */
export function toText(tree) {
  if (tree.missing) return '?';
  if (tree.var) return tree.var;
  if (tree.not) {
    const inner = toText(tree.not);
    return tree.not.var || tree.not.missing ? `¬${inner}` : `¬(${inner})`;
  }
  const side = (t) => (needsBrackets(t, tree.op) ? `(${toText(t)})` : toText(t));
  return `${side(tree.left)} ${SYMBOLS[tree.op]} ${side(tree.right)}`.replace(/ \. /g, '.');
}

// ---------------------------------------------------------------------------
// Checking a saved or example circuit
// ---------------------------------------------------------------------------

export function isValidCircuit(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.wires)) return false;
  const ids = new Set();
  for (const n of data.nodes) {
    if (typeof n.id !== 'string' || ids.has(n.id)) return false;
    ids.add(n.id);
    if (!['input', 'output', 'gate'].includes(n.kind)) return false;
    if (n.kind === 'gate' && !GATES[n.type]) return false;
    if (n.kind !== 'gate' && typeof n.name !== 'string') return false;
    if (typeof n.x !== 'number' || typeof n.y !== 'number') return false;
  }
  const test = emptyCircuit();
  test.nodes = data.nodes;
  for (const w of data.wires) {
    if (!ids.has(w.from) || !ids.has(w.to)) return false;
    if (connect(test, w.from, w.to, w.pin).error) return false;
  }
  return true;
}
