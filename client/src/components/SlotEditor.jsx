import React, { useState, useEffect } from "react";
import { numberOr } from "../utils/spellUtils.js";

export function SlotEditor({ slots, onChange }) {
  const [levels, setLevels] = useState(() =>
    Object.keys(slots || {})
      .map((l) => Number(l))
      .sort((a, b) => a - b)
  );

  useEffect(() => {
    setLevels(
      Object.keys(slots || {})
        .map((l) => Number(l))
        .sort((a, b) => a - b)
    );
  }, [slots]);

  return (
    <div className="space-y-2">
      {levels.map((l) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-10">L{l}</span>
          <input
            type="number"
            className="input"
            value={slots[l]?.current ?? 0}
            onChange={(e) =>
              onChange({
                ...slots,
                [l]: {
                  ...(slots[l] || { max: 0 }),
                  current: numberOr(e.target.value),
                },
              })
            }
          />
          <span>/</span>
          <input
            type="number"
            className="input"
            value={slots[l]?.max ?? 0}
            onChange={(e) =>
              onChange({
                ...slots,
                [l]: {
                  current: slots[l]?.current ?? 0,
                  max: numberOr(e.target.value),
                },
              })
            }
          />
          <button
            className="btn"
            onClick={() =>
              onChange({
                ...slots,
                [l]: {
                  current: Math.max(0, (slots[l]?.current ?? 0) - 1),
                  max: slots[l]?.max ?? 0,
                },
              })
            }
          >
            ‑1
          </button>
          <button
            className="btn"
            onClick={() =>
              onChange({
                ...slots,
                [l]: {
                  current: Math.min(
                    slots[l]?.max ?? 0,
                    (slots[l]?.current ?? 0) + 1
                  ),
                  max: slots[l]?.max ?? 0,
                },
              })
            }
          >
            +1
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          id="newlvl"
          className="input w-20"
          placeholder="Lvl"
          type="number"
        />
        <button
          className="btn"
          onClick={() => {
            const el = document.getElementById("newlvl");
            const lvl = Number(el.value);
            if (!Number.isFinite(lvl) || lvl <= 0) return;
            onChange({ ...(slots || {}), [lvl]: { current: 0, max: 0 } });
            el.value = "";
          }}
        >
          Level hinzufügen
        </button>
      </div>
    </div>
  );
}
