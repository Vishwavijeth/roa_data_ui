import React, { useState, useEffect, useMemo } from 'react';

const CDA_SENT_API = 'https://roa-data-backend.vercel.app/cda-sent/listing';
const ROWS_PER_PAGE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (val) => {
    if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return String(val);
};

const fmtCurrency = (val) => {
    if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return `$${Number(val).toLocaleString()}`;
};

const fmtDate = (val) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return val;
};

// Checks whether a record has ANY field-level mismatch
const hasMismatch = (row) => {
    return (
        row.gross_commission_mismatch === 'mismatch' ||
        row.sale_price_mismatch === true ||
        row.closed_date_mismatch === true ||
        row.contract_date_mismatch === true ||
        row.transaction_status_mismatch === true ||
        (typeof row.listing_price_mismatch === 'boolean' && row.listing_price_mismatch === true) ||
        row.buyer_name_comparison === 'mismatch' ||
        row.seller_name_comparison === 'mismatch'
    );
};

// Badge for boolean mismatch fields
const MismatchBadge = ({ mismatch }) => {
    if (mismatch === true) {
        return <span className="badge mismatch" style={{ fontSize: '0.7rem' }}>Mismatch</span>;
    }
    if (mismatch === false) {
        return <span className="badge match" style={{ fontSize: '0.7rem' }}>Match</span>;
    }
    // "null" string or actual null
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>N/A</span>;
};

// Badge for comparison string fields (match / mismatch / null / "null")
const CompBadge = ({ value }) => {
    if (value === 'match') return <span className="badge match" style={{ fontSize: '0.7rem' }}>Match</span>;
    if (value === 'mismatch') return <span className="badge mismatch" style={{ fontSize: '0.7rem' }}>Mismatch</span>;
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>N/A</span>;
};

