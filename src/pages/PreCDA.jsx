import React from 'react';
import { Button } from '../components/ui/Button';

function PreCDA() {
    const handleDownloadReport = () => {
        alert('Downloading Report...');
    };

    const handleConnectQuickBooks = () => {
        window.location.href = "https://roa-data-backend.vercel.app/auth/quickbooks/login";
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Page Header & Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">PreCDA</h1>
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
