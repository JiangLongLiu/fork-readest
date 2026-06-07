use std::sync::Arc;

use tauri::{command, AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_fs::FsExt;
use tokio_util::sync::CancellationToken;

use crate::error::{Error, Result};
use crate::models::*;
use crate::KokoroState;

/// Initialize the Kokoro TTS engine.
///
/// Loads the ONNX model and token vocabulary from the app's resources directory.
/// Must be called before any synthesis commands.
#[command]
pub(crate) async fn init<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, KokoroState>,
) -> Result<KokoroInitResponse> {
    // Check if already initialized
    {
        let engine_guard = state.engine.read();
        if engine_guard.is_some() {
            let voice_count = engine_guard.as_ref().unwrap().get_voices().len();
            return Ok(KokoroInitResponse {
                success: true,
                message: Some("Engine already initialized".to_string()),
                voice_count,
            });
        }
    }

    // Determine resource directory
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| Error::ModelLoadError(format!("Failed to get resource directory: {}", e)))?;

    // Determine writable app data directory for espeak-ng data extraction
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| Error::ModelLoadError(format!("Failed to get app data directory: {}", e)))?;

    // Allow overriding model path via env var for development.
    // When using Tauri's resource_dir, model files are in the "kokoro-tts" subdirectory
    // (as configured in tauri.conf.json bundle.resources).
    let model_dir = std::env::var("KOKORO_MODEL_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| resource_dir.join("kokoro-tts"));

    let model_path = model_dir.join("kokoro-v0_19.onnx");
    let tokens_path = model_dir.join("tokens.txt");

    log::info!(
        "[KokoroTTS] Initializing engine with model dir: {:?}, data dir: {:?}",
        model_dir,
        app_data_dir
    );

    // Read model and tokens via Tauri FsExt.
    // On desktop, this uses standard filesystem.
    // On Android, resource_dir returns "asset://localhost/..." and FsExt
    // transparently reads from the APK assets.
    let model_bytes = app.fs().read(&model_path).map_err(|e| {
        Error::ModelLoadError(format!(
            "Failed to read model file {:?}: {}. \
             Ensure kokoro-v0_19.onnx is in the resources directory.",
            model_path, e
        ))
    })?;

    let tokens_bytes = app.fs().read(&tokens_path).map_err(|e| {
        Error::TokensLoadError(format!(
            "Failed to read tokens file {:?}: {}. \
             Ensure tokens.txt is in the resources directory.",
            tokens_path, e
        ))
    })?;

    log::info!(
        "[KokoroTTS] Read model ({} bytes) and tokens ({} bytes)",
        model_bytes.len(),
        tokens_bytes.len()
    );

    match crate::kokoro_engine::KokoroEngine::new(model_bytes, tokens_bytes, app_data_dir) {
        Ok(engine) => {
            let voice_count = engine.get_voices().len();
            let mut engine_guard = state.engine.write();
            *engine_guard = Some(Arc::new(engine));
            Ok(KokoroInitResponse {
                success: true,
                message: Some("Kokoro TTS engine initialized successfully".to_string()),
                voice_count,
            })
        }
        Err(e) => {
            log::error!("[KokoroTTS] Failed to initialize engine: {}", e);
            Ok(KokoroInitResponse {
                success: false,
                message: Some(format!("Initialization failed: {}", e)),
                voice_count: 0,
            })
        }
    }
}

