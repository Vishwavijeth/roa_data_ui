import React, { useState, useEffect, useMemo } from 'react';
import { CHECKLIST_TYPE_MAPPING_API, ROWS_PER_PAGE } from '../constants';
import MultiSelect from '../components/shared/MultiSelect';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

function ChecklistTypeMappingView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Search
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [typeOfSaleFilter, setTypeOfSaleFilter] = useState([]);
    const [typeOfSaleOptions, setTypeOfSaleOptions] = useState([]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch data
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', ROWS_PER_PAGE);
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        typeOfSaleFilter.forEach(t => params.append('type_of_sale', t));

        fetch(`${CHECKLIST_TYPE_MAPPING_API}?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                setData(Array.isArray(json.data) ? json.data : []);
                setTotalCount(json.total_count ?? 0);

                if (json.filters?.type_of_sale) {
                    setTypeOfSaleOptions(prev =>
                        prev.length > 0 ? prev : [...json.filters.type_of_sale].sort()
                    );
                }
                setLoading(false);
            })
            .catch(err => {
                if (!active) return;
                console.error(err);
                setError(err.message);
                setLoading(false);
            });

        return () => { active = false; };
    }, [page, searchQuery, typeOfSaleFilter]);

    const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);

    const hasActiveFilters = searchInput || typeOfSaleFilter.length > 0;
    const clearAllFilters = () => {
        setSearchInput('');
        setSearchQuery('');
        setTypeOfSaleFilter([]);
        setPage(1);
    };

    const matchBadge = (result) => {
        const v = (result || '').toLowerCase();
        if (v === 'match') {
            return (
                <Badge variant="success" className="rounded font-bold text-xs">
                    Match
                </Badge>
            );
        }
        if (v === 'mismatch') {
            return (
                <Badge variant="destructive" className="rounded font-bold text-xs">
                    Mismatch
                </Badge>
            );
        }
        return <span className="text-xs text-slate-400">—</span>;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Checklist Type Mapping</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Validate checklist types against transaction type of sale.
                    </p>
                </div>
            </div>

            {/* Table Card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                {/* Table header / count */}
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
                            Page {page} of {totalPages}
                        </span>
                    )}
                </div>

                {/* Search + Filters */}
                <div className="p-5 border-b border-slate-100 bg-white space-y-4">
                    {/* Search bar */}
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="checklist-search"
                            type="text"
                            placeholder="Search by property address…"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
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

                    {/* Filter row */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1 z-30">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Type of Sale</label>
                            <MultiSelect
                                id="checklist-type-of-sale-filter"
                                options={typeOfSaleOptions}
                                selected={typeOfSaleFilter}
                                onChange={v => { setTypeOfSaleFilter(v); setPage(1); }}
                                placeholder="All Types"
                                allLabel="All Types"
                            />
                        </div>

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                onClick={clearAllFilters}
                                className="h-8.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold self-end"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table content */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading checklist data…</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center max-w-sm mx-auto space-y-2">
                        <div className="text-3xl">⚠️</div>
                        <h3 className="text-sm font-bold text-red-600">Failed to load data</h3>
                        <p className="text-xs text-slate-500">{error}</p>
                    </div>
                ) : (
                    <>
                        <Table className="table-fixed w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead className="text-left w-1/3 min-w-[200px]">Property Address</TableHead>
                                    <TableHead className="text-center w-1/4 min-w-[150px]">Type of Sale</TableHead>
                                    <TableHead className="text-center w-1/4 min-w-[150px]">Checklist Type</TableHead>
                                    <TableHead className="text-center w-28">Match Result</TableHead>
                                    <TableHead className="text-center w-28">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, i) => (
                                    <TableRow key={row.saleguid ?? i} className="hover:bg-slate-50/55 transition-colors">
                                        <TableCell className="text-center font-mono text-xs text-slate-400 py-3">
                                            {(page - 1) * ROWS_PER_PAGE + i + 1}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-700 font-medium py-3 truncate" title={row.propertyaddress}>
                                            {row.propertyaddress || '—'}
                                        </TableCell>
                                        <TableCell className="text-center py-3 truncate" title={row.type_of_sale}>
                                            <span className="text-xs font-semibold text-slate-600">
                                                {row.type_of_sale || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center py-3 truncate" title={row.checklist_type_name}>
                                            <span className="text-xs font-semibold text-slate-600">
                                                {row.checklist_type_name || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center py-3">
                                            {matchBadge(row.match_result)}
                                        </TableCell>
                                        <TableCell className="text-center py-3">
                                            {row.url ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50 font-bold transition-all px-2.5"
                                                    onClick={() => window.open(row.url, '_blank')}
                                                >
                                                    SkySlope
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-slate-400 py-10 font-medium">
                                            No data available
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/20">
                                <Button
                                    variant="outline"
                                    className="h-8 text-xs font-semibold"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                >
                                    ← Previous
                                </Button>
                                <span className="text-xs text-slate-500 font-semibold">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    className="h-8 text-xs font-semibold"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                >
                                    Next →
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}

export default ChecklistTypeMappingView;
