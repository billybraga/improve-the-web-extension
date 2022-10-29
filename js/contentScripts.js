document.head.querySelector("meta[name=theme-color]").content = "#fff"

// Fade
console.warn("Loaded fading");

const fadeTime = 700;
const playBtn = document.getElementById("play-pause-button");
let playerApi = document.getElementById("player").playerApi_;
let targetVolume = 50;

const setVolume = (newVolume) => {
    console.info("Setting volume", newVolume);
    playerApi.setVolume(newVolume);
};

const fade = (dir, dest, cb) => {
    let startVolume = playerApi.getVolume();
    // Change 1% at a time, so calculate steps to take fadeTime in total
    let deltaTimeForChange = fadeTime / Math.abs(dest - startVolume);
    console.info("Will set volume to " + dest + " in " + deltaTimeForChange + " ms");
    
    innerFade();
    
    function innerFade() {
        let volume = playerApi.getVolume();
        if ((dir == -1 && volume <= dest) || (dir == 1 && volume >= dest)) {
            console.info("Set volume", volume);
            cb();
            return;
        }
        let newVolume = volume + (dir);
        setVolume(newVolume);
        setTimeout(innerFade, deltaTimeForChange);
    };
};

playBtn.addEventListener(
    'click',
    e => {
        e.stopImmediatePropagation();
        targetVolume = playerApi.getVolume();
        // 1 is play, 2 is pause
        if (playerApi.getPlayerState() == 1) {
            console.info("Will trigger pause after fade");
            fade(
                -1,
                0,
                () => {
                    playerApi.pauseVideo()
                    // put volume back
                    setVolume(targetVolume);
                }
            );
        } else {
            console.info("Will trigger play and fade");
            // always start at zero when playing
            setVolume(0);
            // press play
            playerApi.playVideo();
            fade(
                1,
                targetVolume,
                () => {}
            );
        }
    },
    true
);