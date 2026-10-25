// AQA A-level (7517) assembly language: parser and machine.
// This module has no DOM code so it can be unit-tested with Node and reused
// by later parts of the workshop.

export const REGISTER_COUNT = 13;
export const MEMORY_SIZE = 13;
export const STEP_LIMIT = 10000;
export const WORD_SIZES = [8, 16, 32];
export const DEFAULT_WORD_SIZE = 8;

export const CONDITIONS = {
  EQ: 'equal',
  NE: 'not equal',
  GT: 'greater than',
  LT: 'less than',
};

// Operand patterns for every AQA instruction.
// reg = register, op2 = #n or Rm, mem = direct memory address, label = branch target.
const SYNTAX = {
  LDR: { operands: ['reg', 'mem'], form: 'LDR Rd, <memory ref>', example: 'LDR R1, 10' },
  STR: { operands: ['reg', 'mem'], form: 'STR Rd, <memory ref>', example: 'STR R1, 10' },
  ADD: { operands: ['reg', 'reg', 'op2'], form: 'ADD Rd, Rn, <operand2>', example: 'ADD R1, R2, #5' },
  SUB: { operands: ['reg', 'reg', 'op2'], form: 'SUB Rd, Rn, <operand2>', example: 'SUB R1, R2, #5' },
  MOV: { operands: ['reg', 'op2'], form: 'MOV Rd, <operand2>', example: 'MOV R1, #5' },
  CMP: { operands: ['reg', 'op2'], form: 'CMP Rn, <operand2>', example: 'CMP R1, #5' },
  AND: { operands: ['reg', 'reg', 'op2'], form: 'AND Rd, Rn, <operand2>', example: 'AND R1, R2, #1' },
  ORR: { operands: ['reg', 'reg', 'op2'], form: 'ORR Rd, Rn, <operand2>', example: 'ORR R1, R2, #8' },
  EOR: { operands: ['reg', 'reg', 'op2'], form: 'EOR Rd, Rn, <operand2>', example: 'EOR R1, R2, R3' },
  MVN: { operands: ['reg', 'op2'], form: 'MVN Rd, <operand2>', example: 'MVN R1, R2' },
  LSL: { operands: ['reg', 'reg', 'op2'], form: 'LSL Rd, Rn, <operand2>', example: 'LSL R1, R2, #2' },
  LSR: { operands: ['reg', 'reg', 'op2'], form: 'LSR Rd, Rn, <operand2>', example: 'LSR R1, R2, #1' },
  B: { operands: ['label'], form: 'B <label>', example: 'B loop' },
  HALT: { operands: [], form: 'HALT', example: 'HALT' },
};
for (const cond of Object.keys(CONDITIONS)) {
  SYNTAX['B' + cond] = { operands: ['label'], form: `B${cond} <label>`, example: `B${cond} loop` };
}

// Instructions students often try from other assembly languages.
const NOT_AQA = {
  MUL: 'Multiply using repeated addition or LSL.',
  MULT: 'Multiply using repeated addition or LSL.',
  DIV: 'Divide using repeated subtraction or LSR.',
  SDIV: 'Divide using repeated subtraction or LSR.',
  UDIV: 'Divide using repeated subtraction or LSR.',
  BGE: 'The only conditions are EQ, NE, GT and LT. For "greater than or equal", branch the other way with BLT.',
  BLE: 'The only conditions are EQ, NE, GT and LT. For "less than or equal", branch the other way with BGT.',
  BAL: 'To branch every time, use B on its own, for example B loop.',
  JMP: 'To branch every time, use B, for example B loop.',
  JUMP: 'To branch every time, use B, for example B loop.',
  BRA: 'To branch every time, use B, for example B loop.',
  LDA: 'To load a value from memory, use LDR, for example LDR R1, 10.',
  STA: 'To store a value in memory, use STR, for example STR R1, 10.',
  LOAD: 'To load a value from memory, use LDR, for example LDR R1, 10.',
  STORE: 'To store a value in memory, use STR, for example STR R1, 10.',
  NOT: 'For bitwise NOT, use MVN, for example MVN R1, R2.',
  OR: 'For bitwise OR, use ORR, for example ORR R1, R2, #8.',
  XOR: 'For exclusive OR, use EOR, for example EOR R1, R2, R3.',
  END: 'To stop the program, use HALT.',
  STOP: 'To stop the program, use HALT.',
  HLT: 'To stop the program, use HALT.',
};

