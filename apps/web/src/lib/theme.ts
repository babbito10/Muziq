import type { ThemePreference } from '@musicverse/types';

const STORAGE_KEY = 'mv-theme';

export function resolveTheme(preference: ThemePreference): 'dark' | 'light' {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(preference: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(preference);
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage may be unavailable (private mode); the theme still applies for this page.
  }
}

/** Inline script that applies the stored theme before first paint (prevents a flash). */
export const themeBootstrapScript = `(()=>{try{var p=localStorage.getItem('${STORAGE_KEY}')||'dark';var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}})();`;
