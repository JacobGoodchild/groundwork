# Groundwork style

Every page links `assets/style.css`. New tools should use its tokens and components rather than adding their own colours, fonts or button styles. Page-specific layout (grids, column widths) goes in a small stylesheet next to the page, as `assembly/simulator.css` does.

## Principles

- It should look like a careful textbook companion: plain, quiet, readable.
- Opening a tool shows the tool, ready to use. No intro screens, banners or hero sections.
- Write like a good worksheet: short, plain, specific sentences. British English. No exclamation marks, emoji, hype or chatty asides.
- Error messages say what is wrong, where, and how to fix it. Nothing else.
- Motion only when it means something: a register or memory slot highlights when its value changes. Nothing animates on page load or scroll. `prefers-reduced-motion` turns the highlight into a still tint.
- No frameworks (no Tailwind, shadcn or similar). No web fonts.

## Tokens (CSS custom properties on `:root`)

| Group | Tokens | Notes |
|---|---|---|
| Fonts | `--font-text`, `--font-code` | System fonts only. Code, registers and memory use `--font-code`. |
| Sizes | `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--code-size`, `--code-line` | `--code-line` is a fixed pixel line height so the editor's line numbers and highlights line up. |
| Spacing | `--space-1` … `--space-7` | 0.25rem up to 3rem. |
| Layout | `--page-width`, `--prose-width`, `--radius` | |
| Colour | `--bg`, `--surface`, `--surface-sunk`, `--text`, `--text-muted`, `--border`, `--border-strong` | Neutral, warm greys. |
| Accent | `--accent`, `--accent-text`, `--accent-soft` | One teal accent. Use it for links, the primary button, the current line and changed values. Nowhere else. |
| Meaning | `--read-mark`, `--current-line`, `--error`, `--error-soft`, `--focus` | |

Dark mode redefines the colour tokens inside `@media (prefers-color-scheme: dark)`. Never hard-code a colour in a page; add a token instead.

## Components

- **Site frame**: `.site-header` (site name left, quiet "See more" link right), `main`, `.site-footer`. Copy the header and footer markup from an existing page.
- **Text pages**: `main.prose` limits text to a readable width. `.entry-list` for lists of links with a description; `.section-label` for small uppercase group headings; `.tag` for an understated label.
- **Panels**: `.panel` with a `.panel-title`. `.info-line` for a small explanatory note at the bottom.
- **Buttons**: `.button`, `.button.primary` (one per toolbar at most), `.button-group` for joined pairs. `.toolbar` lays out controls; `.field` wraps a label and its control.
- **Code editor**: `.code-editor` containing `.code-gutter` (line numbers) and `.code-area` (`.code-backdrop` behind a transparent `textarea.code-input`). Mark lines with `.is-current` or `.has-error` on the gutter and backdrop rows.
- **Errors**: `.error-list` under the editor.
- **Registers and memory**: `.cell-grid` of `.cell` elements, each with `.cell-label` and `.cell-value`. Set `--cell-min` on the grid (in `ch`) to fit the widest value. `.is-written` marks a cell the last step changed (brief highlight); `.is-read` marks a cell it read from (dashed border).
- **Status boxes**: `.status-box` for single values like the program counter.
- **Explanations**: `.explanation` for the latest step, `.history` for earlier steps.
- **Reference**: `details.reference` with a `table.ref` inside. On narrow screens the table becomes stacked blocks.

## Accessibility

- Every control has a visible label. Focus is always visible (`:focus-visible` outline in `--focus`).
- Text colours meet WCAG AA contrast against their backgrounds in both themes.
- Layouts must work at phone width with no sideways scrolling; panels stack.
