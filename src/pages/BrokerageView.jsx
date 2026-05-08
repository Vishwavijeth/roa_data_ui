import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { BE_API, ROWS_PER_PAGE } from '../constants';
import { IconDownload, IconArrowLeft } from '../components/Icons';
import SectionedDetailView from '../components/SectionedDetailView';

function BrokerageView({ syncingBE, syncProgress, syncBEResult, handleSyncBE, setSyncBEResult }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [closeDateFrom, setCloseDateFrom] = useState('');
    const [closeDateTo, setCloseDateTo] = useState('');
    const [contractDateFrom, setContractDateFrom] = useState('');
    const [contractDateTo, setContractDateTo] = useState('');

    const [selectedRecord, setSelectedRecord] = useState(null);
    const [detailTab, setDetailTab] = useState('details'); // 'details' | 'skyslope'
    const [detailData, setDetailData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        if (selectedRecord) {
            setLoadingDetail(true);
            setDetailData(null);
            fetch(`https://roa-data-backend.vercel.app/brokerage_engine/detail?transactionid=${selectedRecord.transactionid}`)
                .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
                .then(json => {
                    setDetailData(json);
                    setLoadingDetail(false);
                })
                .catch(err => {
                    console.error(err);
                    setDetailData({ _error: err.message });
                    setLoadingDetail(false);
                });
        }
    }, [selectedRecord]);

    // Browser back-button support
    useEffect(() => {
        if (selectedRecord) {
            window.history.pushState({ detail: true }, '');
            const handlePopState = () => setSelectedRecord(null);
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [selectedRecord]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(BE_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => { setData(Array.isArray(json) ? json : []); setLoading(false); })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    const stats = useMemo(() => {
        if (!data.length) return { total: 0, complete: 0, withSpecialist: 0 };
        return {
            total: data.length,
            complete: data.filter(r => r.status === 'Complete').length,
            withSpecialist: data.filter(r => r.transaction_specialist).length,
        };
    }, [data]);

    const uniqueStatuses = useMemo(() => [...new Set(data.map(r => r.status).filter(Boolean))].sort(), [data]);

    const filteredData = useMemo(() => {
        let result = data;
        if (statusFilter) result = result.filter(r => r.status === statusFilter);
        if (closeDateFrom) result = result.filter(r => r.close_date && r.close_date >= closeDateFrom);
        if (closeDateTo) result = result.filter(r => r.close_date && r.close_date <= closeDateTo);
        if (contractDateFrom) result = result.filter(r => r.contract_date && r.contract_date >= contractDateFrom);
        if (contractDateTo) result = result.filter(r => r.contract_date && r.contract_date <= contractDateTo);
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionid || '').toLowerCase().includes(q) ||
                (r.property_address || '').toLowerCase().includes(q) ||
                (r.buying_agent_name || '').toLowerCase().includes(q) ||
                (r.skyslopefileid || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [data, statusFilter, closeDateFrom, closeDateTo, contractDateFrom, contractDateTo, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Brokerage Engine');
        writeFile(wb, 'Brokerage_Engine_report.xlsx');
    };

    if (selectedRecord) {
        return (
            <div className="dashboard detail-view">
                <div className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <button
                        className="back-btn"
                        onClick={() => setSelectedRecord(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            padding: 0,
                            marginBottom: '1.5rem',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'color 0.2s'
                        }}
                    >
                        <IconArrowLeft /> Back to brokerage engine
                    </button>
                    <div style={{ width: '100%', padding: '1.5rem', background: 'linear-gradient(to right, rgba(14, 165, 233, 0.05), transparent)', borderLeft: '4px solid var(--primary)', borderRadius: '0 8px 8px 0' }}>
                        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {selectedRecord.property_address || 'No Address Provided'}
                        </h1>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Transaction ID:</span> {selectedRecord.transactionid || 'Unknown'}
                        </p>
                        <div style={{ marginTop: '0.75rem' }}>
                            {(loadingDetail ? !!selectedRecord.skyslopefileid : detailData?.skyslope?.match !== false) ? (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.3rem 0.75rem', borderRadius: '999px',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                    Matched with SkySlope data
                                </span>
                            ) : (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.3rem 0.75rem', borderRadius: '999px',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                                    No related SkySlope data
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="detail-card" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -4px rgba(0, 0, 0, 0.06)' }}>
                    <div className="tabs-container" style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                        <button
                            className={`tab-btn ${detailTab === 'details' ? 'active' : ''}`}
                            onClick={() => setDetailTab('details')}
                            style={{
                                flex: 1,
                                padding: '1.25rem 1.5rem',
                                background: detailTab === 'details' ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: detailTab === 'details' ? '3px solid var(--primary)' : '3px solid transparent',
                                color: detailTab === 'details' ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontWeight: detailTab === 'details' ? 600 : 500,
                                fontSize: '1rem',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                            }}
                        >
                            Details
                        </button>
                        <button
                            className={`tab-btn ${detailTab === 'skyslope' ? 'active' : ''}`}
                            onClick={() => setDetailTab('skyslope')}
                            style={{
                                flex: 1,
                                padding: '1.25rem 1.5rem',
                                background: detailTab === 'skyslope' ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: detailTab === 'skyslope' ? '3px solid var(--primary)' : '3px solid transparent',
                                color: detailTab === 'skyslope' ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontWeight: detailTab === 'skyslope' ? 600 : 500,
                                fontSize: '1rem',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                            }}
                        >
                            Related Skyslope Record
                        </button>
                    </div>

                    <div className="detail-content" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: loadingDetail || (detailData && detailData._error) ? 'center' : 'stretch', justifyContent: loadingDetail || (detailData && detailData._error) ? 'center' : 'flex-start' }}>
                        {loadingDetail ? (
                            <div className="loading" style={{ margin: '0 auto' }}><div className="spinner"></div><p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Fetching transaction details…</p></div>
                        ) : detailData && detailData._error ? (
                            <div style={{ textAlign: 'center', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '2rem', borderRadius: '8px' }}>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Failed to load details</p>
                                <p style={{ fontSize: '0.9rem' }}>{detailData._error}</p>
                            </div>
                        ) : detailData ? (
                            <div style={{ width: '100%', animation: 'fadeIn 0.3s ease-in-out' }}>
                                {detailTab === 'details' && (
                                    detailData.brokerage_engine
                                        ? <SectionedDetailView data={detailData.brokerage_engine} />
                                        : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}><p style={{ fontSize: '1.1rem' }}>No Brokerage Engine details found.</p></div>
                                )}
                                {detailTab === 'skyslope' && (
                                    detailData.skyslope && detailData.skyslope.match !== false
                                        ? <SectionedDetailView data={detailData.skyslope} />
                                        : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}><p style={{ fontSize: '1.1rem' }}>No related SkySlope record found for this transaction.</p></div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Brokerage Engine</h1>
                    <p>Transaction data sourced from Brokerage Engine.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        id="sync-be-data-btn"
                        className="export-btn"
                        onClick={handleSyncBE}
                        disabled={syncingBE}
                        style={{
                            background: syncingBE
                                ? 'linear-gradient(135deg, #4b4d8f, #3b3880)'
                                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            opacity: syncingBE ? 0.75 : 1,
                            cursor: syncingBE ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {syncingBE ? (
                            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{ animation: 'spin 1s linear infinite' }}>
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                            </svg>
                        ) : (
                            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                            </svg>
                        )}
                        {syncingBE ? 'Syncing…' : 'Sync BE Data'}
                    </button>
                    <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                        <IconDownload /> Download Report
                    </button>
                </div>
            </div>

            {/* Sync progress indicator */}
            {syncingBE && (
                <div style={{
                    margin: '0 0 1.25rem 0',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(79, 70, 229, 0.03))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    animation: 'fadeIn 0.3s ease-in-out',
                    backdropFilter: 'blur(8px)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {syncProgress < 100 ? (
                                <svg width="18" height="18" fill="none" stroke="#6366f1" viewBox="0 0 24 24"
                                    style={{ animation: 'spin 1s linear infinite' }}>
                                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                                    <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                {syncProgress < 100 ? 'Syncing Brokerage Engine Data…' : 'Sync Complete!'}
                            </span>
                        </div>
                        <span style={{
                            fontWeight: 700, fontSize: '1.25rem',
                            color: syncProgress === 100 ? '#10b981' : '#6366f1',
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: '3.5rem',
                            textAlign: 'right',
                        }}>
                            {syncProgress}%
                        </span>
                    </div>
                    <div className="progress-bar-wrap" style={{ height: '10px', background: 'rgba(99, 102, 241, 0.1)', marginBottom: '0.6rem' }}>
                        <div className="progress-bar-fill" style={{
                            width: `${syncProgress}%`,
                            background: syncProgress === 100
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #6366f1, #818cf8)',
                            transition: 'width 0.4s ease, background 0.3s ease',
                        }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {syncProgress < 20
                            ? 'Connecting to Brokerage Engine API…'
                            : syncProgress < 50
                                ? 'Fetching transaction records…'
                                : syncProgress < 80
                                    ? 'Processing and updating records…'
                                    : syncProgress < 100
                                        ? 'Finalizing data sync…'
                                        : 'All records have been synced successfully.'}
                    </p>
                </div>
            )}

            {/* Sync success banner */}
            {!syncingBE && syncBEResult && syncBEResult.ok && (
                <div style={{
                    margin: '0 0 1.25rem 0',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    animation: 'fadeIn 0.3s ease-in-out',
                }}
                >
                    <span style={{ fontSize: '1rem' }}>✅</span>
                    <span>{syncBEResult.message}</span>
                </div>
            )}

            {/* Table card */}
            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Transactions</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length.toLocaleString()} records</span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search + filter */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="be-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID, Property Address, or Buying Agent…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Date filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="be-close-from" className="filter-label">Close Date From</label>
                        <input id="be-close-from" type="date" className="filter-select"
                            value={closeDateFrom} onChange={e => { setCloseDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-close-to" className="filter-label">Close Date To</label>
                        <input id="be-close-to" type="date" className="filter-select"
                            value={closeDateTo} onChange={e => { setCloseDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-contract-from" className="filter-label">Contract Date From</label>
                        <input id="be-contract-from" type="date" className="filter-select"
                            value={contractDateFrom} onChange={e => { setContractDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-contract-to" className="filter-label">Contract Date To</label>
                        <input id="be-contract-to" type="date" className="filter-select"
                            value={contractDateTo} onChange={e => { setContractDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-status-filter" className="filter-label">Status</label>
                        <select id="be-status-filter" className="filter-select"
                            value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {(searchQuery || statusFilter || closeDateFrom || closeDateTo || contractDateFrom || contractDateTo) && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={() => {
                                setSearchQuery(''); setStatusFilter(''); setCloseDateFrom(''); setCloseDateTo('');
                                setContractDateFrom(''); setContractDateTo(''); setPage(1);
                            }}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading Brokerage Engine data…</p></div>
                ) : error ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>⚠️ Failed to load data: {error}</p>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>Buying Agent</th>
                                        <th>Sale Price</th>
                                        <th>Contract Date</th>
                                        <th>Close Date</th>
                                        <th>Transaction Specialist</th>
                                        <th>Status</th>
                                        <th>Skyslope FileID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i} onClick={() => { setSelectedRecord(row); setDetailTab('details'); }} style={{ cursor: 'pointer' }} className="clickable-row">
                                            <td className="cell-guid">{row.transactionid || '-'}</td>
                                            <td className="cell-address">{row.property_address || '-'}</td>
                                            <td>{row.buying_agent_name || '-'}</td>
                                            <td>{row.sale_price != null ? `$${Number(row.sale_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.contract_date || '-'}</td>
                                            <td>{row.close_date || '-'}</td>
                                            <td>{row.transaction_specialist || '-'}</td>
                                            <td>
                                                {row.status
                                                    ? <span className={`badge ${row.status.toLowerCase()}`}>{row.status}</span>
                                                    : '-'}
                                            </td>
                                            <td>{row.skyslopefileid || '-'}</td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
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

export default BrokerageView;