const LABEL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ORDINALS = ['first', 'second', 'third'];

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function maxValue(wordSize) {
  return 2 ** wordSize - 1;
}

export function wrap(value, wordSize) {
  const m = 2 ** wordSize;
  return ((value % m) + m) % m;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

// Read one operand. `kind` is what the instruction expects in this position.
// Returns { operand } or { error }.
function readOperand(text, kind, position, mnemonic, wordSize) {
  const syntax = SYNTAX[mnemonic];
  const ordinal = ORDINALS[position];
  const regMatch = /^R(\d+)$/i.exec(text);
  const isImmediate = text.startsWith('#');
  const isNumber = /^\d+$/.test(text);

  if (regMatch) {
    const n = Number(regMatch[1]);
    if (n >= REGISTER_COUNT) {
      return { error: `${text.toUpperCase()} does not exist. The registers are R0 to R12.` };
    }
  }

  if (kind === 'reg') {
    if (regMatch) return { operand: { kind: 'reg', n: Number(regMatch[1]) } };
    if (isImmediate || isNumber) {
      return {
        error: `${mnemonic} needs a register as its ${ordinal} operand, for example ${syntax.example}.`,
      };
    }
    return {
      error: `"${text}" is not a register. ${mnemonic} needs a register (R0 to R12) as its ${ordinal} operand, for example ${syntax.example}.`,
    };
  }

  if (kind === 'mem') {
    if (isNumber) {
      const address = Number(text);
      if (address >= MEMORY_SIZE) {
        return {
          error: `memory address ${address} is out of range. Addresses go from 0 to ${MEMORY_SIZE - 1}.`,
        };
      }
      return { operand: { kind: 'mem', address } };
    }
    if (isImmediate) {
      return {
        error: `${mnemonic} needs a memory address written as a plain number, for example ${syntax.example}. Remove the #: a # means a value, not an address.`,
      };
    }
    if (regMatch) {
      return {
        error: `${mnemonic} needs a memory address as its ${ordinal} operand, not a register. Write the address as a plain number, for example ${syntax.example}.`,
      };
    }
    return {
      error: `"${text}" is not a memory address. Write the address as a plain number from 0 to ${MEMORY_SIZE - 1}, for example ${syntax.example}.`,
    };
  }

  if (kind === 'op2') {
    if (regMatch) return { operand: { kind: 'reg', n: Number(regMatch[1]) } };
    if (isImmediate) {
      const digits = text.slice(1).trim();
      if (!/^-?\d+$/.test(digits)) {
        return {
          error: `"${text}" is not a denary number. After the # write a whole number, for example #25.`,
        };
      }
      const value = Number(digits);
      if (value < 0) {
        return {
          error: `${text} is negative. This simulator uses unsigned numbers, so write a value from 0 to ${maxValue(wordSize)}.`,
        };
      }
      if (value > maxValue(wordSize)) {
        return {
          error: `${text} is too big for ${wordSize} bits. The largest ${wordSize}-bit value is ${maxValue(wordSize)}. Use a smaller value or a larger word size.`,
        };
      }
      return { operand: { kind: 'imm', value } };
    }
    if (isNumber) {
      return {
        error: `${text} needs a # in front to be used as a value, for example #${text}. ${mnemonic} cannot read memory directly; load the value into a register with LDR first if you meant address ${text}.`,
      };
    }
    return {
      error: `"${text}" is not a valid ${ordinal} operand for ${mnemonic}. Use a register (R0 to R12) or a value such as #5.`,
    };
  }

  // kind === 'label'
  if (LABEL_NAME.test(text) && !regMatch) return { operand: { kind: 'label', name: text } };
  if (isNumber || isImmediate) {
    return {
      error: `${mnemonic} needs a label to branch to, for example ${syntax.example}. Line numbers and addresses cannot be used.`,
    };
  }
  return {
    error: `"${text}" is not a valid label. ${mnemonic} needs a label name, for example ${syntax.example}.`,
  };
}

function parseInstruction(text, lineNumber, wordSize) {
  const spaceAt = text.search(/\s/);
  const word = spaceAt === -1 ? text : text.slice(0, spaceAt);
  const rest = spaceAt === -1 ? '' : text.slice(spaceAt).trim();
  const mnemonic = word.toUpperCase();
  const syntax = SYNTAX[mnemonic];

  if (!syntax) {
    if (NOT_AQA[mnemonic]) {
      return { error: `${mnemonic} is not part of the AQA instruction set. ${NOT_AQA[mnemonic]}` };
    }
    if (/^B[A-Z]{2}$/.test(mnemonic)) {
      return {
        error: `${mnemonic} is not part of the AQA instruction set. The branch conditions are EQ, NE, GT and LT, for example BEQ loop.`,
      };
    }
    return {
      error: `${word} is not an AQA instruction. Check the spelling, or see the Instruction reference for the instructions you can use.`,
    };
  }

  const parts = rest === '' ? [] : rest.split(',').map((p) => p.trim());
  const expected = syntax.operands.length;

  if (expected === 0 && parts.length > 0) {
    return { error: `${mnemonic} does not take any operands. Write HALT on its own.` };
  }
  if (parts.length !== expected) {
    return {
      error: `${mnemonic} needs ${plural(expected, 'operand')} (${syntax.form}), but this line has ${parts.length}. For example: ${syntax.example}.`,
    };
  }
  const blank = parts.findIndex((p) => p === '');
  if (blank !== -1) {
    return {
      error: `the ${ORDINALS[blank]} operand of ${mnemonic} is missing. Check for an extra comma. For example: ${syntax.example}.`,
    };
  }

  const operands = [];
  for (let i = 0; i < parts.length; i++) {
    const result = readOperand(parts[i], syntax.operands[i], i, mnemonic, wordSize);
    if (result.error) return { error: result.error };
    operands.push(result.operand);
  }

  const instruction = { mnemonic, operands, line: lineNumber, source: text };
  if (mnemonic.length === 3 && mnemonic.startsWith('B') && CONDITIONS[mnemonic.slice(1)]) {
    instruction.mnemonic = 'B';
    instruction.condition = mnemonic.slice(1);
  }
  return { instruction };
}

/**
 * Parse a whole program.
 * Returns { instructions, labels, errors, lineToIndex }.
 * - instructions: [{ mnemonic, condition?, operands, line, source }]
 * - labels: Map of lower-case name -> { name, index, line }
 * - errors: [{ line, message }] sorted by line. The message does not include
 *   the line number; use formatError() to add it.
 */
export function parse(source, { wordSize = DEFAULT_WORD_SIZE } = {}) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const instructions = [];
  const labels = new Map();
  const errors = [];

  lines.forEach((raw, i) => {
    const lineNumber = i + 1;
    let text = raw;
    const commentAt = text.indexOf('//');
    if (commentAt !== -1) text = text.slice(0, commentAt);
    text = text.trim();
    if (text === '') return;

    const colonAt = text.indexOf(':');
    if (colonAt !== -1) {
      const name = text.slice(0, colonAt).trim();
      if (!LABEL_NAME.test(name) || /^R\d+$/i.test(name)) {
        errors.push({
          line: lineNumber,
          message: `"${name}" is not a valid label name. A label starts with a letter, contains only letters, digits and underscores, and cannot be a register name.`,
        });
        return;
      }
      const key = name.toLowerCase();
      if (labels.has(key)) {
        errors.push({
          line: lineNumber,
          message: `the label "${name}" is already defined on line ${labels.get(key).line}. Each label can only be defined once.`,
        });
      } else {
        labels.set(key, { name, index: instructions.length, line: lineNumber });
      }
      text = text.slice(colonAt + 1).trim();
      if (text === '') return;
    }

    const result = parseInstruction(text, lineNumber, wordSize);
    if (result.error) {
      errors.push({ line: lineNumber, message: result.error });
    } else {
      instructions.push(result.instruction);
    }
  });

  for (const ins of instructions) {
    if (ins.mnemonic !== 'B') continue;
    const target = ins.operands[0].name;
    if (!labels.has(target.toLowerCase())) {
      errors.push({
        line: ins.line,
        message: `there is no label called "${target}". Add a line such as "${target}:" where the branch should go, or check the spelling.`,
      });
    }
  }

  errors.sort((a, b) => a.line - b.line);
  return { instructions, labels, errors };
}

