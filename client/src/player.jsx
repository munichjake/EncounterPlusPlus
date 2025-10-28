import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const API = (p) => `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${p}`;

function PlayerScreen() {
  const [enc, setEnc] = useState(null);
  const [encounterName, setEncounterName] = useState('');
  const [round, setRound] = useState(1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [initiativeOrder, setInitiativeOrder] = useState([]);
  const [isRotated, setIsRotated] = useState(() => {
    const saved = localStorage.getItem('playerScreenRotated');
    return saved ? JSON.parse(saved) : false;
  });
  const [displayOrder, setDisplayOrder] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFadingCurrentTurn, setIsFadingCurrentTurn] = useState(false);
  const prevTurnIndexRef = useRef(0);
  const prevRoundRef = useRef(1);
  const prevCombatantNameRef = useRef('');

  useEffect(() => {
    localStorage.setItem('playerScreenRotated', JSON.stringify(isRotated));
  }, [isRotated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encounterId = params.get('encounter');

    if (!encounterId) {
      return;
    }

    // Initial fetch
    fetchEncounter(encounterId);

    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      fetchEncounter(encounterId);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  async function fetchEncounter(id) {
    try {
      const response = await fetch(API(`/api/encounters/${id}`));
      if (!response.ok) return;

      const data = await response.json();
      setEnc(data);
      setEncounterName(data.name || 'Encounter');

      const newRound = data.round || 1;
      const dmTurnIndex = data.turnIndex || 0;

      setRound(newRound);

      // Build full initiative order from initiativeOrder (includes lair actions)
      const fullOrder = (data.initiativeOrder || []).map(id => {
        // Check if it's a lair action marker
        if (typeof id === 'object' && id.type === 'lair') {
          return {
            id: id.id,
            name: '🏰 Lair Actions',
            isLairAction: true,
            visibleToPlayers: false, // Hidden from players
            initiative: id.initiative,
          };
        }
        // Regular combatant
        return data.combatants[id];
      }).filter(Boolean);

      // Build visible-only initiative order for display (exclude lair actions and hidden combatants)
      const visibleOrder = fullOrder.filter(c => c.visibleToPlayers !== false && !c.isLairAction);
      setInitiativeOrder(visibleOrder);

      // Calculate which visible combatant should be shown as active
      // If current DM combatant is hidden or is a lair action, stick to last visible one
      const currentDmCombatant = fullOrder[dmTurnIndex];
      let displayTurnIndex = 0;

      if (currentDmCombatant && (currentDmCombatant.visibleToPlayers === false || currentDmCombatant.isLairAction)) {
        // Current combatant is hidden or is a lair action - find the last visible combatant before it
        let foundBefore = false;
        for (let i = dmTurnIndex - 1; i >= 0; i--) {
          const combatant = fullOrder[i];
          if (combatant.visibleToPlayers !== false && !combatant.isLairAction) {
            // Found last visible combatant - find its index in visibleOrder
            displayTurnIndex = visibleOrder.findIndex(c => c.id === combatant.id);
            foundBefore = true;
            break;
          }
        }
        // If no visible combatant found before, check from the end (wrap around)
        if (!foundBefore) {
          for (let i = fullOrder.length - 1; i > dmTurnIndex; i--) {
            const combatant = fullOrder[i];
            if (combatant.visibleToPlayers !== false && !combatant.isLairAction) {
              displayTurnIndex = visibleOrder.findIndex(c => c.id === combatant.id);
              break;
            }
          }
        }
      } else if (currentDmCombatant) {
        // Current combatant is visible - find its index in visibleOrder
        displayTurnIndex = visibleOrder.findIndex(c => c.id === currentDmCombatant.id);
      }

      // Ensure valid index
      if (displayTurnIndex === -1) displayTurnIndex = 0;

      // Detect turn change and trigger animation
      const prevTurnIndex = prevTurnIndexRef.current;
      const prevRound = prevRoundRef.current;
      const roundChanged = newRound !== prevRound;

      if (displayTurnIndex !== prevTurnIndex || roundChanged) {
        const newCombatantName = visibleOrder[displayTurnIndex]?.name || '';

        // Trigger fade animation if name changed
        if (newCombatantName !== prevCombatantNameRef.current) {
          setIsFadingCurrentTurn(true);
          setTimeout(() => setIsFadingCurrentTurn(false), 300);
          prevCombatantNameRef.current = newCombatantName;
        }

        // Check if we moved forward
        const movedForward = displayTurnIndex === prevTurnIndex + 1 ||
                            (displayTurnIndex === 0 && prevTurnIndex === visibleOrder.length - 1);

        if (movedForward || roundChanged) {
          // Step 1: Scroll out the top item
          setIsTransitioning(true);

          // Step 2: After scroll completes, update turn and reset position
          setTimeout(() => {
            setCurrentTurnIndex(displayTurnIndex);
            setIsTransitioning(false);
          }, 600);
        } else {
          // Immediate update for backwards navigation
          setCurrentTurnIndex(displayTurnIndex);
        }

        prevTurnIndexRef.current = displayTurnIndex;
        prevRoundRef.current = newRound;
      }
    } catch (error) {
      console.error('Failed to fetch encounter:', error);
    }
  }

  // Create display order - rotate so current is always at top
  useEffect(() => {
    if (initiativeOrder.length === 0) return;

    const total = initiativeOrder.length;
    const reordered = [];

    // Start from current and go forward, wrapping around
    for (let i = 0; i < total; i++) {
      const idx = (currentTurnIndex + i) % total;

      // The round marker should appear BEFORE the first combatant (idx 0)
      // which means AFTER the last combatant (idx total-1)
      // In our rotated view, this is when the ORIGINAL index is total-1
      const isLastInInitiativeOrder = idx === total - 1;

      reordered.push({
        ...initiativeOrder[idx],
        originalIndex: idx,
        displayIndex: i,
        showRoundMarker: isLastInInitiativeOrder
      });
    }

    setDisplayOrder(reordered);
  }, [initiativeOrder, currentTurnIndex]);

  if (!enc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-3xl font-bold mb-2">Player Screen</h1>
          <p className="text-slate-400">Waiting for encounter data...</p>
        </div>
      </div>
    );
  }

  const currentCombatant = initiativeOrder[currentTurnIndex];

  // If initiative hasn't been rolled yet, show "ROLL INITIATIVE!" message
  if (initiativeOrder.length === 0) {
    return (
      <div className={`h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white transition-transform duration-500 ${isRotated ? 'rotate-180' : ''}`}>
        {/* Rotation Toggle Button */}
        <button
          className={`fixed top-4 right-4 z-50 w-12 h-12 bg-slate-700/80 hover:bg-slate-600 rounded-full flex items-center justify-center text-2xl transition-all ${isRotated ? 'rotate-180' : ''}`}
          onClick={() => setIsRotated(!isRotated)}
          title="Rotate Screen 180°"
        >
          🔄
        </button>

        <div className="text-center">
          <div className="text-8xl mb-8 animate-pulse">⚔️</div>
          <h1 className="text-6xl font-bold mb-4 shiny-text">
            Combat is about to start.
          </h1>
          <p className="text-7xl font-black shiny-text">
            ROLL INITIATIVE!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 transition-transform duration-500 ${isRotated ? 'rotate-180' : ''}`}>
      {/* Rotation Toggle Button */}
      <button
        className={`fixed top-4 right-4 z-50 w-12 h-12 bg-slate-700/80 hover:bg-slate-600 rounded-full flex items-center justify-center text-2xl transition-all ${isRotated ? 'rotate-180' : ''}`}
        onClick={() => setIsRotated(!isRotated)}
        title="Rotate Screen 180°"
      >
        🔄
      </button>

      {/* Header with Encounter Name, Round Counter and Current Turn */}
      <div className="flex-shrink-0 mb-6">
        {/* Encounter Name */}
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            {encounterName}
          </h1>
        </div>

        {/* Round Counter and Current Combatant side by side */}
        <div className="flex items-center justify-center gap-4">
          {/* Round Counter */}
          <div className="bg-slate-700/50 px-6 py-3 rounded-xl border border-slate-600">
            <div className="text-center">
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Round</div>
              <div className="text-3xl font-bold text-blue-400">{round}</div>
            </div>
          </div>

          {/* Current Turn Display with fixed width and fade animation */}
          {currentCombatant && (
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 px-6 py-3 rounded-xl shadow-lg w-[500px] transition-all duration-300">
              <div className="flex items-center gap-4">
                {/* Token Image with fade */}
                {(() => {
                  // Prefer tokenUrl over imageUrl for player screen (tokens are better for initiative tracking)
                  let tokenUrl = currentCombatant.tokenUrl || currentCombatant.imageUrl;

                  // Fix old 5e.tools URLs to use our proxy
                  if (tokenUrl && tokenUrl.includes('5e.tools')) {
                    const match = tokenUrl.match(/5e\.tools\/img\/bestiary\/(tokens\/)?([^\/]+)\/(.+?)\.webp/);
                    if (match) {
                      const source = match[2];
                      const name = match[3];
                      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                      tokenUrl = `${API_BASE}/api/token/${encodeURIComponent(source)}/${encodeURIComponent(name)}`;
                    }
                  }

                  return tokenUrl ? (
                    <div className={`flex-shrink-0 transition-opacity duration-300 ${isFadingCurrentTurn ? 'opacity-0' : 'opacity-100'}`}>
                      <img
                        src={tokenUrl}
                        alt={currentCombatant.name}
                        className="w-20 h-20 rounded-full border-4 border-yellow-500 object-cover shadow-xl"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : null;
                })()}
                <div className={`text-center flex-1 transition-opacity duration-300 ${isFadingCurrentTurn ? 'opacity-0' : 'opacity-100'}`}>
                  <div className="text-xs text-yellow-300 font-medium uppercase tracking-wide">Current Turn</div>
                  <div className="text-3xl font-bold text-yellow-300">{currentCombatant.name}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Initiative Order with Scroll Animation */}
      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-4">
        <div className="relative" style={{ minHeight: '500px' }}>
          {displayOrder.map((combatant, displayIdx) => {
            const isCurrent = displayIdx === 0;
            const isNext = displayIdx === 1;

            // Calculate position
            const itemHeight = 104; // ~6.5rem in pixels (padding + content + margin)
            const markerHeight = 60; // Height of the round marker

            // Find where the round marker is in the display order
            const markerIndex = displayOrder.findIndex(c => c.showRoundMarker);

            // Add extra space for items that come after the marker
            let extraSpace = 0;
            if (markerIndex !== -1 && displayIdx > markerIndex) {
              extraSpace = markerHeight;
            }

            const basePosition = displayIdx * itemHeight + extraSpace;
            const targetExtraSpace = isTransitioning && markerIndex !== -1 && (displayIdx - 1) > markerIndex ? markerHeight :
                                    isTransitioning && markerIndex !== -1 && displayIdx > markerIndex ? markerHeight : extraSpace;
            const targetPosition = isTransitioning ? (displayIdx - 1) * itemHeight + targetExtraSpace : basePosition;

            return (
              <React.Fragment key={`${combatant.id}-${combatant.originalIndex}`}>
                <div
                  className={`absolute top-0 left-0 right-0 flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ease-out ${
                    isTransitioning && displayIdx === 0 ? 'opacity-0 scale-95' : 'opacity-100'
                  } ${
                    isCurrent
                      ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 shadow-xl shadow-yellow-500/30'
                      : isNext
                      ? 'bg-slate-700/70 border-2 border-slate-500 shadow-lg'
                      : 'bg-slate-700/50 border border-slate-600'
                  }`}
                  style={{
                    transform: `translateY(${targetPosition}px) ${!isCurrent ? 'scale(0.95)' : ''}`,
                    ...(combatant.concentration && { animation: 'concentration-pulse 2s ease-in-out infinite' })
                  }}
                >
                  {/* Position */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                    isCurrent
                      ? 'bg-yellow-500 text-slate-900'
                      : isNext
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-600 text-slate-300'
                  }`}>
                    {isCurrent ? '▶' : isNext ? '⧁' : displayIdx + 1}
                  </div>

                  {/* Token Image */}
                  {(() => {
                    // Prefer tokenUrl over imageUrl for player screen
                    let tokenUrl = combatant.tokenUrl || combatant.imageUrl;

                    // Fix old 5e.tools URLs to use our proxy
                    if (tokenUrl && tokenUrl.includes('5e.tools')) {
                      const match = tokenUrl.match(/5e\.tools\/img\/bestiary\/(tokens\/)?([^\/]+)\/(.+?)\.webp/);
                      if (match) {
                        const source = match[2];
                        const name = match[3];
                        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                        tokenUrl = `${API_BASE}/api/token/${encodeURIComponent(source)}/${encodeURIComponent(name)}`;
                      }
                    }

                    return tokenUrl ? (
                      <div className="flex-shrink-0">
                        <img
                          src={tokenUrl}
                          alt={combatant.name}
                          className={`w-12 h-12 rounded-full object-cover shadow-lg transition-all ${
                            isCurrent
                              ? 'border-2 border-yellow-500'
                              : isNext
                              ? 'border-2 border-blue-500'
                              : 'border border-slate-500'
                          }`}
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null;
                  })()}

                  {/* Name */}
                  <div className="flex-1">
                    <div className={`text-xl font-semibold transition-colors ${
                      isCurrent
                        ? 'text-yellow-300'
                        : isNext
                        ? 'text-blue-300'
                        : 'text-white'
                    }`}>
                      {combatant.name}
                    </div>
                  </div>

                  {/* Conditions (visible to players) */}
                  {combatant.conditions && combatant.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {combatant.conditions.map(cond => (
                        <span
                          key={cond}
                          className="px-2 py-1 bg-amber-500/30 text-amber-300 rounded-full text-xs font-medium border border-amber-500/50"
                        >
                          {cond}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Concentration indicator (visible to players) */}
                  {combatant.concentration && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-purple-500/30 text-purple-300 rounded-full text-sm font-medium border border-purple-500/50">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                      Concentrating
                    </div>
                  )}

                  {/* Initiative Value */}
                  <div className="text-center">
                    <div className="text-sm text-slate-400">Initiative</div>
                    <div className={`text-2xl font-bold transition-colors ${
                      isCurrent
                        ? 'text-yellow-400'
                        : isNext
                        ? 'text-blue-300'
                        : 'text-blue-400'
                    }`}>
                      {combatant.initiative ?? 0}
                    </div>
                  </div>
                </div>

                {/* Round Separator - shown AFTER the last combatant in initiative order */}
                {combatant.showRoundMarker && (
                  <div
                    className="absolute top-0 left-0 right-0 transition-all duration-600 ease-in-out z-10"
                    style={{
                      transform: `translateY(${targetPosition + itemHeight + 12}px)`,
                      opacity: isTransitioning && combatant.originalIndex === initiativeOrder.length - 1 && displayIdx === 0 ? 0 : 1
                    }}
                  >
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-dashed border-purple-500/50"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <div className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 backdrop-blur-sm px-6 py-2 rounded-full border border-purple-500/50 shadow-lg">
                          <div className="text-sm font-bold text-purple-300 flex items-center gap-2">
                            <span className="text-lg">↻</span>
                            <span>ROUND {round + 1}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<PlayerScreen />);
