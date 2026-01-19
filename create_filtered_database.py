#!/usr/bin/env python3
"""
Create Filtered ATEPP Database - Only Pieces with MusicXML Scores
For reliable score following and predictive JI tuning
"""

import pandas as pd
import os
import sys
from simple_ngram_fingerprinting import SimpleNGramFingerprinter
from tqdm import tqdm

print("="*70)
print("CREATING FILTERED ATEPP DATABASE (MusicXML Scores Only)")
print("="*70)
print()

# Load metadata
print("Step 1: Loading metadata...")
metadata_path = 'ATEPP_JI_Dataset/ATEPP-metadata-JI.csv'
df = pd.read_csv(metadata_path)

total_tracks = len(df)
with_scores = df['score_path'].notna().sum()

print(f"  Total ATEPP tracks: {total_tracks}")
print(f"  Tracks with MusicXML scores: {with_scores} ({with_scores/total_tracks*100:.1f}%)")
print()

# Filter to only entries with scores
print("Step 2: Filtering to entries with scores...")
df_with_scores = df[df['score_path'].notna()].copy()

# Verify score files exist
print("Step 3: Verifying score files exist...")
valid_entries = []
atepp_base = 'ATEPP_JI_Dataset/ATEPP-1.2'

for idx, row in tqdm(df_with_scores.iterrows(), total=len(df_with_scores), desc="Verifying"):
    # CORRECTED: Both paths are relative and go under ATEPP-1.2/ATEPP-1.2/
    score_path = os.path.join(atepp_base, row['score_path'])
    midi_path = os.path.join(atepp_base, row['midi_path'])
    
    # Check both files exist
    if os.path.exists(score_path) and os.path.exists(midi_path):
        valid_entries.append({
            'midi_path': midi_path,
            'score_path': score_path,
            'composer': row['composer'],
            'track': row['track'],
            'midi_filename': os.path.basename(midi_path)
        })

print(f"  ✓ Verified {len(valid_entries)} valid pairs (MIDI + MusicXML)")
print()

# Build filtered fingerprint database
print("Step 4: Building filtered fingerprint database...")
print(f"  Processing {len(valid_entries)} pieces with scores...")
print()

fingerprinter = SimpleNGramFingerprinter(n=4)

# Create metadata mapping
metadata_map = {}
for entry in valid_entries:
    filename = entry['midi_filename']
    display_name = f"{entry['composer']}: {entry['track']}"
    metadata_map[filename] = display_name

# Get MIDI file paths
midi_files = [entry['midi_path'] for entry in valid_entries]

# Build database
fingerprinter.build_database(midi_files, metadata_map)

# Save filtered database
output_path = 'atepp_filtered_database.pkl'
fingerprinter.save_database(output_path)

# Save mapping information
print()
print("Step 5: Saving score mapping...")
import pickle

score_mapping = {}
for entry in valid_entries:
    score_mapping[entry['midi_filename']] = {
        'score_path': entry['score_path'],
        'composer': entry['composer'],
        'track': entry['track']
    }

with open('atepp_score_mapping.pkl', 'wb') as f:
    pickle.dump(score_mapping, f)

print(f"  ✓ Saved score mapping for {len(score_mapping)} pieces")
print()

# Statistics
print("="*70)
print("FILTERED DATABASE COMPLETE")
print("="*70)
print(f"Pieces with scores: {len(valid_entries)}")
print(f"Unique fingerprints: {len(fingerprinter.database):,}")
print(f"Database file: {output_path}")
print(f"Score mapping: atepp_score_mapping.pkl")
print()
print("✓ This filtered database ensures 100% score following coverage!")
print("✓ All identified pieces will have MusicXML scores available")
print("="*70)

