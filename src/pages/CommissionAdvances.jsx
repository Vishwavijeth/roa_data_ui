import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatDateUS } from '../utils/helpers';
import { IconArrowLeft } from '../components/shared/Icons';
import {
    COMMISSION_ADVANCES_SUMMARY_API,
    COMMISSION_ADVANCES_LISTING_API,
    COMMISSION_ADVANCES_DETAIL_API,
    COMMISSION_ADVANCES_DROPDOWN_API,
    COMMISSION_ADVANCES_STATUS_DROPDOWN_API,
    COMMISSION_ADVANCES_SUGGESTIONS_API,
    COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API,
    COMMISSION_ADVANCES_LOG_API,
    COMMISSION_ADVANCES_EDIT_API,
    ROWS_PER_PAGE
} from '../constants';

function CommissionAdvances() {
    // ── Routing / Hash State ───────────────────────────────────────────────────
    const parseHash = () => {
        const parts = window.location.hash.split('?');
        const params = parts.length > 1 ? new URLSearchParams(parts[1]) : new URLSearchParams();
        return {
            agentName: params.get('agent_name') || '',
            view: params.get('view') || '',
        };
    };

    const [activeAgentName, setActiveAgentName] = useState(() => parseHash().agentName);
    const [activeView, setActiveView] = useState(() => parseHash().view);

    useEffect(() => {
        const handleHashChange = () => {
            const { agentName, view } = parseHash();
            setActiveAgentName(agentName);
            setActiveView(view);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleViewDetail = (agentName) => {
        window.location.hash = `commission_advances?agent_name=${encodeURIComponent(agentName)}`;
    };

    const handleBackToList = () => {
        window.location.hash = 'commission_advances';
    };

    const handleGoToLogAdvance = () => {
        window.location.hash = 'commission_advances?view=log_advance';
    };

    // ── Log Advance Form State ─────────────────────────────────────────────────
    const [logForm, setLogForm] = useState({
        agent_name: '',
        address: '',
        company: '',
        state: '',
        amount: '',
        date: '',
        notes: '',
    });
    const [logSubmitting, setLogSubmitting] = useState(false);
    const [logSuccess, setLogSuccess] = useState(false);
    const [logError, setLogError] = useState(null);

    const handleLogFormChange = (e) => {
        const { name, value } = e.target;
        setLogForm(prev => ({ ...prev, [name]: value }));
    };

    const handleLogFormSubmit = async (e) => {
        e.preventDefault();
        setLogSubmitting(true);
        setLogError(null);
        setLogSuccess(false);
        try {
            const res = await fetch(COMMISSION_ADVANCES_LOG_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name:    logForm.agent_name.trim(),
                    amount:        parseFloat(logForm.amount) || 0,
                    address:       logForm.address.trim(),
                    company:       logForm.company.trim(),
                    approved_date: logForm.date || null,
                    notes:         logForm.notes.trim() || null,
                    saleguid:      selectedAddressInfo?.saleguid || null,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.message || json.detail || `Server error: ${res.status}`);
            }
            setLogSuccess(true);
            setTimeout(() => setLogSuccess(false), 3000);
            setLogForm({ agent_name: '', address: '', company: '', state: '', amount: '', date: '', notes: '' });
            setSelectedAgentInfo(null);
            setSelectedAddressInfo(null);
        } catch (err) {
            setLogError(err.message);
        } finally {
            setLogSubmitting(false);
        }
    };

    // ── Dropdown Options State (State & Company) ──────────────────────────────
    const [dropdownOptions, setDropdownOptions] = useState({ state: [], company: [] });

    useEffect(() => {
        if (activeView !== 'log_advance') return;
        let active = true;
        fetch(COMMISSION_ADVANCES_DROPDOWN_API)
            .then(res => res.json())
            .then(json => {
                if (!active) return;
                if (json.success && json.filters) {
                    setDropdownOptions({
                        state: json.filters.state || [],
                        company: json.filters.company || [],
                    });
                }
            })
            .catch(err => console.error('Failed to load log dropdowns:', err));

        return () => { active = false; };
    }, [activeView]);

    // ── Agent Name, Address & Company Suggestions ────────────────────────────
    const [agentSuggestions, setAgentSuggestions] = useState([]);
    const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
    const [fetchingAgentSuggestions, setFetchingAgentSuggestions] = useState(false);
    const agentJustSelectedRef = useRef(false);
    const [selectedAgentInfo, setSelectedAgentInfo] = useState(null);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const addressJustSelectedRef = useRef(false);
    const [selectedAddressInfo, setSelectedAddressInfo] = useState(null);
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

    // Fetch Agent Suggestions
    useEffect(() => {
        // If user just selected from dropdown, skip this re-run
        if (agentJustSelectedRef.current) {
            agentJustSelectedRef.current = false;
            return;
        }
        if (activeView !== 'log_advance' || !logForm.agent_name || logForm.agent_name.trim().length < 1) {
            setAgentSuggestions([]);
            setShowAgentSuggestions(false);
            setFetchingAgentSuggestions(false);
            return;
        }

        // Show inline spinner immediately; dropdown only opens when results arrive
        setFetchingAgentSuggestions(true);

        let active = true;
        const timer = setTimeout(() => {
            fetch(`${COMMISSION_ADVANCES_SUGGESTIONS_API}?q=${encodeURIComponent(logForm.agent_name.trim())}&limit=8`)
                .then(res => res.json())
                .then(json => {
                    if (!active) return;
                    let list = [];
                    if (json.success && json.filters && Array.isArray(json.filters.agent_name)) {
                        list = json.filters.agent_name;
                    } else if (Array.isArray(json)) {
                        list = json;
                    } else if (json.data && Array.isArray(json.data)) {
                        list = json.data;
                    }
                    setAgentSuggestions(list);
                    setShowAgentSuggestions(list.length > 0);
                })
                .catch(err => console.error(err))
                .finally(() => { if (active) setFetchingAgentSuggestions(false); });
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [logForm.agent_name, activeView]);

    // Fetch Address Suggestions
    useEffect(() => {
        // If user just selected from dropdown, skip this re-run
        if (addressJustSelectedRef.current) {
            addressJustSelectedRef.current = false;
            return;
        }
        if (activeView !== 'log_advance' || !logForm.address || logForm.address.trim().length < 1) {
            setAddressSuggestions([]);
            setShowAddressSuggestions(false);
            return;
        }

        let active = true;
        const timer = setTimeout(() => {
            fetch(`${COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API}?q=${encodeURIComponent(logForm.address.trim())}&limit=5`)
                .then(res => res.json())
                .then(json => {
                    if (!active) return;
                    let list = [];
                    if (json.success && json.filters && Array.isArray(json.filters.address)) {
                        list = json.filters.address;
                    } else if (Array.isArray(json)) {
                        list = json;
                    } else if (json.data && Array.isArray(json.data)) {
                        list = json.data;
                    }

                    setAddressSuggestions(list);
                    setShowAddressSuggestions(list.length > 0);
                })
                .catch(err => console.error(err));
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [logForm.address, activeView]);

    // ── Summary Data State ─────────────────────────────────────────────────────
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    // Fetch summary metrics on mount
    useEffect(() => {
        setSummaryLoading(true);
        fetch(COMMISSION_ADVANCES_SUMMARY_API)
            .then(res => {
                if (!res.ok) throw new Error(`Summary API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (json.success && json.data) {
                    setSummaryData(json.data);
                } else {
                    throw new Error(json.message || 'Failed to fetch summary data');
                }
                setSummaryLoading(false);
            })
            .catch(err => {
                console.error(err);
                setSummaryError(err.message);
                setSummaryLoading(false);
            });
    }, []);

    // ── Status Filter Options State ────────────────────────────────────────────
    const [statusOptions, setStatusOptions] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        let active = true;
        fetch(COMMISSION_ADVANCES_STATUS_DROPDOWN_API)
            .then(res => {
                if (!res.ok) throw new Error(`Status dropdown error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                if (json.success && json.filters && Array.isArray(json.filters.status)) {
                    setStatusOptions([...json.filters.status].sort());
                }
            })
            .catch(err => console.error('Failed to load status dropdown options:', err));

        return () => { active = false; };
    }, []);

    // ── Listing Data State ─────────────────────────────────────────────────────
    const [items, setItems] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [listingLoading, setListingLoading] = useState(false);
    const [listingError, setListingError] = useState(null);

    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch paginated listing data
    useEffect(() => {
        // Only run fetch listing if we are NOT on the detail page or log advance page
        if (activeAgentName || activeView === 'log_advance') return;

        let active = true;
        setListingLoading(true);
        setListingError(null);

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', ROWS_PER_PAGE);
        if (debouncedSearchQuery.trim()) {
            params.append('search', debouncedSearchQuery.trim());
        }
        if (statusFilter) {
            params.append('status', statusFilter);
        }

        const url = `${COMMISSION_ADVANCES_LISTING_API}?${params.toString()}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`Listing API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                if (json.success && json.data) {
                    setItems(json.data.items || []);
                    setTotalCount(json.data.total_count ?? 0);
                } else {
                    throw new Error(json.message || 'Failed to load listing data');
                }
                setListingLoading(false);
            })
            .catch(err => {
                if (!active) return;
                console.error(err);
                setListingError(err.message);
                setListingLoading(false);
            });

        return () => {
            active = false;
        };
    }, [page, debouncedSearchQuery, statusFilter, activeAgentName, activeView]);

    // Apply a robust client-side filter fallback in case the backend does not implement search parameters
    const filteredItems = React.useMemo(() => {
        let list = items;
        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase();
            const hasUnfiltered = list.some(item => !item.agent_name.toLowerCase().includes(query));
            if (hasUnfiltered) {
                list = list.filter(item => item.agent_name.toLowerCase().includes(query));
            }
        }
        if (statusFilter) {
            const sfNorm = statusFilter.toLowerCase().replace(/_/g, ' ');
            const hasUnfilteredStatus = list.some(item => {
                if (!item.status_breakdown) return true;
                const activeStatuses = Object.keys(item.status_breakdown).filter(k => item.status_breakdown[k] > 0);
                return !activeStatuses.some(st => st.toLowerCase().replace(/_/g, ' ') === sfNorm);
            });
            if (hasUnfilteredStatus) {
                list = list.filter(item => {
                    if (!item.status_breakdown) return false;
                    const entries = Object.entries(item.status_breakdown).filter(([_, count]) => count > 0);
                    return entries.some(([k, _]) => k.toLowerCase().replace(/_/g, ' ') === sfNorm);
                });
            }
        }
        return list;
    }, [items, debouncedSearchQuery, statusFilter]);

    const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE) || 1;

    // ── Detail Data State ──────────────────────────────────────────────────────
    const [detailItems, setDetailItems] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);

    // Fetch agent detail when activeAgentName changes
    useEffect(() => {
        if (!activeAgentName) {
            setDetailItems([]);
            return;
        }

        let active = true;
        setDetailLoading(true);
        setDetailError(null);

        const detailUrl = `${COMMISSION_ADVANCES_DETAIL_API}?agent_name=${encodeURIComponent(activeAgentName)}`;

        fetch(detailUrl)
            .then(res => {
                if (!res.ok) throw new Error(`Detail API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                if (json.success && json.data) {
                    setDetailItems(json.data.items || []);
                } else {
                    throw new Error(json.message || 'Failed to load details');
                }
                setDetailLoading(false);
            })
            .catch(err => {
                if (!active) return;
                console.error(err);
                setDetailError(err.message);
                setDetailLoading(false);
            });

        return () => {
            active = false;
        };
    }, [activeAgentName]);

    // ── Edit Modal State ───────────────────────────────────────────────────────
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editSuccess, setEditSuccess] = useState(false);
    const [editError, setEditError] = useState(null);
    const [editStatusOptions, setEditStatusOptions] = useState([]);

    // Fetch status options whenever the modal opens
    useEffect(() => {
        if (!editItem) return;
        let active = true;
        fetch(COMMISSION_ADVANCES_STATUS_DROPDOWN_API)
            .then(res => res.json())
            .then(json => {
                if (!active) return;
                if (json.success && json.filters && Array.isArray(json.filters.status)) {
                    setEditStatusOptions([...json.filters.status].sort());
                }
            })
            .catch(err => console.error('Failed to load edit status options:', err));
        return () => { active = false; };
    }, [editItem]);

    const openEditModal = (item) => {
        setEditItem(item);
        setEditForm({
            status: item.status || '',
            amount: '',
            paid_date: item.paid_date ? item.paid_date.slice(0, 10) : '',
            approved_date: item.approved_date ? item.approved_date.slice(0, 10) : '',
            notes: item.notes || '',
        });
        setEditSuccess(false);
        setEditError(null);
    };

    const closeEditModal = () => {
        setEditItem(null);
        setEditForm({});
        setEditError(null);
        setEditSuccess(false);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editItem) return;
        setEditSubmitting(true);
        setEditError(null);
        setEditSuccess(false);
        try {
            const statusLower = editForm.status.trim().toLowerCase();
            const isWageGarnishment = statusLower.includes('garnishment') || statusLower.includes('garnish');
            const isCancelledOrLeft = statusLower === 'cancelled' || statusLower === 'left roa';
            const isPaid = statusLower === 'paid';

            // Always start with status
            const payload = { status: editForm.status.trim() };

            if (!isPaid && editForm.amount !== '' && !isWageGarnishment && !isCancelledOrLeft) {
                payload.amount = parseFloat(editForm.amount) || 0;
            }
            if (editForm.paid_date) payload.paid_date = editForm.paid_date;
            if (editForm.approved_date) payload.approved_date = editForm.approved_date;
            if (editForm.notes.trim()) payload.notes = editForm.notes.trim();

            const res = await fetch(`${COMMISSION_ADVANCES_EDIT_API}/${editItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || json.detail || `Server error: ${res.status}`);
            setEditSuccess(true);
            closeEditModal();
            window.location.reload();
        } catch (err) {
            setEditError(err.message);
        } finally {
            setEditSubmitting(false);
        }
    };

    // ── Formatters & Helpers ───────────────────────────────────────────────────
    const formatCurrency = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(val);
    };

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const renderDetailStatusBadge = (status) => {
        const s = String(status || '').toLowerCase().replace(/_/g, ' ');
        if (s === 'paid') {
            return (
                <Badge variant="success" className="px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                    Paid
                </Badge>
            );
        }
        if (s.includes('garnishment') || s.includes('garnish')) {
            return (
                <Badge variant="destructive" className="px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                    Wage Garnishment
                </Badge>
            );
        }
        if (s.includes('pending partial') || s === 'pending partial') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm bg-orange-50 text-orange-700 border-orange-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    {status}
                </span>
            );
        }
        if (s.includes('pending')) {
            return (
                <Badge variant="warning" className="px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                    Pending
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {status || 'Unknown'}
            </Badge>
        );
    };

    const renderStatusBreakdown = (breakdown) => {
        if (!breakdown || typeof breakdown !== 'object') {
            return <span className="text-slate-400 text-xs font-medium select-none">—</span>;
        }

        const entries = Object.entries(breakdown).filter(([_, count]) => typeof count === 'number' ? count > 0 : Boolean(count));

        if (entries.length === 0) {
            return <span className="text-slate-400 text-xs font-medium select-none">—</span>;
        }

        return (
            <div className="flex flex-col gap-1.5">
                {entries.map(([statusKey, count]) => {
                    const keyLower = statusKey.toLowerCase().replace(/_/g, ' ');
                    let badgeClass = 'bg-slate-50 text-slate-700 border-slate-200';
                    let dotClass = 'bg-slate-500';

                    if (keyLower.includes('paid')) {
                        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        dotClass = 'bg-emerald-500';
                    } else if (keyLower.includes('pending')) {
                        badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        dotClass = 'bg-amber-500';
                    } else if (keyLower.includes('garnishment') || keyLower.includes('garnish')) {
                        badgeClass = 'bg-red-50 text-red-700 border-red-200';
                        dotClass = 'bg-red-500';
                    }

                    const formattedLabel = statusKey.includes('_') && !statusKey.includes(' ')
                        ? statusKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                        : statusKey;

                    return (
                        <span
                            key={statusKey}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm w-fit ${badgeClass}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                            {formattedLabel}: {count}
                        </span>
                    );
                })}
            </div>
        );
    };

    const renderAgentStatusBadge = (status) => {
        if (!status) return null;
        const s = String(status).toLowerCase();
        if (s === 'active') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                </span>
            );
        }
        if (s === 'inactive') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Inactive
                </span>
            );
        }
        if (s === 'terminated' || s === 'term') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Terminated
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {status}
            </span>
        );
    };

    const ACCUMULATION_MAX = 20000;

    const renderAccumulationBar = (totalOutstanding) => {
        const amount = totalOutstanding || 0;
        const isOver = amount > ACCUMULATION_MAX;
        const pct = Math.min((amount / ACCUMULATION_MAX) * 100, 100);
        const barColor = isOver
            ? 'bg-red-500'
            : pct >= 80
            ? 'bg-amber-500'
            : 'bg-indigo-500';

        return (
            <div className="space-y-1.5 min-w-[140px]">
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${
                        isOver ? 'text-red-600' : 'text-slate-800'
                    }`}>
                        {formatCurrency(amount)}
                    </span>
                    {isOver && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-300 whitespace-nowrap">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Over Limit
                        </span>
                    )}
                </div>
                <div className="relative w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                    <span>$0</span>
                    <span>$20k max</span>
                </div>
            </div>
        );
    };

    // Calculate aggregated details stats
    const detailTotalAmount = detailItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const agentState = detailItems[0]?.state || '';

    // ── RENDER LOG ADVANCE FORM ─────────────────────────────────────────────────
    if (activeView === 'log_advance') {
        return (
            <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
                {/* Top Header Block */}
                <div className="space-y-2 border-b border-slate-200/80 pb-5">
                    <button
                        onClick={handleBackToList}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors select-none"
                    >
                        <IconArrowLeft /> Back to Commission Advances
                    </button>
                    <div className="flex justify-between items-end pt-2">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Log New Commission Advance</h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Fill in the details below to record a new advance entry.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form Card */}
                <Card className="border-slate-200/80 shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <form onSubmit={handleLogFormSubmit} className="space-y-4">
                            {/* Row 1: Agent Name & Company */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Agent Name with Autocomplete Suggestions */}
                                <div className="space-y-1 relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="log-agent-name">
                                        Agent Name <span className="text-red-500">*</span>
                                    </label>
                                    {/* Wrapper for input + inline spinner */}
                                    <div className="relative">
                                        <Input
                                            id="log-agent-name"
                                            name="agent_name"
                                            value={logForm.agent_name}
                                            onChange={(e) => {
                                                handleLogFormChange(e);
                                                setShowAgentSuggestions(false);
                                                setSelectedAgentInfo(null);
                                            }}
                                            onBlur={() => setTimeout(() => setShowAgentSuggestions(false), 150)}
                                            placeholder="Type to search agent..."
                                            required
                                            autoComplete="off"
                                            className={`w-full h-9 text-sm ${fetchingAgentSuggestions ? 'pr-8' : ''}`}
                                        />
                                        {fetchingAgentSuggestions && (
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    {showAgentSuggestions && !fetchingAgentSuggestions && agentSuggestions.length > 0 && (
                                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto py-1">
                                            {agentSuggestions.map((item, idx) => {
                                                const nameStr = typeof item === 'string' ? item : (item.display_name || item.agent_name || item.name || JSON.stringify(item));
                                                const status = typeof item === 'object' ? (item.agent_status || '') : '';
                                                const isActive = status.toLowerCase() === 'active';
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            agentJustSelectedRef.current = true;
                                                            const displayName = typeof item === 'string' ? item : (item.display_name || item.agent_name || nameStr);
                                                            setLogForm(prev => ({ ...prev, agent_name: displayName }));
                                                            if (typeof item === 'object') {
                                                                setSelectedAgentInfo(item);
                                                            }
                                                            setShowAgentSuggestions(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-slate-800 transition-colors flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
                                                    >
                                                        <span className="font-semibold text-slate-800">{nameStr}</span>
                                                        {status && (
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                                                isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                {status}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Selected Agent Info Card */}
                                    {selectedAgentInfo && (
                                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-3 space-y-2">
                                            {/* Status row */}
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        (selectedAgentInfo.agent_status || '').toLowerCase() === 'active'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        (selectedAgentInfo.agent_status || '').toLowerCase() === 'active'
                                                            ? 'bg-emerald-500'
                                                            : 'bg-amber-500'
                                                    }`} />
                                                    {selectedAgentInfo.agent_status || 'Unknown'}
                                                </span>
                                            </div>
                                            {/* General Notes */}
                                            {selectedAgentInfo.general_notes && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">General Notes</p>
                                                    <p className="text-xs text-slate-700 leading-snug">{selectedAgentInfo.general_notes}</p>
                                                </div>
                                            )}
                                            {/* Internal Notes */}
                                            {selectedAgentInfo.internal_notes && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Internal Notes</p>
                                                    <p className="text-xs text-slate-700 leading-snug">{selectedAgentInfo.internal_notes}</p>
                                                </div>
                                            )}
                                            {/* Fallback if both notes are null */}
                                            {!selectedAgentInfo.general_notes && !selectedAgentInfo.internal_notes && (
                                                <p className="text-[11px] text-slate-400 italic">No notes</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Company with Typeahead Suggestions */}
                                <div className="space-y-1 relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="log-company">
                                        Company <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="log-company"
                                        name="company"
                                        value={logForm.company}
                                        onChange={(e) => {
                                            handleLogFormChange(e);
                                            setShowCompanySuggestions(true);
                                        }}
                                        onFocus={() => setShowCompanySuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 150)}
                                        placeholder="Select or type a new company..."
                                        required
                                        autoComplete="off"
                                        className="w-full h-9 text-sm"
                                    />
                                    {showCompanySuggestions && dropdownOptions.company.length > 0 && (() => {
                                        const filtered = dropdownOptions.company.filter(c =>
                                            c.toLowerCase().includes((logForm.company || '').toLowerCase())
                                        );
                                        return filtered.length > 0 ? (
                                            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto py-1">
                                                {filtered.map((comp) => (
                                                    <button
                                                        key={comp}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setLogForm(prev => ({ ...prev, company: comp }));
                                                            setShowCompanySuggestions(false);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 text-slate-800 transition-colors border-b border-slate-50 last:border-0"
                                                    >
                                                        {comp}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            </div>

                            {/* Row 2: Property Address (full width, autocomplete) */}
                            <div className="space-y-1 relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="log-address">
                                    Property Address <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    id="log-address"
                                    name="address"
                                    value={logForm.address}
                                    onChange={(e) => {
                                        handleLogFormChange(e);
                                        setShowAddressSuggestions(false);
                                        setSelectedAddressInfo(null);
                                    }}
                                    onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
                                    placeholder="Type to search address..."
                                    required
                                    autoComplete="off"
                                    className="w-full h-9 text-sm"
                                />
                                {showAddressSuggestions && addressSuggestions.length > 0 && (
                                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto py-1">
                                        {addressSuggestions.map((item, idx) => {
                                            const addrStr = typeof item === 'string' ? item : (item.address || item.property_address || item.name || JSON.stringify(item));
                                            const status = typeof item === 'object' ? (item.ss_status || '') : '';
                                            const statusColor = {
                                                closed:    'bg-emerald-100 text-emerald-700 [&>span]:bg-emerald-500',
                                                archived:  'bg-slate-100 text-slate-500 [&>span]:bg-slate-400',
                                                active:    'bg-blue-100 text-blue-700 [&>span]:bg-blue-500',
                                            }[status.toLowerCase()] || 'bg-amber-100 text-amber-700 [&>span]:bg-amber-500';
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        addressJustSelectedRef.current = true;
                                                        const addrValue = typeof item === 'string' ? item : (item.address || item.property_address || addrStr);
                                                        setLogForm(prev => ({ ...prev, address: addrValue }));
                                                        if (typeof item === 'object') {
                                                            setSelectedAddressInfo(item);
                                                        }
                                                        setShowAddressSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-slate-800 transition-colors flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
                                                >
                                                    <span className="font-semibold text-slate-800">{addrStr}</span>
                                                    {status && (
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${statusColor}`}>
                                                            <span className="w-1.5 h-1.5 rounded-full" />
                                                            {status}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {/* Selected Address Info Card */}
                                {selectedAddressInfo && (
                                    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-3 flex items-center gap-4">
                                        {selectedAddressInfo.ss_status && (() => {
                                            const s = (selectedAddressInfo.ss_status || '').toLowerCase();
                                            const cls = s === 'closed'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : s === 'archived'
                                                    ? 'bg-slate-100 text-slate-500'
                                                    : 'bg-amber-100 text-amber-700';
                                            const dot = s === 'closed'
                                                ? 'bg-emerald-500'
                                                : s === 'archived'
                                                    ? 'bg-slate-400'
                                                    : 'bg-amber-500';
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${cls}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                                    {selectedAddressInfo.ss_status}
                                                </span>
                                            );
                                        })()}
                                        {selectedAddressInfo.close_date && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Close Date</p>
                                                <p className="text-xs font-semibold text-slate-700">{formatDateUS(selectedAddressInfo.close_date)}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Row 3: Amount & Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="log-amount">
                                        Amount ($) <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="log-amount"
                                        name="amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={logForm.amount}
                                        onChange={handleLogFormChange}
                                        placeholder="e.g. 5880"
                                        required
                                        className="w-full h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="log-date">
                                        Approval Date
                                    </label>
                                    <Input
                                        id="log-date"
                                        name="date"
                                        type="date"
                                        value={logForm.date}
                                        onChange={handleLogFormChange}
                                        className="w-full h-9 text-sm bg-white"
                                    />
                                </div>
                            </div>

                            {/* Row 4: Notes */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="log-notes">
                                    Notes
                                </label>
                                <textarea
                                    id="log-notes"
                                    name="notes"
                                    value={logForm.notes}
                                    onChange={handleLogFormChange}
                                    placeholder="Optional notes about this advance..."
                                    rows={3}
                                    className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-800 resize-none"
                                />
                            </div>

                            {/* Success Banner */}
                            {logSuccess && (
                                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
                                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Commission advance logged successfully.
                                </div>
                            )}

                            {/* Error Banner */}
                            {logError && (
                                <div className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">
                                    <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    </svg>
                                    {logError}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleBackToList}
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold transition-colors h-9 px-4 text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 select-none"
                                >
                                    Cancel
                                </button>
                                <Button
                                    id="log-advance-submit-btn"
                                    type="submit"
                                    disabled={logSubmitting}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-all h-9 min-w-[120px]"
                                >
                                    {logSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Submitting...
                                        </span>
                                    ) : 'Submit Advance'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── RENDER DETAIL VIEW ─────────────────────────────────────────────────────
    if (activeAgentName) {
        return (
            <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
                {/* Back Link */}
                <div>
                    <button
                        onClick={handleBackToList}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors select-none"
                    >
                        <IconArrowLeft /> Back to Commission Advances
                    </button>
                </div>

                {/* Agent Header Info Card */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{activeAgentName}</h2>
                            <p className="text-xs text-slate-400 mt-1 font-medium">Commission Advance Detail History</p>
                        </div>
                    </div>
                    <div className="flex gap-8 items-center">
                        <div className="text-right">
                            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Total Records</p>
                            <p className="text-xl font-bold text-slate-900 mt-0.5">
                                {detailLoading ? '...' : detailItems.length}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Total Outstanding</p>
                            <p className="text-xl font-bold text-slate-900 mt-0.5">
                                {detailLoading ? '...' : formatCurrency(detailItems.reduce((s, i) => s + (i.outstanding_amount || 0), 0))}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Detailed Table */}
                <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/4">Property Address</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Original Amount</TableHead>
                                <TableHead>Outstanding</TableHead>
                                <TableHead>Approved Date</TableHead>
                                <TableHead>Paid Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-1/5">Notes</TableHead>
                                <TableHead className="w-20 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailLoading ? (
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <TableRow key={idx} className="animate-pulse">
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-4/5" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-16" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-14" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-14" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-20" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-20" /></TableCell>
                                        <TableCell><div className="h-6 bg-slate-100 rounded-full w-20" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-3/4" /></TableCell>
                                        <TableCell><div className="h-8 bg-slate-100 rounded w-12 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : detailError ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-red-500 bg-red-50/50">
                                        Error loading details: {detailError}
                                    </TableCell>
                                </TableRow>
                            ) : detailItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                                        No transaction items found for this agent.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                detailItems.map((item, idx) => (
                                    <TableRow key={item.id ?? idx}>
                                        <TableCell className="font-medium text-slate-800 text-sm">
                                            {(() => {
                                                const addr = item.address || '';
                                                const commaIdx = addr.indexOf(',');
                                                if (!addr) return '—';
                                                if (commaIdx === -1) return addr;
                                                const line1 = addr.slice(0, commaIdx).trim();
                                                const line2 = addr.slice(commaIdx + 1).trim();
                                                return (
                                                    <span className="flex flex-col gap-0.5">
                                                        <span className="font-semibold text-slate-800">{line1}</span>
                                                        <span className="text-xs text-slate-400 font-normal">{line2}</span>
                                                    </span>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-slate-600 font-medium text-sm">
                                            {item.company || '—'}
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-900 text-sm">
                                            {formatCurrency(item.original_amount)}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <span className={`font-bold ${
                                                (item.outstanding_amount || 0) > 0
                                                    ? 'text-red-600'
                                                    : 'text-emerald-600'
                                            }`}>
                                                {formatCurrency(item.outstanding_amount)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-slate-500 font-medium text-sm">
                                            {formatDateUS(item.approved_date)}
                                        </TableCell>
                                        <TableCell className="text-slate-500 font-medium text-sm">
                                            {formatDateUS(item.paid_date)}
                                        </TableCell>
                                        <TableCell>
                                            {renderDetailStatusBadge(item.status)}
                                        </TableCell>
                                        <TableCell
                                            className="text-slate-500 italic text-xs max-w-[180px] truncate"
                                            title={item.notes || ''}
                                        >
                                            {item.notes || '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all shadow-sm"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* ── Edit Modal ─────────────────────────────────────────── */}
                {editItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200/80 overflow-hidden">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Edit Advance Record</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">{editItem.address || 'Record #' + editItem.id}</p>
                                </div>
                                <button
                                    onClick={closeEditModal}
                                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">

                                {/* Status */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
                                    <select
                                        name="status"
                                        value={editForm.status}
                                        onChange={handleEditFormChange}
                                        className="flex w-full rounded-md border border-input bg-white px-3 h-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-800"
                                    >
                                        <option value="">— Select status —</option>
                                        {editStatusOptions.length > 0
                                            ? editStatusOptions.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))
                                            : [
                                                <option key="Pending" value="Pending">Pending</option>,
                                                <option key="Paid" value="Paid">Paid</option>,
                                                <option key="Wage Garnishment" value="Wage Garnishment">Wage Garnishment</option>,
                                            ]
                                        }
                                    </select>
                                </div>

                                {/* Amount & Dates — visibility depends on status */}
                                {(() => {
                                    const st = (editForm.status || '').toLowerCase();
                                    const isGarnishment = st.includes('garnishment') || st.includes('garnish');
                                    const isCancelledOrLeft = st === 'cancelled' || st === 'left roa';
                                    const isPaid = st === 'paid';
                                    const showAmount = !isGarnishment && !isCancelledOrLeft && !isPaid;

                                    return (
                                        <div className="space-y-4">
                                            {showAmount && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Amount ($)</label>
                                                    <Input
                                                        name="amount"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={editForm.amount}
                                                        onChange={handleEditFormChange}
                                                        placeholder="e.g. 8775"
                                                        className="w-full h-9 text-sm"
                                                    />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Date</label>
                                                    <Input
                                                        name="approved_date"
                                                        type="date"
                                                        value={editForm.approved_date}
                                                        onChange={handleEditFormChange}
                                                        className="w-full h-9 text-sm bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid Date</label>
                                                    <Input
                                                        name="paid_date"
                                                        type="date"
                                                        value={editForm.paid_date}
                                                        onChange={handleEditFormChange}
                                                        className="w-full h-9 text-sm bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Notes */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notes</label>
                                    <textarea
                                        name="notes"
                                        value={editForm.notes}
                                        onChange={handleEditFormChange}
                                        rows={3}
                                        placeholder="Optional notes..."
                                        className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-800 resize-none"
                                    />
                                </div>

                                {/* Success */}
                                {editSuccess && (
                                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
                                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Record updated successfully.
                                    </div>
                                )}

                                {/* Error */}
                                {editError && (
                                    <div className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">
                                        <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        </svg>
                                        {editError}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="pt-1 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={closeEditModal}
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold transition-colors h-9 px-4 text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <Button
                                        type="submit"
                                        disabled={editSubmitting}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-9 min-w-[110px]"
                                    >
                                        {editSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Saving...
                                            </span>
                                        ) : 'Save Changes'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── RENDER SUMMARY & LISTING VIEW ──────────────────────────────────────────
    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Commission Advances</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Track and manage advance commission payments, statuses, and agent accounts.
                    </p>
                </div>
                <Button
                    id="log-advance-btn"
                    onClick={handleGoToLogAdvance}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-all gap-2 shrink-0"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Log Advance
                </Button>
            </div>

            {/* Metrics cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1 */}
                <Card className="border-slate-200/60 shadow-sm overflow-hidden relative transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-white">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <p className="text-xs font-bold tracking-wider uppercase text-slate-400">Pending Advances</p>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                                    {summaryLoading ? (
                                        <span className="inline-block w-16 h-8 bg-slate-100 animate-pulse rounded" />
                                    ) : summaryError ? (
                                        <span className="text-sm text-red-500 font-medium">Err</span>
                                    ) : (
                                        summaryData?.pending_advances ?? 0
                                    )}
                                </h3>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 2 */}
                <Card className="border-slate-200/60 shadow-sm overflow-hidden relative transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-white">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <p className="text-xs font-bold tracking-wider uppercase text-slate-400">Advances Received</p>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                                    {summaryLoading ? (
                                        <span className="inline-block w-16 h-8 bg-slate-100 animate-pulse rounded" />
                                    ) : summaryError ? (
                                        <span className="text-sm text-red-500 font-medium">Err</span>
                                    ) : (
                                        summaryData?.commission_advance_received ?? 0
                                    )}
                                </h3>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 3 */}
                <Card className="border-slate-200/60 shadow-sm overflow-hidden relative transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-white">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <p className="text-xs font-bold tracking-wider uppercase text-slate-400">Agents with Active Advances</p>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                                    {summaryLoading ? (
                                        <span className="inline-block w-16 h-8 bg-slate-100 animate-pulse rounded" />
                                    ) : summaryError ? (
                                        <span className="text-sm text-red-500 font-medium">Err</span>
                                    ) : (
                                        summaryData?.agents_with_active_advances ?? 0
                                    )}
                                </h3>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card with Header & Filters Grid */}
            <Card className="shadow-sm border-slate-200/80 overflow-hidden bg-white">
                {/* Table Header Bar */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-md font-bold text-slate-800">Agent Accounts</h2>
                        {totalCount > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 font-bold text-[10px] rounded">
                                {totalCount.toLocaleString()} agents
                            </Badge>
                        )}
                    </div>
                    {totalPages > 0 && (
                        <span className="text-xs font-semibold text-slate-500">
                            Showing page {page} of {totalPages}
                        </span>
                    )}
                </div>

                {/* Filters Row */}
                <div className="p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-1">
                        {/* Search Input */}
                        <div className="space-y-1 flex-1 max-w-md">
                            <label htmlFor="commission-search" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Search Agent</label>
                            <div className="relative w-full">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <Input
                                    id="commission-search"
                                    type="text"
                                    placeholder="Search by agent name…"
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    className="pl-9 pr-8 w-full"
                                />
                                {searchInput && (
                                    <button
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                        onClick={() => { setSearchInput(''); setDebouncedSearchQuery(''); setPage(1); }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-1 min-w-[200px]">
                            <label htmlFor="commission-status-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Status</label>
                            <select
                                id="commission-status-filter"
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                                className="flex w-full rounded-md border border-input bg-white px-3 h-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-800 font-normal"
                            >
                                <option value="" className="font-normal">All Statuses</option>
                                {statusOptions.map(st => (
                                    <option key={st} value={st} className="font-normal">{st}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Clear Filters Row */}
                    {(searchInput || debouncedSearchQuery || statusFilter) && (
                        <div className="pt-1 sm:pt-0 shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchInput('');
                                    setDebouncedSearchQuery('');
                                    setStatusFilter('');
                                    setPage(1);
                                }}
                                className="h-9 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                            >
                                Clear All Filters
                            </Button>
                        </div>
                    )}
                </div>

                <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/4">Agent Name</TableHead>
                                <TableHead>Total Outstanding</TableHead>
                                <TableHead>Total Accumulation</TableHead>
                                <TableHead>Status Breakdown</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {listingLoading ? (
                                Array.from({ length: 6 }).map((_, idx) => (
                                    <TableRow key={idx} className="animate-pulse">
                                        <TableCell>
                                            <div className="h-4 bg-slate-100 rounded w-32 mb-1" />
                                            <div className="h-3 bg-slate-100 rounded w-14" />
                                        </TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-16" /></TableCell>
                                        <TableCell>
                                            <div className="space-y-1.5">
                                                <div className="h-3.5 bg-slate-100 rounded w-24" />
                                                <div className="h-1.5 bg-slate-100 rounded-full w-36" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1.5">
                                                <div className="h-5 bg-slate-100 rounded-full w-20" />
                                                <div className="h-5 bg-slate-100 rounded-full w-24" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : listingError ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-red-500 bg-red-50/50">
                                        Error loading commission advances listing: {listingError}
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                                        No agents found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item, idx) => (
                                    <TableRow
                                        key={item.agent_name + idx}
                                        onClick={() => handleViewDetail(item.agent_name)}
                                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                                    >
                                        <TableCell>
                                            <div className="space-y-1.5">
                                                <span className="font-semibold text-slate-800 text-sm block">
                                                    {item.agent_name}
                                                </span>
                                                {renderAgentStatusBadge(item.agent_status)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-900">
                                            {formatCurrency(item.total_outstanding)}
                                        </TableCell>
                                        <TableCell>
                                            {renderAccumulationBar(item.total_outstanding)}
                                        </TableCell>
                                        <TableCell>
                                            {renderStatusBreakdown(item.status_breakdown)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Pagination Controls */}
                {!listingLoading && !listingError && totalPages > 1 && (
                    <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="text-xs font-semibold text-slate-500">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page === 1}
                                className="font-semibold select-none"
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={page === totalPages}
                                className="font-semibold select-none"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
}

export default CommissionAdvances;

