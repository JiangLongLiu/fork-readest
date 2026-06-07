use regex::Regex;
use unicode_segmentation::UnicodeSegmentation;

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

    // Regex for sentence boundaries:
    // Group 1: CJK sentence-ending punctuation
    // Group 2: Latin sentence-ending punctuation followed by space/EOL
    let sentence_re = Regex::new(
        r"(?<=[。！？\n])|(?<=[.!?])\s+",
    )
    .unwrap();

    let raw_parts: Vec<&str> = sentence_re.split(text).collect();
    let mut sentences = Vec::new();

    for part in raw_parts {
        let trimmed = part.trim();
        if !trimmed.is_empty() {
            sentences.push(trimmed.to_string());
        }
    }

    // Post-process: merge very short fragments (< 3 graphemes) with the
    // previous sentence to avoid awkward prosody breaks
    let mut merged = Vec::new();
    for sentence in sentences {
        let grapheme_count = sentence.graphemes(true).count();
        if grapheme_count < 3 && !merged.is_empty() {
            let last: &mut String = merged.last_mut().unwrap();
            last.push(' ');
            last.push_str(&sentence);
        } else {
            merged.push(sentence);
        }
    }

    if merged.is_empty() {
        // Fallback: return the whole text as one sentence
        vec![text.trim().to_string()]
    } else {
        merged
    }
}

/// Normalize text for TTS synthesis.
///
/// Performs the following cleanups:
/// - Collapse multiple whitespace into single spaces
/// - Remove control characters (except newline and tab)
/// - Normalize Unicode dashes to hyphens
/// - Expand ellipsis to spaced periods
/// - Strip markdown formatting (bold, italic, code)
pub fn normalize_text(text: &str) -> String {
    let mut result = text.to_string();

    // Remove control characters except \n, \r, \t
    result = result
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
        .collect();

    // Strip markdown bold/italic markers
    let md_re = Regex::new(r"\*{1,3}([^*]+)\*{1,3}").unwrap();
    result = md_re.replace_all(&result, "$1").to_string();

    // Strip inline code markers
    let code_re = Regex::new(r"`([^`]+)`").unwrap();
    result = code_re.replace_all(&result, "$1").to_string();

    // Normalize various dashes to comma (better for TTS prosody)
    let dash_re = Regex::new(r"[–—―]").unwrap();
    result = dash_re.replace_all(&result, ",").to_string();

    // Expand ellipsis
    let ellipsis_re = Regex::new(r"\.{3,}|……+").unwrap();
    result = ellipsis_re.replace_all(&result, ", ").to_string();

    // Collapse whitespace
    let ws_re = Regex::new(r"\s+").unwrap();
    result = ws_re.replace_all(&result, " ").to_string();

    result.trim().to_string()
}

/// Basic phonemizer that maps characters to phoneme-like token IDs.
///
/// IMPORTANT: This is a **simplified ASCII phonemizer** suitable for initial
/// testing and validation. For production-quality speech, replace this with
/// an espeak-ng based phonemizer (via `piper-phonemize` FFI or `espeak-ng`
/// command-line invocation) that produces proper IPA phoneme sequences.
///
/// The Kokoro model expects phoneme token IDs as input. This function maps
/// each character to a token ID using the provided `phoneme_to_id` mapping.
/// Unknown characters are skipped.
pub fn text_to_phoneme_ids(text: &str, phoneme_to_id: &std::collections::HashMap<char, i64>) -> Vec<i64> {
    let mut ids = Vec::new();

    for ch in text.chars() {
        // Direct character mapping (for models that use character-level tokenization)
        if let Some(&id) = phoneme_to_id.get(&ch) {
            ids.push(id);
        } else {
            // Try lowercase
            let lower = ch.to_lowercase().next().unwrap_or(ch);
            if let Some(&id) = phoneme_to_id.get(&lower) {
                ids.push(id);
            }
            // Unknown characters are silently skipped
        }
    }

    ids
}

/// Load a tokens file (one token per line) and build a char -> id mapping.
///
/// The file format is expected to be:
/// ```text
/// <blank>
/// <pad>
/// a
/// b
/// c
/// ...
/// ```
///
/// Each line's index (0-based) becomes the token ID.
pub fn load_tokens_file(content: &str) -> std::collections::HashMap<char, i64> {
    let mut map = std::collections::HashMap::new();

    for line in content.lines() {
        let line = line.trim_end(); // preserve leading spaces (space char is a valid token)
        if line.is_empty() {
            continue;
        }

        // sherpa-onnx tokens.txt format: "<token> <id>" per line
        // e.g. "$ 0", "; 1", "  16" (space character with id 16)
        let Some(last_space) = line.rfind(' ') else {
            continue;
        };
        let token_part = &line[..last_space];
        let id_part = &line[last_space + 1..];

        let Ok(id) = id_part.parse::<i64>() else {
            continue;
        };

        // Skip special tokens like <blank>, <pad>, <unk>, etc.
        if token_part.starts_with('<') && token_part.ends_with('>') {
            continue;
        }

        // Only map single-character tokens (handles multi-byte Unicode like IPA, CJK)
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
        assert_eq!(map.get(&' '), Some(&16)); // space character
    }
}
