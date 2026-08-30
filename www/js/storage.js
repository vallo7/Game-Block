const Storage = {
  settingsKey: "inkblast_settings_v2",
  bestKey: "inkblast_best_v2",
  tutorialKey: "inkblast_tutorial_v1",
  getSettings() {
    const defaults = { sound: true, music: true, vibration: true, adsBlocked: false };
    try {
      const raw = localStorage.getItem(this.settingsKey);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch (e) { return defaults; }
  },
  saveSettings(s) { localStorage.setItem(this.settingsKey, JSON.stringify(s)); },
  getBest() { return Number(localStorage.getItem(this.bestKey) || 0); },
  saveBest(v) { localStorage.setItem(this.bestKey, String(v)); },
  isTutorialDone() { return localStorage.getItem(this.tutorialKey) === "1"; },
  setTutorialDone() { localStorage.setItem(this.tutorialKey, "1"); }
};
