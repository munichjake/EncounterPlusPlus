import { useState, useEffect } from "react";
import { apiGet, apiPut } from "../utils/api.js";

export function useEncounter(id, onEncounterUpdate) {
  const [enc, setEnc] = useState(null);

  useEffect(() => {
    if (!id) return;

    // Skip API call for temporary IDs (optimistic creation)
    if (typeof id === 'string' && id.startsWith('temp_')) {
      // Create empty encounter structure for temporary ID
      setEnc({
        id: id,
        name: 'Encounter',
        combatants: {},
        initiativeOrder: [],
        round: 1,
        turnIndex: 0
      });
      return;
    }

    apiGet(`/api/encounters/${id}`)
      .then((r) => r.json())
      .then((data) => {
        // Normalize combatants to fix any object fields that should be primitives
        if (data && data.combatants) {
          const normalizedCombatants = {};
          Object.entries(data.combatants).forEach(([key, c]) => {
            normalizedCombatants[key] = {
              ...c,
              // Ensure hp and baseHP are numbers, not objects
              hp:
                typeof c.hp === "object"
                  ? c.hp?.average || c.hp?.formula || 0
                  : c.hp || 0,
              baseHP:
                typeof c.baseHP === "object"
                  ? c.baseHP?.average || c.baseHP?.formula || 0
                  : c.baseHP || 0,
              // Ensure ac is a number
              ac: typeof c.ac === "object" ? c.ac?.value || 10 : c.ac || 10,
              // Ensure senses is a string, not an object
              senses:
                typeof c.senses === "object" && c.senses !== null
                  ? Object.entries(c.senses)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(", ")
                  : c.senses,
            };
          });
          data.combatants = normalizedCombatants;
        }
        setEnc(data);
      })
      .catch((err) => {
        console.error('Failed to load encounter:', err);
        // Create empty encounter on error
        setEnc({
          id: id,
          name: 'Encounter',
          combatants: {},
          initiativeOrder: [],
          round: 1,
          turnIndex: 0
        });
      });
  }, [id]);

  const save = async (next) => {
    // Optimistic update: Update UI immediately
    const previous = enc;
    setEnc(next);

    // Update encounters list immediately (optimistic)
    if (onEncounterUpdate && next.id && next.name) {
      onEncounterUpdate(next.id, next.name);
    }

    // Background API call
    try {
      await apiPut(`/api/encounters/${id}`, next);
    } catch (err) {
      console.error('Failed to save encounter:', err);
      // Rollback on error
      setEnc(previous);
      if (onEncounterUpdate && previous.id && previous.name) {
        onEncounterUpdate(previous.id, previous.name);
      }
    }
  };

  return { enc, setEnc, save };
}
