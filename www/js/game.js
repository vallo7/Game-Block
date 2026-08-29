const Game = {
SIZE: 8,
canvas: null,
ctx: null,
active: false,
runActive: false,
gameOver: false,
drawing: false,
strokeStarted: false,
cells: [],
path: [],
score: 0,
displayedScore: 0,
best: 0,
displayedBest: 0,
turn: 1,
totalCleared: 0,
requiredBlocks: 3,
queue: [],
turnsSinceObstacle: 0,
combo: 0,
comboUntil: 0,
praiseUntil: 0,
timeScale: 1,
lastFrame: null,
gameNow: 0,
pointer: { x: 0, y: 0, active: false },
countdown: 0,
countdownTimer: null,
freezeTimeout: null,
popupTimeout: null,
colorFx: null,
freezeFx: null,
freezeDelays: {},
lightWave: null,
blockShake: null,
afterGlow: null,
lineBeams: [],
cellAnims: {},
cancelAnims: [],
cellFlashes: [],
floatingTexts: [],
particles: [],
debris: [],
shockwaves: [],
lineFlashes: [],
frameGradients: {},
glowCache: {},
lastInvalidKey: null,
lastInvalidTime: 0,
// Nouveaux états pour l'animation de fin/restart
isClearingGrid: false,
clearGridStartTime: 0,

init() {
this.canvas = document.getElementById("gameCanvas");
this.ctx = this.canvas.getContext("2d");
this.best = Storage.getBest();
this.displayedBest = this.best;
const bestEl = document.getElementById("bestScoreValue");
bestEl.textContent = this.best;

// Création dynamique des badges si absents (sécurité)
if (!document.getElementById("praiseBadge")) {
const el = document.createElement("div");
el.id = "praiseBadge";
el.className = "praise-badge hidden";
document.querySelector(".score-wrap").appendChild(el);
}

this.bindEvents();
this.resize();

const tick = (now) => {
const realDelta = Math.min(50, now - (this.lastFrame ?? now));
this.lastFrame = now;
this.timeScale += (1 - this.timeScale) * Math.min(1, realDelta / 260);
this.gameNow += realDelta * this.timeScale;

if (this.active) {
try {
this.update(realDelta);
this.draw();
} catch (error) { console.error(error); }
}
requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
},

start() {
this.active = true;
this.lastFrame = null;
if (!this.runActive) {
this.reset();
}
},

stop() {
this.active = false;
this.stopCountdown();
this.clearDefeatTimeouts();
this.unlockUI();
this.cancelPath(false);
},

clearDefeatTimeouts() {
if (this.freezeTimeout) { clearTimeout(this.freezeTimeout); this.freezeTimeout = null; }
if (this.popupTimeout) { clearTimeout(this.popupTimeout); this.popupTimeout = null; }
},

lockUI() { document.body.classList.add("locked"); },
unlockUI() { document.body.classList.remove("locked"); },

reset() {
this.cells = Array.from({ length: this.SIZE }, () => Array(this.SIZE).fill(0));
this.path = [];
this.score = 0;
this.displayedScore = 0;
this.turn = 1;
this.totalCleared = 0;
this.turnsSinceObstacle = 0;
this.combo = 0;
this.comboUntil = 0;
this.praiseUntil = 0;
this.timeScale = 1;
this.gameOver = false;
this.drawing = false;
this.strokeStarted = false;
this.runActive = true;
this.isClearingGrid = false;
this.stopCountdown();
this.clearDefeatTimeouts();
this.unlockUI();
this.colorFx = null;
this.freezeFx = null;
this.freezeDelays = {};
this.lightWave = null;
this.blockShake = null;
this.afterGlow = null;
this.lineBeams = [];
this.cellAnims = {};
this.cancelAnims = [];
this.cellFlashes = [];
this.floatingTexts = [];
this.particles = [];
this.debris = [];
this.shockwaves = [];
this.lineFlashes = [];
this.queue = [];
for (let i = 0; i < 3; i++) { this.queue.push(this.generateRequiredBlocks()); }
this.setupNextBlock();

document.getElementById("gameOverOverlay").classList.add("hidden");
document.getElementById("comboBadge").classList.add("hidden");
document.getElementById("praiseBadge").classList.add("hidden");
document.getElementById("gameScreen").classList.remove("quake");
document.getElementById("currentScore").textContent = "0";
this.updateHUD();
},

bindEvents() {
// ... (Events existants inchangés pour le dessin) ...
this.canvas.addEventListener("pointerdown", (event) => {
if (!this.active || this.gameOver || this.isClearingGrid) return;
event.preventDefault();
GameAudio.unlock();
this.canvas.setPointerCapture(event.pointerId);
this.sanitizeStroke();
const cell = this.getCellFromEvent(event);
this.updatePointer(event, true);
if (!cell) return;
this.drawing = true;
this.strokeStarted = this.tryStart(cell);
});
// ... pointermove, pointerup, pointercancel similaires ...
this.canvas.addEventListener("pointermove", (event) => {
if (!this.active || this.isClearingGrid) return;
this.updatePointer(event, this.drawing);
if (!this.drawing || !this.strokeStarted || this.gameOver) return;
event.preventDefault();
const cell = this.getCellFromEvent(event);
if (!cell) return;
this.tryContinue(cell);
});
this.canvas.addEventListener("pointerup", (event) => {
if (!this.active || !this.drawing) return;
event.preventDefault();
this.drawing = false;
this.strokeStarted = false;
this.pointer.active = false;
if (this.gameOver || this.isClearingGrid) return;
if (this.path.length === this.requiredBlocks) { this.validate(); } else { this.cancelIncomplete(); }
});
this.canvas.addEventListener("pointercancel", () => { if (!this.active) return; this.pointer.active = false; this.cancelPath(false); });

// Boutons Overlay
document.getElementById("gameoverHomeBtn").addEventListener("click", () => {
GameAudio.playClick();
setTimeout(() => { this.stopCountdown(); App.showMenu(); }, 200);
});
document.getElementById("gameoverRestartBtn").addEventListener("click", () => {
GameAudio.playClick();
this.startRestartSequence();
});
document.getElementById("adsBtn").addEventListener("click", () => {
GameAudio.playClick();
setTimeout(() => { this.stopCountdown(); this.revive(); }, 250);
});

window.addEventListener("resize", () => this.resize());
window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 120));
},

