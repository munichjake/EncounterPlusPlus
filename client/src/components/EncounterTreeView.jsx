import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { useModal } from './Modal';

/**
 * Hierarchical tree view component for encounters organized in folders
 * Supports:
 * - Nested folder structure
 * - Drag & drop to move encounters between folders
 * - Folder creation, renaming, deletion
 * - Campaign filtering
 */
export default function EncounterTreeView({
  encounters,
  loading,
  currentId,
  onSelectEncounter,
  onDeleteEncounter,
  onCreateEncounter,
  campaigns,
  onRefreshEncounters,
  onMoveEncounter
}) {
  const { alert, confirm, modal } = useModal();
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [creatingFolderParentId, setCreatingFolderParentId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null); // { type: 'folder'|'encounter'|'root', id: string, position: 'before'|'after'|'inside' }
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFolders();
  }, []);

  async function loadFolders() {
    try {
      const response = await apiGet('/api/folders');
      const data = await response.json();
      setFolders(data);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }

  async function createFolder(parentId = null) {
    if (!newFolderName.trim()) return;

    // Optimistic update: Generate temporary ID and add folder immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticFolder = {
      id: tempId,
      name: newFolderName.trim(),
      parentId,
      path: parentId ? `${folders.find(f => f.id === parentId)?.path}/${newFolderName.trim()}` : newFolderName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setFolders([...folders, optimisticFolder]);
    setNewFolderName('');
    setCreatingFolderParentId(null);

    // Auto-expand parent folder
    if (parentId) {
      setExpandedFolders(new Set([...expandedFolders, parentId]));
    }

    // Background API call
    try {
      const response = await apiPost('/api/folders', {
        name: optimisticFolder.name,
        parentId
      });
      const newFolder = await response.json();

      // Replace temporary folder with real one
      setFolders(prev => prev.map(f => f.id === tempId ? newFolder : f));
    } catch (err) {
      console.error('Failed to create folder:', err);
      // Rollback: Remove optimistic folder
      setFolders(prev => prev.filter(f => f.id !== tempId));
      await alert('Fehler beim Erstellen des Ordners');
    }
  }

  async function renameFolder(folderId) {
    if (!editingFolderName.trim()) return;

    // Save original for rollback
    const originalFolder = folders.find(f => f.id === folderId);
    if (!originalFolder) return;

    // Optimistic update: Update folder name immediately
    const newName = editingFolderName.trim();
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return { ...f, name: newName, updatedAt: new Date().toISOString() };
      }
      return f;
    }));
    setEditingFolderId(null);
    setEditingFolderName('');

    // Background API call
    try {
      const response = await apiPut(`/api/folders/${folderId}`, {
        name: newName
      });
      const updated = await response.json();
      setFolders(prev => prev.map(f => f.id === folderId ? updated : f));

      // Refresh encounters to update their folder paths
      if (onRefreshEncounters) {
        onRefreshEncounters();
      }
    } catch (err) {
      console.error('Failed to rename folder:', err);
      // Rollback: Restore original folder
      setFolders(prev => prev.map(f => f.id === folderId ? originalFolder : f));
      await alert('Fehler beim Umbenennen des Ordners');
    }
  }

  async function deleteFolder(folderId) {
    if (!await confirm('Ordner wirklich löschen? Er muss leer sein.')) return;

    try {
      await apiDelete(`/api/folders/${folderId}`);
      setFolders(folders.filter(f => f.id !== folderId));
    } catch (err) {
      console.error('Failed to delete folder:', err);
      const errorMsg = err.message || 'Fehler beim Löschen des Ordners';
      await alert(errorMsg);
    }
  }

  async function moveEncounterToFolder(encounterId, folderPath) {
    // Optimistic update: Update UI immediately via callback
    if (onMoveEncounter) {
      onMoveEncounter(encounterId, folderPath);
    }

    // Background API call
    try {
      // Load full encounter data
      const response = await apiGet(`/api/encounters/${encounterId}`);
      const encounter = await response.json();

      // Update folder
      await apiPut(`/api/encounters/${encounterId}`, {
        ...encounter,
        folder: folderPath
      });

      // No need to refresh - optimistic update already applied
    } catch (err) {
      console.error('Failed to move encounter:', err);
      // Rollback: Refresh to restore original state from server
      if (onRefreshEncounters) {
        onRefreshEncounters();
      }
      await alert('Fehler beim Verschieben des Encounters');
    }
  }

  function toggleFolder(folderId) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  }

  function startEditingFolder(folder) {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  }

  function startCreatingFolder(parentId = null) {
    setCreatingFolderParentId(parentId);
    setNewFolderName('');
  }

  // Build tree structure
  function buildTree() {
    const tree = [];
    const folderMap = new Map();

    // Filter encounters by campaign and search
    let filteredEncounters = encounters;
    if (selectedCampaignFilter !== 'all') {
      filteredEncounters = filteredEncounters.filter(e => e.campaignId === selectedCampaignFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filteredEncounters = filteredEncounters.filter(e =>
        e.name.toLowerCase().includes(term)
      );
    }

    // Create folder nodes
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: [],
        encounters: []
      });
    });

    // Build parent-child relationships
    folders.forEach(folder => {
      const node = folderMap.get(folder.id);
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId).children.push(node);
      } else {
        tree.push(node);
      }
    });

    // Add encounters to folders
    filteredEncounters.forEach(encounter => {
      if (encounter.folder) {
        const folder = folders.find(f => f.path === encounter.folder);
        if (folder && folderMap.has(folder.id)) {
          folderMap.get(folder.id).encounters.push(encounter);
        }
      }
    });

    // Add root-level encounters (no folder)
    const rootEncounters = filteredEncounters.filter(e => !e.folder);

    return { tree, rootEncounters };
  }

  // Drag and drop handlers
  function handleDragStart(e, item, type) {
    setDraggedItem({ ...item, type }); // type: 'encounter' or 'folder'
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, folderId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  }

  function handleDragLeave(e) {
    setDragOverFolder(null);
  }

  function handleDrop(e, targetFolderId) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    setDropIndicator(null);

    if (!draggedItem) return;

    const targetFolder = folders.find(f => f.id === targetFolderId);
    const targetPath = targetFolder ? targetFolder.path : null;

    if (draggedItem.type === 'encounter') {
      moveEncounterToFolder(draggedItem.id, targetPath);
    }
    // TODO: Implement folder moving if needed

    setDraggedItem(null);
  }

  function handleDropToRoot(e) {
    e.preventDefault();
    setDragOverFolder(null);
    setDropIndicator(null);

    if (!draggedItem || draggedItem.type !== 'encounter') return;

    moveEncounterToFolder(draggedItem.id, null);
    setDraggedItem(null);
  }

  // Render folder node recursively
  function renderFolderNode(node, depth = 0) {
    const isExpanded = expandedFolders.has(node.id);
    const isEditing = editingFolderId === node.id;
    const isCreating = creatingFolderParentId === node.id;
    const isDragOver = dragOverFolder === node.id;
    const showDropIndicator = dropIndicator?.type === 'folder' && dropIndicator?.id === node.id;

    return (
      <div key={node.id} className="select-none relative">
        {/* Drop indicator - Windows-style horizontal line with end caps */}
        {showDropIndicator && (
          <div className="absolute left-0 right-0 top-0 flex items-center pointer-events-none z-10">
            <div className="flex-1 flex items-center" style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
              <div className="w-2 h-0.5 bg-blue-500"></div>
              <div className="flex-1 h-0.5 bg-blue-500"></div>
              <div className="w-2 h-0.5 bg-blue-500"></div>
            </div>
          </div>
        )}
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 cursor-pointer ${
            isDragOver ? 'bg-blue-900/20' : ''
          }`}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragOver(e, node.id);
            setDropIndicator({ type: 'folder', id: node.id });
          }}
          onDragLeave={() => {
            handleDragLeave();
            setDropIndicator(null);
          }}
          onDrop={(e) => handleDrop(e, node.id)}
        >
          <button
            onClick={() => toggleFolder(node.id)}
            className="text-gray-400 hover:text-white w-4 h-4 flex items-center justify-center"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          {isEditing ? (
            <input
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameFolder(node.id);
                if (e.key === 'Escape') setEditingFolderId(null);
              }}
              onBlur={() => renameFolder(node.id)}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
              autoFocus
            />
          ) : (
            <>
              <span className="text-yellow-500">📁</span>
              <span className="flex-1 text-sm">{node.name}</span>
              <button
                onClick={() => startCreatingFolder(node.id)}
                className="text-xs text-green-400 hover:text-green-300 px-1"
                title="Unterordner erstellen"
              >
                +📁
              </button>
              <button
                onClick={() => startEditingFolder(node)}
                className="text-xs text-blue-400 hover:text-blue-300 px-1"
                title="Umbenennen"
              >
                ✏️
              </button>
              <button
                onClick={() => deleteFolder(node.id)}
                className="text-xs text-red-400 hover:text-red-300 px-1"
                title="Löschen"
              >
                🗑️
              </button>
            </>
          )}
        </div>

        {isExpanded && (
          <div>
            {isCreating && (
              <div className="flex items-center gap-2 px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 1.5 + 0.5}rem` }}>
                <span className="text-yellow-500">📁</span>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createFolder(node.id);
                    if (e.key === 'Escape') setCreatingFolderParentId(null);
                  }}
                  placeholder="Ordnername..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button
                  onClick={() => createFolder(node.id)}
                  className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
                >
                  ✓
                </button>
                <button
                  onClick={() => setCreatingFolderParentId(null)}
                  className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded"
                >
                  ✗
                </button>
              </div>
            )}

            {node.children.map(child => renderFolderNode(child, depth + 1))}

            {node.encounters.map(enc => renderEncounterNode(enc, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  // Render encounter node
  function renderEncounterNode(encounter, depth = 0) {
    const isSelected = encounter.id === currentId;
    const campaign = campaigns.find(c => c.id === encounter.campaignId);
    const showDropIndicator = dropIndicator?.type === 'encounter' && dropIndicator?.id === encounter.id;

    return (
      <div key={encounter.id} className="relative">
        {/* Drop indicator before encounter */}
        {showDropIndicator && (
          <div className="absolute left-0 right-0 top-0 flex items-center pointer-events-none z-10">
            <div className="flex-1 flex items-center" style={{ paddingLeft: `${depth * 1.5 + 1.5}rem` }}>
              <div className="w-2 h-0.5 bg-blue-500"></div>
              <div className="flex-1 h-0.5 bg-blue-500"></div>
              <div className="w-2 h-0.5 bg-blue-500"></div>
            </div>
          </div>
        )}
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, encounter, 'encounter')}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropIndicator({ type: 'encounter', id: encounter.id });
          }}
          onDragLeave={() => setDropIndicator(null)}
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
            isSelected ? 'bg-blue-900 border border-blue-500' : 'hover:bg-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 1.5 + 1.5}rem` }}
          onClick={() => onSelectEncounter(encounter.id)}
        >
        <span className="text-gray-400">📄</span>
        <span className="flex-1 text-sm">{encounter.name}</span>
        {campaign && (
          <span className="text-xs text-purple-400 px-1 py-0.5 bg-purple-900/30 rounded">
            {campaign.name}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteEncounter(encounter.id);
          }}
          className="text-xs text-red-400 hover:text-red-300"
          title="Löschen"
        >
          🗑️
        </button>
        </div>
      </div>
    );
  }

  const { tree, rootEncounters } = buildTree();

  return (
    <>
      {modal}
      <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-3 bg-gray-800 border-b border-gray-700 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Encounter suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={onCreateEncounter}
            className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-sm font-medium"
          >
            + Neu
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCampaignFilter}
            onChange={(e) => setSelectedCampaignFilter(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm"
          >
            <option value="all">Alle Kampagnen</option>
            <option value="">Keine Kampagne</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => startCreatingFolder(null)}
            className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 rounded text-sm font-medium"
            title="Ordner erstellen"
          >
            📁+
          </button>
        </div>
      </div>

      {/* Tree View */}
      <div
        className="flex-1 overflow-y-auto p-2 relative"
        onDragOver={(e) => {
          e.preventDefault();
          setDropIndicator({ type: 'root' });
        }}
        onDragLeave={() => setDropIndicator(null)}
        onDrop={handleDropToRoot}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin text-4xl mb-2">⏳</div>
              <p className="text-gray-400 text-sm">Lade Encounters...</p>
            </div>
          </div>
        ) : (
          <>
        {/* Root drop indicator */}
        {dropIndicator?.type === 'root' && (
          <div className="absolute left-0 right-0 top-2 flex items-center pointer-events-none z-10 px-2">
            <div className="w-2 h-0.5 bg-blue-500"></div>
            <div className="flex-1 h-0.5 bg-blue-500"></div>
            <div className="w-2 h-0.5 bg-blue-500"></div>
          </div>
        )}
        {/* Creating root folder */}
        {creatingFolderParentId === null && (
          <div className="flex items-center gap-2 px-2 py-1 mb-2">
            <span className="text-yellow-500">📁</span>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder(null);
                if (e.key === 'Escape') setCreatingFolderParentId(null);
              }}
              placeholder="Ordnername..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
              autoFocus
            />
            <button
              onClick={() => createFolder(null)}
              className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
            >
              ✓
            </button>
            <button
              onClick={() => setCreatingFolderParentId(null)}
              className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded"
            >
              ✗
            </button>
          </div>
        )}

        {/* Folder tree */}
        {tree.map(node => renderFolderNode(node))}

        {/* Root encounters */}
        {rootEncounters.length > 0 && (
          <div className="mt-2">
            {rootEncounters.map(enc => renderEncounterNode(enc, 0))}
          </div>
        )}

        {tree.length === 0 && rootEncounters.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            {searchTerm || selectedCampaignFilter !== 'all'
              ? 'Keine Encounters gefunden'
              : 'Noch keine Encounters erstellt'}
          </div>
        )}
        </>
        )}
      </div>
    </div>
    </>
  );
}
