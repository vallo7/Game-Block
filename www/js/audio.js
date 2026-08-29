const GameAudio = {
ctx: null,
master: null,
musicGain: null,
musicNodes: [],
bgMusic: null, // Pour la musique d'ambiance (HTML Audio element)
soundEnabled: true,
musicEnabled: false,

ensure() {
if (this.ctx) {
if (this.ctx.state === "suspended") this.ctx.resume();
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
if (this.musicEnabled) this.startMusic();
},

setSoundEnabled(value) { this.soundEnabled = value; },
setMusicEnabled(value) {
this.musicEnabled = value;
if (value) this.startMusic();
else this.stopMusic();
},

// Gestion Musique d'Ambiance (Fichier externe)
loadBackgroundMusic(src) {
if (this.bgMusic) return;
this.bgMusic = new Audio(src);
this.bgMusic.loop = true;
this.bgMusic.preload = "auto";
// Volume confortable mais présent
this.bgMusic.volume = 0.6; 
},

startMusic() {
// 1. Musique générée (ancienne méthode)
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

// 2. Fichier Audio (si chargé)
if (this.bgMusic && this.musicEnabled) {
this.bgMusic.play().catch(e => console.log("Autoplay blocked", e));
}
},

stopMusic() {
// Arrêt synthé
if (!this.ctx || !this.musicGain || this.musicNodes.length === 0) return;
const now = this.ctx.currentTime;
const current = Math.max(this.musicGain.gain.value, 0.0001);
this.musicGain.gain.cancelScheduledValues(now);
this.musicGain.gain.setValueAtTime(current, now);
this.musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
this.musicNodes.forEach(node => {
try { if (node.stop) node.stop(now + 0.3); } catch (error) {}
try { node.disconnect(); } catch (error) {}
});
this.musicNodes = [];

// Arrêt fichier
if (this.bgMusic) {
this.bgMusic.pause();
this.bgMusic.currentTime = 0;
}
},

playTone(freq, options = {}) {
if (!this.soundEnabled) return;
this.ensure();
if (!this.ctx || !this.master) return;
const { duration = 0.08, type = "sine", gain = 0.3, slideTo = null, delay = 0 } = options;
const now = this.ctx.currentTime + delay;
const oscillator = this.ctx.createOscillator();
const gainNode = this.ctx.createGain();
oscillator.type = type;
oscillator.frequency.setValueAtTime(freq, now);
if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
gainNode.gain.setValueAtTime(0.0001, now);
gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.012);
gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
oscillator.connect(gainNode);
gainNode.connect(this.master);
oscillator.start(now);
oscillator.stop(now + duration + 0.03);
},

playClick() { this.playTone(540, { duration: 0.05, type: "triangle", gain: 0.36 }); this.playTone(760, { duration: 0.04, type: "sine", gain: 0.22, delay: 0.02 }); },
playAdd(index) { const freq = 300 * Math.pow(1.05946, index); this.playTone(freq, { duration: 0.05, type: "triangle", gain: 0.3 }); },
playBack() { this.playTone(220, { duration: 0.04, type: "triangle", gain: 0.18, slideTo: 180 }); },
playPlace() { this.playTone(330, { duration: 0.08, type: "sine", gain: 0.34, slideTo: 430 }); this.playTone(520, { duration: 0.05, type: "triangle", gain: 0.18, delay: 0.03 }); },
playCancel() { this.playTone(190, { duration: 0.1, type: "triangle", gain: 0.22, slideTo: 110 }); },
playClear(count) { const base = 392; const notes = Math.min(count + 2, 5); for (let i = 0; i < notes; i++) { this.playTone(base * Math.pow(1.19, i), { duration: 0.09, type: "triangle", gain: 0.36, delay: i * 0.032 }); } if (count > 1) { this.playTone(base * 2, { duration: 0.18, type: "sine", gain: 0.38, delay: 0.12 }); } },
playFreezeTick(index) { this.playTone(700 + index * 90, { duration: 0.05, type: "sine", gain: 0.14 }); },
playPraise(level) { const base = 523; const notes = 3 + level; for (let i = 0; i < notes; i++) { this.playTone(base * Math.pow(1.22, i), { duration: 0.1, type: "triangle", gain: 0.34, delay: i * 0.05 }); } if (level >= 3) { this.playTone(base / 2, { duration: 0.3, type: "sine", gain: 0.3, delay: 0.1 }); } if (level >= 5) { this.playTone(base * 3, { duration: 0.2, type: "sine", gain: 0.3, delay: 0.3 }); this.playTone(base * 4, { duration: 0.2, type: "sine", gain: 0.24, delay: 0.38 }); } },
playColorShift() { const base = 523; for (let i = 0; i < 4; i++) { this.playTone(base * Math.pow(1.26, i), { duration: 0.1, type: "triangle", gain: 0.36, delay: i * 0.05 }); } },
playError() { this.playTone(110, { duration: 0.1, type: "square", gain: 0.2, slideTo: 70 }); },
playCountdown() { this.playTone(660, { duration: 0.06, type: "triangle", gain: 0.3 }); },
playGameOver() { this.playTone(220, { duration: 0.22, type: "sawtooth", gain: 0.2, slideTo: 70 }); },
playDefeatLong(durationMs = 3200) { if (!this.soundEnabled) return; this.ensure(); if (!this.ctx || !this.master) return; const duration = durationMs / 1000; const now = this.ctx.currentTime; const osc1 = this.ctx.createOscillator(); const gain1 = this.ctx.createGain(); osc1.type = "sawtooth"; osc1.frequency.setValueAtTime(280, now); osc1.frequency.exponentialRampToValueAtTime(55, now + duration); gain1.gain.setValueAtTime(0.0001, now); gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.08); gain1.gain.setValueAtTime(0.28, now + duration - 0.6); gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration); osc1.connect(gain1); gain1.connect(this.master); osc1.start(now); osc1.stop(now + duration + 0.05); const osc2 = this.ctx.createOscillator(); const gain2 = this.ctx.createGain(); osc2.type = "sine"; osc2.frequency.setValueAtTime(140, now); osc2.frequency.exponentialRampToValueAtTime(40, now + duration); gain2.gain.setValueAtTime(0.0001, now); gain2.gain.exponentialRampToValueAtTime(0.32, now + 0.1); gain2.gain.setValueAtTime(0.32, now + duration - 0.6); gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration); osc2.connect(gain2); gain2.connect(this.master); osc2.start(now); osc2.stop(now + duration + 0.05); }
};
