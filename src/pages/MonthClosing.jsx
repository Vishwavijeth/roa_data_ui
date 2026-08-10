import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SectionedDetailView from '../components/shared/SectionedDetailView';
import { formatDateUS } from '../utils/helpers';
import DateFilterInput from '../components/shared/DateFilterInput';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { API_DOMAIN } from '../constants';

const fmtCurrency = v => (v != null ? `$${Number(v).toLocaleString()}` : '—');
const fmtVal = v => (v != null && v !== '' ? String(v) : '—');

const checkHasMismatch = (row) => {
    if (!row) return false;
    // Strictly check backend comparison fields for explicit 'mismatch'
    return (
        row.closed_date_comparison === 'mismatch' ||
        row.sale_price_comparison === 'mismatch' ||
        row.contract_date_comparison === 'mismatch' ||
        row.transaction_status_comparison === 'mismatch' ||
        row.gross_commission_comparison === 'mismatch' ||
        row.listing_price_comparison === 'mismatch' ||
        row.buyer_name_comparison === 'mismatch' ||
        row.seller_name_comparison === 'mismatch'
    );
};

// ── Column Definitions ───────────────────────────────────────────────────────
const COLUMNS = [
    {
        id: 'skyslope',
        label: 'SkySlope',
        color: 'text-indigo-600',
        borderColor: 'border-indigo-200/60',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/30',
        gradientClass: 'from-indigo-50/20 to-indigo-50/5',
        apiQuery: 'skyslope=true',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
    },
    {
        id: 'pending',
        label: 'Pending',
        color: 'text-amber-500',
        borderColor: 'border-amber-200/60',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/30',
        gradientClass: 'from-amber-50/20 to-amber-50/5',
        apiQuery: 'status=pending',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        id: 'closed',
        label: 'Closed',
        color: 'text-emerald-500',
        borderColor: 'border-emerald-200/60',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/30',
        gradientClass: 'from-emerald-50/20 to-emerald-50/5',
        apiQuery: 'status=closed',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        id: 'cancelled',
        label: 'Cancelled',
        color: 'text-red-500',
        borderColor: 'border-red-200/60',
        badgeColor: 'bg-red-50 text-red-700 border-red-200/30',
        gradientClass: 'from-red-50/20 to-red-50/5',
        apiQuery: 'status=cancelled',
        icon: (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

// ── SkySlope Detail Modal ────────────────────────────────────────────────────
function SkySlopeDetailModal({ fileId, row, onClose }) {
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('skyslope');

    useEffect(() => {
        setLoading(true);
        setError(null);
        setDetailData(null);
        fetch(`${API_DOMAIN}/skyslope/detail?saleguid=${fileId}`)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(json => { setDetailData(json); setLoading(false); })
            .catch(err => {
                console.warn("Backend detail fetch crashed/failed, falling back to local card row data:", err);
                if (row) {
                    const fallbackSkySlope = {
                        saleguid: row.skyslopefileid || fileId,
                        propertyaddress: row.property_address,
                        buyer_name: row.ss_buyer_name,
                        seller_name: row.ss_seller_name,
                        close_date: row.ss_closed_date,
                        contract_date: row.ss_contract_date,
                        sale_price: row.ss_sale_price,
                        listing_price: row.ss_listing_price,
                        gross_commission: row.ss_gross_commission,
                        transaction_status: row.ss_transaction_status,
                        state: row.state
                    };

                    setDetailData({
                        skyslope: fallbackSkySlope,
                        brokerage_engine_records: [],
                        otherincome_transactions: []
                    });
                    setLoading(false);
                } else {
                    setError(err.message);
                    setLoading(false);
                }
            });
    }, [fileId, row]);

    return (
        <Dialog open={true} onOpenChange={onClose} size="4xl">
            <DialogHeader className="border-b border-slate-100 pb-2 flex flex-row items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <DialogTitle>SkySlope Transaction Detail</DialogTitle>
                        {!loading && detailData && (() => {
                            const hasBE = detailData.brokerage_engine_records && detailData.brokerage_engine_records.length > 0;
                            const hasOI = detailData.otherincome_transactions && detailData.otherincome_transactions.length > 0;
                            if (hasBE && hasOI) {
                                return (
                                    <Badge variant="success" className="gap-1 px-2 py-0.5 font-bold text-[9px] uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Both have data
                                    </Badge>
                                );
                            } else if (hasBE || hasOI) {
                                const typeName = hasBE ? 'Brokerage Engine' : 'Other Income';
                                return (
                                    <Badge variant="success" className="gap-1 px-2 py-0.5 font-bold text-[9px] uppercase rounded bg-blue-50 text-blue-700 border border-blue-200">
                                        Only one has data ({typeName})
                                    </Badge>
                                );
                            } else {
                                return (
                                    <Badge variant="destructive" className="gap-1 px-2 py-0.5 font-bold text-[9px] uppercase rounded bg-rose-50 text-rose-700 border border-rose-200">
                                        No related Backend data
                                    </Badge>
                                );
                            }
                        })()}
                    </div>
                </div>
            </DialogHeader>
            <DialogContent className="p-0">
                <Tabs className="w-full">
                    <TabsList className="w-full rounded-none border-b border-slate-100 bg-slate-50/50 p-0 flex h-11">
                        <TabsTrigger
                            active={tab === 'skyslope'}
                            onClick={() => setTab('skyslope')}
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                        >
                            SkySlope Details
                        </TabsTrigger>
                        <TabsTrigger
                            active={tab === 'brokerage_engine'}
                            onClick={() => setTab('brokerage_engine')}
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                        >
                            Brokerage Engine Record
                        </TabsTrigger>
                        {detailData && detailData.otherincome_transactions && detailData.otherincome_transactions.length > 0 && (
                            <TabsTrigger
                                active={tab === 'other_income'}
                                onClick={() => setTab('other_income')}
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                            >
                                Related Other Income Record
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <div className="p-4 max-h-[76vh] overflow-y-auto custom-scrollbar min-h-[200px]">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center space-y-3">
                                <svg className="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="text-xs font-semibold text-slate-400">Fetching transaction details…</span>
                            </div>
                        ) : error ? (
                            <div className="p-8 text-center max-w-sm mx-auto bg-red-50/30 border border-red-100 rounded-xl space-y-1">
                                <p className="font-bold text-red-600 text-sm">Failed to load details</p>
                                <p className="text-xs text-slate-500">{error}</p>
                            </div>
                        ) : detailData ? (
                            <div className="w-full">
                                <TabsContent active={tab === 'skyslope'} className="w-full">
                                    {detailData.skyslope ? (
                                        <SectionedDetailView data={(() => {
                                            const filtered = { ...detailData.skyslope };
                                            delete filtered.transaction_specialist;
                                            delete filtered.specialist;
                                            delete filtered.reviewer;
                                            delete filtered.reviewer_name;
                                            return filtered;
                                        })()} />
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 text-sm font-medium">No SkySlope details found.</div>
                                    )}
                                </TabsContent>
                                <TabsContent active={tab === 'brokerage_engine'} className="w-full">
                                    {detailData.brokerage_engine_records && detailData.brokerage_engine_records.length > 0 ? (
                                        detailData.brokerage_engine_records.map((beRecord, idx) => (
                                            <div key={idx} className="space-y-4">
                                                {detailData.brokerage_engine_records.length > 1 && (
                                                    <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">
                                                        Record #{idx + 1} ({beRecord.record_role || 'Brokerage Engine'})
                                                    </h4>
                                                )}
                                                <SectionedDetailView data={beRecord} />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 text-sm font-medium">No related Brokerage Engine record found.</div>
                                    )}
                                </TabsContent>
                                <TabsContent active={tab === 'other_income'} className="w-full">
                                    {detailData.otherincome_transactions && detailData.otherincome_transactions.length > 0 ? (
                                        detailData.otherincome_transactions.map((oiRecord, idx) => (
                                            <div key={idx} className="space-y-4">
                                                {detailData.otherincome_transactions.length > 1 && (
                                                    <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">
                                                        Record #{idx + 1} ({oiRecord.record_role || 'Other Income'})
                                                    </h4>
                                                )}
                                                <SectionedDetailView data={oiRecord} />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 text-sm font-medium">No related Other Income record found.</div>
                                    )}
                                </TabsContent>
                            </div>
                        ) : null}
                    </div>
                </Tabs>
            </DialogContent>
            <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/30">
                <Button onClick={onClose} className="h-9 font-semibold text-xs select-none">
                    Close Details
                </Button>
            </DialogFooter>
        </Dialog>
    );
}

// ── Brokerage Detail Modal ──────────────────────────────────────────────────
function BrokerageDetailModal({ transactionId, row, onClose }) {
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('brokerage_engine'); // 'brokerage_engine' | 'skyslope'

    useEffect(() => {
        setLoading(true);
        setError(null);
        setDetailData(null);
        fetch(`${API_DOMAIN}/brokerage_engine/detail?transactionid=${transactionId}`)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(json => { setDetailData(json); setLoading(false); })
            .catch(err => {
                console.warn("Backend brokerage detail fetch failed, falling back to local card row data:", err);
                if (row) {
                    const fallbackBE = {
                        transactionid: row.transaction_id || row.id || transactionId,
                        property_address: row.property_address,
                        buyer_name: row.be_buyer_name,
                        seller_name: row.be_seller_name,
                        closed_date: row.be_closed_date,
                        contract_date: row.be_contract_date,
                        sale_price: row.be_sale_price,
                        listing_price: row.be_listing_price,
                        gross_commission: row.be_gross_commission,
                        transaction_status: row.be_transaction_status,
                        state: row.state,
                        transaction_specialist: row.transaction_specialist
                    };

                    const fallbackSkySlope = {
                        saleguid: row.skyslopefileid,
                        propertyaddress: row.property_address,
                        buyer_name: row.ss_buyer_name,
                        seller_name: row.ss_seller_name,
                        close_date: row.ss_closed_date,
                        contract_date: row.ss_contract_date,
                        sale_price: row.ss_sale_price,
                        listing_price: row.ss_listing_price,
                        gross_commission: row.ss_gross_commission,
                        transaction_status: row.ss_transaction_status,
                        state: row.state
                    };

                    setDetailData({
                        brokerage_engine: fallbackBE,
                        skyslope: row.skyslopefileid ? fallbackSkySlope : null
                    });
                    setLoading(false);
                } else {
                    setError(err.message);
                    setLoading(false);
                }
            });
    }, [transactionId, row]);

    return (
        <Dialog open={true} onOpenChange={onClose} size="4xl">
            <DialogHeader className="border-b border-slate-100 pb-2 flex flex-row items-center justify-between">
                <div>
                    <DialogTitle>Brokerage Engine Transaction Detail</DialogTitle>
                </div>
            </DialogHeader>
            <DialogContent className="p-0">
                <Tabs className="w-full">
                    <TabsList className="w-full rounded-none border-b border-slate-100 bg-slate-50/50 p-0 flex h-11">
                        <TabsTrigger
                            active={tab === 'brokerage_engine'}
                            onClick={() => setTab('brokerage_engine')}
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                        >
                            Brokerage Engine Record
                        </TabsTrigger>
                        <TabsTrigger
                            active={tab === 'skyslope'}
                            onClick={() => setTab('skyslope')}
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                        >
                            Related SkySlope Record
                        </TabsTrigger>
                    </TabsList>

                    <div className="p-4 max-h-[76vh] overflow-y-auto custom-scrollbar min-h-[200px]">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center space-y-3">
                                <svg className="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="text-xs font-semibold text-slate-400">Fetching transaction details…</span>
                            </div>
                        ) : error ? (
                            <div className="p-8 text-center max-w-sm mx-auto bg-red-50/30 border border-red-100 rounded-xl space-y-1">
                                <p className="font-bold text-red-600 text-sm">Failed to load details</p>
                                <p className="text-xs text-slate-500">{error}</p>
                            </div>
                        ) : detailData ? (
                            <div className="w-full">
                                <TabsContent active={tab === 'brokerage_engine'} className="w-full">
                                    {detailData.brokerage_engine ? (
                                        <SectionedDetailView data={detailData.brokerage_engine} />
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 text-sm font-medium">No Brokerage Engine details found.</div>
                                    )}
                                </TabsContent>
                                <TabsContent active={tab === 'skyslope'} className="w-full">
                                    {detailData.skyslope && detailData.skyslope.match !== false ? (
                                        <SectionedDetailView data={(() => {
                                            const filtered = { ...detailData.skyslope };
                                            delete filtered.transaction_specialist;
                                            delete filtered.specialist;
                                            delete filtered.reviewer;
                                            delete filtered.reviewer_name;
                                            return filtered;
                                        })()} />
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 text-sm font-medium">No related SkySlope record found.</div>
                                    )}
                                </TabsContent>
                            </div>
                        ) : null}
                    </div>
                </Tabs>
            </DialogContent>
            <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/30">
                <Button onClick={onClose} className="h-9 font-semibold text-xs select-none">
                    Close Details
                </Button>
            </DialogFooter>
        </Dialog>
    );
}

// ── Premium Kanban Card ──────────────────────────────────────────────────────
function KanbanCard({ row, col, onCardClick }) {
    const mismatches = {
        closeDate: row.closed_date_comparison === 'mismatch',
        contractDate: row.contract_date_comparison === 'mismatch',
        salePrice: row.sale_price_comparison === 'mismatch',
        listingPrice: row.listing_price_comparison === 'mismatch',
        commission: row.gross_commission_comparison === 'mismatch',
        status: row.transaction_status_comparison === 'mismatch',
        buyerName: row.buyer_name_comparison === 'mismatch',
        sellerName: row.seller_name_comparison === 'mismatch',
    };

    const hasMismatch = Object.values(mismatches).some(Boolean);

    const mismatchItems = [];
    if (mismatches.closeDate) {
        mismatchItems.push({ label: 'Close Date', be: formatDateUS(row.be_closed_date), ss: formatDateUS(row.ss_closed_date) });
    }
    if (mismatches.contractDate) {
        mismatchItems.push({ label: 'Contract Date', be: formatDateUS(row.be_contract_date), ss: formatDateUS(row.ss_contract_date) });
    }
    if (mismatches.salePrice) {
        mismatchItems.push({ label: 'Sale Price', be: fmtCurrency(row.be_sale_price), ss: fmtCurrency(row.ss_sale_price) });
    }
    if (mismatches.listingPrice) {
        mismatchItems.push({ label: 'Listing Price', be: fmtCurrency(row.be_listing_price), ss: fmtCurrency(row.ss_listing_price) });
    }
    if (mismatches.commission) {
        mismatchItems.push({ label: 'Commission', be: fmtCurrency(row.be_gross_commission), ss: fmtCurrency(row.ss_gross_commission) });
    }
    if (mismatches.status) {
        mismatchItems.push({ label: 'Status', be: row.be_transaction_status, ss: row.ss_transaction_status });
    }
    if (mismatches.buyerName) {
        mismatchItems.push({ label: 'Buyer Name', be: row.buyer_name, ss: row.ss_buyer_name });
    }
    if (mismatches.sellerName) {
        mismatchItems.push({ label: 'Seller Name', be: row.seller_name, ss: row.ss_seller_name });
    }

    return (
        <Card
            className={`cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-l-[3.5px] overflow-hidden ${hasMismatch
                ? 'border-l-red-500 bg-red-50/10 hover:bg-red-50/20'
                : col.id === 'skyslope'
                    ? 'border-l-indigo-500'
                    : col.id === 'pending'
                        ? 'border-l-amber-500'
                        : col.id === 'closed'
                            ? 'border-l-emerald-500'
                            : 'border-l-red-500'
                }`}
            onClick={() => onCardClick(row, col.id)}
            title="Click to view transaction details"
        >
            <CardContent className="p-4 space-y-3 select-none">
                <div>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight" title={row.property_address}>
                        {row.property_address || '—'}
                    </h4>
                    {row.be_stage && (
                        <div className="mt-1.5">
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                                {row.be_stage}
                            </span>
                        </div>
                    )}
                </div>

                {col.id !== 'skyslope' ? (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="opacity-60">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                sessionStorage.setItem('specialist_dash_search', row.transaction_specialist || 'unassigned');
                                window.location.hash = 'txn_specialist_dash';
                            }}
                            className={`cursor-pointer transition-colors hover:underline hover:text-blue-600 ${row.transaction_specialist ? 'text-blue-500' : 'italic text-slate-400'
                                }`}
                            title={`Click to view Specialist Dashboard for ${row.transaction_specialist || 'unassigned'}`}
                        >
                            {row.transaction_specialist || 'Unassigned'}
                        </span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {row.ss_status && (
                            <div>
                                <Badge variant="secondary" className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-600 rounded">
                                    {row.ss_status}
                                </Badge>
                            </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="opacity-60">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    sessionStorage.setItem('reviewer_dash_search', row.reviewer || 'unassigned');
                                    window.location.hash = 'reviewer_dash';
                                }}
                                className={`cursor-pointer transition-colors hover:underline hover:text-blue-600 ${row.reviewer ? 'text-blue-500' : 'italic text-slate-400'
                                    }`}
                                title={`Click to view Reviewer Dashboard for ${row.reviewer || 'unassigned'}`}
                            >
                                {row.reviewer || 'Unassigned'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Mismatches lists rendering */}
                {col.id !== 'skyslope' && (
                    <div className="space-y-2 pt-1 border-t border-slate-100/50">
                        {mismatchItems.map((item, index) => (
                            <div key={index} className="p-2 rounded bg-red-50/50 border border-red-100/60 text-[10px] space-y-1">
                                <div className="font-bold text-red-600 flex items-center gap-1">
                                    ⚠️ {item.label} Mismatch
                                </div>
                                <div className="flex justify-between text-slate-500 font-semibold font-mono text-[9px]">
                                    <span>BE: {item.be || '—'}</span>
                                    <span>SS: {item.ss || '—'}</span>
                                </div>
                            </div>
                        ))}
                        {mismatchItems.length === 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50/40 border border-emerald-100/50 rounded p-2">
                                <span>✅</span>
                                <span>Matched perfectly</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
    col,
    data,
    loading,
    error,
    activeSpecialist,
    onCardClick,
    hasMore,
    loadingMore,
    onLoadMore,
    searchQuery,
    onSearchChange,
    pendingSubfilter,
    onPendingSubfilterChange,
    total
}) {
    const [search, setSearch] = useState(searchQuery || '');

    useEffect(() => {
        setSearch(searchQuery || '');
    }, [searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== (searchQuery || '')) {
                onSearchChange(search);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [search, searchQuery, onSearchChange]);

    const filtered = useMemo(() => {
        let result = data || [];
        if (col.id === 'pending' || col.id === 'closed' || col.id === 'cancelled') {
            const mismatches = [];
            const matches = [];
            for (const row of result) {
                if (checkHasMismatch(row)) {
                    mismatches.push(row);
                } else {
                    matches.push(row);
                }
            }
            return [...mismatches, ...matches];
        }
        return result;
    }, [data, col.id]);

    const mismatchesCount = useMemo(() => {
        if (!data) return 0;
        return data.filter(checkHasMismatch).length;
    }, [data]);

    const hasAnyMismatch = mismatchesCount > 0;

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50) {
            if (!loading && !loadingMore && hasMore) {
                onLoadMore();
            }
        }
    };

    return (
        <div
            className={`flex flex-col h-[70vh] min-w-[280px] sm:min-w-[300px] rounded-xl border p-4 space-y-3 bg-gradient-to-b ${hasAnyMismatch
                ? 'border-red-200/80 from-red-50/20 to-red-50/5 shadow-sm shadow-red-500/5'
                : `${col.borderColor} ${col.gradientClass}`
                }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <span className={hasAnyMismatch ? 'text-red-500' : col.color}>{col.icon}</span>
                    <span className="truncate max-w-[170px] flex items-center gap-1">
                        <span>{col.label}</span>
                        {col.id === 'pending' && pendingSubfilter.length > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200/40 font-extrabold text-[10px] rounded-full">
                                {total || 0}
                            </Badge>
                        )}
                        {col.id === 'skyslope' && (
                            <span className="text-[9px] font-normal text-slate-400 block -mt-0.5">Not in Brokerage Engine</span>
                        )}
                    </span>
                </div>
                {col.id === 'skyslope' && hasAnyMismatch && (
                    <Badge variant="destructive" className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 gap-1">
                        ⚠️ Mismatch
                    </Badge>
                )}
            </div>

            {/* Local Column Search */}
            <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                    type="text"
                    placeholder="Filter cards…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-7 h-8 text-[11px]"
                />
                {search && (
                    <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                        onClick={() => setSearch('')}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Dropdown Filter for Pending Column */}
            {col.id === 'pending' && (
                <MultiSelectDropdown
                    options={[
                        { value: 'open', label: 'Open' },
                        { value: 'commissionverified', label: 'Commission Verified' },
                        { value: 'cdasent', label: 'CDA Sent' },
                        { value: 'titlepaymentreceived', label: 'Title Payment Received' },
                    ]}
                    value={pendingSubfilter}
                    onChange={onPendingSubfilterChange}
                    placeholder="All Pending"
                    className="w-full"
                />
            )}

            {/* Scrollable Column Cards Container */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar" onScroll={handleScroll}>
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs font-medium">
                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Loading Column…</span>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center text-red-500 text-[10px] font-bold">
                        Failed to load: {error}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-[11px] font-semibold">
                        {search ? 'No matches' : 'No items'}
                    </div>
                ) : (
                    <>
                        {filtered.map((row, i) => <KanbanCard key={row.id || row.transaction_id || i} row={row} col={col} onCardClick={onCardClick} />)}
                        {loadingMore && (
                            <div className="py-2 flex items-center justify-center gap-1.5 text-slate-400 text-[10px] font-semibold">
                                <svg className="animate-spin h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Loading more…</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Multi-Select Dropdown ────────────────────────────────────────────────────
function MultiSelectDropdown({ options, value = [], onChange, placeholder, className }) {
    const normalizedOptions = options.map(opt =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggle = (optValue) => {
        if (value.includes(optValue)) {
            onChange(value.filter(v => v !== optValue));
        } else {
            onChange([...value, optValue]);
        }
    };

    const displayLabel = value.length === 0
        ? (placeholder || 'Select…')
        : value.length === 1
            ? (normalizedOptions.find(o => o.value === value[0])?.label || value[0])
            : `${value.length} selected`;

    return (
        <div ref={ref} className={`relative ${className || ''}`}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full h-9 flex items-center justify-between gap-2 px-3 rounded-md border text-xs font-medium transition-all bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${value.length > 0 ? 'border-blue-300 text-slate-800' : 'border-slate-200 text-slate-400'
                    }`}
            >
                <span className="truncate">{displayLabel}</span>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1 left-0 min-w-full w-max max-w-[240px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto custom-scrollbar">
                    {normalizedOptions.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-slate-400 italic">No options available</div>
                    ) : (
                        normalizedOptions.map(opt => (
                            <label key={opt.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={value.includes(opt.value)}
                                    onChange={() => toggle(opt.value)}
                                    className="accent-blue-600 w-3 h-3 shrink-0 cursor-pointer"
                                />
                                <span className="text-xs text-slate-700 font-medium truncate">{opt.label}</span>
                            </label>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Page Component ──────────────────────────────────────────────────────
function MonthClosing() {
    const [selectedDetail, setSelectedDetail] = useState(null);

    const handleCardClick = (row, colId) => {
        if (colId === 'skyslope') {
            setSelectedDetail({ row, type: 'skyslope' });
        } else {
            setSelectedDetail({ row, type: 'brokerage' });
        }
    };

    const [columnsState, setColumnsState] = useState({
        skyslope: { data: [], loading: true, loadingMore: false, error: null, page: 1, total: 0, hasMore: true, searchQuery: '' },
        pending: { data: [], loading: true, loadingMore: false, error: null, page: 1, total: 0, hasMore: true, searchQuery: '' },
        closed: { data: [], loading: true, loadingMore: false, error: null, page: 1, total: 0, hasMore: true, searchQuery: '' },
        cancelled: { data: [], loading: true, loadingMore: false, error: null, page: 1, total: 0, hasMore: true, searchQuery: '' }
    });

    const columnsData = useMemo(() => ({
        skyslope: columnsState.skyslope.data,
        pending: columnsState.pending.data,
        closed: columnsState.closed.data,
        cancelled: columnsState.cancelled.data,
    }), [columnsState]);

    const columnsLoading = useMemo(() => ({
        skyslope: columnsState.skyslope.loading,
        pending: columnsState.pending.loading,
        closed: columnsState.closed.loading,
        cancelled: columnsState.cancelled.loading,
    }), [columnsState]);

    const columnsError = useMemo(() => ({
        skyslope: columnsState.skyslope.error,
        pending: columnsState.pending.error,
        closed: columnsState.closed.error,
        cancelled: columnsState.cancelled.error,
    }), [columnsState]);

    const [stateOptions, setStateOptions] = useState([]);
    const [specialistOptions, setSpecialistOptions] = useState([]);
    const optionsPopulated = React.useRef(false);

    useEffect(() => {
        fetch(`${API_DOMAIN}/transaction_specialist_dashboard`)
            .then(res => res.json())
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                const specialists = new Set();
                rows.forEach(row => {
                    if (row.transaction_specialist) {
                        specialists.add(row.transaction_specialist.trim());
                    }
                });
                if (specialists.size > 0) {
                    setSpecialistOptions(Array.from(specialists).sort());
                }
            })
            .catch(err => console.error('Failed to fetch transaction specialists:', err));
    }, []);

    useEffect(() => {
        const isLoaded = !columnsLoading.skyslope && !columnsLoading.pending &&
            !columnsLoading.closed && !columnsLoading.cancelled;
        if (!isLoaded) return;

        if (optionsPopulated.current) return;

        const states = new Set();
        Object.values(columnsData).forEach(arr => {
            if (!Array.isArray(arr)) return;
            arr.forEach(row => {
                if (row.state) states.add(row.state.trim().toUpperCase());
            });
        });

        if (states.size > 0) setStateOptions(Array.from(states).sort());
        optionsPopulated.current = true;
    }, [columnsData, columnsLoading]);

    const [draftFrom, setDraftFrom] = useState(() => sessionStorage.getItem('mc_draftFrom') || '');
    const [draftTo, setDraftTo] = useState(() => sessionStorage.getItem('mc_draftTo') || '');
    const [draftState, setDraftState] = useState(() => { try { return JSON.parse(sessionStorage.getItem('mc_draftState') || '[]'); } catch { return []; } });
    const [draftSpecialist, setDraftSpecialist] = useState(() => { try { return JSON.parse(sessionStorage.getItem('mc_draftSpecialist') || '[]'); } catch { return []; } });
    const [draftMismatch, setDraftMismatch] = useState(() => sessionStorage.getItem('mc_draftMismatch') === 'true');

    const [activeFrom, setActiveFrom] = useState(() => sessionStorage.getItem('mc_activeFrom') || '');
    const [activeTo, setActiveTo] = useState(() => sessionStorage.getItem('mc_activeTo') || '');
    const [activeState, setActiveState] = useState(() => { try { return JSON.parse(sessionStorage.getItem('mc_activeState') || '[]'); } catch { return []; } });
    const [activeSpecialist, setActiveSpecialist] = useState(() => { try { return JSON.parse(sessionStorage.getItem('mc_activeSpecialist') || '[]'); } catch { return []; } });
    const [activeMismatch, setActiveMismatch] = useState(() => sessionStorage.getItem('mc_activeMismatch') === 'true');
    const [pendingSubfilter, setPendingSubfilter] = useState(() => { try { return JSON.parse(sessionStorage.getItem('mc_pendingSubfilter') || '[]'); } catch { return []; } });
    const [unfilteredPendingCount, setUnfilteredPendingCount] = useState(0);
    const [downloading, setDownloading] = useState(false);

    // Captures the pending total on first successful load — never changes after that
    const staticPendingCountRef = useRef(null);

    // Keep a ref so buildColumnUrl can read the latest pendingSubfilter without it being a reactive dep
    const pendingSubfilterRef = useRef(pendingSubfilter);
    useEffect(() => { pendingSubfilterRef.current = pendingSubfilter; }, [pendingSubfilter]);

    useEffect(() => {
        sessionStorage.setItem('mc_draftFrom', draftFrom);
        sessionStorage.setItem('mc_draftTo', draftTo);
        sessionStorage.setItem('mc_draftState', JSON.stringify(draftState));
        sessionStorage.setItem('mc_draftSpecialist', JSON.stringify(draftSpecialist));
        sessionStorage.setItem('mc_draftMismatch', String(draftMismatch));
        sessionStorage.setItem('mc_activeFrom', activeFrom);
        sessionStorage.setItem('mc_activeTo', activeTo);
        sessionStorage.setItem('mc_activeState', JSON.stringify(activeState));
        sessionStorage.setItem('mc_activeSpecialist', JSON.stringify(activeSpecialist));
        sessionStorage.setItem('mc_activeMismatch', String(activeMismatch));
        sessionStorage.setItem('mc_pendingSubfilter', JSON.stringify(pendingSubfilter));
    }, [draftFrom, draftTo, draftState, draftSpecialist, draftMismatch, activeFrom, activeTo, activeState, activeSpecialist, activeMismatch, pendingSubfilter]);

    const searchQueriesRef = React.useRef({
        skyslope: '',
        pending: '',
        closed: '',
        cancelled: ''
    });

    const buildColumnUrl = useCallback((colQuery, pageNum, searchQuery) => {
        let url = `${API_DOMAIN}/month-closing/listing`;
        const params = [`page=${pageNum}`];
        if (colQuery) {
            params.push(colQuery);
            // Read pendingSubfilter from ref so this callback is NOT recreated when it changes
            if (colQuery === 'status=pending' && pendingSubfilterRef.current.length > 0) {
                pendingSubfilterRef.current.forEach(sf => params.push(`pending_subfilter=${encodeURIComponent(sf)}`));
            }
        }
        if (searchQuery) {
            params.push(`search=${encodeURIComponent(searchQuery)}`);
        }
        if (activeFrom) params.push(`from_close_date=${encodeURIComponent(activeFrom)}`);
        if (activeTo) params.push(`to_close_date=${encodeURIComponent(activeTo)}`);
        activeState.forEach(s => params.push(`state=${encodeURIComponent(s)}`));
        activeSpecialist.forEach(spec => {
            const specVal = spec === 'UNASSIGNED' ? 'Unassigned' : spec;
            params.push(`transaction_specialist=${encodeURIComponent(specVal)}`);
        });
        if (activeMismatch) {
            params.push('mismatch=true');
        }
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        return url;
        // NOTE: pendingSubfilter intentionally excluded — read via ref to avoid cascade re-fetches
    }, [activeFrom, activeTo, activeState, activeSpecialist, activeMismatch]);

    const fetchColumnPage = useCallback(async (colId, pageNum, isLoadMore = false, searchQuery = '') => {
        const col = COLUMNS.find(c => c.id === colId);
        if (!col) return;

        if (isLoadMore) {
            setColumnsState(prev => ({
                ...prev,
                [colId]: { ...prev[colId], loadingMore: true, error: null }
            }));
        } else {
            setColumnsState(prev => ({
                ...prev,
                [colId]: { ...prev[colId], loading: true, error: null, page: 1, data: [] }
            }));
        }

        try {
            const url = buildColumnUrl(col.apiQuery, pageNum, searchQuery);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            const fetchedData = Array.isArray(json.data) ? json.data : [];
            const total = json.total != null ? json.total : fetchedData.length;

            setColumnsState(prev => {
                const existingData = isLoadMore ? prev[colId].data : [];
                const merged = [...existingData];
                fetchedData.forEach(item => {
                    const id1 = item.id || item.transaction_id || item.skyslopefileid;
                    const exists = merged.some(m => (m.id || m.transaction_id || m.skyslopefileid) === id1);
                    if (!exists) {
                        merged.push(item);
                    }
                });

                if (colId === 'pending' && !pendingSubfilterRef.current.length) {
                    setUnfilteredPendingCount(total);
                    // Capture static count once on first unfiltered load
                    if (staticPendingCountRef.current === null) {
                        staticPendingCountRef.current = total;
                    }
                }

                return {
                    ...prev,
                    [colId]: {
                        ...prev[colId],
                        data: merged,
                        loading: false,
                        loadingMore: false,
                        error: null,
                        page: pageNum,
                        total: total,
                        hasMore: merged.length < total && fetchedData.length > 0
                    }
                };
            });

            // If colId is pending and a subfilter is active, fetch the unfiltered total count in the background!
            if (colId === 'pending' && pendingSubfilter.length > 0) {
                let unfilteredUrl = `${API_DOMAIN}/month-closing/listing?page=1&status=pending`;
                if (searchQuery) unfilteredUrl += `&search=${encodeURIComponent(searchQuery)}`;
                if (activeFrom) unfilteredUrl += `&from_close_date=${encodeURIComponent(activeFrom)}`;
                if (activeTo) unfilteredUrl += `&to_close_date=${encodeURIComponent(activeTo)}`;
                if (activeState) unfilteredUrl += `&state=${encodeURIComponent(activeState)}`;
                if (activeSpecialist) {
                    const specVal = activeSpecialist === 'UNASSIGNED' ? 'Unassigned' : activeSpecialist;
                    unfilteredUrl += `&transaction_specialist=${encodeURIComponent(specVal)}`;
                }
                if (activeMismatch) unfilteredUrl += '&mismatch=true';

                fetch(unfilteredUrl)
                    .then(res => res.json())
                    .then(json => {
                        const unfilteredTotal = json.total != null ? json.total : 0;
                        setUnfilteredPendingCount(unfilteredTotal);
                    })
                    .catch(err => console.error('Failed to fetch unfiltered pending total:', err));
            }
        } catch (e) {
            console.error(`Error fetching column ${colId} page ${pageNum}:`, e);
            setColumnsState(prev => ({
                ...prev,
                [colId]: {
                    ...prev[colId],
                    loading: false,
                    loadingMore: false,
                    error: e.message
                }
            }));
        }
    }, [buildColumnUrl, activeFrom, activeTo, activeState, activeSpecialist, activeMismatch]);

    const fetchData = useCallback(async () => {
        await Promise.all(
            COLUMNS.map(col => {
                const searchQ = searchQueriesRef.current[col.id];
                return fetchColumnPage(col.id, 1, false, searchQ);
            })
        );
    }, [fetchColumnPage]);

    // Fetch all columns when global filters change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch ONLY the pending column when pendingSubfilter changes
    const prevPendingSubfilterRef = useRef(null);
    useEffect(() => {
        // Skip on initial mount (fetchData handles that)
        if (prevPendingSubfilterRef.current === null) {
            prevPendingSubfilterRef.current = pendingSubfilter;
            return;
        }
        prevPendingSubfilterRef.current = pendingSubfilter;
        const searchQ = searchQueriesRef.current['pending'];
        fetchColumnPage('pending', 1, false, searchQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingSubfilter]);

    const handleLoadMore = useCallback((colId) => {
        const colState = columnsState[colId];
        if (colState.loading || colState.loadingMore || !colState.hasMore) return;
        fetchColumnPage(colId, colState.page + 1, true, colState.searchQuery);
    }, [columnsState, fetchColumnPage]);

    const handleSearchChange = useCallback((colId, query) => {
        searchQueriesRef.current[colId] = query;
        setColumnsState(prev => {
            const currentQ = prev[colId].searchQuery || '';
            if (currentQ === query) return prev;

            fetchColumnPage(colId, 1, false, query);

            return {
                ...prev,
                [colId]: {
                    ...prev[colId],
                    searchQuery: query
                }
            };
        });
    }, [fetchColumnPage]);

    // Mismatch toggle fires immediately — no need to hit Apply
    const handleMismatchToggle = () => {
        const next = !draftMismatch;
        setDraftMismatch(next);
        setActiveMismatch(next); // triggers re-fetch via buildColumnUrl dependency
    };

    // Apply only affects the other 4 draft filters; mismatch is already live
    const handleApply = () => {
        setActiveFrom(draftFrom);
        setActiveTo(draftTo);
        setActiveState([...draftState]);
        setActiveSpecialist([...draftSpecialist]);
    };

    const handleClear = () => {
        setDraftFrom(''); setDraftTo(''); setDraftState([]); setDraftSpecialist([]); setDraftMismatch(false);
        setActiveFrom(''); setActiveTo(''); setActiveState([]); setActiveSpecialist([]); setActiveMismatch(false);
        setPendingSubfilter([]);
        setUnfilteredPendingCount(0);

        searchQueriesRef.current = { skyslope: '', pending: '', closed: '', cancelled: '' };
        setColumnsState(prev => ({
            skyslope: { ...prev.skyslope, searchQuery: '' },
            pending: { ...prev.pending, searchQuery: '' },
            closed: { ...prev.closed, searchQuery: '' },
            cancelled: { ...prev.cancelled, searchQuery: '' }
        }));
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            let url = `${API_DOMAIN}/month-closing/download`;
            const params = [];
            
            if (activeFrom) params.push(`from_close_date=${encodeURIComponent(activeFrom)}`);
            if (activeTo) params.push(`to_close_date=${encodeURIComponent(activeTo)}`);
            activeState.forEach(s => params.push(`state=${encodeURIComponent(s)}`));
            activeSpecialist.forEach(spec => {
                const specVal = spec === 'UNASSIGNED' ? 'Unassigned' : spec;
                params.push(`transaction_specialist=${encodeURIComponent(specVal)}`);
            });
            if (activeMismatch) params.push('mismatch=true');
            if (pendingSubfilter.length > 0) {
                pendingSubfilter.forEach(sf => params.push(`pending_subfilter=${encodeURIComponent(sf)}`));
            }

            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Download API error: ${response.status}`);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;

            // Try to extract filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'ROA_Month_Closing_Report.xlsx';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Month Closing download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    const hasActive = !!(activeFrom || activeTo || activeState.length > 0 || activeSpecialist.length > 0 || activeMismatch);
    const isAnyLoading = Object.values(columnsLoading).some(Boolean);

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Month Closing</h1>
                    <p className="text-sm text-slate-500 mt-1">Mismatch breakdown across transactions. Click a card to expand details.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="shadow-lg shadow-blue-600/10 font-semibold gap-2 h-9 select-none"
                    >
                        <svg className={`h-4 w-4 ${downloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {downloading ? 'Generating Report…' : 'Download Report'}
                    </Button>
                    <Button
                        onClick={fetchData}
                        disabled={isAnyLoading}
                        className="shadow-md shadow-blue-600/10 font-semibold gap-2 h-9 select-none"
                    >
                        <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            className={isAnyLoading ? 'animate-spin' : ''}
                        >
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {isAnyLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="shadow-sm border-slate-100">
                <CardContent className="p-5 space-y-3">
                    {/* All filter controls in one aligned row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">

                        {/* Close From */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close From</label>
                            <DateFilterInput
                                value={draftFrom}
                                onChange={val => setDraftFrom(val)}
                                className="h-9 text-xs text-slate-700 w-full"
                            />
                        </div>

                        {/* Close To */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close To</label>
                            <DateFilterInput
                                value={draftTo}
                                onChange={val => setDraftTo(val)}
                                className="h-9 text-xs text-slate-700 w-full"
                            />
                        </div>

                        {/* State */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">State</label>
                            <MultiSelectDropdown
                                options={stateOptions}
                                value={draftState}
                                onChange={setDraftState}
                                placeholder="All States"
                                className="w-full"
                            />
                        </div>

                        {/* Specialist */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Specialist</label>
                            <MultiSelectDropdown
                                options={[
                                    { value: 'UNASSIGNED', label: 'Unassigned (Null)' },
                                    ...specialistOptions.map(s => ({ value: s, label: s }))
                                ]}
                                value={draftSpecialist}
                                onChange={setDraftSpecialist}
                                placeholder="All Specialists"
                                className="w-full"
                            />
                        </div>

                        {/* Mismatch toggle — same row, same height */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mismatches</label>
                            <button
                                type="button"
                                onClick={handleMismatchToggle}
                                disabled={isAnyLoading}
                                className={`h-9 inline-flex items-center gap-2 px-3 rounded-md border text-xs font-semibold transition-all select-none whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed ${draftMismatch
                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100/70'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <span className={`relative flex-shrink-0 inline-block w-7 h-4 rounded-full transition-colors duration-200 ${draftMismatch ? 'bg-red-500' : 'bg-slate-200'}`}>
                                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${draftMismatch ? 'left-3.5' : 'left-0.5'}`} />
                                </span>
                                Only Mismatches
                            </button>
                        </div>

                        {/* Clear + Apply — same row, bottom-aligned */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-transparent uppercase tracking-wider block select-none pointer-events-none">·</label>
                            <div className="flex items-center gap-2">
                                {(hasActive || draftFrom || draftTo || draftState.length > 0 || draftSpecialist.length > 0 || draftMismatch) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClear}
                                        className="h-9 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold shrink-0"
                                    >
                                        Clear
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    onClick={handleApply}
                                    disabled={isAnyLoading}
                                    className="h-9 px-4 text-xs font-semibold shrink-0"
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Active filter badges */}
                    {(activeFrom || activeTo || activeState || activeSpecialist || activeMismatch) && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100/60">
                            {activeFrom && <Badge variant="secondary" className="text-[9px] font-bold">From: {activeFrom}</Badge>}
                            {activeTo && <Badge variant="secondary" className="text-[9px] font-bold">To: {activeTo}</Badge>}
                            {activeState.map(s => <Badge key={s} variant="secondary" className="text-[9px] font-bold">State: {s}</Badge>)}
                            {activeSpecialist.map(sp => <Badge key={sp} variant="secondary" className="text-[9px] font-bold">Specialist: {sp === 'UNASSIGNED' ? 'Unassigned (Null)' : sp}</Badge>)}
                            {activeMismatch && <Badge variant="destructive" className="text-[9px] font-bold uppercase tracking-wider">⚠️ Mismatches Only</Badge>}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Kanban summary numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {COLUMNS.map(col => {
                    const count = col.id === 'pending'
                        ? (staticPendingCountRef.current ?? unfilteredPendingCount ?? columnsState[col.id].total ?? 0)
                        : (columnsState[col.id].total || 0);
                    return (
                        <Card key={col.id} className="hover:border-slate-300 transition-all select-none">
                            <CardContent className="pt-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        {col.label}
                                        {col.id === 'skyslope' && <span className="text-[8px] lowercase font-semibold block text-slate-400 leading-none mt-0.5">(not in BE)</span>}
                                    </span>
                                    <div className="text-xl font-black text-slate-800 mt-1.5">
                                        {columnsLoading[col.id] ? '…' : columnsError[col.id] ? 'Err' : count.toLocaleString()}
                                    </div>
                                </div>
                                <span className={`p-2 rounded-lg bg-slate-50 border border-slate-100 ${col.color}`}>{col.icon}</span>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Kanban Board Container */}
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar select-none items-start">
                {COLUMNS.map(col => (
                    <KanbanColumn
                        key={col.id}
                        col={col}
                        data={columnsData[col.id]}
                        loading={columnsLoading[col.id]}
                        error={columnsError[col.id]}
                        activeSpecialist={activeSpecialist}
                        onCardClick={handleCardClick}
                        hasMore={columnsState[col.id].hasMore}
                        loadingMore={columnsState[col.id].loadingMore}
                        onLoadMore={() => handleLoadMore(col.id)}
                        searchQuery={columnsState[col.id].searchQuery}
                        onSearchChange={(query) => handleSearchChange(col.id, query)}
                        pendingSubfilter={pendingSubfilter}
                        onPendingSubfilterChange={setPendingSubfilter}
                        total={columnsState[col.id].total}
                    />
                ))}
            </div>

            {/* Detail Modals */}
            {selectedDetail && selectedDetail.type === 'skyslope' && (
                <SkySlopeDetailModal
                    fileId={selectedDetail.row.skyslopefileid}
                    row={selectedDetail.row}
                    onClose={() => setSelectedDetail(null)}
                />
            )}
            {selectedDetail && selectedDetail.type === 'brokerage' && (
                <BrokerageDetailModal
                    transactionId={selectedDetail.row.transaction_id || selectedDetail.row.id}
                    row={selectedDetail.row}
                    onClose={() => setSelectedDetail(null)}
                />
            )}
        </div>
    );
}

export default MonthClosing;
