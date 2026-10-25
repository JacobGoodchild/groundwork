import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse, assemble, runToEnd, formatError, Machine,
  MEMORY_SIZE, REGISTER_COUNT, STEP_LIMIT,
} from '../../assembly/aqa.js';
import { EXAMPLES } from '../../assembly/examples.js';

function run(source, { wordSize = 8, registers = {}, memory = {} } = {}) {
  const m = assemble(source, { wordSize });
  for (const [n, v] of Object.entries(registers)) m.setRegister(Number(n), v);
  for (const [a, v] of Object.entries(memory)) m.setMemory(Number(a), v);
  return runToEnd(m);
}

function errorsFor(source, options) {
  return parse(source, options).errors.map(formatError);
}

function oneError(source, options) {
  const errors = errorsFor(source, options);
  assert.equal(errors.length, 1, `expected one error, got: ${JSON.stringify(errors)}`);
  return errors[0];
}

describe('machine model', () => {
  test('has 13 registers and 26 memory slots, all zero to start', () => {
    const m = new Machine();
    assert.equal(REGISTER_COUNT, 13);
    assert.equal(MEMORY_SIZE, 26);
    assert.deepEqual(m.registers, new Array(13).fill(0));
    assert.deepEqual(m.memory, new Array(26).fill(0));
    assert.equal(m.pc, 0);
    assert.equal(m.comparison, null);
  });
});

describe('instructions', () => {
  test('LDR loads from memory', () => {
    const m = assemble('LDR R2, 4\nHALT');
    m.setMemory(4, 12);
    const r = m.step();
    assert.equal(m.registers[2], 12);
    assert.equal(r.explanation, 'Copied the value in memory address 4 (12) into R2.');
    assert.deepEqual(r.reads, [{ type: 'mem', address: 4 }]);
    assert.deepEqual(r.writes, [{ type: 'reg', n: 2 }]);
  });

  test('STR stores into memory', () => {
    const m = run('MOV R1, #9\nSTR R1, 25\nHALT');
    assert.equal(m.memory[25], 9);
  });

  test('ADD with immediate and register', () => {
    const m = assemble('MOV R1, #7\nADD R3, R1, #5\nADD R4, R3, R1\nHALT');
    m.step();
    const r = m.step();
    assert.equal(r.explanation, 'Added 5 to R1 (7) and stored the result (12) in R3.');
    m.step();
    assert.equal(m.registers[3], 12);
    assert.equal(m.registers[4], 19);
  });

  test('SUB with immediate and register', () => {
    const m = run('MOV R1, #20\nMOV R2, #6\nSUB R3, R1, #5\nSUB R4, R1, R2\nHALT');
    assert.equal(m.registers[3], 15);
    assert.equal(m.registers[4], 14);
  });

  test('MOV copies an immediate or a register', () => {
    const m = run('MOV R0, #42\nMOV R12, R0\nHALT');
    assert.equal(m.registers[0], 42);
    assert.equal(m.registers[12], 42);
  });

  test('AND, ORR, EOR', () => {
    const m = run('MOV R0, #12\nAND R1, R0, #10\nORR R2, R0, #10\nEOR R3, R0, #10\nMOV R4, #6\nAND R5, R0, R4\nHALT');
    assert.equal(m.registers[1], 8);   // 1100 & 1010
    assert.equal(m.registers[2], 14);  // 1100 | 1010
    assert.equal(m.registers[3], 6);   // 1100 ^ 1010
    assert.equal(m.registers[5], 4);   // 1100 & 0110
  });

  test('MVN flips every bit within the word size', () => {
    assert.equal(run('MVN R0, #5\nHALT').registers[0], 250);
    assert.equal(run('MVN R0, #5\nHALT', { wordSize: 16 }).registers[0], 65530);
    assert.equal(run('MVN R0, #0\nHALT', { wordSize: 32 }).registers[0], 4294967295);
    assert.equal(run('MOV R1, #255\nMVN R0, R1\nHALT').registers[0], 0);
  });

  test('LSL and LSR', () => {
    const m = run('MOV R0, #13\nLSL R1, R0, #2\nLSR R2, R0, #1\nMOV R3, #3\nLSL R4, R0, R3\nHALT');
    assert.equal(m.registers[1], 52);
    assert.equal(m.registers[2], 6);
    assert.equal(m.registers[4], 104);
  });

  test('LSL loses bits that move out of the word; shifting by the word size or more gives 0', () => {
    assert.equal(run('MOV R0, #200\nLSL R1, R0, #1\nHALT').registers[1], 144);
    assert.equal(run('MOV R0, #255\nLSL R1, R0, #8\nLSR R2, R0, #9\nHALT').registers[1], 0);
    const m32 = run('MOV R0, #4294967295\nLSL R1, R0, #4\nLSR R2, R0, #31\nHALT', { wordSize: 32 });
    assert.equal(m32.registers[1], 4294967280);
    assert.equal(m32.registers[2], 1);
  });

  test('B always branches', () => {
    const m = run('B skip\nMOV R0, #1\nskip: MOV R1, #2\nHALT');
    assert.equal(m.registers[0], 0);
    assert.equal(m.registers[1], 2);
  });

  test('HALT stops the program', () => {
    const m = run('MOV R0, #1\nHALT\nMOV R0, #2');
    assert.equal(m.status, 'halted');
    assert.equal(m.registers[0], 1);
    const after = m.step();
    assert.equal(after.status, 'halted');
    assert.equal(m.registers[0], 1);
  });

  test('instructions, registers and labels are case-insensitive; comments and blank lines are ignored', () => {
    const m = run('// a comment\n\nmov r1, #3   // set up\nLoop: sub r1, r1, #1\ncmp r1, #0\nbne LOOP\nhalt\n');
    assert.equal(m.registers[1], 0);
  });

  test('a label can be on its own line or followed by an instruction', () => {
    const p = parse('start:\n  MOV R0, #1\nnext: MOV R1, #2\nHALT');
    assert.equal(p.errors.length, 0);
    assert.equal(p.labels.get('start').index, 0);
    assert.equal(p.labels.get('next').index, 1);
  });
});

