import React, { useState, useEffect } from 'react';

interface PreferencesProps {
  onClose?: () => void;
}

export const Preferences: React.FC<PreferencesProps> = ({ onClose }) => {
  const [format, setFormat] = useState<string>('wav');
  const [sampleRate, setSampleRate] = useState<string>('44100');
  const [channelMode, setChannelMode] = useState<string>('stereo');
  const [useTabTitle, setUseTabTitle] = useState<boolean>(false);

  useEffect(() => {
    // Load saved preferences
    chrome.storage.local.get(['preferences'], (result) => {
      if (result.preferences) {
        const prefs = result.preferences;
        if (prefs.format) setFormat(prefs.format);
        if (prefs.sampleRate) setSampleRate(prefs.sampleRate);
        if (prefs.channelMode) setChannelMode(prefs.channelMode);
        if (prefs.useTabTitle !== undefined) setUseTabTitle(prefs.useTabTitle);
      }
    });
  }, []);

  const savePreferences = (
    newFormat?: string,
    newSampleRate?: string,
    newChannelMode?: string,
    newUseTabTitle?: boolean
  ) => {
    chrome.storage.local.set({
      preferences: {
        format: newFormat !== undefined ? newFormat : format,
        sampleRate: newSampleRate !== undefined ? newSampleRate : sampleRate,
        channelMode: newChannelMode !== undefined ? newChannelMode : channelMode,
        useTabTitle: newUseTabTitle !== undefined ? newUseTabTitle : useTabTitle
      }
    });
  };

  const handleFormatChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFormat = e.target.value;
    setFormat(newFormat);
    
    // Save the new format immediately with the new value
    savePreferences(newFormat);
    
    // Update all saved recordings to use the new format
    // Convert the audio data to the new format
    chrome.storage.local.get(['savedRecordings'], async (result) => {
      const savedRecordings = result.savedRecordings || [];
      if (savedRecordings.length > 0) {
        // Import converter dynamically to avoid circular dependencies
        const { convertAudioFormat } = await import('../utils/audioConverter');
        
        // Convert all recordings to the new format
        const updatedRecordings = await Promise.all(
          savedRecordings.map(async (recording: any) => {
            // Reconstruct blob from stored audio data
            const audioArray = new Uint8Array(recording.audioData);
            const originalBlob = new Blob([audioArray], { type: 'audio/webm' });
            
            // Convert to new format
            const convertedBlob = await convertAudioFormat(originalBlob, newFormat);
            const convertedArrayBuffer = await convertedBlob.arrayBuffer();
            const convertedAudioData = Array.from(new Uint8Array(convertedArrayBuffer));
            
            // Update filename extension
            const extension = newFormat.toLowerCase();
            let recordingName = recording.name;
            const nameWithoutExt = recordingName.replace(/\.[^/.]+$/, '');
            recordingName = `${nameWithoutExt}.${extension}`;
            
            return {
              ...recording,
              name: recordingName,
              audioData: convertedAudioData,
              format: newFormat
            };
          })
        );
        
        chrome.storage.local.set({ savedRecordings: updatedRecordings });
      }
    });
  };

  const handleSampleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSampleRate = e.target.value;
    setSampleRate(newSampleRate);
    savePreferences(undefined, newSampleRate);
  };

  const handleChannelModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChannelMode = e.target.value;
    setChannelMode(newChannelMode);
    savePreferences(undefined, undefined, newChannelMode);
  };

  const handleUseTabTitleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUseTabTitle = e.target.checked;
    setUseTabTitle(newUseTabTitle);
    savePreferences(undefined, undefined, undefined, newUseTabTitle);
  };

  return (
    <div className="preferences">
      <div className="preference-item">
        <label className="preference-label">format</label>
        <select 
          className="preference-select"
          value={format}
          onChange={handleFormatChange}
        >
          <option value="wav">wav</option>
          <option value="webm">webm</option>
          <option value="mp3">mp3</option>
          <option value="ogg">ogg</option>
        </select>
      </div>

      <div className="preference-item">
        <label className="preference-label">sample rate</label>
        <select 
          className="preference-select"
          value={sampleRate}
          onChange={handleSampleRateChange}
        >
          <option value="44100">44100</option>
          <option value="48000">48000</option>
          <option value="96000">96000</option>
          <option value="192000">192000</option>
        </select>
      </div>

      <div className="preference-item">
        <label className="preference-label">mono/stereo</label>
        <select 
          className="preference-select"
          value={channelMode}
          onChange={handleChannelModeChange}
        >
          <option value="mono">mono</option>
          <option value="stereo">stereo</option>
        </select>
      </div>

      <div className="preference-item">
        <label className="preference-label">use tab title as sample name</label>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={useTabTitle}
            onChange={handleUseTabTitleToggle}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    </div>
  );
};

