import { AppService } from '@/types/system';
import { READEST_NODE_BASE_URL, READEST_WEB_BASE_URL } from './constants';
import { getRuntimeConfig } from './runtimeConfig';
import { getStoredServerConfig } from '@/utils/supabase';

declare global {
  interface Window {
    __READEST_CLI_ACCESS?: boolean;
  }
}

export const isTauriAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasCli = () => window.__READEST_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;
export const getBaseUrl = () => {
  // Web: runtime-config.js is authoritative; stored config is irrelevant
  if (isWebAppPlatform()) {
    return (
      getRuntimeConfig()?.apiBaseUrl ??
      process.env['API_BASE_URL'] ??
      process.env['NEXT_PUBLIC_API_BASE_URL'] ??
      READEST_WEB_BASE_URL
    );
  }
  // Tauri: localStorage wizard config takes highest priority
  const stored = getStoredServerConfig();
  return (
    stored?.apiBaseUrl ??
    stored?.supabaseUrl ??
    process.env['NEXT_PUBLIC_API_BASE_URL'] ??
    READEST_WEB_BASE_URL
  );
};

// Returns the public base URL of the web frontend (used for share links,
// annotation links, OG metadata). In self-hosted deployments this points to
// the Kong gateway so that share links like http://<IP>:8000/s/<token> work.
export const getWebBaseUrl = () => {
  if (isWebAppPlatform()) {
    return getRuntimeConfig()?.webBaseUrl ?? process.env['WEB_BASE_URL'] ?? getBaseUrl();
  }
  const stored = getStoredServerConfig();
  return stored?.webBaseUrl ?? process.env['NEXT_PUBLIC_WEB_BASE_URL'] ?? getBaseUrl();
};

export const getShareBaseUrl = () => `${getWebBaseUrl()}/s`;
export const getNodeBaseUrl = () =>
  process.env['NEXT_PUBLIC_NODE_BASE_URL'] ?? READEST_NODE_BASE_URL;

export const isMacPlatform = () =>
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const getCommandPaletteShortcut = () => (isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P');

const isWebDevMode = () => process.env['NODE_ENV'] === 'development' && isWebAppPlatform();

// Dev API only in development mode and web platform
// with command `pnpm dev-web`
// for production build or tauri app use the production Web API
export const getAPIBaseUrl = () => (isWebDevMode() ? '/api' : `${getBaseUrl()}/api`);

// For Node.js API that currently not supported in some edge runtimes
export const getNodeAPIBaseUrl = () => (isWebDevMode() ? '/api' : `${getNodeBaseUrl()}/api`);

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let nativeAppService: AppService | null = null;
const getNativeAppService = async () => {
  if (!nativeAppService) {
    const { NativeAppService } = await import('@/services/nativeAppService');
    nativeAppService = new NativeAppService();
    await nativeAppService.init();
  }
  return nativeAppService;
};

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    webAppService = new WebAppService();
    await webAppService.init();
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (isTauriAppPlatform()) {
      return getNativeAppService();
    } else {
      return getWebAppService();
    }
  },
};

/**
 * Synchronously returns the app service if it has already been created by
 * {@link environmentConfig.getAppService}; null before first init. The async
 * getter is preferred everywhere — use this only from synchronous code paths
 * that run well after startup (e.g. capability checks during reader render),
 * where the singleton is guaranteed to exist.
 */
export const getInitializedAppService = (): AppService | null => nativeAppService ?? webAppService;

export default environmentConfig;
