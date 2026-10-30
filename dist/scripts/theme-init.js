// Runs before CSS. Appearance preference is independent of DayUp's business data.
(() => {
  let theme = 'soda';
  try {
    const saved = localStorage.getItem('app-theme');
    theme = ['soda', 'prism', 'brut'].includes(saved) ? saved
      : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'prism' : 'soda');
  } catch { /* Unavailable storage: the offline light theme remains usable. */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
