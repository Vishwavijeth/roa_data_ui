import React from 'react';
import { DETAIL_SECTION_MAP } from '../constants';

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            {sections.map(section => (
                <div key={section.title}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        marginBottom: '0.75rem', paddingBottom: '0.5rem',
                        borderBottom: `1px solid ${section.color}30`
                    }}>
                        <div style={{ width: '3px', height: '1.1rem', borderRadius: '2px', background: section.color, flexShrink: 0 }} />
                        <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: section.color }}>
                            {section.title}
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                        {section.items.map(([key, value]) => (
                            <div key={key}
                                style={{ background: 'var(--bg-primary)', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: section.color, opacity: 0.6, flexShrink: 0 }} />
                                    {key.replace(/_/g, ' ')}
                                </div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-word', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                    {value !== null && value !== '' ? String(value) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400 }}>Not provided</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default SectionedDetailView;
