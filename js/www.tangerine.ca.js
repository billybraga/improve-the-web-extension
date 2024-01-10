if (!window.__itwLoaded) {
    window.__itwLoaded = true;
    console.log('Loaded tangerine');
    
    const h1 = document.querySelector('#mainContent .account-summary-container h1');
    if (h1) {
        const buttonElement = document.createElement('button');
        buttonElement.textContent = 'Load';
        
        h1.appendChild(buttonElement);
        
        buttonElement.onclick = async () => {
            const result = await callApi("https://secure.tangerine.ca/web/rest/pfm/v1/accounts");
            const chequing = result.accounts.find(x => x.type === "CHEQUING").number;
            const savings = result.accounts.find(x => x.type === "SAVINGS").number;
            const r = [];
            const now = new Date();
            const monthEnd = new Date(now.getFullYear(), now.getMonth(), -1);
            const start = new Date(now.valueOf() - 4 * 31 * 24 * 60 * 60 * 1000);
            const current = new Date(start);
            while (current < monthEnd) {
                console.log("Will load", current);
                const result = await loadAsync(current.getFullYear(), current.getMonth() + 1, chequing, savings);
                console.log(result);
                r.push.apply(r, result);
                current.setMonth(current.getMonth() + 1);
            }
            console.log(r.map(x => `${x.date.toISOString().split('T')[0]}\t${x.balance}`).join("\n"));
        };
    }
    
    /**
     * @param {number} year
     * @param {number} month
     * @param {string} chequing
     * @param {string} savings
     */
    async function loadAsync(year, month, chequing, savings) {
        const [chequingTransactions, savingsTransactions] = await Promise.all(
            [
                // chequing
                getTransactionsAsync(
                    chequing,
                    new Date(year, month - 1, 1),
                    new Date(year, month - 1, 21)
                ),
                // savings
                getTransactionsAsync(
                    savings,
                    new Date(year, month - 1, 10),
                    new Date(year, month - 1, 25)
                ),
            ]
        );

        const result = [];
        for (const savingsTransaction of savingsTransactions) {
            if (savingsTransaction.description === 'VEF Paiement - Carte de crédit Tangerine - TANGERINE CCRD') {
                const chequingEntry = chequingTransactions.filter(x => x.date < savingsTransaction.date)[0];
                if (!chequingEntry) {
                    console.error('Did not find checking entry', savingsTransaction.date);
                    return result;
                }
                result.push({date: savingsTransaction.date, balance: savingsTransaction.balance + chequingEntry.balance});
            }
        }
        return result;
    }

    /**
     * @param id
     * @param {Date} dateStart
     * @param {Date} dateEnd
     * @param urlSuffix
     */
    async function getTransactionsAsync(id, dateStart, dateEnd, urlSuffix = "") {
        const result = await callApi(`https://secure.tangerine.ca/web/rest/pfm/v1/transactions?accountIdentifiers=${id}&periodFrom=${formatDateForApi(dateStart)}&periodTo=${formatDateForApi(dateEnd)}${urlSuffix}`);
        return result
            .transactions
            .map(t => ({
                    description: t.description,
                    balance: t.balance_after,
                    date: new Date(Date.parse(t.transaction_date)),
                })
            );
    }

    async function callApi(url) {
        const response = await fetch(url, {
            "headers": {
                "accept": "application/json, text/plain, */*"
            },
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        });
        return await response.json();
    }

    /**
     * @param {Date} dateTime
     */
    function formatDateForApi(dateTime) {
        return dateTime.toISOString().replace(/Z$/, '');
    }
}