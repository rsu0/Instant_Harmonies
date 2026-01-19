#!/usr/bin/env python3
"""
Build Fingerprint Database for ATEPP_JI_Dataset

Builds fingerprint database and score mapping for the filtered dataset
with 100% MusicXML coverage.
"""

import os
import pickle
import sys

import pandas as pd
from tqdm import tqdm

sys.path.insert(0, 'MIDI-Zero-main')
from simple_ngram_fingerprinting import SimpleNGramFingerprinter, get_midi_files

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JI_DATASET_PATH = os.path.join(BASE_DIR, '..', 'ATEPP_JI_Dataset')
ATEPP_DATA_PATH = os.path.join(JI_DATASET_PATH, 'ATEPP-1.2')
METADATA_PATH = os.path.join(JI_DATASET_PATH, 'ATEPP-metadata-JI.csv')
OUTPUT_FINGERPRINT_DB = 'atepp_ji_fingerprint_database.pkl'
OUTPUT_SCORE_MAPPING = 'atepp_ji_score_mapping.pkl'


def main():
    print("=" * 70)
    print("ATEPP_JI_Dataset Fingerprint Database Builder")
    print("=" * 70)
    print()

    # Verify paths exist
    print("Configuration:")
    print(f"  Dataset path: {JI_DATASET_PATH}")
    print(f"  Data path: {ATEPP_DATA_PATH}")
    print(f"  Metadata: {METADATA_PATH}")
    print()

    if not os.path.exists(METADATA_PATH):
        print(f"ERROR: Metadata file not found: {METADATA_PATH}")
        print("Please ensure ATEPP_JI_Dataset is in the correct location.")
        sys.exit(1)

    if not os.path.exists(ATEPP_DATA_PATH):
        print(f"ERROR: Data directory not found: {ATEPP_DATA_PATH}")
        sys.exit(1)

    # ========================================================================
    # Step 1: Load metadata
    # ========================================================================
    print("Step 1: Loading ATEPP_JI_Dataset metadata...")
    df = pd.read_csv(METADATA_PATH)
    
    print(f"  ✓ Loaded {len(df):,} entries")
    print(f"  ✓ All entries have MusicXML scores (100% coverage)")
    print()

    # ========================================================================
    # Step 2: Verify files and build file lists
    # ========================================================================
    print("Step 2: Verifying files and building mappings...")
    
    valid_entries = []
    missing_files = []
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="  Verifying"):
        midi_rel = row['midi_path']
        score_rel = row['score_path']
        
        # Build full paths
        midi_path = os.path.join(ATEPP_DATA_PATH, midi_rel)
        score_path = os.path.join(ATEPP_DATA_PATH, score_rel)
        
        # Verify both files exist
        if os.path.exists(midi_path) and os.path.exists(score_path):
            valid_entries.append({
                'midi_path': midi_path,
                'score_path': score_path,
                'composer': row['composer'],
                'track': row['track'],
                'midi_filename': os.path.basename(midi_path)
            })
        else:
            missing_files.append((midi_rel, score_rel))
    
    print(f"  ✓ Valid entries: {len(valid_entries):,}")
    if missing_files:
        print(f"  ⚠ Missing files: {len(missing_files)}")
    print()

    # ========================================================================
    # Step 3: Build metadata mapping for display names
    # ========================================================================
    print("Step 3: Building metadata mapping...")
    
    metadata_map = {}
    for entry in valid_entries:
        filename = entry['midi_filename']
        display_name = f"{entry['composer']}: {entry['track']}"
        metadata_map[filename] = display_name
    
    print(f"  ✓ Created display names for {len(metadata_map):,} pieces")
    print()

    # ========================================================================
    # Step 4: Build fingerprint database
    # ========================================================================
    print("Step 4: Building fingerprint database...")
    print("  This may take 5-10 minutes depending on your machine...")
    print()
    
    midi_files = [entry['midi_path'] for entry in valid_entries]
    
    fingerprinter = SimpleNGramFingerprinter(n=4)
    fingerprinter.build_database(midi_files, metadata_map)
    
    # Save fingerprint database
    fingerprinter.save_database(OUTPUT_FINGERPRINT_DB)
    print()

    # ========================================================================
    # Step 5: Build score mapping
    # ========================================================================
    print("Step 5: Building score mapping...")
    
    score_mapping = {}
    for entry in valid_entries:
        score_mapping[entry['midi_filename']] = {
            'score_path': entry['score_path'],
            'composer': entry['composer'],
            'track': entry['track']
        }
    
    with open(OUTPUT_SCORE_MAPPING, 'wb') as f:
        pickle.dump(score_mapping, f)
    
    print(f"  ✓ Saved score mapping: {OUTPUT_SCORE_MAPPING}")
    print()

    # ========================================================================
    # Summary
    # ========================================================================
    print("=" * 70)
    print("DATABASE BUILD COMPLETE")
    print("=" * 70)
    print()
    print("Statistics:")
    print(f"  Total pieces: {len(valid_entries):,}")
    print(f"  Unique fingerprints: {len(fingerprinter.database):,}")
    print(f"  Score coverage: 100% (all pieces have MusicXML)")
    print()
    print("Output files:")
    print(f"  • {OUTPUT_FINGERPRINT_DB}")
    print(f"  • {OUTPUT_SCORE_MAPPING}")
    print()
    print("Next steps:")
    print("  1. Start the server with the new database files:")
    print(f"     python two_stage_server.py \\")
    print(f"       --fingerprint-db {OUTPUT_FINGERPRINT_DB} \\")
    print(f"       --score-mapping {OUTPUT_SCORE_MAPPING} \\")
    print(f"       --atepp-path ../ATEPP_JI_Dataset/ATEPP-1.2")
    print()
    print("  2. Or use the convenience script:")
    print("     ./start_ji_dataset_server.sh")
    print()
    print("=" * 70)


if __name__ == '__main__':
    main()
