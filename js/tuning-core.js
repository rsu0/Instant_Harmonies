// Tuning Core - 5-limit Just Intonation ratios and conversion utilities
// 5-limit JI uses factors of 2, 3, and 5 only, giving pure thirds and fifths

import { NOTE_NAMES } from './key-detection.js';

export const JI_RATIOS = {
    major: {
        0: 1/1,      // Unison
        1: 16/15,    // Minor 2nd
        2: 9/8,      // Major 2nd
        3: 6/5,      // Minor 3rd
        4: 5/4,      // Major 3rd
        5: 4/3,      // Perfect 4th
        6: 45/32,    // Tritone
        7: 3/2,      // Perfect 5th
        8: 8/5,      // Minor 6th
        9: 5/3,      // Major 6th
        10: 9/5,     // Minor 7th
        11: 15/8,    // Major 7th
        12: 2/1      // Octave
    },
    minor: {
        0: 1/1,
        1: 16/15,
        2: 9/8,
        3: 6/5,
        4: 5/4,
        5: 4/3,
        6: 45/32,
        7: 3/2,
        8: 8/5,
        9: 5/3,
        10: 16/9,    // Minor 7th (different from major)
        11: 15/8,
        12: 2/1
    }
};

const KEY_ROOTS = {
    'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63,
    'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68,
    'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71,
    'Cm': 60, 'C#m': 61, 'Dm': 62, 'D#m': 63, 'Ebm': 63,
    'Em': 64, 'Fm': 65, 'F#m': 66, 'Gm': 67, 'G#m': 68,
    'Am': 69, 'A#m': 70, 'Bbm': 70, 'Bm': 71
};

export function getKeyRoot(keyName) {
    return KEY_ROOTS[keyName] || 60;
}

export function isMinorKey(keyName) {
    return keyName && keyName.includes('m');
}

// Standard pitch bend range: ±2 semitones = ±200 cents
// MIDI pitch bend range: -8192 to +8191

export function centsToPitchBend(cents) {
    const pitchBend = Math.round((cents / 200) * 8192);
    return Math.max(-8192, Math.min(8191, pitchBend));
}

export function pitchBendToCents(pitchBend) {
    return (pitchBend / 8192) * 200;
}

// Calculate how many cents a JI ratio differs from equal temperament
export function ratioToCentsDeviation(ratio, interval) {
    const jiCents = 1200 * Math.log2(ratio);
    const etCents = interval * 100;
    return jiCents - etCents;
}

export function calculateJICentsForNote(midiNote, keyName) {
    const keyRoot = getKeyRoot(keyName);
    const ratios = isMinorKey(keyName) ? JI_RATIOS.minor : JI_RATIOS.major;
    const interval = (midiNote - keyRoot + 144) % 12;
    const ratio = ratios[interval] || 1.0;
    
    return ratioToCentsDeviation(ratio, interval);
}

export function calculateJIPitchBend(midiNote, keyName) {
    const cents = calculateJICentsForNote(midiNote, keyName);
    return centsToPitchBend(cents);
}

// Generate 12-note scale tuning array for MTS (cents deviation per pitch class)
export function calculateScaleOctaveTuning(keyRoot, isMinor) {
    const ratios = isMinor ? JI_RATIOS.minor : JI_RATIOS.major;
    const centsArray = new Array(12).fill(0);
    
    for (let pc = 0; pc < 12; pc++) {
        const interval = (pc - (keyRoot % 12) + 12) % 12;
        const ratio = ratios[interval] || 1.0;
        const jiCents = 1200 * Math.log2(ratio);
        const etCents = interval * 100;
        const deviation = jiCents - etCents;
        centsArray[pc] = Math.round(deviation * 100) / 100;
    }
    
    return centsArray;
}

const INTERVAL_NAMES = [
    'Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 
    'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th',
    'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'
];

export function getIntervalInfo(interval, isMinor = false) {
    const ratios = isMinor ? JI_RATIOS.minor : JI_RATIOS.major;
    const ratio = ratios[interval] || 1.0;
    const deviation = ratioToCentsDeviation(ratio, interval);
    
    return {
        name: INTERVAL_NAMES[interval],
        ratio,
        ratioString: ratioToString(ratio),
        cents: Math.round(deviation * 100) / 100
    };
}

function ratioToString(ratio) {
    const knownRatios = {
        [1/1]: '1/1', [16/15]: '16/15', [9/8]: '9/8', [6/5]: '6/5',
        [5/4]: '5/4', [4/3]: '4/3', [45/32]: '45/32', [3/2]: '3/2',
        [8/5]: '8/5', [5/3]: '5/3', [9/5]: '9/5', [16/9]: '16/9',
        [15/8]: '15/8', [2/1]: '2/1'
    };
    
    return knownRatios[ratio] || ratio.toFixed(4);
}

export function generateTuningTable(keyName) {
    const isMinor = isMinorKey(keyName);
    const table = [];
    
    for (let interval = 0; interval < 12; interval++) {
        const info = getIntervalInfo(interval, isMinor);
        const keyRoot = getKeyRoot(keyName);
        const notePc = (keyRoot + interval) % 12;
        
        table.push({
            interval,
            noteName: NOTE_NAMES[notePc],
            ...info
        });
    }
    
    return table;
}
