import React from 'react';

interface AmbientNeonFlowsProps {
  enabled: boolean;
}

export const AmbientNeonFlows: React.FC<AmbientNeonFlowsProps> = ({ enabled }) => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#08090C]"
    >
      {enabled && (
        <>
          {/* Halos ambiants diffus et discrets (inspiration dark ambient) */}
          <div
            className="absolute -top-28 -right-24 h-80 w-80 rounded-full bg-[#F5B971]/[0.055] blur-[100px] animate-pulse"
            style={{ animationDuration: '5.5s' }}
          />
          <div
            className="absolute bottom-10 -left-24 h-80 w-80 rounded-full bg-[#10B981]/[0.055] blur-[105px] animate-pulse"
            style={{ animationDuration: '7s' }}
          />
          <div
            className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.04] blur-[115px]"
          />

          {/* Subtle gold & emerald luminous streams traversing the dark canvas */}
          <svg
            className="ambient-flow-1 absolute -left-[12%] -top-[8%] h-[116%] w-[124%]"
            viewBox="0 0 1440 900"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tomi-flow-gold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F5B971" stopOpacity="0" />
                <stop offset="30%" stopColor="#F5B971" stopOpacity="0.10" />
                <stop offset="70%" stopColor="#F5B971" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#F5B971" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Soft halo */}
            <path
              d="M-60 220 C 280 120, 560 340, 920 210 C 1180 120, 1340 240, 1520 180"
              stroke="url(#tomi-flow-gold)"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.28"
            />
            {/* Crisp luminous hairline */}
            <path
              d="M-60 220 C 280 120, 560 340, 920 210 C 1180 120, 1340 240, 1520 180"
              stroke="url(#tomi-flow-gold)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>

          <svg
            className="ambient-flow-2 absolute -left-[12%] -top-[6%] h-[114%] w-[124%]"
            viewBox="0 0 1440 900"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tomi-flow-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
                <stop offset="28%" stopColor="#10B981" stopOpacity="0.065" />
                <stop offset="68%" stopColor="#10B981" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M-80 610 C 240 500, 620 710, 980 540 C 1200 440, 1360 560, 1520 490"
              stroke="url(#tomi-flow-emerald)"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.25"
            />
            <path
              d="M-80 610 C 240 500, 620 710, 980 540 C 1200 440, 1360 560, 1520 490"
              stroke="url(#tomi-flow-emerald)"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
          </svg>

          <svg
            className="ambient-flow-3 absolute -left-[10%] -top-[4%] h-[110%] w-[120%]"
            viewBox="0 0 1440 900"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tomi-flow-blend" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
                <stop offset="35%" stopColor="#10B981" stopOpacity="0.065" />
                <stop offset="65%" stopColor="#F5B971" stopOpacity="0.075" />
                <stop offset="100%" stopColor="#F5B971" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M-60 790 C 340 720, 680 840, 1060 730 C 1260 675, 1380 730, 1520 700"
              stroke="url(#tomi-flow-blend)"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.24"
            />
            <path
              d="M-60 790 C 340 720, 680 840, 1060 730 C 1260 675, 1380 730, 1520 700"
              stroke="url(#tomi-flow-blend)"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>
        </>
      )}
    </div>
  );
};