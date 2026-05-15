import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { REVIEWER_API, ROWS_PER_PAGE } from '../constants';
import { IconDownload } from '../components/Icons';
import { extractState } from '../utils/helpers';

function ReviewerListingView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [ssStatusFilter, setSsStatusFilter] = useState('');
    const [reviewerFilter, setReviewerFilter] = useState('');
    const [stageFilter, setStageFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        const url = stageFilter
            ? `${REVIEWER_API}?stage_name=${encodeURIComponent(stageFilter)}`
            : REVIEWER_API;
        fetch(url)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, [stageFilter]);

    // Derive unique values for filters
    const uniqueStates = useMemo(() => {
        const states = data.map(r => extractState(r.propertyaddress)).filter(Boolean);
        return [...new Set(states)].sort();
    }, [data]);

    const uniqueSsStatuses = useMemo(() => {
        return [...new Set(data.map(r => r.ss_status).filter(Boolean))].sort();
    }, [data]);

    const uniqueReviewers = useMemo(() => {
        return [...new Set(data.map(r => r.reviewer_name).filter(Boolean))].sort();
    }, [data]);

    const uniqueStages = useMemo(() => {
        return [...new Set(data.map(r => r.stage_name).filter(Boolean))].sort();
    }, [data]);

    // Filtered data
    const filteredData = useMemo(() => {
        let result = data;

        if (dateFrom) {
            result = result.filter(r => r.escrow_close_date && r.escrow_close_date >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(r => r.escrow_close_date && r.escrow_close_date <= dateTo);
        }
        if (stateFilter) {
            result = result.filter(r => extractState(r.propertyaddress) === stateFilter);
        }
        if (ssStatusFilter) {
            result = result.filter(r => r.ss_status === ssStatusFilter);
        }
        if (reviewerFilter) {
            if (reviewerFilter === 'UNASSIGNED') {
                result = result.filter(r => !r.reviewer_name);
            } else {
                result = result.filter(r => r.reviewer_name === reviewerFilter);
            }
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.saleguid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [data, dateFrom, dateTo, stateFilter, ssStatusFilter, reviewerFilter, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(filteredData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Reviewer Dashboard');
        writeFile(wb, 'Reviewer_Dashboard_report.xlsx');
    };

    const hasActiveFilters = searchQuery || dateFrom || dateTo || stateFilter || ssStatusFilter || reviewerFilter || stageFilter;

    const clearAllFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setStateFilter('');
        setSsStatusFilter('');
        setReviewerFilter('');
        setStageFilter('');
        setPage(1);
    };

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Reviewer Listing</h1>
                    <p>View and filter reviewer assignments and transaction statuses.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

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

                {/* Search */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="rev-search" type="text" className="search-input"
                            placeholder="Search by Sale GUID or Property Address…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="rev-date-from" className="filter-label">Escrow Close Date From</label>
                        <input
                            id="rev-date-from" type="date" className="filter-select"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-date-to" className="filter-label">Escrow Close Date To</label>
                        <input
                            id="rev-date-to" type="date" className="filter-select"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-state-filter" className="filter-label">State</label>
                        <select
                            id="rev-state-filter" className="filter-select"
                            value={stateFilter}
                            onChange={e => { setStateFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All States</option>
                            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-ss-status-filter" className="filter-label">SS Status</label>
                        <select
                            id="rev-ss-status-filter" className="filter-select"
                            value={ssStatusFilter}
                            onChange={e => { setSsStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Statuses</option>
                            {uniqueSsStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-reviewer-filter" className="filter-label">Reviewer</label>
                        <select
                            id="rev-reviewer-filter" className="filter-select"
                            value={reviewerFilter}
                            onChange={e => { setReviewerFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Reviewers</option>
                            <option value="UNASSIGNED">Unassigned</option>
                            {uniqueReviewers.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-stage-filter" className="filter-label">Stage</label>
                        <select
                            id="rev-stage-filter" className="filter-select"
                            value={stageFilter}
                            onChange={e => { setStageFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Stages</option>
                            {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={clearAllFilters}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading Reviewer data…</p></div>
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
                                        <th>Property Address</th>
                                        <th>Reviewer</th>
                                        <th>Stage</th>
                                        <th>State</th>
                                        <th>Sale Price</th>
                                        <th>Listing Price</th>
                                        <th>Escrow Close Date</th>
                                        <th>SS Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="cell-guid">{row.saleguid || '-'}</td>
                                            <td className="cell-address">{row.propertyaddress || '-'}</td>
                                            <td>{row.reviewer_name || '-'}</td>
                                            <td>
                                                {row.stage_name
                                                    ? <span className="badge badge-stage">{row.stage_name}</span>
                                                    : '-'}
                                            </td>
                                            <td>{extractState(row.propertyaddress) || '-'}</td>
                                            <td>{row.sale_price != null ? `$${Number(row.sale_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.listing_price != null ? `$${Number(row.listing_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.escrow_close_date || '-'}</td>
                                            <td>
                                                {row.ss_status
                                                    ? <span className={`badge ${row.ss_status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.ss_status}</span>
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
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

export default ReviewerListingView;
