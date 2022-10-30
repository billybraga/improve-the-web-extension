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
        console.info("Listening messages in tab within bg context");
        chrome.runtime.onMessage.addListener(function (message) {
            console.info("Received message in tab within bg context");
            window.postMessage({ type: "volume_change", message: message }, "*");
        });
    }
}

chrome.commands.onCommand.addListener(function (command) {
    const direction = command.split('-')[1];

    console.info("Received command in bg", command);
    chrome.tabs.query({ url: "https://music.youtube.com/*" }, function (tabs) {
        tabs.forEach(tab => {
            console.info("Sending command in to tab", tab.id, command);
            chrome.tabs.sendMessage(tab.id, { direction });
        });
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.url.indexOf("https://music.youtube.com") === 0 && changeInfo.status == 'complete' && tab.active) {
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