import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GATES, GATE_TYPES, emptyCircuit, addNode, removeNode, connect, rename, evaluate,
  truthTable, expression, toText, isValidCircuit, clone, wireInto, describe as describeNode,
  MAX_INPUTS, nameParts,
} from '../../logic/logic.js';
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

  test('the number of inputs is limited', () => {
    const c = emptyCircuit();
    for (let i = 0; i < MAX_INPUTS; i++) assert.ok(addNode(c, { kind: 'input' }).node);
    assert.match(addNode(c, { kind: 'input' }).error, /up to 5 inputs/);
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
