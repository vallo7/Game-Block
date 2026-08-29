const Settings = {
data: {
sound: true,
music: false,
vibration: true,
noAds: false // Ajout
},
load() {
this.data = Storage.getSettings();
this.apply();
this.updateUI();
},
save() {
Storage.saveSettings(this.data);
},
apply() {
GameAudio.setSoundEnabled(this.data.sound);
GameAudio.setMusicEnabled(this.data.music);
Haptics.setEnabled(this.data.vibration);
},
toggle(key) {
if (!(key in this.data)) return;
this.data[key] = !this.data[key];
this.save();
this.apply();
this.updateUI();
if (key === "vibration" && this.data.vibration) { Haptics.vibrate(300); }
if (key === "music" && this.data.music) { GameAudio.unlock(); }
},
updateUI() {
document.querySelectorAll("[data-setting]").forEach(button => {
const key = button.dataset.setting;
button.classList.toggle("on", Boolean(this.data[key]));
});
}
};
