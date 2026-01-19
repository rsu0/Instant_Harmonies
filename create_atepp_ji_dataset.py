#!/usr/bin/env python3
"""
Create ATEPP_JI_Dataset - Filtered Dataset for Just Intonation Research
========================================================================
This script creates a filtered version of ATEPP containing only pieces
with MusicXML scores, suitable for predictive JI tuning research.

Output:
- ATEPP_JI_Dataset/ATEPP-1.2/  (mirrored structure with only score-available pieces)
- ATEPP_JI_Dataset/ATEPP-metadata-JI.csv  (filtered metadata)
- ATEPP_JI_Dataset/README.md  (dataset documentation)
"""

import os
import sys
import shutil
import pandas as pd
from datetime import datetime
from pathlib import Path
from tqdm import tqdm

# Configuration
SOURCE_ATEPP = Path('/Users/ruisu/Desktop/phd/JustIntonation/THESIS/LR/Code/ATEPP-1.2')
SOURCE_METADATA = SOURCE_ATEPP / 'ATEPP-metadata-1.2.csv'
TARGET_DIR = Path('/Users/ruisu/Desktop/phd/JustIntonation/THESIS/LR/Code/ATEPP_JI_Dataset')
TARGET_DATA = TARGET_DIR / 'ATEPP-1.2'

print("=" * 70)
print("ATEPP_JI_DATASET CREATOR")
print("Filtered Dataset for Just Intonation Research")
print("=" * 70)
print()

# Step 1: Load and analyze metadata
print("Step 1: Loading ATEPP metadata...")
df = pd.read_csv(SOURCE_METADATA)

total_entries = len(df)
entries_with_scores = df['score_path'].notna().sum()

print(f"  Total ATEPP entries: {total_entries:,}")
print(f"  Entries with MusicXML scores: {entries_with_scores:,} ({entries_with_scores/total_entries*100:.1f}%)")
print()

# Step 2: Filter to entries with scores
print("Step 2: Filtering to entries with MusicXML scores...")
df_filtered = df[df['score_path'].notna()].copy()
print(f"  Filtered entries: {len(df_filtered):,}")
print()

# Step 3: Verify source files exist and build copy list
print("Step 3: Verifying source files exist...")
files_to_copy = []  # (source, dest) tuples
missing_files = []
valid_entries = []

for idx, row in tqdm(df_filtered.iterrows(), total=len(df_filtered), desc="  Verifying"):
    midi_rel = row['midi_path']
    score_rel = row['score_path']
    
    # Source paths (relative paths are under ATEPP-1.2/)
    midi_source = SOURCE_ATEPP / 'ATEPP-1.2' / midi_rel
    score_source = SOURCE_ATEPP / 'ATEPP-1.2' / score_rel
    
    # Check if both files exist
    midi_exists = midi_source.exists()
    score_exists = score_source.exists()
    
    if midi_exists and score_exists:
        # Destination paths (maintain same relative structure)
        midi_dest = TARGET_DATA / midi_rel
        score_dest = TARGET_DATA / score_rel
        
        files_to_copy.append((midi_source, midi_dest))
        files_to_copy.append((score_source, score_dest))
        valid_entries.append(idx)
    else:
        missing = []
        if not midi_exists:
            missing.append(f"MIDI: {midi_rel}")
        if not score_exists:
            missing.append(f"Score: {score_rel}")
        missing_files.extend(missing)

print(f"  ✓ Valid entries: {len(valid_entries):,}")
if missing_files:
    print(f"  ⚠ Missing files: {len(missing_files)}")
print()

# Deduplicate files (same score used by multiple performances)
unique_files = {}
for src, dest in files_to_copy:
    if str(dest) not in unique_files:
        unique_files[str(dest)] = (src, dest)

files_to_copy = list(unique_files.values())
print(f"  Unique files to copy: {len(files_to_copy):,}")
print()

# Step 4: Create target directory structure and copy files
print("Step 4: Creating ATEPP_JI_Dataset directory and copying files...")

