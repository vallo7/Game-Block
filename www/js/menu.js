const Menu = {
  init() {
    const classicModeBtn = document.getElementById("classicModeBtn");

    classicModeBtn.addEventListener("click", () => {
      Tutorial.handleClassicTap();
      GameAudio.unlock();
      GameAudio.playModeSelect();
      Haptics.vibrate(15);

      if (!Tutorial.active) {
        Ads.maybeShowInterstitial(1 / 5);
      }

      setTimeout(() => {
        App.showGame();
      }, 220);
    });

    document.querySelectorAll(".mode-card.locked").forEach(button => {
      button.addEventListener("click", () => {
        GameAudio.playClick();
        Haptics.vibrate(15);
      });
    });
  }
};
