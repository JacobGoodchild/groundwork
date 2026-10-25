# Groundwork

Interactive tools for learning how computers work, following the AQA A-level Computer Science course (specification 7517).

There are two tools so far:

- an **assembly simulator** for the AQA assembly language: write a program, step through it one instruction at a time, and see the registers and memory change, with a plain-English explanation of each step;
- a **logic gates** circuit builder: wire up AQA's six gates and see the truth table and Boolean expressions update as you build.

The site is plain HTML, CSS and JavaScript modules. There is no build step.

## Run it locally

```
npm start
```

Then open http://localhost:4173/.

## Tests

```
npm install
npx playwright install chromium   # first time only
npm test
```

- `npm run test:unit` tests the simulator core (`assembly/aqa.js`) with Node's built-in test runner.
- `npm run test:ui` tests the pages in a real browser with Playwright.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Home page |
| `assembly/` | The assembly simulator. `aqa.js` is the parser and CPU (no page code), `examples.js` the example programs, `app.js` the page. |
| `logic/` | The logic gates tool. `logic.js` is the circuit model, evaluation and expressions (no page code), `shapes.js` the gate symbols, `examples.js` the example circuits, `app.js` the page. |
| `projects/` | The "See more" page. Edit `projects.js` to change the list. |
| `assets/style.css`, `assets/settings-menu.js` | Shared styles and the settings menu used by every tool. See `STYLE.md`. |
| `tests/` | Unit tests (`unit/`) and browser tests (`ui/`). |

Pushing to `main` runs all the tests on GitHub Actions and, if they pass, publishes the site to GitHub Pages.
