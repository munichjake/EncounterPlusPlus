import React, { useState } from "react";

export function ConditionAutocomplete({ value, onChange, conditionImmunities = [], settings }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingImmune, setPendingImmune] = useState({}); // Tracks immune conditions awaiting confirmation

  const commonConditions = [
    "Blinded",
    "Charmed",
    "Deafened",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
  ];
  const conditions = value || [];
  const filtered = commonConditions.filter(
    (c) =>
      !conditions.includes(c) &&
      !pendingImmune[c] &&
      c.toLowerCase().includes(input.toLowerCase())
  );

  // Check if a condition is immune (case-insensitive)
  const isImmune = (cond) => {
    if (!conditionImmunities || !Array.isArray(conditionImmunities)) {
      return false;
    }
    return conditionImmunities.some(immune =>
      immune.toLowerCase() === cond.toLowerCase()
    );
  };

  const addCondition = (cond) => {
    console.log('[ConditionAutocomplete] addCondition called with:', cond);
    console.log('[ConditionAutocomplete] conditionImmunities:', conditionImmunities);
    console.log('[ConditionAutocomplete] isImmune check:', isImmune(cond));
    console.log('[ConditionAutocomplete] current conditions:', conditions);

    // Check if should show immunity reminder
    if (isImmune(cond) && settings?.conditionImmunityReminder) {
      console.log('[ConditionAutocomplete] Adding to pending immune:', cond);
      // Add to pending immune conditions instead of active conditions
      setPendingImmune({ ...pendingImmune, [cond]: true });
    } else {
      console.log('[ConditionAutocomplete] Adding to active conditions:', cond);
      onChange([...conditions, cond]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeCondition = (cond) => {
    onChange(conditions.filter((c) => c !== cond));
  };

  const confirmImmuneCondition = (cond) => {
    // Move from pending to active conditions
    const newPending = { ...pendingImmune };
    delete newPending[cond];
    setPendingImmune(newPending);
    onChange([...conditions, cond]);
  };

  const rejectImmuneCondition = (cond) => {
    // Remove from pending
    const newPending = { ...pendingImmune };
    delete newPending[cond];
    setPendingImmune(newPending);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Pending immune conditions with confirm/reject buttons */}
        {Object.keys(pendingImmune).map((cond) => (
          <span
            key={cond}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium border border-red-300 dark:border-red-800"
            title={`${cond} is immune against being ${cond}`}
          >
            {cond}
            <button
              onClick={() => confirmImmuneCondition(cond)}
              className="hover:text-red-900 dark:hover:text-red-100 font-bold text-base leading-none"
              title={`${cond} is immune against being ${cond}`}
            >
              &#10003;
            </button>
            <button
              onClick={() => rejectImmuneCondition(cond)}
              className="hover:text-red-900 dark:hover:text-red-100 font-bold text-base leading-none"
              title={`${cond} is immune against being ${cond}`}
            >
              &#10005;
            </button>
          </span>
        ))}

        {/* Active conditions with remove button */}
        {conditions.map((cond) => (
          <span
            key={cond}
            className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
          >
            {cond}
            <button
              onClick={() => removeCondition(cond)}
              className="hover:text-amber-900 dark:hover:text-amber-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          className="input w-full"
          placeholder="Add condition..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            console.log('[ConditionAutocomplete] Input focused');
            setShowSuggestions(true);
          }}
          onBlur={() => {
            console.log('[ConditionAutocomplete] Input blurred, will hide suggestions in 300ms');
            setTimeout(() => setShowSuggestions(false), 300);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              console.log('[ConditionAutocomplete] Enter pressed with:', input.trim());
              addCondition(input.trim());
              e.preventDefault();
            }
          }}
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-auto">
            {filtered.map((cond) => (
              <button
                key={cond}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm dark:text-slate-200"
                onMouseDown={(e) => {
                  console.log('[ConditionAutocomplete] Suggestion clicked:', cond);
                  e.preventDefault(); // Prevent blur
                  addCondition(cond);
                }}
              >
                {cond}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
