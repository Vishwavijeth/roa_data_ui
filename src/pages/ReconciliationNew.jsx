import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import MultiSelect from '../components/shared/MultiSelect';
import DateFilterInput from '../components/shared/DateFilterInput';
import SectionedDetailView from '../components/shared/SectionedDetailView';
import ReconciliationAnalytics from './ReconciliationAnalytics';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '../components/ui/Table';
import { PARAMETERS, API_DOMAIN } from '../constants';

function ReconciliationNew({ syncingData, syncProgress, syncResult, handleSyncData, setSyncResult, refreshTrigger }) {
    // Refs to control when the main transactions effect fires.
    // bootstrappedRef: becomes true after the initial bootstrap call completes.
    // skipNextRef:     set to true right before we programmatically update selectedParams
    //                  so the main effect ignores that one triggered re-run.
    const bootstrappedRef = React.useRef(false);
    const skipNextRef = React.useRef(false);

    // ── Sub-tab routing via hash (reconciliation_new/analytics | reconciliation_new/transactions)
    const getSubTabFromHash = () => {
        const hash = window.location.hash.replace('#', '');
        if (hash === 'reconciliation_new/analytics') return 'analytics';
        return 'transactions';
    };
    const [activeSubTab, setActiveSubTab] = useState(getSubTabFromHash);

    // Sync sub-tab when browser back/forward is pressed
    useEffect(() => {
        const onHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            // Only handle sub-tabs for this page; let dashboard handle top-level page changes
            if (hash === 'reconciliation_new/analytics') {
                setActiveSubTab('analytics');
            } else if (hash === 'reconciliation_new' || hash === 'reconciliation_new/transactions') {
                setActiveSubTab('transactions');
            }
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // Helper: navigate sub-tab and push to browser history
    const navigateSubTab = (tab) => {
        const newHash = tab === 'analytics' ? 'reconciliation_new/analytics' : 'reconciliation_new/transactions';
        if (window.location.hash !== `#${newHash}`) {
            window.location.hash = newHash;
        }
        setActiveSubTab(tab);
    };
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
    const [downloadingReport, setDownloadingReport] = useState(false);

    // ── Filter options (populated from API on first fetch) ────────────────────
    const [availableParams, setAvailableParams] = useState([]);
    const [selectedParams, setSelectedParams] = useState([]);

    // ── Source Table Toggle ───────────────────────────────────────────────────
    // null = all, 'sale income' = sale income only, 'other income' = other income only
    const [sourceTableFilter, setSourceTableFilter] = useState(null);

    // ── Search ────────────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // ── Advanced Filters ─────────────────────────────────────────────────────
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [closeDateFrom, setCloseDateFrom] = useState('');
    const [closeDateTo, setCloseDateTo] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [selectedSpecialists, setSelectedSpecialists] = useState([]);
    const [availableSpecialists, setAvailableSpecialists] = useState([]);
    const [selectedReviewers, setSelectedReviewers] = useState([]);
    const [availableReviewers, setAvailableReviewers] = useState([]);
    const [filterSaleNoSkyslope, setFilterSaleNoSkyslope] = useState(false);
    const [filterOtherNoSkyslope, setFilterOtherNoSkyslope] = useState(false);
    const [selectedReviewStatuses, setSelectedReviewStatuses] = useState([]);

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
    // Bootstrap (runs once on mount):
    //   1. Calls the transactions API to discover available parameter filters.
    //   2. Pre-selects all discovered parameters.
    //   3. Loads the first page of data with all parameters already selected.
    //   4. Sets bootstrappedRef so the main effect knows it can fire freely.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        setError(null);
        setMetricsLoading(true);

        fetch(`${API_BASE}/reconciliation/transactions?page=1`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(json => {
                // Discover available parameter filters (but do NOT pre-select any).
                if (json.filters?.parameter?.length) {
                    setAvailableParams(json.filters.parameter);
                }

                // Populate status filter options from transactions filters key
                if (json.filters?.status?.length) {
                    setAvailableStatuses(json.filters.status);
                }

                if (json.filters?.specialist?.length) {
                    setAvailableSpecialists(json.filters.specialist);
                }

                if (json.filters?.reviewer?.length) {
                    setAvailableReviewers(json.filters.reviewer);
                }

                // Set metrics summary from summary key
                if (json.summary) {
                    setMetrics(json.summary);
                }
                setMetricsLoading(false);

                // Use this response as the initial data.
                setTransactions(Array.isArray(json.data) ? json.data : []);
                setTotalPages(json.pagination?.total_pages || 1);
                setTotalCount(json.count || 0);

                // Unlock the main effect for all future user-driven changes.
                bootstrappedRef.current = true;
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                bootstrappedRef.current = true;
                setLoading(false);
                setMetricsLoading(false);
            });
    }, []); // runs exactly once

    // ─────────────────────────────────────────────────────────────────────────
    // Main transactions fetch – fires only when the user changes a filter/page.
    // Gated by bootstrappedRef so it does NOT fire on initial mount or during
    // the bootstrap's programmatic selectedParams update.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        // Skip until bootstrap is done.
        if (!bootstrappedRef.current) return;

        // Skip the single re-trigger caused by the bootstrap pre-selecting params.
        if (skipNextRef.current) {
            skipNextRef.current = false;
            return;
        }

        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ page });
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        if (selectedParams.length > 0) {
            selectedParams.forEach(p => params.append('mismatch_parameter', p));
        }
        if (sourceTableFilter) {
            params.set('source_table', sourceTableFilter);
        }
        // Advanced filters
        if (closeDateFrom) params.set('from_close_date', closeDateFrom);
        if (closeDateTo) params.set('to_close_date', closeDateTo);
        if (selectedStatuses.length > 0) {
            selectedStatuses.forEach(s => params.append('status', s));
        }
        if (selectedSpecialists.length > 0) {
            selectedSpecialists.forEach(s => params.append('specialist', s));
        }
        if (selectedReviewers.length > 0) {
            selectedReviewers.forEach(r => params.append('reviewer', r));
        }
        if (filterSaleNoSkyslope) params.set('saleincome_no_skyslopefileid', 'true');
        if (filterOtherNoSkyslope) params.set('otherincome_no_skyslopefileid', 'true');
        if (selectedReviewStatuses.length > 0) {
            selectedReviewStatuses.forEach(s => params.append('review_status', s));
        }

        fetch(`${API_BASE}/reconciliation/transactions?${params}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(json => {
                // Populate status filter options from transactions filters key
                if (json.filters?.status?.length) {
                    setAvailableStatuses(json.filters.status);
                }
                if (json.filters?.specialist?.length) {
                    setAvailableSpecialists(json.filters.specialist);
                }
                if (json.filters?.reviewer?.length) {
                    setAvailableReviewers(json.filters.reviewer);
                }

                // Set metrics summary from summary key
                if (json.summary) {
                    setMetrics(json.summary);
                }

                setTransactions(Array.isArray(json.data) ? json.data : []);
                setTotalPages(json.pagination?.total_pages || 1);
                setTotalCount(json.count || 0);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [page, debouncedSearch, selectedParams, sourceTableFilter, closeDateFrom, closeDateTo, selectedStatuses, selectedSpecialists, selectedReviewers, filterSaleNoSkyslope, filterOtherNoSkyslope, selectedReviewStatuses, refreshTrigger]);

    const handleDownloadReport = async () => {
        setDownloadingReport(true);
        try {
            const params = new URLSearchParams();
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
            if (selectedParams.length > 0) {
                selectedParams.forEach(p => params.append('mismatch_parameter', p));
            }
            if (sourceTableFilter) {
                params.set('source_table', sourceTableFilter);
            }
            if (closeDateFrom) params.set('from_close_date', closeDateFrom);
            if (closeDateTo) params.set('to_close_date', closeDateTo);
            if (selectedStatuses.length > 0) {
                selectedStatuses.forEach(s => params.append('status', s));
            }
            if (selectedSpecialists.length > 0) {
                selectedSpecialists.forEach(s => params.append('specialist', s));
            }
            if (selectedReviewers.length > 0) {
                selectedReviewers.forEach(r => params.append('reviewer', r));
            }
            if (filterSaleNoSkyslope) params.set('saleincome_no_skyslopefileid', 'true');
            if (filterOtherNoSkyslope) params.set('otherincome_no_skyslopefileid', 'true');
            if (selectedReviewStatuses.length > 0) {
                selectedReviewStatuses.forEach(s => params.append('review_status', s));
            }

            const url = `${API_DOMAIN}/recon-data/download?${params.toString()}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();

            // Get content disposition header if available to extract filename
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'reconciliation_report.xlsx';
            if (contentDisposition && contentDisposition.includes('filename=')) {
                filename = contentDisposition.split('filename=')[1].replace(/["']/g, '');
            }

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
            }, 200);
        } catch (err) {
            console.error('Download report failed:', err);
            alert(`Download failed: ${err.message}`);
        } finally {
            setDownloadingReport(false);
        }
    };

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
        const sourceTables = Array.isArray(row.source_table) ? row.source_table : (row.source_table ? [row.source_table] : []);
        const hasSaleIncome = sourceTables.some(t => t === 'sale income');
        const hasOtherIncome = sourceTables.some(t => t === 'other income' || t === 'otherincome_transactions');
        // When both sale income AND other income are present, or when a saleguid exists → use skyslope detail.
        // Only fall back to otherincome endpoint when the record is exclusively other income (no sale income).
        const isMixed = hasSaleIncome && hasOtherIncome;
        const isOnlyOtherIncome = hasOtherIncome && !hasSaleIncome;
        const url = isMixed
            ? `${API_BASE}/skyslope/detail?saleguid=${encodeURIComponent(saleguid)}`
            : isOnlyOtherIncome
                ? `${API_BASE}/otherincome_transactions/detail?transactionid=${encodeURIComponent(txnId)}`
                : (saleguid
                    ? `${API_BASE}/skyslope/detail?saleguid=${encodeURIComponent(saleguid)}`
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
                    `${API_DOMAIN}/reconciliation/review/${encodeURIComponent(txnId)}`,
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

    const hasAdvancedFilters = closeDateFrom || closeDateTo || selectedStatuses.length > 0 || selectedSpecialists.length > 0 || selectedReviewers.length > 0 || filterSaleNoSkyslope || filterOtherNoSkyslope || selectedReviewStatuses.length > 0;
    const hasActiveFilters = selectedParams.length > 0 || searchQuery || sourceTableFilter || hasAdvancedFilters;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="p-8 max-w-7xl mx-auto w-full space-y-8">

                {/* ── Page Header ─────────────────────────────────────────── */}
                <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Reconciliation Transactions
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            All transactions with Brokerage Engine and SkySlope parameter comparison.
                            Click any row to see the full parameter breakdown.
                        </p>
                    </div>

                    {/* Secondary Navigation Sub-Tabs + Sync Data Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => navigateSubTab('transactions')}
                                className={`py-2 px-4 text-xs font-bold border-b-2 transition-all leading-none ${activeSubTab === 'transactions'
                                    ? 'border-indigo-600 text-indigo-600 font-bold'
                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Transactions
                            </button>
                            <button
                                onClick={() => navigateSubTab('analytics')}
                                className={`py-2 px-4 text-xs font-bold border-b-2 transition-all leading-none ${activeSubTab === 'analytics'
                                    ? 'border-indigo-600 text-indigo-600 font-bold'
                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Analytics
                            </button>
                        </div>
                        <Button
                            id="sync-data-btn"
                            onClick={handleSyncData}
                            disabled={syncingData}
                            className={`font-semibold text-xs shadow-md select-none gap-2 h-9 ${syncingData
                                ? 'bg-indigo-700/80'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
                                }`}
                        >
                            {syncingData ? (
                                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
                                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                                </svg>
                            ) : (
                                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                                </svg>
                            )}
                            {syncingData ? 'Syncing…' : 'Sync Data'}
                        </Button>
                        <Button
                            id="recon-download-btn"
                            variant="outline"
                            onClick={handleDownloadReport}
                            disabled={downloadingReport}
                            className="font-semibold text-xs shadow-sm select-none gap-2 h-9 border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                        >
                            <svg className={`h-4 w-4 ${downloadingReport ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            {downloadingReport ? 'Generating Report…' : 'Download Report'}
                        </Button>
                    </div>
                </div>

                {/* Sync progress indicator */}
                {syncingData && (
                    <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/50 to-indigo-50/10 border border-indigo-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {syncProgress < 100 ? (
                                    <svg width="18" height="18" fill="none" stroke="#6366f1" viewBox="0 0 24 24" className="animate-spin shrink-0">
                                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24" className="shrink-0 text-emerald-500">
                                        <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                <span className="font-semibold text-sm text-slate-800">
                                    {syncProgress < 100 ? 'Syncing Brokerage Engine, Other Income & SkySlope Data…' : 'Sync Complete!'}
                                </span>
                            </div>
                            <span className="font-bold text-lg text-indigo-600 font-mono">
                                {syncProgress}%
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-indigo-100/50 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300 ease-out"
                                style={{
                                    width: `${syncProgress}%`,
                                    background: syncProgress === 100
                                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                                        : 'linear-gradient(90deg, #6366f1, #818cf8)',
                                }}
                            />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                            {syncProgress < 20
                                ? 'Connecting to Brokerage Engine & SkySlope APIs…'
                                : syncProgress < 50
                                    ? 'Fetching transactions, other income & SkySlope records…'
                                    : syncProgress < 80
                                        ? 'Processing and comparison-matching records…'
                                        : syncProgress < 100
                                            ? 'Finalizing data sync & updating cache…'
                                            : 'All records have been synced successfully.'}
                        </p>
                    </div>
                )}

                {/* Sync success banner */}
                {!syncingData && syncResult && syncResult.ok && (
                    <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/60 text-emerald-700 font-medium text-xs flex items-center gap-2 shadow-sm">
                        <span>✅</span>
                        <span>{syncResult.message}</span>
                    </div>
                )}

                {/* Sync failure banner */}
                {!syncingData && syncResult && !syncResult.ok && (
                    <div className="p-3.5 rounded-lg bg-red-50/50 border border-red-200/60 text-red-700 font-medium text-xs flex items-center gap-2 shadow-sm">
                        <span>❌</span>
                        <span>{syncResult.message}</span>
                    </div>
                )}

                {activeSubTab === 'analytics' ? (
                    <ReconciliationAnalytics
                        fromCloseDate={closeDateFrom}
                        setFromCloseDate={setCloseDateFrom}
                        toCloseDate={closeDateTo}
                        setToCloseDate={setCloseDateTo}
                        selectedSpecialists={selectedSpecialists}
                        setSelectedSpecialists={setSelectedSpecialists}
                        selectedReviewers={selectedReviewers}
                        setSelectedReviewers={setSelectedReviewers}
                        selectedStatuses={selectedStatuses}
                        setSelectedStatuses={setSelectedStatuses}
                        onSeeTransactions={(paramName) => {
                            const paramMap = {
                                gross_commission: 'Gross Commission',
                                close_date: 'Close Date',
                                status: 'Status',
                                sale_price: 'Sale Price',
                                listing_price: 'Listing Price',
                                buyer_name: 'Buyer Name',
                                seller_name: 'Seller Name',
                                buying_agent_name: 'Buying Agent Name',
                                title_company: 'Title Company',
                                contract_date: 'Contract Date'
                            };
                            const humanLabel = paramMap[paramName];
                            if (humanLabel) {
                                setSelectedParams([humanLabel]);
                            }
                            setPage(1);
                            navigateSubTab('transactions');
                        }}
                    />
                ) : (
                    <>
                        {/* ── Metrics Cards ────────────────────────────────────────── */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <Card className="hover:border-slate-300 transition-all select-none">
                                <CardContent className="pt-6">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Records</span>
                                    <div className="text-2xl font-bold text-slate-800 mt-2">
                                        {metricsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (metrics?.total_record?.toLocaleString() ?? '—')}
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
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm relative z-20">
                            {/* Row 1: Search + Clear */}
                            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
                                <div className="relative flex-1 min-w-0">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <Input
                                        id="txn-search"
                                        type="text"
                                        placeholder="Search by address, transaction ID or GUID…"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-8 w-full text-sm"
                                    />
                                    {searchQuery && (
                                        <button
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                                {hasActiveFilters && (
                                    <button
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSelectedParams([]);
                                            setSourceTableFilter(null);
                                            setCloseDateFrom('');
                                            setCloseDateTo('');
                                            setSelectedStatuses([]);
                                            setSelectedSpecialists([]);
                                            setSelectedReviewers([]);
                                            setFilterSaleNoSkyslope(false);
                                            setFilterOtherNoSkyslope(false);
                                            setPage(1);
                                        }}
                                    >
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        Clear all
                                    </button>
                                )}
                                {/* Advanced Filters Toggle */}
                                <button
                                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showAdvancedFilters || hasAdvancedFilters
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    onClick={() => setShowAdvancedFilters(v => !v)}
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                                    </svg>
                                    Advanced Filters
                                    {hasAdvancedFilters && (
                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold ml-0.5">
                                            {[closeDateFrom || closeDateTo ? 1 : 0, selectedStatuses.length > 0 ? 1 : 0, selectedSpecialists.length > 0 ? 1 : 0, selectedReviewers.length > 0 ? 1 : 0, filterSaleNoSkyslope ? 1 : 0, filterOtherNoSkyslope ? 1 : 0].filter(Boolean).length}
                                        </span>
                                    )}
                                    <svg className={`h-3 w-3 ml-0.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                            </div>

                            {/* Row 2: Source toggle + Parameters */}
                            <div className="flex flex-wrap items-center gap-4 px-5 py-3">
                                {/* Source Table Segmented Control */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Source</span>
                                    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                                        {[
                                            { label: 'All', value: null },
                                            { label: 'Sale Income', value: 'sale income' },
                                            { label: 'Other Income', value: 'other income' },
                                        ].map(opt => (
                                            <button
                                                key={String(opt.value)}
                                                onClick={() => { setSourceTableFilter(opt.value); setPage(1); setExpandedTxnId(null); }}
                                                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap leading-none ${sourceTableFilter === opt.value
                                                    ? opt.value === 'sale income'
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : opt.value === 'other income'
                                                            ? 'bg-emerald-600 text-white shadow-sm'
                                                            : 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-6 w-px bg-slate-200" />

                                {/* Parameters MultiSelect */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Parameters</span>
                                    <MultiSelect
                                        id="param-filter"
                                        options={availableParams}
                                        selected={selectedParams}
                                        onChange={vals => { setSelectedParams(vals); setPage(1); setExpandedTxnId(null); }}
                                        placeholder="All parameters"
                                        allLabel="All parameters"
                                    />
                                </div>

                                {/* Active param chips */}
                                {selectedParams.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedParams.map(p => (
                                            <span key={p} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                {p}
                                                <button
                                                    className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors"
                                                    onClick={() => setSelectedParams(prev => prev.filter(v => v !== p))}
                                                >
                                                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Advanced Filters Panel ────────────────────────────── */}
                            {showAdvancedFilters && (
                                <div className="px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/40">
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                                        </svg>
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Advanced Filters</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                                        {/* Close Date From */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                                Close Date From
                                            </label>
                                            <DateFilterInput
                                                id="adv-close-date-from"
                                                value={closeDateFrom}
                                                onChange={v => { setCloseDateFrom(v); setPage(1); }}
                                                placeholder="MM/DD/YYYY"
                                            />
                                        </div>

                                        {/* Close Date To */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                                Close Date To
                                            </label>
                                            <DateFilterInput
                                                id="adv-close-date-to"
                                                value={closeDateTo}
                                                onChange={v => { setCloseDateTo(v); setPage(1); }}
                                                placeholder="MM/DD/YYYY"
                                            />
                                        </div>

                                        {/* Status Multi-Select */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                                Status
                                            </label>
                                            <MultiSelect
                                                id="adv-status-filter"
                                                options={availableStatuses}
                                                selected={selectedStatuses}
                                                onChange={vals => { setSelectedStatuses(vals); setPage(1); }}
                                                placeholder={availableStatuses.length === 0 ? 'Loading…' : 'All statuses'}
                                                allLabel="All statuses"
                                            />
                                        </div>

                                        {/* Specialist Multi-Select */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                                Specialist
                                            </label>
                                            <MultiSelect
                                                id="adv-specialist-filter"
                                                options={availableSpecialists}
                                                selected={selectedSpecialists}
                                                onChange={vals => { setSelectedSpecialists(vals); setPage(1); }}
                                                placeholder={availableSpecialists.length === 0 ? 'Loading…' : 'All specialists'}
                                                allLabel="All specialists"
                                            />
                                        </div>

                                        {/* Reviewer Multi-Select */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                                Reviewer
                                            </label>
                                            <MultiSelect
                                                id="adv-reviewer-filter"
                                                options={availableReviewers}
                                                selected={selectedReviewers}
                                                onChange={vals => { setSelectedReviewers(vals); setPage(1); }}
                                                placeholder={availableReviewers.length === 0 ? 'Loading…' : 'All reviewers'}
                                                allLabel="All reviewers"
                                            />
                                        </div>

                                        {/* No SkySlope File ID + Review Status — single full-width row */}
                                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-5">
                                            <div className="flex items-center gap-6">

                                                {/* No SkySlope File ID */}
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">No SkySlope File ID</span>
                                                    <div className="flex flex-row gap-2">
                                                        {/* Sale Income */}
                                                        <button
                                                            onClick={() => {
                                                                const next = !filterSaleNoSkyslope;
                                                                setFilterSaleNoSkyslope(next);
                                                                if (next) setFilterOtherNoSkyslope(false);
                                                                setPage(1);
                                                            }}
                                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${filterSaleNoSkyslope
                                                                ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <span className={`w-3.5 h-3.5 flex items-center justify-center rounded border text-[9px] font-bold transition-all ${filterSaleNoSkyslope ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white text-transparent'
                                                                }`}>
                                                                {filterSaleNoSkyslope ? '✓' : ''}
                                                            </span>
                                                            Sale Income
                                                            {metrics?.saleincome_no_skyslopefileid != null && (
                                                                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterSaleNoSkyslope ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {metrics.saleincome_no_skyslopefileid.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/* Other Income */}
                                                        <button
                                                            onClick={() => {
                                                                const next = !filterOtherNoSkyslope;
                                                                setFilterOtherNoSkyslope(next);
                                                                if (next) setFilterSaleNoSkyslope(false);
                                                                setPage(1);
                                                            }}
                                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${filterOtherNoSkyslope
                                                                ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <span className={`w-3.5 h-3.5 flex items-center justify-center rounded border text-[9px] font-bold transition-all ${filterOtherNoSkyslope ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 bg-white text-transparent'
                                                                }`}>
                                                                {filterOtherNoSkyslope ? '✓' : ''}
                                                            </span>
                                                            Other Income
                                                            {metrics?.otherincome_no_skyslopefileid != null && (
                                                                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterOtherNoSkyslope ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {metrics.otherincome_no_skyslopefileid.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Divider */}
                                                <div className="w-px self-stretch bg-slate-200" />

                                                {/* Review Status */}
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Review Status</span>
                                                    <div className="flex flex-row flex-wrap gap-2">
                                                        {[
                                                            { value: 'in_review', label: 'In Review', active: 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm', dot: 'bg-indigo-500' },
                                                            { value: 'review_done', label: 'Review Done', active: 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm', dot: 'bg-emerald-500' },
                                                            { value: 'not_a_mismatch', label: 'Not a Mismatch', active: 'bg-slate-100 text-slate-700 border-slate-400 shadow-sm', dot: 'bg-slate-500' },
                                                        ].map(opt => {
                                                            const isActive = selectedReviewStatuses.includes(opt.value);
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => {
                                                                        setSelectedReviewStatuses(prev =>
                                                                            isActive ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                                                                        );
                                                                        setPage(1);
                                                                    }}
                                                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${isActive ? opt.active : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    <span className={`w-3.5 h-3.5 flex items-center justify-center rounded border text-[9px] font-bold transition-all ${isActive ? `${opt.dot} border-transparent text-white` : 'border-slate-300 bg-white text-transparent'
                                                                        }`}>
                                                                        {isActive ? '✓' : ''}
                                                                    </span>
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </div>

                                    {/* Active advanced filter chips */}
                                    {hasAdvancedFilters && (
                                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                                            {closeDateFrom && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                                                    From: {closeDateFrom}
                                                    <button className="ml-0.5 text-violet-400 hover:text-red-500 transition-colors" onClick={() => { setCloseDateFrom(''); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            )}
                                            {closeDateTo && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                                                    To: {closeDateTo}
                                                    <button className="ml-0.5 text-violet-400 hover:text-red-500 transition-colors" onClick={() => { setCloseDateTo(''); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            )}
                                            {selectedStatuses.map(s => (
                                                <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                    {s}
                                                    <button className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors" onClick={() => { setSelectedStatuses(prev => prev.filter(v => v !== s)); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            ))}
                                            {filterSaleNoSkyslope && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                    Sale: No SkySlope ID
                                                    <button className="ml-0.5 text-amber-400 hover:text-red-500 transition-colors" onClick={() => { setFilterSaleNoSkyslope(false); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            )}
                                            {filterOtherNoSkyslope && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                                    Other Income: No SkySlope ID
                                                    <button className="ml-0.5 text-sky-400 hover:text-red-500 transition-colors" onClick={() => { setFilterOtherNoSkyslope(false); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            )}
                                            {selectedSpecialists.map(s => (
                                                <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                                    Specialist: {s}
                                                    <button className="ml-0.5 text-orange-400 hover:text-red-500 transition-colors" onClick={() => { setSelectedSpecialists(prev => prev.filter(v => v !== s)); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            ))}
                                            {selectedReviewers.map(r => (
                                                <span key={r} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                                    Reviewer: {r}
                                                    <button className="ml-0.5 text-teal-400 hover:text-red-500 transition-colors" onClick={() => { setSelectedReviewers(prev => prev.filter(v => v !== r)); setPage(1); }}>
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            ))}
                                            {selectedReviewStatuses.map(s => {
                                                const labels = { in_review: 'In Review', review_done: 'Review Done', not_a_mismatch: 'Not a Mismatch' };
                                                return (
                                                    <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        Review: {labels[s] || s}
                                                        <button className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors" onClick={() => { setSelectedReviewStatuses(prev => prev.filter(v => v !== s)); setPage(1); }}>
                                                            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                            <button
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all"
                                                onClick={() => {
                                                    setCloseDateFrom('');
                                                    setCloseDateTo('');
                                                    setSelectedStatuses([]);
                                                    setSelectedSpecialists([]);
                                                    setSelectedReviewers([]);
                                                    setFilterSaleNoSkyslope(false);
                                                    setFilterOtherNoSkyslope(false);
                                                    setSelectedReviewStatuses([]);
                                                    setPage(1);
                                                }}
                                            >
                                                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                Clear advanced
                                            </button>
                                        </div>
                                    )}
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
                                                <TableHead className="w-[24%] font-bold text-[10px] uppercase tracking-wider text-slate-400">Property Address</TableHead>
                                                <TableHead className="w-[22%]"></TableHead>
                                                <TableHead className="w-[18%] font-bold text-[10px] uppercase tracking-wider text-slate-400">Mismatched Parameters</TableHead>
                                                <TableHead className="w-[22%] font-bold text-[10px] uppercase tracking-wider text-slate-400">Review Status</TableHead>
                                                <TableHead className="w-[14%] text-center font-bold text-[10px] uppercase tracking-wider text-slate-400">Action</TableHead>
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
                                                            {/* Property Address */}
                                                            <TableCell className="py-3.5 pr-4 min-w-0">
                                                                {(() => {
                                                                    const addr = row.propertyaddress || '';
                                                                    const ci = addr.indexOf(',');
                                                                    const l1 = ci !== -1 ? addr.slice(0, ci) : addr;
                                                                    const l2 = ci !== -1 ? addr.slice(ci + 1).trim() : '';
                                                                    return (
                                                                        <div className="flex flex-col min-w-0">
                                                                            {/* Street Address */}
                                                                            <span
                                                                                className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors truncate block"
                                                                                title={addr}
                                                                            >
                                                                                {l1 || '—'}
                                                                            </span>
                                                                            {/* City, State, Zip */}
                                                                            {l2 && (
                                                                                <span className="text-xs text-slate-400 font-medium truncate block" title={l2}>
                                                                                    {l2}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </TableCell>

                                                            {/* Source & SkySlope Stage */}
                                                            <TableCell className="py-3.5 pr-4 min-w-0">
                                                                {(() => {
                                                                    const sourceTables = Array.isArray(row.source_table)
                                                                        ? row.source_table
                                                                        : (row.source_table ? [row.source_table] : []);
                                                                    const hasContent = sourceTables.length > 0 || row.skyslope_stage || !row.saleguid || row.saleguid === 'null';
                                                                    if (!hasContent) return <span className="text-slate-300 text-xs">—</span>;
                                                                    return (
                                                                        <div className="flex flex-col gap-1.5 items-start">
                                                                            {/* Source Table Badges — one per entry */}
                                                                            {sourceTables.map((st, stIdx) => (
                                                                                <span
                                                                                    key={stIdx}
                                                                                    className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${st === 'sale income'
                                                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                                            : 'bg-sky-50 text-sky-700 border-sky-200'
                                                                                        }`}
                                                                                >
                                                                                    {st === 'sale income' ? 'Sale Income' : 'Other Income'}
                                                                                </span>
                                                                            ))}
                                                                            {/* SkySlope Stage or No SkySlope File ID Badge */}
                                                                            {!row.saleguid || row.saleguid === 'null' ? (
                                                                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shadow-sm">
                                                                                    No SkySlope File ID
                                                                                </span>
                                                                            ) : (
                                                                                row.skyslope_stage && (
                                                                                    <span
                                                                                        className="inline-block whitespace-normal break-words max-w-[200px] text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-left"
                                                                                        title={row.skyslope_stage}
                                                                                    >
                                                                                        {row.skyslope_stage}
                                                                                    </span>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
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
                                                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full capitalize border whitespace-nowrap shadow-sm ${row.review.review_status === 'review_done'
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100/80'
                                                                            : row.review.review_status === 'not_a_mismatch'
                                                                                ? 'bg-slate-50 text-slate-600 border-slate-200/80'
                                                                                : 'bg-blue-50 text-blue-700 border-blue-100/80'
                                                                            }`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.review.review_status === 'review_done'
                                                                                ? 'bg-emerald-500'
                                                                                : row.review.review_status === 'not_a_mismatch'
                                                                                    ? 'bg-slate-400'
                                                                                    : 'bg-blue-500'
                                                                                }`} />
                                                                            {row.review.review_status.replace(/_/g, ' ')}
                                                                        </span>
                                                                        {row.review.notes && (
                                                                            <span className="text-[10px] text-slate-400 font-medium max-w-[160px] truncate block" title={row.review.notes}>
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
                                                                <div className="flex flex-col lg:flex-row items-center justify-center gap-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openDrawer(row); }}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all select-none whitespace-nowrap"
                                                                    >
                                                                        <svg className="h-3 w-3 text-slate-500 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                        Details
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openReviewModal(row); }}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm hover:bg-indigo-100 hover:text-indigo-700 transition-all select-none whitespace-nowrap"
                                                                    >
                                                                        <svg className="h-3 w-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                        Review
                                                                    </button>
                                                                    {row.skyslope_url && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); window.open(row.skyslope_url, '_blank', 'noopener,noreferrer'); }}
                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 shadow-sm hover:bg-sky-100 hover:text-sky-800 transition-all select-none whitespace-nowrap"
                                                                            title="Open in SkySlope"
                                                                        >
                                                                            <svg className="h-3 w-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                            </svg>
                                                                            SkySlope
                                                                        </button>
                                                                    )}
                                                                    {/* Chevron expand indicator */}
                                                                    <span className={`text-slate-400 transition-transform duration-200 ml-1 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                                                                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* ─ Inline Expansion Panel ─ */}
                                                        {isExpanded && (
                                                            <TableRow key={`exp-${i}`}>
                                                                <TableCell colSpan={5} className="p-0 border-t-0">
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
                                                    <TableCell colSpan={6} className="text-center text-slate-400 py-12 font-medium">
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
                    </>
                )}
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
                                    {(() => {
                                        const st = drawerRow.source_table;
                                        const tables = Array.isArray(st) ? st : (st ? [st] : []);
                                        return tables.map((t, i) => (
                                            <Badge key={i} variant="secondary" className="capitalize text-[10px] px-2 py-0.5 rounded">
                                                {t.replace(/_/g, ' ')}
                                            </Badge>
                                        ));
                                    })()}
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
                                    {reviewModal.success}
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeReviewModal}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReviewSubmit}
                                disabled={reviewModal.submitting || !reviewForm.track_status}
                                className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {reviewModal.submitting ? 'Saving…' : 'Save Review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ReconciliationNew;
