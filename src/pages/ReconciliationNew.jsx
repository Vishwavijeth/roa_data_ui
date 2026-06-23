import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import MultiSelect from '../components/MultiSelect';
import SectionedDetailView from '../components/shared/SectionedDetailView';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '../components/ui/Table';
import { PARAMETERS } from '../constants';

const API_BASE = 'https://roa-data-backend.vercel.app';

function ReconciliationNew() {
    // ── Metrics ──────────────────────────────────────────────────────────────
    const [metrics, setMetrics] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(true);

    // ── Transactions ─────────────────────────────────────────────────────────
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // ── Filter options (populated from API on first fetch) ────────────────────
    const [availableParams, setAvailableParams] = useState([]);
    const [selectedParams, setSelectedParams] = useState([]);

    // ── Search ────────────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // ── Inline row expansion ──────────────────────────────────────────────────
    const [expandedTxnId, setExpandedTxnId] = useState(null);
    const [expandedDetails, setExpandedDetails] = useState({});   // txnId → detail object
    const [expandedLoading, setExpandedLoading] = useState({});   // txnId → boolean

    // ── SkySlope details modal ────────────────────────────────────────────────
    const [drawerRow, setDrawerRow] = useState(null);
    const [drawerDetail, setDrawerDetail] = useState(null);
    const [drawerDetailLoading, setDrawerDetailLoading] = useState(false);
    const [popupSegment, setPopupSegment] = useState('brokerage_engine');

    // ── Review modal state ─────────────────────────────────────────────────────
    const [reviewModal, setReviewModal] = useState({ open: false, row: null, submitting: false, error: null, success: false });
    const [reviewForm, setReviewForm] = useState({ parameter: '', track_status: 'in_review', assigned_to: '', notes: '', updated_by: '' });

    // ─────────────────────────────────────────────────────────────────────────
    // Search debounce
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch metrics summary
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        setMetricsLoading(true);
        fetch(`${API_BASE}/reconciliation/summary`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setMetrics(data); setMetricsLoading(false); })
            .catch(() => setMetricsLoading(false));
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch transactions (page / search / parameter filter)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ page });
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        if (selectedParams.length > 0) {
            // API expects the label values (e.g. "Close Date") mapped to snake_case
            // The API param key is `mismatch_parameter`; values come from filters.parameter list
            selectedParams.forEach(p => params.append('mismatch_parameter', p));
        }

        fetch(`${API_BASE}/reconciliation/transactions?${params}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(json => {
                setTransactions(Array.isArray(json.data) ? json.data : []);
                setTotalPages(json.pagination?.total_pages || 1);
                setTotalCount(json.count || 0);

                // Populate filter options from the first successful response
                if (json.filters?.parameter?.length && availableParams.length === 0) {
                    setAvailableParams(json.filters.parameter);
                }
                setLoading(false);
            })
            .catch(err => { setError(err.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, selectedParams]);

    // ─────────────────────────────────────────────────────────────────────────
    // Inline row expansion – fetch /reconciliation/transaction/:id
    // ─────────────────────────────────────────────────────────────────────────
    const handleRowClick = (row, e) => {
        if (e.target.closest('button')) return; // let buttons handle themselves
        const txnId = row.transactionid;
        if (!txnId) return;

        if (expandedTxnId === txnId) {
            setExpandedTxnId(null);
            return;
        }
        setExpandedTxnId(txnId);

        if (!expandedDetails[txnId]) {
            setExpandedLoading(prev => ({ ...prev, [txnId]: true }));
            fetch(`${API_BASE}/reconciliation/transaction/${txnId}`)
                .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
                .then(data => {
                    setExpandedDetails(prev => ({ ...prev, [txnId]: data }));
                    setExpandedLoading(prev => ({ ...prev, [txnId]: false }));
                })
                .catch(() => setExpandedLoading(prev => ({ ...prev, [txnId]: false })));
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SkySlope / detail modal
    // ─────────────────────────────────────────────────────────────────────────
    const openDrawer = (row) => {
        setDrawerRow(row);
        setDrawerDetail(null);
        setPopupSegment('brokerage_engine');

        const saleguid = row.saleguid;
        const txnId = row.transactionid;
        if (!saleguid && !txnId) return;

        setDrawerDetailLoading(true);
        const url = saleguid
            ? `${API_BASE}/skyslope/detail?saleguid=${encodeURIComponent(saleguid)}`
            : (row.source_table === 'otherincome_transactions'
                ? `${API_BASE}/otherincome_transactions/detail?transactionid=${encodeURIComponent(txnId)}`
                : `${API_BASE}/brokerage_engine/detail?transactionid=${encodeURIComponent(txnId)}`);

        fetch(url)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(json => {
                setDrawerDetail(json);
                setDrawerDetailLoading(false);
                if (json?.brokerage_engine_records?.length) setPopupSegment('brokerage_engine');
                else if (json?.brokerage_engine) setPopupSegment('brokerage_engine');
                else if (json?.otherincome_transactions) setPopupSegment('other_income');
                else if (json?.skyslope) setPopupSegment('skyslope');
            })
            .catch(err => { setDrawerDetail({ _error: err.message }); setDrawerDetailLoading(false); });
    };

    const closeDrawer = () => setDrawerRow(null);

    useEffect(() => {
        if (!drawerRow) return;
        const h = (e) => { if (e.key === 'Escape') closeDrawer(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [drawerRow]);

    // ── Review Action Handlers ──────────────────────────────────────────────────
    const openReviewModal = (row, specificParam = null) => {
        let selectedParam = '';
        if (specificParam) {
            const found = PARAMETERS.find(p => p.id === specificParam || p.endpoint === specificParam || p.id === specificParam.replace(/_/g, ''));
            selectedParam = found ? found.endpoint : specificParam;
        } else if (Array.isArray(row.mismatched_parameters) && row.mismatched_parameters.length > 0) {
            const firstMismatched = row.mismatched_parameters[0];
            const found = PARAMETERS.find(p => p.id === firstMismatched || p.endpoint === firstMismatched || p.id === firstMismatched.replace(/_/g, ''));
            selectedParam = found ? found.endpoint : firstMismatched;
        } else if (PARAMETERS.length > 0) {
            selectedParam = PARAMETERS[0].endpoint;
        }

        setReviewForm({
            parameter: selectedParam,
            track_status: row.review?.review_status || row.status || 'in_review',
            notes: row.review?.notes || row.notes || '',
            updated_by: row.review?.updated_by || row.updated_by || '',
        });
        setReviewModal({ open: true, row, submitting: false, error: null, success: false });
    };

    const closeReviewModal = () => {
        setReviewModal({ open: false, row: null, submitting: false, error: null, success: false });
    };

    const handleReviewSubmit = async () => {
        const { row } = reviewModal;
        const txnId = row.transactionid || row.transactionId;
        if (!txnId) {
            setReviewModal(m => ({ ...m, error: 'Transaction ID not found for this record.' }));
            return;
        }
        if (!reviewForm.parameter) {
            setReviewModal(m => ({ ...m, error: 'Please select a parameter to review.' }));
            return;
        }
        setReviewModal(m => ({ ...m, submitting: true, error: null }));
        try {
            // Call both APIs in parallel
            const [resTrack, resReview] = await Promise.all([
                fetch(
                    `${API_BASE}/reconciliation/track?transaction_id=${encodeURIComponent(txnId)}&parameter=${encodeURIComponent(reviewForm.parameter)}`,
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
                ),
                fetch(
                    `https://roa-data-backend.vercel.app/reconciliation/review/${encodeURIComponent(txnId)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            review_status: reviewForm.track_status,
                            notes: reviewForm.notes || null,
                            updated_by: reviewForm.updated_by || null,
                        }),
                    }
                )
            ]);

            const jsonTrack = await resTrack.json();
            const jsonReview = await resReview.json();

            if (!resTrack.ok || jsonTrack.status === 'error') {
                throw new Error(jsonTrack.message || `Track API error: HTTP ${resTrack.status}`);
            }
            if (!resReview.ok || jsonReview.status === 'error') {
                throw new Error(jsonReview.message || `Review API error: HTTP ${resReview.status}`);
            }

            // Update transactions locally to reflect the review state change
            setTransactions(prev => prev.map(r => {
                const id = r.transactionid || r.transactionId;
                if (id === txnId) {
                    return {
                        ...r,
                        status: reviewForm.track_status,
                        notes: reviewForm.notes,
                        review: {
                            review_status: reviewForm.track_status,
                            notes: reviewForm.notes || null,
                            updated_by: reviewForm.updated_by || null
                        }
                    };
                }
                return r;
            }));

            setReviewModal(m => ({ ...m, submitting: false, success: true }));
            setTimeout(() => closeReviewModal(), 1400);
        } catch (err) {
            setReviewModal(m => ({ ...m, submitting: false, error: err.message }));
        }
    };

    const hasActiveFilters = selectedParams.length > 0 || searchQuery;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="p-8 max-w-7xl mx-auto w-full space-y-8">

                {/* ── Page Header ─────────────────────────────────────────── */}
                <div className="border-b border-slate-200 pb-5">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Reconciliation Transactions
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        All transactions with Brokerage Engine and SkySlope parameter comparison.
                        Click any row to see the full parameter breakdown.
                    </p>
                </div>

                {/* ── Metrics Cards ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <Card className="hover:border-slate-300 transition-all select-none">
                        <CardContent className="pt-6">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Records</span>
                            <div className="text-2xl font-bold text-slate-800 mt-2">
                                {metricsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (metrics?.total_record_count?.toLocaleString() ?? '—')}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:border-amber-200 hover:bg-amber-50/5 transition-all select-none">
                        <CardContent className="pt-6">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Sale Income – No SkySlope ID</span>
                            <div className="text-2xl font-bold text-amber-600 mt-2">
                                {metricsLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (metrics?.saleincome_no_skyslopefileid?.toLocaleString() ?? '—')}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:border-amber-200 hover:bg-amber-50/5 transition-all select-none">
                        <CardContent className="pt-6">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Other Income – No SkySlope ID</span>
                            <div className="text-2xl font-bold text-amber-600 mt-2">
                                {metricsLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (metrics?.otherincome_no_skyslopefileid?.toLocaleString() ?? '—')}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Search + Filter Bar ──────────────────────────────────── */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-0 max-w-lg">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <Input
                                id="txn-search"
                                type="text"
                                placeholder="Search by ID, GUID or property address…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8 w-full"
                            />
                            {searchQuery && (
                                <button
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    onClick={() => setSearchQuery('')}
                                >✕</button>
                            )}
                        </div>

                        {/* Parameters MultiSelect */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Parameters:</span>
                            <MultiSelect
                                id="param-filter"
                                options={availableParams}
                                selected={selectedParams}
                                onChange={vals => { setSelectedParams(vals); setPage(1); setExpandedTxnId(null); }}
                                placeholder="All parameters"
                                allLabel="All parameters"
                            />
                        </div>

                        {/* Clear all filters */}
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 whitespace-nowrap"
                                onClick={() => { setSearchQuery(''); setSelectedParams([]); setPage(1); }}
                            >
                                ✕ Clear Filters
                            </Button>
                        )}
                    </div>

                    {/* Active filter chips */}
                    {selectedParams.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {selectedParams.map(p => (
                                <span key={p} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {p}
                                    <button
                                        className="hover:text-red-500 ml-0.5"
                                        onClick={() => setSelectedParams(prev => prev.filter(v => v !== p))}
                                    >✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Transactions Table ───────────────────────────────────── */}
                <Card className="shadow-sm border-slate-100 overflow-hidden bg-white">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-800">
                                Transactions
                            </h2>
                            {!loading && (
                                <Badge variant="secondary" className="px-2 py-0.5 font-bold text-[10px] rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    {totalCount.toLocaleString()} records
                                </Badge>
                            )}
                        </div>
                        {!loading && (
                            <span className="text-xs font-semibold text-slate-500">
                                Showing page {page} of {totalPages || 1}
                            </span>
                        )}
                    </div>
                    {loading ? (
                        <div className="p-12 flex flex-col items-center justify-center gap-4">
                            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <p className="text-sm font-semibold text-slate-500">Loading transactions…</p>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center space-y-2">
                            <div className="text-3xl">⚠️</div>
                            <p className="text-sm font-bold text-red-600">Failed to load data</p>
                            <p className="text-xs text-slate-500">{error}</p>
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-200/60">
                                        <TableHead className="w-[35%] font-bold text-[10px] uppercase tracking-wider text-slate-400">Property Details</TableHead>
                                        <TableHead className="w-[25%] font-bold text-[10px] uppercase tracking-wider text-slate-400">Mismatched Parameters</TableHead>
                                        <TableHead className="w-[22%] font-bold text-[10px] uppercase tracking-wider text-slate-400">Review Status</TableHead>
                                        <TableHead className="w-[18%] text-center font-bold text-[10px] uppercase tracking-wider text-slate-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((row, i) => {
                                        const txnId = row.transactionid;
                                        const isExpanded = expandedTxnId === txnId;
                                        const isExpLoading = expandedLoading[txnId];
                                        const expDetail = expandedDetails[txnId];

                                        return (
                                            <React.Fragment key={`frag-${i}`}>
                                                {/* ─ Main Row ─ */}
                                                <TableRow
                                                    onClick={(e) => handleRowClick(row, e)}
                                                    className={`align-middle cursor-pointer select-none transition-colors border-b border-slate-100/60 ${isExpanded ? 'bg-indigo-50/20' : 'hover:bg-slate-50/40'}`}
                                                >
                                                    {/* Property Details */}
                                                    <TableCell className="py-4 pr-4">
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            {(() => {
                                                                const addr = row.propertyaddress || '';
                                                                const ci = addr.indexOf(',');
                                                                const l1 = ci !== -1 ? addr.slice(0, ci) : addr;
                                                                const l2 = ci !== -1 ? addr.slice(ci + 1).trim() : '';
                                                                return (
                                                                    <>
                                                                        <span className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors truncate" title={addr}>
                                                                            {l1 || '—'}
                                                                        </span>
                                                                        {l2 && <span className="text-xs text-slate-400 font-medium truncate">{l2}</span>}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </TableCell>

                                                    {/* Mismatched Parameters */}
                                                    <TableCell className="py-4 pr-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Array.isArray(row.mismatched_parameters) && row.mismatched_parameters.length > 0 ? (
                                                                row.mismatched_parameters.map((p, idx) => (
                                                                    <Badge
                                                                        key={idx}
                                                                        variant="outline"
                                                                        className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border-rose-100/80 whitespace-nowrap shadow-sm"
                                                                    >
                                                                        {p.replace(/_/g, ' ')}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-slate-400 text-xs font-medium">None</span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Review Status Column */}
                                                    <TableCell className="py-4 pr-4">
                                                        {row.review && row.review.review_status ? (
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full capitalize border whitespace-nowrap shadow-sm ${
                                                                    row.review.review_status === 'review_done'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100/80'
                                                                        : row.review.review_status === 'not_a_mismatch'
                                                                            ? 'bg-slate-50 text-slate-600 border-slate-200/80'
                                                                            : 'bg-blue-50 text-blue-700 border-blue-100/80'
                                                                }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                        row.review.review_status === 'review_done'
                                                                            ? 'bg-emerald-500'
                                                                            : row.review.review_status === 'not_a_mismatch'
                                                                                ? 'bg-slate-400'
                                                                                : 'bg-blue-500'
                                                                    }`} />
                                                                    {row.review.review_status.replace(/_/g, ' ')}
                                                                </span>
                                                                {row.review.notes && (
                                                                    <span className="text-[10px] text-slate-400 font-medium max-w-[160px] truncate" title={row.review.notes}>
                                                                        📝 {row.review.notes}
                                                                    </span>
                                                                )}
                                                                {row.review.updated_by && (
                                                                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                                                                        By {row.review.updated_by}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50/50 px-2 py-0.5 rounded border border-dashed border-slate-200 whitespace-nowrap">
                                                                Not Reviewed
                                                            </span>
                                                        )}
                                                    </TableCell>

                                                    {/* Action */}
                                                    <TableCell className="py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openDrawer(row); }}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all select-none"
                                                            >
                                                                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                Details
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openReviewModal(row); }}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm hover:bg-indigo-100 hover:text-indigo-700 transition-all select-none"
                                                            >
                                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                Review
                                                            </button>
                                                            {/* Chevron expand indicator */}
                                                            <span className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {/* ─ Inline Expansion Panel ─ */}
                                                {isExpanded && (
                                                    <TableRow key={`exp-${i}`}>
                                                        <TableCell colSpan={4} className="p-0 border-t-0">
                                                            <div style={{ animation: 'slideDown 0.22s ease-out forwards', overflow: 'hidden' }}>
                                                                <div className="px-6 py-5 bg-gradient-to-b from-slate-50/80 to-white border-t border-indigo-100/60">
                                                                    {isExpLoading ? (
                                                                        <div className="flex items-center gap-3 py-4">
                                                                            <svg className="animate-spin h-5 w-5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24">
                                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                            </svg>
                                                                            <span className="text-xs font-semibold text-slate-400">Fetching parameter breakdown…</span>
                                                                        </div>
                                                                    ) : expDetail ? (
                                                                        <div className="space-y-4">
                                                                            {/* Meta chips */}
                                                                            <div className="flex items-center">
                                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Parameter Comparison</span>
                                                                            </div>

                                                                            {/* Column header */}
                                                                            <div className="grid grid-cols-[1.2fr_1fr_1fr_100px] gap-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/50">
                                                                                <span>Parameter</span>
                                                                                <span>Brokerage Engine</span>
                                                                                <span>SkySlope</span>
                                                                                <span className="text-right">Result</span>
                                                                            </div>

                                                                            {/* Parameter rows */}
                                                                            <div className="divide-y divide-slate-100/75 border-b border-slate-100/75">
                                                                                {expDetail.parameters && Object.entries(expDetail.parameters).map(([key, val]) => {
                                                                                    const isMismatch = val.match_result === 'mismatch';
                                                                                    const isMatch = val.match_result === 'match';
                                                                                    return (
                                                                                        <div
                                                                                            key={key}
                                                                                            className="grid grid-cols-[1.2fr_1fr_1fr_100px] gap-4 items-center px-3 py-3 text-xs hover:bg-slate-50/50 transition-colors"
                                                                                        >
                                                                                            {/* Param name */}
                                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMismatch ? 'bg-rose-500' : isMatch ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                                                                <span className={`font-medium capitalize truncate ${isMismatch ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                                                                                                    {key.replace(/_/g, ' ')}
                                                                                                </span>
                                                                                            </div>
                                                                                            {/* BE value */}
                                                                                            <span className={`font-mono text-xs truncate ${isMismatch ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                                                                                                {val.be_value !== null && val.be_value !== undefined ? String(val.be_value) : <span className="text-slate-300">—</span>}
                                                                                            </span>
                                                                                            {/* SkySlope value */}
                                                                                            <span className={`font-mono text-xs truncate ${isMismatch ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                                                                                                {val.skyslope_value !== null && val.skyslope_value !== undefined ? String(val.skyslope_value) : <span className="text-slate-300">—</span>}
                                                                                            </span>
                                                                                            {/* Match badge */}
                                                                                            <div className="flex justify-end">
                                                                                                {isMismatch ? (
                                                                                                    <span className="inline-flex items-center text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100/60 whitespace-nowrap">
                                                                                                        Mismatch
                                                                                                    </span>
                                                                                                ) : isMatch ? (
                                                                                                    <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/60 whitespace-nowrap">
                                                                                                        Match
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-[10px] text-slate-400 font-normal">N/A</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="py-6 text-center text-xs text-slate-400 font-medium">
                                                                            Failed to load parameter details.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    {transactions.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-slate-400 py-12 font-medium">
                                                No transactions found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-slate-100 bg-slate-50/20 flex items-center justify-between">
                                    <Button variant="outline" size="sm" onClick={() => { setPage(p => Math.max(1, p - 1)); setExpandedTxnId(null); }} disabled={page === 1} className="h-8 text-xs font-semibold text-slate-600">
                                        Previous
                                    </Button>
                                    <span className="text-xs font-semibold text-slate-500">Page {page} of {totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setExpandedTxnId(null); }} disabled={page === totalPages} className="h-8 text-xs font-semibold text-slate-600">
                                        Next
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </Card>
            </div>

            {/* ── SkySlope / Detail Modal ─────────────────────────────────── */}
            {drawerRow && (
                <>
                    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px]" onClick={closeDrawer} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeDrawer(); }}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden" style={{ height: '94vh', maxHeight: '94vh' }}>

                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Transaction Detail</h2>
                                    {drawerRow.source_table && (
                                        <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0.5 rounded">
                                            {drawerRow.source_table.replace(/_/g, ' ')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => { closeDrawer(); openReviewModal(drawerRow); }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Review
                                    </button>
                                    <button onClick={closeDrawer} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Tab selector */}
                            {drawerDetail && !drawerDetailLoading && !drawerDetail._error && (
                                <div className="flex border-b border-slate-100 shrink-0">
                                    {((drawerDetail.brokerage_engine_records?.length) || drawerDetail.brokerage_engine) && (
                                        <button onClick={() => setPopupSegment('brokerage_engine')} className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${popupSegment === 'brokerage_engine' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/10' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'}`}>
                                            Brokerage Engine Record
                                        </button>
                                    )}
                                    {drawerDetail.otherincome_transactions && (Array.isArray(drawerDetail.otherincome_transactions) ? drawerDetail.otherincome_transactions.length > 0 : true) && (
                                        <button onClick={() => setPopupSegment('other_income')} className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${popupSegment === 'other_income' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/10' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'}`}>
                                            Other Income Record
                                        </button>
                                    )}
                                    {drawerDetail.skyslope && drawerDetail.skyslope.match !== false && (
                                        <button onClick={() => setPopupSegment('skyslope')} className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${popupSegment === 'skyslope' ? 'border-sky-600 text-sky-700 bg-sky-50/10' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'}`}>
                                            Related SkySlope Record
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Modal Body */}
                            {drawerDetailLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                                    <svg className="animate-spin h-7 w-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <p className="text-xs font-semibold text-slate-400">Fetching transaction details…</p>
                                </div>
                            ) : drawerDetail?._error ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                    <p className="font-bold text-red-600 text-sm">Failed to load details</p>
                                    <p className="text-xs text-slate-500">{drawerDetail._error}</p>
                                </div>
                            ) : drawerDetail ? (
                                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                    {popupSegment === 'brokerage_engine' && (
                                        drawerDetail.brokerage_engine_records?.length > 0
                                            ? drawerDetail.brokerage_engine_records.map((rec, idx) => (
                                                <div key={idx} className="space-y-4">
                                                    {drawerDetail.brokerage_engine_records.length > 1 && (
                                                        <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">Record #{idx + 1}</h4>
                                                    )}
                                                    <SectionedDetailView data={rec} />
                                                </div>
                                            ))
                                            : drawerDetail.brokerage_engine
                                                ? <SectionedDetailView data={drawerDetail.brokerage_engine} />
                                                : <p className="text-sm text-slate-400 text-center py-12">No Brokerage Engine record found</p>
                                    )}
                                    {popupSegment === 'other_income' && (
                                        drawerDetail.otherincome_transactions
                                            ? Array.isArray(drawerDetail.otherincome_transactions)
                                                ? drawerDetail.otherincome_transactions.length > 0
                                                    ? drawerDetail.otherincome_transactions.map((rec, idx) => (
                                                        <div key={idx} className="space-y-4">
                                                            {drawerDetail.otherincome_transactions.length > 1 && <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">Record #{idx + 1}</h4>}
                                                            <SectionedDetailView data={rec} />
                                                        </div>
                                                    ))
                                                    : <p className="text-sm text-slate-400 text-center py-12">No Other Income record found</p>
                                                : <SectionedDetailView data={drawerDetail.otherincome_transactions} />
                                            : <p className="text-sm text-slate-400 text-center py-12">No Other Income record found</p>
                                    )}
                                    {popupSegment === 'skyslope' && (
                                        drawerDetail.skyslope && drawerDetail.skyslope.match !== false
                                            ? <SectionedDetailView data={drawerDetail.skyslope} />
                                            : <p className="text-sm text-slate-400 text-center py-12">No linked SkySlope record found</p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-sm text-slate-400">No transaction ID available for this record.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

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
                                <h3 className="text-sm font-bold text-slate-800">Review Transaction Discrepancy</h3>
                                <p className="text-xs text-slate-500 mt-0.5 font-mono truncate max-w-xs">
                                    {reviewModal.row?.propertyaddress || reviewModal.row?.transactionid || reviewModal.row?.transactionId || 'Transaction'}
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
                                            type="button"
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
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-300 transition-all resize-none text-slate-700"
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
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-300 transition-all text-slate-700"
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

export default ReconciliationNew;
