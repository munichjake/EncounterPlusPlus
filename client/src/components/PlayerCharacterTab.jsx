import React, { useState, useEffect } from 'react';
import { TagInput } from './TagInput.jsx';
import { useToast } from './Toast.jsx';

export function PlayerCharacterTab({ apiGet, apiPost, apiDelete, onAddToEncounter, alert, confirm, campaigns = [] }) {
  const toast = useToast();
  const [subtab, setSubtab] = useState('browse');
  const [pcList, setPcList] = useState([]);
  const [pcQ, setPcQ] = useState('');
  const [addingCharacterId, setAddingCharacterId] = useState(null);
  const [pcForm, setPcForm] = useState({
    name: '',
    class: '',
    level: 1,
    race: '',
    ac: 10,
    hp: 10,
    initiativeMod: 0,
    speed: '30 ft.',
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    avatarUrl: '',
    proficiencyBonus: 2,
    tags: [],
    campaignIds: [],
    notes: ''
  });
  const [ddbCharacterId, setDdbCharacterId] = useState('');
  const [ddbCobaltToken, setDdbCobaltToken] = useState('');
  const [importing, setImporting] = useState(false);
  const [jsonText, setJsonText] = useState('[\n  {\n    "name": "Example Character",\n    "class": "Fighter 5",\n    "level": 5,\n    "race": "Human",\n    "ac": 18,\n    "hp": 45,\n    "initiativeMod": 2,\n    "speed": "30 ft.",\n    "stats": { "str": 16, "dex": 14, "con": 15, "int": 10, "wis": 12, "cha": 8 },\n    "proficiencyBonus": 3,\n    "tags": ["Tank", "Melee"]\n  }\n]');

  useEffect(() => {
    loadCharacters();
    loadUserSettings();
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [pcQ]);

  async function loadUserSettings() {
    try {
      const r = await apiGet('/api/user/settings');
      const settings = await r.json();
      if (settings.ddbCobaltToken) {
        setDdbCobaltToken(settings.ddbCobaltToken);
      }
    } catch (err) {
      console.error('Failed to load user settings:', err);
    }
  }

  async function loadCharacters() {
    try {
      const r = await apiGet(`/api/characters?search=${encodeURIComponent(pcQ)}`);
      const data = await r.json();
      setPcList(data);
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
  }

  async function saveCharacter() {
    const payload = {
      ...pcForm,
      name: pcForm.name.trim(),
      ac: Number(pcForm.ac) || 10,
      hp: Number(pcForm.hp) || 10,
      level: Number(pcForm.level) || 1,
      initiativeMod: Number(pcForm.initiativeMod) || 0,
      tags: pcForm.tags || [],
    };

    if (!payload.name) {
      toast.error('Name ist erforderlich');
      return;
    }

    try {
      const r = await apiPost('/api/characters', payload);
      if (r.ok) {
        const saved = await r.json();
        toast.success('Spielercharakter gespeichert!');
        setPcForm({
          name: '',
          class: '',
          level: 1,
          race: '',
          ac: 10,
          hp: 10,
          initiativeMod: 0,
          speed: '30 ft.',
          stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          avatarUrl: '',
          proficiencyBonus: 2,
          tags: [],
          campaignIds: [],
          notes: ''
        });
        loadCharacters();
      } else {
        toast.error('Fehler beim Speichern');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Fehler beim Speichern');
    }
  }

  async function importFromDDB() {
    if (!ddbCharacterId.trim()) {
      toast.warning('Bitte Character ID eingeben');
      return;
    }

    setImporting(true);
    try {
      const r = await apiPost('/api/characters/import/ddb', {
        characterId: ddbCharacterId.trim(),
        cobaltToken: ddbCobaltToken.trim() || undefined
      });

      const result = await r.json();

      if (r.ok) {
        toast.success(`${result.message}\n\nCharakter: ${result.character.name}`, 5000);
        setDdbCharacterId('');
        setDdbCobaltToken('');
        loadCharacters();
        setSubtab('browse');
      } else {
        toast.error(`Import fehlgeschlagen:\n${result.error}`, 5000);
      }
    } catch (err) {
      console.error('DDB import error:', err);
      toast.error('Fehler beim Import von D&D Beyond');
    } finally {
      setImporting(false);
    }
  }

  async function handleAddToEncounter(pc) {
    if (!onAddToEncounter) return;

    setAddingCharacterId(pc.id);
    try {
      await onAddToEncounter(pc);
    } finally {
      setAddingCharacterId(null);
    }
  }

  async function deleteCharacter(id) {
    if (!await confirm('Charakter wirklich löschen?')) return;
    try {
      await apiDelete(`/api/characters/${encodeURIComponent(id)}`);
      toast.success('Charakter gelöscht');
      loadCharacters();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Fehler beim Löschen');
    }
  }

  async function importFromJSON() {
    try {
      const characters = JSON.parse(jsonText);

      if (!Array.isArray(characters)) {
        toast.error('JSON muss ein Array von Charakteren sein');
        return;
      }

      let imported = 0;
      for (const char of characters) {
        try {
          const r = await apiPost('/api/characters', char);
          if (r.ok) imported++;
        } catch (err) {
          console.error('Failed to import character:', char.name, err);
        }
      }

      toast.success(`${imported} von ${characters.length} Charakteren erfolgreich importiert`, 4000);
      loadCharacters();
      setSubtab('browse');
    } catch (err) {
      console.error('JSON import error:', err);
      toast.error('Fehler beim Parsen des JSON. Bitte überprüfe das Format.');
    }
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setJsonText(content);
      }
    };
    reader.readAsText(file);
  }

  function loadCharacterToForm(pc) {
    // Ensure all fields have default values
    setPcForm({
      name: pc.name || '',
      class: pc.class || '',
      level: pc.level || 1,
      race: pc.race || '',
      ac: pc.ac || 10,
      hp: pc.hp || 10,
      initiativeMod: pc.initiativeMod || 0,
      speed: pc.speed || '30 ft.',
      stats: pc.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      avatarUrl: pc.avatarUrl || '',
      proficiencyBonus: pc.proficiencyBonus || 2,
      tags: pc.tags || [],
      campaignIds: pc.campaignIds || [],
      notes: pc.notes || '',
      id: pc.id // Preserve ID for updating
    });
    setSubtab('form');
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {['form', 'json', 'ddb', 'browse'].map(t => (
          <button
            key={t}
            className={`px-3 py-2 font-medium transition-colors ${
              subtab === t
                ? 'text-blue-700 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            onClick={() => setSubtab(t)}
          >
            {t === 'form' && '✍️ Manuell erstellen'}
            {t === 'json' && '📄 JSON Import'}
            {t === 'ddb' && '🎲 D&D Beyond Import'}
            {t === 'browse' && '👥 Meine Charaktere'}
          </button>
        ))}
      </div>

      {/* Manual Form */}
      {subtab === 'form' && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={pcForm.name}
                onChange={e => setPcForm({ ...pcForm, name: e.target.value })}
                className="input w-full"
                placeholder="z.B. Gandalf"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Klasse *</label>
              <input
                type="text"
                value={pcForm.class}
                onChange={e => setPcForm({ ...pcForm, class: e.target.value })}
                className="input w-full"
                placeholder="z.B. Wizard 10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Level</label>
              <input
                type="number"
                value={pcForm.level}
                onChange={e => setPcForm({ ...pcForm, level: e.target.value })}
                className="input w-full"
                min="1"
                max="20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rasse</label>
              <input
                type="text"
                value={pcForm.race}
                onChange={e => setPcForm({ ...pcForm, race: e.target.value })}
                className="input w-full"
                placeholder="z.B. Human"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">AC (Rüstungsklasse)</label>
              <input
                type="number"
                value={pcForm.ac}
                onChange={e => setPcForm({ ...pcForm, ac: e.target.value })}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">HP (Trefferpunkte)</label>
              <input
                type="number"
                value={pcForm.hp}
                onChange={e => setPcForm({ ...pcForm, hp: e.target.value })}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Initiative Modifier</label>
              <input
                type="number"
                value={pcForm.initiativeMod}
                onChange={e => setPcForm({ ...pcForm, initiativeMod: e.target.value })}
                className="input w-full"
                placeholder="z.B. +3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Geschwindigkeit</label>
              <input
                type="text"
                value={pcForm.speed}
                onChange={e => setPcForm({ ...pcForm, speed: e.target.value })}
                className="input w-full"
                placeholder="z.B. 30 ft."
              />
            </div>
          </div>

          {/* Ability Scores */}
          <div>
            <label className="block text-sm font-medium mb-2">Attributswerte</label>
            <div className="grid grid-cols-6 gap-2">
              {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(stat => (
                <div key={stat}>
                  <label className="block text-xs font-medium mb-1 uppercase text-center">{stat}</label>
                  <input
                    type="number"
                    value={pcForm.stats?.[stat] || 10}
                    onChange={e => setPcForm({
                      ...pcForm,
                      stats: { ...pcForm.stats, [stat]: Number(e.target.value) || 10 }
                    })}
                    className="input w-full text-center"
                    min="1"
                    max="30"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Avatar URL</label>
              <input
                type="text"
                value={pcForm.avatarUrl || ''}
                onChange={e => setPcForm({ ...pcForm, avatarUrl: e.target.value })}
                className="input w-full"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Proficiency Bonus</label>
              <input
                type="number"
                value={pcForm.proficiencyBonus || 2}
                onChange={e => setPcForm({ ...pcForm, proficiencyBonus: Number(e.target.value) || 2 })}
                className="input w-full"
                min="2"
                max="6"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <TagInput
              value={pcForm.tags || []}
              onChange={tags => setPcForm({ ...pcForm, tags })}
            />
          </div>

          {/* Campaigns */}
          <div>
            <label className="block text-sm font-medium mb-1">Kampagnen</label>
            <div className="space-y-2">
              {campaigns.length === 0 ? (
                <p className="text-sm text-gray-500">Keine Kampagnen verfügbar</p>
              ) : (
                campaigns.map(campaign => (
                  <label key={campaign.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(pcForm.campaignIds || []).includes(campaign.id)}
                      onChange={e => {
                        const campaignIds = pcForm.campaignIds || [];
                        if (e.target.checked) {
                          setPcForm({ ...pcForm, campaignIds: [...campaignIds, campaign.id] });
                        } else {
                          setPcForm({ ...pcForm, campaignIds: campaignIds.filter(id => id !== campaign.id) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{campaign.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notizen</label>
            <textarea
              value={pcForm.notes || ''}
              onChange={e => setPcForm({ ...pcForm, notes: e.target.value })}
              className="input w-full"
              rows="3"
              placeholder="Hintergrundgeschichte, besondere Fähigkeiten, etc."
            />
          </div>

          <div className="flex gap-2">
            <button onClick={saveCharacter} className="btn-primary">
              💾 Speichern
            </button>
            <button
              onClick={() => {
                setPcForm({
                  name: '',
                  class: '',
                  level: 1,
                  race: '',
                  ac: 10,
                  hp: 10,
                  initiativeMod: 0,
                  speed: '30 ft.',
                  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                  avatarUrl: '',
                  proficiencyBonus: 2,
                  tags: [],
                  notes: ''
                });
              }}
              className="btn-secondary"
            >
              🔄 Zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* D&D Beyond Import */}
      {subtab === 'ddb' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              📘 D&D Beyond Character Import
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
              Importiere Charaktere direkt von D&D Beyond. Für private Charaktere benötigst du deinen Cobalt Session Token.
            </p>
            <details className="text-sm text-blue-800 dark:text-blue-400">
              <summary className="cursor-pointer font-medium mb-2">🔍 Wie finde ich meine Character ID und Cobalt Token?</summary>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                <li>Öffne deinen Charakter auf dndbeyond.com</li>
                <li>Die Character ID steht in der URL: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">dndbeyond.com/characters/[ID]</code></li>
                <li>Für private Charaktere: Öffne die Browser-Entwicklertools (F12)</li>
                <li>Gehe zu Application → Cookies → dndbeyond.com</li>
                <li>Kopiere den Wert von "CobaltSession"</li>
              </ol>
            </details>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Character ID oder URL *</label>
            <input
              type="text"
              value={ddbCharacterId}
              onChange={e => setDdbCharacterId(e.target.value)}
              className="input w-full"
              placeholder="z.B. 123456789 oder https://www.dndbeyond.com/characters/123456789"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Du kannst die komplette URL oder nur die Character ID eingeben
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Cobalt Session Token
              <span className="text-xs text-slate-500 ml-2">(Optional, nur für private Charaktere)</span>
            </label>
            <input
              type="password"
              value={ddbCobaltToken}
              onChange={e => setDdbCobaltToken(e.target.value)}
              className="input w-full"
              placeholder="Wird automatisch gespeichert nach dem ersten Import"
            />
            {ddbCobaltToken && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Token gespeichert - wird automatisch für zukünftige Imports verwendet
              </p>
            )}
          </div>

          <button
            onClick={importFromDDB}
            disabled={importing}
            className="btn-primary w-full"
          >
            {importing ? '⏳ Importiere...' : '📥 Von D&D Beyond importieren'}
          </button>
        </div>
      )}

      {/* JSON Import */}
      {subtab === 'json' && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              📄 JSON Import
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-400 mb-2">
              Importiere mehrere Charaktere auf einmal im JSON-Format. Du kannst entweder eine Datei hochladen oder JSON direkt einfügen.
            </p>
            <details className="text-sm text-blue-800 dark:text-blue-400">
              <summary className="cursor-pointer font-medium mb-2">📝 JSON Format Beispiel</summary>
              <pre className="bg-blue-100 dark:bg-blue-800 p-2 rounded mt-2 overflow-x-auto text-xs">
{`[
  {
    "name": "Gandalf",
    "class": "Wizard 20",
    "level": 20,
    "race": "Maia",
    "ac": 15,
    "hp": 120,
    "initiativeMod": 2,
    "speed": "30 ft.",
    "stats": {
      "str": 10,
      "dex": 14,
      "con": 16,
      "int": 20,
      "wis": 18,
      "cha": 16
    },
    "proficiencyBonus": 6,
    "tags": ["Spellcaster", "Support"],
    "notes": "Istar sent to Middle-earth"
  }
]`}
              </pre>
            </details>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">📁 Datei hochladen</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500 dark:text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300
                dark:hover:file:bg-blue-800"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Wähle eine JSON-Datei aus - der Inhalt wird automatisch ins Textfeld geladen
            </p>
          </div>

          {/* JSON Textarea */}
          <div>
            <label className="block text-sm font-medium mb-2">📝 JSON Code</label>
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              className="input w-full font-mono text-sm"
              rows={15}
              placeholder="Füge hier JSON ein oder lade eine Datei hoch..."
            />
          </div>

          <button
            onClick={importFromJSON}
            className="btn-primary w-full"
          >
            📥 Charaktere importieren
          </button>
        </div>
      )}

      {/* Browse Characters */}
      {subtab === 'browse' && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              value={pcQ}
              onChange={e => setPcQ(e.target.value)}
              className="input w-full"
              placeholder="🔍 Suche Charaktere..."
            />
          </div>

          {pcList.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              Noch keine Spielercharaktere erstellt. Erstelle einen neuen oder importiere von D&D Beyond!
            </p>
          ) : (
            <div className="grid gap-3">
              {pcList.map(pc => (
                <div
                  key={pc.id}
                  className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {pc.avatarUrl && (
                          <img src={pc.avatarUrl} alt={pc.name} className="w-10 h-10 rounded-full" />
                        )}
                        <div>
                          <h4 className="font-semibold text-lg">{pc.name}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {pc.race && `${pc.race} `}
                            {pc.class || `Level ${pc.level}`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-4 text-sm">
                        <span>AC {pc.ac}</span>
                        <span>HP {pc.hp}</span>
                        <span>Initiative {pc.initiativeMod >= 0 ? '+' : ''}{pc.initiativeMod}</span>
                        <span>{pc.speed}</span>
                      </div>
                      {pc.source && (
                        <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {pc.source}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {onAddToEncounter && (
                        <button
                          onClick={() => handleAddToEncounter(pc)}
                          disabled={addingCharacterId === pc.id}
                          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Zum Encounter hinzufügen"
                        >
                          {addingCharacterId === pc.id ? (
                            <span className="inline-block animate-spin">⏳</span>
                          ) : (
                            '➕'
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => loadCharacterToForm(pc)}
                        className="btn-secondary text-sm"
                        title="Bearbeiten"
                      >
                        ✏️
                        </button>
                      <button
                        onClick={() => deleteCharacter(pc.id)}
                        className="btn-secondary text-sm hover:bg-red-100 dark:hover:bg-red-900"
                        title="Löschen"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast Container */}
      <toast.ToastContainer />
    </div>
  );
}
