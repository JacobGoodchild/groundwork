import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GATES, GATE_TYPES, emptyCircuit, addNode, removeNode, connect, rename, evaluate,
  truthTable, expression, toText, isValidCircuit, clone, wireInto, describe as describeNode,
  nameParts, simulate, makeComponent, pinCount, addComponent, check, normalise, outCount, expression as exprOf,
} from '../../logic/logic.js';
import { TARGETS } from '../../logic/targets.js';
import { readLibrary, addToLibrary, removeFromLibrary, LIBRARY_LIMIT } from '../../logic/library.js';
import { EXAMPLES } from '../../logic/examples.js';

// Build a circuit with named inputs feeding one gate into output Q.
function singleGate(type) {
  const c = emptyCircuit();
  const a = addNode(c, { kind: 'input' }).node;
  const g = addNode(c, { kind: 'gate', type }).node;
  const q = addNode(c, { kind: 'output' }).node;
  connect(c, a.id, g.id, 0);
  if (GATES[type].inputs === 2) {
    const b = addNode(c, { kind: 'input' }).node;
    connect(c, b.id, g.id, 1);
  }
  connect(c, g.id, q.id, 0);
  return c;
}

const column = (table, i = 0) => table.rows.map((r) => r.outputs[i]).join('');

describe('gates', () => {
  // Outputs for inputs 00, 01, 10, 11 (or 0, 1 for NOT), as in AQA truth tables.
  const expected = {
    NOT: '10', AND: '0001', OR: '0111', XOR: '0110', NAND: '1110', NOR: '1000',
  };
  for (const type of GATE_TYPES) {
    test(`${type} truth table`, () => {
      assert.equal(column(truthTable(singleGate(type))), expected[type]);
    });
  }

  test('the six AQA gates are all available', () => {
    assert.deepEqual(GATE_TYPES.sort(), ['AND', 'NAND', 'NOR', 'NOT', 'OR', 'XOR']);
  });
});

describe('building circuits', () => {
  test('inputs and outputs are named in order', () => {
    const c = emptyCircuit();
    assert.equal(addNode(c, { kind: 'input' }).node.name, 'A');
    assert.equal(addNode(c, { kind: 'input' }).node.name, 'B');
    assert.equal(addNode(c, { kind: 'output' }).node.name, 'Q');
    assert.equal(addNode(c, { kind: 'output' }).node.name, 'R');
  });

  test('a removed name is reused', () => {
    const c = emptyCircuit();
    const a = addNode(c, { kind: 'input' }).node;
    addNode(c, { kind: 'input' });
    removeNode(c, a.id);
    assert.equal(addNode(c, { kind: 'input' }).node.name, 'A');
  });

  test('the core does not limit the number of inputs (the tool page sets its own limit)', () => {
    const c = emptyCircuit();
    for (let i = 0; i < 9; i++) assert.ok(addNode(c, { kind: 'input' }).node);
  });

  test('removing a node removes its wires', () => {
    const c = singleGate('AND');
    const g = c.nodes.find((n) => n.kind === 'gate');
    removeNode(c, g.id);
    assert.equal(c.wires.length, 0);
  });

  test('a new wire into a pin replaces the old one', () => {
    const c = singleGate('NOT');
    const g = c.nodes.find((n) => n.kind === 'gate');
    const b = addNode(c, { kind: 'input' }).node;
    const r = connect(c, b.id, g.id, 0);
    assert.equal(r.replaced, true);
    assert.equal(wireInto(c, g.id, 0).from, b.id);
    assert.equal(c.wires.filter((w) => w.to === g.id).length, 1);
  });

  test('one output can feed several pins', () => {
    const c = emptyCircuit();
    const a = addNode(c, { kind: 'input' }).node;
    const g = addNode(c, { kind: 'gate', type: 'NAND' }).node;
    assert.ok(connect(c, a.id, g.id, 0).ok);
    assert.ok(connect(c, a.id, g.id, 1).ok);
  });

  test('wires that would make a loop are refused', () => {
    const c = emptyCircuit();
    const a = addNode(c, { kind: 'input' }).node;
    const g1 = addNode(c, { kind: 'gate', type: 'AND' }).node;
    const g2 = addNode(c, { kind: 'gate', type: 'NOT' }).node;
    connect(c, a.id, g1.id, 0);
    connect(c, g1.id, g2.id, 0);
    assert.match(connect(c, g2.id, g1.id, 1).error, /back into itself/);
    assert.match(connect(c, g1.id, g1.id, 1).error, /back into itself/);
  });

  test('wires must start at an output and end at an input pin', () => {
    const c = singleGate('NOT');
    const q = c.nodes.find((n) => n.kind === 'output');
    const a = c.nodes.find((n) => n.kind === 'input');
    assert.match(connect(c, q.id, a.id, 0).error, /must start from an input or a gate output/);
    const g = c.nodes.find((n) => n.kind === 'gate');
    assert.match(connect(c, a.id, g.id, 1).error, /must end at a gate input or an output/);
  });

  test('renaming checks the name', () => {
    const c = singleGate('AND');
    const a = c.nodes.find((n) => n.name === 'A');
    assert.ok(rename(c, a.id, 'Cin').ok);
    assert.match(rename(c, a.id, 'B').error, /already used/);
    assert.match(rename(c, a.id, '1x').error, /starts with a letter/);
    assert.match(rename(c, a.id, 'toolong').error, /at most 4/);
  });

  test('gates are described by type and number', () => {
    const c = emptyCircuit();
    const g1 = addNode(c, { kind: 'gate', type: 'AND' }).node;
    assert.equal(describeNode(c, g1), 'AND gate');
    const g2 = addNode(c, { kind: 'gate', type: 'AND' }).node;
    assert.equal(describeNode(c, g2), 'AND gate 2');
  });
});

