import React from 'react';

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  onClick
}) => {
  return (
    <button
      className={`record-button ${isRecording ? 'recording stop-button' : ''}`}
      onClick={onClick}
      title={isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {isRecording ? (
        <div className="stop-button-inner" />
      ) : (
        <div className="record-button-inner" />
      )}
    </button>
  );
};
