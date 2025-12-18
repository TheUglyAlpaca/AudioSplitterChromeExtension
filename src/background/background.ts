// Background service worker for handling desktop audio capture

let isRecording = false;
let recordingChunks: Blob[] = [];
let mediaRecorder: MediaRecorder | null = null;
let currentStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let destinationNode: MediaStreamAudioDestinationNode | null = null;

interface Message {
  action: string;
  streamId?: string;
  tabId?: number;
  chunk?: number[];
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
  if (message.action === 'startCapture') {
    // Automatically capture from current Chrome window/tab without showing picker
    const tabId = message.tabId || sender.tab?.id;
    
    if (tabId) {
      // Get streamId and return it to popup - popup will get the stream
      captureTabAudio(tabId)
        .then(() => {
          chrome.storage.local.get(['recordingStreamId'], (result) => {
            sendResponse({ success: true, streamId: result.recordingStreamId, method: 'tab' });
          });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
    } else {
      // Fallback: get current active tab and capture
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          captureTabAudio(tabs[0].id)
            .then(() => {
              chrome.storage.local.get(['recordingStreamId'], (result) => {
                sendResponse({ success: true, streamId: result.recordingStreamId, method: 'tab' });
              });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
    }
    return true; // Keep channel open for async response
  }

  if (message.action === 'startRecordingWithStream') {
    // Popup sends us the streamId to start recording in background
    if (message.streamId) {
      startRecordingFromStreamId(message.streamId)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
    } else {
      sendResponse({ success: false, error: 'Stream ID required' });
    }
    return true;
  }

  if (message.action === 'stopCapture') {
    handleStopCapture()
      .then(async (audioBlob) => {
        if (audioBlob) {
          const arrayBuffer = await audioBlob.arrayBuffer();
          sendResponse({ success: true, audioBlob: Array.from(new Uint8Array(arrayBuffer)) });
        } else {
          sendResponse({ success: true, audioBlob: null });
        }
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'getRecordingState') {
    // Double-check state from storage to ensure accuracy
    chrome.storage.local.get(['recordingStartTime', 'recordingChunks'], (result) => {
      const hasActiveRecording = isRecording && (result.recordingStartTime || recordingChunks.length > 0);
      sendResponse({ 
        success: true,
        isRecording: hasActiveRecording,
        hasRecording: recordingChunks.length > 0 || (result.recordingChunks && result.recordingChunks.length > 0)
      });
    });
    return true;
  }

  if (message.action === 'getRecordingData') {
    if (recordingChunks.length > 0) {
      // Get format preference
      chrome.storage.local.get(['preferences'], (prefsResult) => {
        const format = prefsResult.preferences?.format || 'webm';
        let mimeType = 'audio/webm';
        
        if (format === 'ogg') {
          mimeType = 'audio/ogg';
        } else if (format === 'webm') {
          mimeType = 'audio/webm';
        }
        
        const blob = new Blob(recordingChunks, { type: mimeType });
        blob.arrayBuffer().then((arrayBuffer) => {
          sendResponse({ 
            success: true, 
            audioBlob: Array.from(new Uint8Array(arrayBuffer)),
            hasData: true
          });
        });
      });
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: true, hasData: false });
      return true;
    }
  }

  if (message.action === 'clearRecording') {
    // Stop any active recording first
    if (mediaRecorder && isRecording) {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      mediaRecorder = null;
      isRecording = false;
    }
    
    // Clean up stream
    if (currentStream) {
      const tracks = currentStream.getTracks();
      tracks.forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      currentStream = null;
    }
    
    // Clean up audio context
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    destinationNode = null;
    
    // Clear chunks and storage
    recordingChunks = [];
    chrome.storage.local.remove([
      'recordingStreamId',
      'recordingTabId',
      'recordingStartTime',
      'recordingChunks'
    ]);
    
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'addRecordingChunk') {
    // Add chunk from popup recorder
    if (message.chunk) {
      const blob = new Blob([new Uint8Array(message.chunk)], { type: 'audio/webm' });
      recordingChunks.push(blob);
      // Store in storage for persistence
      chrome.storage.local.get(['recordingChunks'], async (result) => {
        const existingChunks = result.recordingChunks || [];
        const chunksArray = await Promise.all(
          recordingChunks.map(async (chunk) => {
            const arrayBuffer = await chunk.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
          })
        );
        chrome.storage.local.set({ recordingChunks: chunksArray });
      });
    }
    sendResponse({ success: true });
    return true;
  }
});

// Automatically capture audio from a specific tab (no picker, without muting)
async function captureTabAudio(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // First, check if there's an existing stream for this tab and wait for it to be released
    // Chrome's tabCapture API requires that previous streams are fully released before capturing again
    
    // Wait a bit to ensure any previous stream is fully released
    setTimeout(() => {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId: tabId },
        (streamId: string | undefined) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            // If error is about active stream, wait a bit more and retry
            if (errorMsg && errorMsg.includes('active stream')) {
              // Wait longer and retry once
              setTimeout(() => {
                chrome.tabCapture.getMediaStreamId(
                  { targetTabId: tabId },
                  (retryStreamId: string | undefined) => {
                    if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                      return;
                    }
                    if (!retryStreamId) {
                      reject(new Error('Failed to get media stream ID'));
                      return;
                    }
                    chrome.storage.local.set({ 
                      recordingStreamId: retryStreamId,
                      recordingTabId: tabId 
                    });
                    resolve();
                  }
                );
              }, 500);
              return;
            }
            reject(new Error(errorMsg));
            return;
          }

          if (!streamId) {
            reject(new Error('Failed to get media stream ID'));
            return;
          }

          // Store streamId - the popup will use it to get the stream
          chrome.storage.local.set({ 
            recordingStreamId: streamId,
            recordingTabId: tabId 
          });
          
          resolve();
        }
      );
    }, 100); // Small delay to ensure previous stream is released
  });
}

