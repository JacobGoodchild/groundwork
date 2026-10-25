// Assembly simulator page. All the simulation happens in aqa.js; this file
// only draws the machine and responds to the controls.

import {
  parse, formatError, Machine, maxValue,
  REGISTER_COUNT, MEMORY_SIZE, DEFAULT_WORD_SIZE, WORD_SIZES,
} from './aqa.js';
import { EXAMPLES } from './examples.js';

const STORAGE_KEY = 'groundwork.assembly.v1';
const HISTORY_LENGTH = 20;
// Delay between instructions (ms) for each speed setting. 0 means as fast as possible.
const SPEEDS = [1000, 700, 500, 350, 250, 150, 80, 40, 15, 0];

const $ = (id) => document.getElementById(id);
const ui = {
  step: $('step'), stepBack: $('step-back'), run: $('run'), reset: $('reset'), speed: $('speed'),
  examples: $('examples'), format: $('format'), wordSize: $('word-size'),
  regZero: $('registers-zero'), regRandom: $('registers-random'),
  memZero: $('memory-zero'), memRandom: $('memory-random'),
  code: $('code'), gutter: $('gutter'), backdrop: $('backdrop'), errors: $('errors'),
  registers: $('registers'), memory: $('memory'), pc: $('pc'), comparison: $('comparison'),
  explanation: $('explanation'), history: $('history'),
  settingsToggle: $('settings-toggle'), settingsMenu: $('settings-menu'),
};

const state = {
  machine: new Machine({ wordSize: DEFAULT_WORD_SIZE }),
  format: 'dec',
  dirty: true,         // the editor has changed since the program was last parsed
  errorLines: new Set(),
  runtimeErrorLine: null,
  timer: null,
  running: false,
  reads: [],
  writes: [],
  log: [],
};

// ---------- Saving ----------

function save() {
  const m = state.machine;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      code: ui.code.value,
      format: state.format,
      wordSize: m.wordSize,
      registers: m.initial.registers,
      memory: m.initial.memory,
    }));
  } catch {
    // Storage may be unavailable (private browsing); the page still works.
  }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- Number formatting ----------

function formatValue(value, format = state.format, bits = state.machine.wordSize) {
  if (format === 'bin') {
    const groups = value.toString(2).padStart(bits, '0').replace(/(.{4})(?=.)/g, '$1 ');
    // 32-bit binary is shown as two lines of 16 bits.
    return bits === 32 ? `${groups.slice(0, 19)}\n${groups.slice(20)}` : groups;
  }
  if (format === 'hex') return value.toString(16).toUpperCase().padStart(bits / 4, '0');
  return String(value);
}

function valueWidth() {
  const bits = state.machine.wordSize;
  if (state.format === 'bin') return bits + bits / 4 - 1;
  if (state.format === 'hex') return bits / 4;
  return String(maxValue(bits)).length;
}

const FORMAT_NAMES = { dec: 'denary', bin: 'binary', hex: 'hexadecimal' };

// Read a value typed into a register or memory slot, in the current format.
function readValue(text) {
  const t = text.trim().replace(/[\s_]/g, '');
  const bits = state.machine.wordSize;
  let value;
  if (state.format === 'bin') {
    if (!/^[01]+$/.test(t)) return { error: 'Use only the digits 0 and 1 for a binary value.' };
    value = parseInt(t, 2);
  } else if (state.format === 'hex') {
    const h = t.replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(h)) return { error: 'Use only 0–9 and A–F for a hexadecimal value.' };
    value = parseInt(h, 16);
  } else {
    if (!/^\d+$/.test(t)) return { error: 'Enter a whole number, for example 12.' };
    value = Number(t);
  }
  if (value > maxValue(bits)) {
    return { error: `${text.trim()} is too big for ${bits} bits. Enter a value from 0 to ${formatValue(maxValue(bits))} (${FORMAT_NAMES[state.format]}).` };
  }
  return { value };
}

// ---------- Building the grids ----------

function makeCell(kind, index) {
  const label = kind === 'reg' ? `R${index}` : String(index);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.dataset.kind = kind;
  button.dataset.index = index;
  button.innerHTML = `<span class="cell-label"></span><span class="cell-value"></span>`;
  button.querySelector('.cell-label').textContent = label;
  button.addEventListener('click', () => beginEdit(button));
  return button;
}

