const App = {
splashHidden: false,
lastBackPress: 0,
init() {
Theme.init();
Settings.load();
Tutorial.init();
Game.init();
Menu.init();
this.bindUI();
this.bindBackButton();
this.bindButtonPop();
this.showMenu();
this.hideSplashLater();
document.addEventListener("pointerdown", () => { GameAudio.unlock(); }, { once: true });
},
bindBackButton() {
if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
Capacitor.Plugins.App.addListener("backButton", () => this.handleBack());
}
},
handleBack() {
const so = document.getElementById("settingsOverlay");
const go = document.getElementById("gameOverOverlay");
const gs = document.getElementById("gameScreen");
if (!so.classList.contains("hidden")) { GameAudio.playClick(); this.closeSettings(); return; }
if (!go.classList.contains("hidden")) { GameAudio.playClick(); Game.stopCountdown(); this.showMenu(); return; }
if (gs.classList.contains("active")) { GameAudio.playClick(); this.showMenu(); return; }
const now = Date.now();
if (this.lastBackPress && now - this.lastBackPress < 2000) {
if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp();
else window.history.back();
return;
}
this.lastBackPress = now;
Haptics.vibrate(10);
},
bindButtonPop() {
document.addEventListener("click", (e) => {
const b = e.target.closest ? e.target.closest("button") : null;
if (!b) return;
b.classList.remove("btn-pop"); void b.offsetWidth; b.classList.add("btn-pop");
setTimeout(() => b.classList.remove("btn-pop"), 320);
}, true);
},
hideSplashLater() {
setTimeout(() => {
const s = document.getElementById("splash");
if (s && !this.splashHidden) { s.classList.add("hidden"); this.splashHidden = true; }
}, 1600);
},
celebrateEl(el) { el.classList.remove("celebrate"); void el.offsetWidth; el.classList.add("celebrate"); setTimeout(() => el.classList.remove("celebrate"), 600); },
confetti(o) {
const r = o.getBoundingClientRect();
const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
const colors = Theme.bank.map(c => c.bg);
for (let i = 0; i < 26; i++) {
const p = document.createElement("div");
p.className = "confetti-piece";
const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140;
p.style.left = ox + "px"; p.style.top = oy + "px";
p.style.background = colors[Math.floor(Math.random() * colors.length)];
p.style.setProperty("--tx", Math.cos(a) * d + "px");
p.style.setProperty("--ty", Math.sin(a) * d * 0.6 + 160 + Math.random() * 120 + "px");
p.style.setProperty("--rot", Math.floor(Math.random() * 720) + "deg");
p.style.animationDuration = 800 + Math.random() * 500 + "ms";
document.body.appendChild(p);
setTimeout(() => p.remove(), 1600);
}
},
bindUI() {
const settingsBtn = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const settingsHomeBtn = document.getElementById("settingsHomeBtn");
const settingsRestartBtn = document.getElementById("settingsRestartBtn");
const bestScore = document.querySelector(".best-score");
const availablePill = document.getElementById("availablePill");
bestScore.addEventListener("click", () => { GameAudio.unlock(); GameAudio.playClick(); this.celebrateEl(bestScore); this.confetti(bestScore); });
availablePill.addEventListener("click", () => { GameAudio.unlock(); GameAudio.playClick(); this.celebrateEl(availablePill); });
settingsBtn.addEventListener("click", () => { GameAudio.unlock(); GameAudio.playClick(); setTimeout(() => this.openSettings(), 160); });
settingsCloseBtn.addEventListener("click", () => { GameAudio.playClick(); this.closeSettings(); });
settingsHomeBtn.addEventListener("click", () => { GameAudio.playClick(); setTimeout(() => { this.closeSettings(); this.showMenu(); }, 200); });
settingsRestartBtn.addEventListener("click", () => { GameAudio.playClick(); setTimeout(() => { this.closeSettings(); Game.reset(); }, 200); });
settingsOverlay.addEventListener("click", (e) => { if (e.target === settingsOverlay) this.closeSettings(); });
document.querySelectorAll("[data-setting]").forEach(b => {
b.addEventListener("click", () => {
GameAudio.unlock(); GameAudio.playClick();
const k = b.dataset.setting;
setTimeout(() => Settings.toggle(k), 120);
});
});
},
showMenu() {
document.getElementById("menuScreen").classList.add("active");
document.getElementById("gameScreen").classList.remove("active");
Game.stop();
},
showGame() {
if (!Game.runActive) Theme.useMenuColor();
Tutorial.startGame();
document.getElementById("menuScreen").classList.remove("active");
document.getElementById("gameScreen").classList.add("active");
Game.start();
},
openSettings() { document.getElementById("settingsOverlay").classList.remove("hidden"); },
closeSettings() { document.getElementById("settingsOverlay").classList.add("hidden"); }
};
document.addEventListener("DOMContentLoaded", () => { App.init(); });
