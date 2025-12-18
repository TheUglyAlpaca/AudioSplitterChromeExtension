import React, { useState, useEffect } from 'react';
import { processAudioWithSAM, isSAMAvailable } from '../utils/samIntegration';

interface SAMProcessorProps {
  audioBlob: Blob | null;
  onProcessed: (processedBlob: Blob) => void;
}

export const SAMProcessor: React.FC<SAMProcessorProps> = ({ audioBlob, onProcessed }) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [getResidual, setGetResidual] = useState(false);

  useEffect(() => {
    // Check if SAM server is available
    const checkAvailability = async () => {
      const available = await isSAMAvailable();
      setIsAvailable(available);
    };
    checkAvailability();
    
    // Check periodically
    const interval = setInterval(checkAvailability, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleProcess = async () => {
    if (!audioBlob || !prompt.trim()) {
      setError('Please enter a description of the sound to isolate');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await processAudioWithSAM({
        audioBlob,
        prompt: prompt.trim(),
        getResidual
      });

      if (result.success && result.processedBlob) {
        onProcessed(result.processedBlob);
        setError(null);
      } else {
        setError(result.error || 'Processing failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!audioBlob) {
    return null;
  }

  return (
    <div className="sam-processor">
      <div className="sam-processor-header">
        <h3 className="sam-processor-title">SAM Audio Isolation</h3>
        <div className={`sam-status ${isAvailable ? 'available' : 'unavailable'}`}>
          {isAvailable ? '● Connected' : '○ Server Offline'}
        </div>
      </div>
      
      {!isAvailable && (
        <div className="sam-warning">
          <p>SAM server is not running. Start it with:</p>
          <code>python sam_server/server.py</code>
        </div>
      )}

      <div className="sam-input-group">
        <label className="sam-label">Describe the sound to isolate:</label>
        <input
          type="text"
          className="sam-prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'A man speaking', 'Guitar playing', 'Birds chirping'"
          disabled={!isAvailable || isProcessing}
        />
      </div>

      <div className="sam-options">
        <label className="sam-checkbox-label">
          <input
            type="checkbox"
            checked={getResidual}
            onChange={(e) => setGetResidual(e.target.checked)}
            disabled={!isAvailable || isProcessing}
          />
          <span>Get residual (everything except target sound)</span>
        </label>
      </div>

      {error && (
        <div className="sam-error">{error}</div>
      )}

      <button
        className="sam-process-button"
        onClick={handleProcess}
        disabled={!isAvailable || isProcessing || !prompt.trim()}
      >
        {isProcessing ? 'Processing...' : 'Process with SAM'}
      </button>
    </div>
  );
};

