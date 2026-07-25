# Ondine

A modern desktop application for learning and visualizing piano music with real-time playback, live input support, and professional video export.

![Ondine](https://img.shields.io/badge/platform-macOS%20|%20Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6)

## Features

### 🎹 Playback & Visualization
- **Interactive Piano Visualizer** — Watch notes fall onto a scrolling piano like Guitar Hero, with support for tempo changes, looping, and playback speed control
- **MIDI File Support** — Load any standard `.mid` file and see it rendered in real time
- **Multi-Track Rendering** — View all tracks simultaneously or mute individual tracks during playback
- **Camera Controls** — Zoom the highway and scroll through large pieces
- **Metronome** — Fixed-tempo click track independent of song speed

### 🎓 Practice Mode
- **Error Detection** — Play along with a song and get real-time feedback on mistakes
- **Customizable Hand Targets** — Practice left hand, right hand, or both
- **Performance Metrics** — Track accuracy and progress over time

### 🎤 Live Mode
- **Real-Time Input** — Connect a MIDI keyboard and watch notes appear live
- **Recording** — Capture your playing as a MIDI file to replay later or convert to a new track
- **Interactive Visualization** — See live notes stream upward in real time

### 📹 Export
- **Video Export** — Record playback as MP4/WebM with synchronized audio
- **GIF Export** — Create animated GIFs of specific sections
- **PNG Sequence** — Export frame-by-frame for custom post-processing
- **Sheet Music** — Export as PDF notation for study
- **MIDI Export** — Save any recording or loaded song
- **Flexible Resolution** — Support for 720p through 8K at 24–120 fps
- **Early Finish** — Stop recording mid-export and save what you've captured so far

### 🎨 Customization
- **Background Themes** — Matte, Aurora, Nebula, and Midnight styles
- **Color Schemes** — Left/right hand gradients, accent colors, keyboard styling
- **UI Transparency** — Adjust panel opacity to your preference
- **Persistent Settings** — All preferences saved across sessions

## System Requirements

- **Windows** 10 or later
- **macOS** 10.15 or later (Intel or Apple Silicon)
- **4 GB RAM** minimum (8 GB recommended for 4K+ export)
- **MIDI Keyboard** (optional, for Live mode)

## Installation

### Download
Pre-built installers and apps are available on the [Releases](https://github.com/AhmedAmer29/ondine/releases) page.

**Windows:** Download `.exe` or `.msi` installer  
**macOS:** Download `.dmg` or `.app` bundle

### From Source

**Prerequisites:**
- Node.js 18+
- Rust 1.70+ (with `rustup`)

**Setup:**
```bash
git clone https://github.com/AhmedAmer29/ondine.git
cd ondine
npm install
npm run tauri dev
```

**Build:**
```bash
npm run build
npm run tauri build
```

Compiled binaries will be in `src-tauri/target/release/bundle/`.

## Usage

### 1. Play Mode
- Drag & drop a MIDI file or use File → Open
- Click Play to watch the visualization
- Adjust playback speed, zoom, and loop range
- Mute individual tracks in the Customization panel

### 2. Practice Mode
- Load a song in Play mode, then switch to Learn
- Select hand mode (Left, Right, or Both) and start practicing
- Mistakes appear highlighted in real time
- Use countdown to prepare before the song starts

### 3. Live Mode
- Connect a MIDI keyboard
- Click Record to start capturing
- Play on your keyboard and watch notes appear
- Stop Recording to convert your performance to a saved song

### 4. Export
- Open the Export panel
- Choose format (MP4, GIF, PNG Sequence)
- Set resolution, frame rate, bitrate, and time range
- Click "Export" and monitor progress
- Use "Finish" button in video export to stop early and save

### 5. Customize
- Open the Customization panel (note icon)
- Adjust background, keyboard, hand colors, and UI transparency
- Toggle effects like light rays, particles, and vignette

## Architecture

```
src/
├── App.tsx                 # Main app component and routing
├── components/             # React UI components
├── panels/                 # Collapsible settings panels
├── hooks/                  # Custom React hooks for state management
├── state/                  # Zustand stores (song, playback, export, etc.)
├── renderer/               # PixiJS-based visualization layers
│   ├── PianoFlowRenderer   # Main song player visualization
│   ├── LivePianoRenderer   # Live mode visualization
│   ├── BackgroundLayer     # Animated background effects
│   └── layers/             # Keyboard, notes, hit effects
├── audio/                  # Tone.js audio engine
│   ├── PlaybackEngine      # Song playback and transport control
│   ├── instrument.ts       # Piano voice synthesis
│   └── metronome.ts        # Click track generation
├── export/                 # Video/GIF/PNG exporters
├── midi/                   # MIDI parsing and music theory utilities
├── practice/               # Practice mode engine and scoring
├── live/                   # Live input recording and synthesis
├── notation/               # Sheet music PDF generation
└── utils/                  # Helpers (file I/O, colors, etc.)
```

### Technology Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS, Framer Motion
- **Rendering:** PixiJS (WebGL)
- **Audio:** Tone.js, Web Audio API
- **Desktop:** Tauri 2 (Rust backend)
- **Build:** Vite, Rollup
- **Linting:** Oxlint

## Development

### Running in Dev Mode
```bash
npm run tauri dev
```

Vite dev server runs on `http://localhost:1420` with hot module replacement. The Tauri backend auto-reloads on Rust changes.

### Building & Testing
```bash
npm run lint        # Check code with Oxlint
npm run build       # Compile TypeScript and Vite bundle
npm run tauri build # Package native app
```

### Key Concepts

**Stores (Zustand)**
- `songStore` — Current loaded song and playback state
- `playbackStore` — Transport (play/pause/seek), metronome, loop
- `customizationStore` — User preferences (colors, effects, UI)
- `exportStore` — Export progress, settings, cancellation
- `practiceStore` — Practice mode state and judgements

**Rendering Loop**
- `PianoFlowRenderer` polls `PlaybackEngine.getCurrentTime()` every frame
- `SongQuery.getActiveNotesAt()` derives active notes without events
- Layers (keyboard, notes, hit effects, background) render each frame
- No React re-render—performance-critical rendering is pure Pixi

**MIDI Processing**
- `parseMidi()` converts raw MIDI to a normalized `ParsedSong` structure
- `SongQuery` indexes notes for O(1) time lookup without polling
- `synthesizeSongFromRecording()` converts live input to a playable song

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes with clear messages
4. Push to your branch and open a Pull Request

During development, keep the following in mind:
- Use TypeScript strict mode
- Run `npm run lint` before committing
- Add/update tests for new features
- Update documentation for UI or API changes
- Ensure video export works at multiple resolutions before submitting

## Troubleshooting

### MIDI File Won't Load
- Ensure the file is a valid `.mid` format
- Check browser console (F12) for parsing errors
- Try converting the file with a tool like MuseScore

### Video Export Fails
- Lower resolution or frame rate
- Reduce bitrate (try 20 Mbps)
- Ensure your graphics driver is up to date
- Check available disk space

### No MIDI Input in Live Mode
- Verify MIDI keyboard is connected and powered on
- Check OS MIDI settings (Windows: MIDI Mapper, macOS: Audio/MIDI Setup)
- Reload the app if the keyboard was connected after launch
- Try a different USB port

### Audio Crackling/Latency
- Close other audio applications
- Update audio drivers
- Reduce buffer size in system settings (if available)

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Tone.js](https://tonejs.org/) — Audio synthesis and scheduling
- [PixiJS](https://pixijs.com/) — GPU-accelerated rendering
- [Tauri](https://tauri.app/) — Lightweight desktop framework
- [Zustand](https://zustand-demo.vercel.app/) — State management
- [VexFlow](https://www.vexflow.com/) — Music notation rendering

## Roadmap

- [ ] Linux support
- [ ] Chord detection and real-time hand suggestion
- [ ] Audio input (microphone recognition)
- [ ] Online song library and community uploads
- [ ] Collaborative practice sessions
- [ ] Mobile companion app for remote playback control
- [ ] Neural network-based hand movement prediction

## Support

Found a bug or have a feature request? Please [open an issue](https://github.com/AhmedAmer29/ondine/issues) on GitHub.

For questions and discussion, join our [Discord](https://discord.gg/your-invite-link) or check [Discussions](https://github.com/AhmedAmer29/ondine/discussions).

---

**Happy practicing!** 🎹✨
