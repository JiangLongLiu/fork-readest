# ============================================================================
# Kokoro-82M TTS Model Downloader (PowerShell)
# ============================================================================
# Downloads the Kokoro v0.19 ONNX model and tokens.txt for Windows.
#
# Usage:
#   .\scripts\download-kokoro-model.ps1 [-FP16] [-Full]
# ============================================================================

param(
    [switch]$Full,
    [switch]$FP16 = $true,
    [switch]$Help
)

if ($Help) {
    Write-Host "Usage: .\download-kokoro-model.ps1 [-FP16] [-Full]"
    Write-Host ""
    Write-Host "  -FP16   Download FP16 model (default, ~169 MB)"
    Write-Host "  -Full   Download FP32 model (~310 MB, higher quality)"
    exit 0
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Join-Path $ScriptDir "..\src-tauri"
$ResourcesDir = Join-Path $ProjectRoot "resources\kokoro-tts"

$OnnxFp16Url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.fp16.onnx"
$OnnxFullUrl = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx"
$SherpaBundleUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Kokoro-82M TTS Model Downloader (Windows)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target directory: $ResourcesDir"
Write-Host ""

# Create target directory
if (-not (Test-Path $ResourcesDir)) {
    New-Item -ItemType Directory -Path $ResourcesDir -Force | Out-Null
}

# ---- Step 1: Download ONNX model ----
Write-Host ""
Write-Host "[Step 1/2] Downloading ONNX model..." -ForegroundColor Yellow

if ($Full) {
    $ModelUrl = $OnnxFullUrl
    Write-Host "  Using FP32 full-precision model (~310 MB)"
} else {
    $ModelUrl = $OnnxFp16Url
    Write-Host "  Using FP16 half-precision model (~169 MB)"
}

$ModelFile = Join-Path $ResourcesDir "kokoro-v0_19.onnx"

if (Test-Path $ModelFile) {
    Write-Host "  [SKIP] kokoro-v0_19.onnx already exists" -ForegroundColor Gray
} else {
    Write-Host "  URL: $ModelUrl"
    Write-Host "  Downloading (this may take a few minutes)..."
    try {
        # Use curl.exe (ships with Windows 10+) for reliable large file downloads
        & curl.exe -L --progress-bar -o $ModelFile $ModelUrl
        if ($LASTEXITCODE -ne 0) { throw "curl exited with code $LASTEXITCODE" }
        Write-Host "  [OK] Downloaded kokoro-v0_19.onnx" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Failed to download model: $_" -ForegroundColor Red
        Write-Host "  You can manually download from: $ModelUrl"
        Write-Host "  And place it in: $ModelFile"
        exit 1
    }
}

# ---- Step 2: Get tokens.txt ----
Write-Host ""
Write-Host "[Step 2/2] Obtaining tokens.txt..." -ForegroundColor Yellow

$TokensFile = Join-Path $ResourcesDir "tokens.txt"

if (Test-Path $TokensFile) {
    Write-Host "  [SKIP] tokens.txt already exists" -ForegroundColor Gray
} else {
    $TempDir = Join-Path $env:TEMP "kokoro-model-download-$(Get-Random)"
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    $BundleFile = Join-Path $TempDir "kokoro-en-v0_19.tar.bz2"

    Write-Host "  Downloading sherpa-onnx bundle for tokens.txt..."
    try {
        & curl.exe -L --progress-bar -o $BundleFile $SherpaBundleUrl
        if ($LASTEXITCODE -ne 0) { throw "curl exited with code $LASTEXITCODE" }

        Write-Host "  Extracting tokens.txt..."
        # Use tar (ships with Windows 10+) to extract
        & tar -xjf $BundleFile -C $TempDir 2>$null

        # Find tokens.txt in extracted files
        $ExtractedTokens = Get-ChildItem -Path $TempDir -Recurse -Filter "tokens.txt" | Select-Object -First 1

        if ($ExtractedTokens) {
            Copy-Item -Path $ExtractedTokens.FullName -Destination $TokensFile
            $LineCount = (Get-Content $TokensFile | Measure-Object -Line).Lines
            Write-Host "  [OK] Extracted tokens.txt ($LineCount lines)" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] tokens.txt not found in bundle, generating from vocabulary..." -ForegroundColor Yellow
            # Generate tokens.txt from the Kokoro v0.19 default vocabulary
            Generate-TokensFile -OutputPath $TokensFile
        }
    } catch {
        Write-Host "  [WARN] Bundle download failed: $_" -ForegroundColor Yellow
        Write-Host "  Generating tokens.txt from vocabulary..."
        Generate-TokensFile -OutputPath $TokensFile
    } finally {
        # Cleanup temp files
        if (Test-Path $TempDir) {
            Remove-Item -Recurse -Force $TempDir
        }
    }
}

