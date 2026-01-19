// --- Configuration Variables ---
let midiAccess = null, midiInput = null, midiOutput = null, audioContext = null, 
    outputMode = 'midi', tuningSystem = '12tet', isTuningActive = false, 
    keyDetectionMode = 'manual', referenceKey = 60, scaleType = 'major', 
    pianoSampleBuffer = null;
const webAudioNotes = {};
const multiSamples = {};
const PIANO_SAMPLE_MAP = {
    24: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C1.mp3', // C1
    36: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C2.mp3', // C2
    48: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C3.mp3', // C3
    60: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C4.mp3', // C4
    72: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C5.mp3', // C5
    84: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C6.mp3', // C6
    96: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C7.mp3', // C7
};
const activeOnNotes = {};
const tempoTracker = {
    interNoteTimes: [],
    maxHistory: 20,
    avgTime: 500,
    lastNoteTime: 0,
    currentWindowMs: 8000
};
const tuningAdjuster = {
    currentAdjustments: new Array(12).fill(0), 
    targetAdjustments: new Array(12).fill(0),
};
const MAX_POLYPHONY = 32;
const voicePool = [];
let lastVoice = 0;

// --- Sustain pedal state ---
let sustainPedal = false;          
const keysDown = new Set();        // MIDI notes currently held by key
const sustainedNotes = new Set();  // notes released while pedal is down (WebAudio only)

let sysExSupported = true;
const notesUsingBend = new Set();
let pitchBendRangeSemitones = 2; // Default ±2 semitones, can be configured

// --- MPE Channel Management ---
const MPE_CHANNELS = Array.from({ length: 15 }, (_, i) => ({ channel: i + 1, inUse: false, note: null }));
const activeNotesToMpeChannel = {};

// --- Just Intonation Ratios ---
const JI_RATIOS = {
    major: { 
        0: "1/1",     // Tonic
        1: "16/15",   // Minor 2nd
        2: "9/8",     // Major 2nd  
        3: "6/5",     // Minor 3rd
        4: "5/4",     // Major 3rd
        5: "4/3",     // Perfect 4th
        6: "45/32",   // Tritone
        7: "3/2",     // Perfect 5th
        8: "8/5",     // Minor 6th
        9: "5/3",     // Major 6th
        10: "9/5",    // Minor 7th
        11: "15/8"    // Major 7th
    },
    minor: { 
        0: "1/1",     // Tonic
        1: "16/15",   // Minor 2nd
        2: "9/8",     // Major 2nd
        3: "6/5",     // Minor 3rd
        4: "5/4",     // Major 3rd (for harmonic minor)
        5: "4/3",     // Perfect 4th
        6: "45/32",   // Tritone
        7: "3/2",     // Perfect 5th
        8: "8/5",     // Minor 6th
        9: "5/3",     // Major 6th (for harmonic minor)
        10: "9/5",    // Minor 7th
        11: "15/8"    // Major 7th (for harmonic minor)
    }
};

// --- User Interface Elements ---
const statusDiv = document.getElementById('status'), midiInSelect = document.getElementById('midiIn'), midiOutSelect = document.getElementById('midiOut'),
    messageLog = document.getElementById('messageLog'), outputModeRadios = document.querySelectorAll('input[name="outputMode"]'),
    tuningSystemRadios = document.querySelectorAll('input[name="tuningSystem"]'), referenceNoteSelect = document.getElementById('jiReferenceNote'),
    activateTuningButton = document.getElementById('activateTuningButton'), tuningStatusSpan = document.getElementById('tuningStatus'),
    panicButton = document.getElementById('panicButton'), scaleTypeSelect = document.getElementById('jiScaleType'),
    keyDetectionRadios = document.querySelectorAll('input[name="jiReferenceSource"]'), manualJiControls = document.getElementById('manualJiControls'),
    autoDetectControls = document.getElementById('autoDetectControls'), detectedKeyDisplay = document.getElementById('detectedKeyDisplay'),
    pitchBendRangeSelect = document.getElementById('pitchBendRange');
// Add these with your other UI element constants
const smartActivateButton = document.getElementById('smartActivateButton');
const smartStatus = document.getElementById('smartStatus');
const advancedControlsToggle = document.getElementById('advancedControlsToggle');
const advancedControlsContainer = document.getElementById('advancedControlsContainer');
const quickStartGuide = document.getElementById('quickStartGuide');

