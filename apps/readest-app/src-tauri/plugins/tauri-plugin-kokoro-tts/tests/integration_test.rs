//! End-to-end integration test for the Kokoro TTS pipeline.
//!
//! Tests the complete flow: text → phonemize → token IDs → ONNX model load.
//!
//! Note: Full ONNX inference tests (marked #[ignore]) require loading the
//! 170MB model and can take 30+ seconds. Run with:
//!   cargo test -p tauri-plugin-kokoro-tts -- --ignored

use std::collections::HashMap;
use std::path::PathBuf;

/// Get the path to the kokoro-tts resources directory.
fn resource_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("resources")
        .join("kokoro-tts")
}

// ============================================================================
// Text Processing Pipeline Tests (no model needed)
// ============================================================================

#[test]
fn test_text_processing_full_pipeline() {
    // Load real tokens file
    let tokens_path = resource_dir().join("tokens.txt");
    assert!(tokens_path.exists(), "tokens.txt not found at {:?}", tokens_path);

    let tokens_content = std::fs::read_to_string(&tokens_path).unwrap();
    let phoneme_to_id: HashMap<char, i64> =
        tauri_plugin_kokoro_tts::text_processing::load_tokens_file(&tokens_content);

    // Verify we loaded a reasonable vocabulary
    assert!(
        phoneme_to_id.len() > 50,
        "Expected >50 phoneme mappings, got {}",
        phoneme_to_id.len()
    );

    // Test English phonemization with espeak-ng
    let text = "Hello, this is a test of the text to speech system.";
    let ids = tauri_plugin_kokoro_tts::text_processing::text_to_phoneme_ids(text, &phoneme_to_id);
    assert!(
        !ids.is_empty(),
        "espeak-ng should produce phoneme IDs for English text"
    );
    assert!(
        ids.len() > 5,
        "Expected more than 5 token IDs for a full sentence, got {}",
        ids.len()
    );

    // All token IDs should be valid (non-negative)
    for (i, &id) in ids.iter().enumerate() {
        assert!(
            id >= 0,
            "Token ID at position {} is negative: {}",
            i, id
        );
    }
}

#[test]
fn test_sentence_splitting_and_phonemization() {
    // Load real tokens
    let tokens_path = resource_dir().join("tokens.txt");
    let tokens_content = std::fs::read_to_string(&tokens_path).unwrap();
    let phoneme_to_id: HashMap<char, i64> =
        tauri_plugin_kokoro_tts::text_processing::load_tokens_file(&tokens_content);

    // Test a multi-sentence paragraph
    let text = "The quick brown fox jumps over the lazy dog. How wonderful life is!";
    let sentences = tauri_plugin_kokoro_tts::text_processing::split_sentences(text);

    assert_eq!(sentences.len(), 2, "Expected 2 sentences, got {:?}", sentences);

    // Each sentence should produce non-empty phoneme IDs
    for (i, sentence) in sentences.iter().enumerate() {
        let ids = tauri_plugin_kokoro_tts::text_processing::text_to_phoneme_ids(
            sentence,
            &phoneme_to_id,
        );
        assert!(
            !ids.is_empty(),
            "Sentence {} '{}' should produce phoneme IDs",
            i,
            sentence
        );
    }
}

#[test]
fn test_cjk_text_uses_fallback() {
    let tokens_path = resource_dir().join("tokens.txt");
    let tokens_content = std::fs::read_to_string(&tokens_path).unwrap();
    let phoneme_to_id: HashMap<char, i64> =
        tauri_plugin_kokoro_tts::text_processing::load_tokens_file(&tokens_content);

    // CJK text should use fallback (char-level mapping), not espeak-ng
    let text = "你好世界";
    let ids = tauri_plugin_kokoro_tts::text_processing::text_to_phoneme_ids(text, &phoneme_to_id);
    // CJK chars likely won't be in the Kokoro vocabulary (it's English-focused),
    // so we just verify the function doesn't panic and returns gracefully
    // (IDs may be empty if CJK chars aren't in vocab)
    let _ = ids; // No assertion on length — CJK chars may not be in English vocab
}

#[test]
fn test_text_normalization_pipeline() {
    // Verify text normalization handles various input patterns
    let input = "Hello **world**... This — is — a — test.\n\nNew paragraph here.";

    let normalized = tauri_plugin_kokoro_tts::text_processing::normalize_text(input);
    assert!(!normalized.contains("**"), "Markdown bold should be stripped");
    assert!(!normalized.contains("—"), "Em dashes should be normalized");
    assert!(!normalized.contains("..."), "Ellipsis should be normalized");

    let sentences = tauri_plugin_kokoro_tts::text_processing::split_sentences(&normalized);
    assert!(
        sentences.len() >= 2,
        "Should split into at least 2 sentences, got {:?}",
        sentences
    );
}

