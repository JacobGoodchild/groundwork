# Groundwork style

Every page links `assets/style.css`. New tools use its tokens and components rather than adding their own colours, fonts or button styles. Only layout that belongs to one tool (its workspace grid, panel sizes) goes in a small stylesheet next to the page, as `assembly/simulator.css` does.

The assembly simulator is the reference example of a tool page. Start a new tool by following its structure, not by copying it exactly.

## Direction

Tools should feel like a well-made IDE or desktop app: the work area comes first, the controls are compact, and the page trusts the user to explore. They should be slightly tutorial-like only where it actually helps someone learn, such as a log explaining what each step did, or an error that says how to fix itself.

- **Tool first.** Opening a tool shows the tool, ready to use, with a working example already loaded. No intro screens, banners, hero sections or "how to use this" paragraphs.
- **No hint text.** Don't add lines like "Click a box to edit it" or "Press Step to begin". If a control needs explaining, make the control clearer: an icon with a `title` tooltip, a better label, a sensible default.
- **Compact controls.** Frequent actions are icon buttons in the tool bar. Everything else (examples, starting values, display options, speed) goes in the settings menu behind the cog.
- **Explanations live in the log.** Plain-English explanations of what happened go in a collapsible Log panel, not scattered around the page. The log starts empty.
- **Reference material is official and tucked away.** Put it in a collapsible panel, and when it comes from AQA, copy AQA's wording exactly with no additions.
- **Examples match the exam.** Sample programs and data follow the conventions AQA uses in its papers.

## Writing

- Short, plain, specific. British English. No exclamation marks, emoji, hype, greetings or chatty asides.
- Error messages say what is wrong, where, and how to fix it, and nothing else. Example: "Line 3: ADD needs a register as its first operand, for example ADD R1, R2, #5."
- Log entries describe what happened with the actual values: "Added 5 to R1 (7) and stored the result (12) in R3."

## Look

- Neutral warm-grey background, white panels with thin borders, one teal accent. Generous but not loose spacing.
- System fonts for text, a monospace font for code and values. No web fonts.
- No gradients, glows, glass effects or decorative illustration. No frameworks (Tailwind, shadcn or similar).
- Motion only where it carries meaning: a value highlights when it changes, and the cog turns when the settings menu opens. Nothing animates on page load or scroll. `prefers-reduced-motion` removes motion.
- Proper light and dark themes via `prefers-color-scheme`.

## Anatomy of a tool page

```
site header             Groundwork ............................ See more
.tool-bar               Title  [run] [reset]  [step back] [step] ... [cog]
.status-strip           [ status value ] [ status value ]
workspace               .panel  .panel  .panel   (tool's own grid)
details.reference.log   Log (open, collapsible)
details.reference       Reference (closed, collapsible)
site footer
```

## Tokens (CSS custom properties on `:root`)

| Group | Tokens | Notes |
|---|---|---|
| Fonts | `--font-text`, `--font-code` | System fonts only. Code and values use `--font-code`. |
| Sizes | `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--code-size`, `--code-line` | `--code-line` is a fixed pixel line height so the editor's line numbers and highlights line up. |
| Spacing | `--space-1` … `--space-7` | 0.25rem up to 3rem. |
| Layout | `--page-width`, `--prose-width`, `--radius` | |
| Colour | `--bg`, `--surface`, `--surface-sunk`, `--text`, `--text-muted`, `--border`, `--border-strong` | Neutral, warm greys. |
| Accent | `--accent`, `--accent-text`, `--accent-soft` | Teal. Links, the current line, changed values, focus. |
| Run | `--go`, `--go-text` | Green, only for the main "run" action. |
| Meaning | `--read-mark`, `--current-line`, `--error`, `--error-soft`, `--focus` | |

Dark mode redefines the colour tokens inside `@media (prefers-color-scheme: dark)`. Never hard-code a colour in a page; add a token instead, and check that its text contrast meets WCAG AA in both themes.

## Components

**Tool layout**
- `main.tool` stacks the tool's sections with even gaps.
- `.panel.tool-bar` holds an `h1.tool-title`, a `.toolbar.tool-actions` group of icon buttons (use `.toolbar-gap` between groups), and the settings cog.
- **Settings menu**: a `.settings` wrapper holding `button.icon-button.cog` (with `aria-controls` and `aria-expanded`) and a `.settings-menu` that starts `hidden`. It is a two-column grid of label and control. Wire it up with `setupSettingsMenu(toggle, menu)` from `assets/settings-menu.js`, which handles opening, closing on an outside click, and Escape.
- `.status-strip` holds `.status-box` elements (`.cell-label` and `.status-value`) for read-only values such as a program counter.
- `details.reference.log` holds the log: `p.explanation` for the latest entry and `ol.history` for earlier ones. Both hide themselves when empty.
- `details.reference` holds reference material: `table.ref`, then `h3.reference-notes-title` with `p.reference-notes` or `ul.reference-notes`. On narrow screens the table becomes stacked blocks.

**Controls**
- `.icon-button` is a square button with one inline SVG icon. It always has an `aria-label` and a `title`. Variants: `.go` (green; its `.icon-play` and `.icon-pause` swap on `aria-pressed`) and `.cog` (borderless; turns while `aria-expanded` is true).
- `.button`, `.button.primary` (rarely needed now) and `.button-group` for joined pairs such as Zero / Random.
- `.toolbar` lays out a row of controls; `.field` wraps a label and its control outside the settings menu.

**Workspace pieces**
- `.panel` with an uppercase `.panel-title`.
- **Code editor**: `.code-editor` containing `.code-gutter` (line numbers) and `.code-area` (`.code-backdrop` behind a transparent `textarea.code-input`). Mark lines with `.is-current` or `.has-error` on the gutter and backdrop rows. `.error-list` goes underneath.
- **Value cells**: a `.cell-grid` of `.cell` elements, each with `.cell-label` and `.cell-value`. Set `--cell-min` on the grid (in `ch`) to fit the widest value. `.is-written` marks a cell the last step changed (brief highlight); `.is-read` marks a cell it read from (dashed border). Cells can be buttons so values are editable in place.

**Site pages**
- `.site-header`, `main`, `.site-footer`. Copy the header and footer markup from an existing page.
- Text pages use `main.prose`, `.entry-list`, `.section-label` and `.tag`. The projects page uses its own card layout in `projects/projects.css`.

## Accessibility

- Every control has an accessible name: a visible label, or `aria-label` plus `title` for icon buttons.
- Focus is always visible (`:focus-visible` outline in `--focus`). Everything works from the keyboard, and Escape closes menus.
- Layouts work at phone width with no sideways scrolling: panels stack, and the settings menu fits the screen.