updatePointer(event, active) {
const rect = this.canvas.getBoundingClientRect();
this.pointer.x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
this.pointer.y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
this.pointer.active = active;
},

sanitizeStroke() {
for (let y = 0; y < this.SIZE; y++) { for (let x = 0; x < this.SIZE; x++) { if (this.cells[y][x] === 1) this.cells[y][x] = 0; } }
this.path = [];
},

getDpr() { return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2); },
resize() {
if (!this.canvas) return;
const dpr = this.getDpr();
const rect = this.canvas.getBoundingClientRect();
const size = Math.floor(rect.width * dpr);
if (size > 0) { this.canvas.width = size; this.canvas.height = size; }
},

ensureCanvasSize() {
const dpr = this.getDpr();
const target = Math.floor(this.canvas.clientWidth * dpr);
if (target > 0 && this.canvas.width !== target) { this.canvas.width = target; this.canvas.height = target; }
},

buildFrameGradients() {
// ... (Inchangé) ...
const cellSize = this.getCellSize();
const ctx = this.ctx;
let g = ctx.createLinearGradient(0, 0, 0, cellSize);
g.addColorStop(0, "#faf3e1"); g.addColorStop(1, "#e3d5b8"); this.frameGradients[1] = g;
g = ctx.createLinearGradient(0, 0, 0, cellSize);
g.addColorStop(0, "#faf3e1"); g.addColorStop(1, "#e0d2b4"); this.frameGradients[2] = g;
g = ctx.createLinearGradient(0, 0, 0, cellSize);
g.addColorStop(0, Theme.current.light); g.addColorStop(1, Theme.current.dark); this.frameGradients[3] = g;
g = ctx.createLinearGradient(0, 0, 0, cellSize);
g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#9fd8ff"); this.frameGradients.ice = g;
},

getGlowSprite(rgb) {
if (this.glowCache[rgb]) return this.glowCache[rgb];
const c = document.createElement("canvas"); c.width = 128; c.height = 128;
const g = c.getContext("2d");
const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, `rgba(${rgb},1)`); grad.addColorStop(1, `rgba(${rgb},0)`);
g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
this.glowCache[rgb] = c; return c;
},

update(realDelta) {
this.ensureCanvasSize();
const scoreEl = document.getElementById("currentScore");
if (!this.isClearingGrid) {
if (this.displayedScore !== this.score) {
const diff = this.score - this.displayedScore;
const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.16));
this.displayedScore += diff > 0 ? step : -step;
scoreEl.textContent = this.displayedScore;
}
const bestEl = document.getElementById("bestScoreValue");
if (this.displayedBest !== this.best) {
const diff = this.best - this.displayedBest;
const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.16));
this.displayedBest += diff > 0 ? step : -step;
bestEl.textContent = this.displayedBest;
}
} else {
// Animation de décompte du score vers 0 pendant le clear
if (this.displayedScore > 0) {
this.displayedScore -= Math.ceil(this.displayedScore * 0.1);
if (this.displayedScore < 0) this.displayedScore = 0;
scoreEl.textContent = this.displayedScore;
scoreEl.classList.add("score-bump");
setTimeout(() => scoreEl.classList.remove("score-bump"), 300);
}
}