const registerCells = [];
const memoryCells = [];
for (let i = 0; i < REGISTER_COUNT; i++) {
  const c = makeCell('reg', i);
  registerCells.push(c);
  ui.registers.append(c);
}
for (let i = 0; i < MEMORY_SIZE; i++) {
  const c = makeCell('mem', i);
  memoryCells.push(c);
  ui.memory.append(c);
}

for (const ex of EXAMPLES) {
  const opt = document.createElement('option');
  opt.value = ex.id;
  opt.textContent = ex.title;
  ui.examples.append(opt);
}

// ---------- Editing values ----------

function beginEdit(button) {
  if (state.running || button.querySelector('input')) return;
  const kind = button.dataset.kind;
  const index = Number(button.dataset.index);
  const m = state.machine;
  const current = kind === 'reg' ? m.registers[index] : m.memory[index];
  const name = kind === 'reg' ? `R${index}` : `memory address ${index}`;

  const valueSpan = button.querySelector('.cell-value');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = formatValue(current).replace(/\s/g, '');
  input.setAttribute('aria-label', `New value for ${name}, in ${FORMAT_NAMES[state.format]}`);
  input.spellcheck = false;
  valueSpan.hidden = true;
  button.append(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    if (commit) {
      const result = readValue(input.value);
      if (result.error) {
        say(`Could not change ${name}. ${result.error}`, { error: true, log: false });
      } else if (result.value !== current) {
        if (kind === 'reg') m.setRegister(index, result.value);
        else m.setMemory(index, result.value);
        state.writes = [{ type: kind, n: index, address: index }];
        state.reads = [];
        say(`Set ${name} to ${result.value}${m.started ? '.' : ' before the program runs.'}`, { log: false });
        save();
      }
    }
    input.remove();
    valueSpan.hidden = false;
    render();
    button.focus();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    e.stopPropagation();
  });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
}

// ---------- Messages ----------

function say(text, { error = false, line = null, log = true } = {}) {
  ui.explanation.textContent = text;
  ui.explanation.classList.toggle('is-error', error);
  if (log) addToLog(text, line);
}

function addToLog(text, line) {
  state.log.unshift({ text, line });
  if (state.log.length > HISTORY_LENGTH) state.log.length = HISTORY_LENGTH;
}

function renderLog() {
  // The newest entry is already shown above the list, so the list starts from the one before.
  const items = state.log.slice(1).map(({ text, line }) => {
    const li = document.createElement('li');
    if (line) {
      const ref = document.createElement('span');
      ref.className = 'line-ref';
      ref.textContent = `Line ${line}`;
      li.append(ref);
    }
    li.append(text);
    return li;
  });
  ui.history.replaceChildren(...items);
}

// ---------- Editor ----------

function renderEditor() {
  const lines = ui.code.value.split('\n');
  const m = state.machine;
  const current = !state.dirty && m.status === 'ready' && m.currentInstruction
    ? m.currentInstruction.line
    : null;

  const gutter = [];
  const back = [];
  lines.forEach((_, i) => {
    const n = i + 1;
    const classes = [];
    if (n === current) classes.push('is-current');
    if (state.errorLines.has(n) || n === state.runtimeErrorLine) classes.push('has-error');
    const g = document.createElement('div');
    g.textContent = n;
    const b = document.createElement('div');
    if (classes.length) { g.className = classes.join(' '); b.className = classes.join(' '); }
    gutter.push(g);
    back.push(b);
  });
  ui.gutter.replaceChildren(...gutter);
  ui.backdrop.replaceChildren(...back);
  syncScroll();
  return current;
}

function syncScroll() {
  const top = ui.code.scrollTop;
  ui.gutter.scrollTop = top;
  ui.backdrop.scrollTop = top;
  ui.backdrop.scrollLeft = ui.code.scrollLeft;
}

