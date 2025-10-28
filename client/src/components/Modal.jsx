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
export function InitiativeModal({ combatants, onSubmit, onCancel }) {
  const [initiatives, setInitiatives] = React.useState(() => {
    const init = {};
    combatants.forEach(c => {
      init[c.id] = c.initiative || '';
    });
    return init;
  });
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

// Modal Container Hook - für einfache Verwendung
export function useModal() {
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

  return { alert, confirm, prompt, initiativePrompt, modal };
}
