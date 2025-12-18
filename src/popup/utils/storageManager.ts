// Storage Manager - Handles both chrome.storage.local and IndexedDB
// This allows for much larger storage capacity (IndexedDB can store GBs)

export interface RecordingMetadata {
  id: string;
  name: string;
  timestamp: string;
  duration: number;
  format?: string;
  channelMode?: string;
}

export interface RecordingWithAudio extends RecordingMetadata {
  audioData: ArrayBuffer;
}

const DB_NAME = 'AudioRecorderDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Initialize IndexedDB
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Save recording to IndexedDB
export async function saveRecording(
  metadata: RecordingMetadata,
  audioData: ArrayBuffer
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const recording = {
      ...metadata,
      audioData: audioData // Store as ArrayBuffer
    };
    
    const request = store.put(recording);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get recording from IndexedDB
export async function getRecording(id: string): Promise<{ metadata: RecordingMetadata; audioData: ArrayBuffer } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { id, name, timestamp, duration, format, channelMode, audioData } = result;
        resolve({
          metadata: { id, name, timestamp, duration, format, channelMode },
          audioData: audioData as ArrayBuffer
        });
      } else {
        resolve(null);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Get all recording metadata (without audio data for list view)
export async function getAllRecordingsMetadata(): Promise<RecordingMetadata[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev'); // Sort by timestamp descending
    
    const recordings: RecordingMetadata[] = [];
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const { id, name, timestamp, duration, format, channelMode } = cursor.value;
        recordings.push({ id, name, timestamp, duration, format, channelMode });
        cursor.continue();
      } else {
        resolve(recordings);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Delete recording from IndexedDB
export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get storage usage estimate
export async function getStorageUsage(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { used: 0, quota: 0 };
}

// Clear all recordings
export async function clearAllRecordings(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Update recording name
export async function updateRecordingName(id: string, newName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const recording = getRequest.result;
      if (recording) {
        recording.name = newName;
        const putRequest = store.put(recording);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error('Recording not found'));
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Migrate recordings from chrome.storage.local to IndexedDB
export async function migrateFromChromeStorage(): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['savedRecordings'], async (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      const savedRecordings = result.savedRecordings || [];
      if (savedRecordings.length === 0) {
        resolve(0);
        return;
      }
      
      let migratedCount = 0;
      const errors: Error[] = [];
      
      // Migrate each recording
      for (const recording of savedRecordings) {
        try {
          // Convert audioData array back to ArrayBuffer
          const audioArray = new Uint8Array(recording.audioData);
          const arrayBuffer = audioArray.buffer;
          
          const metadata: RecordingMetadata = {
            id: recording.id,
            name: recording.name,
            timestamp: recording.timestamp,
            duration: recording.duration,
            format: recording.format,
            channelMode: recording.channelMode
          };
          
          await saveRecording(metadata, arrayBuffer);
          migratedCount++;
        } catch (error) {
          console.error(`Failed to migrate recording ${recording.id}:`, error);
          errors.push(error as Error);
        }
      }
      
      // Clear chrome.storage.local recordings after successful migration
      if (migratedCount > 0) {
        chrome.storage.local.remove(['savedRecordings'], () => {
          if (errors.length > 0) {
            console.warn(`Migrated ${migratedCount} recordings, ${errors.length} failed`);
          }
          resolve(migratedCount);
        });
      } else {
        resolve(0);
      }
    });
  });
}

