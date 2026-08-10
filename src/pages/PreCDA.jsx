import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { API_DOMAIN } from '../constants';

function PreCDA() {
    const [qbStatus, setQbStatus] = useState('loading');
    const [realmId, setRealmId] = useState(null);

    useEffect(() => {
        // Parse the query parameters from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('quickbooks');
        const realm = urlParams.get('realm_id');

        if (status) {
            setQbStatus(status);
            setRealmId(realm);

            // Clear the query parameters from the URL immediately so they don't persist
            // or propagate to other pages when navigating
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState(null, '', cleanUrl);
        } else {
            // Hit the token status API to check active QuickBooks connection
            fetch(`${API_DOMAIN}/auth/quickbooks/token-status`)
                .then((res) => res.json())
                .then((data) => {
                    if (data && data.connected) {
                        setQbStatus('connected');
                        setRealmId(data.realm_id || data.realmId);
                    } else {
                        setQbStatus('disconnected');
                    }
                })
                .catch((err) => {
                    console.error('Failed to retrieve QuickBooks token status:', err);
                    setQbStatus('error');
                });
        }
    }, []);

    const handleDownloadReport = () => {
        alert('Downloading Report...');
    };

    const handleConnectQuickBooks = () => {
        window.location.href = `${API_DOMAIN}/auth/quickbooks/login`;
    };

    // Helper to render the QuickBooks status badge based on url parameters or API status
    const renderStatusBadge = () => {
        if (qbStatus === 'loading') {
            return (
                <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold gap-1.5 text-slate-400 bg-slate-50 border-slate-200">
                    <svg className="animate-spin h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking connection...
                </Badge>
            );
        }
        if (qbStatus === 'connected') {
            return (
                <Badge variant="success" className="px-2.5 py-1 text-xs font-semibold gap-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    Connected to QuickBooks {realmId ? `(Realm ID: ${realmId})` : ''}
                </Badge>
            );
        }
        if (qbStatus === 'error') {
            return (
                <Badge variant="destructive" className="px-2.5 py-1 text-xs font-semibold gap-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    QuickBooks Connection Failed
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold gap-1.5 text-slate-500 bg-slate-100 border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                QuickBooks Disconnected
            </Badge>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header & Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">PreCDA</h1>
                        {renderStatusBadge()}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        Prepare and verify pending Commission Disbursement Authorizations (CDA).
                    </p>
                </div>

                {/* The Two Buttons */}
                <div className="flex items-center gap-3">
                    <Button
                        id="pre-cda-download-btn"
                        onClick={handleDownloadReport}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-sm transition-all"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Report
                    </Button>

                    <Button
                        id="pre-cda-qb-btn"
                        onClick={handleConnectQuickBooks}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-sm transition-all"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Connect to QuickBooks
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default PreCDA;