// ── Component ─────────────────────────────────────────────────────────────────
function CdaSent() {
    const [filter, setFilter] = useState('all'); // 'all' | 'mismatch' | 'no_skyslope'
    const [data, setData] = useState([]);
    const [totalCdaSent, setTotalCdaSent] = useState(0);
    const [unmatchedCount, setUnmatchedCount] = useState(0);
    const [noSkyslopeCount, setNoSkyslopeCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch whenever filter changes
    useEffect(() => {
        setLoading(true);
        setError(null);
        setData([]);
        setPage(1);

        const url = filter === 'all'
            ? CDA_SENT_API
            : `${CDA_SENT_API}?filter=${filter}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                setData(Array.isArray(json.data) ? json.data : []);
                setTotalCdaSent(json.total_cda_sent ?? 0);
                setUnmatchedCount(json.unmatched_count ?? 0);
                setNoSkyslopeCount(json.no_skyslope_record ?? 0);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [filter]);

    // Client-side search
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.trim().toLowerCase();
        return data.filter(row =>
            (row.transaction_id || '').toLowerCase().includes(q) ||
            (row.property_address || '').toLowerCase().includes(q)
        );
    }, [data, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    // Column count: 2 fixed + 3*7 groups + is_stale = 2 + 21 + 1 = 24
    const COL_COUNT = 24;

    return (
        <div className="dashboard">
            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1>CDA Sent</h1>
                    <p>Review CDA-sent transactions and highlight data mismatches between Brokerage Engine and SkySlope.</p>
                </div>
            </div>

            {/* ── Summary Cards ────────────────────────────────────────────── */}
            <div className="metrics-container" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                <div className="metric-card">
                    <h3>Total CDA Sent</h3>
                    <p className="value">{totalCdaSent.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Unmatched Transactions</h3>
                    <p className="value danger">{unmatchedCount.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Match Rate</h3>
                    <p className="value success">
                        {totalCdaSent > 0
                            ? `${(((totalCdaSent - unmatchedCount) / totalCdaSent) * 100).toFixed(1)}%`
                            : '—'}
                    </p>
                </div>
                <div className="metric-card">
                    <h3>No SkySlope File ID</h3>
                    <p className="value warning">{noSkyslopeCount.toLocaleString()}</p>
                </div>
            </div>

            {/* ── Table Card ───────────────────────────────────────────────── */}
            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <h2>Transactions</h2>

                        {/* Mismatches filter */}
                        <div className="mismatch-toggle-group">
                            <button
                                id="cda-filter-mismatch"
                                className={`toggle-btn ${filter === 'mismatch' ? 'active' : ''}`}
                                onClick={() => {
                                    setFilter(f => f === 'mismatch' ? 'all' : 'mismatch');
                                    setPage(1);
                                    setSearchQuery('');
                                }}
                            >
                                Mismatches Only
                            </button>
                            <span className="mismatch-count-badge">{unmatchedCount}</span>
                        </div>

                        {/* No SkySlope File ID filter */}
                        <div className="mismatch-toggle-group">
                            <button
                                id="cda-filter-no-skyslope"
                                className={`toggle-btn no-skyslope ${filter === 'no_skyslope' ? 'active' : ''}`}
                                onClick={() => {
                                    setFilter(f => f === 'no_skyslope' ? 'all' : 'no_skyslope');
                                    setPage(1);
                                    setSearchQuery('');
                                }}
                            >
                                No SkySlope File ID
                            </button>
                            <span className="no-skyslope-count-badge">{noSkyslopeCount}</span>
                        </div>

                        {(filter !== 'all' || searchQuery) && (
                            <button
                                className="clear-filters-btn"
                                onClick={() => { setFilter('all'); setSearchQuery(''); setPage(1); }}
                            >
                                ✕ Clear Filters
                            </button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}&nbsp;({filteredData.length.toLocaleString()} records)
                    </span>
                </div>

                {/* Search bar */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="cda-search"
                            type="text"
                            className="search-input"
                            placeholder="Search by Transaction ID or Property Address…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading CDA Sent data…</p>
                    </div>
                ) : error ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>⚠️ Failed to load data: {error}</p>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table style={{ fontSize: '0.78rem' }}>
                                <thead>
                                    <tr>
                                        {/* Fixed columns */}
                                        <th style={{ minWidth: '130px' }}>Transaction ID</th>
                                        <th style={{ minWidth: '220px' }}>Property Address</th>
                                        <th style={{ minWidth: '160px' }}>Tags</th>

                                        {/* Gross Commission */}
                                        <th>BE Gross Commission</th>
                                        <th>SS Gross Commission</th>
                                        <th>Gross Commission</th>

                                        {/* Closed Date */}
                                        <th>BE Closed</th>
                                        <th>SS Closed</th>
                                        <th>Closed Date</th>

                                        {/* Sale Price */}
                                        <th>BE Sale Price</th>
                                        <th>SS Sale Price</th>
                                        <th>Sale Price</th>

                                        {/* Transaction Status */}
                                        <th>BE Status</th>
                                        <th>SS Status</th>
                                        <th>Status</th>

                                        {/* Contract Date */}
                                        <th>BE Contract</th>
                                        <th>SS Contract</th>
                                        <th>Contract Date</th>

                                        {/* Listing Price */}
                                        <th>BE Listing Price</th>
                                        <th>SS Listing Price</th>
                                        <th>Listing Price</th>

                                        {/* Buyer */}
                                        <th>BE Buyer</th>
                                        <th>SS Buyer</th>
                                        <th>Buyer</th>

                                        {/* Seller */}
                                        <th>BE Seller</th>
                                        <th>SS Seller</th>
                                        <th>Seller</th>

                                        {/* Stale — last */}
                                        <th>Stale?</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => {
                                        const rowHasMismatch = hasMismatch(row);
                                        return (
                                            <tr
                                                key={row.transaction_id || i}
                                                className={rowHasMismatch ? 'mismatch' : ''}
                                            >
                                                {/* Transaction ID */}
                                                <td className="cell-guid" title={row.transaction_id}>
                                                    {row.transaction_id ? `${row.transaction_id.slice(0, 18)}…` : '—'}
                                                </td>

                                                {/* Property Address */}
                                                <td className="cell-address">{row.property_address || '—'}</td>

                                                {/* Tags */}
                                                <td style={{ maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                                                    {row.tags
                                                        ? row.tags.split(',').map(t => t.trim()).map((tag, ti) => (
                                                            <span key={ti} style={{
                                                                display: 'inline-block',
                                                                background: 'var(--bg-card)',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: '6px',
                                                                padding: '2px 8px',
                                                                marginRight: '4px',
                                                                marginBottom: '3px',
                                                                fontSize: '0.72rem',
                                                                color: 'var(--text-muted)'
                                                            }}>{tag}</span>
                                                        ))
                                                        : '—'}
                                                </td>

                                                {/* Gross Commission */}
                                                <td>{fmtCurrency(row.be_gross_commission)}</td>
                                                <td>{fmtCurrency(row.ss_gross_commission)}</td>
                                                <td><CompBadge value={row.gross_commission_mismatch} /></td>

                                                {/* Closed Date */}
                                                <td>{fmtDate(row.be_closed_date)}</td>
                                                <td>{fmtDate(row.ss_closed_date)}</td>
                                                <td><MismatchBadge mismatch={row.closed_date_mismatch} /></td>

                                                {/* Sale Price */}
                                                <td>{fmtCurrency(row.be_sale_price)}</td>
                                                <td>{fmtCurrency(row.ss_sale_price)}</td>
                                                <td><MismatchBadge mismatch={row.sale_price_mismatch} /></td>

                                                {/* Transaction Status */}
                                                <td>{fmt(row.be_transaction_status)}</td>
                                                <td>{fmt(row.ss_transaction_status)}</td>
                                                <td><MismatchBadge mismatch={row.transaction_status_mismatch} /></td>

                                                {/* Contract Date */}
                                                <td>{fmtDate(row.be_contract_date)}</td>
                                                <td>{fmtDate(row.ss_contract_date)}</td>
                                                <td><MismatchBadge mismatch={row.contract_date_mismatch} /></td>

                                                {/* Listing Price */}
                                                <td>{fmtCurrency(row.be_listing_price)}</td>
                                                <td>{fmtCurrency(row.ss_listing_price)}</td>
                                                <td><CompBadge value={row.listing_price_mismatch} /></td>

                                                {/* Buyer */}
                                                <td style={{ maxWidth: '160px', whiteSpace: 'normal' }}>{fmt(row.be_buyer_name)}</td>
                                                <td style={{ maxWidth: '160px', whiteSpace: 'normal' }}>{fmt(row.ss_buyer_name)}</td>
                                                <td><CompBadge value={row.buyer_name_comparison} /></td>

                                                {/* Seller */}
                                                <td style={{ maxWidth: '160px', whiteSpace: 'normal' }}>{fmt(row.be_seller_name)}</td>
                                                <td style={{ maxWidth: '160px', whiteSpace: 'normal' }}>{fmt(row.ss_seller_name)}</td>
                                                <td><CompBadge value={row.seller_name_comparison} /></td>

                                                {/* Stale — last */}
                                                <td>
                                                    {row.is_stale
                                                        ? <span className="badge mismatch" style={{ fontSize: '0.7rem' }}>Stale</span>
                                                        : <span className="badge match" style={{ fontSize: '0.7rem' }}>Fresh</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {paginatedData.length === 0 && (
                                        <tr>
                                            <td colSpan={28} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                                No records found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                                <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default CdaSent;
