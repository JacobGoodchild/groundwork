// Things to build and check against in the logic tool. Each target says
// which inputs and outputs the circuit must have, and what the outputs should
// be for any inputs (see check() in logic.js).

const two = (name, fn) => ({
  inputs: ['A', 'B'],
  outputs: ['Q'],
  expected: ({ A, B }) => ({ Q: fn(A, B) }),
  goal: `Build ${name}. Inputs A and B, output Q.`,
});

export const TARGETS = [
  { id: 'not', name: 'NOT', inputs: ['A'], outputs: ['Q'], expected: ({ A }) => ({ Q: 1 - A }), goal: 'Build NOT. Input A, output Q.' },
  { id: 'and', name: 'AND', ...two('AND', (a, b) => a & b) },
  { id: 'or', name: 'OR', ...two('OR', (a, b) => a | b) },
  { id: 'xor', name: 'XOR', ...two('XOR', (a, b) => a ^ b) },
  { id: 'nand', name: 'NAND', ...two('NAND', (a, b) => 1 - (a & b)) },
  { id: 'nor', name: 'NOR', ...two('NOR', (a, b) => 1 - (a | b)) },
  {
    id: 'half-adder',
    name: 'Half adder',
    inputs: ['A', 'B'],
    outputs: ['S', 'C'],
    expected: ({ A, B }) => ({ S: A ^ B, C: A & B }),
    goal: 'Build a half adder. It adds two bits, A and B, and outputs a sum S and a carry C.',
  },
  {
    id: 'full-adder',
    name: 'Full adder',
    inputs: ['A', 'B', 'Cin'],
    outputs: ['S', 'Cout'],
    expected: ({ A, B, Cin }) => ({ S: A ^ B ^ Cin, Cout: (A & B) | (Cin & (A ^ B)) }),
    goal: 'Build a full adder. It adds A, B and a carry in Cin, and outputs a sum S and a carry out Cout.',
  },
];
