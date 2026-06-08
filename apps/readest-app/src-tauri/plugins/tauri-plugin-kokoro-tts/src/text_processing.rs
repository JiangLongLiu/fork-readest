use regex::Regex;
use unicode_segmentation::UnicodeSegmentation;

// ============================================================================
// Sentence Splitting
// ============================================================================

/// Split text into sentences using Unicode-aware heuristics.
///
/// Handles common patterns in English, Chinese, Japanese, and Korean:
/// - ASCII sentence endings: `.`, `!`, `?` followed by whitespace or end-of-string
/// - CJK sentence endings: `。`, `！`, `？`
/// - Ellipsis: `...`, `……`
/// - Preserves the sentence-ending punctuation for natural TTS prosody
pub fn split_sentences(text: &str) -> Vec<String> {
    if text.trim().is_empty() {
        return vec![];
    }

    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut sentences: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut i = 0;

    while i < len {
        let ch = chars[i];

        if ch == '\n' {
            // Newline: end the current sentence (newline itself is discarded)
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current.clear();
            i += 1;
        } else if ch == '。' || ch == '！' || ch == '？' {
            // CJK sentence-ending punctuation: include it, then split
            current.push(ch);
            sentences.push(current.trim().to_string());
            current.clear();
            i += 1;
        } else if ch == '.' || ch == '!' || ch == '?' {
            // Check for ellipsis patterns: "..." (three or more ASCII dots)
            if ch == '.' && i + 2 < len && chars[i + 1] == '.' && chars[i + 2] == '.' {
                // Consume all consecutive dots as part of the current sentence
                current.push('.');
                i += 1;
                while i < len && chars[i] == '.' {
                    current.push('.');
                    i += 1;
                }
                // Ellipsis ends the sentence
                sentences.push(current.trim().to_string());
                current.clear();
            } else if i + 1 < len && chars[i + 1].is_whitespace() && chars[i + 1] != '\n' {
                // ASCII sentence-ending punctuation followed by whitespace (but not newline)
                current.push(ch);
                sentences.push(current.trim().to_string());
                current.clear();
                i += 1;
                // Skip the whitespace character(s) after the punctuation
                while i < len && chars[i].is_whitespace() && chars[i] != '\n' {
                    i += 1;
                }
            } else {
                // Not a sentence boundary (e.g., abbreviation at end of text, or before newline)
                current.push(ch);
                i += 1;
            }
        } else if ch == '…' && i + 1 < len && chars[i + 1] == '…' {
            // CJK ellipsis "……" (consume both and any further '…')
            current.push('…');
            current.push('…');
            i += 2;
            while i < len && chars[i] == '…' {
                current.push('…');
                i += 1;
            }
            sentences.push(current.trim().to_string());
            current.clear();
        } else {
            current.push(ch);
            i += 1;
        }
    }

    // Flush any remaining text as the final sentence
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }

    // Merge very short fragments (< 3 graphemes) with the previous sentence
    let mut merged: Vec<String> = Vec::new();
    for sentence in sentences {
        let grapheme_count = sentence.graphemes(true).count();
        if grapheme_count < 3 && !merged.is_empty() {
            let last = merged.last_mut().unwrap();
            last.push(' ');
            last.push_str(&sentence);
        } else {
            merged.push(sentence);
        }
    }

    if merged.is_empty() {
        vec![text.trim().to_string()]
    } else {
        merged
    }
}

// ============================================================================
// Text Normalization
// ============================================================================

/// Normalize text for TTS synthesis.
///
/// - Collapse multiple whitespace into single spaces
/// - Remove control characters (except newline and tab)
/// - Normalize Unicode dashes to commas
/// - Expand ellipsis
/// - Strip markdown formatting (bold, italic, code)
pub fn normalize_text(text: &str) -> String {
    let mut result = text.to_string();

    result = result
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
        .collect();

    let md_re = Regex::new(r"\*{1,3}([^*]+)\*{1,3}").unwrap();
    result = md_re.replace_all(&result, "$1").to_string();

    let code_re = Regex::new(r"`([^`]+)`").unwrap();
    result = code_re.replace_all(&result, "$1").to_string();

    let dash_re = Regex::new(r"[–—―]").unwrap();
    result = dash_re.replace_all(&result, ",").to_string();

    let ellipsis_re = Regex::new(r"\.{3,}|……+").unwrap();
    result = ellipsis_re.replace_all(&result, ", ").to_string();

    let ws_re = Regex::new(r"\s+").unwrap();
    result = ws_re.replace_all(&result, " ").to_string();

    result.trim().to_string()
}

