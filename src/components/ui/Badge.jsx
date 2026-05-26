import React from 'react';
import { twMerge } from 'tailwind-merge';

const badgeVariants = {
  default: "border-transparent bg-primary text-primary-foreground shadow",
  secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
  success: "border-transparent bg-emerald-100 text-emerald-800",
  destructive: "border-transparent bg-red-100 text-red-800",
  warning: "border-transparent bg-amber-100 text-amber-800",
  outline: "text-slate-950 border border-slate-200",
};

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={twMerge(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
