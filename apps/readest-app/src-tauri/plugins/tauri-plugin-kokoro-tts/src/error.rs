use serde::{ser::Serializer, Serialize};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Kokoro TTS engine is not initialized")]
    NotInitialized,

    #[error("Failed to load ONNX model: {0}")]
    ModelLoadError(String),

    #[error("Failed to load tokens file: {0}")]
    TokensLoadError(String),

    #[error("ONNX inference error: {0}")]
    InferenceError(String),

    #[error("Text processing error: {0}")]
    TextProcessingError(String),

    #[error("Session already running, stop it first")]
    SessionAlreadyRunning,

    #[error("Plugin error: {0}")]
    PluginError(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[cfg(mobile)]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
