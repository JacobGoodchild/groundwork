# Groundwork: vision and roadmap

This document explains what Groundwork is ultimately for, so that every session builds towards the same thing. `STYLE.md` says how pages look and read. `NOTES.md` records what has been built and decided. **This file says what we are building and why.** Read all three before starting work.

If a request in a session conflicts with this file, follow the request and note the change here.

**Changes since the first version** (agreed with the owner):
- 3.4: the instruction encoding follows AQA's opcode-plus-operand model from specification 4.7.3.3, with the addressing mode in the opcode, rather than being invented freely.
- 3.6: levels follow the IDE style the owner chose for the tools: one short goal, no on-screen instructions about using the page.
- Chapters 5 and 6: added the stored program concept (specification 4.7.2), which was missing.

---

## 1. What Groundwork is

Groundwork is a learning website for AQA A-level Computer Science (7517). It is built first for its owner, an A-level student, and second for any other A-level student who finds it useful.

Its purpose is **understanding**. The owner wants to see, in a way that genuinely makes sense, how a computer works from the bottom up: how switches become logic gates, how gates become an adder, how binary becomes an instruction, how an instruction makes the processor and memory do something, and how assembly programs run on all of that.

It is **not**:
- a portfolio or product site with sections to scroll through and admire
- a game where pieces snap into place and something "apparently" starts working
- a research-level tool. It is pitched at A-level, with A-level language and A-level depth
- an AI or machine-learning project. No AI features anywhere on the site

### Two kinds of thing on the site

1. **Tools** (sandboxes). Standalone, free-play tools for one topic: the assembly simulator, the logic gates builder, and later things like Boolean algebra, Dijkstra's algorithm and finite state machines. Open one and use it immediately. These already follow the IDE style in `STYLE.md`.

2. **The workshop: "Build a computer"** (guided). A sequence of chapters where the student builds a working computer from logic gates upwards, one tested part at a time, and finishes by writing assembly that runs on the computer they built. This is the main long-term goal of the site.

The tools come first. Each tool's DOM-free core (`logic/logic.js`, `assembly/aqa.js`, and so on) is written so the workshop can reuse it later. **The workshop is assembled from the tools' cores, not written separately.**

---

## 2. What is wrong with existing simulators

The owner tried the Peter Higginson AQA simulator and the game *Turing Complete*, and found both confusing.

- **Everything is on screen at once.** Every wire, register and gate is visible together, so the screen becomes a tangle of coloured lines. You can't see what matters for the step you're on.
- **No sense of where data goes.** Numbers change, but you can't follow a value from where it came from to where it ended up.
- **Unexplained jargon and layout.** Panels and terms appear with no indication of what they are or why they matter.
- **Not matched to the course.** They don't use AQA's notation, instruction set or exam conventions.

Groundwork's answer to each of these is in the principles below.

---

## 3. Principles

### 3.1 Build it, then box it up

This is the central idea and the answer to the "wall of wires" problem.

- At each level, the student builds a part from the parts of the level below. For example, a half adder from an XOR gate and an AND gate.
- When the part passes its check (3.2), it becomes a **component**: a neat box with labelled pins, for example `HALF ADDER` with inputs `A`, `B` and outputs `S`, `C`.
- From then on, that component appears in the parts list as a single box. The screen only ever shows boxes from the level just below, so it never becomes cluttered.
- **Nothing is magic.** Every box on screen is one the student built and tested earlier. Double-clicking (or pressing Enter on) a component opens it and shows the circuit inside, with live values, then you can step back out. This "zoom in, zoom out" is how the workshop shows that a CPU really is just gates.
- **Build one, then copy.** Where a design needs many identical parts (8 one-bit adders for an 8-bit adder, 13 registers), the student builds one, and the workshop can then provide copies of *their* part. Repetition is not learning; understanding the first one is.

### 3.2 It can fail, and you fix it

- Every level has a **check**. The student presses Check and the workshop tests their circuit against the required behaviour: every row of the truth table for small circuits, or a set of test cases for bigger ones (for example "5 + 3 = 8", "255 + 1 = 0 with carry out 1").
- The circuit is simulated honestly. If it is wired wrongly, it gives the wrong answer, and the check fails.
- A failed check says exactly what went wrong in plain English, using the actual values:
  "When A = 1 and B = 1, your circuit outputs S = 1. It should be 0."
  The workshop then sets the inputs to that failing case so the student can watch the wrong value happen.
