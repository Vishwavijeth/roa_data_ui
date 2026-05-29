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

    return (
        <div className="flex flex-col gap-6 w-full">
            {sections.map(section => (
                <div key={section.title} className="space-y-3">
                    {/* Section Header */}
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100" style={{ borderBottomColor: `${section.color}20` }}>
                        <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: section.color }} />
                        <h3 className="text-xs font-bold tracking-wider uppercase" style={{ color: section.color }}>
                            {section.title}
                        </h3>
                    </div>

                    {/* Section Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {section.items.map(([key, value]) => {
                            const isDateKey = key.toLowerCase().includes('date') || key.toLowerCase().includes('timestamp') || section.title === 'Dates';
                            return (
                                <div 
                                    key={key}
                                    className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200/80 group"
                                >
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full opacity-60 shrink-0" style={{ backgroundColor: section.color }} />
                                        {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="font-semibold text-sm text-slate-800 break-words leading-relaxed">
                                        {value !== null && value !== '' ? (
                                            isDateKey ? formatDateUS(value) : String(value)
                                        ) : (
                                            <span className="text-slate-400 italic font-normal">Not provided</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default SectionedDetailView;