describe('evaluation', () => {
  test('uses the input switch values', () => {
    const c = singleGate('AND');
    const q = c.nodes.find((n) => n.kind === 'output');
    assert.equal(evaluate(c).get(q.id), 0);
    c.nodes.filter((n) => n.kind === 'input').forEach((n) => { n.value = 1; });
    assert.equal(evaluate(c).get(q.id), 1);
  });

  test('an unconnected pin makes everything after it unknown', () => {
    const c = emptyCircuit();
    const a = addNode(c, { kind: 'input' }).node;
    const g = addNode(c, { kind: 'gate', type: 'AND' }).node;
    const q = addNode(c, { kind: 'output' }).node;
    connect(c, a.id, g.id, 0);
    connect(c, g.id, q.id, 0);
    assert.equal(evaluate(c).get(q.id), null);
    assert.deepEqual(truthTable(c).rows.map((r) => r.outputs[0]), [null, null]);
  });

  test('truth table rows count up in binary, first input most significant', () => {
    const t = truthTable(singleGate('OR'));
    assert.deepEqual(t.inputs, ['A', 'B']);
    assert.deepEqual(t.rows.map((r) => r.inputs.join('')), ['00', '01', '10', '11']);
  });
});

describe('Boolean expressions', () => {
  const textFor = (c, name = 'Q') => {
    const out = c.nodes.find((n) => n.kind === 'output' && n.name === name);
    return toText(expression(c, out.id));
  };

  test('single gates use AQA notation', () => {
    assert.equal(textFor(singleGate('AND')), 'A.B');
    assert.equal(textFor(singleGate('OR')), 'A + B');
    assert.equal(textFor(singleGate('XOR')), 'A ⊕ B');
    assert.equal(textFor(singleGate('NOT')), '¬A');
    assert.equal(textFor(singleGate('NAND')), '¬(A.B)');
    assert.equal(textFor(singleGate('NOR')), '¬(A + B)');
  });

  test('brackets only where needed', () => {
    const ex = (id) => clone(EXAMPLES.find((e) => e.id === id).circuit);
    assert.equal(textFor(ex('and-or')), 'A.B + C');
    const full = ex('full-adder');
    assert.equal(textFor(full, 'S'), '(A ⊕ B) ⊕ Cin');
    assert.equal(textFor(full, 'Cout'), '(A ⊕ B).Cin + A.B');
  });

  test('OR inside AND is bracketed', () => {
    const c = emptyCircuit();
    const [a, b, d] = [0, 1, 2].map(() => addNode(c, { kind: 'input' }).node);
    const or = addNode(c, { kind: 'gate', type: 'OR' }).node;
    const and = addNode(c, { kind: 'gate', type: 'AND' }).node;
    const q = addNode(c, { kind: 'output' }).node;
    connect(c, a.id, or.id, 0); connect(c, b.id, or.id, 1);
    connect(c, or.id, and.id, 0); connect(c, d.id, and.id, 1);
    connect(c, and.id, q.id, 0);
    assert.equal(textFor(c), '(A + B).C');
  });

  test('a missing wire shows as ?', () => {
    const c = emptyCircuit();
    const a = addNode(c, { kind: 'input' }).node;
    const g = addNode(c, { kind: 'gate', type: 'OR' }).node;
    const q = addNode(c, { kind: 'output' }).node;
    connect(c, a.id, g.id, 0); connect(c, g.id, q.id, 0);
    assert.equal(textFor(c), 'A + ?');
  });
});

