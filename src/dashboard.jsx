import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ReconciliationView from './pages/ReconciliationView';
import BrokerageView from './pages/BrokerageView';
import SkySlopeView from './pages/SkySlopeView';
import TransactionSpecialistListingView from './pages/TransactionSpecialistListingView';
import ReviewerListingView from './pages/ReviewerListingView';
import TransactionSpecialistDashboardView from './pages/TransactionSpecialistDashboardView';
import ReviewerDashboardView from './pages/ReviewerDashboardView';

// ── Dashboard Shell (layout + sidebar + lifted sync state) ───────────────────
function Dashboard({ setIsAuthenticated }) {
    // Restore the active page from the URL hash on refresh
    const validPages = ['dashboard', 'brokerage', 'skyslope', 'txn_specialist', 'reviewer', 'txn_specialist_dash', 'reviewer_dash'];
    const hashPage = window.location.hash.replace('#', '');
    const [activePage, setActivePage] = useState(validPages.includes(hashPage) ? hashPage : 'dashboard');

    // Keep the URL hash in sync with the active page
    useEffect(() => {
        window.location.hash = activePage;
    }, [activePage]);

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
            const res = await fetch('https://roa-data-backend.vercel.app/sync/brokerage-engine', {
                method: 'POST',
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                finishSync(true, json.message || json.detail || 'Brokerage Engine data synced successfully.');
            } else {
                console.warn('[Sync BE] Server error:', res.status, json);
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

    const handleLogout = () => {
        sessionStorage.removeItem('roa_auth');
        setIsAuthenticated(false);
    };

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return <ReconciliationView />;
            case 'brokerage':
                return <BrokerageView syncingBE={syncingBE} syncProgress={syncProgress} syncBEResult={syncBEResult} handleSyncBE={handleSyncBE} setSyncBEResult={setSyncBEResult} />;
            case 'skyslope':
                return <SkySlopeView syncingSS={syncingSS} syncSSProgress={syncSSProgress} syncSSResult={syncSSResult} handleSyncSS={handleSyncSS} setSyncSSResult={setSyncSSResult} />;
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
        <div className="app-layout">
            <Sidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} />
            <main className="main-content">
                {renderPage()}
            </main>
        </div>
    );
}

export default Dashboard;