// Start recording from a streamId (called from popup after getting the stream)
async function startRecordingFromStreamId(streamId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get the stream using getUserMedia in background worker
      // Note: This may not work in all service worker contexts, but we'll try
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // If getUserMedia not available, we'll rely on popup recording
        // Store streamId for popup to use
        chrome.storage.local.set({ recordingStreamId: streamId });
        isRecording = true;
        resolve();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // @ts-ignore - chromeMediaSource is a Chrome-specific constraint
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId
            }
          } as any,
          video: false
        });

        currentStream = stream;
        
        // Get format preference
        chrome.storage.local.get(['preferences'], (prefsResult) => {
          const format = prefsResult.preferences?.format || 'webm';
          let mimeType = 'audio/webm';
          
          // Map format to MIME type
          if (format === 'ogg') {
            mimeType = 'audio/ogg';
          } else if (format === 'webm') {
            mimeType = 'audio/webm';
          } else {
            // For wav and mp3, MediaRecorder doesn't support them natively
            // Use webm as fallback
            mimeType = 'audio/webm';
          }
          
          // Create MediaRecorder in background worker
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType
          });

          recordingChunks = [];
          mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
              recordingChunks.push(event.data);
              // Store chunks in storage for persistence
              const chunksArray = await Promise.all(
                recordingChunks.map(async (chunk) => {
                  const arrayBuffer = await chunk.arrayBuffer();
                  return Array.from(new Uint8Array(arrayBuffer));
                })
              );
              chrome.storage.local.set({ recordingChunks: chunksArray });
            }
          };

          mediaRecorder.onstop = () => {
            // Recording stopped - blob will be created in handleStopCapture
            console.log('Background MediaRecorder stopped, chunks:', recordingChunks.length);
          };

          mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
          };

          mediaRecorder.start(100); // Collect data every 100ms
          isRecording = true;
          
          // Store recording start time for persistence
          chrome.storage.local.set({ recordingStartTime: Date.now() });
          
          resolve();
        });
      } catch (getUserMediaError) {
        // If getUserMedia fails in service worker, fall back to popup recording
        console.warn('getUserMedia not available in service worker, using popup recording');
        chrome.storage.local.set({ recordingStreamId: streamId });
        isRecording = true;
        resolve();
      }
    } catch (error: any) {
      reject(error);
    }
  });
}

