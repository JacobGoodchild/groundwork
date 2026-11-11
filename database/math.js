// Typesets every .m (inline) and .md (display) element with KaTeX.
// KaTeX is loaded as a classic script before this module.

export const MACROS = {
  '\\bx': '\\fcolorbox{##1f8fe0}{transparent}{$\\displaystyle #1$}',
  '\\E': '\\mathbb{E}',
  '\\N': '\\mathcal{N}',
  '\\bm': '\\boldsymbol{#1}',
};

export function typeset(root = document) {
  for (const el of root.querySelectorAll('.m, .md')) {
    if (el.dataset.done) continue;
    const tex = el.textContent;
    el.dataset.tex = tex;
    window.katex.render(tex, el, {
      displayMode: el.classList.contains('md'),
      throwOnError: false,
      macros: { ...MACROS },
      trust: false,
    });
    el.dataset.done = '1';
  }
}
