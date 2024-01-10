Remove-Item itw.zip
Rename-Item -path manifest.json -newname manifest-chrome.json
Rename-Item -path manifest-firefox-android.json -newname manifest.json
Compress-Archive -Path ./* -DestinationPath itw.zip
Rename-Item -path manifest.json -newname manifest-firefox-android.json
Rename-Item -path manifest-chrome.json -newname manifest.json