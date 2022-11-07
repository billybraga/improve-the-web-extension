function loadYtm() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/ytm.js');
    s.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
}

function listen() {
    if (!window.__ytmMessageListenSet) {
        window.__ytmMessageListenSet = true;

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
    chrome.tabs.query({url: "https://music.youtube.com/*"}, function (tabs) {
        tabs.forEach(tab => {
            console.info("Sending command in to tab", tab.id, message);
            chrome.tabs.sendMessage(tab.id, message);
        });
    });
    chrome.tabs.query({url: "https://youtube.com/*"}, function (tabs) {
        tabs.forEach(tab => {
            console.info("Sending command in to tab", tab.id, message);
            chrome.tabs.sendMessage(tab.id, message);
        });
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.url.indexOf("https://music.youtube.com") === 0 && changeInfo.status === 'complete' && tab.active) {
        chrome.scripting.executeScript({
            target: {tabId},
            func: loadYtm
        });
        chrome.scripting.executeScript({
            target: {tabId},
            func: listen
        });
    }
});
