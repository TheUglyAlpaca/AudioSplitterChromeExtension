import React, { useState, useEffect, useRef } from 'react';
import { formatDate } from '../utils/audioUtils';

interface AudioInfoProps {
  recordingName: string;
  timestamp: Date;
  onDownload?: () => void;
  onDelete?: () => void;
  onNameChange?: (newName: string) => void;
}

export const AudioInfo: React.FC<AudioInfoProps> = ({
  recordingName,
  timestamp,
  onDownload,
  onDelete,
  onNameChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(recordingName.replace(/\.[^/.]+$/, ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Update edited name when recordingName prop changes
    setEditedName(recordingName.replace(/\.[^/.]+$/, ''));
  }, [recordingName]);

  useEffect(() => {
    // Focus input when editing starts
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameClick = () => {
    if (onNameChange) {
      setIsEditing(true);
    }
  };

  const handleNameBlur = () => {
    setIsEditing(false);
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== recordingName.replace(/\.[^/.]+$/, '') && onNameChange) {
      onNameChange(trimmedName);
    } else if (!trimmedName) {
      // Reset to original if empty
      setEditedName(recordingName.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEditedName(recordingName.replace(/\.[^/.]+$/, ''));
      inputRef.current?.blur();
    }
  };

  return (
    <div className="audio-info">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="recording-name-input"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
        />
      ) : (
        <span 
          className="recording-name" 
          onClick={handleNameClick}
          style={{ cursor: onNameChange ? 'text' : 'default' }}
          title={onNameChange ? 'Click to edit name' : ''}
        >
          {editedName}
        </span>
      )}
      <div className="audio-actions">
        {onDownload && (
          <button className="icon-button" onClick={onDownload} title="Download">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 10l-4-4h2.5V2h3v4H12l-4 4zm-4 2h8v2H4v-2z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button className="icon-button" onClick={onDelete} title="Delete">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
              <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

