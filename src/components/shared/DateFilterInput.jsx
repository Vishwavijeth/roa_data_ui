import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/Input';
import { parseDateUS, formatDateUS } from '../../utils/helpers';

export function DateFilterInput({ id, value, onChange, placeholder = 'MM/DD/YYYY', className }) {
    const [localText, setLocalText] = useState('');
    const dateInputRef = useRef(null);

    // Sync display value from YYYY-MM-DD prop
    useEffect(() => {
        if (!value) {
            setLocalText('');
        } else {
            const formatted = formatDateUS(value);
            if (formatted && formatted !== '—') {
                setLocalText(formatted);
            } else {
                setLocalText('');
            }
        }
    }, [value]);

    const handleTextChange = (e) => {
        const val = e.target.value;
        setLocalText(val);

        if (!val.trim()) {
            onChange('');
            return;
        }

        const parsed = parseDateUS(val);
        if (parsed) {
            onChange(parsed);
        }
    };

    const handleTextBlur = () => {
        const parsed = parseDateUS(localText);
        if (parsed) {
            setLocalText(formatDateUS(parsed));
            onChange(parsed);
        } else if (!localText.trim()) {
            setLocalText('');
            onChange('');
        }
    };

    const handleNativeChange = (e) => {
        const val = e.target.value; // always in YYYY-MM-DD format
        onChange(val);
    };

    const triggerDatePicker = (e) => {
        e.preventDefault();
        if (dateInputRef.current) {
            try {
                dateInputRef.current.showPicker();
            } catch (err) {
                console.warn('Native showPicker not supported or blocked:', err);
                dateInputRef.current.focus();
            }
        }
    };

    return (
        <div className="relative w-full flex items-center">
            {/* Native date input, invisible but active to enable browser calendar dropdown */}
            <input
                ref={dateInputRef}
                type="date"
                value={value || ''}
                onChange={handleNativeChange}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '10px',
                    width: '1px',
                    height: '1px',
                    opacity: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none'
                }}
            />
            
            {/* Visual Text Input showing MM/DD/YYYY */}
            <div className="relative w-full">
                <button
                    type="button"
                    onClick={triggerDatePicker}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none z-10"
                    title="Open calendar picker"
                >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>
                <Input
                    id={id}
                    type="text"
                    placeholder={placeholder}
                    value={localText}
                    onChange={handleTextChange}
                    onBlur={handleTextBlur}
                    className={`pl-8 ${localText ? 'pr-7' : ''} ${className || ''}`}
                />
                {localText && (
                    <button
                        type="button"
                        onClick={() => {
                            setLocalText('');
                            onChange('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold z-10"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

export default DateFilterInput;
