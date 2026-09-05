/*
  Intégration AdMob (plugin @capacitor-community/admob), en phase de test.
  Les IDs ci-dessous sont les IDs de démonstration officiels de Google —
  à remplacer par les vrais IDs AdMob avant publication.
  Ne fait rien si le plugin natif n'est pas disponible (navigateur, dev web)
  ou si le joueur a activé "Remove Ads".
*/
const Ads = {
  ready: false,
  bannerVisible: false,

  UNIT_IDS: {
    banner: "ca-app-pub-3940256099942544/6300978111",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
    rewarded: "ca-app-pub-3940256099942544/5224354917"
  },

  hasPlugin() {
    return Boolean(
      window.Capacitor &&
      Capacitor.Plugins &&
      Capacitor.Plugins.AdMob
    );
  },

  isOnline() {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  },

  showOfflineMessage() {
    const el = document.createElement("div");
    el.className = "ad-toast";
    el.textContent = "No internet connection";

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));

    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 2200);
  },

  isBlocked() {
    return Boolean(Settings.data && Settings.data.adsBlocked);
  },

  async init() {
    if (!this.hasPlugin()) return;

    try {
      await Capacitor.Plugins.AdMob.initialize({
        initializeForTesting: true
      });
      this.ready = true;
    } catch (error) {
      // Pas d'AdMob disponible sur cet environnement : le jeu continue sans pub.
    }
  },

  // Publicité plein écran (mode cliqué, restart pause, restart/countdown défaite),
  // déclenchée avec une probabilité "chance" (0-1).
  async maybeShowInterstitial(chance) {
    if (this.isBlocked() || !this.isOnline() || !this.hasPlugin() || !this.ready) return;
    if (Math.random() > chance) return;

    Game.pause();
    GameAudio.pause();

    try {
      const AdMob = Capacitor.Plugins.AdMob;
      await AdMob.prepareInterstitial({ adId: this.UNIT_IDS.interstitial, isTesting: true });
      await AdMob.showInterstitial();
    } catch (error) {
      // Publicité indisponible : on n'interrompt jamais le joueur pour ça.
    }

    Game.resume();
    GameAudio.resume();
  },

  // Publicité récompensée (bouton "Watch Ad" du panneau défaite). onComplete est
  // toujours appelé, même en cas d'échec, pour ne jamais pénaliser le joueur.
  // Un micro délai sépare la fin de la pub de l'octroi effectif de la récompense.
  async showRewarded(onComplete) {
    const grant = () => setTimeout(() => { if (onComplete) onComplete(); }, 350);

    if (this.isBlocked() || !this.hasPlugin() || !this.ready) {
      grant();
      return;
    }

    Game.pause();
    GameAudio.pause();

    try {
      const AdMob = Capacitor.Plugins.AdMob;
      await AdMob.prepareRewardVideoAd({ adId: this.UNIT_IDS.rewarded, isTesting: true });
      await AdMob.showRewardVideoAd();
    } catch (error) {
      // Pub indisponible : on accorde quand même la récompense.
    }

    Game.resume();
    GameAudio.resume();

    grant();
  },

  async showBanner() {
    if (this.isBlocked() || !this.hasPlugin() || this.bannerVisible) return;

    try {
      await Capacitor.Plugins.AdMob.showBanner({
        adId: this.UNIT_IDS.banner,
        adSize: "ADAPTIVE_BANNER",
        position: "BOTTOM_CENTER",
        margin: 0,
        isTesting: true
      });
      this.bannerVisible = true;
    } catch (error) {
      // Pas de bannière disponible.
    }
  },

  async hideBanner() {
    if (!this.hasPlugin() || !this.bannerVisible) return;

    try {
      await Capacitor.Plugins.AdMob.hideBanner();
    } catch (error) {
      // Rien à faire.
    }

    this.bannerVisible = false;
  }
};
