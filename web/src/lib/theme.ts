// Appearance preference: 'system' follows the device; light/dark force a class on <html>.
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'cc_theme';

export function getTheme(): Theme {
  try { return (localStorage.getItem(KEY) as Theme) || 'system'; } catch { return 'system'; }
}

export function applyTheme(theme: Theme) {
  const cl = document.documentElement.classList;
  cl.toggle('theme-light', theme === 'light');
  cl.toggle('theme-dark', theme === 'dark');
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
}
