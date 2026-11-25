/**
 * Theme toggle. The no-flash part lives in the inline <head> script in BaseLayout;
 * this module only wires the button. Stored values: 'light' | 'dark' (absent = follow OS).
 */

export const THEME_STORAGE_KEY = 'theme';
export type Theme = 'light' | 'dark';

const media = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)');

export function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return media().matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* not persisted when storage is unavailable */
  }
  sync();
}

function sync(): void {
  const dark = currentTheme() === 'dark';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(dark));
  });
}

export function initThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    // Rendered disabled so it is no dead tab stop without JavaScript (QA-16).
    btn.disabled = false;
    btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  });
  media().addEventListener('change', sync);
  sync();
}
