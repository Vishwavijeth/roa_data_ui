import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { SS_API } from '../constants';
import { IconDownload, IconArrowLeft } from '../components/shared/Icons';
import SectionedDetailView from '../components/shared/SectionedDetailView';
import { formatDateUS } from '../utils/helpers';
import DateFilterInput from '../components/shared/DateFilterInput';
import MultiSelect from '../components/shared/MultiSelect';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
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

// Helper to render property addresses in two clean lines with optional Lead Based Checklist flag
const renderPropertyAddress = (val, checklistLeadCheck) => {
    if (val == null || val === '') return '—';
    const str = String(val).trim();
    if (!str) return '—';
    const firstCommaIdx = str.indexOf(',');
    let addressNode;
    if (firstCommaIdx !== -1) {
        const street = str.substring(0, firstCommaIdx).trim();
        const cityStateZip = str.substring(firstCommaIdx + 1).trim();
        addressNode = (
            <div className="flex flex-col leading-snug">
                <span className="font-semibold text-slate-800 text-xs truncate" title={str}>{street}</span>
                {cityStateZip && <span className="text-[11px] text-slate-500 font-normal truncate" title={str}>{cityStateZip}</span>}
            </div>
        );
    } else {
        addressNode = <span className="font-medium text-slate-800 text-xs block leading-tight">{str}</span>;
    }

    return (
        <div className="space-y-1">
            {addressNode}
            {checklistLeadCheck === true && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    Lead Based Checklist Present
                </span>
            )}
            {checklistLeadCheck === false && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80 shadow-2xs w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                    No Lead Based Checklist
                </span>
            )}
        </div>
    );
};

// Helper to render text in at most two clean lines
const renderTwoLines = (val) => {
    if (val == null || val === '') return '—';
    const str = String(val).trim();
    if (!str) return '—';
    return (
        <span className="line-clamp-2 leading-tight block whitespace-normal" title={str}>
            {str}
        </span>
    );
};

// Helper to format Year Built values (renders '-' if 0, null, or invalid)
const formatYearBuilt = (val) => {
    if (val == null || val === '' || val === 0 || val === '0') return '—';
    const num = Number(val);
    return (!isNaN(num) && num > 0) ? num : '—';
};

