if (!window.__itwLoaded) {
    console.log("Loading campus fixes");

    window.__itwLoaded = true;

    doLoop().catch(console.error);

    async function doLoop() {
        while (true) {
            /** @var {HTMLAudioElement} player */
            const player = document.getElementById('lp_audio_media_player_html5');
            try {
                if (!player || player.dataset.__itwUpdated) {
                    continue;
                }

                player.dataset.__itwUpdated = "true";
                player.volume = 0.1;
                player.playbackRate = 1.5;

                if (player.dataset.__itwCallback) {
                    continue;
                }

                player.dataset.__itwCallback = "true";
                const setVolume = async () => {
                    player.removeEventListener('play', setVolume);
                    for (let i = 0; i < 100; i++) {
                        if (player.volume > 0.7) {
                            player.volume = 0.1;
                            return;
                        } else {
                            await sleep(10);
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