describe('CMP and branch conditions', () => {
  const cases = [
    // [R0, operand, BEQ, BNE, BGT, BLT]
    [3, 5, false, true, false, true],
    [5, 5, true, false, false, false],
    [7, 5, false, true, true, false],
  ];
  for (const [left, right, eq, ne, gt, lt] of cases) {
    for (const [cond, expected] of [['EQ', eq], ['NE', ne], ['GT', gt], ['LT', lt]]) {
      test(`B${cond} with ${left} compared to ${right} ${expected ? 'branches' : 'does not branch'}`, () => {
        const m = run(`MOV R0, #${left}\nCMP R0, #${right}\nB${cond} yes\nMOV R1, #1\nHALT\nyes: MOV R1, #2\nHALT`);
        assert.equal(m.registers[1], expected ? 2 : 1);
      });
    }
  }

  test('CMP records the comparison in words', () => {
    const m = assemble('MOV R1, #3\nCMP R1, #5\nMOV R2, #9\nCMP R1, R2\nHALT');
    assert.equal(m.comparison, null);
    m.step();
    const r = m.step();
    assert.equal(m.comparison.text, 'R1 (3) compared with #5: less than');
    assert.equal(r.explanation, 'Compared R1 (3) with #5: less than.');
    m.step();
    m.step();
    assert.equal(m.comparison.text, 'R1 (3) compared with R2 (9): less than');
  });

  test('a branch step explains the last comparison', () => {
    const m = assemble('MOV R1, #3\nCMP R1, #5\nloop: BLT loop');
    m.step(); m.step();
    const r = m.step();
    assert.equal(r.explanation, 'Last comparison was "less than", so BLT branches to loop (line 3).');
  });

  test('a conditional branch before any CMP stops with an error', () => {
    const m = assemble('BEQ end\nend: HALT');
    const r = m.step();
    assert.equal(m.status, 'error');
    assert.match(r.explanation, /^Line 1: BEQ checks the last comparison, but no CMP has run yet/);
  });

  test('CMP compares unsigned values', () => {
    const m = run('MOV R0, #200\nCMP R0, #100\nBGT big\nMOV R1, #0\nHALT\nbig: MOV R1, #1\nHALT');
    assert.equal(m.registers[1], 1);
  });
});

