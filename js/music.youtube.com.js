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

    const volChangeRoundDigits = 0;
    const minVolChange = Math.pow(10, -volChangeRoundDigits);
    const volChangeMinStep = minVolChange;
    const fadeTime = 700;
    const steps = 30;
    const playBtn = document.getElementById("play-pause-button");
    const videoTag = document.getElementsByTagName("video")[0];
    const playerApi = document.getElementById("player").playerApi_;
    const volumeSlider = document.getElementById('volume-slider');
    let targetVolume = 5;
    let changingVolume = false;

    videoTag.volumechange = e => {
        if (!changingVolume) {
            console.info("Got video tag volumechange event outside of changingVolume=true, cancelling", e);
            setTimeout(() => setVolume(targetVolume), 1);
            return;
        }

        console.info("Got video tag volumechange inside of changingVolume=true", e);
    };

    volumeSlider.onchange = () => {
        targetVolume = volumeSlider.value;
        console.info("Setting new volume from slider event", volumeSlider.value);
    };

    const oldVolStr = localStorage["__ytmVol"];
    if (oldVolStr) {
        setVolume(parseFloat(oldVolStr))
    }

    const logEvents = ['onPlaybackQualityChange', 'onPlaybackRateChange', 'onError', 'onApiChange'];
    for (const logEvent of logEvents) {
        playerApi.addEventListener(logEvent, function () {
            console.info("playerApi event", logEvent, arguments);
            console.info("playerApi event tag vol", logEvent, getVidTagVolume());

            setTimeout(() => {
                console.info("playerApi event tag vol", logEvent, getVidTagVolume());
            }, 150);
        });
    }

    let onStateChangeVolChangeTimeout = null;
    playerApi.addEventListener('onStateChange', function () {
        console.info("playerApi.onStateChange", arguments);
        console.info("playerApi event tag vol", "onStateChange", getVidTagVolume());
        if (!onStateChangeVolChangeTimeout) {
            onStateChangeVolChangeTimeout = setTimeout(() => {
                onStateChangeVolChangeTimeout = null;
                console.info("playerApi event tag vol", "onStateChange", getVidTagVolume());
                updateVol();
            }, 150);
        }
    });

    function updateVol() {
        setVolume(targetVolume);
    }

    function getPlayerApi() {
        return playerApi;
    }

    function getVidTagVolume() {
        return videoTag.volume * 100;
    }

    function setVolume(newVolume, makeNewTarget = true) {
        try {
            changingVolume = true;
            if (makeNewTarget) {
                targetVolume = newVolume;
                console.info("Setting new volume", newVolume);
            } else {
                logDebug("Setting temp volume", newVolume);
            }
            const intVol = Math.max(1, Math.round(newVolume));
            playerApi.setVolume(intVol);
            volumeSlider.value = intVol;
            videoTag.volume = Math.min(1, newVolume / 100);
        } finally {
            changingVolume = false;
        }
    }

    const fade = (dir, dest, cb) => {
        const startVolume = getVidTagVolume();
        const delta = Math.abs(dest - startVolume) / steps;
        // 30 steps
        const deltaTimeForChange = fadeTime / steps;
        console.info("Will set volume to " + dest + " in " + steps + " " + deltaTimeForChange + "ms / " + delta + "% steps");

        innerFade();

        function innerFade() {
            let tagVol = getVidTagVolume();
            if ((dir === -1 && tagVol <= dest) || (dir === 1 && tagVol >= dest)) {
                setVolume(dest, false);
                console.info("Set volume", tagVol);
                cb();
                return;
            }
            let newVolume = Math.max(0, tagVol + (dir * delta));
            setVolume(newVolume, false);
            setTimeout(innerFade, deltaTimeForChange);
        }
    };

    playBtn.addEventListener(
        'click',
        e => {
            e.stopImmediatePropagation();
            targetVolume = getVidTagVolume();
            // 1 is play, 2 is pause
            if (playerApi.getPlayerState() === 1) {
                console.info("Will trigger pause after fade");
                fade(
                    -1,
                    0,
                    () => {
                        playerApi.pauseVideo()
                        // put volume back
                        setVolume(targetVolume, false);
                    }
                );
            } else {
                console.info("Will trigger play and fade");
                // always start at zero when playing
                setVolume(0, false);
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
            let vol = getVidTagVolume();
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
        const startVol = getVidTagVolume();
        const unit = direction === 'down' ? -1 : 1;
        const relativeChange = unit * Math.max(
            minVolChange,
            roundN(
                (volChangeMinStep + (4 * startVol / 100.0)),
                volChangeRoundDigits
            )
        );
        const newVol = roundN(
            Math.min(
                100,
                Math.max(
                    0,
                    startVol + relativeChange
                )
            ),
            volChangeRoundDigits
        );
        console.info(`will change volume by ${relativeChange}, from ${startVol} to ${newVol}`);
        setVolume(newVol);
        localStorage["__ytmVol"] = newVol.toString();
        return newVol;
    }

    function roundN(value, digits) {
        const tenToN = 10 ** digits;
        return (Math.round(value * tenToN)) / tenToN;
    }

    console.info("Loaded shortcuts");
}
