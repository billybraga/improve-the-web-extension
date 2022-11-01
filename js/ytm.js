if (!window.__ytmLoaded) {
    window.__ytmLoaded = true;

    console.info("Loaded theme");
    document.head.querySelector("meta[name=theme-color]").content = "#fff"

    console.info("Loaded fading");

    const fadeTime = 700;
    const volDelta = 1;
    const playBtn = document.getElementById("play-pause-button");

    const playerApi = document.getElementById("player").playerApi_;
    const volumeSlider = document.getElementById('volume-slider');
    let targetVolume = 50;

    const setVolume = (newVolume) => {
        console.info("Setting volume", newVolume);
        playerApi.setVolume(newVolume);
        volumeSlider.value = newVolume;
    };

    const fade = (dir, dest, cb) => {
        let startVolume = playerApi.getVolume();
        // Change 1% at a time, so calculate steps to take fadeTime in total
        let deltaTimeForChange = fadeTime / Math.abs(dest - startVolume);
        console.info("Will set volume to " + dest + " in " + deltaTimeForChange + " ms");
        
        innerFade();
        
        function innerFade() {
            let volume = playerApi.getVolume();
            if ((dir === -1 && volume <= dest) || (dir === 1 && volume >= dest)) {
                console.info("Set volume", volume);
                cb();
                return;
            }
            let newVolume = volume + (dir);
            setVolume(newVolume);
            setTimeout(innerFade, deltaTimeForChange);
        }
    };

    playBtn.addEventListener(
        'click',
        e => {
            e.stopImmediatePropagation();
            targetVolume = playerApi.getVolume();
            // 1 is play, 2 is pause
            if (playerApi.getPlayerState() === 1) {
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

    window.addEventListener("message", (event) => {
        // We only accept messages from ourselves
        if (event.source !== window) {
          return;
        }
      
        if (event.data.type && (event.data.type === "volume_change")) {
            console.log("Content script received", event.data);
            const { direction } = event.data.message;
            handleVolumeCommand(direction);
        }
      }, false);

    function handleVolumeCommand(direction) {
        let volume = playerApi.getVolume();
        const unit = direction === 'down' ? -1 : 1;
        const newVol = Math.min(100, Math.max(0, volume + (unit * volDelta)));
        setVolume(newVol);
    }
    
    console.info("Loaded shortcuts");
}
