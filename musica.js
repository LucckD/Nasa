document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. REFERÊNCIAS AOS ELEMENTOS ---
    const music = document.getElementById("background-music");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const volumeDownBtn = document.getElementById("volume-down-btn");
    const volumeUpBtn = document.getElementById("volume-up-btn");

    // --- 2. CONFIGURAÇÃO INICIAL ---
    music.volume = 0.05;

    // --- 3. LÓGICA DOS BOTÕES ---

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

    // --- 4. ADICIONA OS EVENTOS DE CLIQUE ---
    playPauseBtn.addEventListener("click", togglePlayPause);
    volumeUpBtn.addEventListener("click", volumeUp);
    volumeDownBtn.addEventListener("click", volumeDown);
});