// ============================================================================
// Phonemizer — espeak-ng (pure Rust) with CJK fallback
// ============================================================================

use std::sync::OnceLock;
use parking_lot::Mutex;

/// Global espeak-ng engine instance (English).
/// Wrapped in Option<Mutex<...>>: None if espeak-ng initialization failed (CJK-only fallback).
static ESPEAK_ENGINE: OnceLock<Option<Mutex<espeak_ng::EspeakNg>>> = OnceLock::new();

/// Global espeak-ng engine instance (Mandarin Chinese / cmn).
/// Used for CJK text phonemization instead of the char-level fallback.
static ESPEAK_CMN_ENGINE: OnceLock<Option<Mutex<espeak_ng::EspeakNg>>> = OnceLock::new();

/// Configurable data directory for espeak-ng (set during engine init).
/// Falls back to CARGO_MANIFEST_DIR/espeak-ng-data if not set (dev/test mode).
static ESPEAK_DATA_DIR_OVERRIDE: OnceLock<std::path::PathBuf> = OnceLock::new();
static ESPEAK_DATA_DIR: OnceLock<std::path::PathBuf> = OnceLock::new();

/// Set the directory where espeak-ng bundled data will be extracted.
/// Must be called before any phonemization (typically from KokoroEngine::new).
/// The directory must be writable at runtime.
pub fn set_espeak_data_dir(dir: std::path::PathBuf) {
    let _ = ESPEAK_DATA_DIR_OVERRIDE.set(dir);
}

/// Check if espeak-ng engine is available (without triggering initialization).
/// Returns true if previously initialized successfully, false otherwise.
pub fn is_espeak_available() -> bool {
    match ESPEAK_ENGINE.get() {
        Some(Some(_)) => true,
        Some(None) => false,
        None => {
            // Not yet initialized — trigger init to check
            get_espeak_engine().is_some()
        }
    }
}

/// Extract bundled espeak-ng data to a writable directory (once).
/// Returns the path to the data directory.
fn ensure_espeak_data() -> &'static std::path::PathBuf {
    ESPEAK_DATA_DIR.get_or_init(|| {
        // Use configured path (runtime app data), or fall back to CARGO_MANIFEST_DIR (dev/test)
        let data_dir = if let Some(configured) = ESPEAK_DATA_DIR_OVERRIDE.get() {
            configured.clone()
        } else {
            log::warn!(
                "[KokoroTTS] espeak data dir not configured, falling back to CARGO_MANIFEST_DIR"
            );
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("espeak-ng-data")
        };

        // Only extract if not already present
        if !data_dir.join("en_dict").exists() {
            log::info!(
                "[KokoroTTS-DIAG] Extracting bundled espeak-ng data to {:?}",
                data_dir
            );
            // Ensure parent directory exists
            if let Some(parent) = data_dir.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            match espeak_ng::install_bundled_language(&data_dir, "en") {
                Ok(_) => {
                    log::info!("[KokoroTTS-DIAG] espeak-ng 'en' data extraction OK");
                    // Verify extraction
                    if let Ok(entries) = std::fs::read_dir(&data_dir) {
                        let count = entries.count();
                        log::info!("[KokoroTTS-DIAG] espeak data dir has {} entries after 'en' extraction", count);
                    }
                }
                Err(e) => {
                    log::error!("[KokoroTTS-DIAG] espeak-ng 'en' data extraction FAILED: {:?}", e);
                }
            }
        } else {
            log::debug!("[KokoroTTS] espeak-ng 'en' data already present at {:?}", data_dir);
        }

        // Also extract Mandarin Chinese (cmn) data
        if !data_dir.join("cmn_dict").exists() {
            log::info!(
                "[KokoroTTS-DIAG] Extracting bundled espeak-ng 'cmn' data to {:?}",
                data_dir
            );
            match espeak_ng::install_bundled_language(&data_dir, "cmn") {
                Ok(_) => {
                    log::info!("[KokoroTTS-DIAG] espeak-ng 'cmn' data extraction OK");
                    if let Ok(entries) = std::fs::read_dir(&data_dir) {
                        let files: Vec<String> = entries
                            .filter_map(|e| e.ok())
                            .map(|e| format!("{}", e.file_name().to_string_lossy()))
                            .collect();
                        log::info!("[KokoroTTS-DIAG] espeak data files after cmn extraction: {:?}", files);
                    }
                }
                Err(e) => {
                    log::error!("[KokoroTTS-DIAG] espeak-ng 'cmn' data extraction FAILED: {:?}", e);
                }
            }
        } else {
            log::debug!("[KokoroTTS] espeak-ng 'cmn' data already present at {:?}", data_dir);
        }

        data_dir
    })
}

