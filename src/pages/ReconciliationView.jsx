import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { PARAMETERS, API_BASE, ROWS_PER_PAGE, getResult } from '../constants';
import { formatDateUS } from '../utils/helpers';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '../components/ui/Table';

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
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

        if (isServerSideParam(activeParam.id) && debouncedSearchQuery.trim()) {
            url += `&search=${encodeURIComponent(debouncedSearchQuery.trim())}`;
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
    }, [activeParam, page, showOnlyMismatches, showNoSkyslope, debouncedSearchQuery]);

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
        if (searchQuery.trim() && !isServerSideParam(activeParam.id)) {
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
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction Reconciliation</h1>
                    <p className="text-sm text-slate-500 mt-1">Compare transaction data across Brokerage Engine and SkySlope.</p>
                </div>
                <Button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="shadow-lg shadow-blue-600/10 font-semibold gap-2 select-none"
                >
                    <svg className={`h-4 w-4 ${downloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {downloading ? 'Generating Report…' : 'Download Report'}
                </Button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:border-slate-300 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Records</span>
                        <div className="text-2xl font-bold text-slate-800 mt-2">
                            {statsLoading ? (
                                <Skeleton className="h-8 w-24 mt-1" />
                            ) : (
                                stats.total.toLocaleString()
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-emerald-200 hover:bg-emerald-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Match Percentage</span>
                        <div className="text-2xl font-bold text-emerald-600 mt-2">
                            {statsLoading ? (
                                <Skeleton className="h-8 w-20 mt-1" />
                            ) : (
                                `${stats.matchPct}%`
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-red-200 hover:bg-red-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mismatch Percentage</span>
                        <div className="text-2xl font-bold text-red-600 mt-2">
                            {statsLoading ? (
                                <Skeleton className="h-8 w-20 mt-1" />
                            ) : (
                                `${stats.mismatchPct}%`
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-amber-200 hover:bg-amber-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">No SkySlope File ID</span>
                        <div className="text-2xl font-bold text-amber-600 mt-2">
                            {statsLoading ? (
                                <Skeleton className="h-8 w-16 mt-1" />
                            ) : (
                                stats.noSkyslopeCount.toLocaleString()
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Comparison Parameters Chips */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comparison Parameters</h2>
                <div className="flex flex-wrap gap-2">
                    {(() => {
                        const orderedIds = ['gross_commission', 'close_date', 'status', 'saleprice'];
                        const orderedParams = [
                            ...orderedIds.map(id => PARAMETERS.find(p => p.id === id)).filter(Boolean),
                            ...PARAMETERS.filter(p => !orderedIds.includes(p.id))
                        ];
                        return orderedParams.map(param => {
                            const isSelected = activeParam.id === param.id;
                            return (
                                <Button
                                    key={param.id}
                                    variant={isSelected ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setActiveParam(param);
                                        setShowOnlyMismatches(false);
                                        setShowNoSkyslope(false);
                                        setSearchQuery('');
                                        setPage(1);
                                    }}
                                    className={`rounded-full px-4 h-8 text-xs font-semibold ${isSelected
                                            ? 'shadow-sm'
                                            : 'hover:bg-slate-50'
                                        }`}
                                >
                                    {param.label}
                                </Button>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* Table Container Card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                {/* Table top filtering bar */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-md font-bold text-slate-800">{activeParam.label}</h2>

                        {/* Mismatches filter toggle */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                            <button
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${showOnlyMismatches
                                        ? 'bg-red-50 text-red-700'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                onClick={() => {
                                    setShowOnlyMismatches(!showOnlyMismatches);
                                    if (!showOnlyMismatches) setShowNoSkyslope(false);
                                    setPage(1);
                                }}
                            >
                                Mismatches
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-500 border-l border-slate-200">
                                {statsLoading ? (
                                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" /></span>
                                ) : (
                                    stats.mismatchCount
                                )}
                            </span>
                        </div>

                        {/* No SkySlope toggle */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                            <button
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${showNoSkyslope
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                onClick={() => {
                                    setShowNoSkyslope(!showNoSkyslope);
                                    if (!showNoSkyslope) setShowOnlyMismatches(false);
                                    setPage(1);
                                }}
                            >
                                No SkySlope File ID
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-500 border-l border-slate-200">
                                {statsLoading ? (
                                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" /></span>
                                ) : (
                                    stats.noSkyslopeCount
                                )}
                            </span>
                        </div>

                        {(showOnlyMismatches || showNoSkyslope || searchQuery) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowOnlyMismatches(false);
                                    setShowNoSkyslope(false);
                                    setSearchQuery('');
                                    setPage(1);
                                }}
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                ✕ Clear Filters
                            </Button>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search Bar */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center">
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="table-search"
                            type="text"
                            placeholder="Search by Transaction ID, Sale Guid, or Property Address…"
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
                </div>

                {/* Main Table */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading {activeParam.label} data…</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center max-w-md mx-auto space-y-2">
                        <div className="text-3xl">⚠️</div>
                        <h3 className="text-sm font-bold text-red-600">Failed to load data</h3>
                        <p className="text-xs text-slate-500">{error}</p>
                        <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 mt-2">
                            Verify the backend service is running at <code>{API_BASE}</code>
                        </p>
                    </div>
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/6">Sale Guid</TableHead>
                                    <TableHead className="w-1/6">Transaction ID</TableHead>
                                    <TableHead className="w-1/3">Property Address</TableHead>
                                    <TableHead className="w-1/8">SkySlope {activeParam.label}</TableHead>
                                    <TableHead className="w-1/8">BE {activeParam.label}</TableHead>
                                    <TableHead className="w-1/8 text-right pr-6">Result</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((row, i) => {
                                    const resultVal = getResult(row);
                                    const isMismatch = resultVal === 'mismatch';
                                    const isNoSkyslope = resultVal === 'no_skyslope_record';
                                    const skVal = row[activeParam.skyslopeKey];
                                    const beVal = row[activeParam.beKey];
                                    return (
                                        <TableRow
                                            key={i}
                                            className={
                                                isMismatch
                                                    ? 'bg-red-50/40 hover:bg-red-50/60 transition-colors'
                                                    : isNoSkyslope
                                                        ? 'bg-amber-50/20 hover:bg-amber-50/40 transition-colors'
                                                        : 'hover:bg-slate-50/40'
                                            }
                                        >
                                            <TableCell className="font-mono text-xs text-slate-500 shrink-0">{row.saleguid || '-'}</TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 shrink-0">{row.transactionId || row.transactionid || '-'}</TableCell>
                                            <TableCell className="font-medium text-slate-800 text-xs max-w-xs truncate">{row.propertyaddress || '-'}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{activeParam.id.includes('date') && skVal != null && skVal !== 'null' ? formatDateUS(skVal) : (skVal != null ? String(skVal) : 'null')}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{activeParam.id.includes('date') && beVal != null && beVal !== 'null' ? formatDateUS(beVal) : (beVal != null ? String(beVal) : 'null')}</TableCell>
                                            <TableCell className="text-right pr-6 shrink-0 select-none">
                                                {resultVal ? (
                                                    <Badge
                                                        variant={
                                                            resultVal === 'match'
                                                                ? 'success'
                                                                : resultVal === 'mismatch'
                                                                    ? 'destructive'
                                                                    : 'warning'
                                                        }
                                                        className="capitalize px-2 py-0.5 rounded text-[10px]"
                                                    >
                                                        {resultVal.replace(/_/g, ' ')}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {paginatedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-slate-400 py-10 font-medium">
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
                                    className="h-8 select-none font-semibold text-xs text-slate-600"
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
                                    className="h-8 select-none font-semibold text-xs text-slate-600"
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

export default ReconciliationView;
