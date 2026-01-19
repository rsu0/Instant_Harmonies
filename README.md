# Just Intonation Tuner

A real-time adaptive just intonation tuning system for MIDI instruments with two-stage predictive tuning using music fingerprinting and score following.

## Features

- **Real-time MIDI Tuning**: Apply just intonation tuning to live MIDI input
- **Key Detection**: Automatic key detection using ensemble methods
- **Two-Stage Predictive System**:
  - Stage 1: N-gram fingerprint identification to recognize the piece being played
  - Stage 2: Score following with Parangonar for predictive note tuning
- **MusicXML Key Signatures**: Extract authentic key information from scores
- **Multiple Tuning Modes**: Support for MTS (MIDI Tuning Standard) and MPE (MIDI Polyphonic Expression)
- **MIDI Recording**: Record performances with JI tuning applied
- **File Tuning**: Apply JI tuning to existing MIDI files with export to MIDI 1.0 or MIDI 2.0

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Frontend                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │   MIDI   │  │   Key    │  │  Tuning  │  │    Recording     ││
│  │  Input   │  │Detection │  │  Engine  │  │    & Export      ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
└───────┼─────────────┼─────────────┼─────────────────┼──────────┘
        │             │             │                 │
        └─────────────┴──────┬──────┴─────────────────┘
                             │ WebSocket
        ┌────────────────────┴────────────────────┐
        │         Two-Stage Python Server          │
        │  ┌──────────────┐  ┌──────────────────┐ │
        │  │  Fingerprint │  │  Score Following │ │
        │  │ Identification│  │   (Parangonar)  │ │
        │  └──────────────┘  └──────────────────┘ │
        └─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js (optional, for development)
- Web browser with Web MIDI API support (Chrome/Edge recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rsu0/Instant_Harmonies.git
cd Instant_Harmonies
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Download the ATEPP dataset (optional, for piece identification):
   - Place the ATEPP-1.2 dataset in `ATEPP_JI_Dataset/ATEPP-1.2/`
   - Or build your own fingerprint database

4. Build the fingerprint database (if using piece identification):
```bash
python build_atepp_fingerprint_db.py
```

### Running the System

**Option 1: Full system with piece identification**
```bash
./start_all.sh
```

**Option 2: Frontend only (no piece identification)**
Simply open `index.html` in a browser with Web MIDI support.

**Option 3: Manual start**
```bash
# Start the two-stage server
python two_stage_server.py --port 5005

# Open index.html in browser
```

## Project Structure

```
├── index.html                    # Main web application
├── js/                           # JavaScript modules
│   ├── main.js                   # Application entry point
│   ├── audio-engine.js           # Web Audio synthesis
│   ├── key-detection.js          # Key detection algorithms
│   ├── tuning-core.js            # JI ratio calculations
│   ├── tuning-mts.js             # MTS SysEx implementation
│   ├── tuning-mpe.js             # MPE pitch bend implementation
│   ├── midi-parser.js            # MIDI file parsing
│   ├── midi-writer.js            # MIDI file export
│   ├── midi-file-tuner.js        # Apply JI to MIDI files
│   ├── midi-recorder.js          # Live performance recording
│   └── latency-metrics.js        # Performance monitoring
├── two_stage_server.py           # Python WebSocket server
├── two_stage_client.js           # WebSocket client
├── simple_ngram_fingerprinting.py # Fingerprint algorithm
├── build_atepp_fingerprint_db.py  # Database builder
├── create_atepp_ji_dataset.py     # Dataset creation
├── create_filtered_database.py    # Database filtering
├── start_all.sh                   # Startup script
├── requirements.txt               # Python dependencies
├── justkeydding-master/           # Key detection library
├── parangonar-main/               # Score following library
└── partitura-main/                # Music parsing library
```

## Usage

### Real-time Tuning

1. Connect a MIDI keyboard
2. Select input/output devices in the web interface
3. Click "Start" to begin tuning
4. Play - the system will detect keys and apply JI tuning

### File Tuning

1. Click "Select MIDI File" and choose a .mid file
2. Select auto-detect or manual key
3. Click "Apply Tuning"
4. Download the tuned MIDI file

### Recording

1. Click "Record" to start recording your performance
2. Play with JI tuning applied in real-time
3. Click "Stop" when finished
4. Download as MIDI 1.0 (with MTS) or MIDI 2.0

## Dependencies

### Python
- Flask & Flask-SocketIO (WebSocket server)
- Parangonar (score following)
- Partitura (music parsing)
- pretty_midi (MIDI processing)
- NumPy, Pandas, PyTorch

### JavaScript (no build required)
- All modules are vanilla ES6, no bundler needed

## External Libraries

This project includes the following external libraries:

- **justkeydding**: Key detection (C++ with Python bindings)
- **parangonar**: Real-time score following
- **partitura**: MusicXML/MIDI parsing

## License

MIT License

## Acknowledgments

- ATEPP Dataset for piano performance data
- Parangonar for score following algorithms
- Partitura for music parsing utilities
