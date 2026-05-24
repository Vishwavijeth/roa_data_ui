import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { PARAMETERS, API_BASE, ROWS_PER_PAGE, getResult } from '../constants';
import { IconDownload } from '../components/Icons';

function ReconciliationView() {
    const getInitialParam = () => {
        const savedId = localStorage.getItem('reconciliation_active_param_id');
        if (savedId) {
            const found = PARAMETERS.find(p => p.id === savedId);
            if (found) return found;
        }
        return PARAMETERS.find(p => p.id === 'gross_commission') || PARAMETERS[0];
    };

    const [activeParam, setActiveParam] = useState(getInitialParam);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);
    const [showNoSkyslope, setShowNoSkyslope] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (activeParam && activeParam.id) {
            localStorage.setItem('reconciliation_active_param_id', activeParam.id);
        }
    }, [activeParam]);

    const isServerSideParam = (paramId) => {
        return ['saleprice', 'status', 'close_date', 'gross_commission'].includes(paramId);
    };

    const [apiMismatchCount, setApiMismatchCount] = useState(null);
    const [serverTotalPages, setServerTotalPages] = useState(1);
    const [summaryStats, setSummaryStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Fetch summary stats when switching to server-side parameters
    useEffect(() => {
        if (isServerSideParam(activeParam.id)) {
            setStatsLoading(true);
            const paramName = activeParam.endpoint;
            Promise.all([
                fetch(`https://roa-data-backend.vercel.app/compare/${paramName}/summary`).then(res => {
                    if (!res.ok) throw new Error('Summary fetch failed');
                    return res.json();
                }),
                fetch(`https://roa-data-backend.vercel.app/compare/${paramName}?page=1&mismatch=true`).then(res => {
                    if (!res.ok) throw new Error('Mismatch count fetch failed');
                    return res.json();
                })
            ])
            .then(([summaryJson, mismatchJson]) => {
                setSummaryStats({
                    ...summaryJson,
                    mismatch_count: mismatchJson.total_count
                });
                setStatsLoading(false);
            })
            .catch(err => {
                console.error('Error fetching summary stats:', err);
                setStatsLoading(false);
            });
        } else {
            setSummaryStats(null);
        }
    }, [activeParam]);

    // Fetch data for server-side endpoints (paginated and server-filtered)
    useEffect(() => {
        if (!isServerSideParam(activeParam.id)) return;

        setLoading(true);
        setError(null);

        const paramName = activeParam.endpoint;
        let url = `https://roa-data-backend.vercel.app/compare/${paramName}?page=${page}`;
        if (showOnlyMismatches) {
            url += '&mismatch=true';
        } else if (showNoSkyslope) {
            url += '&no_skyslope=true';
        }

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (json && Array.isArray(json.data)) {
                    setData(json.data);
                    setServerTotalPages(json.total_pages || 1);
                } else {
                    setData([]);
                    setServerTotalPages(1);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setLoading(false);
            });
    }, [activeParam, page, showOnlyMismatches, showNoSkyslope]);

    // Fetch data for other endpoints (client-side paginated and client-filtered)
    useEffect(() => {
        if (!activeParam.endpoint) { setData([]); return; }
        if (isServerSideParam(activeParam.id)) return;

        setLoading(true);
        setStatsLoading(true);
        setError(null);
        setData([]);
        setApiMismatchCount(null);
        setPage(1);

        fetch(`${activeParam.apiBase || API_BASE}/${activeParam.endpoint}`)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (json && Array.isArray(json.data)) {
                    setData(json.data);
                    setApiMismatchCount(json.mismatch_count ?? null);
                } else if (Array.isArray(json)) {
                    setData(json);
                    setApiMismatchCount(null);
                } else {
                    setData([]);
                    setApiMismatchCount(null);
                }
                setLoading(false);
                setStatsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setLoading(false);
                setStatsLoading(false);
            });
    }, [activeParam]);

    const stats = useMemo(() => {
        if (isServerSideParam(activeParam.id)) {
            if (summaryStats) {
                return {
                    total: summaryStats.total_count,
                    matchPct: summaryStats.match_percentage ? summaryStats.match_percentage.toFixed(1) : '0.0',
                    mismatchPct: summaryStats.mismatch_percentage ? summaryStats.mismatch_percentage.toFixed(1) : '0.0',
                    mismatchCount: summaryStats.mismatch_count ?? 0,
                    noSkyslopeCount: summaryStats.no_skyslope_record_count,
                    noSkysloppePct: ((summaryStats.no_skyslope_record_count / (summaryStats.total_count || 1)) * 100).toFixed(1),
                };
            }
            return { total: 0, matchPct: '0.0', mismatchPct: '0.0', mismatchCount: 0, noSkyslopeCount: 0, noSkysloppePct: '0.0' };
        }

        if (!data.length) return { total: 0, matchPct: 0, mismatchPct: 0, mismatchCount: 0, noSkyslopeCount: 0, noSkysloppePct: 0 };
        const withResult = data.filter(r => getResult(r) !== '');
        const noSkyslope = withResult.filter(r => getResult(r) === 'no_skyslope_record').length;
        const matches = withResult.filter(r => getResult(r) === 'match').length;
        const mismatches = apiMismatchCount != null ? apiMismatchCount : withResult.filter(r => getResult(r) === 'mismatch').length;
        // Base for percentages: only match + mismatch (exclude no_skyslope_record)
        const comparedBase = matches + mismatches || 1;
        return {
            total: data.length,
            matchPct: ((matches / comparedBase) * 100).toFixed(1),
            mismatchPct: ((mismatches / comparedBase) * 100).toFixed(1),
            mismatchCount: mismatches,
            noSkyslopeCount: noSkyslope,
            noSkysloppePct: ((noSkyslope / (withResult.length || 1)) * 100).toFixed(1),
        };
    }, [activeParam, data, apiMismatchCount, summaryStats]);

    const filteredData = useMemo(() => {
        let result = data;
        if (!isServerSideParam(activeParam.id)) {
            if (showOnlyMismatches) result = result.filter(r => getResult(r) === 'mismatch');
            if (showNoSkyslope) result = result.filter(r => getResult(r) === 'no_skyslope_record');
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionId || r.transactionid || '').toLowerCase().includes(q) ||
                (r.saleguid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [activeParam, data, showOnlyMismatches, showNoSkyslope, searchQuery]);

    const totalPages = useMemo(() => {
        if (isServerSideParam(activeParam.id)) {
            return serverTotalPages;
        }
        return Math.ceil(filteredData.length / ROWS_PER_PAGE);
    }, [activeParam, filteredData, serverTotalPages]);

    const paginatedData = useMemo(() => {
        if (isServerSideParam(activeParam.id)) {
            return filteredData;
        }
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [activeParam, filteredData, page]);

    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            // Fetch all parameter data in parallel
            const results = await Promise.all(
                PARAMETERS.map(async (param) => {
                    try {
                        if (isServerSideParam(param.id)) {
                            const res1 = await fetch(`${param.apiBase || API_BASE}/${param.endpoint}?page=1`);
                            if (!res1.ok) return { param, data: [] };
                            const json1 = await res1.json();
                            let rows = (json1 && Array.isArray(json1.data)) ? json1.data : [];
                            const tPages = (json1 && json1.total_pages) ? json1.total_pages : 1;
                            if (tPages > 1) {
                                const fetchPromises = [];
                                for (let p = 2; p <= tPages; p++) {
                                    fetchPromises.push(
                                        fetch(`${param.apiBase || API_BASE}/${param.endpoint}?page=${p}`)
                                            .then(r => r.ok ? r.json() : { data: [] })
                                            .then(j => (j && Array.isArray(j.data)) ? j.data : [])
                                            .catch(() => [])
                                    );
                                }
                                const remainingPages = await Promise.all(fetchPromises);
                                remainingPages.forEach(pageData => {
                                    rows = rows.concat(pageData);
                                });
                            }
                            return { param, data: rows };
                        } else {
                            const res = await fetch(`${param.apiBase || API_BASE}/${param.endpoint}`);
                            if (!res.ok) return { param, data: [] };
                            const json = await res.json();
                            const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                            return { param, data: rows };
                        }
                    } catch (err) {
                        console.error(`Error downloading param ${param.label}:`, err);
                        return { param, data: [] };
                    }
                })
            );

            // Build a map keyed by saleguid, merging all parameter columns
            const mergedMap = new Map();
            results.forEach(({ param, data: rows }) => {
                rows.forEach(row => {
                    const key = row.saleguid || row.transactionId || row.transactionid || '';
                    if (!key) return;
                    if (!mergedMap.has(key)) {
                        mergedMap.set(key, {
                            saleguid: row.saleguid || '',
                            transactionId: row.transactionId || row.transactionid || '',
                            propertyaddress: row.propertyaddress || '',
                        });
                    }
                    const entry = mergedMap.get(key);
                    // Use the property address from any row that has it
                    if (!entry.propertyaddress && row.propertyaddress) entry.propertyaddress = row.propertyaddress;
                    entry[`SS_${param.label}`] = row[param.skyslopeKey] != null ? String(row[param.skyslopeKey]) : '';
                    entry[`BE_${param.label}`] = row[param.beKey] != null ? String(row[param.beKey]) : '';
                    entry[`Result_${param.label}`] = row.match_result || '';
                });
            });

            const exportData = Array.from(mergedMap.values());
            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, 'Reconciliation Report');
            writeFile(wb, 'ROA_Full_Reconciliation_Report.xlsx');
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="dashboard">
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1>Transaction Reconciliation</h1>
                    <p>Compare transaction data across Brokerage Engine and SkySlope.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={downloading}>
                    <IconDownload /> {downloading ? 'Generating Report…' : 'Download Report'}
                </button>
            </div>

            {/* Metric cards */}
            <div className="metrics-container">
                <div className="metric-card">
                    <h3>Total Records</h3>
                    <p className="value">
                        {statsLoading ? (
                            <span className="dot-elastic"><span></span><span></span><span></span></span>
                        ) : (
                            stats.total.toLocaleString()
                        )}
                    </p>
                </div>
                <div className="metric-card">
                    <h3>Match Percentage</h3>
                    <p className="value success">
                        {statsLoading ? (
                            <span className="dot-elastic"><span></span><span></span><span></span></span>
                        ) : (
                            `${stats.matchPct}%`
                        )}
                    </p>
                </div>
                <div className="metric-card">
                    <h3>Mismatch Percentage</h3>
                    <p className="value danger">
                        {statsLoading ? (
                            <span className="dot-elastic"><span></span><span></span><span></span></span>
                        ) : (
                            `${stats.mismatchPct}%`
                        )}
                    </p>
                </div>
                <div className="metric-card">
                    <h3>No SkySlope File ID</h3>
                    <p className="value warning">
                        {statsLoading ? (
                            <span className="dot-elastic"><span></span><span></span><span></span></span>
                        ) : (
                            stats.noSkyslopeCount.toLocaleString()
                        )}
                    </p>
                </div>
            </div>

            {/* Parameter chips */}
            <div className="parameters-section">
                <h2>Comparison Parameters</h2>
                <div className="chips-container">
                    {(() => {
                        const orderedIds = ['gross_commission', 'close_date', 'status', 'saleprice'];
                        const orderedParams = [
                            ...orderedIds.map(id => PARAMETERS.find(p => p.id === id)).filter(Boolean),
                            ...PARAMETERS.filter(p => !orderedIds.includes(p.id))
                        ];
                        return orderedParams.map(param => (
                            <button
                                key={param.id}
                                className={`chip ${activeParam.id === param.id ? 'active' : ''}`}
                                onClick={() => { setActiveParam(param); setShowOnlyMismatches(false); setShowNoSkyslope(false); setSearchQuery(''); setPage(1); }}
                            >
                                {param.label}
                            </button>
                        ));
                    })()}
                </div>
            </div>

            {/* Table card */}
            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2>{activeParam.label}</h2>
                        <div className="mismatch-toggle-group">
                            <button
                                className={`toggle-btn ${showOnlyMismatches ? 'active' : ''}`}
                                onClick={() => { setShowOnlyMismatches(!showOnlyMismatches); if (!showOnlyMismatches) setShowNoSkyslope(false); setPage(1); }}
                            >Mismatches</button>
                            <span className="mismatch-count-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {statsLoading ? (
                                    <span className="dot-elastic badge-dots"><span></span><span></span><span></span></span>
                                ) : (
                                    stats.mismatchCount
                                )}
                            </span>
                        </div>
                        <div className="mismatch-toggle-group">
                            <button
                                className={`toggle-btn no-skyslope ${showNoSkyslope ? 'active' : ''}`}
                                onClick={() => { setShowNoSkyslope(!showNoSkyslope); if (!showNoSkyslope) setShowOnlyMismatches(false); setPage(1); }}
                            >No SkySlope File ID</button>
                            <span className="no-skyslope-count-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {statsLoading ? (
                                    <span className="dot-elastic badge-dots"><span></span><span></span><span></span></span>
                                ) : (
                                    stats.noSkyslopeCount
                                )}
                            </span>
                        </div>
                        {(showOnlyMismatches || showNoSkyslope || searchQuery) && (
                            <button
                                className="clear-filters-btn"
                                onClick={() => { setShowOnlyMismatches(false); setShowNoSkyslope(false); setSearchQuery(''); setPage(1); }}
                            >✕ Clear Filters</button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="table-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID, Sale Guid, or Property Address…"
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
                        <p>Loading {activeParam.label} data…</p>
                    </div>
                ) : error ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>⚠️ Failed to load data: {error}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Make sure the API server is running at <code>{API_BASE}</code>
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Sale Guid</th>
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>SkySlope {activeParam.label}</th>
                                        <th>BE {activeParam.label}</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => {
                                        const resultVal = getResult(row);
                                        const isMismatch = resultVal === 'mismatch';
                                        const isNoSkyslope = resultVal === 'no_skyslope_record';
                                        const skVal = row[activeParam.skyslopeKey];
                                        const beVal = row[activeParam.beKey];
                                        return (
                                            <tr key={i} className={isMismatch ? 'mismatch' : isNoSkyslope ? 'no-skyslope' : ''}>
                                                <td className="cell-guid">{row.saleguid || '-'}</td>
                                                <td className="cell-guid">{row.transactionId || row.transactionid || '-'}</td>
                                                <td className="cell-address">{row.propertyaddress || '-'}</td>
                                                <td>{skVal != null ? String(skVal) : 'null'}</td>
                                                <td>{beVal != null ? String(beVal) : 'null'}</td>
                                                <td>
                                                    {resultVal
                                                        ? <span className={`badge ${resultVal}`}>{resultVal}</span>
                                                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {paginatedData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td>
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

export default ReconciliationView;
