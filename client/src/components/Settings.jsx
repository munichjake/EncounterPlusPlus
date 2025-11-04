import React, { useState, useEffect } from 'react';

export function Settings({ isOpen, onClose }) {
  const [diceRollerType, setDiceRollerType] = useState('2d');
  const [creatureNamingMode, setCreatureNamingMode] = useState('adjective');
  const [concentrationCheckReminder, setConcentrationCheckReminder] = useState(true);
  const [autoRollConcentrationNPCs, setAutoRollConcentrationNPCs] = useState(true);
  const [conditionImmunityReminder, setConditionImmunityReminder] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.diceRollerType) {
          setDiceRollerType(settings.diceRollerType);
        }
        if (settings.creatureNamingMode) {
          setCreatureNamingMode(settings.creatureNamingMode);
        }
        if (settings.concentrationCheckReminder !== undefined) {
          setConcentrationCheckReminder(settings.concentrationCheckReminder);
        }
        if (settings.autoRollConcentrationNPCs !== undefined) {
          setAutoRollConcentrationNPCs(settings.autoRollConcentrationNPCs);
        }
        if (settings.conditionImmunityReminder !== undefined) {
          setConditionImmunityReminder(settings.conditionImmunityReminder);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, [isOpen]);

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      diceRollerType,
      creatureNamingMode,
      concentrationCheckReminder,
      autoRollConcentrationNPCs,
      conditionImmunityReminder
    };
    localStorage.setItem('app-settings', JSON.stringify(settings));

    // Dispatch custom event so App.jsx can react to settings changes
    window.dispatchEvent(new CustomEvent('settings-changed', {
      detail: settings
    }));

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Settings Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 pointer-events-auto animate-[slideUpComplete_0.3s_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>⚙️</span>
              <span>Einstellungen</span>
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
              title="Schließen"
            >
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Settings Content */}
          <div className="space-y-6">
            {/* Dice Roller Type Setting */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Würfel-Roller Typ
              </label>
              <div className="space-y-3">
                {/* 2D Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: diceRollerType === '2d' ? '#3b82f6' : 'transparent',
                    backgroundColor: diceRollerType === '2d' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="diceRollerType"
                    value="2d"
                    checked={diceRollerType === '2d'}
                    onChange={(e) => setDiceRollerType(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>🎲</span>
                      <span>2D Würfel (Schnell)</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Animierte 2D Würfel mit schneller Darstellung
                    </div>
                  </div>
                </label>

                {/* 3D Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: diceRollerType === '3d' ? '#3b82f6' : 'transparent',
                    backgroundColor: diceRollerType === '3d' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="diceRollerType"
                    value="3d"
                    checked={diceRollerType === '3d'}
                    onChange={(e) => setDiceRollerType(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>🎮</span>
                      <span>3D Würfel (Physik)</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Realistische 3D Würfel mit Physik-Simulation
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Creature Naming Mode Setting */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Kreaturen-Benennung bei Duplikaten
              </label>
              <div className="space-y-3">
                {/* None Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: creatureNamingMode === 'none' ? '#3b82f6' : 'transparent',
                    backgroundColor: creatureNamingMode === 'none' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="creatureNamingMode"
                    value="none"
                    checked={creatureNamingMode === 'none'}
                    onChange={(e) => setCreatureNamingMode(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Keine (z.B. "Goblin", "Goblin", "Goblin")
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Keine automatische Umbenennung bei Duplikaten
                    </div>
                  </div>
                </label>

                {/* Adjective Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: creatureNamingMode === 'adjective' ? '#3b82f6' : 'transparent',
                    backgroundColor: creatureNamingMode === 'adjective' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="creatureNamingMode"
                    value="adjective"
                    checked={creatureNamingMode === 'adjective'}
                    onChange={(e) => setCreatureNamingMode(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Adjektive (z.B. "Brave Goblin", "Fierce Goblin")
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Verwendet zufällige beschreibende Adjektive
                    </div>
                  </div>
                </label>

                {/* Letter Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: creatureNamingMode === 'letter' ? '#3b82f6' : 'transparent',
                    backgroundColor: creatureNamingMode === 'letter' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="creatureNamingMode"
                    value="letter"
                    checked={creatureNamingMode === 'letter'}
                    onChange={(e) => setCreatureNamingMode(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Buchstaben (z.B. "Goblin A", "Goblin B")
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Nummeriert mit Buchstaben A-Z
                    </div>
                  </div>
                </label>

                {/* Number Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: creatureNamingMode === 'number' ? '#3b82f6' : 'transparent',
                    backgroundColor: creatureNamingMode === 'number' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="creatureNamingMode"
                    value="number"
                    checked={creatureNamingMode === 'number'}
                    onChange={(e) => setCreatureNamingMode(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Zahlen (z.B. "Goblin 1", "Goblin 2")
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Einfache numerische Nummerierung
                    </div>
                  </div>
                </label>

                {/* Roman Numerals Option */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  style={{
                    borderColor: creatureNamingMode === 'roman' ? '#3b82f6' : 'transparent',
                    backgroundColor: creatureNamingMode === 'roman' ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="creatureNamingMode"
                    value="roman"
                    checked={creatureNamingMode === 'roman'}
                    onChange={(e) => setCreatureNamingMode(e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Römische Zahlen (z.B. "Goblin I", "Goblin II")
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Klassische römische Nummerierung
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Concentration & Condition Settings */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Concentration & Condition Checks
              </label>
              <div className="space-y-3">
                {/* Concentration Check Reminder Toggle */}
                <label className="flex items-center justify-between p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Concentration Check Reminder
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Show popup when PCs need concentration checks
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={concentrationCheckReminder}
                    onChange={(e) => setConcentrationCheckReminder(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>

                {/* Auto Roll Concentration for NPCs Toggle */}
                <label className="flex items-center justify-between p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Auto Roll Concentration Checks for NPCs
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Automatically roll concentration checks for monsters
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRollConcentrationNPCs}
                    onChange={(e) => setAutoRollConcentrationNPCs(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>

                {/* Condition Immunity Reminder Toggle */}
                <label className="flex items-center justify-between p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Condition Immunity Reminder
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Show warnings when applying conditions to immune creatures
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={conditionImmunityReminder}
                    onChange={(e) => setConditionImmunityReminder(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Abbrechen
            </button>
            <button
              onClick={saveSettings}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium shadow-lg shadow-blue-500/30"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to get current settings
export function useSettings() {
  const [settings, setSettings] = useState({
    diceRollerType: '2d',
    creatureNamingMode: 'adjective',
    concentrationCheckReminder: true,
    autoRollConcentrationNPCs: true,
    conditionImmunityReminder: true
  });

  useEffect(() => {
    // Load initial settings
    const loadSettings = () => {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings(parsed);
        } catch (e) {
          console.error('Failed to load settings:', e);
        }
      }
    };

    loadSettings();

    // Listen for settings changes
    const handleSettingsChange = (e) => {
      setSettings(e.detail);
    };

    window.addEventListener('settings-changed', handleSettingsChange);
    return () => window.removeEventListener('settings-changed', handleSettingsChange);
  }, []);

  return settings;
}
