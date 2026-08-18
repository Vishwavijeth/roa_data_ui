import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatDateUS } from '../utils/helpers';
import { COMMISSION_ADVANCES_FLOW_LIST_API, ROWS_PER_PAGE } from '../constants';

function CommissionAdvancesFlow() {
    const [items, setItems] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ── Search & Filter State ──────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [officeFilter, setOfficeFilter] = useState('ALL');
    const [approvalFilter, setApprovalFilter] = useState('ALL');

    // ── Backend API Pagination State ───────────────────────────────────────────
    const [page, setPage] = useState(1);
    const pageSize = ROWS_PER_PAGE || 50;

    // ── Expanded Rows State ────────────────────────────────────────────────────
    const [expandedRows, setExpandedRows] = useState({});

    // ── Fetch Data with API Pagination Support ─────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('page', page);
            params.append('page_size', pageSize);
            if (searchQuery.trim()) {
                params.append('search', searchQuery.trim());
            }

            const url = `${COMMISSION_ADVANCES_FLOW_LIST_API}?${params.toString()}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error ${res.status}`);
            }
            const json = await res.json();
            if (json.success && json.data) {
                setItems(json.data.items || []);
                setTotalCount(json.data.total_count ?? (json.data.items ? json.data.items.length : 0));
            } else if (Array.isArray(json.items)) {
                setItems(json.items);
                setTotalCount(json.total_count || json.items.length);
            } else {
                throw new Error(json.message || 'Failed to load flow data');
            }
        } catch (err) {
            console.error('Error loading commission advances flow:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    // ── Unique Filter Options ──────────────────────────────────────────────────
    const uniqueStatuses = useMemo(() => {
        const statuses = new Set();
        items.forEach(item => {
            if (item.status) statuses.add(item.status);
        });
        return Array.from(statuses).sort();
    }, [items]);

    const uniqueOffices = useMemo(() => {
        const offices = new Set();
        items.forEach(item => {
            if (item.listing_office) offices.add(item.listing_office);
            if (item.sales_office) offices.add(item.sales_office);
        });
        return Array.from(offices).sort();
    }, [items]);

    // ── Filtered Data (on items returned from API) ─────────────────────────────
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Search Query Filter (only by agent name and address)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const addressMatch = (item.address || '').toLowerCase().includes(q);

                const listingAgentsMatch = (item.listing_agents || []).some(a => 
                    (a.display_name || '').toLowerCase().includes(q)
                );
                const buyingAgentsMatch = (item.buying_agents || []).some(a => 
                    (a.display_name || '').toLowerCase().includes(q)
                );

                if (!addressMatch && !listingAgentsMatch && !buyingAgentsMatch) {
                    return false;
                }
            }

            // Status Filter
            if (statusFilter !== 'ALL' && item.status !== statusFilter) {
                return false;
            }

            // Office Filter
            if (officeFilter !== 'ALL') {
                if (item.listing_office !== officeFilter && item.sales_office !== officeFilter) {
                    return false;
                }
            }

            // Approval Filter
            if (approvalFilter === 'APPROVED_COMMISSION' && !item.approved_for_commission) return false;
            if (approvalFilter === 'APPROVED_PROCESSING' && !item.approved_for_processing) return false;
            if (approvalFilter === 'APPROVED_BOTH' && (!item.approved_for_commission || !item.approved_for_processing)) return false;
            if (approvalFilter === 'PENDING' && (item.approved_for_commission || item.approved_for_processing)) return false;

            return true;
        });
    }, [items, searchQuery, statusFilter, officeFilter, approvalFilter]);

    // ── Total Pages from Backend total_count ──────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter, officeFilter, approvalFilter]);

    // ── Row Expansion Handlers ─────────────────────────────────────────────────
    const toggleRow = (index) => {
        setExpandedRows(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // ── Clear Filters Handler ──────────────────────────────────────────────────
    const handleClearFilters = () => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setOfficeFilter('ALL');
        setApprovalFilter('ALL');
        setPage(1);
    };

    const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'ALL' || officeFilter !== 'ALL' || approvalFilter !== 'ALL';

    // ── Formatters ─────────────────────────────────────────────────────────────
    const formatCurrency = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(parseFloat(val));
    };

    const renderAddressTwoLines = (address, type) => {
        if (!address) return <span className="text-slate-400 italic">—</span>;

        const commaIndex = address.indexOf(',');
        let line1 = address;
        let line2 = '';

        if (commaIndex !== -1) {
            line1 = address.slice(0, commaIndex).trim();
            line2 = address.slice(commaIndex + 1).trim();
        }

        return (
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs" title={line1}>{line1}</span>
                    {type && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            {type}
                        </span>
                    )}
                </div>
                {line2 && (
                    <span className="text-[11px] text-slate-500 font-medium" title={line2}>{line2}</span>
                )}
            </div>
        );
    };

    const renderAgentNames = (item) => {
        const listing = item.listing_agents || [];
        const buying = item.buying_agents || [];

        if (listing.length === 0 && buying.length === 0) {
            return <span className="text-slate-400 text-xs italic">Unassigned</span>;
        }

        return (
            <div className="flex flex-col gap-1">
                {listing.map((ag, i) => (
                    <div key={`l-${i}`} className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                            Listing
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{ag.display_name || 'Agent'}</span>
                        {ag.agent_status && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                ag.agent_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {ag.agent_status}
                            </span>
                        )}
                    </div>
                ))}
                {buying.map((ag, i) => (
                    <div key={`b-${i}`} className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            Buying
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{ag.display_name || 'Agent'}</span>
                        {ag.agent_status && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                ag.agent_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {ag.agent_status}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderStatusBadge = (status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'approved' || s === 'completed') {
            return <Badge variant="success" className="capitalize">{status}</Badge>;
        }
        if (s === 'pending') {
            return <Badge variant="warning" className="capitalize">{status}</Badge>;
        }
        if (s === 'rejected' || s === 'cancelled') {
            return <Badge variant="destructive" className="capitalize">{status}</Badge>;
        }
        return <Badge variant="secondary" className="capitalize">{status || '—'}</Badge>;
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Commission Advances Flow</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Detailed breakdown and live tracking of commission advance items, office allocations, and approvals.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-white hover:bg-slate-50 shadow-sm"
                    >
                        <svg className={`w-4 h-4 mr-1.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Metric Card: Single Total Count from API total_count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200/80 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Count</p>
                        <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Total items from API</p>
                    </CardContent>
                </Card>
            </div>

            {/* Controls Bar: Search & Filters */}
            <Card className="bg-white border-slate-200/80 shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            type="text"
                            placeholder="Search by property address or agent name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus:bg-white transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Selects */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="ALL">All Statuses</option>
                            {uniqueStatuses.map(st => (
                                <option key={st} value={st}>{st.toUpperCase()}</option>
                            ))}
                        </select>

                        {/* Office Filter */}
                        <select
                            value={officeFilter}
                            onChange={(e) => setOfficeFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="ALL">All Offices</option>
                            {uniqueOffices.map(off => (
                                <option key={off} value={off}>{off}</option>
                            ))}
                        </select>

                        {/* Approval Filter */}
                        <select
                            value={approvalFilter}
                            onChange={(e) => setApprovalFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="ALL">All Approvals</option>
                            <option value="APPROVED_COMMISSION">Approved for Commission</option>
                            <option value="APPROVED_PROCESSING">Approved for Processing</option>
                            <option value="APPROVED_BOTH">Approved for Both</option>
                            <option value="PENDING">Pending Approval</option>
                        </select>

                        {/* Clear Filters Button */}
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClearFilters}
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-semibold"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Error Message Alert */}
            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <span>⚠️ Error loading data: {error}</span>
                    <button onClick={fetchData} className="underline text-red-800 hover:text-red-950 ml-auto">Retry</button>
                </div>
            )}

            {/* Data Table */}
            <Card className="bg-white border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableHead className="text-xs font-bold uppercase text-slate-500">Property Address</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-slate-500">Agent Name(s)</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Advance Amount</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">GCI</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-slate-500 text-center">Status & Approvals</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i} className="animate-pulse">
                                        <TableCell><div className="w-48 h-4 bg-slate-200 rounded"></div></TableCell>
                                        <TableCell><div className="w-36 h-4 bg-slate-200 rounded"></div></TableCell>
                                        <TableCell><div className="w-20 h-4 bg-slate-200 rounded ml-auto"></div></TableCell>
                                        <TableCell><div className="w-20 h-4 bg-slate-200 rounded ml-auto"></div></TableCell>
                                        <TableCell><div className="w-24 h-4 bg-slate-200 rounded mx-auto"></div></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                                        No commission advances flow records found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const isExpanded = Boolean(expandedRows[idx]);

                                    return (
                                        <React.Fragment key={idx}>
                                            {/* Main Table Row */}
                                            <TableRow
                                                onClick={() => toggleRow(idx)}
                                                className={`cursor-pointer transition-colors select-none ${
                                                    isExpanded ? 'bg-blue-50/40 hover:bg-blue-50/60 border-b-0' : 'hover:bg-slate-50/60'
                                                }`}
                                            >
                                                {/* Property Address (rendered in 2 lines) */}
                                                <TableCell>
                                                    {renderAddressTwoLines(item.address, item.type)}
                                                </TableCell>

                                                {/* Agent Name(s) */}
                                                <TableCell className="text-xs">
                                                    {renderAgentNames(item)}
                                                </TableCell>

                                                {/* Advance Amount */}
                                                <TableCell className="text-right text-xs font-bold text-emerald-600">
                                                    {formatCurrency(item.amount)}
                                                </TableCell>

                                                {/* GCI */}
                                                <TableCell className="text-right text-xs font-bold text-slate-700">
                                                    {formatCurrency(item.gci)}
                                                </TableCell>

                                                {/* Status & Approvals */}
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {renderStatusBadge(item.status)}
                                                        <div className="flex items-center gap-1">
                                                            {item.approved_for_commission ? (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Approved for Commission">
                                                                    Comm. ✓
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-400 border border-slate-200" title="Commission Approval Pending">
                                                                    Comm. ✕
                                                                </span>
                                                            )}
                                                            {item.approved_for_processing ? (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Approved for Processing">
                                                                    Proc. ✓
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-400 border border-slate-200" title="Processing Approval Pending">
                                                                    Proc. ✕
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded Detailed Drawer Row */}
                                            {isExpanded && (
                                                <TableRow className="bg-slate-50/90 border-b border-blue-100">
                                                    <TableCell colSpan={5} className="p-4">
                                                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-inner space-y-5 text-xs text-slate-700">
                                                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                                                    <h4 className="font-bold text-sm text-slate-900">
                                                                        Full Flow Details — {item.address}
                                                                    </h4>
                                                                </div>
                                                                <span className="text-[11px] text-slate-400 font-medium">
                                                                    Row #{ (page - 1) * pageSize + idx + 1 }
                                                                </span>
                                                            </div>

                                                            {/* Grid layout of all values */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                                {/* Column 1: General & Office Info */}
                                                                <div className="space-y-3">
                                                                    <h5 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                                                                        General & Offices
                                                                    </h5>
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Transaction Type</span>
                                                                            <span className="font-semibold text-slate-800">{item.type || '—'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Listing Office</span>
                                                                            <span className="font-semibold text-slate-800">{item.listing_office || '—'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Sales Office</span>
                                                                            <span className="font-semibold text-slate-800">{item.sales_office || '—'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Is Other Income</span>
                                                                            <span className="font-semibold text-slate-800">
                                                                                {item.is_other_income ? 'Yes' : 'No'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Column 2: Agent Details */}
                                                                <div className="space-y-3">
                                                                    <h5 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                                                                        Agents & Allocations
                                                                    </h5>
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Listing Agents ({item.listing_agents?.length || 0})</span>
                                                                            {item.listing_agents && item.listing_agents.length > 0 ? (
                                                                                <div className="space-y-1">
                                                                                    {item.listing_agents.map((ag, i) => (
                                                                                        <div key={i} className="p-1.5 rounded bg-blue-50/50 border border-blue-100 text-[11px]">
                                                                                            <div className="font-bold text-blue-900">{ag.display_name}</div>
                                                                                            <div className="text-[10px] font-medium text-blue-600">Status: {ag.agent_status || 'N/A'}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : <span className="text-slate-400 italic">None</span>}
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Buying Agents ({item.buying_agents?.length || 0})</span>
                                                                            {item.buying_agents && item.buying_agents.length > 0 ? (
                                                                                <div className="space-y-1">
                                                                                    {item.buying_agents.map((ag, i) => (
                                                                                        <div key={i} className="p-1.5 rounded bg-purple-50/50 border border-purple-100 text-[11px]">
                                                                                            <div className="font-bold text-purple-900">{ag.display_name}</div>
                                                                                            <div className="text-[10px] font-medium text-purple-600">Status: {ag.agent_status || 'N/A'}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : <span className="text-slate-400 italic">None</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Column 3: Financials & Deposit Account */}
                                                                <div className="space-y-3">
                                                                    <h5 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                                                                        Financials & Account
                                                                    </h5>
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Property Price</span>
                                                                            <span className="font-bold text-slate-900">{formatCurrency(item.price)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Gross Commission (GCI)</span>
                                                                            <span className="font-bold text-blue-600">{formatCurrency(item.gci)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Advance Amount</span>
                                                                            <span className="font-bold text-emerald-600">{formatCurrency(item.amount)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Deposit Account</span>
                                                                            <span className="font-semibold text-slate-800">{item.commission_deposit_account || '—'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Column 4: Dates & Approval Workflows */}
                                                                <div className="space-y-3">
                                                                    <h5 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                                                                        Dates & Workflows
                                                                    </h5>
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Contract On</span>
                                                                            <span className="font-semibold text-slate-800">{formatDateUS(item.contract_on)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Closed On</span>
                                                                            <span className="font-semibold text-slate-800">{formatDateUS(item.closed_on)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Overall Status</span>
                                                                            <div className="mt-0.5">{renderStatusBadge(item.status)}</div>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Approved for Commission</span>
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${
                                                                                item.approved_for_commission ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                                                                            }`}>
                                                                                {item.approved_for_commission ? '✓ Approved' : '✕ Pending'}
                                                                            </span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Approved for Processing</span>
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${
                                                                                item.approved_for_processing ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                                                                            }`}>
                                                                                {item.approved_for_processing ? '✓ Approved' : '✕ Pending'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* API Backend Pagination Controls below the listing view */}
            {!loading && !error && (
                <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-sm mt-4">
                    <div className="text-xs font-semibold text-slate-500 select-none">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(prev => Math.max(1, prev - 1))}
                            disabled={page === 1}
                            className="font-semibold select-none text-xs"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={page === totalPages}
                            className="font-semibold select-none text-xs"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CommissionAdvancesFlow;