/// Get or initialize the global espeak-ng engine.
/// Returns None if espeak-ng could not be initialized (CJK text will use fallback).
fn get_espeak_engine() -> Option<&'static Mutex<espeak_ng::EspeakNg>> {
    ESPEAK_ENGINE.get_or_init(|| {
        // First, ensure bundled data is extracted
        let data_dir = ensure_espeak_data();

        log::info!("[KokoroTTS-DIAG] espeak data dir: {:?}", data_dir);
        log::info!("[KokoroTTS-DIAG] en_dict exists: {}", data_dir.join("en_dict").exists());

        // List files in espeak data dir
        if let Ok(entries) = std::fs::read_dir(data_dir) {
            let files: Vec<String> = entries
                .filter_map(|e| e.ok())
                .map(|e| format!("{}({}B)", e.file_name().to_string_lossy(),
                    e.metadata().map(|m| m.len()).unwrap_or(0)))
                .collect();
            log::info!("[KokoroTTS-DIAG] espeak data files: {:?}", files);
        }

        match espeak_ng::EspeakNg::with_data_dir("en", data_dir) {
            Ok(engine) => {
                log::info!("[KokoroTTS-DIAG] espeak-ng init OK");
                Some(Mutex::new(engine))
            }
            Err(e) => {
                log::error!("[KokoroTTS-DIAG] espeak-ng init FAILED: {:?}", e);
                match espeak_ng::EspeakNg::new("en") {
                    Ok(engine) => {
                        log::info!("[KokoroTTS-DIAG] espeak-ng fallback OK");
                        Some(Mutex::new(engine))
                    }
                    Err(e2) => {
                        log::error!("[KokoroTTS-DIAG] espeak-ng fallback FAILED: {:?}", e2);
                        None
                    }
                }
            }
        }
    }).as_ref()
}

/// Check if espeak-ng cmn (Chinese) engine is available (without triggering initialization).
pub fn is_espeak_cmn_available() -> bool {
    match ESPEAK_CMN_ENGINE.get() {
        Some(Some(_)) => true,
        Some(None) => false,
        None => {
            get_espeak_cmn_engine().is_some()
        }
    }
}

/// Get or initialize the global espeak-ng engine for Mandarin Chinese.
/// Returns None if the cmn engine could not be initialized.
fn get_espeak_cmn_engine() -> Option<&'static Mutex<espeak_ng::EspeakNg>> {
    ESPEAK_CMN_ENGINE.get_or_init(|| {
        let data_dir = ensure_espeak_data();

        log::info!("[KokoroTTS-DIAG] Initializing espeak-ng cmn engine, data_dir={:?}", data_dir);
        log::info!("[KokoroTTS-DIAG] cmn_dict exists: {}", data_dir.join("cmn_dict").exists());

        match espeak_ng::EspeakNg::with_data_dir("cmn", data_dir) {
            Ok(engine) => {
                log::info!("[KokoroTTS-DIAG] espeak-ng cmn init OK");
                Some(Mutex::new(engine))
            }
            Err(e) => {
                log::error!("[KokoroTTS-DIAG] espeak-ng cmn init FAILED: {:?}", e);
                match espeak_ng::EspeakNg::new("cmn") {
                    Ok(engine) => {
                        log::info!("[KokoroTTS-DIAG] espeak-ng cmn fallback OK");
                        Some(Mutex::new(engine))
                    }
                    Err(e2) => {
                        log::error!("[KokoroTTS-DIAG] espeak-ng cmn fallback FAILED: {:?}", e2);
                        None
                    }
                }
            }
        }
    }).as_ref()
}

