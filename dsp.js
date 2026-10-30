// P142 local spectral pitch analysis. No network calls or external dependencies.
export const MIDI_MIN = 36, MIDI_MAX = 96;
export const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
export function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imag[i], imag[j]] = [imag[j], imag[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len, wr0 = Math.cos(angle), wi0 = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = start + j, b = a + len / 2;
        const vr = real[b] * wr - imag[b] * wi, vi = real[b] * wi + imag[b] * wr;
        real[b] = real[a] - vr; imag[b] = imag[a] - vi;
        real[a] += vr; imag[a] += vi;
        const next = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = next;
      }
    }
  }
}
export function resample(data, sampleRate, target = 22050) {
  if (sampleRate === target) return data;
  // Windowed-sinc anti-alias filter; handles non-integer sample-rate ratios.
  const ratio = sampleRate / target, size = Math.floor(data.length / ratio), out = new Float32Array(size);
  const cutoff = Math.min(1, 1 / ratio) * .94, radius = Math.ceil(10 / cutoff);
  for (let i = 0; i < size; i++) {
    const t = i * ratio, middle = Math.floor(t); let sum = 0, weight = 0;
    for (let j = Math.max(0, middle - radius); j <= Math.min(data.length - 1, middle + radius); j++) {
      const d = t - j, z = Math.PI * cutoff * d;
      const w = (Math.abs(z) < 1e-10 ? cutoff : Math.sin(z) / (Math.PI * d)) * (.5 + .5 * Math.cos(Math.PI * d / (radius + 1)));
      sum += data[j] * w; weight += w;
    }
    out[i] = weight ? sum / weight : 0;
  }
  return out;
}
function getPeaks(real, imag, rate, n) {
  const mags = new Float64Array(n / 2);
  for (let i = 1; i < mags.length; i++) mags[i] = Math.hypot(real[i], imag[i]);
  const peaks = [];
  for (let i = 2; i < mags.length - 1; i++) {
    if (mags[i] <= mags[i - 1] || mags[i] < mags[i + 1]) continue;
    const a = Math.log(mags[i - 1] + 1e-15), b = Math.log(mags[i] + 1e-15), c = Math.log(mags[i + 1] + 1e-15);
    const den = a - 2 * b + c, offset = den ? Math.max(-.5, Math.min(.5, .5 * (a - c) / den)) : 0;
    const f = (i + offset) * rate / n;
    if (f < 60 || f > 9000) continue;
    peaks.push({ f, amp: Math.exp(b - .25 * (a - c) * offset) });
  }
  return peaks.sort((a, b) => b.amp - a.amp).slice(0, 45);
}
export function detectFrame(samples, center, rate, poly = false) {
  const n = poly ? 4096 : 2048, real = new Float64Array(n), imag = new Float64Array(n);
  let energy = 0, centeredEnergy = 0, centeredCount = 0;
  for (let i = 0; i < n; i++) {
    const sample = samples[center + i - n / 2] || 0;
    energy += sample * sample;
    if (Math.abs(i - n / 2) <= 128) { centeredEnergy += sample * sample; centeredCount++; }
    real[i] = sample * (.5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  }
  const rms = Math.sqrt(centeredEnergy / centeredCount);
  if (rms < 1e-7) return { pitches: [], rms, confidence: 0 };
  fft(real, imag);
  const peaks = getPeaks(real, imag, rate, n), max = peaks[0]?.amp || 0;
  if (!max) return { pitches: [], rms, confidence: 0 };
  const nearest = (f, tolerance = 38) => {
    let best = null;
    for (const p of peaks) if (Math.abs(1200 * Math.log2(p.f / f)) < tolerance && (!best || p.amp > best.amp)) best = p;
    return best;
  };
  const candidates = [];
  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    const root = nearest(frequency(midi), 48);
    if (!root || root.amp < max * .085) continue;
    let support = 0, harmonicCount = 0;
    for (let h = 2; h <= 6; h++) {
      const harmonic = nearest(root.f * h, 30);
      if (harmonic && harmonic.amp > max * .035) { support += harmonic.amp * .85 ** (h - 1); harmonicCount++; }
    }
    const cents = 1200 * Math.log2(root.f / frequency(midi));
    candidates.push({ midi, f: root.f, amp: root.amp, score: root.amp + support, harmonicCount, cents });
  }
  if (!candidates.length) return { pitches: [], rms, confidence: 0 };
  candidates.sort((a, b) => b.score - a.score);
  let accepted;
  if (!poly) accepted = [candidates[0]];
  else {
    const eligible = candidates.filter(c => c.amp > max * .18).sort((a, b) => a.f - b.f);
    accepted = [];
    for (const c of eligible) {
      const overtone = accepted.some(p => {
        const multiple = Math.round(c.f / p.f);
        return multiple >= 2 && multiple <= 8 && Math.abs(1200 * Math.log2(c.f / (p.f * multiple))) < 28 && c.amp < p.amp * 2.8;
      });
      if (!overtone) accepted.push(c);
    }
    accepted = accepted.sort((a, b) => b.amp - a.amp).slice(0, 5).sort((a, b) => a.midi - b.midi);
  }
  const explained = Math.min(1, candidates[0].score / peaks.slice(0, 12).reduce((s, p) => s + p.amp, 0));
  const tuning = Math.max(0, 1 - Math.abs(candidates[0].cents) / 65);
  // A heuristic quality score, not a calibrated probability of correctness.
  const confidence = Math.min(.98, .25 + .55 * explained + .2 * tuning);
  return { pitches: accepted.map(c => c.midi), rms, confidence, cents: candidates[0].cents, energy: energy / n };
}
function median(values) { const a = values.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }
export function framesToEvents(frames, hopSeconds, minDuration, offset = 0, totalDuration = Infinity) {
  if (!frames.length) return [];
  const smoothed = frames.map((f, i) => {
    const prev = frames[Math.max(0, i - 1)], next = frames[Math.min(frames.length - 1, i + 1)];
    // Isolated octave glitches are corrected only between equal, sounding neighbors.
    if (prev.pitches.length === 1 && next.pitches.length === 1 && prev.pitches[0] === next.pitches[0] && f.pitches.length === 1)
      return { ...f, pitches: [median([prev.pitches[0], f.pitches[0], next.pitches[0]])] };
    return f;
  });
  const events = []; let current = null;
  for (let i = 0; i < smoothed.length; i++) {
    const f = smoothed[i], signature = f.pitches.join(','), prev = smoothed[i - 1];
    const time = Math.min(totalDuration, Math.max(0, i * hopSeconds - hopSeconds / 2));
    const reattack = current && signature && current.signature === signature && i - current.first > 4 && prev && f.rms > prev.rms * 2.2 && prev.rms < current.peak * .6;
    if (current && (signature !== current.signature || reattack)) {
      current.end = time; events.push(current); current = null;
    }
    if (signature && !current) current = { signature, pitches: f.pitches.slice(), start: time, end: time, first: i, confidenceSum: 0, count: 0, cents: [], peak: f.rms };
    if (current) { current.count++; current.confidenceSum += f.confidence; current.cents.push(f.cents || 0); current.peak = Math.max(current.peak, f.rms); }
  }
  if (current) { current.end = Math.min(totalDuration, smoothed.length * hopSeconds); events.push(current); }
  // Bridge a single-frame interruption; retain repeated notes separated by actual silence.
  const merged = [];
  for (const ev of events) {
    const prev = merged.at(-1);
    if (prev && ev.signature === prev.signature && ev.start - prev.end <= hopSeconds * 1.05 && ev.start > prev.end && ev.end - ev.start < minDuration) {
      prev.end = ev.end; prev.count += ev.count; prev.confidenceSum += ev.confidenceSum; prev.cents.push(...ev.cents);
    } else merged.push(ev);
  }
  return merged.filter(e => e.end - e.start >= minDuration).map((e, i) => ({
    id: i + 1, pitches: e.pitches, start: +(e.start + offset).toFixed(3), end: +(e.end + offset).toFixed(3),
    confidence: +(e.confidenceSum / e.count).toFixed(3), cents: +median(e.cents).toFixed(1), edited: false
  }));
}
export function analyzeSamples(data, sampleRate, options = {}, onProgress = () => {}) {
  const target = 22050, samples = resample(data, sampleRate, target), hop = 256;
  const frames = [], total = Math.ceil(samples.length / hop);
  let maxRms = 0;
  for (let i = 0; i < total; i++) {
    const frame = detectFrame(samples, i * hop, target, options.mode === 'poly');
    maxRms = Math.max(maxRms, frame.rms); frames.push(frame);
    if (i % 35 === 0) onProgress(Math.round(i / total * 92));
  }
  // Relative floor permits quiet but otherwise clear recordings.
  const floor = Math.max(1e-6, maxRms * (options.gate ?? .025));
  for (const f of frames) if (f.rms < floor || f.confidence < .38) f.pitches = [];
  onProgress(96);
  return { events: framesToEvents(frames, hop / target, options.minDuration ?? .1, options.offset || 0, samples.length / target), maxRms, frameCount: total, algorithm: 'P142-spectral-v1', mode: options.mode || 'melody' };
}
