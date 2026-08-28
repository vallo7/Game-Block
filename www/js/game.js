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

  timeScale: 1,
  lastFrame: null,
  gameNow: 0,

  pointer: { x: 0, y: 0, active: false },

  countdown: 0,
  countdownTimer: null,
  gameOverTimeout: null,

  colorFx: null,
  lineBeams: [],

  cellAnims: {},
  cancelAnims: [],
  particles: [],
  debris: [],
  shockwaves: [],
  lineFlashes: [],

  lastInvalidKey: null,
  lastInvalidTime: 0,

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.best = Storage.getBest();
    this.displayedBest = this.best;

    const bestEl = document.getElementById("bestScoreValue");
    bestEl.textContent = this.best;

    this.bindEvents();
    this.resize();

    const tick = (now) => {
      const realDelta = Math.min(50, now - (this.lastFrame ?? now));
      this.lastFrame = now;

      this.timeScale += (1 - this.timeScale) * Math.min(1, realDelta / 260);
      this.gameNow += realDelta * this.timeScale;

      if (this.active) {
        this.update(realDelta);
        this.draw();
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
    this.clearGameOverTimeout();
    this.unlockUI();
    this.cancelPath(false);
  },

  clearGameOverTimeout() {
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
      this.gameOverTimeout = null;
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

    this.path = [];
    this.score = 0;
    this.displayedScore = 0;
    this.turn = 1;
    this.totalCleared = 0;
    this.turnsSinceObstacle = 0;

    this.combo = 0;
    this.comboUntil = 0;
    this.timeScale = 1;

    this.gameOver = false;
    this.drawing = false;
    this.strokeStarted = false;
    this.runActive = true;

    this.stopCountdown();
    this.clearGameOverTimeout();
    this.unlockUI();

    this.colorFx = null;
    this.lineBeams = [];
    this.cellAnims = {};
    this.cancelAnims = [];
    this.particles = [];
    this.debris = [];
    this.shockwaves = [];
    this.lineFlashes = [];

    this.queue = [];
    for (let i = 0; i < 3; i++) {
      this.queue.push(this.generateRequiredBlocks());
    }

    this.setupNextBlock();

    document.getElementById("gameOverOverlay").classList.add("hidden");
    document.getElementById("comboBadge").classList.add("hidden");
    document.getElementById("gameScreen").classList.remove("quake");

    document.getElementById("currentScore").textContent = "0";

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

    document.getElementById("gameoverHomeBtn").addEventListener("click", () => {
      GameAudio.playClick();

      setTimeout(() => {
        this.stopCountdown();
        App.showMenu();
      }, 200);
    });

    document.getElementById("adsBtn").addEventListener("click", () => {
      GameAudio.playClick();

      setTimeout(() => {
        this.stopCountdown();
        this.revive();
      }, 250);
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

  resize() {
    if (!this.canvas) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const rect = this.canvas.getBoundingClientRect();

    const size = Math.floor(rect.width * dpr);

    if (size > 0) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
  },

  ensureCanvasSize() {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const target = Math.floor(this.canvas.clientWidth * dpr);

    if (target > 0 && this.canvas.width !== target) {
      this.canvas.width = target;
      this.canvas.height = target;
    }
  },

  update(realDelta) {
    this.ensureCanvasSize();

    const scoreEl = document.getElementById("currentScore");

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

    const badge = document.getElementById("comboBadge");

    if (!badge.classList.contains("hidden") && this.gameNow > this.comboUntil) {
      badge.classList.add("hidden");
    }
  },

  getDifficulty() {
    const turnFactor = Math.min(1, Math.max(0, (this.turn - 1) / 45));
    const scoreFactor = Math.min(1, this.score / 8000);
    const fill = this.getFillRatio();
    const fillFactor = Math.min(1, Math.max(0, (fill - 0.35) / 0.4));

    return Math.min(1, turnFactor * 0.66 + scoreFactor * 0.24 + fillFactor * 0.2);
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

  generateRequiredBlocks() {
    const diff = this.getDifficulty();
    const fill = this.getFillRatio();

    const low = [6, 14, 22, 26, 20, 12];
    const high = [4, 8, 12, 20, 26, 30];

    const weights = low.map((value, index) => {
      return value + (high[index] - value) * diff;
    });

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
    if (this.queue.length < 3) {
      this.queue.push(this.generateRequiredBlocks());
    }

    this.requiredBlocks = this.queue.shift();
    this.queue.push(this.generateRequiredBlocks());

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
    const diff = this.getDifficulty();
    const interval = Math.max(2, 4 - Math.floor(diff * 2));

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

    this.turn += 1;
    this.turnsSinceObstacle += 1;

    const emptied = this.isGridEmpty();

    if (emptied) {
      this.registerCombo(8, true);
      this.celebrateEmptyGrid();
    } else {
      this.registerCombo(result ? result.count : 0, false);
    }

    this.maybeSpawnObstacles();
    this.setupNextBlock();
    this.checkGameOver();

    this.updateHUD();
  },

  celebrateEmptyGrid() {
    GameAudio.playColorShift();
    Haptics.vibrate(600);

    this.spawnShockwave(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.55
    );

    for (let i = 0; i < 6; i++) {
      const x = Math.floor(Math.random() * this.SIZE);
      const y = Math.floor(Math.random() * this.SIZE);
      this.spawnParticles(x, y, 6, "#faf3e1");
    }

    this.timeScale = 0.4;

    this.colorFx = {
      start: this.gameNow,
      duration: 900
    };

    Theme.shift(900);

    const screen = document.getElementById("gameScreen");
    screen.classList.remove("quake");
    void screen.offsetWidth;
    screen.classList.add("quake");

    setTimeout(() => {
      screen.classList.remove("quake");
    }, 900);

    const halo = document.getElementById("haloWave");
    halo.classList.remove("play");
    void halo.offsetWidth;
    halo.classList.add("play");
  },

  registerCombo(count, emptied) {
    const badge = document.getElementById("comboBadge");

    if (count <= 0 && !emptied) {
      this.combo = 0;
      badge.classList.add("hidden");
      return;
    }

    this.combo = emptied ? 8 : this.combo + 1;
    this.comboUntil = this.gameNow + 1800;

    if (this.combo >= 2) {
      badge.textContent = `COMBO x${this.combo}`;
      badge.classList.remove("hidden");
      badge.classList.remove("pop", "mega");
      void badge.offsetWidth;
      badge.classList.add(emptied ? "mega" : "pop");
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

    if (count === 0) return { count: 0, reward: 0 };

    const clearedKeys = new Set();

    for (const y of fullRows) {
      this.lineFlashes.push({ type: "row", index: y, start: this.gameNow });

      for (let x = 0; x < this.SIZE; x++) {
        clearedKeys.add(`${x},${y}`);
      }
    }

    for (const x of fullCols) {
      this.lineFlashes.push({ type: "col", index: x, start: this.gameNow });

      for (let y = 0; y < this.SIZE; y++) {
        clearedKeys.add(`${x},${y}`);
      }
    }

    if (count >= 2) {
      for (const y of fullRows) {
        this.lineBeams.push({ type: "row", index: y, start: this.gameNow, power: count });
      }

      for (const x of fullCols) {
        this.lineBeams.push({ type: "col", index: x, start: this.gameNow, power: count });
      }
    }

    for (const key of clearedKeys) {
      const [x, y] = key.split(",").map(Number);
      const value = this.cells[y][x];

      const color = value === 3 ? Theme.current.dark : "#faf3e1";

      this.spawnDebris(x, y, color, 3);
      this.spawnParticles(x, y, 8, null);
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

    let reward = count;
    let points = count * 100;

    const beforeBonus = Math.floor(this.totalCleared / 2);
    this.totalCleared += count;
    const afterBonus = Math.floor(this.totalCleared / 2);

    if (afterBonus > beforeBonus) {
      points += 200;
      reward += 1;
    }

    points += Math.max(0, this.combo) * 50;

    this.addScore(points);

    this.spawnShockwave(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * (count > 1 ? 0.4 : 0.25)
    );

    if (count > 1) {
      this.timeScale = 0.35;
    }

    GameAudio.playClear(count);

    const scoreEl = document.getElementById("currentScore");
    scoreEl.classList.remove("score-bump");
    void scoreEl.offsetWidth;
    scoreEl.classList.add("score-bump");

    return { count, reward };
  },

  addScore(points) {
    this.score += points;

    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveBest(this.best);

      const bestEl = document.getElementById("bestScoreValue");
      bestEl.classList.remove("score-bump");
      void bestEl.offsetWidth;
      bestEl.classList.add("score-bump");
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

    this.clearGameOverTimeout();

    this.gameOverTimeout = setTimeout(() => {
      this.gameOverTimeout = null;
      this.startGameOver();
    }, 3000);
  },

  startGameOver() {
    const overlay = document.getElementById("gameOverOverlay");
    const ring = document.getElementById("ringFg");
    const countdownEl = document.getElementById("countdownValue");

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
        this.stopCountdown();
        this.reset();
        return;
      }

      countdownEl.textContent = this.countdown;
      countdownEl.classList.remove("tick");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("tick");

      GameAudio.playCountdown();
    }, 1000);
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
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

    if (this.isGridFull()) {
      const rows = this.shuffleArray([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 2);

      for (const y of rows) {
        for (let x = 0; x < this.SIZE; x++) {
          this.spawnDebris(x, y, "#faf3e1", 2);
          this.cells[y][x] = 0;
        }

        this.lineFlashes.push({ type: "row", index: y, start: this.gameNow });
      }
    }

    this.gameOver = false;
    this.turnsSinceObstacle = 0;
    this.timeScale = 0.5;

    document.getElementById("gameOverOverlay").classList.add("hidden");

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

    const previous = countEl.textContent;

    countEl.textContent = remaining;

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

      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cellSize * 0.03,
        size: cellSize * (0.03 + Math.random() * 0.05),
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        color: forcedColor || (Math.random() > 0.45 ? "#faf3e1" : Theme.current.light)
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
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.24,
        life: 1,
        decay: 0.016 + Math.random() * 0.02,
        color
      });
    }
  },

  spawnShockwave(x, y, maxRadius) {
    this.shockwaves.push({
      x,
      y,
      start: this.gameNow,
      maxRadius
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

    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, radius);
    this.ctx.arcTo(x + w, y + h, x, y + h, radius);
    this.ctx.arcTo(x, y + h, x, y, radius);
    this.ctx.arcTo(x, y, x + w, y, radius);
    this.ctx.closePath();
  },

  drawGlow(x, y, radius, rgb, alpha) {
    const ctx = this.ctx;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  },

  draw() {
    const ctx = this.ctx;
    const now = this.gameNow;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawAmbientLight();
    this.drawBoard();
    this.drawPathLine();
    this.drawCells();
    this.drawLineFlashes(now);
    this.drawLineBeams(now);
    this.drawShockwaves(now);
    this.drawCancelAnims(now);
    this.drawParticles();
    this.drawDebris();
    this.drawPointerLight();
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
      "250,243,225",
      0.04
    );
  },

  drawPointerLight() {
    if (!this.pointer.active || this.gameOver) return;

    this.drawGlow(
      this.pointer.x,
      this.pointer.y,
      this.getCellSize() * 2.4,
      "250,243,225",
      0.12
    );
  },

  drawBoard() {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        const px = x * cellSize;
        const py = y * cellSize;
        const pad = cellSize * 0.035;
        const box = cellSize - pad * 2;
        const radius = cellSize * 0.16;

        ctx.save();

        ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
        this.roundRectPath(px + pad, py + pad, box, box, radius);
        ctx.fill();

        ctx.strokeStyle = "rgba(250, 243, 225, 0.07)";
        ctx.lineWidth = Math.max(1, cellSize * 0.012);
        this.roundRectPath(px + pad, py + pad, box, box, radius);
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

    if (d > -0.6 && d < 1.4) {
      glow = 0.4 * Math.max(0, 1 - Math.abs(d - 0.4) / 1);
    }

    return { pulse, glow };
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

        this.drawCellAt(x, y, value, scale, alpha);

        if (glow > 0) {
          const px = x * cellSize;
          const py = y * cellSize;
          const pad = cellSize * 0.035;
          const box = cellSize - pad * 2;
          const radius = cellSize * 0.16;

          this.ctx.save();
          this.ctx.globalAlpha = glow;
          this.ctx.fillStyle = "#faf3e1";
          this.roundRectPath(px + pad, py + pad, box, box, radius);
          this.ctx.fill();
          this.ctx.restore();
        }
      }
    }
  },

  drawCellAt(x, y, value, scale, alpha) {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    const px = x * cellSize;
    const py = y * cellSize;
    const pad = cellSize * 0.035;
    const box = cellSize - pad * 2;
    const radius = cellSize * 0.16;
    const center = cellSize / 2;

    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.translate(px + center, py + center);
    ctx.scale(scale, scale);
    ctx.translate(-(px + center), -(py + center));

    if (value === 1) {
      ctx.shadowColor = "rgba(250, 243, 225, 0.35)";
      ctx.shadowBlur = cellSize * 0.12;

      const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
      gradient.addColorStop(0, "#faf3e1");
      gradient.addColorStop(1, "#e3d5b8");

      ctx.fillStyle = gradient;
    } else if (value === 2) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = cellSize * 0.12;

      const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
      gradient.addColorStop(0, "#faf3e1");
      gradient.addColorStop(1, "#e0d2b4");

      ctx.fillStyle = gradient;
    } else {
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = cellSize * 0.1;

      const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
      gradient.addColorStop(0, Theme.current.light);
      gradient.addColorStop(1, Theme.current.dark);

      ctx.fillStyle = gradient;
    }

    this.roundRectPath(px + pad, py + pad, box, box, radius);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(250, 243, 225, 0.4)";
    this.roundRectPath(
      px + pad + box * 0.10,
      py + pad + box * 0.08,
      box * 0.80,
      box * 0.20,
      radius * 0.7
    );
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    this.roundRectPath(
      px + pad + box * 0.10,
      py + pad + box * 0.74,
      box * 0.80,
      box * 0.16,
      radius * 0.7
    );
    ctx.fill();

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

  drawLineFlashes(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.lineFlashes = this.lineFlashes.filter(item => now - item.start < 340);

    for (const flash of this.lineFlashes) {
      const age = (now - flash.start) / 340;
      const alpha = 0.28 * (1 - age);

      ctx.save();

      ctx.fillStyle = `rgba(250, 243, 225, ${alpha})`;

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

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (beam.type === "row") {
        const y = beam.index * cellSize + cellSize / 2;
        const head = -trail + (this.canvas.width + trail * 2) * progress;

        const gradient = ctx.createLinearGradient(head - trail, 0, head, 0);
        gradient.addColorStop(0, "rgba(250, 243, 225, 0)");
        gradient.addColorStop(1, `rgba(250, 243, 225, ${alpha})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(head - trail, y - thickness / 2, trail, thickness);

        if (power >= 3) {
          ctx.fillStyle = `rgba(250, 243, 225, ${alpha * 0.4})`;
          ctx.fillRect(head - trail, y - thickness, trail, thickness * 2);
        }
      } else {
        const x = beam.index * cellSize + cellSize / 2;
        const head = -trail + (this.canvas.height + trail * 2) * progress;

        const gradient = ctx.createLinearGradient(0, head - trail, 0, head);
        gradient.addColorStop(0, "rgba(250, 243, 225, 0)");
        gradient.addColorStop(1, `rgba(250, 243, 225, ${alpha})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x - thickness / 2, head - trail, thickness, trail);

        if (power >= 3) {
          ctx.fillStyle = `rgba(250, 243, 225, ${alpha * 0.4})`;
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

      ctx.save();

      ctx.strokeStyle = `rgba(250, 243, 225, ${alpha})`;
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

    for (const anim of this.cancelAnims) {
      const age = (now - anim.start) / 260;
      const scale = 1 - age * 0.45;
      const alpha = 0.5 * (1 - age);

      const px = anim.x * cellSize;
      const py = anim.y * cellSize;
      const pad = cellSize * 0.035;
      const box = cellSize - pad * 2;
      const radius = cellSize * 0.16;
      const center = cellSize / 2;

      ctx.save();

      ctx.globalAlpha = alpha;

      ctx.translate(px + center, py + center);
      ctx.scale(scale, scale);
      ctx.translate(-(px + center), -(py + center));

      ctx.fillStyle = "#ef4444";
      this.roundRectPath(px + pad, py + pad, box, box, radius);
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
