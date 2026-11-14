export type AudioWeather = 'clear' | 'rain' | 'snow';

export class PronteraAudio {
  private ctx: AudioContext | null = null;
  private muted = true;
  private chimeTimer = 0;
  private weather: AudioWeather = 'clear';
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(next: boolean): void {
    this.muted = next;
    if (!next) {
      this.ensureCtx();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.syncWeatherLoop();
    } else if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.15);
    }
  }

  setWeather(weather: AudioWeather): void {
    this.weather = weather;
    this.syncWeatherLoop();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    return this.ctx;
  }

  private syncWeatherLoop(): void {
    if (this.muted || !this.ctx) return;
    if (!this.noiseSource) {
      // Create 2-second seamless filtered pink-ish noise buffer
      const sr = this.ctx.sampleRate;
      const len = sr * 2;
      const buffer = this.ctx.createBuffer(1, len, sr);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.12) * 0.5;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.65;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();

      this.noiseSource = src;
      this.noiseFilter = filter;
      this.noiseGain = gain;
    }

    const now = this.ctx.currentTime;
    if (this.weather === 'rain') {
      this.noiseFilter!.frequency.setTargetAtTime(1450, now, 0.3);
      this.noiseGain!.gain.setTargetAtTime(0.055, now, 0.35);
    } else if (this.weather === 'snow') {
      this.noiseFilter!.frequency.setTargetAtTime(420, now, 0.3);
      this.noiseGain!.gain.setTargetAtTime(0.02, now, 0.35);
    } else {
      this.noiseGain!.gain.setTargetAtTime(0.0, now, 0.35);
    }
  }

  playThunder(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sub-bass thunder boom
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(88, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.4);
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.16, now + 0.06);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.85);

    // 2. Filtered noise crackle
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 1.9);
    const buf = ctx.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.55));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 1.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  playMoveClick(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playFootstep(onStone: boolean): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pitchJitter = 0.92 + Math.random() * 0.16;
    osc.type = onStone ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime((onStone ? 175 : 120) * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.055);
    gain.gain.setValueAtTime(onStone ? 0.035 : 0.024, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playSwordSlash(comboIndex: number): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.14);
    const buf = ctx.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.045));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 + comboIndex * 320, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.13);
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  playMobHit(killed: boolean): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = killed ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(killed ? 640 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(killed ? 980 : 110, now + (killed ? 0.18 : 0.09));
    gain.gain.setValueAtTime(killed ? 0.08 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (killed ? 0.2 : 0.11));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (killed ? 0.21 : 0.12));
  }

  updateAmbient(dt: number): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.chimeTimer -= dt;
    if (this.chimeTimer <= 0) {
      this.chimeTimer = 2.0 + Math.random() * 2.4;
      const notes = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.02, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.4);
    }
  }

  dispose(): void {
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch {
        // ignore if already stopped
      }
      this.noiseSource = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
