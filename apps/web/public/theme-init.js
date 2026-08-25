(function initTheme() {
  try {
    var stored = localStorage.getItem('convert-hub-theme');
    var dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {
    // localStorage/matchMedia unavailable (privacy mode, sandboxed preview) — falls back to light.
  }
})();
