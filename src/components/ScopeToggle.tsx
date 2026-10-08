/** Segmented control for "where does this apply": global, this project, or off. */
import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ScopeToggleOption {
  id: string;
  label: string;
  title?: string;
}

interface ScopeToggleProps {
  options: ScopeToggleOption[];
  value: string;
  onChange: (id: string) => void;
  busy?: boolean;
  disabled?: boolean;
  accentColor: string;
}

export const ScopeToggle: React.FC<ScopeToggleProps> = ({ options, value, onChange, busy, disabled, accentColor }) => (
  <div className="inline-flex items-center p-0.5 rounded bg-[#121215] border border-[#27272a]">
    {options.map((option) => {
      const isActive = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          disabled={disabled || busy || isActive}
          title={option.title}
          aria-pressed={isActive}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer disabled:cursor-default ${
            isActive ? 'font-semibold' : 'text-[#71717a] hover:text-[#fafafa]'
          }`}
          style={
            isActive
              ? { backgroundColor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}55` }
              : { border: '1px solid transparent' }
          }
        >
          {busy && isActive && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          <span>{option.label}</span>
        </button>
      );
    })}
  </div>
);
