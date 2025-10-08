if (!window.__itwLoaded) {
    window.__itwLoaded = true;

    console.log("yt");

    let lastHref;

    setInterval(checkPageChange, 100);

    async function checkPageChange() {
        if (lastHref === location.href) {
            return;
        }
        lastHref = location.href;
        console.log("check page");

        if (location.href.indexOf("/playlist") !== -1) {
            await loadWatchlistPage();
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

    function sleep(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    async function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    async function loadWatchlistPage() {

        if (window.__itwWatchListLoaded) {
            console.log("skipping watchlist page");
            return;
        }

        console.log("watchlist page");
        window.__itwWatchListLoaded = true;

        await sleep(1000);

        const nodes = document
            .querySelectorAll(
                'ytd-playlist-video-list-renderer #contents ytd-playlist-video-renderer'
            );

        for (let node of nodes) {
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '️🗑️';
            deleteButton.onclick = async () => {
                node.querySelector('#menu button#button').click();
                for (let i = 0; i < 5; i++) {
                    await nextFrame();
                    const dropdowns = document.querySelectorAll('ytd-popup-container tp-yt-iron-dropdown');
                    if (dropdowns.length !== 1) {
                        console.log('did not find the dropdown menu', dropdowns);
                        continue;
                    }
                    const dropdown = dropdowns[0];
                    const deleteMenu = dropdown.querySelectorAll('ytd-menu-service-item-renderer')[2];
                    if (!deleteMenu) {
                        console.log('did not find delete menu', dropdown);
                        continue;
                    }
                    const deleteMenuLabel = deleteMenu.querySelector('yt-formatted-string');
                    if (deleteMenuLabel?.textContent !== 'Remove from Watch later') {
                        console.log('3rd menu label is not remove', deleteMenuLabel);
                        continue;
                    }
                    deleteMenu.click();
                    return;
                }
            };
            node.appendChild(deleteButton);
        }
    }
}
