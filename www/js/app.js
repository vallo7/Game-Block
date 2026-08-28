const App = {
  splashHidden: false,

  init() {
    Theme.init();

    Settings.load();
    Game.init();
    Menu.init();

    this.bindUI();
    this.bindBackButton();
    this.showMenu();
    this.hideSplashLater();

    document.addEventListener("pointerdown", () => {
      GameAudio.unlock();
    }, { once: true });
  },

  bindBackButton() {
    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
      Capacitor.Plugins.App.addListener("backButton", () => {
        Capacitor.Plugins.App.exitApp();
      });
    }
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
