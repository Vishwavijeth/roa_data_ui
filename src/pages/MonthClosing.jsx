import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SectionedDetailView from '../components/SectionedDetailView';

const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://roa-data-backend.vercel.app';
const fmtCurrency = v => (v != null ? `$${Number(v).toLocaleString()}` : '—');
const fmtVal = v => (v != null && v !== '' ? String(v) : '—');

const checkHasMismatch = (row) => {
    if (!row) return false;
    return (
        row.closed_date_mismatch === true ||
        row.contract_date_mismatch === true ||
        row.sale_price_mismatch === true ||
        row.listing_price_comparison === 'mismatch' ||
        ((row.be_gross_commission != null && row.ss_gross_commission != null && Number(row.be_gross_commission) !== Number(row.ss_gross_commission)) || row.gross_commission_mismatch === 'mismatch') ||
        row.transaction_status_mismatch === true ||
        row.buyer_name_comparison === 'mismatch' || row.buyer_name_mismatch === 'mismatch' ||
        row.seller_name_comparison === 'mismatch' || row.seller_name_mismatch === 'mismatch'
    );
};

// ── Column Definitions ───────────────────────────────────────────────────────
const COLUMNS = [
    {
        id: 'skyslope',
        label: 'Skyslope',
        color: '#6366f1',
        gradientFrom: 'rgba(99,102,241,0.18)',
        gradientTo: 'rgba(99,102,241,0.04)',
        borderColor: 'rgba(99,102,241,0.45)',
        apiQuery: 'skyslope=true',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
    },
    {
        id: 'pending',
        label: 'Pending',
        color: '#f59e0b',
        gradientFrom: 'rgba(245,158,11,0.18)',
        gradientTo: 'rgba(245,158,11,0.04)',
        borderColor: 'rgba(245,158,11,0.45)',
        apiQuery: 'status=pending',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        id: 'closed',
        label: 'Closed',
        color: '#10b981',
        gradientFrom: 'rgba(16,185,129,0.18)',
        gradientTo: 'rgba(16,185,129,0.04)',
        borderColor: 'rgba(16,185,129,0.45)',
        apiQuery: 'status=closed',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        id: 'cancelled',
        label: 'Cancelled',
        color: '#ef4444',
        gradientFrom: 'rgba(239,68,68,0.18)',
        gradientTo: 'rgba(239,68,68,0.04)',
        borderColor: 'rgba(239,68,68,0.45)',
        apiQuery: 'status=cancelled',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

// ── SkySlope Detail Modal ────────────────────────────────────────────────────
function SkySlopeDetailModal({ fileId, row, onClose }) {
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('skyslope');

    useEffect(() => {
        setLoading(true);
        setError(null);
        setDetailData(null);
        fetch(`${BASE_URL}/skyslope/detail?saleguid=${fileId}`)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(json => { setDetailData(json); setLoading(false); })
            .catch(err => {
                console.warn("Backend detail fetch crashed/failed, falling back to local card row data:", err);
                if (row) {
                    const fallbackSkySlope = {
                        saleguid: row.skyslopefileid || fileId,
                        propertyaddress: row.property_address,
                        buyer_name: row.ss_buyer_name,
                        seller_name: row.ss_seller_name,
                        close_date: row.ss_closed_date,
                        contract_date: row.ss_contract_date,
                        sale_price: row.ss_sale_price,
                        listing_price: row.ss_listing_price,
                        gross_commission: row.ss_gross_commission,
                        transaction_status: row.ss_transaction_status,
                        state: row.state
                    };

                    setDetailData({
                        skyslope: fallbackSkySlope,
                        brokerage_engine: null
                    });
                    setLoading(false);
                } else {
                    setError(err.message);
                    setLoading(false);
                }
            });
    }, [fileId, row]);

    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem', animation: 'fadeIn 0.2s ease'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    width: '100%', maxWidth: '880px',
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
                    overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.1rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-primary)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            SkySlope Transaction Detail
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {fileId}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '1.25rem', lineHeight: 1,
                            transition: 'background 0.15s'
                        }}
                    >×</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                    {[['skyslope', 'SkySlope Details'], ['brokerage_engine', 'Brokerage Engine Record']].map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            style={{
                                flex: 1, padding: '0.85rem 1rem',
                                background: tab === key ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: tab === key ? '3px solid var(--primary)' : '3px solid transparent',
                                color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', fontWeight: tab === key ? 600 : 500,
                                fontSize: '0.875rem', transition: 'all 0.2s'
                            }}
                        >{label}</button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem' }}>
                            <div className="spinner" />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Fetching transaction details…</span>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', color: 'var(--danger)', padding: '2rem' }}>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>⚠️ Failed to load details</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>{error}</p>
                        </div>
                    ) : detailData ? (
                        tab === 'skyslope' ? (
                            detailData.skyslope ? (
                                <SectionedDetailView data={(() => {
                                    const filtered = { ...detailData.skyslope };
                                    delete filtered.transaction_specialist;
                                    delete filtered.specialist;
                                    delete filtered.reviewer;
                                    delete filtered.reviewer_name;
                                    return filtered;
                                })()} />
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No SkySlope details found.</div>
                            )
                        ) : (
                            detailData.brokerage_engine
                                ? <SectionedDetailView data={detailData.brokerage_engine} />
                                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No related Brokerage Engine record found.</div>
                        )
                    ) : null}
                </div>
            </div>
        </div>
    );
}

