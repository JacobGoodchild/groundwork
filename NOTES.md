# Notes: first session

## What was built

- **Site shell**: home page (`/`), "Other projects" page (`/projects/`), shared header (site name left, quiet "See more" right) and footer. Shared stylesheet `assets/style.css`, documented in `STYLE.md`.
- **Assembly simulator** (`/assembly/`):
  - `assembly/aqa.js`: parser and machine with no DOM code. Exports `parse`, `Machine`, `assemble`, `runToEnd`, `formatError` and the constants `REGISTER_COUNT` (13), `MEMORY_SIZE` (13), `STEP_LIMIT` (10,000) and `WORD_SIZES`.
  - `assembly/examples.js`: the six example programs, with starting memory values.
  - `assembly/app.js`: the page. Editor with line numbers, current-line and error highlighting; registers, memory, program counter and last comparison; Step, Step back, Run/Pause with speed, Reset; Zero/Random starting values; number format; word size; examples; explanation with a history of the last 20 steps; click-to-edit values; instruction reference; saving to localStorage.
- **Tests**: 63 unit tests (`tests/unit/aqa.test.js`) and 12 Playwright tests (`tests/ui/site.spec.js`). All pass locally.
- **CI**: `.github/workflows/test-and-deploy.yml` runs unit and browser tests on every push to `main` and on pull requests, and deploys to GitHub Pages only from `main` after the tests pass.

## Checked against the official AQA document

The AQA "Assembly language instruction set" PDF (filestore.aqa.org.uk, AQA-75162-75172-ALI.PDF) was reachable. Its instruction table, the `<operand2>` rules (`#` for a denary value, `Rm` for a register), the label syntax and "registers 0 to 12" all match what is implemented. There were no differences.

The AQA document does not cover the following, so these are this simulator's own choices:

- Memory size (26 locations), word size (8/16/32-bit unsigned) and wrap-around.
- `//` comments, and instructions, registers and labels all being case-insensitive.
- Immediate values must be non-negative and fit the current word size, otherwise the program is rejected.
- A conditional branch that runs before any `CMP` stops the program with an error, rather than guessing a result.
- Shifting by the word size or more gives 0.

## Decisions

- **Program counter** holds the number of the next instruction, counting from 0, shown in the selected number format with "(next: line N)" beside it. The program is not stored in the 26 data slots, so the PC is not a memory address. The page says this in a small info line.
- **Starting values**: values edited before the first step become the program's starting values, which Reset restores. Edits made part-way through a run change only the current state. Zero, Random, loading an example and changing the word size all set new starting values and go back to line 1.
- **Random** fills with values from 0 to 255 even in 16- and 32-bit mode, so they stay readable.
- **Errors** are found when Step, Run or Reset is pressed, not while typing, so half-typed lines aren't flagged. Editing the program part-way through a run makes the next Step start again from line 1, and a note in the history says so.
- **Examples** set starting memory values (AQA assembly has no way to declare data). If the editor holds the user's own work, loading an example asks first.
- **localStorage** saves the program, number format, word size and starting values.
- **Explanations** always use denary, and add grouped binary for AND, ORR, EOR, MVN, LSL and LSR. The register and memory boxes use the selected format.
- **Fastest speed** runs 250 instructions between redraws, so the 10,000-instruction limit is reached in about a second.
- **Projects page**: the two black-hole preprints (records 23136697 and 23136851) were fetched from Zenodo, and their real titles are used. The one-line descriptions were written from their abstracts, so you may want to reword them.
- **Other projects page (updated)**: now laid out as two columns of clickable boxes. Papers (titles only) and libraries are on the left; Apex Ring (with its cover image from itch.io, saved as `projects/images/apex-ring.jpg`), Desk Piano and Air Violin are on the right. Home Roads and mathrun were removed at the owner's request. On a phone the columns stack.
- Footer: "Groundwork follows the AQA A-level Computer Science specification (7517). It is not made or endorsed by AQA."

## Before the site goes live

- The repository had no branches before this session. The work is on `claude/new-session-uwypdm`. Deployment runs only from `main`, so merge this branch into `main` (or create `main` from it). With Pages set to "GitHub Actions", that push will test and deploy.
- `package-lock.json` is committed so `npm ci` works in CI.

## Uncertain or unfinished

- The CI workflow has not run yet, because nothing has been pushed to `main`. It uses the standard `actions/*-pages` actions and should work, but check the first run.
- Only Chromium is tested. Firefox and Safari should be fine (no unusual APIs), but they haven't been checked.
- The editor is a plain `textarea` with an overlay. It has no syntax colouring. Tab moves focus out of the editor rather than indenting, which keeps keyboard navigation predictable.

## Suggestions for the next session

