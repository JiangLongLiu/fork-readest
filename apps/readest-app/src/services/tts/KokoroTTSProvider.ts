import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { TTSProvider, AudioChunkCallback, TTSProviderVoice, OnAudioChunk } from './types';

// ============================================================================
// Event payload types (matching Rust models.rs)
// ============================================================================

interface KokoroAudioChunkPayload {
  sessionId: string;
  audioBase64: string;
  sampleRate: number;
  isLast: boolean;
  sentenceIndex: number;
  totalSentences: number;
}

interface KokoroEndPayload {
  sessionId: string;
}

interface KokoroInitResult {
  success: boolean;
  message?: string;
  voiceCount: number;
}

interface KokoroStartResult {
  sessionId: string;
}

interface KokoroVoiceInfo {
  id: string;
  name: string;
  lang: string;
  index: number;
}

// ============================================================================
// StreamAudioPlayer — Web Audio API PCM streaming player
// ============================================================================

/**
 * Handles gapless PCM audio streaming playback using the Web Audio API.
 *
 * Audio chunks are scheduled ahead of time using AudioBufferSourceNode
 * for sample-accurate, gapless playback. Supports pause/resume by tracking
 * the playback offset and re-scheduling from that point.
 *
 * Design decisions:
 * - Uses AudioBufferSourceNode (not AudioWorklet) for simplicity and
 *   wide browser support. Each chunk becomes a short AudioBuffer.
 * - Buffers are scheduled at precise `startTime` values so there are
 *   no audible gaps or clicks between chunks.
 * - A small scheduling interval (10ms) keeps latency low while avoiding
 *   excessive setTimeout overhead.
 */
class StreamAudioPlayer {
  private context: AudioContext | null = null;
  private scheduledSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime = 0;
  private playbackOffset = 0;
  private startWallTime = 0;
  private sampleRate = 24000;

  /**
   * Queue of audio chunks waiting to be scheduled.
   * Used during pause to accumulate incoming data.
   */
  private pendingQueue: Float32Array[] = [];
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private onPlaybackEnd: (() => void) | null = null;

  /**
   * Initialize the AudioContext with the given sample rate.
   * Must be called before scheduling any audio.
   */
  init(sampleRate: number): void {
    this.sampleRate = sampleRate;
    if (!this.context) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new Ctor({ sampleRate });
    }
  }

  get contextState(): AudioContextState | 'closed' {
    return this.context?.state ?? 'closed';
  }

  get currentOffset(): number {
    return this.playbackOffset;
  }

  /**
   * Queue a Float32 PCM chunk for playback.
   * The chunk will be scheduled at the next available time slot
   * to maintain gapless audio.
   */
  queueChunk(data: Float32Array): void {
    if (!this.context) return;
    this.pendingQueue.push(data);
    this.schedulePending();
    this.ensureScheduler();
  }

  /**
   * Pause playback: record current offset, stop all scheduled sources.
   * Incoming chunks will be buffered in pendingQueue until resume().
   */
  pause(): number {
    if (this.context && this.context.state === 'running') {
      this.playbackOffset = this.context.currentTime - this.startWallTime;
      this.context.suspend();
    }
    this.stopAllSources();
    return this.playbackOffset;
  }

  /**
   * Resume playback from the recorded offset.
   * Re-schedules any buffered chunks and resumes the AudioContext.
   */
  async resume(): Promise<void> {
    if (!this.context) return;

    this.nextStartTime = this.playbackOffset;
    this.startWallTime = this.context.currentTime - this.playbackOffset;

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    // Re-schedule buffered chunks
    this.schedulePending();
    this.ensureScheduler();
  }

  /**
   * Stop all playback and release resources.
   */
  stop(): void {
    this.stopAllSources();
    this.clearScheduler();
    this.pendingQueue = [];
    this.playbackOffset = 0;
    this.nextStartTime = 0;
    this.startWallTime = 0;
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
  }

  /** Set a callback invoked when all audio has finished playing. */
  set onEnded(cb: (() => void) | null) {
    this.onPlaybackEnd = cb;
  }

  // ---- Internal ----

  private schedulePending(): void {
    if (!this.context) return;

    while (this.pendingQueue.length > 0) {
      const data = this.pendingQueue.shift()!;
      const buffer = this.context.createBuffer(1, data.length, this.sampleRate);
      buffer.getChannelData(0).set(data);

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;

      this.scheduledSources.add(source);
      source.onended = () => {
        this.scheduledSources.delete(source);
        // When no more sources and no pending data, playback is done
        if (this.scheduledSources.size === 0 && this.pendingQueue.length === 0) {
          this.onPlaybackEnd?.();
        }
      };
    }
  }

  private ensureScheduler(): void {
    if (this.schedulerTimer !== null) return;
    this.schedulerTimer = setInterval(() => {
      this.schedulePending();
      if (this.pendingQueue.length === 0 && this.scheduledSources.size === 0) {
        this.clearScheduler();
      }
    }, 50); // Check every 50ms for new data
  }

  private clearScheduler(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private stopAllSources(): void {
    for (const source of this.scheduledSources) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // Source may already have stopped
      }
    }
    this.scheduledSources.clear();
  }
}