const badge = document.getElementById("comboBadge");
if (!badge.classList.contains("hidden") && this.gameNow > this.comboUntil) { badge.classList.add("hidden"); }
const praise = document.getElementById("praiseBadge");
if (!praise.classList.contains("hidden") && this.gameNow > this.praiseUntil) { praise.classList.add("hidden"); }
},

// ... (Fonctions getDifficulty, getFillRatio, etc. inchangées) ...
getDifficulty() { const turnCurve = 1 - Math.exp(-this.turn / 60); const scoreCurve = 1 - Math.exp(-this.score / 15000); const fill = this.getFillRatio(); const fillCurve = Math.min(1, Math.max(0, (fill - 0.3) / 0.5)); return Math.min(1, turnCurve * 0.6 + scoreCurve * 0.25 + fillCurve * 0.15); },
getFillRatio() { let filled = 0; for (let y = 0; y < this.SIZE; y++) { for (let x = 0; x < this.SIZE; x++) { if (this.cells[y][x] !== 0) filled++; } } return filled / (this.SIZE * this.SIZE); },
isGridEmpty() { return this.cells.every(row => row.every(value => value === 0)); },
isGridFull() { return this.cells.every(row => row.every(value => value !== 0)); },
hasPossibleMove() { /* ... code existant ... */ 
const target = this.requiredBlocks; if (target <= 0) return true; let emptyCount = 0; for (let y = 0; y < this.SIZE; y++) { for (let x = 0; x < this.SIZE; x++) { if (this.cells[y][x] === 0) emptyCount++; } } if (emptyCount < target) return false; const dirs = [[1,0],[-1,0],[0,1],[0,-1]]; const findPath = (x, y, depth, visited) => { if (depth === target) return true; const key = y * this.SIZE + x; visited.add(key); for (const [dx, dy] of dirs) { const nx = x + dx; const ny = y + dy; if (nx >= 0 && nx < this.SIZE && ny >= 0 && ny < this.SIZE && this.cells[ny][nx] === 0 && !visited.has(ny * this.SIZE + nx)) { if (findPath(nx, ny, depth + 1, visited)) { visited.delete(key); return true; } } } visited.delete(key); return false; }; for (let y = 0; y < this.SIZE; y++) { for (let x = 0; x < this.SIZE; x++) { if (this.cells[y][x] !== 0) continue; if (findPath(x, y, 1, new Set())) { return true; } } } return false; 
},
largestPathLength() { /* ... code existant ... */ 
let bestLen = 0; const dirs = [[1,0],[-1,0],[0,1],[0,-1]]; const dfs = (x, y, depth, visited) => { if (depth > bestLen) bestLen = depth; if (depth === 6) return; const key = y * this.SIZE + x; visited.add(key); for (const [dx, dy] of dirs) { const nx = x + dx; const ny = y + dy; if (nx >= 0 && nx < this.SIZE && ny >= 0 && ny < this.SIZE && this.cells[ny][nx] === 0 && !visited.has(ny * this.SIZE + nx)) { dfs(nx, ny, depth + 1, visited); } } visited.delete(key); }; for (let y = 0; y < this.SIZE; y++) { for (let x = 0; x < this.SIZE; x++) { if (this.cells[y][x] !== 0) continue; dfs(x, y, 1, new Set()); if (bestLen === 6) return 6; } } return bestLen; 
},
generateRequiredBlocks() { /* ... code existant ... */ 
const diff = this.getDifficulty(); const fill = this.getFillRatio(); const low = [6, 14, 22, 26, 20, 12]; const high = [4, 8, 12, 20, 26, 30]; const weights = low.map((value, index) => value + (high[index] - value) * diff); if (fill > 0.72) { weights[4] *= 0.64; weights[5] *= 0.42; weights[0] *= 1.08; weights[1] *= 1.14; } if (fill < 0.24) { weights[3] *= 1.08; weights[4] *= 1.12; weights[5] *= 1.08; } const total = weights.reduce((sum, value) => sum + value, 0); let random = Math.random() * total; for (let i = 0; i < weights.length; i++) { if (random < weights[i]) return i + 1; random -= weights[i]; } return 3; 
},
setupNextBlock() { if (this.queue.length < 3) { this.queue.push(this.generateRequiredBlocks()); } this.requiredBlocks = this.queue.shift(); this.queue.push(this.generateRequiredBlocks()); this.updateHUD(); },
wouldCompleteLine(x, y) { /* ... code existant ... */ 
let rowFilled = 0; for (let x2 = 0; x2 < this.SIZE; x2++) { if (x2 !== x && this.cells[y][x2] !== 0) rowFilled++; } if (rowFilled === this.SIZE - 1) return true; let colFilled = 0; for (let y2 = 0; y2 < this.SIZE; y2++) { if (y2 !== y && this.cells[y2][x] !== 0) colFilled++; } if (colFilled === this.SIZE - 1) return true; return false; 
},
maybeSpawnObstacles() { /* ... code existant ... */ 
const diff = this.getDifficulty(); const interval = Math.max(2, 5 - Math.round(diff * 3)); if (this.turnsSinceObstacle < interval) return; this.turnsSinceObstacle = 0; const fill = this.getFillRatio(); let count = 1 + Math.round(diff * 3); if (fill > 0.78) count = Math.max(1, count - 1); if (fill < 0.22) count = Math.min(4, count + 1); const cells = this.chooseObstacleCells(count); cells.forEach(cell => { this.cells[cell.y][cell.x] = 3; this.cellAnims[`${cell.x},${cell.y}`] = { start: this.gameNow, type: "spawn" }; this.spawnParticles(cell.x, cell.y, 4, Theme.current.dark); }); 
},
chooseObstacleCells(count) { /* ... code existant ... */ 
const chosen = []; const keys = new Set(); const add = (cell) => { if (!cell) return; const key = `${cell.x},${cell.y}`; if (this.cells[cell.y][cell.x] === 0 && !keys.has(key) && !this.wouldCompleteLine(cell.x, cell.y)) { keys.add(key); chosen.push(cell); } }; if (count >= 3 && Math.random() < 0.45) { this.tryPatternL().forEach(add); } if (chosen.length === 0 && count >= 2) { this.tryPatternPair().forEach(add); } while (chosen.length < count) { const cell = this.getRandomEmptyCell(); if (!cell) break; add(cell); } return chosen.slice(0, count); 
},
getRandomEmptyCell() { const emptyCells = []; for (let y = 0; y < this.SIZE; y++) { for (let x = 0; x < this.SIZE; x++) { if (this.cells[y][x] === 0) emptyCells.push({ x, y }); } } if (emptyCells.length === 0) return null; return emptyCells[Math.floor(Math.random() * emptyCells.length)]; },
shuffleArray(array) { const copy = [...array]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; },
tryPatternPair() { /* ... code existant ... */ 
const anchor = this.getRandomEmptyCell(); if (!anchor) return []; const directions = this.shuffleArray([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]); for (const dir of directions) { const neighbor = { x: anchor.x + dir.x, y: anchor.y + dir.y }; if (neighbor.x >= 0 && neighbor.x < this.SIZE && neighbor.y >= 0 && neighbor.y < this.SIZE && this.cells[neighbor.y][neighbor.x] === 0) { return [anchor, neighbor]; } } return []; 
},
tryPatternL() { /* ... code existant ... */ 
const anchor = this.getRandomEmptyCell(); if (!anchor) return []; const patterns = this.shuffleArray([[{ x: 1, y: 0 }, { x: 0, y: 1 }], [{ x: -1, y: 0 }, { x: 0, y: 1 }], [{ x: 1, y: 0 }, { x: 0, y: -1 }], [{ x: -1, y: 0 }, { x: 0, y: -1 }]]); for (const pattern of patterns) { const a = { x: anchor.x + pattern[0].x, y: anchor.y + pattern[0].y }; const b = { x: anchor.x + pattern[1].x, y: anchor.y + pattern[1].y }; const valid = [a, b].every(cell => cell.x >= 0 && cell.x < this.SIZE && cell.y >= 0 && cell.y < this.SIZE && this.cells[cell.y][cell.x] === 0); if (valid) return [anchor, a, b]; } return []; 
},
getCellFromEvent(event) { const rect = this.canvas.getBoundingClientRect(); const x = Math.floor(((event.clientX - rect.left) / rect.width) * this.SIZE); const y = Math.floor(((event.clientY - rect.top) / rect.height) * this.SIZE); if (x < 0 || x >= this.SIZE || y < 0 || y >= this.SIZE) return null; return { x, y }; },
canAddCell(x, y) { if (this.gameOver || this.isClearingGrid) return false; if (x < 0 || x >= this.SIZE || y < 0 || y >= this.SIZE) return false; if (this.cells[y][x] !== 0) return false; if (this.path.length >= this.requiredBlocks) return false; if (this.path.length === 0) return true; const last = this.path[this.path.length - 1]; return Math.abs(last.x - x) + Math.abs(last.y - y) === 1; },
tryStart(cell) { if (!this.canAddCell(cell.x, cell.y)) { this.invalidFeedback(cell.x, cell.y); return false; } this.addCell(cell.x, cell.y); return true; },
tryContinue(cell) { const index = this.path.findIndex(p => p.x === cell.x && p.y === cell.y); if (index >= 0) { this.backtrackTo(index); return; } if (this.canAddCell(cell.x, cell.y)) { this.addCell(cell.x, cell.y); } else if (this.cells[cell.y][cell.x] === 0) { this.invalidFeedback(cell.x, cell.y); } },
addCell(x, y) { this.cells[y][x] = 1; this.path.push({ x, y }); this.cellAnims[`${x},${y}`] = { start: this.gameNow, type: "place" }; GameAudio.playAdd(this.path.length); Haptics.vibrate(12); this.updateHUD(); },
backtrackTo(index) { const removed = this.path.splice(index + 1); if (removed.length === 0) return; removed.forEach(cell => { this.cells[cell.y][cell.x] = 0; }); GameAudio.playBack(); this.updateHUD(); },
cancelPath(animated) { this.drawing = false; this.strokeStarted = false; if (this.path.length === 0) return; this.path.forEach(cell => { this.cells[cell.y][cell.x] = 0; }); this.path = []; if (animated) { GameAudio.playCancel(); Haptics.vibrate([20, 30, 20]); } this.updateHUD(); },
cancelIncomplete() { if (this.path.length === 0) return; const cancelledCells = [...this.path]; cancelledCells.forEach(cell => { this.cancelAnims.push({ x: cell.x, y: cell.y, start: this.gameNow }); this.spawnDebris(cell.x, cell.y, "#ef4444", 2); }); this.cancelPath(true); },

