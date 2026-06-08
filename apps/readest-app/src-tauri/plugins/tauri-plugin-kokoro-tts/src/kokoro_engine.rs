use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use ndarray::{Array1, Array2};
use ort::session::{Session, SessionOutputs, builder::GraphOptimizationLevel};
use ort::value::DynValue;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::Mutex as TokioMutex;

use crate::error::{Error, Result};
use crate::models::*;
use crate::text_processing;

// ============================================================================
// Diagnostic Logging for Synthesis (Android only)
// ============================================================================

#[cfg(target_os = "android")]
const SYNTH_LOG_PATH: &str = "/storage/emulated/0/Download/kokoro-tts-synth.log";

#[cfg(target_os = "android")]
fn synth_log(msg: &str) {
    use std::fs::OpenOptions;
    use std::io::Write;
    log::info!("[KokoroTTS-SYNTH] {}", msg);
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(SYNTH_LOG_PATH)
    {
        let _ = writeln!(f, "{}", msg);
    }
}

#[cfg(not(target_os = "android"))]
fn synth_log(msg: &str) {
    log::info!("[KokoroTTS-SYNTH] {}", msg);
}

/// Default sample rate for Kokoro-82M model output
const KOKORO_SAMPLE_RATE: u32 = 24000;

/// Style vector dimension for Kokoro v0.19
const STYLE_VECTOR_DIM: usize = 256;

/// Maximum number of phoneme characters per inference chunk.
/// Kokoro model limit is 510; we leave room for the pad tokens at start/end.
const MAX_PHONEME_CHARS: usize = 510;

/// Built-in Kokoro voices (v0.19) — 54 voices across 9 languages.
/// Each voice corresponds to a row index in the style embedding matrix.
/// Tuple format: (id, display_name, language_code, style_index)
pub(crate) const KOKORO_VOICES: &[(&str, &str, &str, i64)] = &[
    // ── American English Female (11) ──
    ("af_alloy",    "Alloy",    "en-us", 0),
    ("af_aoede",    "Aoede",    "en-us", 1),
    ("af_bella",    "Bella",    "en-us", 2),
    ("af_heart",    "Heart",    "en-us", 3),
    ("af_jessica",  "Jessica",  "en-us", 4),
    ("af_kore",     "Kore",     "en-us", 5),
    ("af_nicole",   "Nicole",   "en-us", 6),
    ("af_nova",     "Nova",     "en-us", 7),
    ("af_river",    "River",    "en-us", 8),
    ("af_sarah",    "Sarah",    "en-us", 9),
    ("af_sky",      "Sky",      "en-us", 10),
    // ── American English Male (9) ──
    ("am_adam",     "Adam",     "en-us", 11),
    ("am_echo",     "Echo",     "en-us", 12),
    ("am_eric",     "Eric",     "en-us", 13),
    ("am_fenrir",   "Fenrir",   "en-us", 14),
    ("am_liam",     "Liam",     "en-us", 15),
    ("am_michael",  "Michael",  "en-us", 16),
    ("am_onyx",     "Onyx",     "en-us", 17),
    ("am_puck",     "Puck",     "en-us", 18),
    ("am_santa",    "Santa",    "en-us", 19),
    // ── British English Female (4) ──
    ("bf_alice",    "Alice",    "en-gb", 20),
    ("bf_emma",     "Emma",     "en-gb", 21),
    ("bf_isabella", "Isabella", "en-gb", 22),
    ("bf_lily",     "Lily",     "en-gb", 23),
    // ── British English Male (4) ──
    ("bm_daniel",   "Daniel",   "en-gb", 24),
    ("bm_fable",    "Fable",    "en-gb", 25),
    ("bm_george",   "George",   "en-gb", 26),
    ("bm_lewis",    "Lewis",    "en-gb", 27),
    // ── Spanish (3) ──
    ("ef_dora",     "Dora",     "es", 28),
    ("em_alex",     "Alex",     "es", 29),
    ("em_santa",    "Santa",    "es", 30),
    // ── French (1) ──
    ("ff_siwis",    "Siwis",    "fr", 31),
    // ── Hindi (4) ──
    ("hf_alpha",    "Alpha",    "hi", 32),
    ("hf_beta",     "Beta",     "hi", 33),
    ("hm_omega",    "Omega",    "hi", 34),
    ("hm_psi",      "Psi",      "hi", 35),
    // ── Italian (2) ──
    ("if_sara",     "Sara",     "it", 36),
    ("im_nicola",   "Nicola",   "it", 37),
    // ── Japanese (5) ──
    ("jf_alpha",      "Alpha",      "ja", 38),
    ("jf_gongitsune", "Gongitsune", "ja", 39),
    ("jf_nezumi",     "Nezumi",     "ja", 40),
    ("jf_tebukuro",   "Tebukuro",   "ja", 41),
    ("jm_kumo",       "Kumo",       "ja", 42),
    // ── Portuguese (3) ──
    ("pf_dora",     "Dora",     "pt", 43),
    ("pm_alex",     "Alex",     "pt", 44),
    ("pm_santa",    "Santa",    "pt", 45),
    // ── Chinese (8) ──
    ("zf_xiaobei",  "Xiaobei",  "zh", 46),
    ("zf_xiaoni",   "Xiaoni",   "zh", 47),
    ("zf_xiaoxiao", "Xiaoxiao", "zh", 48),
    ("zf_xiaoyi",   "Xiaoyi",   "zh", 49),
    ("zm_yunjian",  "Yunjian",  "zh", 50),
    ("zm_yunxi",    "Yunxi",    "zh", 51),
    ("zm_yunxia",   "Yunxia",   "zh", 52),
    ("zm_yunyang",  "Yunyang",  "zh", 53),
];

