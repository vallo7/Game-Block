const Theme = {
bank: [
{ bg: "#E88383", dark: "#C46161", light: "#F2A6A6" },
{ bg: "#E89B6B", dark: "#C67A4B", light: "#F2B992" },
{ bg: "#E3BC5C", dark: "#C09C3C", light: "#EDD08A" },
{ bg: "#5CC9B4", dark: "#3AA894", light: "#8ADCCB" },
{ bg: "#5CB8E3", dark: "#3A97C2", light: "#8AD0EE" },
{ bg: "#6B86E8", dark: "#4A64C6", light: "#93A6F0" },
{ bg: "#9678E8", dark: "#7457C6", light: "#B29CF0" },
{ bg: "#E37BB8", dark: "#C15A97", light: "#EE9FCE" },
{ bg: "#E06D86", dark: "#BE4C66", light: "#EC93A6" },
{ bg: "#52B8A8", dark: "#33978A", light: "#7FCEC2" }
],
menuIndex: 0,
gameIndex: 0,
current: {
bg: "#6B86E8",
dark: "#4A64C6",
light: "#93A6F0"
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
