const Menu = {
  init() {
    const classicModeBtn = document.getElementById("classicModeBtn");

    classicModeBtn.addEventListener("click", () => {
      GameAudio.unlock();
      Haptics.vibrate(8);
      App.showGame();
    });

    document.querySelectorAll(".mode-card.locked").forEach(button => {
      button.addEventListener("click", () => {
        Haptics.vibrate(10);
      });
    });
  }
};
