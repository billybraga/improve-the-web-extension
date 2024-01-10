if (!window.__itwLoaded) {
    window.__itwLoaded = true;

    console.log("yt");

    let lastHref;

    setInterval(checkPageChange, 100);

    function checkPageChange() {
        if (lastHref === location.href) {
            return;
        }
        lastHref = location.href;
        console.log("check page");
        // if (location.href.indexOf("/watch") !== -1) {
        //     showCommentsOnTheRight();
        // }

        if (location.href.indexOf("/playlist") !== -1) {
            loadWatchlistPage();
        }
    }

    const debugLogs = false;

    function logDebug() {
        if (debugLogs) {
            console.log.apply(console, arguments);
        }
    }

    const volDelta = 1;

    console.info("Loaded theme");
    document.head.querySelector("meta[name=theme-color]").content = "#fff"

    console.info("Loading controls");

    const getPlayerApi = (function () {
        let playerApi;
        return function () {
            return playerApi = playerApi || document.querySelector("[role=main]").player;
        };
    })();

    const setApiVolume = (newVolume) => {
        logDebug("Setting api volume", newVolume);
        getPlayerApi().setVolume(newVolume);
    };

    window.addEventListener("message", (event) => {
        console.info("got message in yt", event);
        // We only accept messages from ourselves
        if (event.source !== window || event.data.destination !== 'content') {
            return;
        }

        if (event.data.type) {
            console.log("Content script received", event.data);
            let notif = {
                type: "progress",
                title: "Youtube"
            };
            let instant = true;
            if (event.data.type === "volume_change") {
                handleVolumeCommand(event.data.arg);
                notif.message = "Volume " + event.data.arg;
                instant = false;
            } else if (event.data.type === "play_pause") {
                // 1 is play, 2 is pause
                if (getPlayerApi().getPlayerState() === 1) {
                    notif.message = "Pause";
                    getPlayerApi().pauseVideo();
                } else {
                    notif.message = "Play";
                    getPlayerApi().playVideo();
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

            notif.progress = getPlayerApi().getVolume();
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
        let volume = getPlayerApi().getVolume();
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
        return newVol;
    }

    console.info("Loaded shortcuts");

    /**
     * comments on left, not used
     */

    function showCommentsOnTheRight() {
        console.log("showCommentsOnTheRight");
        if (!comments() || !watchNext()) {
            window.setTimeout(showCommentsOnTheRight, 500);
            return;
        }
        swapCommentsAndWatchNext();
    }

    function swapCommentsAndWatchNext() {
        console.log("swapCommentsAndWatchNext");
        if (!panelsContainNodes()) {
            return;
        }
        let commentsNode = leftPanel().removeChild(comments());
        let watchNextNode = rightPanel().removeChild(watchNext());
        leftPanel().appendChild(watchNextNode);
        rightPanel().appendChild(commentsNode);
    }

    function comments() {
        return document.getElementById('comments');
    }

    function watchNext() {
        return document.getElementById('related');
    }

    function panelsContainNodes() {
        return leftPanel().contains(comments()) && rightPanel().contains(watchNext());
    }

    function rightPanel() {
        return document.getElementById('secondary-inner');
    }

    function leftPanel() {
        return document.getElementById('below');
    }

    function loadWatchlistPage() {
        console.log("watchlist page");

        const nodes = document
            .querySelectorAll(
                'ytd-browse ytd-playlist-video-renderer, ytd-browse a.ytd-playlist-video-renderer, ytd-browse ytd-video-meta-block, ytd-browse ytd-playlist-video-renderer ytd-video-meta-block .ytd-channel-name a'
            );
        for (let node of nodes) {
            node.addEventListener('click', evt => {
                if (evt.ctrlKey && evt.shiftKey) {
                    console.log('yeah');
                    evt.stopImmediatePropagation();
                    evt.preventDefault();
                    // deleteFromWatchlist();
                    return false;
                }
            });
        }
    }

    function deleteFromWatchlist() {
        fetch("https://www.youtube.com/youtubei/v1/browse/edit_playlist?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false", {
            "body": JSON.stringify(
                {
                    "context": {
                        "client": {},
                        "user": {"lockedSafetyMode": false},
                        "request": {"useSsl": true, "internalExperimentFlags": [], "consistencyTokenJars": []},
                        "adSignalsInfo": {}
                    },
                    "actions": [{"setVideoId": "8588FA9ACFBD88BA", "action": "ACTION_REMOVE_VIDEO"}],
                    "params": "CAFAAQ%3D%3D",
                    "playlistId": "WL"
                }
            ),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });
    }
}