validate() {
if (this.path.length !== this.requiredBlocks) return;
const placed = [...this.path];
this.path = [];
placed.forEach(cell => {
this.cells[cell.y][cell.x] = 2;
this.cellAnims[`${cell.x},${cell.y}`] = { start: this.gameNow, type: "validate" };
});
GameAudio.playPlace();
const result = this.processClears();
const count = result.count;
const emptied = this.isGridEmpty();

if (count > 0) {
this.combo = emptied ? 8 : this.combo + 1;
} else {
this.combo = 0;
}

if (count > 0) {
let base = count * 100;
const beforeBonus = Math.floor(this.totalCleared / 2); // Exemple simplifié
this.totalCleared += count;
// Logique de score simplifiée pour l'exemple
this.score += base * (this.combo > 1 ? this.combo : 1);
if (emptied) {
this.triggerClearAnimation(result.lines);
} else {
this.showComboOrPraise(count, result.lines);
}
this.turn++;
this.setupNextBlock();
this.maybeSpawnObstacles();
} else {
this.checkGameOver();
}
},

processClears() {
// Logique simplifiée de détection de lignes/colonnes
const lines = [];
// Lignes
for (let y = 0; y < this.SIZE; y++) {
if (this.cells[y].every(v => v === 2)) {
lines.push({ type: 'row', index: y });
for (let x = 0; x < this.SIZE; x++) this.cells[y][x] = 0;
}
}
// Colonnes
for (let x = 0; x < this.SIZE; x++) {
let full = true;
for (let y = 0; y < this.SIZE; y++) { if (this.cells[y][x] !== 2) full = false; }
if (full) {
lines.push({ type: 'col', index: x });
for (let y = 0; y < this.SIZE; y++) this.cells[y][x] = 0;
}
}
return { count: lines.length, lines };
},

