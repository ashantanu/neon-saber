/**
 * 8-bit Audio Generator
 * Generates retro-style game sounds using Web Audio API
 */

export class Audio8Bit {
  private audioContext: AudioContext;
  private bgMusicGain: GainNode | null = null;
  private bgMusicNodes: OscillatorNode[] = [];

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
   * Start looping 8-bit background music
   */
  startBackgroundMusic() {
    if (this.bgMusicNodes.length > 0) {
      this.stopBackgroundMusic();
    }

    // Create master gain for background music
    this.bgMusicGain = this.audioContext.createGain();
    this.bgMusicGain.gain.value = 0.15; // Keep it subtle
    this.bgMusicGain.connect(this.audioContext.destination);

    // Simple chiptune melody pattern
    // Using pentatonic scale for a catchy 8-bit feel
    const melodyPattern = [
      { note: 523.25, duration: 0.2 },  // C5
      { note: 587.33, duration: 0.2 },  // D5
      { note: 659.25, duration: 0.2 },  // E5
      { note: 783.99, duration: 0.4 },  // G5
      { note: 659.25, duration: 0.2 },  // E5
      { note: 587.33, duration: 0.2 },  // D5
      { note: 523.25, duration: 0.4 },  // C5
      { note: 392.00, duration: 0.4 },  // G4
    ];

    // Bass line pattern (plays simultaneously)
    const bassPattern = [
      { note: 130.81, duration: 0.8 },  // C3
      { note: 196.00, duration: 0.8 },  // G3
      { note: 146.83, duration: 0.8 },  // D3
      { note: 130.81, duration: 0.8 },  // C3
    ];

    const patternDuration = melodyPattern.reduce((sum, note) => sum + note.duration, 0);

    this.scheduleMelodyLoop(melodyPattern, 0);
    this.scheduleBassLoop(bassPattern, 0);
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
