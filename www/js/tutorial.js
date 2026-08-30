const Tutorial = {
active: false,
step: 0,
paths: {
1: [{x:0,y:5},{x:1,y:5},{x:2,y:5},{x:3,y:5}],
2: [{x:4,y:5},{x:5,y:5},{x:6,y:5},{x:7,y:5},{x:7,y:6},{x:7,y:7}],
3: [{x:7,y:5},{x:7,y:4},{x:7,y:3},{x:7,y:2},{x:7,y:1},{x:7,y:0}]
},
init() {
if (!Storage.isTutorialDone()) {
this.active = true;
this.step = 0;
document.body.classList.add("tutorial-menu");
}
},
startGame() {
if (!this.active) return;
if (this.step === 0) this.step = 1;
document.body.classList.remove("tutorial-menu");
document.body.classList.add("tutorial-game");
},
expectedPath() { return this.paths[this.step] || []; },
required() { return this.expectedPath().length; },
onValidated() {
if (this.step < 3) { this.step++; }
else { this.complete(); }
},
complete() {
Game.spawnRandomBlocks(5);
this.active = false;
this.step = 0;
Storage.setTutorialDone();
document.body.classList.remove("tutorial-game");
const g = document.getElementById("gameGlove");
if (g) g.style.opacity = 0;
},
tick(now) {
const g = document.getElementById("gameGlove");
if (!g) return;
if (!this.active || this.step === 0) { g.style.opacity = 0; return; }
const path = this.expectedPath();
const remaining = path.slice(Game.path.length);
if (remaining.length === 0) { g.style.opacity = 0; return; }
g.style.opacity = 1;
const period = 650;
const t = (now % (period * remaining.length)) / period;
const i = Math.floor(t);
const f = t - i;
const a = remaining[i];
const b = remaining[Math.min(i + 1, remaining.length - 1)];
const move = Math.min(1, f / 0.6);
const e = 1 - Math.pow(1 - move, 3);
const cx = a.x + (b.x - a.x) * e;
const cy = a.y + (b.y - a.y) * e;
const dip = f > 0.6 ? Math.sin(((f - 0.6) / 0.4) * Math.PI) * 5 : 0;
this.placeGlove(g, cx, cy, dip);
},
placeGlove(g, cx, cy, dip) {
const canvas = Game.canvas;
const pad = 6;
const cellPx = canvas.clientWidth / Game.SIZE;
const x = pad + (cx + 0.5) * cellPx;
const y = pad + (cy + 0.5) * cellPx;
g.style.left = (x - 32) + "px";
g.style.top = (y - 6 + dip) + "px";
},
drawHighlights(ctx, now) {
if (!this.active || this.step === 0) return;
const path = this.expectedPath();
const start = Game.path.length;
const cell = Game.getCellSize();
const pulse = 0.5 + 0.5 * Math.sin(now / 220);
for (let i = start; i < path.length; i++) {
const c = path[i];
const px = c.x * cell, py = c.y * cell;
const pad = cell * 0.035;
const box = cell - pad * 2;
const r = cell * 0.16;
ctx.save();
ctx.globalAlpha = 0.22 + 0.35 * pulse;
ctx.fillStyle = "#faf3e1";
this.rr(ctx, px + pad, py + pad, box, box, r);
ctx.fill();
ctx.restore();
}
},
rr(ctx, x, y, w, h, r) {
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.arcTo(x + w, y, x + w, y + h, r);
ctx.arcTo(x + w, y + h, x, y + h, r);
ctx.arcTo(x, y + h, x, y, r);
ctx.arcTo(x, y, x + w, y, r);
ctx.closePath();
}
};
