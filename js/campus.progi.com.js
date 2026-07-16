if (!window.__itwLoaded) {
    console.log("Loading campus fixes");

    window.__itwLoaded = true;

    doLoop().catch(console.error);

    const targetVolume = 0.8;

    async function doLoop() {
        while (true) {
            /** @var {HTMLAudioElement} player */
            const player = document.querySelector('#cm-content video');
            try {
                if (!player || player.dataset.__itwUpdated) {
                    continue;
                }

                player.dataset.__itwUpdated = "true";
                player.volume = targetVolume;
                player.playbackRate = 1.5;

                if (player.dataset.__itwCallback) {
                    continue;
                }

                player.dataset.__itwCallback = "true";
                const setVolume = async () => {
                    player.removeEventListener('play', setVolume);
                    for (let i = 0; i < 1000; i++) {
                        if (player.volume > targetVolume) {
                            player.volume = targetVolume;
                            return;
                        } else {
                            await sleep(1);
                        }
                    }
                };
                player.addEventListener('play', setVolume);
            } finally {
                await sleep(100);
            }
        }
    }

    function sleep(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }
}
