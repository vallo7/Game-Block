const Game = {
  SIZE: 8,

  canvas: null,
  ctx: null,

  active: false,
  runActive: false,
  gameOver: false,
  drawing: false,
  strokeStarted: false,
  sequenceRunning: false,

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
  cancelAnims: {},
  destroyAnims: [],
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

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.blockImages = {};
    ["blue", "yellow", "green", "purple", "pink", "stone", "ice"].forEach(name => {
      const img = new Image();
      img.src = `img/blocks/block-${name}.png`;
      this.blockImages[name] = img;
    });

    this.best = Storage.getBest();
    this.displayedBest = this.best;

    const bestEl = document.getElementById("bestScoreValue");
    if (bestEl) bestEl.textContent = this.best;

    if (!document.getElementById("praiseBadge")) {
      const el = document.createElement("div");
      el.id = "praiseBadge";
      el.className = "praise-badge hidden";
      const zone =
        document.getElementById("feedbackZone") ||
        document.querySelector(".board-shell");
      if (zone) zone.appendChild(el);
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
        } catch (error) {
          // garde-fou : le loop ne meurt jamais
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  },

  on(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
    return el;
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
    if (this.freezeTimeout) {
      clearTimeout(this.freezeTimeout);
      this.freezeTimeout = null;
    }
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
      this.popupTimeout = null;
    }
  },

  lockUI() {
    document.body.classList.add("locked");
  },

  unlockUI() {
    document.body.classList.remove("locked");
  },

  reset() {
    this.cells = Array.from({ length: this.SIZE }, () => Array(this.SIZE).fill(0));
    this.cellColors = {};
    this.turnColor = null;
    this.stoneSeeds = {};

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
    this.sequenceRunning = false;

    this.gameOver = false;
    this.drawing = false;
    this.strokeStarted = false;
    this.runActive = true;

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
    this.destroyAnims = [];
    this.cellFlashes = [];
    this.floatingTexts = [];
    this.particles = [];
    this.debris = [];
    this.shockwaves = [];
    this.lineFlashes = [];

    this.queue = [];
    for (let i = 0; i < 3; i++) {
      this.queue.push(this.generateRequiredBlocks());
    }

    this.setupNextBlock();

    const over = document.getElementById("gameOverOverlay");
    if (over) over.classList.add("hidden");

    const badge = document.getElementById("comboBadge");
    if (badge) badge.classList.add("hidden");

    const praise = document.getElementById("praiseBadge");
    if (praise) praise.classList.add("hidden");

    const screen = document.getElementById("gameScreen");
    if (screen) screen.classList.remove("quake");

    const scoreEl = document.getElementById("currentScore");
    if (scoreEl) scoreEl.textContent = "0";

    this.updateHUD();
  },

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (!this.active || this.gameOver) return;

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

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.active) return;

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

      if (this.gameOver) return;

      if (this.path.length === this.requiredBlocks) {
        this.validate();
      } else {
        this.cancelIncomplete();
      }
    });

    this.canvas.addEventListener("pointercancel", () => {
      if (!this.active) return;

      this.pointer.active = false;
      this.cancelPath(false);
    });

    // Bouton CONTINUER (pub) : plus gros / mis en avant dans le pop-up
    this.on("adsBtn", () => {
      GameAudio.playClick();
      setTimeout(() => {
        this.stopCountdown();
        this.revive();
      }, 250);
    });

    // Bouton RESTART : séquence de redémarrage animée
    this.on("restartBtn", () => {
      GameAudio.playClick();
      this.startNewGameSequence();
    });

    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.resize(), 120);
    });
  },

  updatePointer(event, active) {
    const rect = this.canvas.getBoundingClientRect();

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
    this.pointer.y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    this.pointer.active = active;
  },

  sanitizeStroke() {
    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] === 1) {
          this.cells[y][x] = 0;
        }
      }
    }

    this.path = [];
  },

  getDpr() {
    return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  },

  resize() {
    if (!this.canvas) return;

    const dpr = this.getDpr();
    const rect = this.canvas.getBoundingClientRect();

    const size = Math.floor(rect.width * dpr);

    if (size > 0) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
  },

  ensureCanvasSize() {
    const dpr = this.getDpr();
    const target = Math.floor(this.canvas.clientWidth * dpr);

    if (target > 0 && this.canvas.width !== target) {
      this.canvas.width = target;
      this.canvas.height = target;
    }
  },

  // Banque de couleurs vives pour les blocs (inclut les teintes B/L/C/K/O du
  // logo Game Block) + la teinte "pierre" des obstacles.
  COLOR_BANK: [
    { name: "blue", base: "#0477fc", light: "#23a8fd", dark: "#0045f1" },
    { name: "yellow", base: "#fde402", light: "#fcf828", dark: "#fdb701" },
    { name: "green", base: "#46f30d", light: "#6bf90d", dark: "#14c304" },
    { name: "purple", base: "#9a0bf9", light: "#b847f9", dark: "#6505cb" },
    { name: "pink", base: "#f91487", light: "#fb59c5", dark: "#d00245" }
  ],

  STONE_COLOR: { name: "stone", base: "#777c8a", light: "#a1a5b4", dark: "#454852" },
  ICE_COLOR: { name: "ice", base: "#058afd", light: "#75f1fa", dark: "#0071fc" },

  pickTurnColor() {
    const bank = this.COLOR_BANK;
    const current = Math.floor(Math.random() * bank.length);

    if (this.turnColor) {
      const currentIndex = bank.findIndex(c => c.name === this.turnColor.name);
      if (currentIndex === current) {
        return bank[(current + 1) % bank.length];
      }
    }

    return bank[current];
  },

  getBankColor(name) {
    if (name === "stone") return this.STONE_COLOR;
    return this.COLOR_BANK.find(c => c.name === name) || this.COLOR_BANK[0];
  },

  hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  },

  lerpColor(hexA, hexB, t) {
    const a = this.hexToRgb(hexA);
    const b = this.hexToRgb(hexB);
    const clampT = Math.max(0, Math.min(1, t));

    const r = Math.round(a.r + (b.r - a.r) * clampT);
    const g = Math.round(a.g + (b.g - a.g) * clampT);
    const bl = Math.round(a.b + (b.b - a.b) * clampT);

    return `rgb(${r}, ${g}, ${bl})`;
  },

  buildFrameGradients() {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    const sizeChanged = this._gradCellSize !== cellSize;
    const themeChanged = this._gradThemeLight !== Theme.current.light || this._gradThemeDark !== Theme.current.dark;

    if (!sizeChanged && !themeChanged) return;

    if (sizeChanged || !this.frameGradients[1]) {
      let g = ctx.createLinearGradient(0, 0, 0, cellSize);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#e2e2e2");
      this.frameGradients[1] = g;

      g = ctx.createLinearGradient(0, 0, 0, cellSize);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#dcdcdc");
      this.frameGradients[2] = g;

      g = ctx.createLinearGradient(0, 0, 0, cellSize);
      g.addColorStop(0, this.ICE_COLOR.light);
      g.addColorStop(1, this.ICE_COLOR.base);
      this.frameGradients.ice = g;
    }

    if (sizeChanged || themeChanged) {
      const g = ctx.createLinearGradient(0, 0, 0, cellSize);
      g.addColorStop(0, Theme.current.light);
      g.addColorStop(1, Theme.current.dark);
      this.frameGradients[3] = g;
    }

    this._gradCellSize = cellSize;
    this._gradThemeLight = Theme.current.light;
    this._gradThemeDark = Theme.current.dark;
  },

  getGlowSprite(rgb) {
    if (this.glowCache[rgb]) return this.glowCache[rgb];

    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;

    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);

    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);

    this.glowCache[rgb] = c;
    return c;
  },

  update(realDelta) {
    this.ensureCanvasSize();

    const scoreEl = document.getElementById("currentScore");

    if (this.displayedScore !== this.score) {
      const diff = this.score - this.displayedScore;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.16));

      this.displayedScore += diff > 0 ? step : -step;

      if (scoreEl) scoreEl.textContent = this.displayedScore;
    }

    const bestEl = document.getElementById("bestScoreValue");

    if (this.displayedBest !== this.best) {
      const diff = this.best - this.displayedBest;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.16));

      this.displayedBest += diff > 0 ? step : -step;

      if (bestEl) bestEl.textContent = this.displayedBest;
    }

    const badge = document.getElementById("comboBadge");

    if (badge && !badge.classList.contains("hidden") && this.gameNow > this.comboUntil) {
      badge.classList.add("hidden");
    }

    const praise = document.getElementById("praiseBadge");

    if (praise && !praise.classList.contains("hidden") && this.gameNow > this.praiseUntil) {
      praise.classList.add("hidden");
    }
  },

  getDifficulty() {
    const turnCurve = 1 - Math.exp(-this.turn / 60);
    const scoreCurve = 1 - Math.exp(-this.score / 15000);
    const fill = this.getFillRatio();
    const fillCurve = Math.min(1, Math.max(0, (fill - 0.3) / 0.5));

    return Math.min(1, turnCurve * 0.6 + scoreCurve * 0.25 + fillCurve * 0.15);
  },

  // La courbe ci-dessus plafonne à 1 (autour du tour ~250-300). Au-delà de ce
  // plafond, cette seconde courbe très lente et sans limite continue de faire
  // évoluer la partie pour les joueurs qui durent très longtemps.
  getEndlessIntensity() {
    const longTurn = Math.max(0, this.turn - 150);
    const longScore = Math.max(0, this.score - 40000);

    return Math.log(1 + longTurn / 90 + longScore / 60000);
  },

  getFillRatio() {
    let filled = 0;

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] !== 0) filled++;
      }
    }

    return filled / (this.SIZE * this.SIZE);
  },

  isGridEmpty() {
    return this.cells.every(row => row.every(value => value === 0));
  },

  isGridFull() {
    return this.cells.every(row => row.every(value => value !== 0));
  },

  hasPossibleMove() {
    const target = this.requiredBlocks;

    if (target <= 0) return true;

    let emptyCount = 0;

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] === 0) emptyCount++;
      }
    }

    if (emptyCount < target) return false;

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    const findPath = (x, y, depth, visited) => {
      if (depth === target) return true;

      const key = y * this.SIZE + x;
      visited.add(key);

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 && nx < this.SIZE &&
          ny >= 0 && ny < this.SIZE &&
          this.cells[ny][nx] === 0 &&
          !visited.has(ny * this.SIZE + nx)
        ) {
          if (findPath(nx, ny, depth + 1, visited)) {
            visited.delete(key);
            return true;
          }
        }
      }

      visited.delete(key);
      return false;
    };

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] !== 0) continue;

        if (findPath(x, y, 1, new Set())) {
          return true;
        }
      }
    }

    return false;
  },

  largestPathLength() {
    let bestLen = 0;

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    const dfs = (x, y, depth, visited) => {
      if (depth > bestLen) bestLen = depth;
      if (depth === 6) return;

      const key = y * this.SIZE + x;
      visited.add(key);

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 && nx < this.SIZE &&
          ny >= 0 && ny < this.SIZE &&
          this.cells[ny][nx] === 0 &&
          !visited.has(ny * this.SIZE + nx)
        ) {
          dfs(nx, ny, depth + 1, visited);
        }
      }

      visited.delete(key);
    };

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] !== 0) continue;

        dfs(x, y, 1, new Set());

        if (bestLen === 6) return 6;
      }
    }

    return bestLen;
  },

  generateRequiredBlocks() {
    const diff = this.getDifficulty();
    const intensity = this.getEndlessIntensity();
    const fill = this.getFillRatio();

    const low = [6, 14, 22, 26, 20, 12];
    const high = [4, 8, 12, 20, 26, 30];

    const weights = low.map((value, index) => {
      return value + (high[index] - value) * diff;
    });

    if (intensity > 0) {
      const shift = Math.min(0.85, intensity * 0.18);
      weights[0] *= 1 - shift * 0.7;
      weights[1] *= 1 - shift * 0.5;
      weights[4] *= 1 + shift * 0.6;
      weights[5] *= 1 + shift * 0.9;
    }

    if (fill > 0.72) {
      weights[4] *= 0.64;
      weights[5] *= 0.42;
      weights[0] *= 1.08;
      weights[1] *= 1.14;
    }

    if (fill < 0.24) {
      weights[3] *= 1.08;
      weights[4] *= 1.12;
      weights[5] *= 1.08;
    }

    const total = weights.reduce((sum, value) => sum + value, 0);
    let random = Math.random() * total;

    for (let i = 0; i < weights.length; i++) {
      if (random < weights[i]) return i + 1;
      random -= weights[i];
    }

    return 3;
  },

  setupNextBlock() {
    if (Tutorial.active) {
      const forced = Tutorial.nextRequiredBlocks();
      if (forced !== null) {
        this.requiredBlocks = forced;
        this.turnColor = this.pickTurnColor();
        this.updateHUD();
        return;
      }
    }

    if (this.queue.length < 3) {
      this.queue.push(this.generateRequiredBlocks());
    }

    this.requiredBlocks = this.queue.shift();
    this.queue.push(this.generateRequiredBlocks());

    this.turnColor = this.pickTurnColor();
    this.updateHUD();
  },

  wouldCompleteLine(x, y) {
    let rowFilled = 0;
    for (let x2 = 0; x2 < this.SIZE; x2++) {
      if (x2 !== x && this.cells[y][x2] !== 0) rowFilled++;
    }
    if (rowFilled === this.SIZE - 1) return true;

    let colFilled = 0;
    for (let y2 = 0; y2 < this.SIZE; y2++) {
      if (y2 !== y && this.cells[y2][x] !== 0) colFilled++;
    }
    if (colFilled === this.SIZE - 1) return true;

    return false;
  },

  maybeSpawnObstacles() {
    if (Tutorial.active) return;

    const diff = this.getDifficulty();
    const intensity = this.getEndlessIntensity();
    const interval = Math.max(1, 5 - Math.round(diff * 3) - Math.min(1, Math.round(intensity * 0.5)));

    if (this.turnsSinceObstacle < interval) return;

    this.turnsSinceObstacle = 0;

    const fill = this.getFillRatio();

    let count = 1 + Math.round(diff * 3);

    if (fill > 0.78) count = Math.max(1, count - 1);
    if (fill < 0.22) count = Math.min(4, count + 1);

    const cells = this.chooseObstacleCells(count);

    cells.forEach(cell => {
      this.cells[cell.y][cell.x] = 3;

      this.cellAnims[`${cell.x},${cell.y}`] = {
        start: this.gameNow,
        type: "spawn"
      };

      this.spawnParticles(cell.x, cell.y, 4, Theme.current.dark);
    });
  },

  chooseObstacleCells(count) {
    const chosen = [];
    const keys = new Set();

    const add = (cell) => {
      if (!cell) return;

      const key = `${cell.x},${cell.y}`;

      if (
        this.cells[cell.y][cell.x] === 0 &&
        !keys.has(key) &&
        !this.wouldCompleteLine(cell.x, cell.y)
      ) {
        keys.add(key);
        chosen.push(cell);
      }
    };

    if (count >= 3 && Math.random() < 0.45) {
      this.tryPatternL().forEach(add);
    }

    if (chosen.length === 0 && count >= 2) {
      this.tryPatternPair().forEach(add);
    }

    while (chosen.length < count) {
      const cell = this.getRandomEmptyCell();
      if (!cell) break;
      add(cell);
    }

    return chosen.slice(0, count);
  },

  getRandomEmptyCell() {
    const emptyCells = [];

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] === 0) emptyCells.push({ x, y });
      }
    }

    if (emptyCells.length === 0) return null;

    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  },

  shuffleArray(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  },

  tryPatternPair() {
    const anchor = this.getRandomEmptyCell();
    if (!anchor) return [];

    const directions = this.shuffleArray([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ]);

    for (const dir of directions) {
      const neighbor = { x: anchor.x + dir.x, y: anchor.y + dir.y };

      if (
        neighbor.x >= 0 &&
        neighbor.x < this.SIZE &&
        neighbor.y >= 0 &&
        neighbor.y < this.SIZE &&
        this.cells[neighbor.y][neighbor.x] === 0
      ) {
        return [anchor, neighbor];
      }
    }

    return [];
  },

  tryPatternL() {
    const anchor = this.getRandomEmptyCell();
    if (!anchor) return [];

    const patterns = this.shuffleArray([
      [{ x: 1, y: 0 }, { x: 0, y: 1 }],
      [{ x: -1, y: 0 }, { x: 0, y: 1 }],
      [{ x: 1, y: 0 }, { x: 0, y: -1 }],
      [{ x: -1, y: 0 }, { x: 0, y: -1 }]
    ]);

    for (const pattern of patterns) {
      const a = { x: anchor.x + pattern[0].x, y: anchor.y + pattern[0].y };
      const b = { x: anchor.x + pattern[1].x, y: anchor.y + pattern[1].y };

      const valid = [a, b].every(cell => {
        return (
          cell.x >= 0 &&
          cell.x < this.SIZE &&
          cell.y >= 0 &&
          cell.y < this.SIZE &&
          this.cells[cell.y][cell.x] === 0
        );
      });

      if (valid) return [anchor, a, b];
    }

    return [];
  },

  getCellFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();

    const x = Math.floor(((event.clientX - rect.left) / rect.width) * this.SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * this.SIZE);

    if (x < 0 || x >= this.SIZE || y < 0 || y >= this.SIZE) return null;

    return { x, y };
  },

  canAddCell(x, y) {
    if (this.gameOver) return false;
    if (x < 0 || x >= this.SIZE || y < 0 || y >= this.SIZE) return false;
    if (this.cells[y][x] !== 0) return false;
    if (this.path.length >= this.requiredBlocks) return false;
    if (Tutorial.active && !Tutorial.isCellAllowed(x, y, this.path)) return false;

    if (this.path.length === 0) return true;

    const last = this.path[this.path.length - 1];
    return Math.abs(last.x - x) + Math.abs(last.y - y) === 1;
  },

  tryStart(cell) {
    if (!this.canAddCell(cell.x, cell.y)) {
      this.invalidFeedback(cell.x, cell.y);
      return false;
    }

    this.addCell(cell.x, cell.y);
    return true;
  },

  tryContinue(cell) {
    const index = this.path.findIndex(p => p.x === cell.x && p.y === cell.y);

    if (index >= 0) {
      this.backtrackTo(index);
      return;
    }

    if (this.canAddCell(cell.x, cell.y)) {
      this.addCell(cell.x, cell.y);
    } else if (this.cells[cell.y][cell.x] === 0) {
      this.invalidFeedback(cell.x, cell.y);
    }
  },

  addCell(x, y) {
    this.cells[y][x] = 1;
    this.path.push({ x, y });
    this.cellColors[`${x},${y}`] = this.turnColor ? this.turnColor.name : this.COLOR_BANK[0].name;

    this.cellAnims[`${x},${y}`] = {
      start: this.gameNow,
      type: "place"
    };

    GameAudio.playAdd(this.path.length);
    Haptics.vibrate(12);

    this.updateHUD();
  },

  backtrackTo(index) {
    const removed = this.path.splice(index + 1);

    if (removed.length === 0) return;

    removed.forEach(cell => {
      this.cells[cell.y][cell.x] = 0;
      delete this.cellColors[`${cell.x},${cell.y}`];
    });

    GameAudio.playBack();

    this.updateHUD();
  },

  cancelPath(animated) {
    this.drawing = false;
    this.strokeStarted = false;

    if (this.path.length === 0) return;

    this.path.forEach(cell => {
      this.cells[cell.y][cell.x] = 0;
      delete this.cellColors[`${cell.x},${cell.y}`];
    });

    this.path = [];

    if (animated) {
      GameAudio.playCancel();
      Haptics.vibrate([20, 30, 20]);
    }

    this.updateHUD();
  },

  cancelIncomplete() {
    if (this.path.length === 0) return;

    const cancelledCells = [...this.path];

    cancelledCells.forEach(cell => {
      this.cancelAnims.push({
        x: cell.x,
        y: cell.y,
        start: this.gameNow
      });

      this.spawnDebris(cell.x, cell.y, "#ef4444", 2);
    });

    this.cancelPath(true);
  },

  validate() {
    if (this.path.length !== this.requiredBlocks) return;

    const placed = [...this.path];
    this.path = [];

    placed.forEach(cell => {
      this.cells[cell.y][cell.x] = 2;

      this.cellAnims[`${cell.x},${cell.y}`] = {
        start: this.gameNow,
        type: "validate"
      };
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

      const beforeBonus = Math.floor(this.totalCleared / 2);
      this.totalCleared += count;

      if (Math.floor(this.totalCleared / 2) > beforeBonus) {
        base += 200;
      }

      let points = base * Math.max(1, this.combo);

      if (emptied) {
        points += 300 * 8;
      }

      this.addScore(points);

      const color = emptied ? "#ffb100" : this.pointsColor(count);

      this.addFloatingText(
        `+${points}`,
        this.canvas.width / 2,
        this.canvas.height / 2,
        color
      );

      const vib = [];
      for (let i = 0; i < count; i++) {
        vib.push(30 + count * 10, 20);
      }
      Haptics.vibrate(vib);

      this.comboUntil = this.gameNow + 1800;

      if (this.combo >= 2) {
        const badge = document.getElementById("comboBadge");

        if (badge) {
          badge.textContent = `COMBO x${this.combo}`;
          badge.classList.remove("hidden");
          badge.classList.remove("pop", "mega");
          void badge.offsetWidth;
          badge.classList.add(emptied ? "mega" : "pop");
        }
      }

      if (count >= 3 || this.combo >= 2) {
        const power = count + this.combo;

        let level = 1;
        if (power >= 12) level = 5;
        else if (power >= 9) level = 4;
        else if (power >= 7) level = 3;
        else if (power >= 5) level = 2;

        if (emptied) level = 4;

        this.showPraise(level, emptied);
      }
    } else {
      this.comboUntil = this.gameNow + 1800;
    }

    this.turn += 1;
    this.turnsSinceObstacle += 1;

    if (emptied) {
      this.celebrateEmptyGrid();
    }

    this.maybeSpawnObstacles();
    this.setupNextBlock();
    this.checkGameOver();

    this.updateHUD();

    if (Tutorial.active) {
      Tutorial.afterValidate();
    }
  },

  pointsColor(count) {
    if (count >= 4) return "#ff9f1a";
    if (count === 3) return "#ffb100";
    if (count === 2) return Theme.current.light;
    return "#ffffff";
  },

  showPraise(level, emptied) {
    const words = ["NICE!", "GREAT!", "AWESOME!", "AMAZING!", "UNREAL!"];

    const badge = document.getElementById("praiseBadge");
    if (!badge) return;

    badge.textContent = words[level - 1];
    badge.className = `praise-badge l${level}`;
    void badge.offsetWidth;
    badge.classList.add("show");

    this.praiseUntil = this.gameNow + 1200 + level * 250;

    GameAudio.playPraise(level);
    if (typeof GameAudio.playVoice === "function") {
      GameAudio.playVoice(level);
    }
    Haptics.vibrate(30 + level * 15);

    // Gerbe de particules proportionnelle au niveau, éparpillée sur la
    // grille pour accompagner le mot d'encouragement.
    const bursts = 2 + level * 2;
    for (let i = 0; i < bursts; i++) {
      const bx = Math.floor(Math.random() * this.SIZE);
      const by = Math.floor(Math.random() * this.SIZE);
      this.spawnParticles(bx, by, level >= 4 ? 5 : 3, level >= 4 ? null : Theme.current.light);
    }

    if (level >= 2) {
      this.blockShake = {
        start: this.gameNow,
        duration: 260 + level * 110
      };
    }

    if (level >= 3 && !emptied) {
      this.lightWave = {
        start: this.gameNow,
        level
      };
    }

    if (level >= 4) {
      this.spawnShockwave(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.4);
    }

    if (level >= 5) {
      const screen = document.getElementById("gameScreen");
      if (screen) {
        screen.classList.remove("quake");
        void screen.offsetWidth;
        screen.classList.add("quake");

        setTimeout(() => {
          screen.classList.remove("quake");
        }, 900);
      }
    }

    if (level >= 3) {
      this.afterGlow = {
        start: this.gameNow,
        level,
        duration: 3000 + level * 800
      };
    }
  },

  addFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      start: this.gameNow
    });
  },

  celebrateEmptyGrid() {
    GameAudio.playColorShift();
    Haptics.vibrate(1200);

    this.spawnShockwave(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.55
    );

    setTimeout(() => {
      this.spawnShockwave(
        this.canvas.width / 2,
        this.canvas.height / 2,
        this.canvas.width * 0.42
      );
    }, 160);

    for (let i = 0; i < 10; i++) {
      const x = Math.floor(Math.random() * this.SIZE);
      const y = Math.floor(Math.random() * this.SIZE);
      this.spawnParticles(x, y, 7, "#ffffff");
      if (i % 2 === 0) this.spawnDebris(x, y, Theme.current.light, 2);
    }

    this.timeScale = 0.4;

    this.colorFx = {
      start: this.gameNow,
      duration: 900
    };

    this.blockShake = {
      start: this.gameNow,
      duration: 700
    };

    Theme.shift(900);

    const screen = document.getElementById("gameScreen");
    if (screen) {
      screen.classList.remove("quake");
      void screen.offsetWidth;
      screen.classList.add("quake");

      setTimeout(() => {
        screen.classList.remove("quake");
      }, 900);
    }

    const halo = document.getElementById("haloWave");
    if (halo) {
      halo.classList.remove("play", "thick");
      void halo.offsetWidth;
      halo.classList.add("play", "thick");
    }
  },

  processClears() {
    const fullRows = [];
    const fullCols = [];

    for (let y = 0; y < this.SIZE; y++) {
      const rowFull = this.cells[y].every(value => value !== 0);
      if (rowFull) fullRows.push(y);
    }

    for (let x = 0; x < this.SIZE; x++) {
      let colFull = true;

      for (let y = 0; y < this.SIZE; y++) {
        if (this.cells[y][x] === 0) {
          colFull = false;
          break;
        }
      }

      if (colFull) fullCols.push(x);
    }

    const count = fullRows.length + fullCols.length;

    if (count === 0) return { count: 0 };

    const toColor = this.turnColor || this.COLOR_BANK[0];
    const clearedKeys = new Set();

    for (const y of fullRows) {
      this.lineFlashes.push({ type: "row", index: y, start: this.gameNow, power: count, color: toColor.base });

      for (let x = 0; x < this.SIZE; x++) {
        clearedKeys.add(`${x},${y}`);
      }
    }

    for (const x of fullCols) {
      this.lineFlashes.push({ type: "col", index: x, start: this.gameNow, power: count, color: toColor.base });

      for (let y = 0; y < this.SIZE; y++) {
        clearedKeys.add(`${x},${y}`);
      }
    }

    if (count >= 2) {
      for (const y of fullRows) {
        this.lineBeams.push({ type: "row", index: y, start: this.gameNow, power: count, color: toColor.base });
      }

      for (const x of fullCols) {
        this.lineBeams.push({ type: "col", index: x, start: this.gameNow, power: count, color: toColor.base });
      }
    }

    let i = 0;
    const power = Math.min(5, count);

    for (const key of clearedKeys) {
      const [x, y] = key.split(",").map(Number);
      const value = this.cells[y][x];
      const fromName = value === 3 ? "stone" : (this.cellColors[key] || toColor.name);
      const fromColor = this.getBankColor(fromName);

      this.cellFlashes.push({
        x,
        y,
        power,
        color: toColor.base,
        start: this.gameNow + (i % 8) * 22
      });

      this.destroyAnims.push({
        x,
        y,
        value,
        power,
        fromColor: fromColor.base,
        toColor: toColor.base,
        fromName,
        toName: toColor.name,
        start: this.gameNow + (i % 8) * 22
      });

      this.spawnDebris(x, y, toColor.base, 3 + power);
      this.spawnParticles(x, y, 8 + power * 2, toColor.light);

      delete this.cellColors[key];

      i++;
    }

    for (const y of fullRows) {
      for (let x = 0; x < this.SIZE; x++) {
        this.cells[y][x] = 0;
      }
    }

    for (const x of fullCols) {
      for (let y = 0; y < this.SIZE; y++) {
        this.cells[y][x] = 0;
      }
    }

    this.spawnShockwave(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * (count > 1 ? 0.4 : 0.25),
      toColor.base
    );

    if (count > 1) {
      this.timeScale = 0.35;
    }

    GameAudio.playClear(count);

    const scoreEl = document.getElementById("currentScore");
    if (scoreEl) {
      scoreEl.classList.remove("score-bump");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("score-bump");
    }

    return { count };
  },

  addScore(points) {
    this.score += points;

    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveBest(this.best);

      const bestEl = document.getElementById("bestScoreValue");
      if (bestEl) {
        bestEl.classList.remove("score-bump");
        void bestEl.offsetWidth;
        bestEl.classList.add("score-bump");
      }
    }
  },

  checkGameOver() {
    if (this.hasPossibleMove()) return;

    this.gameOver = true;

    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveBest(this.best);
    }

    this.lockUI();
    this.clearDefeatTimeouts();

    this.freezeTimeout = setTimeout(() => {
      this.freezeTimeout = null;

      this.startFreeze();
      GameAudio.playDefeatLong(3200);

      this.popupTimeout = setTimeout(() => {
        this.popupTimeout = null;
        this.startGameOver();
      }, 3400);
    }, 2000);
  },

  startFreeze() {
    const order = this.shuffleArray(
      Array.from({ length: this.SIZE * this.SIZE }, (_, i) => i)
    );

    this.freezeDelays = {};

    order.forEach((cellIndex, position) => {
      const x = cellIndex % this.SIZE;
      const y = Math.floor(cellIndex / this.SIZE);

      this.freezeDelays[`${x},${y}`] = position * (2800 / (this.SIZE * this.SIZE));
    });

    this.freezeFx = {
      start: this.gameNow,
      duration: 3000
    };

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        GameAudio.playFreezeTick(i);
      }, i * 360);
    }
  },

  startGameOver() {
    const overlay = document.getElementById("gameOverOverlay");
    const ring = document.getElementById("ringFg");
    const countdownEl = document.getElementById("countdownValue");

    if (!overlay || !ring || !countdownEl) return;

    this.unlockUI();

    GameAudio.playGameOver();

    overlay.classList.remove("hidden");

    ring.classList.remove("drain");
    void ring.offsetWidth;
    ring.classList.add("drain");

    this.countdown = 10;
    countdownEl.textContent = this.countdown;

    this.stopCountdown();

    this.countdownTimer = setInterval(() => {
      this.countdown -= 1;

      if (this.countdown <= 0) {
        this.countdown = 0;
        countdownEl.textContent = "0";
        this.stopCountdown();
        return;
      }

      countdownEl.textContent = this.countdown;
      countdownEl.classList.remove("tick");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("tick");

      GameAudio.playCountdown();
    }, 1000);
  },

  startNewGameSequence() {
    if (this.sequenceRunning) return;
    this.sequenceRunning = true;

    this.stopCountdown();

    const overlay = document.getElementById("gameOverOverlay");

    if (overlay) {
      overlay.classList.add("fade-out");

      setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("fade-out");
      }, 300);
    }

    setTimeout(() => {
      const blocks = [];

      for (let y = 0; y < this.SIZE; y++) {
        for (let x = 0; x < this.SIZE; x++) {
          if (this.cells[y][x] !== 0) {
            blocks.push({ x, y });
          }
        }
      }

      const shuffled = this.shuffleArray(blocks);
      const step = Math.max(12, Math.floor(900 / Math.max(1, shuffled.length)));

      shuffled.forEach((cell, index) => {
        setTimeout(() => {
          this.cells[cell.y][cell.x] = 0;
          this.spawnParticles(cell.x, cell.y, 2, "#9fd8ff");

          if (typeof GameAudio.playBlockDisappear === "function") {
            GameAudio.playBlockDisappear(index);
          }
        }, index * step);
      });

      const scoreEl = document.getElementById("currentScore");
      if (scoreEl) scoreEl.classList.add("score-reset");

      this.score = 0;

      setTimeout(() => {
        if (scoreEl) scoreEl.classList.remove("score-reset");
      }, 900);

      setTimeout(() => {
        this.sequenceRunning = false;
        this.reset();
      }, 2000);
    }, 300);
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  ensurePlayable() {
    let guard = 0;

    while (!this.hasPossibleMove() && guard < 5) {
      const row = Math.floor(Math.random() * this.SIZE);

      for (let x = 0; x < this.SIZE; x++) {
        this.spawnDebris(x, row, "#ffffff", 2);
        this.cells[row][x] = 0;
      }

      this.lineFlashes.push({ type: "row", index: row, start: this.gameNow });

      guard++;
    }

    if (!this.hasPossibleMove()) {
      const maxPath = this.largestPathLength();

      this.requiredBlocks = Math.max(1, Math.min(this.requiredBlocks, maxPath));
      this.updateHUD();
    }
  },

  revive() {
    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] === 3) {
          this.cells[y][x] = 0;
          this.spawnParticles(x, y, 6, Theme.current.light);
          this.spawnDebris(x, y, Theme.current.dark, 2);
        }
      }
    }

    this.ensurePlayable();

    this.gameOver = false;
    this.freezeFx = null;
    this.freezeDelays = {};
    this.turnsSinceObstacle = 0;
    this.timeScale = 0.5;

    const overlay = document.getElementById("gameOverOverlay");
    if (overlay) overlay.classList.add("hidden");

    GameAudio.playClear(2);

    this.updateHUD();
    this.checkGameOver();
  },

  updateHUD() {
    this.renderAvailableBlocks();
  },

  renderAvailableBlocks() {
    const remaining = Math.max(0, this.requiredBlocks - this.path.length);

    const countEl = document.getElementById("availableCount");
    const pillEl = document.getElementById("availablePill");

    if (!countEl || !pillEl) return;

    const previous = countEl.textContent;

    countEl.textContent = remaining;

    if (this.turnColor) {
      pillEl.style.backgroundColor = this.turnColor.base;
    }

    if (String(remaining) !== previous) {
      pillEl.classList.remove("bump");
      void pillEl.offsetWidth;
      pillEl.classList.add("bump");
    }
  },

  spawnParticles(cellX, cellY, amount, forcedColor) {
    const cellSize = this.getCellSize();
    const cx = this.getCellCenterX(cellX);
    const cy = this.getCellCenterY(cellY);

    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cellSize * (0.05 + Math.random() * 0.14);
      const big = Math.random() > 0.72;

      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cellSize * 0.03,
        size: cellSize * (big ? 0.07 + Math.random() * 0.04 : 0.03 + Math.random() * 0.04),
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.12,
        shape: Math.random() > 0.6 ? "diamond" : "circle",
        glow: big,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        color: forcedColor || (Math.random() > 0.45 ? "#ffffff" : Theme.current.light)
      });
    }
  },

  spawnDebris(cellX, cellY, color, amount) {
    const cellSize = this.getCellSize();
    const cx = this.getCellCenterX(cellX);
    const cy = this.getCellCenterY(cellY);

    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cellSize * (0.06 + Math.random() * 0.16);

      this.debris.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cellSize * 0.04,
        size: cellSize * (0.08 + Math.random() * 0.10),
        stretch: 0.55 + Math.random() * 0.8,
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.24,
        life: 1,
        decay: 0.016 + Math.random() * 0.02,
        color
      });
    }
  },

  spawnShockwave(x, y, maxRadius, color) {
    this.shockwaves.push({
      x,
      y,
      start: this.gameNow,
      maxRadius,
      color: color || "#ffffff"
    });
  },

  getCellSize() {
    return this.canvas.width / this.SIZE;
  },

  getCellCenterX(x) {
    return x * this.getCellSize() + this.getCellSize() / 2;
  },

  getCellCenterY(y) {
    return y * this.getCellSize() + this.getCellSize() / 2;
  },

  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;

    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  },

  roundRectPath(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  },

  drawGlow(x, y, radius, rgb, alpha) {
    const ctx = this.ctx;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.getGlowSprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  },

  draw() {
    const ctx = this.ctx;
    const now = this.gameNow;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.buildFrameGradients();

    this.drawAmbientLight();
    this.drawBoard();
    this.drawCells();
    this.drawDestroyAnims(now);
    this.drawCellFlashes(now);
    this.drawLineFlashes(now);
    this.drawLineBeams(now);
    this.drawLightWave(now);
    this.drawShockwaves(now);
    this.drawCancelAnims(now);
    this.drawFloatingTexts(now);
    this.drawParticles();
    this.drawDebris();
    this.drawPointerLight();

    if (Tutorial.active) {
      Tutorial.drawOnCanvas(ctx, now);
    }
  },

  drawAmbientLight() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this.gameNow / 1000;

    this.drawGlow(
      w * 0.5 + Math.sin(t * 0.5) * w * 0.28,
      h * 0.28 + Math.cos(t * 0.35) * h * 0.16,
      w * 0.55,
      Theme.rgb(Theme.current.light),
      0.06
    );

    this.drawGlow(
      w * 0.5 + Math.cos(t * 0.42) * w * 0.3,
      h * 0.75 + Math.sin(t * 0.5) * h * 0.14,
      w * 0.5,
      "255,255,255",
      0.04
    );
  },

  drawPointerLight() {
    if (!this.pointer.active || this.gameOver) return;

    this.drawGlow(
      this.pointer.x,
      this.pointer.y,
      this.getCellSize() * 2.4,
      "255,255,255",
      0.12
    );
  },

  drawBoard() {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const pad = cellSize * 0.02;
    const box = cellSize - pad * 2;
    const r = cellSize * 0.26;

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        const px = x * cellSize;
        const py = y * cellSize;

        ctx.save();

        ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
        this.roundRectPath(px + pad, py + pad, box, box, r);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = Math.max(1, cellSize * 0.012);
        this.roundRectPath(px + pad, py + pad, box, box, r);
        ctx.stroke();

        ctx.restore();
      }
    }
  },

  getColorFxState(x, y, now) {
    if (!this.colorFx) return null;

    const age = now - this.colorFx.start;

    if (age > this.colorFx.duration) {
      this.colorFx = null;
      return null;
    }

    const ring = Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5));
    const wave = (age / this.colorFx.duration) * 6.5;

    const pulse = 1 + 0.05 * Math.sin(age / 42 + ring * 1.3);

    const d = wave - ring;
    let glow = 0;

    if (d > -0.9 && d < 1.7) {
      glow = 0.6 * Math.max(0, 1 - Math.abs(d - 0.4) / 1.3);
    }

    return { pulse, glow };
  },

  getFreezeState(x, y, now) {
    if (!this.freezeFx) return 0;

    const delay = this.freezeDelays[`${x},${y}`] ?? 0;
    const ft = now - (this.freezeFx.start + delay);

    if (ft <= 0) return 0;

    return Math.min(1, ft / 220);
  },

  getShakeOffset(x, y, now) {
    if (!this.blockShake) return 0;

    const age = now - this.blockShake.start;

    if (age > this.blockShake.duration) {
      this.blockShake = null;
      return 0;
    }

    const power = Math.pow(1 - age / this.blockShake.duration, 2);
    const phase = (x * 13 + y * 7) * 40;

    return Math.sin((now + phase) / 26) * this.getCellSize() * 0.07 * power;
  },

  getAfterGlowAlpha(x, y, now) {
    if (!this.afterGlow) return 0;

    const age = now - this.afterGlow.start;

    if (age > this.afterGlow.duration) {
      this.afterGlow = null;
      return 0;
    }

    const level = this.afterGlow.level;
    const fade = 1 - age / this.afterGlow.duration;
    const speed = 150 - level * 22;
    const phase = (x * 7 + y * 13) * 0.7;

    const flicker = (Math.sin(now / speed + phase) + 1) / 2;

    return (0.06 + level * 0.05) * flicker * fade;
  },

  getIdleBreath(x, y, value, now) {
    if (value !== 2) return 1;

    const phase = (x * 12.9 + y * 7.3) % (Math.PI * 2);
    const period = 2800 + ((x * 3 + y * 5) % 5) * 140;

    return 1 + Math.sin(now / period + phase) * 0.014;
  },

  drawCells() {
    const cellSize = this.getCellSize();
    const now = this.gameNow;

    const keys = Object.keys(this.cellAnims);

    for (const key of keys) {
      const anim = this.cellAnims[key];
      const duration = anim.type === "spawn" ? 420 : 260;

      if (now - anim.start > duration) {
        delete this.cellAnims[key];
      }
    }

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        const value = this.cells[y][x];

        if (value === 0) continue;

        const shake = this.getShakeOffset(x, y, now);
        const anim = this.cellAnims[`${x},${y}`];
        let scale = 1;
        let alpha = 1;
        let glow = 0;

        if (anim) {
          const age = Math.min(1, (now - anim.start) / (anim.type === "spawn" ? 420 : 260));

          if (anim.type === "spawn") {
            scale = this.easeOutBack(age);
          } else if (anim.type === "place") {
            scale = 0.7 + 0.3 * this.easeOutBack(age);
          } else if (anim.type === "validate") {
            scale = 1 + 0.16 * Math.sin(age * Math.PI);
          }
        }

        if (value === 1) alpha = 0.55;

        const fx = this.getColorFxState(x, y, now);

        if (fx) {
          scale *= fx.pulse;
          glow = fx.glow;
        }

        scale *= this.getIdleBreath(x, y, value, now);

        this.drawCellAt(x, y, value, scale, alpha, shake);

        const ctx = this.ctx;
        const px = x * cellSize + shake;
        const py = y * cellSize;
        const pad = cellSize * 0.02;
        const box = cellSize - pad * 2;
        const r = cellSize * 0.26;
        const center = cellSize / 2;

        if (glow > 0) {
          ctx.save();
          ctx.globalAlpha = glow;
          ctx.translate(px + center, py + center);
          ctx.scale(scale, scale);
          ctx.translate(-center, -center);
          ctx.fillStyle = "#ffffff";
          this.roundRectPath(pad, pad, box, box, r);
          ctx.fill();
          ctx.restore();
        }

        const ice = this.getFreezeState(x, y, now);

        if (ice > 0) {
          const iceScale = 1 + 0.12 * Math.sin(ice * Math.PI);
          const iceImg = this.blockImages.ice;

          ctx.save();
          ctx.globalAlpha = ice * 0.92;

          ctx.translate(px + center, py + center);
          ctx.scale(iceScale, iceScale);
          ctx.translate(-center, -center);

          if (iceImg && iceImg.complete && iceImg.naturalWidth) {
            ctx.drawImage(iceImg, pad, pad, box, box);
          } else {
            ctx.fillStyle = this.frameGradients.ice;
            this.roundRectPath(pad, pad, box, box, r);
            ctx.fill();
          }

          ctx.restore();
        }

        const after = this.getAfterGlowAlpha(x, y, now);

        if (after > 0) {
          ctx.save();
          ctx.globalAlpha = after;
          ctx.translate(px + center, py + center);
          ctx.translate(-center, -center);
          ctx.fillStyle = "#ffffff";
          this.roundRectPath(pad, pad, box, box, r);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  },

  getStoneSeed(x, y) {
    const key = `${x},${y}`;

    if (this.stoneSeeds[key] === undefined) {
      this.stoneSeeds[key] = Math.random() * 1000;
    }

    return this.stoneSeeds[key];
  },

  getStoneJitter(x, y, now) {
    const seed = this.getStoneSeed(x, y);
    const cellSize = this.getCellSize();

    // Tremblement irrégulier : courte secousse rapide, puis pause aléatoire
    // (durée de cycle et déphasage propres à chaque bloc).
    const cycleLength = 1400 + (seed % 1700);
    const burstLength = 220;
    const t = (now + seed * 137) % cycleLength;

    if (t > burstLength) return { x: 0, y: 0 };

    const intensity = 1 - t / burstLength;

    const jx = Math.sin(t / 26 + seed * 3.1) * cellSize * 0.022 * intensity;
    const jy = Math.cos(t / 21 + seed * 4.7) * cellSize * 0.02 * intensity;

    return { x: jx, y: jy };
  },

  getCellImage(x, y, value) {
    if (value === 3) return this.blockImages.stone;

    const name = this.cellColors[`${x},${y}`];
    const entry = this.getBankColor(name);

    return this.blockImages[entry.name];
  },

  drawCellAt(x, y, value, scale, alpha, shakeX = 0) {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    let jitterX = 0;
    let jitterY = 0;

    if (value === 3) {
      const jitter = this.getStoneJitter(x, y, this.gameNow);
      jitterX = jitter.x;
      jitterY = jitter.y;
    }

    const px = x * cellSize + shakeX + jitterX;
    const py = y * cellSize + jitterY;
    const pad = cellSize * 0.02;
    const box = cellSize - pad * 2;
    const center = cellSize / 2;

    const img = this.getCellImage(x, y, value);

    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.translate(px + center, py + center);
    ctx.scale(scale, scale);
    ctx.translate(-center, -center);

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, pad, pad, box, box);
    } else {
      // Filet de sécurité tant que l'image charge encore
      const fallback = value === 3 ? this.STONE_COLOR : this.getBankColor(this.cellColors[`${x},${y}`]);
      this.roundRectPath(pad, pad, box, box, cellSize * 0.22);
      ctx.fillStyle = fallback.base;
      ctx.fill();
    }

    ctx.restore();
  },



  drawDestroyAnims(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();
    const DURATION = 380;
    const RECOLOR_END = 0.4;

    this.destroyAnims = this.destroyAnims.filter(a => now >= a.start && now - a.start < DURATION);

    const pad = cellSize * 0.02;
    const box = cellSize - pad * 2;
    const center = cellSize / 2;

    for (const a of this.destroyAnims) {
      const t = (now - a.start) / DURATION;
      const power = Math.min(5, a.power || 1);
      const boost = 1 + power * 0.09;

      const colorT = Math.min(1, t / RECOLOR_END);

      const popT = Math.max(0, (t - RECOLOR_END) / (1 - RECOLOR_END));

      const grow = t < RECOLOR_END
        ? 1 + 0.06 * Math.sin(colorT * Math.PI)
        : 1.3 * boost * (1 - popT);

      const alpha = t < RECOLOR_END ? 1 : 1 - popT;
      const rot = (popT * (0.5 + power * 0.12)) * (((a.x + a.y) % 2 === 0) ? 1 : -1);

      const px = a.x * cellSize;
      const py = a.y * cellSize;

      ctx.save();

      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(px + center, py + center);
      ctx.rotate(rot);
      ctx.scale(Math.max(0.01, grow), Math.max(0.01, grow));
      ctx.translate(-center, -center);

      const fromImg = a.fromName ? this.blockImages[a.fromName] : null;
      const toImg = a.toName ? this.blockImages[a.toName] : null;

      if (fromImg && fromImg.complete && colorT < 1) {
        ctx.drawImage(fromImg, pad, pad, box, box);
      }

      if (toImg && toImg.complete) {
        const baseAlpha = ctx.globalAlpha;
        ctx.globalAlpha = baseAlpha * colorT;
        ctx.drawImage(toImg, pad, pad, box, box);
        ctx.globalAlpha = baseAlpha;
      } else if (!fromImg || !fromImg.complete) {
        this.roundRectPath(pad, pad, box, box, cellSize * 0.22);
        ctx.fillStyle = a.toColor || "#ffffff";
        ctx.fill();
      }

      ctx.restore();
    }
  },

  drawCellFlashes(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.cellFlashes = this.cellFlashes.filter(item => now >= item.start && now - item.start < 380);

    const pad = cellSize * 0.02;
    const box = cellSize - pad * 2;
    const r = cellSize * 0.26;
    const center = cellSize / 2;

    for (const flash of this.cellFlashes) {
      const t = (now - flash.start) / 380;
      const power = Math.min(5, flash.power || 1);
      const alpha = Math.sin(Math.PI * t) * (0.85 + power * 0.06);

      const px = flash.x * cellSize;
      const py = flash.y * cellSize;

      ctx.save();

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.35;
      ctx.translate(px + center, py + center);
      ctx.scale(1.25 + 0.15 * t, 1.25 + 0.15 * t);
      ctx.translate(-center, -center);
      ctx.fillStyle = flash.color || "#ffffff";
      this.roundRectPath(pad, pad, box, box, r);
      ctx.fill();

      ctx.restore();

      ctx.save();

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.translate(px + center, py + center);
      ctx.scale(1 + 0.3 * t, 1 + 0.3 * t);
      ctx.translate(-center, -center);
      ctx.fillStyle = "#ffffff";
      this.roundRectPath(pad, pad, box, box, r);
      ctx.fill();

      ctx.restore();
    }
  },

  drawFloatingTexts(now) {
    const ctx = this.ctx;

    this.floatingTexts = this.floatingTexts.filter(item => now - item.start < 1000);

    for (const item of this.floatingTexts) {
      const age = now - item.start;
      const t = age / 1000;

      const scale = this.easeOutBack(Math.min(1, age / 220));
      const y = item.y - t * this.getCellSize() * 0.8;
      const alpha = 1 - Math.max(0, (age - 600) / 400);

      ctx.save();

      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(item.x, y);
      ctx.scale(scale, scale);

      ctx.font = `900 ${Math.floor(this.getCellSize() * 0.55)}px "Baloo 2", Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillText(item.text, 0, 4);

      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      ctx.restore();
    }
  },

  drawLightWave(now) {
    if (!this.lightWave) return;

    const age = now - this.lightWave.start;
    const duration = 900;

    if (age > duration) {
      this.lightWave = null;
      return;
    }

    const p = age / duration;
    const level = this.lightWave.level;

    const maxR = this.canvas.width * (0.55 + level * 0.25);
    const size = p * maxR;
    const thickness = this.getCellSize() * (0.25 + level * 0.12);
    const alpha = (0.3 + level * 0.1) * (1 - p * 0.6);

    const ctx = this.ctx;

    ctx.save();

    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
    ctx.lineWidth = thickness * 1.8;
    this.roundRectPath(
      this.canvas.width / 2 - size,
      this.canvas.height / 2 - size,
      size * 2,
      size * 2,
      30
    );
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = thickness;
    this.roundRectPath(
      this.canvas.width / 2 - size,
      this.canvas.height / 2 - size,
      size * 2,
      size * 2,
      30
    );
    ctx.stroke();

    ctx.restore();
  },

  drawLineFlashes(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.lineFlashes = this.lineFlashes.filter(item => now - item.start < 380);

    for (const flash of this.lineFlashes) {
      const power = Math.min(5, flash.power || 1);
      const age = (now - flash.start) / 380;
      const flare = Math.max(0, 1 - age * 3.2);
      const alpha = (0.22 + power * 0.05) * (1 - age) + flare * 0.4;
      const rgb = this.hexToRgb(flash.color || "#ffffff");

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

      if (flash.type === "row") {
        ctx.fillRect(0, flash.index * cellSize, this.canvas.width, cellSize);
      } else {
        ctx.fillRect(flash.index * cellSize, 0, cellSize, this.canvas.height);
      }

      ctx.restore();
    }
  },

  drawLineBeams(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.lineBeams = this.lineBeams.filter(item => now - item.start < 620);

    for (const beam of this.lineBeams) {
      const age = (now - beam.start) / 620;
      const progress = this.easeOutCubic(Math.min(1, age));

      const power = Math.min(5, beam.power);
      const trail = cellSize * (1 + power * 0.6);
      const thickness = cellSize * (0.22 + power * 0.08);
      const alpha = Math.min(0.85, 0.3 + power * 0.12) * (1 - age * 0.6);
      const rgb = this.hexToRgb(beam.color || "#ffffff");
      const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (beam.type === "row") {
        const y = beam.index * cellSize + cellSize / 2;
        const head = -trail + (this.canvas.width + trail * 2) * progress;

        const gradient = ctx.createLinearGradient(head - trail, 0, head, 0);
        gradient.addColorStop(0, `rgba(${rgbStr}, 0)`);
        gradient.addColorStop(1, `rgba(${rgbStr}, ${alpha})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(head - trail, y - thickness / 2, trail, thickness);

        if (power >= 3) {
          ctx.fillStyle = `rgba(${rgbStr}, ${alpha * 0.4})`;
          ctx.fillRect(head - trail, y - thickness, trail, thickness * 2);
        }
      } else {
        const x = beam.index * cellSize + cellSize / 2;
        const head = -trail + (this.canvas.height + trail * 2) * progress;

        const gradient = ctx.createLinearGradient(0, head - trail, 0, head);
        gradient.addColorStop(0, `rgba(${rgbStr}, 0)`);
        gradient.addColorStop(1, `rgba(${rgbStr}, ${alpha})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x - thickness / 2, head - trail, thickness, trail);

        if (power >= 3) {
          ctx.fillStyle = `rgba(${rgbStr}, ${alpha * 0.4})`;
          ctx.fillRect(x - thickness, head - trail, thickness * 2, trail);
        }
      }

      ctx.restore();
    }
  },

  drawShockwaves(now) {
    const ctx = this.ctx;

    this.shockwaves = this.shockwaves.filter(item => now - item.start < 460);

    for (const wave of this.shockwaves) {
      const age = (now - wave.start) / 460;
      const radius = wave.maxRadius * age;
      const alpha = 0.32 * (1 - age);
      const rgb = this.hexToRgb(wave.color || "#ffffff");

      ctx.save();

      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      ctx.lineWidth = Math.max(1, this.getCellSize() * 0.05 * (1 - age));

      ctx.beginPath();
      ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  },

  drawCancelAnims(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.cancelAnims = this.cancelAnims.filter(item => now - item.start < 260);

    const pad = cellSize * 0.02;
    const box = cellSize - pad * 2;
    const r = cellSize * 0.26;
    const center = cellSize / 2;

    for (const anim of this.cancelAnims) {
      const age = (now - anim.start) / 260;
      const scale = 1 - age * 0.45;
      const alpha = 0.5 * (1 - age);

      const px = anim.x * cellSize;
      const py = anim.y * cellSize;

      ctx.save();

      ctx.globalAlpha = alpha;

      ctx.translate(px + center, py + center);
      ctx.scale(scale, scale);
      ctx.translate(-center, -center);

      ctx.fillStyle = "#ef4444";
      this.roundRectPath(pad, pad, box, box, r);
      ctx.fill();

      ctx.restore();
    }
  },

  drawParticles() {
    const ctx = this.ctx;

    this.particles = this.particles.filter(p => p.life > 0);

    for (const p of this.particles) {
      p.x += p.vx * this.timeScale;
      p.y += p.vy * this.timeScale;
      p.vx *= Math.pow(0.985, this.timeScale);
      p.vy += this.getCellSize() * 0.004 * this.timeScale;
      p.rotation += (p.vr || 0) * this.timeScale;
      p.life -= p.decay * this.timeScale;

      if (p.life <= 0) continue;

      ctx.save();

      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;

      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2.2;
      }

      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);

      if (p.shape === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  },

  drawDebris() {
    const ctx = this.ctx;

    this.debris = this.debris.filter(p => p.life > 0);

    for (const p of this.debris) {
      p.x += p.vx * this.timeScale;
      p.y += p.vy * this.timeScale;
      p.vx *= Math.pow(0.98, this.timeScale);
      p.vy += this.getCellSize() * 0.005 * this.timeScale;
      p.rotation += p.vr * this.timeScale;
      p.life -= p.decay * this.timeScale;

      if (p.life <= 0) continue;

      ctx.save();

      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 0.8;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      const size = p.size;
      const stretch = p.stretch || 1;
      ctx.fillRect((-size / 2) * stretch, -size / 2, size * stretch, size);

      ctx.restore();
    }
  },

  invalidFeedback(x, y) {
    const now = performance.now();
    const key = `${x},${y}`;

    if (this.lastInvalidKey === key && now - this.lastInvalidTime < 250) {
      return;
    }

    this.lastInvalidKey = key;
    this.lastInvalidTime = now;

    this.spawnDebris(x, y, "#ef4444", 1);

    GameAudio.playError();
    Haptics.vibrate(30);
  }
};
