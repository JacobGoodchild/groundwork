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

const INPUT_NAMES = 'ABCDEFGHIJKLMNOP'.split('');
const OUTPUT_NAMES = 'QRSTUVWXYZ'.split('');
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,3}$/;
const COMPONENT_NAME = /^[A-Za-z][A-Za-z0-9 ]{0,13}$/;
const MAX_DEPTH = 20; // components inside components, at most this deep

// ---------------------------------------------------------------------------
// Circuit model
//
// A circuit is plain data, so it can be saved, copied and compared:
// {
//   nodes: [{ id, kind: 'input'|'output'|'gate'|'component', type?, name?, x, y, value?, ins?, outs? }],
//   wires: [{ from: nodeId, fromPin: outputIndex, to: nodeId, pin: inputIndex }],
//   components: { [id]: { id, name, inputs: [names], outputs: [names], circuit } },
// }
// Inputs have a value (0 or 1). Gates have a type from GATES. Outputs have
// one input pin. A component node is a box whose inside is another circuit:
// its `type` is the id of a definition in `components`, and `ins` and `outs`
// are its pin names. Definitions are stored in the circuit that uses them,
// so a saved circuit always carries everything it needs.
// Each input pin takes at most one wire; an output pin can feed any number.
// ---------------------------------------------------------------------------

export function emptyCircuit() {
  return { nodes: [], wires: [], components: {} };
}

// Fill in parts that older saved circuits don't have (wires without
// fromPin, no components). Returns a new circuit.
export function normalise(circuit) {
  const c = clone(circuit);
  c.wires = c.wires.map((w) => ({ from: w.from, fromPin: w.fromPin ?? 0, to: w.to, pin: w.pin }));
  c.components = c.components ?? {};
  for (const def of Object.values(c.components)) def.circuit = normalise(def.circuit);
  return c;
}

export function clone(circuit) {
  return JSON.parse(JSON.stringify(circuit));
}

// Number of input pins.
export function pinCount(node) {
  if (node.kind === 'input') return 0;
  if (node.kind === 'output') return 1;
  if (node.kind === 'component') return node.ins.length;
  return GATES[node.type].inputs;
}

// Number of output pins.
export function outCount(node) {
  if (node.kind === 'output') return 0;
  if (node.kind === 'component') return node.outs.length;
  return 1;
}

export function hasOutput(node) {
  return outCount(node) > 0;
}

export function definitionOf(circuit, node) {
  return node.kind === 'component' ? circuit.components?.[node.type] ?? null : null;
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

// How a name is displayed: one capital letter followed by lowercase letters
// or digits is written with the ending as a subscript, as in exam papers:
// Cin -> C with subscript "in", A1 -> A with subscript "1". Other names are
// shown as they are. Returns { main, sub } (sub is '' when there is none).
export function nameParts(name) {
  const m = /^([A-Z])([a-z0-9]+)$/.exec(name);
  return m ? { main: m[1], sub: m[2] } : { main: name, sub: '' };
}

// A short human label for a node, used in the log and for screen readers:
// "input A", "output Q", "AND gate 2".
export function describe(circuit, node) {
  if (node.kind === 'input') return `input ${node.name}`;
  if (node.kind === 'output') return `output ${node.name}`;
  const same = circuit.nodes.filter((n) => n.kind === node.kind && n.type === node.type);
  const number = same.length > 1 ? ` ${same.indexOf(node) + 1}` : '';
  if (node.kind === 'component') return `${definitionOf(circuit, node)?.name ?? 'component'}${number}`;
  return `${node.type} gate${number}`;
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
    const n = name ?? freeName(circuit, INPUT_NAMES);
    if (!n) return { error: 'There are no free input names left.' };
    node = { id: nextId(circuit, 'in'), kind, name: n, x, y, value: 0 };
  } else if (kind === 'output') {
    const n = name ?? freeName(circuit, OUTPUT_NAMES);
    if (!n) return { error: 'There are no free output names left.' };
    node = { id: nextId(circuit, 'out'), kind, name: n, x, y };
  } else {
    return { error: `Unknown kind of node: ${kind}.` };
  }
  circuit.nodes.push(node);
  return { node };
}

