import React, { useState, useEffect, useRef } from "react";

export function QuickHPInput({
  currentHP,
  maxHP,
  tempHP,
  onHeal,
  onDamage,
  onSetHP,
  onClose,
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = () => {
    const val = input.trim();
    if (!val) return;

    if (val.startsWith("+")) {
      // Healing
      const amount = parseInt(val.substring(1)) || 0;
      onHeal(amount);
    } else if (val.startsWith("-")) {
      // Damage
      const amount = parseInt(val.substring(1)) || 0;
      onDamage(amount);
    } else {
      // Absolute value
      const amount = parseInt(val) || 0;
      onSetHP(amount);
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-white dark:bg-slate-800 z-10 flex items-center justify-center rounded-xl shadow-lg border-2 border-blue-500 dark:border-blue-400">
      <div className="text-center space-y-3 p-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          HP: <span className="font-bold">{currentHP}</span> / {maxHP}
          {tempHP > 0 && (
            <span className="text-cyan-600 dark:text-cyan-400 ml-2">
              +{tempHP} temp
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="input w-32 text-center text-lg font-bold"
          placeholder="+10 oder -5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
          onBlur={onClose}
        />
        <div className="text-xs text-slate-500 dark:text-slate-400">
          +10 (heal) | -5 (dmg) | 20 (set)
        </div>
      </div>
    </div>
  );
}