// ── Brokerage Detail Modal ──────────────────────────────────────────────────
function BrokerageDetailModal({ transactionId, row, onClose }) {
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('brokerage_engine'); // 'brokerage_engine' | 'skyslope'

    useEffect(() => {
        setLoading(true);
        setError(null);
        setDetailData(null);
        fetch(`${BASE_URL}/brokerage_engine/detail?transactionid=${transactionId}`)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(json => { setDetailData(json); setLoading(false); })
            .catch(err => {
                console.warn("Backend brokerage detail fetch failed, falling back to local card row data:", err);
                if (row) {
                    const fallbackBE = {
                        transactionid: row.transaction_id || row.id || transactionId,
                        property_address: row.property_address,
                        buyer_name: row.be_buyer_name,
                        seller_name: row.be_seller_name,
                        closed_date: row.be_closed_date,
                        contract_date: row.be_contract_date,
                        sale_price: row.be_sale_price,
                        listing_price: row.be_listing_price,
                        gross_commission: row.be_gross_commission,
                        transaction_status: row.be_transaction_status,
                        state: row.state,
                        transaction_specialist: row.transaction_specialist
                    };

                    const fallbackSkySlope = {
                        saleguid: row.skyslopefileid,
                        propertyaddress: row.property_address,
                        buyer_name: row.ss_buyer_name,
                        seller_name: row.ss_seller_name,
                        close_date: row.ss_closed_date,
                        contract_date: row.ss_contract_date,
                        sale_price: row.ss_sale_price,
                        listing_price: row.ss_listing_price,
                        gross_commission: row.ss_gross_commission,
                        transaction_status: row.ss_transaction_status,
                        state: row.state
                    };

                    setDetailData({
                        brokerage_engine: fallbackBE,
                        skyslope: row.skyslopefileid ? fallbackSkySlope : null
                    });
                    setLoading(false);
                } else {
                    setError(err.message);
                    setLoading(false);
                }
            });
    }, [transactionId, row]);

    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem', animation: 'fadeIn 0.2s ease'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    width: '100%', maxWidth: '880px',
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
                    overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.1rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-primary)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            Brokerage Engine Transaction Detail
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {transactionId}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '1.25rem', lineHeight: 1,
                            transition: 'background 0.15s'
                        }}
                    >×</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                    {[['brokerage_engine', 'Brokerage Engine Record'], ['skyslope', 'Related SkySlope Record']].map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            style={{
                                flex: 1, padding: '0.85rem 1rem',
                                background: tab === key ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: tab === key ? '3px solid var(--primary)' : '3px solid transparent',
                                color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', fontWeight: tab === key ? 600 : 500,
                                fontSize: '0.875rem', transition: 'all 0.2s'
                            }}
                        >{label}</button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem' }}>
                            <div className="spinner" />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Fetching transaction details…</span>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', color: 'var(--danger)', padding: '2rem' }}>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>⚠️ Failed to load details</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>{error}</p>
                        </div>
                    ) : detailData ? (
                        tab === 'brokerage_engine' ? (
                            detailData.brokerage_engine
                                ? <SectionedDetailView data={detailData.brokerage_engine} />
                                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No Brokerage Engine details found.</div>
                        ) : (
                            detailData.skyslope && detailData.skyslope.match !== false
                                ? <SectionedDetailView data={(() => {
                                    const filtered = { ...detailData.skyslope };
                                    delete filtered.transaction_specialist;
                                    delete filtered.specialist;
                                    delete filtered.reviewer;
                                    delete filtered.reviewer_name;
                                    return filtered;
                                })()} />
                                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No related SkySlope record found.</div>
                        )
                    ) : null}
                </div>
            </div>
        </div>
    );
}

