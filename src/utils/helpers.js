// ── Helper: extract US state abbreviation from address ────────────────────────
export function extractState(address) {
    if (!address) return '';
    // Match 2-letter state code before a zip code like ", TX 76111" or ", TX, 76111"
    const match = address.match(/,\s*([A-Z]{2})\s*,?\s*\d{5}/);
    return match ? match[1] : '';
}

// ── Helper: format dates to US format (MM/DD/YYYY) timezone-safely ──────────
export function formatDateUS(dateString, fallback = '—') {
    if (!dateString) return fallback;
    const str = String(dateString).trim();
    if (str === 'null' || str === 'undefined' || str === '—' || str === '-' || str === '') return fallback;

    // Match YYYY-MM-DD pattern in the string
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [_, year, month, day] = match;
        return `${month}/${day}/${year}`;
    }
    return dateString;
}

// ── Helper: parse US date string (MM/DD/YYYY) to YYYY-MM-DD ──────────────────
export function parseDateUS(usDateString) {
    if (!usDateString) return '';
    const clean = String(usDateString).trim();
    // Match MM/DD/YYYY, MM-DD-YYYY or MM.DD.YYYY
    const match = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (match) {
        const [_, month, day, year] = match;
        const mm = month.padStart(2, '0');
        const dd = day.padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }
    return '';
}

