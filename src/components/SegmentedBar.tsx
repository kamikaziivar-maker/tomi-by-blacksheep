import React from 'react';
import { Transaction, TransactionType } from '../types/finance';

interface SegmentedProgressBarProps {
  percent: number;
  tone?: 'emerald' | 'amber' | 'red';
  segments?: number;
  heightClass?: string;
}

export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  percent,
  tone = 'amber',
  segments = 20,
  heightClass = 'h-2',
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const filledCount = Math.round((clamped / 100) * segments);

  const activeColor =
    tone === 'emerald'
      ? 'bg-[#10B981]'
      : tone === 'red'
      ? 'bg-[#EF4444]'
      : 'bg-[#F5B971]';

  return (
    <div
      className="flex w-full items-center gap-1"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: segments }).map((_, idx) => (
        <span
          key={idx}
          className={`flex-1 rounded-[2px] transition-colors duration-200 ${heightClass} ${
            idx < filledCount ? activeColor : 'bg-zinc-800/90'
          }`}
        />
      ))}
    </div>
  );
};

interface MultiSegmentItem {
  label: string;
  amountFbu: number;
  percent: number;
}

const SEGMENT_COLORS = [
  'bg-[#F5B971]',
  'bg-[#10B981]',
  'bg-sky-400',
  'bg-violet-400',
  'bg-zinc-400',
];

const DOT_COLORS = [
  'bg-[#F5B971]',
  'bg-[#10B981]',
  'bg-sky-400',
  'bg-violet-400',
  'bg-zinc-400',
];

export const MultiSegmentBar: React.FC<{
  items: MultiSegmentItem[];
  formatValue: (valFbu: number) => string;
}> = ({ items, formatValue }) => {
  if (items.length === 0) {
    return (
      <div className="py-2 text-xs text-zinc-500">
        Aucune entrée enregistrée sur cette période pour calculer la répartition.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-zinc-800/80 gap-0.5">
        {items.map((item, idx) => (
          <div
            key={item.label}
            style={{ width: `${Math.max(item.percent, 3)}%` }}
            className={`${SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} h-full transition-all duration-300`}
            title={`${item.label}: ${item.percent}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((item, idx) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[idx % DOT_COLORS.length]}`}
              />
              <span className="truncate text-zinc-300">{item.label}</span>
            </div>
            <div className="ml-2 shrink-0 font-mono-num text-zinc-200">
              {item.percent}% <span className="text-zinc-500">· {formatValue(item.amountFbu)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const EvolutionChart: React.FC<{
  transactions: Transaction[];
  positive: boolean;
}> = ({ transactions, positive }) => {
  const sorted = [...transactions]
    .filter(
      (t) =>
        t.type === TransactionType.INFLOW || t.type === TransactionType.OUTFLOW
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded-xl border border-zinc-800/70 bg-[#121215] text-xs text-zinc-500">
        Ajoutez au moins 2 mouvements pour afficher la courbe d’évolution
      </div>
    );
  }

  // Build cumulative series
  let running = 0;
  const points = sorted.map((tx) => {
    running += tx.type === TransactionType.INFLOW ? tx.amountInFbu : -tx.amountInFbu;
    return { date: tx.date, value: running };
  });

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);
  const range = maxVal - minVal || 1;

  const width = 320;
  const height = 76;
  const padY = 8;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
    const y = height - padY - ((p.value - minVal) / range) * (height - padY * 2);
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const strokeColor = positive ? '#10B981' : '#EF4444';
  const gradId = positive ? 'gradPos' : 'gradNeg';

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-800/70 bg-[#121215] p-2.5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.length > 0 && (
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r="3.2"
            fill={strokeColor}
          />
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{sorted[0].date}</span>
        <span>{sorted[sorted.length - 1].date}</span>
      </div>
    </div>
  );
};