// ============================================================================
// KokoroTTSProvider — Offline TTS via Rust ONNX Runtime backend
// ============================================================================

/**
 * KokoroTTSProvider implements the TTSProvider strategy interface for
 * offline text-to-speech using the Kokoro-82M ONNX model running
 * natively in the Rust backend.
 *
 * Flow:
 *  1. `speak()` calls `plugin:kokoro-tts|start` to trigger Rust-side inference
 *  2. Rust splits text into sentences, runs ONNX inference per sentence
 *  3. Each audio chunk is emitted as a Tauri event (`kokoro-tts-audio-chunk`)
 *  4. This provider listens for events, decodes base64 PCM, and feeds the
 *     StreamAudioPlayer for gapless Web Audio playback
 *  5. `kokoro-tts-end` event signals synthesis completion
 */
export class KokoroTTSProvider implements TTSProvider {
  readonly name = 'kokoro';
  readonly isOnline = false;
  initialized = false;

  private player = new StreamAudioPlayer();
  private audioListener: UnlistenFn | null = null;
  private endListener: UnlistenFn | null = null;
  private rate = 1.0;
  private voiceId = 0;

  /** When true, incoming audio chunks are dropped (during pause). */
  private isPaused = false;

  /** Accumulates chunks received during pause for replay on resume. */
  private pauseBuffer: OnAudioChunk[] = [];

  async initialize(): Promise<boolean> {
    try {
      const result = await invoke<KokoroInitResult>('plugin:kokoro-tts|init');
      this.initialized = result.success;
      if (result.success) {
        console.log(`[KokoroProvider] Engine initialized: ${result.voiceCount} voices loaded`);
      } else {
        console.warn('[KokoroProvider] Init failed:', result.message);
      }
      return this.initialized;
    } catch (error) {
      console.error('[KokoroProvider] Init error:', error);
      this.initialized = false;
      return false;
    }
  }

