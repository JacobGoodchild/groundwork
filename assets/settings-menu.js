// Settings cog menu shared by every tool.
// Markup: a `.settings` wrapper holding the toggle button (aria-controls set
// to the menu's id) and the `.settings-menu` element, hidden to start.
// Closes on a click outside the wrapper or on Escape.

export function setupSettingsMenu(toggle, menu) {
  const wrapper = toggle.closest('.settings');

  const open = () => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };

  const close = (returnFocus = true) => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    if (menu.hidden) open();
    else close(false);
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !wrapper.contains(e.target)) close(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) close();
  });

  return { open, close };
}
