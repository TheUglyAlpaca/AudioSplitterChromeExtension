import { useState, useEffect, useRef, useCallback } from 'react';

interface WaveformData {
  data: Uint8Array;
  sampleRate: number;
  duration: number;
}

interface UseWaveformReturn {
  waveformData: WaveformData | null;
  analyzeAudio: (audioBlob: Blob) => Promise<void>;
  analyzeStream: (stream: MediaStream) => Promise<void>;
  clearWaveform: () => void;
  listenForRemoteUpdates: () => () => void;
}

export function useWaveform(): UseWaveformReturn {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize AudioContext
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;
    analyserRef.current.smoothingTimeConstant = 0.8;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const analyzeAudio = useCallback(async (audioBlob: Blob) => {
    if (!audioContextRef.current) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Get raw audio data for waveform visualization
      const channelData = audioBuffer.getChannelData(0); // Get first channel
      const samples = channelData.length;

      // Downsample for visualization (take every Nth sample)
      const targetSamples = 1000; // Number of bars to show
      const step = Math.max(1, Math.floor(samples / targetSamples));
      const waveformArray = new Uint8Array(targetSamples);

      for (let i = 0; i < targetSamples; i++) {
        const start = i * step;
        const end = Math.min(start + step, samples);
        let sum = 0;
        let max = 0;

        for (let j = start; j < end; j++) {
          const abs = Math.abs(channelData[j]);
          sum += abs;
          max = Math.max(max, abs);
        }

        // Normalize to 0-255 range
        const avg = sum / (end - start);
        waveformArray[i] = Math.min(255, Math.floor((avg + max) / 2 * 255));
      }

      setWaveformData({
        data: waveformArray,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration
      });
    } catch (error) {
      console.error('Error analyzing audio:', error);
    }
  }, []);

  const analyzeStream = useCallback(async (stream: MediaStream) => {
    if (!audioContextRef.current || !analyserRef.current) return;

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          setWaveformData({
            data: new Uint8Array(dataArray),
            sampleRate: audioContextRef.current?.sampleRate || 44100,
            duration: 0 // Will be updated by recording duration
          });
        }
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    } catch (error) {
      console.error('Error analyzing stream:', error);
    }
  }, []);

  const clearWaveform = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Clear waveform data immediately
    setWaveformData(null);
  }, []);

  const listenForRemoteUpdates = useCallback(() => {
    const listener = (message: any) => {
      if (message.action === 'waveformUpdate' && message.data) {
        setWaveformData({
          data: new Uint8Array(message.data),
          sampleRate: 44100, // Default for visualization
          duration: 0
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Return cleanup function
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return {
    waveformData,
    analyzeAudio,
    analyzeStream,
    clearWaveform,
    listenForRemoteUpdates
  };
}

