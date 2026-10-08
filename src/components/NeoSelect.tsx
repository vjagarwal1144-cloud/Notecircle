import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface NeoSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface NeoSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: NeoSelectOption[];
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export const NeoSelect: React.FC<NeoSelectProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  size = 'md',
  ariaLabel
}) => {
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 font-display select-none flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      )}

      {/* Neo-Brutalist Select Container */}
      <div 
        className={`relative w-full rounded-2xl border-[2.5px] border-stone-950 dark:border-stone-700 bg-[#FAF7F0] dark:bg-[#15141A] shadow-[3px_3px_0px_#121217] dark:shadow-[3px_3px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#121217] dark:hover:shadow-[4px_4px_0px_#000] focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 focus-within:shadow-[4px_4px_0px_#FFB800] ${
          disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
        }`}
      >
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className={`w-full appearance-none bg-transparent font-bold text-stone-950 dark:text-stone-100 cursor-pointer outline-none focus:outline-none focus:ring-0 border-0 ${
            size === 'sm' ? 'py-2 pl-3 pr-9 text-xs' : 'py-2.5 pl-3.5 pr-10 text-xs sm:text-sm'
          }`}
          style={{
            WebkitAppearance: 'none',
            MozAppearance: 'none'
          }}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[#FAF7F0] dark:bg-[#15141A] text-stone-950 dark:text-stone-100 font-bold py-1.5"
            >
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom NoteCircle Brutalist Chevron Indicator */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-stone-950 dark:text-stone-100">
          <div className="w-5 h-5 rounded-md bg-amber-400 dark:bg-amber-400 text-stone-950 border-1.5 border-stone-950 flex items-center justify-center shadow-[1px_1px_0px_#121217]">
            <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        </div>
      </div>

      {selectedOption?.description && (
        <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 pl-1">
          {selectedOption.description}
        </span>
      )}
    </div>
  );
};