- Build the logic-gate / Boolean algebra tool using the same stylesheet and components.
- Later, connect the workshop CPU to `aqa.js`: the `Machine` class is the natural place to expose fetch, decode and execute as separate stages, and to move the program into memory (Von Neumann) as an option.
- Possible simulator extras, if wanted: a shareable link that encodes the program, keyboard shortcuts for Step and Step back, and an "explain this error" link to the reference row.

## Second round of changes (owner's requests)

- **IDE-style layout.** The top bar holds the title and icon buttons: green Run/Pause, Reset, then Step back and Step. A settings cog at the top right opens a menu with Speed, Example, Registers, Memory, Number format and Word size. The cog turns when the menu opens. Program counter and Last comparison are two separate boxes under the bar. The Program panel is wider and taller.
- **Removed teaching text**: the line under the title, the Von Neumann note under memory and the "click to edit" hint. Editing values by clicking still works.
- **Log**: renamed from "What happened". It now sits below the program and above the instruction reference, is collapsible (open by default) and starts empty.
- **Memory is now 13 slots** (addresses 0 to 12). Saved starting values from the old 26-slot version are cut down to fit.
- **Instruction reference** now uses the exact wording of the AQA instruction set sheet, including its "Labels" and "Interpretation of <operand2>" sections, and nothing else.
- **Comments**: the AQA instruction set doesn't define a comment syntax, and the assembly programs in AQA past papers (A-level Paper 2, November 2020 to June 2023) have no comments. They put labels on their own line and indent instructions by two spaces. The default program and all the examples now follow that style with no comments. The simulator still quietly ignores anything after `//`, so a student's own notes don't cause errors, but the page doesn't advertise it.
- **Second colour**: the Run button is green (`--go` token), at the owner's request. Teal stays the accent everywhere else.

## Logic gates tool (`/logic/`)

What it does:
- A circuit builder using the six gates in the AQA specification (4.6.4.1): NOT, AND, OR, XOR, NAND, NOR. They are drawn as ANSI/IEEE 91-1984 distinctive-shape symbols, which the spec says students must know.
- Add inputs, outputs and gates from the tool bar, wire them up and click inputs to switch them between 0 and 1. Wires carrying 1 are teal, 0 is grey, and unconnected parts are dashed.
- The truth table and the Boolean expression for each output (AQA notation: overbar, `.`, `+`, `⊕`) update as you build. Clicking a truth table row sets the inputs to that row.
- Undo and redo, delete, rename (F2 or double-click), keyboard moving (arrow keys) and keyboard wiring (Enter on a pin, then Enter on another).
- Examples in the settings menu: half adder (the default), full adder, NOT made from NAND, A.B + C, and De Morgan's law shown as two circuits with identical truth tables.
- `logic/logic.js` is the DOM-free core (model, evaluation, truth tables, expressions), tested in `tests/unit/logic.test.js`. `logic/shapes.js` holds the gate symbols, shared by the canvas, tool bar and reference.

Decisions:
- Gates have two inputs (NOT has one), as in almost all AQA questions.
- Up to 5 inputs (a 32-row truth table) and 4 outputs.
- Wires that would feed an output back into an earlier gate are refused. Feedback is how flip-flops work, so it belongs with the D-type flip-flop.
- Truth table rows count up in binary with the first input as the most significant bit, as AQA lays them out. Inputs and outputs are listed in alphabetical order.
- XOR is always bracketed when it is combined with another operator, for example (A ⊕ B).Cin, to avoid any doubt about precedence.
- Switching an input isn't an undoable change; editing the circuit is.

Not done yet / ideas for next time:
- The edge-triggered D-type flip-flop (4.6.4.1, "be familiar with the use of"). It needs a clock and feedback, so it would suit its own tool or a "memory" step in the workshop.
- Building a circuit from a typed Boolean expression, and checking a student's circuit against a target truth table (good for practising "draw an equivalent circuit").
- On a phone the canvas works but is small. Pinch-to-zoom works, but a zoom control would help.
- Boolean algebra (4.6.5): simplification with identities and De Morgan's laws.

## Deploy fix

The first logic gates deploy left `logic/` off the live site, because the workflow copied a fixed list of folders. The deploy now copies everything except development files (tests, scripts, Markdown, npm and Playwright files), and fails if any page linked from the home page is missing.

## Wire styles (logic gates)

