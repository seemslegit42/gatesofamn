class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd * jitter), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playSlash() {
    this.playTone(340, 110, 0.14, 'sawtooth', 0.07);
  }

  playBolt() {
    this.playTone(620, 260, 0.16, 'triangle', 0.065);
  }

  playNova() {
    this.playTone(220, 68, 0.34, 'sawtooth', 0.1);
    this.playTone(540, 280, 0.25, 'sine', 0.06);
  }

  playDash() {
    this.playTone(260, 480, 0.12, 'sine', 0.055);
  }

  playHit() {
    this.playTone(170, 58, 0.11, 'square', 0.06);
  }

  playLoot() {
    this.playTone(660, 880, 0.12, 'triangle', 0.06);
    setTimeout(() => this.playTone(880, 1180, 0.15, 'triangle', 0.05), 65);
  }

  playLevelUp() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.02, 0.22, 'triangle', 0.075), idx * 80);
    });
  }
}

export const gameAudio = new ProceduralAudioEngine();
