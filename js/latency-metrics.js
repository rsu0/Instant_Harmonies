// Latency Metrics - comprehensive benchmarking for JI tuning system
// Measures hardware timestamps, software processing, and MIDI transmission time
// MIDI 1.0 rate: 31.25 kbaud = 3125 bytes/sec = 0.32ms per byte

const MAX_SAMPLES = 1000;
const WARMUP_SAMPLES = 10;
const MIDI_BAUD_RATE = 31250;
const BITS_PER_BYTE = 10;
const MS_PER_BYTE = (BITS_PER_BYTE / MIDI_BAUD_RATE) * 1000;

let measurements = {
    MTS_ScaleOctave: [],
    MTS_SingleNote: [],
    MPE: [],
    Internal: []
};

let currentMeasurement = null;
let sampleCount = 0;
let isEnabled = true;
let sessionStartTime = null;

export function startMeasurement(hardwareTimestamp = null) {
    if (!isEnabled) return;
    
    if (!sessionStartTime) {
        sessionStartTime = performance.now();
    }
    
    const now = performance.now();
    
    currentMeasurement = {
        t_hardware: hardwareTimestamp,
        t0_noteReceived: now,
        t1_keyDetectionDone: null,
        t2_tuningCalculated: null,
        t3_midiSent: null,
        mode: null,
        mtsSubMode: null,
        bytesSent: 0,
        keyDetectionRan: false,
        midiNote: null,
        callbackLatency: null,
        processingLatency: null,
        transmissionTime: null
    };
}

export function setNoteNumber(note) {
    if (!isEnabled || !currentMeasurement) return;
    currentMeasurement.midiNote = note;
}

export function markKeyDetectionDone(detectionActuallyRan = true) {
    if (!isEnabled || !currentMeasurement) return;
    currentMeasurement.t1_keyDetectionDone = performance.now();
    currentMeasurement.keyDetectionRan = detectionActuallyRan;
}

export function markTuningCalculated() {
    if (!isEnabled || !currentMeasurement) return;
    currentMeasurement.t2_tuningCalculated = performance.now();
}

export function completeMeasurement(mode, options = {}) {
    if (!isEnabled || !currentMeasurement) return;
    
    const now = performance.now();
    currentMeasurement.t3_midiSent = now;
    currentMeasurement.mode = mode;
    currentMeasurement.bytesSent = options.bytesSent || 0;
    currentMeasurement.mtsSubMode = options.mtsSubMode || null;
    
    sampleCount++;
    
    if (sampleCount <= WARMUP_SAMPLES) {
        currentMeasurement = null;
        return;
    }
    
    const m = currentMeasurement;
    
    const callbackLatency = m.t_hardware ? (m.t0_noteReceived - m.t_hardware) : null;
    const processingLatency = m.t3_midiSent - m.t0_noteReceived;
    const transmissionTime = m.bytesSent > 0 ? m.bytesSent * MS_PER_BYTE : 0;
    
    const keyDetectionTime = m.t1_keyDetectionDone 
        ? m.t1_keyDetectionDone - m.t0_noteReceived 
        : null;
    
    const tuningCalcTime = m.t2_tuningCalculated
        ? m.t2_tuningCalculated - (m.t1_keyDetectionDone || m.t0_noteReceived)
        : null;
    
    const midiSendTime = m.t3_midiSent - (m.t2_tuningCalculated || m.t0_noteReceived);
    
    const record = {
        processingLatency,
        callbackLatency,
        transmissionTime,
        totalEstimated: processingLatency + transmissionTime,
        keyDetection: keyDetectionTime,
        keyDetectionRan: m.keyDetectionRan,
        tuningCalc: tuningCalcTime,
        midiSend: midiSendTime,
        bytesSent: m.bytesSent,
        mtsSubMode: m.mtsSubMode,
        midiNote: m.midiNote,
        timestamp: Date.now(),
        sessionOffset: now - sessionStartTime
    };
    
    let bucket;
    if (mode === 'MTS') {
        bucket = m.mtsSubMode === 'scale_octave' ? 'MTS_ScaleOctave' : 'MTS_SingleNote';
    } else if (mode === 'MPE') {
        bucket = 'MPE';
    } else if (mode === 'Internal') {
        bucket = 'Internal';
    } else {
        bucket = 'MPE';
    }
    
    measurements[bucket].push(record);
    
    if (measurements[bucket].length > MAX_SAMPLES) {
        measurements[bucket].shift();
    }
    
    currentMeasurement = null;
}

