import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { formatDateUS } from '../utils/helpers';

const CDA_SENT_API = 'https://roa-data-backend.vercel.app/cda-sent';
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

// Match badge for string "match" / "mismatch" / null fields
const MatchBadge = ({ value }) => {
    if (value === 'match') {
        return <Badge variant="success" className="px-1.5 py-0.5 rounded font-semibold text-[9px]">Match</Badge>;
    }
    if (value === 'mismatch') {
        return <Badge variant="destructive" className="px-1.5 py-0.5 rounded font-semibold text-[9px]">Mismatch</Badge>;
    }
    return <span className="text-slate-400 text-[10px] font-bold">N/A</span>;
};

function CdaSent() {
    const [mismatchOnly, setMismatchOnly] = useState(false);
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState({ total_count: 0, mismatch_count: 0 });
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams();
            if (mismatchOnly) params.append('mismatch', 'true');
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            const url = `https://roa-data-backend.vercel.app/cda-sent/download?${params.toString()}`;
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

    // Fetch whenever filter/page/search changes
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', ROWS_PER_PAGE);
        if (mismatchOnly) params.append('mismatch', 'true');
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        fetch(`${CDA_SENT_API}?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                setData(Array.isArray(json.data) ? json.data : []);
                setSummary(json.summary ?? { total_count: 0, mismatch_count: 0 });
                setTotalPages(json.total_pages ?? 0);
                setTotalCount(json.summary?.total_count ?? 0);
                setLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err.message);
                setLoading(false);
            });

        return () => { active = false; };
    }, [mismatchOnly, page, searchQuery]);

    const mismatchRate = summary.total_count > 0
        ? ((summary.mismatch_count / summary.total_count) * 100).toFixed(1)
        : '0.0';

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="hover:border-slate-300 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Transactions</span>
                        <div className="text-2xl font-bold text-slate-800 mt-2">
                            {(summary.total_count ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-red-200 hover:bg-red-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mismatches</span>
                        <div className="text-2xl font-bold text-red-600 mt-2">
                            {(summary.mismatch_count ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-emerald-200 hover:bg-emerald-50/5 transition-all select-none">
                    <CardContent className="pt-6">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mismatch Rate</span>
                        <div className="text-2xl font-bold text-emerald-600 mt-2">
                            {mismatchRate}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-md font-bold text-slate-800">Transactions</h2>

                        {/* Mismatch Filter Toggle */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                            <button
                                id="cda-filter-mismatch"
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mismatchOnly
                                    ? 'bg-red-50 text-red-700'
                                    : 'hover:bg-slate-50 text-slate-600'
                                }`}
                                onClick={() => {
                                    setMismatchOnly(v => !v);
                                    setSearchQuery('');
                                    setPage(1);
                                }}
                            >
                                Mismatches Only
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-500 border-l border-slate-200">
                                {summary.mismatch_count ?? 0}
                            </span>
                        </div>

                        {(mismatchOnly || searchQuery) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setMismatchOnly(false); setSearchQuery(''); setPage(1); }}
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                ✕ Clear Filters
                            </Button>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                        Showing page {page} of {totalPages || 1} ({(summary.total_count ?? 0).toLocaleString()} records)
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
                            placeholder="Search by property address…"
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
                                    {/* Property Address */}
                                    <TableHead className="min-w-[240px] font-bold">Property Address</TableHead>

                                    {/* Gross Commission group */}
                                    <TableHead className="font-semibold text-center" colSpan={3}>
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Gross Commission</span>
                                            <div className="flex gap-2 text-[10px] font-semibold text-slate-400">
                                                <span>BE</span><span>·</span><span>SS</span><span>·</span><span>Match</span>
                                            </div>
                                        </div>
                                    </TableHead>

                                    {/* Close Date group */}
                                    <TableHead className="font-semibold text-center" colSpan={3}>
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Close Date</span>
                                            <div className="flex gap-2 text-[10px] font-semibold text-slate-400">
                                                <span>BE</span><span>·</span><span>SS</span><span>·</span><span>Match</span>
                                            </div>
                                        </div>
                                    </TableHead>

                                    {/* Status group */}
                                    <TableHead className="font-semibold text-center" colSpan={3}>
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Status</span>
                                            <div className="flex gap-2 text-[10px] font-semibold text-slate-400">
                                                <span>BE</span><span>·</span><span>SS</span><span>·</span><span>Match</span>
                                            </div>
                                        </div>
                                    </TableHead>

                                    {/* Sale Price group */}
                                    <TableHead className="font-semibold text-center" colSpan={3}>
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Sale Price</span>
                                            <div className="flex gap-2 text-[10px] font-semibold text-slate-400">
                                                <span>BE</span><span>·</span><span>SS</span><span>·</span><span>Match</span>
                                            </div>
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, i) => {
                                    const hasAnyMismatch =
                                        row.gross_commission_match === 'mismatch' ||
                                        row.close_date_match === 'mismatch' ||
                                        row.status_match === 'mismatch' ||
                                        row.sale_price_match === 'mismatch';

                                    return (
                                        <TableRow
                                            key={row.transaction_id || i}
                                            className={
                                                hasAnyMismatch
                                                    ? 'bg-red-50/30 hover:bg-red-50/50 transition-colors'
                                                    : 'hover:bg-slate-50/40'
                                            }
                                        >
                                            {/* Property Address + Source Table label */}
                                            <TableCell className="max-w-xs">
                                                <div className="font-medium text-slate-800 text-xs truncate">{row.property_address || '—'}</div>
                                                {row.be_source_table && (
                                                    <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 border border-slate-200/60 rounded px-1.5 py-0.5">
                                                        {row.be_source_table}
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Gross Commission */}
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.be_gross_commission)}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.skyslope_gross_commission)}</TableCell>
                                            <TableCell><MatchBadge value={row.gross_commission_match} /></TableCell>

                                            {/* Close Date */}
                                            <TableCell className="text-xs text-slate-500 font-medium">{fmtDate(row.be_close_date)}</TableCell>
                                            <TableCell className="text-xs text-slate-500 font-medium">{fmtDate(row.skyslope_close_date_value)}</TableCell>
                                            <TableCell><MatchBadge value={row.close_date_match} /></TableCell>

                                            {/* Status */}
                                            <TableCell className="text-xs text-slate-600 font-medium">{fmt(row.be_status)}</TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">{fmt(row.skyslope_status_value)}</TableCell>
                                            <TableCell><MatchBadge value={row.status_match} /></TableCell>

                                            {/* Sale Price */}
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.be_sale_price)}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-600">{fmtCurrency(row.skyslope_sale_price)}</TableCell>
                                            <TableCell><MatchBadge value={row.sale_price_match} /></TableCell>
                                        </TableRow>
                                    );
                                })}
                                {data.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={13} className="text-center text-slate-400 py-10 font-medium">
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
