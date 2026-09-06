/*
  Panneau "Rate us".
  S'affiche automatiquement :
  - la toute première fois que le joueur revient sur la page d'accueil
    après avoir terminé le tutoriel (affichage garanti, une seule fois) ;
  - puis occasionnellement, au hasard, sur la page d'accueil ou lors du
    redémarrage d'une partie.
  Ne s'affiche jamais pendant le tutoriel, ni par-dessus un autre panneau
  déjà ouvert.
*/
const RateUs = {
  STORE_URL: "https://play.google.com/store/apps/details?id=com.vallo7.inkblast",

  // Apparitions aléatoires occasionnelles : au moins MIN_PROMPTS_BETWEEN
  // passages par l'accueil/un restart entre deux propositions, puis un
  // tirage au sort à chaque fois au-delà de ce nombre.
  MIN_PROMPTS_BETWEEN: 6,
  MENU_CHANCE: 1 / 14,
  RESTART_CHANCE: 1 / 20,

  shownOnce: false,
  promptsSinceShown: 0,

  init() {
    this.shownOnce = Storage.getRateUsShown();

    const overlay = document.getElementById("rateUsOverlay");
    const rateBtn = document.getElementById("rateUsBtn");
    const dismissBtn = document.getElementById("rateUsDismissBtn");

    if (rateBtn) {
      rateBtn.addEventListener("click", () => {
        GameAudio.playClick();
        Haptics.vibrate(15);
        this.openStore();
        this.hide();
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        GameAudio.playClick();
        this.hide();
      });
    }

    if (overlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) this.hide();
      });
    }
  },

  isAnyOverlayOpen() {
    return [
      "settingsOverlay",
      "homeSettingsOverlay",
      "aboutUsOverlay",
      "gameOverOverlay",
      "rateUsOverlay"
    ].some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
  },

  canPrompt() {
    if (Tutorial.active || !Storage.getTutorialDone()) return false;
    if (document.body.classList.contains("locked")) return false;
    if (this.isAnyOverlayOpen()) return false;

    return true;
  },

  // Page d'accueil : premier retour après le tutoriel -> affichage garanti.
  // Ensuite, apparitions occasionnelles seulement.
  maybeShowOnMenu() {
    if (!this.canPrompt()) return;

    if (!this.shownOnce) {
      this.show();
      return;
    }

    this.promptsSinceShown += 1;
    if (this.promptsSinceShown < this.MIN_PROMPTS_BETWEEN) return;
    if (Math.random() > this.MENU_CHANCE) return;

    this.show();
  },

  // Redémarrage d'une partie : apparitions occasionnelles seulement (le
  // tout premier affichage garanti reste réservé à la page d'accueil).
  maybeShowOnRestart() {
    if (!this.canPrompt()) return;
    if (!this.shownOnce) return;

    this.promptsSinceShown += 1;
    if (this.promptsSinceShown < this.MIN_PROMPTS_BETWEEN) return;
    if (Math.random() > this.RESTART_CHANCE) return;

    this.show();
  },

  show() {
    const overlay = document.getElementById("rateUsOverlay");
    if (!overlay) return;

    this.promptsSinceShown = 0;

    if (!this.shownOnce) {
      this.shownOnce = true;
      Storage.setRateUsShown();
    }

    // Micro-délai avant apparition : un affichage qui se sent plus
    // intentionnel qu'un pop-in instantané.
    setTimeout(() => {
      const panel = overlay.querySelector(".rate-us-panel");

      overlay.classList.remove("hidden");

      if (panel) {
        // On repart toujours d'un état neuf pour que l'animation d'entrée
        // (panneau + étoiles) rejoue à chaque affichage, même répété.
        panel.classList.remove("rate-us-animate-in");
        void panel.offsetWidth;
        panel.classList.add("rate-us-animate-in");
      }
    }, 220);
  },

  hide() {
    const overlay = document.getElementById("rateUsOverlay");
    if (!overlay) return;

    overlay.classList.add("hidden");

    const panel = overlay.querySelector(".rate-us-panel");
    if (panel) panel.classList.remove("rate-us-animate-in");
  },

  openStore() {
    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser) {
      Capacitor.Plugins.Browser.open({ url: this.STORE_URL });
      return;
    }

    // Pas de plugin Browser installé : on retombe sur l'ouverture système
    // standard (le WebView Capacitor délègue les liens externes à l'OS).
    window.open(this.STORE_URL, "_system");
  }
};
