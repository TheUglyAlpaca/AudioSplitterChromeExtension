// Audio format conversion utilities

/**
 * Converts an audio blob to WAV format
 */
export async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Get audio data
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  // Interleave audio data
  const interleaved = new Float32Array(length * numberOfChannels);
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      interleaved[i * numberOfChannels + channel] = audioBuffer.getChannelData(channel)[i];
    }
  }
  
  // Convert to 16-bit PCM
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Create WAV file
  const wavBuffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(wavBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true); // byte rate
  view.setUint16(32, numberOfChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  
  // Write PCM data
  const pcmView = new Int16Array(wavBuffer, 44);
  pcmView.set(pcm);
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Converts an audio blob to the specified format
 */
export async function convertAudioFormat(blob: Blob, targetFormat: string): Promise<Blob> {
  const format = targetFormat.toLowerCase();
  
  // If already in the target format (or compatible), return as-is
  if (format === 'webm' && blob.type.includes('webm')) {
    return blob;
  }
  
  if (format === 'ogg' && blob.type.includes('ogg')) {
    return blob;
  }
  
  // Convert to WAV
  if (format === 'wav') {
    return convertToWav(blob);
  }
  
  // For MP3, we'd need a library like lamejs
  // For now, convert to WAV as a fallback
  if (format === 'mp3') {
    console.warn('MP3 conversion not yet implemented, converting to WAV instead');
    return convertToWav(blob);
  }
  
  // Default: return original blob
  return blob;
}

