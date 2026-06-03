import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { REVIEWER_SUMMARY_API } from '../constants';
import { IconDownload } from '../components/shared/Icons';
import MultiSelect from '../components/shared/MultiSelect';
import DateFilterInput from '../components/shared/DateFilterInput';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

function ReviewerDashboardView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState(() => {
        const stored = sessionStorage.getItem('reviewer_dash_search');
        if (stored) {
            sessionStorage.removeItem('reviewer_dash_search');
            return stored;
        }
        return '';
    });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState([]); // multi-select → array
    const [uniqueStates, setUniqueStates] = useState([]);



    useEffect(() => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (dateFrom) params.append('from_date', dateFrom);
        if (dateTo) params.append('to_date', dateTo);
        stateFilter.forEach(s => params.append('state', s));
        const queryString = params.toString();
        const url = queryString ? `${REVIEWER_SUMMARY_API}?${queryString}` : REVIEWER_SUMMARY_API;

        fetch(url)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                // API returns { states: [...], data: [...] }
                if (json && Array.isArray(json.states)) {
                    // Deduplicate and sort states (API may have duplicates like 'Ca', 'CA')
                    const deduped = [...new Set(json.states.map(s => s.toUpperCase()))].sort();
                    setUniqueStates(deduped);
                }
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, [dateFrom, dateTo, stateFilter]);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.trim().toLowerCase();
        return data.filter(r => (r.reviewer_full_name || '').toLowerCase().includes(q));
    }, [data, searchQuery]);

    const totals = useMemo(() => {
        const outstanding = data.reduce((sum, r) => sum + (r.transactions_outstanding || 0), 0);
        const closed = data.reduce((sum, r) => sum + (r.transactions_closed || 0), 0);
        return { reviewers: data.length, outstanding, closed, total: outstanding + closed };
    }, [data]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Reviewer Summary');
        writeFile(wb, 'Reviewer_Summary.xlsx');
    };

    const hasActiveFilters = dateFrom || dateTo || stateFilter.length > 0 || searchQuery;

    const clearAllFilters = () => {
        setDateFrom('');
        setDateTo('');
        setStateFilter([]);
        setSearchQuery('');
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reviewer Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Summary of reviewers — outstanding vs closed transactions.</p>
                </div>
                <Button 
                    onClick={handleDownload} 
                    disabled={!data.length}
                    className="font-semibold text-xs gap-2 h-9 shadow-md shadow-blue-600/10"
                >
                    <IconDownload /> Download Report
                </Button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:border-slate-300 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Reviewers</span>
                        <div className="text-2xl font-bold text-slate-800 mt-2">
                            {totals.reviewers.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-amber-200 hover:bg-amber-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Outstanding Transactions</span>
                        <div className="text-2xl font-bold text-amber-600 mt-2">
                            {totals.outstanding.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-emerald-200 hover:bg-emerald-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Closed Transactions</span>
                        <div className="text-2xl font-bold text-emerald-600 mt-2">
                            {totals.closed.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-indigo-200 hover:bg-indigo-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Managed</span>
                        <div className="text-2xl font-bold text-indigo-600 mt-2">
                            {totals.total.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-md font-bold text-slate-800">Reviewer Breakdown</h2>
                        {data.length > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 font-bold text-[10px] rounded">
                                {filteredData.length} of {data.length} reviewers
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Search and Filters grid */}
                <div className="p-5 border-b border-slate-100 bg-white space-y-4">
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="reviewer-dash-search"
                            type="text"
                            placeholder="Search by reviewer name…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 pr-8 w-full"
                        />
                        {searchQuery && (
                            <button 
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold" 
                                onClick={() => setSearchQuery('')}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                            <label htmlFor="rev-dash-date-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close From</label>
                            <DateFilterInput
                                id="rev-dash-date-from"
                                value={dateFrom}
                                onChange={val => setDateFrom(val)}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="rev-dash-date-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close To</label>
                            <DateFilterInput
                                id="rev-dash-date-to"
                                value={dateTo}
                                onChange={val => setDateTo(val)}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="space-y-1 z-20">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">State</label>
                            <MultiSelect
                                id="rev-dash-state-filter"
                                options={uniqueStates}
                                selected={stateFilter}
                                onChange={v => setStateFilter(v)}
                                placeholder="All States"
                                allLabel="All States"
                            />
                        </div>
                        
                        {hasActiveFilters && (
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={clearAllFilters}
                                    className="h-9 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold w-full md:w-auto"
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading reviewer summary…</p>
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
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>Reviewer</TableHead>
                                    <TableHead className="w-40">Outstanding</TableHead>
                                    <TableHead className="w-40">Closed</TableHead>
                                    <TableHead className="w-28">Total</TableHead>
                                    <TableHead className="min-w-[220px]">Distribution</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((row, i) => {
                                    const outstanding = row.transactions_outstanding || 0;
                                    const closed = row.transactions_closed || 0;
                                    const total = outstanding + closed;
                                    const outPct = total > 0 ? (outstanding / total * 100).toFixed(0) : 0;
                                    const closedPct = total > 0 ? (closed / total * 100).toFixed(0) : 0;
                                    return (
                                        <TableRow key={i}>
                                            <TableCell className="text-center font-mono text-xs text-slate-400">{i + 1}</TableCell>
                                            <TableCell className="font-semibold text-slate-800 text-xs">{row.reviewer_full_name || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="warning" className="w-9 justify-center rounded font-semibold text-xs">
                                                    {outstanding}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="success" className="w-9 justify-center rounded font-semibold text-xs">
                                                    {closed}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold text-slate-800 text-xs">{total}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-5 rounded-md overflow-hidden flex-1 min-w-[120px] bg-slate-100">
                                                        {outstanding > 0 && (
                                                            <div 
                                                                style={{ width: `${outPct}%` }} 
                                                                className="bg-red-500 transition-all duration-500 ease-out"
                                                                title={`Outstanding: ${outstanding} (${outPct}%)`} 
                                                            />
                                                        )}
                                                        {closed > 0 && (
                                                            <div 
                                                                style={{ width: `${closedPct}%` }} 
                                                                className="bg-blue-500 transition-all duration-500 ease-out"
                                                                title={`Closed: ${closed} (${closedPct}%)`} 
                                                            />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-bold white-space-nowrap shrink-0">
                                                        {closedPct}% closed
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-slate-400 py-10 font-medium">
                                            No data available
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {/* Legend */}
                        <div className="flex gap-4 p-4 px-6 border-t border-slate-100 bg-slate-50/20 text-xs font-bold text-slate-400 select-none">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-red-500 block shrink-0" />
                                Outstanding
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-blue-500 block shrink-0" />
                                Closed
                            </span>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}

export default ReviewerDashboardView;