export function formatError(error) {
  const msg = error.message.charAt(0).toUpperCase() + error.message.slice(1);
  return error.line ? `Line ${error.line}: ${msg}` : msg;
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

// Binary with a space every 4 bits, for explanations: 0000 1100.
export function toBinary(value, wordSize) {
  return value.toString(2).padStart(wordSize, '0').replace(/(.{4})(?=.)/g, '$1 ');
}

function compareWords(a, b) {
  if (a === b) return 'equal';
  return a < b ? 'less than' : 'greater than';
}

function conditionMet(condition, result) {
  switch (condition) {
    case 'EQ': return result === 'equal';
    case 'NE': return result !== 'equal';
    case 'GT': return result === 'greater than';
    case 'LT': return result === 'less than';
    default: return false;
  }
}

export class Machine {
  constructor({ wordSize = DEFAULT_WORD_SIZE } = {}) {
    if (!WORD_SIZES.includes(wordSize)) throw new Error(`Unsupported word size: ${wordSize}`);
    this.wordSize = wordSize;
    this.program = { instructions: [], labels: new Map(), errors: [] };
    this.initial = {
      registers: new Array(REGISTER_COUNT).fill(0),
      memory: new Array(MEMORY_SIZE).fill(0),
    };
    this.restart();
  }

  // Load a parsed program (from parse()). Restores the starting values.
  load(program) {
    this.program = program;
    this.restart();
  }

  // Back to the start: starting values in registers and memory, PC at 0.
  restart() {
    this.registers = [...this.initial.registers];
    this.memory = [...this.initial.memory];
    this.pc = 0;
    this.comparison = null;
    this.status = 'ready'; // ready | halted | ended | limit | error
    this.steps = 0;
    this.history = [];
    this.lastResult = null;
  }

  get started() {
    return this.steps > 0;
  }

  get finished() {
    return this.status !== 'ready';
  }

  get currentInstruction() {
    return this.program.instructions[this.pc] ?? null;
  }

  // Set a register. Before the program starts this also changes the starting value.
  setRegister(n, value) {
    const v = this.checkValue(value);
    this.registers[n] = v;
    if (!this.started) this.initial.registers[n] = v;
  }

  setMemory(address, value) {
    const v = this.checkValue(value);
    this.memory[address] = v;
    if (!this.started) this.initial.memory[address] = v;
  }

  // Replace all starting values (used by Zero / Random) and restart.
  setInitialRegisters(values) {
    this.initial.registers = values.map((v) => this.checkValue(v));
    this.restart();
  }

  setInitialMemory(values) {
    this.initial.memory = values.map((v) => this.checkValue(v));
    this.restart();
  }

  checkValue(value) {
    if (!Number.isInteger(value) || value < 0 || value > maxValue(this.wordSize)) {
      throw new RangeError(`Value must be a whole number from 0 to ${maxValue(this.wordSize)}.`);
    }
    return value;
  }

  // Change word size. Existing values are cut down to fit (wrapped) and the
  // program restarts. The caller should re-parse, as immediate limits change.
  setWordSize(wordSize) {
    if (!WORD_SIZES.includes(wordSize)) throw new Error(`Unsupported word size: ${wordSize}`);
    this.wordSize = wordSize;
    this.initial.registers = this.initial.registers.map((v) => wrap(v, wordSize));
    this.initial.memory = this.initial.memory.map((v) => wrap(v, wordSize));
    this.restart();
  }

  snapshot() {
    return {
      registers: [...this.registers],
      memory: [...this.memory],
      pc: this.pc,
      comparison: this.comparison,
      status: this.status,
      steps: this.steps,
      lastResult: this.lastResult,
    };
  }

  restore(s) {
    this.registers = [...s.registers];
    this.memory = [...s.memory];
    this.pc = s.pc;
    this.comparison = s.comparison;
    this.status = s.status;
    this.steps = s.steps;
    this.lastResult = s.lastResult;
  }

  // Undo the last instruction. Returns false if there is nothing to undo.
  stepBack() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.restore(previous);
    return true;
  }

  /**
   * Run one instruction. Returns a result:
   * { explanation, line, reads: [{type:'reg', n}|{type:'mem', address}],
   *   writes: [...same...], status, note? }
   * If the machine has already finished, returns { explanation, status } and
   * changes nothing.
   */
  step() {
    if (this.status !== 'ready') {
      return { explanation: this.finishedMessage(), reads: [], writes: [], status: this.status, line: null };
    }
    const ins = this.currentInstruction;
    if (!ins) {
      this.status = 'ended';
      const explanation = this.program.instructions.length === 0
        ? 'There are no instructions to run. Write a program in the editor first.'
        : this.finishedMessage();
      return { explanation, reads: [], writes: [], status: this.status, line: null };
    }

    this.history.push(this.snapshot());
    let result;
    try {
      result = this.execute(ins);
    } catch (err) {
      if (!(err instanceof RuntimeError)) throw err;
      this.history.pop();
      this.status = 'error';
      result = { explanation: `Line ${ins.line}: ${err.message}`, reads: [], writes: [], error: true };
    }
    result.line = ins.line;

    if (this.status === 'ready') {
      this.steps++;
      if (this.pc >= this.program.instructions.length) {
        this.status = 'ended';
        result.note = 'Reached the end of the program without HALT. AQA programs normally end with HALT.';
      } else if (this.steps >= STEP_LIMIT) {
        this.status = 'limit';
        result.note = `Stopped after ${STEP_LIMIT.toLocaleString('en-GB')} instructions. Your program may be stuck in a loop.`;
      }
    } else if (this.status === 'halted') {
      this.steps++;
    }
    result.status = this.status;
    this.lastResult = result;
    return result;
  }

  finishedMessage() {
    switch (this.status) {
      case 'halted': return 'The program has stopped at HALT. Press Reset to run it again.';
      case 'limit': return `Stopped after ${STEP_LIMIT.toLocaleString('en-GB')} instructions. Your program may be stuck in a loop.`;
      case 'error': return 'The program stopped because of an error. Press Reset to run it again.';
      default: return 'Reached the end of the program without HALT. AQA programs normally end with HALT.';
    }
  }

  // Read <operand2>: returns { value, text, read }.
  operand2(op) {
    if (op.kind === 'imm') return { value: op.value, text: String(op.value), short: `#${op.value}`, read: null };
    const value = this.registers[op.n];
    return { value, text: `R${op.n} (${value})`, short: `R${op.n} (${value})`, read: { type: 'reg', n: op.n } };
  }

  execute(ins) {
    const bits = this.wordSize;
    const max = 2 ** bits;
    const [a, b, c] = ins.operands;
    const reads = [];
    const writes = [];
    const next = () => { this.pc++; };
    const done = (explanation) => ({ explanation, reads, writes });

    switch (ins.mnemonic) {
      case 'LDR': {
        const value = this.memory[b.address];
        this.registers[a.n] = value;
        reads.push({ type: 'mem', address: b.address });
        writes.push({ type: 'reg', n: a.n });
        next();
        return done(`Copied the value in memory address ${b.address} (${value}) into R${a.n}.`);
      }
      case 'STR': {
        const value = this.registers[a.n];
        this.memory[b.address] = value;
        reads.push({ type: 'reg', n: a.n });
        writes.push({ type: 'mem', address: b.address });
        next();
        return done(`Copied the value in R${a.n} (${value}) into memory address ${b.address}.`);
      }
      case 'MOV': {
        const src = this.operand2(b);
        if (src.read) reads.push(src.read);
        this.registers[a.n] = src.value;
        writes.push({ type: 'reg', n: a.n });
        next();
        return done(b.kind === 'imm'
          ? `Copied ${src.value} into R${a.n}.`
          : `Copied the value in ${src.text} into R${a.n}.`);
      }
      case 'ADD':
      case 'SUB': {
        const n = this.registers[b.n];
        const src = this.operand2(c);
        reads.push({ type: 'reg', n: b.n });
        if (src.read) reads.push(src.read);
        const raw = ins.mnemonic === 'ADD' ? n + src.value : n - src.value;
        const value = wrap(raw, bits);
        this.registers[a.n] = value;
        writes.push({ type: 'reg', n: a.n });
        next();
        const verb = ins.mnemonic === 'ADD'
          ? `Added ${src.text} to R${b.n} (${n})`
          : `Subtracted ${src.text} from R${b.n} (${n})`;
        if (raw === value) return done(`${verb} and stored the result (${value}) in R${a.n}.`);
        const sum = ins.mnemonic === 'ADD' ? `${n} + ${src.value}` : `${n} − ${src.value}`;
        const why = raw > 0
          ? `which doesn't fit in ${bits} bits`
          : `which is below 0 and can't be stored as an unsigned ${bits}-bit number`;
        return done(`${verb}: ${sum} = ${String(raw).replace('-', '−')}, ${why}, so it wrapped round to ${value}. Stored ${value} in R${a.n}.`);
      }
      case 'CMP': {
        const n = this.registers[a.n];
        const src = this.operand2(b);
        reads.push({ type: 'reg', n: a.n });
        if (src.read) reads.push(src.read);
        const result = compareWords(n, src.value);
        this.comparison = {
          text: `R${a.n} (${n}) compared with ${src.short}: ${result}`,
          left: n,
          right: src.value,
          result,
        };
        next();
        return done(`Compared R${a.n} (${n}) with ${src.short}: ${result}.`);
      }
      case 'B': {
        const target = this.program.labels.get(a.name.toLowerCase());
        const where = target.index < this.program.instructions.length
          ? `line ${this.program.instructions[target.index].line}`
          : 'the end of the program';
        if (!ins.condition) {
          this.pc = target.index;
          return done(`B always branches. Jumped to ${target.name} (${where}).`);
        }
        const name = `B${ins.condition}`;
        if (!this.comparison) {
          throw new RuntimeError(`${name} checks the last comparison, but no CMP has run yet. Put a CMP instruction before the branch.`);
        }
        const result = this.comparison.result;
        if (conditionMet(ins.condition, result)) {
          this.pc = target.index;
          return done(`Last comparison was "${result}", so ${name} branches to ${target.name} (${where}).`);
        }
        next();
        return done(`Last comparison was "${result}", so ${name} does not branch. Moving on to the next instruction.`);
      }
      case 'AND':
      case 'ORR':
      case 'EOR': {
        const n = this.registers[b.n];
        const src = this.operand2(c);
        reads.push({ type: 'reg', n: b.n });
        if (src.read) reads.push(src.read);
        let value;
        if (ins.mnemonic === 'AND') value = (n & src.value) >>> 0;
        else if (ins.mnemonic === 'ORR') value = (n | src.value) >>> 0;
        else value = (n ^ src.value) >>> 0;
        this.registers[a.n] = value;
        writes.push({ type: 'reg', n: a.n });
        next();
        const name = { AND: 'AND', ORR: 'OR', EOR: 'Exclusive OR' }[ins.mnemonic];
        return done(`${name} of R${b.n} (${n} = ${toBinary(n, bits)}) and ${src.text} (${toBinary(src.value, bits)}) gives ${value} (${toBinary(value, bits)}). Stored in R${a.n}.`);
      }
      case 'MVN': {
        const src = this.operand2(b);
        if (src.read) reads.push(src.read);
        const value = max - 1 - src.value;
        this.registers[a.n] = value;
        writes.push({ type: 'reg', n: a.n });
        next();
        return done(`NOT of ${src.text} (${toBinary(src.value, bits)}) flips every bit, giving ${value} (${toBinary(value, bits)}). Stored in R${a.n}.`);
      }
      case 'LSL':
      case 'LSR': {
        const n = this.registers[b.n];
        const src = this.operand2(c);
        reads.push({ type: 'reg', n: b.n });
        if (src.read) reads.push(src.read);
        const places = src.value;
        const dir = ins.mnemonic === 'LSL' ? 'left' : 'right';
        let value;
        let lost = false;
        if (places >= bits) {
          value = 0;
          lost = n !== 0;
        } else if (ins.mnemonic === 'LSL') {
          const full = BigInt(n) << BigInt(places);
          value = Number(full & BigInt(max - 1));
          lost = BigInt(value) !== full;
        } else {
          value = Number(BigInt(n) >> BigInt(places));
        }
        this.registers[a.n] = value;
        writes.push({ type: 'reg', n: a.n });
        next();
        const by = src.read ? `${src.text} places` : plural(places, 'place');
        let text = `Shifted R${b.n} (${n} = ${toBinary(n, bits)}) ${dir} by ${by}, giving ${value} (${toBinary(value, bits)}).`;
        if (places >= bits && n !== 0) {
          text += ` Shifting by ${bits} or more places moves every bit out, so the result is 0.`;
        } else if (lost && dir === 'left') {
          text += ` Some 1 bits were shifted out of the ${bits}-bit word and lost, so the answer wrapped round.`;
        }
        return done(`${text} Stored in R${a.n}.`);
      }
      case 'HALT': {
        this.status = 'halted';
        return done('HALT: the program has stopped.');
      }
      default:
        throw new RuntimeError(`${ins.mnemonic} cannot be run.`);
    }
  }
}

export class RuntimeError extends Error {}

// Convenience: parse and load in one go. Throws if the program has errors.
export function assemble(source, options = {}) {
  const program = parse(source, options);
  if (program.errors.length) {
    throw new Error(program.errors.map(formatError).join('\n'));
  }
  const machine = new Machine(options);
  machine.load(program);
  return machine;
}

// Run until the machine stops. Returns the machine.
export function runToEnd(machine) {
  while (machine.status === 'ready') machine.step();
  return machine;
}

export const INSTRUCTION_SYNTAX = SYNTAX;