showComboOrPraise(count, lines) {
const badge = document.getElementById("comboBadge");
const praise = document.getElementById("praiseBadge");

// Reset classes
badge.className = "combo-badge hidden";
praise.className = "praise-badge hidden";

if (this.combo > 1) {
badge.textContent = `COMBO x${this.combo}`;
badge.classList.remove("hidden");
badge.classList.add("pop");
this.comboUntil = this.gameNow + 800;
GameAudio.playClear(this.combo);
} else if (count >= 3) {
// Mots rares
const words = ["NICE!", "GREAT!", "AMAZING!", "EPIC!", "LEGENDARY!"];
const level = Math.min(5, count); // Niveau basé sur le nombre de lignes
const word = words[level - 1] || "WOW!";
praise.textContent = word;
praise.className = `praise-badge show l${level}`;
praise.classList.remove("hidden");
this.praiseUntil = this.gameNow + 1200;
GameAudio.playPraise(level);

// Tremblement si niveau max
if (level === 5) {
document.getElementById("gameScreen").classList.add("quake");
setTimeout(() => document.getElementById("gameScreen").classList.remove("quake"), 900);
Haptics.vibrate(400);
}
} else {
GameAudio.playClear(count);
}
},

triggerClearAnimation(lines) {
// Nouvelle animation de vidage complet
this.isClearingGrid = true;
this.clearGridStartTime = this.gameNow;

// Effet visuel global
document.getElementById("gameScreen").classList.add("quake");
Haptics.vibrate(600); // Vibration prolongée

// Préparer les cellules pour l'animation de vague
const center = this.SIZE / 2 - 0.5;
const orderedCells = [];
for (let y = 0; y < this.SIZE; y++) {
for (let x = 0; x < this.SIZE; x++) {
if (this.cells[y][x] !== 0) {
const dist = Math.max(Math.abs(x - center), Math.abs(y - center)); // Distance carrée (Chebyshev)
orderedCells.push({ x, y, dist });
}
}
}
orderedCells.sort((a, b) => a.dist - b.dist);

// Marquer les cellules pour l'animation de flash individuel
orderedCells.forEach((cell, index) => {
this.cellFlashes.push({
x: cell.x,
y: cell.y,
start: this.gameNow + (index * 30) // Délai progressif
});
});

// Lancer la vague Halo
setTimeout(() => {
this.lightWave = { start: this.gameNow, level: 3 };
const halo = document.getElementById("haloWave");
halo.classList.add("thick", "play");
Theme.shift(800); // Changement de couleur synchronisé
GameAudio.playColorShift();
}, 300); // Micro délai avant la vague

// Fin de l'animation après 2 secondes
setTimeout(() => {
this.finishClearAnimation();
}, 2000);
},

