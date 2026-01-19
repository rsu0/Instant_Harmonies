// Key Detection - Ensemble method using established key-finding profiles
//
// References:
// - Albrecht & Shanahan (2013). Music Perception, 31(1), 59-67.
// - Temperley (1999). Music Perception, 17(1), 65-100.
// - Krumhansl & Kessler (1982). Psychological Review, 89(4), 334-368.

// Albrecht-Shanahan (2013) - corpus-derived from 490 common-practice pieces
// Reported 91.3% accuracy; their meta-algorithm achieved 95.1%
export const ALBRECHT_SHANAHAN_PROFILES = {
    major: [0.238, 0.006, 0.111, 0.006, 0.137, 0.094, 0.016, 0.214, 0.009, 0.080, 0.008, 0.081],
    minor: [0.220, 0.006, 0.104, 0.123, 0.019, 0.103, 0.012, 0.214, 0.062, 0.022, 0.061, 0.052]
};

// Temperley-style profiles (normalized). Key principles from Temperley (1999):
// larger diatonic/chromatic gap, harmonic minor assumption, low weight for flat-7
export const TEMPERLEY_PROFILES = {
    major: [0.176, 0.014, 0.115, 0.019, 0.158, 0.108, 0.023, 0.168, 0.024, 0.086, 0.013, 0.094],
    minor: [0.170, 0.020, 0.113, 0.148, 0.012, 0.110, 0.025, 0.179, 0.097, 0.016, 0.032, 0.079]
};

// Krumhansl-Kessler (1982) - probe-tone profiles from listener experiments
// Known issues: small diatonic/chromatic gap, tendency toward relative major for minor pieces
export const KRUMHANSL_KESSLER_PROFILES = {
    major: [0.152, 0.053, 0.083, 0.056, 0.105, 0.098, 0.060, 0.124, 0.057, 0.088, 0.055, 0.069],
    minor: [0.142, 0.060, 0.079, 0.121, 0.058, 0.079, 0.057, 0.107, 0.089, 0.060, 0.075, 0.071]
};

// Weights reflect relative reliability. Albrecht & Shanahan showed combining algorithms
// yields better results (95.1% meta vs 91.3% single). Kania et al. (2024, Archives of
// Acoustics 49(4)) emphasizes stability for real-time applications.
export const ENSEMBLE_CONFIG = {
    profiles: {
        albrecht_shanahan: { data: ALBRECHT_SHANAHAN_PROFILES, weight: 0.45 },
        temperley: { data: TEMPERLEY_PROFILES, weight: 0.35 },
        krumhansl_kessler: { data: KRUMHANSL_KESSLER_PROFILES, weight: 0.20 }
    },
    threshold: 0.04
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class KeyDetector {
    constructor() {
        this.currentKey = null;
    }

    detectKey(noteBuffer, sensitivity = 'medium') {
        return this.detectKeyEnsemble(noteBuffer, sensitivity);
    }

    detectKeyEnsemble(noteBuffer, sensitivity) {
        // Threshold values (high=0.03, medium=0.04, low=0.05) empirically tuned
        // for real-time use, balancing responsiveness vs stability
        const threshold = sensitivity === 'high' ? 0.03 : sensitivity === 'medium' ? 0.04 : 0.05;
        
        const noteCounts = new Array(12).fill(0);
        noteBuffer.forEach(noteEvent => {
            noteCounts[noteEvent.note % 12]++;
        });
        
        const total = noteCounts.reduce((a, b) => a + b, 0);
        if (total === 0) return null;
        
        const normalized = noteCounts.map(c => c / total);
        
        const keyVotes = {};
        const profileResults = {};
        
        for (const [profileName, profileConfig] of Object.entries(ENSEMBLE_CONFIG.profiles)) {
            const profile = profileConfig.data;
            const weight = profileConfig.weight;
            
            let bestKey = null;
            let bestScore = -Infinity;
            
            for (let root = 0; root < 12; root++) {
                for (const mode of ['major', 'minor']) {
                    const profileData = profile[mode];
                    const rotated = [...profileData.slice(12 - root), ...profileData.slice(0, 12 - root)];
                    
                    // Scalar product - Temperley (1999, p.70) shows this is equivalent to
                    // Pearson correlation for finding the best-matching key
                    let score = 0;
                    for (let i = 0; i < 12; i++) {
                        score += normalized[i] * rotated[i];
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestKey = NOTE_NAMES[root] + (mode === 'minor' ? 'm' : '');
                    }
                }
            }
            
            profileResults[profileName] = { key: bestKey, score: bestScore };
            
            if (!keyVotes[bestKey]) {
                keyVotes[bestKey] = { weightedScore: 0, voteCount: 0, profiles: [] };
            }
            keyVotes[bestKey].weightedScore += weight * bestScore;
            keyVotes[bestKey].voteCount += 1;
            keyVotes[bestKey].profiles.push(profileName);
        }
        
        let finalKey = null;
        let finalScore = -Infinity;
        let agreement = 0;
        
        for (const [key, data] of Object.entries(keyVotes)) {
            if (data.weightedScore > finalScore) {
                finalScore = data.weightedScore;
                finalKey = key;
                agreement = data.voteCount;
            }
        }
        
        // Agreement bonus: unanimous (3/3) gets 1.2x, 2/3 gets 1.0x, 1/3 gets 0.8x
        const agreementBonus = agreement === 3 ? 1.2 : agreement === 2 ? 1.0 : 0.8;
        const confidencePercent = Math.round(finalScore * 400 * agreementBonus);
        
        if (finalScore >= threshold && finalKey !== this.currentKey) {
            this.currentKey = finalKey;
            const agreementText = agreement === 3 ? 'unanimous' : `${agreement}/3 agree`;
            
            console.log('Ensemble results:', profileResults);
            
            return {
                key: finalKey,
                confidence: confidencePercent,
                agreement,
                agreementText,
                profileResults,
                method: 'ensemble'
            };
        }
        
        return null;
    }

    getEnsembleAnalysis(noteBuffer) {
        if (noteBuffer.length < 8) {
            return { error: 'Insufficient notes for analysis' };
        }
        
        const noteCounts = new Array(12).fill(0);
        noteBuffer.forEach(noteEvent => {
            noteCounts[noteEvent.note % 12]++;
        });
        
        const total = noteCounts.reduce((a, b) => a + b, 0);
        const normalized = noteCounts.map(c => c / total);
        
        const analysis = {
            noteCount: total,
            histogram: noteCounts,
            normalizedHistogram: normalized,
            profileResults: {}
        };
        
        for (const [profileName, profileConfig] of Object.entries(ENSEMBLE_CONFIG.profiles)) {
            const profile = profileConfig.data;
            let bestKey = null;
            let bestScore = -Infinity;
            
            for (let root = 0; root < 12; root++) {
                for (const mode of ['major', 'minor']) {
                    const profileData = profile[mode];
                    const rotated = [...profileData.slice(12 - root), ...profileData.slice(0, 12 - root)];
                    
                    let score = 0;
                    for (let i = 0; i < 12; i++) {
                        score += normalized[i] * rotated[i];
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestKey = NOTE_NAMES[root] + (mode === 'minor' ? 'm' : '');
                    }
                }
            }
            
            analysis.profileResults[profileName] = {
                key: bestKey,
                score: bestScore,
                weight: profileConfig.weight,
                weightedScore: bestScore * profileConfig.weight
            };
        }
        
        return analysis;
    }

    getCurrentKey() {
        return this.currentKey;
    }

    reset() {
        this.currentKey = null;
    }
}

export const keyDetector = new KeyDetector();
