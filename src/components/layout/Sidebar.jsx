import React from 'react';
import {
    IconDashboard, IconBrokerage, IconSkySlope, IconChevron,
    IconLogout, IconSpecialist, IconReviewer, IconSpecialistDash, IconReviewerDash, IconCdaSent,
    IconMonthClosing, IconPreCda, IconChecklist, IconCommission, IconUserAccess
} from '../shared/Icons';
import { isAdminUser } from '../../utils/api';

function Sidebar({ activePage, setActivePage, onLogout }) {
    const isAdmin = isAdminUser();

    const navSections = [
        {
            label: 'RECONCILIATION',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
                { id: 'reconciliation_new', label: 'Reconciliation', icon: <IconDashboard /> },
            ],
        },
        {
            label: 'LISTING',
            items: [
                { id: 'brokerage', label: 'Brokerage Engine', icon: <IconBrokerage /> },
                { id: 'skyslope', label: 'SkySlope', icon: <IconSkySlope /> },
            ],
        },
        {
            label: 'CDA LISTING',
            items: [
                { id: 'cda_sent', label: 'CDA Sent', icon: <IconCdaSent /> },
                { id: 'pre_cda', label: 'Account Hold', icon: <IconPreCda /> },
                { id: 'commission_advances', label: 'Commission Advances', icon: <IconCommission /> },
                { id: 'commission_advances_flow', label: 'Commission Advances Flow', icon: <IconCommission /> },
            ],
        },
        {
            label: 'BOOK CLOSING',
            items: [
                { id: 'month_closing', label: 'Month Closing', icon: <IconMonthClosing /> },
            ],
        },
        {
            label: 'TRANSACTION SPECIALIST & REVIEWER',
            items: [
                { id: 'txn_specialist', label: 'Transaction Specialist listing', icon: <IconSpecialist /> },
                { id: 'reviewer', label: 'Reviewer listing', icon: <IconReviewer /> },
            ],
        },
        {
            label: 'DASHBOARDS',
            items: [
                { id: 'txn_specialist_dash', label: 'Transaction Specialist Dashboard', icon: <IconSpecialistDash /> },
                { id: 'reviewer_dash', label: 'Reviewer Dashboard', icon: <IconReviewerDash /> },
                { id: 'checklist_type_mapping', label: 'Checklist Type Mapping', icon: <IconChecklist /> },
            ],
        },
    ];

    if (isAdmin) {
        navSections.push({
            label: 'ADMIN',
            items: [
                { id: 'user_access', label: 'User Access', icon: <IconUserAccess /> },
            ],
        });
    }

    return (
        <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen shrink-0 border-r border-slate-800 sticky top-0">
            {/* Logo */}
            <div className="p-6 flex items-center justify-center border-b border-slate-800/60 bg-slate-950/20">
                <img
                    src="roa_logo.png"
                    alt="ROA Logo"
                    className="h-10 object-contain brightness-0 invert"
                />
            </div>

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-7 custom-scrollbar">
                {navSections.map(section => (
                    <div key={section.label} className="space-y-2">
                        <span className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
                            {section.label}
                        </span>
                        <div className="space-y-1">
                            {section.items.map(item => {
                                const isActive = activePage === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 select-none group text-left ${
                                            isActive
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                        }`}
                                        onClick={() => {
                                            setActivePage(item.id);
                                            window.location.hash = item.id;
                                        }}
                                    >
                                        <span className={`transition-colors shrink-0 ${
                                            isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                                        }`}>
                                            {item.icon}
                                        </span>
                                        <span className="flex-1 truncate">{item.label}</span>
                                        {isActive && (
                                            <span className="text-white/80 shrink-0">
                                                <IconChevron />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-slate-800/60 bg-slate-950/20">
                <button 
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all select-none text-left" 
                    onClick={onLogout}
                >
                    <IconLogout />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;
