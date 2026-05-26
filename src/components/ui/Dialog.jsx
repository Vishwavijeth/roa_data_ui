import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';

const Dialog = ({ open, onOpenChange, children, size = 'lg', className }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  const maxWidthClass = sizeClasses[size] || 'max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Container */}
      <div className={twMerge("relative z-10 w-full transform rounded-lg bg-white p-6 shadow-xl transition-all border border-slate-100 flex flex-col max-h-[85vh]", maxWidthClass, className)}>
        {children}
        <button
          onClick={() => onOpenChange?.(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-slate-400 p-1 hover:bg-slate-100"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
};

const DialogHeader = ({ className, ...props }) => (
  <div className={twMerge("flex flex-col space-y-1.5 text-left mb-4", className)} {...props} />
);

const DialogTitle = ({ className, ...props }) => (
  <h2 className={twMerge("text-lg font-semibold leading-none tracking-tight text-slate-900", className)} {...props} />
);

const DialogDescription = ({ className, ...props }) => (
  <p className={twMerge("text-sm text-muted-foreground", className)} {...props} />
);

const DialogFooter = ({ className, ...props }) => (
  <div className={twMerge("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 border-t border-slate-100 pt-4 mt-auto", className)} {...props} />
);

const DialogContent = ({ className, children, ...props }) => (
  <div className={twMerge("flex-1 overflow-y-auto pr-1 py-1", className)} {...props}>
    {children}
  </div>
);

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogContent };
