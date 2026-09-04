import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatDateUS } from '../utils/helpers';
import { authFetch } from '../utils/api';
import { IconArrowLeft } from '../components/shared/Icons';
import SectionedDetailView from '../components/shared/SectionedDetailView';
import {
    COMMISSION_ADVANCES_SUMMARY_API,
    COMMISSION_ADVANCES_LISTING_API,
    COMMISSION_ADVANCES_DETAIL_API,
    COMMISSION_ADVANCES_META_API,
    COMMISSION_ADVANCES_DROPDOWN_API,
    COMMISSION_ADVANCES_STATUS_DROPDOWN_API,
    COMMISSION_ADVANCES_SUGGESTIONS_API,
    COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API,
    COMMISSION_ADVANCES_LOG_API,
    COMMISSION_ADVANCES_EDIT_API,
    ROWS_PER_PAGE,
    API_DOMAIN
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
            const hasGarnishment = !!(selectedAgentInfo?.has_wage_garnishment || selectedAgentInfo?.wage_garnishment);
            const agentId = selectedAgentInfo?.agent_id || selectedAgentInfo?.id || selectedAgentInfo?.uuid || null;
            const saleGuid = selectedAddressInfo?.saleguid || selectedAddressInfo?.sale_guid || null;
            const payload = {
                agent_name: logForm.agent_name.trim(),
                address: logForm.address.trim(),
                company: logForm.company.trim(),
                approved_date: logForm.date || null,
                notes: logForm.notes.trim() || null,
                saleguid: saleGuid,
                agent_id: agentId,
            };
            if (!hasGarnishment) {
                payload.amount = parseFloat(logForm.amount) || 0;
            }
            const res = await authFetch(COMMISSION_ADVANCES_LOG_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
        authFetch(COMMISSION_ADVANCES_META_API)
            .then(res => res.json())
            .then(json => {
                if (!active) return;
                const companyList = json.data?.company || json.filters?.company || [];
                const stateList = json.data?.state || json.filters?.state || [];
                setDropdownOptions({
                    state: stateList,
                    company: companyList,
                });
            })
            .catch(err => console.error('Failed to load log metadata:', err));

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
            authFetch(`${COMMISSION_ADVANCES_SUGGESTIONS_API}?q=${encodeURIComponent(logForm.agent_name.trim())}&limit=8`)
                .then(res => res.json())
                .then(json => {
                    if (!active) return;
                    let list = [];
                    if (json.agent_name && Array.isArray(json.agent_name)) {
                        list = json.agent_name;
                    } else if (json.success && json.filters && Array.isArray(json.filters.agent_name)) {
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
            authFetch(`${COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API}?q=${encodeURIComponent(logForm.address.trim())}&limit=5`)
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
        authFetch(COMMISSION_ADVANCES_SUMMARY_API)
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
        authFetch(COMMISSION_ADVANCES_META_API)
            .then(res => {
                if (!res.ok) throw new Error(`Status dropdown error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                const fetched = json.data?.status || json.filters?.status;
                if (Array.isArray(fetched)) {
                    const combined = fetched.some(s => s.toLowerCase() === 'replacement')
                        ? fetched
                        : [...fetched, 'Replacement'];
                    setStatusOptions([...combined].sort());
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

        authFetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`Listing API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (!active) return;
                if (json.success && json.data) {
                    setItems(json.data.items || []);
                    setTotalCount(json.data.total_count ?? json.total_count ?? json.count ?? (json.data.items ? json.data.items.length : 0));
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
            const matchesClient = (item) => {
                const nameStr = (item.agent_name || '').toLowerCase();
                const addrStr = (item.address || item.property_address || '').toLowerCase();
                return nameStr.includes(query) || addrStr.includes(query);
            };
            const hasClientMismatch = list.some(item => !matchesClient(item));
            const hasClientMatch = list.some(matchesClient);
            // Only narrow client-side if at least one item matches client fields (e.g. when backend returns full list),
            // but preserve results when backend searched property address at database level.
            if (hasClientMismatch && hasClientMatch) {
                list = list.filter(matchesClient);
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
    const [expandedLogs, setExpandedLogs] = useState({});
    // menuState: { id, top, left, openUpward } or null
    const [menuState, setMenuState] = useState(null);
    const openActionMenuId = menuState?.id ?? null;

    const openActionMenu = (e, id) => {
        e.stopPropagation();
        if (menuState?.id === id) {
            setMenuState(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 140; // approximate dropdown height
        const openUpward = spaceBelow < menuHeight + 8;
        setMenuState({
            id,
            top: openUpward ? rect.top : rect.bottom,
            left: rect.right,
            openUpward,
        });
    };

    useEffect(() => {
        if (!menuState) return;
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.actions-dropdown-portal')) {
                setMenuState(null);
            }
        };
        const handleScroll = () => setMenuState(null);
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [menuState]);

    useEffect(() => {
        const isAnyExpanded = Object.values(expandedLogs).some(Boolean);
        if (!isAnyExpanded) return;

        const handleLogOutsideClick = (e) => {
            if (!e.target.closest('tr') && !e.target.closest('.actions-dropdown-container')) {
                setExpandedLogs({});
            }
        };

        document.addEventListener('click', handleLogOutsideClick);
        return () => document.removeEventListener('click', handleLogOutsideClick);
    }, [expandedLogs]);

    // ── SkySlope Detail Popup State (Log Advance form) ─────────────────────────
    const [skySlopePopup, setSkySlopePopup] = useState(null); // { open, saleguid, data, loading, error, segment }

    const openSkySlopePopup = (saleguid) => {
        setSkySlopePopup({ open: true, saleguid, data: null, loading: true, error: null, segment: 'skyslope' });
        authFetch(`${API_DOMAIN}/skyslope/detail?saleguid=${encodeURIComponent(saleguid)}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(json => {
                let seg = 'skyslope';
                if (json?.brokerage_engine_records?.length) seg = 'brokerage_engine';
                else if (json?.skyslope) seg = 'skyslope';
                setSkySlopePopup(prev => ({ ...prev, data: json, loading: false, segment: seg }));
            })
            .catch(err => setSkySlopePopup(prev => ({ ...prev, loading: false, error: err.message })));
    };

    const closeSkySlopePopup = () => setSkySlopePopup(null);

    useEffect(() => {
        if (!skySlopePopup?.open) return;
        const h = (e) => { if (e.key === 'Escape') closeSkySlopePopup(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [skySlopePopup?.open]);

    // ── Wage Garnishment Detail Popup State ─────────────────────────────────────
    const [garnishmentPopup, setGarnishmentPopup] = useState(null); // { open, id, data, loading, error }

    const openGarnishmentPopup = (id) => {
        setGarnishmentPopup({ open: true, id, data: null, loading: true, error: null });
        authFetch(`${API_DOMAIN}/commission-advances/garnishments/${encodeURIComponent(id)}/detail`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(json => {
                if (json.success && json.data) {
                    setGarnishmentPopup(prev => ({ ...prev, data: json.data, loading: false }));
                } else {
                    throw new Error(json.message || 'Failed to load garnishment details');
                }
            })
            .catch(err => setGarnishmentPopup(prev => ({ ...prev, loading: false, error: err.message })));
    };

    const closeGarnishmentPopup = () => setGarnishmentPopup(null);

    useEffect(() => {
        if (!garnishmentPopup?.open) return;
        const h = (e) => { if (e.key === 'Escape') closeGarnishmentPopup(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [garnishmentPopup?.open]);

    const toggleLogs = (id) => {
        setExpandedLogs(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Fetch agent detail when activeAgentName changes
    const fetchAgentDetail = React.useCallback(() => {
        if (!activeAgentName) {
            setDetailItems([]);
            setExpandedLogs({});
            return;
        }

        setDetailLoading(true);
        setDetailError(null);

        const detailUrl = `${COMMISSION_ADVANCES_DETAIL_API}?agent_name=${encodeURIComponent(activeAgentName)}`;

        authFetch(detailUrl)
            .then(res => {
                if (!res.ok) throw new Error(`Detail API error: ${res.status}`);
                return res.json();
            })
            .then(json => {
                if (json.success && json.data) {
                    setDetailItems(json.data.items || []);
                    setDetailSummary({
                        total_outstanding: json.data.global_outstanding ?? null,
                        total_count: json.data.total_count ?? json.data.count ?? null,
                    });
                    setExpandedLogs({});
                } else {
                    throw new Error(json.message || 'Failed to load details');
                }
                setDetailLoading(false);
            })
            .catch(err => {
                console.error(err);
                setDetailError(err.message);
                setDetailLoading(false);
            });
    }, [activeAgentName]);

    useEffect(() => {
        fetchAgentDetail();
    }, [fetchAgentDetail]);

    // ── Detail Summary State ────────────────────────────────────────────────────
    const [detailSummary, setDetailSummary] = useState(null);

    // ── Edit Modal State ───────────────────────────────────────────────────────
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editSuccess, setEditSuccess] = useState(false);
    const [editError, setEditError] = useState(null);
    const [editStatusOptions, setEditStatusOptions] = useState([]);
    const [editOperationOptions, setEditOperationOptions] = useState([]);
    const [editDrafts, setEditDrafts] = useState({});

    // ── Edit Modal Address Suggestions State ────────────────────────────
    const [editAddressSuggestions, setEditAddressSuggestions] = useState([]);
    const [showEditAddressSuggestions, setShowEditAddressSuggestions] = useState(false);
    const editAddressJustSelectedRef = useRef(false);
    const [editSelectedAddressInfo, setEditSelectedAddressInfo] = useState(null);

    // Fetch Address Suggestions for Edit Modal when status is Replacement
    useEffect(() => {
        if (editAddressJustSelectedRef.current) {
            editAddressJustSelectedRef.current = false;
            return;
        }
        const statusLower = (editForm.status || '').trim().toLowerCase();
        if (!editItem || statusLower !== 'replacement' || !editForm.address || editForm.address.trim().length < 1) {
            setEditAddressSuggestions([]);
            setShowEditAddressSuggestions(false);
            return;
        }

        let active = true;
        const timer = setTimeout(() => {
            authFetch(`${COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API}?q=${encodeURIComponent(editForm.address.trim())}&limit=5`)
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

                    setEditAddressSuggestions(list);
                    setShowEditAddressSuggestions(list.length > 0);
                })
                .catch(err => console.error(err));
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [editForm.address, editForm.status, editItem]);

    // Fetch status options whenever the modal opens
    useEffect(() => {
        if (!editItem) return;
        let active = true;
        authFetch(COMMISSION_ADVANCES_META_API)
            .then(res => res.json())
            .then(json => {
                if (!active) return;
                const fetchedStatus = json.data?.status || json.filters?.status;
                if (Array.isArray(fetchedStatus)) {
                    const combined = fetchedStatus.some(s => s.toLowerCase() === 'replacement')
                        ? fetchedStatus
                        : [...fetchedStatus, 'Replacement'];
                    setEditStatusOptions([...combined].sort());
                }
                const fetchedOperations = json.data?.operations || json.filters?.operations;
                if (Array.isArray(fetchedOperations)) {
                    setEditOperationOptions(fetchedOperations);
                }
            })
            .catch(err => console.error('Failed to load edit status options:', err));
        return () => { active = false; };
    }, [editItem]);

    const openEditModal = (item) => {
        setEditItem(item);
        const draft = editDrafts[item.id];
        if (draft) {
            setEditForm(draft);
        } else {
            setEditForm({
                status: item.status || '',
                operation: item.operation || '',
                amendment_sign: '+',
                amount: '',
                paid_date: item.paid_date ? item.paid_date.slice(0, 10) : '',
                approved_date: item.approved_date ? item.approved_date.slice(0, 10) : '',
                transaction_date: item.transaction_date ? item.transaction_date.slice(0, 10) : '',
                notes: item.notes || '',
                address: item.address || '',
            });
        }
        if (item.saleguid || item.sale_guid || item.ss_status || item.close_date) {
            setEditSelectedAddressInfo({
                address: item.address || '',
                ss_status: item.ss_status || item.status || '',
                close_date: item.close_date || item.closed_date || null,
                saleguid: item.saleguid || item.sale_guid || null,
            });
        } else {
            setEditSelectedAddressInfo(null);
        }
        setEditAddressSuggestions([]);
        setShowEditAddressSuggestions(false);
        setEditSuccess(false);
        setEditError(null);
    };

    const closeEditModal = () => {
        if (editItem && editForm && Object.keys(editForm).length > 0) {
            setEditDrafts(prev => ({
                ...prev,
                [editItem.id]: editForm,
            }));
        }
        setEditItem(null);
        setEditForm({});
        setEditSelectedAddressInfo(null);
        setEditAddressSuggestions([]);
        setShowEditAddressSuggestions(false);
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
            const statusTrimmed = editForm.status ? editForm.status.trim() : '';
            const operationTrimmed = editForm.operation ? editForm.operation.trim() : '';
            const statusLower = statusTrimmed.toLowerCase();
            const operationLower = operationTrimmed.toLowerCase();

            const isWageGarnishment = statusLower.includes('garnishment') || statusLower.includes('garnish');
            const isCancelledOrLeft = statusLower === 'cancelled' || statusLower === 'left roa';
            const isPaid = statusLower === 'paid';
            const isReplacement = statusLower === 'replacement';

            const payload = {};
            if (statusTrimmed) payload.status = statusTrimmed;

            // Do not send operation or type for Wage Garnishment
            if (!isWageGarnishment) {
                if (operationTrimmed) payload.operation = operationTrimmed;

                if (operationLower === 'payment') {
                    payload.type = 'Credit';
                } else if (operationLower === 'interest' || operationLower === 'fee') {
                    payload.type = 'Debit';
                } else if (operationLower === 'amendment') {
                    const sign = editForm.amendment_sign || '+';
                    payload.type = sign === '+' ? 'Debit' : 'Credit';
                }
            }

            if (!isPaid && editForm.amount !== '' && !isWageGarnishment && !isCancelledOrLeft) {
                payload.amount = parseFloat(editForm.amount) || 0;
            }
            if (editForm.transaction_date) payload.transaction_date = editForm.transaction_date;
            if (editForm.approved_date) payload.approved_date = editForm.approved_date;
            if (editForm.paid_date) payload.paid_date = editForm.paid_date;
            if (editForm.notes && editForm.notes.trim()) payload.notes = editForm.notes.trim();

            if (isReplacement) {
                if (editForm.address && editForm.address.trim()) {
                    payload.address = editForm.address.trim();
                }
                const saleguid = editSelectedAddressInfo?.saleguid || editSelectedAddressInfo?.sale_guid || editItem?.saleguid || editItem?.sale_guid;
                if (saleguid) {
                    payload.saleguid = saleguid;
                }
            }

            const res = await authFetch(`${COMMISSION_ADVANCES_EDIT_API}/${editItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || json.detail || `Server error: ${res.status}`);
            if (editItem) {
                setEditDrafts(prev => {
                    const next = { ...prev };
                    delete next[editItem.id];
                    return next;
                });
            }
            setEditSuccess(true);
            closeEditModal();
            fetchAgentDetail();
        } catch (err) {
            setEditError(err.message);
        } finally {
            setEditSubmitting(false);
        }
    };

    // ── Formatters & Helpers ───────────────────────────────────────────────────
    const splitAddressTwoLines = (address) => {
        if (!address) return ['—', ''];
        const str = String(address).trim();
        const commaIdx = str.indexOf(',');
        if (commaIdx !== -1) {
            return [str.slice(0, commaIdx).trim(), str.slice(commaIdx + 1).trim()];
        }
        const stateZipMatch = str.search(/\s+(?=[A-Z]{2}\s+\d{5})/i);
        if (stateZipMatch !== -1) {
            return [str.slice(0, stateZipMatch).trim(), str.slice(stateZipMatch + 1).trim()];
        }
        if (str.length > 22) {
            const mid = Math.floor(str.length / 2);
            const spaceIdx = str.indexOf(' ', mid);
            if (spaceIdx !== -1) {
                return [str.slice(0, spaceIdx).trim(), str.slice(spaceIdx + 1).trim()];
            }
        }
        return [str, ''];
    };

    const formatCurrency = (val) => {
        if (val === undefined || val === null || val === '' || isNaN(Number(val))) return '—';
        const num = Number(val);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: num % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const formatHistoryDateTime = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const formattedTime = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            return `${formattedDate} at ${formattedTime}`;
        } catch (e) {
            return dateStr;
        }
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
                <Badge variant="success" className="px-2.5 py-0.5 text-xs font-semibold shadow-2xs whitespace-nowrap inline-flex items-center">
                    Paid
                </Badge>
            );
        }
        if (s.includes('garnishment') || s.includes('garnish')) {
            return (
                <Badge variant="destructive" className="px-2.5 py-0.5 text-[11px] font-semibold shadow-2xs whitespace-nowrap inline-flex items-center max-w-full truncate">
                    Wage Garnishment
                </Badge>
            );
        }
        if (s.includes('replacement') || s === 'replacement') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap max-w-full truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                    Replacement
                </span>
            );
        }
        if (s.includes('pending partial') || s === 'pending partial') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap max-w-full truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    {status}
                </span>
            );
        }
        if (s.includes('pending')) {
            return (
                <Badge variant="warning" className="px-2.5 py-0.5 text-xs font-semibold shadow-2xs whitespace-nowrap inline-flex items-center">
                    Pending
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold text-slate-600 whitespace-nowrap inline-flex items-center max-w-full truncate">
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
                    } else if (keyLower.includes('replacement')) {
                        badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                        dotClass = 'bg-purple-500';
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
                    <span className={`text-xs font-bold ${isOver ? 'text-red-600' : 'text-slate-800'
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

    // ── SkySlope Detail Popup Component ─────────────────────────────────────────
    const renderSkySlopePopupModal = () => {
        if (!skySlopePopup?.open) return null;
        return (
            <>
                <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px]" onClick={closeSkySlopePopup} />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeSkySlopePopup(); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden" style={{ height: '90vh', maxHeight: '90vh' }}>

                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">SkySlope Transaction Detail</h2>
                                {skySlopePopup.data?.skyslope?.status && (
                                    <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0.5 rounded">
                                        {skySlopePopup.data.skyslope.status}
                                    </Badge>
                                )}
                            </div>
                            <button onClick={closeSkySlopePopup} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Segment Tabs */}
                        {skySlopePopup.data && !skySlopePopup.loading && !skySlopePopup.error && (
                            <div className="flex border-b border-slate-100 shrink-0">
                                {skySlopePopup.data.skyslope && (
                                    <button
                                        type="button"
                                        onClick={() => setSkySlopePopup(prev => ({ ...prev, segment: 'skyslope' }))}
                                        className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${skySlopePopup.segment === 'skyslope'
                                            ? 'border-sky-600 text-sky-700 bg-sky-50/10'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                                            }`}
                                    >
                                        SkySlope Record
                                    </button>
                                )}
                                {skySlopePopup.data.brokerage_engine_records?.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSkySlopePopup(prev => ({ ...prev, segment: 'brokerage_engine' }))}
                                        className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${skySlopePopup.segment === 'brokerage_engine'
                                            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/10'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                                            }`}
                                    >
                                        Brokerage Engine Record
                                    </button>
                                )}
                                {skySlopePopup.data.otherincome_transactions?.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSkySlopePopup(prev => ({ ...prev, segment: 'other_income' }))}
                                        className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-all ${skySlopePopup.segment === 'other_income'
                                            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/10'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                                            }`}
                                    >
                                        Other Income Record
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Body */}
                        {skySlopePopup.loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                                <svg className="animate-spin h-7 w-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <p className="text-xs font-semibold text-slate-400">Fetching SkySlope details…</p>
                            </div>
                        ) : skySlopePopup.error ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                <p className="font-bold text-red-600 text-sm">Failed to load details</p>
                                <p className="text-xs text-slate-500">{skySlopePopup.error}</p>
                            </div>
                        ) : skySlopePopup.data ? (
                            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                {skySlopePopup.segment === 'skyslope' && skySlopePopup.data.skyslope && (
                                    <SectionedDetailView data={skySlopePopup.data.skyslope} />
                                )}
                                {skySlopePopup.segment === 'brokerage_engine' && (
                                    skySlopePopup.data.brokerage_engine_records?.length > 0
                                        ? skySlopePopup.data.brokerage_engine_records.map((rec, idx) => (
                                            <div key={idx} className="space-y-4">
                                                {skySlopePopup.data.brokerage_engine_records.length > 1 && (
                                                    <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">Record #{idx + 1}</h4>
                                                )}
                                                <SectionedDetailView data={rec} />
                                            </div>
                                        ))
                                        : <p className="text-sm text-slate-400 text-center py-12">No Brokerage Engine record found</p>
                                )}
                                {skySlopePopup.segment === 'other_income' && (
                                    skySlopePopup.data.otherincome_transactions?.length > 0
                                        ? skySlopePopup.data.otherincome_transactions.map((rec, idx) => (
                                            <div key={idx} className="space-y-4">
                                                {skySlopePopup.data.otherincome_transactions.length > 1 && (
                                                    <h4 className="text-xs font-bold text-slate-700 bg-slate-100/60 p-2 rounded">Record #{idx + 1}</h4>
                                                )}
                                                <SectionedDetailView data={rec} />
                                            </div>
                                        ))
                                        : <p className="text-sm text-slate-400 text-center py-12">No Other Income record found</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-sm text-slate-400">No detail data available.</p>
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    };

    const renderGarnishmentPopupModal = () => {
        if (!garnishmentPopup?.open) return null;
        const data = garnishmentPopup.data;
        const sourceTx = data?.source_transaction;
        const advances = data?.commission_advances || [];

        return (
            <>
                <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px]" onClick={closeGarnishmentPopup} />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeGarnishmentPopup(); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ height: '85vh', maxHeight: '85vh' }}>

                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 bg-slate-50/80">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Wage Garnishment Details</h2>
                                    <p className="text-xs text-slate-500">Transaction ledger and linked commission advance history</p>
                                </div>
                            </div>
                            <button onClick={closeGarnishmentPopup} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        {garnishmentPopup.loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                                <svg className="animate-spin h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <p className="text-xs font-semibold text-slate-400">Fetching Garnishment details…</p>
                            </div>
                        ) : garnishmentPopup.error ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-1 p-6">
                                <p className="font-bold text-red-600 text-sm">Failed to load garnishment details</p>
                                <p className="text-xs text-slate-500">{garnishmentPopup.error}</p>
                            </div>
                        ) : data ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                                {/* Source Transaction Card Banner */}
                                {sourceTx && (
                                    <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50/90 via-amber-50/30 to-white p-4 space-y-2 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider bg-red-100 px-2 py-0.5 rounded border border-red-200">
                                                Source Transaction
                                            </span>
                                            {sourceTx.company && (
                                                <span className="text-xs font-bold text-slate-700">{sourceTx.company}</span>
                                            )}
                                        </div>
                                        {sourceTx.address && (
                                            <div className="text-sm font-bold text-slate-900">{sourceTx.address}</div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-red-100 text-xs">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Original Amount</span>
                                                <span className="text-sm font-bold text-slate-800">{formatCurrency(sourceTx.original_amount)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Outstanding Balance</span>
                                                <span className="text-sm font-extrabold text-red-700">{formatCurrency(sourceTx.outstanding_amount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Commission Advances Ledger List */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                                        Linked Commission Advances ({advances.length})
                                    </h3>

                                    {advances.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-8">No commission advance records found for this garnishment.</p>
                                    ) : (
                                        advances.map((adv, idx) => (
                                            <div key={idx} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs space-y-3">
                                                {/* Header for advance */}
                                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">{adv.address}</div>
                                                        <div className="text-[11px] text-slate-500">{adv.company}</div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs">
                                                        <div>
                                                            <span className="text-[10px] text-slate-400 font-semibold block">Original</span>
                                                            <span className="font-semibold text-slate-700">{formatCurrency(adv.original_amount)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] text-slate-400 font-semibold block">Outstanding</span>
                                                            <span className="font-bold text-red-600">{formatCurrency(adv.outstanding_amount)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Transactions Table */}
                                                <div className="px-4 pb-3 overflow-x-auto">
                                                    <table className="w-full text-left text-xs border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                <th className="py-2 pr-3">Date</th>
                                                                <th className="py-2 px-3">Operation</th>
                                                                <th className="py-2 px-3">Type</th>
                                                                <th className="py-2 px-3 text-right">Amount</th>
                                                                <th className="py-2 px-3 text-right">Outstanding</th>
                                                                <th className="py-2 pl-3">Notes</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {(adv.transactions || []).map((tx) => {
                                                                const isDebit = tx.type?.toLowerCase() === 'debit';
                                                                const isCredit = tx.type?.toLowerCase() === 'credit';
                                                                const typeBadgeCls = isDebit
                                                                    ? 'bg-red-100 text-red-700 border-red-200'
                                                                    : isCredit
                                                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                                        : 'bg-blue-100 text-blue-700 border-blue-200';

                                                                return (
                                                                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                                                                        <td className="py-2.5 pr-3 font-medium text-slate-700 whitespace-nowrap">
                                                                            {formatDateUS(tx.transaction_date)}
                                                                        </td>
                                                                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                                                                            {tx.operation}
                                                                        </td>
                                                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${typeBadgeCls}`}>
                                                                                {tx.type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                                                            {formatCurrency(tx.amount)}
                                                                        </td>
                                                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                                                                            {formatCurrency(tx.outstanding_amount)}
                                                                        </td>
                                                                        <td className="py-2.5 pl-3 text-slate-500 text-[11px]">
                                                                            {tx.notes
                                                                                ? <span className="block text-slate-700 font-medium">{tx.notes}</span>
                                                                                : <span className="text-slate-300 italic">—</span>}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </>
        );
    };

    // Calculate aggregated details stats
    const detailTotalAmount = detailItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const agentState = detailItems[0]?.state || '';

    // ── RENDER LOG ADVANCE FORM ─────────────────────────────────────────────────
    if (activeView === 'log_advance') {
        return (
            <>
                <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-6">
                    {/* Top Header Block */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleBackToList}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors select-none"
                        >
                            <IconArrowLeft /> Back to Commission Advances
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Log New Commission Advance</h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Fill in the details below to record a new advance entry.
                            </p>
                        </div>
                    </div>

                    {/* Form Card */}
                    <Card className="border border-slate-200/90 shadow-sm bg-white rounded-xl overflow-hidden">
                        <CardContent className="p-6 sm:p-8">
                            <form onSubmit={handleLogFormSubmit} className="space-y-5">
                                {/* Row 1: Agent Name & Company */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Agent Name */}
                                    <div className="space-y-1.5 relative">
                                        <label className="text-xs font-bold text-slate-700 block" htmlFor="log-agent-name">
                                            Agent Name <span className="text-red-500">*</span>
                                        </label>
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
                                                className={`w-full h-10 text-sm rounded-lg ${fetchingAgentSuggestions ? 'pr-9' : ''}`}
                                            />
                                            {fetchingAgentSuggestions && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Autocomplete suggestions */}
                                        {showAgentSuggestions && !fetchingAgentSuggestions && agentSuggestions.length > 0 && (
                                            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto py-1 divide-y divide-slate-100">
                                                {agentSuggestions.map((item, idx) => {
                                                    const nameStr = typeof item === 'string' ? item : (item.display_name || item.agent_name || item.name || JSON.stringify(item));
                                                    const status = typeof item === 'object' ? (item.agent_status || '') : '';
                                                    const isActive = status.toLowerCase() === 'active';
                                                    const itemGarnishment = typeof item === 'object' && (item.has_wage_garnishment || !!item.wage_garnishment);
                                                    const gAmt = typeof item === 'object' ? (item.wage_garnishment?.outstanding_amount ?? item.wage_garnishment?.original_amount ?? 0) : 0;
                                                    const office = typeof item === 'object' ? item.office : '';

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
                                                            className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-blue-50/80 text-slate-800 transition-colors flex items-center justify-between gap-2"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">{nameStr}</span>
                                                                {office && (
                                                                    <span className="text-[11px] text-slate-400 truncate">{office.trim()}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {itemGarnishment && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                                        Garnishment: {formatCurrency(gAmt)}
                                                                    </span>
                                                                )}
                                                                {status && (
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                        {status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Selected Agent Info Card */}
                                        {selectedAgentInfo && (
                                            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2 text-xs">
                                                <div className="flex items-center justify-between gap-2">
                                                    {selectedAgentInfo.agent_status && (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${(selectedAgentInfo.agent_status || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${(selectedAgentInfo.agent_status || '').toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            {selectedAgentInfo.agent_status}
                                                        </span>
                                                    )}
                                                    {selectedAgentInfo.office && (
                                                        <span className="text-[11px] font-medium text-slate-500 truncate" title={selectedAgentInfo.office}>
                                                            {selectedAgentInfo.office.trim()}
                                                        </span>
                                                    )}
                                                </div>

                                                {(selectedAgentInfo.has_wage_garnishment || selectedAgentInfo.wage_garnishment) && (
                                                    <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-900 space-y-1 font-medium">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 font-bold text-red-700 text-[11px] uppercase">
                                                                <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                Wage Garnishment Active
                                                            </div>
                                                            {(() => {
                                                                const gId = typeof selectedAgentInfo.wage_garnishment === 'object'
                                                                    ? (selectedAgentInfo.wage_garnishment?.id ?? selectedAgentInfo.wage_garnishment?.garnishment_id ?? selectedAgentInfo.wage_garnishment_id)
                                                                    : (typeof selectedAgentInfo.wage_garnishment === 'number' ? selectedAgentInfo.wage_garnishment : selectedAgentInfo.wage_garnishment_id);
                                                                return gId ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openGarnishmentPopup(gId)}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-2xs shrink-0"
                                                                    >
                                                                        Details
                                                                    </button>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs pt-0.5">
                                                            <span className="text-slate-600">Outstanding:</span>
                                                            <span className="font-bold text-red-700">{formatCurrency(selectedAgentInfo.wage_garnishment?.outstanding_amount ?? 0)}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedAgentInfo.general_notes && (
                                                    <div className="text-[11px] text-slate-600">
                                                        <span className="font-semibold text-slate-500">General Notes:</span> {selectedAgentInfo.general_notes}
                                                    </div>
                                                )}
                                                {selectedAgentInfo.internal_notes && (
                                                    <div className="text-[11px] text-slate-600">
                                                        <span className="font-semibold text-slate-500">Internal Notes:</span> {selectedAgentInfo.internal_notes}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Company */}
                                    <div className="space-y-1.5 relative">
                                        <label className="text-xs font-bold text-slate-700 block" htmlFor="log-company">
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
                                            placeholder="Select or type company..."
                                            required
                                            autoComplete="off"
                                            className="w-full h-10 text-sm rounded-lg"
                                        />
                                        {showCompanySuggestions && dropdownOptions.company.length > 0 && (() => {
                                            const filtered = dropdownOptions.company.filter(c =>
                                                c.toLowerCase().includes((logForm.company || '').toLowerCase())
                                            );
                                            return filtered.length > 0 ? (
                                                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
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

                                {/* Row 2: Property Address */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-xs font-bold text-slate-700 block" htmlFor="log-address">
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
                                        placeholder="Type to search property address..."
                                        required
                                        autoComplete="off"
                                        className="w-full h-10 text-sm rounded-lg"
                                    />
                                    {showAddressSuggestions && addressSuggestions.length > 0 && (
                                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto py-1 divide-y divide-slate-100">
                                            {addressSuggestions.map((item, idx) => {
                                                const addrStr = typeof item === 'string' ? item : (item.address || item.property_address || item.name || JSON.stringify(item));
                                                const status = typeof item === 'object' ? (item.ss_status || '') : '';
                                                const statusColor = {
                                                    closed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                    archived: 'bg-slate-100 text-slate-500 border-slate-200',
                                                    active: 'bg-blue-100 text-blue-700 border-blue-200',
                                                }[status.toLowerCase()] || 'bg-amber-100 text-amber-700 border-amber-200';

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
                                                        className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-blue-50 text-slate-800 transition-colors flex items-center justify-between gap-2"
                                                    >
                                                        <span className="font-semibold text-slate-800 truncate">{addrStr}</span>
                                                        {status && (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${statusColor}`}>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                                {status}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Selected Address Info */}
                                    {selectedAddressInfo && (
                                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 flex items-center gap-4 flex-wrap text-xs">
                                            {selectedAddressInfo.ss_status && (() => {
                                                const s = (selectedAddressInfo.ss_status || '').toLowerCase();
                                                const cls = s === 'closed'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : s === 'archived'
                                                        ? 'bg-slate-100 text-slate-500'
                                                        : 'bg-amber-100 text-amber-700';
                                                return (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cls}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                        SkySlope: {selectedAddressInfo.ss_status}
                                                    </span>
                                                );
                                            })()}
                                            {selectedAddressInfo.close_date && (
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Close Date</span>
                                                    <span className="font-semibold text-slate-700">{formatDateUS(selectedAddressInfo.close_date)}</span>
                                                </div>
                                            )}
                                            {selectedAddressInfo.saleguid && (
                                                <button
                                                    type="button"
                                                    onClick={() => openSkySlopePopup(selectedAddressInfo.saleguid)}
                                                    className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs shrink-0"
                                                >
                                                    View SkySlope Details
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Row 3: Amount ($) & Date */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {!(selectedAgentInfo?.has_wage_garnishment || selectedAgentInfo?.wage_garnishment) && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 block" htmlFor="log-amount">
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
                                            className="w-full h-10 text-sm rounded-lg"
                                        />
                                    </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 block" htmlFor="log-date">
                                            Approval Date
                                        </label>
                                        <Input
                                            id="log-date"
                                            name="date"
                                            type="date"
                                            value={logForm.date}
                                            onChange={handleLogFormChange}
                                            className="w-full h-10 text-sm bg-white rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* Row 4: Notes */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 block" htmlFor="log-notes">
                                        Notes
                                    </label>
                                    <textarea
                                        id="log-notes"
                                        name="notes"
                                        value={logForm.notes}
                                        onChange={handleLogFormChange}
                                        placeholder="Optional notes about this advance..."
                                        rows={3}
                                        className="flex w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm shadow-2xs transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-slate-800 resize-none"
                                    />
                                </div>

                                {/* Success Banner */}
                                {logSuccess && (
                                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                                        <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Commission advance logged successfully.
                                    </div>
                                )}

                                {/* Error Banner */}
                                {logError && (
                                    <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                                        <svg className="h-4 w-4 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        </svg>
                                        {logError}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={handleBackToList}
                                        className="inline-flex items-center justify-center rounded-lg font-semibold transition-colors h-9 px-4 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 select-none"
                                    >
                                        Cancel
                                    </button>
                                    <Button
                                        id="log-advance-submit-btn"
                                        type="submit"
                                        disabled={logSubmitting}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition-colors h-9 px-5 text-xs rounded-lg min-w-[120px]"
                                    >
                                        {logSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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

                {renderSkySlopePopupModal()}
                {renderGarnishmentPopupModal()}
            </>
        );
    }

    // ── RENDER DETAIL VIEW ─────────────────────────────────────────────────────
    if (activeAgentName) {
        return (
            <>
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
                                    {detailLoading ? '...' : (detailSummary?.total_count ?? detailItems.length)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Total Outstanding</p>
                                <p className="text-xl font-bold text-red-600 mt-0.5">
                                    {detailLoading ? '...' : formatCurrency(detailSummary?.total_outstanding ?? 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Table View (Single Table with Status Column) */}
                    <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white">
                        <Table className="w-full">
                            <TableHeader className="bg-slate-50/70">
                                <TableRow className="border-b border-slate-200">
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Address & Company
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">
                                        Original
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">
                                        Paid
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">
                                        Outstanding
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">
                                        Approved Date
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">
                                        Paid Date
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Status
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Notes
                                    </TableHead>
                                    <TableHead className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailLoading ? (
                                    Array.from({ length: 4 }).map((_, idx) => (
                                        <TableRow key={idx} className="animate-pulse">
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-4/5 mb-1" /><div className="h-3 bg-slate-100 rounded w-1/3" /></TableCell>
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-14" /></TableCell>
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-14" /></TableCell>
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-14" /></TableCell>
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-16" /></TableCell>
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-16" /></TableCell>
                                            <TableCell className="px-3"><div className="h-6 bg-slate-100 rounded-full w-20" /></TableCell>
                                            <TableCell className="px-3"><div className="h-4 bg-slate-100 rounded w-12" /></TableCell>
                                            <TableCell className="px-3"><div className="h-7 bg-slate-100 rounded w-28 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : detailError ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10 text-red-500 bg-red-50/50 font-semibold">
                                            Error loading details: {detailError}
                                        </TableCell>
                                    </TableRow>
                                ) : detailItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                                            No transaction items found for this agent.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    detailItems.map((item, idx) => {
                                        const [line1, line2] = splitAddressTwoLines(item.address);
                                        const paidAmount = item.amount_paid !== undefined && item.amount_paid !== null
                                            ? item.amount_paid
                                            : Math.max(0, (item.original_amount || 0) - (item.outstanding_amount || 0));
                                        const hasTransactions = Array.isArray(item.transactions) && item.transactions.length > 0;
                                        const hasHistory = Array.isArray(item.history) && item.history.length > 0;

                                        return (
                                            <React.Fragment key={item.id ?? idx}>
                                                <TableRow className={`hover:bg-slate-50/80 transition-colors ${expandedLogs[item.id] ? 'border-b-0' : ''}`}>
                                                    {/* Property Address & Company */}
                                                    <TableCell className="px-3 py-3.5 align-top max-w-[220px]">
                                                        <div className="space-y-0.5 min-w-0">
                                                            <span className="font-semibold text-slate-800 text-sm block whitespace-normal break-words leading-snug" title={item.address || ''}>
                                                                {line1 || '—'}
                                                            </span>
                                                            {line2 && (
                                                                <span className="text-xs text-slate-400 font-normal block whitespace-normal break-words leading-snug" title={line2}>
                                                                    {line2}
                                                                </span>
                                                            )}
                                                            {item.company && (
                                                                <span className="inline-block mt-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                                                                    {item.company}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Original */}
                                                    <TableCell className="px-3 py-3.5 align-top font-semibold text-slate-800 text-sm text-right whitespace-nowrap">
                                                        {formatCurrency(item.original_amount)}
                                                    </TableCell>

                                                    {/* Paid */}
                                                    <TableCell className="px-3 py-3.5 align-top font-semibold text-slate-700 text-sm text-right whitespace-nowrap">
                                                        {formatCurrency(paidAmount)}
                                                    </TableCell>

                                                    {/* Outstanding */}
                                                    <TableCell className="px-3 py-3.5 align-top text-sm text-right whitespace-nowrap">
                                                        <span className={`font-bold ${(item.outstanding_amount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {formatCurrency(item.outstanding_amount)}
                                                        </span>
                                                    </TableCell>

                                                    {/* Approved Date */}
                                                    <TableCell className="px-3 py-3.5 align-top text-xs font-medium text-slate-600 text-center whitespace-nowrap">
                                                        {formatDateUS(item.approved_date)}
                                                    </TableCell>

                                                    {/* Paid Date */}
                                                    <TableCell className="px-3 py-3.5 align-top text-xs font-medium text-slate-600 text-center whitespace-nowrap">
                                                        {formatDateUS(item.paid_date)}
                                                    </TableCell>

                                                    {/* Status */}
                                                    <TableCell className="px-3 py-3.5 align-top min-w-0">
                                                        {renderDetailStatusBadge(item.status)}
                                                    </TableCell>

                                                    {/* Notes */}
                                                    <TableCell className="px-3 py-3.5 align-top text-xs text-slate-500 italic min-w-0">
                                                        <span className="block truncate max-w-full" title={item.notes || ''}>
                                                            {item.notes || '—'}
                                                        </span>
                                                    </TableCell>

                                                    {/* Actions */}
                                                    <TableCell className="py-3.5 align-top text-right">
                                                        <div className="inline-block text-left actions-dropdown-container">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => openActionMenu(e, item.id)}
                                                                className={`p-1.5 rounded-lg border transition-all ${openActionMenuId === item.id
                                                                    ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
                                                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                                                                    }`}
                                                                title="Actions menu"
                                                            >
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                                </svg>
                                                            </button>

                                                            {openActionMenuId === item.id && menuState && ReactDOM.createPortal(
                                                                <div
                                                                    className="actions-dropdown-portal fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-left"
                                                                    style={{
                                                                        top: menuState.openUpward ? menuState.top - 8 : menuState.top + 4,
                                                                        left: menuState.left - 176,
                                                                        transform: menuState.openUpward ? 'translateY(-100%)' : 'none',
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    {/* View/Hide Logs */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleLogs(item.id);
                                                                            setMenuState(null);
                                                                        }}
                                                                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between gap-2"
                                                                    >
                                                                        <span className="flex items-center gap-2">
                                                                            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                            </svg>
                                                                            {expandedLogs[item.id] ? 'Hide Logs' : 'View Logs'}
                                                                        </span>
                                                                        {(hasTransactions || hasHistory) && (
                                                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                {hasTransactions ? item.transactions.length : item.history.length}
                                                                            </span>
                                                                        )}
                                                                    </button>

                                                                    {/* SkySlope Details */}
                                                                    <button
                                                                        type="button"
                                                                        disabled={!item.saleguid && !item.sale_guid}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const guid = item.saleguid || item.sale_guid;
                                                                            if (guid) openSkySlopePopup(guid);
                                                                            setMenuState(null);
                                                                        }}
                                                                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2 ${item.saleguid || item.sale_guid
                                                                            ? 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                                                                            : 'text-slate-300 cursor-not-allowed'
                                                                            }`}
                                                                    >
                                                                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                        Details
                                                                    </button>

                                                                    <div className="my-1 border-t border-slate-100" />

                                                                    {/* Edit Record */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            openEditModal(item);
                                                                            setMenuState(null);
                                                                        }}
                                                                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 01-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                        Edit
                                                                    </button>
                                                                </div>,
                                                                document.body
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Logs Section */}
                                                {expandedLogs[item.id] && (
                                                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200">
                                                        <TableCell colSpan={9} className="py-4 px-6">
                                                            {hasTransactions ? (
                                                                <div className="space-y-3 bg-slate-900/5 p-4 rounded-xl border border-slate-200/90 shadow-inner">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                                                                            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                            </svg>
                                                                            Logs ({item.transactions.length} {item.transactions.length === 1 ? 'entry' : 'entries'})
                                                                        </div>
                                                                    </div>

                                                                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
                                                                        <table className="w-full text-left text-xs border-collapse table-fixed">
                                                                            <thead>
                                                                                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                                                                    <th className="py-2.5 px-4 w-[20%]">Operation</th>
                                                                                    <th className="py-2.5 px-4 w-[12%]">Type</th>
                                                                                    <th className="py-2.5 px-4 w-[16%]">Transaction Date</th>
                                                                                    <th className="py-2.5 px-4 w-[15%]">Amount</th>
                                                                                    <th className="py-2.5 px-4 w-[15%]">Outstanding</th>
                                                                                    <th className="py-2.5 px-4 w-[22%]">Notes</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100">
                                                                                {item.transactions.map((tx, txIdx) => {
                                                                                    const typeLower = (tx.type || '').toLowerCase();
                                                                                    let typeBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                                                                                    let typeDotClass = 'bg-slate-400';

                                                                                    if (typeLower === 'debit') {
                                                                                        typeBadgeClass = 'bg-red-50 text-red-700 border-red-200';
                                                                                        typeDotClass = 'bg-red-500';
                                                                                    } else if (typeLower === 'credit') {
                                                                                        typeBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                                                                        typeDotClass = 'bg-emerald-500';
                                                                                    } else if (typeLower === 'status') {
                                                                                        typeBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                                                                                        typeDotClass = 'bg-purple-500';
                                                                                    }

                                                                                    const isDebit = typeLower === 'debit';
                                                                                    const isCredit = typeLower === 'credit';

                                                                                    return (
                                                                                        <tr key={tx.id ?? txIdx} className="hover:bg-slate-50/80 transition-colors">
                                                                                            {/* Operation */}
                                                                                            <td className="py-2.5 px-4 font-semibold text-slate-800 align-middle">
                                                                                                {tx.operation || '—'}
                                                                                            </td>

                                                                                            {/* Type */}
                                                                                            <td className="py-2.5 px-4 align-middle">
                                                                                                {tx.type ? (
                                                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${typeBadgeClass}`}>
                                                                                                        <span className={`w-1.5 h-1.5 rounded-full ${typeDotClass}`} />
                                                                                                        {tx.type}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-slate-400 italic">—</span>
                                                                                                )}
                                                                                            </td>

                                                                                            {/* Transaction Date */}
                                                                                            <td className="py-2.5 px-4 text-slate-600 font-medium align-middle whitespace-nowrap">
                                                                                                {formatDateUS(tx.transaction_date)}
                                                                                            </td>

                                                                                            {/* Amount */}
                                                                                            <td className="py-2.5 px-4 font-semibold align-middle whitespace-nowrap">
                                                                                                <span className={isCredit ? 'text-emerald-700' : isDebit ? 'text-slate-900' : 'text-slate-700'}>
                                                                                                    {formatCurrency(tx.amount)}
                                                                                                </span>
                                                                                            </td>

                                                                                            {/* Outstanding */}
                                                                                            <td className="py-2.5 px-4 font-bold align-middle whitespace-nowrap">
                                                                                                <span className={(tx.outstanding_amount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                                                                                                    {formatCurrency(tx.outstanding_amount)}
                                                                                                </span>
                                                                                            </td>

                                                                                            {/* Notes */}
                                                                                            <td className="py-2.5 px-4 text-slate-500 italic align-middle whitespace-normal break-words">
                                                                                                {tx.notes || '—'}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : hasHistory ? (
                                                                <div className="space-y-3 bg-slate-900/5 p-4 rounded-xl border border-slate-200/90 shadow-inner">
                                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                                                                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                        </svg>
                                                                        Log history ({item.history.length} {item.history.length === 1 ? 'entry' : 'entries'})
                                                                    </div>

                                                                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
                                                                        <table className="w-full text-left text-xs border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                                                                    <th className="py-2.5 px-4 w-[24%]">Date & Time</th>
                                                                                    <th className="py-2.5 px-4 w-[22%]">Field Modified</th>
                                                                                    <th className="py-2.5 px-4 w-[27%]">Previous Value</th>
                                                                                    <th className="py-2.5 px-4 w-[27%]">Updated Value</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100">
                                                                                {item.history.flatMap((hist, hIdx) => {
                                                                                    const changes = hist.changes && hist.changes.length > 0
                                                                                        ? hist.changes
                                                                                        : [{ field: 'Record Updated', old_value: '—', new_value: '—' }];

                                                                                    return changes.map((change, cIdx) => (
                                                                                        <tr key={`${hIdx}-${cIdx}`} className="hover:bg-slate-50/80 transition-colors">
                                                                                            {cIdx === 0 && (
                                                                                                <td rowSpan={changes.length} className="py-2.5 px-4 font-mono text-[11px] font-medium text-slate-700 bg-slate-50/40 align-top border-r border-slate-100">
                                                                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                                                                        {formatHistoryDateTime(hist.edited_at)}
                                                                                                    </div>
                                                                                                </td>
                                                                                            )}
                                                                                            <td className="py-2.5 px-4 font-sans font-semibold text-slate-800 align-top">
                                                                                                {change.field}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-4 text-slate-500 bg-slate-50/20 align-top whitespace-normal break-words max-w-[240px]">
                                                                                                {change.old_value !== null && change.old_value !== undefined && change.old_value !== '' ? (
                                                                                                    <span className="inline-block font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 whitespace-normal break-words">
                                                                                                        {String(change.old_value)}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-slate-400 italic font-sans">—</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-4 font-semibold text-slate-900 bg-emerald-50/20 align-top whitespace-normal break-words max-w-[240px]">
                                                                                                {change.new_value !== null && change.new_value !== undefined && change.new_value !== '' ? (
                                                                                                    <span className="inline-block font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200/60 whitespace-normal break-words">
                                                                                                        {String(change.new_value)}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-slate-400 italic font-sans">—</span>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ));
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-slate-400 italic py-3 px-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                                                                    No logs recorded for this advance record.
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </Card>

                    {/* ── Edit Modal ─────────────────────────────────────────── */}
                    {editItem && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }}
                            onClick={closeEditModal}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
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
                                <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
                                    {/* Financial Summary Card */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 grid grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original Amount</p>
                                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                                                {formatCurrency(editItem.original_amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Amount</p>
                                            <p className="text-sm font-bold text-slate-700 mt-0.5">
                                                {formatCurrency(Math.max(0, (editItem.original_amount || 0) - (editItem.outstanding_amount || 0)))}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Amount</p>
                                            <p className={`text-sm font-bold mt-0.5 ${(editItem.outstanding_amount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(editItem.outstanding_amount)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status & Operation */}
                                    {(() => {
                                        const currentStatus = (editForm.status || '').trim().toLowerCase();
                                        const showOperation = currentStatus === 'pending' || currentStatus === 'pending partial';

                                        return (
                                            <div className={`grid gap-4 ${showOperation ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                                                {/* Status */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
                                                    <select
                                                        name="status"
                                                        value={editForm.status || ''}
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
                                                                <option key="Pending Partial" value="Pending Partial">Pending Partial</option>,
                                                                <option key="Paid" value="Paid">Paid</option>,
                                                                <option key="Wage Garnishment" value="Wage Garnishment">Wage Garnishment</option>,
                                                                <option key="Replacement" value="Replacement">Replacement</option>,
                                                            ]
                                                        }
                                                    </select>
                                                </div>

                                                {/* Operation (only for Pending or Pending Partial) */}
                                                {showOperation && (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operation</label>
                                                        <select
                                                            name="operation"
                                                            value={editForm.operation || ''}
                                                            onChange={handleEditFormChange}
                                                            className="flex w-full rounded-md border border-input bg-white px-3 h-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-800"
                                                        >
                                                            <option value="">— Select operation —</option>
                                                            {editOperationOptions.length > 0
                                                                ? editOperationOptions.map(op => (
                                                                    <option key={op} value={op}>{op}</option>
                                                                ))
                                                                : [
                                                                    <option key="Payment" value="Payment">Payment</option>,
                                                                    <option key="Interest" value="Interest">Interest</option>,
                                                                    <option key="Fee" value="Fee">Fee</option>,
                                                                    <option key="Amendment" value="Amendment">Amendment</option>,
                                                                ]
                                                            }
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Property Address Search (visible when status is Replacement) */}
                                    {(editForm.status || '').trim().toLowerCase() === 'replacement' && (
                                        <div className="space-y-1 relative">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="edit-address">
                                                Property Address <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                id="edit-address"
                                                name="address"
                                                value={editForm.address || ''}
                                                onChange={(e) => {
                                                    handleEditFormChange(e);
                                                    setShowEditAddressSuggestions(false);
                                                    setEditSelectedAddressInfo(null);
                                                }}
                                                onBlur={() => setTimeout(() => setShowEditAddressSuggestions(false), 150)}
                                                placeholder="Type to search replacement address..."
                                                autoComplete="off"
                                                className="w-full h-9 text-sm"
                                            />
                                            {showEditAddressSuggestions && editAddressSuggestions.length > 0 && (
                                                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto py-1">
                                                    {editAddressSuggestions.map((item, idx) => {
                                                        const addrStr = typeof item === 'string' ? item : (item.address || item.property_address || item.name || JSON.stringify(item));
                                                        const status = typeof item === 'object' ? (item.ss_status || '') : '';
                                                        const statusColor = {
                                                            closed: 'bg-emerald-100 text-emerald-700 [&>span]:bg-emerald-500',
                                                            archived: 'bg-slate-100 text-slate-500 [&>span]:bg-slate-400',
                                                            active: 'bg-blue-100 text-blue-700 [&>span]:bg-blue-500',
                                                        }[status.toLowerCase()] || 'bg-amber-100 text-amber-700 [&>span]:bg-amber-500';
                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    editAddressJustSelectedRef.current = true;
                                                                    const addrValue = typeof item === 'string' ? item : (item.address || item.property_address || addrStr);
                                                                    setEditForm(prev => ({ ...prev, address: addrValue }));
                                                                    if (typeof item === 'object') {
                                                                        setEditSelectedAddressInfo(item);
                                                                    }
                                                                    setShowEditAddressSuggestions(false);
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
                                            {editSelectedAddressInfo && (
                                                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-3 flex items-center gap-4 flex-wrap">
                                                    {editSelectedAddressInfo.ss_status && (() => {
                                                        const s = (editSelectedAddressInfo.ss_status || '').toLowerCase();
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
                                                                {editSelectedAddressInfo.ss_status}
                                                            </span>
                                                        );
                                                    })()}
                                                    {editSelectedAddressInfo.close_date && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Close Date</p>
                                                            <p className="text-xs font-semibold text-slate-700">{formatDateUS(editSelectedAddressInfo.close_date)}</p>
                                                        </div>
                                                    )}
                                                    {(editSelectedAddressInfo.saleguid || editSelectedAddressInfo.sale_guid) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openSkySlopePopup(editSelectedAddressInfo.saleguid || editSelectedAddressInfo.sale_guid)}
                                                            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm shrink-0"
                                                        >
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            Details
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                                    <div className="space-y-3">
                                                        {/* Amount Field */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                                    Amount ($)
                                                                </label>
                                                                {(editForm.operation || '').trim().toLowerCase() === 'amendment' && (
                                                                    <div className="inline-flex rounded-md bg-slate-100 p-0.5 border border-slate-200 shadow-inner">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEditForm(prev => ({ ...prev, amendment_sign: '+' }))}
                                                                            className={`px-3 py-0.5 text-xs font-bold rounded transition-all ${(editForm.amendment_sign || '+') === '+'
                                                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                                                                                }`}
                                                                        >
                                                                            +
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEditForm(prev => ({ ...prev, amendment_sign: '-' }))}
                                                                            className={`px-3 py-0.5 text-xs font-bold rounded transition-all ${editForm.amendment_sign === '-'
                                                                                ? 'bg-red-600 text-white shadow-sm'
                                                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                                                                                }`}
                                                                        >
                                                                            -
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <Input
                                                                name="amount"
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={editForm.amount}
                                                                onChange={handleEditFormChange}
                                                                placeholder="e.g. 5000"
                                                                className="w-full h-9 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transaction Date</label>
                                                        <Input
                                                            name="transaction_date"
                                                            type="date"
                                                            value={editForm.transaction_date || ''}
                                                            onChange={handleEditFormChange}
                                                            className="w-full h-9 text-sm bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Date</label>
                                                        <Input
                                                            name="approved_date"
                                                            type="date"
                                                            value={editForm.approved_date || ''}
                                                            onChange={handleEditFormChange}
                                                            className="w-full h-9 text-sm bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid Date</label>
                                                        <Input
                                                            name="paid_date"
                                                            type="date"
                                                            value={editForm.paid_date || ''}
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
                                            rows={2}
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

                {renderSkySlopePopupModal()}
                {renderGarnishmentPopupModal()}
            </>
        );
    }

    // ── RENDER SUMMARY & LISTING VIEW ──────────────────────────────────────────
    return (
        <>
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
            {renderSkySlopePopupModal()}
            {renderGarnishmentPopupModal()}
        </>
    );
}

export default CommissionAdvances;