  async speak(text: string, onChunk: AudioChunkCallback, signal: AbortSignal): Promise<void> {
    if (!this.initialized) {
      throw new Error('KokoroTTSProvider not initialized');
    }

    // Stop any previous session
    await this.stopInternal();
    this.isPaused = false;
    this.pauseBuffer = [];

    // Initialize the stream audio player
    this.player.init(24000); // Kokoro-82M outputs 24kHz mono

    return new Promise<void>(async (resolve, reject) => {
      let resolved = false;

      // ---- Audio chunk listener ----
      const unlistenAudio = await listen<KokoroAudioChunkPayload>(
        'kokoro-tts-audio-chunk',
        (event) => {
          const { audioBase64, sampleRate, isLast, sentenceIndex } = event.payload;

          // Decode base64 → Float32 PCM
          const pcmData = decodeBase64ToFloat32(audioBase64);
          const chunk: OnAudioChunk = { data: pcmData, sampleRate };

          // Deliver to caller's callback
          onChunk(chunk);

          // Schedule for playback (or buffer if paused)
          if (this.isPaused) {
            this.pauseBuffer.push(chunk);
          } else {
            this.player.queueChunk(pcmData);
          }

          if (isLast && !resolved) {
            resolved = true;
            cleanup();
            resolve();
          }
        },
      );
      this.audioListener = unlistenAudio;

      // ---- End event listener ----
      const unlistenEnd = await listen<KokoroEndPayload>('kokoro-tts-end', () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      });
      this.endListener = unlistenEnd;

      // ---- Abort signal handler ----
      const abortHandler = () => {
        // Stop Rust-side synthesis
        invoke('plugin:kokoro-tts|stop', { args: {} }).catch(() => {});
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(); // Resolve (not reject) — abort is a normal control flow
        }
      };
      signal.addEventListener('abort', abortHandler);

      // ---- Cleanup helper ----
      const cleanup = () => {
        signal.removeEventListener('abort', abortHandler);
        unlistenAudio();
        unlistenEnd();
        this.audioListener = null;
        this.endListener = null;
      };

      // ---- Start Rust-side synthesis ----
      try {
        await invoke<KokoroStartResult>('plugin:kokoro-tts|start', {
          args: {
            text,
            voiceId: this.voiceId,
            speed: this.rate,
          },
        });
      } catch (error) {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      }
    });
  }

  async pause(): Promise<boolean> {
    this.isPaused = true;
    this.player.pause();
    return true;
  }

  async resume(): Promise<boolean> {
    this.isPaused = false;

    // Replay any chunks buffered during pause
    for (const chunk of this.pauseBuffer) {
      this.player.queueChunk(chunk.data);
    }
    this.pauseBuffer = [];

    await this.player.resume();
    return true;
  }

  async stop(): Promise<void> {
    await this.stopInternal();
  }

  async setRate(rate: number): Promise<void> {
    this.rate = rate;
    await invoke('plugin:kokoro-tts|set_rate', { args: { rate } });
  }

  async setPitch(_pitch: number): Promise<void> {
    // Kokoro model does not have a direct pitch control.
    // Pitch variation would require modifying the style vector,
    // which is not implemented in this version.
  }

  async setVoice(voiceId: string): Promise<void> {
    // Voice IDs are like "af_bella", "am_adam", etc.
    // We map them to the numeric index used by the Rust engine.
    const voices = await this.getVoices();
    const voice = voices.find((v) => v.id === voiceId);
    if (voice) {
      // Parse index from the voice or use id as-is
      const match = voiceId.match(/^(\d+)$/);
      this.voiceId = match ? parseInt(match[1], 10) : 0;
      await invoke('plugin:kokoro-tts|set_voice', {
        args: { voiceId: this.voiceId },
      });
    }
  }

  async getVoices(): Promise<TTSProviderVoice[]> {
    try {
      const result = await invoke<{ voices: KokoroVoiceInfo[] }>('plugin:kokoro-tts|get_voices');
      return result.voices.map((v) => ({
        id: v.id,
        name: v.name,
        lang: v.lang,
        isOnline: false,
      }));
    } catch {
      return [];
    }
  }

  async destroy(): Promise<void> {
    await this.stopInternal();
    this.initialized = false;
  }

  // ---- Private helpers ----

  private async stopInternal(): Promise<void> {
    this.isPaused = false;
    this.pauseBuffer = [];
    this.player.stop();

    if (this.audioListener) {
      this.audioListener();
      this.audioListener = null;
    }
    if (this.endListener) {
      this.endListener();
      this.endListener = null;
    }

    try {
      await invoke('plugin:kokoro-tts|stop', { args: {} });
    } catch {
      // Ignore errors when no session is active
    }
  }
}

// ============================================================================
// Utility: Base64 → Float32Array decoder
// ============================================================================

/**
 * Decode a base64-encoded string of little-endian Float32 PCM samples
 * into a Float32Array suitable for the Web Audio API.
 */
function decodeBase64ToFloat32(base64: string): Float32Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // Interpret as little-endian Float32 (matches Rust's native byte order on x86/ARM)
  return new Float32Array(bytes.buffer);
}
