import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { formatDateUS } from '../utils/helpers';

const CDA_SENT_API = 'https://roa-data-backend.vercel.app/cda-sent/listing';
const ROWS_PER_PAGE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (val) => {
    if (val === null || val === undefined) return <span className="text-slate-400 font-bold">—</span>;
    return String(val);
};

const fmtCurrency = (val) => {
    if (val === null || val === undefined) return <span className="text-slate-400 font-bold">—</span>;
    return `$${Number(val).toLocaleString()}`;
};

const fmtDate = (val) => {
    if (!val) return <span className="text-slate-400 font-bold">—</span>;
    return formatDateUS(val);
};

// Checks whether a record has ANY field-level mismatch
const hasMismatch = (row) => {
    return (
        row.gross_commission_mismatch === 'mismatch' ||
        row.sale_price_mismatch === true ||
        row.closed_date_mismatch === true ||
        row.contract_date_mismatch === true ||
        row.transaction_status_mismatch === true ||
        (typeof row.listing_price_mismatch === 'boolean' && row.listing_price_mismatch === true) ||
        row.buyer_name_comparison === 'mismatch' ||
        row.seller_name_comparison === 'mismatch'
    );
};

// Badge for boolean mismatch fields
const MismatchBadge = ({ mismatch }) => {
    if (mismatch === true) {
        return <Badge variant="destructive" className="px-1.5 py-0.5 rounded font-semibold text-[9px] capitalize">Mismatch</Badge>;
    }
    if (mismatch === false) {
        return <Badge variant="success" className="px-1.5 py-0.5 rounded font-semibold text-[9px] capitalize">Match</Badge>;
    }
    return <span className="text-slate-400 text-[10px] font-bold">N/A</span>;
};

// Badge for comparison string fields
const CompBadge = ({ value }) => {
    if (value === 'match') return <Badge variant="success" className="px-1.5 py-0.5 rounded font-semibold text-[9px] capitalize">Match</Badge>;
    if (value === 'mismatch') return <Badge variant="destructive" className="px-1.5 py-0.5 rounded font-semibold text-[9px] capitalize">Mismatch</Badge>;
    return <span className="text-slate-400 text-[10px] font-bold">N/A</span>;
};



