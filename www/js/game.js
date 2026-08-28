const Game = {
  SIZE: 8,
  BASE_INK: 6,
  MAX_SHAPE: 6,

  canvas: null,
  ctx: null,

  active: false,
  gameOver: false,
  drawing: false,
  strokeStarted: false,

  cells: [],
  path: [],

  ink: 6,
  score: 0,
  best: 0,
  turn: 1,
  totalCleared: 0,

  popAnims: [],
  invalidFlashes: [],
  particles: [],
  clearFlashes: [],

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
    this.cancelPath();
  },

  reset() {
    this.cells = Array.from({ length: this.SIZE }, () => Array(this.SIZE).fill(0));

    this.path = [];
    this.ink = this.BASE_INK;
    this.score = 0;
    this.turn = 1;
    this.totalCleared = 0;

    this.gameOver = false;
    this.drawing = false;
    this.strokeStarted = false;

    this.popAnims = [];
    this.invalidFlashes = [];
    this.particles = [];
    this.clearFlashes = [];

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

      if (!this.gameOver) {
        this.validate();
      }
    });

    this.canvas.addEventListener("pointercancel", () => {
      if (!this.active) return;

      this.cancelPath();
    });

    document.getElementById("restartBtn").addEventListener("click", () => {
      GameAudio.unlock();
      this.reset();
      Haptics.vibrate(10);
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
    if (this.ink <= 0) return false;
    if (this.path.length >= this.MAX_SHAPE) return false;

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
    this.ink -= 1;

    this.popAnims.push({
      x,
      y,
      start: performance.now(),
      rgb: "34,197,94"
    });

    GameAudio.playAdd(this.path.length);
    Haptics.vibrate(6);

    this.updateHUD();
  },

  backtrackTo(index) {
    const removed = this.path.splice(index + 1);

    if (removed.length === 0) return;

    removed.forEach(cell => {
      this.cells[cell.y][cell.x] = 0;
    });

    this.ink += removed.length;

    GameAudio.playBack();
    Haptics.vibrate(4);

    this.updateHUD();
  },

  cancelPath() {
    this.drawing = false;
    this.strokeStarted = false;

    if (this.path.length === 0) return;

    this.path.forEach(cell => {
      this.cells[cell.y][cell.x] = 0;
    });

    this.path = [];
    this.ink = this.BASE_INK;

    this.updateHUD();
  },

  validate() {
    if (this.path.length === 0) return;

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

    const result = this.processClears();

    this.turn += 1;

    if (this.turn % 5 === 0) {
      this.spawnNeutralBlocks(2);
    }

    this.ink = this.BASE_INK + result.reward;

    this.updateHUD();
    this.checkGameOver();
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

    if (count === 0) {
      return { count: 0, reward: 0 };
    }

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
      this.spawnParticles(x, y, 14);
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

    this.score += count * 100;

    const beforeBonus = Math.floor(this.totalCleared / 2);
    this.totalCleared += count;
    const afterBonus = Math.floor(this.totalCleared / 2);

    if (afterBonus > beforeBonus) {
      this.score += 200;
      reward += 1;
    }

    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveBest(this.best);
    }

    GameAudio.playClear(count);
    Haptics.vibrate(count > 1 ? [28, 35, 65] : 24);

    this.updateHUD();

    return { count, reward };
  },

  spawnNeutralBlocks(count) {
    const emptyCells = [];

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        if (this.cells[y][x] === 0) {
          emptyCells.push({ x, y });
        }
      }
    }

    for (let i = 0; i < count; i++) {
      if (emptyCells.length === 0) break;

      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const cell = emptyCells.splice(randomIndex, 1)[0];

      this.cells[cell.y][cell.x] = 3;

      this.popAnims.push({
        x: cell.x,
        y: cell.y,
        start: performance.now(),
        rgb: "148,163,184"
      });
    }
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
    document.getElementById("bestScoreValue").textContent = this.best;
    document.getElementById("turnValue").textContent = this.turn;

    this.renderInkBlocks();
  },

  renderInkBlocks() {
    const container = document.getElementById("inkBlocks");
    container.innerHTML = "";

    const shown = Math.max(this.BASE_INK, Math.min(12, this.ink));

    for (let i = 0; i < shown; i++) {
      const block = document.createElement("div");
      block.className = "ink-block";

      if (i < this.ink) {
        block.classList.add("filled");

        if (i >= this.BASE_INK) {
          block.classList.add("bonus");
        }
      }

      container.appendChild(block);
    }
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
    this.drawPopAnims(now);
    this.drawInvalidFlashes(now);
    this.drawParticles();
  },

  drawBoard() {
    const cellSize = this.getCellSize();
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(2, 6, 23, 0.28)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        const px = x * cellSize;
        const py = y * cellSize;
        const pad = cellSize * 0.045;
        const box = cellSize - pad * 2;
        const radius = cellSize * 0.14;

        ctx.save();

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        this.roundRectPath(px + pad, py + pad, box, box, radius);
        ctx.fill();

        ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
        ctx.lineWidth = Math.max(1, cellSize * 0.012);
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
        const pad = cellSize * 0.045;
        const box = cellSize - pad * 2;
        const radius = cellSize * 0.14;

        ctx.save();

        if (value === 1) {
          ctx.globalAlpha = 0.52;

          ctx.shadowColor = "rgba(34, 197, 94, 0.28)";
          ctx.shadowBlur = cellSize * 0.10;

          const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
          gradient.addColorStop(0, "#4ade80");
          gradient.addColorStop(1, "#16a34a");

          ctx.fillStyle = gradient;
        } else if (value === 2) {
          ctx.shadowColor = "rgba(59, 130, 246, 0.22)";
          ctx.shadowBlur = cellSize * 0.10;

          const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
          gradient.addColorStop(0, "#60a5fa");
          gradient.addColorStop(1, "#2563eb");

          ctx.fillStyle = gradient;
        } else {
          ctx.shadowColor = "rgba(148, 163, 184, 0.12)";
          ctx.shadowBlur = cellSize * 0.06;

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
    ctx.lineWidth = cellSize * 0.13;

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

  drawPopAnims(now) {
    const ctx = this.ctx;
    const cellSize = this.getCellSize();

    this.popAnims = this.popAnims.filter(item => now - item.start < 260);

    for (const anim of this.popAnims) {
      const age = (now - anim.start) / 260;

      const px = anim.x * cellSize;
      const py = anim.y * cellSize;
      const pad = cellSize * 0.045;
      const box = cellSize - pad * 2;
      const radius = cellSize * 0.14;

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
      const pad = cellSize * 0.045;
      const box = cellSize - pad * 2;
      const radius = cellSize * 0.14;

      ctx.save();

      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      this.roundRectPath(px + pad, py + pad, box, box, radius);
      ctx.fill();

      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha + 0.10})`;
      ctx.lineWidth = Math.max(2, cellSize * 0.035);
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
