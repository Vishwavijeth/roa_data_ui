import React, { useState, useEffect, useCallback, useMemo } from 'react';

const BASE_URL = 'https://roa-data-backend.vercel.app';
const fmtCurrency = v => (v != null ? `$${Number(v).toLocaleString()}` : '—');
const fmtVal = v => (v != null && v !== '' ? String(v) : '—');

// ── Mismatch column definitions ──────────────────────────────────────────────
const COLUMNS = [
    {
        id: 'gross_commission', label: 'Gross Commission',
        color: '#6366f1', gradientFrom: 'rgba(99,102,241,0.18)', gradientTo: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.45)',
        filterFn: r => r.gross_commission_mismatch === 'mismatch',
        beKey: 'be_gross_commission', ssKey: 'ss_gross_commission', fmt: fmtCurrency,
        icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        id: 'close_date', label: 'Close Date',
        color: '#10b981', gradientFrom: 'rgba(16,185,129,0.18)', gradientTo: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.45)',
        filterFn: r => r.closed_date_mismatch === true,
        beKey: 'be_closed_date', ssKey: 'ss_closed_date', fmt: fmtVal,
        icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
    {
        id: 'sale_price', label: 'Sale Price',
        color: '#f59e0b', gradientFrom: 'rgba(245,158,11,0.18)', gradientTo: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.45)',
        filterFn: r => r.sale_price_mismatch === true,
        beKey: 'be_sale_price', ssKey: 'ss_sale_price', fmt: fmtCurrency,
        icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
    },
    {
        id: 'status', label: 'Status',
        color: '#ef4444', gradientFrom: 'rgba(239,68,68,0.18)', gradientTo: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.45)',
        filterFn: r => r.transaction_status_mismatch === true,
        beKey: 'be_transaction_status', ssKey: 'ss_transaction_status', fmt: fmtVal,
        icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        id: 'buyer_name', label: 'Buyer Name',
        color: '#8b5cf6', gradientFrom: 'rgba(139,92,246,0.18)', gradientTo: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.45)',
        filterFn: r => r.buyer_name_comparison === 'mismatch',
        beKey: 'be_buyer_name', ssKey: 'ss_buyer_name', fmt: fmtVal,
        icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    },
    {
        id: 'seller_name', label: 'Seller Name',
        color: '#0ea5e9', gradientFrom: 'rgba(14,165,233,0.18)', gradientTo: 'rgba(14,165,233,0.04)', borderColor: 'rgba(14,165,233,0.45)',
        filterFn: r => r.seller_name_comparison === 'mismatch',
        beKey: 'be_seller_name', ssKey: 'ss_seller_name', fmt: fmtVal,
        icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
];