# Create base directory
TARGET_DIR.mkdir(parents=True, exist_ok=True)

# Copy files
copied_count = 0
for src, dest in tqdm(files_to_copy, desc="  Copying"):
    # Create parent directories
    dest.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy file (if not already exists or is different)
    if not dest.exists():
        shutil.copy2(src, dest)
        copied_count += 1
    elif src.stat().st_size != dest.stat().st_size:
        shutil.copy2(src, dest)
        copied_count += 1

print(f"  ✓ Copied {copied_count:,} files")
print()

# Step 5: Create filtered metadata CSV
print("Step 5: Creating filtered metadata CSV...")

df_ji = df.loc[valid_entries].copy()

# Save filtered metadata
metadata_path = TARGET_DIR / 'ATEPP-metadata-JI.csv'
df_ji.to_csv(metadata_path, index=False)

print(f"  ✓ Saved: {metadata_path}")
print(f"  ✓ Entries in filtered metadata: {len(df_ji):,}")
print()

# Step 6: Generate statistics
print("Step 6: Generating dataset statistics...")

# Composer distribution
composer_counts = df_ji['composer'].value_counts()
unique_compositions = df_ji['composition_id'].nunique()
unique_scores = df_ji['score_path'].nunique()

# Step 7: Create README documentation
print("Step 7: Creating README documentation...")

readme_content = f"""# ATEPP_JI_Dataset
## Filtered Dataset for Just Intonation Research

**Created:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Purpose:** Real-time predictive Just Intonation tuning system

---

## Dataset Overview

This is a filtered subset of the ATEPP (Aligned Transcriptions of Expressive Piano Performance) dataset,
containing only entries that have MusicXML score files available. This ensures 100% score-following
coverage for the predictive JI tuning system.

| Metric | Value |
|--------|-------|
| Total MIDI performances | {len(df_ji):,} |
| Unique compositions | {unique_compositions:,} |
| Unique MusicXML scores | {unique_scores:,} |
| Composers | {len(composer_counts):,} |

## Coverage vs Full ATEPP

| Dataset | Entries | Coverage |
|---------|---------|----------|
| Full ATEPP | {total_entries:,} | 100% |
| ATEPP_JI_Dataset | {len(df_ji):,} | {len(df_ji)/total_entries*100:.1f}% |

## Composer Distribution

| Composer | Performances |
|----------|--------------|
"""

for composer, count in composer_counts.head(15).items():
    readme_content += f"| {composer} | {count:,} |\n"

if len(composer_counts) > 15:
    readme_content += f"| ... and {len(composer_counts) - 15} more | ... |\n"

readme_content += f"""
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
    print(f"MIDI: {{midi_path}}")
    print(f"Score: {{score_path}}")
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
"""

readme_path = TARGET_DIR / 'README.md'
with open(readme_path, 'w') as f:
    f.write(readme_content)

print(f"  ✓ Saved: {readme_path}")
print()

# Final summary
print("=" * 70)
print("ATEPP_JI_DATASET CREATION COMPLETE")
print("=" * 70)
print()
print(f"Location: {TARGET_DIR}")
print()
print("Contents:")
print(f"  📁 ATEPP-1.2/           ({len(files_to_copy):,} files)")
print(f"  📄 ATEPP-metadata-JI.csv ({len(df_ji):,} entries)")
print(f"  📄 README.md            (documentation)")
print()
print("Statistics:")
print(f"  MIDI performances: {len(df_ji):,}")
print(f"  Unique compositions: {unique_compositions:,}")
print(f"  Unique MusicXML scores: {unique_scores:,}")
print(f"  Composers: {len(composer_counts):,}")
print()
print("Top 5 composers by performance count:")
for composer, count in composer_counts.head(5).items():
    print(f"  • {composer}: {count:,} performances")
print()
print("=" * 70)
print("✓ Dataset ready for use with predictive JI tuning system!")
print("=" * 70)

