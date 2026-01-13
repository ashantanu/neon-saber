/**
 * 8-bit Audio Generator
 * Generates retro-style game sounds using Web Audio API
 */

// Track patterns for different songs
interface TrackPattern {
  melody: Array<{ note: number; duration: number }>;
  bass: Array<{ note: number; duration: number }>;
}

const TRACK_PATTERNS: Record<string, TrackPattern> = {
  // Track 1: Neon Runner - Classic chiptune (original)
  '1': {
    melody: [
      { note: 523.25, duration: 0.2 },  // C5
      { note: 587.33, duration: 0.2 },  // D5
      { note: 659.25, duration: 0.2 },  // E5
      { note: 783.99, duration: 0.4 },  // G5
      { note: 659.25, duration: 0.2 },  // E5
      { note: 587.33, duration: 0.2 },  // D5
      { note: 523.25, duration: 0.4 },  // C5
      { note: 392.00, duration: 0.4 },  // G4
    ],
    bass: [
      { note: 130.81, duration: 0.8 },  // C3
      { note: 196.00, duration: 0.8 },  // G3
      { note: 146.83, duration: 0.8 },  // D3
      { note: 130.81, duration: 0.8 },  // C3
    ]
  },
  // Track 2: Digital Pulse - 8-bit Funky groove
  '2': {
    melody: [
      { note: 392.00, duration: 0.15 },  // G4
      { note: 0, duration: 0.05 },       // rest
      { note: 392.00, duration: 0.1 },   // G4
      { note: 440.00, duration: 0.2 },   // A4
      { note: 493.88, duration: 0.15 },  // B4
      { note: 523.25, duration: 0.15 },  // C5
      { note: 0, duration: 0.1 },        // rest
      { note: 587.33, duration: 0.2 },   // D5
      { note: 523.25, duration: 0.1 },   // C5
      { note: 493.88, duration: 0.1 },   // B4
      { note: 440.00, duration: 0.3 },   // A4
      { note: 392.00, duration: 0.1 },   // G4
      { note: 329.63, duration: 0.3 },   // E4
    ],
    bass: [
      { note: 98.00, duration: 0.2 },    // G2
      { note: 0, duration: 0.1 },        // rest
      { note: 98.00, duration: 0.1 },    // G2
      { note: 110.00, duration: 0.4 },   // A2
      { note: 123.47, duration: 0.2 },   // B2
      { note: 0, duration: 0.1 },        // rest
      { note: 110.00, duration: 0.2 },   // A2
      { note: 98.00, duration: 0.3 },    // G2
      { note: 82.41, duration: 0.4 },    // E2
    ]
  },
  // Track 3: Cyber Chase - Diverse/Intense with arpeggios
  '3': {
    melody: [
      { note: 659.25, duration: 0.1 },   // E5
      { note: 783.99, duration: 0.1 },   // G5
      { note: 987.77, duration: 0.1 },   // B5
      { note: 1174.66, duration: 0.2 },  // D6
      { note: 987.77, duration: 0.1 },   // B5
      { note: 783.99, duration: 0.1 },   // G5
      { note: 659.25, duration: 0.1 },   // E5
      { note: 587.33, duration: 0.1 },   // D5
      { note: 659.25, duration: 0.1 },   // E5
      { note: 783.99, duration: 0.15 },  // G5
      { note: 880.00, duration: 0.15 },  // A5
      { note: 783.99, duration: 0.1 },   // G5
      { note: 659.25, duration: 0.15 },  // E5
      { note: 523.25, duration: 0.2 },   // C5
      { note: 587.33, duration: 0.1 },   // D5
      { note: 659.25, duration: 0.2 },   // E5
    ],
    bass: [
      { note: 164.81, duration: 0.15 },  // E3
      { note: 196.00, duration: 0.15 },  // G3
      { note: 246.94, duration: 0.15 },  // B3
      { note: 196.00, duration: 0.15 },  // G3
      { note: 174.61, duration: 0.15 },  // F3
      { note: 196.00, duration: 0.15 },  // G3
      { note: 220.00, duration: 0.3 },   // A3
      { note: 164.81, duration: 0.2 },   // E3
      { note: 130.81, duration: 0.3 },   // C3
      { note: 146.83, duration: 0.2 },   // D3
      { note: 164.81, duration: 0.3 },   // E3
    ]
  }
};

export class Audio8Bit {
  private audioContext: AudioContext;
  private bgMusicGain: GainNode | null = null;
  private bgMusicNodes: OscillatorNode[] = [];
  private previewGain: GainNode | null = null;
  private previewNodes: OscillatorNode[] = [];
  private previewTimeouts: number[] = [];
  private previewAutoStopTimeout: number | null = null;
  private currentPreviewSongId: string | null = null;
  private isPreviewPlaying: boolean = false;
  private onPreviewEndCallback: (() => void) | null = null;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  /**
   * Set callback for when preview ends (auto-stops or is stopped)
   */
  setOnPreviewEnd(callback: (() => void) | null) {
    this.onPreviewEndCallback = callback;
  }

