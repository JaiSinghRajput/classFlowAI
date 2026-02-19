'use client';

import { useMemo } from 'react';
import type { CursorState } from '@classflowai/types';

interface CursorLayerProps {
  cursorState: CursorState;
}

const cursorStyles: Record<string, { emoji: string; size: number; offset: number }> = {
  default: { emoji: '➤', size: 16, offset: 0 },
  pointer: { emoji: '➤', size: 16, offset: 0 },
  writing: { emoji: '✎', size: 20, offset: -2 },
  drawing: { emoji: '✏', size: 20, offset: -2 },
};

export function CursorLayer({ cursorState }: CursorLayerProps) {
  const { x, y, visible, style } = cursorState;

  const cursorStyle = useMemo(() => cursorStyles[style] ?? cursorStyles.default, [style])!;

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute transition-transform duration-75 ease-out"
      style={{
        left: x,
        top: y,
        transform: `translate(${cursorStyle.offset}px, ${cursorStyle.offset}px)`,
        willChange: 'transform',
      }}
    >
      <span
        className="inline-flex items-center justify-center animate-pulse"
        style={{
          fontSize: cursorStyle.size,
          color: '#ffffff',
          textShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(59,130,246,0.5)',
        }}
        aria-hidden="true"
      >
        {cursorStyle.emoji}
      </span>
      <div
        className="absolute w-2 h-2 bg-white rounded-full opacity-75"
        style={{
          left: cursorStyle.size / 2 - 4,
          top: cursorStyle.size / 2 - 4,
          boxShadow: '0 0 6px 2px rgba(59, 130, 246, 0.6)',
        }}
      />
    </div>
  );
}