const App = {
splashHidden: false,
lastBackPress: 0,
init() {
Theme.init();
Settings.load();
Game.init();
Menu.init();
this.bindUI();
this.bindBackButton();
this.bindButtonPop();
this.showMenu();
this.hideSplashLater();

// Initialisation Musique Ambiance (Remplacez 'music.mp3' par votre fichier)
// Assurez-vous que le fichier est dans le dossier www ou accessible
GameAudio.loadBackgroundMusic('music.mp3'); 

document.addEventListener("pointerdown", () => {
GameAudio.unlock();
}, { once: true });
},

bindBackButton() {
if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
Capacitor.Plugins.App.addListener("backButton", () => { this.handleBack(); });
}
},

handleBack() {
const settingsOverlay = document.getElementById("settingsOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameScreen = document.getElementById("gameScreen");
if (!settingsOverlay.classList.contains("hidden")) { GameAudio.playClick(); this.closeSettings(); return; }
if (!gameOverOverlay.classList.contains("hidden")) { GameAudio.playClick(); Game.stopCountdown(); this.showMenu(); return; }
if (gameScreen.classList.contains("active")) { GameAudio.playClick(); this.showMenu(); return; }
const now = Date.now();
if (this.lastBackPress && now - this.lastBackPress < 2000) {
if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) { Capacitor.Plugins.App.exitApp(); } else { window.history.back(); }
return;
}
this.lastBackPress = now;
Haptics.vibrate(10);
},

bindButtonPop() {
document.addEventListener("click", (event) => {
const button = event.target.closest ? event.target.closest("button") : null;
if (!button) return;
button.classList.remove("btn-pop");
void button.offsetWidth;
button.classList.add("btn-pop");
setTimeout(() => { button.classList.remove("btn-pop"); }, 320);
}, true);
},

hideSplashLater() {
setTimeout(() => {
const splash = document.getElementById("splash");
if (splash && !this.splashHidden) { splash.classList.add("hidden"); this.splashHidden = true; }
}, 1600);
},

celebrateEl(el) {
el.classList.remove("celebrate");
void el.offsetWidth;
el.classList.add("celebrate");
setTimeout(() => { el.classList.remove("celebrate"); }, 600);
},

confetti(originEl) {
const rect = originEl.getBoundingClientRect();
const ox = rect.left + rect.width / 2;
const oy = rect.top + rect.height / 2;
const colors = Theme.bank.map(c => c.bg);
for (let i = 0; i < 26; i++) {
const piece = document.createElement("div");
piece.className = "confetti-piece";
const angle = Math.random() * Math.PI * 2;
const dist = 60 + Math.random() * 140;
piece.style.left = ox + "px";
piece.style.top = oy + "px";
piece.style.background = colors[Math.floor(Math.random() * colors.length)];
piece.style.setProperty("--tx", Math.cos(angle) * dist + "px");
piece.style.setProperty("--ty", Math.sin(angle) * dist * 0.6 + 160 + Math.random() * 120 + "px");
piece.style.setProperty("--rot", Math.floor(Math.random() * 720) + "deg");
piece.style.animationDuration = 800 + Math.random() * 500 + "ms";
document.body.appendChild(piece);
setTimeout(() => { piece.remove(); }, 1600);
}
},

bindUI() {
// Boutons Rapides Menu
['qsSound', 'qsMusic', 'qsVib'].forEach(id => {
const btn = document.getElementById(id);
if(btn) {
btn.addEventListener("click", () => {
GameAudio.unlock();
GameAudio.playClick();
const key = btn.dataset.setting;
Settings.toggle(key);
this.updateQuickSettingsUI();
});
}
});

// Bouton No Ads
const noAdsBtn = document.getElementById("noAdsBtn");
if(noAdsBtn) {
noAdsBtn.addEventListener("click", () => {
GameAudio.playClick();
Haptics.vibrate(50);
// Simulation achat ou toggle
const current = Storage.getSettings().noAds || false;
const newSettings = { ...Storage.getSettings(), noAds: !current };
localStorage.setItem(Storage.settingsKey, JSON.stringify(newSettings));
Settings.data = newSettings;
Settings.apply();
this.celebrateEl(noAdsBtn);
this.confetti(noAdsBtn);
});
}

const settingsBtn = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const settingsHomeBtn = document.getElementById("settingsHomeBtn");
const settingsRestartBtn = document.getElementById("settingsRestartBtn");
const bestScore = document.querySelector(".best-score");
const availablePill = document.getElementById("availablePill");

bestScore.addEventListener("click", () => {
GameAudio.unlock();
GameAudio.playClick();
this.celebrateEl(bestScore);
this.confetti(bestScore);
});

availablePill.addEventListener("click", () => {
GameAudio.unlock();
GameAudio.playClick();
this.celebrateEl(availablePill);
});

settingsBtn.addEventListener("click", () => {
GameAudio.unlock();
GameAudio.playClick();
setTimeout(() => { this.openSettings(); }, 160);
});

settingsCloseBtn.addEventListener("click", () => { GameAudio.playClick(); this.closeSettings(); });
settingsHomeBtn.addEventListener("click", () => {
GameAudio.playClick();
setTimeout(() => { this.closeSettings(); this.showMenu(); }, 200);
});
settingsRestartBtn.addEventListener("click", () => {
GameAudio.playClick();
setTimeout(() => { this.closeSettings(); Game.reset(); }, 200);
});

settingsOverlay.addEventListener("click", (event) => {
if (event.target === settingsOverlay) { this.closeSettings(); }
});

document.querySelectorAll("[data-setting]").forEach(button => {
button.addEventListener("click", () => {
GameAudio.unlock();
GameAudio.playClick();
const key = button.dataset.setting;
setTimeout(() => { Settings.toggle(key); }, 120);
});
});
},

updateQuickSettingsUI() {
['qsSound', 'qsMusic', 'qsVib'].forEach(id => {
const btn = document.getElementById(id);
const key = btn.dataset.setting;
if(Settings.data[key]) btn.classList.add("on");
else btn.classList.remove("on");
});
},

showMenu() {
document.getElementById("menuScreen").classList.add("active");
document.getElementById("gameScreen").classList.remove("active");
Game.stop();
this.updateQuickSettingsUI();
},

showGame() {
if (!Game.runActive) { Theme.useMenuColor(); }
document.getElementById("menuScreen").classList.remove("active");
document.getElementById("gameScreen").classList.add("active");
Game.start();
},

openSettings() {
document.getElementById("settingsOverlay").classList.remove("hidden");
},

closeSettings() {
document.getElementById("settingsOverlay").classList.add("hidden");
}
};

document.addEventListener("DOMContentLoaded", () => { App.init(); });