/// The core Kokoro ONNX inference engine.
///
/// Manages the ONNX session, token vocabulary, and voice definitions.
/// The ONNX `Session` is wrapped in a `tokio::sync::Mutex` because
/// `Session::run()` requires `&mut self` in ort 2.x.
pub struct KokoroEngine {
    /// The loaded ONNX inference session (behind async mutex for &mut access)
    session: Arc<TokioMutex<Session>>,
    /// Phoneme character -> token ID mapping
    phoneme_to_id: HashMap<char, i64>,
    /// Current speed setting (used as default when not overridden per-call)
    default_speed: f32,
    /// Current voice index
    default_voice_id: i64,
}

// SAFETY: The tokio::sync::Mutex<Session> provides synchronized access.
// KokoroEngine is safe to share across async tasks.
unsafe impl Send for KokoroEngine {}
unsafe impl Sync for KokoroEngine {}

impl KokoroEngine {
    /// Create and initialize a new KokoroEngine.
    ///
    /// # Arguments
    /// * `model_bytes` — Raw bytes of the ONNX model file (kokoro-v0_19.onnx).
    ///   On Android, these are read via Tauri's FsExt which handles the asset:// protocol.
    /// * `tokens_bytes` — Raw bytes of the token vocabulary file (tokens.txt).
    /// * `app_data_dir` — Writable application data directory for espeak-ng data extraction.
    pub fn new(model_bytes: Vec<u8>, tokens_bytes: Vec<u8>, app_data_dir: PathBuf) -> Result<Self> {
        // Configure espeak-ng data directory before any phonemization
        let espeak_data_dir = app_data_dir.join("espeak-ng-data");
        text_processing::set_espeak_data_dir(espeak_data_dir);

        log::info!("[KokoroTTS] Loading ONNX model ({} bytes)", model_bytes.len());

        // Build ONNX session from memory
        // Note: ort 2.0.0-rc.12 uses commit_from_memory (no commit_from_file)
        let session = Session::builder()
            .map_err(|e| Error::ModelLoadError(format!("Failed to create session builder: {}", e)))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| Error::ModelLoadError(format!("Failed to set optimization level: {}", e)))?
            .with_intra_threads(
                std::thread::available_parallelism()
                    .map(|n| n.get().min(8))
                    .unwrap_or(4),
            )
            .map_err(|e| Error::ModelLoadError(format!("Failed to set thread count: {}", e)))?
            .commit_from_memory(&model_bytes)
            .map_err(|e| Error::ModelLoadError(format!("Failed to load model: {}", e)))?;

