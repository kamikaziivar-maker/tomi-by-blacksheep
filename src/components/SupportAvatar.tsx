import React from 'react';
import { Banknote } from 'lucide-react';
import { FundSupport, SupportType } from '../types/finance';
import { getInitials } from '../utils/imageUtils';

interface SupportAvatarProps {
  support: Pick<FundSupport, 'name' | 'type' | 'logoDataUrl'>;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

export const SupportAvatar: React.FC<SupportAvatarProps> = ({
  support,
  size = 'md',
}) => {
  const initials = getInitials(support.name, 'CP');
  const sizeCls = SIZE_CLASSES[size];

  if (support.logoDataUrl) {
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-full border border-zinc-700/80 bg-[#0D0D0F] ${sizeCls}`}
      >
        <img
          src={support.logoDataUrl}
          alt={support.name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (support.type === SupportType.CASH) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border border-zinc-700/80 bg-[#18181B] text-zinc-300 ${sizeCls}`}
      >
        <Banknote className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>
    );
  }

  const accentCls =
    support.type === SupportType.MOBILE_MONEY
      ? 'border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]'
      : 'border-[#F5B971]/35 bg-[#F5B971]/10 text-[#F5B971]';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border font-display font-bold tracking-tight ${accentCls} ${sizeCls}`}
    >
      {initials}
    </div>
  );
};
