const GameAudio = {
  ctx: null,
  master: null,
  musicGain: null,

  musicBuffer: null,
  musicSource: null,
  musicLoading: false,
  musicNodes: [],

  soundEnabled: true,
  musicEnabled: false,

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !document.hidden) {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    this.musicGain.connect(this.master);
  },

  unlock() {
    this.ensure();

    if (this.musicEnabled && !document.hidden) {
      this.startMusic();
    }
  },

  handleVisibility() {
    if (!this.ctx) return;

    if (document.hidden) {
      if (this.ctx.state === "running") {
        this.ctx.suspend();
      }
    } else {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      if (this.musicEnabled) {
        this.startMusic();
      }
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

  loadMusic(callback) {
    if (this.musicBuffer) {
      if (callback) callback(true);
      return;
    }

    if (this.musicLoading) return;
    this.musicLoading = true;

    fetch("music.mp3")
      .then(response => {
        if (!response.ok) throw new Error("http");
        return response.arrayBuffer();
      })
      .then(data => this.ctx.decodeAudioData(data))
      .then(buffer => {
        this.musicBuffer = buffer;
        this.musicLoading = false;
        if (callback) callback(true);
      })
      .catch(() => {
        this.musicLoading = false;
        if (callback) callback(false);
      });
  },

  startMusic() {
    this.ensure();
    if (!this.ctx || !this.musicGain || !this.musicEnabled) return;
    if (document.hidden) return;
    if (this.musicSource || this.musicNodes.length > 0) return;

    if (!this.musicBuffer) {
      this.loadMusic((ok) => {
        if (!this.musicEnabled) return;
        if (ok && this.musicBuffer) {
          this.startMusic();
        } else {
          this.startSynthMusic();
        }
      });
      return;
    }

    const now = this.ctx.currentTime;

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.45, now + 1.2);

    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();

    this.musicSource = src;
  },

  startSynthMusic() {
    this.ensure();
    if (!this.ctx || !this.musicGain || !this.musicEnabled) return;
    if (document.hidden) return;
    if (this.musicNodes.length > 0) return;

    const now = this.ctx.currentTime;

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.35, now + 1.6);

    const freqs = [110, 164.81, 220];

    freqs.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      gain.gain.value = index === 0 ? 0.2 : 0.1;

      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = (index - 1) * 4;

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
    if (!this.ctx || !this.musicGain) return;

    const now = this.ctx.currentTime;
    const current = Math.max(this.musicGain.gain.value, 0.0001);

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(current, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    if (this.musicSource) {
      try {
        this.musicSource.stop(now + 0.3);
      } catch (error) {}
      this.musicSource = null;
    }

    this.stopSynthMusic();
  },

  stopSynthMusic() {
    if (!this.ctx || this.musicNodes.length === 0) return;

    const now = this.ctx.currentTime;

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
  },

  // Gamme pentatonique majeure : sert à composer des petites suites de notes
  // harmonieuses (playClear/playPraise/playColorShift) au lieu de sauts de
  // fréquence arbitraires.
  PENTATONIC: [1, 1.125, 1.25, 1.5, 1.6667],

  noteFreq(root, step) {
    const scale = this.PENTATONIC;
    const octave = Math.floor(step / scale.length);
    const degree = ((step % scale.length) + scale.length) % scale.length;

    return root * scale[degree] * Math.pow(2, octave);
  },

  playTone(freq, options = {}) {
    if (!this.soundEnabled) return;
    if (document.hidden) return;

    this.ensure();
    if (!this.ctx || !this.master) return;

    const {
      duration = 0.08,
      type = "sine",
      gain = 0.3,
      slideTo = null,
      delay = 0
    } = options;

    const now = this.ctx.currentTime + delay;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.max(freq * 4.5, 850), now);
    filter.Q.value = 0.5;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.011);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.connect(gainNode);
    gainNode.connect(this.master);

    // Deux voix très légèrement désaccordées (chorus doux) pour un timbre
    // plus rond et plus "pro" qu'un simple oscillateur nu.
    [-6, 6].forEach((cents) => {
      const oscillator = this.ctx.createOscillator();
      const voiceGain = this.ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now);
      oscillator.detune.value = cents;

      if (slideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      }

      voiceGain.gain.value = 0.55;

      oscillator.connect(voiceGain);
      voiceGain.connect(filter);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
    });
  },

  playClick() {
    this.playTone(540, { duration: 0.05, type: "triangle", gain: 0.36 });
    this.playTone(760, { duration: 0.04, type: "sine", gain: 0.22, delay: 0.02 });
  },

  playAdd(index) {
    const freq = 300 * Math.pow(1.05946, index);
    this.playTone(freq, { duration: 0.05, type: "triangle", gain: 0.3 });
  },

  playBack() {
    this.playTone(220, { duration: 0.04, type: "triangle", gain: 0.18, slideTo: 180 });
  },

  playPlace() {
    this.playTone(330, { duration: 0.08, type: "sine", gain: 0.34, slideTo: 430 });
    this.playTone(520, { duration: 0.05, type: "triangle", gain: 0.18, delay: 0.03 });
  },

  playCancel() {
    this.playTone(190, { duration: 0.1, type: "triangle", gain: 0.22, slideTo: 110 });
  },

  playClear(count) {
    const base = 392;
    const notes = Math.min(count + 2, 5);

    for (let i = 0; i < notes; i++) {
      this.playTone(this.noteFreq(base, i), {
        duration: 0.1,
        type: "triangle",
        gain: 0.34,
        delay: i * 0.034
      });
    }

    if (count > 1) {
      this.playTone(base * 2, { duration: 0.2, type: "sine", gain: 0.36, delay: 0.13 });
    }
  },

  playFreezeTick(index) {
    this.playTone(700 + index * 90, { duration: 0.05, type: "sine", gain: 0.14 });
  },

  playBlockDisappear(index) {
    this.playTone(620 - (index % 14) * 28, {
      duration: 0.05,
      type: "sine",
      gain: 0.1,
      slideTo: 300
    });
  },

  playBlockSpawn(index) {
    this.playTone(280 + (index % 8) * 34, {
      duration: 0.07,
      type: "triangle",
      gain: 0.22,
      slideTo: 520
    });
  },

  playPraise(level) {
    const base = 523;
    const notes = 3 + level;

    for (let i = 0; i < notes; i++) {
      this.playTone(this.noteFreq(base, i), {
        duration: 0.11,
        type: "triangle",
        gain: 0.32,
        delay: i * 0.052
      });
    }

    if (level >= 3) {
      this.playTone(base / 2, { duration: 0.3, type: "sine", gain: 0.28, delay: 0.1 });
    }

    if (level >= 5) {
      this.playTone(base * 2, { duration: 0.22, type: "sine", gain: 0.28, delay: 0.3 });
      this.playTone(base * 2.5, { duration: 0.22, type: "sine", gain: 0.22, delay: 0.38 });
    }
  },

  playColorShift() {
    const base = 523;

    for (let i = 0; i < 4; i++) {
      this.playTone(this.noteFreq(base, i), {
        duration: 0.11,
        type: "triangle",
        gain: 0.34,
        delay: i * 0.055
      });
    }
  },

  playError() {
    this.playTone(110, { duration: 0.1, type: "square", gain: 0.16, slideTo: 70 });
  },

  playCountdown() {
    this.playTone(660, { duration: 0.06, type: "triangle", gain: 0.3 });
  },

  playGameOver() {
    this.playTone(220, { duration: 0.22, type: "sawtooth", gain: 0.17, slideTo: 70 });
  },

  // Voix (moteur de synthèse vocale du système) pour les mots d'encouragement.
  // Utilise la voix installée sur l'appareil : la qualité dépend donc du
  // téléphone, ce n'est pas une voix professionnelle enregistrée.
  playVoice(level) {
    if (!this.soundEnabled) return;
    if (document.hidden) return;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== "function") return;

    const words = ["Nice!", "Great!", "Awesome!", "Amazing!", "Unreal!"];
    const text = words[Math.min(Math.max(level, 1), words.length) - 1];

    try {
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05 + level * 0.05;
      utter.pitch = 1.15 + level * 0.13;
      utter.volume = 1;

      const voices = window.speechSynthesis.getVoices();

      if (voices && voices.length) {
        const preferred = voices.find(v => /female|samantha|zira|victoria|karen|jenny/i.test(v.name))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en"))
          || voices[0];

        if (preferred) utter.voice = preferred;
      }

      window.speechSynthesis.speak(utter);
    } catch (error) {
      // Synthèse vocale indisponible sur cet appareil : on ignore simplement.
    }
  },

  playTutorialDone() {
    const base = 523;

    for (let i = 0; i < 4; i++) {
      this.playTone(this.noteFreq(base, i), {
        duration: 0.13,
        type: "triangle",
        gain: 0.34,
        delay: i * 0.075
      });
    }

    this.playTone(base * 2, { duration: 0.3, type: "sine", gain: 0.32, delay: 0.34 });
  },

  playDefeatLong(durationMs = 3200) {
    if (!this.soundEnabled) return;
    if (document.hidden) return;

    this.ensure();
    if (!this.ctx || !this.master) return;

    const duration = durationMs / 1000;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const filter1 = this.ctx.createBiquadFilter();

    filter1.type = "lowpass";
    filter1.frequency.setValueAtTime(900, now);
    filter1.frequency.exponentialRampToValueAtTime(260, now + duration);
    filter1.Q.value = 0.4;

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(55, now + duration);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.24, now + 0.08);
    gain1.gain.setValueAtTime(0.24, now + duration - 0.6);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.master);

    osc1.start(now);
    osc1.stop(now + duration + 0.05);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(140, now);
    osc2.frequency.exponentialRampToValueAtTime(40, now + duration);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.exponentialRampToValueAtTime(0.32, now + 0.1);
    gain2.gain.setValueAtTime(0.32, now + duration - 0.6);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc2.connect(gain2);
    gain2.connect(this.master);

    osc2.start(now);
    osc2.stop(now + duration + 0.05);
  }
};
