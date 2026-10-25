# Notes: first session

## What was built

- **Site shell**: home page (`/`), "Other projects" page (`/projects/`), shared header (site name left, quiet "See more" right) and footer. Shared stylesheet `assets/style.css`, documented in `STYLE.md`.
- **Assembly simulator** (`/assembly/`):
  - `assembly/aqa.js`: parser and machine with no DOM code. Exports `parse`, `Machine`, `assemble`, `runToEnd`, `formatError` and the constants `REGISTER_COUNT` (13), `MEMORY_SIZE` (26), `STEP_LIMIT` (10,000) and `WORD_SIZES`.
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
