import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { BE_API } from '../constants';
import { IconDownload, IconArrowLeft } from '../components/shared/Icons';
import SectionedDetailView from '../components/shared/SectionedDetailView';
import { formatDateUS } from '../utils/helpers';
import DateFilterInput from '../components/shared/DateFilterInput';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

// Helper to display data completely and split comma-separated values into lines
const renderCellData = (val) => {
    if (val == null || val === '') return '—';
    const str = String(val);
    if (str.includes(',')) {
        return (
            <div className="flex flex-col gap-0.5 whitespace-normal">
                {str.split(',').map((item, idx) => (
                    <div key={idx} className="block leading-tight py-0.5">{item.trim()}</div>
                ))}
            </div>
        );
    }
    return <span className="whitespace-normal block leading-tight">{str}</span>;
};

function BrokerageView({ syncingBE, syncProgress, syncBEResult, handleSyncBE, setSyncBEResult }) {
    const [data, setData] = useState([]);
    const [syncInfo, setSyncInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [closeDateFrom, setCloseDateFrom] = useState('');
    const [closeDateTo, setCloseDateTo] = useState('');
    const [contractDateFrom, setContractDateFrom] = useState('');
    const [contractDateTo, setContractDateTo] = useState('');
    const [brokerHold, setBrokerHold] = useState(false);

    const [totalCount, setTotalCount] = useState(0);
    const [availableStatuses, setAvailableStatuses] = useState([]);

    const [selectedRecord, setSelectedRecord] = useState(null);
    const [detailTab, setDetailTab] = useState('details'); // 'details' | 'skyslope'
    const [detailData, setDetailData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Sync logs modal state
    const [showSyncLogs, setShowSyncLogs] = useState(false);
    const [syncLogs, setSyncLogs] = useState(null);
    const [loadingSyncLogs, setLoadingSyncLogs] = useState(false);
    const [syncLogsError, setSyncLogsError] = useState(null);

    const handleViewSyncLogs = () => {
        setShowSyncLogs(true);
        setLoadingSyncLogs(true);
        setSyncLogsError(null);
        setSyncLogs(null);
        fetch('https://roa-data-backend.vercel.app/brokerage_sync_logs')
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
            .then(json => { setSyncLogs(json); setLoadingSyncLogs(false); })
            .catch(err => { setSyncLogsError(err.message); setLoadingSyncLogs(false); });
    };

    useEffect(() => {
        if (selectedRecord) {
            setLoadingDetail(true);
            setDetailData(null);
            fetch(`https://roa-data-backend.vercel.app/brokerage_engine/detail?transactionid=${selectedRecord.transactionid}`)
                .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
                .then(json => {
                    setDetailData(json);
                    setLoadingDetail(false);
                })
                .catch(err => {
                    console.error(err);
                    setDetailData({ _error: err.message });
                    setLoadingDetail(false);
                });
        }
    }, [selectedRecord]);

    // Browser back-button support for record detail
    useEffect(() => {
        if (selectedRecord) {
            window.history.pushState({ detail: true }, '');
            const handlePopState = () => setSelectedRecord(null);
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [selectedRecord]);

    // Browser back-button support for sync logs view
    useEffect(() => {
        if (showSyncLogs) {
            window.history.pushState({ syncLogs: true }, '');
            const handlePopState = () => setShowSyncLogs(false);
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [showSyncLogs]);

    // Auto-dismiss the sync success banner after 3 seconds
    useEffect(() => {
        if (syncBEResult && syncBEResult.ok) {
            const timer = setTimeout(() => setSyncBEResult(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [syncBEResult, setSyncBEResult]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch sync info on mount
    useEffect(() => {
        fetch('https://roa-data-backend.vercel.app/brokerage_engine/sync_info')
            .then(res => res.json())
            .then(json => {
                if (json && json.sync_info) {
                    setSyncInfo(json.sync_info);
                } else if (json && json.sync_date) {
                    setSyncInfo(json);
                }
            })
            .catch(err => {
                console.error('Failed to fetch BE sync info:', err);
            });
    }, []);

    // Fetch status filter options on mount
    useEffect(() => {
        fetch('https://roa-data-backend.vercel.app/brokerage_engine/status-filter')
            .then(res => res.json())
            .then(json => {
                if (json && Array.isArray(json.status_list)) {
                    setAvailableStatuses(json.status_list);
                }
            })
            .catch(err => {
                console.error('Failed to fetch BE status filter:', err);
            });
    }, []);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [brokerHold, closeDateFrom, closeDateTo, contractDateFrom, contractDateTo, statusFilter, searchQuery]);

    // Fetch data when page or filters change
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        if (brokerHold) params.append('brokerhold', 'true');
        if (closeDateFrom) params.append('from_close_date', closeDateFrom);
        if (closeDateTo) params.append('to_close_date', closeDateTo);
        if (contractDateFrom) params.append('from_contract_date', contractDateFrom);
        if (contractDateTo) params.append('to_contract_date', contractDateTo);
        if (statusFilter) params.append('status', statusFilter);
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        const url = `${BE_API}?${params.toString()}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                const fetchedData = json && Array.isArray(json.data) ? json.data : [];
                const total = json.total_count != null ? json.total_count : fetchedData.length;

                setData(fetchedData);
                setTotalCount(total);

                if (json.sync_info) {
                    setSyncInfo(prev => prev ?? json.sync_info);
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
    }, [page, brokerHold, closeDateFrom, closeDateTo, contractDateFrom, contractDateTo, statusFilter, searchQuery]);

    const totalPages = Math.ceil(totalCount / 50);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Brokerage Engine');
        writeFile(wb, 'Brokerage_Engine_report.xlsx');
    };

    if (selectedRecord) {
        return (
            <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex flex-col items-start gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRecord(null)}
                        className="text-slate-600 hover:text-slate-900 gap-2 font-semibold h-9 -ml-2"
                    >
                        <IconArrowLeft /> Back to brokerage engine
                    </Button>
                    <div className="w-full p-6 bg-gradient-to-r from-blue-50/60 to-transparent border-l-4 border-blue-600 rounded-r-xl">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">
                            {selectedRecord.property_address || 'No Address Provided'}
                        </h1>
                        <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                            <span className="font-semibold text-slate-700">Transaction ID:</span> {selectedRecord.transactionid || 'Unknown'}
                        </p>
                        <div className="mt-3">
                            {(loadingDetail ? !!selectedRecord.skyslopefileid : detailData?.skyslope?.match !== false) ? (
                                <Badge variant="success" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    Matched with SkySlope data
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                    No related SkySlope data
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <Card className="shadow-sm border-slate-100 overflow-hidden">
                    <Tabs className="w-full">
                        <TabsList className="w-full rounded-none border-b border-slate-100 bg-slate-50/50 p-0 flex h-12">
                            <TabsTrigger
                                active={detailTab === 'details'}
                                onClick={() => setDetailTab('details')}
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                active={detailTab === 'skyslope'}
                                onClick={() => setDetailTab('skyslope')}
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                            >
                                Related SkySlope Record
                            </TabsTrigger>
                        </TabsList>

                        <div className="p-6 min-h-[300px] flex flex-col justify-start">
                            {loadingDetail ? (
                                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                                    <svg className="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <p className="text-xs font-semibold text-slate-400">Fetching transaction details…</p>
                                </div>
                            ) : detailData && detailData._error ? (
                                <div className="p-8 text-center max-w-sm mx-auto bg-red-50/30 border border-red-100 rounded-xl space-y-1">
                                    <p className="font-bold text-red-600 text-sm">Failed to load details</p>
                                    <p className="text-xs text-slate-500">{detailData._error}</p>
                                </div>
                            ) : detailData ? (
                                <div className="w-full">
                                    <TabsContent active={detailTab === 'details'} className="w-full">
                                        {detailData.brokerage_engine ? (
                                            <SectionedDetailView data={detailData.brokerage_engine} />
                                        ) : (
                                            <div className="py-12 text-center text-slate-400 text-sm font-medium">No Brokerage Engine details found.</div>
                                        )}
                                    </TabsContent>
                                    <TabsContent active={detailTab === 'skyslope'} className="w-full">
                                        {detailData.skyslope && detailData.skyslope.match !== false ? (
                                            <SectionedDetailView data={detailData.skyslope} />
                                        ) : (
                                            <div className="py-12 text-center text-slate-400 text-sm font-medium">No related SkySlope record found for this transaction.</div>
                                        )}
                                    </TabsContent>
                                </div>
                            ) : null}
                        </div>
                    </Tabs>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Brokerage Engine</h1>
                    <p className="text-sm text-slate-500 mt-1">Transaction data sourced from Brokerage Engine.</p>
                    {syncInfo && (
                        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-indigo-50/40 border border-indigo-100/50 backdrop-blur-sm">
                            <svg width="13" height="13" fill="none" stroke="#6366f1" viewBox="0 0 24 24" className="shrink-0 opacity-80">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                            </svg>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Updated at</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{formatDateUS(syncInfo.sync_date)}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-xs font-bold text-slate-700 font-mono">{syncInfo.sync_timestamp}</span>
                            <span className="text-[9px] font-extrabold tracking-wider text-indigo-600 bg-indigo-100/50 border border-indigo-200/30 rounded px-1 uppercase">IST</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                        id="sync-be-data-btn"
                        onClick={handleSyncBE}
                        disabled={syncingBE}
                        className={`font-semibold text-xs shadow-md select-none gap-2 h-9 ${syncingBE
                            ? 'bg-indigo-700/80'
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
                            }`}
                    >
                        {syncingBE ? (
                            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                            </svg>
                        ) : (
                            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                            </svg>
                        )}
                        {syncingBE ? 'Syncing…' : 'Sync BE Data'}
                    </Button>
                    <Button
                        id="view-sync-logs-btn"
                        onClick={handleViewSyncLogs}
                        className="bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/10 font-semibold text-xs gap-2 h-9"
                    >
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                        </svg>
                        View Sync Logs
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleDownload}
                        disabled={!data.length}
                        className="font-semibold text-xs gap-2 h-9 hover:bg-slate-50"
                    >
                        <IconDownload /> Download Report
                    </Button>
                </div>
            </div>

            {/* Sync progress indicator */}
            {syncingBE && (
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
                                {syncProgress < 100 ? 'Syncing Brokerage Engine Data…' : 'Sync Complete!'}
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
                            ? 'Connecting to Brokerage Engine API…'
                            : syncProgress < 50
                                ? 'Fetching transaction records…'
                                : syncProgress < 80
                                    ? 'Processing and updating records…'
                                    : syncProgress < 100
                                        ? 'Finalizing data sync…'
                                        : 'All records have been synced successfully.'}
                    </p>
                </div>
            )}

            {/* Sync success banner */}
            {!syncingBE && syncBEResult && syncBEResult.ok && (
                <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/60 text-emerald-700 font-medium text-xs flex items-center gap-2 shadow-sm">
                    <span>✅</span>
                    <span>{syncBEResult.message}</span>
                </div>
            )}

            {/* Table card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-md font-bold text-slate-800">Transactions</h2>
                        {data.length > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 font-bold text-[10px] rounded">
                                {totalCount.toLocaleString()} records
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Filters Grid */}
                <div className="p-5 border-b border-slate-100 bg-white space-y-4">
                    {/* Search */}
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="be-search"
                            type="text"
                            placeholder="Search by Transaction ID, Property Address, or Buying Agent…"
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

                    {/* Date and dropdown filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_1.2fr] gap-3 pt-1">
                        <div className="space-y-1">
                            <label htmlFor="be-close-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Close From</label>
                            <DateFilterInput id="be-close-from" value={closeDateFrom} onChange={val => { setCloseDateFrom(val); setPage(1); }} className="h-8.5 text-xs text-slate-700" />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="be-close-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Close To</label>
                            <DateFilterInput id="be-close-to" value={closeDateTo} onChange={val => { setCloseDateTo(val); setPage(1); }} className="h-8.5 text-xs text-slate-700" />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="be-contract-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract From</label>
                            <DateFilterInput id="be-contract-from" value={contractDateFrom} onChange={val => { setContractDateFrom(val); setPage(1); }} className="h-8.5 text-xs text-slate-700" />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="be-contract-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract To</label>
                            <DateFilterInput id="be-contract-to" value={contractDateTo} onChange={val => { setContractDateTo(val); setPage(1); }} className="h-8.5 text-xs text-slate-700" />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="be-status-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Status</label>
                            <Select id="be-status-filter" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-8.5 text-xs">
                                <option value="">All Statuses</option>
                                {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>

                        {/* Broker Hold toggle */}
                        <div className="space-y-1 flex flex-col justify-end">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hold Status</label>
                            <Button
                                id="be-brokerhold-toggle"
                                variant={brokerHold ? 'destructive' : 'outline'}
                                onClick={() => { setBrokerHold(v => !v); setPage(1); }}
                                className={`h-8.5 text-xs font-bold gap-2 px-3 justify-start w-full border rounded-md transition-all select-none ${brokerHold
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100/60 border-red-200'
                                    : 'hover:bg-slate-50'
                                    }`}
                            >
                                <span className={`relative inline-block w-6 h-3.5 rounded-full shrink-0 transition-colors duration-200 ${brokerHold ? 'bg-red-500' : 'bg-slate-200'
                                    }`}>
                                    <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all duration-200 shadow-sm ${brokerHold ? 'left-3' : 'left-0.5'
                                        }`} />
                                </span>
                                Broker Hold
                            </Button>
                        </div>
                    </div>

                    {/* Reset Button */}
                    {(searchInput || searchQuery || statusFilter || closeDateFrom || closeDateTo || contractDateFrom || contractDateTo || brokerHold) && (
                        <div className="flex justify-end pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchInput(''); setSearchQuery(''); setStatusFilter(''); setCloseDateFrom(''); setCloseDateTo('');
                                    setContractDateFrom(''); setContractDateTo(''); setBrokerHold(false); setPage(1);
                                }}
                                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                            >
                                Clear All Filters
                            </Button>
                        </div>
                    )}
                </div>

                {/* Grid Table */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading Brokerage Engine data…</p>
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
                                    <TableHead className="w-1/8">Transaction ID</TableHead>
                                    <TableHead className="w-1/4">Property Address</TableHead>
                                    <TableHead className="w-1/10">Sale Price</TableHead>
                                    <TableHead className="w-1/10">Status</TableHead>
                                    <TableHead className="w-1/10">Close Date</TableHead>
                                    <TableHead className="w-1/10">Contract Date</TableHead>
                                    <TableHead className="w-1/8">Buying Agent</TableHead>
                                    <TableHead className="w-1/8">Specialist</TableHead>
                                    <TableHead className="w-1/10 text-right pr-6">SkySlope ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, i) => (
                                    <TableRow
                                        key={i}
                                        onClick={() => { setSelectedRecord(row); setDetailTab('details'); }}
                                        className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                                    >
                                        <TableCell className="font-mono text-xs text-slate-600 shrink-0">{row.transactionid || '-'}</TableCell>
                                        <TableCell className="font-medium text-slate-800 text-xs">{renderCellData(row.property_address)}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-600">{row.sale_price != null ? `$${Number(row.sale_price).toLocaleString()}` : '-'}</TableCell>
                                        <TableCell className="shrink-0 select-none">
                                            {row.status ? (
                                                <Badge
                                                    variant={row.status.toLowerCase() === 'complete' ? 'success' : 'secondary'}
                                                    className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold"
                                                >
                                                    {row.status}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium">{formatDateUS(row.close_date)}</TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium">{formatDateUS(row.contract_date)}</TableCell>
                                        <TableCell className="text-xs text-slate-600">{renderCellData(row.buying_agent_name)}</TableCell>
                                        <TableCell className="text-xs text-slate-600">{renderCellData(row.transaction_specialist)}</TableCell>
                                        <TableCell className="text-right pr-6 font-mono text-xs text-slate-500 shrink-0">{row.skyslopefileid || '-'}</TableCell>
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

                        {/* Pagination */}
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

            {/* Sync logs dialog */}
            <Dialog open={showSyncLogs} onOpenChange={setShowSyncLogs}>
                <DialogHeader>
                    <DialogTitle>Sync History Log</DialogTitle>
                    <DialogDescription>
                        Audit logs for Brokerage Engine synchronization tasks.
                    </DialogDescription>
                </DialogHeader>
                <DialogContent>
                    {loadingSyncLogs ? (
                        <div className="py-8 flex flex-col items-center justify-center space-y-3">
                            <svg className="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <p className="text-xs font-semibold text-slate-400">Loading sync history logs…</p>
                        </div>
                    ) : syncLogsError ? (
                        <div className="p-4 text-center text-red-600 text-xs font-bold">
                            ⚠️ Failed to load sync logs: {syncLogsError}
                        </div>
                    ) : syncLogs ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100/50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sync Summary</span>
                                <Badge variant="secondary" className="font-bold text-[10px]">{syncLogs.count} entries</Badge>
                            </div>
                            <div className="border border-slate-100 rounded-lg overflow-hidden max-h-80 overflow-y-auto custom-scrollbar">
                                <Table>
                                    <TableHeader className="bg-slate-50/70 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="text-xs">Sync Date</TableHead>
                                            <TableHead className="text-xs">Sync Time</TableHead>
                                            <TableHead className="text-xs text-right pr-6">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {syncLogs.data.map((log, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="text-xs font-medium text-slate-700">{formatDateUS(log.sync_date)}</TableCell>
                                                <TableCell className="text-xs font-mono text-slate-500">{log.sync_time}</TableCell>
                                                <TableCell className="text-right pr-6 select-none">
                                                    <Badge
                                                        variant={log.status === 'success' ? 'success' : 'destructive'}
                                                        className="px-2 py-0.5 rounded text-[10px] font-semibold gap-1.5 inline-flex items-center"
                                                    >
                                                        <span className={`w-1 h-1 rounded-full shrink-0 ${log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        {log.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setShowSyncLogs(false)} className="h-9 font-semibold text-xs select-none">
                        Close Log
                    </Button>
                </DialogFooter>
            </Dialog>
        </div>
    );
}

export default BrokerageView;