// ── Card ─────────────────────────────────────────────────────────────────────
function KanbanCard({ row, col }) {
    const [expanded, setExpanded] = useState(false);
    const beVal = col.fmt(row[col.beKey]);
    const ssVal = col.fmt(row[col.ssKey]);

    const allMismatches = [
        row.gross_commission_mismatch === 'mismatch' && 'Commission',
        row.closed_date_mismatch === true && 'Close Date',
        row.sale_price_mismatch === true && 'Sale Price',
        row.transaction_status_mismatch === true && 'Status',
        row.buyer_name_comparison === 'mismatch' && 'Buyer Name',
        row.seller_name_comparison === 'mismatch' && 'Seller Name',
    ].filter(Boolean);

    return (
        <div className="kanban-card" style={{ '--card-accent': col.color, borderLeft: `3px solid ${col.color}` }} onClick={() => setExpanded(e => !e)}>
            <div className="kanban-card-header">
                <div className="kanban-card-address" title={row.property_address}>{row.property_address || '—'}</div>
                <div className="kanban-card-chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
                </div>
            </div>

            {/* Specialist */}
            {row.transaction_specialist && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 0.75rem 0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.transaction_specialist}
                </div>
            )}

            {/* BE vs SS comparison */}
            <div style={{ display: 'flex', gap: '0.4rem', padding: '0 0.75rem 0.5rem', fontSize: '0.75rem' }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.3rem 0.5rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>BE</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{beVal}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.3rem 0.5rem', borderLeft: `2px solid ${col.color}` }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>SS</div>
                    <div style={{ fontWeight: 600, color: col.color }}>{ssVal}</div>
                </div>
            </div>

            {/* Mismatch badge */}
            <div style={{ padding: '0 0.75rem 0.5rem' }}>
                <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', background: `${col.color}22`, border: `1px solid ${col.color}55`, color: col.color, fontSize: '0.65rem', fontWeight: 700 }}>
                    ⚠ Mismatch
                </span>
            </div>

            {/* Expanded */}
            {expanded && (
                <div className="kanban-card-details">
                    <div className="kanban-detail-grid">
                        <div className="kanban-detail-item"><span className="kanban-detail-label">BE Close Date</span><span className="kanban-detail-value">{row.be_closed_date || '—'}</span></div>
                        <div className="kanban-detail-item"><span className="kanban-detail-label">SS Close Date</span><span className="kanban-detail-value">{row.ss_closed_date || '—'}</span></div>
                        <div className="kanban-detail-item"><span className="kanban-detail-label">BE Sale Price</span><span className="kanban-detail-value">{fmtCurrency(row.be_sale_price)}</span></div>
                        <div className="kanban-detail-item"><span className="kanban-detail-label">SS Sale Price</span><span className="kanban-detail-value">{fmtCurrency(row.ss_sale_price)}</span></div>
                        <div className="kanban-detail-item"><span className="kanban-detail-label">BE Status</span><span className="kanban-detail-value">{row.be_transaction_status || '—'}</span></div>
                        <div className="kanban-detail-item"><span className="kanban-detail-label">SS Status</span><span className="kanban-detail-value">{row.ss_transaction_status || '—'}</span></div>
                    </div>
                    {allMismatches.length > 0 && (
                        <div className="kanban-mismatch-flags" style={{ marginTop: '0.5rem' }}>
                            {allMismatches.map(m => <span key={m} className="kanban-flag">{m} Mismatch</span>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Column ───────────────────────────────────────────────────────────────────
function KanbanColumn({ col, data, loading, error }) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const colData = data.filter(col.filterFn);
        if (!search.trim()) return colData;
        const q = search.toLowerCase();
        return colData.filter(r =>
            (r.property_address || '').toLowerCase().includes(q) ||
            (r.transaction_specialist || '').toLowerCase().includes(q)
        );
    }, [data, col.filterFn, search]);

    const total = useMemo(() => data.filter(col.filterFn).length, [data, col.filterFn]);

    return (
        <div className="kanban-column" style={{ '--col-color': col.color, background: `linear-gradient(180deg, ${col.gradientFrom} 0%, ${col.gradientTo} 100%)`, border: `1px solid ${col.borderColor}` }}>
            <div className="kanban-col-header">
                <div className="kanban-col-title">
                    <span className="kanban-col-icon" style={{ color: col.color }}>{col.icon}</span>
                    <span className="kanban-col-label">{col.label}</span>
                </div>
                <span className="kanban-col-count" style={{ background: col.color + '22', color: col.color, border: `1px solid ${col.color}44` }}>
                    {loading ? '…' : total.toLocaleString()}
                </span>
            </div>

            <div className="kanban-col-search">
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                <input type="text" className="kanban-search-input" placeholder="Filter cards…" value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                {search && <button className="kanban-search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>

            <div className="kanban-cards-container">
                {loading ? (
                    <div className="kanban-col-state"><div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }} /><span>Loading…</span></div>
                ) : error ? (
                    <div className="kanban-col-state kanban-col-error"><span>Failed to load</span></div>
                ) : filtered.length === 0 ? (
                    <div className="kanban-col-state"><span style={{ opacity: 0.4, fontSize: '0.8rem' }}>{search ? 'No matches' : 'No mismatches'}</span></div>
                ) : (
                    filtered.map((row, i) => <KanbanCard key={row.transaction_id || i} row={row} col={col} />)
                )}
            </div>
        </div>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────
function MonthClosing() {
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [meta, setMeta] = useState({});

    // Draft filter state
    const [draftFrom, setDraftFrom]           = useState('');
    const [draftTo, setDraftTo]               = useState('');
    const [draftState, setDraftState]         = useState('');
    const [draftSpecialist, setDraftSpecialist] = useState('');

    // Applied filter state (triggers fetch)
    const [activeFrom, setActiveFrom]           = useState('');
    const [activeTo, setActiveTo]               = useState('');
    const [activeState, setActiveState]         = useState('');
    const [activeSpecialist, setActiveSpecialist] = useState('');

    const buildUrl = useCallback(() => {
        let url = `${BASE_URL}/book-closing/listing?`;
        const params = [];
        if (activeFrom)       params.push(`from_closed_date=${encodeURIComponent(activeFrom)}`);
        if (activeTo)         params.push(`to_closed_date=${encodeURIComponent(activeTo)}`);
        if (activeState)      params.push(`state=${encodeURIComponent(activeState)}`);
        if (activeSpecialist) params.push(`transaction_specialist=${encodeURIComponent(activeSpecialist)}`);
        return url + params.join('&');
    }, [activeFrom, activeTo, activeState, activeSpecialist]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(buildUrl());
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setAllData(Array.isArray(json.data) ? json.data : []);
            setMeta({ total: json.total, unmatched: json.unmatched_count, noSkyslope: json.no_skyslope_record });
        } catch (e) {
            setError(e.message);
            setAllData([]);
        } finally {
            setLoading(false);
        }
    }, [buildUrl]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleApply = () => {
        setActiveFrom(draftFrom);
        setActiveTo(draftTo);
        setActiveState(draftState.trim().toUpperCase());
        setActiveSpecialist(draftSpecialist.trim());
    };

    const handleClear = () => {
        setDraftFrom(''); setDraftTo(''); setDraftState(''); setDraftSpecialist('');
        setActiveFrom(''); setActiveTo(''); setActiveState(''); setActiveSpecialist('');
    };

    const hasActive = !!(activeFrom || activeTo || activeState || activeSpecialist);

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Month Closing</h1>
                    <p>Mismatch breakdown across transactions. Click a card to expand details.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="sync-btn" onClick={fetchData} disabled={loading} title="Refresh">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="mc-filter-bar">
                <div className="mc-filter-group">
                    <label className="mc-filter-label">Close Date From</label>
                    <input type="date" className="mc-filter-input" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} style={{ backgroundImage: 'none' }} />
                </div>
                <div className="mc-filter-group">
                    <label className="mc-filter-label">Close Date To</label>
                    <input type="date" className="mc-filter-input" value={draftTo} onChange={e => setDraftTo(e.target.value)} style={{ backgroundImage: 'none' }} />
                </div>
                <div className="mc-filter-group">
                    <label className="mc-filter-label">State</label>
                    <input type="text" className="mc-filter-input" placeholder="e.g. TX" value={draftState} onChange={e => setDraftState(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApply()} />
                </div>
                <div className="mc-filter-group" style={{ flex: 2 }}>
                    <label className="mc-filter-label">Transaction Specialist</label>
                    <input type="text" className="mc-filter-input" placeholder="e.g. Viviana Cardona" value={draftSpecialist} onChange={e => setDraftSpecialist(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApply()} />
                </div>
                <div className="mc-filter-actions">
                    <button className="mc-apply-btn" onClick={handleApply} disabled={loading}>Apply</button>
                    {(hasActive || draftFrom || draftTo || draftState || draftSpecialist) && (
                        <button className="mc-clear-btn" onClick={handleClear}>Clear</button>
                    )}
                </div>
                {hasActive && (
                    <div className="mc-active-chips">
                        {activeFrom      && <span className="mc-chip">From: {activeFrom}</span>}
                        {activeTo        && <span className="mc-chip">To: {activeTo}</span>}
                        {activeState     && <span className="mc-chip">State: {activeState}</span>}
                        {activeSpecialist && <span className="mc-chip">Specialist: {activeSpecialist}</span>}
                    </div>
                )}
            </div>

            {/* Scrollable wrapper: summary row + kanban board */}
            <div className="kanban-scroll-wrapper">
                {/* Summary row */}
                <div className="kanban-summary-row">
                    {COLUMNS.map(col => {
                        const count = loading ? null : allData.filter(col.filterFn).length;
                        return (
                            <div key={col.id} className="month-closing-summary-card" style={{ borderTop: `3px solid ${col.color}` }}>
                                <div className="month-closing-summary-icon" style={{ color: col.color }}>{col.icon}</div>
                                <div>
                                    <div className="month-closing-summary-label">{col.label}</div>
                                    <div className="month-closing-summary-value" style={{ color: col.color }}>
                                        {loading ? '…' : error ? 'Err' : count.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Kanban board */}
                <div className="kanban-board">
                    {COLUMNS.map(col => (
                        <KanbanColumn key={col.id} col={col} data={allData} loading={loading} error={error} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default MonthClosing;
