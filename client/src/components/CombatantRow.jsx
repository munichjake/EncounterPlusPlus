import React, { useState } from "react";
import { SlotEditor } from "./SlotEditor.jsx";
import { AdjectiveSelector } from "./AdjectiveSelector.jsx";
import { ConditionAutocomplete } from "./ConditionAutocomplete.jsx";
import { InlineEdit } from "./InlineEdit.jsx";
import { QuickHPInput } from "./QuickHPInput.jsx";

export function CombatantRow({
  c,
  idx,
  active,
  onChange,
  onSelect,
  isSelected,
  onDamage,
  allPlayers = [],
  hpManagement,
  conditionsData = {},
  getConditionTooltipHandlers,
  setSelectedCondition,
  setConditionName,
  setShowConditionModal,
  settings,
  isCompleted = false,
}) {
  const [open, setOpen] = useState(false);
  const [showHPInput, setShowHPInput] = useState(false);

  // Special rendering for Lair Action markers
  if (c.isLairAction) {
    return (
      <div
        className={`card relative overflow-hidden cursor-pointer transition-all ${
          active ? "ring-2 ring-red-500 shadow-lg bg-red-50 dark:bg-red-900/30 border-r-8 !border-r-yellow-500" : "bg-red-50/50 dark:bg-red-900/10"
        } ${isSelected ? "ring-2 ring-purple-400" : ""}`}
        onClick={(e) => {
          if (!e.defaultPrevented) onSelect();
        }}
      >
        <div className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 flex items-center justify-center bg-red-200 dark:bg-red-800 rounded-full font-bold text-sm text-red-900 dark:text-red-200">
            {idx + 1}
          </div>
          <div className="flex-1 font-semibold text-lg text-red-900 dark:text-red-300">
            {c.name}
          </div>
          <div className="flex items-center gap-1 text-red-700 dark:text-red-400">
            <span className="text-xs">Init</span>
            <span className="w-16 text-center font-bold">{c.initiative}</span>
          </div>
          <div className="px-3 py-1 bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-200 rounded-full text-xs font-semibold">
            DM Only
          </div>
        </div>
      </div>
    );
  }

  const effectiveMaxHP = (c.baseHP ?? 0) + (c.maxHPModifier ?? 0);
  const hpPercent =
    effectiveMaxHP > 0 ? Math.max(0, Math.min(100, (c.hp / effectiveMaxHP) * 100)) : 100;
  const hpColor =
    hpPercent > 60
      ? "bg-green-500"
      : hpPercent > 30
      ? "bg-yellow-500"
      : "bg-red-500";
  const isBloodied = hpPercent > 0 && hpPercent < 50;

  return (
    <div
      className={`card relative ${open ? 'overflow-visible' : 'overflow-hidden'} cursor-pointer transition-all ${
        c.player ? "!bg-green-50 dark:!bg-green-950/20 border-l-8 !border-l-green-500" : ""
      } ${active ? "ring-2 ring-blue-500 shadow-lg border-r-8 !border-r-yellow-500" : ""
      } ${isSelected ? "ring-2 ring-purple-400" : ""} ${
        c.concentration && !c.player ? "border-l-4 border-l-purple-500" : ""
      } ${isBloodied && c.concentration ? "bloodied-concentration-border" : isBloodied ? "bloodied-border" : ""
      }`}
      style={c.concentration && !isBloodied ? { animation: 'concentration-pulse 2s ease-in-out infinite' } : {}}
      onClick={(e) => {
        if (!e.defaultPrevented) onSelect();
      }}
    >
      {showHPInput && (
        <QuickHPInput
          currentHP={c.hp ?? 0}
          maxHP={c.baseHP}
          tempHP={c.tempHP ?? 0}
          onHeal={(amount) => {
            onChange({ hp: Math.min(c.baseHP, c.hp + amount) });
            setShowHPInput(false);
          }}
          onDamage={(amount) => {
            onDamage(amount);
            setShowHPInput(false);
          }}
          onSetHP={(hp) => {
            onChange({ hp: Math.max(0, Math.min(c.baseHP, hp)) });
            setShowHPInput(false);
          }}
          onClose={() => setShowHPInput(false)}
        />
      )}

      {c.concentration && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full flex items-center gap-1 pointer-events-none z-5">
          <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-pulse"></span>
          Concentrating
        </div>
      )}

      <div className="space-y-2">
        {/* First Row: Index, Name, Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full font-bold text-sm dark:text-slate-200">
            {idx + 1}
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <InlineEdit
              value={c.name}
              onChange={(name) => onChange({ name })}
              className="font-semibold text-lg dark:text-slate-100"
              disabled={isCompleted}
            />
            {c.sidekickOf && (
              <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded text-xs font-semibold">
                🤝 Sidekick
              </span>
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
              Init
            </span>
            <InlineEdit
              value={c.initiative ?? 0}
              onChange={(initiative) => onChange({ initiative })}
              type="number"
              className="w-16 text-center font-bold text-2xl text-blue-600 dark:text-blue-400"
              disabled={isCompleted}
            />
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex gap-2">
              <span>Mod: {c.initiativeMod >= 0 ? '+' : ''}{c.initiativeMod || 0}</span>
              <span>Tie: {c.initiativeTieBreaker || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">AC</span>
            <InlineEdit
              value={c.ac ?? 0}
              onChange={(ac) => onChange({ ac })}
              type="number"
              className="w-16 text-center dark:text-slate-100"
              disabled={isCompleted}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">HP</span>
            <div
              className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${isCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCompleted && hpManagement) {
                  hpManagement(c, onChange);
                }
              }}
              title={isCompleted ? 'Combat completed' : 'Klick für HP Management'}
            >
              <span className="text-center font-bold dark:text-slate-100 min-w-[3rem]">
                {c.hp ?? 0}{c.tempHP > 0 ? `+${c.tempHP}` : ''}
              </span>
              <span className="text-slate-400 dark:text-slate-500">/</span>
              <span className="text-center text-slate-600 dark:text-slate-300 font-medium min-w-[2rem]">
                {(c.baseHP ?? 0) + (c.maxHPModifier ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Second Row: Action Buttons */}
        <div className="flex items-center gap-2 pl-11">
          <button
            disabled={isCompleted}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              c.concentration
                ? "bg-purple-500 dark:bg-purple-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30"
            } ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ concentration: !c.concentration });
            }}
          >
            {c.concentration ? "⚡ Concentrating" : "Concentration"}
          </button>

          <button
            disabled={isCompleted}
            className={`p-2 rounded-lg text-lg transition-all ${
              c.visibleToPlayers !== false
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
            } ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ visibleToPlayers: c.visibleToPlayers === false });
            }}
            title={c.visibleToPlayers !== false ? "Visible to players" : "Hidden from players"}
          >
            {c.visibleToPlayers !== false ? "👁️" : "👁️‍🗨️"}
          </button>

          <button
            className="btn ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* HP Bar */}
      <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${hpColor} transition-all duration-300`}
          style={{ width: `${hpPercent}%` }}
        ></div>
      </div>

      {/* Conditions Display */}
      {c.conditions && c.conditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.conditions.map((cond) => (
            <button
              key={cond}
              className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium cursor-pointer transition-colors border border-amber-300 dark:border-amber-800"
              onClick={() => {
                const conditionData = conditionsData[cond.toLowerCase()];
                if (conditionData) {
                  setSelectedCondition(conditionData);
                  setConditionName(cond);
                  setShowConditionModal(true);
                }
              }}
              {...getConditionTooltipHandlers(cond)}
            >
              {cond}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="lbl mb-1 block">Notizen</label>
              <textarea
                className="input h-24 resize-none"
                value={c.notes || ""}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Notizen hinzufügen..."
                disabled={isCompleted}
              />
            </div>

            <div>
              <label className="lbl mb-1 block">Diesen Eintrag als Sidekick zuweisen</label>
              <select
                className="input w-full"
                value={c.sidekickOf || ''}
                onChange={(e) => onChange({ sidekickOf: e.target.value || null })}
                disabled={isCompleted}
              >
                <option value="">Kein Sidekick</option>
                {allPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dieser Eintrag wird als Sidekick dem ausgewählten Spieler zugeordnet und teilt dessen Initiative
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.player || false}
                  onChange={(e) => onChange({ player: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="lbl">Is Player Character</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Spielercharaktere müssen ihre Initiative manuell eingeben
              </p>
            </div>

            <div>
              <label className="lbl mb-1 block">Conditions</label>
              <ConditionAutocomplete
                value={c.conditions || []}
                onChange={(conditions) => onChange({ conditions })}
                conditionImmunities={c.conditionImmunities || []}
                settings={settings}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Spell Slots</h4>
              <SlotEditor
                slots={c.spellSlots || {}}
                onChange={(slots) => onChange({ spellSlots: slots })}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Adjektiv ändern</h4>
              <AdjectiveSelector
                currentName={c.name}
                onChange={(newName) => onChange({ name: newName })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