export function cancelMeasurement() {
    currentMeasurement = null;
}

function calculateStats(values) {
    if (!values || values.length === 0) {
        return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0, p50: 0, p95: 0, p99: 0, iqr: 0 };
    }
    
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const sorted = [...values].sort((a, b) => a - b);
    
    const p50 = sorted[Math.floor(n * 0.50)] || sorted[n - 1];
    const p95 = sorted[Math.floor(n * 0.95)] || sorted[n - 1];
    const p99 = sorted[Math.floor(n * 0.99)] || sorted[n - 1];
    
    const q1 = sorted[Math.floor(n * 0.25)] || sorted[0];
    const q3 = sorted[Math.floor(n * 0.75)] || sorted[n - 1];
    const iqr = q3 - q1;
    
    return { mean, stdDev, min: sorted[0], max: sorted[n - 1], p50, p95, p99, iqr, count: n };
}

export function getStatsForMode(bucket) {
    const data = measurements[bucket] || [];
    
    const processing = data.map(r => r.processingLatency);
    const callback = data.map(r => r.callbackLatency).filter(v => v !== null);
    const transmission = data.map(r => r.transmissionTime);
    const totalEstimated = data.map(r => r.totalEstimated);
    const keyDetections = data.filter(r => r.keyDetectionRan).map(r => r.keyDetection).filter(v => v !== null);
    const tuningCalcs = data.map(r => r.tuningCalc).filter(v => v !== null);
    const midiSends = data.map(r => r.midiSend);
    const byteCounts = data.map(r => r.bytesSent);
    
    return {
        processing: calculateStats(processing),
        callback: calculateStats(callback),
        transmission: calculateStats(transmission),
        totalEstimated: calculateStats(totalEstimated),
        keyDetection: calculateStats(keyDetections),
        tuningCalc: calculateStats(tuningCalcs),
        midiSend: calculateStats(midiSends),
        bytes: calculateStats(byteCounts),
        sampleCount: data.length,
        keyDetectionSamples: keyDetections.length
    };
}

export function getAllStats() {
    const buckets = ['MTS_ScaleOctave', 'MTS_SingleNote', 'MPE', 'Internal'];
    const stats = {};
    
    for (const bucket of buckets) {
        stats[bucket] = getStatsForMode(bucket);
    }
    
    const allMTSData = [...measurements.MTS_ScaleOctave, ...measurements.MTS_SingleNote];
    stats.MTS_Combined = {
        processing: calculateStats(allMTSData.map(r => r.processingLatency)),
        totalEstimated: calculateStats(allMTSData.map(r => r.totalEstimated)),
        sampleCount: allMTSData.length
    };
    
    const totalSamples = buckets.reduce((sum, b) => sum + measurements[b].length, 0);
    
    return {
        ...stats,
        totalSamples,
        warmupSkipped: Math.min(sampleCount, WARMUP_SAMPLES),
        sessionDuration: sessionStartTime ? (performance.now() - sessionStartTime) / 1000 : 0
    };
}

// Welch's t-test for comparing two modes
export function compareModes(bucket1, bucket2, metric = 'totalEstimated') {
    const data1 = measurements[bucket1]?.map(r => r[metric]).filter(v => v !== null) || [];
    const data2 = measurements[bucket2]?.map(r => r[metric]).filter(v => v !== null) || [];
    
    if (data1.length < 2 || data2.length < 2) {
        return { error: 'Insufficient data for comparison', n1: data1.length, n2: data2.length };
    }
    
    const n1 = data1.length;
    const n2 = data2.length;
    const mean1 = data1.reduce((a, b) => a + b, 0) / n1;
    const mean2 = data2.reduce((a, b) => a + b, 0) / n2;
    const var1 = data1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1);
    const var2 = data2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1);
    
    const se = Math.sqrt(var1 / n1 + var2 / n2);
    const t = (mean1 - mean2) / se;
    
    const df = Math.pow(var1 / n1 + var2 / n2, 2) / 
               (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
    
    const approxP = 2 * (1 - approximateTCDF(Math.abs(t), df));
    
    return {
        bucket1, bucket2, metric,
        n1, n2, mean1, mean2,
        diff: mean1 - mean2,
        tStatistic: t,
        degreesOfFreedom: df,
        pValue: approxP,
        significant: approxP < 0.05
    };
}