        log::info!("[KokoroTTS] ONNX model loaded successfully");

        // Load token vocabulary from bytes
        let tokens_content = String::from_utf8(tokens_bytes)
            .map_err(|e| Error::TokensLoadError(format!("Tokens file is not valid UTF-8: {}", e)))?;
        let phoneme_to_id = text_processing::load_tokens_file(&tokens_content);

        log::info!(
            "[KokoroTTS] Engine initialized: {} phonemes, sample_rate={}Hz",
            phoneme_to_id.len(),
            KOKORO_SAMPLE_RATE
        );

        Ok(Self {
            session: Arc::new(TokioMutex::new(session)),
            phoneme_to_id,
            default_speed: 1.0,
            default_voice_id: 0,
        })
    }

    /// Get the list of available voices.
    pub fn get_voices(&self) -> Vec<KokoroVoice> {
        KOKORO_VOICES
            .iter()
            .map(|(id, name, lang, index)| KokoroVoice {
                id: id.to_string(),
                name: name.to_string(),
                lang: lang.to_string(),
                index: *index,
            })
            .collect()
    }

    /// Set the default speed for future synthesis calls.
    #[allow(dead_code)]
    pub fn set_default_speed(&mut self, speed: f32) {
        self.default_speed = speed.clamp(0.5, 3.0);
    }

    /// Set the default voice ID for future synthesis calls.
    #[allow(dead_code)]
    pub fn set_default_voice(&mut self, voice_id: i64) {
        let max_voice = KOKORO_VOICES.len() as i64 - 1;
        self.default_voice_id = voice_id.clamp(0, max_voice);
    }

    /// Run streaming TTS synthesis on the given text.
    ///
    /// Splits the text into sentences, runs ONNX inference for each sentence,
    /// and emits `kokoro-tts-audio-chunk` events via Tauri's event system.
    ///
    /// The `cancel_token` is checked between sentences to allow early termination.
    pub async fn synthesize<R: Runtime>(
        &self,
        app: AppHandle<R>,
        session_id: String,
        text: String,
        voice_id: Option<i64>,
        speed: Option<f32>,
        cancel_token: tokio_util::sync::CancellationToken,
    ) -> Result<()> {
        let voice_idx = voice_id.unwrap_or(self.default_voice_id);
        let speed_val = speed.unwrap_or(self.default_speed);

        synth_log(&format!("=== Synthesis Start ==="));
        synth_log(&format!("[S1] text_len={}, voice={}, speed={}", text.len(), voice_idx, speed_val));
        synth_log(&format!("[S1] text={:?}", &text[..text.len().min(200)]));

        // Check espeak-ng status
        let espeak_ok = text_processing::is_espeak_available();
        synth_log(&format!("[S1] espeak-ng available: {}", espeak_ok));

        // Normalize and split text into sentences
        let normalized = text_processing::normalize_text(&text);
        let sentences = text_processing::split_sentences(&normalized);
        let total_sentences = sentences.len();

        synth_log(&format!("[S2] {} sentences after split", total_sentences));
        for (i, s) in sentences.iter().enumerate() {
            synth_log(&format!("[S2] sentence[{}]: {:?}", i, &s[..s.len().min(80)]));
        }

        log::info!(
            "[KokoroTTS] Session {}: synthesizing {} sentences (voice={}, speed={})",
            session_id,
            total_sentences,
            voice_idx,
            speed_val
        );

        for (idx, sentence) in sentences.iter().enumerate() {
            // Check cancellation before each sentence
            if cancel_token.is_cancelled() {
                log::info!(
                    "[KokoroTTS] Session {} cancelled at sentence {}/{}",
                    session_id,
                    idx,
                    total_sentences
                );
                return Ok(());
            }

            log::debug!(
                "[KokoroTTS] Session {}: sentence {}/{}: {:?}",
                session_id,
                idx + 1,
                total_sentences,
                &sentence[..sentence.len().min(50)]
            );

            // Convert text to phoneme token IDs
            let token_ids = text_processing::text_to_phoneme_ids(sentence, &self.phoneme_to_id);

            synth_log(&format!(
                "[S3] sentence[{}]: {} phoneme_ids, first10={:?}",
                idx,
                token_ids.len(),
                &token_ids[..token_ids.len().min(10)]
            ));

            if token_ids.is_empty() {
                log::warn!(
                    "[KokoroTTS] Session {}: empty token sequence for sentence {}, skipping",
                    session_id,
                    idx
                );
                continue;
            }

            // Run ONNX inference for this sentence
            let audio_data = self
                .run_inference(&token_ids, voice_idx, speed_val)
                .await
                .map_err(|e| {
                    Error::InferenceError(format!(
                        "Inference failed at sentence {}: {}",
                        idx, e
                    ))
                })?;

            if audio_data.is_empty() {
                synth_log(&format!("[S4] sentence[{}]: EMPTY audio output!", idx));
                log::warn!(
                    "[KokoroTTS] Session {}: no audio output for sentence {}",
                    session_id,
                    idx
                );
                continue;
            }

            // Log audio statistics
            let audio_min = audio_data.iter().cloned().fold(f32::INFINITY, f32::min);
            let audio_max = audio_data.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
            let audio_mean = audio_data.iter().sum::<f32>() / audio_data.len() as f32;
            let nan_count = audio_data.iter().filter(|v| v.is_nan()).count();
            let inf_count = audio_data.iter().filter(|v| v.is_infinite()).count();
            let audio_duration_ms = (audio_data.len() as f64 / KOKORO_SAMPLE_RATE as f64 * 1000.0) as u64;
            synth_log(&format!(
                "[S4] sentence[{}]: {} samples ({:.0}ms), min={:.4}, max={:.4}, mean={:.6}, NaN={}, Inf={}",
                idx, audio_data.len(), audio_duration_ms, audio_min, audio_max, audio_mean, nan_count, inf_count
            ));

            // Encode audio as base64 for IPC transport
            let audio_bytes: &[u8] = bytemuck_cast_f32_slice(&audio_data);
            let audio_base64 = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                audio_bytes,
            );

            synth_log(&format!(
                "[S5] sentence[{}]: base64_len={}, audio_bytes={}",
                idx, audio_base64.len(), audio_bytes.len()
            ));

            let is_last = idx == total_sentences - 1;

            // Emit audio chunk event to frontend
            let event = KokoroAudioChunkEvent {
                session_id: session_id.clone(),
                audio_base64,
                sample_rate: KOKORO_SAMPLE_RATE,
                is_last,
                sentence_index: idx,
                total_sentences,
            };

            app.emit("kokoro-tts-audio-chunk", &event).map_err(|e| {
                Error::PluginError(format!("Failed to emit audio chunk: {}", e))
            })?;
        }

        // Emit session end event
        if !cancel_token.is_cancelled() {
            synth_log(&format!("=== Synthesis Complete: {} sentences ===", total_sentences));
            let end_event = KokoroEndEvent {
                session_id: session_id.clone(),
            };
            app.emit("kokoro-tts-end", &end_event).map_err(|e| {
                Error::PluginError(format!("Failed to emit end event: {}", e))
            })?;
            log::info!(
                "[KokoroTTS] Session {} completed: {} sentences synthesized",
                session_id,
                total_sentences
            );
        }

        Ok(())
    }

    /// Run ONNX inference on a sequence of phoneme token IDs.
    ///
    /// Adds pad tokens (0) at the start and end of the sequence as required
    /// by the Kokoro model: [0, *token_ids, 0].
    ///
    /// Returns raw Float32 PCM audio samples at 24kHz.
    /// Acquires the session mutex for the duration of inference.
    async fn run_inference(
        &self,
        token_ids: &[i64],
        voice_idx: i64,
        speed: f32,
    ) -> Result<Vec<f32>> {
        // Add pad tokens: [0, *token_ids, 0]
        let mut padded = Vec::with_capacity(token_ids.len() + 2);
        padded.push(0); // pad start
        padded.extend_from_slice(token_ids);
        padded.push(0); // pad end
        let token_len = padded.len();

        // For very long sequences, split into chunks to prevent OOM
        if token_len > MAX_PHONEME_CHARS {
            return self.run_inference_chunked(&padded, voice_idx, speed).await;
        }

        // Build input tensors
        let tokens_array = Array2::from_shape_vec(
            (1, token_len),
            padded,
        )
        .map_err(|e| Error::InferenceError(format!("Failed to create token tensor: {}", e)))?;

        // Style vector: one-hot encoded voice selection
        let mut style_vec = vec![0.0f32; STYLE_VECTOR_DIM];
        let voice_idx_usize = (voice_idx as usize).min(STYLE_VECTOR_DIM - 1);
        style_vec[voice_idx_usize] = 1.0;
        let style_array = Array2::from_shape_vec((1, STYLE_VECTOR_DIM), style_vec)
            .map_err(|e| Error::InferenceError(format!("Failed to create style tensor: {}", e)))?;

        // Speed scalar
        let speed_array = Array1::from_vec(vec![speed]);

        // Build named input values matching model's expected inputs
        let inputs = self.build_inputs(tokens_array, style_array, speed_array).await?;

        // Acquire session lock and run inference
        // Session::run() requires &mut self in ort 2.x, so we use a blocking lock
        let audio_data = {
            let mut session = self.session.lock().await;
            let outputs: SessionOutputs = session
                .run(inputs)
                .map_err(|e| Error::InferenceError(format!("ONNX inference failed: {}", e)))?;
            extract_audio_output(&outputs)?
        };

        Ok(audio_data)
    }

    /// Run inference on long sequences by splitting into chunks.
    /// The input is expected to already include pad tokens.
    /// Each chunk runs inference directly (no recursion into run_inference).
    async fn run_inference_chunked(
        &self,
        padded_ids: &[i64],
        voice_idx: i64,
        speed: f32,
    ) -> Result<Vec<f32>> {
        let mut all_audio = Vec::new();
        let chunks = padded_ids.chunks(MAX_PHONEME_CHARS);

        for (chunk_idx, chunk) in chunks.enumerate() {
            log::debug!(
                "[KokoroTTS] Processing chunk {}/{} ({} tokens)",
                chunk_idx + 1,
                (padded_ids.len() + MAX_PHONEME_CHARS - 1) / MAX_PHONEME_CHARS,
                chunk.len()
            );

            // Build tensors for this chunk (inline to avoid async recursion)
            let tokens_array = Array2::from_shape_vec(
                (1, chunk.len()),
                chunk.to_vec(),
            )
            .map_err(|e| Error::InferenceError(format!("Failed to create token tensor: {}", e)))?;

            let mut style_vec = vec![0.0f32; STYLE_VECTOR_DIM];
            let voice_idx_usize = (voice_idx as usize).min(STYLE_VECTOR_DIM - 1);
            style_vec[voice_idx_usize] = 1.0;
            let style_array = Array2::from_shape_vec((1, STYLE_VECTOR_DIM), style_vec)
                .map_err(|e| Error::InferenceError(format!("Failed to create style tensor: {}", e)))?;

            let speed_array = Array1::from_vec(vec![speed]);
            let inputs = self.build_inputs(tokens_array, style_array, speed_array).await?;

            let chunk_audio = {
                let mut session = self.session.lock().await;
                let outputs: SessionOutputs = session
                    .run(inputs)
                    .map_err(|e| Error::InferenceError(format!("ONNX inference failed: {}", e)))?;
                extract_audio_output(&outputs)?
            };
            all_audio.extend_from_slice(&chunk_audio);
        }

        Ok(all_audio)
    }

    /// Build ONNX input Value array with proper input names.
    ///
    /// Inspects the model's input metadata to determine correct names and ordering.
    async fn build_inputs(
        &self,
        tokens: Array2<i64>,
        style: Array2<f32>,
        speed: Array1<f32>,
    ) -> Result<Vec<(String, DynValue)>> {
        let inputs_meta: Vec<String> = {
            let session = self.session.lock().await;
            session.inputs().iter().map(|m| m.name().to_string()).collect()
        };
        let mut input_values: Vec<(String, DynValue)> = Vec::new();

        for name in inputs_meta.iter() {
            let name_lower = name.to_lowercase();

            if name_lower.contains("token") || name_lower.contains("input_ids") || name_lower.contains("input") {
                let value: DynValue = ort::value::Value::from_array(tokens.clone())
                    .map_err(|e| Error::InferenceError(format!("Failed to create token value: {}", e)))?
                    .into();
                input_values.push((name.clone(), value));
            } else if name_lower.contains("style") || name_lower.contains("voice") {
                let value: DynValue = ort::value::Value::from_array(style.clone())
                    .map_err(|e| Error::InferenceError(format!("Failed to create style value: {}", e)))?
                    .into();
                input_values.push((name.clone(), value));
            } else if name_lower.contains("speed") || name_lower.contains("rate") {
                let value: DynValue = ort::value::Value::from_array(speed.clone())
                    .map_err(|e| Error::InferenceError(format!("Failed to create speed value: {}", e)))?
                    .into();
                input_values.push((name.clone(), value));
            } else {
                log::warn!("[KokoroTTS] Unknown model input: '{}', skipping", name);
            }
        }

        if input_values.is_empty() {
            return Err(Error::InferenceError(
                "No matching inputs found for the model. Check that the ONNX model has the expected input names (tokens/input_ids, style, speed).".to_string()
            ));
        }

        log::debug!(
            "[KokoroTTS] Built {} inputs: {:?}",
            input_values.len(),
            input_values.iter().map(|(n, _)| n).collect::<Vec<_>>()
        );

        Ok(input_values)
    }
}

