/**
 * The 5px drag target for a resizable panel edge. It is rendered as a zero-width
 * flex item whose hit area overhangs the boundary, so it never shifts layout.
 */
import React from 'react';

interface PanelResizeHandleProps {
  side: 'left' | 'right';
  label: string;
  active: boolean;
  handleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
  };
}

export const PanelResizeHandle: React.FC<PanelResizeHandleProps> = ({ side, label, active, handleProps }) => (
  <div className="relative w-0 shrink-0 z-40 self-stretch">
    <div
      {...handleProps}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      className={`absolute inset-y-0 w-[5px] cursor-col-resize outline-none transition-colors ${
        side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
      } ${active ? 'bg-[#a78bfa]/30' : 'bg-transparent hover:bg-[#a78bfa]/35 focus-visible:bg-[#a78bfa]/35'}`}
    />
  </div>
);
