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
    const volChangeMinStep = 2 * minVolChange;
    const fadeTime = 700;
    const fadeSteps = 30;
    const playBtn = document.getElementById("play-pause-button");
    const videoTag = document.getElementsByTagName("video")[0];
    const playerApi = document.getElementById("player").playerApi;
    const volumeSlider = document.getElementById('volume-slider');
    
    /** @var {HTMLMediaElement} volChangeAudio */
    const volChangeAudio = document.getElementById('vol-change-sound');
    
    let targetVolume = 50;
    let expectedChangeVolumeEventCount = 0;
    let tabIndex = -1;
    let tabWindowId = -1;

    videoTag.onvolumechange = e => {
        expectedChangeVolumeEventCount--;
        if (expectedChangeVolumeEventCount < 0) {
            expectedChangeVolumeEventCount = 0;
            console.info("Got umexpected video tag volumechange, cancelling", e, new Error().stack.toString());
            setTimeout(() => setVolume(targetVolume), 1);
            return;
        }

        logDebug("Got expected video tag volumechange", e);
    };

    volumeSlider.onchange = () => {
        setVolume(volumeSlider.value, true);
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
    // newState 1 : playing
    // newState 2 : paused
    playerApi.addEventListener('onStateChange', function (newState) {
        console.info("playerApi.onStateChange", arguments);
        console.info("playerApi event tag vol", "onStateChange", getVidTagVolume());
        if (!onStateChangeVolChangeTimeout) {
            onStateChangeVolChangeTimeout = setTimeout(() => {
                onStateChangeVolChangeTimeout = null;
                console.info("playerApi event tag vol", "onStateChange", getVidTagVolume());
                updateVol();
            }, 150);
        }

        const notifTitle = newState === 1
            ? 'Playing'
            : newState === 2
                ? 'Paused'
                : null;
        if (notifTitle) {
            notify(notifTitle, notifTitle, getVidTagVolume(), 5000);
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

    function getPlayerState(inverse) {
        // 1 is play, 2 is pause
        const play = inverse ? 2 : 1;
        if (getPlayerApi().getPlayerState() === play) {
            return {name: "Play", verb: "playing"};
        } else {
            return {name: "Pause", verb: "paused"};
        }
    }

    function setVolume(newVolume, makeNewTarget = true) {
        if (makeNewTarget) {
            targetVolume = newVolume;
            console.info("Setting new volume", newVolume);
        } else {
            logDebug("Setting temp volume", newVolume);
        }
        const intVol = Math.max(1, Math.round(newVolume));
        expectedChangeVolumeEventCount++;
        playerApi.setVolume(intVol);
        volumeSlider.value = intVol;
        expectedChangeVolumeEventCount++;
        videoTag.volume = Math.min(1, newVolume / 100);
    }

    const fade = (dir, dest, cb) => {
        const startVolume = getVidTagVolume();
        const delta = Math.abs(dest - startVolume) / fadeSteps;
        // 30 steps
        const deltaTimeForChange = fadeTime / fadeSteps;
        console.info("Will set volume to " + dest + " in " + fadeSteps + " " + deltaTimeForChange + "ms / " + delta + "% steps");

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

            tabIndex = event.data.tabIndex;
            tabWindowId = event.data.tabWindowId;

            if (event.data.type === "volume_change") {
                volChangeAudio.play().catch(e => console.error("Error playing sound", e));
                const vol = handleVolumeCommand(event.data.arg);
                let playerState = getPlayerState();
                const title = "Volume " + event.data.arg + " to " + vol.toFixed(volChangeRoundDigits) + "% (" + playerState.verb + ")";
                notify(event.data.type, title, vol, 2000, false);
            } else if (event.data.type === "play_pause") {
                playBtn.click();
            } else if (event.data.type === "track") {
                if (event.data.arg === "next") {
                    getPlayerApi().nextVideo();
                } else if (event.data.arg === "prev") {
                    getPlayerApi().previousVideo();
                }
            }

        }
    }, false);

    function notify(type, title, vol, notifTimeMs, instant = true) {
        const songTitle = document.querySelector(".ytmusic-player-bar .title")?.textContent;
        const authorAndMore = document.querySelector(".ytmusic-player-bar .subtitle .byline")?.textContent;
        let notif = {
            type: "progress"
        };
        notif.message = songTitle || authorAndMore ? `${songTitle} • ${authorAndMore}` : '';
        notif.progress = Math.max(1, Math.round(vol));
        notif.title = title;
        window.postMessage(
            {
                type: "notif",
                notifId: type,
                notifTimeMs,
                notif,
                destination: "extension",
                instant,
                tabIndex,
                tabWindowId,
            });
    }

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
