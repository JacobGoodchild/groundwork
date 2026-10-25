// Example programs. `memory` gives starting values for memory addresses.
// Each program's first line says what it does.

export const EXAMPLES = [
  {
    id: 'add',
    title: 'Add two numbers from memory',
    memory: { 0: 12, 1: 30 },
    code: `// Load two values from memory, add them, and store the result.
// Memory address 0 holds 12 and address 1 holds 30. The answer goes in address 2.
        LDR R0, 0
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
    code: `// Compare two values and store the larger one in memory address 2.
// Memory address 0 holds 17 and address 1 holds 25.
        LDR R0, 0
        LDR R1, 1
        CMP R0, R1
        BGT first
        STR R1, 2       // R1 is larger (or they are equal)
        B done
first:
        STR R0, 2       // R0 is larger
done:
        HALT
`,
  },
  {
    id: 'multiply',
    title: 'Multiply by repeated addition',
    memory: { 0: 6, 1: 7 },
    code: `// Multiply two numbers by repeated addition, using a loop.
// Memory address 0 holds 6 and address 1 holds 7. The answer goes in address 2.
        LDR R0, 0       // the number to add each time
        LDR R1, 1       // how many times to add it
        MOV R2, #0      // the running total
loop:
        CMP R1, #0
        BEQ done        // stop when there is nothing left to add
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
    title: 'Multiply and divide with shifts',
    memory: { 0: 13 },
    code: `// Multiply by 4 using LSL, and divide by 2 using LSR.
// Memory address 0 holds 13. Address 1 gets 13 x 4 and address 2 gets 13 / 2, rounded down.
        LDR R0, 0
        LSL R1, R0, #2  // shifting left 2 places multiplies by 4
        STR R1, 1
        LSR R2, R0, #1  // shifting right 1 place divides by 2
        STR R2, 2
        HALT
`,
  },
  {
    id: 'countdown',
    title: 'Count down from 10 to 0',
    memory: {},
    code: `// Count down from 10 to 0, storing each value in memory address 0.
        MOV R0, #10
loop:
        STR R0, 0
        SUB R0, R0, #1
        CMP R0, #0
        BNE loop        // keep going until R0 reaches 0
        STR R0, 0
        HALT
`,
  },
  {
    id: 'oddeven',
    title: 'Check whether a number is odd or even',
    memory: { 0: 13 },
    code: `// Use AND to check whether a number is odd or even.
// Memory address 0 holds 13. Address 1 gets 1 if it is odd, or 0 if it is even.
        LDR R0, 0
        AND R1, R0, #1  // keep only the last bit: 1 for odd, 0 for even
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