// ── Premium Kanban Card ──────────────────────────────────────────────────────
function KanbanCard({ row, col, onCardClick }) {
    // Mismatches state
    const mismatches = {
        commission: (row.be_gross_commission != null && row.ss_gross_commission != null && Number(row.be_gross_commission) !== Number(row.ss_gross_commission)) || row.gross_commission_mismatch === 'mismatch',
        closeDate: row.closed_date_mismatch === true,
        contractDate: row.contract_date_mismatch === true,
        salePrice: row.sale_price_mismatch === true,
        listingPrice: row.listing_price_comparison === 'mismatch',
        status: row.transaction_status_mismatch === true,
        buyerName: row.buyer_name_comparison === 'mismatch' || row.buyer_name_mismatch === 'mismatch',
        sellerName: row.seller_name_comparison === 'mismatch' || row.seller_name_mismatch === 'mismatch',
    };

    const hasMismatch = Object.values(mismatches).some(Boolean);

    const mismatchItems = [];
    if (mismatches.closeDate) {
        mismatchItems.push({ label: 'Close Date', be: row.be_closed_date, ss: row.ss_closed_date });
    }
    if (mismatches.contractDate) {
        mismatchItems.push({ label: 'Contract Date', be: row.be_contract_date, ss: row.ss_contract_date });
    }
    if (mismatches.salePrice) {
        mismatchItems.push({ label: 'Sale Price', be: fmtCurrency(row.be_sale_price), ss: fmtCurrency(row.ss_sale_price) });
    }
    if (mismatches.listingPrice) {
        mismatchItems.push({ label: 'Listing Price', be: fmtCurrency(row.be_listing_price), ss: fmtCurrency(row.ss_listing_price) });
    }
    if (mismatches.commission) {
        mismatchItems.push({ label: 'Commission', be: fmtCurrency(row.be_gross_commission), ss: fmtCurrency(row.ss_gross_commission) });
    }
    if (mismatches.status) {
        mismatchItems.push({ label: 'Status', be: row.be_transaction_status, ss: row.ss_transaction_status });
    }
    if (mismatches.buyerName) {
        mismatchItems.push({ label: 'Buyer Name', be: row.be_buyer_name, ss: row.ss_buyer_name });
    }
    if (mismatches.sellerName) {
        mismatchItems.push({ label: 'Seller Name', be: row.be_seller_name, ss: row.ss_seller_name });
    }

    const isSkyslope = col.id === 'skyslope';

    return (
        <div
            className="kanban-card"
            style={{
                '--card-accent': col.color,
                borderLeft: `3.5px solid ${hasMismatch ? 'var(--danger)' : col.color}`,
                boxShadow: hasMismatch ? '0 2px 8px rgba(220, 38, 38, 0.08)' : 'none',
                cursor: 'pointer',
                padding: '0.85rem 0.95rem',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
            onClick={() => onCardClick(row, col.id)}
            title="Click to view transaction details"
        >
            <div className="kanban-card-header" style={{ marginBottom: '0.25rem' }}>
                <div className="kanban-card-address" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }} title={row.property_address}>
                    {row.property_address || '—'}
                </div>
            </div>
            {(col.id === 'pending' || col.id === 'closed' || col.id === 'cancelled') && (
                <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.55rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontWeight: 500
                }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            sessionStorage.setItem('specialist_dash_search', row.transaction_specialist || 'unassigned');
                            window.location.hash = 'txn_specialist_dash';
                        }}
                        style={{
                            cursor: 'pointer',
                            color: row.transaction_specialist ? 'var(--primary)' : 'var(--text-muted)',
                            transition: 'color 0.15s',
                            fontStyle: row.transaction_specialist ? 'normal' : 'italic',
                            opacity: row.transaction_specialist ? 1 : 0.6
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#818cf8';
                            e.currentTarget.style.textDecoration = 'underline';
                            e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = row.transaction_specialist ? 'var(--primary)' : 'var(--text-muted)';
                            e.currentTarget.style.textDecoration = 'none';
                            e.currentTarget.style.opacity = row.transaction_specialist ? '1' : '0.6';
                        }}
                        title={`Click to view Transaction Specialist Dashboard for ${row.transaction_specialist || 'unassigned'}`}
                    >
                        {row.transaction_specialist || 'Unassigned'}
                    </span>
                </div>
            )}
            {col.id === 'skyslope' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    marginBottom: '0.55rem'
                }}>
                    {row.ss_status && (
                        <div style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontWeight: 500
                        }}>
                            <span style={{
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                textTransform: 'capitalize'
                            }}>
                                {row.ss_status}
                            </span>
                        </div>
                    )}
                    <div style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontWeight: 500
                    }}>
                        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                sessionStorage.setItem('reviewer_dash_search', row.reviewer || 'unassigned');
                                window.location.hash = 'reviewer_dash';
                            }}
                            style={{
                                cursor: 'pointer',
                                color: row.reviewer ? 'var(--primary)' : 'var(--text-muted)',
                                transition: 'color 0.15s',
                                fontStyle: row.reviewer ? 'normal' : 'italic',
                                opacity: row.reviewer ? 1 : 0.6
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#818cf8';
                                e.currentTarget.style.textDecoration = 'underline';
                                e.currentTarget.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = row.reviewer ? 'var(--primary)' : 'var(--text-muted)';
                                e.currentTarget.style.textDecoration = 'none';
                                e.currentTarget.style.opacity = row.reviewer ? '1' : '0.6';
                            }}
                            title={`Click to view Reviewer Dashboard for ${row.reviewer || 'unassigned'}`}
                        >
                            {row.reviewer || 'Unassigned'}
                        </span>
                    </div>
                </div>
            )}

            {/* Mismatch items rendering */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {mismatchItems.map((item, index) => (
                    <div key={index} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        background: 'rgba(239, 68, 68, 0.06)',
                        border: '1px solid rgba(239, 68, 68, 0.18)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.72rem'
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            ⚠️ {item.label} Mismatch
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '0.7rem', fontWeight: 500 }}>
                            <span>BE: {item.be || '—'}</span>
                            <span>SS: {item.ss || '—'}</span>
                        </div>
                    </div>
                ))}
                {mismatchItems.length === 0 && col.id !== 'skyslope' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--success)',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '6px',
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 600
                    }}>
                        ✅ All matched perfectly
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ col, data, loading, error, activeSpecialist, onCardClick }) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        let result = data || [];
        if (activeSpecialist === 'UNASSIGNED') {
            result = result.filter(r => !r.transaction_specialist);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(r =>
                (r.property_address || '').toLowerCase().includes(q) ||
                (r.transaction_specialist || '').toLowerCase().includes(q)
            );
        }

        // Display cards with mismatches first in pending, closed, and cancelled columns
        if (col.id === 'pending' || col.id === 'closed' || col.id === 'cancelled') {
            const mismatches = [];
            const matches = [];
            for (const row of result) {
                if (checkHasMismatch(row)) {
                    mismatches.push(row);
                } else {
                    matches.push(row);
                }
            }
            return [...mismatches, ...matches];
        }

        return result;
    }, [data, search, col.id, activeSpecialist]);

    const mismatchesCount = useMemo(() => {
        if (!data) return 0;
        let list = data;
        if (activeSpecialist === 'UNASSIGNED') {
            list = list.filter(r => !r.transaction_specialist);
        }
        return list.filter(checkHasMismatch).length;
    }, [data, activeSpecialist]);

    const hasAnyMismatch = mismatchesCount > 0;

    return (
        <div
            className="kanban-column"
            style={{
                '--col-color': hasAnyMismatch ? '#ef4444' : col.color,
                background: hasAnyMismatch
                    ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)'
                    : `linear-gradient(180deg, ${col.gradientFrom} 0%, ${col.gradientTo} 100%)`,
                border: hasAnyMismatch
                    ? '1px solid rgba(239, 68, 68, 0.35)'
                    : `1px solid ${col.borderColor}`,
                boxShadow: hasAnyMismatch
                    ? '0 4px 20px rgba(239, 68, 68, 0.05)'
                    : 'none'
            }}
        >
            <div className="kanban-col-header">
                <div className="kanban-col-title">
                    <span className="kanban-col-icon" style={{ color: hasAnyMismatch ? '#ef4444' : col.color }}>{col.icon}</span>
                    <span className="kanban-col-label">
                        {col.label}
                        {col.id === 'skyslope' && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.3rem', textTransform: 'lowercase' }}>
                                (not in brokerage engine)
                            </span>
                        )}
                    </span>
                    {col.id === 'skyslope' && hasAnyMismatch && (
                        <span className="kanban-col-mismatch-badge" style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            marginLeft: '0.4rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                        }}>
                            ⚠️ Mismatch
                        </span>
                    )}
                </div>
            </div>

            <div className="kanban-col-search">
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                    type="text"
                    className="kanban-search-input"
                    placeholder="Filter cards…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                />
                {search && <button className="kanban-search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>

            <div className="kanban-cards-container">
                {loading ? (
                    <div className="kanban-col-state">
                        <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }} />
                        <span>Loading…</span>
                    </div>
                ) : error ? (
                    <div className="kanban-col-state kanban-col-error">
                        <span>Failed to load: {error}</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="kanban-col-state">
                        <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>
                            {search ? 'No matches' : 'No items'}
                        </span>
                    </div>
                ) : (
                    filtered.map((row, i) => <KanbanCard key={row.id || row.transaction_id || i} row={row} col={col} onCardClick={onCardClick} />)
                )}
            </div>
        </div>
    );
}