- **Hints, not answers.** After a failed check, a Hint button gives a nudge, then a more specific nudge if pressed again. Written like a teacher, never like a cheerleader. For example: "S should only be 1 when exactly one input is 1. Which gate does that?" A full worked solution is only shown if the student explicitly asks for it, and it is clearly labelled.
- A part can only be used in later levels once it has passed its check.

### 3.3 See data move

The owner wants to see "how data flows through those logic gates and it actually works". So:

- **Wires show their value.** A wire carrying 1 is coloured (teal, as in the logic tool), 0 is grey. This already exists in the logic tool.
- **Step-through propagation.** For a combinational circuit, a Step mode shows signals settling one gate at a time (in evaluation order), so the student can follow a change from an input to an output.
- **Buses are one line with a number on it.** An 8-bit bus is drawn as a single thicker line labelled with its current value (in the chosen number format), not as 8 separate wires. Hovering or clicking shows the individual bits. This is the single biggest thing that stops the CPU view becoming a *Turing Complete*-style mess.
- **Highlight what this step uses.** When the CPU runs a step, only the parts and buses involved are emphasised. Everything else is dimmed. The log says what happened in words.
- **The log explains, using real values.** "The program counter (4) was copied to the MAR along the address bus." Same style as the assembly simulator's log.

### 3.4 From binary to instructions

The moment the owner most wants to see: **how a pattern of 1s and 0s makes the computer do something.** Show it explicitly:

1. An assembly line, for example `ADD R1, R2, #5`.
2. The same instruction as binary, split into labelled fields. AQA does not fix a binary encoding for its assembly language, but the specification (4.7.3.3) does describe the model to use: an instruction is an **opcode** followed by one or more **operands** (a value, a memory address or a register), and the opcode bits include the **addressing mode** (immediate or direct, 4.7.3.4), so the opcode says both what to do and how to read the operand. AQA's own example is an 8-bit instruction: a 4-bit opcode (3 bits for the operation, 1 bit for the addressing mode) and a 4-bit operand. The workshop's encoding follows this model, scaled up as needed to fit AQA's instructions and registers, and **says clearly that the exact bit layout is Groundwork's own**, while the opcode-plus-operand structure is AQA's.
3. The decoder: the opcode bits go into a decoder circuit the student built, and exactly one control line switches on.
4. That control line visibly enables the parts it controls (the ALU set to add, the right register selected to receive the result).

Seeing "these 4 bits switched on the ADD line, which made the ALU add" is the point where binary stops being abstract.

### 3.5 Realistic for A-level

- Use AQA's terms, notation and conventions everywhere: `.` for AND, `+` for OR, overbar for NOT, `⊕` for XOR; the AQA register names (PC, CIR, MAR, MBR, SR); the AQA assembly instruction set; AQA's truth table layout.
- Every chapter lists the AQA specification points it covers (check the exact section numbers against the specification document). Anything that goes beyond the specification is labelled "Beyond the specification" in its reference panel, kept short, and only included because it makes the specified content make sense.
- Pitch explanations at A-level. Accurate, but simplified where the full truth is degree-level (for example, transistors are explained as switches, not semiconductor physics).

### 3.6 Clean and serious, not "AI-made"

All of `STYLE.md` applies. In particular, for the workshop:
- No XP, stars, badges, streaks, confetti, sound effects, mascots or story characters.
- No welcome screens or motivational text. Opening a level shows the level.
- Levels feel like the tools: an IDE, not a tutorial page. Each level has one short goal (one or two sentences saying what to build and what it must do) and nothing else on screen telling the student how to use the page. Explanation lives in the log, the hints and the reference panel.
- The site should feel like a carefully made textbook companion that a person built.

---

## 4. The workshop: chapters

This is the planned path. Each chapter is a set of levels. Each level has:
- **Goal**: one or two sentences, for example "Build a half adder. It adds two bits, A and B, and outputs a sum S and a carry C."
- **Parts available**: only components the student has already built (plus basic inputs and outputs).
- **Check**: the tests from 3.2.
- **Reference**: a collapsible panel with the relevant AQA wording and, where needed, a short "Beyond the specification" note.
- **Log**: what happened, as in the tools.

Progress and built components are saved in the browser (localStorage, wrapped in try/catch), so the student keeps their computer between visits. Provide export and import of progress as a file, so it isn't lost if the browser is cleared.

### Chapter 0: Switches (beyond the specification, short)

