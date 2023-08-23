if (!window.__itwLoaded) {
    window.__itwLoaded = true;
    const SPRINT_PAGE = 'sprint';
    const WORK_ITEM_PAGE = 'work item';
    const BUILD_RESULTS_PAGE = 'build results';
    const fixers = {
        [SPRINT_PAGE]: augmentSprint,
        [WORK_ITEM_PAGE]: augmentWorkItem,
        [BUILD_RESULTS_PAGE]: fixBuildResults,
    }
    let lastHref;
    let sprintAugmented = false;
    let lastPage = null;
    setInterval(checkPage, 100);

    function checkPage() {
        if (lastHref === location.href) {
            return;
        }

        lastHref = location.href;
        let page = null;

        if (lastHref.indexOf("_build/results") !== -1) {
            page = BUILD_RESULTS_PAGE;
        } else if (lastHref.indexOf("_sprints/taskboard") !== -1) {
            if (lastHref.indexOf("workitem=") === -1) {
                page = SPRINT_PAGE;
            } else {
                page = WORK_ITEM_PAGE;
            }
        } else if (lastHref.indexOf("_workitems/edit") !== -1) {
            page = WORK_ITEM_PAGE;
        }

        if (page) {
            console.info("Fixing", page);
            fixers[page]();
        }
    }

    function fixBuildResults() {
        console.info("fix elems");
        var elems = document.querySelectorAll(".dark-run-logs");

        for (var i = 0; i < elems.length; i++) {
            elems[i].classList.remove("dark-run-logs");
        }
    }

    function augmentSprint() {
        if (sprintAugmented) {
            return;
        }
        sprintAugmented = true;
        console.info("augmentSprint");
        const versionParts = location.pathname.split('.');
        const versionStr = versionParts.pop();
        let minor = parseInt(versionStr);
        if (isNaN(minor)) {
            console.error(versionStr + ' is NaN');
            return;
        }
        const bntNextHtml = `
    <button class="bolt-split-button-main bolt-button bolt-icon-button enabled bolt-focus-treatment" role="button" type="button">
    <span class="bolt-button-text body-m">Next &gt;</span>
    <span aria-hidden="true" class="fabric-icon flex-noshrink left-icon medium"></span>
    </button>`;
        const bntPrevHtml = `
    <button class="bolt-split-button-main bolt-button bolt-icon-button enabled bolt-focus-treatment" role="button" type="button">
    <span aria-hidden="true" class="fabric-icon flex-noshrink left-icon medium"></span>
    <span class="bolt-button-text body-m">&lt; Previous</span>
    </button>`;

        function updateVersion(inc) {
            minor += inc;
            // 0  1        2        3        4         5   6        7
            // '' ProgiDev ProgiOne _sprints taskboard Dev ProgiOne v%200.19
            let url = versionParts
                .concat([minor.toString()])
                .join('.');
            let urlParts = url.split('/');
            const iteration = decodeURIComponent(urlParts[urlParts.length - 2])
                + '/'
                + decodeURIComponent(urlParts[urlParts.length - 1]);
            const project = decodeURIComponent(urlParts[2]);
            const pivot = decodeURIComponent(urlParts[4]);
            const team = decodeURIComponent(urlParts[5]);
            const state = {
                "vssNavigationState": {
                    "state": {
                        "project": project,
                        "pivot": pivot,
                        "teamName": team,
                        "viewname": "content",
                        "iteration": iteration
                    },
                    "routeId": "ms.vss-work-web.new-sprints-content-route",
                    "data": {},
                    "url": url
                }
            };
            // history.pushState(state, "", url);
            navigation.navigate(url);
        }

        const parent = document.querySelector('.sprints-tabbar-header-commandbar[role=menubar] > .sprints-tabbar-header-commandbar')
            || document.querySelector('.ms-CommandBar-sideCommands');
        const btnNextDiv = document.createElement("div");
        btnNextDiv.innerHTML = bntNextHtml;
        btnNextDiv.onclick = () => updateVersion(1);
        parent.prepend(btnNextDiv);
        const btnPrevDiv = document.createElement("div");
        btnPrevDiv.innerHTML = bntPrevHtml;
        btnPrevDiv.onclick = () => updateVersion(-1);
        parent.prepend(btnPrevDiv);
    }

    function augmentWorkItem() {
        tryAugmentWorkItem(0);
    }

    function tryAugmentWorkItem(tryIndex) {
        const wiElem = document.querySelector('.work-item-form-dialog .file-drop-zone-container')
            || document.querySelector('[role=main] .file-drop-zone-container');

        if (wiElem) {
            addTitle(wiElem);
        } else if (tryIndex < 3) {
            setTimeout(tryAugmentWorkItem.bind(null, tryIndex++), 50);
        } else {
            console.error('Did not find wiElem');
        }
    }

    function addTitle(wiElem) {
        const reactKey = Object.keys(wiElem).find(x => x.startsWith('__reactEventHandlers'));
        if (!reactKey) {
            console.error('Did not find react key in elem', wiElem);
            return;
        }

        const wi = wiElem[reactKey].children[0]._owner.stateNode.state.values.workItem;
        const headerTextParent = wiElem.querySelector('.work-item-form-header .secondary-text .flex-row');
        const newTextElem = document.createElement('input');
        newTextElem.style.marginLeft = '10px';
        newTextElem.style.border = 'none';
        newTextElem.style.width = '85%';
        newTextElem.value = wi.id + ' ' + wi._fieldData[1];
        newTextElem.onfocus = () => {
            newTextElem.selectionStart = 0;
            newTextElem.selectionEnd = newTextElem.value.length;
        }
        headerTextParent.appendChild(newTextElem);
    }
}
