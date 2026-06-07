import { TTSProvider, TTSProviderVoice, AudioChunkCallback } from './types';
import { KokoroTTSProvider } from './KokoroTTSProvider';
import { MinimaxTTSProvider, MinimaxConfig } from './MinimaxTTSProvider';

// ============================================================================
// TTSManager — Unified manager for TTS Provider strategy switching
// ============================================================================

/**
 * TTSManager is the central coordinator for all TTS providers.
 *
 * It manages the lifecycle of each provider (initialize, destroy),
 * handles switching between providers (e.g. from offline Kokoro to
 * cloud Minimax), and provides a unified API for the UI layer.
 *
 * Usage:
 * ```ts
 * const manager = TTSManager.getInstance();
 * await manager.initialize();
 *
 * // Switch to Kokoro (offline)
 * await manager.setActiveProvider('kokoro');
 *
 * // Start synthesis
 * const ac = new AbortController();
 * await manager.speak('Hello world', (chunk) => { ... }, ac.signal);
 * ```
 */

export type TTSProviderName = 'kokoro' | 'minimax';

export interface TTSManagerState {
  activeProvider: TTSProviderName | null;
  providers: Record<string, { initialized: boolean; isOnline: boolean }>;
  isSpeaking: boolean;
  isPaused: boolean;
}

export class TTSManager {
  private static instance: TTSManager | null = null;

  private providers = new Map<string, TTSProvider>();
  private activeProviderName: TTSProviderName | null = null;
  private currentAbortController: AbortController | null = null;
  private state: TTSManagerState = {
    activeProvider: null,
    providers: {},
    isSpeaking: false,
    isPaused: false,
  };

  private constructor() {
    // Register built-in providers
    this.providers.set('kokoro', new KokoroTTSProvider());
    this.providers.set('minimax', new MinimaxTTSProvider());
  }

  /**
   * Get the singleton TTSManager instance.
   */
  static getInstance(): TTSManager {
    if (!TTSManager.instance) {
      TTSManager.instance = new TTSManager();
    }
    return TTSManager.instance;
  }

  /**
   * Initialize all registered providers.
   * Providers that fail to initialize are marked but not removed.
   */
  async initialize(): Promise<void> {
    const initPromises = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        await provider.initialize();
        this.state.providers[name] = {
          initialized: provider.initialized,
          isOnline: provider.isOnline,
        };
      } catch (error) {
        console.warn(`[TTSManager] Failed to init provider '${name}':`, error);
        this.state.providers[name] = {
          initialized: false,
          isOnline: provider.isOnline,
        };
      }
    });

    await Promise.allSettled(initPromises);

    // Auto-select the best available provider
    if (!this.activeProviderName) {
      if (this.providers.get('kokoro')?.initialized) {
        this.activeProviderName = 'kokoro';
      } else if (this.providers.get('minimax')?.initialized) {
        this.activeProviderName = 'minimax';
      }
      this.state.activeProvider = this.activeProviderName;
    }
  }

  /**
   * Switch to a different TTS provider.
   * Stops any active synthesis on the current provider before switching.
   */
  async setActiveProvider(name: TTSProviderName): Promise<boolean> {
    const provider = this.providers.get(name);
    if (!provider) {
      console.warn(`[TTSManager] Unknown provider: '${name}'`);
      return false;
    }

    if (!provider.initialized) {
      console.warn(`[TTSManager] Provider '${name}' is not initialized`);
      return false;
    }

    // Stop current synthesis if active
    if (this.state.isSpeaking) {
      await this.stop();
    }

    this.activeProviderName = name;
    this.state.activeProvider = name;
    console.log(`[TTSManager] Active provider switched to '${name}'`);
    return true;
  }

  /**
   * Get the currently active provider instance.
   */
  getActiveProvider(): TTSProvider | null {
    if (!this.activeProviderName) return null;
    return this.providers.get(this.activeProviderName) ?? null;
  }

  /**
   * Get the name of the active provider.
   */
  getActiveProviderName(): TTSProviderName | null {
    return this.activeProviderName;
  }

  /**
   * Get the current manager state.
   */
  getState(): Readonly<TTSManagerState> {
    return { ...this.state };
  }

  /**
   * Start speaking using the active provider.
   */
  async speak(text: string, onChunk: AudioChunkCallback, signal: AbortSignal): Promise<void> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('[TTSManager] No active provider');
    }

    this.state.isSpeaking = true;
    this.state.isPaused = false;

    try {
      await provider.speak(text, onChunk, signal);
    } finally {
      this.state.isSpeaking = false;
      this.state.isPaused = false;
    }
  }

  /**
   * Pause the active provider's playback.
   */
  async pause(): Promise<boolean> {
    const provider = this.getActiveProvider();
    if (!provider) return false;

    const result = await provider.pause();
    if (result) {
      this.state.isPaused = true;
    }
    return result;
  }

  /**
   * Resume the active provider's playback.
   */
  async resume(): Promise<boolean> {
    const provider = this.getActiveProvider();
    if (!provider) return false;

    const result = await provider.resume();
    if (result) {
      this.state.isPaused = false;
    }
    return result;
  }

  /**
   * Stop the active provider's synthesis and playback.
   */
  async stop(): Promise<void> {
    const provider = this.getActiveProvider();
    if (provider) {
      await provider.stop();
    }
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.state.isSpeaking = false;
    this.state.isPaused = false;
  }

  /**
   * Get voices from all initialized providers, grouped by provider.
   */
  async getAllVoices(): Promise<Array<{ provider: string; voices: TTSProviderVoice[] }>> {
    const results: Array<{ provider: string; voices: TTSProviderVoice[] }> = [];

    for (const [name, provider] of this.providers) {
      if (provider.initialized) {
        const voices = await provider.getVoices();
        results.push({ provider: name, voices });
      }
    }

    return results;
  }

  /**
   * Set the speech rate on the active provider.
   */
  async setRate(rate: number): Promise<void> {
    const provider = this.getActiveProvider();
    if (provider) {
      await provider.setRate(rate);
    }
  }

  /**
   * Set the voice on the active provider.
   */
  async setVoice(voiceId: string): Promise<void> {
    const provider = this.getActiveProvider();
    if (provider) {
      await provider.setVoice(voiceId);
    }
  }

  /**
   * Register a custom TTS provider.
   */
  registerProvider(name: string, provider: TTSProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Destroy all providers and release resources.
   */
  async destroy(): Promise<void> {
    await this.stop();
    for (const [, provider] of this.providers) {
      await provider.destroy();
    }
    this.activeProviderName = null;
    this.state.activeProvider = null;
  }

  /**
   * Reset the singleton instance (mainly for testing).
   */
  static resetInstance(): void {
    if (TTSManager.instance) {
      TTSManager.instance.destroy();
      TTSManager.instance = null;
    }
  }
}
