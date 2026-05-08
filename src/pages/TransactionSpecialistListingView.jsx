import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { TXN_SPECIALIST_API, ROWS_PER_PAGE } from '../constants';
import { IconDownload } from '../components/Icons';
import { extractState } from '../utils/helpers';

function TransactionSpecialistListingView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [workflowStatusFilter, setWorkflowStatusFilter] = useState('');
    const [specialistFilter, setSpecialistFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(TXN_SPECIALIST_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    // Derive unique values for filters
    const uniqueStates = useMemo(() => {
        const states = data.map(r => extractState(r.propertyaddress)).filter(Boolean);
        return [...new Set(states)].sort();
    }, [data]);

    const uniqueWorkflowStatuses = useMemo(() => {
        return [...new Set(data.map(r => r.be_workflow_status).filter(Boolean))].sort();
    }, [data]);

    const uniqueSpecialists = useMemo(() => {
        return [...new Set(data.map(r => r.transaction_specialist).filter(Boolean))].sort();
    }, [data]);

    // Filtered data
    const filteredData = useMemo(() => {
        let result = data;

        // Date range filter on be_closed_date
        if (dateFrom) {
            result = result.filter(r => r.be_closed_date && r.be_closed_date >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(r => r.be_closed_date && r.be_closed_date <= dateTo);
        }

        // State filter
        if (stateFilter) {
            result = result.filter(r => extractState(r.propertyaddress) === stateFilter);
        }

        // Workflow Status filter
        if (workflowStatusFilter) {
            result = result.filter(r => r.be_workflow_status === workflowStatusFilter);
        }

        // Transaction specialist filter
        if (specialistFilter) {
            if (specialistFilter === 'UNASSIGNED') {
                result = result.filter(r => !r.transaction_specialist);
            } else {
                result = result.filter(r => r.transaction_specialist === specialistFilter);
            }
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [data, dateFrom, dateTo, stateFilter, workflowStatusFilter, specialistFilter, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(filteredData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Transaction Specialist');
        writeFile(wb, 'Transaction_Specialist_report.xlsx');
    };

    const hasActiveFilters = searchQuery || dateFrom || dateTo || stateFilter || workflowStatusFilter || specialistFilter;

    const clearAllFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setStateFilter('');
        setWorkflowStatusFilter('');
        setSpecialistFilter('');
        setPage(1);
    };

    return (
        <div className="dashboard">
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1>Transaction Specialist Listing</h1>
                    <p>View and filter transaction specialist assignments and statuses.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            {/* Table */}
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
                            id="txn-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID, Property Address"
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
                        <label htmlFor="txn-date-from" className="filter-label">Close Date From</label>
                        <input
                            id="txn-date-from" type="date" className="filter-select"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-date-to" className="filter-label">Close Date To</label>
                        <input
                            id="txn-date-to" type="date" className="filter-select"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-state-filter" className="filter-label">State</label>
                        <select
                            id="txn-state-filter" className="filter-select"
                            value={stateFilter}
                            onChange={e => { setStateFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All States</option>
                            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-workflow-status-filter" className="filter-label">BE Status</label>
                        <select
                            id="txn-workflow-status-filter" className="filter-select"
                            value={workflowStatusFilter}
                            onChange={e => { setWorkflowStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Statuses</option>
                            {uniqueWorkflowStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-specialist-filter" className="filter-label">Transaction Specialist</label>
                        <select
                            id="txn-specialist-filter" className="filter-select"
                            value={specialistFilter}
                            onChange={e => { setSpecialistFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Specialists</option>
                            <option value="UNASSIGNED">Unassigned</option>
                            {uniqueSpecialists.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={clearAllFilters}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading Transaction Specialist data…</p></div>
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
                                        <th>Transaction Specialist</th>
                                        <th>State</th>
                                        <th>Sale Price</th>
                                        <th>Listing Price</th>
                                        <th>Close Date</th>
                                        <th>BE Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="cell-guid">{row.transactionid || '-'}</td>
                                            <td className="cell-address">{row.propertyaddress || '-'}</td>
                                            <td>{row.transaction_specialist || '-'}</td>
                                            <td>{extractState(row.propertyaddress) || '-'}</td>
                                            <td>{row.be_sale_price != null ? `$${Number(row.be_sale_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.listing_price != null ? `$${Number(row.listing_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.be_closed_date || '-'}</td>
                                            <td>
                                                {row.be_workflow_status
                                                    ? <span className={`badge ${row.be_workflow_status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.be_workflow_status}</span>
                                                    : '-'}
                                            </td>
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

export default TransactionSpecialistListingView;
