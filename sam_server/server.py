#!/usr/bin/env python3
"""
SAM-Audio Server for Chrome Extension
Provides HTTP API for audio separation using Meta's SAM-Audio model
"""

import os
import sys
import json
import base64
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torchaudio

# Try to import SAM-Audio, but handle missing dependencies gracefully
try:
    from sam_audio import SAMAudio, SAMAudioProcessor
    SAM_AVAILABLE = True
except ImportError as e:
    print(f"Warning: SAM-Audio not fully available: {e}")
    print("Some dependencies may be missing. The server will start but audio processing may not work.")
    SAM_AVAILABLE = False
    SAMAudio = None
    SAMAudioProcessor = None

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Global model and processor
model = None
processor = None
device = "cuda" if torch.cuda.is_available() else "cpu"

def load_model():
    """Load SAM-Audio model"""
    global model, processor
    if not SAM_AVAILABLE:
        print("ERROR: SAM-Audio is not available due to missing dependencies.")
        print("Please install all required dependencies. See README.md for details.")
        return False
    try:
        print("Loading SAM-Audio model...")
        model = SAMAudio.from_pretrained("facebook/sam-audio-large")
        processor = SAMAudioProcessor.from_pretrained("facebook/sam-audio-large")
        model = model.eval().to(device)
        print(f"Model loaded successfully on {device}")
        return True
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Make sure you have:")
        print("1. Requested access to the model on Hugging Face")
        print("2. Authenticated with: huggingface-cli login")
        print("3. Installed all dependencies")
        import traceback
        traceback.print_exc()
        return False

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'device': device
    })

@app.route('/separate', methods=['POST'])
def separate_audio():
    """
    Separate audio using SAM-Audio
    
    Expects JSON with:
    - audio_data: base64 encoded audio file
    - description: text prompt describing the sound to isolate
    - predict_spans: (optional) whether to predict time spans
    - reranking_candidates: (optional) number of candidates for reranking
    """
    if model is None or processor is None:
        return jsonify({
            'success': False,
            'error': 'Model not loaded. Please check server logs.'
        }), 500
    
    try:
        data = request.json
        audio_data_b64 = data.get('audio_data')
        description = data.get('description', '')
        predict_spans = data.get('predict_spans', False)
        reranking_candidates = data.get('reranking_candidates', 1)
        
        if not audio_data_b64:
            return jsonify({
                'success': False,
                'error': 'audio_data is required'
            }), 400
        
        if not description:
            return jsonify({
                'success': False,
                'error': 'description is required'
            }), 400
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_data_b64)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_audio_path = tmp_file.name
        
        try:
            # Process audio
            batch = processor(
                audios=[tmp_audio_path],
                descriptions=[description],
            ).to(device)
            
            # Separate audio
            with torch.inference_mode():
                result = model.separate(
                    batch,
                    predict_spans=predict_spans,
                    reranking_candidates=reranking_candidates
                )
            
            # Save separated audio to temporary file
            sample_rate = processor.audio_sampling_rate
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_output:
                torchaudio.save(tmp_output.name, result.target.cpu(), sample_rate)
                
                # Read processed audio
                with open(tmp_output.name, 'rb') as f:
                    processed_audio = f.read()
                
                # Clean up
                os.unlink(tmp_output.name)
            
            # Encode to base64
            processed_audio_b64 = base64.b64encode(processed_audio).decode('utf-8')
            
            return jsonify({
                'success': True,
                'audio_data': processed_audio_b64,
                'sample_rate': sample_rate
            })
            
        finally:
            # Clean up input file
            if os.path.exists(tmp_audio_path):
                os.unlink(tmp_audio_path)
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/separate_residual', methods=['POST'])
def separate_audio_residual():
    """
    Get the residual (everything except the target sound)
    """
    if model is None or processor is None:
        return jsonify({
            'success': False,
            'error': 'Model not loaded'
        }), 500
    
    try:
        data = request.json
        audio_data_b64 = data.get('audio_data')
        description = data.get('description', '')
        
        if not audio_data_b64 or not description:
            return jsonify({
                'success': False,
                'error': 'audio_data and description are required'
            }), 400
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_data_b64)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_audio_path = tmp_file.name
        
        try:
            # Process audio
            batch = processor(
                audios=[tmp_audio_path],
                descriptions=[description],
            ).to(device)
            
            # Separate audio
            with torch.inference_mode():
                result = model.separate(batch)
            
            # Save residual audio
            sample_rate = processor.audio_sampling_rate
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_output:
                torchaudio.save(tmp_output.name, result.residual.cpu(), sample_rate)
                
                with open(tmp_output.name, 'rb') as f:
                    processed_audio = f.read()
                
                os.unlink(tmp_output.name)
            
            # Encode to base64
            processed_audio_b64 = base64.b64encode(processed_audio).decode('utf-8')
            
            return jsonify({
                'success': True,
                'audio_data': processed_audio_b64,
                'sample_rate': sample_rate
            })
            
        finally:
            if os.path.exists(tmp_audio_path):
                os.unlink(tmp_audio_path)
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Load model on startup
    if not load_model():
        print("Warning: Model failed to load. Server will start but /separate endpoints will fail.")
        print("Please check your Hugging Face authentication and model access.")
    
    # Run server
    port = int(os.environ.get('PORT', 5001))  # Use 5001 to avoid AirPlay conflict on macOS
    print(f"Starting SAM-Audio server on http://localhost:{port}")
    print("Make sure this server is running before using SAM features in the extension.")
    if not SAM_AVAILABLE:
        print("\n⚠️  WARNING: SAM-Audio is not fully available due to missing dependencies.")
        print("   The server will start but audio processing endpoints will not work.")
        print("   This is expected on macOS ARM64 due to xformers dependency limitations.")
    app.run(host='localhost', port=port, debug=False)

