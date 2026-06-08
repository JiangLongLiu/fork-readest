use std::sync::Arc;

use tauri::{command, AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_fs::FsExt;
use tokio_util::sync::CancellationToken;

use crate::error::{Error, Result};
use crate::models::*;
use crate::KokoroState;

// ============================================================================
// Diagnostic Logging (Android only)
// ============================================================================

#[cfg(target_os = "android")]
const DIAG_LOG_PATH: &str = "/storage/emulated/0/Download/kokoro-tts-init.log";

#[cfg(target_os = "android")]
fn diag_log(msg: &str) {
    use std::fs::OpenOptions;
    use std::io::Write;
    log::info!("[KokoroTTS-DIAG] {}", msg);
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(DIAG_LOG_PATH)
    {
        let _ = writeln!(f, "{}", msg);
    }
}

#[cfg(not(target_os = "android"))]
fn diag_log(msg: &str) {
    log::info!("[KokoroTTS-DIAG] {}", msg);
}

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

    diag_log("=== Kokoro TTS Init Starting ===");

    // Determine resource directory
    let resource_dir = match app.path().resource_dir() {
        Ok(dir) => {
            diag_log(&format!("[1] resource_dir = {:?}", dir));
            dir
        }
        Err(e) => {
            let msg = format!("[1] FAILED to get resource_dir: {}", e);
            diag_log(&msg);
            return Err(Error::ModelLoadError(msg));
        }
    };

    // Determine writable app data directory for espeak-ng data extraction
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => {
            diag_log(&format!("[2] app_data_dir = {:?}", dir));
            dir
        }
        Err(e) => {
            let msg = format!("[2] FAILED to get app_data_dir: {}", e);
            diag_log(&msg);
            return Err(Error::ModelLoadError(msg));
        }
    };

    // Allow overriding model path via env var for development.
    let model_dir = std::env::var("KOKORO_MODEL_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| resource_dir.join("kokoro-tts"));

    let model_path = model_dir.join("kokoro-v0_19.onnx");
    let tokens_path = model_dir.join("tokens.txt");

    diag_log(&format!("[3] model_dir = {:?}", model_dir));
    diag_log(&format!("[3] model_path = {:?}", model_path));
    diag_log(&format!("[3] tokens_path = {:?}", tokens_path));
    diag_log(&format!("[3] model_path display = {}", model_path.display()));

    // Log OS info
    diag_log(&format!("[3] OS = {}", std::env::consts::OS));

    // ---- Read model with multiple fallback strategies ----

    diag_log("[4] Attempting to read model file...");

    let model_bytes = match read_with_fallbacks(&app, &model_path, "model") {
        Ok(bytes) => bytes,
        Err(e) => {
            let msg = format!("[4] ALL read strategies failed for model: {}", e);
            diag_log(&msg);
            return Err(Error::ModelLoadError(msg));
        }
    };
    diag_log(&format!(
        "[4] Model read OK: {} bytes ({:.1} MB)",
        model_bytes.len(),
        model_bytes.len() as f64 / 1048576.0
    ));

    // ---- Read tokens with multiple fallback strategies ----

    diag_log("[5] Attempting to read tokens file...");

    let tokens_bytes = match read_with_fallbacks(&app, &tokens_path, "tokens") {
        Ok(bytes) => bytes,
        Err(e) => {
            let msg = format!("[5] ALL read strategies failed for tokens: {}", e);
            diag_log(&msg);
            return Err(Error::TokensLoadError(msg));
        }
    };
    diag_log(&format!(
        "[5] Tokens read OK: {} bytes",
        tokens_bytes.len()
    ));

    // ---- Create engine ----

    diag_log("[6] Creating KokoroEngine...");

    match crate::kokoro_engine::KokoroEngine::new(model_bytes, tokens_bytes, app_data_dir) {
        Ok(engine) => {
            let voice_count = engine.get_voices().len();
            diag_log(&format!(
                "[6] KokoroEngine created OK: {} voices",
                voice_count
            ));
            let mut engine_guard = state.engine.write();
            *engine_guard = Some(Arc::new(engine));
            diag_log("=== Kokoro TTS Init SUCCESS ===");
            Ok(KokoroInitResponse {
                success: true,
                message: Some("Kokoro TTS engine initialized successfully".to_string()),
                voice_count,
            })
        }
        Err(e) => {
            let msg = format!("[6] FAILED to create KokoroEngine: {}", e);
            diag_log(&msg);
            diag_log("=== Kokoro TTS Init FAILED ===");
            Ok(KokoroInitResponse {
                success: false,
                message: Some(format!("Initialization failed: {}", e)),
                voice_count: 0,
            })
        }
    }
}