/// Start a streaming TTS synthesis session.
///
/// The synthesis runs in a background task. Audio chunks are emitted
/// as Tauri events (`kokoro-tts-audio-chunk`) to the frontend.
///
/// Returns immediately with a session ID. Use `stop` to cancel.
#[command]
pub(crate) async fn start<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, KokoroState>,
    args: KokoroStartArgs,
) -> Result<KokoroStartResponse> {
    // Get engine reference
    let engine = {
        let engine_guard = state.engine.read();
        engine_guard
            .as_ref()
            .ok_or(Error::NotInitialized)?
            .clone()
    };

    // Check if there's already a running session
    {
        let mut cancel_guard = state.cancel_token.lock();
        if let Some(existing_token) = cancel_guard.take() {
            log::info!("[KokoroTTS] Cancelling previous session");
            existing_token.cancel();
        }
    }

    // Generate session ID
    let session_id = args.session_id.unwrap_or_else(|| {
        format!(
            "kokoro-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        )
    });

    // Create cancellation token
    let cancel_token = CancellationToken::new();
    {
        let mut cancel_guard = state.cancel_token.lock();
        *cancel_guard = Some(cancel_token.clone());
    }

    let session_id_clone = session_id.clone();

    // Read default rate/voice from state (can be overridden by args in future)
    let default_rate = { *state.default_rate.lock() };
    let default_voice = { *state.default_voice.lock() };

    let voice_id = if args.voice_id >= 0 {
        Some(args.voice_id)
    } else {
        Some(default_voice)
    };
    let speed = if args.speed > 0.0 {
        Some(args.speed)
    } else {
        Some(default_rate)
    };

    // Spawn background synthesis task
    // IMPORTANT: This task runs on the Tokio runtime, NOT on the Tauri main thread.
    // The UI remains responsive during synthesis.
    let app_for_error = app.clone();
    tokio::spawn(async move {
        let result = engine
            .synthesize(
                app,
                session_id_clone.clone(),
                args.text,
                voice_id,
                speed,
                cancel_token,
            )
            .await;

        if let Err(e) = result {
            log::error!(
                "[KokoroTTS] Session {} failed: {}",
                session_id_clone,
                e
            );
            // Emit error event so the frontend is notified immediately
            let error_event = KokoroErrorEvent {
                session_id: session_id_clone.clone(),
                error: e.to_string(),
            };
            let _ = app_for_error.emit("kokoro-tts-error", &error_event);
        }
    });

    Ok(KokoroStartResponse { session_id })
}

/// Stop an active TTS synthesis session.
///
/// Signals the background task to cancel via the cancellation token.
/// The task will stop after the current sentence completes.
#[command]
pub(crate) async fn stop<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, KokoroState>,
    args: KokoroStopArgs,
) -> Result<()> {
    let _ = args; // session_id filtering reserved for future multi-session support

    let mut cancel_guard = state.cancel_token.lock();
    if let Some(token) = cancel_guard.take() {
        log::info!("[KokoroTTS] Stopping active session");
        token.cancel();
    } else {
        log::debug!("[KokoroTTS] No active session to stop");
    }

    Ok(())
}

/// Set the default speech rate for future synthesis calls.
#[command]
pub(crate) async fn set_rate<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, KokoroState>,
    args: KokoroSetRateArgs,
) -> Result<()> {
    // Verify engine is initialized
    {
        let engine_guard = state.engine.read();
        if engine_guard.is_none() {
            return Err(Error::NotInitialized);
        }
    }

    let clamped_rate = args.rate.clamp(0.5, 3.0);
    let mut rate_guard = state.default_rate.lock();
    *rate_guard = clamped_rate;
    log::info!("[KokoroTTS] Default rate set to {} (requested: {})", clamped_rate, args.rate);
    Ok(())
}

/// Set the default voice for future synthesis calls.
#[command]
pub(crate) async fn set_voice<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, KokoroState>,
    args: KokoroSetVoiceArgs,
) -> Result<()> {
    // Verify engine is initialized
    {
        let engine_guard = state.engine.read();
        if engine_guard.is_none() {
            return Err(Error::NotInitialized);
        }
    }

    let mut voice_guard = state.default_voice.lock();
    *voice_guard = args.voice_id;
    log::info!("[KokoroTTS] Default voice set to {}", args.voice_id);
    Ok(())
}

/// Get the list of available Kokoro voices.
#[command]
pub(crate) async fn get_voices<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, KokoroState>,
) -> Result<KokoroGetVoicesResponse> {
    let engine_guard = state.engine.read();
    if let Some(engine) = engine_guard.as_ref() {
        Ok(KokoroGetVoicesResponse {
            voices: engine.get_voices(),
        })
    } else {
        // Return built-in voices even if engine is not yet initialized
        let voices = KOKORO_EN_VOICES_STATIC
            .iter()
            .map(|(id, name, index)| KokoroVoice {
                id: id.to_string(),
                name: name.to_string(),
                lang: "en".to_string(),
                index: *index,
            })
            .collect();
        Ok(KokoroGetVoicesResponse { voices })
    }
}

/// Static voice list for when engine is not yet initialized
const KOKORO_EN_VOICES_STATIC: &[(&str, &str, i64)] = &[
    ("af_bella", "Bella (Female, American)", 0),
    ("af_nicole", "Nicole (Female, American)", 1),
    ("af_sarah", "Sarah (Female, American)", 2),
    ("af_sky", "Sky (Female, American)", 3),
    ("am_adam", "Adam (Male, American)", 4),
    ("am_michael", "Michael (Male, American)", 5),
    ("bf_emma", "Emma (Female, British)", 6),
    ("bf_isabella", "Isabella (Female, British)", 7),
    ("bm_george", "George (Male, British)", 8),
    ("bm_lewis", "Lewis (Male, British)", 9),
];
