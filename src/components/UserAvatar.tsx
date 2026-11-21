import React from 'react';
import { getInitials } from '../utils/imageUtils';

interface UserAvatarProps {
  name: string;
  avatarDataUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarDataUrl,
  size = 'md',
}) => {
  const initials = getInitials(name, 'TB');
  const cls = SIZE_MAP[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#F5B971]/40 bg-[#18181B] font-display font-bold text-[#F5B971] ${cls}`}
    >
      {avatarDataUrl ? (
        <img
          src={avatarDataUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
