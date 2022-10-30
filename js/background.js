function loadYtm() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/ytm.js');
    s.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
}

function listen() {
    console.info("Listen messages")
    chrome.runtime.onMessage.addListener(function (message) {
        window.postMessage({ type: "FROM_PAGE", text: message }, "*");
    });
}

chrome.commands.onCommand.addListener(function (command) {
    const direction = command.split('-')[1];

    chrome.tabs.query({ url: "https://music.youtube.com/*" }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { direction });
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