import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { useModal } from './Modal';

export default function CampaignManager({ onClose }) {
  const { alert, confirm, modal } = useModal();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editMode, setEditMode] = useState(false);

  // Data for assignment
  const [allEncounters, setAllEncounters] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [allMonsters, setAllMonsters] = useState([]);

  useEffect(() => {
    loadCampaigns();
    loadAllData();
  }, []);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const response = await apiGet('/api/campaigns');
      const data = await response.json();
      setCampaigns(data);
    } catch (err) {
      setError('Fehler beim Laden der Kampagnen: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllData() {
    try {
      const [encResponse, charResponse, monsterResponse] = await Promise.all([
        apiGet('/api/encounters'),
        apiGet('/api/characters'),
        apiGet('/api/monsters')
      ]);
      const encounters = await encResponse.json();
      const characters = await charResponse.json();
      const monsters = await monsterResponse.json();
      setAllEncounters(encounters);
      setAllCharacters(characters);
      setAllMonsters(monsters.filter(m => m.isCustom));
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    try {
      setSaving(true);
      const response = await apiPost('/api/campaigns', {
        name: name.trim(),
        description: description.trim()
      });
      const newCampaign = await response.json();
      setCampaigns([...campaigns, newCampaign]);
      resetForm();
      setError(null);
    } catch (err) {
      setError('Fehler beim Erstellen: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedCampaign || !name.trim()) return;

    try {
      setSaving(true);
      const response = await apiPut(`/api/campaigns/${selectedCampaign.id}`, {
        name: name.trim(),
        description: description.trim(),
        encounters: selectedCampaign.encounters,
        playerCharacters: selectedCampaign.playerCharacters,
        monsters: selectedCampaign.monsters
      });
      const updated = await response.json();
      setCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
      setSelectedCampaign(updated);
      setEditMode(false);
      setError(null);
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!await confirm('Kampagne wirklich löschen?')) return;

    try {
      await apiDelete(`/api/campaigns/${id}`);
      setCampaigns(campaigns.filter(c => c.id !== id));
      if (selectedCampaign?.id === id) {
        setSelectedCampaign(null);
        resetForm();
      }
      setError(null);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  function selectCampaign(campaign) {
    setSelectedCampaign(campaign);
    setName(campaign.name);
    setDescription(campaign.description);
    setEditMode(false);
  }

  function resetForm() {
    setName('');
    setDescription('');
    setEditMode(false);
    setSelectedCampaign(null);
  }

  async function toggleItem(type, itemId) {
    if (!selectedCampaign) return;

    const arrayName = type === 'encounter' ? 'encounters' :
                      type === 'character' ? 'playerCharacters' : 'monsters';
    const currentArray = selectedCampaign[arrayName] || [];
    const newArray = currentArray.includes(itemId)
      ? currentArray.filter(id => id !== itemId)
      : [...currentArray, itemId];

    try {
      const response = await apiPut(`/api/campaigns/${selectedCampaign.id}`, {
        ...selectedCampaign,
        [arrayName]: newArray
      });
      const updated = await response.json();
      setCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
      setSelectedCampaign(updated);
    } catch (err) {
      setError('Fehler beim Zuordnen: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4">
          <div className="text-center">Lade Kampagnen...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {modal}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Kampagnen-Verwaltung</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kampagnen-Liste */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold mb-3">Meine Kampagnen</h3>
            <div className="space-y-2 mb-4">
              {campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className={`p-3 rounded cursor-pointer flex justify-between items-start ${
                    selectedCampaign?.id === campaign.id
                      ? 'bg-blue-900 border border-blue-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => selectCampaign(campaign)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{campaign.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {campaign.encounters?.length || 0} Encounters, {campaign.playerCharacters?.length || 0} Chars
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(campaign.id);
                    }}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {/* Neue Kampagne erstellen */}
            <div className="bg-gray-700 p-4 rounded">
              <h4 className="font-semibold mb-2">Neue Kampagne</h4>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 mb-2"
                disabled={editMode}
              />
              <textarea
                placeholder="Beschreibung (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 mb-2 h-20"
                disabled={editMode}
              />
              <button
                onClick={handleCreate}
                disabled={saving || editMode}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded"
              >
                {saving ? 'Erstelle...' : 'Erstellen'}
              </button>
            </div>
          </div>

          {/* Kampagnen-Details */}
          <div className="lg:col-span-2">
            {selectedCampaign ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {editMode ? (
                      <div>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 mb-2 text-xl font-bold"
                        />
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 h-20"
                        />
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-xl font-bold">{selectedCampaign.name}</h3>
                        <p className="text-gray-400 mt-1">{selectedCampaign.description}</p>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 space-x-2">
                    {editMode ? (
                      <>
                        <button
                          onClick={handleUpdate}
                          disabled={saving}
                          className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                        >
                          Speichern
                        </button>
                        <button
                          onClick={() => {
                            setName(selectedCampaign.name);
                            setDescription(selectedCampaign.description);
                            setEditMode(false);
                          }}
                          className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
                        >
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditMode(true)}
                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                      >
                        Bearbeiten
                      </button>
                    )}
                  </div>
                </div>

                {/* Zuordnungen */}
                <div className="space-y-4">
                  {/* Encounters */}
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold mb-3">Encounters ({selectedCampaign.encounters?.length || 0})</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {allEncounters.map(enc => (
                        <label key={enc.id} className="flex items-center p-2 hover:bg-gray-600 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCampaign.encounters?.includes(enc.id)}
                            onChange={() => toggleItem('encounter', enc.id)}
                            className="mr-2"
                          />
                          <span>{enc.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Player Characters */}
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold mb-3">Spielercharaktere ({selectedCampaign.playerCharacters?.length || 0})</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {allCharacters.map(char => (
                        <label key={char.id} className="flex items-center p-2 hover:bg-gray-600 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCampaign.playerCharacters?.includes(char.id)}
                            onChange={() => toggleItem('character', char.id)}
                            className="mr-2"
                          />
                          <span>{char.name} ({char.class} {char.level})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Custom Monsters */}
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold mb-3">Eigene Monster ({selectedCampaign.monsters?.length || 0})</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {allMonsters.map(monster => (
                        <label key={monster.id} className="flex items-center p-2 hover:bg-gray-600 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCampaign.monsters?.includes(monster.id)}
                            onChange={() => toggleItem('monster', monster.id)}
                            className="mr-2"
                          />
                          <span>{monster.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                Wähle eine Kampagne aus oder erstelle eine neue
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
