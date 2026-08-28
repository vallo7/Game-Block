const GameAudio = {
  ctx: null,
  master: null,
  musicGain: null,
  musicNodes: [],

  soundEnabled: true,
  musicEnabled: false,

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    this.musicGain.connect(this.master);
  },

  unlock() {
    this.ensure();

    if (this.musicEnabled) {
      this.startMusic();
    }
  },

  setSoundEnabled(value) {
    this.soundEnabled = value;
  },

  setMusicEnabled(value) {
    this.musicEnabled = value;

    if (value) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  },

  playTone(freq, options = {}) {
    if (!this.soundEnabled) return;

    this.ensure();

    if (!this.ctx || !this.master) return;

    const {
      duration = 0.08,
      type = "sine",
      gain = 0.16,
      slideTo = null,
      delay = 0
    } = options;

    const now = this.ctx.currentTime + delay;

    const oscillator = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);

    if (slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.master);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  },

  playAdd(index) {
    const freq = 300 * Math.pow(1.05946, index);
    this.playTone(freq, {
      duration: 0.05,
      type: "triangle",
      gain: 0.13
    });
  },

  playBack() {
    this.playTone(220, {
      duration: 0.04,
      type: "triangle",
      gain: 0.07,
      slideTo: 180
    });
  },

  playPlace() {
    this.playTone(330, {
      duration: 0.08,
      type: "sine",
      gain: 0.15,
      slideTo: 430
    });

    this.playTone(520, {
      duration: 0.05,
      type: "triangle",
      gain: 0.06,
      delay: 0.03
    });
  },

  playClear(count) {
    const base = 392;
    const notes = Math.min(count + 2, 5);

    for (let i = 0; i < notes; i++) {
      this.playTone(base * Math.pow(1.19, i), {
        duration: 0.09,
        type: "triangle",
        gain: 0.18,
        delay: i * 0.032
      });
    }

    if (count > 1) {
      this.playTone(base * 2, {
        duration: 0.18,
        type: "sine",
        gain: 0.20,
        delay: 0.12
      });
    }
  },

  playError() {
    this.playTone(110, {
      duration: 0.10,
      type: "square",
      gain: 0.06,
      slideTo: 70
    });
  },

  playGameOver() {
    this.playTone(220, {
      duration: 0.22,
      type: "sawtooth",
      gain: 0.06,
      slideTo: 70
    });
  },

  startMusic() {
    this.ensure();

    if (!this.ctx || !this.musicGain || !this.musicEnabled) return;
    if (this.musicNodes.length > 0) return;

    const now = this.ctx.currentTime;

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.042, now + 1.6);

    const freqs = [110, 164.81, 220];

    freqs.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      gain.gain.value = index === 0 ? 0.20 : 0.10;

      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = (index - 1) * 4;

      let endpoint = this.musicGain;

      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = (index - 1) * 0.25;
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicGain);
      } else {
        osc.connect(gain);
        gain.connect(this.musicGain);
      }

      osc.start();
      this.musicNodes.push(osc, gain);
    });

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.011;

    lfo.connect(lfoGain);
    lfoGain.connect(this.musicGain.gain);

    lfo.start();

    this.musicNodes.push(lfo, lfoGain);
  },

  stopMusic() {
    if (!this.ctx || !this.musicGain || this.musicNodes.length === 0) return;

    const now = this.ctx.currentTime;
    const current = Math.max(this.musicGain.gain.value, 0.0001);

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(current, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    this.musicNodes.forEach(node => {
      try {
        if (node.stop) {
          node.stop(now + 0.3);
        }
      } catch (error) {}

      try {
        node.disconnect();
      } catch (error) {}
    });

    this.musicNodes = [];
  }
};