function scrollLineIntoView(line) {
  if (!line) return;
  const lineHeight = parseFloat(getComputedStyle(ui.code).lineHeight) || 22;
  const padding = parseFloat(getComputedStyle(ui.code).paddingTop) || 0;
  const top = padding + (line - 1) * lineHeight;
  const view = ui.code.clientHeight;
  if (top < ui.code.scrollTop || top + lineHeight > ui.code.scrollTop + view) {
    ui.code.scrollTop = Math.max(0, top - view / 3);
    syncScroll();
  }
}

function showErrors(errors) {
  state.errorLines = new Set(errors.map((e) => e.line));
  ui.errors.replaceChildren(...errors.map((e) => {
    const li = document.createElement('li');
    li.textContent = formatError(e);
    return li;
  }));
}

// Parse the editor contents and load them into the machine.
// Returns true if the program is ready to run.
function prepare() {
  const program = parse(ui.code.value, { wordSize: state.machine.wordSize });
  showErrors(program.errors);
  state.runtimeErrorLine = null;
  if (program.errors.length) {
    const n = program.errors.length;
    say(`The program has ${n === 1 ? 'an error' : `${n} errors`}, listed under the editor.`, { error: true });
    state.dirty = true;
    render();
    return false;
  }
  state.machine.load(program);
  state.dirty = false;
  return true;
}

// ---------- Drawing the machine ----------

function markCells(cells, kind) {
  cells.forEach((cell, i) => {
    const read = state.reads.some((r) => r.type === kind && (kind === 'reg' ? r.n : r.address) === i);
    const written = state.writes.some((w) => w.type === kind && (kind === 'reg' ? w.n : w.address) === i);
    cell.classList.toggle('is-read', read && !written);
    if (written) {
      // Restart the highlight even if the same cell changed last time.
      cell.classList.remove('is-written');
      void cell.offsetWidth;
      cell.classList.add('is-written');
    } else {
      cell.classList.remove('is-written');
    }
  });
}

function renderCells(cells, values, kind) {
  cells.forEach((cell, i) => {
    const text = formatValue(values[i]);
    cell.querySelector('.cell-value').textContent = text;
    const name = kind === 'reg' ? `R${i}` : `Memory address ${i}`;
    cell.setAttribute('aria-label', `${name}: ${values[i]}${state.running ? '' : '. Press to change.'}`);
    cell.disabled = state.running;
  });
  markCells(cells, kind);
}

function render() {
  const m = state.machine;
  // Cap the width at 19 characters so 32-bit binary wraps onto two lines.
  const width = `calc(${Math.min(Math.max(valueWidth(), 3), 19)}ch + 1.25rem)`;
  ui.registers.style.setProperty('--cell-min', width);
  ui.memory.style.setProperty('--cell-min', width);

  renderCells(registerCells, m.registers, 'reg');
  renderCells(memoryCells, m.memory, 'mem');

  const current = renderEditor();
  if (current) scrollLineIntoView(current);

  if (state.dirty) {
    ui.pc.textContent = `${formatValue(m.pc)} (program not yet checked)`;
  } else if (m.status === 'ready' && current) {
    ui.pc.textContent = `${formatValue(m.pc)} (next: line ${current})`;
  } else {
    const words = { halted: 'stopped at HALT', ended: 'end of program', limit: 'stopped', error: 'stopped by an error', ready: 'end of program' };
    ui.pc.textContent = `${formatValue(m.pc)} (${words[m.status]})`;
  }
  ui.comparison.textContent = m.comparison ? m.comparison.text : 'No comparison yet';

  const finished = !state.dirty && m.finished;
  ui.step.disabled = state.running || finished;
  ui.stepBack.disabled = state.running || state.dirty || m.history.length === 0;
  ui.run.disabled = !state.running && finished;
  const runLabel = state.running ? 'Pause' : 'Run';
  ui.run.setAttribute('aria-label', runLabel);
  ui.run.title = runLabel;
  ui.run.setAttribute('aria-pressed', String(state.running));
  ui.code.readOnly = state.running;
  for (const el of [ui.examples, ui.format, ui.wordSize, ui.regZero, ui.regRandom, ui.memZero, ui.memRandom]) {
    el.disabled = state.running;
  }
  renderLog();
}

// ---------- Running ----------

function applyResult(result) {
  state.reads = result.reads;
  state.writes = result.writes;
  if (result.error) {
    state.runtimeErrorLine = result.line;
    say(result.explanation, { error: true, line: null });
  } else {
    say(result.explanation, { line: result.line });
  }
  if (result.note) say(result.note, { error: result.status === 'limit' });
}

