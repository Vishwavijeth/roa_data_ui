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
        triggerLabel = <span className="ms-placeholder">{placeholder}</span>;
    } else if (selected.length === options.length) {
        triggerLabel = <span className="ms-placeholder">{allLabel}</span>;
    } else if (selected.length <= 2) {
        triggerLabel = (
            <span className="ms-chips">
                {selected.map(v => (
                    <span key={v} className="ms-chip">
                        {v}
                        <button
                            className="ms-chip-remove"
                            onMouseDown={e => { e.stopPropagation(); toggle(v); }}
                            aria-label={`Remove ${v}`}
                        >✕</button>
                    </span>
                ))}
            </span>
        );
    } else {
        triggerLabel = (
            <span className="ms-chips">
                <span className="ms-chip">{selected[0]}<button className="ms-chip-remove" onMouseDown={e => { e.stopPropagation(); toggle(selected[0]); }} aria-label={`Remove ${selected[0]}`}>✕</button></span>
                <span className="ms-count-chip">+{selected.length - 1} more</span>
            </span>
        );
    }

    return (
        <div className="ms-container" ref={containerRef}>
            <button
                id={id}
                type="button"
                className={`ms-trigger${open ? ' ms-trigger--open' : ''}${someSelected || (selected.length > 0 && selected.length < options.length) ? ' ms-trigger--active' : ''}`}
                onClick={() => { setOpen(o => !o); setSearch(''); }}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="ms-trigger-content">{triggerLabel}</span>
                <svg className="ms-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className="ms-dropdown" role="listbox" aria-multiselectable="true">
                    {options.length > 5 && (
                        <div className="ms-search-wrap">
                            <input
                                className="ms-search"
                                type="text"
                                placeholder="Search…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}
                    <div className="ms-options">
                        {/* Select all row */}
                        {!search && (
                            <div
                                className={`ms-option ms-option-all${allSelected ? ' ms-option--checked' : ''}`}
                                role="option"
                                aria-selected={allSelected}
                                onClick={toggleAll}
                            >
                                <span className={`ms-checkbox${allSelected ? ' ms-checkbox--checked' : someSelected ? ' ms-checkbox--indeterminate' : ''}`}>
                                    {allSelected ? '✓' : someSelected ? '−' : ''}
                                </span>
                                <span>{allLabel}</span>
                            </div>
                        )}
                        {filtered.length === 0 && (
                            <div className="ms-no-results">No options found</div>
                        )}
                        {filtered.map(option => {
                            const checked = selected.includes(option);
                            return (
                                <div
                                    key={option}
                                    className={`ms-option${checked ? ' ms-option--checked' : ''}`}
                                    role="option"
                                    aria-selected={checked}
                                    onClick={() => toggle(option)}
                                >
                                    <span className={`ms-checkbox${checked ? ' ms-checkbox--checked' : ''}`}>
                                        {checked ? '✓' : ''}
                                    </span>
                                    <span>{option}</span>
                                </div>
                            );
                        })}
                    </div>
                    {selected.length > 0 && (
                        <div className="ms-footer">
                            <button className="ms-clear-btn" onClick={() => onChange([])}>
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
