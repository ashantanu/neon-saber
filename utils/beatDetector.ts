import { BeatMap, BeatEvent } from '../types';

/**
 * Real-time beat detector using Web Audio API
 * Analyzes audio frequencies to detect beats and onsets
 */
export class BeatDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // FFT data
  private frequencyData: Uint8Array = new Uint8Array(0);
  private timeData: Uint8Array = new Uint8Array(0);

  // Beat detection state
  private lastBassEnergy = 0;
  private lastMidEnergy = 0;
  private lastHighEnergy = 0;
  private bassHistory: number[] = [];
  private beatThreshold = 1.4;
  private historySize = 43; // ~1 second at 60fps

  // BPM detection
  private beatTimes: number[] = [];
  private detectedBPM = 0;

  // Callbacks
  private onBeatCallbacks: ((type: 'kick' | 'snare' | 'hihat', intensity: number) => void)[] = [];

  constructor() {
    // Initialize in connect method to handle user gesture requirement
  }

  /**
   * Connect to an audio element for analysis
   */
  connect(audioElement: HTMLAudioElement): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect source
      if (!this.sourceNode) {
        this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }

      // Initialize data arrays
      const bufferLength = this.analyser.frequencyBinCount;
      this.frequencyData = new Uint8Array(bufferLength);
      this.timeData = new Uint8Array(bufferLength);

      // Reset state
      this.bassHistory = [];
      this.beatTimes = [];
      this.lastBassEnergy = 0;
      this.lastMidEnergy = 0;
      this.lastHighEnergy = 0;
    } catch (error) {
      console.error('BeatDetector: Failed to connect audio', error);
    }
  }

  /**
   * Analyze current audio frame and detect beats
   * Call this in your animation loop
   */
  analyze(): { kick: boolean; snare: boolean; hihat: boolean; bassEnergy: number; midEnergy: number; highEnergy: number } {
    if (!this.analyser) {
      return { kick: false, snare: false, hihat: false, bassEnergy: 0, midEnergy: 0, highEnergy: 0 };
    }

    this.analyser.getByteFrequencyData(this.frequencyData);

    // Frequency ranges (assuming 44100Hz sample rate, 2048 FFT size)
    // Each bin = ~21.5Hz
    // Bass: 0-200Hz (bins 0-9)
    // Low-Mid: 200-500Hz (bins 9-23)
    // Mid: 500-2000Hz (bins 23-93)
    // High: 2000-8000Hz (bins 93-372)

    const bassRange = this.frequencyData.slice(0, 10);
    const midRange = this.frequencyData.slice(23, 93);
    const highRange = this.frequencyData.slice(93, 200);

    // Calculate energy levels
    const bassEnergy = this.calculateEnergy(bassRange);
    const midEnergy = this.calculateEnergy(midRange);
    const highEnergy = this.calculateEnergy(highRange);

    // Store bass history for adaptive threshold
    this.bassHistory.push(bassEnergy);
    if (this.bassHistory.length > this.historySize) {
      this.bassHistory.shift();
    }

    // Calculate average bass energy
    const avgBassEnergy = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length;

    // Beat detection with adaptive threshold
    const kick = bassEnergy > avgBassEnergy * this.beatThreshold && bassEnergy > this.lastBassEnergy * 1.1;
    const snare = midEnergy > this.lastMidEnergy * 1.5 && midEnergy > 50;
    const hihat = highEnergy > this.lastHighEnergy * 1.3 && highEnergy > 30;

    // Track beat times for BPM calculation
    if (kick) {
      const now = performance.now() / 1000;
      this.beatTimes.push(now);

      // Keep only last 20 beats
      if (this.beatTimes.length > 20) {
        this.beatTimes.shift();
      }

      // Calculate BPM from beat intervals
      if (this.beatTimes.length > 4) {
        this.detectedBPM = this.calculateBPM();
      }

      // Fire callbacks
      this.onBeatCallbacks.forEach(cb => cb('kick', bassEnergy / 255));
    }

    if (snare) {
      this.onBeatCallbacks.forEach(cb => cb('snare', midEnergy / 255));
    }

    if (hihat) {
      this.onBeatCallbacks.forEach(cb => cb('hihat', highEnergy / 255));
    }

    // Update last values
    this.lastBassEnergy = bassEnergy;
    this.lastMidEnergy = midEnergy;
    this.lastHighEnergy = highEnergy;

    return { kick, snare, hihat, bassEnergy, midEnergy, highEnergy };
  }

  /**
   * Calculate energy of a frequency range
   */
  private calculateEnergy(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / data.length;
  }

  /**
   * Calculate BPM from beat times
   */
  private calculateBPM(): number {
    if (this.beatTimes.length < 2) return 0;

    // Calculate intervals between beats
    const intervals: number[] = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }

    // Filter out outliers (intervals that are too short or too long)
    const filteredIntervals = intervals.filter(i => i > 0.25 && i < 1.5);

    if (filteredIntervals.length === 0) return 0;

    // Calculate average interval
    const avgInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;

    // Convert to BPM
    return Math.round(60 / avgInterval);
  }

  /**
   * Get the detected BPM
   */
  getBPM(): number {
    return this.detectedBPM;
  }

  /**
   * Get current frequency data for visualization
   */
  getFrequencyData(): Uint8Array {
    return this.frequencyData;
  }

  /**
   * Register a callback for beat events
   */
  onBeat(callback: (type: 'kick' | 'snare' | 'hihat', intensity: number) => void): void {
    this.onBeatCallbacks.push(callback);
  }

  /**
   * Set beat detection sensitivity
   */
  setSensitivity(sensitivity: number): void {
    // sensitivity 1-10, where 1 is most sensitive, 10 is least
    this.beatThreshold = 1 + (sensitivity * 0.1);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }
    this.sourceNode = null;
    this.analyser = null;
    this.onBeatCallbacks = [];
  }
}

