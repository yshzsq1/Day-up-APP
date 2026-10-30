// Theme changes do not render, replace, focus, or inspect business components.
(() => {
  const themes = ['soda', 'prism', 'brut'];
  function choose(theme) {
    if (!themes.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('app-theme', theme); } catch { /* Session-only choice. */ }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-choice]');
    if (button) choose(button.dataset.themeChoice);
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && !event.repeat && event.key.toLowerCase() === 't') {
      event.preventDefault();
      const index = themes.indexOf(document.documentElement.getAttribute('data-theme'));
      choose(themes[(index + 1) % themes.length]);
    }
  });
})();
