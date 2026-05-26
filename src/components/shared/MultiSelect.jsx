import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MultiSelect – a styled multi-value dropdown.
 *
 * Props:
 *   id          – string  – HTML id applied to the trigger button
 *   label       – string  – visible label above the trigger (optional)
 *   options     – string[] – list of selectable values
 *   selected    – string[] – currently selected values
 *   onChange    – (string[]) => void – called with the new selection
 *   placeholder – string  – text when nothing is selected
 *   allLabel    – string  – label for the "select all / none" option (default "All")
 */
function MultiSelect({ id, options = [], selected = [], onChange, placeholder = 'All', allLabel = 'All' }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = useCallback((value) => {
        const next = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(next);
    }, [selected, onChange]);

    const toggleAll = useCallback(() => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange([...options]);
        }
    }, [selected, options, onChange]);

    const filtered = options.filter(o =>
        o.toLowerCase().includes(search.toLowerCase())
    );

    const allSelected = selected.length === options.length && options.length > 0;
    const someSelected = selected.length > 0 && !allSelected;

    // Trigger label
    let triggerLabel;
    if (selected.length === 0) {
        triggerLabel = <span className="text-slate-400 text-xs font-normal">{placeholder}</span>;
    } else if (selected.length === options.length) {
        triggerLabel = <span className="text-slate-700 text-xs font-semibold">{allLabel}</span>;
    } else if (selected.length <= 2) {
        triggerLabel = (
            <span className="flex flex-wrap gap-1 items-center w-full">
                {selected.map(v => (
                    <span key={v} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 border border-slate-200/60 whitespace-normal select-none">
                        <span className="whitespace-normal">{v}</span>
                        <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600 transition-colors ml-0.5 font-bold focus:outline-none"
                            onMouseDown={e => { e.stopPropagation(); toggle(v); }}
                            aria-label={`Remove ${v}`}
                        >✕</button>
                    </span>
                ))}
            </span>
        );
    } else {
        triggerLabel = (
            <span className="flex flex-wrap gap-1 items-center">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 border border-slate-200/60 whitespace-normal select-none">
                    <span className="whitespace-normal">{selected[0]}</span>
                    <button 
                        type="button"
                        className="text-slate-400 hover:text-slate-600 transition-colors ml-0.5 font-bold focus:outline-none" 
                        onMouseDown={e => { e.stopPropagation(); toggle(selected[0]); }} 
                        aria-label={`Remove ${selected[0]}`}
                    >✕</button>
                </span>
                <span className="inline-flex items-center rounded bg-blue-50 border border-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-bold">
                    +{selected.length - 1} more
                </span>
            </span>
        );
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                id={id}
                type="button"
                className={`flex min-h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-1 text-sm shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer select-none text-left ${
                    open 
                        ? 'border-blue-500 ring-1 ring-blue-500' 
                        : someSelected || (selected.length > 0 && selected.length < options.length)
                            ? 'border-blue-200 bg-blue-50/10'
                            : 'border-input hover:border-slate-300'
                }`}
                onClick={() => { setOpen(o => !o); setSearch(''); }}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="flex-1 whitespace-normal py-0.5">{triggerLabel}</span>
                <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 mt-1.5 z-30 w-full rounded-md border border-slate-100 bg-white shadow-lg flex flex-col" role="listbox" aria-multiselectable="true">
                    {options.length > 5 && (
                        <div className="p-2 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                            <input
                                className="w-full h-8 px-2.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-ring bg-white text-slate-800"
                                type="text"
                                placeholder="Search…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto max-h-48 p-1 space-y-0.5 custom-scrollbar">
                        {/* Select all row */}
                        {!search && (
                            <div
                                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-50 cursor-pointer select-none ${
                                    allSelected ? 'bg-blue-50/30 text-blue-900 font-semibold' : ''
                                }`}
                                role="option"
                                aria-selected={allSelected}
                                onClick={toggleAll}
                            >
                                <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded text-[9px] font-bold transition-all ${
                                    allSelected 
                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                        : someSelected 
                                            ? 'bg-blue-500 border-blue-500 text-white' 
                                            : 'border-slate-300 bg-white text-transparent'
                                }`}>
                                    {allSelected ? '✓' : someSelected ? '−' : ''}
                                </span>
                                <span>{allLabel}</span>
                            </div>
                        )}
                        {filtered.length === 0 && (
                            <div className="text-center text-xs text-slate-400 py-3">No options found</div>
                        )}
                        {filtered.map(option => {
                            const checked = selected.includes(option);
                            return (
                                <div
                                    key={option}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-50 cursor-pointer select-none ${
                                        checked ? 'bg-blue-50/30 text-blue-900 font-semibold' : ''
                                    }`}
                                    role="option"
                                    aria-selected={checked}
                                    onClick={() => toggle(option)}
                                >
                                    <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded text-[9px] font-bold transition-all ${
                                        checked 
                                            ? 'bg-blue-600 border-blue-600 text-white' 
                                            : 'border-slate-300 bg-white text-transparent'
                                    }`}>
                                        {checked ? '✓' : ''}
                                    </span>
                                    <span className="whitespace-normal">{option}</span>
                                </div>
                            );
                        })}
                    </div>
                    {selected.length > 0 && (
                        <div className="p-2 border-t border-slate-100 bg-slate-50/50 flex justify-end sticky bottom-0 z-10">
                            <button 
                                type="button" 
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold focus:outline-none" 
                                onClick={() => onChange([])}
                            >
                                Clear ({selected.length})
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MultiSelect;