  /**
   * Play 8-bit explosion sound
   */
  playExplosion() {
    const now = this.audioContext.currentTime;

    // Create noise burst with pitch drop
    const noise = this.audioContext.createOscillator();
    const noiseGain = this.audioContext.createGain();

    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(200, now);
    noise.frequency.exponentialRampToValueAtTime(20, now + 0.3);

    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);

    noise.start(now);
    noise.stop(now + 0.3);
  }

  /**
   * Play 8-bit game start jingle
   */
  playGameStart() {
    const now = this.audioContext.currentTime;

    // Ascending arpeggio: C4, E4, G4, C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.15;

    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'square';
      osc.frequency.value = freq;

      const startTime = now + (i * duration);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Start looping 8-bit background music for a specific song
   */
  startBackgroundMusic(songId: string = '1') {
    if (this.bgMusicNodes.length > 0) {
      this.stopBackgroundMusic();
    }

    // Get pattern for the song, default to track 1 if not found
    const pattern = TRACK_PATTERNS[songId] || TRACK_PATTERNS['1'];

    // Create master gain for background music
    this.bgMusicGain = this.audioContext.createGain();
    this.bgMusicGain.gain.value = 0.15; // Keep it subtle
    this.bgMusicGain.connect(this.audioContext.destination);

    this.scheduleMelodyLoop(pattern.melody, 0);
    this.scheduleBassLoop(pattern.bass, 0);
  }

  /**
   * Play track preview - plays for a few seconds then auto-stops
   * If same song is already playing, stop it (toggle behavior)
   */
  playTrackPreview(songId: string): boolean {
    // If same song is playing, stop it (toggle off)
    if (this.isPreviewPlaying && this.currentPreviewSongId === songId) {
      this.stopTrackPreview();
      return false;
    }

    // Stop any existing preview
    this.stopTrackPreview();

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Get pattern for the song, default to track 1 if not found
    const pattern = TRACK_PATTERNS[songId] || TRACK_PATTERNS['1'];

    // Create master gain for preview
    this.previewGain = this.audioContext.createGain();
    this.previewGain.gain.value = 0.2; // Slightly louder for preview
    this.previewGain.connect(this.audioContext.destination);

    this.currentPreviewSongId = songId;
    this.isPreviewPlaying = true;

    // Start preview loops
    this.schedulePreviewMelodyLoop(pattern.melody);
    this.schedulePreviewBassLoop(pattern.bass);

    // Auto-stop after 6 seconds
    this.previewAutoStopTimeout = window.setTimeout(() => {
      this.stopTrackPreview();
    }, 6000);

    return true;
  }

  /**
   * Stop track preview
   */
  stopTrackPreview() {
    const wasPlaying = this.isPreviewPlaying;

    // Clear auto-stop timeout
    if (this.previewAutoStopTimeout !== null) {
      clearTimeout(this.previewAutoStopTimeout);
      this.previewAutoStopTimeout = null;
    }

    // Clear all scheduled timeouts
    this.previewTimeouts.forEach(timeout => clearTimeout(timeout));
    this.previewTimeouts = [];

    // Stop all preview oscillators
    this.previewNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    this.previewNodes = [];

    // Disconnect preview gain
    if (this.previewGain) {
      this.previewGain.disconnect();
      this.previewGain = null;
    }

    this.currentPreviewSongId = null;
    this.isPreviewPlaying = false;

    // Call the callback if preview was playing
    if (wasPlaying && this.onPreviewEndCallback) {
      this.onPreviewEndCallback();
    }
  }

  /**
   * Check if preview is currently playing for a song
   */
  isPreviewPlayingForSong(songId: string): boolean {
    return this.isPreviewPlaying && this.currentPreviewSongId === songId;
  }

  /**
   * Schedule preview melody loop (limited loops for preview)
   */
  private schedulePreviewMelodyLoop(pattern: Array<{ note: number, duration: number }>) {
    const loopMusic = () => {
      if (!this.previewGain || !this.isPreviewPlaying) return;

      const now = this.audioContext.currentTime;
      let currentTime = now;

      pattern.forEach((noteData) => {
        if (noteData.note === 0) {
          // Rest - just advance time
          currentTime += noteData.duration;
          return;
        }

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'square';
        osc.frequency.value = noteData.note;

        gain.gain.setValueAtTime(0, currentTime);
        gain.gain.linearRampToValueAtTime(1, currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0.6, currentTime + noteData.duration * 0.3);
        gain.gain.setValueAtTime(0.6, currentTime + noteData.duration * 0.8);
        gain.gain.linearRampToValueAtTime(0, currentTime + noteData.duration);

        osc.connect(gain);
        gain.connect(this.previewGain!);

        osc.start(currentTime);
        osc.stop(currentTime + noteData.duration);

        this.previewNodes.push(osc);

        currentTime += noteData.duration;
      });

      const patternDuration = pattern.reduce((sum, note) => sum + note.duration, 0);
      const timeout = window.setTimeout(() => loopMusic(), patternDuration * 1000);
      this.previewTimeouts.push(timeout);
    };

    loopMusic();
  }

  /**
   * Schedule preview bass loop
   */
  private schedulePreviewBassLoop(pattern: Array<{ note: number, duration: number }>) {
    const loopBass = () => {
      if (!this.previewGain || !this.isPreviewPlaying) return;

      const now = this.audioContext.currentTime;
      let currentTime = now;

      pattern.forEach((noteData) => {
        if (noteData.note === 0) {
          currentTime += noteData.duration;
          return;
        }

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.value = noteData.note;

        gain.gain.setValueAtTime(0.4, currentTime);
        gain.gain.linearRampToValueAtTime(0.1, currentTime + noteData.duration);

        osc.connect(gain);
        gain.connect(this.previewGain!);

        osc.start(currentTime);
        osc.stop(currentTime + noteData.duration);

        this.previewNodes.push(osc);

        currentTime += noteData.duration;
      });

      const patternDuration = pattern.reduce((sum, note) => sum + note.duration, 0);
      const timeout = window.setTimeout(() => loopBass(), patternDuration * 1000);
      this.previewTimeouts.push(timeout);
    };

    loopBass();
  }

  /**
   * Schedule melody loop
   */
  private scheduleMelodyLoop(pattern: Array<{ note: number, duration: number }>, startOffset: number) {
    const loopMusic = () => {
      if (!this.bgMusicGain) return;

      const now = this.audioContext.currentTime;
      let currentTime = now;

      pattern.forEach((noteData) => {
        if (noteData.note === 0) {
          // Rest - just advance time
          currentTime += noteData.duration;
          return;
        }

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'square'; // Classic 8-bit square wave
        osc.frequency.value = noteData.note;

        // ADSR envelope for more musical feel
        gain.gain.setValueAtTime(0, currentTime);
        gain.gain.linearRampToValueAtTime(1, currentTime + 0.01); // Attack
        gain.gain.linearRampToValueAtTime(0.6, currentTime + noteData.duration * 0.3); // Decay
        gain.gain.setValueAtTime(0.6, currentTime + noteData.duration * 0.8); // Sustain
        gain.gain.linearRampToValueAtTime(0, currentTime + noteData.duration); // Release

        osc.connect(gain);
        gain.connect(this.bgMusicGain!);

        osc.start(currentTime);
        osc.stop(currentTime + noteData.duration);

        this.bgMusicNodes.push(osc);

        currentTime += noteData.duration;
      });

      // Schedule next loop
      const patternDuration = pattern.reduce((sum, note) => sum + note.duration, 0);
      setTimeout(() => loopMusic(), patternDuration * 1000);
    };

    loopMusic();
  }

  /**
   * Schedule bass loop
   */
  private scheduleBassLoop(pattern: Array<{ note: number, duration: number }>, startOffset: number) {
    const loopBass = () => {
      if (!this.bgMusicGain) return;

      const now = this.audioContext.currentTime;
      let currentTime = now;

      pattern.forEach((noteData) => {
        if (noteData.note === 0) {
          // Rest - just advance time
          currentTime += noteData.duration;
          return;
        }

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle'; // Triangle wave for bass
        osc.frequency.value = noteData.note;

        gain.gain.setValueAtTime(0.4, currentTime);
        gain.gain.linearRampToValueAtTime(0.1, currentTime + noteData.duration);

        osc.connect(gain);
        gain.connect(this.bgMusicGain!);

        osc.start(currentTime);
        osc.stop(currentTime + noteData.duration);

        this.bgMusicNodes.push(osc);

        currentTime += noteData.duration;
      });

      // Schedule next loop
      const patternDuration = pattern.reduce((sum, note) => sum + note.duration, 0);
      setTimeout(() => loopBass(), patternDuration * 1000);
    };

    loopBass();
  }

  /**
   * Stop background music
   */
  stopBackgroundMusic() {
    this.bgMusicNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    this.bgMusicNodes = [];

    if (this.bgMusicGain) {
      this.bgMusicGain.disconnect();
      this.bgMusicGain = null;
    }
  }

  /**
   * Clean up audio context
   */
  dispose() {
    this.stopBackgroundMusic();
    this.audioContext.close();
  }
}

// Singleton instance
let audioInstance: Audio8Bit | null = null;

export const getAudio8Bit = (): Audio8Bit => {
  if (!audioInstance) {
    audioInstance = new Audio8Bit();
  }
  return audioInstance;
};