/**
 * Pre-analyze an audio buffer to extract beat map
 * This runs once when a song is loaded for more accurate beat placement
 */
export async function analyzeAudioBuffer(audioBuffer: AudioBuffer): Promise<BeatMap> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Use first channel

  // Parameters
  const windowSize = Math.floor(sampleRate * 0.023); // ~23ms window
  const hopSize = Math.floor(windowSize / 2);

  const beats: number[] = [];
  const onsets: number[] = [];
  const events: BeatEvent[] = [];

  // Calculate spectral flux for onset detection
  let prevEnergy = 0;
  const energyHistory: number[] = [];
  const historySize = 43;

  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    // Calculate energy in window
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += channelData[i + j] ** 2;
    }
    energy = Math.sqrt(energy / windowSize);

    // Store history
    energyHistory.push(energy);
    if (energyHistory.length > historySize) {
      energyHistory.shift();
    }

    // Calculate threshold
    const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
    const threshold = avgEnergy * 1.5;

    // Detect onset
    const time = i / sampleRate;
    if (energy > threshold && energy > prevEnergy * 1.3) {
      onsets.push(time);

      // Add as beat event
      events.push({
        time,
        type: 'beat',
        intensity: Math.min(energy / 0.5, 1)
      });
    }

    prevEnergy = energy;
  }

  // Filter onsets to get beats (minimum 100ms apart)
  let lastBeatTime = -1;
  for (const onset of onsets) {
    if (onset - lastBeatTime > 0.1) {
      beats.push(onset);
      lastBeatTime = onset;
    }
  }

  // Calculate BPM from beat intervals
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(beats.length, 50); i++) {
    intervals.push(beats[i] - beats[i - 1]);
  }

  const filteredIntervals = intervals.filter(i => i > 0.25 && i < 1.5);
  const avgInterval = filteredIntervals.length > 0
    ? filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length
    : 0.5;

  const bpm = Math.round(60 / avgInterval);

  return {
    bpm,
    beats,
    onsets,
    events
  };
}

// Singleton instance
let beatDetectorInstance: BeatDetector | null = null;

export function getBeatDetector(): BeatDetector {
  if (!beatDetectorInstance) {
    beatDetectorInstance = new BeatDetector();
  }
  return beatDetectorInstance;
}