finishClearAnimation() {
this.isClearingGrid = false;
document.getElementById("gameScreen").classList.remove("quake");
document.getElementById("haloWave").classList.remove("thick", "play");
this.lightWave = null;
this.cellFlashes = [];
// Reset grille proprement
this.cells = Array.from({ length: this.SIZE }, () => Array(this.SIZE).fill(0));
this.score = 0;
this.displayedScore = 0;
this.turn = 1;
this.combo = 0;
this.totalCleared = 0;
this.queue = [];
for (let i = 0; i < 3; i++) { this.queue.push(this.generateRequiredBlocks()); }
this.setupNextBlock();
this.updateHUD();
GameAudio.playPlace(); // Son de fin
},

startRestartSequence() {
// Séquence demandée : Popup disparaît -> délai -> blocs disparaissent + son -> score reset -> nouvelle partie
const overlay = document.getElementById("gameOverOverlay");
overlay.style.transition = "opacity 0.3s ease, transform 0.3s ease";
overlay.style.opacity = "0";
overlay.style.transform = "scale(0.9)";

setTimeout(() => {
overlay.classList.add("hidden");
overlay.style.opacity = ""; // Reset inline styles
overlay.style.transform = "";

// Disparition des blocs gelés (si any) avec son
let frozenCells = [];
for(let y=0; y<this.SIZE; y++) {
for(let x=0; x<this.SIZE; x++) {
if(this.cells[y][x] === 3) frozenCells.push({x,y});
}
}

frozenCells.forEach((cell, i) => {
setTimeout(() => {
this.cells[cell.y][cell.x] = 0;
this.spawnParticles(cell.x, cell.y, 5, "#aaa");
GameAudio.playBack(); // Son par disparition
}, i * 50);
});

// Reset score animé
const startScore = this.displayedScore;
let currentDisplay = startScore;
const scoreInterval = setInterval(() => {
currentDisplay -= Math.ceil(currentDisplay * 0.15);
if(currentDisplay <= 0) {
currentDisplay = 0;
clearInterval(scoreInterval);
}
document.getElementById("currentScore").textContent = currentDisplay;
document.getElementById("currentScore").classList.add("score-bump");
setTimeout(()=>document.getElementById("currentScore").classList.remove("score-bump"), 200);
}, 100);

// Démarrage nouvelle partie après 2s totales depuis le début
setTimeout(() => {
this.reset();
this.start();
}, 2000);

}, 300); // Délai micro après disparition popup
},

checkGameOver() {
if (!this.hasPossibleMove()) {
this.gameOver = true;
this.runActive = false;
GameAudio.playGameOver();
document.getElementById("gameOverOverlay").classList.remove("hidden");
this.startCountdown();
}
},

