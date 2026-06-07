use serde::{Deserialize, Serialize};

// ============================================================================
// Command Request / Response Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroInitResponse {
    pub success: bool,
    pub message: Option<String>,
    /// Number of voices loaded
    pub voice_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroStartArgs {
    /// The text to synthesize. Will be split into sentences for streaming.
    pub text: String,
    /// Voice ID / style index (maps to a row in the style tensor).
    /// Default: -1 (use engine default, typically voice 0 = af_bella)
    #[serde(default = "default_voice_id")]
    pub voice_id: i64,
    /// Speed multiplier. 1.0 = normal. Range: [0.5, 3.0]
    /// Default: -1.0 (use engine default rate)
    #[serde(default = "default_speed")]
    pub speed: f32,
    /// Optional session ID for tracking. Auto-generated if not provided.
    #[serde(default)]
    pub session_id: Option<String>,
}

fn default_speed() -> f32 {
    -1.0
}

fn default_voice_id() -> i64 {
    -1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroStartResponse {
    /// The session ID for this synthesis run
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroStopArgs {
    /// Session ID to stop. If None, stops all active sessions.
    #[serde(default)]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroSetRateArgs {
    pub rate: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroSetVoiceArgs {
    pub voice_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroVoice {
    pub id: String,
    pub name: String,
    pub lang: String,
    pub index: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroGetVoicesResponse {
    pub voices: Vec<KokoroVoice>,
}

// ============================================================================
// Tauri Event Payload (emitted from Rust to frontend)
// ============================================================================

/// Payload for the `kokoro-tts-audio-chunk` event.
/// Each chunk contains base64-encoded Float32 PCM data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroAudioChunkEvent {
    /// Unique session identifier
    pub session_id: String,
    /// Base64-encoded Float32 PCM audio data (little-endian)
    pub audio_base64: String,
    /// Sample rate in Hz (typically 24000)
    pub sample_rate: u32,
    /// Whether this is the final chunk in the session
    pub is_last: bool,
    /// Current sentence index being synthesized
    pub sentence_index: usize,
    /// Total number of sentences in the input text
    pub total_sentences: usize,
}

/// Payload for the `kokoro-tts-error` event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroErrorEvent {
    pub session_id: String,
    pub error: String,
}

/// Payload for the `kokoro-tts-end` event (session completed successfully).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KokoroEndEvent {
    pub session_id: String,
}