function CdaSent() {
    const [filter, setFilter] = useState('all'); // 'all' | 'mismatch' | 'no_skyslope'
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState({ total_cda_sent: 0, unmatched_count: 0, no_skyslope_record: 0, match_percentage: 0 });
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const url = filter === 'all'
                ? 'https://roa-data-backend.vercel.app/cda-sent/download'
                : `https://roa-data-backend.vercel.app/cda-sent/download?filter=${filter}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Download API error: ${response.status}`);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;

            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'ROA_CDA_Sent_Report.xlsx';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) filename = filenameMatch[1];
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { a.remove(); window.URL.revokeObjectURL(downloadUrl); }, 200);
        } catch (err) {
            console.error('CDA Sent download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    // Fetch whenever filter or page changes
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', ROWS_PER_PAGE);
        if (filter !== 'all') params.append('filter', filter);
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        fetch(`${CDA_SENT_API}?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                setData(Array.isArray(json.data) ? json.data : []);
                setSummary(json.summary ?? { total_cda_sent: 0, unmatched_count: 0, no_skyslope_record: 0, match_percentage: 0 });
                setTotalPages(json.total_pages ?? 0);
                setLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err.message);
                setLoading(false);
            });

        return () => { active = false; };
    }, [filter, page, searchQuery]);

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">CDA Sent</h1>
                    <p className="text-sm text-slate-500 mt-1">Review CDA-sent transactions and highlight data mismatches between Brokerage Engine and SkySlope.</p>
                </div>
                <Button
                    id="cda-download-btn"
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
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total CDA Sent</span>
                        <div className="text-2xl font-bold text-slate-800 mt-2">
                            {(summary.total_cda_sent ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-red-200 hover:bg-red-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Unmatched Transactions</span>
                        <div className="text-2xl font-bold text-red-600 mt-2">
                            {(summary.unmatched_count ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-emerald-200 hover:bg-emerald-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Match Rate</span>
                        <div className="text-2xl font-bold text-emerald-600 mt-2">
                            {summary.match_percentage != null ? `${Number(summary.match_percentage).toFixed(1)}%` : '—'}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-amber-200 hover:bg-amber-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">No SkySlope File ID</span>
                        <div className="text-2xl font-bold text-amber-600 mt-2">
                            {(summary.no_skyslope_record ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-md font-bold text-slate-800">Transactions</h2>

                        {/* Mismatches Filter Toggle */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                            <button
                                id="cda-filter-mismatch"
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filter === 'mismatch'
                                        ? 'bg-red-50 text-red-700'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                onClick={() => {
                                    setFilter(f => f === 'mismatch' ? 'all' : 'mismatch');
                                    setSearchQuery('');
                                    setPage(1);
                                }}
                            >
                                Mismatches Only
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-500 border-l border-slate-200">
                                {summary.unmatched_count ?? 0}
                            </span>
                        </div>

                        {/* No SkySlope Filter Toggle */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                            <button
                                id="cda-filter-no-skyslope"
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filter === 'no_skyslope'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                onClick={() => {
                                    setFilter(f => f === 'no_skyslope' ? 'all' : 'no_skyslope');
                                    setSearchQuery('');
                                    setPage(1);
                                }}
                            >
                                No SkySlope File ID
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-500 border-l border-slate-200">
                                {summary.no_skyslope_record ?? 0}
                            </span>
                        </div>

                        {(filter !== 'all' || searchQuery) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setFilter('all'); setSearchQuery(''); setPage(1); }}
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                ✕ Clear Filters
                            </Button>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                        Showing page {page} of {totalPages || 1} ({(summary.total_cda_sent ?? 0).toLocaleString()} records)
                    </span>
                </div>

                {/* Search input */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center">
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="cda-search"
                            type="text"
                            placeholder="Search by Transaction ID or Property Address…"
                            value={searchQuery}
                            onChange={e => { setPage(1); setSearchQuery(e.target.value); }}
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

                {/* Main Content */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading CDA Sent data…</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center max-w-sm mx-auto space-y-2">
                        <div className="text-3xl">⚠️</div>
                        <h3 className="text-sm font-bold text-red-600">Failed to load data</h3>
                        <p className="text-xs text-slate-500">{error}</p>
                    </div>
                ) : (
                    <>
                        <Table style={{ fontSize: '0.75rem' }}>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[130px] font-bold">Transaction ID</TableHead>
                                    <TableHead className="min-w-[220px] font-bold">Property Address</TableHead>
                                    <TableHead className="min-w-[160px] font-bold">Tags</TableHead>
                                    <TableHead className="font-semibold">BE Gross Commission</TableHead>
                                    <TableHead className="font-semibold">SS Gross Commission</TableHead>
                                    <TableHead className="font-semibold">Gross Commission</TableHead>
                                    <TableHead className="font-semibold">BE Closed</TableHead>
                                    <TableHead className="font-semibold">SS Closed</TableHead>
                                    <TableHead className="font-semibold">Closed Date</TableHead>
                                    <TableHead className="font-semibold">BE Sale Price</TableHead>
                                    <TableHead className="font-semibold">SS Sale Price</TableHead>
                                    <TableHead className="font-semibold">Sale Price</TableHead>
                                    <TableHead className="font-semibold">BE Status</TableHead>
                                    <TableHead className="font-semibold">SS Status</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold">BE Contract</TableHead>
                                    <TableHead className="font-semibold">SS Contract</TableHead>
                                    <TableHead className="font-semibold">Contract Date</TableHead>
                                    <TableHead className="font-semibold">BE Listing Price</TableHead>
                                    <TableHead className="font-semibold">SS Listing Price</TableHead>
                                    <TableHead className="font-semibold">Listing Price</TableHead>
                                    <TableHead className="font-semibold">BE Buyer</TableHead>
                                    <TableHead className="font-semibold">SS Buyer</TableHead>
                                    <TableHead className="font-semibold">Buyer</TableHead>
                                    <TableHead className="font-semibold">BE Seller</TableHead>
                                    <TableHead className="font-semibold">SS Seller</TableHead>
                                    <TableHead className="font-semibold">Seller</TableHead>
                                    <TableHead className="font-semibold text-right pr-6">Stale?</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, i) => {
                                    const rowHasMismatch = hasMismatch(row);
                                    return (
                                        <TableRow
                                            key={row.transaction_id || i}
                                            className={
                                                rowHasMismatch
                                                    ? 'bg-red-50/30 hover:bg-red-50/50 transition-colors'
                                                    : 'hover:bg-slate-50/40'
                                            }
                                        >
                                            {/* Transaction ID */}
                                            <TableCell className="font-mono text-[10px] text-slate-500 shrink-0" title={row.transaction_id}>
                                                {row.transaction_id ? `${row.transaction_id.slice(0, 18)}…` : '—'}
                                            </TableCell>

                                            {/* Property Address */}
                                            <TableCell className="font-medium text-slate-800 text-xs truncate max-w-xs">{row.property_address || '—'}</TableCell>

                                            {/* Tags */}
                                            <TableCell className="max-w-[200px] shrink-0">
                                                {row.tags ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.tags.split(',').map(t => t.trim()).map((tag, ti) => (
                                                            <Badge key={ti} variant="secondary" className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/30">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">—</span>
                                                )}
                                            </TableCell>

                                            {/* Gross Commission */}
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.be_gross_commission)}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.ss_gross_commission)}</TableCell>
                                            <TableCell><CompBadge value={row.gross_commission_mismatch} /></TableCell>

                                            {/* Closed Date */}
                                            <TableCell className="text-xs text-slate-500 font-medium">{fmtDate(row.be_closed_date)}</TableCell>
                                            <TableCell className="text-xs text-slate-500 font-medium">{fmtDate(row.ss_closed_date)}</TableCell>
                                            <TableCell><MismatchBadge mismatch={row.closed_date_mismatch} /></TableCell>

                                            {/* Sale Price */}
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.be_sale_price)}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.ss_sale_price)}</TableCell>
                                            <TableCell><MismatchBadge mismatch={row.sale_price_mismatch} /></TableCell>

                                            {/* Transaction Status */}
                                            <TableCell className="text-xs text-slate-600 font-medium">{fmt(row.be_transaction_status)}</TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">{fmt(row.ss_transaction_status)}</TableCell>
                                            <TableCell><MismatchBadge mismatch={row.transaction_status_mismatch} /></TableCell>

                                            {/* Contract Date */}
                                            <TableCell className="text-xs text-slate-500 font-medium">{fmtDate(row.be_contract_date)}</TableCell>
                                            <TableCell className="text-xs text-slate-500 font-medium">{fmtDate(row.ss_contract_date)}</TableCell>
                                            <TableCell><MismatchBadge mismatch={row.contract_date_mismatch} /></TableCell>

                                            {/* Listing Price */}
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.be_listing_price)}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.ss_listing_price)}</TableCell>
                                            <TableCell><CompBadge value={row.listing_price_mismatch} /></TableCell>

                                            {/* Buyer */}
                                            <TableCell className="text-xs text-slate-600 max-w-[160px] truncate">{fmt(row.be_buyer_name)}</TableCell>
                                            <TableCell className="text-xs text-slate-600 max-w-[160px] truncate">{fmt(row.ss_buyer_name)}</TableCell>
                                            <TableCell><CompBadge value={row.buyer_name_comparison} /></TableCell>

                                            {/* Seller */}
                                            <TableCell className="text-xs text-slate-600 max-w-[160px] truncate">{fmt(row.be_seller_name)}</TableCell>
                                            <TableCell className="text-xs text-slate-600 max-w-[160px] truncate">{fmt(row.ss_seller_name)}</TableCell>
                                            <TableCell><CompBadge value={row.seller_name_comparison} /></TableCell>

                                            {/* Stale */}
                                            <TableCell className="text-right pr-6 shrink-0 select-none">
                                                {row.is_stale ? (
                                                    <Badge variant="destructive" className="px-1.5 py-0.5 rounded font-semibold text-[9px] capitalize">Stale</Badge>
                                                ) : (
                                                    <Badge variant="success" className="px-1.5 py-0.5 rounded font-semibold text-[9px] capitalize">Fresh</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {data.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={28} className="text-center text-slate-400 py-10 font-medium">
                                            No records found
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

export default CdaSent;
