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
