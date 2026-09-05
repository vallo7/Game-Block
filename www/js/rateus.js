/*
  Panneau "Rate Us" : s'affiche une première fois obligatoirement au retour
  sur l'accueil après le tutoriel, puis occasionnellement (aléatoire) par la
  suite, sur l'accueil et lors du restart d'une partie.
*/
const RateUs = {
  PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=com.vallo7.inkblast",

  init() {
    const rateBtn = document.getElementById("rateUsBtn");
    const dismissBtn = document.getElementById("rateUsDismissBtn");
    const overlay = document.getElementById("rateUsOverlay");

    if (rateBtn) {
      rateBtn.addEventListener("click", () => this.rate());
    }

    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => this.dismiss());
    }

    if (overlay) {
      overlay.addEventListener("click", event => {
        if (event.target === overlay) this.dismiss();
      });
    }
  },

  isEligible() {
    return Storage.getTutorialDone() && !Tutorial.active;
  },

  maybeShowOnMenu() {
    if (!this.isEligible()) return;

    if (!Storage.getRateUsShown()) {
      this.show();
      return;
    }

    if (Math.random() < 1 / 12) {
      this.show();
    }
  },

  maybeShowOnRestart() {
    if (!this.isEligible()) return;
    if (Math.random() < 1 / 15) {
      this.show();
    }
  },

  show() {
    const overlay = document.getElementById("rateUsOverlay");
    if (!overlay || !overlay.classList.contains("hidden")) return;

    Storage.setRateUsShown();
    overlay.classList.remove("hidden");
  },

  hide() {
    const overlay = document.getElementById("rateUsOverlay");
    if (overlay) overlay.classList.add("hidden");
  },

  rate() {
    GameAudio.playClick();
    this.hide();

    try {
      window.open(this.PLAY_STORE_URL, "_system");
    } catch (error) {
      window.location.href = this.PLAY_STORE_URL;
    }
  },

  dismiss() {
    GameAudio.playClick();
    this.hide();
  }
};

