# Groundwork

Interactive tools for learning how computers work, following the AQA A-level Computer Science course (specification 7517).

The first tool is an **assembly simulator** for the AQA assembly language: write a program, step through it one instruction at a time, and see the registers and memory change, with a plain-English explanation of each step.

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
| `projects/` | The "See more" page. Edit `projects.js` to change the list. |
| `assets/style.css`, `assets/settings-menu.js` | Shared styles and the settings menu used by every tool. See `STYLE.md`. |
| `tests/` | Unit tests (`unit/`) and browser tests (`ui/`). |

Pushing to `main` runs all the tests on GitHub Actions and, if they pass, publishes the site to GitHub Pages.