function approximateTCDF(t, df) {
    if (df > 30) return normalCDF(t);
    const x = df / (df + t * t);
    return 1 - 0.5 * Math.pow(x, df / 2);
}

function normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

export function printStats() {
    const stats = getAllStats();
    
    console.log('LATENCY BENCHMARK RESULTS');
    console.log('='.repeat(70));
    
    if (stats.totalSamples === 0) {
        console.log('No measurements collected yet. Play some notes first!');
        return stats;
    }
    
    const formatMs = (v) => v?.toFixed(3) || '—';
    const formatBytes = (v) => v?.toFixed(0) || '—';
    
    console.log(`Session: ${stats.sessionDuration.toFixed(1)}s | Warmup: ${stats.warmupSkipped} samples skipped\n`);
    
    for (const bucket of ['MTS_SingleNote', 'MTS_ScaleOctave', 'MPE', 'Internal']) {
        const m = stats[bucket];
        if (m.sampleCount === 0) continue;
        
        const modeLabel = {
            'MTS_SingleNote': 'MTS Single-Note (per-note SysEx)',
            'MTS_ScaleOctave': 'MTS Scale/Octave (key-change SysEx)',
            'MPE': 'MPE (per-channel pitch bend)',
            'Internal': 'Internal (Web Audio)'
        }[bucket];
        
        console.log(`${modeLabel} (n=${m.sampleCount}):`);
        console.log(`  Processing: ${formatMs(m.processing.mean)} ms (σ=${formatMs(m.processing.stdDev)}, p95=${formatMs(m.processing.p95)})`);
        
        if (m.callback.count > 0) {
            console.log(`  Callback:   ${formatMs(m.callback.mean)} ms (hardware→JS)`);
        }
        
        if (bucket !== 'Internal') {
            console.log(`  Transmit:   ${formatMs(m.transmission.mean)} ms (${formatBytes(m.bytes.mean)} bytes avg)`);
            console.log(`  TOTAL:      ${formatMs(m.totalEstimated.mean)} ms (p50=${formatMs(m.totalEstimated.p50)}, p95=${formatMs(m.totalEstimated.p95)})`);
        } else {
            console.log(`  TOTAL:      ${formatMs(m.processing.mean)} ms (+ Web Audio buffer)`);
        }
        console.log('');
    }
    
    if (stats.MPE.sampleCount >= 10 && stats.MTS_SingleNote.sampleCount >= 10) {
        const comparison = compareModes('MPE', 'MTS_SingleNote', 'totalEstimated');
        const diff = comparison.mean1 - comparison.mean2;
        console.log('MPE vs MTS Single-Note:');
        console.log(`  Difference: ${diff > 0 ? '+' : ''}${formatMs(diff)} ms (MPE ${diff > 0 ? 'slower' : 'faster'})`);
        console.log(`  t=${comparison.tStatistic.toFixed(3)}, p=${comparison.pValue.toFixed(4)} ${comparison.significant ? '(significant)' : ''}`);
    }
    
    return stats;
}

export function exportData() {
    const stats = getAllStats();
    
    return {
        measurements: {
            MTS_ScaleOctave: [...measurements.MTS_ScaleOctave],
            MTS_SingleNote: [...measurements.MTS_SingleNote],
            MPE: [...measurements.MPE],
            Internal: [...measurements.Internal]
        },
        stats,
        comparisons: {
            MPE_vs_MTS_SingleNote: compareModes('MPE', 'MTS_SingleNote', 'totalEstimated'),
            MPE_vs_MTS_ScaleOctave: compareModes('MPE', 'MTS_ScaleOctave', 'totalEstimated')
        },
        exportTime: new Date().toISOString(),
        sessionDuration: stats.sessionDuration,
        config: { maxSamples: MAX_SAMPLES, warmupSamples: WARMUP_SAMPLES, midiBaudRate: MIDI_BAUD_RATE, msPerByte: MS_PER_BYTE }
    };
}

export function clearStats() {
    measurements = { MTS_ScaleOctave: [], MTS_SingleNote: [], MPE: [], Internal: [] };
    sampleCount = 0;
    currentMeasurement = null;
    sessionStartTime = null;
    console.log('Latency statistics cleared');
}

export function setEnabled(enabled) {
    isEnabled = enabled;
    console.log(`Latency measurement ${enabled ? 'enabled' : 'disabled'}`);
}

export function isMetricsEnabled() {
    return isEnabled;
}

export { compareModes as compareLatencyModes };
