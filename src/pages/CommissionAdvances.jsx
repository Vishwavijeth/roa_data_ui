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
    COMMISSION_ADVANCES_SUGGESTIONS_API,
    COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API,
    COMMISSION_ADVANCES_LOG_API,
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
            // Extract state from the address string
            // Address format: "Street, City, ST, ZIP" → split by ", " → 3rd element is state
            const addressParts = logForm.address.trim().split(', ');
            const stateFromAddress = addressParts.length >= 3
                ? addressParts[addressParts.length - 2].trim().toUpperCase()
                : (logForm.state || '').trim().toUpperCase();

            const res = await fetch(COMMISSION_ADVANCES_LOG_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: logForm.agent_name.trim(),
                    address: logForm.address.trim(),
                    company: logForm.company.trim(),
                    state: stateFromAddress,
                    amount: parseFloat(logForm.amount) || 0,
                    paid_date: logForm.date || null,
                    notes: logForm.notes.trim() || null,
                    status: 'Pending',
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.message || json.detail || `Server error: ${res.status}`);
            }
            setLogSuccess(true);
            setTimeout(() => setLogSuccess(false), 3000);
            setLogForm({ agent_name: '', address: '', company: '', state: '', amount: '', date: '', notes: '' });
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
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const addressJustSelectedRef = useRef(false);
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
    }, [page, debouncedSearchQuery, activeAgentName, activeView]);

    // Apply a robust client-side filter fallback in case the backend does not implement search parameters
    const filteredItems = React.useMemo(() => {
        if (!debouncedSearchQuery.trim()) return items;
        // Verify if items are already filtered by the API. If not, filter client-side.
        const query = debouncedSearchQuery.toLowerCase();
        const hasUnfiltered = items.some(item => !item.agent_name.toLowerCase().includes(query));
        if (hasUnfiltered) {
            return items.filter(item => item.agent_name.toLowerCase().includes(query));
        }
        return items;
    }, [items, debouncedSearchQuery]);

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
        if (s.includes('paid')) {
            return (
                <Badge variant="success" className="px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                    Paid
                </Badge>
            );
        }
        if (s.includes('pending')) {
            return (
                <Badge variant="warning" className="px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                    Pending
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
        return (
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {status || 'Unknown'}
            </Badge>
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
                            {/* Row 1: Agent Name & Property Address */}
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
                                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto py-1">
                                            {agentSuggestions.map((item, idx) => {
                                                const nameStr = typeof item === 'string' ? item : (item.agent_name || item.name || item.title || JSON.stringify(item));
                                                const subStr = typeof item === 'object' ? (item.address || item.company || item.state || '') : '';
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            agentJustSelectedRef.current = true;
                                                            if (typeof item === 'string') {
                                                                setLogForm(prev => ({ ...prev, agent_name: item }));
                                                            } else {
                                                                setLogForm(prev => ({
                                                                    ...prev,
                                                                    agent_name: item.agent_name || item.name || nameStr,
                                                                    ...(item.address ? { address: item.address } : {}),
                                                                    ...(item.company ? { company: item.company } : {}),
                                                                    ...(item.state ? { state: item.state } : {}),
                                                                }));
                                                            }
                                                            setShowAgentSuggestions(false);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 text-slate-800 transition-colors flex flex-col border-b border-slate-50 last:border-0"
                                                    >
                                                        <span className="font-medium text-slate-800">{nameStr}</span>
                                                        {subStr && <span className="text-[11px] text-slate-400">{subStr}</span>}
                                                    </button>
                                                );
                                            })}
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
                                    }}
                                    onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
                                    placeholder="Type to search address..."
                                    required
                                    autoComplete="off"
                                    className="w-full h-9 text-sm"
                                />
                                {showAddressSuggestions && addressSuggestions.length > 0 && (
                                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto py-1">
                                        {addressSuggestions.map((item, idx) => {
                                            const addrStr = typeof item === 'string' ? item : (item.address || item.property_address || item.name || item.title || JSON.stringify(item));
                                            const subStr = typeof item === 'object' ? (item.agent_name || item.company || item.state || '') : '';
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        addressJustSelectedRef.current = true;
                                                        if (typeof item === 'string') {
                                                            setLogForm(prev => ({ ...prev, address: item }));
                                                        } else {
                                                            setLogForm(prev => ({
                                                                ...prev,
                                                                address: item.address || item.property_address || addrStr,
                                                                ...(item.agent_name ? { agent_name: item.agent_name } : {}),
                                                                ...(item.company ? { company: item.company } : {}),
                                                                ...(item.state ? { state: item.state } : {}),
                                                            }));
                                                        }
                                                        setShowAddressSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 text-slate-800 transition-colors flex flex-col border-b border-slate-50 last:border-0"
                                                >
                                                    <span className="font-medium text-slate-800">{addrStr}</span>
                                                    {subStr && <span className="text-[11px] text-slate-400">{subStr}</span>}
                                                </button>
                                            );
                                        })}
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
                                        Date
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
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-slate-900">{activeAgentName}</h2>
                                {agentState && (
                                    <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-semibold text-blue-600 bg-blue-50 border-blue-200 shadow-sm">
                                        State: {agentState}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 font-medium">Commission Advance Detail History</p>
                        </div>
                    </div>
                    <div className="flex gap-6 items-center">
                        <div className="text-right">
                            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Total Advances</p>
                            <p className="text-xl font-bold text-slate-900 mt-0.5">
                                {detailLoading ? '...' : detailItems.length}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Detailed Table */}
                <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/3">Property Address</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Paid Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-1/4">Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailLoading ? (
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <TableRow key={idx} className="animate-pulse">
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-4/5" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-16" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-12" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-20" /></TableCell>
                                        <TableCell><div className="h-6 bg-slate-100 rounded-full w-16" /></TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-3/4" /></TableCell>
                                    </TableRow>
                                ))
                            ) : detailError ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-red-500 bg-red-50/50">
                                        Error loading details: {detailError}
                                    </TableCell>
                                </TableRow>
                            ) : detailItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                                        No transaction items found for this agent.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                detailItems.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium text-slate-800">
                                            {item.address || '—'}
                                        </TableCell>
                                        <TableCell className="text-slate-600 font-medium">
                                            {item.company || '—'}
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-900">
                                            {formatCurrency(item.amount)}
                                        </TableCell>
                                        <TableCell className="text-slate-500 font-medium">
                                            {formatDateUS(item.paid_date)}
                                        </TableCell>
                                        <TableCell>
                                            {renderDetailStatusBadge(item.status)}
                                        </TableCell>
                                        <TableCell className="text-slate-500 italic text-xs max-w-[200px] truncate" title={item.notes || ''}>
                                            {item.notes || '—'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
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

            {/* Filter and Table container */}
            <div className="space-y-4">
                {/* Search Bar */}
                <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                    <div className="relative w-80">
                        <Input
                            placeholder="Search by agent name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9 bg-slate-50/50 hover:bg-slate-50 border-slate-200 focus-visible:bg-white"
                        />
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        {searchInput && (
                            <button
                                onClick={() => setSearchInput('')}
                                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="text-xs font-semibold text-slate-400">
                        {!listingLoading && `Showing ${filteredItems.length} of ${totalCount} agents`}
                    </div>
                </div>

                {/* Table */}
                <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/3">Agent Name</TableHead>
                                <TableHead>Total Outstanding</TableHead>
                                <TableHead>Status Breakdown</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {listingLoading ? (
                                Array.from({ length: 6 }).map((_, idx) => (
                                    <TableRow key={idx} className="animate-pulse">
                                        <TableCell>
                                            <div className="h-4 bg-slate-100 rounded w-32" />
                                        </TableCell>
                                        <TableCell><div className="h-4 bg-slate-100 rounded w-16" /></TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <div className="h-5 bg-slate-100 rounded-full w-20" />
                                                <div className="h-5 bg-slate-100 rounded-full w-20" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="h-8 bg-slate-100 rounded w-16 ml-auto" />
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
                                    <TableRow key={item.agent_name + idx}>
                                        <TableCell>
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {item.agent_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-900">
                                            {formatCurrency(item.total_outstanding)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {item.status_breakdown?.pending > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                        Pending: {item.status_breakdown.pending}
                                                    </span>
                                                )}
                                                {item.status_breakdown?.paid > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        Paid: {item.status_breakdown.paid}
                                                    </span>
                                                )}
                                                {item.status_breakdown?.wage_garnishment > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 shadow-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                        Garnished: {item.status_breakdown.wage_garnishment}
                                                    </span>
                                                )}
                                                {(!item.status_breakdown ||
                                                    (item.status_breakdown.pending === 0 &&
                                                        item.status_breakdown.paid === 0 &&
                                                        item.status_breakdown.wage_garnishment === 0)) && (
                                                        <span className="text-slate-400 text-xs font-medium select-none">—</span>
                                                    )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewDetail(item.agent_name)}
                                                className="hover:bg-slate-50 border-slate-200 hover:text-slate-900 text-slate-700 transition-all font-semibold"
                                            >
                                                Detail
                                            </Button>
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
        </div>
    );
}

export default CommissionAdvances;
