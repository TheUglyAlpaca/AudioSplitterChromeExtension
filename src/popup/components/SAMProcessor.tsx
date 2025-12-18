import React, { useState, useEffect } from 'react';
// SAM integration imports - will be used when packages are installed
// import { processAudioWithSAM, isSAMAvailable } from '../utils/samIntegration';

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
    // SAM integration not yet configured - stub out availability check
    // TODO: Uncomment when SAM packages are installed
    // const checkAvailability = async () => {
    //   const available = await isSAMAvailable();
    //   setIsAvailable(available);
    // };
    // const timeout = setTimeout(checkAvailability, 200);
    // const interval = setInterval(checkAvailability, 10000);
    // return () => {
    //   clearTimeout(timeout);
    //   clearInterval(interval);
    // };
    
    // For now, always show as unavailable
    setIsAvailable(false);
  }, []);

  const handleProcess = async () => {
    if (!audioBlob || !prompt.trim()) {
      setError('Please enter a description of the sound to isolate');
      return;
    }

    setIsProcessing(true);
    setError(null);

    // SAM integration not yet configured - stub out processing
    // TODO: Uncomment when SAM packages are installed
    // try {
    //   const result = await processAudioWithSAM({
    //     audioBlob,
    //     prompt: prompt.trim(),
    //     getResidual
    //   });
    //   if (result.success && result.processedBlob) {
    //     onProcessed(result.processedBlob);
    //     setError(null);
    //   } else {
    //     setError(result.error || 'Processing failed');
    //   }
    // } catch (err: any) {
    //   setError(err.message || 'An error occurred during processing');
    // } finally {
    //   setIsProcessing(false);
    // }
    
    // For now, just show error that packages aren't installed
    setError('SAM packages not installed. Please install SAM packages to use this feature.');
    setIsProcessing(false);
  };

  if (!audioBlob) {
    return null;
  }

  return (
    <div className="sam-processor">
      <div className="sam-processor-header">
        <h3 className="sam-processor-title">SAM Audio Isolation</h3>
        <div className={`sam-status unavailable`}>
          SAM integration not yet configured
        </div>
      </div>
      
      <div className="sam-warning">
        <p>SAM integration will be available after installing packages.</p>
        <p>This feature requires SAM-Audio model and Python server setup.</p>
      </div>

      <div className="sam-input-group">
        <label className="sam-label">Describe the sound to isolate:</label>
        <input
          type="text"
          className="sam-prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'A man speaking', 'Guitar playing', 'Birds chirping'"
          disabled={true}
          title="SAM packages not installed"
        />
      </div>

      <div className="sam-options">
        <label className="sam-checkbox-label">
          <input
            type="checkbox"
            checked={getResidual}
            onChange={(e) => setGetResidual(e.target.checked)}
            disabled={true}
            title="SAM packages not installed"
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
        disabled={true}
        title="SAM packages not installed"
      >
        Process with SAM
      </button>
    </div>
  );
};

