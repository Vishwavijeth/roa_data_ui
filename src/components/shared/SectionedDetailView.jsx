import React from 'react';
import { DETAIL_SECTION_MAP } from '../../constants';
import { formatDateUS } from '../../utils/helpers';

function SectionedDetailView({ data }) {
    if (!data || typeof data !== 'object') return null;
    const entries = Object.entries(data);
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
                        const isDateKey = key.toLowerCase().includes('date') ||
                            key.toLowerCase().includes('timestamp') ||
                            section.title === 'Dates';
                        const display = value !== null && value !== '' && value !== undefined
                            ? (isDateKey ? formatDateUS(value) : String(value))
                            : null;
                        return (
                            <div key={key} className="space-y-0.5 min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate" title={key.replace(/_/g, ' ')}>
                                    {key.replace(/_/g, ' ')}
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
