import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const [validImages, setValidImages] = useState(new Set());
  const [showRollInitiativeAnimation, setShowRollInitiativeAnimation] = useState(false);
  const prevTurnIndexRef = useRef(0);
  const prevRoundRef = useRef(1);
  const prevCombatantNameRef = useRef('');
  const prevInitiativeCountRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('playerScreenRotated', JSON.stringify(isRotated));
  }, [isRotated]);

  // Helper function to check if an image URL is valid
  const checkImageExists = useCallback(async (url) => {
    if (!url) return false;

    console.log('[Player] Checking image:', url);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log('[Player] ✓ Image loaded:', url);
        resolve(true);
      };
      img.onerror = (e) => {
        console.error('[Player] ✗ Image failed:', url, e);
        resolve(false);
      };
      img.src = url;
      // Timeout after 5 seconds
      setTimeout(() => {
        console.warn('[Player] ⏱ Image timeout:', url);
        resolve(false);
      }, 5000);
    });
  }, []);

  // Helper function to fix 5e.tools URLs
  const fixTokenUrl = useCallback((tokenUrl) => {
    if (!tokenUrl) return null;

    if (tokenUrl.includes('5e.tools')) {
      const match = tokenUrl.match(/5e\.tools\/img\/bestiary\/(tokens\/)?([^\/]+)\/(.+?)\.webp/);
      if (match) {
        const source = match[2];
        const name = match[3];
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const fixedUrl = `${API_BASE}/api/token/${encodeURIComponent(source)}/${encodeURIComponent(name)}`;
        console.log('[Player] Fixed URL:', tokenUrl, '->', fixedUrl);
        return fixedUrl;
      }
    }
    console.log('[Player] Using URL as-is:', tokenUrl);
    return tokenUrl;
  }, []);

  // Helper to get best image for current turn (prefer _full, fallback to _token)
  const getBestImageForCurrentTurn = useCallback((combatant) => {
    if (!combatant) return null;

    // Try _full first (check both direct property and meta)
    const imageUrl = combatant.imageUrl || combatant.meta?.imageUrl;
    if (imageUrl) {
      const fullUrl = fixTokenUrl(imageUrl);
      if (fullUrl && validImages.has(fullUrl)) {
        return fullUrl;
      }
    }

    // Fallback to _token (check both direct property and meta)
    const tokenUrl = combatant.tokenUrl || combatant.meta?.tokenUrl;
    if (tokenUrl) {
      const tokenUrlFixed = fixTokenUrl(tokenUrl);
      if (tokenUrlFixed && validImages.has(tokenUrlFixed)) {
        return tokenUrlFixed;
      }
    }

    return null;
  }, [fixTokenUrl, validImages]);

  // Validate images for all combatants
  const validateImages = useCallback(async (combatants) => {
    console.log('[Player] Validating images for', combatants.length, 'combatants');
    const validUrls = new Set();

    for (const combatant of combatants) {
      // Check both direct properties and meta
      const tokenUrlRaw = combatant.tokenUrl || combatant.meta?.tokenUrl;
      const imageUrlRaw = combatant.imageUrl || combatant.meta?.imageUrl;

      console.log('[Player] Combatant:', combatant.name, 'tokenUrl:', tokenUrlRaw, 'imageUrl:', imageUrlRaw);

      // Check both tokenUrl and imageUrl (_full)
      const tokenUrl = fixTokenUrl(tokenUrlRaw);
      const imageUrl = fixTokenUrl(imageUrlRaw);

      if (tokenUrl) {
        const isValid = await checkImageExists(tokenUrl);
        if (isValid) {
          validUrls.add(tokenUrl);
        }
      }

      if (imageUrl && imageUrl !== tokenUrl) {
        const isValid = await checkImageExists(imageUrl);
        if (isValid) {
          validUrls.add(imageUrl);
        }
      }
    }

    console.log('[Player] Valid images:', validUrls.size, Array.from(validUrls));
    setValidImages(validUrls);
  }, [checkImageExists, fixTokenUrl]);

  const fetchEncounter = useCallback(async (id) => {
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

      // Detect if initiative was just rolled (combatants with initiative increased from 0)
      const combatantsWithInitiative = visibleOrder.filter(c => c.initiative !== undefined && c.initiative !== null).length;
      const prevInitiativeCount = prevInitiativeCountRef.current;

      // Trigger animation if we went from few/no initiative to all having initiative
      if (prevInitiativeCount === 0 && combatantsWithInitiative > 0 && combatantsWithInitiative === visibleOrder.length) {
        setShowRollInitiativeAnimation(true);
        setTimeout(() => setShowRollInitiativeAnimation(false), 3000); // Hide after 3 seconds
      }

      prevInitiativeCountRef.current = combatantsWithInitiative;
      setInitiativeOrder(visibleOrder);

      // Validate images for all visible combatants
      validateImages(visibleOrder);

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
  }, [validateImages]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encounterId = params.get('encounter');
    const followMode = params.get('follow') === 'true';
    const token = params.get('token');

    if (!encounterId && !followMode) {
      return;
    }

    const fetchCurrentEncounter = async () => {
      if (followMode) {
        // Follow mode: fetch the current active encounter using secure token
        try {
          console.log('[Player] Follow mode: fetching current encounter with token');
          const response = await fetch(API(`/api/encounters/current/active?token=${encodeURIComponent(token)}`), {
            credentials: 'include'
          });
          if (!response.ok) {
            console.error('[Player] Failed to fetch current encounter:', response.status, response.statusText);
            return;
          }
          const data = await response.json();
          console.log('[Player] Current encounter ID:', data.id);
          // Fetch the actual encounter data
          fetchEncounter(data.id);
        } catch (error) {
          console.error('[Player] Failed to fetch current encounter:', error);
        }
      } else {
        // Normal mode: fetch specific encounter
        fetchEncounter(encounterId);
      }
    };

    // Initial fetch
    fetchCurrentEncounter();

    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      fetchCurrentEncounter();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchEncounter]);

  // Create display order - rotate so current is always at top
  useEffect(() => {
    if (initiativeOrder.length === 0) return;

    const total = initiativeOrder.length;
    const reordered = [];

    // Check if current combatant is a sidekick - if so, show owner instead
    const currentCombatant = initiativeOrder[currentTurnIndex];
    let effectiveCurrentIndex = currentTurnIndex;

    if (currentCombatant?.sidekickOf) {
      // Find the owner/main character
      const ownerIndex = initiativeOrder.findIndex(c => c.id === currentCombatant.sidekickOf);
      if (ownerIndex !== -1) {
        effectiveCurrentIndex = ownerIndex;
      }
    }

    // Start from effective current and go forward, wrapping around
    for (let i = 0; i < total; i++) {
      const idx = (effectiveCurrentIndex + i) % total;

      reordered.push({
        ...initiativeOrder[idx],
        originalIndex: idx,
        displayIndex: i
      });

      // Insert round marker AFTER the last combatant in original order
      // Check if next combatant would be the first one (index 0)
      const nextIdx = (effectiveCurrentIndex + i + 1) % total;
      if (nextIdx === 0) {
        // Insert a special "round marker" entry
        reordered.push({
          id: `round-marker-${i}`,
          isRoundMarker: true,
          displayIndex: i + 0.5, // Between this and next
          name: 'Round Marker'
        });
      }
    }

    setDisplayOrder(reordered);
  }, [initiativeOrder, currentTurnIndex, round]);

  // Get settings from encounter data (synced from DM screen) - BEFORE any returns
  const blackMode = enc?.playerScreenSettings?.blackMode || false;
  const rotation = enc?.playerScreenSettings?.rotation || 0;
  const zoom = enc?.playerScreenSettings?.zoom || 100;
  const showCurrentTurnImage = enc?.playerScreenSettings?.showCurrentTurnImage !== false;
  const showInitiativeImages = enc?.playerScreenSettings?.showInitiativeImages !== false;
  const showTurnButton = enc?.playerScreenSettings?.showTurnButton !== false;
  const hideScrollbars = enc?.playerScreenSettings?.hideScrollbars || false;
  const showBloodiedInPlayerView = enc?.playerScreenSettings?.showBloodiedInPlayerView || false;
  const blankScreen = enc?.playerScreenSettings?.blankScreen || false;

  // Check if combat is completed
  const isCombatCompleted = enc?.combatStatus === 'completed';

  // Combine local and DM-controlled rotation
  const effectiveRotation = isRotated ? 180 : rotation;

  // Early exit: No encounter data yet
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

  // If combat is completed or blank screen is active, show black screen with fade
  // (Only check this AFTER we know enc exists)
  if (isCombatCompleted || blankScreen) {
    console.log('[Player] Showing black screen - isCombatCompleted:', isCombatCompleted, 'blankScreen:', blankScreen);
    return (
      <div className="min-h-screen min-w-screen bg-black animate-fadeIn"></div>
    );
  }

  const currentCombatant = initiativeOrder[currentTurnIndex];

  // Helper function to determine if a combatant is a player character
  const isPlayerCharacter = (combatant) => {
    if (!combatant) return false;
    return combatant.player || combatant.isPC || combatant.source === "ddb-import" || combatant.source === "player-character";
  };

  // Check if current combatant has any sidekicks
  const getSidekicksForCombatant = (combatantId) => {
    return initiativeOrder.filter(c => c.sidekickOf === combatantId);
  };

  // Get the effective combatant to display (if current is sidekick, return owner)
  const getEffectiveCurrentCombatant = () => {
    if (!currentCombatant) return null;

    // If current combatant is a sidekick, find and return the owner
    if (currentCombatant.sidekickOf) {
      const owner = initiativeOrder.find(c => c.id === currentCombatant.sidekickOf);
      return owner || currentCombatant;
    }

    return currentCombatant;
  };

  // Build display name for current turn (include sidekicks)
  const getCurrentTurnDisplayName = () => {
    const effectiveCombatant = getEffectiveCurrentCombatant();
    if (!effectiveCombatant) return '';

    const sidekicks = getSidekicksForCombatant(effectiveCombatant.id);
    if (sidekicks.length > 0) {
      const sidekickNames = sidekicks.map(s => s.name).join(' & ');
      return `${effectiveCombatant.name} & ${sidekickNames}`;
    }
    return effectiveCombatant.name;
  };

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
    <div className={`min-h-screen min-w-screen flex items-center justify-center transition-all duration-500 animate-fadeIn`}
      style={{
        background: blackMode ? '#000000' : 'linear-gradient(to bottom right, rgb(30, 41, 59), rgb(15, 23, 42))'
      }}
    >
      <div
        className={`h-screen w-screen flex flex-col text-white p-4 md:p-8 transition-all duration-500`}
        style={{
          background: blackMode ? '#000000' : 'linear-gradient(to bottom right, rgb(30, 41, 59), rgb(15, 23, 42))',
          zoom: `${zoom}%`,
          transform: `rotate(${effectiveRotation}deg)`,
          overflow: hideScrollbars ? 'hidden' : 'auto'
        }}
      >
      {/* Rotation Toggle Button - conditionally shown */}
      {showTurnButton && (
        <button
          className={`fixed top-2 right-2 md:top-4 md:right-4 z-50 w-10 h-10 md:w-12 md:h-12 bg-slate-700/80 hover:bg-slate-600 rounded-full flex items-center justify-center text-xl md:text-2xl transition-all ${isRotated ? 'rotate-180' : ''}`}
          onClick={() => setIsRotated(!isRotated)}
          title="Rotate Screen 180°"
        >
          🔄
        </button>
      )}

      {/* Roll Initiative Animation Overlay */}
      {showRollInitiativeAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="text-center animate-pulse">
            <div className="text-9xl mb-8 animate-bounce">🎲</div>
            <h2 className="text-6xl font-bold bg-gradient-to-r from-red-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent mb-4">
              Roll Initiative!
            </h2>
            <p className="text-3xl text-white/80">Combat begins...</p>
          </div>
        </div>
      )}

      {/* Header with Encounter Name, Round Counter and Current Turn */}
      <div className="flex-shrink-0 mb-4 md:mb-6 lg:mb-8">
        {/* Encounter Name */}
        <div className="text-center mb-3 md:mb-6">
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 4rem)' }} className="font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent leading-tight">
            {encounterName}
          </h1>
        </div>

        {/* Round Counter and Current Combatant side by side */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6">
          {/* Round Counter */}
          <div className="bg-slate-700/50 px-6 py-3 md:px-8 md:py-4 rounded-2xl border-2 border-slate-600">
            <div className="text-center">
              <div style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.2rem)' }} className="text-slate-400 font-medium uppercase tracking-wide">Round</div>
              <div style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }} className="font-bold text-blue-400">{round}</div>
            </div>
          </div>

          {/* Current Turn Display - responsive width */}
          {currentCombatant && (() => {
            const effectiveCombatant = getEffectiveCurrentCombatant();
            const isPC = isPlayerCharacter(effectiveCombatant);
            const sideBarColor = isPC ? 'bg-green-500' : 'bg-red-500';
            const textColor = isPC ? 'text-green-300' : 'text-red-300';
            const imageBorderColor = isPC ? 'border-green-500' : 'border-red-500';

            return (
              <div className="bg-slate-700/50 px-6 py-3 md:px-8 md:py-4 rounded-2xl shadow-2xl w-full max-w-4xl transition-all duration-300 relative overflow-hidden">
                {/* Left side colored bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${sideBarColor}`}></div>

                <div className="flex items-center gap-4">
                  {/* Image with fade - prefer _full, fallback to _token */}
                  {showCurrentTurnImage && (() => {
                    const imageUrl = getBestImageForCurrentTurn(effectiveCombatant);

                    // Only show if validated
                    return imageUrl ? (
                      <div className={`flex-shrink-0 transition-opacity duration-300 ${isFadingCurrentTurn ? 'opacity-0' : 'opacity-100'}`}>
                        <img
                          src={imageUrl}
                          alt={effectiveCombatant.name}
                          style={{ width: 'clamp(4rem, 8vw, 8rem)', height: 'clamp(4rem, 8vw, 8rem)' }}
                          className={`rounded-full border-4 ${imageBorderColor} object-cover shadow-2xl`}
                          crossOrigin="anonymous"
                        />
                      </div>
                    ) : null;
                  })()}
                  <div className={`text-center flex-1 transition-opacity duration-300 ${isFadingCurrentTurn ? 'opacity-0' : 'opacity-100'}`}>
                    <div style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.5rem)' }} className={`${textColor} font-medium uppercase tracking-wide`}>Current Turn</div>
                    <div style={{ fontSize: 'clamp(1.5rem, 4vw, 4rem)' }} className={`font-bold ${textColor} break-words leading-tight`}>{getCurrentTurnDisplayName()}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Initiative Order with Scroll Animation */}
      <div className="flex-1 overflow-y-auto w-full px-4 md:px-8">
        <div className="relative max-w-7xl mx-auto" style={{ minHeight: '50vh' }}>
          {displayOrder.map((combatant, displayIdx) => {
            const isCurrent = displayIdx === 0;
            const isNext = displayIdx === 1;

            // Calculate position - reduced spacing for compact layout
            const baseItemHeight = 130;
            const itemHeight = baseItemHeight + (combatant.conditions?.length > 0 ? 8 : 0);

            const basePosition = displayIdx * itemHeight;
            const targetPosition = isTransitioning ? (displayIdx - 1) * itemHeight : basePosition;

            // Calculate if combatant is bloodied
            const effectiveMaxHP = (combatant.baseHP || 0) + (combatant.maxHPModifier || 0);
            const hpPercent = effectiveMaxHP > 0 ? ((combatant.hp || 0) / effectiveMaxHP) * 100 : 100;
            const isBloodied = showBloodiedInPlayerView && hpPercent > 0 && hpPercent < 50;

            // Determine if this combatant is a player character
            const isPC = isPlayerCharacter(combatant);

            // Color scheme based on type and position
            let sideBarColor, sideBarWidth;
            if (isCurrent) {
              sideBarColor = isPC ? 'bg-green-500' : 'bg-red-500';
              sideBarWidth = 'w-2';
            } else if (isNext) {
              sideBarColor = isPC ? 'bg-green-600' : 'bg-red-600';
              sideBarWidth = 'w-1.5';
            } else {
              sideBarColor = isPC ? 'bg-green-800' : 'bg-red-800';
              sideBarWidth = 'w-1';
            }

            const indentAmount = combatant.sidekickOf ? 'clamp(3rem, 8vw, 6rem)' : '0';

            return (
              <React.Fragment key={`${combatant.id}-${combatant.originalIndex}`}>
                <div
                  className="absolute top-0 w-full transition-all duration-500 ease-out"
                  style={{
                    transform: `translateY(${targetPosition}px)`,
                  }}
                >
                  {/* Sidekick layout: arrow + card side by side */}
                  <div className="flex items-start w-full" style={{ paddingRight: combatant.sidekickOf ? '1px' : '0' }}>
                    {/* Sidekick Arrow Indicator */}
                    {combatant.sidekickOf && (
                      <div
                        className="text-slate-400 pointer-events-none flex-shrink-0 flex items-start"
                        style={{
                          fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)',
                          width: indentAmount,
                          paddingLeft: '1.5rem',
                          paddingTop: 'clamp(3rem, 4vw, 4rem)',
                        }}
                      >
                        <span style={{ lineHeight: '1' }}>└───&gt;</span>
                      </div>
                    )}

                    {/* Card - Outer wrapper for animation */}
                    <div
                      className={`rounded-2xl transition-all duration-500 ease-out ${
                        isTransitioning && displayIdx === 0 ? 'opacity-0 scale-95' : 'opacity-100'
                      } ${
                        isBloodied && combatant.concentration
                          ? (isCurrent ? 'player-bloodied-concentration-border-current' : isNext ? 'player-bloodied-concentration-border-next' : 'player-bloodied-concentration-border-other')
                        : isBloodied
                          ? (isCurrent ? 'player-bloodied-border-current' : isNext ? 'player-bloodied-border-next' : 'player-bloodied-border-other')
                        : ''
                      } relative`}
                      style={{
                        flex: 1,
                        transform: !isCurrent ? 'scale(0.95)' : '',
                        ...(combatant.concentration && !isBloodied && !combatant.isRoundMarker && { animation: 'concentration-pulse 2s ease-in-out infinite' })
                      }}
                    >
                      {/* Inner content div with solid background */}
                      <div
                        className={`flex items-center gap-4 md:gap-6 p-4 md:p-6 rounded-2xl ${
                          combatant.isRoundMarker ? 'bg-transparent'
                          : combatant.isDead ? 'bg-slate-800/50'
                          : 'bg-slate-700'
                        } ${
                          isCurrent ? 'shadow-2xl' : isNext ? 'shadow-xl' : ''
                        } relative overflow-hidden ${
                          combatant.isDead ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Dead Overlay with Skull */}
                        {combatant.isDead && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="text-9xl opacity-40 filter drop-shadow-lg">💀</div>
                          </div>
                        )}
                  {/* Round Marker Content */}
                  {combatant.isRoundMarker ? (
                    <div className="w-full relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-4 border-dashed border-purple-500/50"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <div className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 backdrop-blur-sm px-4 py-1 md:px-6 md:py-2 rounded-full border-4 border-purple-500/50">
                          <div className="font-bold text-purple-300 flex items-center gap-2 md:gap-3" style={{ fontSize: 'clamp(1rem, 2vw, 2.5rem)' }}>
                            <span style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)' }}>↻</span>
                            <span>ROUND {round + 1}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Left side colored bar */}
                      <div className={`absolute left-0 top-0 bottom-0 ${sideBarWidth} ${sideBarColor} transition-all duration-300`}></div>

                      {/* Position or Token Image */}
                  {showInitiativeImages ? (() => {
                    // Show token image instead of position number
                    const tokenUrlRaw = combatant.tokenUrl || combatant.meta?.tokenUrl || combatant.imageUrl || combatant.meta?.imageUrl;
                    const tokenUrl = fixTokenUrl(tokenUrlRaw);

                    // Border color based on type and current/next status
                    const tokenBorderColor = isCurrent
                      ? (isPC ? 'border-green-500' : 'border-red-500')
                      : isNext
                      ? (isPC ? 'border-green-600' : 'border-red-600')
                      : (isPC ? 'border-green-800' : 'border-red-800');

                    // Only show if validated
                    return tokenUrl && validImages.has(tokenUrl) ? (
                      <div className="flex-shrink-0">
                        <img
                          src={tokenUrl}
                          alt={combatant.name}
                          style={{ width: 'clamp(3rem, 5vw, 5rem)', height: 'clamp(3rem, 5vw, 5rem)' }}
                          className={`rounded-full object-cover shadow-xl transition-all border-4 ${tokenBorderColor}`}
                          crossOrigin="anonymous"
                        />
                      </div>
                    ) : (
                      // Fallback to position number if no token
                      <div style={{ width: 'clamp(3rem, 5vw, 5rem)', height: 'clamp(3rem, 5vw, 5rem)', fontSize: 'clamp(1.25rem, 2.5vw, 2.5rem)' }} className={`rounded-full flex items-center justify-center font-bold transition-all ${
                        isCurrent
                          ? (isPC ? 'bg-green-500 text-slate-900' : 'bg-red-500 text-white')
                          : isNext
                          ? (isPC ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                          : 'bg-slate-600 text-slate-300'
                      }`}>
                        {isCurrent ? '▶' : isNext ? '⧁' : displayIdx + 1}
                      </div>
                    );
                  })() : (
                    // Show position number when checkbox is inactive
                    <div style={{ width: 'clamp(3rem, 5vw, 5rem)', height: 'clamp(3rem, 5vw, 5rem)', fontSize: 'clamp(1.25rem, 2.5vw, 2.5rem)' }} className={`rounded-full flex items-center justify-center font-bold transition-all ${
                      isCurrent
                        ? (isPC ? 'bg-green-500 text-slate-900' : 'bg-red-500 text-white')
                        : isNext
                        ? (isPC ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                        : 'bg-slate-600 text-slate-300'
                    }`}>
                      {isCurrent ? '▶' : isNext ? '⧁' : displayIdx + 1}
                    </div>
                  )}

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 'clamp(1.25rem, 2.5vw, 3rem)' }} className={`font-semibold transition-colors truncate leading-tight ${
                      isCurrent
                        ? (isPC ? 'text-green-300' : 'text-red-300')
                        : isNext
                        ? (isPC ? 'text-green-400' : 'text-orange-400')
                        : 'text-white'
                    }`}>
                      {combatant.name}
                    </div>
                  </div>

                  {/* Conditions and Status Badges (visible to players) */}
                  <div className="flex flex-wrap gap-2">
                    {/* Conditions */}
                    {combatant.conditions && combatant.conditions.length > 0 && (
                      <>
                        {combatant.conditions.map(cond => (
                          <span
                            key={cond}
                            style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.2rem)' }}
                            className="px-3 py-1 bg-amber-500/30 text-amber-300 rounded-full font-medium border-2 border-amber-500/50"
                          >
                            {cond}
                          </span>
                        ))}
                      </>
                    )}

                    {/* Stable Badge */}
                    {combatant.isStable && (
                      <span
                        style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.2rem)' }}
                        className="px-3 py-1 bg-blue-500/30 text-blue-300 rounded-full font-medium border-2 border-blue-500/50"
                      >
                        STABLE
                      </span>
                    )}
                  </div>

                  {/* Initiative Value with Concentration Badge */}
                  <div className="flex items-center gap-3">
                    {/* Concentration indicator (visible to players) */}
                    {combatant.concentration && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/30 text-purple-300 rounded-full font-medium border-2 border-purple-500/50" style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.2rem)' }}>
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                        <span className="hidden sm:inline">Concentrating</span>
                        <span className="sm:hidden">⚡</span>
                      </div>
                    )}

                    <div className="text-center">
                      <div style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.2rem)' }} className="text-slate-400">Initiative</div>
                      <div style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)' }} className={`font-bold transition-colors ${
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
                    </>
                  )}
                      </div>
                      {/* End inner content div */}
                    </div>
                    {/* End outer animation wrapper div */}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<PlayerScreen />);
