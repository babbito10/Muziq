/** Runtime configuration rendered by the root layout (server) and read by client code. */
export interface RuntimeConfig {
  apiUrl: string;
}

export const RUNTIME_CONFIG_ID = 'mv-runtime-config';
export const DEFAULT_API_URL = 'http://localhost:4000/api/v1';

export function readRuntimeConfig(): RuntimeConfig {
  if (typeof document !== 'undefined') {
    const el = document.getElementById(RUNTIME_CONFIG_ID);
    if (el?.textContent) {
      try {
        return JSON.parse(el.textContent) as RuntimeConfig;
      } catch {
        // fall through to the default
      }
    }
  }
  return { apiUrl: DEFAULT_API_URL };
}

/** Serialise for embedding in <script type="application/json"> (escape `<` to prevent breakout). */
export function serialiseRuntimeConfig(config: RuntimeConfig): string {
  return JSON.stringify(config).replace(/</g, '\\u003c');
}