// Legacy function - kept for reference but not used
async function captureAllTabs(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get all Chrome tabs
      const tabs = await chrome.tabs.query({});
      
      if (tabs.length === 0) {
        reject(new Error('No tabs found'));
        return;
      }

      // Create audio context for mixing
      audioContext = new AudioContext();
      destinationNode = audioContext.createMediaStreamDestination();

      const streams: MediaStream[] = [];
      let capturedCount = 0;

      // Capture audio from each tab
      for (const tab of tabs) {
        if (!tab.id) continue;

        try {
          const streamId = await new Promise<string>((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId(
              { targetTabId: tab.id },
              (streamId: string | undefined) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                if (!streamId) {
                  reject(new Error('Failed to get stream ID'));
                  return;
                }
                resolve(streamId);
              }
            );
          });

          // Get the stream
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
              }
            } as any,
            video: false
          });

          streams.push(stream);

          // Connect to audio context for mixing
          const source = audioContext!.createMediaStreamSource(stream);
          source.connect(destinationNode!);

          capturedCount++;
        } catch (error) {
          console.warn(`Failed to capture tab ${tab.id}:`, error);
          // Continue with other tabs
        }
      }

      if (capturedCount === 0) {
        reject(new Error('Failed to capture any tabs'));
        return;
      }

      // Use the mixed stream
      const mixedStream = destinationNode!.stream;
      currentStream = mixedStream;

      // Create MediaRecorder
      mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType: 'audio/webm'
      });

      recordingChunks = [];
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          recordingChunks.push(event.data);
          // Store chunks in storage for persistence
          const chunksArray = await Promise.all(
            recordingChunks.map(async (chunk) => {
              const arrayBuffer = await chunk.arrayBuffer();
              return Array.from(new Uint8Array(arrayBuffer));
            })
          );
          chrome.storage.local.set({ recordingChunks: chunksArray });
        }
      };

      mediaRecorder.onstop = () => {
        // Clean up streams
        streams.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        destinationNode = null;
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

          mediaRecorder.start(100); // Collect data every 100ms
          isRecording = true;
          
          // Store recording start time for persistence
          chrome.storage.local.set({ recordingStartTime: Date.now() });
          
          resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function handleStartCapture(streamId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get the stream using getUserMedia with chromeMediaSource
    navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-ignore - chromeMediaSource is a Chrome-specific constraint
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      } as any,
      video: false
    }).then((stream) => {
      currentStream = stream;
      
      // Create MediaRecorder
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      recordingChunks = [];
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          recordingChunks.push(event.data);
          // Store chunks in storage for persistence
          const chunksArray = await Promise.all(
            recordingChunks.map(async (chunk) => {
              const arrayBuffer = await chunk.arrayBuffer();
              return Array.from(new Uint8Array(arrayBuffer));
            })
          );
          chrome.storage.local.set({ recordingChunks: chunksArray });
        }
      };

      mediaRecorder.onstop = () => {
        // Recording stopped
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

          mediaRecorder.start(100); // Collect data every 100ms
          isRecording = true;
          
          // Store recording start time for persistence
          chrome.storage.local.set({ recordingStartTime: Date.now() });
          
          resolve();
    }).catch((error) => {
      reject(error);
    });
  });
}