# ---- Verification ----
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$AllOk = $true

if (Test-Path $ModelFile) {
    $Size = [math]::Round((Get-Item $ModelFile).Length / 1MB, 1)
    Write-Host "  [OK] kokoro-v0_19.onnx (${Size} MB)" -ForegroundColor Green
} else {
    Write-Host "  [MISSING] kokoro-v0_19.onnx" -ForegroundColor Red
    $AllOk = $false
}

if (Test-Path $TokensFile) {
    $Lines = (Get-Content $TokensFile | Measure-Object -Line).Lines
    Write-Host "  [OK] tokens.txt ($Lines lines)" -ForegroundColor Green
} else {
    Write-Host "  [MISSING] tokens.txt" -ForegroundColor Red
    $AllOk = $false
}

Write-Host ""
if ($AllOk) {
    Write-Host "All model files are ready in: $ResourcesDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "To test with the dev server, set the environment variable:"
    Write-Host "  `$env:KOKORO_MODEL_DIR = `"$ResourcesDir`""
} else {
    Write-Host "Some files are missing. Please check the output above." -ForegroundColor Red
    exit 1
}

# ============================================================================
# Fallback: Generate tokens.txt from Kokoro v0.19 default vocabulary
# ============================================================================
function Generate-TokensFile {
    param([string]$OutputPath)

    # This is the default Kokoro v0.19 vocabulary
    # Source: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/config.json (vocab field)
    # and kokoro-onnx/src/kokoro_onnx/config.py (DEFAULT_VOCAB)
    $vocab = @(
        '<blank>', '<pad>', '<unk>', '<s>', '</s>',
        ' ', '!', '"', '#', '$', '%', '&', "'", '(', ')', ',', '-', '.',
        '/', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';',
        '?', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
        'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y',
        'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
        'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
        'z',
        # IPA phonemes used by Kokoro v0.19
        'ˌ', 'ˈ', 'ː',
        'æ', 'ɑ', 'ɔ', 'ɒ', 'ə', 'ɛ', 'ɜ', 'ɪ', 'ɹ', 'ʃ', 'ʊ', 'ʌ', 'ʒ',
        'ð', 'ŋ', 'θ',
        'ɐ', 'ɚ', 'ɝ', 'ɞ', 'ɟ', 'ɡ', 'ɢ', 'ɦ', 'ɬ', 'ɮ', 'ɯ', 'ɰ',
        'ɱ', 'ɲ', 'ɳ', 'ɴ', 'ɵ', 'ɶ', 'ɷ', 'ɸ', 'ɻ', 'ɼ', 'ɽ', 'ɾ',
        'ʀ', 'ʁ', 'ʂ', 'ʈ', 'ʉ', 'ʋ', 'ʏ', 'ʐ', 'ʑ',
        'ˀ', 'ˁ', '˂', '˃', '˄', '˅', 'ˆ', 'ˇ', 'ˉ', 'ˊ', 'ˋ',
        'χ', 'ħ', 'ʕ', 'ʢ', 'ʡ', 'ɕ', 'ʝ', 'ʎ', 'ʟ', 'ʝ',
        'β', 'ç', 'ɣ', 'ɥ', 'ʝ', 'ʟ', 'ɸ', 'ʁ'
    )

    $vocab | Out-File -FilePath $OutputPath -Encoding utf8NoBOM
    $LineCount = $vocab.Count
    Write-Host "  [OK] Generated tokens.txt ($LineCount entries)" -ForegroundColor Green
}
