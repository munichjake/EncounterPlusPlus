import React from 'react';

/**
 * Generic tooltip component with smart positioning
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @param {number} width - Tooltip width in pixels
 * @param {string} color - Color theme (purple, amber, etc.)
 * @param {React.ReactNode} children - Tooltip content
 */
export function Tooltip({ x, y, width = 500, color = 'purple', children }) {
  const tooltipHeight = 400; // max-h-96 (384px) + padding
  const offset = 5;
  const padding = 10; // padding from screen edge

  let left = x + offset;
  let top = y + offset;
  let isAboveMouse = false;

  // Check bottom edge - need to show tooltip above mouse
  if (top + tooltipHeight > window.innerHeight - padding) {
    top = y - offset; // Position bottom edge at mouse Y
    isAboveMouse = true;
  }

  // Check right edge
  if (left + width > window.innerWidth - padding) {
    left = x - width - offset;
  }

  // Check left edge
  if (left < padding) {
    left = padding;
  }

  // Check top edge
  if (top < padding) {
    top = padding;
  }

  const colorClasses = {
    purple: 'border-purple-500 dark:border-purple-700',
    amber: 'border-amber-500 dark:border-amber-700',
    blue: 'border-blue-500 dark:border-blue-700',
    red: 'border-red-500 dark:border-red-700',
  };

  return (
    <div
      className={`fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 ${colorClasses[color] || colorClasses.purple} p-4 max-h-96 overflow-y-auto pointer-events-none`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        maxWidth: "90vw",
        transform: isAboveMouse ? 'translateY(-100%)' : 'none',
      }}
    >
      {children}
    </div>
  );
}
