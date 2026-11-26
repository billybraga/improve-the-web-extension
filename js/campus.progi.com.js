if (!window.__itwLoaded) {
    console.log("Loading campus fixes");

    window.__itwLoaded = true;

    const targetVolume = 0.3;

    doLoop().catch(console.error);

    async function doLoop() {
        while (true) {
            /** @var {HTMLAudioElement} player */
            const player = document.querySelector('#lp_audio_media_player_html5');
            try {
                if (!player || player.dataset.__itwUpdated) {
                    continue;
                }

                player.dataset.__itwUpdated = "true";
                player.volume = targetVolume;
                player.playbackRate = 1.5;

                console.log("updated volume and rate");

                if (player.dataset.__itwCallback) {
                    continue;
                }

                player.dataset.__itwCallback = "true";
                const setVolume = async () => {
                    player.removeEventListener('play', setVolume);
                    for (let i = 0; i < 1000; i++) {
                        if (player.volume > targetVolume) {
                            player.volume = targetVolume;
                            console.log("updated AGAIN volume and rate");
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
