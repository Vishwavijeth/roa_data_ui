import React from 'react';
import { DETAIL_SECTION_MAP } from '../../constants';
import { formatDateUS } from '../../utils/helpers';

const FIELD_LABEL_MAP = {
    officegrosscommissiononsale: 'Office Gross Commission On Sale',
    office_gross_commission_on_sale: 'Office Gross Commission On Sale',
    total_gross_commission: 'Total Gross Commission',
    listing_side_gross_commission: 'Listing Side Gross Commission',
    buying_side_gross_commission: 'Buying Side Gross Commission',
    gross_commission: 'Gross Commission',
    officegrosscommission: 'Office Gross Commission',
    listingprice: 'Listing Price',
    saleprice: 'Sale Price',
    sale_price: 'Sale Price',
    listing_price: 'Listing Price',
    contractacceptancedate: 'Contract Acceptance Date',
    contract_date: 'Contract Date',
    escrowclosingdate: 'Escrow Closing Date',
    closed_date: 'Closed Date',
    mlsnumber: 'MLS Number',
    mls_number: 'MLS Number',
    propertyaddress: 'Property Address',
    property_address: 'Property Address',
    buyer_agent: 'Buyer Agent',
    buyer_agent_email: 'Buyer Agent Email',
    buying_agent_name: 'Buying Agent Name',
    skyslopefileid: 'SkySlope File ID',
    yearbuilt: 'Year Built',
    saleguid: 'Sale GUID',
    transactionid: 'Transaction ID',
    transaction_status: 'Transaction Status',
    transaction_specialist: 'Transaction Specialist',
};

const formatFieldLabel = (key) => {
    const kLow = String(key).toLowerCase();
    if (FIELD_LABEL_MAP[kLow]) {
        return FIELD_LABEL_MAP[kLow];
    }
    return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

const formatCurrencyValue = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(num);
};

// Keys (exact or containing) that should never be rendered in the detail view
const HIDDEN_KEYS = ['user', 'user_id', 'user_name', 'userid', 'username', 'created_by_user'];

function SectionedDetailView({ data }) {
    if (!data || typeof data !== 'object') return null;
    const entries = Object.entries(data).filter(([key]) => {
        const k = key.toLowerCase();
        return !HIDDEN_KEYS.some(hk => k === hk || k === hk.replace(/_/g, ''));
    });
    const assigned = new Set();

    const sections = DETAIL_SECTION_MAP.map(section => {
        const items = entries.filter(([key]) => {
            if (assigned.has(key)) return false;
            const k = key.toLowerCase();
            return section.keys.some(sk => k === sk || k.includes(sk));
        });
        items.forEach(([key]) => assigned.add(key));
        return { ...section, items };
    }).filter(s => s.items.length > 0);

    // Collect any remaining fields
    const remaining = entries.filter(([key]) => !assigned.has(key));
    if (remaining.length > 0) {
        sections.push({ title: 'Other Details', color: '#64748b', items: remaining });
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4 w-full items-start">
            {sections.map(section => (
                <React.Fragment key={section.title}>
                    {/* Section Header spanning the full width */}
                    <div 
                        className="col-span-full flex items-center gap-2 pt-3 pb-1 border-b border-slate-100/80 first:pt-0"
                        style={{ borderBottomColor: `${section.color}20` }}
                    >
                        <div className="w-1.5 h-3 rounded-full shrink-0" style={{ backgroundColor: section.color }} />
                        <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: section.color }}>
                            {section.title}
                        </span>
                    </div>

                    {/* Section Fields inside the grid */}
                    {section.items.map(([key, value]) => {
                        const kLower = key.toLowerCase();
                        const isDateKey = kLower.includes('date') ||
                            kLower.includes('timestamp') ||
                            section.title === 'Dates';
                        const isCurrencyKey = section.title === 'Financials' ||
                            kLower.includes('price') ||
                            kLower.includes('commission') ||
                            kLower.includes('amount');

                        let display = null;
                        if (value !== null && value !== '' && value !== undefined) {
                            if (isDateKey) {
                                display = formatDateUS(value);
                            } else if (isCurrencyKey && !isNaN(Number(value))) {
                                display = formatCurrencyValue(value);
                            } else {
                                display = String(value);
                            }
                        }

                        const fieldLabel = formatFieldLabel(key);

                        return (
                            <div key={key} className="space-y-0.5 min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate" title={fieldLabel}>
                                    {fieldLabel}
                                </span>
                                <span 
                                    className="text-[13px] font-semibold text-slate-700 block break-words leading-tight"
                                    title={display || '—'}
                                >
                                    {display ?? <span className="text-slate-300 italic font-normal">—</span>}
                                </span>
                            </div>
                        );
                    })}
                </React.Fragment>
            ))}
        </div>
    );
}

export default SectionedDetailView;
