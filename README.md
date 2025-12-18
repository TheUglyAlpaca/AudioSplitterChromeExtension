# Audio Splitter Chrome Extension

A Chrome extension for recording browser audio output with waveform visualization, playback controls, and format conversion capabilities.

![Extension Screenshot](./Screenshot%202025-12-18%20at%2012.32.43%20AM.png)

## Features

### Recording
- **Automatic Tab Audio Capture**: Records audio from the current Chrome tab automatically without requiring user selection
- **Non-Muting Recording**: Audio continues to play through your speakers/headphones while recording
- **Background Recording**: Recording continues even when the extension popup is closed
- **Real-time Waveform Visualization**: See live waveform visualization while recording
- **Interactive Waveform**: After recording, scrub through the waveform by clicking to seek playback

### Playback & Controls
- **Play/Pause Controls**: Standard audio playback controls
- **Waveform Scrubbing**: Click anywhere on the waveform to seek to that position
- **Smooth Playhead**: Interpolated playhead movement for smooth visual updates
- **Zoom Controls**: Zoom in/out on the waveform for detailed viewing
- **Return to Start**: Reset playback position to the beginning
- **Loop Playback**: Toggle loop mode for continuous playback

### Format & Preferences
- **Multiple Format Support**: Record and export in WAV, WEBM, MP3, or OGG formats
- **Format Conversion**: Automatic conversion between formats when preferences change
- **Sample Rate Selection**: Choose from 44.1kHz, 48kHz, 96kHz, or 192kHz
- **Channel Mode**: Select mono or stereo recording
- **Tab Title Naming**: Optional automatic naming using the current tab title
- **Persistent Preferences**: All settings are saved and persist across sessions

### Recent Recordings
- **Recording History**: Automatically saves recordings to a "Recent Recordings" section
- **Quick Access**: View and manage up to 50 recent recordings
- **Play from History**: Click any recording to load and play it
- **Download Recordings**: Download recordings in your preferred format
- **Delete Recordings**: Remove recordings from history

### UI/UX
- **Modern Design**: Sleek, clean interface with Inter font
- **Dark/Light Mode**: Toggle between dark and light themes
- **No Scrolling Required**: Optimized layout that fits within the extension popup
- **Status Indicators**: Visual feedback for recording state and active recordings

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Build Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd AudioSplitterChromeExtension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` directory from this project

## Usage

### Recording Audio

1. **Start Recording**:
   - Click the extension icon in Chrome's toolbar
   - Click the red circular record button
   - The button transforms into a square stop button while recording

2. **During Recording**:
   - Audio continues playing normally (not muted)
   - Real-time waveform visualization appears
   - Recording continues even if you close the popup

3. **Stop Recording**:
   - Click the square stop button
   - The full waveform appears
   - Recording is automatically saved to Recent Recordings

### Playing Recordings

- **Play/Pause**: Use the play button in the controls
- **Seek**: Click anywhere on the waveform to jump to that position
- **Zoom**: Use the zoom in/out buttons to adjust waveform detail
- **Reset**: Click the return-to-start button to reset playback position
- **Loop**: Toggle the loop button for continuous playback

### Managing Recordings

- **View Recent Recordings**: Click the "Recent Recordings" tab
- **Play a Recording**: Click on any recording in the list
- **Download**: Click the download icon to save the recording
- **Delete**: Click the trash icon to remove a recording

### Preferences

- **Access Settings**: Click the "Preferences" tab
- **Change Format**: Select from WAV, WEBM, MP3, or OGG
- **Adjust Sample Rate**: Choose your preferred sample rate
- **Set Channel Mode**: Select mono or stereo
- **Tab Title Naming**: Toggle automatic naming from tab title

**Note**: When you change the format preference, all existing recordings are automatically converted to the new format.

## Technical Details

### Architecture

- **Frontend**: React + TypeScript
- **Build Tool**: Webpack
- **Chrome APIs**: 
  - `chrome.tabCapture` - For capturing tab audio
  - `chrome.storage.local` - For persisting recordings and preferences
  - `chrome.tabs` - For accessing current tab information

### Storage

Recordings are stored in Chrome's local storage (`chrome.storage.local`) under the key `savedRecordings`. Each recording includes:
- Unique ID
- Name (without file extension in UI)
- Timestamp
- Duration
- Audio data (as numeric array)
- Format preference

**Storage Limits**:
- Maximum 50 recordings stored
- Older recordings are automatically removed when limit is reached
- Chrome storage quota applies (typically 10MB per extension)

### Audio Format Conversion

The extension uses the Web Audio API to convert audio between formats:
- **WAV**: Full conversion to PCM 16-bit format
- **WEBM**: Native MediaRecorder support
- **OGG**: Native MediaRecorder support (browser dependent)
- **MP3**: Currently converts to WAV (MP3 encoding requires additional libraries)

### Permissions

The extension requires the following permissions:
- `tabCapture` - To capture audio from browser tabs
- `tabs` - To access current tab information
- `storage` - To save recordings and preferences
- `activeTab` - To interact with the current active tab

## Development

### Project Structure

```
AudioSplitterChromeExtension/
├── src/
│   ├── popup/
│   │   ├── Popup.tsx              # Main popup component
│   │   ├── components/            # UI components
│   │   │   ├── RecordButton.tsx
│   │   │   ├── Waveform.tsx
│   │   │   ├── RecordingControls.tsx
│   │   │   ├── AudioInfo.tsx
│   │   │   ├── RecentRecordings.tsx
│   │   │   └── Preferences.tsx
│   │   ├── hooks/                 # React hooks
│   │   │   ├── useAudioRecorder.ts
│   │   │   └── useWaveform.ts
│   │   ├── utils/                 # Utility functions
│   │   │   ├── audioUtils.ts
│   │   │   ├── audioConverter.ts
│   │   │   └── formatUtils.ts
│   │   └── styles/
│   │       └── popup.css
│   └── background/
│       └── background.ts          # Background service worker
├── public/
│   ├── popup.html
│   └── icons/                     # Extension icons
├── manifest.json                  # Extension manifest
├── webpack.config.js              # Webpack configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json
```

### Available Scripts

- `npm run build` - Build the extension for production
- `npm run dev` - Build in development mode with watch
- `npm run clean` - Remove the dist directory
- `npm run generate-icons` - Generate placeholder icons

### Building

The build process:
1. Generates placeholder icons (if needed)
2. Compiles TypeScript to JavaScript
3. Bundles React components with Webpack
4. Copies manifest.json and icons to dist directory

Output is in the `dist/` directory, which is what you load into Chrome.

## Known Limitations

1. **MP3 Format**: MP3 encoding is not fully implemented - recordings are converted to WAV format instead
2. **Storage Quota**: Limited by Chrome's storage quota (typically 10MB)
3. **Recording Limit**: Maximum of 50 recordings stored
4. **Format Conversion**: Converting existing recordings to a new format can take time for large files

## Future Enhancements

- Full MP3 encoding support
- Export recordings directly to file system
- Cloud storage integration
- Audio editing capabilities
- Integration with Meta SAM audio isolation model

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