/// Extract Float32 PCM audio data from the ONNX model outputs.
///
/// Handles various output tensor shapes:
/// - [N] or [1, N]: direct PCM samples
/// - [1, C, N] where C=1: squeeze channel dimension
/// - [1, C, N] where C>1: take first channel (mono)
fn extract_audio_output(outputs: &SessionOutputs) -> Result<Vec<f32>> {
    // Try common output names
    let output_names = ["audio", "output", "waveform", "output_0", "0"];

    for name in &output_names {
        if let Some(val) = outputs.get(*name) {
            return extract_f32_from_dyn_value(val);
        }
    }

    // Fallback: try the first output by index
    if let Some((first_name, _)) = outputs.iter().next() {
        if let Some(val) = outputs.get(first_name) {
            return extract_f32_from_dyn_value(val);
        }
    }

    Err(Error::InferenceError(
        "No output tensor found in model results".to_string(),
    ))
}

/// Extract f32 PCM samples from a DynValue tensor.
fn extract_f32_from_dyn_value(val: &DynValue) -> Result<Vec<f32>> {
    // try_extract_tensor returns (&Shape, &[f32]) tuple
    let (shape, data_slice) = val
        .try_extract_tensor::<f32>()
        .map_err(|e| Error::InferenceError(format!("Failed to extract f32 tensor: {}", e)))?;

    let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();

    match dims.len() {
        1 | 2 => {
            // [N] or [1, N] — direct PCM samples
            Ok(data_slice.to_vec())
        }
        3 => {
            // [1, channels, samples]
            let channels = dims[1];
            let samples_per_channel = dims[2];
            if channels <= 1 {
                Ok(data_slice.to_vec())
            } else {
                // Take first channel from interleaved data
                let mono: Vec<f32> = data_slice
                    .chunks(channels * samples_per_channel)
                    .flat_map(|batch: &[f32]| {
                        batch
                            .iter()
                            .enumerate()
                            .filter(|(i, _)| i % channels == 0)
                            .map(|(_, &v)| v)
                    })
                    .collect();
                Ok(mono)
            }
        }
        _ => {
            log::warn!(
                "[KokoroTTS] Unexpected output shape {:?}, flattening to 1D",
                dims
            );
            Ok(data_slice.to_vec())
        }
    }
}

/// Cast a Float32 slice to raw bytes for base64 encoding.
fn bytemuck_cast_f32_slice(data: &[f32]) -> &[u8] {
    unsafe {
        std::slice::from_raw_parts(
            data.as_ptr() as *const u8,
            data.len() * std::mem::size_of::<f32>(),
        )
    }
}
