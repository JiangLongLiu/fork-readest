#!/usr/bin/env bash
# ============================================================================
# Kokoro-82M TTS Model Downloader
# ============================================================================
# This script downloads the Kokoro v0.19 ONNX model and tokens.txt
# and places them in the Tauri resources directory.
#
# Usage:
#   bash scripts/download-kokoro-model.sh
#
# Requirements:
#   - curl or wget
#   - tar (for extracting tokens.txt from sherpa-onnx bundle)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../src-tauri" && pwd)"
RESOURCES_DIR="$PROJECT_ROOT/resources/kokoro-tts"

# Model download URLs
ONNX_FP16_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.fp16.onnx"
ONNX_FULL_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx"
SHERPA_BUNDLE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2"

# File sizes (approximate)
ONNX_FP16_SIZE="~169 MB"
ONNX_FULL_SIZE="~310 MB"

# Default to FP16 (smaller, good enough for most use cases)
USE_FP16=true

echo "============================================"
echo " Kokoro-82M TTS Model Downloader"
echo "============================================"
echo ""
echo "Target directory: $RESOURCES_DIR"
echo ""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --full)
            USE_FP16=false
            echo "[Config] Using full-precision model (FP32, $ONNX_FULL_SIZE)"
            ;;
        --fp16)
            USE_FP16=true
            echo "[Config] Using half-precision model (FP16, $ONNX_FP16_SIZE)"
            ;;
        --help|-h)
            echo "Usage: $0 [--fp16|--full]"
            echo ""
            echo "  --fp16  Download FP16 model (default, ~169 MB)"
            echo "  --full  Download FP32 model (~310 MB, higher quality)"
            exit 0
            ;;
    esac
done

# Create target directory
mkdir -p "$RESOURCES_DIR"

# ---- Step 1: Download ONNX model ----
echo ""
echo "[Step 1/2] Downloading ONNX model..."

if [ "$USE_FP16" = true ]; then
    MODEL_URL="$ONNX_FP16_URL"
    MODEL_FILE="kokoro-v0_19.onnx"
    echo "  URL:  $MODEL_URL"
    echo "  Size: $ONNX_FP16_SIZE"
else
    MODEL_URL="$ONNX_FULL_URL"
    MODEL_FILE="kokoro-v0_19.onnx"
    echo "  URL:  $MODEL_URL"
    echo "  Size: $ONNX_FULL_SIZE"
fi

# Check if file exists and is large enough (not just a Git LFS pointer)
# FP16 model is ~169 MB, FP32 is ~310 MB; LFS pointers are < 1 KB
MIN_MODEL_SIZE=$((10 * 1024 * 1024))  # 10 MB minimum
if [ -f "$RESOURCES_DIR/$MODEL_FILE" ]; then
    EXISTING_SIZE=$(stat -c%s "$RESOURCES_DIR/$MODEL_FILE" 2>/dev/null || stat -f%z "$RESOURCES_DIR/$MODEL_FILE" 2>/dev/null || echo 0)
    if [ "$EXISTING_SIZE" -ge "$MIN_MODEL_SIZE" ]; then
        echo "  [SKIP] $MODEL_FILE already exists ($EXISTING_SIZE bytes)"
    else
        echo "  [WARN] $MODEL_FILE exists but is too small ($EXISTING_SIZE bytes), likely a Git LFS pointer"
        echo "  Re-downloading..."
        rm -f "$RESOURCES_DIR/$MODEL_FILE"
        curl -L --progress-bar -o "$RESOURCES_DIR/$MODEL_FILE" "$MODEL_URL"
        echo "  [OK] Downloaded $MODEL_FILE"
    fi
else
    echo "  Downloading..."
    curl -L --progress-bar -o "$RESOURCES_DIR/$MODEL_FILE" "$MODEL_URL"
    echo "  [OK] Downloaded $MODEL_FILE"
fi

# ---- Step 2: Get tokens.txt ----
echo ""
echo "[Step 2/2] Obtaining tokens.txt..."

