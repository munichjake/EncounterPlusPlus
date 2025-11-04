import React, { useEffect, useRef } from 'react';

// Alert Modal - ersetzt alert()
export function AlertModal({ message, onClose }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full animate-[slideUp_0.2s_ease-out]">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">ℹ️</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Information</h3>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{message}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end">
          <button
            ref={buttonRef}
            className="btn bg-blue-600 text-white hover:bg-blue-700 border-blue-600 px-6"
            onClick={onClose}
            onKeyDown={(e) => e.key === 'Enter' && onClose()}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Confirm Modal - ersetzt confirm()
export function ConfirmModal({ message, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full animate-[slideUp_0.2s_ease-out]">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Bestätigung</h3>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{message}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
          <button
            className="btn hover:bg-slate-100 dark:hover:bg-slate-700 px-6"
            onClick={onCancel}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          >
            Abbrechen
          </button>
          <button
            ref={confirmRef}
            className="btn bg-orange-600 text-white hover:bg-orange-700 border-orange-600 px-6"
            onClick={onConfirm}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
          >
            Bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}

// Prompt Modal - ersetzt prompt()
export function PromptModal({ message, defaultValue = '', onSubmit, onCancel }) {
  const inputRef = useRef(null);
  const [value, setValue] = React.useState(defaultValue);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full animate-[slideUp_0.2s_ease-out]">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✏️</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Eingabe</h3>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{message}</p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="text"
            className="input w-full"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
          <button
            className="btn hover:bg-slate-100 dark:hover:bg-slate-700 px-6"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            className="btn bg-purple-600 text-white hover:bg-purple-700 border-purple-600 px-6"
            onClick={handleSubmit}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Initiative Modal - für manuelle Initiative-Eingabe
export function InitiativeModal({ combatants, onSubmit, onCancel, rollDice, setDiceContextMenu }) {
  const [initiatives, setInitiatives] = React.useState(() => {
    const init = {};
    combatants.forEach(c => {
      init[c.id] = c.initiative || '';
    });
    return init;
  });
  const [pendingInitiativeRoll, setPendingInitiativeRoll] = React.useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    // Convert all values to numbers
    const results = {};
    Object.entries(initiatives).forEach(([id, value]) => {
      results[id] = Number(value) || 0;
    });
    onSubmit(results);
  };

  const rollInitiativeForCombatant = async (combatant, rollMode = 'normal') => {
    const modifier = combatant.initiativeMod || 0;
    const notation = modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`;

    if (rollDice) {
      // Use the proper dice rolling system with animation
      const result = await rollDice({
        notation,
        rollMode,
        label: 'Initiative',
        character: combatant.name
      });

      if (result && result.total !== undefined) {
        setInitiatives(prev => ({ ...prev, [combatant.id]: result.total }));
      }
    } else {
      // Fallback if rollDice not available
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + modifier;
      setInitiatives(prev => ({ ...prev, [combatant.id]: total }));
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(e.target.closest('form').querySelectorAll('input[type="number"]'));
      if (index < inputs.length - 1) {
        inputs[index + 1].focus();
        inputs[index + 1].select();
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-[slideUp_0.2s_ease-out]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🎲</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Initiative Eingeben</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Gib die Initiative für alle Spielercharaktere ein</p>
            </div>
          </div>
        </div>

        <form className="flex-1 overflow-y-auto p-6" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="space-y-3">
            {combatants.map((c, index) => (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Initiative Modifier: {c.initiativeMod >= 0 ? '+' : ''}{c.initiativeMod || 0}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Initiative:</label>
                  <input
                    ref={index === 0 ? firstInputRef : null}
                    type="number"
                    className="input w-24 text-center"
                    value={initiatives[c.id]}
                    onChange={(e) => setInitiatives({ ...initiatives, [c.id]: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => rollInitiativeForCombatant(c, 'normal')}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const modifier = c.initiativeMod || 0;
                      const notation = modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`;
                      if (setDiceContextMenu) {
                        // Store combatant for capturing result after context menu roll
                        setPendingInitiativeRoll(c);
                        setDiceContextMenu({
                          show: true,
                          x: e.clientX,
                          y: e.clientY,
                          notation,
                          type: 'd20',
                          label: 'Initiative',
                          character: c.name,
                          onRoll: (result) => {
                            // Capture the result from context menu roll
                            if (result && result.total !== undefined) {
                              setInitiatives(prev => ({ ...prev, [c.id]: result.total }));
                            }
                            setPendingInitiativeRoll(null);
                          }
                        });
                      }
                    }}
                    className="btn w-10 h-10 p-0 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white border-red-600 transition-all hover:scale-110"
                    title={`Links: Normal würfeln | Rechts: Vor-/Nachteil`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </form>

        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
          <button
            type="button"
            className="btn hover:bg-slate-100 dark:hover:bg-slate-700 px-6"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="btn bg-red-600 text-white hover:bg-red-700 border-red-600 px-6"
            onClick={handleSubmit}
          >
            Initiative setzen
          </button>
        </div>
      </div>
    </div>
  );
}

// HP Management Modal - für umfassende HP-Verwaltung
export function HPManagementModal({ combatant, onChange, onClose }) {
  const [currentHP, setCurrentHP] = React.useState(combatant.hp ?? 0);
  const [maxHP, setMaxHP] = React.useState(combatant.baseHP ?? 0);
  const [tempHP, setTempHP] = React.useState(combatant.tempHP ?? 0);
  const [maxHPModifier, setMaxHPModifier] = React.useState(combatant.maxHPModifier ?? 0);
  const currentInputRef = useRef(null);

  useEffect(() => {
    currentInputRef.current?.focus();
    currentInputRef.current?.select();
  }, []);

  const handleSave = () => {
    onChange({
      hp: Math.max(0, currentHP),
      baseHP: Math.max(1, maxHP),
      tempHP: Math.max(0, tempHP),
      maxHPModifier: maxHPModifier
    });
    onClose();
  };

  const adjustCurrentHP = (amount) => {
    setCurrentHP(prev => Math.max(0, Math.min(maxHP + maxHPModifier, prev + amount)));
  };

  const effectiveMaxHP = maxHP + maxHPModifier;
  const totalHP = currentHP + tempHP;
  const hpPercent = effectiveMaxHP > 0 ? Math.max(0, Math.min(100, (currentHP / effectiveMaxHP) * 100)) : 100;
  const hpColor = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full animate-[slideUp_0.2s_ease-out]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">❤️</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">HP Management</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{combatant.name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* HP Overview */}
          <div className="text-center space-y-2">
            <div className="text-5xl font-bold text-slate-900 dark:text-slate-100">
              {totalHP}
              <span className="text-3xl text-slate-400 dark:text-slate-500">/{effectiveMaxHP}</span>
            </div>
            {tempHP > 0 && (
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                ({currentHP} HP + {tempHP} Temp HP)
              </div>
            )}
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${hpColor} transition-all duration-300`}
                style={{ width: `${hpPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Current HP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Current HP
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustCurrentHP(-10)}
                className="btn bg-red-600 hover:bg-red-700 text-white border-red-600 px-3 py-2"
              >
                -10
              </button>
              <button
                onClick={() => adjustCurrentHP(-1)}
                className="btn bg-red-500 hover:bg-red-600 text-white border-red-500 px-3 py-2"
              >
                -1
              </button>
              <input
                ref={currentInputRef}
                type="text"
                className="input flex-1 text-center text-lg font-bold"
                value={currentHP}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow direct number input
                  if (!value.startsWith('+') && !value.startsWith('-')) {
                    const num = Number(value);
                    if (!isNaN(num) || value === '') {
                      setCurrentHP(Math.max(0, Math.min(effectiveMaxHP, num || 0)));
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  // Handle +/- shortcuts on blur
                  if (value.startsWith('+') || value.startsWith('-')) {
                    const change = parseInt(value) || 0;
                    setCurrentHP(prev => Math.max(0, Math.min(effectiveMaxHP, prev + change)));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.target.value.trim();
                    // Handle +/- shortcuts on Enter
                    if (value.startsWith('+') || value.startsWith('-')) {
                      const change = parseInt(value) || 0;
                      setCurrentHP(prev => Math.max(0, Math.min(effectiveMaxHP, prev + change)));
                      e.preventDefault();
                    } else {
                      handleSave();
                    }
                  }
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="HP or +10/-5"
              />
              <button
                onClick={() => adjustCurrentHP(1)}
                className="btn bg-green-500 hover:bg-green-600 text-white border-green-500 px-3 py-2"
              >
                +1
              </button>
              <button
                onClick={() => adjustCurrentHP(10)}
                className="btn bg-green-600 hover:bg-green-700 text-white border-green-600 px-3 py-2"
              >
                +10
              </button>
            </div>
          </div>

          {/* Temp HP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Temporary HP
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input flex-1 text-center"
                value={tempHP}
                onChange={(e) => setTempHP(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
              />
              <button
                onClick={() => setTempHP(0)}
                className="btn bg-slate-500 hover:bg-slate-600 text-white border-slate-500 px-4 py-2"
              >
                Clear
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Temp HP absorbiert Schaden zuerst und stapelt sich nicht
            </p>
          </div>

          {/* Max HP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Max HP (Base)
            </label>
            <input
              type="number"
              className="input w-full text-center"
              value={maxHP}
              onChange={(e) => setMaxHP(Math.max(1, Number(e.target.value) || 1))}
              placeholder="1"
            />
          </div>

          {/* Max HP Modifier */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Max HP Modifier
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                className="input flex-1 text-center"
                value={maxHPModifier}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty, minus sign, or valid numbers (positive or negative)
                  if (value === '' || value === '-') {
                    setMaxHPModifier(0);
                  } else if (/^-?\d+$/.test(value)) {
                    setMaxHPModifier(Number(value));
                  }
                }}
                onBlur={(e) => {
                  // Clean up on blur if just a minus sign
                  if (e.target.value === '-' || e.target.value === '') {
                    setMaxHPModifier(0);
                  }
                }}
                placeholder="0 (can be negative)"
              />
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Effective Max: <span className="font-bold">{effectiveMaxHP}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Für temporäre Effekte wie Aid Spell (+5 max HP)
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setCurrentHP(effectiveMaxHP)}
              className="btn flex-1 bg-green-600 hover:bg-green-700 text-white border-green-600"
            >
              Full Heal
            </button>
            <button
              onClick={() => setCurrentHP(0)}
              className="btn flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              Set to 0
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
          <button
            className="btn hover:bg-slate-100 dark:hover:bg-slate-700 px-6"
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700 border-red-600 px-6"
            onClick={handleSave}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Container Hook - für einfache Verwendung
export function useModal(rollDice = null, setDiceContextMenu = null) {
  const [modal, setModal] = React.useState(null);

  const alert = (message) => {
    return new Promise((resolve) => {
      setModal(
        <AlertModal
          message={message}
          onClose={() => {
            setModal(null);
            resolve();
          }}
        />
      );
    });
  };

  const confirm = (message) => {
    return new Promise((resolve) => {
      setModal(
        <ConfirmModal
          message={message}
          onConfirm={() => {
            setModal(null);
            resolve(true);
          }}
          onCancel={() => {
            setModal(null);
            resolve(false);
          }}
        />
      );
    });
  };

  const prompt = (message, defaultValue = '') => {
    return new Promise((resolve) => {
      setModal(
        <PromptModal
          message={message}
          defaultValue={defaultValue}
          onSubmit={(value) => {
            setModal(null);
            resolve(value);
          }}
          onCancel={() => {
            setModal(null);
            resolve(null);
          }}
        />
      );
    });
  };

  const initiativePrompt = (combatants) => {
    return new Promise((resolve) => {
      setModal(
        <InitiativeModal
          combatants={combatants}
          rollDice={rollDice}
          setDiceContextMenu={setDiceContextMenu}
          onSubmit={(initiatives) => {
            setModal(null);
            resolve(initiatives);
          }}
          onCancel={() => {
            setModal(null);
            resolve(null);
          }}
        />
      );
    });
  };

  const hpManagement = (combatant, onChange) => {
    return new Promise((resolve) => {
      setModal(
        <HPManagementModal
          combatant={combatant}
          onChange={onChange}
          onClose={() => {
            setModal(null);
            resolve();
          }}
        />
      );
    });
  };

  return { alert, confirm, prompt, initiativePrompt, hpManagement, modal };
}
