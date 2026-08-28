const Game = {
  SIZE: 8,

  canvas: null,
  ctx: null,

  active: false,
  gameOver: false,
  drawing: false,
  strokeStarted: false,

  cells: [],
  path: [],

  score: 0,
  best: 0,
  turn: 1,
  totalCleared: 0,

  requiredBlocks: 3,
  queue: [],
  turnsSinceObstacle: 0,

  previousScore: -1,
  previousRemaining: -1,
  previousRequired: -1,

  popAnims: [],
  invalidFlashes: [],
  particles: [],
  clearFlashes: [],
  debris: [],
  shockwaves: [],

  lastInvalidKey: null,
  lastInvalidTime: 0,

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.best = Storage.getBest();

    this.bindEvents();
    this.resize();

    const tick = (now) => {
      if (this.active) {
        this.draw(now);
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  },

  start() {
    this.active = true;
    this.reset();

    requestAnimationFrame(() => {
      this.resize();
    });
  },

  stop() {
    this.active = false;
    this.cancelPath(false);
  },

  reset() {
    this.cells = Array.from({ length: this.SIZE }, () => Array(this.SIZE).fill(0));

    this.path = [];
    this.score = 0;
    this.turn = 1;
    this.totalCleared = 0;
    this.turnsSinceObstacle = 0;

    this.gameOver = false;
    this.drawing = false;
    this.strokeStarted = false;

    this.popAnims = [];
    this.invalidFlashes = [];
    this.particles = [];
    this.clearFlashes = [];
    this.debris = [];
    this.shockwaves = [];

    this.previousScore = -1;
    this.previousRemaining = -1;
    this.previousRequired = -1;

    this.queue = [];
    for (let i = 0; i < 3; i++) {
      this.queue.push(this.generateRequiredBlocks());
    }

    this.setupNextBlock();

    document.getElementById("gameOverOverlay").classList.add("hidden");

    this.updateHUD();
  },

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (!this.active || this.gameOver) return;

      event.preventDefault();

      GameAudio.unlock();

      this.canvas.setPointerCapture(event.pointerId);

      const cell = this.getCellFromEvent(event);
      if (!cell) return;

      this.drawing = true;
      this.strokeStarted = this.tryStart(cell);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.active || !this.drawing || !this.strokeStarted || this.gameOver) return;

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

      if (this.gameOver) return;

      if (this.path.length === this.requiredBlocks) {
        this.validate();
      } else {
        this.cancelIncomplete();
      }
    });

    this.canvas.addEventListener("pointercancel", () => {
      if (!this.active) return;
      this.cancelPath(false);
    });

    document.getElementById("restartBtn").addEventListener("click", () => {
      GameAudio.unlock();
      GameAudio.playClick();
      Haptics.vibrate(10);
      this.reset();
    });

    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.resize(), 120);
    });
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

  getDifficulty() {
    const turnFactor = Math.min(1, Math.max(0, (this.turn - 1) / 70));
    const scoreFactor = Math.min(1, this.score / 12000);
    const fill = this.getFillRatio();
    const fillFactor = Math.min(1, Math.max(0, (fill - 0.45) / 0.4));

    return Math.min(1, turnFactor * 0.62 + scoreFactor * 0.24 + fillFactor * 0.14);
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

  generateRequiredBlocks() {
    const diff = this.getDifficulty();
    const fill = this.getFillRatio();

    const low = [10, 18, 24, 24, 16, 8];
    const high = [6, 10, 16, 22, 24, 22];

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
      if (random < weights[i]) {
        return i + 1;
      }

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

  maybeSpawnObstacles() {
    const diff = this.getDifficulty();
    const interval = Math.max(3, 5 - Math.floor(diff * 2));

    if (this.turnsSinceObstacle < interval) return;

    this.turnsSinceObstacle = 0;

    const fill = this.getFillRatio();

    let count = 1 + Math.round(diff * 2);

    if (fill > 0.78) {
      count = Math.max(1, count - 1);
    }

    if (fill < 0.22) {
      count = Math.min(4, count + 1);
    }

    const cells = this.chooseObstacleCells(count);

    cells.forEach(cell => {
      this.cells[cell.y][cell.x] = 3;

      this.popAnims.push({
        x: cell.x,
        y: cell.y,
        start: performance.now(),
        rgb: "148,163,184"
      });
    });
  },

  chooseObstacleCells(count) {
    const chosen = [];
    const keys = new Set();

    const add = (cell) => {
      if (!cell) return;

      const key = `${cell.x},${cell.y}`;

      if (this.cells[cell.y][cell.x] === 0 && !keys.has(key)) {
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
        if (this.cells[y][x] === 0) {
          emptyCells.push({ x, y });
        }
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
      const neighbor = {
        x: anchor.x + dir.x,
        y: anchor.y + dir.y
      };

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
      const a = {
        x: anchor.x + pattern[0].x,
        y: anchor.y + pattern[0].y
      };

      const b = {
        x: anchor.x + pattern[1].x,
        y: anchor.y + pattern[1].y
      };

      const valid = [a, b].every(cell => {
        return (
          cell.x >= 0 &&
          cell.x < this.SIZE &&
          cell.y >= 0 &&
          cell.y < this.SIZE &&
          this.cells[cell.y][cell.x] === 0
        );
      });

      if (valid) {
        return [anchor, a, b];
      }
    }

    return [];
  },

  getCellFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();

    const x = Math.floor(((event.clientX - rect.left) / rect.width) * this.SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * this.SIZE);

    if (x < 0 || x >= this.SIZE || y < 0 || y >= this.SIZE) {
      return null;
    }

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
    } else {
      if (this.cells[cell.y][cell.x] === 0) {
        this.invalidFeedback(cell.x, cell.y);
      }
    }
  },

  addCell(x, y) {
    this.cells[y][x] = 1;
    this.path.push({ x, y });

    this.popAnims.push({
      x,
      y,
      start: performance.now(),
      rgb: "34,197,94"
    });

    GameAudio.playAdd(this.path.length);
    Haptics.vibrate(6);

    if (this.path.length === this.requiredBlocks) {
      Haptics.vibrate(10);
    }

    this.updateHUD();
  },

  backtrackTo(index) {
    const removed = this.path.splice(index + 1);

    if (removed.length === 0) return;

    removed.forEach(cell => {
      this.cells[cell.y][cell.x] = 0;
    });

    GameAudio.playBack();
    Haptics.vibrate(4);

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
      Haptics.vibrate([12, 18, 12]);
    }

    this.updateHUD();
  },

  cancelIncomplete() {
    if (this.path.length === 0) return;

    const now = performance.now();
    const cancelledCells = [...this.path];

    cancelledCells.forEach(cell => {
      this.popAnims.push({
        x: cell.x,
        y: cell.y,
        start: now,
        rgb: "239,68,68"
      });

      this.spawnDebris(cell.x, cell.y, "#ef4444", 2);
    });

    this.cancelPath(true);
  },

  validate() {
    if (this.path.length !== this.requiredBlocks) return;

    const placed = [...this.path];
    this.path = [];

    const now = performance.now();

    placed.forEach(cell => {
      this.cells[cell.y][cell.x] = 2;

      this.popAnims.push({
        x: cell.x,
        y: cell.y,
        start: now,
        rgb: "59,130,246"
      });
    });

    GameAudio.playPlace();
    Haptics.vibrate(16);

    this.processClears();

    this.turn += 1;
    this.turnsSinceObstacle += 1;

    this.maybeSpawnObstacles();
    this.checkGameOver();

    if (!this.gameOver) {
      this.setupNextBlock();
    } else {
      this.updateHUD();
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

    if (count === 0) return;

    const now = performance.now();
    const clearedKeys = new Set();

    for (const y of fullRows) {
      this.clearFlashes.push({ type: "row", index: y, start: now });

      for (let x = 0; x < this.SIZE; x++) {
        clearedKeys.add(`${x},${y}`);
      }
    }

    for (const x of fullCols) {
      this.clearFlashes.push({ type: "col", index: x, start: now });

      for (let y = 0; y < this.SIZE; y++) {
        clearedKeys.add(`${x},${y}`);
      }
    }

    for (const key of clearedKeys) {
      const [x, y] = key.split(",").map(Number);
      const value = this.cells[y][x];

      const color = value === 3 ? "#94a3b8" : "#60a5fa";

      this.spawnDebris(x, y, color, 3);
      this.spawnParticles(x, y, 8);
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

    this.addScore(points);

    this.spawnShockwave(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * (count > 1 ? 0.38 : 0.24)
    );

    GameAudio.playClear(count);
    Haptics.vibrate(count > 1 ? [28, 35, 65] : 24);

    return { count, reward };
  },

  addScore(points) {
    this.score += points;

    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveBest(this.best);
    }

    this.updateScore();
  },

  checkGameOver() {
    const isGridFull = this.cells.every(row => row.every(value => value !== 0));

    if (!isGridFull) return;

    this.gameOver = true;

    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveBest(this.best);
    }

    document.getElementById("finalScoreValue").textContent = this.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");

    GameAudio.playGameOver();
    Haptics.vibrate([70, 45, 80]);
  },

  updateHUD() {
    this.updateScore();

    document.getElementById("bestScoreValue").textContent = this.best;
    document.getElementById("turnValue").textContent = this.turn;

    this.renderAvailableBlocks();
  },

  updateScore() {
    const scoreEl = document.getElementById("currentScore");
    if (!scoreEl) return;

    if (this.score !== this.previousScore) {
      scoreEl.textContent = this.score;
      this.bumpElement(scoreEl, "score-bump");
      this.previousScore = this.score;
    }
  },

  renderAvailableBlocks() {
    const remaining = Math.max(0, this.requiredBlocks - this.path.length);

    const countEl = document.getElementById("availableCount");
    const pillEl = document.getElementById("availablePill");
    const pipsEl = document.getElementById("availablePips");

    countEl.textContent = remaining;

    if (
      remaining !== this.previousRemaining ||
      this.requiredBlocks !== this.previousRequired
    ) {
      this.bumpElement(pillEl, "bump");
      this.previousRemaining = remaining;
      this.previousRequired = this.requiredBlocks;
    }

    pipsEl.innerHTML = "";

    for (let i = 0; i < this.requiredBlocks; i++) {
      const pip = document.createElement("div");
      pip.className = "available-pip";

      if (i < remaining) {
        pip.classList.add("filled");
      } else {
        pip.classList.add("used");
      }

      pipsEl.appendChild(pip);
    }
  },

  bumpElement(element, className = "bump") {
    if (!element) return;

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  },

  spawnParticles(cellX, cellY, amount) {
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
        color: Math.random() > 0.45 ? "#60a5fa" : "#22c55e"
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
      start: performance.now(),
      maxRadius,
      rgb: "255,255,255"
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

  draw(now) {
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawBoard();
    this.drawPathLine();
    this.drawCells(now);
    this.drawClearFlashes(now);
    this.drawShockwaves(now);
    this.drawPopAnims(now);
    this.drawInvalidFlashes(now);
    this.drawParticles();
    this.drawDebris();
  },

  drawBoard() {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(2, 6, 23, 0.24)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        const px = x * cellSize;
        const py = y * cellSize;
        const pad = cellSize * 0.032;
        const box = cellSize - pad * 2;
        const radius = cellSize * 0.12;

        ctx.save();

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        this.roundRectPath(px + pad, py + pad, box, box, radius);
        ctx.fill();

        ctx.strokeStyle = "rgba(148, 163, 184, 0.055)";
        ctx.lineWidth = Math.max(1, cellSize * 0.01);
        this.roundRectPath(px + pad, py + pad, box, box, radius);
        ctx.stroke();

        ctx.restore();
      }
    }
  },

  drawCells(now) {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        const value = this.cells[y][x];

        if (value === 0) continue;

        const px = x * cellSize;
        const py = y * cellSize;
        const pad = cellSize * 0.032;
        const box = cellSize - pad * 2;
        const radius = cellSize * 0.12;

        ctx.save();

        if (value === 1) {
          ctx.globalAlpha = 0.52;

          ctx.shadowColor = "rgba(34, 197, 94, 0.28)";
          ctx.shadowBlur = cellSize * 0.08;

          const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
          gradient.addColorStop(0, "#4ade80");
          gradient.addColorStop(1, "#16a34a");

          ctx.fillStyle = gradient;
        } else if (value === 2) {
          ctx.shadowColor = "rgba(59, 130, 246, 0.22)";
          ctx.shadowBlur = cellSize * 0.08;

          const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
          gradient.addColorStop(0, "#60a5fa");
          gradient.addColorStop(1, "#2563eb");

          ctx.fillStyle = gradient;
        } else {
          ctx.shadowColor = "rgba(148, 163, 184, 0.12)";
          ctx.shadowBlur = cellSize * 0.05;

          const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
          gradient.addColorStop(0, "#64748b");
          gradient.addColorStop(1, "#475569");

          ctx.fillStyle = gradient;
        }

        this.roundRectPath(px + pad, py + pad, box, box, radius);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
        this.roundRectPath(
          px + pad + box * 0.10,
          py + pad + box * 0.08,
          box * 0.80,
          box * 0.16,
          radius * 0.7
        );
        ctx.fill();

        ctx.restore();
      }
    }
  },

  drawPathLine() {
    if (this.path.length < 2) return;

    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(34, 197, 94, 0.12)";
    ctx.lineWidth = cellSize * 0.11;

    ctx.beginPath();
    ctx.moveTo(this.getCellCenterX(this.path[0].x), this.getCellCenterY(this.path[0].y));

    for (let i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.getCellCenterX(this.path[i].x), this.getCellCenterY(this.path[i].y));
    }

    ctx.stroke();

    ctx.restore();
  },

  drawClearFlashes(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.clearFlashes = this.clearFlashes.filter(item => now - item.start < 320);

    for (const flash of this.clearFlashes) {
      const age = (now - flash.start) / 320;
      const alpha = 0.24 * (1 - age);

      ctx.save();

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

      if (flash.type === "row") {
        ctx.fillRect(0, flash.index * cellSize, this.canvas.width, cellSize);
      } else {
        ctx.fillRect(flash.index * cellSize, 0, cellSize, this.canvas.height);
      }

      ctx.restore();
    }
  },

  drawShockwaves(now) {
    const ctx = this.ctx;

    this.shockwaves = this.shockwaves.filter(item => now - item.start < 450);

    for (const wave of this.shockwaves) {
      const age = (now - wave.start) / 450;
      const radius = wave.maxRadius * age;
      const alpha = 0.28 * (1 - age);

      ctx.save();

      ctx.strokeStyle = `rgba(${wave.rgb}, ${alpha})`;
      ctx.lineWidth = Math.max(1, this.getCellSize() * 0.045 * (1 - age));

      ctx.beginPath();
      ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  },

  drawPopAnims(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.popAnims = this.popAnims.filter(item => now - item.start < 260);

    for (const anim of this.popAnims) {
      const age = (now - anim.start) / 260;

      const px = anim.x * cellSize;
      const py = anim.y * cellSize;
      const pad = cellSize * 0.032;
      const box = cellSize - pad * 2;
      const radius = cellSize * 0.12;

      const scale = 0.88 + Math.sin(age * Math.PI) * 0.14;
      const center = cellSize / 2;
      const alpha = 0.24 * (1 - age);

      ctx.save();

      ctx.translate(px + center, py + center);
      ctx.scale(scale, scale);
      ctx.translate(-(px + center), -(py + center));

      ctx.fillStyle = `rgba(${anim.rgb}, ${alpha})`;

      this.roundRectPath(px + pad, py + pad, box, box, radius);
      ctx.fill();

      ctx.restore();
    }
  },

  drawInvalidFlashes(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.invalidFlashes = this.invalidFlashes.filter(item => now - item.start < 220);

    for (const flash of this.invalidFlashes) {
      const age = (now - flash.start) / 220;
      const alpha = 0.22 * (1 - age);

      const px = flash.x * cellSize;
      const py = flash.y * cellSize;
      const pad = cellSize * 0.032;
      const box = cellSize - pad * 2;
      const radius = cellSize * 0.12;

      ctx.save();

      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      this.roundRectPath(px + pad, py + pad, box, box, radius);
      ctx.fill();

      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha + 0.10})`;
      ctx.lineWidth = Math.max(2, cellSize * 0.03);
      this.roundRectPath(px + pad, py + pad, box, box, radius);
      ctx.stroke();

      ctx.restore();
    }
  },

  drawParticles() {
    const ctx = this.ctx;

    this.particles = this.particles.filter(p => p.life > 0);

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += this.getCellSize() * 0.004;
      p.life -= p.decay;

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
      p.x += p.vx;
      p.y += p.vy;
      p.vy += this.getCellSize() * 0.005;
      p.rotation += p.vr;
      p.life -= p.decay;

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

    this.invalidFlashes.push({
      x,
      y,
      start: now
    });

    GameAudio.playError();
    Haptics.vibrate(18);
  }
};
