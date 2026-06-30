import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import DateFilterInput from '../components/shared/DateFilterInput';

function ReconciliationAnalytics({
    fromCloseDate = '',
    setFromCloseDate = () => {},
    toCloseDate = '',
    setToCloseDate = () => {},
    transactionSpecialist = '',
    setTransactionSpecialist = () => {},
    reviewer = '',
    setReviewer = () => {},
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
        if (transactionSpecialist) params.append('transaction_specialist', transactionSpecialist);
        if (reviewer) params.append('reviewer', reviewer);

        const url = `https://roa-data-backend.vercel.app/reconciliation/analytics?${params.toString()}`;

        fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`API error: ${res.status} ${res.statusText}`);
                }
                return res.json();
            })
            .then(json => {
                setData(json.data || {});
                
                // Only populate the filters list once so we preserve options when filtering
                if (json.filters) {
                    setFiltersOptions(prev => {
                        const hasSpecialist = prev.transaction_specialist && prev.transaction_specialist.length > 0;
                        const hasReviewer = prev.reviewer && prev.reviewer.length > 0;
                        
                        if (hasSpecialist && hasReviewer) {
                            return prev;
                        }
                        
                        return {
                            transaction_specialist: Array.isArray(json.filters.transaction_specialist) 
                                ? [...json.filters.transaction_specialist].sort() 
                                : [],
                            reviewer: Array.isArray(json.filters.reviewer) 
                                ? [...json.filters.reviewer].sort() 
                                : [],
                            status: Array.isArray(json.filters.status) 
                                ? [...json.filters.status].sort() 
                                : []
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
    }, [fromCloseDate, toCloseDate, transactionSpecialist, reviewer]);

    const hasActiveFilters = fromCloseDate || toCloseDate || transactionSpecialist || reviewer;

    const handleClearFilters = () => {
        setFromCloseDate('');
        setToCloseDate('');
        setTransactionSpecialist('');
        setReviewer('');
    };

    // Calculate distributions and lists for rendering
    const stats = React.useMemo(() => {
        if (!data) return null;

        const total = data.total_records || 0;
        const sale = data.total_sale_income || 0;
        const other = data.total_other_income || 0;
        const highDiscrepancy = data.transactions_with_more_than_2_mismatches || 0;

        const salePct = total > 0 ? ((sale / total) * 100).toFixed(1) : '0.0';
        const otherPct = total > 0 ? ((other / total) * 100).toFixed(1) : '0.0';
        const highPct = total > 0 ? ((highDiscrepancy / total) * 100).toFixed(1) : '0.0';

        // Prepare parameter mismatch counts for bar visualizer
        const paramKeys = [
            { key: 'gross_commission', label: 'Gross Commission', color: 'bg-rose-500' },
            { key: 'close_date', label: 'Close Date', color: 'bg-amber-500' },
            { key: 'status', label: 'Status', color: 'bg-orange-500' },
            { key: 'sale_price', label: 'Sale Price', color: 'bg-red-500' },
            { key: 'listing_price', label: 'Listing Price', color: 'bg-yellow-500' },
            { key: 'buyer_name', label: 'Buyer Name', color: 'bg-emerald-500' },
            { key: 'seller_name', label: 'Seller Name', color: 'bg-teal-500' },
            { key: 'buying_agent_name', label: 'Buying Agent Name', color: 'bg-sky-500' },
            { key: 'title_company', label: 'Title Company', color: 'bg-indigo-500' },
        ];

        const paramMismatches = paramKeys
            .map(item => {
                const count = data[item.key] || 0;
                const percentage = total > 0 ? ((count / total) * 100) : 0;
                return {
                    ...item,
                    count,
                    percentage
                };
            })
            .sort((a, b) => b.count - a.count); // sort descending

        return {
            total,
            sale,
            other,
            highDiscrepancy,
            salePct,
            otherPct,
            highPct,
            paramMismatches
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
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
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
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
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Transaction Specialist
                                </label>
                                <Select
                                    id="analytics-specialist"
                                    value={transactionSpecialist}
                                    onChange={e => setTransactionSpecialist(e.target.value)}
                                >
                                    <option value="">All Specialists</option>
                                    {filtersOptions.transaction_specialist.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Reviewer
                                </label>
                                <Select
                                    id="analytics-reviewer"
                                    value={reviewer}
                                    onChange={e => setReviewer(e.target.value)}
                                >
                                    <option value="">All Reviewers</option>
                                    {filtersOptions.reviewer.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                // Skeletons when loading
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="bg-white border-slate-100">
                                <CardContent className="pt-6">
                                    <Skeleton className="h-4 w-28 mb-2" />
                                    <Skeleton className="h-8 w-20" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Card className="bg-white border-slate-100">
                        <CardContent className="p-6">
                            <Skeleton className="h-6 w-48 mb-4" />
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex items-center gap-4">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 flex-1" />
                                        <Skeleton className="h-4 w-12" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : error ? (
                <div className="p-12 bg-white rounded-xl border border-red-100 text-center space-y-3">
                    <div className="text-4xl">⚠️</div>
                    <h3 className="text-base font-bold text-red-600">Failed to Load Analytics</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
                </div>
            ) : !stats || stats.total === 0 ? (
                <div className="p-16 bg-white rounded-xl border border-slate-100 text-center space-y-2">
                    <div className="text-4xl">📊</div>
                    <h3 className="text-sm font-bold text-slate-800">No Analytics Data Found</h3>
                    <p className="text-xs text-slate-400">Try loosening your filter parameters.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Metrics Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <Card className="hover:border-slate-300 transition-all select-none bg-white">
                            <CardContent className="pt-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Records Analyzed</span>
                                <div className="text-3xl font-extrabold text-slate-800 mt-2 flex items-baseline gap-2">
                                    {stats.total.toLocaleString()}
                                    <span className="text-xs font-semibold text-slate-400">transactions</span>
                                </div>
                                {/* Stacked distribution preview */}
                                <div className="mt-4 space-y-1.5">
                                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                                        <div className="h-full bg-indigo-500" style={{ width: `${stats.salePct}%` }} title={`Sale Income: ${stats.salePct}%`} />
                                        <div className="h-full bg-emerald-500" style={{ width: `${stats.otherPct}%` }} title={`Other Income: ${stats.otherPct}%`} />
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

                        <Card className="hover:border-slate-300 transition-all select-none bg-white">
                            <CardContent className="pt-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Sale vs Other Income</span>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Sale Income</span>
                                        <span className="text-lg font-bold text-indigo-600 block mt-0.5">{stats.sale.toLocaleString()}</span>
                                    </div>
                                    <div className="border-l border-slate-100 pl-4">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Other Income</span>
                                        <span className="text-lg font-bold text-emerald-600 block mt-0.5">{stats.other.toLocaleString()}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="hover:border-rose-200 hover:bg-rose-50/5 transition-all select-none bg-white">
                            <CardContent className="pt-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">High Discrepancy Records</span>
                                <div className="text-3xl font-extrabold text-rose-600 mt-2 flex items-baseline gap-2">
                                    {stats.highDiscrepancy.toLocaleString()}
                                    <span className="text-xs font-semibold text-rose-500/80">({stats.highPct}% of total)</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-semibold block mt-3 uppercase tracking-wider">
                                    Transactions with &gt; 2 mismatched parameters
                                </span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Mismatch Parameter Distribution */}
                    <Card className="shadow-sm border-slate-100 bg-white">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-800">
                                Mismatch Distribution by Parameter
                            </h2>
                            <Badge variant="secondary" className="px-2.5 py-0.5 font-bold text-[10px] rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Mismatches per parameter
                            </Badge>
                        </div>
                        <CardContent className="p-6">
                            <div className="space-y-5">
                                {stats.paramMismatches.map((param) => (
                                    <div key={param.key} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-700 capitalize">
                                                    {param.label}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onSeeTransactions && onSeeTransactions(param.key)}
                                                    className="h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold flex items-center gap-1 transition-all rounded bg-slate-50 border border-slate-100 hover:border-indigo-100"
                                                >
                                                    See Transactions
                                                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-2 font-mono">
                                                <span className="font-bold text-slate-900">
                                                    {param.count.toLocaleString()}
                                                </span>
                                                <span className="text-slate-400 text-[10px]">
                                                    ({param.percentage.toFixed(2)}% of total records)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${param.color || 'bg-blue-600'}`}
                                                style={{ width: `${param.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Assignments / Performance Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top Specialist Card */}
                        {data.top_transaction_specialist && (
                            <Card className="shadow-sm border-slate-100 bg-white">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                                    <h3 className="text-sm font-bold text-slate-800">
                                        Top Specialist with Mismatches
                                    </h3>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Specialist Name</span>
                                            <span className="text-base font-bold text-slate-800">
                                                {data.top_transaction_specialist.name || 'Unassigned'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                        <div>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Mismatch Transactions</span>
                                            <span className="text-xl font-bold text-slate-800 block mt-0.5">
                                                {(data.top_transaction_specialist.mismatch_transactions || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Critical Mismatches (&gt;2)</span>
                                            <span className="text-xl font-bold text-rose-600 block mt-0.5">
                                                {(data.top_transaction_specialist.mismatch_transactions_gt_2 || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Top Reviewer Card */}
                        {data.top_reviewer && (
                            <Card className="shadow-sm border-slate-100 bg-white">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                                    <h3 className="text-sm font-bold text-slate-800">
                                        Top Reviewer with Mismatches
                                    </h3>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Reviewer Name</span>
                                            <span className="text-base font-bold text-slate-800">
                                                {data.top_reviewer.name || 'Unassigned'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                        <div>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Mismatch Transactions</span>
                                            <span className="text-xl font-bold text-slate-800 block mt-0.5">
                                                {(data.top_reviewer.mismatch_transactions || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Critical Mismatches (&gt;2)</span>
                                            <span className="text-xl font-bold text-rose-600 block mt-0.5">
                                                {(data.top_reviewer.mismatch_transactions_gt_2 || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReconciliationAnalytics;
