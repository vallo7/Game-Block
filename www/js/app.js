const App = {
  splashHidden: false,

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

    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
      Capacitor.Plugins.App.exitApp();
    } else {
      window.history.back();
    }
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

  bindUI() {
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const settingsCloseBtn = document.getElementById("settingsCloseBtn");
    const settingsHomeBtn = document.getElementById("settingsHomeBtn");

    settingsBtn.addEventListener("click", () => {
      GameAudio.unlock();
      GameAudio.playClick();
      this.openSettings();
    });

    settingsCloseBtn.addEventListener("click", () => {
      GameAudio.playClick();
      this.closeSettings();
    });

    settingsHomeBtn.addEventListener("click", () => {
      GameAudio.playClick();
      this.closeSettings();
      this.showMenu();
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
        Settings.toggle(key);
      });
    });
  },

  showMenu() {
    Theme.useMenuColor();

    document.getElementById("menuScreen").classList.add("active");
    document.getElementById("gameScreen").classList.remove("active");

    Game.stop();
  },

  showGame() {
    Theme.useMenuColor();

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
