/**
 * @typedef AppSpec
 * @property {string} url
 * @property {string[]} supportedCommandTypes
 * @property {boolean} hasScript
 */

/**
 * @param {string} url
 * @param {string[]} supportedCommandTypes
 * @param {boolean} hasScript
 * @returns {AppSpec}
 */
function createAppSpec(url, supportedCommandTypes, hasScript) {
    return {
        url: url,
        supportedCommandTypes: supportedCommandTypes,
        hasScript,
    };
}

/**
 * @param {string} url
 * @param {boolean} hasScript
 * @returns {AppSpec}
 */
function createMediaAppSpec(url, hasScript) {
    return createAppSpec(url, ["volume_change", "play_pause", "track"], hasScript);
}

const appSpecs = [
    createMediaAppSpec("https://music.youtube.com", 'ytm'),
    createMediaAppSpec("https://youtube.com"),
];

function loadScript() {
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

const notifTimeMs = 2000;
let notifs = {};
chrome.runtime.onMessage.addListener(function (message) {
    if (message.type === "notif") {
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
                notifs[notifId] = {created: true};
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
                createTimeoutId: setTimeout(doCreate, message.instant ? 0 : 500)
            };
        }
    }
});

chrome.commands.onCommand.addListener(function (command) {
    const parts = command.split('-');
    const type = parts[0];
    const arg = parts[1];

    console.info("Received command in bg", command);

    const message = {type: type, arg, destination: "content"};
    appSpecs
        .filter(app => app.supportedCommandTypes.indexOf(type) !== -1)
        .forEach(app => {
            chrome.tabs.query({url: app.url + "/*"}, function (tabs) {
                tabs.forEach(tab => {
                    console.info("Sending command in to tab", tab.id, message);
                    chrome.tabs.sendMessage(tab.id, message);
                });
            });
        });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status !== 'complete' || !tab.active) {
        return;
    }

    const app = appSpecs.find(x => tab.url.indexOf(x.url) === 0);
    if (!app) {
        return;
    }

    if (app.hasScript) {
        chrome.scripting.executeScript({
            target: {tabId},
            func: loadScript,
        });
    }
    if (app.supportedCommandTypes.length) {
        chrome.scripting.executeScript({
            target: {tabId},
            func: listen
        });
    }
});
