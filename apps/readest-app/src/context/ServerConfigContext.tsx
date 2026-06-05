'use client';

import {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
  useEffect,
  useMemo,
} from 'react';
import { isTauriAppPlatform } from '@/services/environment';
import {
  saveServerConfig,
  getStoredServerConfig,
  reinitializeSupabase,
  type ServerConfig,
} from '@/utils/supabase';

interface ServerConfigContextType {
  /** true once the config check / wizard is complete and children may render */
  ready: boolean;
  /** The active server config (null if wizard hasn't been completed) */
  config: ServerConfig | null;
  /** Save a new config, re-initialize Supabase, and mark ready */
  saveAndContinue: (config: ServerConfig) => void;
  /** Open the wizard again to edit the server config */
  openWizard: () => void;
}

const ServerConfigContext = createContext<ServerConfigContextType | undefined>(undefined);

// ── First-Launch Wizard UI ──────────────────────────────────────────

function SetupWizard({ onComplete }: { onComplete: (config: ServerConfig) => void }) {
  const [serverUrl, setServerUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = useCallback(async () => {
    const url = serverUrl.trim().replace(/\/+$/, '');
    if (!url) {
      setError('Please enter the server URL');
      return;
    }
    setTesting(true);
    setError('');

    // Quick connectivity check: try to reach the Kong/Supabase health endpoint
    try {
      const resp = await fetch(`${url}/auth/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok && resp.status !== 401) {
        // 401 is fine — it means the gateway is up but requires auth
        setError(`Server responded with status ${resp.status}. Please verify the URL.`);
        setTesting(false);
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Cannot reach server: ${msg}`);
      setTesting(false);
      return;
    }

    const config: ServerConfig = {
      supabaseUrl: url,
      ...(anonKey.trim() ? { supabaseAnonKey: anonKey.trim() } : {}),
      apiBaseUrl: url, // Kong gateway also serves the REST API
    };
    onComplete(config);
    setTesting(false);
  }, [serverUrl, anonKey, onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        background: 'var(--bg-primary, #f8f9fa)',
        color: 'var(--text-primary, #1a1a2e)',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: 'var(--bg-secondary, #fff)',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: '0 0 4px',
            textAlign: 'center',
          }}
        >
          Readest
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary, #666)',
            textAlign: 'center',
            margin: '0 0 24px',
          }}
        >
          Self-hosted Server Setup / 自建服务器配置
        </p>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Server URL *
        </label>
        <input
          type='url'
          placeholder='http://192.168.1.100:8000'
          value={serverUrl}
          onChange={(e) => {
            setServerUrl(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !testing) handleConnect();
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            border: '1px solid var(--border-primary, #ddd)',
            borderRadius: 8,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 16,
            background: 'var(--bg-primary, #f8f9fa)',
            color: 'var(--text-primary, #1a1a2e)',
          }}
          autoFocus
        />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Anon Key{' '}
          <span style={{ fontWeight: 400, color: 'var(--text-secondary, #999)' }}>(optional)</span>
        </label>
        <input
          type='text'
          placeholder='Leave blank to use the default key'
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !testing) handleConnect();
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            border: '1px solid var(--border-primary, #ddd)',
            borderRadius: 8,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 20,
            background: 'var(--bg-primary, #f8f9fa)',
            color: 'var(--text-primary, #1a1a2e)',
          }}
        />

        {error && (
          <div
            style={{
              fontSize: 13,
              color: '#e53e3e',
              marginBottom: 12,
              padding: '8px 12px',
              background: '#fff5f5',
              borderRadius: 6,
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={testing || !serverUrl.trim()}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            background: testing ? '#a0aec0' : '#3182ce',
            border: 'none',
            borderRadius: 8,
            cursor: testing || !serverUrl.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {testing ? 'Connecting...' : 'Connect / 连接'}
        </button>

        <p
          style={{
            fontSize: 12,
            color: 'var(--text-secondary, #999)',
            textAlign: 'center',
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Enter the URL of your Readest self-hosted server (Kong gateway port, typically :8000).
          <br />
          输入你的 Readest 自建服务器地址（Kong 网关端口，通常为 :8000）。
        </p>
      </div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────

export function ServerConfigProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    // Only gate on Tauri platform — web uses runtime-config.js
    if (!isTauriAppPlatform()) {
      setReady(true);
      return;
    }

    const stored = getStoredServerConfig();
    if (stored?.supabaseUrl) {
      setConfig(stored);
      setReady(true);
    } else {
      // No config yet — show wizard
      setShowWizard(true);
    }
  }, []);

  const saveAndContinue = useCallback((newConfig: ServerConfig) => {
    saveServerConfig(newConfig);
    reinitializeSupabase();
    setConfig(newConfig);
    setShowWizard(false);
    setReady(true);
  }, []);

  const openWizard = useCallback(() => {
    setShowWizard(true);
  }, []);

  const value = useMemo(
    () => ({ ready, config, saveAndContinue, openWizard }),
    [ready, config, saveAndContinue, openWizard],
  );

  if (showWizard) {
    return (
      <ServerConfigContext.Provider value={value}>
        <SetupWizard onComplete={saveAndContinue} />
      </ServerConfigContext.Provider>
    );
  }

  return <ServerConfigContext.Provider value={value}>{children}</ServerConfigContext.Provider>;
}

export function useServerConfig(): ServerConfigContextType {
  const ctx = useContext(ServerConfigContext);
  if (!ctx) throw new Error('useServerConfig must be used within ServerConfigProvider');
  return ctx;
}
