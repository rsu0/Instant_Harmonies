#!/usr/bin/env python3
"""
Build ATEPP Fingerprint Database
Generates key-aware n-gram fingerprints for all ATEPP pieces
"""

import os
import sys

import pandas as pd

sys.path.insert(0, 'MIDI-Zero-main')
from simple_ngram_fingerprinting import SimpleNGramFingerprinter, get_midi_files

print("="*70)
print("ATEPP FINGERPRINT DATABASE BUILDER")
print("="*70)
print()

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ATEPP_PATH = os.path.join(BASE_DIR, 'ATEPP-1.2', 'ATEPP-1.2')
METADATA_PATH = os.path.join(BASE_DIR, 'ATEPP-1.2', 'ATEPP-metadata-1.2.csv')
OUTPUT_DB = "atepp_fingerprint_database.pkl"

print("Configuration:")
print(f"  ATEPP path: {ATEPP_PATH}")
print(f"  Metadata: {METADATA_PATH}")
print(f"  Output: {OUTPUT_DB}")
print()

# Step 1: Load ATEPP MIDI files
print("Step 1: Loading ATEPP MIDI files...")
midi_files = get_midi_files(ATEPP_PATH)
print(f"  ✓ Found {len(midi_files)} MIDI files")
print()

# Step 2: Load metadata
print("Step 2: Loading metadata...")
try:
    df = pd.read_csv(METADATA_PATH)
    metadata_map = {}
    
    for _, row in df.iterrows():
        midi_path = row['midi_path']
        if pd.notna(midi_path):
            filename = os.path.basename(midi_path)
            composer = row.get('composer', '')
            track = row.get('track', '')
            
            if composer and track:
                display_name = f"{composer}: {track}"
            else:
                display_name = filename.replace('.mid', '')
            
            metadata_map[filename] = display_name
    
    print(f"  ✓ Loaded metadata for {len(metadata_map)} compositions")
except Exception as e:
    print(f"  ⚠ Warning: Could not load metadata: {e}")
    metadata_map = {}

print()

# Step 3: Build fingerprint database
print("Step 3: Building fingerprint database...")
print("  This will take ~10-15 minutes on M4")
print()

fingerprinter = SimpleNGramFingerprinter(n=4)
fingerprinter.build_database(midi_files, metadata_map)

print()

# Step 4: Save database
print("Step 4: Saving database...")
fingerprinter.save_database(OUTPUT_DB)

# Statistics
print()
print("="*70)
print("DATABASE STATISTICS")
print("="*70)
print(f"Total pieces: {len(set(piece for fp_dict in fingerprinter.database.values() for piece in fp_dict))}")
print(f"Total unique fingerprints: {len(fingerprinter.database):,}")
print(f"Database file: {OUTPUT_DB}")
print()
print("✓ ATEPP fingerprint database ready!")
print("✓ Can now identify pieces with key-aware matching!")
print("="*70)

