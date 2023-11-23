if (!window.__itwLoaded) {
    window.__itwLoaded = true;
    console.log("Loaded github ext");
    const sidePane = document.getElementById('repos-file-tree')?.parentElement?.parentElement;
    if (sidePane) {
        sidePane.style.cssText = '--pane-width:1000px';
        sidePane.classList.add('ext-loaded');
    }
}
