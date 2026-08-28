const Menu = {
  init() {
    const classicModeBtn = document.getElementById("classicModeBtn");

    classicModeBtn.addEventListener("click", () => {
      GameAudio.unlock();
      GameAudio.playClick();
      Haptics.vibrate(15);

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