function SkySlopeView({ syncingSS, syncSSProgress, syncSSResult, handleSyncSS, setSyncSSResult }) {
    const [data, setData] = useState([]);
    const [syncInfo, setSyncInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [stageFilter, setStageFilter] = useState([]);
    const [closeDateFrom, setCloseDateFrom] = useState('');
    const [closeDateTo, setCloseDateTo] = useState('');
    const [yearBuiltFrom, setYearBuiltFrom] = useState('');
    const [yearBuiltTo, setYearBuiltTo] = useState('');
    const [notInBe, setNotInBe] = useState(false);
    const [leadChecklistFilter, setLeadChecklistFilter] = useState('');

    const [totalCount, setTotalCount] = useState(0);
    const [serverTotalPages, setServerTotalPages] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [availableStages, setAvailableStages] = useState([]);

    const [selectedRecord, setSelectedRecord] = useState(null);
    const [detailTab, setDetailTab] = useState('skyslope');
    const [detailData, setDetailData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Sync logs state
    const [showSyncLogs, setShowSyncLogs] = useState(false);
    const [syncLogs, setSyncLogs] = useState(null);
    const [loadingSyncLogs, setLoadingSyncLogs] = useState(false);
    const [syncLogsError, setSyncLogsError] = useState(null);

    const handleViewSyncLogs = () => {
        setShowSyncLogs(true);
        setLoadingSyncLogs(true);
        setSyncLogsError(null);
        setSyncLogs(null);
        fetch('https://roa-data-backend.vercel.app/skyslope_sync_logs')
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
            .then(json => { setSyncLogs(json); setLoadingSyncLogs(false); })
            .catch(err => { setSyncLogsError(err.message); setLoadingSyncLogs(false); });
    };

    useEffect(() => {
        if (selectedRecord) {
            setLoadingDetail(true);
            setDetailData(null);
            fetch(`https://roa-data-backend.vercel.app/skyslope/detail?saleguid=${selectedRecord.saleguid}`)
                .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
                .then(json => {
                    setDetailData(json);
                    setLoadingDetail(false);
                })
                .catch(err => {
                    console.error(err);
                    // If no linked BE data/other income, still show skyslope data from the row itself
                    setDetailData({
                        skyslope: selectedRecord,
                        brokerage_engine_records: [],
                        otherincome_transactions: []
                    });
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
        if (syncSSResult && syncSSResult.ok) {
            const timer = setTimeout(() => setSyncSSResult(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [syncSSResult, setSyncSSResult]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);



    // Fetch filters (status_list, stage_list) on mount
    useEffect(() => {
        let active = true;
        fetch('https://roa-data-backend.vercel.app/skyslope-listing-filters')
            .then(res => {
                if (!res.ok) throw new Error(`Filters API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                const filters = json.filters || json;
                if (filters && Array.isArray(filters.status_list)) {
                    setAvailableStatuses([...filters.status_list].sort());
                }
                if (filters && Array.isArray(filters.stage_list)) {
                    setAvailableStages([...filters.stage_list].sort());
                }
            })
            .catch(err => {
                console.error('Failed to fetch SkySlope filters:', err);
            });
        return () => {
            active = false;
        };
    }, []);

    // Fetch sync info on mount
    useEffect(() => {
        fetch('https://roa-data-backend.vercel.app/skyslope/sync_info')
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (json && json.sync_info) {
                    setSyncInfo(json.sync_info);
                } else if (json && json.sync_date) {
                    setSyncInfo(json);
                }
            })
            .catch(err => {
                console.error('Failed to fetch sync info:', err);
            });
    }, []);

    // Refetch sync info when sync finishes
    useEffect(() => {
        if (syncSSResult && syncSSResult.ok) {
            fetch('https://roa-data-backend.vercel.app/skyslope/sync_info')
                .then(res => res.json())
                .then(json => {
                    if (json && json.sync_info) {
                        setSyncInfo(json.sync_info);
                    } else if (json && json.sync_date) {
                        setSyncInfo(json);
                    }
                })
                .catch(err => console.error('Failed to refresh sync info:', err));
        }
    }, [syncSSResult]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [closeDateFrom, closeDateTo, statusFilter, stageFilter, yearBuiltFrom, yearBuiltTo, searchQuery, notInBe, leadChecklistFilter]);

    // Fetch paginated and filtered data from API
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', 50);
        if (closeDateFrom) params.append('from_close_date', closeDateFrom);
        if (closeDateTo) params.append('to_close_date', closeDateTo);
        if (yearBuiltFrom) params.append('year_built_from', yearBuiltFrom);
        if (yearBuiltTo) params.append('year_built_to', yearBuiltTo);
        if (Array.isArray(statusFilter)) {
            statusFilter.forEach(s => params.append('status', s));
        }
        if (Array.isArray(stageFilter)) {
            stageFilter.forEach(s => {
                params.append('stage', s);
                params.append('stage_name', s);
            });
        }
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        if (notInBe) params.append('not_in_be', 'True');
        if (leadChecklistFilter) params.append('checklist_lead_based', leadChecklistFilter);

        const url = `https://roa-data-backend.vercel.app/skyslope-listing?${params.toString()}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;

                let fetchedData = [];
                if (json && json.data) {
                    if (Array.isArray(json.data.items)) {
                        fetchedData = json.data.items;
                    } else if (Array.isArray(json.data)) {
                        fetchedData = json.data;
                    }
                } else if (json && Array.isArray(json.items)) {
                    fetchedData = json.items;
                } else if (Array.isArray(json)) {
                    fetchedData = json;
                }
                setData(fetchedData);

                const total = json?.data?.total_count ?? json?.total_count ?? json?.total ?? null;
                if (total !== null) {
                    setTotalCount(total);
                } else {
                    setTotalCount(prev => (page === 1 ? fetchedData.length : prev + fetchedData.length));
                }

                if (json?.total_pages != null) {
                    setServerTotalPages(json.total_pages);
                } else {
                    setServerTotalPages(null);
                }

                if (json?.has_next != null) {
                    setHasMore(json.has_next);
                } else if (total !== null) {
                    setHasMore((page - 1) * 50 + fetchedData.length < total);
                } else {
                    setHasMore(fetchedData.length === 50);
                }

                if (json.filters && Array.isArray(json.filters.status_list)) {
                    setAvailableStatuses(prev => prev.length === 0 ? [...json.filters.status_list].sort() : prev);
                }
                if (json.filters && Array.isArray(json.filters.stage_list)) {
                    setAvailableStages(prev => prev.length === 0 ? [...json.filters.stage_list].sort() : prev);
                }

                if (json.sync_info) {
                    setSyncInfo(json.sync_info);
                } else if (json.sync_date) {
                    setSyncInfo({ sync_date: json.sync_date, sync_timestamp: json.sync_timestamp });
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
    }, [page, closeDateFrom, closeDateTo, statusFilter, stageFilter, yearBuiltFrom, yearBuiltTo, searchQuery, notInBe, leadChecklistFilter]);

    const totalPages = serverTotalPages ?? Math.ceil(totalCount / 50);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams();
            if (closeDateFrom) params.append('from_close_date', closeDateFrom);
            if (closeDateTo) params.append('to_close_date', closeDateTo);
            if (yearBuiltFrom) params.append('year_built_from', yearBuiltFrom);
            if (yearBuiltTo) params.append('year_built_to', yearBuiltTo);
            if (Array.isArray(statusFilter)) {
                statusFilter.forEach(s => params.append('status', s));
            }
            if (Array.isArray(stageFilter)) {
                stageFilter.forEach(s => {
                    params.append('stage', s);
                    params.append('stage_name', s);
                });
            }
            if (searchQuery.trim()) params.append('search', searchQuery.trim());
            if (notInBe) params.append('not_in_be', 'True');
            if (leadChecklistFilter) params.append('checklist_lead_based', leadChecklistFilter);

            const queryString = params.toString();
            const downloadUrl = `https://roa-data-backend.vercel.app/skyslope/download${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Download API error: ${response.status}`);
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'SkySlope_Data_report.xlsx';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"\n]*)\1/);
                if (match && match[2]) filename = match[2].trim();
            }
            const objectUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { a.remove(); window.URL.revokeObjectURL(objectUrl); }, 200);
        } catch (err) {
            console.error('SkySlope download failed:', err);
            alert(`Download failed: ${err.message}. Please try again.`);
        } finally {
            setDownloading(false);
        }
    };

    if (selectedRecord) {
        return (
            <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex items-center justify-between w-full border-b border-slate-100 pb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRecord(null)}
                        className="text-slate-600 hover:text-slate-900 gap-2 font-semibold h-9 -ml-2"
                    >
                        <IconArrowLeft /> Back to SkySlope data
                    </Button>
                    <div>
                        {loadingDetail ? (
                            <Badge variant="secondary" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full bg-slate-100 text-slate-500 border border-slate-200 animate-pulse">
                                Checking related data...
                            </Badge>
                        ) : detailData ? (
                            (() => {
                                const hasBE = detailData.brokerage_engine_records && detailData.brokerage_engine_records.length > 0;
                                const hasOI = detailData.otherincome_transactions && detailData.otherincome_transactions.length > 0;

                                if (hasBE && hasOI) {
                                    return (
                                        <Badge variant="success" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            Both have data
                                        </Badge>
                                    );
                                } else if (hasBE || hasOI) {
                                    const typeName = hasBE ? 'Brokerage Engine' : 'Other Income';
                                    return (
                                        <Badge variant="success" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            Only one has data ({typeName})
                                        </Badge>
                                    );
                                } else {
                                    return (
                                        <Badge variant="destructive" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                            No related BE data
                                        </Badge>
                                    );
                                }
                            })()
                        ) : (
                            selectedRecord.transaction_id && selectedRecord.transaction_id !== 'No related BE data' ? (
                                <Badge variant="success" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    Matched with Brokerage Engine data
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                    No related Brokerage Engine data
                                </Badge>
                            )
                        )}
                    </div>
                </div>

                <Card className="shadow-sm border-slate-100 overflow-hidden">
                    <Tabs className="w-full">
                        <TabsList className="w-full rounded-none border-b border-slate-100 bg-slate-50/50 p-0 flex h-12">
                            <TabsTrigger
                                active={detailTab === 'skyslope'}
                                onClick={() => setDetailTab('skyslope')}
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                            >
                                SkySlope Details
                            </TabsTrigger>
                            <TabsTrigger
                                active={detailTab === 'details'}
                                onClick={() => setDetailTab('details')}
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                            >
                                Related Brokerage Engine Record
                            </TabsTrigger>
                            {detailData && detailData.otherincome_transactions && detailData.otherincome_transactions.length > 0 && (
                                <TabsTrigger
                                    active={detailTab === 'other_income'}
                                    onClick={() => setDetailTab('other_income')}
                                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full font-bold text-xs"
                                >
                                    Related Other Income Record
                                </TabsTrigger>
                            )}
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
                                    <TabsContent active={detailTab === 'skyslope'} className="w-full">
                                        {detailData.skyslope ? (
                                            <SectionedDetailView data={detailData.skyslope} />
                                        ) : (
                                            <div className="py-12 text-center text-slate-400 text-sm font-medium">No SkySlope details found.</div>
                                        )}
                                    </TabsContent>
                                    <TabsContent active={detailTab === 'details'} className="w-full">
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
                                            <div className="py-12 text-center text-slate-400 text-sm font-medium">No related Brokerage Engine data</div>
                                        )}
                                    </TabsContent>
                                    <TabsContent active={detailTab === 'other_income'} className="w-full">
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
                                            <div className="py-12 text-center text-slate-400 text-sm font-medium">No related Other Income data</div>
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">SkySlope Data</h1>
                    <p className="text-sm text-slate-500 mt-1">Transaction data sourced from SkySlope.</p>
                    {syncInfo && (
                        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-sky-50/40 border border-sky-100/50 backdrop-blur-sm">
                            <svg width="13" height="13" fill="none" stroke="#0ea5e9" viewBox="0 0 24 24" className="shrink-0 opacity-80">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                            </svg>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Updated at</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{formatDateUS(syncInfo.sync_date)}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-xs font-bold text-slate-700 font-mono">{syncInfo.sync_timestamp}</span>
                            <span className="text-[9px] font-extrabold tracking-wider text-sky-600 bg-sky-100/50 border border-sky-200/30 rounded px-1 uppercase">IST</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">

                    <Button
                        id="view-ss-sync-logs-btn"
                        onClick={handleViewSyncLogs}
                        className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/10 font-semibold text-xs gap-2 h-9"
                    >
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                        </svg>
                        View Sync Logs
                    </Button>
                    <Button
                        id="ss-download-btn"
                        variant="outline"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="font-semibold text-xs gap-2 h-9 hover:bg-slate-50"
                    >
                        <svg className={`h-4 w-4 ${downloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {downloading ? 'Generating Report…' : 'Download Report'}
                    </Button>
                </div>
            </div>

            {/* Sync progress indicator */}
            {syncingSS && (
                <div className="p-5 rounded-xl bg-gradient-to-br from-sky-50/50 to-sky-50/10 border border-sky-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {syncSSProgress < 100 ? (
                                <svg width="18" height="18" fill="none" stroke="#0ea5e9" viewBox="0 0 24 24" className="animate-spin shrink-0">
                                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1 0 6 6.071" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24" className="shrink-0 text-emerald-500">
                                    <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            <span className="font-semibold text-sm text-slate-800">
                                {syncSSProgress < 100 ? 'Syncing SkySlope Data…' : 'Sync Complete!'}
                            </span>
                        </div>
                        <span className="font-bold text-lg text-sky-600 font-mono">
                            {syncSSProgress}%
                        </span>
                    </div>
                    <div className="w-full h-2.5 bg-sky-100/50 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-300 ease-out"
                            style={{
                                width: `${syncSSProgress}%`,
                                background: syncSSProgress === 100
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                            }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                        {syncSSProgress < 20
                            ? 'Connecting to SkySlope API…'
                            : syncSSProgress < 50
                                ? 'Fetching sale records…'
                                : syncSSProgress < 80
                                    ? 'Processing and updating records…'
                                    : syncSSProgress < 100
                                        ? 'Finalizing data sync…'
                                        : 'All records have been synced successfully.'}
                    </p>
                </div>
            )}

            {/* Sync success banner */}
            {!syncingSS && syncSSResult && syncSSResult.ok && (
                <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/60 text-emerald-700 font-medium text-xs flex items-center gap-2 shadow-sm">
                    <span>✅</span>
                    <span>{syncSSResult.message}</span>
                </div>
            )}

            {/* Table card */}
            <Card className="shadow-sm border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                            Showing page {page} of {totalPages}
                        </span>
                    )}
                </div>

                {/* Filters Grid */}
                <div className="p-5 border-b border-slate-100 bg-white space-y-4">
                    {/* Search */}
                    <div className="relative w-full max-w-lg">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            id="ss-search"
                            type="text"
                            placeholder="Search by Sale GUID, Property Address, or Transaction ID…"
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

                    {/* Filter controls — flex-wrap so labels never get squeezed */}
                    <div className="flex flex-wrap items-end gap-3 pt-1">
                        <div className="flex flex-col gap-1 min-w-[130px]">
                            <label htmlFor="ss-close-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Close From</label>
                            <DateFilterInput id="ss-close-from" value={closeDateFrom} onChange={val => { setCloseDateFrom(val); setPage(1); }} className="h-9 text-xs text-slate-700" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[130px]">
                            <label htmlFor="ss-close-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Close To</label>
                            <DateFilterInput id="ss-close-to" value={closeDateTo} onChange={val => { setCloseDateTo(val); setPage(1); }} className="h-9 text-xs text-slate-700" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[150px]">
                            <label htmlFor="ss-status-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</label>
                            <MultiSelect
                                id="ss-status-filter"
                                options={availableStatuses}
                                selected={statusFilter}
                                onChange={val => { setStatusFilter(val); setPage(1); }}
                                placeholder="All Statuses"
                                allLabel="All Statuses"
                            />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[150px]">
                            <label htmlFor="ss-stage-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Stage</label>
                            <MultiSelect
                                id="ss-stage-filter"
                                options={availableStages}
                                selected={stageFilter}
                                onChange={val => { setStageFilter(val); setPage(1); }}
                                placeholder="All Stages"
                                allLabel="All Stages"
                            />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[150px]">
                            <label htmlFor="ss-lead-checklist-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Lead Based Checklist</label>
                            <select
                                id="ss-lead-checklist-filter"
                                value={leadChecklistFilter}
                                onChange={e => { setLeadChecklistFilter(e.target.value); setPage(1); }}
                                className="flex w-full rounded-md border border-input bg-white px-3 h-9 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-700 font-normal"
                            >
                                <option value="">All</option>
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 min-w-[120px]">
                            <label htmlFor="ss-year-built-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Year Built From</label>
                            <Input
                                id="ss-year-built-from"
                                type="number"
                                placeholder="e.g. 1990"
                                value={yearBuiltFrom}
                                onChange={e => { setYearBuiltFrom(e.target.value); setPage(1); }}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[120px]">
                            <label htmlFor="ss-year-built-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Year Built To</label>
                            <Input
                                id="ss-year-built-to"
                                type="number"
                                placeholder="e.g. 2024"
                                value={yearBuiltTo}
                                onChange={e => { setYearBuiltTo(e.target.value); setPage(1); }}
                                className="h-9 text-xs text-slate-700"
                            />
                        </div>
                    </div>

                    {/* Not in BE toggle + Reset row */}
                    <div className="flex items-center justify-between pt-1">
                        <button
                            id="ss-not-in-be-toggle"
                            onClick={() => { setNotInBe(v => !v); setPage(1); }}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs select-none ${notInBe
                                ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${notInBe ? 'bg-white' : 'bg-slate-300'}`} />
                            Not in BE
                        </button>

                        {(searchInput || searchQuery || (statusFilter && statusFilter.length > 0) || (stageFilter && stageFilter.length > 0) || closeDateFrom || closeDateTo || yearBuiltFrom || yearBuiltTo || notInBe || leadChecklistFilter) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchInput(''); setSearchQuery(''); setStatusFilter([]); setStageFilter([]); setCloseDateFrom(''); setCloseDateTo('');
                                    setYearBuiltFrom(''); setYearBuiltTo(''); setNotInBe(false); setLeadChecklistFilter(''); setPage(1);
                                }}
                                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                            >
                                Clear All Filters
                            </Button>
                        )}
                    </div>
                </div>

                {/* Grid Table */}
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-500">Loading SkySlope data…</p>
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
                                    <TableHead className="w-1/4">Property Address</TableHead>
                                    <TableHead className="w-1/10">Close Date</TableHead>
                                    <TableHead className="w-1/10">Status</TableHead>
                                    <TableHead className="w-1/12">Year Built</TableHead>
                                    <TableHead className="w-1/8">Stage Name</TableHead>
                                    <TableHead className="w-1/8">Buyer Name</TableHead>
                                    <TableHead className="w-1/8">Buyer Agent</TableHead>
                                    <TableHead className="w-1/10">Reviewer</TableHead>
                                    <TableHead className="w-1/8 text-right pr-6">Transaction ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, i) => (
                                    <TableRow
                                        key={i}
                                        onClick={() => { setSelectedRecord(row); setDetailTab('skyslope'); }}
                                        className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                                    >
                                        <TableCell className="font-medium text-slate-800 text-xs py-2.5">
                                            {renderPropertyAddress(row.propertyaddress, row.checklist_lead_check)}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 font-medium">{formatDateUS(row.close_date)}</TableCell>
                                        <TableCell className="shrink-0 select-none">
                                            {row.status ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold"
                                                >
                                                    {row.status}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600 font-medium">{formatYearBuilt(row.yearbuilt ?? row.year_built ?? row.yearBuilt)}</TableCell>
                                        <TableCell className="text-xs text-slate-600 font-medium">{renderTwoLines(row.stage_name)}</TableCell>
                                        <TableCell className="text-xs text-slate-600">{renderCellData(row.buyer_name)}</TableCell>
                                        <TableCell className="text-xs text-slate-600">{renderCellData(row.buyer_agent_name)}</TableCell>
                                        <TableCell className="text-xs text-slate-600">{renderTwoLines(row.reviewer)}</TableCell>
                                        <TableCell className="font-mono text-xs text-slate-600 shrink-0 text-right pr-6">{row.transaction_id || 'No related BE data'}</TableCell>
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
                        {(totalPages > 1 || page > 1 || hasMore) && (
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
                                    Page {page} {totalPages > 0 ? `of ${totalPages}` : ''}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={!hasMore || (totalPages > 0 && page === totalPages)}
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
                    <DialogTitle>SkySlope Sync History Log</DialogTitle>
                    <DialogDescription>
                        Audit logs for SkySlope synchronization tasks.
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

export default SkySlopeView;
