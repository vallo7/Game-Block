const Haptics = {
  enabled: true,

  setEnabled(value) {
    this.enabled = value;
  },

  vibrate(pattern) {
    if (!this.enabled) return;

    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }
};
