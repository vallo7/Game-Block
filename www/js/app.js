const App = {
  splashHidden: false,
  lastBackPress: 0,

  init() {
    Theme.init();

    Settings.load();
    Game.init();
    Menu.init();

    this.bindUI();
    this.bindBackButton();
    this.bindButtonPop();
    this.showMenu();
    this.hideSplashLater();

    document.addEventListener("pointerdown", () => {
      GameAudio.unlock();
    }, { once: true });
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

    if (!settingsOverlay.classList.contains("hidden")) {
      GameAudio.playClick();
      this.closeSettings();
      return;
    }

    if (!gameOverOverlay.classList.contains("hidden")) {
      GameAudio.playClick();
      Game.stopCountdown();
      this.showMenu();
      return;
    }

    if (gameScreen.classList.contains("active")) {
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

  confetti() {
    const colors = Theme.bank.map(c => c.bg);

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";

      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = 900 + Math.random() * 700 + "ms";
      piece.style.animationDelay = Math.random() * 200 + "ms";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;

      document.body.appendChild(piece);

      setTimeout(() => {
        piece.remove();
      }, 2200);
    }
  },

  bindUI() {
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const settingsCloseBtn = document.getElementById("settingsCloseBtn");
    const settingsHomeBtn = document.getElementById("settingsHomeBtn");
    const settingsRestartBtn = document.getElementById("settingsRestartBtn");
    const bestScore = document.querySelector(".best-score");

    bestScore.addEventListener("click", () => {
      GameAudio.unlock();
      GameAudio.playClick();
      this.confetti();
    });

    settingsBtn.addEventListener("click", () => {
      GameAudio.unlock();
      GameAudio.playClick();

      setTimeout(() => {
        this.openSettings();
      }, 160);
    });

    settingsCloseBtn.addEventListener("click", () => {
      GameAudio.playClick();
      this.closeSettings();
    });

    settingsHomeBtn.addEventListener("click", () => {
      GameAudio.playClick();

      setTimeout(() => {
        this.closeSettings();
        this.showMenu();
      }, 200);
    });

    settingsRestartBtn.addEventListener("click", () => {
      GameAudio.playClick();

      setTimeout(() => {
        this.closeSettings();
        Game.reset();
      }, 200);
    });

    settingsOverlay.addEventListener("click", (event) => {
      if (event.target === settingsOverlay) {
        this.closeSettings();
      }
    });

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
    document.getElementById("settingsOverlay").classList.remove("hidden");
  },

  closeSettings() {
    document.getElementById("settingsOverlay").classList.add("hidden");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