export function removeNode(circuit, id) {
  circuit.nodes = circuit.nodes.filter((n) => n.id !== id);
  circuit.wires = circuit.wires.filter((w) => w.from !== id && w.to !== id);
  // Forget component definitions that nothing uses any more.
  for (const defId of Object.keys(circuit.components ?? {})) {
    if (!circuit.nodes.some((n) => n.kind === 'component' && n.type === defId)) delete circuit.components[defId];
  }
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
  if (!node || (node.kind !== 'input' && node.kind !== 'output')) return { error: 'Only inputs and outputs have names.' };
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
 * Connect output `fromPin` of node `from` to input `pin` of node `to`.
 * Replaces any wire already in that pin. Returns { ok, replaced } or { error }.
 */
export function connect(circuit, from, to, pin, fromPin = 0) {
  const a = getNode(circuit, from);
  const b = getNode(circuit, to);
  if (!a || !b) return { error: 'Both ends of a wire must be on the circuit.' };
  if (fromPin < 0 || fromPin >= outCount(a)) return { error: 'A wire must start from an input or a gate output.' };
  if (pin < 0 || pin >= pinCount(b)) return { error: 'A wire must end at a gate input or an output.' };
  if (from === to || reaches(circuit, to, from)) {
    return { error: 'That wire would feed a gate\'s output back into itself. Circuits here must flow one way, from inputs to outputs.' };
  }
  const existing = wireInto(circuit, to, pin);
  if (existing && existing.from === from && (existing.fromPin ?? 0) === fromPin) return { ok: true, replaced: false };
  if (existing) removeWire(circuit, to, pin);
  circuit.wires.push({ from, fromPin, to, pin });
  return { ok: true, replaced: Boolean(existing) };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Simulate a circuit. `values` maps input names to 0 or 1; an input not in
 * `values` uses its own `value`. Returns:
 *   out:   Map of node id -> array of output values (0 | 1 | null). null means
 *          "not known", because a pin somewhere upstream has no wire.
 *          An output node's array holds the value arriving at it.
 *   inner: Map of component node id -> the simulation of its inside, so the
 *          page can open a component and show live values.
 */
export function simulate(circuit, values = {}, depth = 0) {
  const out = new Map();
  const inner = new Map();
  const visit = (node) => {
    if (out.has(node.id)) return out.get(node.id);
    out.set(node.id, new Array(Math.max(outCount(node), 1)).fill(null)); // guards against loops
    let result;
    if (node.kind === 'input') {
      result = [node.name in values ? values[node.name] : (node.value ?? 0)];
    } else {
      const ins = [];
      for (let pin = 0; pin < pinCount(node); pin++) {
        const w = wireInto(circuit, node.id, pin);
        ins.push(w ? visit(getNode(circuit, w.from))[w.fromPin ?? 0] ?? null : null);
      }
      if (node.kind === 'output') {
        result = [ins[0]];
      } else if (node.kind === 'gate') {
        result = [ins.some((x) => x === null) ? null : GATES[node.type].fn(ins)];
      } else {
        const def = definitionOf(circuit, node);
        if (!def || depth >= MAX_DEPTH) {
          result = node.outs.map(() => null);
        } else {
          const given = Object.fromEntries(def.inputs.map((name, i) => [name, ins[i]]));
          const sim = simulate(def.circuit, given, depth + 1);
          inner.set(node.id, sim);
          result = def.outputs.map((name) => {
            const o = def.circuit.nodes.find((n) => n.kind === 'output' && n.name === name);
            return o ? sim.out.get(o.id)[0] : null;
          });
        }
      }
    }
    out.set(node.id, result);
    return result;
  };
  circuit.nodes.forEach(visit);
  return { out, inner };
}

/**
 * The value at every node, for circuits where each node has one output:
 * a Map of node id -> 0 | 1 | null (a component gives its first output).
 */
export function evaluate(circuit, values = {}) {
  const { out } = simulate(circuit, values);
  return new Map([...out].map(([id, v]) => [id, v[0]]));
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
  // `env` maps the input names of a component's inside to the expressions
  // wired into its pins, so the result is written in terms of the outer inputs.
  const build = (c, id, outPin, env, depth) => {
    const node = getNode(c, id);
    if (!node || depth > MAX_DEPTH * 50) return { missing: true };
    if (node.kind === 'input') return env ? (env[node.name] ?? { missing: true }) : { var: node.name };
    const args = [];
    for (let pin = 0; pin < pinCount(node); pin++) {
      const w = wireInto(c, node.id, pin);
      args.push(w ? build(c, w.from, w.fromPin ?? 0, env, depth + 1) : { missing: true });
    }
    if (node.kind === 'output') return args[0];
    if (node.kind === 'component') {
      const def = definitionOf(c, node);
      if (!def) return { missing: true };
      const o = def.circuit.nodes.find((n) => n.kind === 'output' && n.name === def.outputs[outPin]);
      if (!o) return { missing: true };
      const innerEnv = Object.fromEntries(def.inputs.map((name, i) => [name, args[i]]));
      return build(def.circuit, o.id, 0, innerEnv, depth + 1);
    }
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
  return build(circuit, outputId, 0, null, 0);
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

export function isValidCircuit(data, depth = 0) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.wires)) return false;
  if (depth > MAX_DEPTH) return false;
  const defs = data.components ?? {};
  if (typeof defs !== 'object' || Array.isArray(defs)) return false;
  for (const [id, def] of Object.entries(defs)) {
    if (!def || def.id !== id || typeof def.name !== 'string') return false;
    if (!Array.isArray(def.inputs) || !Array.isArray(def.outputs)) return false;
    if (!isValidCircuit(def.circuit, depth + 1)) return false;
  }
  const ids = new Set();
  for (const n of data.nodes) {
    if (typeof n.id !== 'string' || ids.has(n.id)) return false;
    ids.add(n.id);
    if (!['input', 'output', 'gate', 'component'].includes(n.kind)) return false;
    if (n.kind === 'gate' && !GATES[n.type]) return false;
    if (n.kind === 'component') {
      const def = defs[n.type];
      if (!def || !Array.isArray(n.ins) || !Array.isArray(n.outs)) return false;
      if (n.ins.length !== def.inputs.length || n.outs.length !== def.outputs.length) return false;
    }
    if ((n.kind === 'input' || n.kind === 'output') && typeof n.name !== 'string') return false;
    if (typeof n.x !== 'number' || typeof n.y !== 'number') return false;
  }
  const test = { nodes: data.nodes, wires: [], components: defs };
  for (const w of data.wires) {
    if (!ids.has(w.from) || !ids.has(w.to)) return false;
    if (connect(test, w.from, w.to, w.pin, w.fromPin ?? 0).error) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Components ("build it, then box it up")
// ---------------------------------------------------------------------------

// Pins are ordered top to bottom, as they appear on the canvas.
const byPosition = (a, b) => a.y - b.y || a.x - b.x;

/**
 * Turn a circuit into a component definition. Returns { def } or { error }.
 * The circuit must have at least one input and one output, and every output
 * must be connected all the way back to the inputs.
 */
export function makeComponent(circuit, name, id) {
  const clean = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!COMPONENT_NAME.test(clean)) {
    return { error: 'A component name starts with a letter and has up to 14 letters, digits or spaces, for example HALF ADDER.' };
  }
  const ins = circuit.nodes.filter((n) => n.kind === 'input').sort(byPosition);
  const outs = circuit.nodes.filter((n) => n.kind === 'output').sort(byPosition);
  if (ins.length === 0) return { error: 'A component needs at least one input.' };
  if (outs.length === 0) return { error: 'A component needs at least one output.' };
  const { out } = simulate(circuit);
  const loose = outs.find((o) => out.get(o.id)[0] === null);
  if (loose) {
    return { error: `Output ${loose.name} isn't connected all the way back to the inputs yet, so the component wouldn't work. Connect it first.` };
  }
  const inner = clone(circuit);
  inner.components = inner.components ?? {};
  for (const n of inner.nodes) if (n.kind === 'input') n.value = 0;
  return {
    def: { id, name: clean, inputs: ins.map((n) => n.name), outputs: outs.map((n) => n.name), circuit: inner },
  };
}

// Place a component on a circuit. Its definition is copied into the circuit.
export function addComponent(circuit, def, { x = 0, y = 0 } = {}) {
  circuit.components = circuit.components ?? {};
  circuit.components[def.id] = clone(def);
  const node = { id: nextId(circuit, 'c'), kind: 'component', type: def.id, x, y, ins: [...def.inputs], outs: [...def.outputs] };
  circuit.nodes.push(node);
  return { node };
}

// ---------------------------------------------------------------------------
// Checks: does a circuit do what a target says it should?
//
// A target is { name, inputs: [names], outputs: [names], expected(values) }
// where expected() takes { A: 0, B: 1, ... } and returns { S: 1, C: 0, ... }.
// Every combination of inputs is tested (every row of the truth table). For
// targets with many inputs, give `cases`: an array of input objects to test.
// ---------------------------------------------------------------------------

const describeValues = (names, values) => names.map((n) => `${n} = ${values[n]}`).join(' and ');

export function check(circuit, target) {
  const ins = inputs(circuit);
  const outs = outputs(circuit);
  const has = (list, name) => list.some((n) => n.name === name);

  const missingIn = target.inputs.filter((n) => !has(ins, n));
  if (missingIn.length) {
    const list = missingIn.join(', ');
    return { pass: false, kind: 'setup', message: `Your circuit needs ${missingIn.length === 1 ? 'an input' : 'inputs'} called ${list}. Add ${missingIn.length === 1 ? 'it' : 'them'}, or rename an input with F2.` };
  }
  const extraIn = ins.filter((n) => !target.inputs.includes(n.name));
  if (extraIn.length) {
    return { pass: false, kind: 'setup', message: `Your circuit has an input called ${extraIn[0].name}, which ${target.name} doesn't use. Remove it or rename it.` };
  }
  const missingOut = target.outputs.filter((n) => !has(outs, n));
  if (missingOut.length) {
    const list = missingOut.join(', ');
    return { pass: false, kind: 'setup', message: `Your circuit needs ${missingOut.length === 1 ? 'an output' : 'outputs'} called ${list}. Add ${missingOut.length === 1 ? 'it' : 'them'}, or rename an output with F2.` };
  }

  const cases = target.cases ?? Array.from({ length: 2 ** target.inputs.length }, (_, r) => Object.fromEntries(
    target.inputs.map((name, i) => [name, (r >> (target.inputs.length - 1 - i)) & 1]),
  ));
  for (const values of cases) {
    const { out } = simulate(circuit, values);
    const want = target.expected(values);
    for (const name of target.outputs) {
      const node = outs.find((n) => n.name === name);
      const got = out.get(node.id)[0];
      if (got === null) {
        return {
          pass: false, kind: 'unknown', values,
          message: `When ${describeValues(target.inputs, values)}, output ${name} has no value, because something feeding it isn't connected.`,
        };
      }
      if (got !== want[name]) {
        return {
          pass: false, kind: 'wrong', values,
          message: `When ${describeValues(target.inputs, values)}, your circuit outputs ${name} = ${got}. It should be ${want[name]}.`,
        };
      }
    }
  }
  const what = target.cases ? `all ${cases.length} test cases` : `all ${cases.length} rows of the truth table`;
  return { pass: true, tested: cases.length, message: `Check passed: ${what} match ${target.name}.` };
}
