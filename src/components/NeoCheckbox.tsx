import React from 'react';
import { Check } from 'lucide-react';

export interface NeoCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const NeoCheckbox: React.FC<NeoCheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = ''
}) => {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-3 select-none cursor-pointer group ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      <div className="relative mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded-lg border-2 border-stone-950 dark:border-stone-700 flex items-center justify-center transition-all ${
            checked
              ? 'bg-amber-400 text-stone-950 shadow-[2px_2px_0px_#121217] scale-105'
              : 'bg-white dark:bg-[#15141A] text-transparent shadow-[1px_1px_0px_#121217] group-hover:border-amber-400'
          }`}
        >
          <Check className={`w-3.5 h-3.5 stroke-[3.5] ${checked ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      </div>

      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
};
