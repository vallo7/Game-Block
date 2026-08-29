const Theme = {
bank: [
{ bg: "#E08A8A", dark: "#C06A6A", light: "#EBA8A8" },
{ bg: "#DD9A6B", dark: "#BC7F4F", light: "#E8B492" },
{ bg: "#D9B366", dark: "#B8944E", light: "#E5C88F" },
{ bg: "#5CB8A4", dark: "#439B87", light: "#8ACDBB" },
{ bg: "#6BB5D6", dark: "#4F97B5", light: "#97CBE3" },
{ bg: "#7A93D9", dark: "#5F79BC", light: "#A3B5E8" },
{ bg: "#9C86DC", dark: "#7F68BD", light: "#BBA9E9" },
{ bg: "#D68BC0", dark: "#B56CA2", light: "#E3AFD4" },
{ bg: "#D97E97", dark: "#B96079", light: "#E7A2B4" },
{ bg: "#63AFA5", dark: "#47948A", light: "#8FC8C0" }
],
menuIndex: 0,
gameIndex: 0,
current: {
bg: "#7A93D9",
dark: "#5F79BC",
light: "#A3B5E8"
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
