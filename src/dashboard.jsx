import React, { useState, useEffect, useCallback } from 'react';
import { logoutUser, setUnauthorizedHandler } from './utils/api';
import Sidebar from './components/layout/Sidebar';
import ReconciliationView from './pages/ReconciliationView';
import ReconciliationNew from './pages/ReconciliationNew';
import BrokerageView from './pages/BrokerageView';
import SkySlopeView from './pages/SkySlopeView';
import TransactionSpecialistListingView from './pages/TransactionSpecialistListingView';
import ReviewerListingView from './pages/ReviewerListingView';
import TransactionSpecialistDashboardView from './pages/TransactionSpecialistDashboardView';
import ReviewerDashboardView from './pages/ReviewerDashboardView';
import CdaSent from './pages/CdaSent';
import MonthClosing from './pages/MonthClosing';
import PreCDA from './pages/PreCDA';

// ── Dashboard Shell (layout + sidebar + lifted sync state) ───────────────────
function Dashboard({ setIsAuthenticated }) {
    // Restore the active page from the URL hash on refresh
    const validPages = ['dashboard', 'reconciliation_new', 'brokerage', 'skyslope', 'cda_sent', 'pre_cda', 'month_closing', 'txn_specialist', 'reviewer', 'txn_specialist_dash', 'reviewer_dash'];

    const hashPage = window.location.hash.replace('#', '').split('?')[0];
    const [activePage, setActivePage] = useState(validPages.includes(hashPage) ? hashPage : 'dashboard');

    // Keep the URL hash in sync with the active page
    useEffect(() => {
        window.location.hash = activePage;
    }, [activePage]);

    // Handle back button and external hash routing dynamically
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '').split('?')[0];
            if (validPages.includes(hash)) {
                setActivePage(hash);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // ── Sync BE Data state (lifted here so it persists across page navigation) ──
    const [syncingBE, setSyncingBE] = useState(false);
    const [syncBEResult, setSyncBEResult] = useState(null);
    const [syncProgress, setSyncProgress] = useState(0);

    const handleSyncBE = async () => {
        setSyncingBE(true);
        setSyncBEResult(null);
        setSyncProgress(0);

        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            setSyncProgress(prev => {
                if (prev >= 90) return prev;
                const elapsed = (Date.now() - startTime) / 1000;
                const target = Math.min(90, 20 * Math.log(elapsed + 1) + 3);
                return Math.max(prev, Math.round(target));
            });
        }, 300);

        // Always animate to 100% and wait before hiding, regardless of success/failure
        const finishSync = (success, message) => {
            clearInterval(progressInterval);
            setSyncProgress(100);
            if (success) {
                setSyncBEResult({ ok: true, message });
            }
            setTimeout(() => {
                setSyncingBE(false);
                setSyncProgress(0);
            }, 3000);
        };

        try {
            const [resBE, resOI] = await Promise.all([
                fetch('https://roa-data-backend.vercel.app/sync/brokerage-engine', {
                    method: 'POST',
                }),
                fetch('https://roa-data-backend.vercel.app/sync/other-income', {
                    method: 'POST',
                })
            ]);

            const jsonBE = await resBE.json().catch(() => ({}));
            const jsonOI = await resOI.json().catch(() => ({}));

            if (resBE.ok && resOI.ok) {
                const msgBE = jsonBE.message || jsonBE.detail || 'Brokerage Engine synced successfully';
                const msgOI = jsonOI.message || jsonOI.detail || 'Other Income synced successfully';
                finishSync(true, `${msgBE} & ${msgOI}`);
            } else {
                if (!resBE.ok) console.warn('[Sync BE] Brokerage Engine server error:', resBE.status, jsonBE);
                if (!resOI.ok) console.warn('[Sync BE] Other Income server error:', resOI.status, jsonOI);
                finishSync(false);
            }
        } catch (err) {
            console.warn('[Sync BE] Network error:', err.message);
            finishSync(false);
        }
    };

    // ── Sync SkySlope state (lifted here so it persists across page navigation) ──
    const [syncingSS, setSyncingSS] = useState(false);
    const [syncSSResult, setSyncSSResult] = useState(null);
    const [syncSSProgress, setSyncSSProgress] = useState(0);

    const handleSyncSS = async () => {
        setSyncingSS(true);
        setSyncSSResult(null);
        setSyncSSProgress(0);

        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            setSyncSSProgress(prev => {
                if (prev >= 90) return prev;
                const elapsed = (Date.now() - startTime) / 1000;
                const target = Math.min(90, 20 * Math.log(elapsed + 1) + 3);
                return Math.max(prev, Math.round(target));
            });
        }, 300);

        try {
            const res = await fetch('https://roa-data-backend.vercel.app/sync/skyslope-sales', {
                method: 'POST',
            });
            const json = await res.json().catch(() => ({}));
            clearInterval(progressInterval);
            if (res.ok) {
                setSyncSSProgress(100);
                setSyncSSResult({ ok: true, message: json.message || json.detail || 'SkySlope data synced successfully.' });
                setTimeout(() => {
                    setSyncingSS(false);
                    setSyncSSProgress(0);
                }, 3000);
                setTimeout(() => {
                    setSyncSSResult(null);
                }, 5000);
            } else {
                console.warn('[Sync SS] Server error:', res.status, json);
                setSyncingSS(false);
                setSyncSSProgress(0);
            }
        } catch (err) {
            clearInterval(progressInterval);
            console.warn('[Sync SS] Network error:', err.message);
            setSyncingSS(false);
            setSyncSSProgress(0);
        }
    };

    // Called when user clicks logout – hits the /auth/logout API then clears session
    const handleLogout = useCallback(async () => {
        await logoutUser();
        setIsAuthenticated(false);
    }, [setIsAuthenticated]);

    // Called automatically when a token refresh fails (session expired)
    const forceLogout = useCallback(() => {
        setIsAuthenticated(false);
    }, [setIsAuthenticated]);

    // Register the global unauthorized handler so all pages auto-logout on token expiry
    useEffect(() => {
        setUnauthorizedHandler(forceLogout);
    }, [forceLogout]);

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return <ReconciliationView />;
            case 'reconciliation_new':
                return <ReconciliationNew />;
            case 'brokerage':
                return <BrokerageView syncingBE={syncingBE} syncProgress={syncProgress} syncBEResult={syncBEResult} handleSyncBE={handleSyncBE} setSyncBEResult={setSyncBEResult} />;
            case 'skyslope':
                return <SkySlopeView syncingSS={syncingSS} syncSSProgress={syncSSProgress} syncSSResult={syncSSResult} handleSyncSS={handleSyncSS} setSyncSSResult={setSyncSSResult} />;
            case 'cda_sent':
                return <CdaSent />;
            case 'pre_cda':
                return <PreCDA />;
            case 'month_closing':
                return <MonthClosing />;
            case 'txn_specialist':
                return <TransactionSpecialistListingView />;
            case 'reviewer':
                return <ReviewerListingView />;
            case 'txn_specialist_dash':
                return <TransactionSpecialistDashboardView />;
            case 'reviewer_dash':
                return <ReviewerDashboardView />;
            default:
                return <ReconciliationView />;
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-slate-50">
            <Sidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} />
            <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
                {renderPage()}
            </main>
        </div>
    );
}

export default Dashboard;