Purpose: show that a gate isn't magic.
- A transistor shown as a simple electrically controlled switch: when its control input is 1, current can flow.
- Levels: make NOT from one switch, NAND from two switches in series, NOR from two in parallel.
- After this chapter, NAND (or the student's chosen starting gate) becomes a component.
- Keep this chapter to 3 or 4 levels. It is background, clearly labelled as beyond the specification.

### Chapter 1: Logic gates (AQA 4.6.4)

- Build NOT, AND, OR, NOR, XOR from NAND gates (the student's own NAND from Chapter 0).
- Each passes its truth table check and becomes a component.
- Reuses `logic/logic.js` and the logic tool's canvas, shapes and wiring.

### Chapter 2: Boolean algebra (AQA 4.6.5)

- Levels where a circuit is given and the student builds a simpler equivalent one, checked by comparing truth tables.
- De Morgan's laws and the Boolean identities, shown as "these two circuits always give the same output".
- Ties the expression shown in the logic tool to the circuit.

### Chapter 3: Arithmetic

- Half adder, full adder (AQA 4.6.4: students must be able to draw and explain these).
- 8-bit adder from 8 full adders (build one, copy).
- Subtraction using two's complement (links to AQA data representation): invert and add 1.
- A simple ALU: chooses between ADD, SUB, AND, OR, EOR, NOT and shifts using a selector input. Its operations line up with the AQA assembly instructions it will later run.

### Chapter 4: Memory

- Feedback: why a circuit whose output loops back can "remember". A simple latch.
- The edge-triggered D-type flip-flop (AQA 4.6.4: "be familiar with the use of"), with a visible clock.
- The clock: a Tick button and a Run speed control. One tick at a time is the default.
- One-bit register, then an 8-bit register (copy), then a register file (copies of the student's register, enough for R0 to R12).
- A small RAM: addresses, a read/write control line, and an address decoder the student builds.

### Chapter 5: Buses and architecture (AQA 4.7.1, 4.7.2)

- The address bus, data bus and control bus, drawn as in 3.3.
- Connect the processor parts to memory with buses.
- **The stored program concept** (AQA 4.7.2): machine code instructions are stored in main memory and fetched and executed one at a time by the processor. From this chapter on, the program is shown sitting in memory as binary, next to the data. (The assembly simulator tool keeps the program separately, which is fine for a sandbox; the workshop shows it properly.)
- **Von Neumann and Harvard**: build both. In Von Neumann, instructions and data share one memory and one set of buses, so fetching an instruction and reading data take turns. In Harvard, they have separate memories and buses. Show the difference running the same program side by side, with a count of how many ticks each takes.

### Chapter 6: The processor (AQA 4.7.2, 4.7.3)

- The dedicated registers: PC, CIR, MAR, MBR and SR (status register, holding the result of `CMP`).
- The control unit and the instruction decoder (3.4).
- **The fetch–decode–execute cycle**, step by step, each stage highlighted:
  - Fetch: PC → MAR (address bus); memory → MBR (data bus); MBR → CIR; PC incremented.
  - Decode: CIR split into fields; opcode into the decoder; control lines set.
  - Execute: the ALU, registers or memory do the work; results written back.
- Each stage uses AQA's register transfer descriptions.
- At the end of this chapter, the student's processor runs single instructions loaded by hand in binary.

### Chapter 7: Assembly on your computer (AQA 4.7.3: machine code and assembly)

- The assembly editor from the assembly simulator, now connected to the student's processor instead of the simulator's built-in machine.
- An assembler step that shows each line becoming binary (3.4) and being placed into memory (Von Neumann) or instruction memory (Harvard).
- The student writes and runs AQA assembly programs, and can switch between the simple view (registers, memory, as in the simulator) and the full view (their CPU with data moving on the buses).
- Reuse `assembly/aqa.js` for parsing, error messages and the expected results: the workshop can check the student's CPU against the simulator by running the same program on both and comparing the registers and memory afterwards. A mismatch means a bug in the student's CPU, and the log says which instruction first gave a different result.

### Chapter 8: Input, output and a screen (mostly beyond the specification)

- Memory-mapped input and output: certain addresses are wired to a small screen (for example a 16 by 16 grid of pixels) and to a keyboard.
- I/O controllers explained at AQA level (AQA 4.7.1).
- Write assembly that draws on the screen and reads a key.

### Chapter 9 (stretch): Snake

- If the workshop gets this far: write Snake in AQA assembly and run it on the computer the student built.
- Needs a screen, keyboard input and some source of randomness (for example a memory address wired to a simple counter or random-number circuit, labelled as Groundwork's own addition).
- It is fine if the project never reaches this chapter. Everything before it should be complete and solid first.

### Later topics (ideas, not planned yet)

Interrupts, factors affecting processor performance, translators (assembler, compiler, interpreter), and much later networking (TCP/IP) could become chapters or tools. Do not start these without being asked.

---

## 5. The tools

Tools are standalone, free-play and IDE-style (`STYLE.md`). They should each be useful on their own, and their cores must be reusable by the workshop.

### Assembly simulator (`/assembly/`): built

Matches what the owner asked for: a code area, registers R0 to R12, buttons to fill registers and memory with zeros or random values, a small memory area, and visible data movement (written cells highlight, read cells are marked). Memory is 13 slots (changed from 26 at the owner's request). See `NOTES.md` for its decisions. Keep it as it is unless asked.

### Logic gates (`/logic/`): built (sandbox)

A free circuit builder with the six AQA gates, truth table and Boolean expression. For the workshop it will need:
- **Custom components** (3.1): save a circuit as a component with named pins, use it in another circuit, open it to see inside.
- **Multi-bit buses** (3.3).
- **Feedback and a clock** for flip-flops (Chapter 4). The sandbox currently refuses feedback; the workshop will need a separate evaluation mode that allows it with a clock.
- **Checks** against a target truth table or test cases (3.2).

These belong in `logic/logic.js` (DOM-free, unit-tested) so both the sandbox and the workshop can use them.

### Other tools (planned, build only when asked)

- **Dijkstra's shortest path**: draw your own weighted graph, choose a start node, then step through the algorithm. Show the priority queue, the distance table and the previous-node table updating at every step, in AQA's style. The log explains each step: "Visited C (distance 5). Updated D from ∞ to 7 via C."
- **Boolean algebra**: type an expression, simplify it step by step naming the identity used at each step, and see the circuit and truth table for each stage.
- **Finite state machines**: draw a state transition diagram and run input strings through it.
- Others as the owner asks: they should follow the same pattern.

---

## 6. How sessions should work

- **One roadmap item per session.** Each session is given a specific item (for example "add custom components to the logic core" or "build workshop Chapter 1"). Build that, test it, and stop. Do not start the next item.
- **Read before building.** Read `CLAUDE.md`, `STYLE.md`, `NOTES.md` and this file first. Look at the existing tools so new work matches them.
- **Cores first, then pages.** Put the logic in a DOM-free module with unit tests, then build the page on top.
- **Check AQA.** When a session touches a specification topic, check the AQA specification and exam conventions and match them. Record anything uncertain in `NOTES.md`.
- **Screenshots.** Review the result at laptop width and phone width, in light and dark mode, and fix anything cluttered or hard to read.
- **Finish properly.** Update `NOTES.md` (what was built, decisions, anything unfinished), run all tests, commit and push.
- **Usage is limited.** Do not schedule wake-ups or keep the session running beyond the item. Do not spawn subagents unless asked.

### Suggested order

1. Logic core: custom components (save, reuse, open to look inside) and checks against target behaviour. Update the logic sandbox to use them.
2. Workshop shell: chapter and level structure, progress saving and export, the level layout (goal, parts, check, hint, reference, log), and Chapters 0 and 1.
3. Chapters 2 and 3 (Boolean algebra, arithmetic, the ALU). Add buses to the logic core.
4. Chapter 4 (memory, feedback, clock, flip-flop, registers, RAM).
5. Chapter 5 (buses, Von Neumann and Harvard).
6. Chapter 6 (the processor, fetch–decode–execute, the instruction encoding and decoder).
7. Chapter 7 (assembly on the student's own CPU, cross-checked against `aqa.js`).
8. Chapter 8 and, if wanted, Chapter 9.

Standalone tools (Dijkstra, Boolean algebra, FSMs) can be slotted in between whenever the owner asks.

---

## 7. Questions still open (ask the owner, don't guess)

- **Skipping ahead.** Should a student be able to jump straight to, say, Chapter 6 using Groundwork's ready-made parts (clearly labelled as not their own), or must chapters be done in order? Default until decided: chapters unlock in order, but every chapter can be viewed.
- **Workshop word size.** 8-bit data is the default plan, to keep binary readable and match the simulator's default.
- **Where the workshop lives.** Default plan: `/workshop/`, listed on the home page as its own section above the tools once Chapter 1 exists.
