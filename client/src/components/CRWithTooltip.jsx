import React, { useState, useEffect, useRef } from 'react';
import { apiPost } from '../utils/api.js';

/**
 * Detailed eCR Modal - Shows comprehensive breakdown of eCR calculation
 */
function ECRDetailModal({ monster, displayCR, eCRData, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  if (!eCRData) return null;

  const features = eCRData.features || {};
  const ehp = features.ehp || (features.hp * (1 + (features.ac - 13) * 0.05));

  // Calculate stat explanations
  const getStatExplanation = (stat) => {
    const explanations = {
      hp: 'Hit Points: Die Grundmenge an Lebenspunkten des Monsters',
      ac: 'Armor Class: Die Rüstungsklasse bestimmt, wie schwer das Monster zu treffen ist',
      ehp: 'Effective HP: Berücksichtigt AC-Modifikatoren. Höhere AC = effektiv mehr HP',
      dpr: 'Damage Per Round: Durchschnittlicher Schaden pro Runde basierend auf den stärksten Angriffen',
      str: 'Strength: Stärkewert des Monsters',
      dex: 'Dexterity: Geschicklichkeitswert des Monsters',
      con: 'Constitution: Konstitutionswert des Monsters',
      int: 'Intelligence: Intelligenzwert des Monsters',
      wis: 'Wisdom: Weisheitswert des Monsters',
      cha: 'Charisma: Charismawert des Monsters',
      profBonus: 'Proficiency Bonus: Berechnet aus CR, wird zu Rettungswürfen und Skills addiert',
      numActions: 'Anzahl der verfügbaren Aktionen',
      numBonusActions: 'Anzahl der verfügbaren Bonus-Aktionen',
      numReactions: 'Anzahl der verfügbaren Reaktionen',
      numLegendaryActions: 'Anzahl der legendären Aktionen',
      numResistances: 'Anzahl der Schadensresistenzen',
      numImmunities: 'Anzahl der Schadensimmunitäten',
      numConditionImmunities: 'Anzahl der Zustandsimmunitäten'
    };
    return explanations[stat] || '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-[slideUp_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🎲</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                Effective Challenge Rating Analysis
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {monster?.name || 'Monster'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* CR Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <div className="text-sm uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2 font-medium">
                Estimated CR (ML-berechnet)
              </div>
              <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                {formatCR(eCRData.ecr)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Konfidenz:
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  eCRData.confidence === 'high'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : eCRData.confidence === 'medium'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {eCRData.confidence === 'high' ? 'Hoch' : eCRData.confidence === 'medium' ? 'Mittel' : 'Niedrig'}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
              <div className="text-sm uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2 font-medium">
                Official CR
              </div>
              <div className="text-4xl font-bold text-slate-700 dark:text-slate-300">
                {formatCR(displayCR)}
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Aus dem offiziellen Monster Manual
              </div>
            </div>
          </div>

          {/* Core Combat Stats */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>⚔️</span> Kampf-Statistiken
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="HP" value={features.hp} explanation={getStatExplanation('hp')} />
              <StatCard label="AC" value={features.ac} explanation={getStatExplanation('ac')} />
              <StatCard label="Effective HP" value={ehp?.toFixed(0)} explanation={getStatExplanation('ehp')} highlight />
              <StatCard label="DPR" value={features.dpr?.toFixed(1)} explanation={getStatExplanation('dpr')} highlight />
            </div>
          </div>

          {/* Ability Scores */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>📊</span> Attributswerte
            </h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <StatCard label="STR" value={features.str} subValue={formatModifier(features.strMod)} explanation={getStatExplanation('str')} />
              <StatCard label="DEX" value={features.dex} subValue={formatModifier(features.dexMod)} explanation={getStatExplanation('dex')} />
              <StatCard label="CON" value={features.con} subValue={formatModifier(features.conMod)} explanation={getStatExplanation('con')} />
              <StatCard label="INT" value={features.int} subValue={formatModifier(features.intMod)} explanation={getStatExplanation('int')} />
              <StatCard label="WIS" value={features.wis} subValue={formatModifier(features.wisMod)} explanation={getStatExplanation('wis')} />
              <StatCard label="CHA" value={features.cha} subValue={formatModifier(features.chaMod)} explanation={getStatExplanation('cha')} />
            </div>
          </div>

          {/* Saving Throws */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>🛡️</span> Rettungswürfe
            </h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <StatCard label="STR Save" value={formatModifier(features.strSave)} />
              <StatCard label="DEX Save" value={formatModifier(features.dexSave)} />
              <StatCard label="CON Save" value={formatModifier(features.conSave)} />
              <StatCard label="INT Save" value={formatModifier(features.intSave)} />
              <StatCard label="WIS Save" value={formatModifier(features.wisSave)} />
              <StatCard label="CHA Save" value={formatModifier(features.chaSave)} />
            </div>
          </div>

          {/* Action Economy */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>⏱️</span> Aktionsökonomie
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Aktionen" value={features.numActions} explanation={getStatExplanation('numActions')} />
              <StatCard label="Bonus-Aktionen" value={features.numBonusActions} explanation={getStatExplanation('numBonusActions')} />
              <StatCard label="Reaktionen" value={features.numReactions} explanation={getStatExplanation('numReactions')} />
              <StatCard label="Legendäre Aktionen" value={features.numLegendaryActions} explanation={getStatExplanation('numLegendaryActions')} highlight={features.numLegendaryActions > 0} />
            </div>
          </div>

          {/* Resistances & Immunities */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>🛡️</span> Resistenzen & Immunitäten
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Resistenzen" value={features.numResistances} explanation={getStatExplanation('numResistances')} />
              <StatCard label="Immunitäten" value={features.numImmunities} explanation={getStatExplanation('numImmunities')} />
              <StatCard label="Zustandsimmunitäten" value={features.numConditionImmunities} explanation={getStatExplanation('numConditionImmunities')} />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="flex-1 text-sm text-blue-900 dark:text-blue-200">
                <p className="font-medium mb-2">Wie wird die eCR berechnet?</p>
                <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                  Die Effective Challenge Rating wird durch ein Machine Learning Modell berechnet,
                  das auf den offiziellen D&D 5e Monster-Daten trainiert wurde. Es analysiert alle
                  Kampf-Stats, Fähigkeiten und die Aktionsökonomie, um eine präzisere CR-Bewertung
                  zu ermitteln. Die Konfidenz zeigt an, wie sicher sich das Modell bei der Vorhersage ist.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="btn bg-slate-600 text-white hover:bg-slate-700 border-slate-600 px-6"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * StatCard Component - Displays a single stat with optional explanation
 */
function StatCard({ label, value, subValue, explanation, highlight = false }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <div
        className={`bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border ${
          highlight
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
            : 'border-slate-200 dark:border-slate-600'
        } ${explanation ? 'cursor-help' : ''}`}
        onMouseEnter={() => explanation && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          {label}
        </div>
        <div className={`text-lg font-bold ${
          highlight
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-slate-900 dark:text-slate-100'
        }`}>
          {value ?? '-'}
        </div>
        {subValue && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subValue}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && explanation && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 pointer-events-none">
          <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg p-2">
            {explanation}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format modifier with +/- sign
 */
function formatModifier(mod) {
  if (mod === undefined || mod === null) return '-';
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Format CR with proper fraction symbols
 */
function formatCR(cr) {
  if (cr === undefined || cr === null) return '?';

  const crStr = String(cr);

  // Handle numeric fractions
  if (cr === 0.5 || crStr === '0.5' || crStr === '1/2') return '½';
  if (cr === 0.25 || crStr === '0.25' || crStr === '1/4') return '¼';
  if (cr === 0.125 || crStr === '0.125' || crStr === '1/8') return '⅛';

  return crStr;
}

/**
 * CR Display mit Tooltip für eCR (Estimated Challenge Rating)
 * Zeigt beim Hover einen schönen Tooltip mit ML-basierter eCR-Berechnung
 */
export function CRWithTooltip({ monster, displayCR, className = '', showLabel = true }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [eCRData, setECRData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const tooltipRef = useRef(null);

  // Fetch eCR when hovering or modal opens
  useEffect(() => {
    if ((showTooltip || showModal) && !eCRData && !loading && !error && monster) {
      fetchECR();
    }
  }, [showTooltip, showModal]);

  async function fetchECR() {
    if (!monster) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiPost('/api/ecr/calculate', { monster });

      if (!response.ok) {
        throw new Error('Failed to calculate eCR');
      }

      const data = await response.json();
      setECRData(data);
    } catch (err) {
      console.error('eCR calculation error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleMouseMove(e) {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 10;

    let x = e.clientX + 15; // Offset from cursor
    let y = e.clientY + 15;

    // Check if tooltip would go off the right edge
    if (x + tooltipRect.width + padding > window.innerWidth) {
      x = e.clientX - tooltipRect.width - 15;
    }

    // Check if tooltip would go off the bottom edge
    if (y + tooltipRect.height + padding > window.innerHeight) {
      y = e.clientY - tooltipRect.height - 15;
    }

    // Check if tooltip would go off the left edge
    if (x < padding) {
      x = padding;
    }

    // Check if tooltip would go off the top edge
    if (y < padding) {
      y = padding;
    }

    setTooltipPos({ x, y });
  }

  const crDisplay = displayCR ?? monster?.cr ?? '?';

  return (
    <>
      {/* CR Display */}
      <span
        className={`cursor-pointer transition-all ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
          setShowTooltip(false);
        }}
        onMouseEnter={(e) => {
          setShowTooltip(true);
          handleMouseMove(e);
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {showLabel && 'CR '}{formatCR(crDisplay)}
      </span>

      {/* Tooltip - Fixed Position */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-64 pointer-events-none"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`
          }}
        >
          <div className="bg-gradient-to-br from-amber-600 to-orange-600 dark:from-amber-700 dark:to-orange-700 text-white rounded-lg shadow-2xl p-3 text-xs">
            {/* Content */}
            {loading ? (
              <div className="text-center py-2 text-white/80">
                Berechne eCR...
              </div>
            ) : error ? (
              <div className="text-center py-2 text-red-200">
                Fehler beim Berechnen
              </div>
            ) : eCRData ? (
              <>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/30">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-white/70 mb-0.5">
                      Estimated CR
                    </div>
                    <div className="text-xl font-bold text-yellow-200">
                      {formatCR(eCRData.ecr)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-white/70 mb-0.5">
                      Official CR
                    </div>
                    <div className="text-xl font-bold text-white">
                      {formatCR(crDisplay)}
                    </div>
                  </div>
                </div>

                {/* Confidence Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-white/70">
                    Konfidenz:
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    eCRData.confidence === 'high'
                      ? 'bg-white/30 text-green-200'
                      : eCRData.confidence === 'medium'
                      ? 'bg-white/30 text-yellow-200'
                      : 'bg-white/30 text-red-200'
                  }`}>
                    {eCRData.confidence === 'high' ? 'Hoch' : eCRData.confidence === 'medium' ? 'Mittel' : 'Niedrig'}
                  </span>
                </div>

                {/* Stats */}
                {eCRData.features && (
                  <div className="grid grid-cols-2 gap-1 mb-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-white/70">HP:</span>
                      <span className="font-medium text-white">{eCRData.features.hp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">AC:</span>
                      <span className="font-medium text-white">{eCRData.features.ac}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">EHP:</span>
                      <span className="font-medium text-white">{eCRData.features.ehp?.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">DPR:</span>
                      <span className="font-medium text-white">{eCRData.features.dpr?.toFixed(1)}</span>
                    </div>
                  </div>
                )}

                {/* Info Text */}
                <div className="text-[10px] leading-relaxed text-white/80 pt-2 border-t border-white/30">
                  Die eCR wird durch ein Machine Learning Modell berechnet,
                  das anhand des Statblocks versucht, die Challenge Rating zu ermitteln.
                </div>
              </>
            ) : (
              <div className="text-center py-2 text-white/80">
                Bewege die Maus über CR
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Modal */}
      {showModal && eCRData && (
        <ECRDetailModal
          monster={monster}
          displayCR={crDisplay}
          eCRData={eCRData}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