function stepOnce() {
  const m = state.machine;
  if (state.dirty) {
    const restarting = m.started;
    if (!prepare()) return false;
    if (restarting) addToLog('The program was changed, so it started again from line 1.', null);
  }
  if (m.finished) {
    say(m.finishedMessage(), { log: false });
    return false;
  }
  applyResult(m.step());
  return !m.finished;
}

function step() {
  stepOnce();
  render();
}

function stepBack() {
  const m = state.machine;
  const undone = m.lastResult;
  if (!m.stepBack()) return;
  state.reads = [];
  state.writes = [];
  state.runtimeErrorLine = null;
  const next = m.currentInstruction;
  say(`Stepped back: undid line ${undone?.line ?? '?'}. ${next ? `The next instruction is line ${next.line}.` : ''}`.trim(), { log: true });
  render();
}

function stop() {
  clearTimeout(state.timer);
  state.timer = null;
  state.running = false;
}

function tick() {
  const delay = SPEEDS[Number(ui.speed.value) - 1];
  let more = true;
  if (delay === 0) {
    // Fastest setting: run a batch of instructions, then redraw.
    for (let i = 0; i < 250 && more; i++) more = stepOnce();
  } else {
    more = stepOnce();
  }
  if (!more) stop();
  render();
  if (more) state.timer = setTimeout(tick, delay);
}

function toggleRun() {
  if (state.running) {
    stop();
    say('Paused.', { log: false });
    render();
    return;
  }
  if (state.dirty && !prepare()) return;
  if (state.machine.finished) return;
  state.running = true;
  render();
  tick();
}

function reset() {
  stop();
  state.reads = [];
  state.writes = [];
  state.runtimeErrorLine = null;
  if (state.dirty) {
    if (!prepare()) return;
  } else {
    state.machine.restart();
  }
  const first = state.machine.currentInstruction;
  say(`Reset. Registers and memory are back to their starting values${first ? `, and the next instruction is line ${first.line}` : ''}.`);
  render();
}

// ---------- Setup controls ----------

function randomValues(count) {
  const max = maxValue(state.machine.wordSize);
  // Keep random values small enough to read at a glance in 16 and 32-bit modes.
  const limit = Math.min(max, 255);
  return Array.from({ length: count }, () => Math.floor(Math.random() * (limit + 1)));
}

function setStart(what, values, words) {
  stop();
  const m = state.machine;
  if (what === 'reg') m.setInitialRegisters(values);
  else m.setInitialMemory(values);
  state.reads = [];
  state.writes = [];
  state.runtimeErrorLine = null;
  say(`${words} The program will start again from line 1.`);
  save();
  render();
}

function loadExample(id) {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) return;
  const text = ui.code.value.trim();
  const isExample = text === '' || EXAMPLES.some((e) => e.code.trim() === text);
  if (!isExample && !window.confirm('Loading an example will replace the program in the editor. Continue?')) return;

  stop();
  ui.code.value = ex.code;
  ui.code.scrollTop = 0;
  const memory = new Array(MEMORY_SIZE).fill(0);
  for (const [address, value] of Object.entries(ex.memory)) memory[address] = value;
  state.machine.setInitialRegisters(new Array(REGISTER_COUNT).fill(0));
  state.machine.setInitialMemory(memory);
  state.reads = [];
  state.writes = [];
  state.log = [];
  if (prepare()) {
    const set = Object.keys(ex.memory);
    const setText = set.length === 0 ? '' : ` Memory address${set.length > 1 ? 'es' : ''} ${set.join(' and ')} ${set.length > 1 ? 'have' : 'has'} been given starting values.`;
    say(`Loaded "${ex.title}".${setText}`);
  }
  save();
  render();
}

// ---------- Wiring ----------

ui.step.addEventListener('click', step);
ui.stepBack.addEventListener('click', stepBack);
ui.run.addEventListener('click', toggleRun);
ui.reset.addEventListener('click', reset);

