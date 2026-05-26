import React from 'react';
import { twMerge } from 'tailwind-merge';

function Skeleton({ className, ...props }) {
  return (
    <div
      className={twMerge("animate-pulse rounded-md bg-slate-200/80", className)}
      {...props}
    />
  );
}

export { Skeleton };