// ── Main Page Component ──────────────────────────────────────────────────────
function MonthClosing() {
    const [selectedDetail, setSelectedDetail] = useState(null);

    const handleCardClick = (row, colId) => {
        if (colId === 'skyslope') {
            setSelectedDetail({ row, type: 'skyslope' });
        } else {
            setSelectedDetail({ row, type: 'brokerage' });
        }
    };

    // Parallel fetching states
    const [columnsData, setColumnsData] = useState({
        skyslope: [],
        pending: [],
        closed: [],
        cancelled: []
    });
    const [columnsLoading, setColumnsLoading] = useState({
        skyslope: true,
        pending: true,
        closed: true,
        cancelled: true
    });
    const [columnsError, setColumnsError] = useState({
        skyslope: null,
        pending: null,
        closed: null,
        cancelled: null
    });

    // Options for dropdowns — populated once from the initial unfiltered load.
    // Using a ref flag so applying filters later never overwrites these lists.
    const [stateOptions, setStateOptions] = useState([]);
    const [specialistOptions, setSpecialistOptions] = useState([]);
    const optionsPopulated = React.useRef(false);

    useEffect(() => {
        // Wait until all columns have finished loading
        const isLoaded = !columnsLoading.skyslope && !columnsLoading.pending &&
            !columnsLoading.closed && !columnsLoading.cancelled;
        if (!isLoaded) return;

        // Only populate once — prevents filtered re-fetches from shrinking the lists
        if (optionsPopulated.current) return;

        const states = new Set();
        const specialists = new Set();

        Object.values(columnsData).forEach(arr => {
            if (!Array.isArray(arr)) return;
            arr.forEach(row => {
                if (row.state) states.add(row.state.trim().toUpperCase());
                if (row.transaction_specialist) specialists.add(row.transaction_specialist.trim());
            });
        });

        if (states.size > 0) setStateOptions(Array.from(states).sort());
        if (specialists.size > 0) setSpecialistOptions(Array.from(specialists).sort());

        optionsPopulated.current = true;
    }, [columnsData, columnsLoading]);

    // Draft filter state
    const [draftFrom, setDraftFrom] = useState(() => sessionStorage.getItem('mc_draftFrom') || '');
    const [draftTo, setDraftTo] = useState(() => sessionStorage.getItem('mc_draftTo') || '');
    const [draftState, setDraftState] = useState(() => sessionStorage.getItem('mc_draftState') || '');
    const [draftSpecialist, setDraftSpecialist] = useState(() => sessionStorage.getItem('mc_draftSpecialist') || '');

    // Applied filter state (triggers fetch)
    const [activeFrom, setActiveFrom] = useState(() => sessionStorage.getItem('mc_activeFrom') || '');
    const [activeTo, setActiveTo] = useState(() => sessionStorage.getItem('mc_activeTo') || '');
    const [activeState, setActiveState] = useState(() => sessionStorage.getItem('mc_activeState') || '');
    const [activeSpecialist, setActiveSpecialist] = useState(() => sessionStorage.getItem('mc_activeSpecialist') || '');

    // Sync filters to sessionStorage to keep state across navigation unmounts
    useEffect(() => {
        sessionStorage.setItem('mc_draftFrom', draftFrom);
        sessionStorage.setItem('mc_draftTo', draftTo);
        sessionStorage.setItem('mc_draftState', draftState);
        sessionStorage.setItem('mc_draftSpecialist', draftSpecialist);
        sessionStorage.setItem('mc_activeFrom', activeFrom);
        sessionStorage.setItem('mc_activeTo', activeTo);
        sessionStorage.setItem('mc_activeState', activeState);
        sessionStorage.setItem('mc_activeSpecialist', activeSpecialist);
    }, [draftFrom, draftTo, draftState, draftSpecialist, activeFrom, activeTo, activeState, activeSpecialist]);

    // Helper to build URL for a single column with applied filters
    const buildColumnUrl = useCallback((colQuery) => {
        let url = `${BASE_URL}/month-closing/listing`;
        if (colQuery) {
            url += `?${colQuery}`;
        }
        const params = [];
        if (activeFrom) params.push(`from_close_date=${encodeURIComponent(activeFrom)}`);
        if (activeTo) params.push(`to_close_date=${encodeURIComponent(activeTo)}`);
        if (activeState) params.push(`state=${encodeURIComponent(activeState)}`);
        if (activeSpecialist && activeSpecialist !== 'UNASSIGNED') {
            params.push(`transaction_specialist=${encodeURIComponent(activeSpecialist)}`);
        }

        if (params.length > 0) {
            url += (colQuery ? '&' : '?') + params.join('&');
        }
        return url;
    }, [activeFrom, activeTo, activeState, activeSpecialist]);

    // Data fetching handler
    const fetchData = useCallback(async () => {
        // Set all columns to loading state
        setColumnsLoading({
            skyslope: true,
            pending: true,
            closed: true,
            cancelled: true
        });
        setColumnsError({
            skyslope: null,
            pending: null,
            closed: null,
            cancelled: null
        });

        // 1. Fetch SkySlope column
        const fetchSkySlope = async () => {
            try {
                const url = buildColumnUrl('skyslope=true');
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();

                setColumnsData(prev => ({
                    ...prev,
                    skyslope: Array.isArray(json.data) ? json.data : []
                }));
                setColumnsLoading(prev => ({
                    ...prev,
                    skyslope: false
                }));
            } catch (e) {
                console.error(`Error fetching column skyslope:`, e);
                setColumnsError(prev => ({
                    ...prev,
                    skyslope: e.message
                }));
                setColumnsLoading(prev => ({
                    ...prev,
                    skyslope: false
                }));
                setColumnsData(prev => ({
                    ...prev,
                    skyslope: []
                }));
            }
        };

        // 2. Fetch Pending, Closed, Cancelled columns (Single API Call)
        const fetchOtherColumns = async () => {
            try {
                const url = buildColumnUrl('');
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();

                const listings = Array.isArray(json.data) ? json.data : [];
                
                // Group by be_transaction_status
                const pendingData = [];
                const closedData = [];
                const cancelledData = [];

                listings.forEach(row => {
                    const status = (row.be_transaction_status || '').trim().toLowerCase();
                    if (status === 'pending') {
                        pendingData.push(row);
                    } else if (status === 'closed') {
                        closedData.push(row);
                    } else if (status === 'cancelled') {
                        cancelledData.push(row);
                    }
                });

                setColumnsData(prev => ({
                    ...prev,
                    pending: pendingData,
                    closed: closedData,
                    cancelled: cancelledData
                }));

                setColumnsLoading(prev => ({
                    ...prev,
                    pending: false,
                    closed: false,
                    cancelled: false
                }));
            } catch (e) {
                console.error(`Error fetching other columns:`, e);
                setColumnsError(prev => ({
                    ...prev,
                    pending: e.message,
                    closed: e.message,
                    cancelled: e.message
                }));
                setColumnsLoading(prev => ({
                    ...prev,
                    pending: false,
                    closed: false,
                    cancelled: false
                }));
                setColumnsData(prev => ({
                    ...prev,
                    pending: [],
                    closed: [],
                    cancelled: []
                }));
            }
        };

        // Run both fetches in parallel
        await Promise.all([fetchSkySlope(), fetchOtherColumns()]);
    }, [buildColumnUrl]);

    // Trigger initial load and loads on active filters change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
    const isAnyLoading = Object.values(columnsLoading).some(Boolean);

    return (
        <>
            <div className="dashboard">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1>Month Closing</h1>
                        <p>Mismatch breakdown across transactions. Click a card to expand details.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="sync-btn" onClick={fetchData} disabled={isAnyLoading} title="Refresh">
                            <svg
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                style={{ animation: isAnyLoading ? 'spin 1s linear infinite' : 'none' }}
                            >
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {isAnyLoading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mc-filter-bar">
                    <div className="mc-filter-group">
                        <label className="mc-filter-label">Close Date From</label>
                        <input
                            type="date"
                            className="mc-filter-input"
                            value={draftFrom}
                            onChange={e => setDraftFrom(e.target.value)}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>
                    <div className="mc-filter-group">
                        <label className="mc-filter-label">Close Date To</label>
                        <input
                            type="date"
                            className="mc-filter-input"
                            value={draftTo}
                            onChange={e => setDraftTo(e.target.value)}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>
                    <div className="mc-filter-group">
                        <label className="mc-filter-label">State</label>
                        <select
                            className="mc-filter-input"
                            value={draftState}
                            onChange={e => setDraftState(e.target.value)}
                            style={{ appearance: 'auto', background: 'var(--bg-main, #f8fafc)', paddingRight: '1rem' }}
                        >
                            <option value="">All States</option>
                            {stateOptions.map(st => (
                                <option key={st} value={st}>{st}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mc-filter-group" style={{ flex: 2 }}>
                        <label className="mc-filter-label">Transaction Specialist</label>
                        <select
                            className="mc-filter-input"
                            value={draftSpecialist}
                            onChange={e => setDraftSpecialist(e.target.value)}
                            style={{ appearance: 'auto', background: 'var(--bg-main, #f8fafc)', paddingRight: '1rem' }}
                        >
                            <option value="">All Specialists</option>
                            <option value="UNASSIGNED">Unassigned (Null)</option>
                            {specialistOptions.map(spec => (
                                <option key={spec} value={spec}>{spec}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mc-filter-actions">
                        <button className="mc-apply-btn" onClick={handleApply} disabled={isAnyLoading}>Apply</button>
                        {(hasActive || draftFrom || draftTo || draftState || draftSpecialist) && (
                            <button className="mc-clear-btn" onClick={handleClear}>Clear</button>
                        )}
                    </div>
                    {hasActive && (
                        <div className="mc-active-chips">
                            {activeFrom && <span className="mc-chip">From: {activeFrom}</span>}
                            {activeTo && <span className="mc-chip">To: {activeTo}</span>}
                            {activeState && <span className="mc-chip">State: {activeState}</span>}
                            {activeSpecialist && <span className="mc-chip">Specialist: {activeSpecialist}</span>}
                        </div>
                    )}
                </div>

                {/* Scrollable board wrapper */}
                <div className="kanban-scroll-wrapper">
                    {/* Summary row */}
                    <div className="kanban-summary-row">
                        {COLUMNS.map(col => {
                            let list = columnsData[col.id] || [];
                            if (activeSpecialist === 'UNASSIGNED') {
                                list = list.filter(r => !r.transaction_specialist);
                            }
                            const count = list.length;
                            return (
                                <div key={col.id} className="month-closing-summary-card" style={{ borderTop: `3px solid ${col.color}` }}>
                                    <div className="month-closing-summary-icon" style={{ color: col.color }}>{col.icon}</div>
                                    <div>
                                        <div className="month-closing-summary-label">
                                            {col.label}
                                            {col.id === 'skyslope' && (
                                                <div style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'lowercase', marginTop: '2px', lineHeight: 1.1 }}>
                                                    (not in brokerage engine)
                                                </div>
                                            )}
                                        </div>
                                        <div className="month-closing-summary-value" style={{ color: col.color }}>
                                            {columnsLoading[col.id] ? '…' : columnsError[col.id] ? 'Err' : count.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Kanban board */}
                    <div className="kanban-board">
                        {COLUMNS.map(col => (
                            <KanbanColumn
                                key={col.id}
                                col={col}
                                data={columnsData[col.id]}
                                loading={columnsLoading[col.id]}
                                error={columnsError[col.id]}
                                activeSpecialist={activeSpecialist}
                                onCardClick={handleCardClick}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Detail Modals */}
            {selectedDetail && selectedDetail.type === 'skyslope' && (
                <SkySlopeDetailModal
                    fileId={selectedDetail.row.skyslopefileid}
                    row={selectedDetail.row}
                    onClose={() => setSelectedDetail(null)}
                />
            )}
            {selectedDetail && selectedDetail.type === 'brokerage' && (
                <BrokerageDetailModal
                    transactionId={selectedDetail.row.transaction_id || selectedDetail.row.id}
                    row={selectedDetail.row}
                    onClose={() => setSelectedDetail(null)}
                />
            )}
        </>
    );
}

export default MonthClosing;