startCountdown() {
if (Storage.getSettings().noAds) {
// Si pas de pubs, on passe directement ou on affiche un message différent (selon logique souhaitée)
// Ici on simule juste le countdown normal pour l'exemple
}
this.countdown = 10;
const valEl = document.getElementById("countdownValue");
const ring = document.getElementById("ringFg");
valEl.textContent = this.countdown;
ring.classList.add("drain");
ring.style.animationDuration = "10s";

this.countdownTimer = setInterval(() => {
this.countdown--;
valEl.textContent = this.countdown;
valEl.classList.add("tick");
setTimeout(() => valEl.classList.remove("tick"), 300);
GameAudio.playCountdown();
if (this.countdown <= 0) {
this.stopCountdown();
this.startRestartSequence(); // Utilise la nouvelle séquence
}
}, 1000);
},

stopCountdown() {
if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
const ring = document.getElementById("ringFg");
ring.classList.remove("drain");
},

revive() {
// Logique de revival via pub
this.gameOver = false;
this.runActive = true;
document.getElementById("gameOverOverlay").classList.add("hidden");
this.stopCountdown();
// On remet quelques coups ou on continue
},

updateHUD() {
document.getElementById("availableCount").textContent = this.requiredBlocks;
},

// Méthodes graphiques
getCellSize() { return this.canvas.width / this.SIZE; },
getCellCenterX(x) { return x * this.getCellSize() + this.getCellSize() / 2; },
getCellCenterY(y) { return y * this.getCellSize() + this.getCellSize() / 2; },
roundRectPath(x, y, w, h, r) {
const ctx = this.ctx;
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.lineTo(x + w - r, y);
ctx.quadraticCurveTo(x + w, y, x + w, y + r);
ctx.lineTo(x + w, y + h - r);
ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
ctx.lineTo(x + r, y + h);
ctx.quadraticCurveTo(x, y + h, x, y + h - r);
ctx.lineTo(x, y + r);
ctx.quadraticCurveTo(x, y, x + r, y);
ctx.closePath();
},
easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
easeOutBack(t) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },

draw() {
const ctx = this.ctx;
const now = this.gameNow;
const cellSize = this.getCellSize();
ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

// Dessin des cellules
for (let y = 0; y < this.SIZE; y++) {
for (let x = 0; x < this.SIZE; x++) {
const val = this.cells[y][x];
if (val === 0) continue;

// Animation de flash individuel (pour la vague)
let scale = 1;
let alpha = 1;
const flash = this.cellFlashes.find(f => f.x === x && f.y === y && now - f.start < 400);
if (flash) {
const t = (now - flash.start) / 400;
scale = 1 + Math.sin(t * Math.PI) * 0.4; // Grossissement
alpha = 1;
// Couleur brillante temporaire
ctx.save();
ctx.globalCompositeOperation = "lighter";
ctx.fillStyle = "#fff";
const px = x * cellSize;
const py = y * cellSize;
const pad = cellSize * 0.035;
const box = cellSize - pad * 2;
const r = cellSize * 0.16;
const center = cellSize / 2;
ctx.translate(px + center, py + center);
ctx.scale(scale, scale);
ctx.translate(-center, -center);
this.roundRectPath(pad, pad, box, box, r);
ctx.fill();
ctx.restore();
}

// Dessin normal si pas en flash ou en superposition
if (val !== 0) {
this.drawCellAt(x, y, val, scale, alpha);
}
}
}

// Ligne de tracé
this.drawPathLine();
// Particules, débris, etc.
this.drawParticles();
this.drawDebris();
this.drawCellFlashes(now);
this.drawLightWave(now);
this.drawLineFlashes(now);
this.drawLineBeams(now);
this.drawShockwaves(now);
this.drawCancelAnims(now);
},

drawCellAt(x, y, value, scale, alpha, shakeX = 0) {
const cellSize = this.getCellSize();
const ctx = this.ctx;
const px = x * cellSize + shakeX;
const py = y * cellSize;
const pad = cellSize * 0.035;
const box = cellSize - pad * 2;
const r = cellSize * 0.16;
const center = cellSize / 2;
ctx.save();
ctx.globalAlpha = alpha;
ctx.translate(px + center, py + center);
ctx.scale(scale, scale);
ctx.translate(-center, -center);
ctx.fillStyle = this.frameGradients[value] || "#ffffff";
this.roundRectPath(pad, pad, box, box, r);
ctx.fill();
// Highlight
ctx.fillStyle = "rgba(250, 243, 225, 0.4)";
this.roundRectPath(pad + box * 0.1, pad + box * 0.08, box * 0.8, box * 0.2, r * 0.7);
ctx.fill();
// Shadow
ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
this.roundRectPath(pad + box * 0.1, pad + box * 0.74, box * 0.8, box * 0.16, r * 0.7);
ctx.fill();
ctx.restore();
},

