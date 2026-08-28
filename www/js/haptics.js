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
        HapticsPlugin.impact({ style: "MEDIUM" });

        setTimeout(() => {
          HapticsPlugin.impact({ style: "MEDIUM" });
        }, 160);

        setTimeout(() => {
          HapticsPlugin.impact({ style: "MEDIUM" });
        }, 320);
      } else if (isStrong) {
        HapticsPlugin.impact({ style: "MEDIUM" });
      } else {
        HapticsPlugin.impact({ style: "LIGHT" });
      }

      return;
    }

    if (navigator.vibrate) {
      if (typeof pattern === "number" && pattern >= 300) {
        navigator.vibrate([15, 30, 15, 30, 15]);
      } else if (Array.isArray(pattern) || (typeof pattern === "number" && pattern >= 40)) {
        navigator.vibrate(18);
      } else {
        navigator.vibrate(8);
      }
    }
  }
};
