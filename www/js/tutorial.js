const GLOVE_SVG =
  '<svg viewBox="0 0 64 64">' +
  '<rect x="27" y="2" width="11" height="30" rx="5.5" fill="#fff"/>' +
  '<rect x="18" y="26" width="30" height="26" rx="12" fill="#fff"/>' +
  '<rect x="12" y="30" width="11" height="16" rx="5.5" fill="#fff"/>' +
  "</svg>";

const Tutorial = {
  active: false,
  step: 0, // 0 = menu, 1..3 = tracés, >3 = terminé
  paths: {
    1: [{x:0,y:5},{x:1,y:5},{x:2,y:5},{x:3,y:5}],
    2: [{x:4,y:5},{x:5,y:5},{x:6,y:5},{x:7,y:5},{x:7,y:6},{x:7,y:7}],
    3: [{x:7,y:5},{x:7,y:4},{x:7,y:3},{x:7,y:2},{x:7,y:1},{x:7,y:0}]
  },
  menuGlove: null,
  gameGlove: null,
  _origSetup: null,

  init() {
    if (Storage.isTutorialDone()) { this.active = false; return; }
    this.active = true;
    this.step = 0;
    document.body.classList.add("tutorial-menu");
    this.buildGloves();
    this.installHooks();
  },

  installHooks() {
    const self = this;
    const _canAdd = Game.canAddCell.bind(Game);
    Game.canAddCell = function(x, y) {
      if (self.active && self.step >= 1 && self.step <= 3) return self.canAdd(x, y);
      return _canAdd(x, y);
    };

    const _setup = Game.setupNextBlock.bind(Game);
    this._origSetup = _setup;
    Game.setupNextBlock = function() {
      if (self.active && self.step >= 1 && self.step <= 3) {
        Game.requiredBlocks = self.required();
        Game.updateHUD();
        return;
      }
      return _setup();
    };

    const _obs = Game.maybeSpawnObstacles.bind(Game);
    Game.maybeSpawnObstacles = function() { if (self.active) return; return _obs(); };

    const _check = Game.checkGameOver.bind(Game);
    Game.checkGameOver = function() { if (self.active) return; return _check(); };

    const _validate = Game.validate.bind(Game);
    Game.validate = function() {
      const wasT = self.active && self.step >= 1 && self.step <= 3;
      const r = _validate();
      if (wasT) {
        self.onValidated();
        if (self.active && self.step >= 1 && self.step <= 3) {
          Game.requiredBlocks = self.required();
          Game.updateHUD();
        }
      }
      return r;
    };

    const _draw = Game.draw.bind(Game);
    Game.draw = function() {
      _draw();
      if (self.active && self.step >= 1 && self.step <= 3) self.drawHighlights();
      self.positionGameGlove();
    };
  },

  buildGloves() {
    const btn = document.getElementById("classicModeBtn");
    if (btn && !document.getElementById("menuGlove")) {
      const g = document.createElement("div");
      g.id = "menuGlove";
      g.className = "tutor-glove menu-glove";
      g.innerHTML = GLOVE_SVG;
      btn.appendChild(g);
    }
    const shell = document.querySelector(".board-shell");
    if (shell && !document.getElementById("gameGlove")) {
      const g = document.createElement("div");
      g.id = "gameGlove";
      g.className = "tutor-glove game-glove";
      g.innerHTML = GLOVE_SVG;
      g.style.opacity = "0";
      shell.appendChild(g);
    }
    this.menuGlove = document.getElementById("menuGlove");
    this.gameGlove = document.getElementById("gameGlove");
  },

  startGame() {
    if (!this.active) return;
    this.step = 1;
    document.body.classList.remove("tutorial-menu");
    document.body.classList.add("tutorial-game");
    if (this.gameGlove) this.gameGlove.style.opacity = "1";
  },

  required() { return (this.paths[this.step] || []).length; },

  canAdd(x, y) {
    const path = this.paths[this.step] || [];
    const idx = Game.path.length;
    if (idx >= path.length) return false;
    const t = path[idx];
    return t.x === x && t.y === y;
  },

  onValidated() {
    if (this.step < 3) this.step++;
    else this.complete();
  },

  complete() {
    this.spawn5();
    this.active = false;
    this.step = 4;
    Storage.setTutorialDone();
    document.body.classList.remove("tutorial-game");
    if (this.gameGlove) this.gameGlove.style.opacity = "0";
    if (this._origSetup) this._origSetup();
  },

  spawn5() {
    const cells = [];
    for (let y = 0; y < Game.SIZE; y++)
      for (let x = 0; x < Game.SIZE; x++)
        if (Game.cells[y][x] === 0) cells.push({ x, y });
    const pick = Game.shuffleArray(cells).slice(0, 5);
    pick.forEach(c => {
      Game.cells[c.y][c.x] = 2;
      Game.cellAnims[`${c.x},${c.y}`] = { start: Game.gameNow, type: "spawn" };
    });
  },

  drawHighlights() {
    const ctx = Game.ctx;
    const path = this.paths[this.step] || [];
    const start = Game.path.length;
    const cell = Game.getCellSize();
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
    for (let i = start; i < path.length; i++) {
      const c = path[i];
      const px = c.x * cell, py = c.y * cell;
      const pad = cell * 0.035, box = cell - pad * 2, r = cell * 0.16;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.fillStyle = "#faf3e1";
      Game.roundRectPath(px + pad, py + pad, box, box, r);
      ctx.fill();
      ctx.restore();
    }
  },

  positionGameGlove() {
    const g = this.gameGlove;
    if (!g) return;
    if (!this.active || this.step < 1 || this.step > 3) { g.style.opacity = "0"; return; }
    const path = this.paths[this.step] || [];
    const remaining = path.slice(Game.path.length);
    if (remaining.length === 0) { g.style.opacity = "0"; return; }
    g.style.opacity = "1";
    const period = 650;
    const t = (performance.now() % (period * remaining.length)) / period;
    const i = Math.floor(t);
    const f = t - i;
    const a = remaining[i];
    const b = remaining[Math.min(i + 1, remaining.length - 1)];
    const move = Math.min(1, f / 0.6);
    const e = 1 - Math.pow(1 - move, 3);
    const cx = a.x + (b.x - a.x) * e;
    const cy = a.y + (b.y - a.y) * e;
    const dip = f > 0.6 ? Math.sin(((f - 0.6) / 0.4) * Math.PI) * 5 : 0;
    const canvas = Game.canvas;
    const pad = 6;
    const cellPx = canvas.clientWidth / Game.SIZE;
    const x = pad + (cx + 0.5) * cellPx;
    const y = pad + (cy + 0.5) * cellPx;
    g.style.left = (x - 30) + "px";
    g.style.top = (y - 2 + dip) + "px";
  }
};
