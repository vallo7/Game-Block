/*
  Thèmes visuels (fond d'écran + variantes de blocs). Distinct du système
  Theme existant (js/theme.js), qui gère uniquement les couleurs cycliques
  de la grille, des boutons et du splash — ce fichier gère l'image de fond
  et les variantes d'assets (blocs de pierre/glace) propres à chaque thème.
*/
const VisualTheme = {
  LIST: [
    {
      id: "default",
      name: "Meadow",
      locked: false,
      bg: "img/backgrounds/theme-default-bg.jpg",
      thumb: "img/backgrounds/thumbs/theme-default-bg-thumb.jpg",
      obstacle: "stone",
      defeatOverlay: "stone",
      startColor: { bg: "#0a0c4d", dark: "#070836", light: "#9192af" }
    },
    {
      id: "ice",
      name: "Frozen",
      locked: false,
      bg: "img/backgrounds/theme-ice-bg.jpg",
      thumb: "img/backgrounds/thumbs/theme-ice-bg-thumb.jpg",
      obstacle: "ice",
      defeatOverlay: "ice",
      startColor: null
    },
    {
      id: "halloween",
      name: "Halloween",
      locked: true,
      bg: "img/backgrounds/theme-halloween-bg.jpg",
      thumb: "img/backgrounds/thumbs/theme-halloween-bg-thumb.jpg",
      obstacle: "stone",
      defeatOverlay: "ice",
      startColor: null
    },
    {
      id: "hell",
      name: "Inferno",
      locked: true,
      bg: "img/backgrounds/theme-hell-bg.jpg",
      thumb: "img/backgrounds/thumbs/theme-hell-bg-thumb.jpg",
      obstacle: "stone",
      defeatOverlay: "ice",
      startColor: null
    }
  ],

  current: null,
  topLayer: "A",

  init() {
    const savedId = Storage.getVisualTheme();
    const theme = this.LIST.find(t => t.id === savedId && !t.locked) || this.LIST[0];

    this.current = theme;

    const layerA = document.getElementById("appBgLayerA");
    if (layerA) {
      layerA.style.backgroundImage = `url("${theme.bg}")`;
      layerA.classList.add("is-visible");
    }

    this.bindUI();
  },

  getById(id) {
    return this.LIST.find(t => t.id === id) || null;
  },

  // Applique un thème en fondu-enchaîné entre les deux calques de fond.
  apply(theme) {
    this.current = theme;

    const layerA = document.getElementById("appBgLayerA");
    const layerB = document.getElementById("appBgLayerB");
    if (!layerA || !layerB) return;

    const incoming = this.topLayer === "A" ? layerB : layerA;
    const outgoing = this.topLayer === "A" ? layerA : layerB;

    incoming.style.backgroundImage = `url("${theme.bg}")`;
    incoming.classList.add("is-visible");
    outgoing.classList.remove("is-visible");

    this.topLayer = this.topLayer === "A" ? "B" : "A";
  },

  setDepthActive(active) {
    const appBg = document.getElementById("appBg");
    if (!appBg) return;
    appBg.classList.toggle("depth-active", Boolean(active));
  },

  select(id) {
    const theme = this.getById(id);
    if (!theme || theme.locked) return false;

    GameAudio.playClick();
    Haptics.vibrate(20);

    // Micro-délai avant d'appliquer, pour un changement qui se sent
    // intentionnel plutôt qu'instantané.
    setTimeout(() => {
      this.apply(theme);
      Storage.setVisualTheme(theme.id);
      this.playChangeFlash();
      this.renderCarousel();
    }, 180);

    return true;
  },

  playChangeFlash() {
    const el = document.getElementById("themeChangeFlash");
    if (!el) return;

    el.classList.remove("play");
    void el.offsetWidth;
    el.classList.add("play");
  },

  openPage() {
    this.renderCarousel();
    document.getElementById("menuScreen").classList.remove("active");
    document.getElementById("themeScreen").classList.add("active");
  },

  closePage() {
    document.getElementById("themeScreen").classList.remove("active");
    document.getElementById("menuScreen").classList.add("active");
  },

  buildSlide(theme) {
    const slide = document.createElement("div");
    slide.className = "theme-slide";
    slide.dataset.themeId = theme.id;

    const bg = document.createElement("div");
    bg.className = "theme-slide-bg";
    bg.style.backgroundImage = `url("${theme.bg}")`;
    slide.appendChild(bg);

    const scrim = document.createElement("div");
    scrim.className = "theme-slide-scrim";
    slide.appendChild(scrim);

    const card = document.createElement("div");
    card.className = "theme-slide-card";

    const preview = document.createElement("div");
    preview.className = "theme-slide-preview";

    const ratio = document.createElement("div");
    ratio.className = "theme-slide-preview-ratio";
    preview.appendChild(ratio);

    const img = document.createElement("div");
    img.className = "theme-slide-preview-img";
    img.style.backgroundImage = `url("${theme.thumb}")`;
    preview.appendChild(img);

    const shine = document.createElement("div");
    shine.className = "theme-slide-shine";
    preview.appendChild(shine);

    if (theme.locked) {
      const lock = document.createElement("div");
      lock.className = "theme-slide-lock";
      lock.innerHTML =
        '<svg viewBox="0 0 24 24" class="svg-icon"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg><span>Locked</span>';
      preview.appendChild(lock);
    }

    const name = document.createElement("p");
    name.className = "theme-slide-name";
    name.textContent = theme.name;

    const btn = document.createElement("button");
    btn.className = "theme-select-btn";
    btn.dataset.themeId = theme.id;

    if (theme.locked) {
      btn.textContent = "Locked";
      btn.classList.add("is-locked");
    } else if (this.current && this.current.id === theme.id) {
      btn.textContent = "Active";
      btn.classList.add("is-active");
    } else {
      btn.textContent = "Select";
      btn.addEventListener("click", () => {
        this.select(theme.id);
      });
    }

    card.appendChild(preview);
    card.appendChild(name);
    card.appendChild(btn);
    slide.appendChild(card);

    return slide;
  },

  renderCarousel() {
    const carousel = document.getElementById("themeCarousel");
    const dotsHost = document.getElementById("themeDots");
    if (!carousel || !dotsHost) return;

    const prevScroll = carousel.scrollLeft;

    carousel.innerHTML = "";
    dotsHost.innerHTML = "";

    this.LIST.forEach((theme, index) => {
      carousel.appendChild(this.buildSlide(theme));

      const dot = document.createElement("span");
      dot.className = "theme-dot";
      if (index === 0) dot.classList.add("is-active");
      dotsHost.appendChild(dot);
    });

    carousel.scrollLeft = prevScroll;

    if (!this.carouselBound) {
      carousel.addEventListener("scroll", () => this.updateDots());
      this.carouselBound = true;
    }

    this.updateDots();
  },

  updateDots() {
    const carousel = document.getElementById("themeCarousel");
    const dotsHost = document.getElementById("themeDots");
    if (!carousel || !dotsHost || carousel.clientWidth === 0) return;

    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    const dots = dotsHost.querySelectorAll(".theme-dot");

    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
  },

  bindUI() {
    const themeBtn = document.getElementById("themeBtn");
    const backBtn = document.getElementById("themeBackBtn");

    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        GameAudio.unlock();
        GameAudio.playClick();
        Haptics.vibrate(15);

        setTimeout(() => {
          this.openPage();
        }, 160);
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        GameAudio.playClick();
        Haptics.vibrate(15);

        setTimeout(() => {
          this.closePage();
        }, 140);
      });
    }
  }
};
