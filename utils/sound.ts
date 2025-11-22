
// Web Audio API Sound Engine
// Generates sounds programmatically to avoid external asset dependencies.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API not supported");
      this.enabled = false;
    }
  }

  // Resume context on user interaction (browser policy)
  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1, decay: boolean = true) {
    if (!this.enabled || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    } else {
      gain.gain.setValueAtTime(0, this.ctx.currentTime + duration);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Simulates a wood "thock" sound
  public playMove() {
    if (!this.enabled || !this.ctx) return;
    
    // Low triangle wave for body
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Sharper, louder sound for capturing
  public playCapture() {
    if (!this.enabled || !this.ctx) return;

    // Punchy sine/square mix
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square'; // More harmonic content
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // High pitched blip
  public playSelect() {
    this.playTone(600, 'sine', 0.05, 0.05);
  }

  // Warning double beep
  public playCheck() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    const beep = (offset: number) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now + offset);
      gain.gain.setValueAtTime(0.1, now + offset);
      gain.gain.linearRampToValueAtTime(0, now + offset + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    };

    beep(0);
    beep(0.15);
  }

  // Ascending arpeggio
  public playWin() {
    if (!this.enabled || !this.ctx) return;
    [440, 554, 659, 880].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.1), i * 150);
    });
  }

  // Descending tones
  public playLoss() {
    if (!this.enabled || !this.ctx) return;
    [440, 415, 392, 370].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.4, 0.1), i * 200);
    });
  }
}

export const soundManager = new SoundEngine();