drawCellFlashes(now) { /* Géré dans draw() principal pour la vague */ },
drawFloatingTexts(now) { /* ... */ },
drawLightWave(now) {
if (!this.lightWave) return;
const age = now - this.lightWave.start;
const duration = 1200;
if (age > duration) { this.lightWave = null; return; }
const p = age / duration;
const level = this.lightWave.level;
const maxR = this.canvas.width * (0.6 + level * 0.3);
const size = p * maxR;
const thickness = this.getCellSize() * (0.3 + level * 0.15);
const alpha = (0.4 + level * 0.1) * (1 - p * 0.7);
const ctx = this.ctx;
ctx.save();
ctx.globalCompositeOperation = "lighter";
ctx.strokeStyle = `rgba(250, 243, 225, ${alpha * 0.5})`;
ctx.lineWidth = thickness * 2;
// Forme carrée arrondie qui grandit
const hw = size; // Half width
ctx.beginPath();
ctx.roundRect(this.canvas.width/2 - hw, this.canvas.height/2 - hw, hw*2, hw*2, 40);
ctx.stroke();
ctx.strokeStyle = `rgba(250, 243, 225, ${alpha})`;
ctx.lineWidth = thickness;
ctx.stroke();
ctx.restore();
},
drawPathLine() {
if (this.path.length < 2) return;
const ctx = this.ctx;
const cellSize = this.getCellSize();
ctx.save();
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "rgba(250, 243, 225, 0.2)";
ctx.lineWidth = cellSize * 0.12;
ctx.beginPath();
ctx.moveTo(this.getCellCenterX(this.path[0].x), this.getCellCenterY(this.path[0].y));
for (let i = 1; i < this.path.length; i++) {
ctx.lineTo(this.getCellCenterX(this.path[i].x), this.getCellCenterY(this.path[i].y));
}
ctx.stroke();
ctx.restore();
},
drawLineFlashes(now) { /* ... */ },
drawLineBeams(now) { /* ... */ },
drawShockwaves(now) { /* ... */ },
drawCancelAnims(now) { /* ... */ },
drawParticles() {
const ctx = this.ctx;
this.particles = this.particles.filter(p => p.life > 0);
for (const p of this.particles) {
p.x += p.vx * this.timeScale;
p.y += p.vy * this.timeScale;
p.vy += this.getCellSize() * 0.004 * this.timeScale;
p.life -= p.decay * this.timeScale;
if (p.life <= 0) continue;
ctx.save();
ctx.globalAlpha = Math.max(p.life, 0);
ctx.fillStyle = p.color;
ctx.beginPath();
ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
}
},
drawDebris() {
const ctx = this.ctx;
this.debris = this.debris.filter(p => p.life > 0);
for (const p of this.debris) {
p.x += p.vx * this.timeScale;
p.y += p.vy * this.timeScale;
p.vy += this.getCellSize() * 0.005 * this.timeScale;
p.rotation += p.vr * this.timeScale;
p.life -= p.decay * this.timeScale;
if (p.life <= 0) continue;
ctx.save();
ctx.globalAlpha = Math.max(p.life, 0);
ctx.fillStyle = p.color;
ctx.translate(p.x, p.y);
ctx.rotate(p.rotation);
const size = p.size;
ctx.fillRect(-size / 2, -size / 2, size, size);
ctx.restore();
}
},
invalidFeedback(x, y) {
const now = performance.now();
const key = `${x},${y}`;
if (this.lastInvalidKey === key && now - this.lastInvalidTime < 250) return;
this.lastInvalidKey = key;
this.lastInvalidTime = now;
this.spawnDebris(x, y, "#ef4444", 1);
GameAudio.playError();
Haptics.vibrate(30);
},
spawnParticles(x, y, count, color) {
const cx = x * this.getCellSize() + this.getCellSize()/2;
const cy = y * this.getCellSize() + this.getCellSize()/2;
for(let i=0; i<count; i++) {
this.particles.push({
x: cx, y: cy,
vx: (Math.random() - 0.5) * 10,
vy: (Math.random() - 0.5) * 10,
life: 1, decay: 0.03 + Math.random()*0.02,
size: 2 + Math.random()*3, color: color
});
}
},
spawnDebris(x, y, color, count) {
const cx = x * this.getCellSize() + this.getCellSize()/2;
const cy = y * this.getCellSize() + this.getCellSize()/2;
for(let i=0; i<count; i++) {
this.debris.push({
x: cx, y: cy,
vx: (Math.random() - 0.5) * 8,
vy: (Math.random() - 0.5) * 8 - 5,
vr: (Math.random() - 0.5) * 0.5,
life: 1, decay: 0.02,
size: 4 + Math.random()*4, color: color
});
}
}
};
