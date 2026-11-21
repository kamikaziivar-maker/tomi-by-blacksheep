import React, { useState } from 'react';
import { Banknote, Landmark, Smartphone, Wallet } from 'lucide-react';
import { SupportType } from '../types/finance';

interface SupportLogoProps {
  name: string;
  type: SupportType | string;
  customLogoUrl?: string;
  size?: 'sm' | 'md';
}

const KNOWN_LOGOS: { match: RegExp; src: string; badgeBg: string }[] = [
  { match: /bancobu/i, src: './logos/bancobu.webp', badgeBg: 'bg-green-600/15' },
  { match: /bcb|banque de cr[eé]dit/i, src: './logos/bcb.webp', badgeBg: 'bg-indigo-500/15' },
  { match: /bgf/i, src: './logos/bgf.webp', badgeBg: 'bg-blue-500/15' },
  { match: /cecm/i, src: './logos/cecm.webp', badgeBg: 'bg-orange-500/15' },
  { match: /crdb/i, src: './logos/crdb.webp', badgeBg: 'bg-emerald-500/15' },
  { match: /ecobank/i, src: './logos/ecobank.webp', badgeBg: 'bg-sky-600/15' },
  { match: /ecocash/i, src: './logos/ecocash.webp', badgeBg: 'bg-sky-500/15' },
  { match: /finbank/i, src: './logos/finbank.webp', badgeBg: 'bg-cyan-600/15' },
  { match: /ihela|hela|helá/i, src: './logos/ihela.webp', badgeBg: 'bg-red-900/20' },
  { match: /interbank/i, src: './logos/interbank.webp', badgeBg: 'bg-rose-500/15' },
  { match: /kcb/i, src: './logos/kcb.webp', badgeBg: 'bg-lime-500/15' },
];

export const SupportLogo: React.FC<SupportLogoProps> = ({
  name,
  type,
  customLogoUrl,
  size = 'md',
}) => {
  const [imgError, setImgError] = useState(false);

  const dims = size === 'sm' ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg';
  const iconDims = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const matched = KNOWN_LOGOS.find((item) => item.match.test(name));
  const resolvedSrc = customLogoUrl || matched?.src;

  if (resolvedSrc && !imgError) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        onError={() => setImgError(true)}
        className={`${dims} shrink-0 object-contain bg-white p-0.5 border border-zinc-700/60`}
      />
    );
  }

  const renderFallbackIcon = () => {
    if (type === SupportType.MOBILE_MONEY || /cash|mobile|hela|helá|ihela/i.test(name)) {
      return <Smartphone className={`${iconDims} text-[#10B981]`} />;
    }
    if (
      type === SupportType.BANK ||
      /banque|bank|bancobu|bcb|bgf|cecm|crdb|ecobank|finbank|interbank|kcb/i.test(name)
    ) {
      return <Landmark className={`${iconDims} text-[#F5B971]`} />;
    }
    if (type === SupportType.CASH || /cash/i.test(name)) {
      return <Banknote className={`${iconDims} text-[#F5B971]`} />;
    }
    return <Wallet className={`${iconDims} text-zinc-300`} />;
  };

  return (
    <div
      className={`${dims} ${
        matched?.badgeBg || 'bg-[#18181B]'
      } shrink-0 flex items-center justify-center border border-zinc-800`}
    >
      {renderFallbackIcon()}
    </div>
  );
};