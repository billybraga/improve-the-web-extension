if (!window.__itwThLoaded) {
    window.__itwThLoaded = true;

    console.log("Started js for TH");

    const checkEditors = () => setTimeout(() => {
        const editor = document.querySelector("#remarkEditorInput");
        try {
            if (!editor) {
                return;
            }

            if (editor.dataset.__itwState === 'fixed') {
                console.log("Editor already fixed");
                return;
            }

            editor.dataset.__itwState = 'fixed';
            editor.addEventListener("keydown", e => {
                if (e.keyCode >= 37 && e.keyCode <= 40) {
                    e.stopPropagation();
                    return false;
                }
            });
        } finally {
            checkEditors();
        }
    }, 500);

    checkEditors();
}