// Example circuits. Positions are the top-left corner of each node on a
// 960 x 540 canvas.

const input = (id, name, x, y) => ({ id, kind: 'input', name, x, y, value: 0 });
const output = (id, name, x, y) => ({ id, kind: 'output', name, x, y });
const gate = (id, type, x, y) => ({ id, kind: 'gate', type, x, y });
const wire = (from, to, pin = 0) => ({ from, fromPin: 0, to, pin });

export const EXAMPLES = [
  {
    id: 'half-adder',
    title: 'Half adder',
    circuit: {
      nodes: [
        input('in1', 'A', 60, 150),
        input('in2', 'B', 60, 330),
        gate('g1', 'XOR', 400, 150),
        gate('g2', 'AND', 400, 330),
        output('out1', 'S', 760, 158),
        output('out2', 'C', 760, 338),
      ],
      wires: [
        wire('in1', 'g1', 0), wire('in2', 'g1', 1),
        wire('in1', 'g2', 0), wire('in2', 'g2', 1),
        wire('g1', 'out1'), wire('g2', 'out2'),
      ],
    },
  },
  {
    id: 'full-adder',
    title: 'Full adder',
    circuit: {
      nodes: [
        input('in1', 'A', 40, 80),
        input('in2', 'B', 40, 170),
        input('in3', 'Cin', 40, 300),
        gate('g1', 'XOR', 240, 100),
        gate('g2', 'XOR', 520, 120),
        gate('g3', 'AND', 520, 280),
        gate('g4', 'AND', 240, 400),
        gate('g5', 'OR', 700, 330),
        output('out1', 'S', 840, 128),
        output('out2', 'Cout', 840, 338),
      ],
      wires: [
        wire('in1', 'g1', 0), wire('in2', 'g1', 1),
        wire('g1', 'g2', 0), wire('in3', 'g2', 1),
        wire('g1', 'g3', 0), wire('in3', 'g3', 1),
        wire('in1', 'g4', 0), wire('in2', 'g4', 1),
        wire('g3', 'g5', 0), wire('g4', 'g5', 1),
        wire('g2', 'out1'), wire('g5', 'out2'),
      ],
    },
  },
  {
    id: 'nand-not',
    title: 'NOT made from a NAND gate',
    circuit: {
      nodes: [
        input('in1', 'A', 120, 240),
        gate('g1', 'NAND', 420, 236),
        output('out1', 'Q', 740, 244),
      ],
      wires: [wire('in1', 'g1', 0), wire('in1', 'g1', 1), wire('g1', 'out1')],
    },
  },
  {
    id: 'and-or',
    title: 'A.B + C',
    circuit: {
      nodes: [
        input('in1', 'A', 60, 120),
        input('in2', 'B', 60, 220),
        input('in3', 'C', 60, 360),
        gate('g1', 'AND', 320, 150),
        gate('g2', 'OR', 560, 250),
        output('out1', 'Q', 800, 258),
      ],
      wires: [
        wire('in1', 'g1', 0), wire('in2', 'g1', 1),
        wire('g1', 'g2', 0), wire('in3', 'g2', 1),
        wire('g2', 'out1'),
      ],
    },
  },
  {
    id: 'de-morgan',
    title: 'De Morgan’s law: NOR and AND of NOTs',
    circuit: {
      nodes: [
        input('in1', 'A', 60, 150),
        input('in2', 'B', 60, 330),
        gate('g1', 'NOR', 420, 60),
        gate('g2', 'NOT', 280, 270),
        gate('g3', 'NOT', 280, 400),
        gate('g4', 'AND', 520, 330),
        output('out1', 'P', 800, 68),
        output('out2', 'Q', 800, 338),
      ],
      wires: [
        wire('in1', 'g1', 0), wire('in2', 'g1', 1),
        wire('in1', 'g2'), wire('in2', 'g3'),
        wire('g2', 'g4', 0), wire('g3', 'g4', 1),
        wire('g1', 'out1'), wire('g4', 'out2'),
      ],
    },
  },
];

// Every example circuit is complete in the current format (no components).
for (const ex of EXAMPLES) ex.circuit.components = {};
