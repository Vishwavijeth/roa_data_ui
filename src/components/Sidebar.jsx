import React from 'react';
import {
    IconDashboard, IconBrokerage, IconSkySlope, IconChevron,
    IconLogout, IconSpecialist, IconReviewer, IconSpecialistDash, IconReviewerDash
} from './Icons';

function Sidebar({ activePage, setActivePage, onLogout }) {
    const navSections = [
        {
            label: 'GENERAL',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
            ],
        },
        {
            label: 'RECONCILIATION',
            items: [
                { id: 'brokerage', label: 'Brokerage Engine', icon: <IconBrokerage /> },
                { id: 'skyslope', label: 'SkySlope Data', icon: <IconSkySlope /> },
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
            ],
        },
    ];

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <img
                    src="roa_logo.png"
                    alt="ROA Logo"
                    style={{ height: '50px', objectFit: 'contain' }}
                />
            </div>

            {/* Nav sections */}
            <nav className="sidebar-nav">
                {navSections.map(section => (
                    <div key={section.label} className="nav-section">
                        <span className="nav-section-label">{section.label}</span>
                        {section.items.map(item => (
                            <button
                                key={item.id}
                                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                                onClick={() => setActivePage(item.id)}
                            >
                                <span className="nav-item-icon">{item.icon}</span>
                                <span className="nav-item-label">{item.label}</span>
                                {activePage === item.id && (
                                    <span className="nav-item-chevron"><IconChevron /></span>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="sidebar-footer">
                <button className="sidebar-logout-btn" onClick={onLogout}>
                    <IconLogout />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;
