/**
 * Scope switch — pi-web's `config-switch` geometry (24×14, 7px radius, knob
 * slides 12px) with the scope drawn as an icon in the knob instead of a label:
 * globe = global, folder = this project.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ScopeSwitchProps {
  checked: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  disabled?: boolean;
  busy?: boolean;
}

export const ScopeSwitch: React.FC<ScopeSwitchProps> = ({
  checked,
  onToggle,
  title,
  icon,
  accentColor,
  disabled,
  busy,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={title}
    title={title}
    disabled={disabled || busy}
    onClick={onToggle}
    className="relative h-[14px] w-[24px] rounded-[7px] border transition-colors cursor-pointer disabled:cursor-default disabled:opacity-40 shrink-0"
    style={{
      backgroundColor: checked ? accentColor : 'transparent',
      borderColor: checked ? accentColor : 'var(--border, #454545)',
    }}
  >
    <span
      className={`absolute top-[0.5px] flex h-[11px] w-[11px] items-center justify-center rounded-full transition-transform ${
        checked ? 'translate-x-[11px]' : 'translate-x-[0.5px]'
      }`}
      style={{ color: checked ? '#09090b' : 'var(--text-dim, #a4a4a4)' }}
    >
      {busy ? <Loader2 className="w-2 h-2 animate-spin" /> : icon}
    </span>
  </button>
);
