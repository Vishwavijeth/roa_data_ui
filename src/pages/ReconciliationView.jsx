import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    const [trackStatusFilter, setTrackStatusFilter] = useState(null); // 'in_review' | 'review_done' | 'not_a_mismatch' | null
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    // ── Review modal state ─────────────────────────────────────────────────────
    const [reviewModal, setReviewModal] = useState({ open: false, row: null, submitting: false, error: null, success: false });
    const [reviewForm, setReviewForm] = useState({ track_status: 'in_review', assigned_to: '', notes: '', updated_by: '' });

    const openReviewModal = (row) => {
        setReviewForm({
            track_status: row.status || 'in_review',
            notes: row.notes || '',
            updated_by: row.updated_by || '',
        });
        setReviewModal({ open: true, row, submitting: false, error: null, success: false });
    };

    const closeReviewModal = () => {
        setReviewModal({ open: false, row: null, submitting: false, error: null, success: false });
    };

    const handleReviewSubmit = async () => {
        const { row } = reviewModal;
        const txnId = row.transactionId || row.transactionid;
        if (!txnId) {
            setReviewModal(m => ({ ...m, error: 'Transaction ID not found for this record.' }));
            return;
        }
        setReviewModal(m => ({ ...m, submitting: true, error: null }));
        try {
            const res = await fetch(
                `https://roa-data-backend.vercel.app/reconciliation/track?transaction_id=${encodeURIComponent(txnId)}&parameter=${activeParam.id}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        track_status: reviewForm.track_status,
                        assigned_to: reviewForm.assigned_to || null,
                        notes: reviewForm.notes || null,
                        updated_by: reviewForm.updated_by || null,
                    }),
                }
            );
            const json = await res.json();
            if (!res.ok || json.status === 'error') {
                throw new Error(json.message || `HTTP ${res.status}`);
            }
            // Optimistically update so badge reflects change immediately
            setData(prev => prev.map(r => {
                const id = r.transactionId || r.transactionid;
                if (id === txnId) {
                    return { ...r, status: reviewForm.track_status, notes: reviewForm.notes };
                }
                return r;
            }));
            setReviewModal(m => ({ ...m, submitting: false, success: true }));
            setTimeout(() => closeReviewModal(), 1400);
        } catch (err) {
            setReviewModal(m => ({ ...m, submitting: false, error: err.message }));
        }
    };

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
    // Tracks whether a unified-API param summary has been loaded for the current selection.
    // All server-side params now use the unified API (summary + data in one call).
    const unifiedSummaryLoaded = useRef(false);

    // All server-side params use the unified API: single call returns summary + paginated data.
    const UNIFIED_PARAMS = ['gross_commission', 'close_date', 'status', 'saleprice'];

    // On param switch: reset ref + clear stats so the first data fetch populates them fresh.
    useEffect(() => {
        if (!isServerSideParam(activeParam.id)) {
            setSummaryStats(null);
            return;
        }
        unifiedSummaryLoaded.current = false;
        setSummaryStats(null);
        setStatsLoading(true);
    }, [activeParam]);

    // Fetch data for server-side endpoints (paginated and server-filtered)
    // gross_commission uses a single unified API that returns both summary and data
    useEffect(() => {
        if (!isServerSideParam(activeParam.id)) return;

        setLoading(true);
        setError(null);

        const paramName = activeParam.endpoint;
        const isUnifiedParam = ['gross_commission', 'close_date', 'status', 'saleprice'].includes(activeParam.id);

        let url = `https://roa-data-backend.vercel.app/compare/${paramName}?page=${page}`;
        if (showOnlyMismatches) {
            url += '&mismatch=true';
        } else if (showNoSkyslope) {
            url += ['gross_commission', 'close_date'].includes(activeParam.id) ? '&no_skyslope_file=true' : '&no_skyslope=true';
        }

        if (['close_date', 'gross_commission'].includes(activeParam.id) && trackStatusFilter) {
            url += `&track_status=${encodeURIComponent(trackStatusFilter)}`;
        }

        if (debouncedSearchQuery.trim()) {
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

                // All unified params: extract summary ONLY on first load for this param.
                // Subsequent filter/page changes skip this so metrics cards stay static.
                if (isUnifiedParam && !unifiedSummaryLoaded.current && json && json.summary) {
                    const s = json.summary;
                    setSummaryStats({
                        total_count: s.count,
                        match_percentage: s.match_percentage,
                        mismatch_percentage: s.mismatch_percentage,
                        no_skyslope_record_count: s.no_skyslope_record_count,
                        mismatch_count: Math.round((s.mismatch_percentage / 100) * s.count),
                    });
                    setStatsLoading(false);
                    unifiedSummaryLoaded.current = true;
                }

                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setLoading(false);
                if (isUnifiedParam && !unifiedSummaryLoaded.current) setStatsLoading(false);
            });
    }, [activeParam, page, showOnlyMismatches, showNoSkyslope, trackStatusFilter, debouncedSearchQuery]);

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
                        // Always paginate — fetch page 1 first to discover total_pages,
                        // then pull all remaining pages in parallel for both server-side
                        // and client-side parameters so no records are missed.
                        const res1 = await fetch(`${param.apiBase || API_BASE}/${param.endpoint}?page=1`);
                        if (!res1.ok) return { param, data: [] };
                        const json1 = await res1.json();
                        let rows = (json1 && Array.isArray(json1.data))
                            ? json1.data
                            : (Array.isArray(json1) ? json1 : []);
                        const tPages = (json1 && json1.total_pages) ? json1.total_pages : 1;
                        if (tPages > 1) {
                            const fetchPromises = [];
                            for (let p = 2; p <= tPages; p++) {
                                fetchPromises.push(
                                    fetch(`${param.apiBase || API_BASE}/${param.endpoint}?page=${p}`)
                                        .then(r => r.ok ? r.json() : { data: [] })
                                        .then(j => (j && Array.isArray(j.data))
                                            ? j.data
                                            : (Array.isArray(j) ? j : []))
                                        .catch(() => [])
                                );
                            }
                            const remainingPages = await Promise.all(fetchPromises);
                            remainingPages.forEach(pageData => {
                                rows = rows.concat(pageData);
                            });
                        }
                        return { param, data: rows };
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
        <>
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
                                            setTrackStatusFilter(null);
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

                            {/* Mismatches filter toggle */}
                            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                                <button
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${showOnlyMismatches
                                        ? 'bg-red-50 text-red-700'
                                        : 'hover:bg-slate-50 text-slate-600'
                                        }`}
                                    onClick={() => {
                                        const next = !showOnlyMismatches;
                                        setShowOnlyMismatches(next);
                                        if (next) {
                                            setShowNoSkyslope(false);
                                            setTrackStatusFilter(null);
                                        }
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
                                        const next = !showNoSkyslope;
                                        setShowNoSkyslope(next);
                                        if (next) {
                                            setShowOnlyMismatches(false);
                                            setTrackStatusFilter(null);
                                        }
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

                            {/* Track Status filters — Close Date and Gross Commission */}
                            {['close_date', 'gross_commission'].includes(activeParam.id) && (
                                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                                    {[
                                        { value: 'in_review', label: 'In Review', active: 'bg-blue-50 text-blue-700 border-blue-300', inactive: 'text-slate-600 border-slate-200 hover:bg-slate-50' },
                                        { value: 'review_done', label: 'Review Done', active: 'bg-emerald-50 text-emerald-700 border-emerald-300', inactive: 'text-slate-600 border-slate-200 hover:bg-slate-50' },
                                        { value: 'not_a_mismatch', label: 'Not a Mismatch', active: 'bg-slate-100 text-slate-700 border-slate-400', inactive: 'text-slate-600 border-slate-200 hover:bg-slate-50' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setTrackStatusFilter(prev => prev === opt.value ? null : opt.value);
                                                setShowOnlyMismatches(false);
                                                setShowNoSkyslope(false);
                                                setPage(1);
                                            }}
                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all ${trackStatusFilter === opt.value ? opt.active : opt.inactive
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {(showOnlyMismatches || showNoSkyslope || searchQuery || trackStatusFilter) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowOnlyMismatches(false);
                                        setShowNoSkyslope(false);
                                        setTrackStatusFilter(null);
                                        setSearchQuery('');
                                        setPage(1);
                                    }}
                                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    ✕ Clear Filters
                                </Button>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
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
                                        {['close_date', 'gross_commission'].includes(activeParam.id) && (
                                            <TableHead className="w-1/8 text-center">Actions</TableHead>
                                        )}
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
                                                className={[
                                                    'align-middle',
                                                    isMismatch
                                                        ? 'bg-red-50/40 hover:bg-red-50/60 transition-colors'
                                                        : isNoSkyslope
                                                            ? 'bg-amber-50/20 hover:bg-amber-50/40 transition-colors'
                                                            : 'hover:bg-slate-50/40 transition-colors',
                                                    ['close_date', 'gross_commission'].includes(activeParam.id) && row.status
                                                        ? row.status === 'review_done'
                                                            ? 'border-l-4 border-l-emerald-400'
                                                            : row.status === 'not_a_mismatch'
                                                                ? 'border-l-4 border-l-slate-400'
                                                                : 'border-l-4 border-l-blue-400'
                                                        : '',
                                                ].filter(Boolean).join(' ')}
                                            >
                                                {/* Sale Guid */}
                                                <TableCell className="py-4 pr-4">
                                                    <span className="font-mono text-xs text-slate-400 block max-w-[130px] truncate" title={row.saleguid || ''}>
                                                        {row.saleguid || '—'}
                                                    </span>
                                                </TableCell>
 
                                                {/* Transaction ID */}
                                                <TableCell className="py-4 pr-4">
                                                    <span className="font-mono text-xs text-slate-400 block max-w-[130px] truncate" title={row.transactionId || row.transactionid || ''}>
                                                        {row.transactionId || row.transactionid || '—'}
                                                    </span>
                                                </TableCell>
 
                                                {/* Property Address + track status badge inline */}
                                                <TableCell className="py-4 pr-4">
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        {/* Address + status badge on same line */}
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-sm font-medium text-slate-700 truncate flex-1" title={row.propertyaddress || ''}>
                                                                {row.propertyaddress || '—'}
                                                            </span>
                                                            {['close_date', 'gross_commission'].includes(activeParam.id) && row.status && (
                                                                <span className={`inline-flex items-center gap-0.5 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${row.status === 'review_done'
                                                                        ? 'bg-emerald-100 text-emerald-700'
                                                                        : row.status === 'not_a_mismatch'
                                                                            ? 'bg-slate-100 text-slate-500'
                                                                            : 'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'review_done' ? 'bg-emerald-500'
                                                                            : row.status === 'not_a_mismatch' ? 'bg-slate-400'
                                                                                : 'bg-blue-500'
                                                                        }`} />
                                                                    {row.status.replace(/_/g, ' ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Notes + Updated By meta row */}
                                                        {['close_date', 'gross_commission'].includes(activeParam.id) && (row.notes || row.updated_by) && (
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {row.notes && (
                                                                    <span className="text-[11px] italic text-slate-400 truncate max-w-[220px]" title={row.notes}>
                                                                        "{row.notes}"
                                                                    </span>
                                                                )}
                                                                {row.updated_by && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 shrink-0">
                                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                        </svg>
                                                                        {row.updated_by}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
 
                                                {/* SkySlope value */}
                                                <TableCell className="py-4 pr-4">
                                                    <span className="text-sm font-medium text-slate-600">
                                                        {activeParam.id.includes('date') && skVal != null && skVal !== 'null'
                                                            ? formatDateUS(skVal)
                                                            : skVal != null ? String(skVal) : '—'}
                                                    </span>
                                                </TableCell>
 
                                                {/* BE value */}
                                                <TableCell className="py-4 pr-4">
                                                    <span className="text-sm font-medium text-slate-600">
                                                        {activeParam.id.includes('date') && beVal != null && beVal !== 'null'
                                                            ? formatDateUS(beVal)
                                                            : beVal != null ? String(beVal) : '—'}
                                                    </span>
                                                </TableCell>
 
                                                {/* Result badge */}
                                                <TableCell className="py-4 text-right pr-6 shrink-0 select-none">
                                                    {resultVal ? (
                                                        <Badge
                                                            variant={
                                                                resultVal === 'match' ? 'success'
                                                                    : resultVal === 'mismatch' ? 'destructive'
                                                                        : 'warning'
                                                            }
                                                            className="capitalize px-2.5 py-0.5 rounded text-[11px]"
                                                        >
                                                            {resultVal.replace(/_/g, ' ')}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-300 font-bold">—</span>
                                                    )}
                                                </TableCell>
 
                                                {/* Review button */}
                                                {['close_date', 'gross_commission'].includes(activeParam.id) && (
                                                    <TableCell className="py-4 text-center shrink-0">
                                                        <button
                                                            onClick={() => openReviewModal(row)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all select-none"
                                                        >
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                            Review
                                                        </button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                    {paginatedData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={['close_date', 'gross_commission'].includes(activeParam.id) ? 7 : 6} className="text-center text-slate-400 py-10 font-medium">
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

            {/* ── Review Modal ────────────────────────────────────────────────── */}
            {reviewModal.open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeReviewModal(); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Review {activeParam.label} Record</h3>
                                <p className="text-xs text-slate-500 mt-0.5 font-mono truncate max-w-xs">
                                    {reviewModal.row?.propertyaddress || reviewModal.row?.transactionId || reviewModal.row?.transactionid || 'Transaction'}
                                </p>
                            </div>
                            <button
                                onClick={closeReviewModal}
                                className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            {/* Track Status */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 block">Track Status <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'in_review', label: 'In Review', color: 'indigo' },
                                        { value: 'review_done', label: 'Review Done', color: 'emerald' },
                                        { value: 'not_a_mismatch', label: 'Not a Mismatch', color: 'slate' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setReviewForm(f => ({ ...f, track_status: opt.value }))}
                                            className={`px-2 py-2 rounded-lg border text-[11px] font-semibold transition-all ${reviewForm.track_status === opt.value
                                                ? opt.color === 'indigo' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : opt.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                        : 'bg-slate-700 text-white border-slate-700 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 block">Notes</label>
                                <textarea
                                    rows={3}
                                    placeholder="Add any context or notes about this discrepancy…"
                                    value={reviewForm.notes}
                                    onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-300 transition-all resize-none"
                                />
                            </div>

                            {/* Updated By */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 block">Updated By</label>
                                <input
                                    type="text"
                                    placeholder="Your name"
                                    value={reviewForm.updated_by}
                                    onChange={e => setReviewForm(f => ({ ...f, updated_by: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-300 transition-all"
                                />
                            </div>

                            {/* Error */}
                            {reviewModal.error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                                    <svg className="h-3.5 w-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                                    </svg>
                                    {reviewModal.error}
                                </div>
                            )}

                            {/* Success */}
                            {reviewModal.success && (
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2">
                                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Status updated successfully!
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2">
                            <button
                                onClick={closeReviewModal}
                                disabled={reviewModal.submitting}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReviewSubmit}
                                disabled={reviewModal.submitting || reviewModal.success}
                                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-60 flex items-center gap-1.5"
                            >
                                {reviewModal.submitting ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Saving…
                                    </>
                                ) : 'Save Review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ReconciliationView;
