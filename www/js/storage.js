const Storage = {
settingsKey: "inkblast_settings_v2",
bestKey: "inkblast_best_v2",
tutorialKey: "inkblast_tutorial_v1",
getTutorialDone() {
try {
return localStorage.getItem(this.tutorialKey) === "1";
} catch (error) {
return true;
}
},
setTutorialDone() {
try {
localStorage.setItem(this.tutorialKey, "1");
} catch (error) {}
},
getSettings() {
const defaults = {
sound: true,
music: true,
vibration: true,
adsBlocked: false
};
try {
const raw = localStorage.getItem(this.settingsKey);
if (!raw) return defaults;
const parsed = JSON.parse(raw);
return { ...defaults, ...parsed };
} catch (error) {
return defaults;
}
},
saveSettings(settings) {
localStorage.setItem(this.settingsKey, JSON.stringify(settings));
},
getBest() {
return Number(localStorage.getItem(this.bestKey) || 0);
},
saveBest(value) {
localStorage.setItem(this.bestKey, String(value));
}
};
