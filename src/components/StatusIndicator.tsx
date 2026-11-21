import React from 'react';

export type ProjectStatusType = 'growth' | 'redline' | 'surplus' | 'loan_due';

interface StatusIndicatorProps {
  status: ProjectStatusType;
  label: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label }) => {
  const colorMap: Record<ProjectStatusType, { dot: string; text: string }> = {
    growth: { dot: 'bg-[#10B981]', text: 'text-[#10B981]' },
    surplus: { dot: 'bg-[#F5B971]', text: 'text-[#F5B971]' },
    loan_due: { dot: 'bg-amber-400', text: 'text-amber-300' },
    redline: { dot: 'bg-[#EF4444]', text: 'text-[#EF4444]' },
  };

  const styles = colorMap[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${styles.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
