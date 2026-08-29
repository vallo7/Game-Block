const App = {
  splashHidden: false,
  lastBackPress: 0,

  init() {
    // Le splash se masque TOUJOURS, même si une erreur survient ensuite
    this.hideSplashLater();

    try {
      Theme.init();
      Settings.load();
      Game.init();
      Menu.init();

      this.bindUI();
      this.bindBackButton();
      this.bindButtonPop();
      this.showMenu();
    } catch (error) {
      console.error("Ink Blast init error:", error);
    }

    document.addEventListener("pointerdown", () => {
      GameAudio.unlock();
    }, { once: true });
  },

  on(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
    return el;
  },

  bindBackButton() {
    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
      Capacitor.Plugins.App.addListener("backButton", () => {
        this.handleBack();
      });
    }
  },

  handleBack() {
    const settingsOverlay = document.getElementById("settingsOverlay");
    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameScreen = document.getElementById("gameScreen");

    if (settingsOverlay && !settingsOverlay.classList.contains("hidden")) {
      GameAudio.playClick();
      this.closeSettings();
      return;
    }

    if (gameOverOverlay && !gameOverOverlay.classList.contains("hidden")) {
      GameAudio.playClick();
      Game.stopCountdown();
      this.showMenu();
      return;
    }

    if (gameScreen && gameScreen.classList.contains("active")) {
      GameAudio.playClick();
      this.showMenu();
      return;
    }

    const now = Date.now();

    if (this.lastBackPress && now - this.lastBackPress < 2000) {
      if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
        Capacitor.Plugins.App.exitApp();
      } else {
        window.history.back();
      }
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

      setTimeout(() => {
        button.classList.remove("btn-pop");
      }, 320);
    }, true);
  },

  hideSplashLater() {
    setTimeout(() => {
      const splash = document.getElementById("splash");

      if (splash && !this.splashHidden) {
        splash.classList.add("hidden");
        this.splashHidden = true;
      }
    }, 1600);
  },

  celebrateEl(el) {
    if (!el) return;

    el.classList.remove("celebrate");
    void el.offsetWidth;
    el.classList.add("celebrate");

    setTimeout(() => {
      el.classList.remove("celebrate");
    }, 600);
  },

  confetti(originEl) {
    if (!originEl) return;

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

      setTimeout(() => {
        piece.remove();
      }, 1600);
    }
  },

  bindUI() {
    const settingsOverlay = document.getElementById("settingsOverlay");

    this.on("settingsBtn", () => {
      GameAudio.unlock();
      GameAudio.playClick();

      setTimeout(() => {
        this.openSettings();
      }, 160);
    });

    this.on("settingsCloseBtn", () => {
      GameAudio.playClick();
      this.closeSettings();
    });

    this.on("settingsHomeBtn", () => {
      GameAudio.playClick();

      setTimeout(() => {
        this.closeSettings();
        this.showMenu();
      }, 200);
    });

    this.on("settingsRestartBtn", () => {
      GameAudio.playClick();

      setTimeout(() => {
        this.closeSettings();
        Game.reset();
      }, 200);
    });

    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", (event) => {
        if (event.target === settingsOverlay) {
          this.closeSettings();
        }
      });
    }

    const bestScore = document.querySelector(".best-score");
    if (bestScore) {
      bestScore.addEventListener("click", () => {
        GameAudio.unlock();
        GameAudio.playClick();
        this.celebrateEl(bestScore);
        this.confetti(bestScore);
      });
    }

    const availablePill = document.getElementById("availablePill");
    if (availablePill) {
      availablePill.addEventListener("click", () => {
        GameAudio.unlock();
        GameAudio.playClick();
        this.celebrateEl(availablePill);
      });
    }

    document.querySelectorAll("[data-setting]").forEach(button => {
      button.addEventListener("click", () => {
        GameAudio.unlock();
        GameAudio.playClick();

        const key = button.dataset.setting;

        setTimeout(() => {
          Settings.toggle(key);
        }, 120);
      });
    });
  },

  showMenu() {
    document.getElementById("menuScreen").classList.add("active");
    document.getElementById("gameScreen").classList.remove("active");

    Game.stop();
  },

  showGame() {
    if (!Game.runActive) {
      Theme.useMenuColor();
    }

    document.getElementById("menuScreen").classList.remove("active");
    document.getElementById("gameScreen").classList.add("active");

    Game.start();
  },

  openSettings() {
    const overlay = document.getElementById("settingsOverlay");
    if (overlay) overlay.classList.remove("hidden");
  },

  closeSettings() {
    const overlay = document.getElementById("settingsOverlay");
    if (overlay) overlay.classList.add("hidden");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
