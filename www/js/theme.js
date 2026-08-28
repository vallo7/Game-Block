const Theme = {
  bank: [
    { bg: "#FF5D5D", dark: "#D93A3A", light: "#FF8A8A" },
    { bg: "#FF8E3C", dark: "#E06B12", light: "#FFB27A" },
    { bg: "#FFC53F", dark: "#E0A416", light: "#FFD97A" },
    { bg: "#06D6A0", dark: "#04B183", light: "#5CE8C4" },
    { bg: "#00BBF9", dark: "#0092CC", light: "#5AD4FF" },
    { bg: "#2F6BFF", dark: "#1E4ED8", light: "#7A9BFF" },
    { bg: "#7C4DFF", dark: "#5F30E6", light: "#A58AFF" },
    { bg: "#F15BB5", dark: "#D03494", light: "#FF8ACD" },
    { bg: "#EF476F", dark: "#CC2750", light: "#FF7D9C" },
    { bg: "#00A896", dark: "#028274", light: "#4ED0C2" }
  ],

  menuIndex: 0,
  gameIndex: 0,

  current: {
    bg: "#2F6BFF",
    dark: "#1E4ED8",
    light: "#7A9BFF"
  },

  animFrame: null,

  init() {
    this.menuIndex = Math.floor(Math.random() * this.bank.length);
    this.gameIndex = this.menuIndex;
    this.cancelAnim();
    this.setCurrentFromBank(this.menuIndex);
  },

  setCurrentFromBank(index) {
    const color = this.bank[index];

    this.current = {
      bg: color.bg,
      dark: color.dark,
      light: color.light
    };

    this.pushCSS();
  },

  pushCSS() {
    const root = document.documentElement;

    root.style.setProperty("--theme-bg", this.current.bg);
    root.style.setProperty("--theme-dark", this.current.dark);
    root.style.setProperty("--theme-light", this.current.light);
  },

  useMenuColor() {
    this.gameIndex = this.menuIndex;
    this.cancelAnim();
    this.setCurrentFromBank(this.menuIndex);
  },

  shift(duration) {
    let next = Math.floor(Math.random() * this.bank.length);

    if (next === this.gameIndex) {
      next = (next + 1) % this.bank.length;
    }

    this.gameIndex = next;

    if (duration) {
      this.animateTo(next, duration);
    } else {
      this.cancelAnim();
      this.setCurrentFromBank(next);
    }
  },

  animateTo(index, duration) {
    this.cancelAnim();

    const target = this.bank[index];

    const from = {
      bg: this.hexToRgb(this.current.bg),
      dark: this.hexToRgb(this.current.dark),
      light: this.hexToRgb(this.current.light)
    };

    const to = {
      bg: this.hexToRgb(target.bg),
      dark: this.hexToRgb(target.dark),
      light: this.hexToRgb(target.light)
    };

    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t * t * (3 - 2 * t);

      this.current = {
        bg: this.mix(from.bg, to.bg, e),
        dark: this.mix(from.dark, to.dark, e),
        light: this.mix(from.light, to.light, e)
      };

      this.pushCSS();

      if (t < 1) {
        this.animFrame = requestAnimationFrame(step);
      } else {
        this.animFrame = null;
      }
    };

    this.animFrame = requestAnimationFrame(step);
  },

  cancelAnim() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  },

  mix(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);

    return this.rgbToHex(r, g, bl);
  },

  hexToRgb(hex) {
    const value = hex.replace("#", "");

    return [
      parseInt(value.substring(0, 2), 16),
      parseInt(value.substring(2, 4), 16),
      parseInt(value.substring(4, 6), 16)
    ];
  },

  rgbToHex(r, g, b) {
    const to = (v) => v.toString(16).padStart(2, "0");

    return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
  },

  rgb(hex) {
    return this.hexToRgb(hex).join(",");
  }
};
