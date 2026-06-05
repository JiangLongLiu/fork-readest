import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig } from '@/services/runtimeConfig';

// ── Server config storage ────────────────────────────────────────────
// Supports multiple server profiles for self-hosted deployments.
// Legacy single-config key is migrated on first read.
const STORAGE_KEY = 'readest_server_config';
const PROFILES_KEY = 'readest_server_profiles';
const ACTIVE_ID_KEY = 'readest_active_server_id';

/** Connection config for a single server (unchanged for backward compat). */
export interface ServerConfig {
  supabaseUrl: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
  webBaseUrl?: string;
}

/** A named server entry in the multi-profile store. */
export interface ServerProfile extends ServerConfig {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface ServerProfileStore {
  profiles: ServerProfile[];
  activeId: string | null;
}

// ── Multi-profile CRUD ──────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Auto-migrate the legacy single-config entry into the multi-profile store.
 * Runs silently on first read when the old key exists but profiles don't.
 */
function migrateLegacyConfig(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(PROFILES_KEY)) return; // already migrated
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const config = JSON.parse(raw) as ServerConfig;
    if (!config.supabaseUrl) return;
    const profile: ServerProfile = {
      ...config,
      id: generateId(),
      name: config.supabaseUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, ''),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    const store: ServerProfileStore = { profiles: [profile], activeId: profile.id };
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
    localStorage.setItem(ACTIVE_ID_KEY, profile.id);
  } catch {
    // Legacy data is malformed — skip migration
  }
}

export function getServerProfiles(): ServerProfile[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyConfig();
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const store = JSON.parse(raw) as ServerProfileStore;
    return store.profiles ?? [];
  } catch {
    return [];
  }
}

export function getActiveProfileId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_ID_KEY);
}

export function getActiveProfile(): ServerProfile | null {
  const profiles = getServerProfiles();
  const activeId = getActiveProfileId();
  return profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
}

export function addServerProfile(name: string, config: ServerConfig): ServerProfile {
  const profiles = getServerProfiles();
  const profile: ServerProfile = {
    ...config,
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };
  profiles.push(profile);
  const store: ServerProfileStore = { profiles, activeId: profile.id };
  localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
  localStorage.setItem(ACTIVE_ID_KEY, profile.id);
  return profile;
}

export function updateServerProfile(
  id: string,
  patch: Partial<Omit<ServerProfile, 'id' | 'createdAt'>>,
): void {
  const profiles = getServerProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  Object.assign(profiles[idx]!, patch);
  const store: ServerProfileStore = { profiles, activeId: getActiveProfileId() };
  localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
}

export function removeServerProfile(id: string): void {
  const profiles = getServerProfiles().filter((p) => p.id !== id);
  const activeId = getActiveProfileId();
  const newActiveId = activeId === id ? (profiles[0]?.id ?? null) : activeId;
  const store: ServerProfileStore = { profiles, activeId: newActiveId };
  localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
  if (newActiveId) {
    localStorage.setItem(ACTIVE_ID_KEY, newActiveId);
  } else {
    localStorage.removeItem(ACTIVE_ID_KEY);
  }
}

export function switchActiveProfile(id: string): ServerProfile | null {
  const profile = getServerProfiles().find((p) => p.id === id);
  if (!profile) return null;
  localStorage.setItem(ACTIVE_ID_KEY, id);
  updateServerProfile(id, { lastUsedAt: new Date().toISOString() });
  return profile;
}

// ── Legacy single-config API (backward compat) ──────────────────────

/**
 * Returns the active server's config. On Tauri this is the active profile;
 * on Web this always returns null (runtime-config.js is authoritative).
 */
export function getStoredServerConfig(): ServerConfig | null {
  if (typeof window === 'undefined') return null;
  migrateLegacyConfig();
  const active = getActiveProfile();
  return active
    ? {
        supabaseUrl: active.supabaseUrl,
        supabaseAnonKey: active.supabaseAnonKey,
        apiBaseUrl: active.apiBaseUrl,
        webBaseUrl: active.webBaseUrl,
      }
    : null;
}

export function saveServerConfig(config: ServerConfig): void {
  // When called from the wizard, add-or-update a profile
  const active = getActiveProfile();
  if (active) {
    updateServerProfile(active.id, config);
  } else {
    addServerProfile(config.supabaseUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, ''), config);
  }
  // Also write the legacy key for any old code paths that read it directly
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

/** Safely decode a base64 env var; returns '' when the var is unset. */
function safeAtob(value: string | undefined): string {
  if (!value) return '';
  try {
    return atob(value);
  } catch {
    return '';
  }
}

function resolveSupabaseUrl(): string {
  if (isWeb) {
    return (
      getRuntimeConfig()?.supabaseUrl ||
      process.env['SUPABASE_URL'] ||
      process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
      safeAtob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_URL_BASE64'])
    );
  }
  // Tauri: localStorage wizard config takes highest priority
  return (
    getStoredServerConfig()?.supabaseUrl ||
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
    safeAtob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_URL_BASE64'])
  );
}

function resolveSupabaseAnonKey(): string {
  if (isWeb) {
    return (
      getRuntimeConfig()?.supabaseAnonKey ||
      process.env['SUPABASE_ANON_KEY'] ||
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
      safeAtob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_KEY_BASE64'])
    );
  }
  return (
    getStoredServerConfig()?.supabaseAnonKey ||
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
    safeAtob(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_KEY_BASE64'])
  );
}

// ── Lazy-initialized Supabase client ─────────────────────────────────
let _supabase: SupabaseClient | null = null;
let _clientVersion = 0;

/**
 * Returns a monotonically increasing version number that increments
 * every time `reinitializeSupabase()` is called. Components can use
 * this as a React effect dependency to detect client re-creation.
 */
export function getClientVersion(): number {
  return _clientVersion;
}

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
  _clientVersion++;
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
