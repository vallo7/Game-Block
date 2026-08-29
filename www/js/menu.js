const Menu = {
init() {
this.buildWatermark();
const classicModeBtn = document.getElementById("classicModeBtn");
classicModeBtn.addEventListener("click", () => {
GameAudio.unlock();
GameAudio.playClick();
Haptics.vibrate(15);
setTimeout(() => {
App.showGame();
}, 220);
});
document.querySelectorAll(".mode-card.locked").forEach(button => {
button.addEventListener("click", () => {
GameAudio.playClick();
Haptics.vibrate(15);
});
});
},
buildWatermark() {
const host = document.getElementById("menuBgPattern");
if (!host) return;
host.innerHTML = "";
const count = 12;
for (let i = 0; i < count; i++) {
const block = document.createElement("span");
block.className = "bg-block";
const size = 16 + Math.random() * 44;
block.style.width = size + "px";
block.style.height = size + "px";
block.style.left = Math.random() * 96 + "%";
block.style.top = Math.random() * 96 + "%";
block.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
block.style.setProperty("--dy", (Math.random() * 160 - 80).toFixed(0) + "px");
block.style.setProperty("--rot", (Math.random() * 30 - 15).toFixed(0) + "deg");
const duration = 7 + Math.random() * 9;
block.style.animationDuration = duration.toFixed(1) + "s";
block.style.animationDelay = (-Math.random() * duration).toFixed(1) + "s";
host.appendChild(block);
}
}
};
