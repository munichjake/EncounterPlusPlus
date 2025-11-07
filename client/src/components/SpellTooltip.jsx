import React from 'react';
import { Tooltip } from './Tooltip.jsx';

export function SpellTooltip({ spell, x, y }) {
  if (!spell) return null;

  // Helper function to remove dice notation and 5etools tags
  const cleanText = (text) => {
    if (!text) return "";
    return (
      text
        // Remove 5etools tags like {@damage 2d8}, {@spell fireball}, etc.
        .replace(/\{@[^}]+\}/g, (match) => {
          const textMatch = match.match(
            /\{@\w+\s+([^}|]+)(?:\|[^}]+)?\}/
          );
          return textMatch ? textMatch[1] : match;
        })
        // Remove table dict notation
        .replace(/\{'type':\s*'table'[^}]*\}/g, "[Table]")
        // Clean up extra whitespace
        .replace(/\s+/g, " ")
        .trim()
    );
  };

  const getCastingTime = () => {
    let castingTime = "";
    // encounterpp format
    if (spell.castingTime) {
      castingTime = spell.castingTime;
    }
    // 5e.tools format fallback
    else if (spell.time?.[0]) {
      castingTime = `${spell.time[0].number} ${spell.time[0].unit}`;
    } else {
      return "—";
    }
    // Capitalize first letter
    return castingTime.charAt(0).toUpperCase() + castingTime.slice(1);
  };

  const getRange = () => {
    // encounterpp format (already a string)
    if (typeof spell.range === "string") {
      return spell.range;
    }

    // 5e.tools format fallback
    const range = spell.range;
    if (!range) return "—";

    // Handle point-based range
    if (range.type === "point") {
      const dist = range.distance;
      if (dist.type === "self") {
        return "Self";
      }
      if (dist.amount) {
        return `${dist.amount} ${dist.type}`;
      }
      return dist.type;
    }

    // Handle area effects (cone, line, sphere, cube, etc.)
    if (
      range.type === "cone" ||
      range.type === "line" ||
      range.type === "sphere" ||
      range.type === "cube" ||
      range.type === "hemisphere" ||
      range.type === "radius"
    ) {
      const dist = range.distance;
      if (dist && dist.amount) {
        return `Self (${dist.amount}-${dist.type} ${range.type})`;
      }
      return `Self (${range.type})`;
    }

    return range.type === "self" ? "Self" : range.type;
  };

  const getDescription = () => {
    // encounterpp format
    if (spell.description) {
      return (
        <p className="leading-relaxed">
          {cleanText(spell.description)}
        </p>
      );
    }
    // 5e.tools format fallback
    if (spell.entries?.[0]) {
      return (
        <p className="leading-relaxed">
          {typeof spell.entries[0] === "string"
            ? cleanText(spell.entries[0])
            : ""}
        </p>
      );
    }
    return null;
  };

  const getSource = () => {
    // encounterpp format
    if (spell.meta?.source) {
      return `${spell.meta.source}${
        spell.meta.page
          ? ` p${spell.meta.page}`
          : ""
      }`;
    }
    // 5e.tools format fallback
    return `${spell.source || ""}${
      spell.page ? ` p${spell.page}` : ""
    }`;
  };

  return (
    <Tooltip x={x} y={y} width={634} color="purple">
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold text-purple-900 dark:text-purple-300">
            {spell.name}
          </h3>
          <span className="text-xs text-purple-700 dark:text-purple-400">
            {spell.level === 0
              ? "Cantrip"
              : `Level ${spell.level}`}
            {spell.school && ` • ${spell.school.charAt(0).toUpperCase() + spell.school.slice(1)}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs border-t border-purple-200 dark:border-purple-800 pt-2">
          <div>
            <span className="font-semibold text-purple-800 dark:text-purple-300">
              Casting:
            </span>
            <span className="ml-1 text-slate-700 dark:text-slate-300">
              {getCastingTime()}
            </span>
          </div>
          <div>
            <span className="font-semibold text-purple-800 dark:text-purple-300">
              Range:
            </span>
            <span className="ml-1 text-slate-700 dark:text-slate-300">
              {getRange()}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-700 dark:text-slate-300 border-t border-purple-200 dark:border-purple-800 pt-2 max-h-48 overflow-y-auto">
          {getDescription()}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-purple-200 dark:border-purple-800 pt-1">
          {getSource()}
        </div>
      </div>
    </Tooltip>
  );
}
