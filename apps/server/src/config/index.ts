import { loadEnvConfig } from './env';
import type { EnvConfig } from './env';

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = loadEnvConfig();
  }
  return cachedConfig;
}

export { loadEnvConfig } from './env';
export type { EnvConfig } from './env';