/// Convert text to phoneme token IDs using espeak-ng (pure Rust).
///
/// For English text, uses espeak-ng to produce proper IPA phonemes,
/// then maps each IPA character to a token ID via the vocabulary.
///
/// For CJK text (detected by character ratio), falls back to the
/// simplified character-level mapper.
///
/// The returned token IDs do NOT include pad tokens — those are added
/// by the inference engine.
pub fn text_to_phoneme_ids(text: &str, phoneme_to_id: &std::collections::HashMap<char, i64>) -> Vec<i64> {
    // Detect if text is primarily CJK
    let char_count = text.chars().count().max(1);
    let cjk_count = text.chars().filter(|c| is_cjk(*c)).count();
    let cjk_ratio = cjk_count as f64 / char_count as f64;

    if cjk_ratio > 0.3 {
        log::debug!(
            "[KokoroTTS] CJK text detected (ratio={:.2}), trying espeak-ng cmn engine",
            cjk_ratio
        );

        // Try espeak-ng cmn engine for proper Chinese → IPA phonemization
        if let Some(cmn_engine) = get_espeak_cmn_engine() {
            let cmn_guard = cmn_engine.lock();
            match cmn_guard.text_to_phonemes(text) {
                Ok(phonemes) => {
                    drop(cmn_guard);
                    log::info!(
                        "[KokoroTTS-DIAG] cmn espeak phonemes: len={}, preview={:?}",
                        phonemes.len(),
                        &phonemes[..phonemes.len().min(120)]
                    );

                    // Map IPA phoneme characters to token IDs
                    let mut ids = Vec::new();
                    for ch in phonemes.chars() {
                        if let Some(&id) = phoneme_to_id.get(&ch) {
                            ids.push(id);
                        }
                    }

                    if !ids.is_empty() {
                        log::info!(
                            "[KokoroTTS-DIAG] cmn phoneme_ids: {} (from {} phoneme chars)",
                            ids.len(), phonemes.chars().count()
                        );
                        return ids;
                    }
                    log::warn!("[KokoroTTS-DIAG] cmn espeak produced phonemes but no matching token IDs, falling back");
                }
                Err(e) => {
                    drop(cmn_guard);
                    log::warn!(
                        "[KokoroTTS-DIAG] cmn espeak phonemization failed: {:?}, falling back",
                        e
                    );
                }
            }
        } else {
            log::warn!("[KokoroTTS-DIAG] espeak-ng cmn engine not available, using char-level fallback");
        }

        return text_to_phoneme_ids_fallback(text, phoneme_to_id);
    }

    // Use espeak-ng for English text
    let Some(engine) = get_espeak_engine() else {
        log::warn!("[KokoroTTS] espeak-ng not available, using char-level fallback for English text");
        return text_to_phoneme_ids_fallback(text, phoneme_to_id);
    };
    let engine_guard = engine.lock();

    let phonemes = match engine_guard.text_to_phonemes(text) {
        Ok(phonemes) => phonemes,
        Err(e) => {
            log::warn!(
                "[KokoroTTS] espeak-ng phonemization failed: {:?}, falling back to char-level",
                e
            );
            return text_to_phoneme_ids_fallback(text, phoneme_to_id);
        }
    };

    drop(engine_guard);

    log::debug!(
        "[KokoroTTS] espeak-ng: {:?} -> {:?}",
        &text[..text.len().min(40)],
        &phonemes[..phonemes.len().min(60)]
    );
    log::info!(
        "[KokoroTTS-DIAG] espeak phonemes: len={}, preview={:?}",
        phonemes.len(),
        &phonemes[..phonemes.len().min(80)]
    );

    // Map phoneme characters to token IDs, filtering unknown chars
    let mut ids = Vec::new();
    for ch in phonemes.chars() {
        if let Some(&id) = phoneme_to_id.get(&ch) {
            ids.push(id);
        }
        // Unknown phoneme characters are silently skipped (same as kokoro-onnx)
    }

    if ids.is_empty() {
        log::warn!("[KokoroTTS] espeak-ng produced empty phoneme sequence, falling back");
        return text_to_phoneme_ids_fallback(text, phoneme_to_id);
    }

    ids
}

/// Fallback phonemizer: direct character-to-token-ID mapping.
///
/// Used for CJK text or when espeak-ng fails. Maps each character
/// directly to its token ID from the vocabulary.
fn text_to_phoneme_ids_fallback(text: &str, phoneme_to_id: &std::collections::HashMap<char, i64>) -> Vec<i64> {
    let mut ids = Vec::new();

    for ch in text.chars() {
        if let Some(&id) = phoneme_to_id.get(&ch) {
            ids.push(id);
        } else {
            let lower = ch.to_lowercase().next().unwrap_or(ch);
            if let Some(&id) = phoneme_to_id.get(&lower) {
                ids.push(id);
            }
        }
    }

    ids
}

