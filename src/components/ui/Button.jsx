import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const buttonVariants = {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
    destructive: "bg-destructive text-destructive-foreground hover:bg-red-700 shadow-sm",
    outline: "border border-input bg-background hover:bg-slate-50 text-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-slate-200/80 shadow-sm",
    ghost: "hover:bg-slate-100 hover:text-slate-900 text-muted-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  },
  size: {
    default: "h-9 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs rounded-md",
    lg: "h-10 px-8 text-sm rounded-md",
    icon: "h-9 w-9 flex items-center justify-center rounded-md",
  }
};

const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  asChild = false, 
  ...props 
}, ref) => {
  const Comp = "button";
  return (
    <Comp
      className={twMerge(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none",
        buttonVariants.variant[variant],
        buttonVariants.size[size],
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button };
