// Example programs, written in the same style as AQA exam papers: labels on
// their own line, instructions indented, no comments (the AQA instruction set
// does not define a comment syntax). `memory` gives starting values.

export const EXAMPLES = [
  {
    id: 'add',
    title: 'Add two numbers from memory',
    memory: { 0: 12, 1: 30 },
    code: `  LDR R0, 0
  LDR R1, 1
  ADD R2, R0, R1
  STR R2, 2
  HALT
`,
  },
  {
    id: 'larger',
    title: 'Store the larger of two values',
    memory: { 0: 17, 1: 25 },
    code: `  LDR R0, 0
  LDR R1, 1
  CMP R0, R1
  BGT first
  STR R1, 2
  B done
first:
  STR R0, 2
done:
  HALT
`,
  },
  {
    id: 'multiply',
    title: 'Multiply by repeated addition',
    memory: { 0: 6, 1: 7 },
    code: `  LDR R0, 0
  LDR R1, 1
  MOV R2, #0
loop:
  CMP R1, #0
  BEQ done
  ADD R2, R2, R0
  SUB R1, R1, #1
  B loop
done:
  STR R2, 2
  HALT
`,
  },
  {
    id: 'shift',
    title: 'Multiply by 4 and divide by 2 with shifts',
    memory: { 0: 13 },
    code: `  LDR R0, 0
  LSL R1, R0, #2
  STR R1, 1
  LSR R2, R0, #1
  STR R2, 2
  HALT
`,
  },
  {
    id: 'countdown',
    title: 'Count down from 10 to 0',
    memory: {},
    code: `  MOV R0, #10
loop:
  STR R0, 0
  SUB R0, R0, #1
  CMP R0, #0
  BNE loop
  STR R0, 0
  HALT
`,
  },
  {
    id: 'oddeven',
    title: 'Check whether a number is odd or even',
    memory: { 0: 13 },
    code: `  LDR R0, 0
  AND R1, R0, #1
  CMP R1, #1
  BEQ odd
  MOV R2, #0
  B done
odd:
  MOV R2, #1
done:
  STR R2, 1
  HALT
`,
  },
];
