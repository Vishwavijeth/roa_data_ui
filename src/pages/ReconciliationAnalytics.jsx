import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import DateFilterInput from '../components/shared/DateFilterInput';
import MultiSelect from '../components/shared/MultiSelect';
import { API_DOMAIN } from '../constants';

function ReconciliationAnalytics({
    fromCloseDate = '',
    setFromCloseDate = () => {},
    toCloseDate = '',
    setToCloseDate = () => {},
    selectedSpecialists = [],
    setSelectedSpecialists = () => {},
    selectedReviewers = [],
    setSelectedReviewers = () => {},
    selectedStatuses = [],
    setSelectedStatuses = () => {},
    onSeeTransactions = () => {}
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Available filter option lists (cached from API filters on initial load)
    const [filtersOptions, setFiltersOptions] = useState({
        transaction_specialist: [],
        reviewer: [],
        status: []
    });

    useEffect(() => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (fromCloseDate) params.append('from_close_date', fromCloseDate);
        if (toCloseDate) params.append('to_close_date', toCloseDate);
        
        if (selectedSpecialists && selectedSpecialists.length > 0) {
            selectedSpecialists.forEach(s => {
                params.append('transaction_specialist', s);
                params.append('specialist', s);
            });
        }
        if (selectedReviewers && selectedReviewers.length > 0) {
            selectedReviewers.forEach(r => params.append('reviewer', r));
        }
        if (selectedStatuses && selectedStatuses.length > 0) {
            selectedStatuses.forEach(s => params.append('status', s));
        }

        const url = `${API_DOMAIN}/reconciliation/analytics?${params.toString()}`;

        fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`API error: ${res.status} ${res.statusText}`);
                }
                return res.json();
            })
            .then(json => {
                const responseData = json.data ? json.data : json;
                setData(responseData || {});
                
                // Only populate the filters list once so we preserve options when filtering
                const filters = json.filters || (json.data && json.data.filters);
                if (filters) {
                    setFiltersOptions(prev => {
                        const hasSpecialist = prev.transaction_specialist && prev.transaction_specialist.length > 0;
                        const hasReviewer = prev.reviewer && prev.reviewer.length > 0;
                        const hasStatus = prev.status && prev.status.length > 0;
                        
                        if (hasSpecialist && hasReviewer && hasStatus) {
                            return prev;
                        }
                        
                        return {
                            transaction_specialist: Array.isArray(filters.transaction_specialist) 
                                ? [...filters.transaction_specialist].sort() 
                                : prev.transaction_specialist,
                            reviewer: Array.isArray(filters.reviewer) 
                                ? [...filters.reviewer].sort() 
                                : prev.reviewer,
                            status: Array.isArray(filters.status) 
                                ? [...filters.status].sort() 
                                : prev.status
                        };
                    });
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('[Analytics Fetch Error]', err);
                setError(err.message);
                setLoading(false);
            });
    }, [fromCloseDate, toCloseDate, selectedSpecialists, selectedReviewers, selectedStatuses]);

    const hasActiveFilters = fromCloseDate || toCloseDate || selectedSpecialists.length > 0 || selectedReviewers.length > 0 || selectedStatuses.length > 0;

    const handleClearFilters = () => {
        setFromCloseDate('');
        setToCloseDate('');
        setSelectedSpecialists([]);
        setSelectedReviewers([]);
        setSelectedStatuses([]);
    };

    // Calculate distributions and lists for rendering
    const stats = React.useMemo(() => {
        if (!data) return null;

        const overview = data.overview || {};
        const total = overview.total_records ?? data.total_records ?? 0;
        const sale = overview.total_sale_income ?? data.total_sale_income ?? 0;
        const other = overview.total_other_income ?? data.total_other_income ?? 0;
        const mismatched = overview.mismatched_transactions ?? data.mismatched_transactions ?? 0;

        const salePct = total > 0 ? ((sale / total) * 100).toFixed(1) : '0.0';
        const otherPct = total > 0 ? ((other / total) * 100).toFixed(1) : '0.0';
        const mismatchPct = total > 0 ? ((mismatched / total) * 100).toFixed(1) : '0.0';

        // Prepare parameter mismatch counts for bar visualizer
        const paramKeys = [
            { key: 'gross_commission', label: 'Gross Commission', color: 'from-rose-400 to-rose-600' },
            { key: 'close_date', label: 'Close Date', color: 'from-amber-400 to-amber-600' },
            { key: 'status', label: 'Status', color: 'from-orange-400 to-orange-600' },
            { key: 'sale_price', label: 'Sale Price', color: 'from-red-400 to-red-600' },
            { key: 'listing_price', label: 'Listing Price', color: 'from-yellow-400 to-yellow-600' },
            { key: 'contract_date', label: 'Contract Date', color: 'from-violet-400 to-violet-600' },
            { key: 'buyer_name', label: 'Buyer Name', color: 'from-emerald-400 to-emerald-600' },
            { key: 'seller_name', label: 'Seller Name', color: 'from-teal-400 to-teal-600' },
            { key: 'buying_agent_name', label: 'Buying Agent Name', color: 'from-sky-400 to-sky-600' },
            { key: 'title_company', label: 'Title Company', color: 'from-indigo-400 to-indigo-600' },
        ];

        const breakdownData = data.parameter_breakdown?.data || data.parameter_breakdown || {};

        const paramMismatches = paramKeys
            .map(item => {
                const count = breakdownData[item.key] ?? data[item.key] ?? 0;
                const percentage = total > 0 ? ((count / total) * 100) : 0;
                return {
                    ...item,
                    count,
                    percentage
                };
            })
            .sort((a, b) => b.count - a.count); // sort descending

        const statusDist = Array.isArray(data.status_distribution) 
            ? data.status_distribution 
            : [];

        return {
            total,
            sale,
            other,
            mismatched,
            salePct,
            otherPct,
            mismatchPct,
            paramMismatches,
            statusDist
        };
    }, [data]);

    return (
        <div className="space-y-6">
            {/* Filter Card */}
            <Card className="shadow-sm border-slate-100 bg-white">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                                </svg>
                                Filter Analytics
                            </span>
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    onClick={handleClearFilters}
                                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 font-semibold"
                                >
                                    Clear Filters
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label htmlFor="analytics-close-date-from" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Close Date From
                                </label>
                                <DateFilterInput
                                    id="analytics-close-date-from"
                                    value={fromCloseDate}
                                    onChange={setFromCloseDate}
                                    placeholder="MM/DD/YYYY"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="analytics-close-date-to" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Close Date To
                                </label>
                                <DateFilterInput
                                    id="analytics-close-date-to"
                                    value={toCloseDate}
                                    onChange={setToCloseDate}
                                    placeholder="MM/DD/YYYY"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="analytics-specialist" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Transaction Specialist
                                </label>
                                <MultiSelect
                                    id="analytics-specialist"
                                    options={filtersOptions.transaction_specialist}
                                    selected={selectedSpecialists}
                                    onChange={setSelectedSpecialists}
                                    placeholder="All Specialists"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="analytics-reviewer" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Reviewer
                                </label>
                                <MultiSelect
                                    id="analytics-reviewer"
                                    options={filtersOptions.reviewer}
                                    selected={selectedReviewers}
                                    onChange={setSelectedReviewers}
                                    placeholder="All Reviewers"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="analytics-status" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Status
                                </label>
                                <MultiSelect
                                    id="analytics-status"
                                    options={filtersOptions.status}
                                    selected={selectedStatuses}
                                    onChange={setSelectedStatuses}
                                    placeholder="All Statuses"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                // Premium Skeletons when loading
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="bg-white border-slate-100 shadow-sm">
                                <CardContent className="pt-6 pb-6">
                                    <Skeleton className="h-4 w-28 mb-3" />
                                    <Skeleton className="h-8 w-24 mb-4" />
                                    <Skeleton className="h-2 w-full rounded-full" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <Card className="lg:col-span-3 bg-white border-slate-100 shadow-sm">
                            <CardContent className="p-6">
                                <Skeleton className="h-6 w-48 mb-6" />
                                <div className="space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-4 w-16" />
                                            </div>
                                            <Skeleton className="h-3 w-full rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-2 bg-white border-slate-100 shadow-sm">
                            <CardContent className="p-6">
                                <Skeleton className="h-6 w-36 mb-6" />
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <Card key={i} className="bg-slate-50 border-slate-100">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <Skeleton className="h-4 w-20" />
                                                    <Skeleton className="h-2 w-2/3" />
                                                </div>
                                                <Skeleton className="h-6 w-12 rounded" />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : error ? (
                <div className="p-12 bg-white rounded-xl border border-red-100 shadow-sm text-center space-y-3">
                    <div className="text-4xl">⚠️</div>
                    <h3 className="text-base font-bold text-red-600">Failed to Load Analytics</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
                </div>
            ) : !stats || stats.total === 0 ? (
                <div className="p-16 bg-white rounded-xl border border-slate-100 shadow-sm text-center space-y-2">
                    <div className="text-4xl">📊</div>
                    <h3 className="text-sm font-bold text-slate-800">No Analytics Data Found</h3>
                    <p className="text-xs text-slate-400">Try loosening your filter parameters.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Metrics Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {/* Total Records Card */}
                        <Card className="hover:shadow-md border-slate-100 hover:border-slate-200 transition-all select-none bg-white relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500" />
                            <CardContent className="pt-6 pb-5">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Records Analyzed</span>
                                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 group-hover:scale-110 transition-transform">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </span>
                                </div>
                                <div className="text-3xl font-extrabold text-slate-800 mt-2 flex items-baseline gap-2">
                                    {stats.total.toLocaleString()}
                                    <span className="text-xs font-semibold text-slate-400 font-mono">records</span>
                                </div>
                                {/* Stacked distribution preview */}
                                <div className="mt-5 space-y-1.5">
                                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                                        <div className="h-full bg-indigo-500 rounded-l" style={{ width: `${stats.salePct}%` }} title={`Sale Income: ${stats.salePct}%`} />
                                        <div className="h-full bg-emerald-500 rounded-r" style={{ width: `${stats.otherPct}%` }} title={`Other Income: ${stats.otherPct}%`} />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            Sale: {stats.salePct}%
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Other: {stats.otherPct}%
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Mismatched Transactions Card */}
                        <Card className="hover:shadow-md border-rose-100 hover:border-rose-200 transition-all select-none bg-white relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
                            <CardContent className="pt-6 pb-5">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mismatched Transactions</span>
                                    <span className="p-1.5 rounded-lg bg-rose-50 text-rose-500 group-hover:scale-110 transition-transform">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </span>
                                </div>
                                <div className="text-3xl font-extrabold text-rose-600 mt-2 flex items-baseline gap-2">
                                    {stats.mismatched.toLocaleString()}
                                    <span className="text-xs font-semibold text-rose-500/80 font-mono">({stats.mismatchPct}%)</span>
                                </div>
                                <div className="mt-5 space-y-1.5">
                                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full" style={{ width: `${stats.mismatchPct}%` }} />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider text-right">
                                        Mismatch prevalence rate
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Income Type Splits */}
                        <Card className="hover:shadow-md border-slate-100 hover:border-slate-200 transition-all select-none bg-white relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />
                            <CardContent className="pt-6 pb-5">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Income Category Breakdown</span>
                                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500 group-hover:scale-110 transition-transform">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sale Income</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-lg font-bold text-slate-800">{stats.sale.toLocaleString()}</span>
                                            <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-50 border-0 text-[10px] px-1 py-0 rounded font-mono font-bold">
                                                {stats.salePct}%
                                            </Badge>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${stats.salePct}%` }} />
                                        </div>
                                    </div>
                                    <div className="border-l border-slate-100 pl-4 space-y-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Other Income</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-lg font-bold text-slate-800">{stats.other.toLocaleString()}</span>
                                            <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0 text-[10px] px-1 py-0 rounded font-mono font-bold">
                                                {stats.otherPct}%
                                            </Badge>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.otherPct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Split layout: Mismatch breakdown vs Status distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Parameter breakdown list */}
                        <Card className="lg:col-span-3 shadow-sm border-slate-100 bg-white overflow-hidden">
                            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/20">
                                <h2 className="text-sm font-bold text-slate-800">
                                    Mismatch Distribution by Parameter
                                </h2>
                                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                    A transaction can appear in multiple parameter categories.
                                </p>
                            </div>
                            <CardContent className="p-6">
                                <div className="space-y-4.5">
                                    {stats.paramMismatches.map((param) => (
                                        <div key={param.key} className="group/row space-y-1.5 p-2.5 hover:bg-slate-50/80 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-700 capitalize group-hover/row:text-slate-900 transition-colors">
                                                        {param.label}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onSeeTransactions && onSeeTransactions(param.key)}
                                                        className="h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/60 font-bold flex items-center gap-1 transition-all rounded bg-slate-50 border border-slate-200/50 group-hover/row:border-indigo-200"
                                                    >
                                                        See Transactions
                                                        <svg className="h-2.5 w-2.5 transition-transform group-hover/row:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-2 font-mono">
                                                    <span className="font-bold text-slate-900">
                                                        {param.count.toLocaleString()}
                                                    </span>
                                                    <span className="text-slate-400 text-[10px]">
                                                        ({param.percentage.toFixed(1)}% of total)
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${param.color || 'from-indigo-400 to-indigo-600'}`}
                                                    style={{ width: `${param.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Status distribution list */}
                        <Card className="lg:col-span-2 shadow-sm border-slate-100 bg-white overflow-hidden">
                            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/20">
                                <h2 className="text-sm font-bold text-slate-800">
                                    Status Distribution
                                </h2>
                            </div>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {stats.statusDist.map((item) => {
                                        const statusLower = item.status?.toLowerCase();
                                        
                                        // Pick color styles and icons based on status
                                        let statusColor = 'from-slate-400 to-slate-500';
                                        let statusBg = 'bg-slate-50';
                                        let statusBorder = 'border-slate-100 hover:border-slate-200';
                                        let iconColor = 'text-slate-400 bg-slate-100';
                                        let iconSvg = (
                                            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        );

                                        if (statusLower === 'closed') {
                                            statusColor = 'from-emerald-400 to-emerald-600';
                                            statusBg = 'bg-emerald-50/20';
                                            statusBorder = 'border-emerald-100 hover:border-emerald-200';
                                            iconColor = 'text-emerald-500 bg-emerald-50';
                                            iconSvg = (
                                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                </svg>
                                            );
                                        } else if (statusLower === 'pending') {
                                            statusColor = 'from-amber-400 to-amber-600';
                                            statusBg = 'bg-amber-50/20';
                                            statusBorder = 'border-amber-100 hover:border-amber-200';
                                            iconColor = 'text-amber-500 bg-amber-50';
                                            iconSvg = (
                                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            );
                                        } else if (statusLower === 'cancelled') {
                                            statusColor = 'from-rose-400 to-rose-600';
                                            statusBg = 'bg-rose-50/20';
                                            statusBorder = 'border-rose-100 hover:border-rose-200';
                                            iconColor = 'text-rose-500 bg-rose-50';
                                            iconSvg = (
                                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            );
                                        }

                                        const itemPct = stats.total > 0 ? ((item.count / stats.total) * 100).toFixed(1) : '0.0';

                                        return (
                                            <Card key={item.status} className={`transition-all select-none bg-white border ${statusBorder} hover:shadow-sm`}>
                                                <CardContent className="p-4 flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className={`p-2 rounded-lg shrink-0 ${iconColor}`}>
                                                            {iconSvg}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                                                            <span className="text-sm font-bold text-slate-700 capitalize block truncate">
                                                                {item.status || 'unknown'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-col items-end shrink-0 space-y-1">
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="text-base font-extrabold text-slate-800 font-mono">
                                                                {item.count.toLocaleString()}
                                                            </span>
                                                            <span className="text-[10px] font-semibold text-slate-400">
                                                                ({itemPct}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full bg-gradient-to-r ${statusColor}`} style={{ width: `${itemPct}%` }} />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReconciliationAnalytics;