/// Try multiple strategies to read a file, logging each attempt.
fn read_with_fallbacks<R: Runtime>(
    app: &AppHandle<R>,
    path: &std::path::Path,
    label: &str,
) -> std::result::Result<Vec<u8>, String> {
    // Strategy A: app.fs().read() (FsExt — handles asset:// on Android in theory)
    diag_log(&format!(
        "[{}] Strategy A: app.fs().read({:?})",
        label, path
    ));
    match app.fs().read(path) {
        Ok(bytes) => {
            diag_log(&format!(
                "[{}] Strategy A OK: {} bytes",
                label,
                bytes.len()
            ));
            return Ok(bytes);
        }
        Err(e) => {
            diag_log(&format!("[{}] Strategy A FAILED: {}", label, e));
        }
    }

    // Strategy B: std::fs::read() with the path as-is
    diag_log(&format!(
        "[{}] Strategy B: std::fs::read({:?})",
        label, path
    ));
    match std::fs::read(path) {
        Ok(bytes) => {
            diag_log(&format!(
                "[{}] Strategy B OK: {} bytes",
                label,
                bytes.len()
            ));
            return Ok(bytes);
        }
        Err(e) => {
            diag_log(&format!("[{}] Strategy B FAILED: {}", label, e));
        }
    }

    // Strategy C: Strip asset:// prefix and try std::fs::read
    let path_str = path.to_string_lossy();
    if path_str.starts_with("asset://") {
        let stripped = path_str
            .trim_start_matches("asset://localhost/")
            .trim_start_matches("asset://");
        let stripped_path = std::path::PathBuf::from(stripped);
        diag_log(&format!(
            "[{}] Strategy C: std::fs::read(stripped={:?})",
            label, stripped_path
        ));
        match std::fs::read(&stripped_path) {
            Ok(bytes) => {
                diag_log(&format!(
                    "[{}] Strategy C OK: {} bytes",
                    label,
                    bytes.len()
                ));
                return Ok(bytes);
            }
            Err(e) => {
                diag_log(&format!("[{}] Strategy C FAILED: {}", label, e));
            }
        }
    } else {
        diag_log(&format!(
            "[{}] Strategy C SKIPPED: path does not start with asset://",
            label
        ));
    }

    // Strategy D: Try listing the parent directory to see what's there
    if let Some(parent) = path.parent() {
        diag_log(&format!(
            "[{}] Strategy D: listing parent dir {:?}",
            label, parent
        ));
        match std::fs::read_dir(parent) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(e) => {
                            let meta = e.metadata().ok();
                            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                            diag_log(&format!(
                                "[{}]   -> {:?} ({} bytes)",
                                label,
                                e.file_name(),
                                size
                            ));
                        }
                        Err(e) => diag_log(&format!("[{}]   -> err: {}", label, e)),
                    }
                }
            }
            Err(e) => {
                diag_log(&format!(
                    "[{}] Strategy D FAILED to list {:?}: {}",
                    label, parent, e
                ));
            }
        }
    }

    Err(format!(
        "Could not read {} from {:?} (tried FsExt, std::fs, asset-strip)",
        label, path
    ))
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
#[command]
pub(crate) async fn stop<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, KokoroState>,
    args: KokoroStopArgs,
) -> Result<()> {
    let _ = args;

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
    {
        let engine_guard = state.engine.read();
        if engine_guard.is_none() {
            return Err(Error::NotInitialized);
        }
    }

    let voice_id = args.voice_id;
    let max_voice = crate::kokoro_engine::KOKORO_VOICES.len() as i64 - 1;
    if voice_id < 0 || voice_id > max_voice {
        return Err(Error::InvalidVoice(format!(
            "voice_id {} out of range [0, {}]", voice_id, max_voice
        )));
    }

    let mut voice_guard = state.default_voice.lock();
    *voice_guard = voice_id;
    log::info!("[KokoroTTS] Default voice set to {}", voice_id);
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
        let voices: Vec<KokoroVoice> = crate::kokoro_engine::KOKORO_VOICES
            .iter()
            .map(|(id, name, lang, index)| KokoroVoice {
                id: id.to_string(),
                name: name.to_string(),
                lang: lang.to_string(),
                index: *index,
            })
            .collect();
        Ok(KokoroGetVoicesResponse { voices })
    }
}
