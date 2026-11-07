/**
 * Pure Web Audio API synthesized ambient Sitar & Tanpura harmonic loop + spark ignition chime.
 * Unlocks strictly on user pointerup / click gesture (satisfying iOS Safari & Android Chrome autoplay policies)
 * with zero external audio files required.
 */

class SitarAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private isMuted = false;
  private loopTimer: number | null = null;
  private masterGain: GainNode | null = null;

  // Yaman Raga / Kalyan scale frequencies (Hz) around Sa = D4 (293.66 Hz)
  private readonly ragaNotes = [293.66, 329.63, 369.99, 415.3, 440.0, 493.88, 554.37, 587.33];
  private noteIndex = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.32;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a warm brass temple bell + sitar sympathetic string shimmer when the diya is lit.
   */
  public playIgnitionChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isMuted) return;

    const now = ctx.currentTime;
    const chimeNotes = [293.66, 440.0, 587.33, 739.99, 880.0];

    chimeNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.18 / (idx + 1), now + idx * 0.09 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 2.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 2.5);
    });
  }

  /**
   * Plays a soft crackling firework burst shimmer.
   */
  public playFireworkBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isMuted) return;

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 1.1);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 1.15);
    });
  }

  /**
   * Starts the ambient sitar & tanpura harmonic loop after ignition.
   */
  public startAmbientLoop(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playIgnitionChime();

    const triggerPluck = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain || this.isMuted) return;
      const now = this.ctx.currentTime;

      // Tanpura Sa-Pa drone
      const droneOsc = this.ctx.createOscillator();
      const droneGain = this.ctx.createGain();
      droneOsc.type = 'sine';
      droneOsc.frequency.setValueAtTime(146.83, now); // D3
      droneGain.gain.setValueAtTime(0.001, now);
      droneGain.gain.linearRampToValueAtTime(0.06, now + 0.4);
      droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
      droneOsc.connect(droneGain);
      droneGain.connect(this.masterGain);
      droneOsc.start(now);
      droneOsc.stop(now + 2.7);

      // Sitar melody pluck with gentle jawari harmonic overtone
      const freq = this.ragaNotes[this.noteIndex % this.ragaNotes.length];
      this.noteIndex = (this.noteIndex + 2 + (this.noteIndex % 2)) % this.ragaNotes.length;

      const sitarOsc = this.ctx.createOscillator();
      const overtoneOsc = this.ctx.createOscillator();
      const pluckGain = this.ctx.createGain();

      sitarOsc.type = 'triangle';
      overtoneOsc.type = 'sawtooth';
      sitarOsc.frequency.setValueAtTime(freq, now + 0.15);
      // Subtle meend (pitch bend)
      sitarOsc.frequency.exponentialRampToValueAtTime(freq * 1.012, now + 0.5);
      sitarOsc.frequency.exponentialRampToValueAtTime(freq, now + 1.2);

      overtoneOsc.frequency.setValueAtTime(freq * 2, now + 0.15);

      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.value = 0.18;

      pluckGain.gain.setValueAtTime(0.001, now + 0.15);
      pluckGain.gain.exponentialRampToValueAtTime(0.14, now + 0.2);
      pluckGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);

      sitarOsc.connect(pluckGain);
      overtoneOsc.connect(overtoneGain);
      overtoneGain.connect(pluckGain);
      pluckGain.connect(this.masterGain);

      sitarOsc.start(now + 0.15);
      overtoneOsc.start(now + 0.15);
      sitarOsc.stop(now + 2.35);
      overtoneOsc.stop(now + 2.35);
    };

    triggerPluck();
    this.loopTimer = window.setInterval(triggerPluck, 2500);
  }

  public stopAmbientLoop(): void {
    this.isPlaying = false;
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.32, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const sitarAudio = new SitarAudioEngine();
