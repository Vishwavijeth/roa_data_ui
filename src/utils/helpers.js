// ── Helper: extract US state abbreviation from address ────────────────────────
export function extractState(address) {
    if (!address) return '';
    // Match 2-letter state code before a zip code like ", TX 76111" or ", TX, 76111"
    const match = address.match(/,\s*([A-Z]{2})\s*,?\s*\d{5}/);
    return match ? match[1] : '';
}
