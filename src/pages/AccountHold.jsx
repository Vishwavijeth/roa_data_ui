import React, { useState, useEffect } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import SectionedDetailView from '../components/shared/SectionedDetailView';

// ── Flag helpers ──────────────────────────────────────────────────────────────

const FLAG_LABELS = {
    account_hold: { label: 'Account Hold', color: 'bg-red-100 text-red-700 border-red-200' },
    ar_balance: { label: 'AR Balance', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    close_date: { label: 'Close Date', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    seller_name: { label: 'Seller Name', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    gross_commission: { label: 'Gross Commission', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    status: { label: 'Status', color: 'bg-slate-100 text-slate-700 border-slate-300' },
    contract_date: { label: 'Contract Date', color: 'bg-teal-100 text-teal-700 border-teal-200' },
    transaction_mismatch: { label: 'Mismatch', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function FlagChip({ flag }) {
    const meta = FLAG_LABELS[flag] || { label: flag.replace(/_/g, ' '), color: 'bg-slate-100 text-slate-600 border-slate-200' };
    return (
        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${meta.color}`}>
            {meta.label}
        </span>
    );
}

function SourceTableBadge({ source }) {
    const map = {
        'sale income': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'other income': 'bg-sky-50 text-sky-700 border-sky-200',
    };
    const cls = map[source?.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';
    return (
        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${cls} capitalize`}>
            {source || '—'}
        </span>
    );
}

function TransactionStatusBadge({ status }) {
    if (!status) return null;
    const s = status.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (s.includes('closed') || s.includes('complete')) {
        cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (s.includes('cancel') || s.includes('expire') || s.includes('terminated')) {
        cls = 'bg-red-50 text-red-700 border-red-200';
    } else if (s.includes('pending') || s.includes('active') || s.includes('escrow')) {
        cls = 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return (
        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${cls}`}>
            {status}
        </span>
    );
}

// ── Detail View Component ──────────────────────────────────────────────────────

function AccountHoldDetail({ customerId }) {
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal state for transaction detail popup
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [detailModalData, setDetailModalData] = useState(null);
    const [detailModalLoading, setDetailModalLoading] = useState(false);
    const [popupSegment, setPopupSegment] = useState('brokerage_engine');

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        setDetailData(null);

        fetch(`https://roa-data-backend.vercel.app/account-hold/detail/${customerId}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                return res.json();
            })
            .then(resData => {
                if (isMounted) {
                    setDetailData(resData?.data || resData);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [customerId]);

    const openDetailModal = (txn) => {
        setSelectedTxn(txn);
        setDetailModalData(null);
        setDetailModalLoading(true);
        setPopupSegment('brokerage_engine');

        const txnId = txn.transactionid || txn.transactionId || txn.id;
        const sourceTable = String(txn.source_table || '').toLowerCase();
        const hasSkyslope = Boolean(txn.skyslope_url || txn.skyslope);

        let url = '';
        const API_BASE = 'https://roa-data-backend.vercel.app';

        if (!hasSkyslope) {
            url = `${API_BASE}/brokerage_engine/detail?transactionid=${encodeURIComponent(txnId)}`;
        } else if (sourceTable === 'sale income') {
            url = `${API_BASE}/skyslope/detail?saleguid=${encodeURIComponent(txnId)}`;
        } else if (sourceTable === 'other income') {
            url = `${API_BASE}/otherincome_transactions/detail?transactionid=${encodeURIComponent(txnId)}`;
        } else {
            url = `${API_BASE}/brokerage_engine/detail?transactionid=${encodeURIComponent(txnId)}`;
        }

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                return res.json();
            })
            .then(json => {
                setDetailModalData(json);
                setDetailModalLoading(false);
                if (json?.brokerage_engine_records?.length || json?.brokerage_engine) {
                    setPopupSegment('brokerage_engine');
                } else if (json?.otherincome_transactions) {
                    setPopupSegment('other_income');
                } else if (json?.skyslope) {
                    setPopupSegment('skyslope');
                }
            })
            .catch(err => {
                setDetailModalData({ _error: err.message });
                setDetailModalLoading(false);
            });
    };

    const closeDetailModal = () => {
        setSelectedTxn(null);
        setDetailModalData(null);
    };

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
                    <Button variant="outline" className="opacity-50 pointer-events-none gap-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </Button>
                    <div className="h-6 bg-slate-100 rounded w-48 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
                    <div className="h-80 bg-slate-100 rounded-2xl border border-slate-200" />
                    <div className="h-80 bg-slate-100 rounded-2xl border border-slate-200" />
                </div>
            </div>
        );
    }

    if (error || !detailData) {
        return (
            <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
                    <Button
                        variant="outline"
                        onClick={() => window.location.hash = 'pre_cda'}
                        className="gap-2 text-slate-600 hover:text-slate-900 border-slate-200 bg-white hover:bg-slate-50 transition-all font-semibold"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Listing
                    </Button>
                </div>
                <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-white rounded-2xl border border-slate-200 animate-fade-in">
                    <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
                        <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h3 className="text-base font-semibold text-slate-700">Failed to load agent details</h3>
                        <p className="text-sm text-slate-400 mt-1">{error || 'Agent not found'}</p>
                    </div>
                    <Button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm"
                    >
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    const arData = detailData.ar_balance || {};
    const hasArFlag = detailData.broker_flags?.includes('ar_balance');
    const transactions = detailData.transactions || [];
    const openInvoices = arData.open_invoices || [];

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
            {/* Detail Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="flex flex-wrap items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => window.location.hash = 'pre_cda'}
                        className="gap-2 text-slate-600 hover:text-slate-900 border-slate-200 bg-white hover:bg-slate-50 transition-all font-semibold shadow-xs"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            {detailData.display_name}
                        </h1>
                        <p className="text-sm text-slate-500 font-mono mt-1">
                            {detailData.primary_emailaddress}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {detailData.broker_flags?.map(f => (
                        <FlagChip key={f} flag={f} />
                    ))}
                    {detailData.transaction_flags?.map(f => (
                        <FlagChip key={f} flag={f} />
                    ))}
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-slide-up">
                
                {/* Left Card: QuickBooks AR Balance */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        QuickBooks AR Balance
                    </h3>
                    
                    <div className={`rounded-2xl border p-5 bg-white shadow-xs ${hasArFlag ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Open Balance</span>
                            <span className={`text-xl font-extrabold ${(arData.balance || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ${(arData.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        {openInvoices.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">No open invoices found.</p>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                                            <th className="p-2.5">Invoice #</th>
                                            <th className="p-2.5">Txn Date</th>
                                            <th className="p-2.5">Due Date</th>
                                            <th className="p-2.5 text-right">Amt</th>
                                            <th className="p-2.5 text-right">Bal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {openInvoices.map((inv, i) => (
                                            <tr key={inv.invoice_id || i} className="text-slate-600 hover:bg-slate-50/40">
                                                <td className="p-2.5 font-mono text-slate-700 font-medium">{inv.doc_number || '—'}</td>
                                                <td className="p-2.5">{inv.txn_date || '—'}</td>
                                                <td className="p-2.5">{inv.due_date || '—'}</td>
                                                <td className="p-2.5 text-right">${(inv.total_amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="p-2.5 text-right font-semibold text-amber-600">${(inv.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Involved Transactions */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        Involved Transactions ({transactions.length})
                    </h3>

                    {transactions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-white">
                            <p className="text-xs text-slate-400 italic">No involved transactions found.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
                            {transactions.map((txn, i) => (
                                <div key={txn.transactionid || i} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs hover:shadow-sm transition-shadow">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                        <div className="space-y-1.5 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 leading-snug">
                                                {txn.property_address || 'Unknown Address'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {txn.status && <TransactionStatusBadge status={txn.status} />}
                                                <SourceTableBadge source={txn.source_table} />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                                            <button
                                                onClick={() => openDetailModal(txn)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 transition-all shadow-2xs shrink-0"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Details
                                            </button>

                                            {txn.skyslope_url && (
                                                <a
                                                    href={txn.skyslope_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white border border-sky-200 hover:border-sky-600 transition-all shadow-2xs shrink-0"
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                    SkySlope
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {txn.mismatch_details && Object.keys(txn.mismatch_details).length > 0 && (
                                        <div className="pt-3 border-t border-slate-100 space-y-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mismatch Breakdown</p>
                                            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-xs bg-white">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                                            <th className="p-2">Field</th>
                                                            <th className="p-2">Brokerage Engine</th>
                                                            <th className="p-2">SkySlope</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {Object.entries(txn.mismatch_details).map(([paramName, values]) => (
                                                            <tr key={paramName} className="hover:bg-slate-50/40">
                                                                <td className="p-2 font-semibold text-slate-600 capitalize leading-snug">
                                                                    {paramName.replace(/_/g, ' ')}
                                                                </td>
                                                                <td className="p-2 font-mono text-amber-700 font-semibold break-all leading-normal">
                                                                    {values.be !== null && values.be !== undefined ? String(values.be) : '—'}
                                                                </td>
                                                                <td className="p-2 font-mono text-blue-600 font-semibold break-all leading-normal">
                                                                    {values.skyslope !== null && values.skyslope !== undefined ? String(values.skyslope) : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Transaction Detail Modal (Popup) ────────────────────────── */}
            {selectedTxn && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
                        onClick={closeDetailModal}
                    />
                    {/* Modal */}
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={e => { if (e.target === e.currentTarget) closeDetailModal(); }}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-scale-in"
                            style={{ height: '90vh', maxHeight: '90vh' }}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Transaction Detail</h2>
                                    <SourceTableBadge source={selectedTxn.source_table} />
                                </div>
                                <button
                                    onClick={closeDetailModal}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Tab selector */}
                            {detailModalData && !detailModalLoading && !detailModalData._error && (
                                <div className="flex border-b border-slate-100 shrink-0">
                                    {((detailModalData.brokerage_engine_records?.length) || detailModalData.brokerage_engine) && (
                                        <button
                                            onClick={() => setPopupSegment('brokerage_engine')}
                                            className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${
                                                popupSegment === 'brokerage_engine'
                                                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/10'
                                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                                            }`}
                                        >
                                            Brokerage Engine Record
                                        </button>
                                    )}
                                    {detailModalData.otherincome_transactions && (
                                        Array.isArray(detailModalData.otherincome_transactions)
                                            ? detailModalData.otherincome_transactions.length > 0
                                            : true
                                    ) && (
                                        <button
                                            onClick={() => setPopupSegment('other_income')}
                                            className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${
                                                popupSegment === 'other_income'
                                                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/10'
                                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                                            }`}
                                        >
                                            Other Income Record
                                        </button>
                                    )}
                                    {detailModalData.skyslope && detailModalData.skyslope.match !== false && (
                                        <button
                                            onClick={() => setPopupSegment('skyslope')}
                                            className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${
                                                popupSegment === 'skyslope'
                                                    ? 'border-sky-600 text-sky-700 bg-sky-50/10'
                                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                                            }`}
                                        >
                                            Related SkySlope Record
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Modal Body */}
                            {detailModalLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                                    <svg className="animate-spin h-7 w-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <p className="text-xs font-semibold text-slate-400">Fetching transaction details…</p>
                                </div>
                            ) : detailModalData?._error ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                    <p className="font-bold text-red-600 text-sm">Failed to load details</p>
                                    <p className="text-xs text-slate-500">{detailModalData._error}</p>
                                </div>
                            ) : detailModalData ? (
                                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                    {popupSegment === 'brokerage_engine' && (
                                        detailModalData.brokerage_engine_records?.length > 0
                                            ? detailModalData.brokerage_engine_records.map((rec, idx) => (
                                                <div key={idx} className="space-y-4">
                                                    {detailModalData.brokerage_engine_records.length > 1 && (
                                                        <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">Record #{idx + 1}</h4>
                                                    )}
                                                    <SectionedDetailView data={rec} />
                                                </div>
                                            ))
                                            : detailModalData.brokerage_engine
                                                ? <SectionedDetailView data={detailModalData.brokerage_engine} />
                                                : <p className="text-sm text-slate-400 text-center py-12">No Brokerage Engine record found</p>
                                    )}
                                    {popupSegment === 'other_income' && (
                                        detailModalData.otherincome_transactions
                                            ? Array.isArray(detailModalData.otherincome_transactions)
                                                ? detailModalData.otherincome_transactions.length > 0
                                                    ? detailModalData.otherincome_transactions.map((rec, idx) => (
                                                        <div key={idx} className="space-y-4">
                                                            {detailModalData.otherincome_transactions.length > 1 && (
                                                                <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">Record #{idx + 1}</h4>
                                                            )}
                                                            <SectionedDetailView data={rec} />
                                                        </div>
                                                    ))
                                                    : <p className="text-sm text-slate-400 text-center py-12">No Other Income record found</p>
                                                : <SectionedDetailView data={detailModalData.otherincome_transactions} />
                                            : <p className="text-sm text-slate-400 text-center py-12">No Other Income record found</p>
                                    )}
                                    {popupSegment === 'skyslope' && (
                                        detailModalData.skyslope && detailModalData.skyslope.match !== false
                                            ? <SectionedDetailView data={detailModalData.skyslope} />
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
        </div>
    );
}

// ── Listing View Component ─────────────────────────────────────────────────────

function AccountHoldList({ qbStatus, realmId, handleConnectQuickBooks }) {
    const [agents, setAgents] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [size] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [filterAccountHold, setFilterAccountHold] = useState(false);
    const [filterArBalance, setFilterArBalance] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(true);

    // Fetch static summary metrics (unaffected by filters)
    useEffect(() => {
        fetch('https://roa-data-backend.vercel.app/account-hold/summary')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                return res.json();
            })
            .then(resData => {
                const dataObj = resData?.data || resData;
                setSummaryData(dataObj);
            })
            .catch(() => setSummaryData(null))
            .finally(() => setSummaryLoading(false));
    }, []);

    // Debounce search query to avoid calling API on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setPage(1); // Reset page to 1 on search change
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch listing data
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('size', String(size));
        if (debouncedSearchQuery.trim()) {
            params.append('search', debouncedSearchQuery.trim());
        }
        if (filterAccountHold) params.append('account_hold', 'true');
        if (filterArBalance) params.append('ar_balance', 'true');

        fetch(`https://roa-data-backend.vercel.app/account-hold?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (isMounted) {
                    setAgents(data.data || []);
                    setTotalCount(data.total_count || 0);
                    setTotalPages(data.total_pages || 1);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [page, size, debouncedSearchQuery, filterAccountHold, filterArBalance]);

    const renderStatusBadge = () => {
        if (qbStatus === 'loading') return (
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold gap-1.5 text-slate-400 bg-slate-50 border-slate-200">
                <svg className="animate-spin h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking connection...
            </Badge>
        );
        if (qbStatus === 'connected') return (
            <Badge variant="success" className="px-2.5 py-1 text-xs font-semibold gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected to QuickBooks {realmId ? `(Realm: ${realmId})` : ''}
            </Badge>
        );
        if (qbStatus === 'error') return (
            <Badge variant="destructive" className="px-2.5 py-1 text-xs font-semibold gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                QuickBooks Connection Failed
            </Badge>
        );
        return (
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold gap-1.5 text-slate-505 bg-slate-100 border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                QuickBooks Disconnected
            </Badge>
        );
    };

    const metrics = summaryData?.data || summaryData;

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Hold</h1>
                        {renderStatusBadge()}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        Agents with active account holds, outstanding AR balances, and flagged transactions.
                    </p>
                </div>
                <Button
                    id="account-hold-qb-btn"
                    onClick={handleConnectQuickBooks}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-sm transition-all"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect to QuickBooks
                </Button>
            </div>

            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Agents */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xs px-5 py-4 flex items-center gap-4 hover:border-slate-300 transition-all select-none">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Agents</span>
                        {summaryLoading ? (
                            <div className="h-7 w-20 bg-slate-100 rounded animate-pulse mt-1" />
                        ) : (
                            <div className="text-2xl font-bold text-slate-800 mt-0.5">
                                {(metrics?.total_agents ?? 0).toLocaleString()}
                            </div>
                        )}
                    </div>
                </div>

                {/* AR Balance */}
                <div className="rounded-2xl border border-amber-100 bg-amber-50/40 shadow-xs px-5 py-4 flex items-center gap-4 hover:border-amber-200 transition-all select-none">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Agents with AR Balance</span>
                        {summaryLoading ? (
                            <div className="h-7 w-16 bg-amber-100 rounded animate-pulse mt-1" />
                        ) : (
                            <div className="text-2xl font-bold text-amber-700 mt-0.5">
                                {(metrics?.agents_with_ar_balance ?? 0).toLocaleString()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Account Hold */}
                <div className="rounded-2xl border border-red-100 bg-red-50/40 shadow-xs px-5 py-4 flex items-center gap-4 hover:border-red-200 transition-all select-none">
                    <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Agents with Account Hold</span>
                        {summaryLoading ? (
                            <div className="h-7 w-10 bg-red-100 rounded animate-pulse mt-1" />
                        ) : (
                            <div className="text-2xl font-bold text-red-600 mt-0.5">
                                {(metrics?.agents_with_account_hold ?? 0).toLocaleString()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Flag Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter by flag:</span>
                <button
                    id="filter-account-hold"
                    onClick={() => { setFilterAccountHold(v => !v); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none ${
                        filterAccountHold
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                    }`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${filterAccountHold ? 'bg-white' : 'bg-red-400'}`} />
                    Account Hold
                </button>
                <button
                    id="filter-ar-balance"
                    onClick={() => { setFilterArBalance(v => !v); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none ${
                        filterArBalance
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                    }`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${filterArBalance ? 'bg-white' : 'bg-amber-400'}`} />
                    AR Balance
                </button>
                {(filterAccountHold || filterArBalance) && (
                    <button
                        onClick={() => { setFilterAccountHold(false); setFilterArBalance(false); setPage(1); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                    >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear
                    </button>
                )}
            </div>

            {/* Search and Clear Filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        id="account-hold-search"
                        type="text"
                        placeholder="Search agents by name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                </div>
                {searchQuery && (
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSearchQuery('');
                            setPage(1);
                        }}
                        className="px-4 py-2 text-xs font-semibold h-[42px] border-slate-200 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 transition-all rounded-xl shadow-xs shrink-0"
                    >
                        Clear Filter
                    </Button>
                )}
            </div>

            {/* Loading skeleton — table-shaped rows */}
            {loading && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="h-10 bg-slate-50 border-b border-slate-200" />
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 animate-pulse">
                            <div className="h-3 bg-slate-100 rounded w-36" />
                            <div className="h-3 bg-slate-100 rounded w-52" />
                            <div className="h-4 w-20 bg-slate-100 rounded-full" />
                            <div className="h-3 bg-slate-100 rounded w-16 ml-auto" />
                            <div className="h-3 bg-slate-100 rounded w-10" />
                            <div className="h-7 w-20 bg-slate-100 rounded-lg" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-white rounded-2xl border border-slate-200">
                    <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
                        <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h3 className="text-base font-semibold text-slate-700">Failed to load data</h3>
                        <p className="text-sm text-slate-400 mt-1">{error}</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && agents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white rounded-2xl border border-slate-200">
                    <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
                        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">No agents found</p>
                    <p className="text-xs text-slate-400">Try adjusting your search query.</p>
                </div>
            )}

            {/* Table */}
            {!loading && !error && agents.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-[25%]">
                                    Agent
                                </th>
                                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-505 uppercase tracking-wider w-[30%]">
                                    Email
                                </th>
                                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Broker Flags
                                </th>
                                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Transaction Flags
                                </th>
                                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-[90px]">
                                    Txns
                                </th>
                                <th className="text-center px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-[110px]">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {agents.map((agent, idx) => {
                                const txnCount = agent.transaction_count || 0;
                                return (
                                    <tr key={agent.customer_id ?? idx} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                                            {agent.display_name}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                                            {agent.primary_emailaddress}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-wrap gap-1">
                                                {agent.broker_flags?.length > 0 ? (
                                                    agent.broker_flags.map(f => <FlagChip key={f} flag={f} />)
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-wrap gap-1">
                                                {agent.transaction_flags?.length > 0 ? (
                                                    agent.transaction_flags.map(f => <FlagChip key={f} flag={f} />)
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                                                {txnCount}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button
                                                id={`account-hold-details-${agent.customer_id}`}
                                                onClick={() => {
                                                    window.location.hash = `pre_cda/detail/${agent.customer_id}`;
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white border-blue-200 hover:border-blue-600 shadow-2xs"
                                            >
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination bar */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-105 bg-slate-50/20 flex items-center justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 select-none font-semibold text-xs text-slate-600"
                            >
                                Previous
                            </Button>
                            <span className="text-xs font-semibold text-slate-500 select-none">
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
                </div>
            )}
        </div>
    );
}

// ── Main Page Router ───────────────────────────────────────────────────────────

function AccountHold() {
    const [qbStatus, setQbStatus] = useState('loading');
    const [realmId, setRealmId] = useState(null);

    // QuickBooks token status
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('quickbooks');
        const realm = urlParams.get('realm_id');

        if (status) {
            setQbStatus(status);
            setRealmId(realm);
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState(null, '', cleanUrl);
        } else {
            fetch('https://roa-data-backend.vercel.app/auth/quickbooks/token-status')
                .then(res => res.json())
                .then(data => {
                    if (data && data.connected) {
                        setQbStatus('connected');
                        setRealmId(data.realm_id || data.realmId);
                    } else {
                        setQbStatus('disconnected');
                    }
                })
                .catch(() => setQbStatus('error'));
        }
    }, []);

    const handleConnectQuickBooks = () => {
        window.location.href = 'https://roa-data-backend.vercel.app/auth/quickbooks/login';
    };

    // Sub-routing state parsed from hash
    const parseHashRoute = () => {
        const hash = window.location.hash.replace('#', '');
        const parts = hash.split('/');
        // Format matches: pre_cda/detail/<customer_id>
        if (parts[0] === 'pre_cda' && parts[1] === 'detail' && parts[2]) {
            return { view: 'detail', customerId: parts[2] };
        }
        return { view: 'list', customerId: null };
    };

    const [route, setRoute] = useState(parseHashRoute());

    useEffect(() => {
        const handleHashChange = () => {
            setRoute(parseHashRoute());
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    return (
        <>
            <div style={{ display: route.view === 'list' ? 'block' : 'none' }}>
                <AccountHoldList
                    qbStatus={qbStatus}
                    realmId={realmId}
                    handleConnectQuickBooks={handleConnectQuickBooks}
                />
            </div>
            {route.view === 'detail' && (
                <AccountHoldDetail
                    customerId={route.customerId}
                    qbStatus={qbStatus}
                    realmId={realmId}
                    handleConnectQuickBooks={handleConnectQuickBooks}
                />
            )}
        </>
    );
}

export default AccountHold;
