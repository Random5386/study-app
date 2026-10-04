// Runs before the app loads, so a dark-mode user never sees a white flash.
// It's a separate file (not inline in index.html) because our Content Security Policy blocks inline scripts.
// The React side of this lives in src/lib/theme.ts.
/* global localStorage, matchMedia, document */
(function () {
  var choice = 'system';
  try {
    choice = localStorage.getItem('studyapp.theme') || 'system';
  } catch {
    /* storage blocked: follow the system */
  }
  var dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
