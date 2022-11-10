if (!window.__itwLoaded) {
    window.__itwLoaded = true;

    console.log("yt");

    var lastHref;

//setInterval(checkIsVideoPage, 100);

    function checkIsVideoPage() {
        if (lastHref == location.href) {
            return;
        }
        lastHref = location.href;
        console.log("checkIsVideoPage");
        if (location.href.indexOf("/watch") !== -1) {
            //showCommentsOnTheRight();
            adustVidHeight();
        }
    }

    function adustVidHeight() {
        //var vid = document.querySelector("#columns #movie_player .html5-video-container video.html5-main-video");

    }

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
}
