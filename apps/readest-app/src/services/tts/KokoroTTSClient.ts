import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getUserLocale } from '@/utils/misc';
import { parseSSMLMarks } from '@/utils/ssml';
import { TTSClient, TTSMessageEvent } from './TTSClient';
import { TTSGranularity, TTSVoice, TTSVoicesGroup } from './types';
import { TTSUtils } from './TTSUtils';
import { TTSController } from './TTSController';

// ============================================================================
// KokoroTTSClient — Bridge between TTSClient interface and Rust ONNX backend
// ============================================================================

/**
 * KokoroTTSClient implements the existing TTSClient interface, delegating
 * synthesis to the Rust-side Kokoro ONNX engine via Tauri IPC.
 *
 * This client integrates with the existing TTSController by:
 *  1. Implementing `TTSClient.speak()` as an AsyncIterable that yields
 *     boundary/end/error events per sentence
 *  2. Managing a StreamAudioPlayer for gapless PCM playback via Web Audio API
 *  3. Supporting pause/resume by suspending the AudioContext
 *
 * The client follows the same patterns as EdgeTTSClient and WebSpeechClient,
 * making it a drop-in addition to the TTSController's client roster.
 */

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

interface KokoroVoiceInfo {
  id: string;
  name: string;
  lang: string;
  index: number;
}

/** Voice ID prefix to identify Kokoro voices in the unified voice picker. */
const VOICE_ID_PREFIX = 'kokoro_';

export class KokoroTTSClient implements TTSClient {
  name = 'kokoro-tts';
  initialized = false;
  controller?: TTSController;

  #voices: TTSVoice[] = [];
  #primaryLang = 'en';
  #speakingLang = '';
  #currentVoiceId = '';
  #rate = 1.0;

  // Web Audio playback state
  #audioContext: AudioContext | null = null;
  #scheduledSources: Set<AudioBufferSourceNode> = new Set();
  #nextStartTime = 0;
  #playbackOffset = 0;
  #startWallTime = 0;
  #isPlaying = false;
  #isPaused = false;
  #pauseBuffer: Float32Array[] = [];
  #lastSampleRate = 24000;

  // Event listeners
  #audioListener: UnlistenFn | null = null;
  #endListener: UnlistenFn | null = null;
  #sessionComplete = false;

  constructor(controller?: TTSController) {
    this.controller = controller;
  }

  async init(): Promise<boolean> {
    try {
      const result = await invoke<{ success: boolean; voiceCount: number }>(
        'plugin:kokoro-tts|init',
      );
      this.initialized = result.success;

      if (result.success) {
        await this.#loadVoices();
        console.log(`[KokoroTTSClient] Initialized: ${result.voiceCount} voices`);
      }
      return this.initialized;
    } catch (error) {
      console.error('[KokoroTTSClient] Init failed:', error);
      this.initialized = false;
      return false;
    }
  }

