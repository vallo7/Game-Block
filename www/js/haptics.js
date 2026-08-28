const Haptics = {
  enabled: true,

  setEnabled(value) {
    this.enabled = value;
  },

  hasPlugin() {
    return Boolean(
      window.Capacitor &&
      Capacitor.Plugins &&
      Capacitor.Plugins.Haptics
    );
  },

  vibrate(pattern) {
    if (!this.enabled) return;

    if (this.hasPlugin()) {
      const HapticsPlugin = Capacitor.Plugins.Haptics;

      const isLong = typeof pattern === "number" && pattern >= 300;
      const isStrong =
        Array.isArray(pattern) ||
        (typeof pattern === "number" && pattern >= 40);

      if (isLong) {
        HapticsPlugin.impact({ style: "HEAVY" });

        setTimeout(() => {
          HapticsPlugin.impact({ style: "HEAVY" });
        }, 180);

        setTimeout(() => {
          HapticsPlugin.impact({ style: "HEAVY" });
        }, 360);
      } else if (isStrong) {
        HapticsPlugin.impact({ style: "HEAVY" });
      } else {
        HapticsPlugin.impact({ style: "MEDIUM" });
      }

      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }
};
