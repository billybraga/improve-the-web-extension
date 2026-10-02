if (!window.__itwLoaded) {
    window.__itwLoaded = true;

    // week token emailed by `sevenpace week-email`: "itw", the Sunday of the week (yyyymmdd),
    // then the quarters of each day from Sunday to Saturday (2 digits each)
    const timesheetUrl = 'https://clients.nethris.com/WebTimeAttendance/menusubmit.aspx?menuSelect=SELF.MYPAY.MONTEMPS.FEUILLE';
    const pendingTokenKey = '__itwWeekToken';
    // added to the pending token once the next week was requested, to not go further
    const nextWeekSuffix = ':next';

    const parseToken = token => {
        const match = /^itw(\d{4})(\d{2})(\d{2})((?:\d{2}){7})$/.exec(token.trim());
        if (!match) {
            return null;
        }
        return {
            sunday: new Date(+match[1], match[2] - 1, +match[3]),
            hours: match[4].match(/\d{2}/g).map(q => q / 4),
        };
    };

    /** day of the month of the Sunday shown in the timesheet, from the headers like "D 27", "L 28"... */
    const shownSundayDay = () => {
        const headers = document.querySelector('table#tblTimeEntry tr');
        if (!headers) {
            return null;
        }
        const days = [...headers.children]
            .map(cell => /^([DLMJVS])\s*(\d{1,2})$/.exec(cell.textContent.replace(/\s+/g, ' ').trim()))
            .filter(Boolean);
        return days.length && days[0][1] === 'D' ? +days[0][2] : null;
    };

    const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

    const fillHours = hoursPerDay => {
        // TS_HOURS1 is Sunday, TS_HOURS7 is Saturday
        hoursPerDay.forEach((hours, i) => {
            const hourElem = document.getElementById('TS_HOURS' + (i + 1) + '__TIMEENTRY_SCREEN_DAY__0');
            if (!hourElem || (!hours && !hourElem.value)) {
                return;
            }
            hourElem.value = hours;
            hourElem.dispatchEvent(new Event('change'));
        });
    };

    /** fills the week of the token, going to the next week first when the previous one is shown */
    const fillWeek = (token, canGoToNextWeek = true) => {
        localStorage.removeItem(pendingTokenKey);
        const week = parseToken(token);
        if (!week) {
            alert('Invalid week token: ' + token);
            return;
        }
        const shownDay = shownSundayDay();
        if (shownDay === week.sunday.getDate()) {
            fillHours(week.hours);
            return;
        }
        if (canGoToNextWeek && shownDay === addDays(week.sunday, -7).getDate()) {
            // the page is reloaded (the pending token is filled on load), or updated in place
            localStorage.setItem(pendingTokenKey, token + nextWeekSuffix);
            SubmitWeekChange('NEXT_WEEK');
            let tries = 0;
            const waitForWeek = setInterval(() => {
                if (shownSundayDay() !== shownDay && localStorage.getItem(pendingTokenKey) === token + nextWeekSuffix) {
                    clearInterval(waitForWeek);
                    fillWeek(token, false);
                } else if (++tries > 20) {
                    clearInterval(waitForWeek);
                }
            }, 500);
            return;
        }
        alert('The token is for the week of ' + week.sunday.toDateString() + ', which is not the week shown');
    };

    const fillDefaultWeek = () => {
        const month = 1 + (new Date()).getMonth();
        const isSummer = month >= 7 && month <= 8;
        fillHours([0, ...[2, 3, 4, 5, 6].map(i => isSummer ? (i < 6 ? 8.5 : 4) : 8), 0]);
    };

    const timeAddBtn = document.getElementById('tblTimeEntry_AddLink');
    if (timeAddBtn) {
        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.classList.add('tableActionButton');
        fillBtn.classList.add('DefaultActionButton');
        fillBtn.textContent = 'Fill';
        fillBtn.onclick = () => {
            const token = prompt('Week token from the 7pace email (empty for the default week):');
            if (token === null) {
                return;
            }
            token.trim() ? fillWeek(token) : fillDefaultWeek();
        };
        timeAddBtn.after(fillBtn);

        // token pasted on another page
        const pendingToken = localStorage.getItem(pendingTokenKey);
        if (pendingToken) {
            fillWeek(pendingToken.replace(nextWeekSuffix, ''), !pendingToken.endsWith(nextWeekSuffix));
        }
    }

    // pasting a week token fills the timesheet, opening it first when on another page (like the home page)
    document.addEventListener('paste', e => {
        const token = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (!parseToken(token)) {
            return;
        }
        e.preventDefault();
        if (timeAddBtn) {
            fillWeek(token);
        } else {
            localStorage.setItem(pendingTokenKey, token);
            location.href = timesheetUrl;
        }
    });
}
