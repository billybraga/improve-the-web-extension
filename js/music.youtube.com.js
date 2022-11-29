if (!window.__itwLoaded) {
    window.__itwLoaded = true;

    const debugLogs = false;

    function logDebug() {
        if (debugLogs) {
            console.log.apply(console, arguments);
        }
    }

    console.info("Loaded theme");
    document.documentElement.removeAttribute('dark');
    document.documentElement.setAttribute('light', 'true');
    document.head.querySelector("meta[name=theme-color]").content = "#fff"

    console.info("Loaded fading");

    const fadeTime = 700;
    const steps = 30;
    const playBtn = document.getElementById("play-pause-button");
    const videoTag = document.getElementsByTagName("video")[0];
    const playerApi = document.getElementById("player").playerApi_;
    const volumeSlider = document.getElementById('volume-slider');
    let targetVolume = 50;

    function getPlayerApi() {
        return playerApi;
    }

    function getVidTagVolume() {
        return videoTag.volume * 100;
    }

    function setVidTagVolume(newVolume) {
        logDebug("Setting tag volume", newVolume);
        videoTag.volume = Math.min(1, newVolume / 100);
    }

    function setApiVolume(newVolume) {
        logDebug("Setting api volume", newVolume);
        playerApi.setVolume(newVolume);
        volumeSlider.value = newVolume;
    }

    const oldVolStr = localStorage["__ytmVol"];
    if (oldVolStr) {
        const newVolume = parseFloat(oldVolStr);
        setApiVolume(Math.ceil(newVolume));
        setVidTagVolume(newVolume)
    }

    const fade = (dir, dest, cb) => {
        const startVolume = playerApi.getVolume();
        const delta = Math.abs(dest - startVolume) / steps;
        // 30 steps
        const deltaTimeForChange = fadeTime / steps;
        console.info("Will set volume to " + dest + " in " + steps + " " + deltaTimeForChange + "ms / " + delta + "% steps");

        innerFade();

        function innerFade() {
            let tagVol = getVidTagVolume();
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
                type: "progress",
                title: "Youtube Music"
            };
            let vol = getPlayerApi().getVolume();
            let instant = true;
            if (event.data.type === "volume_change") {
                vol = handleVolumeCommand(event.data.arg);
                notif.message = "Volume " + event.data.arg + " to " + vol.toFixed(1) + "%";
                instant = false;
            } else if (event.data.type === "play_pause") {
                playBtn.click();
                // 1 is play, 2 is pause
                if (getPlayerApi().getPlayerState() === 1) {
                    notif.message = "Pause";
                } else {
                    notif.message = "Play";
                }
            } else if (event.data.type === "track") {
                if (event.data.arg === "next") {
                    notif.message = "Next";
                    getPlayerApi().nextVideo();
                } else if (event.data.arg === "prev") {
                    notif.message = "Previous";
                    getPlayerApi().previousVideo();
                }
            }

            notif.progress = Math.max(1, Math.round(vol));
            const notifId = event.data.type;
            window.postMessage(
                {
                    type: "notif",
                    notifId: notifId,
                    notif,
                    destination: "extension",
                    instant,
                    tabIndex: event.data.tabIndex,
                    tabWindowId: event.data.tabWindowId,
                });
        }
    }, false);

    function handleVolumeCommand(direction) {
        let volume = getVidTagVolume();
        const unit = direction === 'down' ? -1 : 1;
        const relativeChange = roundTenth(unit * (0.1 + (4 * volume / 100.0)));
        const newVol = roundTenth(
            Math.min(
                100,
                Math.max(
                    0,
                    volume + relativeChange
                )
            )
        );
        console.info("will change volume of " + relativeChange + " to " + newVol);
        setApiVolume(Math.ceil(newVol));
        setVidTagVolume(newVol);
        localStorage["__ytmVol"] = newVol.toString();
        return newVol;
    }

    function roundTenth(n) {
        return 0.1 * Math.round(10 * n);
    }

    console.info("Loaded shortcuts");
}
