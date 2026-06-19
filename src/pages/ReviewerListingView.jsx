import React, { useState, useEffect, useMemo } from 'react';

import { REVIEWER_API, ROWS_PER_PAGE } from '../constants';

import { extractState, formatDateUS } from '../utils/helpers';
import DateFilterInput from '../components/shared/DateFilterInput';
import MultiSelect from '../components/shared/MultiSelect';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

function ReviewerListingView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [downloading, setDownloading] = useState(false);

    // Search query states: searchInput is immediate, searchQuery is debounced
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filters — all multi-select (arrays), except date range
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState([]);
    const [ssStatusFilter, setSsStatusFilter] = useState([]);
    const [reviewerFilter, setReviewerFilter] = useState([]);
    const [stageFilter, setStageFilter] = useState([]);
    const [typeOfSaleFilter, setTypeOfSaleFilter] = useState([]);

    // Stored filter dropdown options loaded from API
    const [availableFilters, setAvailableFilters] = useState(null);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch paginated & filtered data from API
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', ROWS_PER_PAGE);
        if (dateFrom) params.append('from_close_date', dateFrom);
        if (dateTo) params.append('to_close_date', dateTo);
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        stateFilter.forEach(s => params.append('state', s));
        ssStatusFilter.forEach(s => params.append('status', s));
        reviewerFilter.forEach(r => params.append('reviewer', r));
        stageFilter.forEach(st => params.append('stage_name', st));
        typeOfSaleFilter.forEach(t => params.append('type_of_sale', t));

        const url = `${REVIEWER_API}?${params.toString()}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;

                const rows = json && Array.isArray(json.data) ? json.data : [];
                setData(rows);

                const total = json.total_count != null ? json.total_count : 0;
                setTotalCount(total);

                if (json.filters) {
                    setAvailableFilters(prev => {
                        // Only save the filters on first fetch so they persist in component state
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
                }
                setLoading(false);
            })
            .catch(err => {
                if (!active) return;
                console.error(err);
                setError(err.message);
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [page, dateFrom, dateTo, stateFilter, ssStatusFilter, reviewerFilter, stageFilter, typeOfSaleFilter, searchQuery]);

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

    const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('from_close_date', dateFrom);
            if (dateTo) params.append('to_close_date', dateTo);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());
            stateFilter.forEach(s => params.append('state', s));
            ssStatusFilter.forEach(s => params.append('status', s));
            reviewerFilter.forEach(r => params.append('reviewer', r));
            stageFilter.forEach(st => params.append('stage_name', st));
            typeOfSaleFilter.forEach(t => params.append('type_of_sale', t));

            const query = params.toString();
            const url = `https://roa-data-backend.vercel.app/reviewer_listing/download${query ? `?${query}` : ''}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Server returned ${response.status}`);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;

            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'Reviewer_Listing_Report.xlsx';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
                if (match && match[1]) filename = decodeURIComponent(match[1].trim());
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
            }, 200);
        } catch (err) {
            console.error('Reviewer Listing download failed:', err);
            alert(`Download failed: ${err.message}. Please try again.`);
        } finally {
            setDownloading(false);
        }
    };

    const hasActiveFilters = searchInput || searchQuery || dateFrom || dateTo ||
        stateFilter.length > 0 || ssStatusFilter.length > 0 ||
        reviewerFilter.length > 0 || stageFilter.length > 0 ||
        typeOfSaleFilter.length > 0;

    const clearAllFilters = () => {
        setSearchInput('');
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setStateFilter([]);
        setSsStatusFilter([]);
        setReviewerFilter([]);
        setStageFilter([]);
        setTypeOfSaleFilter([]);
        setPage(1);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reviewer Listing</h1>
                    <p className="text-sm text-slate-500 mt-1">View and filter reviewer assignments and transaction statuses.</p>
                </div>
                <Button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="font-semibold text-xs gap-2 h-9 shadow-md shadow-blue-600/10"
                >
                    <svg className={`h-4 w-4 ${downloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {downloading ? 'Generating Report…' : 'Download Report'}
                </Button>
            </div>

            {/* Table Card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-md font-bold text-slate-800">Transactions</h2>
                        {totalCount > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 font-bold text-[10px] rounded">
                                {totalCount.toLocaleString()} records
                            </Badge>
                        )}
                    </div>
                    {totalPages > 0 && (
                        <span className="text-xs font-semibold text-slate-500">
                            Showing page {page} of {totalPages}
                        </span>
                    )}
                </div>

                {/* Search and Filters grid */}
                <div className="p-5 border-b border-slate-100 bg-white space-y-4">
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="rev-search"
                            type="text"
                            placeholder="Search by Sale GUID or Property Address…"
                            value={searchInput}
                            onChange={e => { setSearchInput(e.target.value); }}
                            className="pl-9 pr-8 w-full"
                        />
                        {searchInput && (
                            <button
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
                        <div className="space-y-1">
                            <label htmlFor="rev-date-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close From</label>
                            <DateFilterInput
                                id="rev-date-from"
                                value={dateFrom}
                                onChange={val => { setDateFrom(val); setPage(1); }}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="rev-date-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close To</label>
                            <DateFilterInput
                                id="rev-date-to"
                                value={dateTo}
                                onChange={val => { setDateTo(val); setPage(1); }}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">State</label>
                            <MultiSelect
                                id="rev-state-filter"
                                options={filterOptions.state_list}
                                selected={stateFilter}
                                onChange={v => { setStateFilter(v); setPage(1); }}
                                placeholder="All States"
                                allLabel="All States"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">SS Status</label>
                            <MultiSelect
                                id="rev-ss-status-filter"
                                options={filterOptions.status_list}
                                selected={ssStatusFilter}
                                onChange={v => { setSsStatusFilter(v); setPage(1); }}
                                placeholder="All Statuses"
                                allLabel="All Statuses"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Reviewer</label>
                            <MultiSelect
                                id="rev-reviewer-filter"
                                options={filterOptions.reviewer_list}
                                selected={reviewerFilter}
                                onChange={v => { setReviewerFilter(v); setPage(1); }}
                                placeholder="All Reviewers"
                                allLabel="All Reviewers"
                                align="right"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Stage</label>
                            <MultiSelect
                                id="rev-stage-filter"
                                options={filterOptions.stage_list}
                                selected={stageFilter}
                                onChange={v => { setStageFilter(v); setPage(1); }}
                                placeholder="All Stages"
                                allLabel="All Stages"
                                align="right"
                            />
                        </div>
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Type of Sale</label>
                            <MultiSelect
                                id="rev-type-of-sale-filter"
                                options={filterOptions.type_of_sale_list}
                                selected={typeOfSaleFilter}
                                onChange={v => { setTypeOfSaleFilter(v); setPage(1); }}
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
                        <p className="text-sm font-semibold text-slate-500">Loading Reviewer data…</p>
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
                                    <TableHead className="min-w-[200px]">Property Address</TableHead>
                                    <TableHead>Reviewer</TableHead>
                                    <TableHead>Stage</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead>Type of Sale</TableHead>
                                    <TableHead>Sale Price</TableHead>
                                    <TableHead>Listing Price</TableHead>
                                    <TableHead>Escrow Close Date</TableHead>
                                    <TableHead className="text-right pr-6">SS Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, i) => (
                                    <TableRow key={i} className="hover:bg-slate-50/55 transition-colors">
                                        <TableCell className="font-semibold text-slate-800 text-xs py-2.5">{row.propertyaddress || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-600 font-medium">{row.reviewer_name || '-'}</TableCell>
                                        <TableCell>
                                            {row.stage_name ? (
                                                <Badge variant="secondary" className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/30">
                                                    {row.stage_name}
                                                </Badge>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium font-mono uppercase">{row.state || extractState(row.propertyaddress) || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-600 font-medium">{row.type_of_sale || '-'}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-700">{row.sale_price != null ? `$${Number(row.sale_price).toLocaleString()}` : '-'}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-700">{row.listing_price != null ? `$${Number(row.listing_price).toLocaleString()}` : '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium">{formatDateUS(row.escrow_close_date)}</TableCell>
                                        <TableCell className="text-right pr-6 shrink-0 select-none">
                                            {row.ss_status ? (
                                                <Badge variant="secondary" className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold">
                                                    {row.ss_status}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-slate-400 py-10 font-medium">
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

export default ReviewerListingView;
