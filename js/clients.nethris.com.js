if (!window.__itwLoaded) {
    window.__itwLoaded = true;
    const timeAddBtn = document.getElementById('tblTimeEntry_AddLink');
    if (timeAddBtn) {
        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.classList.add('tableActionButton');
        fillBtn.classList.add('DefaultActionButton');
        fillBtn.textContent = 'Fill';
        fillBtn.onclick = () => {
            for (let i = 2; i <= 6; i++) {
                document
                    .getElementById('TS_HOURS' + i + '__TIMEENTRY_SCREEN_DAY__0')
                    .value = 8;
            }
        };
        timeAddBtn.after(fillBtn);
    }
}
