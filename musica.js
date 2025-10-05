document.addEventListener("DOMContentLoaded", () => {
    
    const music = document.getElementById("background-music");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const volumeDownBtn = document.getElementById("volume-down-btn");
    const volumeUpBtn = document.getElementById("volume-up-btn");

    music.volume = 0.05;

    // Tenta iniciar a música após a primeira interação do usuário com a página
    function startMusicOnFirstInteraction() {
      if (music.paused) {
        music.play().catch(() => {}); // O catch evita erros se o autoplay for bloqueado
        playPauseBtn.classList.add("playing");
      }
      document.body.removeEventListener('mousemove', startMusicOnFirstInteraction);
    }

      function togglePlayPause() {
        if (music.paused) {
            music.play();
            playPauseBtn.classList.add("playing");
        } else {
            music.pause();
            playPauseBtn.classList.remove("playing");
        }
    }

    function volumeUp() {
        if (music.volume < 1) {
            music.volume = Math.min(1, music.volume + 0.05);
        }
    }

    function volumeDown() {
        if (music.volume > 0) {
            music.volume = Math.max(0, music.volume - 0.05);
        }
    }

    playPauseBtn.addEventListener("click", togglePlayPause);
    volumeUpBtn.addEventListener("click", volumeUp);
    volumeDownBtn.addEventListener("click", volumeDown);
    document.body.addEventListener('mousemove', startMusicOnFirstInteraction, { once: true });
});