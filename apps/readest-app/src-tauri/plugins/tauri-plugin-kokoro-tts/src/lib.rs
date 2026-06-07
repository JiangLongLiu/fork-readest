use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};
use tokio_util::sync::CancellationToken;

pub use models::*;

mod commands;
mod error;
pub mod kokoro_engine;
mod models;
pub mod text_processing;

pub use error::{Error, Result};

// ============================================================================
// Plugin State
// ============================================================================

/// Shared state for the Kokoro TTS plugin.
///
/// Managed by Tauri's state system and accessible from all commands.
/// Uses `parking_lot` locks for better performance under contention.
pub struct KokoroState {
    /// The ONNX inference engine (initialized on first `init` call).
    /// Wrapped in Arc for sharing with background tasks.
    pub engine: RwLock<Option<Arc<kokoro_engine::KokoroEngine>>>,

    /// Cancellation token for the current synthesis session.
    /// `None` when no session is active.
    pub cancel_token: Mutex<Option<CancellationToken>>,

    /// Default speech rate (overridable per-call).
    pub default_rate: Mutex<f32>,

    /// Default voice index (overridable per-call).
    pub default_voice: Mutex<i64>,
}

// ============================================================================
// Extension Trait
// ============================================================================

/// Extension trait for accessing Kokoro TTS state from Tauri managers.
pub trait KokoroTtsExt<R: Runtime> {
    fn kokoro_tts(&self) -> &KokoroState;
}

impl<R: Runtime, T: Manager<R>> KokoroTtsExt<R> for T {
    fn kokoro_tts(&self) -> &KokoroState {
        self.state::<KokoroState>().inner()
    }
}

// ============================================================================
// Plugin Initialization
// ============================================================================

/// Initializes the Kokoro TTS plugin.
///
/// Registers the following Tauri commands:
/// - `plugin:kokoro-tts|init` — Load the ONNX model
/// - `plugin:kokoro-tts|start` — Start streaming synthesis
/// - `plugin:kokoro-tts|stop` — Cancel active synthesis
/// - `plugin:kokoro-tts|set_rate` — Set speech rate
/// - `plugin:kokoro-tts|set_voice` — Set voice
/// - `plugin:kokoro-tts|get_voices` — List available voices
///
/// Registers the following Tauri events (emitted to frontend):
/// - `kokoro-tts-audio-chunk` — PCM audio data chunk
/// - `kokoro-tts-end` — Synthesis session completed
/// - `kokoro-tts-error` — Error during synthesis
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("kokoro-tts")
        .invoke_handler(tauri::generate_handler![
            commands::init,
            commands::start,
            commands::stop,
            commands::set_rate,
            commands::set_voice,
            commands::get_voices,
        ])
        .setup(|app, _api| {
            let state = KokoroState {
                engine: RwLock::new(None),
                cancel_token: Mutex::new(None),
                default_rate: Mutex::new(1.0),
                default_voice: Mutex::new(0),
            };
            app.manage(state);
            log::info!("[KokoroTTS] Plugin registered");
            Ok(())
        })
        .build()
}
