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
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('reviewer_dash_search') || '');
    const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem('reviewer_dash_filter_dateFrom') || '');
    const [dateTo, setDateTo] = useState(() => sessionStorage.getItem('reviewer_dash_filter_dateTo') || '');
    const [stateFilter, setStateFilter] = useState(() => {
        try {
            return JSON.parse(sessionStorage.getItem('reviewer_dash_filter_state')) || [];
        } catch {
            return [];
        }
    });
    const [ssStatusFilter, setSsStatusFilter] = useState(() => {
        try {
            return JSON.parse(sessionStorage.getItem('reviewer_dash_filter_ssStatus')) || [];
        } catch {
            return [];
        }
    });
    const [reviewerFilter, setReviewerFilter] = useState(() => {
        try {
            return JSON.parse(sessionStorage.getItem('reviewer_dash_filter_reviewer')) || [];
        } catch {
            return [];
        }
    });
    const [stageFilter, setStageFilter] = useState(() => {
        try {
            return JSON.parse(sessionStorage.getItem('reviewer_dash_filter_stage')) || [];
        } catch {
            return [];
        }
    });
    const [typeOfSaleFilter, setTypeOfSaleFilter] = useState(() => {
        try {
            return JSON.parse(sessionStorage.getItem('reviewer_dash_filter_typeOfSale')) || [];
        } catch {
            return [];
        }
    });

    // Stored filter dropdown options loaded from API
    const [availableFilters, setAvailableFilters] = useState(null);



    useEffect(() => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (dateFrom) params.append('from_date', dateFrom);
        if (dateTo) params.append('to_date', dateTo);
        stateFilter.forEach(s => params.append('state', s));
        ssStatusFilter.forEach(s => params.append('status', s));
        reviewerFilter.forEach(r => params.append('reviewer', r));
        stageFilter.forEach(st => params.append('stage_name', st));
        typeOfSaleFilter.forEach(t => params.append('type_of_sale', t));

        const url = `${REVIEWER_SUMMARY_API}?${params.toString()}`;

        fetch(url)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                
                if (json && json.summary) {
                    setSummary(json.summary);
                } else {
                    setSummary(null);
                }

                if (json.filters) {
                    setAvailableFilters(prev => {
                        if (prev && prev.state_list && prev.state_list.length > 0) {
                            return prev;
                        }

                        const stage_list = Array.isArray(json.filters.stage_list) ? [...json.filters.stage_list].sort() : [];
                        const state_list = Array.isArray(json.filters.state_list) ? [...json.filters.state_list].sort() : [];
                        const status_list = Array.isArray(json.filters.status_list) ? [...json.filters.status_list].sort() : [];
                        const reviewer_list = Array.isArray(json.filters.reviewer_list) ? [...json.filters.reviewer_list].sort() : [];
                        const type_of_sale_list = Array.isArray(json.filters.type_of_sale_list) ? [...json.filters.type_of_sale_list].sort() : [];

                        return {
                            stage_list,
                            state_list,
                            status_list,
                            reviewer_list,
                            type_of_sale_list
                        };
                    });
                } else if (json.states) {
                    // Fallback for older states format
                    setAvailableFilters(prev => {
                        if (prev && prev.state_list && prev.state_list.length > 0) return prev;
                        const state_list = Array.isArray(json.states) ? [...new Set(json.states.map(s => s.toUpperCase()))].sort() : [];
                        return {
                            stage_list: [],
                            state_list,
                            status_list: [],
                            reviewer_list: [],
                            type_of_sale_list: []
                        };
                    });
                }

                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, [dateFrom, dateTo, stateFilter, ssStatusFilter, reviewerFilter, stageFilter, typeOfSaleFilter]);

    // Save filters to sessionStorage when they change
    useEffect(() => {
        sessionStorage.setItem('reviewer_dash_search', searchQuery);
        sessionStorage.setItem('reviewer_dash_filter_dateFrom', dateFrom);
        sessionStorage.setItem('reviewer_dash_filter_dateTo', dateTo);
        sessionStorage.setItem('reviewer_dash_filter_state', JSON.stringify(stateFilter));
        sessionStorage.setItem('reviewer_dash_filter_ssStatus', JSON.stringify(ssStatusFilter));
        sessionStorage.setItem('reviewer_dash_filter_reviewer', JSON.stringify(reviewerFilter));
        sessionStorage.setItem('reviewer_dash_filter_stage', JSON.stringify(stageFilter));
        sessionStorage.setItem('reviewer_dash_filter_typeOfSale', JSON.stringify(typeOfSaleFilter));
    }, [searchQuery, dateFrom, dateTo, stateFilter, ssStatusFilter, reviewerFilter, stageFilter, typeOfSaleFilter]);

    // Parse options for the MultiSelects, fallback to empty arrays before load
    const filterOptions = useMemo(() => {
        if (!availableFilters) {
            return {
                stage_list: [],
                state_list: [],
                status_list: [],
                reviewer_list: [],
                type_of_sale_list: []
            };
        }
        return availableFilters;
    }, [availableFilters]);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.trim().toLowerCase();
        return data.filter(r => (r.reviewer_full_name || '').toLowerCase().includes(q));
    }, [data, searchQuery]);

    const totals = useMemo(() => {
        if (summary) {
            return {
                reviewers: summary.count ?? data.length,
                outstanding: summary.outstanding_transactions ?? 0,
                closed: summary.closed_transactions ?? 0,
                total: (summary.outstanding_transactions ?? 0) + (summary.closed_transactions ?? 0)
            };
        }
        const outstanding = data.reduce((sum, r) => sum + (r.transactions_pending || 0) + (r.transactions_expired || 0), 0);
        const closed = data.reduce((sum, r) => sum + (r.transactions_closed || 0) + (r.transactions_archived || 0), 0);
        const total = data.reduce((sum, r) => sum + (r.total_transactions || 0), 0);
        return { reviewers: data.length, outstanding, closed, total };
    }, [data, summary]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Reviewer Summary');
        writeFile(wb, 'Reviewer_Summary.xlsx');
    };

    const hasActiveFilters = dateFrom || dateTo || searchQuery ||
        stateFilter.length > 0 || ssStatusFilter.length > 0 ||
        reviewerFilter.length > 0 || stageFilter.length > 0 ||
        typeOfSaleFilter.length > 0;

    const clearAllFilters = () => {
        setDateFrom('');
        setDateTo('');
        setStateFilter([]);
        setSsStatusFilter([]);
        setReviewerFilter([]);
        setStageFilter([]);
        setTypeOfSaleFilter([]);
        setSearchQuery('');
    };

    const handleRowClick = (reviewerName, specificStatus = undefined) => {
        // Carry over current dashboard filters to listing keys in sessionStorage
        sessionStorage.setItem('reviewer_filter_dateFrom', dateFrom);
        sessionStorage.setItem('reviewer_filter_dateTo', dateTo);
        sessionStorage.setItem('reviewer_filter_state', JSON.stringify(stateFilter));
        sessionStorage.setItem('reviewer_filter_stage', JSON.stringify(stageFilter));
        sessionStorage.setItem('reviewer_filter_typeOfSale', JSON.stringify(typeOfSaleFilter));

        if (reviewerName) {
            sessionStorage.setItem('reviewer_filter_reviewer', JSON.stringify([reviewerName]));
        } else {
            sessionStorage.setItem('reviewer_filter_reviewer', JSON.stringify(reviewerFilter));
        }

        if (specificStatus === 'clear') {
            sessionStorage.setItem('reviewer_filter_ssStatus', JSON.stringify([]));
        } else if (specificStatus === 'Cancelled') {
            sessionStorage.setItem('reviewer_filter_ssStatus', JSON.stringify(['Canceled/App', 'Canceled/Pend']));
        } else if (Array.isArray(specificStatus)) {
            sessionStorage.setItem('reviewer_filter_ssStatus', JSON.stringify(specificStatus));
        } else if (specificStatus) {
            sessionStorage.setItem('reviewer_filter_ssStatus', JSON.stringify([specificStatus]));
        } else {
            sessionStorage.setItem('reviewer_filter_ssStatus', JSON.stringify(ssStatusFilter));
        }

        window.location.hash = '#reviewer';
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card 
                    className="hover:border-slate-300 transition-all select-none cursor-pointer"
                    onClick={() => handleRowClick(undefined, 'clear')}
                >
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">total reviewer</span>
                        <div className="text-2xl font-bold text-slate-800 mt-2">
                            {totals.reviewers.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    className="hover:border-amber-200 hover:bg-amber-50/5 transition-all select-none cursor-pointer"
                    onClick={() => handleRowClick(undefined, ['Pending', 'Expired'])}
                >
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">outstanding transactions (pending & expired)</span>
                        <div className="text-2xl font-bold text-amber-600 mt-2">
                            {totals.outstanding.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    className="hover:border-emerald-200 hover:bg-emerald-50/5 transition-all select-none cursor-pointer"
                    onClick={() => handleRowClick(undefined, ['Closed', 'Archived'])}
                >
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">closed transactions (closed & archived)</span>
                        <div className="text-2xl font-bold text-emerald-600 mt-2">
                            {totals.closed.toLocaleString()}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
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
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">State</label>
                            <MultiSelect
                                id="rev-dash-state-filter"
                                options={filterOptions.state_list}
                                selected={stateFilter}
                                onChange={v => { setStateFilter(v); }}
                                placeholder="All States"
                                allLabel="All States"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">SS Status</label>
                            <MultiSelect
                                id="rev-dash-ss-status-filter"
                                options={filterOptions.status_list}
                                selected={ssStatusFilter}
                                onChange={v => { setSsStatusFilter(v); }}
                                placeholder="All Statuses"
                                allLabel="All Statuses"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Reviewer</label>
                            <MultiSelect
                                id="rev-dash-reviewer-filter"
                                options={filterOptions.reviewer_list}
                                selected={reviewerFilter}
                                onChange={v => { setReviewerFilter(v); }}
                                placeholder="All Reviewers"
                                allLabel="All Reviewers"
                                align="right"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Stage</label>
                            <MultiSelect
                                id="rev-dash-stage-filter"
                                options={filterOptions.stage_list}
                                selected={stageFilter}
                                onChange={v => { setStageFilter(v); }}
                                placeholder="All Stages"
                                allLabel="All Stages"
                                align="right"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Type of Sale</label>
                            <MultiSelect
                                id="rev-dash-type-of-sale-filter"
                                options={filterOptions.type_of_sale_list}
                                selected={typeOfSaleFilter}
                                onChange={v => { setTypeOfSaleFilter(v); }}
                                placeholder="All Types"
                                allLabel="All Types"
                                align="right"
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
                                    <TableHead className="w-12 text-center sticky left-0 z-20 bg-slate-50/75">#</TableHead>
                                    <TableHead className="sticky left-12 z-20 bg-slate-50/75 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Reviewer</TableHead>
                                    <TableHead className="text-center w-24">Expired</TableHead>
                                    <TableHead className="text-center w-36">Pending</TableHead>
                                    <TableHead className="text-center w-24">Closed</TableHead>
                                    <TableHead className="text-center w-24">Archived</TableHead>
                                    <TableHead className="text-center w-24">Canceled</TableHead>
                                    <TableHead className="text-center w-24">Incomplete</TableHead>
                                    <TableHead className="text-center w-28">Pre-Contract</TableHead>
                                    <TableHead className="text-center w-24 font-bold text-slate-900">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((row, i) => {
                                    const total = row.total_transactions || 0;
                                    const pending = row.transactions_pending || 0;
                                    const closed = row.transactions_closed || 0;
                                    const canceled = row.transactions_canceled || 0;
                                    const archived = row.transactions_archived || 0;
                                    const expired = row.transactions_expired || 0;
                                    const incomplete = row.transactions_incomplete || 0;
                                    const preContract = row.transactions_pre_contract || 0;

                                    return (
                                        <TableRow
                                            key={i}
                                            className="hover:bg-slate-50/55 transition-colors cursor-pointer"
                                            onClick={() => handleRowClick(row.reviewer_full_name)}
                                        >
                                            <TableCell className="text-center font-mono text-xs text-slate-400 sticky left-0 z-10 bg-white">{i + 1}</TableCell>
                                            <TableCell className="font-semibold text-slate-800 text-xs py-3 sticky left-12 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">{row.reviewer_full_name || '-'}</TableCell>

                                            {/* Expired */}
                                            <TableCell
                                                className="text-center font-medium text-slate-500 text-xs cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Expired'); }}
                                            >
                                                {expired}
                                            </TableCell>

                                            {/* Pending */}
                                            <TableCell
                                                className="text-center"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Pending'); }}
                                            >
                                                <Badge variant="warning" className="w-10 justify-center rounded font-bold text-xs cursor-pointer">
                                                    {pending}
                                                </Badge>
                                            </TableCell>

                                            {/* Closed */}
                                            <TableCell
                                                className="text-center"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Closed'); }}
                                            >
                                                <Badge variant="success" className="w-10 justify-center rounded font-bold text-xs cursor-pointer">
                                                    {closed}
                                                </Badge>
                                            </TableCell>

                                            {/* Archived */}
                                            <TableCell
                                                className="text-center font-semibold text-slate-600 text-xs cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Archived'); }}
                                            >
                                                {archived}
                                            </TableCell>

                                            {/* Canceled */}
                                            <TableCell
                                                className="text-center font-semibold text-slate-600 text-xs cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Cancelled'); }}
                                            >
                                                {canceled}
                                            </TableCell>

                                            {/* Incomplete */}
                                            <TableCell
                                                className="text-center font-medium text-slate-500 text-xs cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Incomplete'); }}
                                            >
                                                {incomplete}
                                            </TableCell>

                                            {/* Pre-Contract */}
                                            <TableCell
                                                className="text-center font-medium text-slate-500 text-xs cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'Pre-Contract'); }}
                                            >
                                                {preContract}
                                            </TableCell>

                                            {/* Total */}
                                            <TableCell
                                                className="text-center font-bold text-slate-900 text-xs cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); handleRowClick(row.reviewer_full_name, 'clear'); }}
                                            >
                                                {total}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center text-slate-400 py-10 font-medium">
                                            No data available
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-6 gap-y-2 p-4 px-6 border-t border-slate-100 bg-slate-50/20 text-xs font-bold text-slate-400 select-none">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-amber-500 block shrink-0" />
                                Outstanding (Pending)
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-emerald-500 block shrink-0" />
                                Closed
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-slate-400 block shrink-0" />
                                Cancelled
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-slate-600 block shrink-0" />
                                Archived
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-amber-600/70 block shrink-0" />
                                Expired
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-orange-500 block shrink-0" />
                                Incomplete
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-teal-500 block shrink-0" />
                                Pre-Contract
                            </span>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}

export default ReviewerDashboardView;
