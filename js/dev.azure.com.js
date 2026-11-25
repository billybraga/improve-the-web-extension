if (!window.__itwLoaded) {
    console.log("loaded itw");

    window.__itwLoaded = true;
    const CREATING_PR_SESSION_KEY = '_cpr';

    const DASHBOARD_PAGE = 'dashboard';
    const WORK_ITEM_PAGE = 'work item';
    const BUILD_RESULTS_PAGE = 'build results';
    const CREATE_PR_PAGE = 'create pr';
    const EDIT_PR_PAGE = 'edit pr';
    const SOURCE_CODE_PAGE = 'source code';
    const fixers = {
        [DASHBOARD_PAGE]: fixDashboard,
        [WORK_ITEM_PAGE]: augmentWorkItem,
        [BUILD_RESULTS_PAGE]: fixBuildResults,
        [CREATE_PR_PAGE]: createPrPage,
        [EDIT_PR_PAGE]: editPrPage,
        [SOURCE_CODE_PAGE]: sourceCodePage
    }
    let lastHref;
    setInterval(checkPage, 100);
    setInterval(ensureDashboardTab, 300);
    setInterval(highlightSummaryDiffs, 500);
    setInterval(showLinkedWorkItemParents, 500);
    setInterval(wrapMarkdownDiffs, 500);
    registerScrollGutter();
    registerHotKeys();

    function checkPage() {
        if (lastHref === location.href) {
            return;
        }

        lastHref = location.href;
        let page = null;

        let isNormalWidth = false;

        if (lastHref.includes("_build/results")) {
            page = BUILD_RESULTS_PAGE;
            // isNormalWidth = !lastHref.includes('&view=ms.vss-test-web.build-test-results-tab')
            //     && !(lastHref.includes('_build/results') && lastHref.includes('view=logs'));
        } else if (lastHref.includes("_dashboards/dashboard")) {
            page = DASHBOARD_PAGE;
            isNormalWidth = true;
        } else if (lastHref.includes("_workitems/edit") || lastHref.includes("_workitems/create")) {
            // isNormalWidth = false;
            page = WORK_ITEM_PAGE;
        } else if (lastHref.includes("/pullrequestcreate")) {
            page = CREATE_PR_PAGE;
        } else if (lastHref.includes("/pullrequest/")) {
            page = EDIT_PR_PAGE;
            // width is handled in css with :has, to avoid a layout shift when the page loads
        } else if (lastHref.includes("/_git/")) {
            if (lastHref.includes("_a=content") || !lastHref.includes("_a=")) {
                page = SOURCE_CODE_PAGE;
            }
            // isNormalWidth = false;
        } else if (lastHref.includes("/_queries/")) {
            // isNormalWidth = !lastHref.includes('_queries/query/')
            //     && !lastHref.includes('_queries/query-edit/')
            //     && !lastHref.includes('_queries/edit/')
            ;
        } else if (lastHref.includes("/_search")) {
            if (lastHref.includes("action=content")) {
                page = SOURCE_CODE_PAGE;
            }
            // isNormalWidth = false;
        }

        if (isNormalWidth) {
            document.body.classList.add('itw-normal-width');
            document.body.classList.remove('itw-full-width');
        } else {
            document.body.classList.remove('itw-normal-width');
            document.body.classList.add('itw-full-width');
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
            augmentWorkItem(dialogElement, true);
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

    async function sourceCodePage() {
        await tryHandleFixEditor();
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

            // Still try 5 times, in case the editors change
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

    function augmentWorkItem(parentParam, injectCss) {
        const parent = parentParam ?? document.body;

        if (parent.dataset['__itw_done']) {
            return;
        }

        parent.dataset['__itw_done'] = '1';

        tryAugmentWorkItem(parent, 0);

        if (injectCss) {
            window.postMessage(
                {
                    type: "loadCss",
                    host: "dev.azure.com",
                    allFrames: true,
                });
        }
    }

    function tryAugmentWorkItem(parent, tryIndex) {
        parent.querySelectorAll('.work-item-form-control-content span[style*="background-color"], .work-item-form-page-content .comment-content span').forEach(e => {
            e.style.background = "none";
        });

        const wiElem = parent.querySelector('.work-item-form-dialog .file-drop-zone-container')
            || parent.querySelector('[role=main] .file-drop-zone-container');

        if (wiElem) {
            addTitle(wiElem);
            fixAddLink(wiElem);
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
        const title = wi.id + ' ' + wi._fieldData[1];
        addTitleElement(headerTextParent, title);
        addTitleElement(headerTextParent, `feature/${title.replace(/[^\w]+/g, '-').toLowerCase()}`);
    }

    function addTitleElement(headerTextParent, text) {
        const newTextElem = document.createElement('input');
        newTextElem.id = 'title-input';
        newTextElem.style.marginLeft = '10px';
        newTextElem.style.border = 'none';
        newTextElem.style.width = '40%';
        newTextElem.value = text;
        newTextElem.onfocus = () => {
            newTextElem.selectionStart = 0;
            newTextElem.selectionEnd = newTextElem.value.length;
        }
        headerTextParent.appendChild(newTextElem);
    }

    /** @param {Element} wiElem */
    function fixAddLink(wiElem) {
        document.addEventListener('keyup', e => {
            if (e.key !== 'Enter') {
                return;
            }

            if (e.target.tagName !== 'INPUT') {
                return;
            }

            const titleInput = document.querySelector('.add-link-dialog .work-item-link-form input.bolt-textfield-input:not([role=combobox])');
            if (e.target !== titleInput) {
                return;
            }

            const button = document.querySelector('.add-link-dialog button.primary');
            button.click();
        })
    }

    function registerHotKeys() {
        // Ctrl+S or Ctrl+Enter in a PR or work item comment posts it
        document.addEventListener('keydown', e => {
            if ((e.key !== 's' && e.key !== 'Enter') || !e.ctrlKey || e.shiftKey || e.altKey) {
                return;
            }

            const postBtn = getCommentPostButton(e.target);
            if (!postBtn) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (postBtn.disabled || postBtn.classList.contains('disabled')) {
                console.log("Skipping comment post", postBtn);
                return;
            }
            postBtn.click();
        }, true);

        document.addEventListener('keyup', e => {
            if (e.key !== 's' || !e.ctrlKey || e.shiftKey) {
                return;
            }

            if (getCommentPostButton(e.target)) {
                return;
            }

            const dialogSaveBtnElements = document.querySelectorAll('#__bolt-save-dialog');
            dialogSaveBtnElement = dialogSaveBtnElements.length > 0 ? dialogSaveBtnElements[dialogSaveBtnElements.length - 1] : null;
            const saveBtn = dialogSaveBtnElement || document.getElementById('__bolt-save');
            if (!saveBtn || saveBtn.disabled) {
                console.log("Skipping save", saveBtn);
                return;
            }
            saveBtn.click();
        });
    }

    /** @param {EventTarget} target */
    function getCommentPostButton(target) {
        if (target?.tagName !== 'TEXTAREA') {
            return null;
        }

        // Work item discussion, or PR comment (new thread, reply or code comment)
        const editor = target.closest('.comment-editor, [class*=repos-comment-editor]');
        if (!editor) {
            return null;
        }

        // The post button (Save or Comment) is in the closest parent that has a primary button
        for (let e = editor; e && e !== document.body; e = e.parentElement) {
            const button = e.querySelector('button.primary');
            if (button) {
                return button;
            }
        }

        return null;
    }

    // ---- Home page "My dashboard" tab ----

    const DASHBOARD_HASH = '#itw-dashboard';
    const DASHBOARD_QUERY_KEY = '__itw_dashboard_query';

    function getOrg() {
        return location.pathname.split('/')[1];
    }

    function isHomePage() {
        return /^\/[^/]+\/?(_work|_pulls)?\/?$/.test(location.pathname);
    }

    function ensureDashboardTab() {
        if (!isHomePage()) {
            return;
        }

        const pullsTab = document.getElementById('__bolt-tab-pullrequests');
        if (pullsTab && !document.getElementById('itw-dashboard-tab')) {
            const tab = pullsTab.cloneNode(true);
            tab.id = 'itw-dashboard-tab';
            tab.href = `/${getOrg()}/${DASHBOARD_HASH}`;
            tab.setAttribute('aria-selected', 'false');
            tab.classList.remove('selected');
            tab.removeAttribute('data-focuszone');
            const text = tab.querySelector('.bolt-tab-text');
            text.textContent = 'My dashboard';
            text.dataset.content = 'My dashboard';
            tab.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                if (location.hash !== DASHBOARD_HASH) {
                    history.pushState(null, '', `/${getOrg()}/${DASHBOARD_HASH}`);
                }
                showDashboard();
            }, true);
            pullsTab.after(tab);

            // Leaving the dashboard through the other tabs
            pullsTab.parentElement.addEventListener('click', e => {
                if (e.target.closest('.bolt-tab') && !e.target.closest('#itw-dashboard-tab')) {
                    hideDashboard();
                }
            }, true);
        }

        if (location.hash === DASHBOARD_HASH) {
            if (!pullsTab) {
                return;
            }
            // Azure DevOps can re-render the page after we showed the dashboard (e.g. on Back)
            if (!pullsTab.closest('.suite-me-page-tabbar').parentElement.querySelector(':scope > #itw-dashboard')) {
                showDashboard();
            } else {
                if (document.querySelector('.suite-me-page-tabbar .bolt-tab.selected:not(#itw-dashboard-tab)')) {
                    setDashboardTabSelected(true);
                }
                ensureDashboardFilter();
            }
        } else if (document.body.classList.contains('itw-dashboard-active')) {
            hideDashboard();
        }
    }

    function setDashboardTabSelected(selected) {
        const tab = document.getElementById('itw-dashboard-tab');
        tab?.classList.toggle('selected', selected);
        tab?.setAttribute('aria-selected', String(selected));
        document.querySelectorAll('.suite-me-page-tabbar .bolt-tab:not(#itw-dashboard-tab)').forEach(t => {
            t.classList.toggle('selected', !selected && t.getAttribute('aria-selected') === 'true');
        });
    }

    function hideDashboard() {
        document.body.classList.remove('itw-dashboard-active');
        document.getElementById('itw-dashboard')?.remove();
        document.getElementById('itw-dash-filter')?.remove();
        setDashboardTabSelected(false);
    }

    /** The filter box goes at the right of the tabs, where the other tabs have theirs */
    function ensureDashboardFilter() {
        const tabbar = document.querySelector('.suite-me-page-tabbar');
        const existing = document.getElementById('itw-dash-filter');
        if (!tabbar || existing?.parentElement === tabbar) {
            return;
        }
        // Azure DevOps re-rendered the tabs: move the filter to the new ones
        const input = existing ?? document.createElement('input');
        if (!existing) {
            input.id = 'itw-dash-filter';
            input.type = 'search';
            input.placeholder = 'Filter the dashboard';
            input.addEventListener('input', applyDashboardFilter);
        }
        tabbar.appendChild(input);
    }

    function showDashboard() {
        // The page that holds the org title, the tabs and the tab content
        const container = document.querySelector('.suite-me-page-tabbar')?.parentElement;
        if (!container) {
            return;
        }

        document.body.classList.add('itw-dashboard-active');
        setDashboardTabSelected(true);
        document.getElementById('itw-dashboard')?.remove();
        ensureDashboardFilter();

        const root = document.createElement('div');
        root.id = 'itw-dashboard';
        root.innerHTML = `
            <section id="itw-dash-prs">
                <div class="itw-dash-section-header"><h2>My pull requests</h2>${REFRESH_BUTTON}</div>
                <div class="itw-dash-body">Loading...</div>
            </section>
            <section id="itw-dash-wis">
                <div class="itw-dash-section-header"><h2>My work items</h2>${REFRESH_BUTTON}</div>
                <div class="itw-dash-body">Loading...</div>
            </section>
            <section id="itw-dash-query">
                <div class="itw-dash-section-header">
                    <h2 class="itw-dash-query-title">Query</h2>
                    ${REFRESH_BUTTON}
                    <button type="button" class="itw-dash-icon itw-dash-query-edit" title="Choose the query and its name">⚙</button>
                </div>
                <div class="itw-dash-body"></div>
                <dialog class="itw-dash-query-dialog">
                    <form method="dialog">
                        <h2>Query column</h2>
                        <label>Name<input class="itw-dash-query-name" type="text"></label>
                        <label>Project<select class="itw-dash-project"><option value="">Loading...</option></select></label>
                        <label>Query<select class="itw-dash-queries" disabled><option value="">Choose a project first</option></select></label>
                        <label>Or paste a query link<input class="itw-dash-query-link" type="text" placeholder="https://dev.azure.com/.../_queries/query/..."></label>
                        <div class="itw-dash-error"></div>
                        <div class="itw-dash-dialog-buttons">
                            <button type="submit" value="save" class="itw-dash-primary">Save</button>
                            <button type="button" class="itw-dash-cancel">Cancel</button>
                        </div>
                    </form>
                </dialog>
            </section>`;
        container.appendChild(root);

        // Each section knows how to refresh itself
        const prs = root.querySelector('#itw-dash-prs');
        prs.__itwRefresh = () => loadDashboardPrs(prs.querySelector('.itw-dash-body'));
        const wis = root.querySelector('#itw-dash-wis');
        wis.__itwRefresh = () => loadDashboardWorkItems(wis.querySelector('.itw-dash-body'));
        setupDashboardQuery(root.querySelector('#itw-dash-query'));
        root.querySelectorAll('.itw-dash-refresh').forEach(button =>
            button.addEventListener('click', () => button.closest('section').__itwRefresh?.()));

        prs.__itwRefresh();
        wis.__itwRefresh();
        lastDashboardRefresh = Date.now();
    }

    const REFRESH_BUTTON = '<button type="button" class="itw-dash-icon itw-dash-refresh" title="Refresh (F5 refreshes everything)">↻</button>';
    const DASHBOARD_AUTO_REFRESH_MS = 5 * 60 * 1000;
    let lastDashboardRefresh = 0;

    function refreshDashboard() {
        lastDashboardRefresh = Date.now();
        document.querySelectorAll('#itw-dashboard section').forEach(section => section.__itwRefresh?.());
    }

    // Auto refresh every 5 minutes, or when coming back to the tab after that
    function maybeAutoRefreshDashboard() {
        if (document.getElementById('itw-dashboard') && !document.hidden
            && Date.now() - lastDashboardRefresh >= DASHBOARD_AUTO_REFRESH_MS) {
            refreshDashboard();
        }
    }
    setInterval(maybeAutoRefreshDashboard, 30 * 1000);
    document.addEventListener('visibilitychange', maybeAutoRefreshDashboard);

    /** Starts loading a section; returns a token to check that no newer load started since */
    function startDashboardLoad(body) {
        const token = {};
        body.__itwLoad = token;
        body.closest('section')?.classList.add('itw-dash-loading');
        return token;
    }

    function isCurrentDashboardLoad(body, token) {
        return body.__itwLoad === token && body.isConnected;
    }

    function applyDashboardFilter() {
        const root = document.getElementById('itw-dashboard');
        const terms = (document.getElementById('itw-dash-filter')?.value ?? '').toLowerCase().split(/\s+/).filter(x => x);
        root.querySelectorAll('tbody tr').forEach(tr => {
            const text = tr.textContent.toLowerCase();
            tr.hidden = !terms.every(t => text.includes(t));
        });
    }

    /** Fills a dashboard section, keeping the filter applied */
    function setDashboardBody(body, html) {
        // keep the scroll position when refreshing
        const { scrollTop, scrollLeft } = body;
        body.innerHTML = html;
        body.scrollTop = scrollTop;
        body.scrollLeft = scrollLeft;
        body.closest('section')?.classList.remove('itw-dash-loading');
        if (body.isConnected) {
            applyDashboardFilter();
        }
    }

    // F5 on the dashboard reloads its data, without reloading Azure DevOps (Ctrl+F5 still does)
    document.addEventListener('keydown', e => {
        if (e.key !== 'F5' || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey || location.hash !== DASHBOARD_HASH) {
            return;
        }
        if (!document.getElementById('itw-dashboard')) {
            return;
        }
        e.preventDefault();
        refreshDashboard();
    }, true);

    async function adoFetch(path, body) {
        const response = await fetch(`/${getOrg()}${path}`, {
            method: body ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            throw new Error(`${response.status} on ${path}`);
        }
        return response.json();
    }

    let currentUserIdPromise;
    function getCurrentUserId() {
        currentUserIdPromise ??= adoFetch('/_apis/connectionData').then(x => x.authenticatedUser.id);
        return currentUserIdPromise;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function formatDate(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        return isNaN(date) ? value : date.toLocaleDateString('en-CA');
    }

    function formatFieldValue(value) {
        if (value && typeof value === 'object') {
            return value.displayName ?? JSON.stringify(value);
        }
        if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) {
            return formatDate(value);
        }
        if (typeof value === 'string' && value.startsWith('<')) {
            // html fields like the description
            const div = document.createElement('div');
            div.innerHTML = value;
            const text = div.textContent.trim();
            return text.length > 150 ? text.slice(0, 150) + '...' : text;
        }
        return value;
    }

    /**
     * @param {{label: string, html: (row: any) => string}[]} columns
     * @param {any[]} rows
     */
    function renderTable(columns, rows, emptyText) {
        if (!rows.length) {
            return `<div class="itw-dash-empty">${escapeHtml(emptyText)}</div>`;
        }
        return `<table class="itw-dash-table">
            <thead><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${columns.map(c => `<td${c.wrap ? ' class="itw-dash-wrap"' : ''}>${c.html(r)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
    }

    function showDashboardError(body, error) {
        console.error('Dashboard', error);
        body.innerHTML = `<div class="itw-dash-error">Could not load: ${escapeHtml(error.message)}</div>`;
        body.closest('section')?.classList.remove('itw-dash-loading');
    }

    const VOTES = { 10: 'Approved', 5: 'Approved with suggestions', 0: '', [-5]: 'Waiting for author', [-10]: 'Rejected' };

    async function loadDashboardPrs(body) {
        const token = startDashboardLoad(body);
        try {
            const me = await getCurrentUserId();
            const query = 'api-version=7.1&searchCriteria.status=active&$top=200';
            const [created, reviewing] = await Promise.all([
                adoFetch(`/_apis/git/pullrequests?${query}&searchCriteria.creatorId=${me}`),
                adoFetch(`/_apis/git/pullrequests?${query}&searchCriteria.reviewerId=${me}`),
            ]);
            if (!isCurrentDashboardLoad(body, token)) {
                return;
            }

            const prUrl = pr => `/${getOrg()}/${encodeURIComponent(pr.repository.project.name)}/_git/${encodeURIComponent(pr.repository.name)}/pullrequest/${pr.pullRequestId}`;
            const votes = pr => pr.reviewers
                .filter(r => r.vote)
                .map(r => `<span class="itw-dash-vote itw-dash-vote-${r.vote > 0 ? 'ok' : 'ko'}" title="${escapeHtml(r.displayName + ': ' + VOTES[r.vote])}">${r.vote > 0 ? '✓' : '✗'}</span>`)
                .join('');
            // the target branch only when it is not the usual one
            const targetTag = pr => {
                const target = pr.targetRefName.replace('refs/heads/', '');
                return target === 'main' || target === 'master' ? '' : ` <span class="itw-dash-tag">→ ${escapeHtml(target)}</span>`;
            };
            const columns = showAuthor => [
                { label: 'ID', html: pr => `<span class="itw-dash-id">${pr.pullRequestId}</span>` },
                { label: 'Title', wrap: true, html: pr => `<a href="${prUrl(pr)}">${escapeHtml(pr.title)}</a>${pr.isDraft ? ' <span class="itw-dash-tag">Draft</span>' : ''}${pr.autoCompleteSetBy ? ' <span class="itw-dash-tag">Auto-complete</span>' : ''}${targetTag(pr)}` },
                ...(showAuthor ? [{ label: 'Author', html: pr => escapeHtml(pr.createdBy.displayName) }] : []),
                { label: 'Repository', html: pr => `<span title="${escapeHtml(pr.repository.project.name)}">${escapeHtml(pr.repository.name)}</span>` },
                { label: 'Votes', html: votes },
                { label: 'Created', html: pr => formatDate(pr.creationDate) },
            ];
            const byDate = (a, b) => b.creationDate.localeCompare(a.creationDate);

            setDashboardBody(body, `
                <h3>Created by me (${created.value.length})</h3>
                ${renderTable(columns(false), created.value.sort(byDate), 'No active pull request')}
                <h3>Assigned to me (${reviewing.value.length})</h3>
                ${renderTable(columns(true), reviewing.value.sort(byDate), 'No active pull request')}`);
        } catch (e) {
            showDashboardError(body, e);
        }
    }

    async function getWorkItems(ids, fields) {
        const chunks = [];
        for (let i = 0; i < ids.length; i += 200) {
            chunks.push(ids.slice(i, i + 200));
        }
        const results = await Promise.all(chunks.map(chunk =>
            adoFetch('/_apis/wit/workitemsbatch?api-version=7.1', { ids: chunk, fields })));
        const byId = new Map(results.flatMap(r => r.value).map(wi => [wi.id, wi]));
        // keep the query order
        return ids.map(id => byId.get(id)).filter(x => x);
    }

    const workItemTypesByProject = new Map();

    /** Icon urls of the work item types of these projects, by "project|type" */
    async function getWorkItemTypeIcons(projects) {
        const icons = new Map();
        await Promise.all([...new Set(projects)].map(async project => {
            if (!workItemTypesByProject.has(project)) {
                workItemTypesByProject.set(project, adoFetch(`/${encodeURIComponent(project)}/_apis/wit/workitemtypes?api-version=7.1`)
                    .catch(e => {
                        console.warn('Dashboard work item types', project, e);
                        workItemTypesByProject.delete(project);
                        return { value: [] };
                    }));
            }
            const types = await workItemTypesByProject.get(project);
            types.value.forEach(t => icons.set(`${project}|${t.name}`, t.icon?.url));
        }));
        return icons;
    }

    const projectLogoPromises = new Map();

    /** The project logo is the avatar of its default team, like on the Projects tab */
    function getProjectLogo(project) {
        if (!projectLogoPromises.has(project)) {
            projectLogoPromises.set(project, adoFetch(`/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`)
                .then(p => p.defaultTeam?.id
                    ? `/${getOrg()}/_apis/GraphProfile/MemberAvatars/${p.defaultTeam.id}?overrideDisplayName=${encodeURIComponent(project)}&size=2`
                    : null)
                .catch(e => {
                    console.warn('Dashboard project logo', project, e);
                    projectLogoPromises.delete(project);
                    return null;
                }));
        }
        return projectLogoPromises.get(project);
    }

    /** What goes before the work item titles: type icons and project logos */
    async function getTitleImages(items) {
        const projects = [...new Set(items.map(wi => wi.fields['System.TeamProject']))];
        const [icons, logos] = await Promise.all([
            getWorkItemTypeIcons(projects),
            Promise.all(projects.map(getProjectLogo)),
        ]);
        return { icons, logos: new Map(projects.map((p, i) => [p, logos[i]])) };
    }

    /** The title with the project logo and type icon before it, linking to the work item */
    function workItemTitleHtml(wi, { icons, logos }) {
        const project = wi.fields['System.TeamProject'] ?? '';
        const type = wi.fields['System.WorkItemType'] ?? '';
        const image = (url, cls, text) => url
            ? `<img class="${cls}" src="${escapeHtml(url)}" alt="${escapeHtml(text)}" title="${escapeHtml(text)}">`
            : '';
        return image(logos.get(project), 'itw-dash-project-logo', project)
            + image(icons.get(`${project}|${type}`), 'itw-dash-type-icon', type)
            + `<a href="${workItemUrl(wi)}">${escapeHtml(wi.fields['System.Title'])}</a>`;
    }

    const workItemUrl = wi => `/${getOrg()}/${encodeURIComponent(wi.fields['System.TeamProject'] ?? '_')}/_workitems/edit/${wi.id}`;

    async function loadDashboardWorkItems(body) {
        const token = startDashboardLoad(body);
        try {
            const result = await adoFetch('/_apis/wit/wiql?api-version=7.1&$top=500', {
                query: `SELECT [System.Id] FROM WorkItems
                    WHERE [System.AssignedTo] = @Me AND [System.State] NOT IN ('Closed', 'Done', 'Removed', 'Deployed')
                    ORDER BY [System.ChangedDate] DESC`
            });
            const ids = result.workItems.map(x => x.id);
            const allItems = await getWorkItems(ids, ['System.Id', 'System.WorkItemType', 'System.Title', 'System.State', 'System.TeamProject', 'System.ChangedDate', 'System.Parent']);
            const titleImages = await getTitleImages(allItems);
            if (!isCurrentDashboardLoad(body, token)) {
                return;
            }

            // Hide the children (like tasks) when their parent is already in the list
            const listedIds = new Set(allItems.map(wi => wi.id));
            const hiddenChildren = new Map();
            const items = allItems.filter(wi => {
                const parentId = wi.fields['System.Parent'];
                if (!listedIds.has(parentId)) {
                    return true;
                }
                hiddenChildren.set(parentId, [...(hiddenChildren.get(parentId) ?? []), wi]);
                return false;
            });
            // A grandchild's count goes to the listed ancestor
            const countChildren = id => (hiddenChildren.get(id) ?? []).reduce((count, child) => count + 1 + countChildren(child.id), 0);
            const childrenTag = wi => {
                const children = (hiddenChildren.get(wi.id) ?? []);
                if (!children.length) {
                    return '';
                }
                const tooltip = children.map(c => `${c.id} ${c.fields['System.Title']} (${c.fields['System.State']})`).join('\n');
                return ` <span class="itw-dash-tag" title="${escapeHtml(tooltip)}">+${countChildren(wi.id)} assigned to me</span>`;
            };

            const columns = [
                { label: 'ID', html: wi => `<span class="itw-dash-id">${wi.id}</span>` },
                { label: 'Title', wrap: true, html: wi => workItemTitleHtml(wi, titleImages) + childrenTag(wi) },
                { label: 'State', html: wi => escapeHtml(wi.fields['System.State']) },
                { label: 'Changed', html: wi => formatDate(wi.fields['System.ChangedDate']) },
            ];
            const hiddenCount = allItems.length - items.length;
            setDashboardBody(body, `<div class="itw-dash-count">${allItems.length} open, assigned to me${ids.length >= 500 ? ' (first 500)' : ''}${hiddenCount ? `, ${hiddenCount} shown under their parent` : ''}</div>
                ${renderTable(columns, items, 'No open work item')}`);
        } catch (e) {
            showDashboardError(body, e);
        }
    }

    function getSavedDashboardQuery() {
        try {
            return JSON.parse(localStorage[DASHBOARD_QUERY_KEY] || 'null');
        } catch {
            return null;
        }
    }

    async function setupDashboardQuery(section) {
        const title = section.querySelector('.itw-dash-query-title');
        const body = section.querySelector('.itw-dash-body');
        const dialog = section.querySelector('dialog');
        const nameInput = dialog.querySelector('.itw-dash-query-name');
        const projectSelect = dialog.querySelector('.itw-dash-project');
        const querySelect = dialog.querySelector('.itw-dash-queries');
        const linkInput = dialog.querySelector('.itw-dash-query-link');
        const dialogError = dialog.querySelector('.itw-dash-error');
        let saved = getSavedDashboardQuery();

        const showTitle = () => {
            title.textContent = saved?.name || saved?.queryName || 'Query';
        };
        const selectedQueryName = () => querySelect.selectedOptions[0]?.dataset.name ?? '';
        const updateNamePlaceholder = () => {
            nameInput.placeholder = selectedQueryName() || saved?.queryName || 'Name of the column';
        };

        let projectsPromise;
        const loadProjects = () => {
            projectsPromise ??= adoFetch('/_apis/projects?api-version=7.1&$top=500').then(projects => {
                const names = projects.value.map(p => p.name).sort((a, b) => a.localeCompare(b));
                projectSelect.innerHTML = '<option value="">Choose a project</option>' + names.map(n => `<option>${escapeHtml(n)}</option>`).join('');
            });
            return projectsPromise;
        };

        const loadQueries = async (project, selectedId) => {
            querySelect.disabled = true;
            querySelect.innerHTML = '<option value="">Loading...</option>';
            try {
                const result = await adoFetch(`/${encodeURIComponent(project)}/_apis/wit/queries?$depth=2&api-version=7.1`);
                const options = [];
                const walk = (node, path) => {
                    const name = path ? `${path} / ${node.name}` : node.name;
                    if (!node.isFolder) {
                        options.push(`<option value="${node.id}" data-name="${escapeHtml(node.name)}">${escapeHtml(name)}</option>`);
                    }
                    (node.children || []).forEach(c => walk(c, name));
                };
                result.value.forEach(n => walk(n, ''));
                querySelect.innerHTML = '<option value="">Choose a query</option>' + options.join('');
                querySelect.disabled = false;
                if (selectedId) {
                    querySelect.value = selectedId;
                }
                updateNamePlaceholder();
            } catch (e) {
                dialogError.textContent = `Could not load the queries: ${e.message}`;
            }
        };

        projectSelect.addEventListener('change', () => {
            querySelect.innerHTML = '<option value="">Choose a project first</option>';
            querySelect.disabled = true;
            if (projectSelect.value) {
                loadQueries(projectSelect.value);
            }
        });
        querySelect.addEventListener('change', updateNamePlaceholder);
        linkInput.addEventListener('change', async () => {
            dialogError.textContent = '';
            if (!linkInput.value.trim()) {
                return;
            }
            // https://dev.azure.com/{org}/{project}/_queries/query/{id}/
            const match = linkInput.value.match(/dev\.azure\.com\/[^/]+\/([^/]+)\/_queries\/(?:query|query-edit)\/([0-9a-f-]{36})/i);
            if (!match) {
                dialogError.textContent = 'Not a query link';
                return;
            }
            const project = decodeURIComponent(match[1]);
            await loadProjects();
            projectSelect.value = project;
            await loadQueries(project, match[2]);
            if (querySelect.value !== match[2]) {
                dialogError.textContent = 'This query is not in the list (too deep in its folders, or not shared)';
            }
        });

        section.querySelector('.itw-dash-query-edit').addEventListener('click', async () => {
            dialogError.textContent = '';
            linkInput.value = '';
            nameInput.value = saved?.name ?? '';
            updateNamePlaceholder();
            dialog.showModal();
            try {
                await loadProjects();
            } catch (e) {
                dialogError.textContent = `Could not load the projects: ${e.message}`;
                return;
            }
            if (saved?.project && !projectSelect.value) {
                projectSelect.value = saved.project;
                loadQueries(saved.project, saved.queryId);
            }
        });
        dialog.querySelector('.itw-dash-cancel').addEventListener('click', () => dialog.close());
        dialog.querySelector('form').addEventListener('submit', e => {
            if (!projectSelect.value || !querySelect.value) {
                e.preventDefault();
                dialogError.textContent = 'Choose a query';
                return;
            }
            saved = {
                project: projectSelect.value,
                queryId: querySelect.value,
                queryName: selectedQueryName(),
                name: nameInput.value.trim(),
            };
            localStorage[DASHBOARD_QUERY_KEY] = JSON.stringify(saved);
            showTitle();
            runDashboardQuery(body, saved.project, saved.queryId);
        });

        // the refresh button keeps the current results until the new ones arrive
        section.__itwRefresh = () => saved?.queryId && runDashboardQuery(body, saved.project, saved.queryId, true);

        showTitle();
        if (saved?.project && saved.queryId) {
            runDashboardQuery(body, saved.project, saved.queryId);
            if (!saved.queryName) {
                // saved before the query name was remembered
                adoFetch(`/${encodeURIComponent(saved.project)}/_apis/wit/queries/${saved.queryId}?api-version=7.1`)
                    .then(query => {
                        saved.queryName = query.name;
                        localStorage[DASHBOARD_QUERY_KEY] = JSON.stringify(saved);
                        showTitle();
                    })
                    .catch(e => console.warn('Dashboard query name', e));
            }
        } else {
            body.innerHTML = '<div class="itw-dash-empty">Choose a query with ⚙</div>';
        }
    }

    async function runDashboardQuery(body, project, queryId, isRefresh = false) {
        const token = startDashboardLoad(body);
        if (!isRefresh) {
            body.innerHTML = 'Loading...';
        }
        try {
            const result = await adoFetch(`/${encodeURIComponent(project)}/_apis/wit/wiql/${queryId}?api-version=7.1&$top=500`);
            // Tree and one-hop queries return relations instead of work items
            const ids = [...new Set((result.workItems ?? result.workItemRelations?.map(r => r.target) ?? []).map(x => x.id))];
            // Not useful in the narrow column (the priority is always added as the last column)
            const hiddenFields = ['Microsoft.VSTS.Common.Priority', 'System.Parent', 'System.AssignedTo',
                'System.AreaLevel2', 'Microsoft.VSTS.Common.StackRank', 'System.WorkItemType', 'System.TeamProject'];
            const queryColumns = [
                ...result.columns.filter(c => !hiddenFields.includes(c.referenceName)),
                { referenceName: 'Microsoft.VSTS.Common.Priority', name: 'Priority' },
            ];
            const fields = queryColumns.map(c => c.referenceName);
            // the type and title are always needed for the icon before the title
            const items = await getWorkItems(ids, [...new Set(['System.Id', 'System.TeamProject', 'System.WorkItemType', 'System.Title', ...fields])]);
            const titleImages = await getTitleImages(items);
            if (!isCurrentDashboardLoad(body, token)) {
                return;
            }

            const columns = queryColumns.map(c => ({
                label: c.name,
                wrap: c.referenceName === 'System.Title' || c.referenceName === 'System.Description',
                html: wi => {
                    if (c.referenceName === 'System.Title') {
                        return workItemTitleHtml(wi, titleImages);
                    }
                    const value = escapeHtml(formatFieldValue(wi.fields[c.referenceName]));
                    return c.referenceName === 'System.Id' ? `<span class="itw-dash-id">${value}</span>` : value;
                }
            }));
            const queryUrl = `/${getOrg()}/${encodeURIComponent(project)}/_queries/query/${queryId}/`;
            setDashboardBody(body, `<div class="itw-dash-count">${items.length} work items${ids.length >= 500 ? ' (first 500)' : ''} · <a href="${queryUrl}">open the query</a></div>
                ${renderTable(columns, items, 'The query returned no work item')}`);
        } catch (e) {
            showDashboardError(body, e);
        }
    }

    // ---- Parent of the work items linked to a PR ----
    // Shows the parent (e.g. the user story of a task) under each linked work item, with a button to copy its ID.

    const workItemParents = new Map(); // id -> promise of { id, type, title, url } or null

    function getWorkItemParent(id) {
        if (!workItemParents.has(id)) {
            workItemParents.set(id, (async () => {
                const item = await adoFetch(`/_apis/wit/workitems/${id}?fields=System.Parent&api-version=7.1`);
                const parentId = item.fields?.['System.Parent'];
                if (!parentId) {
                    return null;
                }
                const parent = await adoFetch(`/_apis/wit/workitems/${parentId}?fields=System.WorkItemType,System.Title,System.TeamProject&api-version=7.1`);
                return {
                    id: parentId,
                    type: parent.fields['System.WorkItemType'],
                    title: parent.fields['System.Title'],
                    url: `/${getOrg()}/${encodeURIComponent(parent.fields['System.TeamProject'])}/_workitems/edit/${parentId}/`,
                };
            })().catch(e => {
                workItemParents.delete(id); // retried on a later tick
                throw e;
            }));
        }
        return workItemParents.get(id);
    }

    function showLinkedWorkItemParents() {
        for (const link of document.querySelectorAll('.linked-wit-pr-details a[href*="/_workitems/edit/"]:not(.itw-wi-parent-link)')) {
            const id = link.getAttribute('href').match(/_workitems\/edit\/(\d+)/)?.[1];
            const cell = link.closest('.bolt-table-cell-content');
            if (!id || !cell || cell.dataset.itwParentOf === id) {
                continue;
            }
            cell.dataset.itwParentOf = id; // the row can be reused by React for another work item
            cell.querySelector('.itw-wi-parent')?.remove();
            getWorkItemParent(id).then(parent => {
                if (!parent || cell.dataset.itwParentOf !== id || cell.querySelector('.itw-wi-parent')) {
                    return;
                }
                const line = document.createElement('div');
                line.className = 'itw-wi-parent bolt-table-two-line-cell-item flex-row flex-center secondary-text';
                line.innerHTML = `<span class="itw-wi-parent-label">${escapeHtml(parent.type)}</span>
                    <span class="itw-wi-parent-id" title="Click to select">${parent.id}</span>
                    <button type="button" class="itw-wi-parent-copy" title="Copy ${parent.id}">⧉</button>
                    <a class="itw-wi-parent-link" href="${parent.url}" title="${escapeHtml(parent.title)}">${escapeHtml(parent.title)}</a>`;
                // the row opens the work item on click: keep the mouse for selecting the ID, the link and the button
                for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown']) {
                    line.addEventListener(type, e => e.stopPropagation());
                }
                const button = line.querySelector('button');
                button.addEventListener('click', async () => {
                    await navigator.clipboard.writeText(String(parent.id));
                    button.textContent = '✓';
                    setTimeout(() => button.textContent = '⧉', 1500);
                });
                cell.appendChild(line);
            }, e => console.warn('itw: parent of work item', id, e));
        }
    }

    // ---- Scrollbar of the pages shown in the centered column (css: normal width) ----
    // The page's scrollbar is at the right of the column, not at the edge of the screen. Grabbing just right of it
    // (or anywhere in the empty area at the right) started a text selection that auto-scrolls, so it looked like
    // a scrollbar drag that also selected text. That area now acts as the scrollbar: highlighted on hover, dragged like the thumb.

    function getGutterScroller(x, y, target) {
        const column = document.querySelector('.full-size.region-page > .flex-column.full-size.vertical-layout');
        if (!column || (target !== column && !target.matches?.('.full-size.region-page'))) {
            return null;
        }
        const columnRect = column.getBoundingClientRect();
        if (x < columnRect.right - 2 || columnRect.right > window.innerWidth - 20) {
            return null; // not in the area at the right, or the column takes the full width
        }
        let best = null;
        for (const element of column.querySelectorAll('.custom-scrollbar')) {
            const rect = element.getBoundingClientRect();
            if (element.scrollHeight > element.clientHeight + 1 && rect.right >= columnRect.right - 3
                && y >= rect.top && y <= rect.bottom && (!best || element.clientHeight > best.clientHeight)) {
                best = element;
            }
        }
        return best;
    }

    function registerScrollGutter() {
        let hovered = null;
        document.addEventListener('mousemove', e => {
            const scroller = e.buttons ? hovered : getGutterScroller(e.clientX, e.clientY, e.target);
            if (scroller !== hovered) {
                hovered?.classList.remove('itw-gutter-hover');
                scroller?.classList.add('itw-gutter-hover');
                hovered = scroller;
            }
        }, true);

        document.addEventListener('mousedown', e => {
            if (e.button !== 0) {
                return;
            }
            const scroller = getGutterScroller(e.clientX, e.clientY, e.target);
            if (!scroller) {
                return;
            }
            e.preventDefault(); // no text selection
            const startY = e.clientY;
            const startTop = scroller.scrollTop;
            // like the thumb: moving the mouse by the track height scrolls the whole content
            const ratio = scroller.scrollHeight / scroller.clientHeight;
            const onMove = moveEvent => {
                scroller.scrollTop = startTop + (moveEvent.clientY - startY) * ratio;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('mouseup', onUp, true);
            };
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('mouseup', onUp, true);
        }, true);
    }

    // ---- Line wrapping of the Markdown diffs in the PR view that shows several files ----
    // Prose has long lines. They are wrapped (css: .itw-wrap-lines), and in the side-by-side view
    // the rows of both sides get the same height, so the lines stay facing each other.

    function wrapMarkdownDiffs() {
        for (const card of document.querySelectorAll('.repos-summary-header')) {
            const sides = [...card.querySelectorAll('.repos-summary-diff-container')];
            if (!sides.length) {
                continue;
            }
            const path = card.querySelector('.text-ellipsis.margin-right-4 > .secondary-text')?.textContent ?? '';
            if (!/\.(md|markdown)$/i.test(path.trim())) {
                continue;
            }
            card.classList.add('itw-wrap-lines');
            if (sides.length !== 2) {
                continue;
            }
            const rows = sides.map(side => [...side.querySelectorAll('.repos-diff-contents-row')]);
            // Cheap check that nothing changed since the last time: the widths (window or splitter resized) and the lines
            const signature = `${sides.map(side => side.clientWidth).join()}:${rows[0].length}:${rows[1].length}:${card.textContent.length}`;
            if (card.__itwWrapSignature === signature) {
                continue;
            }
            card.__itwWrapSignature = signature;
            alignDiffSides(rows);
        }
    }

    /**
     * The rows of both sides don't match one to one: a filler row can stand for several lines of the other side.
     * The unchanged lines and the "..." rows face each other in order (the anchors). Between two anchors, the
     * changed lines of each side (a hunk) must take the same height: the shorter hunk gets the difference.
     */
    function alignDiffSides(rows) {
        rows.flat().forEach(row => row.style.height = '');
        const isAnchor = row => {
            const line = row.querySelector('.repos-line-content');
            return !line || line.classList.contains('unchanged') || line.classList.contains('v-align-middle');
        };
        // [hunk 0, anchor 0, hunk 1, anchor 1, ..., last hunk], each hunk a list of rows
        const split = sideRows => {
            const anchors = [];
            const hunks = [[]];
            for (const row of sideRows) {
                if (isAnchor(row)) {
                    anchors.push(row);
                    hunks.push([]);
                } else {
                    hunks[hunks.length - 1].push(row);
                }
            }
            return { anchors, hunks };
        };
        const [left, right] = rows.map(split);
        if (left.anchors.length !== right.anchors.length) {
            return;
        }

        const heights = new Map(rows.flat().map(row => [row, row.getBoundingClientRect().height]));
        const targets = new Map(heights);
        const sumOf = hunk => hunk.reduce((sum, row) => sum + heights.get(row), 0);

        left.anchors.forEach((row, i) => {
            const height = Math.max(heights.get(row), heights.get(right.anchors[i]));
            targets.set(row, height);
            targets.set(right.anchors[i], height);
        });
        left.hunks.forEach((leftHunk, i) => {
            const rightHunk = right.hunks[i];
            const difference = sumOf(leftHunk) - sumOf(rightHunk);
            if (Math.abs(difference) < 0.5) {
                return;
            }
            const [shorter, side] = difference > 0 ? [rightHunk, right] : [leftHunk, left];
            // an empty hunk: the anchor above it takes the space (or the one below for the first hunk)
            const row = shorter[shorter.length - 1] ?? side.anchors[i - 1] ?? side.anchors[i];
            if (row) {
                targets.set(row, targets.get(row) + Math.abs(difference));
            }
        });

        for (const [row, height] of targets) {
            if (height > heights.get(row) + 0.5) {
                row.style.height = `${height}px`;
            }
        }
    }

    // ---- Syntax highlighting of the PR diffs that show several files ----
    // The single file view uses Monaco, which highlights, but the multi-file view is plain text.
    // Like Monaco's tokenizers, only keywords, strings, comments and numbers are colored: no types or function names.
    // Colors are set with the CSS Custom Highlight API, so the page's DOM (owned by React) is not touched.

    // not after a dot: obj.type is a property, not the type keyword
    const keywordsRegex = words => new RegExp(`(?<!\\.)\\b(?:${words.split(' ').join('|')})\\b`);

    /** Each rule is [regex without capturing groups, highlight class] */
    function makeLanguage(rules, flags = 'gm') {
        return {
            regex: new RegExp(rules.map(([regex]) => `(${regex.source})`).join('|'), flags),
            classes: rules.map(([, cls]) => cls),
        };
    }

    const BLOCK_COMMENT = /\/\*[\s\S]*?(?:\*\/|(?![\s\S]))/;
    // " * text" lines of a doc comment that started before the visible part of the diff
    const COMMENT_CONTINUATION = /^[ \t]*\*(?:[ \t].*|$)/;
    const C_STRINGS = /@"(?:[^"]|"")*"|\$?"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/;
    const NUMBER = /\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[a-zA-Z]*)\b/;
    const HTML_RULES = [
        [/<!--[\s\S]*?(?:-->|(?![\s\S]))/, 'comment'],
        [/<\/?[A-Za-z][\w:.-]*|\/?>/, 'tag'],
        [/(?<=\s)[@:#]?[\w.:-]+(?==)/, 'attr'],
        [/"[^"\n]*"|'[^'\n]*'/, 'string'],
        [/&#?\w+;/, 'meta'],
    ];

    const CS_KEYWORDS = keywordsRegex('abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach get goto if implicit in init int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref required return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile when where while with yield nameof field partial dynamic');
    const TS_KEYWORDS = keywordsRegex('abstract any as async await boolean break case catch class const constructor continue debugger declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface keyof let module namespace never new null number object of private protected public readonly return satisfies set static string super switch symbol this throw true try type typeof undefined unknown var void while with yield');

    const cLikeRules = keywords => [
        [/\/\/.*/, 'comment'],
        [BLOCK_COMMENT, 'comment'],
        [COMMENT_CONTINUATION, 'comment'],
        [C_STRINGS, 'string'],
        [NUMBER, 'number'],
        [keywords, 'keyword'],
    ];

    const HIGHLIGHT_LANGUAGES = {
        cs: makeLanguage(cLikeRules(CS_KEYWORDS)),
        ts: makeLanguage(cLikeRules(TS_KEYWORDS)),
        vue: makeLanguage([...HTML_RULES.slice(0, 3), ...cLikeRules(TS_KEYWORDS)]),
        html: makeLanguage(HTML_RULES),
        css: makeLanguage([
            [BLOCK_COMMENT, 'comment'],
            [/\/\/.*/, 'comment'],
            [/"[^"\n]*"|'[^'\n]*'/, 'string'],
            [/@[\w-]+|!important/, 'keyword'],
            [/\$[\w-]+|--[\w-]+/, 'variable'],
            [/[\w-]+(?=\s*:(?!:)[^;{}\n]*(?:;|$))/, 'attr'],
            [/#[\da-fA-F]{3,8}\b|-?\b\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?/, 'number'],
            [/[.#&][\w-]+/, 'tag'],
        ]),
        json: makeLanguage([
            [/\/\/.*/, 'comment'],
            [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/, 'key'],
            [/"(?:[^"\\\n]|\\.)*"/, 'string'],
            [NUMBER, 'number'],
            [/\b(?:true|false|null)\b/, 'keyword'],
        ]),
        yaml: makeLanguage([
            [/(?:^|(?<=\s))#.*/, 'comment'],
            [/^[ \t]*(?:- )?[\w.\/-]+(?=:(?:\s|$))/, 'key'],
            [/"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/, 'string'],
            [/\$\{\{[^}\n]*\}\}|\$\([^)\n]*\)/, 'variable'],
            [/\b(?:true|false|null|yes|no)\b/, 'keyword'],
            [NUMBER, 'number'],
        ]),
        sql: makeLanguage([
            [/--.*/, 'comment'],
            [BLOCK_COMMENT, 'comment'],
            [/N?'(?:[^'\n]|'')*'/, 'string'],
            [NUMBER, 'number'],
            [keywordsRegex('add alter and as asc begin between by case cast check column commit constraint create cross declare default delete desc distinct drop else end exec exists foreign from full go group having if in index inner insert into is join key left like merge not null on or order outer primary procedure references return right rollback select set table then top transaction union unique update values view when where while with'), 'keyword'],
            [/\b(?:bigint|bit|char|date|datetime|datetime2|datetimeoffset|decimal|float|int|money|nchar|nvarchar|smallint|tinyint|uniqueidentifier|varchar)\b/, 'type'],
        ], 'gim'),
        shell: makeLanguage([
            [/(?:^|(?<=\s))#.*/, 'comment'],
            [/"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/, 'string'],
            [/\$\{[^}\n]*\}|\$[\w@#?*!-]+/, 'variable'],
            [keywordsRegex('if then else elif fi for in do done while until case esac function return local export readonly set shift exit break continue param foreach switch throw try catch finally'), 'keyword'],
            [/(?<=\s)--?[\w-]+/, 'attr'],
            [NUMBER, 'number'],
        ]),
        python: makeLanguage([
            [/#.*/, 'comment'],
            // docstrings: a triple-quoted string alone at the start of a statement
            [/^[ \t]*[rRuU]?(?:"""[\s\S]*?(?:"""|(?![\s\S]))|'''[\s\S]*?(?:'''|(?![\s\S])))/, 'comment'],
            // the prefix (f, r, b, u...) is shared, so f"""...""" is not read as the empty string f"" followed by a quote
            [/(?<![\w"'])[rRbBfFuU]{0,2}(?:"""[\s\S]*?(?:"""|(?![\s\S]))|'''[\s\S]*?(?:'''|(?![\s\S]))|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/, 'string'],
            [/@\w+/, 'meta'],
            [NUMBER, 'number'],
            [keywordsRegex('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield'), 'keyword'],
        ]),
    };

    const HIGHLIGHT_EXTENSIONS = {
        cs: 'cs', csx: 'cs',
        ts: 'ts', tsx: 'ts', js: 'ts', jsx: 'ts', mjs: 'ts', cjs: 'ts',
        vue: 'vue',
        html: 'html', htm: 'html', xml: 'html', csproj: 'html', props: 'html', targets: 'html', config: 'html',
        resx: 'html', xaml: 'html', svg: 'html', nuspec: 'html', cshtml: 'html', razor: 'html',
        css: 'css', scss: 'css', less: 'css',
        json: 'json', jsonc: 'json',
        yml: 'yaml', yaml: 'yaml',
        sql: 'sql',
        sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'shell', psm1: 'shell',
        py: 'python',
    };

    function getHighlightLanguage(path) {
        const name = path.split('/').pop().toLowerCase();
        if (name === 'dockerfile') {
            return HIGHLIGHT_LANGUAGES.shell;
        }
        const extension = name.includes('.') ? name.split('.').pop() : '';
        return HIGHLIGHT_LANGUAGES[HIGHLIGHT_EXTENSIONS[extension]];
    }

    const highlightRegistry = new Map();
    /** Highlighted diff side (the parent of its rows) => { signature, ranges: [highlight, range][] } */
    const highlightedDiffs = new Map();

    function getHighlight(cls) {
        if (!highlightRegistry.has(cls)) {
            const highlight = new Highlight();
            CSS.highlights.set(`itw-hl-${cls}`, highlight);
            highlightRegistry.set(cls, highlight);
        }
        return highlightRegistry.get(cls);
    }

    function clearDiffHighlight(blocks) {
        highlightedDiffs.get(blocks)?.ranges.forEach(([highlight, range]) => highlight.delete(range));
        highlightedDiffs.delete(blocks);
    }

    function highlightSummaryDiffs() {
        if (!window.CSS?.highlights || !window.Highlight) {
            return;
        }

        // Forget the diffs that are not on the page anymore
        for (const blocks of highlightedDiffs.keys()) {
            if (!blocks.isConnected) {
                clearDiffHighlight(blocks);
            }
        }

        // Each side of a changed file is a .repos-summary-diff-blocks; a new or deleted file has a single plain div
        document.querySelectorAll('.repos-summary-diff-container > div').forEach(blocks => {
            // Cheap check that the lines did not change since the last time (diffs load and expand lazily)
            const signature = `${blocks.childElementCount}:${blocks.textContent.length}`;
            if (highlightedDiffs.get(blocks)?.signature === signature) {
                return;
            }
            clearDiffHighlight(blocks);
            const ranges = [];
            highlightedDiffs.set(blocks, { signature, ranges });

            const card = blocks.closest('.repos-summary-header');
            const path = card?.querySelector('.text-ellipsis.margin-right-4 > .secondary-text')?.textContent
                ?? card?.querySelector('.text-ellipsis.margin-right-4')?.textContent ?? '';
            const language = getHighlightLanguage(path.trim());
            if (!language) {
                return;
            }

            for (const block of getDiffCodeBlocks(blocks)) {
                highlightCodeBlock(block, language, ranges);
            }
        });
    }

    /**
     * The code of a diff side, cut in blocks of consecutive lines, as the text to tokenize
     * and the text nodes it comes from: { text, segments: { node, start }[] }[]
     */
    function getDiffCodeBlocks(blocks) {
        const result = [];
        let current = null;
        let previousLine = 0;

        blocks.querySelectorAll('.repos-line-content:not(.filler):not(.v-align-middle)').forEach(line => {
            const lineNumber = +line.dataset.mline || +line.dataset.oline || 0;
            if (!current || lineNumber !== previousLine + 1) {
                current = { text: '', segments: [] };
                result.push(current);
            } else {
                current.text += '\n';
            }
            previousLine = lineNumber;

            const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
                acceptNode: node => node.parentElement.closest('.screen-reader-only') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
            });
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                current.segments.push({ node, start: current.text.length });
                current.text += node.textContent;
            }
        });

        return result;
    }

    function highlightCodeBlock({ text, segments }, language, ranges) {
        let segmentIndex = 0;
        for (const match of text.matchAll(language.regex)) {
            if (!match[0].length) {
                continue;
            }
            const cls = language.classes[match.findIndex((group, i) => i > 0 && group !== undefined) - 1];
            const highlight = getHighlight(cls);
            const start = match.index;
            const end = start + match[0].length;

            // Tokens are in order: skip the text nodes before this token
            while (segmentIndex < segments.length
                && segments[segmentIndex].start + segments[segmentIndex].node.length <= start) {
                segmentIndex++;
            }
            // A token can span several text nodes (multi-line comments and strings)
            for (let i = segmentIndex; i < segments.length && segments[i].start < end; i++) {
                const { node, start: nodeStart } = segments[i];
                const range = new Range();
                range.setStart(node, Math.max(start, nodeStart) - nodeStart);
                range.setEnd(node, Math.min(end, nodeStart + node.length) - nodeStart);
                if (!range.collapsed) {
                    highlight.add(range);
                    ranges.push([highlight, range]);
                }
            }
        }
    }
}
