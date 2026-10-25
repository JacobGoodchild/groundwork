# Groundwork

Learning tools for AQA A-level Computer Science (7517). Plain HTML, CSS and JavaScript modules; no build step, no frameworks.

- **Read `VISION.md` before starting any work.** It explains what Groundwork is for, the planned workshop, and how sessions should run.
- Follow `STYLE.md` for every page and tool. The assembly simulator (`assembly/`) is the reference example: an IDE-style tool, not a tutorial page. Use the shared components in `assets/style.css` and `assets/settings-menu.js` instead of writing new ones.
- Keep simulation logic in DOM-free modules (like `assembly/aqa.js`) so it can be unit-tested and reused.
- When something comes from AQA (instruction sets, definitions), match AQA's official wording and exam conventions exactly.
- Run `npm test` (unit tests, then Playwright) before pushing. Pushing to `main` deploys to GitHub Pages.
- `NOTES.md` records decisions and open questions; add to it when making a significant change.