# Check if tokens.txt exists and has real content (not a Git LFS pointer)
MIN_TOKENS_LINES=10
if [ -f "$RESOURCES_DIR/tokens.txt" ]; then
    EXISTING_LINES=$(wc -l < "$RESOURCES_DIR/tokens.txt")
    if [ "$EXISTING_LINES" -ge "$MIN_TOKENS_LINES" ]; then
        echo "  [SKIP] tokens.txt already exists ($EXISTING_LINES lines)"
    else
        echo "  [WARN] tokens.txt exists but has too few lines ($EXISTING_LINES), likely a Git LFS pointer"
        rm -f "$RESOURCES_DIR/tokens.txt"
        echo "  Downloading sherpa-onnx bundle to extract tokens.txt..."
        TEMP_DIR=$(mktemp -d)
        BUNDLE_FILE="$TEMP_DIR/kokoro-en-v0_19.tar.bz2"
        curl -L --progress-bar -o "$BUNDLE_FILE" "$SHERPA_BUNDLE_URL"
        echo "  Extracting tokens.txt from bundle..."
        tar -xjf "$BUNDLE_FILE" -C "$TEMP_DIR" --wildcards '*/tokens.txt' 2>/dev/null || \
        tar -xjf "$BUNDLE_FILE" -C "$TEMP_DIR" 2>/dev/null
        TOKENS_FILE=$(find "$TEMP_DIR" -name "tokens.txt" -type f | head -1)
        if [ -n "$TOKENS_FILE" ] && [ -f "$TOKENS_FILE" ]; then
            cp "$TOKENS_FILE" "$RESOURCES_DIR/tokens.txt"
            echo "  [OK] Extracted tokens.txt ($(wc -l < "$RESOURCES_DIR/tokens.txt") lines)"
        fi
        rm -rf "$TEMP_DIR"
    fi
else
    echo "  Downloading sherpa-onnx bundle to extract tokens.txt..."
    TEMP_DIR=$(mktemp -d)
    BUNDLE_FILE="$TEMP_DIR/kokoro-en-v0_19.tar.bz2"

    curl -L --progress-bar -o "$BUNDLE_FILE" "$SHERPA_BUNDLE_URL"

    echo "  Extracting tokens.txt from bundle..."
    # The bundle structure is typically: kokoro-en-v0_19/tokens.txt
    tar -xjf "$BUNDLE_FILE" -C "$TEMP_DIR" --wildcards '*/tokens.txt' 2>/dev/null || \
    tar -xjf "$BUNDLE_FILE" -C "$TEMP_DIR" 2>/dev/null

    # Find the extracted tokens.txt
    TOKENS_FILE=$(find "$TEMP_DIR" -name "tokens.txt" -type f | head -1)

    if [ -n "$TOKENS_FILE" ] && [ -f "$TOKENS_FILE" ]; then
        cp "$TOKENS_FILE" "$RESOURCES_DIR/tokens.txt"
        echo "  [OK] Extracted tokens.txt ($(wc -l < "$RESOURCES_DIR/tokens.txt") lines)"
    else
        echo "  [WARN] Could not find tokens.txt in bundle."
        echo "  Generating tokens.txt from Kokoro v0.19 vocabulary..."
        generate_tokens_file "$RESOURCES_DIR/tokens.txt"
    fi

    # Cleanup
    rm -rf "$TEMP_DIR"
fi

# ---- Verification ----
echo ""
echo "============================================"
echo " Verification"
echo "============================================"

VERIFY_OK=true

if [ -f "$RESOURCES_DIR/kokoro-v0_19.onnx" ]; then
    SIZE=$(du -h "$RESOURCES_DIR/kokoro-v0_19.onnx" | cut -f1)
    echo "  [OK] kokoro-v0_19.onnx ($SIZE)"
else
    echo "  [MISSING] kokoro-v0_19.onnx"
    VERIFY_OK=false
fi

if [ -f "$RESOURCES_DIR/tokens.txt" ]; then
    LINES=$(wc -l < "$RESOURCES_DIR/tokens.txt")
    echo "  [OK] tokens.txt ($LINES lines)"
else
    echo "  [MISSING] tokens.txt"
    VERIFY_OK=false
fi

echo ""
if [ "$VERIFY_OK" = true ]; then
    echo "All model files are ready in: $RESOURCES_DIR"
    echo ""
    echo "To test with the dev server, set the environment variable:"
    echo "  export KOKORO_MODEL_DIR=\"$RESOURCES_DIR\""
else
    echo "Some files are missing. Please check the download output above."
    exit 1
fi
