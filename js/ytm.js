if (!window.__ytmLoaded) {
    window.__ytmLoaded = true;

    const debugLogs = false;

    function logDebug() {
        if (debugLogs) {
            console.log.apply(console, arguments);
        }
    }

    console.info("Loaded theme");
    document.head.querySelector("meta[name=theme-color]").content = "#fff"

    console.info("Loaded fading");

    const fadeTime = 700;
    const steps = 30;
    const volDelta = 1;
    const playBtn = document.getElementById("play-pause-button");
    const videoTag = document.getElementsByTagName("video")[0];
    const playerApi = document.getElementById("player").playerApi_;
    const volumeSlider = document.getElementById('volume-slider');
    let targetVolume = 50;

    const setVidTagVolume = (newVolume) => {
        logDebug("Setting tag volume", newVolume);
        videoTag.volume = Math.min(1, newVolume / 100);
    };

    const setApiVolume = (newVolume) => {
        logDebug("Setting api volume", newVolume);
        playerApi.setVolume(newVolume);
        volumeSlider.value = newVolume;
    };

    const oldVolStr = localStorage["__ytmVol"];
    if (oldVolStr) {
        setApiVolume(parseFloat(oldVolStr));
    }

    const fade = (dir, dest, cb) => {
        const startVolume = playerApi.getVolume();
        const delta = Math.abs(dest - startVolume) / steps;
        // 30 steps
        const deltaTimeForChange = fadeTime / steps;
        console.info("Will set volume to " + dest + " in " + steps + " " + deltaTimeForChange + "ms / " + delta + "% steps");

        innerFade();

        function innerFade() {
            let tagVol = videoTag.volume * 100;
            if ((dir === -1 && tagVol <= dest) || (dir === 1 && tagVol >= dest)) {
                setApiVolume(tagVol);
                console.info("Set volume", tagVol);
                cb();
                return;
            }
            let newVolume = Math.max(0, tagVol + (dir * delta));
            setVidTagVolume(newVolume);
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
                        setApiVolume(targetVolume);
                    }
                );
            } else {
                console.info("Will trigger play and fade");
                // always start at zero when playing
                setApiVolume(0);
                // press play
                playerApi.playVideo();
                fade(
                    1,
                    targetVolume,
                    () => {
                    }
                );
            }
        },
        true
    );

    window.addEventListener("message", (event) => {
        console.info("got message in ytm", event);
        // We only accept messages from ourselves
        if (event.source !== window || event.data.destination !== 'content') {
            return;
        }

        if (event.data.type) {
            console.log("Content script received", event.data);
            let notif = {
                type: "basic",
                title: "Youtube Music"
            };
            let instant = true;
            if (event.data.type === "volume_change") {
                const newVol = handleVolumeCommand(event.data.arg);
                const newVolInt = Math.round(newVol);
                notif.message = "Volume " + event.data.arg;
                notif.progress = newVolInt;
                notif.type = "progress";
                instant = false;
            } else if (event.data.type === "play_pause") {
                notif.progress = playerApi.getVolume();
                notif.type = "progress";
                playBtn.click();
                // 1 is play, 2 is pause
                if (playerApi.getPlayerState() === 1) {
                    notif.message = "Pause";
                } else {
                    notif.message = "Play";
                }
            }

            const notifId = event.data.type;
            window.postMessage(
                {
                    type: "notif",
                    notifId: notifId,
                    notif,
                    destination: "extension",
                    instant
                });
        }
    }, false);

    function handleVolumeCommand(direction) {
        let volume = playerApi.getVolume();
        const unit = direction === 'down' ? -1 : 1;
        const relativeChange = unit * volDelta * (1 + (4 * volume / 100.0));
        console.info("will change volume of", relativeChange);
        const newVol = Math.min(
            100,
            Math.max(
                0,
                volume + relativeChange
            )
        );
        setApiVolume(newVol);
        localStorage["__ytmVol"] = newVol.toString();
        return newVol;
    }

    console.info("Loaded shortcuts");
}