describe('example circuits', () => {
  const tableFor = (id) => truthTable(clone(EXAMPLES.find((e) => e.id === id).circuit));

  test('all examples are valid circuits', () => {
    for (const ex of EXAMPLES) assert.ok(isValidCircuit(ex.circuit), ex.id);
  });

  test('half adder adds two bits', () => {
    const t = tableFor('half-adder');
    assert.deepEqual(t.outputs, ['C', 'S']);
    for (const row of t.rows) {
      const [a, b] = row.inputs;
      const [carry, sum] = row.outputs;
      assert.equal(carry * 2 + sum, a + b);
    }
  });

  test('full adder adds three bits', () => {
    const t = tableFor('full-adder');
    assert.deepEqual(t.inputs, ['A', 'B', 'Cin']);
    assert.deepEqual(t.outputs, ['Cout', 'S']);
    for (const row of t.rows) {
      const [a, b, cin] = row.inputs;
      const [cout, sum] = row.outputs;
      assert.equal(cout * 2 + sum, a + b + cin);
    }
  });

  test('a NAND with both inputs joined acts as NOT', () => {
    assert.equal(column(tableFor('nand-not')), '10');
  });

  test('A.B + C', () => {
    assert.equal(column(tableFor('and-or')), '01010111');
  });

  test('De Morgan: both outputs always match', () => {
    const t = tableFor('de-morgan');
    for (const row of t.rows) assert.equal(row.outputs[0], row.outputs[1]);
    assert.equal(column(t), '1000');
  });
});

describe('saved data', () => {
  test('rejects data that is not a valid circuit', () => {
    assert.equal(isValidCircuit(null), false);
    assert.equal(isValidCircuit({ nodes: [], wires: [{ from: 'x', to: 'y', pin: 0 }] }), false);
    assert.equal(isValidCircuit({ nodes: [{ id: 'g1', kind: 'gate', type: 'MUX', x: 0, y: 0 }], wires: [] }), false);
    assert.equal(isValidCircuit(emptyCircuit()), true);
  });
});

describe('names', () => {
  test('a capital letter followed by lowercase letters or digits has a subscript', () => {
    assert.deepEqual(nameParts('Cin'), { main: 'C', sub: 'in' });
    assert.deepEqual(nameParts('Cout'), { main: 'C', sub: 'out' });
    assert.deepEqual(nameParts('A1'), { main: 'A', sub: '1' });
  });

  test('other names are shown as they are', () => {
    assert.deepEqual(nameParts('A'), { main: 'A', sub: '' });
    assert.deepEqual(nameParts('AB'), { main: 'AB', sub: '' });
    assert.deepEqual(nameParts('cin'), { main: 'cin', sub: '' });
  });
});

// ---------------------------------------------------------------------------
// Components and checks
// ---------------------------------------------------------------------------

const halfAdder = () => clone(EXAMPLES.find((e) => e.id === 'half-adder').circuit);
const target = (id) => TARGETS.find((t) => t.id === id);

function fakeStorage() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
}

// A full adder built from two HALF ADDER components and an OR gate.
function fullAdderFromHalfAdders() {
  const def = makeComponent(normalise(halfAdder()), 'HALF ADDER', 'ha').def;
  const c = emptyCircuit();
  const [a, b, cin] = ['A', 'B', 'Cin'].map((name) => addNode(c, { kind: 'input', name }).node);
  const h1 = addComponent(c, def).node;
  const h2 = addComponent(c, def).node;
  const or = addNode(c, { kind: 'gate', type: 'OR' }).node;
  const s = addNode(c, { kind: 'output', name: 'S' }).node;
  const cout = addNode(c, { kind: 'output', name: 'Cout' }).node;
  // Half adder pins: inputs A, B (top to bottom); outputs S, C (S is higher on the canvas).
  const S = def.outputs.indexOf('S');
  const C = def.outputs.indexOf('C');
  connect(c, a.id, h1.id, 0); connect(c, b.id, h1.id, 1);
  connect(c, h1.id, h2.id, 0, S); connect(c, cin.id, h2.id, 1);
  connect(c, h2.id, s.id, 0, S);
  connect(c, h1.id, or.id, 0, C); connect(c, h2.id, or.id, 1, C);
  connect(c, or.id, cout.id, 0);
  return { c, def, h1, h2 };
}

