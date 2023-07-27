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
            const month = 1 + (new Date()).getMonth();
            const isSummer = month >= 7 && month <= 8;
            for (let i = 2; i <= 6; i++) {
                const hourElem = document
                    .getElementById('TS_HOURS' + i + '__TIMEENTRY_SCREEN_DAY__0');
                hourElem.value = isSummer ? (i < 6 ? 8.5 : 4) : 8;
                const event = new Event('change');
                hourElem.dispatchEvent(event);
            }
        };
        timeAddBtn.after(fillBtn);
    }
}
