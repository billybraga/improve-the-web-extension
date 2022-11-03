function loadYtm() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/ytm.js');
    s.onload = function() {
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
let notifTimeoutIds = {};
chrome.runtime.onMessage.addListener(function (message) {
    if (message.type === "notif") {
        const notifId = "__yt_" + message.notifType;
        if (notifTimeoutIds[notifId]) {
            console.log("Update notif", message.notifMessage);
            clearTimeout(notifTimeoutIds[notifId]);
            chrome.notifications.update(
                notifId,
                {
                    message: message.notifMessage
                }
            );
        } else {
            console.log("Create notif", message.notifMessage);
            chrome.notifications.create(
                notifId,
                {
                    type: "basic",
                    silent: true,
                    iconUrl: "/img/favicon_144.png",
                    title: message.notifTitle,
                    message: message.notifMessage
                }
            );
        }

        notifTimeoutIds[notifId] = setTimeout(() => {
            notifTimeoutIds[notifId] = null;
            console.log("Clear notif");
            chrome.notifications.clear(notifId, x => console.log("Clear callback", x));
        }, notifTimeMs);
    }
});

chrome.commands.onCommand.addListener(function (command) {
    const parts = command.split('-');
    const type = parts[0];
    const arg = parts[1];

    console.info("Received command in bg", command);
    const message = { type: type, arg, destination: "content" };
    chrome.tabs.query({ url: "https://music.youtube.com/*" }, function (tabs) {
        tabs.forEach(tab => {
            console.info("Sending command in to tab", tab.id, message);
            chrome.tabs.sendMessage(tab.id, message);
        });
    });
    chrome.tabs.query({ url: "https://youtube.com/*" }, function (tabs) {
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