describe('wires from a chosen output', () => {
  test('old saved circuits without fromPin still work', () => {
    const old = { nodes: halfAdder().nodes, wires: halfAdder().wires.map(({ from, to, pin }) => ({ from, to, pin })) };
    assert.ok(isValidCircuit(old));
    const c = normalise(old);
    assert.ok(c.wires.every((w) => w.fromPin === 0));
    assert.deepEqual(c.components, {});
    assert.equal(column(truthTable(c), 1), '0110');
  });

  test('a wire must start from an output pin that exists', () => {
    const c = halfAdder();
    assert.match(connect(c, 'g1', 'out1', 0, 1).error, /must start from/);
  });
});

describe('making components', () => {
  test('a half adder becomes a component with pins in top-to-bottom order', () => {
    const { def, error } = makeComponent(normalise(halfAdder()), '  HALF   ADDER ', 'ha');
    assert.equal(error, undefined);
    assert.equal(def.name, 'HALF ADDER');
    assert.deepEqual(def.inputs, ['A', 'B']);
    assert.deepEqual(def.outputs, ['S', 'C']);
  });

  test('the name is checked', () => {
    assert.match(makeComponent(halfAdder(), '', 'x').error, /starts with a letter/);
    assert.match(makeComponent(halfAdder(), 'A VERY LONG NAME INDEED', 'x').error, /up to 14/);
  });

  test('it needs inputs, outputs, and every output connected', () => {
    const c = emptyCircuit();
    addNode(c, { kind: 'output' });
    assert.match(makeComponent(c, 'X', 'x').error, /at least one input/);
    const d = emptyCircuit();
    addNode(d, { kind: 'input' });
    assert.match(makeComponent(d, 'X', 'x').error, /at least one output/);
    const e = halfAdder();
    e.wires = e.wires.filter((w) => w.to !== 'out2');
    assert.match(makeComponent(normalise(e), 'X', 'x').error, /Output C isn't connected/);
  });

  test('a component node has the definition\'s pins', () => {
    const def = makeComponent(normalise(halfAdder()), 'HALF ADDER', 'ha').def;
    const c = emptyCircuit();
    const n = addComponent(c, def, { x: 10, y: 20 }).node;
    assert.equal(n.kind, 'component');
    assert.equal(pinCount(n), 2);
    assert.equal(outCount(n), 2);
    assert.equal(describeNode(c, n), 'HALF ADDER');
    assert.ok(c.components.ha);
  });

  test('removing the last use of a component forgets its definition', () => {
    const def = makeComponent(normalise(halfAdder()), 'HALF ADDER', 'ha').def;
    const c = emptyCircuit();
    const n1 = addComponent(c, def).node;
    const n2 = addComponent(c, def).node;
    removeNode(c, n1.id);
    assert.ok(c.components.ha);
    removeNode(c, n2.id);
    assert.equal(c.components.ha, undefined);
  });
});

describe('simulating components', () => {
  test('a full adder built from two half adder components adds three bits', () => {
    const { c } = fullAdderFromHalfAdders();
    assert.ok(isValidCircuit(c));
    const t = truthTable(c);
    assert.deepEqual(t.inputs, ['A', 'B', 'Cin']);
    assert.deepEqual(t.outputs, ['Cout', 'S']);
    for (const row of t.rows) {
      const [a, b, cin] = row.inputs;
      const [cout, sum] = row.outputs;
      assert.equal(cout * 2 + sum, a + b + cin);
    }
  });

  test('the simulation keeps the live values inside each component', () => {
    const { c, h1 } = fullAdderFromHalfAdders();
    const sim = simulate(c, { A: 1, B: 1, Cin: 0 });
    const inside = sim.inner.get(h1.id);
    const def = c.components.ha;
    const innerS = def.circuit.nodes.find((n) => n.name === 'S');
    const innerC = def.circuit.nodes.find((n) => n.name === 'C');
    assert.equal(inside.out.get(innerS.id)[0], 0);
    assert.equal(inside.out.get(innerC.id)[0], 1);
  });

  test('components can contain components', () => {
    const { c } = fullAdderFromHalfAdders();
    const fa = makeComponent(c, 'FULL ADDER', 'fa').def;
    const outer = emptyCircuit();
    const ins = ['A', 'B', 'Cin'].map((name) => addNode(outer, { kind: 'input', name }).node);
    const box = addComponent(outer, fa).node;
    ins.forEach((n, i) => connect(outer, n.id, box.id, i));
    fa.outputs.forEach((name, i) => {
      const o = addNode(outer, { kind: 'output', name }).node;
      connect(outer, box.id, o.id, 0, i);
    });
    assert.ok(isValidCircuit(outer));
    assert.ok(check(outer, target('full-adder')).pass);
  });

  test('the Boolean expression looks through components to the inputs', () => {
    const { c } = fullAdderFromHalfAdders();
    const s = c.nodes.find((n) => n.name === 'S');
    assert.equal(toText(exprOf(c, s.id)), '(A ⊕ B) ⊕ Cin');
  });
});

describe('checks', () => {
  test('a correct circuit passes every row', () => {
    const r = check(normalise(halfAdder()), target('half-adder'));
    assert.equal(r.pass, true);
    assert.equal(r.message, 'Check passed: all 4 rows of the truth table match Half adder.');
  });

  test('a wrong circuit fails with the first wrong row, in words', () => {
    const c = normalise(halfAdder());
    c.nodes.find((n) => n.id === 'g1').type = 'OR'; // OR where the XOR should be
    const r = check(c, target('half-adder'));
    assert.equal(r.pass, false);
    assert.equal(r.message, 'When A = 1 and B = 1, your circuit outputs S = 1. It should be 0.');
    assert.deepEqual(r.values, { A: 1, B: 1 });
  });

  test('missing or extra inputs and outputs are reported by name', () => {
    const c = normalise(halfAdder());
    assert.match(check(c, target('full-adder')).message, /needs an input called Cin/);
    const d = normalise(halfAdder());
    addNode(d, { kind: 'input', name: 'D' });
    assert.match(check(d, target('half-adder')).message, /input called D, which Half adder doesn't use/);
    assert.match(check(normalise(halfAdder()), target('and')).message, /needs an output called Q/);
  });

  test('an unconnected output is reported', () => {
    const c = normalise(halfAdder());
    c.wires = c.wires.filter((w) => w.to !== 'out1');
    assert.match(check(c, target('half-adder')).message, /output S has no value/);
  });

  test('test cases can be used instead of every row', () => {
    const t = { ...target('half-adder'), cases: [{ A: 1, B: 0 }, { A: 1, B: 1 }] };
    assert.equal(check(normalise(halfAdder()), t).message, 'Check passed: all 2 test cases match Half adder.');
  });

  test('every target is met by a circuit built from its own gate (or an example)', () => {
    for (const type of GATE_TYPES) {
      const c = singleGate(type); // inputs A and B, output Q
      assert.ok(check(normalise(c), target(type.toLowerCase())).pass, type);
    }
    assert.ok(check(normalise(clone(EXAMPLES.find((e) => e.id === 'full-adder').circuit)), target('full-adder')).pass);
  });
});

describe('component library', () => {
  test('components are kept, replaced by name and removed', () => {
    const storage = fakeStorage();
    const def = makeComponent(normalise(halfAdder()), 'HALF ADDER', 'ha').def;
    assert.ok(addToLibrary(storage, def).ok);
    assert.equal(readLibrary(storage).length, 1);
    const again = addToLibrary(storage, { ...def, id: 'ha2' });
    assert.equal(again.replaced, true);
    assert.equal(readLibrary(storage)[0].id, 'ha2');
    removeFromLibrary(storage, 'ha2');
    assert.deepEqual(readLibrary(storage), []);
  });

  test('the library has a limit', () => {
    const storage = fakeStorage();
    const def = makeComponent(normalise(halfAdder()), 'X', 'x').def;
    for (let i = 0; i < LIBRARY_LIMIT; i++) assert.ok(addToLibrary(storage, { ...def, id: `x${i}`, name: `X${i}` }).ok);
    assert.match(addToLibrary(storage, { ...def, id: 'y', name: 'Y' }).error, /up to 12/);
  });
});
