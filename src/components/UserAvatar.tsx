import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isOnline?: boolean;
}

const SIZES = {
  xs: 'w-6 h-6 text-[10px] font-black',
  sm: 'w-8 h-8 text-xs font-black',
  md: 'w-10 h-10 text-sm font-black',
  lg: 'w-14 h-14 text-base font-black',
  xl: 'w-20 h-20 text-xl font-black'
};

const COLOR_PALETTES = [
  'bg-amber-300 dark:bg-amber-400 text-stone-950 border-stone-900',
  'bg-orange-300 dark:bg-orange-400 text-stone-950 border-stone-900',
  'bg-rose-300 dark:bg-rose-400 text-stone-950 border-stone-900',
  'bg-yellow-300 dark:bg-yellow-400 text-stone-950 border-stone-900',
  'bg-emerald-300 dark:bg-emerald-400 text-stone-950 border-stone-900',
  'bg-sky-300 dark:bg-sky-400 text-stone-950 border-stone-900'
];

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  isOnline = false
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

  const onlineBadge = isOnline ? (
    <span 
      className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-emerald-400 border-2 border-stone-900 shadow-[1px_1px_0px_#121217]" 
      title="Online now"
    />
  ) : null;

  if (src && !imgError) {
    return (
      <div className={`relative inline-block shrink-0 ${SIZES[size]}`}>
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`w-full h-full rounded-full object-cover border-2 border-stone-900 dark:border-stone-200 shadow-[1.5px_1.5px_0px_#121217] ${className}`}
        />
        {onlineBadge}
      </div>
    );
  }

  return (
    <div className={`relative inline-block shrink-0 ${SIZES[size]}`}>
      <div
        className={`w-full h-full ${colorClass} rounded-full flex items-center justify-center border-2 border-stone-900 dark:border-stone-200 shadow-[1.5px_1.5px_0px_#121217] select-none ${className}`}
        aria-label={name}
      >
        {initials}
      </div>
      {onlineBadge}
    </div>
  );
};
