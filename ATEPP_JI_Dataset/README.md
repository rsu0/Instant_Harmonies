# ATEPP_JI_Dataset
## Filtered Dataset for Just Intonation Research

**Created:** 2025-12-13 15:06:16
**Purpose:** Real-time predictive Just Intonation tuning system

---

## Dataset Overview

This is a filtered subset of the ATEPP (Aligned Transcriptions of Expressive Piano Performance) dataset,
containing only entries that have MusicXML score files available. This ensures 100% score-following
coverage for the predictive JI tuning system.

| Metric | Value |
|--------|-------|
| Total MIDI performances | 5,091 |
| Unique compositions | 319 |
| Unique MusicXML scores | 319 |
| Composers | 13 |

## Coverage vs Full ATEPP

| Dataset | Entries | Coverage |
|---------|---------|----------|
| Full ATEPP | 11,674 | 100% |
| ATEPP_JI_Dataset | 5,091 | 43.6% |

## Composer Distribution

| Composer | Performances |
|----------|--------------|
| Ludwig van Beethoven | 3,032 |
| Wolfgang Amadeus Mozart | 653 |
| Franz Schubert | 264 |
| Claude Debussy | 254 |
| Robert Schumann | 241 |
| Johann Sebastian Bach | 227 |
| Maurice Ravel | 169 |
| Franz Liszt | 122 |
| Sergei Rachmaninoff | 77 |
| Franz Joseph Haydn | 27 |
| Alexander Scriabin | 15 |
| Johannes Brahms | 6 |
| Domenico Scarlatti | 4 |

## Directory Structure

```
ATEPP_JI_Dataset/
├── ATEPP-1.2/
│   ├── Ludwig_van_Beethoven/
│   │   ├── Piano_Sonata_No._8_in_C_Minor,_Op._13_"Pathétique"/
│   │   │   ├── I._Grave_-_Allegro_di_molto_e_con_brio/
│   │   │   │   ├── musicxml_cleaned.musicxml  (score)
│   │   │   │   ├── 00001.mid  (performance 1)
│   │   │   │   ├── 00002.mid  (performance 2)
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   ├── Johann_Sebastian_Bach/
│   │   └── ...
│   └── ...
├── ATEPP-metadata-JI.csv  (filtered metadata)
└── README.md  (this file)
```

## File Formats

- **MIDI files**: `.mid` or `.midi` - Piano performance transcriptions
- **MusicXML files**: `.musicxml` or `.mxl` - Score files with key signatures

## Usage

### Loading the dataset:

```python
import pandas as pd
from pathlib import Path

# Load metadata
DATASET_PATH = Path('/Users/ruisu/Desktop/phd/JustIntonation/THESIS/LR/Code/ATEPP_JI_Dataset')
df = pd.read_csv(DATASET_PATH / 'ATEPP-metadata-JI.csv')

# Get file paths
for idx, row in df.iterrows():
    midi_path = DATASET_PATH / 'ATEPP-1.2' / row['midi_path']
    score_path = DATASET_PATH / 'ATEPP-1.2' / row['score_path']
    print(f"MIDI: {midi_path}")
    print(f"Score: {score_path}")
```

### Building fingerprint database:

```bash
cd prototype081225_datasets_test
python create_filtered_database.py --atepp-path ../ATEPP_JI_Dataset
```

## Metadata Columns

| Column | Description |
|--------|-------------|
| artist | Performer name |
| artist_id | Unique performer identifier |
| track | Piece/movement name |
| track_duration | Duration in seconds |
| composer | Composer name |
| composition_id | Unique composition identifier |
| score_path | Relative path to MusicXML file |
| midi_path | Relative path to MIDI file |
| youtube_links | Source YouTube URL |
| quality | Recording quality notes |
| perf_id | Unique performance identifier |
| album | Source album |
| album_date | Album release date |
| repetition | Repeat marking (if any) |

## Source

Original dataset: ATEPP 1.2
Reference: Zhang, D., Su, Y., & Gómez, E. (2022). ATEPP: A Dataset of Aligned 
Transcriptions of Expressive Piano Performance. ISMIR 2022.

---

*This filtered dataset was created for PhD research on real-time Just Intonation tuning.*
