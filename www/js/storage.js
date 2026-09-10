const Storage = {
settingsKey: "gameblock_settings_v1",
bestKey: "gameblock_best_v1",
tutorialKey: "gameblock_tutorial_v1",
rateUsKey: "gameblock_rateus_v1",
visualThemeKey: "gameblock_visual_theme_v1",
legacyKeys: {
settings: "inkblast_settings_v2",
best: "inkblast_best_v2",
tutorial: "inkblast_tutorial_v1",
rateUs: "inkblast_rateus_v1",
visualTheme: "inkblast_visual_theme_v1"
},
getTutorialDone() {
try {
return (localStorage.getItem(this.tutorialKey) || localStorage.getItem(this.legacyKeys.tutorial)) === "1";
} catch (error) {
return true;
}
},
setTutorialDone() {
try {
localStorage.setItem(this.tutorialKey, "1");
} catch (error) {}
},
getRateUsShown() {
try {
return (localStorage.getItem(this.rateUsKey) || localStorage.getItem(this.legacyKeys.rateUs)) === "1";
} catch (error) {
return true;
}
},
setRateUsShown() {
try {
localStorage.setItem(this.rateUsKey, "1");
} catch (error) {}
},
getVisualTheme() {
try {
return localStorage.getItem(this.visualThemeKey) || localStorage.getItem(this.legacyKeys.visualTheme) || "default";
} catch (error) {
return "default";
}
},
setVisualTheme(id) {
try {
localStorage.setItem(this.visualThemeKey, id);
} catch (error) {}
},
getSettings() {
const defaults = {
sound: true,
music: true,
musicVolume: 100,
vibration: true,
adsBlocked: false
};
try {
const raw = localStorage.getItem(this.settingsKey) || localStorage.getItem(this.legacyKeys.settings);
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
return Number(localStorage.getItem(this.bestKey) || localStorage.getItem(this.legacyKeys.best) || 0);
},
saveBest(value) {
localStorage.setItem(this.bestKey, String(value));
}
};
