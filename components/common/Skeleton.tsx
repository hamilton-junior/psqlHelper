
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClass = "animate-pulse bg-slate-200 dark:bg-slate-800";
  const variantClasses = {
    text: "h-3 w-3/4 rounded",
    rect: "rounded-xl",
    circle: "rounded-full"
  };

  return <div className={`${baseClass} ${variantClasses[variant]} ${className}`} />;
};

export const TableSkeleton: React.FC<{ rows?: number, cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="w-full space-y-4">
    <div className="flex gap-4 mb-6">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-4">
    <div className="flex justify-between items-start">
      <Skeleton variant="rect" className="w-10 h-10 rounded-2xl" />
      <Skeleton variant="rect" className="w-20 h-6 rounded-lg" />
    </div>
    <Skeleton variant="text" className="w-1/2" />
    <Skeleton variant="text" className="h-6 w-3/4" />
  </div>
);
