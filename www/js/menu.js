const Menu = {
  init() {
    const classicModeBtn = document.getElementById("classicModeBtn");

    classicModeBtn.addEventListener("click", () => {
      GameAudio.unlock();
      GameAudio.playClick();
      Haptics.vibrate(8);
      App.showGame();
    });

    document.querySelectorAll(".mode-card.locked").forEach(button => {
      button.addEventListener("click", () => {
        GameAudio.playClick();
        Haptics.vibrate(10);
      });
    });
  }
};
