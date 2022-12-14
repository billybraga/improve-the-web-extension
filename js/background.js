// Types

/**
 * @typedef AppSpec
 * @property {string} url
 * @property {string} host
 * @property {string[]} supportedCommandTypes
 * @property {boolean} hasScript
 * @property {boolean} hasCss
 */


// Methods

/**
 * @param {string} host
 * @param {string[]} [supportedCommandTypes]
 * @param {boolean} [hasScript]
 * @param {boolean} [hasCss]
 * @returns {AppSpec}
 */
function createAppSpec(host, supportedCommandTypes, hasScript, hasCss) {
    return {
        url: "https://" + host,
        host,
        supportedCommandTypes: supportedCommandTypes,
        hasScript,
        hasCss
    };
}

/**
 * @param {string} url
 * @param {boolean} hasScript
 * @param {boolean} hasCss
 * @returns {AppSpec}
 */
function createMediaAppSpec(url, hasScript, hasCss) {
    return createAppSpec(url, ["volume_change", "play_pause", "track"], hasScript, hasCss);
}

function loadScript() {
    console.log("Loading js");
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/' + location.host + '.js');
    s.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
}

function listen() {
    if (!window.__itwMessageListenSet) {
        window.__itwMessageListenSet = true;

        window.addEventListener("message", (event) => {
            if (event.data.destination === "extension") {
                chrome.runtime.sendMessage(event.data);
            }
        }, false);

        chrome.runtime.onMessage.addListener(function (message) {
            console.info("Received message in tab within bg context", message);
            if (message.destination === "content") {
                window.postMessage(message, "*");
            }
        });
    }
}


// Variables

const appSpecs = [
    // YouTube before YouTube Music, because YouTube Music is always active
    createMediaAppSpec("www.youtube.com", true, true),
    createMediaAppSpec("music.youtube.com", true, true),
    createAppSpec("clients.nethris.com", [], true, true),
    createAppSpec("www.google.com", [], false, true),
    createAppSpec("dev.azure.com", [], true, true),
    createAppSpec("mail.google.com", [], false, true),
];

const notifTimeMs = 2000;
let notifs = {};


// Events

chrome.notifications.onClicked.addListener(function (notificationId) {
    const notif = notifs[notificationId];
    if (!notif) {
        console.log("Did not find notif to click", notificationId);
        return;
    }
    console.log("Will focus tab", notif.tabIndex, notif.tabWindowId);
    chrome.tabs.highlight(
        {
            tabs: [notif.tabIndex],
            windowId: notif.tabWindowId
        },
        () => console.log("Focused tab", notif.tabIndex, notif.tabWindowId)
    );
});

chrome.runtime.onMessage.addListener(function (message) {
    if (message.type !== "notif") {
        return;
    }

    const notifId = message.notifId;
    const notifOptions = message.notif;
    const scheduleClear = () => {
        if (notifs[notifId].clearTimeoutId) {
            clearTimeout(notifs[notifId].clearTimeoutId);
        }
        notifs[notifId].clearTimeoutId = setTimeout(clear, notifTimeMs);
    };
    const clear = (callback) => {
        notifs[notifId] = null;
        console.log("Clear notif", notifId);
        chrome.notifications.clear(
            notifId,
            x => {
                console.log("Clear callback", x, notifId);
                if (callback) {
                    callback();
                }
            }
        );
    };
    if (notifs[notifId] && notifs[notifId].created) {
        console.log("Update notif", notifId, message.notif);
        scheduleClear();
        chrome.notifications.update(
            notifId,
            notifOptions
        );
    } else {
        const doCreate = () => {
            notifs[notifId].created = true;
            scheduleClear();
            notifOptions.iconUrl = "/img/favicon_144.png";
            notifOptions.silent = true;
            console.log("Create notif", notifId, notifOptions);
            chrome.notifications.create(
                notifId,
                notifOptions
            );
        };

        if (notifs[notifId]) {
            clearTimeout(notifs[notifId].createTimeoutId);
        }

        notifs[notifId] = {
            createTimeoutId: setTimeout(doCreate, message.instant ? 0 : 500),
            tabIndex: message.tabIndex,
            tabWindowId: message.tabWindowId,
        };
    }
});

chrome.commands.onCommand.addListener(async function (command) {
    const parts = command.split('-');
    const type = parts[0];
    const arg = parts[1];

    console.info("Received command in bg", command);

    const message = {type: type, arg, destination: "content"};
    const tabsList = await Promise.all(
        appSpecs
            .filter(app => app.supportedCommandTypes.indexOf(type) !== -1)
            .map(app => chrome.tabs.query({url: app.url + "/*"}))
    );

    const tabs = tabsList.flatMap(x => x);

    if (!tabs.length) {
        console.info("Found no tab for command", message);
    }

    sendCommandToTab(tabs[0], message);
});

function sendCommandToTab(tab, message) {
    message.tabIndex = tab.index;
    message.tabWindowId = tab.windowId;
    chrome.tabs.sendMessage(tab.id, message);
    console.info("Sending command in to tab", message, tab);
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (!tab.active) {
        return;
    }

    const app = appSpecs.find(x => tab.url.indexOf(x.url) === 0);
    if (!app) {
        return;
    }

    console.log("tab", changeInfo.status, tab.url);

    if (changeInfo.status === 'complete') {
        if (app.hasScript) {
            chrome.scripting.executeScript(
                {
                    target: {tabId},
                    func: loadScript,
                },
                () => {
                    console.log('added js for ' + app.host)
                });
        }
        if (app.supportedCommandTypes.length) {
            chrome.scripting.executeScript(
                {
                    target: {tabId},
                    func: listen,
                }, () => {
                    console.log('added listen for ' + app.host)
                }
            );
        }
    }

    if (changeInfo.status === 'loading') {
        if (app.hasCss) {
            chrome.scripting.insertCSS(
                {
                    target: {tabId},
                    files: ["css/" + app.host + ".css"],
                },
                () => {
                    console.log('added css for ' + app.host)
                }
            );
        }
    }
});
