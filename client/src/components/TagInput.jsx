import React, { useState } from 'react';

export function TagInput({ value, onChange }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const commonTags = ['Underdark', 'Forest', 'Mountain', 'Desert', 'Swamp', 'Coastal', 'Urban', 'Dungeon', 'Planar', 'Boss', 'Minion', 'Elite', 'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead', 'Tank', 'Spellcaster', 'Healer', 'DPS', 'Support'];
  const tags = value || [];
  const filtered = commonTags.filter(t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()));

  const addTag = (tag) => {
    onChange([...tags, tag]);
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag));
  };

  const tagColors = {
    // Terrain
    'Underdark': 'bg-purple-100 text-purple-800 border-purple-200',
    'Forest': 'bg-green-100 text-green-800 border-green-200',
    'Mountain': 'bg-slate-100 text-slate-800 border-slate-200',
    'Desert': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Swamp': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Coastal': 'bg-blue-100 text-blue-800 border-blue-200',
    'Urban': 'bg-gray-100 text-gray-800 border-gray-200',
    'Dungeon': 'bg-stone-100 text-stone-800 border-stone-200',
    'Planar': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    // Difficulty
    'Boss': 'bg-red-100 text-red-800 border-red-200',
    'Minion': 'bg-slate-100 text-slate-600 border-slate-200',
    'Elite': 'bg-orange-100 text-orange-800 border-orange-200',
    // Player Character Tags
    'Tank': 'bg-blue-100 text-blue-800 border-blue-200',
    'Spellcaster': 'bg-purple-100 text-purple-800 border-purple-200',
    'Healer': 'bg-green-100 text-green-800 border-green-200',
    'DPS': 'bg-red-100 text-red-800 border-red-200',
    'Support': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => {
          // Handle case where tag might be an object or string
          const tagValue = typeof tag === 'string' ? tag : (tag?.type || JSON.stringify(tag));
          return (
          <span
            key={`tag-${index}-${tagValue}`}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${
              tagColors[tagValue] || 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
            }`}
          >
            {tagValue}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Remove tag"
            >
              ×
            </button>
          </span>
          );
        })}
      </div>
      <div className="relative">
        <input
          className="input w-full"
          placeholder="Add tag (press Enter or comma to add)..."
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              addTag(input.trim());
              e.preventDefault();
            }
          }}
        />
        {showSuggestions && (filtered.length > 0 || input.trim()) && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-auto">
            {filtered.map(tag => (
              <button
                key={tag}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2 dark:text-slate-200"
                onClick={() => addTag(tag)}
              >
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                    tagColors[tag] || 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {tag}
                </span>
              </button>
            ))}
            {input.trim() && !commonTags.some(t => t.toLowerCase() === input.toLowerCase()) && (
              <button
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm border-t border-slate-200 dark:border-slate-700"
                onClick={() => addTag(input.trim())}
              >
                <span className="text-blue-600 dark:text-blue-400">+ Create "{input.trim()}"</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
