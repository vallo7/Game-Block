const GameAudio = {
  ctx: null,
  unlocked: false,
  musicSource: null,
  musicPlaying: false,

  init() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.loadAmbientMusic();
  },

  unlock() {
    if (this.unlocked) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.unlocked = true;

    if (Settings.music && !this.musicPlaying) {
      this.startAmbientMusic();
    }
  },

  loadAmbientMusic() {
    // Charger votre fichier audio ici
    // Exemple: this.ambientBuffer = await this.loadAudioFile('assets/ambient.mp3');
  },

  startAmbientMusic() {
    if (!this.ambientBuffer || this.musicPlaying) return;

    this.musicSource = this.ctx.createBufferSource();
    this.musicSource.buffer = this.ambientBuffer;
    this.musicSource.loop = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0.4; // Volume agréable mais audible

    this.musicSource.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    this.musicSource.start();
    this.musicPlaying = true;
  },

  stopAmbientMusic() {
    if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource = null;
    }
    this.musicPlaying = false;
  },

  playTone(freq, type, duration, volume = 0.3) {
    if (!Settings.sound || !this.unlocked) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  playClick() {
    this.playTone(800, "sine", 0.08, 0.25);
  },

  playAdd(length) {
    const baseFreq = 440 + (length - 1) * 60;
    this.playTone(baseFreq, "sine", 0.12, 0.3);
  },

  playBack() {
    this.playTone(320, "sine", 0.1, 0.25);
  },

  playPlace() {
    this.playTone(520, "triangle", 0.15, 0.35);
  },

  playCancel() {
    this.playTone(280, "sawtooth", 0.12, 0.25);
  },

  playError() {
    this.playTone(180, "sawtooth", 0.15, 0.3);
  },

  playClear(count) {
    const baseFreq = 520 + count * 80;
    this.playTone(baseFreq, "sine", 0.2, 0.4);

    if (count >= 2) {
      setTimeout(() => this.playTone(baseFreq + 120, "sine", 0.15, 0.35), 80);
    }

    if (count >= 3) {
      setTimeout(() => this.playTone(baseFreq + 200, "sine", 0.15, 0.35), 160);
    }
  },

  playPraise(level) {
    const notes = [523, 659, 784, 988, 1175];
    const note = notes[level - 1] || 523;

    this.playTone(note, "sine", 0.25, 0.45);
    setTimeout(() => this.playTone(note * 1.25, "sine", 0.2, 0.4), 100);
  },

  playColorShift() {
    [440, 554, 659, 784].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "sine", 0.15, 0.35), i * 60);
    });
  },

  playDefeatLong(duration) {
    if (!Settings.sound || !this.unlocked) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + duration / 1000);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration / 1000);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration / 1000);
  },

  playFreezeTick(index) {
    const freq = 220 + index * 40;
    this.playTone(freq, "square", 0.08, 0.2);
  },

  playGameOver() {
    [262, 196, 165, 131].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "sawtooth", 0.25, 0.3), i * 150);
    });
  },

  playCountdown() {
    this.playTone(660, "sine", 0.12, 0.35);
  },

  playWaveTick() {
    this.playTone(880, "sine", 0.06, 0.25);
  },

  playBlockDisappear() {
    this.playTone(340, "sine", 0.1, 0.25);
  }
};

const Haptics = {
  vibrate(pattern) {
    if (!Settings.vibration || !navigator.vibrate) return;

    navigator.vibrate(pattern);
  }
};

const Settings = {
  sound: true,
  music: true,
  vibration: true,
  adsBlocked: false,

  load() {
    const saved = localStorage.getItem("inkBlastSettings");
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(this, parsed);
    }
  },

  save() {
    localStorage.setItem("inkBlastSettings", JSON.stringify({
      sound: this.sound,
      music: this.music,
      vibration: this.vibration,
      adsBlocked: this.adsBlocked
    }));
  }
};

const Storage = {
  getBest() {
    return parseInt(localStorage.getItem("inkBlastBest") || "0", 10);
  },

  saveBest(score) {
    localStorage.setItem("inkBlastBest", String(score));
  }
};

const Theme = {
  current: {
    light: "#ffb100",
    dark: "#ff6f00"
  },

  rgb(color) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `${r},${g},${b}`;
  },

  shift(duration) {
    const hues = [45, 90, 135, 180, 225, 270, 315, 360];
    let index = hues.indexOf(this.hue) + 1;
    if (index >= hues.length) index = 0;

    this.hue = hues[index];
    this.current.light = `hsl(${this.hue}, 90%, 60%)`;
    this.current.dark = `hsl(${this.hue}, 90%, 45%)`;
  },

  hue: 45
};

const App = {
  init() {
    Settings.load();
    GameAudio.init();
    Game.init();

    this.bindMenuEvents();
    this.updateSettingsUI();
  },

  bindMenuEvents() {
    document.getElementById("startBtn").addEventListener("click", () => {
      GameAudio.playClick();
      GameAudio.unlock();
      this.showGame();
    });

    document.getElementById("settingsBtn").addEventListener("click", () => {
      GameAudio.playClick();
      this.toggleSettings();
    });

    document.getElementById("settingsCloseBtn").addEventListener("click", () => {
      GameAudio.playClick();
      this.toggleSettings();
    });
  },

  showMenu() {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("menuScreen").classList.add("active");

    if (Settings.music && !GameAudio.musicPlaying) {
      GameAudio.startAmbientMusic();
    }
  },

  showGame() {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("gameScreen").classList.add("active");

    Game.start();
  },

  toggleSettings() {
    const panel = document.getElementById("settingsPanel");
    panel.classList.toggle("active");
  },

  updateSettingsUI() {
    document.getElementById("soundBtn").classList.toggle("on", Settings.sound);
    document.getElementById("musicBtn").classList.toggle("on", Settings.music);
    document.getElementById("vibrationBtn").classList.toggle("on", Settings.vibration);

    const adBlockerBtn = document.getElementById("adBlockerBtn");
    adBlockerBtn.classList.toggle("active", Settings.adsBlocked);

    const statusEl = document.getElementById("adBlockerStatus");
    if (statusEl) {
      statusEl.textContent = Settings.adsBlocked ? "Publicités bloquées" : "Publicités activées";
    }
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
