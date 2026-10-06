import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base font-semibold',
  xl: 'w-20 h-20 text-xl font-semibold'
};

const COLOR_PALETTES = [
  'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800',
  'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800',
  'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700',
  'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800',
  'bg-stone-100 dark:bg-stone-850 text-stone-700 dark:text-stone-300 border-stone-250 dark:border-stone-750'
];

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'md',
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);

  // Derive stable initials
  const initials = (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Consistent color based on name
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorClass = COLOR_PALETTES[Math.abs(hash) % COLOR_PALETTES.length];

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${SIZES[size]} rounded-full object-cover shrink-0 border border-slate-200/60 shadow-xs ${className}`}
      />
    );
  }

  return (
    <div
      className={`${SIZES[size]} ${colorClass} rounded-full flex items-center justify-center shrink-0 border select-none font-medium ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
};
