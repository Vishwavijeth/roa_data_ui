import React from 'react';
import { twMerge } from 'tailwind-merge';

const Tabs = ({ className, children, ...props }) => (
  <div className={twMerge("flex flex-col gap-4", className)} {...props}>
    {children}
  </div>
);

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={twMerge(
      "inline-flex h-9 items-center justify-start rounded-lg bg-slate-100 p-1 text-slate-500 w-fit",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef(({ className, active, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={twMerge(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
      active
        ? "bg-white text-slate-950 shadow-sm"
        : "hover:bg-white/50 text-slate-500 hover:text-slate-900",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef(({ className, active, children, ...props }, ref) => {
  if (!active) return null;
  return (
    <div
      ref={ref}
      className={twMerge(
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
