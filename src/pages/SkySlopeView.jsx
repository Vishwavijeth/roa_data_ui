import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { SS_API, ROWS_PER_PAGE } from '../constants';
import { IconDownload, IconArrowLeft } from '../components/Icons';
import SectionedDetailView from '../components/SectionedDetailView';

function SkySlopeView({ syncingSS, syncSSProgress, syncSSResult, handleSyncSS, setSyncSSResult }) {
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
    const [detailTab, setDetailTab] = useState('skyslope');
    const [detailData, setDetailData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        if (selectedRecord) {
            setLoadingDetail(true);
            setDetailData(null);
            fetch(`https://roa-data-backend.vercel.app/skyslope/detail?saleguid=${selectedRecord.saleguid}`)
                .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
                .then(json => {
                    setDetailData(json);
                    setLoadingDetail(false);
                })
                .catch(err => {
                    console.error(err);
                    // If no linked BE record, still show skyslope data from the row itself
                    setDetailData({ skyslope: selectedRecord });
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
        fetch(SS_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => { setData(Array.isArray(json) ? json : []); setLoading(false); })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

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
                (r.saleguid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q) ||
                (r.transaction_id || '').toLowerCase().includes(q)
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
        utils.book_append_sheet(wb, ws, 'SkySlope Data');
        writeFile(wb, 'SkySlope_Data_report.xlsx');
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
                        <IconArrowLeft /> Back to SkySlope data
                    </button>
                    <div style={{ width: '100%', padding: '1.5rem', background: 'linear-gradient(to right, rgba(14, 165, 233, 0.05), transparent)', borderLeft: '4px solid var(--primary)', borderRadius: '0 8px 8px 0' }}>
                        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {selectedRecord.propertyaddress || 'No Address Provided'}
                        </h1>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Sale GUID:</span> {selectedRecord.saleguid || 'Unknown'}
                        </p>
                        <div style={{ marginTop: '0.75rem' }}>
                            {selectedRecord.transaction_id ? (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.3rem 0.75rem', borderRadius: '999px',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                    Matched with Brokerage Engine data
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
                                    No related Brokerage Engine data
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="detail-card" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -4px rgba(0, 0, 0, 0.06)' }}>
                    <div className="tabs-container" style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                        <button
                            className={`tab-btn ${detailTab === 'skyslope' ? 'active' : ''}`}
                            onClick={() => setDetailTab('skyslope')}
                            style={{
                                flex: 1, padding: '1.25rem 1.5rem',
                                background: detailTab === 'skyslope' ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: detailTab === 'skyslope' ? '3px solid var(--primary)' : '3px solid transparent',
                                color: detailTab === 'skyslope' ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', fontWeight: detailTab === 'skyslope' ? 600 : 500,
                                fontSize: '1rem', transition: 'all 0.2s ease', outline: 'none'
                            }}
                        >
                            SkySlope Details
                        </button>
                        <button
                            className={`tab-btn ${detailTab === 'details' ? 'active' : ''}`}
                            onClick={() => setDetailTab('details')}
                            style={{
                                flex: 1, padding: '1.25rem 1.5rem',
                                background: detailTab === 'details' ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: detailTab === 'details' ? '3px solid var(--primary)' : '3px solid transparent',
                                color: detailTab === 'details' ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', fontWeight: detailTab === 'details' ? 600 : 500,
                                fontSize: '1rem', transition: 'all 0.2s ease', outline: 'none'
                            }}
                        >
                            Related Brokerage Engine Record
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
                                {detailTab === 'skyslope' && (
                                    detailData.skyslope
                                        ? <SectionedDetailView data={detailData.skyslope} />
                                        : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}><p style={{ fontSize: '1.1rem' }}>No SkySlope details found.</p></div>
                                )}
                                {detailTab === 'details' && (
                                    detailData.brokerage_engine
                                        ? <SectionedDetailView data={detailData.brokerage_engine} />
                                        : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}><p style={{ fontSize: '1.1rem' }}>No related Brokerage Engine record found.</p></div>
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
                    <h1>SkySlope Data</h1>
                    <p>Transaction data sourced from SkySlope.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        id="sync-skyslope-data-btn"
                        className="export-btn"
                        onClick={handleSyncSS}
                        disabled={syncingSS}
                        style={{
                            background: syncingSS
                                ? 'linear-gradient(135deg, #0369a1, #0284c7)'
                                : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            opacity: syncingSS ? 0.75 : 1,
                            cursor: syncingSS ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {syncingSS ? (
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
                        {syncingSS ? 'Syncing…' : 'Sync SkySlope Data'}
                    </button>
                    <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                        <IconDownload /> Download Report
                    </button>
                </div>
            </div>

            {/* Sync progress indicator */}
            {syncingSS && (
                <div style={{
                    margin: '0 0 1.25rem 0', padding: '1.25rem 1.5rem', borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(2, 132, 199, 0.03))',
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    animation: 'fadeIn 0.3s ease-in-out', backdropFilter: 'blur(8px)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {syncSSProgress < 100 ? (
                                <svg width="18" height="18" fill="none" stroke="#0ea5e9" viewBox="0 0 24 24"
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
                                {syncSSProgress < 100 ? 'Syncing SkySlope Data…' : 'Sync Complete!'}
                            </span>
                        </div>
                        <span style={{
                            fontWeight: 700, fontSize: '1.25rem',
                            color: syncSSProgress === 100 ? '#10b981' : '#0ea5e9',
                            fontVariantNumeric: 'tabular-nums', minWidth: '3.5rem', textAlign: 'right',
                        }}>
                            {syncSSProgress}%
                        </span>
                    </div>
                    <div className="progress-bar-wrap" style={{ height: '10px', background: 'rgba(14, 165, 233, 0.1)', marginBottom: '0.6rem' }}>
                        <div className="progress-bar-fill" style={{
                            width: `${syncSSProgress}%`,
                            background: syncSSProgress === 100
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                            transition: 'width 0.4s ease, background 0.3s ease',
                        }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {syncSSProgress < 20
                            ? 'Connecting to SkySlope API…'
                            : syncSSProgress < 50
                                ? 'Fetching sale records…'
                                : syncSSProgress < 80
                                    ? 'Processing and updating records…'
                                    : syncSSProgress < 100
                                        ? 'Finalizing data sync…'
                                        : 'All records have been synced successfully.'}
                    </p>
                </div>
            )}

            {/* Sync success banner */}
            {!syncingSS && syncSSResult && syncSSResult.ok && (
                <div style={{
                    margin: '0 0 1.25rem 0', padding: '0.75rem 1.25rem', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981', fontWeight: 500, fontSize: '0.875rem',
                    animation: 'fadeIn 0.3s ease-in-out',
                }}>
                    <span style={{ fontSize: '1rem' }}>✅</span>
                    <span>{syncSSResult.message}</span>
                </div>
            )}

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

                {/* Search + filters */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="ss-search" type="text" className="search-input"
                            placeholder="Search by Sale GUID, Property Address, Transaction ID"
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
                        <label htmlFor="ss-close-from" className="filter-label">Close Date From</label>
                        <input id="ss-close-from" type="date" className="filter-select"
                            value={closeDateFrom} onChange={e => { setCloseDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-close-to" className="filter-label">Close Date To</label>
                        <input id="ss-close-to" type="date" className="filter-select"
                            value={closeDateTo} onChange={e => { setCloseDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-contract-from" className="filter-label">Contract Date From</label>
                        <input id="ss-contract-from" type="date" className="filter-select"
                            value={contractDateFrom} onChange={e => { setContractDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-contract-to" className="filter-label">Contract Date To</label>
                        <input id="ss-contract-to" type="date" className="filter-select"
                            value={contractDateTo} onChange={e => { setContractDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-status-filter" className="filter-label">Status</label>
                        <select id="ss-status-filter" className="filter-select" value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
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
                    <div className="loading"><div className="spinner"></div><p>Loading SkySlope data…</p></div>
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
                                        <th>Sale GUID</th>
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>Buyer Name</th>
                                        <th>Buyer Agent</th>
                                        <th>Contract Date</th>
                                        <th>Close Date</th>
                                        <th>Reviewer</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i} onClick={() => { setSelectedRecord(row); setDetailTab('skyslope'); }} style={{ cursor: 'pointer' }} className="clickable-row">
                                            <td className="cell-guid">{row.saleguid || '-'}</td>
                                            <td>{row.transaction_id || 'No related BE data'}</td>
                                            <td>
                                                {row.propertyaddress ? (
                                                    row.propertyaddress.includes(',') ? (
                                                        <>
                                                            <div>{row.propertyaddress.substring(0, row.propertyaddress.indexOf(','))}</div>
                                                            <div>{row.propertyaddress.substring(row.propertyaddress.indexOf(',') + 1).trim()}</div>
                                                        </>
                                                    ) : row.propertyaddress
                                                ) : '-'}
                                            </td>
                                            <td>{row.buyer_name || '-'}</td>
                                            <td>{row.buyer_agent_name || '-'}</td>
                                            <td>{row.contract_date || '-'}</td>
                                            <td>{row.close_date || '-'}</td>
                                            <td>{row.reviewer || '-'}</td>
                                            <td>
                                                {row.status
                                                    ? <span className={`badge ${row.status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.status}</span>
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
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

export default SkySlopeView;
