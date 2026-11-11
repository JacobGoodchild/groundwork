import { typeset } from '../math.js';

typeset();

const slides = [...document.querySelectorAll('#deck .slide')];
const show = document.getElementById('show');
const stage = document.getElementById('stage');
const count = document.getElementById('count');
let current = 0;
let opener = null;

function render() {
  const copy = slides[current].cloneNode(true);
  copy.removeAttribute('id');
  stage.replaceChildren(copy);
  count.textContent = `${current + 1} / ${slides.length}`;
}

function go(i) {
  current = Math.max(0, Math.min(slides.length - 1, i));
  render();
}

function open(i = 0) {
  opener = document.activeElement;
  show.hidden = false;
  document.body.style.overflow = 'hidden';
  go(i);
  show.requestFullscreen?.().catch(() => {});
  document.getElementById('next').focus();
}

function close() {
  show.hidden = true;
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  slides[current].scrollIntoView({ block: 'center' });
  opener?.focus();
}

document.getElementById('present').addEventListener('click', () => open(0));
document.getElementById('prev').addEventListener('click', (e) => { e.stopPropagation(); go(current - 1); });
document.getElementById('next').addEventListener('click', (e) => { e.stopPropagation(); go(current + 1); });
document.getElementById('close').addEventListener('click', (e) => { e.stopPropagation(); close(); });

// Double-click a slide to present from there.
slides.forEach((slide, i) => slide.addEventListener('dblclick', () => open(i)));

// Click the right half for next, the left half for previous.
stage.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const { left, width } = stage.getBoundingClientRect();
  go(current + (e.clientX - left > width / 2 ? 1 : -1));
});

document.addEventListener('keydown', (e) => {
  if (show.hidden) return;
  const keys = {
    ArrowRight: 1, ArrowDown: 1, PageDown: 1,
    ArrowLeft: -1, ArrowUp: -1, PageUp: -1, Backspace: -1,
  };
  if (e.key === 'Escape') { close(); return; }
  if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(slides.length - 1);
  else if (e.key in keys) go(current + keys[e.key]);
  else return;
  e.preventDefault();
});

// Leaving full screen with the browser's own Esc also closes the slideshow.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && !show.hidden) close();
});