Settings has a **Wires** option: Curved (the default), Right angles, or Straight.
- `logic/wiring.js` (DOM-free, tested in `tests/unit/wiring.test.js`) routes the two straight styles.
- **Right angles:** each signal gets one vertical run. Its position is chosen by trying spots either side of the midpoint and keeping the one that sits clear of other signals, crosses them least, and avoids near misses: a wire passing just past the end of another, which looks like a join.
- **Hops:** where two different signals cross, a small arc is drawn. With right angles it goes on the horizontal wire (and also on any near miss that's left); with straight lines it goes on the wire drawn later.
- **Junction dots:** drawn wherever one signal splits into branches (three or more arms meeting), so a join always looks different from a crossing.
- Curved wires don't get hops; curves cross at an angle, which already reads as a crossing. If it's wanted, curves could be split into short straight pieces and given hops too.

## Saved circuits (logic gates)

- Slots, labelled from 1, sit beside the circuit. Each shows a small picture of what it holds, or "Empty". Pressing a filled slot loads it; Undo goes back to the previous circuit.
- Settings → **Save circuit…** opens a large overlay with a card for each slot, each with a picture, the number of inputs, gates and outputs, and when it was saved. An empty slot saves straight away. A filled slot asks "Replace the circuit in slot N? It will be lost." first.
- Saved in the browser's localStorage on that device only (`groundwork.logic.slots.v1`). Damaged data counts as an empty slot, and a browser that blocks storage gets a plain error message.
- New DOM-free modules, all unit-tested: `logic/slots.js` (reading and writing slots), `logic/thumbnail.js` (a circuit as an SVG picture, following the chosen wire style) and `logic/geometry.js` (node sizes and pin positions, now shared by the canvas and the thumbnails).
- Now **six** slots (circuits saved when there were five still load). Each filled slot can be **deleted**: from the small × in its corner on the side strip, or the Delete button on its card in the save overlay. Both ask "Delete…? It will be lost." first, because deleting can't be undone.
- Export and import as a file (as VISION.md plans for the workshop) would make saved circuits portable between devices.

## Subscripts in names

Input and output names written as one capital letter followed by lowercase letters or digits are shown with the ending as a subscript, as in exam papers: `Cin` is shown as C<sub>in</sub>, `Cout` as C<sub>out</sub>, `A1` as A<sub>1</sub>. This applies on the canvas, in the expressions, in truth table headings and in slot pictures. Names are still typed and stored as plain text (`Cin`), and the log uses the plain form. Done with HTML `<sub>` and an SVG `tspan`, not LaTeX, so no extra library is needed. The rule is `nameParts()` in `logic/logic.js`.

## Components and checks (roadmap item 1)

### In the core (`logic/logic.js`, all unit-tested)
- **Wires record which output they leave from** (`fromPin`), because a component can have several outputs. Old saved circuits and slots are upgraded on load by `normalise()`.
- **Components.** `makeComponent(circuit, name, id)` turns a circuit into a definition: name, input pin names, output pin names (each ordered top to bottom as on the canvas) and a copy of the circuit. A circuit needs at least one input and one output, and every output must be connected back to the inputs. `addComponent()` places one on a circuit. The definition is copied into the circuit's own `components`, so a saved circuit always carries everything it needs, and deleting a component from the library never breaks a circuit. A definition nothing uses any more is removed. Components can contain components (up to 20 deep).
- **Simulation.** `simulate()` returns every node's output values and, for each component, the simulation of its inside, so the page can show live values inside a box. `evaluate()` still returns one value per node for simple uses.
- **Expressions look through components**, so an output's Boolean expression is always written in terms of the circuit's own inputs.
- **Checks.** `check(circuit, target)` tests every row of the truth table (or a list of test cases, for bigger circuits) and reports the first problem in plain English with real values: a missing or extra input or output by name, an output with no value, or "When A = 1 and B = 1, your circuit outputs S = 1. It should be 0." It returns the failing inputs so the page can show them.
- **The 5-input and 4-output limits moved out of the core** into the logic page (the workshop needs bigger circuits).

### In the logic tool
- **Settings → Components…** makes a component from the current circuit and lists your components, each with a Delete button. Components are kept in this browser (`logic/library.js`, up to 12). Making one with the same name as an existing one replaces it.
- **Your components appear in the tool bar** after the six gates. A placed component is a box with its pin names inside the edges and its name above.
- **Opening a component:** double-click it, or press Enter when it is focused. The canvas shows its inside with live values, a dashed border, a title trail ("Circuit › HALF ADDER") and a Back button (or Escape). Inside is read-only. Components inside it can be opened in turn. The truth table and expressions show the component's own circuit while you are inside.
- **Settings → Target** picks something to build: NOT, AND, OR, XOR, NAND, NOR, Half adder or Full adder (`logic/targets.js`). Its goal shows in the status strip and a **Check** button appears. A failed check sets the inputs to the failing case so the wrong value is on screen; the Check button turns green or red until the next edit.
- **Double-clicks** are now spotted by the page itself (two clicks on one part within 350 ms), because the browser's own event doesn't fire after the first click on an input redraws the circuit, and is unreliable on touch screens. A double-click on an input renames it without switching it.

### Not done yet
- Hints after a failed check (VISION 3.2) belong with the workshop levels.
- Restricting which parts a target may use (for example "build XOR from NAND gates only") is for the workshop; the sandbox lets you use anything.
- A component can't be edited after it is made. Rebuild the circuit and make it again with the same name to replace it (circuits already using the old one keep their copy).
- The inside view shows the component as it was built. Moving its parts around on screen is not possible.