  async #loadVoices(): Promise<void> {
    try {
      const result = await invoke<{ voices: KokoroVoiceInfo[] }>('plugin:kokoro-tts|get_voices');
      this.#voices = result.voices.map(
        (v) =>
          ({
            id: `${VOICE_ID_PREFIX}${v.id}`,
            name: v.name,
            lang: v.lang,
            disabled: !this.initialized,
          }) as TTSVoice,
      );
    } catch (error) {
      console.warn('[KokoroTTSClient] Failed to load voices:', error);
      this.#voices = [];
    }
  }

  getVoiceIdFromLang = async (lang: string) => {
    const preferredVoiceId = TTSUtils.getPreferredVoice(this.name, lang);
    const preferredVoice = this.#voices.find((v) => v.id === preferredVoiceId);
    if (preferredVoice) return preferredVoice.id;
    const availableVoices = (await this.getVoices(lang))[0]?.voices || [];
    return availableVoices[0]?.id || this.#currentVoiceId || `${VOICE_ID_PREFIX}af_bella`;
  };

  async *speak(
    ssml: string,
    signal: AbortSignal,
    preload = false,
  ): AsyncGenerator<TTSMessageEvent> {
    // No preload support for Kokoro (model is already loaded in Rust)
    if (preload) {
      yield { code: 'end', message: 'Preload skipped' } as TTSMessageEvent;
      return;
    }

    await this.#stopPlayback();

    const { marks } = parseSSMLMarks(ssml, this.#primaryLang);
    if (marks.length === 0) {
      yield { code: 'end', message: 'No content' } as TTSMessageEvent;
      return;
    }

    // Extract plain text from marks for Kokoro (it handles its own sentence splitting)
    const plainText = marks.map((m) => m.text).join(' ');

    // Initialize AudioContext
    this.#initAudioContext();

    // Event-driven async generator: bridge Tauri events into yield statements
    const eventQueue: Array<TTSMessageEvent | null> = [];
    let resolveWaiter: (() => void) | null = null;

    const pushEvent = (event: TTSMessageEvent | null) => {
      eventQueue.push(event);
      if (resolveWaiter) {
        resolveWaiter();
        resolveWaiter = null;
      }
    };

    // Listen for audio chunks from Rust
    const unlistenAudio = await listen<KokoroAudioChunkPayload>(
      'kokoro-tts-audio-chunk',
      (event) => {
        const { audioBase64, sampleRate, sentenceIndex, totalSentences } = event.payload;
        this.#lastSampleRate = sampleRate;

        // Decode and play audio
        const pcmData = decodeBase64ToFloat32(audioBase64);

        if (this.#isPaused) {
          this.#pauseBuffer.push(pcmData);
        } else {
          this.#scheduleAudioChunk(pcmData, sampleRate);
        }

        // Yield a boundary event for this sentence
        const markIdx = Math.min(sentenceIndex, marks.length - 1);
        const mark = marks[markIdx];
        if (mark) {
          this.#speakingLang = mark.language;
          pushEvent({
            code: 'boundary',
            mark: mark.name,
            message: `Sentence ${sentenceIndex + 1}/${totalSentences}`,
          });
        }
      },
    );
    this.#audioListener = unlistenAudio;

    // Listen for session end
    const unlistenEnd = await listen<KokoroEndPayload>('kokoro-tts-end', () => {
      this.#sessionComplete = true;
      pushEvent(null); // Sentinel to unblock the generator
    });
    this.#endListener = unlistenEnd;

    // Abort handler
    const abortHandler = () => {
      invoke('plugin:kokoro-tts|stop', { args: {} }).catch(() => {});
      this.#sessionComplete = true;
      pushEvent({ code: 'error', message: 'Aborted' });
    };
    signal.addEventListener('abort', abortHandler);

    try {
      // Start Rust-side synthesis
      await invoke('plugin:kokoro-tts|start', {
        args: {
          text: plainText,
          voiceId: this.#parseVoiceIndex(),
          speed: this.#rate,
        },
      });

      this.#isPlaying = true;

      // Drain the event queue
      while (true) {
        if (signal.aborted) {
          yield { code: 'error', message: 'Aborted' } as TTSMessageEvent;
          break;
        }

        if (eventQueue.length > 0) {
          const event = eventQueue.shift()!;
          if (event === null) {
            // Session complete sentinel
            yield { code: 'end', message: 'Synthesis complete' } as TTSMessageEvent;
            break;
          }
          yield event;
          if (event.code === 'error') break;
        } else if (this.#sessionComplete) {
          yield { code: 'end', message: 'Synthesis complete' } as TTSMessageEvent;
          break;
        } else {
          // Wait for next event
          await new Promise<void>((resolve) => {
            resolveWaiter = resolve;
            // Safety timeout: if no events arrive within 30s, break
            setTimeout(() => {
              if (resolveWaiter === resolve) {
                resolveWaiter = null;
                this.#sessionComplete = true;
                resolve();
              }
            }, 30000);
          });
        }
      }
    } catch (error) {
      console.error('[KokoroTTSClient] Speak error:', error);
      yield {
        code: 'error',
        message: error instanceof Error ? error.message : String(error),
      } as TTSMessageEvent;
    } finally {
      signal.removeEventListener('abort', abortHandler);
      unlistenAudio();
      unlistenEnd();
      this.#audioListener = null;
      this.#endListener = null;
    }
  }

  async pause(): Promise<boolean> {
    if (!this.#isPlaying) return false;
    this.#isPaused = true;

    // Record current offset and suspend
    if (this.#audioContext && this.#audioContext.state === 'running') {
      this.#playbackOffset = this.#audioContext.currentTime - this.#startWallTime;
      await this.#audioContext.suspend();
    }

    // Stop scheduled sources
    this.#stopAllSources();
    return true;
  }

  async resume(): Promise<boolean> {
    if (!this.#audioContext) return false;
    this.#isPaused = false;

    // Restore scheduling position
    this.#nextStartTime = this.#playbackOffset;
    this.#startWallTime = this.#audioContext.currentTime - this.#playbackOffset;

    if (this.#audioContext.state === 'suspended') {
      await this.#audioContext.resume();
    }

    // Replay buffered chunks
    for (const data of this.#pauseBuffer) {
      this.#scheduleAudioChunk(data, this.#lastSampleRate);
    }
    this.#pauseBuffer = [];
    return true;
  }

  async stop(): Promise<void> {
    await this.#stopPlayback();
  }

  async setRate(rate: number): Promise<void> {
    this.#rate = rate;
    try {
      await invoke('plugin:kokoro-tts|set_rate', { args: { rate } });
    } catch {
      // Ignore if not initialized
    }
  }

  async setPitch(_pitch: number): Promise<void> {
    // Kokoro does not support direct pitch control
  }

  async setVoice(voice: string): Promise<void> {
    this.#currentVoiceId = voice;
    const index = this.#parseVoiceIndex();
    try {
      await invoke('plugin:kokoro-tts|set_voice', { args: { voiceId: index } });
    } catch {
      // Ignore if not initialized
    }
  }

  async getAllVoices(): Promise<TTSVoice[]> {
    if (this.#voices.length === 0) {
      await this.#loadVoices();
    }
    return this.#voices;
  }

  async getVoices(lang: string): Promise<TTSVoicesGroup[]> {
    const locale = lang === 'en' ? getUserLocale(lang) || lang : lang;
    const voices = await this.getAllVoices();
    // Match voices where language prefixes overlap in either direction:
    //   v.lang="en" matches locale="en-US" (v.lang is prefix of locale)
    //   v.lang="en-US" matches locale="en" (locale is prefix of v.lang)
    const filteredVoices = voices.filter(
      (v) => locale.startsWith(v.lang) || v.lang.startsWith(locale),
    );

    return [
      {
        id: 'kokoro-tts',
        name: 'Kokoro TTS (Offline)',
        voices: filteredVoices.sort(TTSUtils.sortVoicesFunc),
        disabled: !this.initialized || filteredVoices.length === 0,
      },
    ];
  }

  setPrimaryLang(lang: string): void {
    this.#primaryLang = lang;
  }

  getGranularities(): TTSGranularity[] {
    return ['sentence'];
  }

  getVoiceId(): string {
    return this.#currentVoiceId;
  }

  getSpeakingLang(): string {
    return this.#speakingLang;
  }

  async shutdown(): Promise<void> {
    await this.#stopPlayback();
    this.initialized = false;
    this.#voices = [];
  }

  // ========================================================================
  // Private: Audio playback helpers
  // ========================================================================

  #initAudioContext(): void {
    if (!this.#audioContext) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.#audioContext = new Ctor({ sampleRate: 24000 });
    }
    this.#nextStartTime = 0;
    this.#playbackOffset = 0;
    this.#startWallTime = this.#audioContext.currentTime;
    this.#sessionComplete = false;
    this.#isPaused = false;
    this.#pauseBuffer = [];
  }

  #scheduleAudioChunk(data: Float32Array, sampleRate: number): void {
    if (!this.#audioContext) return;

    const buffer = this.#audioContext.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);

    const source = this.#audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#audioContext.destination);
    source.start(this.#nextStartTime);
    this.#nextStartTime += buffer.duration;

    this.#scheduledSources.add(source);
    source.onended = () => {
      this.#scheduledSources.delete(source);
    };
  }

  #stopAllSources(): void {
    for (const source of this.#scheduledSources) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // Already stopped
      }
    }
    this.#scheduledSources.clear();
  }

  async #stopPlayback(): Promise<void> {
    this.#isPlaying = false;
    this.#isPaused = false;
    this.#pauseBuffer = [];
    this.#stopAllSources();

    if (this.#audioListener) {
      this.#audioListener();
      this.#audioListener = null;
    }
    if (this.#endListener) {
      this.#endListener();
      this.#endListener = null;
    }

    if (this.#audioContext) {
      await this.#audioContext.close().catch(() => {});
      this.#audioContext = null;
    }

    try {
      await invoke('plugin:kokoro-tts|stop', { args: {} });
    } catch {
      // Ignore
    }
  }

  #parseVoiceIndex(): number {
    // Voice IDs look like "kokoro_af_bella" → index 0
    const id = this.#currentVoiceId.replace(VOICE_ID_PREFIX, '');
    const voiceInfo = this.#voices.find((v) => v.id === `${VOICE_ID_PREFIX}${id}` || v.id === id);
    // Map voice id to its position index
    const idx = this.#voices.indexOf(voiceInfo!);
    return idx >= 0 ? idx : 0;
  }
}

// ============================================================================
// Utility
// ============================================================================

function decodeBase64ToFloat32(base64: string): Float32Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}
