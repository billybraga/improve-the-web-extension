if (!window.__itwLoaded) {
    window.__itwLoaded = true;
    console.log("Loaded github ext");
    const sidePane = document.getElementById('repos-file-tree')?.parentElement?.parentElement;
    if (sidePane) {
        sidePane.style.cssText = '--pane-width:1000px';
        sidePane.classList.add('ext-loaded');
    }
    
    document.addEventListener('DOMContentLoaded', function() {
        const element = document.querySelector('#logs');
        if (element) {
            element.setAttribute('data-color-mode', 'light');
            element.setAttribute('data-dark-theme', 'light');
        }
    });
}