function describeSpeed() {
  const delay = SPEEDS[Number(ui.speed.value) - 1];
  const text = delay === 0 ? 'as fast as possible' : `about ${Math.max(1, Math.round(1000 / delay))} instructions per second`;
  ui.speed.setAttribute('aria-valuetext', text);
  ui.speed.title = text.charAt(0).toUpperCase() + text.slice(1);
}
ui.speed.addEventListener('input', describeSpeed);

ui.regZero.addEventListener('click', () => setStart('reg', new Array(REGISTER_COUNT).fill(0), 'All registers set to 0.'));
ui.regRandom.addEventListener('click', () => setStart('reg', randomValues(REGISTER_COUNT), 'Registers set to random values.'));
ui.memZero.addEventListener('click', () => setStart('mem', new Array(MEMORY_SIZE).fill(0), 'All memory locations set to 0.'));
ui.memRandom.addEventListener('click', () => setStart('mem', randomValues(MEMORY_SIZE), 'Memory set to random values.'));

ui.examples.addEventListener('change', () => {
  const id = ui.examples.value;
  ui.examples.value = '';
  closeSettings(false);
  loadExample(id);
});

// ---------- Settings menu ----------

function openSettings() {
  ui.settingsMenu.hidden = false;
  ui.settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings(returnFocus = true) {
  if (ui.settingsMenu.hidden) return;
  ui.settingsMenu.hidden = true;
  ui.settingsToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) ui.settingsToggle.focus();
}

ui.settingsToggle.addEventListener('click', () => {
  if (ui.settingsMenu.hidden) openSettings();
  else closeSettings(false);
});
document.addEventListener('click', (e) => {
  if (!ui.settingsMenu.hidden && !e.target.closest('.settings')) closeSettings(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !ui.settingsMenu.hidden) closeSettings();
});

ui.format.addEventListener('change', () => {
  state.format = ui.format.value;
  save();
  render();
});

ui.wordSize.addEventListener('change', () => {
  stop();
  state.machine.setWordSize(Number(ui.wordSize.value));
  state.reads = [];
  state.writes = [];
  if (prepare()) say(`Word size is now ${state.machine.wordSize} bits. Values go from 0 to ${maxValue(state.machine.wordSize).toLocaleString('en-GB')}. The program will start again from line 1.`);
  save();
  render();
});

let saveTimer = null;
ui.code.addEventListener('input', () => {
  state.dirty = true;
  state.errorLines = new Set();
  state.runtimeErrorLine = null;
  ui.errors.replaceChildren();
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
});
ui.code.addEventListener('scroll', syncScroll);

// ---------- Start-up ----------

// Programs saved before the examples lost their comments are swapped for the
// new version of the same example.
function stripComments(code) {
  return code.split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean).join('\n');
}

function upgradeSavedCode(code) {
  if (!code.includes('//')) return code;
  const match = EXAMPLES.find((e) => stripComments(e.code) === stripComments(code));
  return match ? match.code : code;
}

function fit(values, length) {
  return Array.from({ length }, (_, i) => values[i] ?? 0);
}

function start() {
  const saved = loadSaved();
  const m = state.machine;
  if (saved && typeof saved.code === 'string') {
    if (WORD_SIZES.includes(saved.wordSize)) m.setWordSize(saved.wordSize);
    if (FORMAT_NAMES[saved.format]) state.format = saved.format;
    try {
      if (Array.isArray(saved.registers)) m.setInitialRegisters(fit(saved.registers, REGISTER_COUNT));
      if (Array.isArray(saved.memory)) m.setInitialMemory(fit(saved.memory, MEMORY_SIZE));
    } catch {
      // Ignore saved values that no longer fit.
    }
    ui.code.value = upgradeSavedCode(saved.code);
  } else {
    const first = EXAMPLES[0];
    ui.code.value = first.code;
    const memory = new Array(MEMORY_SIZE).fill(0);
    for (const [address, value] of Object.entries(first.memory)) memory[address] = value;
    m.setInitialMemory(memory);
  }
  ui.format.value = state.format;
  ui.wordSize.value = String(m.wordSize);
  describeSpeed();
  const program = parse(ui.code.value, { wordSize: m.wordSize });
  if (program.errors.length === 0) {
    m.load(program);
    state.dirty = false;
  }
  render();
}

start();