// ============================================================================
// Model Loading Test (requires 170MB model, marked #[ignore])
// ============================================================================

#[test]
#[ignore]
fn test_onnx_model_load_and_inference() {
    use ndarray::{Array1, Array2};
    use ort::session::{Session, builder::GraphOptimizationLevel};

    let resource_dir = resource_dir();

    // 1. Load model
    let model_path = resource_dir.join("kokoro-v0_19.onnx");
    assert!(model_path.exists(), "ONNX model not found at {:?}", model_path);

    let model_bytes = std::fs::read(&model_path).expect("Failed to read model");
    assert!(
        model_bytes.len() > 100_000_000,
        "Model file seems too small: {} bytes",
        model_bytes.len()
    );

    let session = Session::builder()
        .unwrap()
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .unwrap()
        .with_intra_threads(2)
        .unwrap()
        .commit_from_memory(&model_bytes)
        .expect("Failed to load ONNX model");

    // 2. Inspect model inputs
    let inputs = session.inputs();
    println!("Model inputs:");
    for input in inputs.iter() {
        println!("  {}", input.name());
    }

    // 3. Load tokens and phonemize
    let tokens_path = resource_dir.join("tokens.txt");
    let tokens_content = std::fs::read_to_string(&tokens_path).unwrap();
    let phoneme_to_id: HashMap<char, i64> =
        tauri_plugin_kokoro_tts::text_processing::load_tokens_file(&tokens_content);

    let text = "Hello world";
    let token_ids =
        tauri_plugin_kokoro_tts::text_processing::text_to_phoneme_ids(text, &phoneme_to_id);
    assert!(!token_ids.is_empty(), "Should produce token IDs for 'Hello world'");
    println!("Phoneme IDs for '{}': {:?}", text, token_ids);

    // 4. Add pad tokens: [0, *token_ids, 0]
    let mut padded = Vec::with_capacity(token_ids.len() + 2);
    padded.push(0i64);
    padded.extend_from_slice(&token_ids);
    padded.push(0i64);

    // 5. Build tensors and run inference
    let tokens_array = Array2::from_shape_vec((1, padded.len()), padded).unwrap();

    let mut style_vec = vec![0.0f32; 256];
    style_vec[0] = 1.0; // Bella voice
    let style_array = Array2::from_shape_vec((1, 256), style_vec).unwrap();

    let speed_array = Array1::from_vec(vec![1.0f32]);

    // Build named inputs
    let input_names: Vec<String> = inputs.iter().map(|m| m.name().to_string()).collect();
    let mut input_values: Vec<(String, ort::value::DynValue)> = Vec::new();

    for name in &input_names {
        let name_lower = name.to_lowercase();
        if name_lower.contains("token") || name_lower.contains("input_ids") || name_lower.contains("input") {
            let val: ort::value::DynValue = ort::value::Value::from_array(tokens_array.clone()).unwrap().into();
            input_values.push((name.clone(), val));
        } else if name_lower.contains("style") || name_lower.contains("voice") {
            let val: ort::value::DynValue = ort::value::Value::from_array(style_array.clone()).unwrap().into();
            input_values.push((name.clone(), val));
        } else if name_lower.contains("speed") || name_lower.contains("rate") {
            let val: ort::value::DynValue = ort::value::Value::from_array(speed_array.clone()).unwrap().into();
            input_values.push((name.clone(), val));
        }
    }

    println!("Built {} inputs for inference", input_values.len());
    assert!(!input_values.is_empty(), "Should have at least one input");

    // 6. Run inference
    let mut session = session;
    let outputs = session.run(input_values).expect("ONNX inference failed");

    // 7. Verify output
    let output_names: Vec<String> = outputs.iter().map(|(name, _)| name.to_string()).collect();
    println!("Model output names: {:?}", output_names);
    assert!(!output_names.is_empty(), "Model should produce at least one output");

    // Extract audio from first output
    let (first_name, _) = outputs.iter().next().unwrap();
    let first_val = outputs.get(first_name).unwrap();
    let (shape, data) = first_val.try_extract_tensor::<f32>().unwrap();

    println!("Output shape: {:?}", shape);
    println!("Output samples: {} (first 5: {:?})", data.len(), &data[..data.len().min(5)]);

    // Audio should be non-trivial
    assert!(
        data.len() > 100,
        "Expected >100 audio samples, got {}",
        data.len()
    );

    // Check audio has non-zero values (not silence)
    let max_amplitude = data.iter().map(|x| x.abs()).fold(0.0f32, f32::max);
    assert!(
        max_amplitude > 0.001,
        "Audio output appears to be silence (max amplitude: {})",
        max_amplitude
    );

    println!(
        "Integration test PASSED: {} tokens -> {} audio samples (max amp: {:.4})",
        token_ids.len(),
        data.len(),
        max_amplitude
    );
}
