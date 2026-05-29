import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { TXN_SPECIALIST_API, ROWS_PER_PAGE } from '../constants';
import { IconDownload } from '../components/shared/Icons';
import { extractState, formatDateUS } from '../utils/helpers';
import DateFilterInput from '../components/shared/DateFilterInput';
import MultiSelect from '../components/shared/MultiSelect';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

function TransactionSpecialistListingView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Filters — all multi-select (arrays), except date range
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState([]);
    const [workflowStatusFilter, setWorkflowStatusFilter] = useState([]);
    const [specialistFilter, setSpecialistFilter] = useState([]);

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

    const specialistOptions = useMemo(() => ['UNASSIGNED', ...uniqueSpecialists], [uniqueSpecialists]);

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
        if (stateFilter.length > 0) {
            result = result.filter(r => stateFilter.includes(extractState(r.propertyaddress)));
        }

        // Workflow Status filter
        if (workflowStatusFilter.length > 0) {
            result = result.filter(r => workflowStatusFilter.includes(r.be_workflow_status));
        }

        // Transaction specialist filter
        if (specialistFilter.length > 0) {
            result = result.filter(r => {
                if (specialistFilter.includes('UNASSIGNED') && !r.transaction_specialist) return true;
                return specialistFilter.includes(r.transaction_specialist);
            });
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

    const hasActiveFilters = searchQuery || dateFrom || dateTo ||
        stateFilter.length > 0 || workflowStatusFilter.length > 0 || specialistFilter.length > 0;

    const clearAllFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setStateFilter([]);
        setWorkflowStatusFilter([]);
        setSpecialistFilter([]);
        setPage(1);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction Specialist Listing</h1>
                    <p className="text-sm text-slate-500 mt-1">View and filter transaction specialist assignments and statuses.</p>
                </div>
                <Button
                    onClick={handleDownload}
                    disabled={!data.length}
                    className="font-semibold text-xs gap-2 h-9 shadow-md shadow-blue-600/10"
                >
                    <IconDownload /> Download Report
                </Button>
            </div>

            {/* Table */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-md font-bold text-slate-800">Transactions</h2>
                        {data.length > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 font-bold text-[10px] rounded">
                                {filteredData.length.toLocaleString()} records
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search and Filters grid */}
                <div className="p-5 border-b border-slate-100 bg-white space-y-4">
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="txn-search"
                            type="text"
                            placeholder="Search by Transaction ID, Property Address…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                            className="pl-9 pr-8 w-full"
                        />
                        {searchQuery && (
                            <button
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                onClick={() => { setSearchQuery(''); setPage(1); }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                        <div className="space-y-1">
                            <label htmlFor="txn-date-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close From</label>
                            <DateFilterInput
                                id="txn-date-from"
                                value={dateFrom}
                                onChange={val => { setDateFrom(val); setPage(1); }}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="txn-date-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close To</label>
                            <DateFilterInput
                                id="txn-date-to"
                                value={dateTo}
                                onChange={val => { setDateTo(val); setPage(1); }}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">State</label>
                            <MultiSelect
                                id="txn-state-filter"
                                options={uniqueStates}
                                selected={stateFilter}
                                onChange={v => { setStateFilter(v); setPage(1); }}
                                placeholder="All States"
                                allLabel="All States"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">BE Status</label>
                            <MultiSelect
                                id="txn-workflow-status-filter"
                                options={uniqueWorkflowStatuses}
                                selected={workflowStatusFilter}
                                onChange={v => { setWorkflowStatusFilter(v); setPage(1); }}
                                placeholder="All Statuses"
                                allLabel="All Statuses"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Specialist</label>
                            <MultiSelect
                                id="txn-specialist-filter"
                                options={specialistOptions}
                                selected={specialistFilter}
                                onChange={v => { setSpecialistFilter(v); setPage(1); }}
                                placeholder="All Specialists"
                                allLabel="All Specialists"
                            />
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <div className="flex justify-end pt-1">
                            <Button
                                variant="ghost"
                                onClick={clearAllFilters}
                                className="h-8.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                            >
                                Clear All Filters
                            </Button>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading Transaction Specialist data…</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center max-w-sm mx-auto space-y-2">
                        <div className="text-3xl">⚠️</div>
                        <h3 className="text-sm font-bold text-red-600">Failed to load data</h3>
                        <p className="text-xs text-slate-500">{error}</p>
                    </div>
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Transaction ID</TableHead>
                                    <TableHead className="min-w-[200px]">Property Address</TableHead>
                                    <TableHead>Transaction Specialist</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead>Sale Price</TableHead>
                                    <TableHead>Listing Price</TableHead>
                                    <TableHead>Close Date</TableHead>
                                    <TableHead className="text-right pr-6">BE Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((row, i) => (
                                    <TableRow key={i} className="hover:bg-slate-50/55 transition-colors">
                                        <TableCell className="font-mono text-xs text-slate-500">{row.transactionid || '-'}</TableCell>
                                        <TableCell className="font-semibold text-slate-800 text-xs py-2.5">{row.propertyaddress || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-600 font-medium">{row.transaction_specialist || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium font-mono uppercase">{extractState(row.propertyaddress) || '-'}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-700">{row.be_sale_price != null ? `$${Number(row.be_sale_price).toLocaleString()}` : '-'}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-700">{row.listing_price != null ? `$${Number(row.listing_price).toLocaleString()}` : '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium">{formatDateUS(row.be_closed_date)}</TableCell>
                                        <TableCell className="text-right pr-6 shrink-0 select-none">
                                            {row.be_workflow_status ? (
                                                <Badge variant="secondary" className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold">
                                                    {row.be_workflow_status}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {paginatedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-slate-400 py-10 font-medium">
                                            No data available
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination footer */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 bg-slate-50/20 flex items-center justify-between">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-8 font-semibold text-xs text-slate-600"
                                >
                                    Previous
                                </Button>
                                <span className="text-xs font-semibold text-slate-500">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="h-8 font-semibold text-xs text-slate-600"
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}

export default TransactionSpecialistListingView;
