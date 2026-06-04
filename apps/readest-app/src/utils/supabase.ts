import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig } from '@/services/runtimeConfig';

// ── Server config storage (first-launch wizard) ──────────────────────
const STORAGE_KEY = 'readest_server_config';

export interface ServerConfig {
  supabaseUrl: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
}

export function getStoredServerConfig(): ServerConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ServerConfig) : null;
  } catch {
    return null;
  }
}

export function saveServerConfig(config: ServerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearServerConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasServerConfig(): boolean {
  return !!getStoredServerConfig()?.supabaseUrl;
}

// ── URL / key resolution ─────────────────────────────────────────────
// Priority depends on platform:
//   Web:    runtime-config.js (server-injected) → env vars → base64 fallback
//   Tauri:  localStorage (first-launch wizard) → env vars → base64 fallback
// On web the runtime-config.js is authoritative; a stale localStorage entry
// from a previous server must NOT override it.
const isWeb = process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';

function resolveSupabaseUrl(): string {
  if (isWeb) {
    return (
      getRuntimeConfig()?.supabaseUrl ||
      process.env['SUPABASE_URL'] ||
      process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
      atob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_URL_BASE64']!)
    );
  }
  // Tauri: localStorage wizard config takes highest priority
  return (
    getStoredServerConfig()?.supabaseUrl ||
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
    atob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_URL_BASE64']!)
  );
}

function resolveSupabaseAnonKey(): string {
  if (isWeb) {
    return (
      getRuntimeConfig()?.supabaseAnonKey ||
      process.env['SUPABASE_ANON_KEY'] ||
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
      atob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_KEY_BASE64']!)
    );
  }
  return (
    getStoredServerConfig()?.supabaseAnonKey ||
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
    atob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_KEY_BASE64']!)
  );
}

// ── Lazy-initialized Supabase client ─────────────────────────────────
let _supabase: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client. On first call the client is created
 * using the server config from localStorage (set by the first-launch wizard),
 * runtime config, or build-time env vars — in that priority order.
 *
 * If `reinitialize()` is called (e.g. after the wizard saves new config)
 * the next access will create a fresh client.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(resolveSupabaseUrl(), resolveSupabaseAnonKey());
  }
  return _supabase;
}

/**
 * Destroy the cached client so the next `getSupabase()` call creates a
 * new one with the latest config.  Called after the wizard saves changes.
 */
export function reinitializeSupabase(): void {
  _supabase = null;
}

/**
 * Back-compat getter: code that imported `supabase` as a value can be
 * migrated to `getSupabase()` at its own pace.  The proxy forwards every
 * property access to the lazily-created client.
 *
 * @deprecated Use `getSupabase()` instead.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});

export const createSupabaseClient = (accessToken?: string) => {
  return createClient(resolveSupabaseUrl(), resolveSupabaseAnonKey(), {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });
};

export const createSupabaseAdminClient = () => {
  const supabaseAdminKey = process.env['SUPABASE_ADMIN_KEY'] || '';
  return createClient(resolveSupabaseUrl(), supabaseAdminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