/// Check if a character is CJK (Chinese, Japanese, Korean).
fn is_cjk(ch: char) -> bool {
    let cp = ch as u32;
    (0x4E00..=0x9FFF).contains(&cp)      // CJK Unified Ideographs
        || (0x3400..=0x4DBF).contains(&cp) // CJK Extension A
        || (0x3040..=0x309F).contains(&cp) // Hiragana
        || (0x30A0..=0x30FF).contains(&cp) // Katakana
        || (0xAC00..=0xD7AF).contains(&cp) // Hangul Syllables
}

// ============================================================================
// Token Vocabulary Loading
// ============================================================================

/// Load a tokens file (sherpa-onnx format) and build a char -> id mapping.
///
/// Format: `<token> <id>` per line, e.g. `$ 0`, `; 1`, `  16` (space char).
pub fn load_tokens_file(content: &str) -> std::collections::HashMap<char, i64> {
    let mut map = std::collections::HashMap::new();

    for line in content.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }

        let Some(last_space) = line.rfind(' ') else {
            continue;
        };
        let token_part = &line[..last_space];
        let id_part = &line[last_space + 1..];

        let Ok(id) = id_part.parse::<i64>() else {
            continue;
        };

        if token_part.starts_with('<') && token_part.ends_with('>') {
            continue;
        }

        if token_part.chars().count() == 1 {
            let ch = token_part.chars().next().unwrap();
            map.insert(ch, id);
        }
    }

    log::info!(
        "[KokoroTTS] Loaded {} phoneme-to-id mappings from tokens file",
        map.len()
    );

    map
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_sentences_basic() {
        let text = "Hello world. How are you? I am fine!";
        let sentences = split_sentences(text);
        assert_eq!(sentences.len(), 3);
    }

    #[test]
    fn test_split_sentences_cjk() {
        let text = "你好世界。今天天气怎么样？我很好！";
        let sentences = split_sentences(text);
        assert_eq!(sentences.len(), 3);
    }

    #[test]
    fn test_normalize_text() {
        let text = "Hello   **world**... How — are — you?";
        let normalized = normalize_text(text);
        assert!(!normalized.contains("**"));
        assert!(!normalized.contains("—"));
    }

    #[test]
    fn test_load_tokens_file() {
        let content = "<blank> 0\n<pad> 1\na 2\nb 3\nc 4\n  16\n";
        let map = load_tokens_file(content);
        assert_eq!(map.get(&'a'), Some(&2));
        assert_eq!(map.get(&'b'), Some(&3));
        assert_eq!(map.get(&'c'), Some(&4));
        assert_eq!(map.get(&' '), Some(&16));
    }

    #[test]
    fn test_is_cjk() {
        assert!(is_cjk('你'));
        assert!(is_cjk('あ'));
        assert!(is_cjk('ア'));
        assert!(is_cjk('가'));
        assert!(!is_cjk('a'));
        assert!(!is_cjk('Z'));
    }

    #[test]
    fn test_phonemizer_english() {
        let mut vocab = std::collections::HashMap::new();
        // Add common IPA characters that espeak-ng would produce
        for ch in "hɛləˈoʊ wˈɜːld æ ɪ ŋ ʃ ʒ θ ð ʔ ə ɐ ɒ ɔ ɜ ʊ ʌ ˈ ˌ ː ' ".chars() {
            vocab.insert(ch, (ch as u32) as i64);
        }

        let text = "hello world";
        let ids = text_to_phoneme_ids(text, &vocab);
        assert!(!ids.is_empty(), "espeak-ng should produce phonemes for 'hello world'");
    }

    #[test]
    fn test_phonemizer_cjk_fallback() {
        let mut vocab = std::collections::HashMap::new();
        vocab.insert('你', 100);
        vocab.insert('好', 101);
        vocab.insert('世', 102);
        vocab.insert('界', 103);

        let text = "你好世界";
        let ids = text_to_phoneme_ids(text, &vocab);
        assert_eq!(ids.len(), 4);
        assert_eq!(ids[0], 100);
    }
}