// --- Helper Functions ---
const logMessage = (msg, isErr = false) => {
    // Only show user-friendly messages, hide technical details
    const userFriendlyMsg = makeMessageUserFriendly(msg);
    if (!userFriendlyMsg) return; // Skip technical messages
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (isErr) entry.style.color = 'red';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${userFriendlyMsg}`;
    if (messageLog.childNodes.length > 50) messageLog.removeChild(messageLog.firstChild); // Reduced log size
    messageLog.appendChild(entry);
    messageLog.scrollTop = messageLog.scrollHeight;
    console.log(msg); // Keep full technical log in console for debugging
};

const makeMessageUserFriendly = (msg) => {
    // Filter out technical messages and make others more friendly
    if (msg.includes('MPE') || msg.includes('SysEx') || msg.includes('MTS') || 
        msg.includes('Voice stealing') || msg.includes('Fallback')) return null;
    
    if (msg.includes('Smart Tuning ACTIVATED')) return 'Auto-tuning started';
    if (msg.includes('Smart Tuning DEACTIVATED')) return 'Auto-tuning stopped';
    if (msg.includes('PANIC')) return 'All sounds stopped';
    if (msg.includes('Loading piano')) return 'Loading piano sounds...';
    if (msg.includes('Piano multi-samples loaded')) return 'Piano sounds ready';
    if (msg.includes('Audio context initialized')) return 'Audio system ready';
    if (msg.includes('Requesting MIDI access')) return 'Connecting to MIDI devices...';
    if (msg.includes('MIDI access granted')) return 'MIDI devices connected successfully';
    if (msg.includes('Sustain pedal')) return msg.replace('Sustain pedal', 'Sustain pedal is');
    
    // Filter out note-level technical details
    if (msg.includes('Note:') && msg.includes('Cents')) return null;
    
    return msg;
};

const midiNoteToFrequency = note => 440 * Math.pow(2, (note - 69) / 12);
const parseRatio = r => r ? r.split('/').map(Number).reduce((a, b) => a / b) : null;

function setupVoicePool() {
    for (let i = 0; i < MAX_POLYPHONY; i++) {
        voicePool.push({
            source: null,
            gain: audioContext.createGain(), // Pre-create the gain node
            note: null,
            inUse: false,
            startTime: 0
        });
        voicePool[i].gain.connect(audioContext.destination);
    }
}

function getVoice(note) {
    // First, try to find an unused voice
    let voice = voicePool.find(v => !v.inUse);
    if (voice) return voice;

    // If none are free, steal the oldest one
    voice = voicePool.reduce((oldest, current) => {
        return (current.startTime < oldest.startTime) ? current : oldest;
    });
    
    // Stop the note that's being stolen
    if (voice.source) voice.source.stop();
    logMessage(`Voice stealing: Re-using voice for note ${voice.note}`);
    return voice;
}

// --- Replace the old setupPianoSample function ---
const setupMultiSamples = async (ctx) => {
    logMessage("Loading piano sounds...");
    statusDiv.textContent = "Loading piano sounds...";
    
    const loadPromises = Object.entries(PIANO_SAMPLE_MAP).map(async ([note, url]) => {
        try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            multiSamples[note] = await ctx.decodeAudioData(buffer);
        } catch (e) {
            logMessage(`Could not load piano sound for note ${note}`, true);
        }
    });

    await Promise.all(loadPromises);

    if (Object.keys(multiSamples).length > 0) {
        logMessage("Piano sounds loaded successfully!");
        statusDiv.textContent = "Ready! Select your keyboard and sound device above.";
        statusDiv.className = 'mb-4 p-3 rounded-md bg-green-100 text-green-800';
    } else {
        logMessage("Could not load piano sounds", true);
        statusDiv.textContent = "Error: Could not load piano sounds.";
        statusDiv.className = 'mb-4 p-3 rounded-md bg-red-100 text-red-800';
    }
    updateUIState();
};

// Also update initializeAudioContext to call the new function
const initializeAudioContext = () => {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        logMessage("Audio system ready");
        setupMultiSamples(audioContext);
    } catch (e) { 
        logMessage("Your browser doesn't support Web Audio", true); 
    }
};

// --- Replace the old playWebAudioNote function ---
const playWebAudioNote = (note, vel, freq) => {
    if (!audioContext || Object.keys(multiSamples).length === 0 || webAudioNotes[note]) return;

    // 1. Find the closest sample we have to the note being played
    const sampleNotes = Object.keys(multiSamples).map(Number);
    const closestSampleNote = sampleNotes.reduce((prev, curr) => {
        return (Math.abs(curr - note) < Math.abs(prev - note) ? curr : prev);
    });

    // 2. Get the audio buffer for that sample
    const sampleBuffer = multiSamples[closestSampleNote];
    
    // 3. Create the audio nodes (this is your original, responsive code)
    const source = audioContext.createBufferSource();
    source.buffer = sampleBuffer;
    
    // 4. Calculate playback rate relative to the chosen sample, not a fixed C4
    const baseFreq = midiNoteToFrequency(closestSampleNote);
    source.playbackRate.value = freq / baseFreq;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime((vel / 127) * 0.8, audioContext.currentTime);
    source.connect(gain).connect(audioContext.destination);
    source.start();
    webAudioNotes[note] = { source, gain };
};

const stopWebAudioNote = note => {
    if (!webAudioNotes[note]) return;
    const { source, gain } = webAudioNotes[note];
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    source.stop(audioContext.currentTime + 0.5);
    delete webAudioNotes[note];
};

// --- MIDI Functions ---
const resetAllMidiState = () => {
    logMessage("Stopping all sounds and resetting system");
    if (midiOutput) {
        for (let ch = 0; ch < 16; ch++) {
        midiOutput.send([0xB0 | ch, 122, 0]);   // Local Control OFF (stay off)
        midiOutput.send([0xB0 | ch, 120, 0]);   // All Sound Off
        midiOutput.send([0xB0 | ch, 123, 0]);   // All Notes Off
        midiOutput.send([0xE0 | ch, 0, 64]);    // Pitch Bend center
        }
    }
    Object.keys(webAudioNotes).forEach(noteNum => stopWebAudioNote(parseInt(noteNum)));
    MPE_CHANNELS.forEach(ch => { ch.inUse = false; ch.note = null; });
    Object.keys(activeNotesToMpeChannel).forEach(k => delete activeNotesToMpeChannel[k]);
    notesUsingBend.clear();
    
    sustainPedal = false;
    keysDown.clear();
    sustainedNotes.clear();
};      

const getMpeChannel = note => {
    const freeChannel = MPE_CHANNELS.find(ch => !ch.inUse);
    if (freeChannel) {
        freeChannel.inUse = true;
        freeChannel.note = note;
        activeNotesToMpeChannel[note] = freeChannel.channel;
        return freeChannel.channel;
    }
    logMessage("Warning: No free MPE channels available.", true);
    return null;
};

const releaseMpeChannel = note => {
    const channelNum = activeNotesToMpeChannel[note];
    if (channelNum === undefined) return;
    const mpeChannel = MPE_CHANNELS.find(ch => ch.channel === channelNum);
    if (mpeChannel) { mpeChannel.inUse = false; mpeChannel.note = null; }
    delete activeNotesToMpeChannel[note];
};

const calculateTuning = (note) => {
    if (tuningSystem !== 'ji' || !isTuningActive) {
        return { cents: 0, freq: midiNoteToFrequency(note) };
    }
    
    // Manual tuning is applied once when settings change, not per note
    // Auto mode updates tuning through the key detection system
    
    const pitchClass = note % 12;
    const centsDev = tuningAdjuster.currentAdjustments[pitchClass];
    const etFreq = midiNoteToFrequency(note);
    const finalFreq = etFreq * Math.pow(2, centsDev / 1200);
    return { cents: centsDev, freq: finalFreq };
};

const applyManualTuning = () => {
    const activeScale = JI_RATIOS[scaleType];
    
    for (let i = 0; i < 12; i++) {
        const offset = (i - (referenceKey % 12) + 12) % 12;
        const ratio = parseRatio(activeScale?.[offset]);
        if (ratio) {
            const jiCentsFromTonic = 1200 * Math.log2(ratio);
            const etCentsFromTonic = offset * 100;
            tuningAdjuster.targetAdjustments[i] = jiCentsFromTonic - etCentsFromTonic;
        } else {
            tuningAdjuster.targetAdjustments[i] = 0;
        }
    }
};

const createMtsSysex = (note, cents) => {
    // MTS Real-time Single Note Tuning Change
    // Convert cents to 14-bit resolution (0-16383, where 8192 = 0 cents)
    const tuningValue = Math.max(0, Math.min(16383, Math.round(cents * 81.92) + 8192));
    
    return new Uint8Array([
        0xF0,                    // SysEx start
        0x7F,                    // Universal Real-time
        0x7F,                    // Device ID (broadcast)
        0x08,                    // MIDI Tuning Standard
        0x02,                    // Real-time Single Note Tuning Change
        1,                       // Number of tunings (1 note)
        note,                    // MIDI note number
        (tuningValue >> 7) & 0x7F,  // Tuning MSB
        tuningValue & 0x7F,      // Tuning LSB
        0xF7                     // SysEx end
    ]);
};

const onMIDIMessage = event => {
    const [status, note, vel] = event.data;
    const cmd = status >> 4;
    const now = performance.now();

    if (cmd === 9 && vel > 0) { // Note On
        if (tempoTracker.lastNoteTime > 0) {
            const diff = now - tempoTracker.lastNoteTime;
            tempoTracker.interNoteTimes.push(diff);
            if (tempoTracker.interNoteTimes.length > tempoTracker.maxHistory) {
                tempoTracker.interNoteTimes.shift();
            }
            const sum = tempoTracker.interNoteTimes.reduce((a, b) => a + b, 0);
            tempoTracker.avgTime = sum / tempoTracker.interNoteTimes.length;
            updateAdaptiveWindow();
        }
        
        tempoTracker.lastNoteTime = now;
        activeOnNotes[note] = { time: now, velocity: vel };
        
        keysDown.add(note); // NEW
        
        const { cents, freq } = calculateTuning(note);
        logMessage(`Note: ${note}, Cents Deviation: ${cents.toFixed(2)}`);

        if (outputMode === 'webaudio') {
            // If the same note is already sounding (e.g., sustained), stop it so retrigger works
            if (webAudioNotes[note]) {
                stopWebAudioNote(note);
                sustainedNotes.delete(note);
            }
            playWebAudioNote(note, vel, freq); // existing
        } else if (midiOutput) {
            const assignedChannel = getMpeChannel(note);
            if (assignedChannel === null) return;

            let sentSysEx = false;
            if (isTuningActive && Math.abs(cents) > 0.1) {
                if (sysExSupported) {
                    try {
                        midiOutput.send(createMtsSysex(note, cents));
                        sentSysEx = true;
                    } catch (e) {
                        console.warn("SysEx send failed unexpectedly:", e);
                    }
                }
                
                if (!sentSysEx) {
                    // Calculate pitch bend with configurable range
                    const centsPerSemitone = 100;
                    const maxCents = pitchBendRangeSemitones * centsPerSemitone;
                    
                    // Safety check: skip pitch bend if cents exceed device range
                    if (Math.abs(cents) > maxCents) {
                        logMessage(`Warning: ${cents.toFixed(1)} cents exceeds pitch bend range (±${maxCents} cents), skipping bend for note ${note}`);
                    } else {
                        const bendRatio = cents / maxCents; // -1.0 to +1.0
                        const bendValue = Math.max(0, Math.min(16383, Math.round(bendRatio * 8192) + 8192));
                        const lsb = bendValue & 0x7F;
                        const msb = (bendValue >> 7) & 0x7F;
                        midiOutput.send([0xE0 | assignedChannel, lsb, msb]);
                        notesUsingBend.add(note); 
                        logMessage(`Fallback: Note ${note} tuned with Pitch Bend on MPE Ch ${assignedChannel}`);
                    }
                }
            }
            
            midiOutput.send([0x90 | assignedChannel, note, vel]);
            if(sentSysEx) logMessage(`MTS: Note On ${note} tuned on MPE Ch ${assignedChannel}`);
        }
    } else if (cmd === 8 || (cmd === 9 && vel === 0)) { // Note Off
        if (activeOnNotes[note]) {
            const { time, velocity } = activeOnNotes[note];

            // --- SUSTAIN LOGIC ---
            let duration = now - time;
            if (sustainPedal) {
                duration *= 1.8; // Inflate duration to reflect sustain
            }

            if (keyDetectionMode === 'auto') {
                keyFinder.addNote({ pitch: note, duration: duration, velocity });
            }
            // This was a minor bug in script6, calling analysis on every note-off.
            // It's better to call it less frequently, but for now, this matches the logic you liked.
            // For a future optimization, you could throttle this call.
            keyFinder.runAnalysis(); 
            
            delete activeOnNotes[note];
        }

        keysDown.delete(note); // NEW

        if (outputMode === 'webaudio') {
            if (sustainPedal) {
                // Hold this note until pedal goes up
                sustainedNotes.add(note); // NEW
            } else {
                stopWebAudioNote(note);   // existing
            }
        } else if (midiOutput) {
            const assignedChannel = activeNotesToMpeChannel[note];
            if (assignedChannel !== undefined) {
                midiOutput.send([0x80 | assignedChannel, note, 0]);
                if (notesUsingBend.has(note)) {
                    midiOutput.send([0xE0 | assignedChannel, 0x00, 0x40]); 
                    notesUsingBend.delete(note);
                }
                releaseMpeChannel(note);
            }
        }
    }   else if (cmd === 11) { // Control Change
        const controller = note;    // 'note' byte carries controller number for CC
        const value = vel;

        if (controller === 64) { // Sustain pedal
            const down = value >= 64;
            if (down !== sustainPedal) {
                sustainPedal = down;
                logMessage(`Sustain pedal ${down ? 'DOWN' : 'UP'}`);

                // On pedal up in WebAudio, release any notes that were only being held by the pedal
                if (!down && outputMode === 'webaudio') {
                    for (const n of Array.from(sustainedNotes)) {
                        if (!keysDown.has(n)) {
                            stopWebAudioNote(n);
                            sustainedNotes.delete(n);
                        }
                    }
                }
            }

            // For external MIDI output: broadcast CC64 to all channels (covers MPE per-note channels)
            if (outputMode === 'midi' && midiOutput) {
                for (let ch = 0; ch < 16; ch++) {
                    midiOutput.send([0xB0 | ch, 64, value]);
                }
            }
            return; // handled
        }

        // Other CCs: pass through as before
        if (outputMode === 'midi' && midiOutput) midiOutput.send(event.data);
        return;
    }
};

function updateAdaptiveWindow() {
    const minWindow = 3000;
    const maxWindow = 15000;
    const fastTempoThreshold = 100;
    const slowTempoThreshold = 1000;
    let newWindow;
    if (tempoTracker.avgTime <= fastTempoThreshold) {
        newWindow = minWindow;
    } else if (tempoTracker.avgTime >= slowTempoThreshold) {
        newWindow = maxWindow;
    } else {
        const progress = (tempoTracker.avgTime - fastTempoThreshold) / (slowTempoThreshold - fastTempoThreshold);
        newWindow = minWindow + (maxWindow - minWindow) * progress;
    }
    tempoTracker.currentWindowMs = tempoTracker.currentWindowMs * 0.95 + newWindow * 0.05;
};

// --- Key Finding Algorithm (from script6) ---
const keyFinder = {
    MIN_NOTES_FOR_ANALYSIS: 16, performanceWindow: [], detectedKey: { name: "N/A", rootNote: 60, scale: 'major' },
    PITCH_CLASSES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], COF: ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'],
    COF_ANGLES: Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6),
    addNote({ pitch, duration, velocity }) {
        const now = performance.now();
        this.performanceWindow.push({ pitch, duration, velocity, time: now });
        this.performanceWindow = this.performanceWindow.filter(n => now - n.time < tempoTracker.currentWindowMs);
    },
    // Replace the entire runAnalysis method with this one.

    runAnalysis() {
        if (this.performanceWindow.length < this.MIN_NOTES_FOR_ANALYSIS) return;

        // --- All your profile calculation logic is correct ---
        const noteCount = this.performanceWindow.length;
        const calculateAdaptiveAlpha = c => (c >= 50) ? 0.85 : 0.5 + (0.35 * (c / 50));
        const alpha = calculateAdaptiveAlpha(noteCount);
        const durationProfile = new Array(12).fill(0), countProfile = new Array(12).fill(0);
        this.performanceWindow.forEach(note => { const pc = note.pitch % 12; durationProfile[pc] += note.duration; countProfile[pc]++; });
        const maxDur = Math.max(...durationProfile), maxCount = Math.max(...countProfile);
        const normDur = maxDur > 0 ? durationProfile.map(d => d / maxDur) : durationProfile;
        const normCount = maxCount > 0 ? countProfile.map(c => c / maxCount) : countProfile;
        const hybridProfile = normDur.map((d, i) => alpha * d + (1 - alpha) * normCount[i]);

        // --- Pruning logic ---
        const totalMass = hybridProfile.reduce((a, b) => a + b, 0) || 1;
        const massThreshold = 0.03 * totalMass;
        const prunedProfile = hybridProfile.map(v => v < massThreshold ? 0 : v);
        const maxHybrid = Math.max(...prunedProfile); if (maxHybrid === 0) return;
        const normalizedProfile = prunedProfile.map(p => p / maxHybrid);

        // --- All Circle of Fifths geometry calculations ---
        const cofPitchClasses = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
        const cofProfile = cofPitchClasses.map(pc => normalizedProfile[pc]);
        let maxAxisStrength = -Infinity, mainDirectedAxisStartIdx = -1;
        for (let i = 0; i < 12; i++) {
            let right = 0, left = 0; for (let j = 1; j <= 5; j++) { right += cofProfile[(i + j) % 12]; left += cofProfile[(i - j + 12) % 12]; }
            if (right - left > maxAxisStrength) { maxAxisStrength = right - left; mainDirectedAxisStartIdx = i; }
        }
        const confidence = Math.min(100, (maxAxisStrength / 5) * 100);
        if (mainDirectedAxisStartIdx === -1 || confidence < 20) { this.updateKeyDisplay("Ambiguous", null, 0); return; }
        let totalX = 0, totalY = 0;
        cofProfile.forEach((r, i) => { const phi = this.COF_ANGLES[i]; totalX += r * Math.cos(phi); totalY += r * Math.sin(phi); });
        const phi_SF = Math.atan2(totalY, totalX);
        const mdaseEndIdx = (mainDirectedAxisStartIdx + 6) % 12; const modeAxisIdx = (mdaseEndIdx - 3 + 12) % 12;
        const phi_1 = this.COF_ANGLES[modeAxisIdx]; let phi_m = phi_SF - phi_1;
        while (phi_m <= -Math.PI) phi_m += 2 * Math.PI; while (phi_m > Math.PI) phi_m -= 2 * Math.PI;
        const majorKeyName = this.COF[(mdaseEndIdx - 1 + 12) % 12]; const majorKeyRootIndex = cofPitchClasses[(mdaseEndIdx + 1) % 12];
        const relativeMinorRootIndex = (majorKeyRootIndex - 3 + 12) % 12; const relativeMinorName = this.PITCH_CLASSES[relativeMinorRootIndex];
        let newKey;

        // --- The "Dead Zone" logic for mode decision ---
        const DEAD_ZONE = 0.18;
        if (Math.abs(phi_m) < DEAD_ZONE) {
            newKey = this.detectedKey && this.detectedKey.name !== "N/A" ? { ...this.detectedKey } : null;
            if (newKey) {
                newKey.name = this.PITCH_CLASSES[newKey.rootNote % 12] + (newKey.scale === 'major' ? ' Major' : ' minor');
            }
        } else if (phi_m > 0) {
            newKey = { name: `${majorKeyName} Major`, rootNote: majorKeyRootIndex + 60, scale: 'major' };
        } else {
            newKey = { name: `${relativeMinorName} minor`, rootNote: relativeMinorRootIndex + 60, scale: 'minor' };
        }

        // --- Final update logic ---
        if (newKey && (!this.detectedKey || newKey.name !== this.detectedKey.name)) {
            this.detectedKey = { ...newKey, confidence: confidence };
            logMessage(`New Key Target: ${this.detectedKey.name} (Confidence: ${confidence.toFixed(0)}%)`);
            this.updateKeyDisplay(this.detectedKey.name, this.detectedKey.scale, confidence);
            updateUIState(); // <-- THE FIX: Refresh the main UI when the key changes.

            const activeRoot = this.detectedKey.rootNote;
            const activeScale = JI_RATIOS[this.detectedKey.scale];
            
            for (let i = 0; i < 12; i++) {
                const offset = (i - (activeRoot % 12) + 12) % 12;
                const ratio = parseRatio(activeScale?.[offset]);
                if (ratio) {
                    const jiCentsFromTonic = 1200 * Math.log2(ratio);
                    const etCentsFromTonic = offset * 100;
                    tuningAdjuster.targetAdjustments[i] = jiCentsFromTonic - etCentsFromTonic;
                } else {
                    tuningAdjuster.targetAdjustments[i] = 0;
                }
            }
        } else if (newKey) {
            // Key is the same, just update the confidence for the UI.
            this.detectedKey.confidence = confidence;
            this.updateKeyDisplay(this.detectedKey.name, this.detectedKey.scale, confidence);
            updateUIState(); // <-- THE FIX: Also refresh when confidence changes.
        }
    }, // <-- Make sure this comma is here, before the next method in the object.

    updateKeyDisplay(keyName, scale, confidence = 0) {
        if (keyName === "Ambiguous" || confidence < 20) {
            detectedKeyDisplay.innerHTML = `<span class="font-semibold text-lg text-yellow-700">Ambiguous Key</span>`;
            detectedKeyDisplay.className = 'key-display mt-2 p-3 text-center rounded-md bg-yellow-100 border-yellow-300';
        } else if (keyName === "N/A") {
            detectedKeyDisplay.innerHTML = `<span class="font-semibold text-lg text-gray-500">Play some notes...</span>`;
            detectedKeyDisplay.className = 'key-display mt-2 p-3 text-center rounded-md bg-gray-100 border-gray-300';
        } else {
            const bgColor = scale === 'major' ? 'bg-blue-100 border-blue-300' : 'bg-purple-100 border-purple-300';
            const textColor = scale === 'major' ? 'text-blue-800' : 'text-purple-800';
            detectedKeyDisplay.innerHTML = `<span class="font-semibold text-xl ${textColor}">${keyName}</span><div class="text-xs ${textColor} opacity-80 mt-1">Confidence: ${confidence.toFixed(0)}%</div>`;
            detectedKeyDisplay.className = `key-display mt-2 p-3 text-center rounded-md border ${bgColor}`;
        }
    }
};

// --- MIDI Setup ---
const onMIDISuccess = access => {
    midiAccess = access;
    initializeAudioContext();
    populateDeviceSelectors();
    access.onstatechange = onMIDIStateChange;
    updateUIState();
};

const onMIDIFailure = msg => {
    logMessage(`MIDI access failed: ${msg}. SysEx may be unsupported.`, true);
    statusDiv.textContent = `MIDI access failed: ${msg}. Pitch-bend fallback will be used.`;
    statusDiv.className = 'mb-4 p-3 rounded-md bg-red-100 text-red-800';
    sysExSupported = false;
    if (!audioContext) initializeAudioContext();
    updateUIState();
};

const onMIDIStateChange = event => {
    logMessage(`MIDI state changed: ${event.port.name}, State: ${event.port.state}`);
    if (midiInput && midiInput.id === event.port.id && event.port.state === 'disconnected') {
        midiInput = null;
        midiInSelect.value = "";
    }
    if (midiOutput && midiOutput.id === event.port.id && event.port.state === 'disconnected') {
        midiOutput = null;
        midiOutSelect.value = "";
    }
    populateDeviceSelectors();
    updateUIState();
};

function populateDeviceSelectors() {
    if (!midiAccess) return;
    const currentInId = midiInput?.id, currentOutId = midiOutput?.id;
    midiInSelect.innerHTML = '<option value="">Select Input...</option>';
    midiOutSelect.innerHTML = '<option value="">Select Output...</option>';
    midiAccess.inputs.forEach(i => {
        const opt = new Option(i.name, i.id);
        if (i.id === currentInId) opt.selected = true;
        midiInSelect.appendChild(opt);
    });
    midiAccess.outputs.forEach(o => {
        const opt = new Option(o.name, o.id);
        if (o.id === currentOutId) opt.selected = true;
        midiOutSelect.appendChild(opt);
    });
    populateReferenceNoteSelector();
}

function populateReferenceNoteSelector() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    referenceNoteSelect.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const opt = new Option(`${notes[i]}4`, 60 + i);
        if (opt.value == referenceKey) opt.selected = true;
        referenceNoteSelect.appendChild(opt);
    }
}

function updateUIState() {
    const inputReady = !!midiInput;
    const outputReady = (outputMode === 'midi' && !!midiOutput) || (outputMode === 'webaudio' && Object.keys(multiSamples).length > 0);
    const systemReady = inputReady && outputReady;

    // --- Control the new Smart Button ---
    smartActivateButton.disabled = !systemReady;

    if (isTuningActive) {
        smartActivateButton.textContent = 'Stop Auto-Tuning';
        smartActivateButton.classList.add('bg-red-600', 'hover:bg-red-700');
        smartActivateButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    } else {
        smartActivateButton.textContent = 'Start Auto-Tuning';
        smartActivateButton.classList.remove('bg-red-600', 'hover:bg-red-700');
        smartActivateButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    }

    // --- Status Display Logic ---
    if (!systemReady) {
        smartStatus.innerHTML = `<span>Connect your devices above to begin</span>`;
        smartStatus.className = "key-display-mini mt-2 p-2 text-center rounded-md bg-yellow-100 text-yellow-800";
    } else if (!isTuningActive) {
        smartStatus.innerHTML = `<span>Off</span>`;
        smartStatus.className = "key-display-mini mt-2 p-2 text-center rounded-md bg-gray-100 text-gray-600";
    } else {
        // Show detected key information
        const { name, scale, confidence } = keyFinder.detectedKey;
        if (name === "Ambiguous" || (confidence < 20 && name !== "N/A")) {
            smartStatus.innerHTML = `<span class="font-semibold text-lg">Finding Key...</span>`;
            smartStatus.className = 'key-display-mini mt-2 p-2 text-center rounded-md bg-yellow-100 text-yellow-700';
        } else if (name === "N/A") {
            smartStatus.innerHTML = `<span class="font-semibold text-lg">Listening...</span>`;
            smartStatus.className = 'key-display-mini mt-2 p-2 text-center rounded-md bg-gray-100 text-gray-500';
        } else {
            const bgColor = scale === 'major' ? 'bg-blue-100' : 'bg-purple-100';
            const textColor = scale === 'major' ? 'text-blue-800' : 'text-purple-800';
            smartStatus.innerHTML = `
                <span class="font-semibold text-xl ${textColor}">${name} ${scale}</span>
                <div class="text-xs ${textColor} opacity-80">Tuning harmonies automatically</div>
            `;
            smartStatus.className = `key-display-mini mt-2 p-2 text-center rounded-md ${bgColor}`;
        }
    }


    // --- Logic for the Advanced Controls (unchanged) ---
    activateTuningButton.disabled = !systemReady;
    const isJiTuning = tuningSystem === 'ji';
    document.getElementById('jiOptionsContainer').style.display = isJiTuning ? 'block' : 'none';
    const isAutoDetect = keyDetectionMode === 'auto';
    manualJiControls.style.display = isJiTuning && !isAutoDetect ? 'grid' : 'none';
    autoDetectControls.style.display = isJiTuning && isAutoDetect ? 'block' : 'none';
    
    activateTuningButton.textContent = isTuningActive ? 'Stop Tuning' : 'Apply Tuning';
    activateTuningButton.classList.toggle('bg-red-600', isTuningActive);
    activateTuningButton.classList.toggle('hover:bg-red-700', isTuningActive);
    activateTuningButton.classList.toggle('bg-indigo-600', !isTuningActive);
    activateTuningButton.classList.toggle('hover:bg-indigo-700', !isTuningActive);

    updateTuningStatusSpan();
}

function updateTuningStatusSpan() {
    if (activateTuningButton.disabled) {
        let statusText = "Connect your keyboard first";
        if (outputMode === 'webaudio' && Object.keys(multiSamples).length === 0) statusText = "Loading sounds...";
        else if (outputMode === 'midi' && !midiOutput) statusText = "Connect sound device";
        tuningStatusSpan.textContent = statusText;
        tuningStatusSpan.className = "ml-4 text-sm text-yellow-700 font-medium";
    } else if (isTuningActive) {
        let mode = tuningSystem === 'ji' ? (keyDetectionMode === 'auto' ? `Auto-tuning (${keyFinder.detectedKey.name})` : 'Manual key tuning') : 'Standard tuning';
        tuningStatusSpan.textContent = `Active - ${mode}`;
        tuningStatusSpan.className = "ml-4 text-sm text-green-700 font-medium";
    } else {
        tuningStatusSpan.textContent = "Not Active";
        tuningStatusSpan.className = "ml-4 text-sm text-gray-600";
    }
}

// --- Event Listeners ---
midiInSelect.addEventListener('change', () => {
    if (midiInput) midiInput.onmidimessage = null;
    midiInput = midiInSelect.value ? midiAccess.inputs.get(midiInSelect.value) : null;
    if (midiInput) { midiInput.onmidimessage = onMIDIMessage; logMessage(`Listening to: ${midiInput.name}`); }
    updateUIState();
});

midiOutSelect.addEventListener('change', () => {
    resetAllMidiState();
    midiOutput = midiOutSelect.value ? midiAccess.outputs.get(midiOutSelect.value) : null;
    if (midiOutput) {
        logMessage(`Selected Output: ${midiOutput.name}`);
        
        // --- THE FIX: Add this line ---
        // Send CC #122 (Local Control) with a value of 0 (Off) on channel 1 (0-indexed).
        midiOutput.send([0xB0, 122, 0]); 
        logMessage('Sent Local Control OFF command to the output device.');
    }
    updateUIState();
});

outputModeRadios.forEach(r => r.addEventListener('change', e => {
    resetAllMidiState();
    outputMode = e.target.value;
    midiOutSelect.disabled = outputMode === 'webaudio';
    updateUIState();
}));

tuningSystemRadios.forEach(r => r.addEventListener('change', e => {
    tuningSystem = e.target.value;
    updateUIState();
}));

keyDetectionRadios.forEach(r => r.addEventListener('change', e => {
    keyDetectionMode = e.target.value;
    updateUIState();
}));

scaleTypeSelect.addEventListener('change', e => {
    scaleType = e.target.value;
    if (keyDetectionMode === 'manual' && isTuningActive) {
        applyManualTuning();
    }
});

referenceNoteSelect.addEventListener('change', e => {
    referenceKey = parseInt(e.target.value);
    if (keyDetectionMode === 'manual' && isTuningActive) {
        applyManualTuning();
    }
});

pitchBendRangeSelect.addEventListener('change', e => {
    pitchBendRangeSemitones = parseInt(e.target.value);
    logMessage(`Pitch bend range set to ±${pitchBendRangeSemitones} semitones`);
});

activateTuningButton.addEventListener('click', () => {
    isTuningActive = !isTuningActive;
    if (!isTuningActive) {
        resetAllMidiState();
        // --- Reset tuning adjustments on deactivation ---
        tuningAdjuster.targetAdjustments.fill(0);
        tuningAdjuster.currentAdjustments.fill(0);
    } else if (keyDetectionMode === 'manual') {
        // Apply manual tuning when activating in manual mode
        applyManualTuning();
    }
    logMessage(`Tuning adjustments ${isTuningActive ? 'ACTIVATED' : 'DEACTIVATED'}.`);
    updateUIState();
});

// --- NEW Event Listeners for Simplified UI ---

smartActivateButton.addEventListener('click', () => {
    // Toggle the master tuning state
    isTuningActive = !isTuningActive;

    if (isTuningActive) {
        // Hide the quick start guide once user starts using the tool
        if (quickStartGuide) {
            quickStartGuide.style.display = 'none';
        }
        
        // If activating, force the correct settings
        tuningSystem = 'ji';
        keyDetectionMode = 'auto';
        
        // Also update the radio buttons in the advanced panel to reflect this state
        document.querySelector('input[name="tuningSystem"][value="ji"]').checked = true;
        document.querySelector('input[name="jiReferenceSource"][value="auto"]').checked = true;

        logMessage('Auto-tuning started - listening for key changes');
    } else {
        // If deactivating, reset everything
        resetAllMidiState();
        tuningAdjuster.targetAdjustments.fill(0);
        tuningAdjuster.currentAdjustments.fill(0);
        logMessage('Auto-tuning stopped');
    }
    // Update the entire UI to reflect the new state
    updateUIState();
});

advancedControlsToggle.addEventListener('click', () => {
    advancedControlsContainer.classList.toggle('hidden');
    const isHidden = advancedControlsContainer.classList.contains('hidden');
    advancedControlsToggle.textContent = isHidden ? 'Show Options' : 'Hide Options';
});

panicButton.addEventListener('click', resetAllMidiState);

// --- Smoothing loop using requestAnimationFrame ---
function smoothingLoop() {
    // --- Dynamic Smoothing Factor ---
    const fastTempoThreshold = 100; // From updateAdaptiveWindow
    const smoothingBase = 0.05; // Slower base for more noticeable smoothing
    const dynamicFactor = Math.min(0.3, smoothingBase + (fastTempoThreshold / tempoTracker.avgTime) * 0.15);

    for (let i = 0; i < 12; i++) {
        const current = tuningAdjuster.currentAdjustments[i];
        const target = tuningAdjuster.targetAdjustments[i];
        tuningAdjuster.currentAdjustments[i] += (target - current) * dynamicFactor;
    }

    // --- Retune Held Notes ---
    if (isTuningActive && outputMode === 'midi' && midiOutput) {
        for (const noteStr in activeOnNotes) {
            const note = parseInt(noteStr);
            const pitchClass = note % 12;
            const cents = tuningAdjuster.currentAdjustments[pitchClass];
            
            if (Math.abs(cents) > 0.1) {
                const assignedChannel = activeNotesToMpeChannel[note];
                if (assignedChannel !== undefined) {
                    if (sysExSupported) {
                        midiOutput.send(createMtsSysex(note, cents));
                    } else if (notesUsingBend.has(note)) { // Only send bend if it was originally used
                        const centsPerSemitone = 100;
                        const maxCents = pitchBendRangeSemitones * centsPerSemitone;
                        const bendRatio = cents / maxCents;
                        const bendValue = Math.max(0, Math.min(16383, Math.round(bendRatio * 8192) + 8192));
                        const lsb = bendValue & 0x7F;
                        const msb = (bendValue >> 7) & 0x7F;
                        midiOutput.send([0xE0 | assignedChannel, lsb, msb]);
                    }
                }
            }
        }
    }
    
    requestAnimationFrame(smoothingLoop);
}

// --- Initialization ---
logMessage("Requesting MIDI access...");
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: true })
        .then(onMIDISuccess)
        .catch(onMIDIFailure);
} else { 
    logMessage("Web MIDI API is not supported in this browser.", true); 
    statusDiv.textContent = "Web MIDI API is not supported in this browser.";
    statusDiv.className = 'mb-4 p-3 rounded-md bg-red-100 text-red-800';
}

updateUIState();
requestAnimationFrame(smoothingLoop); // Start the smoothing loop