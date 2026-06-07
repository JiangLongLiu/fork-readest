// ============================================================================
// TTS Provider Strategy Pattern Interface
// ============================================================================
// This file defines the strategy pattern interface for TTS providers.
// Each provider (Kokoro offline, Minimax cloud, etc.) implements TTSProvider,
// allowing TTSManager to switch between them transparently.
// ============================================================================

/**
 * Raw PCM audio chunk received from a TTS engine (Rust backend or cloud API).
 * - `data`: Float32 PCM samples normalized to [-1.0, 1.0]
 * - `sampleRate`: Sample rate in Hz (e.g. 24000 for Kokoro-82M)
 */
export type OnAudioChunk = {
  data: Float32Array;
  sampleRate: number;
};

/**
 * Callback type for receiving streaming audio chunks from a TTS provider.
 * Called repeatedly as the engine produces audio segments.
 */
export type AudioChunkCallback = (chunk: OnAudioChunk) => void;

/**
 * TTS playback state for provider-level tracking.
 */
export type TTSProviderState = 'idle' | 'playing' | 'paused' | 'loading';

/**
 * Voice definition for a TTS provider.
 */
export interface TTSProviderVoice {
  id: string;
  name: string;
  lang: string;
  /** Whether this voice requires a network connection */
  isOnline?: boolean;
}

/**
 * Grouped voices under a common engine/category label.
 */
export interface TTSProviderVoicesGroup {
  id: string;
  name: string;
  voices: TTSProviderVoice[];
  disabled?: boolean;
}

/**
 * ============================================================================
 * TTSProvider — Strategy Interface
 * ============================================================================
 *
 * All TTS engines (offline Kokoro, cloud Minimax, etc.) must implement this
 * interface. The TTSManager holds one active provider at a time and delegates
 * all playback control to it.
 *
 * Lifecycle:
 *   1. `initialize()` — Load models / establish connections (called once)
 *   2. `speak(text, onChunk, signal)` — Start streaming synthesis
 *   3. `pause()` / `resume()` — Optional playback control
 *   4. `stop()` — Abort current synthesis
 *   5. `destroy()` — Release all resources (called on app shutdown)
 */
export interface TTSProvider {
  /** Unique identifier for this provider (e.g. 'kokoro', 'minimax') */
  readonly name: string;

  /** Whether this provider requires network connectivity */
  readonly isOnline: boolean;

  /** Current initialization state */
  initialized: boolean;

  /**
   * Initialize the provider: load ONNX models, warm up sessions, etc.
   * @returns true if initialization succeeded
   */
  initialize(): Promise<boolean>;

  /**
   * Start streaming TTS synthesis for the given text.
   *
   * The provider should call `onChunk` repeatedly as audio data becomes
   * available. The `signal` can be used to abort long-running synthesis.
   *
   * The returned Promise resolves when synthesis is complete (all chunks
   * have been delivered via `onChunk`), or rejects on error.
   */
  speak(text: string, onChunk: AudioChunkCallback, signal: AbortSignal): Promise<void>;

  /**
   * Pause current playback. Returns true if pause was successful.
   * Providers that cannot pause mid-stream should return false.
   */
  pause(): Promise<boolean>;

  /**
   * Resume from a paused state. Returns true if resume was successful.
   */
  resume(): Promise<boolean>;

  /**
   * Stop current synthesis immediately. Should clean up any in-flight
   * inference tasks and audio buffers.
   */
  stop(): Promise<void>;

  /**
   * Set the speech rate multiplier (1.0 = normal speed).
   * Range: typically [0.5, 3.0]
   */
  setRate(rate: number): Promise<void>;

  /**
   * Set the speech pitch multiplier (1.0 = normal pitch).
   * Range: typically [0.5, 2.0]
   */
  setPitch(pitch: number): Promise<void>;

  /**
   * Select a voice by its ID.
   */
  setVoice(voiceId: string): Promise<void>;

  /**
   * Get all available voices for this provider.
   */
  getVoices(): Promise<TTSProviderVoice[]>;

  /**
   * Release all resources held by this provider.
   * After destroy(), the provider cannot be used without re-initialization.
   */
  destroy(): Promise<void>;
}
