import type { MemoryPayload } from '../types/universe.types';

export type ChimeNote = MemoryPayload['chimeTone'];

const PENTATONIC_FREQUENCIES: Record<ChimeNote, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
};

const REVERB_DURATION_SEC = 3.2;
const AMBIENT_GAIN_LEVEL = 0.085;
const MASTER_GAIN_LEVEL = 0.72;
const LOCK_CHIME_COOLDOWN_MS = 400;

/**
 * Procedural Web Audio soundscape & pentatonic starlight chime engine (Report §8).
 * Synthesizes everything natively on-device (zero external audio downloads):
 * - Warm modulated low-frequency cosmic drone (A1 / A2 / E3)
 * - 3.2s stereo convolver reverb hall
 * - Pentatonic dual-harmonic chimes (C4–C5) on reticle lock & message reveal
 */
export class CelestialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private chimeBus: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private droneOscillators: OscillatorNode[] = [];

  private initialized = false;
  private muted = false;
  private pageHidden = false;
  private lastLockChimeTime = 0;

  /**
   * Must be invoked synchronously inside a user tap/click handler so iOS Safari
   * and Chrome Mobile autoplay policies allow AudioContext playback.
   */
  unlock(): void {
    if (typeof window === 'undefined') return;

    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      if (!this.initialized) {
        this.setupGraph();
        this.initialized = true;
      }

      this.syncMasterGain(1.8);
    } catch {
      // Ignore Web Audio failures on restricted environments
    }
  }

  private setupGraph(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master output gain (starts silent and swells in smoothly)
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.connect(ctx.destination);

    // Procedural stereo cosmic hall reverb
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.createReverbImpulse(ctx, REVERB_DURATION_SEC);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.45, now);
    this.convolver.connect(wetGain);
    wetGain.connect(this.masterGain);

    // Chime dry + wet bus
    this.chimeBus = ctx.createGain();
    this.chimeBus.gain.setValueAtTime(1.0, now);
    this.chimeBus.connect(this.masterGain);
    this.chimeBus.connect(this.convolver);

    // Ambient cosmic pad: lowpass filter + gentle LFO breathing
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(280, now);
    padFilter.Q.setValueAtTime(1.4, now);

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(AMBIENT_GAIN_LEVEL, now);

    padFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    this.ambientGain.connect(this.convolver);

    // LFO gently sweeps the lowpass cutoff for slow breathing texture
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.07, now);
    lfoGain.gain.setValueAtTime(75, now);
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start(now);
    this.droneOscillators.push(lfo);

    // Warm harmonic drone voices (55Hz A1, 110Hz A2, 164.81Hz E3)
    const droneVoices: { freq: number; type: OscillatorType; level: number; detune: number }[] = [
      { freq: 55.0, type: 'sine', level: 0.55, detune: 0 },
      { freq: 110.0, type: 'sine', level: 0.28, detune: 3 },
      { freq: 164.81, type: 'triangle', level: 0.08, detune: -4 },
    ];

    for (const v of droneVoices) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, now);
      osc.detune.setValueAtTime(v.detune, now);
      gain.gain.setValueAtTime(v.level, now);
      osc.connect(gain);
      gain.connect(padFilter);
      osc.start(now);
      this.droneOscillators.push(osc);
    }
  }

  private createReverbImpulse(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Soft inverse fade-in + exponential decay tail
        const fadeIn = Math.min(1, i / (sampleRate * 0.02));
        const envelope = fadeIn * Math.pow(1 - t, 2.8);
        const white = Math.random() * 2 - 1;
        // Simple one-pole lowpass to keep reverb warm & velvety
        lp = lp * 0.78 + white * 0.22;
        data[i] = lp * envelope * 0.45;
      }
    }

    return impulse;
  }

  /**
   * Plays each star's distinct signature chime when the reticle locks onto it.
   */
  playLockChime(note: ChimeNote = 'E4'): void {
    if (this.muted || this.pageHidden || !this.ctx || !this.chimeBus) return;
    const nowMs = performance.now();
    if (nowMs - this.lastLockChimeTime < LOCK_CHIME_COOLDOWN_MS) return;
    this.lastLockChimeTime = nowMs;

    if (this.ctx.state === 'suspended') return;

    const baseFreq = PENTATONIC_FREQUENCIES[note] ?? 329.63;
    // Fundamental tone + subtle soft overtone so all 10 stars sound distinct & warm
    this.triggerTone(baseFreq, 0.075, 1.6, 0.016, 0);
    this.triggerTone(baseFreq * 1.5, 0.018, 1.1, 0.025, 0.01);
  }

  /**
   * Plays a common, uplifting celestial success sound when clicking/opening a message.
   */
  playSuccessChime(): void {
    if (this.muted || this.pageHidden || !this.ctx || !this.chimeBus) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    // Gentle ascending celestial chime triad (C5 -> E5 -> G5 -> C6)
    this.triggerTone(523.25, 0.095, 1.8, 0.014, 0.0);
    this.triggerTone(659.25, 0.095, 1.9, 0.014, 0.065);
    this.triggerTone(783.99, 0.1, 2.2, 0.016, 0.13);
    this.triggerTone(1046.5, 0.055, 2.5, 0.02, 0.19);
  }

  private triggerTone(
    freq: number,
    peakGain: number,
    decaySec: number,
    attackSec: number,
    delaySec = 0,
  ): void {
    const ctx = this.ctx;
    const bus = this.chimeBus;
    if (!ctx || !bus) return;

    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peakGain, start + attackSec);
    env.gain.exponentialRampToValueAtTime(0.0001, start + attackSec + decaySec);

    osc.connect(env);
    env.connect(bus);

    osc.start(start);
    osc.stop(start + attackSec + decaySec + 0.05);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncMasterGain(0.18);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setPageHidden(hidden: boolean): void {
    this.pageHidden = hidden;
    if (!this.ctx) return;

    if (hidden) {
      if (this.ctx.state === 'running') {
        void this.ctx.suspend();
      }
    } else if (!this.muted && this.initialized && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private syncMasterGain(rampSec: number): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.muted || this.pageHidden ? 0.0001 : MASTER_GAIN_LEVEL;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
    this.masterGain.gain.exponentialRampToValueAtTime(target, now + rampSec);
  }

  dispose(): void {
    for (const osc of this.droneOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already-stopped oscillators
      }
    }
    this.droneOscillators = [];

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