describe('wrap-around', () => {
  test('8-bit addition wraps and says so', () => {
    const m = assemble('MOV R1, #250\nADD R2, R1, #10\nHALT');
    m.step();
    const r = m.step();
    assert.equal(m.registers[2], 4);
    assert.match(r.explanation, /250 \+ 10 = 260, which doesn't fit in 8 bits, so it wrapped round to 4/);
  });

  test('8-bit subtraction below zero wraps', () => {
    const m = assemble('MOV R1, #3\nSUB R2, R1, #5\nHALT');
    m.step();
    const r = m.step();
    assert.equal(m.registers[2], 254);
    assert.match(r.explanation, /wrapped round to 254/);
  });

  test('16-bit wraps at 65536', () => {
    const m = run('MOV R1, #65535\nADD R2, R1, #2\nMOV R3, #0\nSUB R4, R3, #1\nHALT', { wordSize: 16 });
    assert.equal(m.registers[2], 1);
    assert.equal(m.registers[4], 65535);
  });

  test('32-bit wraps at 4294967296', () => {
    const m = assemble('MOV R1, #4294967295\nADD R2, R1, #1\nSUB R3, R2, #1\nHALT', { wordSize: 32 });
    m.step();
    const r = m.step();
    assert.match(r.explanation, /doesn't fit in 32 bits, so it wrapped round to 0/);
    runToEnd(m);
    assert.equal(m.registers[2], 0);
    assert.equal(m.registers[3], 4294967295);
  });

  test('no wrap note when the result fits', () => {
    const m = assemble('MOV R1, #200\nADD R2, R1, #55\nHALT');
    m.step();
    assert.doesNotMatch(m.step().explanation, /wrapped/);
    assert.equal(m.registers[2], 255);
  });

  test('changing word size cuts existing values down to fit', () => {
    const m = new Machine({ wordSize: 16 });
    m.setRegister(0, 300);
    m.setWordSize(8);
    assert.equal(m.registers[0], 44);
  });
});

describe('step back, reset and safety', () => {
  test('step back undoes one instruction at a time', () => {
    const m = assemble('MOV R0, #1\nSTR R0, 3\nCMP R0, #1\nHALT');
    m.step(); m.step(); m.step(); m.step();
    assert.equal(m.status, 'halted');
    assert.ok(m.stepBack());
    assert.equal(m.status, 'ready');
    assert.equal(m.pc, 3);
    assert.ok(m.comparison);
    assert.ok(m.stepBack());
    assert.equal(m.comparison, null);
    assert.ok(m.stepBack());
    assert.equal(m.memory[3], 0);
    assert.ok(m.stepBack());
    assert.equal(m.registers[0], 0);
    assert.equal(m.pc, 0);
    assert.equal(m.stepBack(), false);
  });

  test('restart restores the values from before the run', () => {
    const m = assemble('ADD R0, R0, #1\nSTR R0, 0\nHALT');
    m.setRegister(0, 10);
    m.setMemory(0, 99);
    runToEnd(m);
    assert.equal(m.registers[0], 11);
    assert.equal(m.memory[0], 11);
    m.restart();
    assert.equal(m.registers[0], 10);
    assert.equal(m.memory[0], 99);
    assert.equal(m.pc, 0);
    assert.equal(m.status, 'ready');
  });

  test('stops after 10,000 instructions without HALT', () => {
    const m = run('loop: B loop');
    assert.equal(STEP_LIMIT, 10000);
    assert.equal(m.status, 'limit');
    assert.equal(m.steps, 10000);
    assert.equal(m.lastResult.note, 'Stopped after 10,000 instructions. Your program may be stuck in a loop.');
  });

  test('a program that finishes in exactly 10,000 instructions is not stopped early', () => {
    // 3 MOVs + 3332 loops of 3 instructions + HALT = 10,000 instructions.
    const m = run('MOV R0, #0\nMOV R1, #0\nMOV R2, #0\nloop: ADD R0, R0, #1\nCMP R0, #3332\nBNE loop\nHALT', { wordSize: 16 });
    assert.equal(m.status, 'halted');
    assert.equal(m.steps, 10000);
  });

  test('running off the end without HALT gives a gentle note', () => {
    const m = assemble('MOV R0, #1');
    const r = m.step();
    assert.equal(m.status, 'ended');
    assert.equal(r.note, 'Reached the end of the program without HALT. AQA programs normally end with HALT.');
  });

  test('an empty program says there is nothing to run', () => {
    const m = assemble('// nothing here\n');
    assert.match(m.step().explanation, /There are no instructions to run/);
  });
});

describe('error messages', () => {
  test('unknown instruction', () => {
    assert.equal(oneError('MOV R0, #1\nFOO R1, R2'), 'Line 2: FOO is not an AQA instruction. Check the spelling, or see the Instruction reference for the instructions you can use.');
  });

  test('instructions from outside the AQA set get a specific hint', () => {
    assert.equal(oneError('MUL R1, R2, R3'), 'Line 1: MUL is not part of the AQA instruction set. Multiply using repeated addition or LSL.');
    assert.match(oneError('BGE loop\nloop: HALT'), /BGE is not part of the AQA instruction set\. The only conditions are EQ, NE, GT and LT/);
    assert.match(oneError('DIV R1, R2, R3'), /Divide using repeated subtraction or LSR/);
  });

  test('wrong number of operands', () => {
    assert.equal(oneError('ADD R1, R2'), 'Line 1: ADD needs 3 operands (ADD Rd, Rn, <operand2>), but this line has 2. For example: ADD R1, R2, #5.');
    assert.match(oneError('MOV R1, #2, #3'), /MOV needs 2 operands/);
    assert.match(oneError('HALT R0'), /HALT does not take any operands/);
    assert.match(oneError('B'), /B needs 1 operand \(B <label>\), but this line has 0/);
    assert.match(oneError('ADD R1, , R2'), /second operand of ADD is missing/);
  });

  test('immediate value where a register is required', () => {
    assert.equal(oneError('STR #5, 10'), 'Line 1: STR needs a register as its first operand, for example STR R1, 10.');
    assert.equal(oneError('ADD #1, R2, R3'), 'Line 1: ADD needs a register as its first operand, for example ADD R1, R2, #5.');
    assert.equal(oneError('ADD R1, #2, R3'), 'Line 1: ADD needs a register as its second operand, for example ADD R1, R2, #5.');
    assert.match(oneError('CMP #1, R2'), /CMP needs a register as its first operand/);
  });

  test('register outside R0 to R12', () => {
    assert.equal(oneError('MOV R13, #1'), 'Line 1: R13 does not exist. The registers are R0 to R12.');
    assert.match(oneError('ADD R1, R2, R20'), /R20 does not exist/);
  });

  test('missing # before an immediate value', () => {
    assert.match(oneError('ADD R1, R2, 5'), /^Line 1: 5 needs a # in front to be used as a value, for example #5\./);
    assert.match(oneError('MOV R1, 7'), /7 needs a # in front/);
  });

  test('# used where a memory address is expected', () => {
    assert.equal(oneError('LDR R1, #10'), 'Line 1: LDR needs a memory address written as a plain number, for example LDR R1, 10. Remove the #: a # means a value, not an address.');
    assert.match(oneError('STR R1, R2'), /STR needs a memory address as its second operand, not a register/);
  });

  test('branch to a label that does not exist', () => {
    assert.equal(oneError('B nowhere'), 'Line 1: There is no label called "nowhere". Add a line such as "nowhere:" where the branch should go, or check the spelling.');
    assert.match(oneError('CMP R0, #1\nBEQ missing'), /^Line 2: There is no label called "missing"/);
  });

  test('label defined twice', () => {
    assert.equal(oneError('loop: MOV R0, #1\nloop: HALT'), 'Line 2: The label "loop" is already defined on line 1. Each label can only be defined once.');
  });

  test('invalid label names', () => {
    assert.match(oneError('1st: HALT'), /"1st" is not a valid label name/);
    assert.match(oneError('R1: HALT'), /cannot be a register name/);
    assert.match(oneError('B 3'), /B needs a label to branch to/);
  });

  test('memory address out of range', () => {
    assert.equal(oneError('LDR R1, 26'), 'Line 1: Memory address 26 is out of range. Addresses go from 0 to 25.');
    assert.match(oneError('STR R1, 100'), /Memory address 100 is out of range/);
    assert.deepEqual(errorsFor('LDR R1, 25\nHALT'), []);
  });

  test('immediate values must be denary and fit the word size', () => {
    assert.match(oneError('MOV R1, #256'), /#256 is too big for 8 bits\. The largest 8-bit value is 255/);
    assert.deepEqual(errorsFor('MOV R1, #256', { wordSize: 16 }), []);
    assert.match(oneError('MOV R1, #0x1F'), /is not a denary number/);
    assert.match(oneError('MOV R1, #-3'), /is negative/);
  });

  test('every error in the program is listed, in line order', () => {
    const errors = errorsFor('MOV R13, #1\nHALT\nFOO\nB nowhere\nLDR R1, 99');
    assert.equal(errors.length, 4);
    assert.deepEqual(errors.map((e) => e.match(/^Line (\d+)/)[1]), ['1', '3', '4', '5']);
  });

  test('assemble refuses a program with errors', () => {
    assert.throws(() => assemble('FOO'), /Line 1: FOO is not an AQA instruction/);
  });
});

describe('example programs', () => {
  const byId = Object.fromEntries(EXAMPLES.map((e) => [e.id, e]));

  function runExample(id, memoryOverride) {
    const ex = byId[id];
    return run(ex.code, { memory: memoryOverride ?? ex.memory });
  }

  test('every example has a comment on its first line and parses cleanly', () => {
    assert.equal(EXAMPLES.length, 6);
    for (const ex of EXAMPLES) {
      assert.match(ex.code.split('\n')[0], /^\/\/ \S/);
      assert.deepEqual(parse(ex.code).errors, [], ex.id);
    }
  });

  test('1. add two values from memory', () => {
    const m = runExample('add');
    assert.equal(m.status, 'halted');
    assert.equal(m.memory[2], 42);
  });

  test('2. store the larger of two values', () => {
    assert.equal(runExample('larger').memory[2], 25);
    assert.equal(runExample('larger', { 0: 40, 1: 9 }).memory[2], 40);
    assert.ok(/CMP/.test(byId.larger.code) && /B(GT|LT)/.test(byId.larger.code));
  });

  test('3. multiply by repeated addition', () => {
    assert.equal(runExample('multiply').memory[2], 42);
    assert.equal(runExample('multiply', { 0: 9, 1: 0 }).memory[2], 0);
  });

  test('4. multiply by 4 with LSL and divide by 2 with LSR', () => {
    const m = runExample('shift');
    assert.equal(m.memory[1], 52);
    assert.equal(m.memory[2], 6);
  });

  test('5. count down from 10 to 0', () => {
    const m = assemble(byId.countdown.code);
    const stored = [];
    while (m.status === 'ready') {
      const r = m.step();
      if (r.writes.some((w) => w.type === 'mem')) stored.push(m.memory[0]);
    }
    assert.equal(m.status, 'halted');
    assert.deepEqual(stored, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    assert.ok(/BNE/.test(byId.countdown.code));
  });

  test('6. odd or even using AND', () => {
    assert.equal(runExample('oddeven').memory[1], 1);
    assert.equal(runExample('oddeven', { 0: 20 }).memory[1], 0);
  });
});
