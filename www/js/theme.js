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

  init() {
    this.menuIndex = Math.floor(Math.random() * this.bank.length);
    this.gameIndex = this.menuIndex;
    this.apply(this.menuIndex);
  },

  apply(index) {
    const color = this.bank[index];
    const root = document.documentElement;

    root.style.setProperty("--theme-bg", color.bg);
    root.style.setProperty("--theme-dark", color.dark);
    root.style.setProperty("--theme-light", color.light);
  },

  useMenuColor() {
    this.gameIndex = this.menuIndex;
    this.apply(this.menuIndex);
  },

  shift() {
    let next = Math.floor(Math.random() * this.bank.length);

    if (next === this.gameIndex) {
      next = (next + 1) % this.bank.length;
    }

    this.gameIndex = next;
    this.apply(next);
  },

  rgb(hex) {
    const value = hex.replace("#", "");

    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);

    return `${r},${g},${b}`;
  },

  get current() {
    return this.bank[this.gameIndex];
  }
};
