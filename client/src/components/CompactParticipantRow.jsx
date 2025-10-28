import React from 'react';

/**
 * Kompakte Teilnehmer-Zeile für Prep Mode
 * Zeigt nur: #, Name, CR
 */
export function CompactParticipantRow({ c, idx, active, onSelect, isSelected, onDelete, showDelete }) {
  return (
    <div
      onClick={onSelect}
      className={`group px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-3 relative ${
        active
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
          : isSelected
          ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
          : 'hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200'
      }`}
    >
      {/* Number */}
      <div className="w-6 h-6 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full font-bold text-xs shrink-0">
        {idx + 1}
      </div>

      {/* Name */}
      <div className="flex-1 font-medium truncate text-sm">
        {c.name}
      </div>

      {/* CR (optional) */}
      {c.cr !== undefined && (
        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          CR {c.cr}
        </div>
      )}

      {/* Delete button - only visible on hover in prep mode */}
      {showDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shrink-0"
          title="Löschen (oder wähle aus und drücke ENTF)"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
