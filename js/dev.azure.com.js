if (!window.__itwLoaded) {
    window.__itwLoaded = true;
    const CREATING_PR_SESSION_KEY = '_cpr';

    const DASHBOARD_PAGE = 'dashboard';
    const WORK_ITEM_PAGE = 'work item';
    const BUILD_RESULTS_PAGE = 'build results';
    const CREATE_PR_PAGE = 'create pr';
    const EDIT_PR_PAGE = 'edit pr';
    const fixers = {
        [DASHBOARD_PAGE]: fixDashboard,
        [WORK_ITEM_PAGE]: augmentWorkItem,
        [BUILD_RESULTS_PAGE]: fixBuildResults,
        [CREATE_PR_PAGE]: createPrPage,
        [EDIT_PR_PAGE]: editPrPage,
    }
    let lastHref;
    setInterval(checkPage, 100);

    function checkPage() {
        if (lastHref === location.href) {
            return;
        }

        lastHref = location.href;
        let page = null;

        if (lastHref.indexOf("_build/results") !== -1) {
            page = BUILD_RESULTS_PAGE;
        } else if (lastHref.indexOf("_dashboards/dashboard") !== -1) {
            page = DASHBOARD_PAGE;
        } else if (lastHref.indexOf("_workitems/edit") !== -1) {
            page = WORK_ITEM_PAGE;
        } else if (lastHref.indexOf("/pullrequestcreate") !== -1) {
            page = CREATE_PR_PAGE;
        } else if (lastHref.indexOf("/pullrequest/") !== -1) {
            page = EDIT_PR_PAGE;
        }

        if (page) {
            console.info("Fixing", page);
            fixers[page]();
        }
    }

    function fixDashboard() {
        if (lastHref.indexOf('_dashboards/dashboard') === -1) {
            return;
        }

        const dialogElement = document.querySelector('.work-item-form-dialog');
        if (dialogElement) {
            augmentWorkItem(dialogElement);
        }

        setTimeout(fixDashboard, 500);
    }

    function fixBuildResults() {
        console.info("fix elems");
        const elems = document.querySelectorAll(".dark-run-logs");

        for (let i = 0; i < elems.length; i++) {
            elems[i].classList.remove("dark-run-logs");
        }
    }

    function sleep(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    function sleepUntil(callback) {
        const resolveIfCallback = resolve => {
            if (callback()) {
                resolve();
            } else {
                setTimeout(() => resolveIfCallback(resolve), 1000);
            }
        };

        return new Promise(resolveIfCallback);
    }

    async function createPrPage() {
        let checkCount = 0;

        await sleepUntil(() => document.querySelector('.repos-pr-create-header .version-dropdown')?.textContent.includes("feature/"));

        console.log("Will try auto create");

        for (let i = 0; i < 5; i++) {
            const workItemLinks = document.querySelectorAll('.region-createPullRequestOverviewExtensions a[href*="_workitems"]');
            if (workItemLinks.length !== 1) {
                if (checkCount++ > 5) {
                    console.log("Skipping, there is not one work item", workItemLinks);
                    return;
                }

                await sleep(250);
                continue;
            }

            return workItemLinkLoaded(workItemLinks[0].textContent);
        }

        function workItemLinkLoaded(defaultTitle) {
            const title = document.querySelector('[aria-label="Enter a title"]');

            if (title.value?.length < 5) {
                title.value = defaultTitle;
            }

            const button = document.querySelector('button.primary:not(.bolt-split-button-option)');
            if (button.disabled) {
                return;
            }

            sessionStorage[CREATING_PR_SESSION_KEY] = 'true';
            button.click();
        }
    }

    async function editPrPage() {
        await Promise.all([
            tryHandleFixEditor(),
            tryHandleAutoPr(),
        ]);
    }

    async function tryHandleFixEditor() {
        for (let i = 0; i < 5; i++) {
            let errors = 0;
            const editorElements = document.querySelectorAll('.monaco-editor[data-uri]');
            if (editorElements.length === 0) {
                errors++;
                console.log('Found no editors');
            }
            editorElements.forEach(editorElement => {
                const path = editorElement.dataset.uri.replace('inmemory://model', '');
                if (!path.endsWith('.vue')) {
                    return;
                }
                
                const editors = monaco.editor.getModels().filter(x => x._associatedResource.path === path);
                if (editors.length === 0) {
                    console.warn(`Did not find editor for ${path}`);
                    errors++;
                    return;
                }

                editors.forEach(e => monaco.editor.setModelLanguage(e, "html"));
            });

            if (errors === 0) {
                return;
            }

            await sleep(250);
        }
    }

    async function tryHandleAutoPr() {
        if (sessionStorage[CREATING_PR_SESSION_KEY] !== 'true') {
            return;
        }

        sessionStorage.removeItem(CREATING_PR_SESSION_KEY);

        const tryClickConfirmAutoComplete = async () => {
            for (let i = 0; i < 5; i++) {
                const confirmBtn = document.querySelector('.bolt-callout button.primary');
                if (confirmBtn) {
                    confirmBtn.click();
                    break;
                }
                await sleep(250);
            }
        }

        for (let i = 0; i < 5; i++) {
            const setAutoComplete = document.querySelector('.repos-pr-header-complete-button button.bolt-split-button-main');
            if (setAutoComplete?.textContent === 'Set auto-complete') {
                setAutoComplete.click();
                await tryClickConfirmAutoComplete();
                break;
            }
            await sleep(250);
        }

        const approveBtn = document.querySelector('.repos-pr-header-vote-button button.bolt-split-button-main.enabled');
        if (approveBtn?.textContent === 'Approve') {
            approveBtn.click();
        }

        const filesTab = document.querySelector('#__bolt-tab-files');
        if (filesTab) {
            filesTab.click();
        }
    }

    function augmentWorkItem(parentParam) {
        const parent = parentParam ?? document.body;

        if (parent.dataset['__itw_done']) {
            return;
        }

        parent.dataset['__itw_done'] = '1';

        tryAugmentWorkItem(parent, 0);
    }

    function tryAugmentWorkItem(parent, tryIndex) {
        parent.querySelectorAll('.work-item-form-control-content span[style*="background-color"], .work-item-form-page-content .comment-content span').forEach(e => {
            e.style.background = "none";
        });

        const wiElem = parent.querySelector('.work-item-form-dialog .file-drop-zone-container')
            || parent.querySelector('[role=main] .file-drop-zone-container');

        if (wiElem) {
            addTitle(wiElem);
        } else if (tryIndex < 3) {
            setTimeout(tryAugmentWorkItem.bind(null, parent, tryIndex++), 50 * tryIndex);
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
        newTextElem.id = 'title-input';
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
