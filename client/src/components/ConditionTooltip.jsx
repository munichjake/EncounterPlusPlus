import React from 'react';
import { Tooltip } from './Tooltip.jsx';

export function ConditionTooltip({ condition, name, x, y }) {
  if (!condition) return null;

  const { legacy, reprinted } = condition;

  // Helper function to parse all entries (not just first)
  const parseEntries = (entries) => {
    if (!entries || !entries.length) return null;

    const cleanText = (text) => {
      if (!text) return "";
      return text
        .replace(/\{@[^}]+\}/g, (match) => {
          const textMatch = match.match(/\{@\w+\s+([^}|]+)(?:\|[^}]+)?\}/);
          return textMatch ? textMatch[1] : match;
        })
        .trim();
    };

    const elements = [];

    entries.forEach((entry, idx) => {
      if (typeof entry === "string") {
        elements.push(
          <p key={idx} className="leading-relaxed mb-1">
            {cleanText(entry)}
          </p>
        );
      } else if (entry.type === "list" && entry.items) {
        elements.push(
          <ul key={idx} className="list-disc list-inside space-y-0.5 mb-1">
            {entry.items.map((item, itemIdx) => (
              <li key={itemIdx} className="leading-relaxed">{cleanText(item)}</li>
            ))}
          </ul>
        );
      } else if (entry.type === "entries" && entry.entries) {
        entry.entries.forEach((subEntry, subIdx) => {
          if (typeof subEntry === "string") {
            elements.push(
              <p key={`${idx}-${subIdx}`} className="leading-relaxed mb-1">
                {cleanText(subEntry)}
              </p>
            );
          } else if (subEntry.type === "entries") {
            if (subEntry.name) {
              elements.push(
                <p key={`${idx}-${subIdx}`} className="leading-relaxed mb-1">
                  <span className="font-medium">{subEntry.name}:</span>{" "}
                  {cleanText(subEntry.entries?.join(" ") || "")}
                </p>
              );
            }
          }
        });
      }
    });

    return <div className="space-y-1">{elements}</div>;
  };

  // Check if both versions exist and are identical
  const areSame = legacy && reprinted &&
    JSON.stringify(legacy.entries) === JSON.stringify(reprinted.entries);

  const renderContent = () => {
    if (areSame) {
      // Same content in both versions
      return (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between border-b border-amber-200 dark:border-amber-700 pb-1">
            <div className="font-semibold text-amber-800 dark:text-amber-400 text-xs">
              Legacy & Reprinted Rules
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              PHB p{legacy.page || "?"} / XPHB p{reprinted.page || "?"}
            </div>
          </div>
          {parseEntries(legacy.entries)}
        </div>
      );
    } else if (legacy && reprinted) {
      // Different content - clean separation with spacing only
      return (
        <>
          <div>
            <div className="flex items-baseline justify-between border-b border-blue-300 dark:border-blue-700 pb-1 mb-1.5">
              <div className="font-semibold text-blue-700 dark:text-blue-400 text-xs">
                Legacy Rules (5e2014)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                PHB p{legacy.page || "?"}
              </div>
            </div>
            {parseEntries(legacy.entries)}
          </div>
          <div className="mt-5">
            <div className="flex items-baseline justify-between border-b border-green-300 dark:border-green-700 pb-1 mb-1.5">
              <div className="font-semibold text-green-700 dark:text-green-400 text-xs">
                Reprinted Rules (5e2024)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                XPHB p{reprinted.page || "?"}
              </div>
            </div>
            {parseEntries(reprinted.entries)}
          </div>
        </>
      );
    } else if (reprinted) {
      // Only reprinted version
      return (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-700 text-right">
            XPHB p{reprinted.page || "?"}
          </div>
          {parseEntries(reprinted.entries)}
        </div>
      );
    } else if (legacy) {
      // Only legacy version
      return (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-700 text-right">
            PHB p{legacy.page || "?"}
          </div>
          {parseEntries(legacy.entries)}
        </div>
      );
    }

    return null;
  };

  return (
    <Tooltip x={x} y={y} width={500} color="amber">
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">
            {name || "Condition"}
          </h3>
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Condition
          </span>
        </div>

        <div className="text-xs text-slate-700 dark:text-slate-300 border-t border-amber-200 dark:border-amber-800 pt-2 max-h-64 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </Tooltip>
  );
}