async function handleStopCapture(): Promise<Blob | null> {
  if (mediaRecorder && isRecording) {
    return new Promise((resolve) => {
      if (mediaRecorder) {
        // Store the onstop handler before stopping
        const originalOnStop = mediaRecorder.onstop;
        
        mediaRecorder.onstop = (event: Event) => {
          console.log('MediaRecorder onstop fired, chunks count:', recordingChunks.length);
          const totalSize = recordingChunks.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log('Total chunks size:', totalSize);
          
          // Get format preference for blob type
          chrome.storage.local.get(['preferences'], (prefsResult) => {
            const format = prefsResult.preferences?.format || 'webm';
            let mimeType = 'audio/webm';
            
            if (format === 'ogg') {
              mimeType = 'audio/ogg';
            } else if (format === 'webm') {
              mimeType = 'audio/webm';
            }
            
            const blob = new Blob(recordingChunks, { type: mimeType });
            console.log('Created blob, size:', blob.size);
          
            if (originalOnStop && mediaRecorder) {
              originalOnStop.call(mediaRecorder, event);
            }
            
            isRecording = false;
            const chunksToReturn = [...recordingChunks]; // Copy before clearing
            recordingChunks = []; // Clear chunks after creating blob
            
            // Clean up stream completely - stop all tracks first
            if (currentStream) {
              const tracks = currentStream.getTracks();
              tracks.forEach((track: MediaStreamTrack) => {
                track.stop();
              });
              // Wait a moment for tracks to fully stop before nulling
              setTimeout(() => {
                currentStream = null;
              }, 50);
            } else {
              currentStream = null;
            }

            if (audioContext) {
              audioContext.close().catch(() => {
                // Ignore errors on close
              });
              audioContext = null;
            }
            destinationNode = null;
            
            // Clear all recording-related storage
            chrome.storage.local.remove([
              'recordingStreamId', 
              'recordingTabId', 
              'recordingStartTime',
              'recordingChunks'
            ]);
            
            const recorderToNull = mediaRecorder;
            mediaRecorder = null;
            
            // Resolve with the blob
            if (blob.size > 0) {
              console.log('Resolving with blob, size:', blob.size);
              resolve(blob);
            } else {
              console.warn('Blob size is 0, trying to use chunks directly');
              // If blob is empty, try to create from chunks copy
              if (chunksToReturn.length > 0) {
                const retryBlob = new Blob(chunksToReturn, { type: mimeType });
                console.log('Retry blob size:', retryBlob.size);
                resolve(retryBlob);
              } else {
                console.warn('No chunks available, resolving with null');
                resolve(null);
              }
            }
          });
        };
        
        // Request final data before stopping
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        }
        if (mediaRecorder) {
          mediaRecorder.stop();
        }
      } else {
        resolve(null);
      }
    });
  }
  
  // If no active recording, return existing chunks if any
  if (recordingChunks.length > 0) {
    // Get format preference
    return new Promise((resolve) => {
      chrome.storage.local.get(['preferences'], (prefsResult) => {
        const format = prefsResult.preferences?.format || 'webm';
        let mimeType = 'audio/webm';
        
        if (format === 'ogg') {
          mimeType = 'audio/ogg';
        } else if (format === 'webm') {
          mimeType = 'audio/webm';
        }
        
        const blob = new Blob(recordingChunks, { type: mimeType });
        recordingChunks = []; // Clear chunks
        isRecording = false; // Ensure flag is cleared
        // Clear all recording-related storage
        chrome.storage.local.remove([
          'recordingStreamId', 
          'recordingTabId', 
          'recordingStartTime',
          'recordingChunks'
        ]);
        resolve(blob);
      });
    });
  }
  
  // Clear storage and state even if no chunks
  isRecording = false;
  recordingChunks = [];
  chrome.storage.local.remove([
    'recordingStreamId', 
    'recordingTabId', 
    'recordingStartTime',
    'recordingChunks'
  ]);
  return Promise.resolve(null);
}

// Handle popup close - continue recording in background
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    // Popup closed, but recording continues in background
    console.log('Popup closed, recording continues in background');
  });
});

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
  }
  if (currentStream) {
    currentStream.getTracks().forEach((track: MediaStreamTrack) => {
      track.stop();
    });
  }
  if (audioContext) {
    audioContext.close();
  }
});

// Restore recording state on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['recordingChunks'], (result) => {
    if (result.recordingChunks && Array.isArray(result.recordingChunks)) {
      recordingChunks = result.recordingChunks.map((chunk: number[]) => 
        new Blob([new Uint8Array(chunk)], { type: 'audio/webm' })
      );
    }
  });
});
