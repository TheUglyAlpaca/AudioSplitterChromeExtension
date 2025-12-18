# SAM-Audio Server

Local Python server for running Meta's SAM-Audio model to isolate sounds from audio recordings.

## Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Note:** The `sam-audio` package is installed directly from GitHub, so you need `git` installed on your system. If you don't have git, you can install it separately:
```bash
# Install sam-audio from GitHub
pip install git+https://github.com/facebookresearch/sam-audio.git

# Then install other dependencies
pip install flask flask-cors torch torchaudio numpy
```

### 2. Get Model Access

1. Request access to SAM-Audio models on [Hugging Face](https://huggingface.co/facebook/sam-audio-large)
2. Once approved, authenticate:
   ```bash
   huggingface-cli login
   ```
   Enter your Hugging Face access token when prompted.

### 3. Run the Server

```bash
python server.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and model loading state.

### Separate Audio
```
POST /separate
Content-Type: application/json

{
  "audio_data": "base64_encoded_audio",
  "description": "text prompt describing sound to isolate",
  "predict_spans": false,  // optional
  "reranking_candidates": 1  // optional
}
```

Returns:
```json
{
  "success": true,
  "audio_data": "base64_encoded_processed_audio",
  "sample_rate": 16000
}
```

### Get Residual (Everything Else)
```
POST /separate_residual
```
Same format as `/separate`, but returns the residual audio (everything except the target sound).

## Usage with Chrome Extension

1. Start this server: `python server.py`
2. The Chrome extension will automatically connect to `http://localhost:5000`
3. Use the "Process with SAM" feature in the extension to isolate sounds

## Requirements

- Python 3.10 or 3.11 (3.13+ not supported due to dependency issues)
- CUDA-compatible GPU (recommended) or CPU
- Hugging Face account with access to SAM-Audio models

## Known Issues

### macOS ARM64 (Apple Silicon)

The `decord` package (required by `perception-models`) is not available for macOS ARM64. This may cause installation issues. If you encounter this:

1. **Option 1: Use Linux or Windows** - SAM-Audio works best on Linux with CUDA support
2. **Option 2: Use Docker** - Run the server in a Docker container
3. **Option 3: Skip perception-models** - Some features may not work, but basic audio separation should still function

### Installation Workaround for macOS

If installation fails due to `decord`, you can try installing without it:

```bash
# Install core dependencies first
pip install flask flask-cors torch torchaudio numpy

# Install SAM-Audio (this may fail on perception-models, but core functionality should work)
pip install git+https://github.com/facebookresearch/sam-audio.git --no-deps
pip install audiobox_aesthetics einops pydub torchcodec torchdiffeq torchvision transformers
```

**Note:** The server may still work for basic audio separation even if some dependencies fail to install.

