const App = {
  init() {
    Settings.load();
    Game.init();
    Menu.init();

    this.bindUI();
    this.showMenu();

    document.addEventListener("pointerdown", () => {
      GameAudio.unlock();
    }, { once: true });
  },

  bindUI() {
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const settingsCloseBtn = document.getElementById("settingsCloseBtn");
    const settingsHomeBtn = document.getElementById("settingsHomeBtn");

    settingsBtn.addEventListener("click", () => {
      GameAudio.unlock();
      Haptics.vibrate(6);
      this.openSettings();
    });

    settingsCloseBtn.addEventListener("click", () => {
      Haptics.vibrate(5);
      this.closeSettings();
    });

    settingsHomeBtn.addEventListener("click", () => {
      Haptics.vibrate(5);
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
        Haptics.vibrate(6);

        const key = button.dataset.setting;
        Settings.toggle(key);
      });
    });
  },

  showMenu() {
    document.getElementById("menuScreen").classList.add("active");
    document.getElementById("gameScreen").classList.remove("active");

    Game.stop();
  },

  showGame() {
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
