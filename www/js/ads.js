/*
  Intégration AdMob (plugin @capacitor-community/admob), en phase de test.
  Les IDs ci-dessous sont les IDs de démonstration officiels de Google —
  à remplacer par les vrais IDs AdMob avant publication.
  Ne fait rien si le plugin natif n'est pas disponible (navigateur, dev web)
  ou si le joueur a activé "Remove Ads".

  Interstitiel et récompensée sont toujours préchargés à l'avance
  (preloadInterstitial/preloadRewarded), pour que le moment où le joueur
  déclenche réellement une pub n'ait qu'à l'afficher — jamais à la
  charger depuis le réseau à cet instant précis, ce qui est la cause du
  délai (et parfois de l'échec) au clic.
*/
const Ads = {
  ready: false,
  bannerVisible: false,

  interstitialReady: false,
  rewardedReady: false,
  preloadingInterstitial: false,
  preloadingRewarded: false,

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
      return;
    }

    // Précharge les deux formats dès le lancement pour qu'ils soient déjà
    // prêts la première fois que le joueur les déclenche.
    this.preloadInterstitial();
    this.preloadRewarded();
  },

  async preloadInterstitial() {
    if (this.preloadingInterstitial || this.interstitialReady) return;
    if (this.isBlocked() || !this.hasPlugin() || !this.ready) return;

    this.preloadingInterstitial = true;

    try {
      await Capacitor.Plugins.AdMob.prepareInterstitial({
        adId: this.UNIT_IDS.interstitial,
        isTesting: true
      });
      this.interstitialReady = true;
    } catch (error) {
      this.interstitialReady = false;
    }

    this.preloadingInterstitial = false;
  },

  async preloadRewarded() {
    if (this.preloadingRewarded || this.rewardedReady) return;
    if (this.isBlocked() || !this.hasPlugin() || !this.ready) return;

    this.preloadingRewarded = true;

    try {
      await Capacitor.Plugins.AdMob.prepareRewardVideoAd({
        adId: this.UNIT_IDS.rewarded,
        isTesting: true
      });
      this.rewardedReady = true;
    } catch (error) {
      this.rewardedReady = false;
    }

    this.preloadingRewarded = false;
  },

  // Publicité plein écran (mode cliqué, restart), déclenchée avec une
  // probabilité "chance" (0-1). Toujours préchargée à l'avance : ne fait
  // qu'afficher une pub déjà prête, sans jamais attendre de chargement au
  // moment du clic. Renvoie une promesse que l'appelant peut attendre pour
  // ne reprendre la main qu'une fois la pub (et la pause associée) bien
  // terminée.
  async maybeShowInterstitial(chance) {
    if (this.isBlocked() || !this.isOnline() || !this.hasPlugin() || !this.ready) return;
    if (Math.random() > chance) return;

    if (!this.interstitialReady) {
      // Pas encore prête : on ne fait jamais attendre le joueur pour ça,
      // on retente juste un préchargement pour la prochaine fois.
      this.preloadInterstitial();
      return;
    }

    Game.pause();
    GameAudio.pause();

    this.interstitialReady = false;

    try {
      await Capacitor.Plugins.AdMob.showInterstitial();
    } catch (error) {
      // Publicité indisponible : on n'interrompt jamais le joueur pour ça.
    }

    Game.resume();
    GameAudio.resume();

    this.preloadInterstitial();
  },

  // Publicité récompensée (bouton "Watch Ad" du panneau défaite). Toujours
  // préchargée à l'avance : s'affiche donc immédiatement, sans délai, au
  // clic. onComplete est toujours appelé, même en cas d'échec, pour ne
  // jamais pénaliser le joueur.
  async showRewarded(onComplete) {
    const grant = () => {
      if (onComplete) onComplete();
    };

    if (this.isBlocked() || !this.hasPlugin() || !this.ready || !this.rewardedReady) {
      grant();
      this.preloadRewarded();
      return;
    }

    Game.pause();
    GameAudio.pause();

    this.rewardedReady = false;

    try {
      await Capacitor.Plugins.AdMob.showRewardVideoAd();
    } catch (error) {
      // Pub indisponible : on accorde quand même la récompense.
    }

    Game.resume();
    GameAudio.resume();

    grant();

    this.preloadRewarded();
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
