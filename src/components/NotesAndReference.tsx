import React, { useState, useEffect, useRef } from 'react';
import { SessionNote, NoteCategory } from '../types/ttrpg';
import {
  BookOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Heart,
  Activity,
  Skull,
  Dices,
  Check,
  Pin,
  Copy,
  Edit2,
  X,
  FileText,
} from 'lucide-react';

const NOTE_CATEGORIES: { id: NoteCategory; label: string; badgeLabel: string; badgeClass: string }[] = [
  { id: 'general', label: 'General', badgeLabel: 'General', badgeClass: 'bg-slate-800 text-slate-200 border-slate-700' },
  { id: 'clue', label: 'Secret / Clue', badgeLabel: 'Clue', badgeClass: 'bg-purple-950 text-purple-300 border-purple-700/80' },
  { id: 'npc', label: 'NPC', badgeLabel: 'NPC', badgeClass: 'bg-cyan-950 text-cyan-300 border-cyan-700/80' },
  { id: 'quest', label: 'Quest', badgeLabel: 'Quest', badgeClass: 'bg-amber-950 text-amber-300 border-amber-700/80' },
  { id: 'loot', label: 'Loot', badgeLabel: 'Loot', badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-700/80' },
  { id: 'tactic', label: 'Combat / Tactic', badgeLabel: 'Tactic', badgeClass: 'bg-rose-950 text-rose-300 border-rose-700/80' },
  { id: 'lore', label: 'World Lore', badgeLabel: 'Lore', badgeClass: 'bg-blue-950 text-blue-300 border-blue-700/80' },
];

const INITIAL_NOTES: SessionNote[] = [
  {
    id: 'note-1',
    title: 'Cultist Midnight Meeting Clue',
    category: 'clue',
    content: 'Strange purple ichor near the cellar stairs. The castle crypt keeper has been missing for 3 days. Rumor of a meeting at midnight in the forest grove.',
    isPinned: true,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'note-2',
    title: 'Party Loot & Magic Items',
    category: 'loot',
    content: 'Party Currency: 240 Units, 3 Cubes (75 Units), 1 Bar (100 Units). 3x Potions of Healing (Bonus Action roll, Action max heal). +1 Longsword attuned to Valerius.',
    isPinned: true,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
  {
    id: 'note-3',
    title: 'Sister Theresa (Morning Dawn)',
    category: 'npc',
    content: 'Priestess in Caladria who can conduct the Resurrection Ritual (base DC 8 + prior deaths). Requires pure unit alloy contribution.',
    isPinned: false,
    createdAt: Date.now() - 10800000,
    updatedAt: Date.now() - 10800000,
  },
  {
    id: 'note-4',
    title: 'General Supplies',
    category: 'general',
    content: 'Stocked 50ft hempen rope, 4 torches, 2 flasks of oil, and 5 rations per party member before descending.',
    isPinned: false,
    createdAt: Date.now() - 14400000,
    updatedAt: Date.now() - 14400000,
  },
];

export const NotesAndReference: React.FC = () => {
  const [notes, setNotes] = useState<SessionNote[]>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_session_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_NOTES;
  });

  const [activeTab, setActiveTab] = useState<'homebrew' | 'scratchpad'>('scratchpad');
  const [importNotification, setImportNotification] = useState<string>('');

  // Jot Quick Note Form State
  const [newNoteCategory, setNewNoteCategory] = useState<NoteCategory>('clue');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Editing Note State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editCategory, setEditCategory] = useState<NoteCategory>('general');

  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ttrpg_session_notes', JSON.stringify(notes));
    } catch {}
  }, [notes]);

  const showNotice = (msg: string) => {
    setImportNotification(msg);
    setTimeout(() => setImportNotification(''), 4000);
  };

  // Add new quick note
  const handleSaveQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    const newNote: SessionNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: newNoteContent.trim().slice(0, 35) + (newNoteContent.length > 35 ? '...' : ''),
      content: newNoteContent.trim(),
      category: newNoteCategory,
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setNotes((prev) => [newNote, ...prev]);
    setNewNoteContent('');
    showNotice('Note saved to scratchpad!');
  };

  // Toggle pin
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n))
    );
  };

  // Delete note
  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Start edit
  const handleStartEdit = (note: SessionNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditCategory(note.category);
  };

  // Save edit
  const handleSaveEdit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              content: editContent.trim(),
              category: editCategory,
              title: editContent.trim().slice(0, 35) + (editContent.length > 35 ? '...' : ''),
              updatedAt: Date.now(),
            }
          : n
      )
    );
    setEditingNoteId(null);
    showNotice('Note updated!');
  };

  // Copy all notes as Markdown
  const handleCopyAllAsMarkdown = () => {
    const visibleNotes = getFilteredNotes();
    if (visibleNotes.length === 0) {
      showNotice('No notes to copy.');
      return;
    }

    const md = visibleNotes
      .map((n) => {
        const catObj = NOTE_CATEGORIES.find((c) => c.id === n.category);
        const time = new Date(n.createdAt || n.updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `### [${catObj?.badgeLabel || n.category.toUpperCase()}] (${time})\n${n.content}\n`;
      })
      .join('\n---\n\n');

    navigator.clipboard?.writeText(md);
    showNotice('Copied all visible notes to clipboard as Markdown!');
  };

  // Filter & sort notes (pinned first, then chronological)
  const getFilteredNotes = () => {
    return notes
      .filter((n) => filterCategory === 'all' || n.category === filterCategory)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || b.updatedAt) - (a.createdAt || a.updatedAt);
      });
  };

  // Export Data JSON
  const handleExportData = () => {
    let mapPins: any = {};
    let uploadedMaps: any = [];
    let customMacros: any = [];
    try {
      const savedMaps = localStorage.getItem('ttrpg_uploaded_campaign_maps');
      if (savedMaps) uploadedMaps = JSON.parse(savedMaps);
      const savedMacros = localStorage.getItem('ttrpg_custom_macros');
      if (savedMacros) customMacros = JSON.parse(savedMacros);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ttrpg_map_pins_')) {
          mapPins[key] = JSON.parse(localStorage.getItem(key) || '[]');
        }
      }
    } catch {}

    const backupPayload = {
      app: 'Grimoire & Grid',
      exportDate: new Date().toISOString(),
      notes,
      uploadedMaps,
      mapPins,
      customMacros,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grimoire-grid-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Notes and session backup exported successfully!');
  };

  // Import Data JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let noteCount = 0;
        if (Array.isArray(parsed.notes)) {
          setNotes(parsed.notes);
          localStorage.setItem('ttrpg_session_notes', JSON.stringify(parsed.notes));
          noteCount = parsed.notes.length;
        }

        if (parsed.mapPins && typeof parsed.mapPins === 'object') {
          Object.entries(parsed.mapPins).forEach(([key, val]) => {
            localStorage.setItem(key, JSON.stringify(val));
          });
        }

        if (Array.isArray(parsed.customMacros)) {
          localStorage.setItem('ttrpg_custom_macros', JSON.stringify(parsed.customMacros));
        }

        showNotice(`Imported ${noteCount} notes and campaign data successfully!`);
      } catch (err) {
        showNotice('Error: Invalid JSON backup file format.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const filteredNotes = getFilteredNotes();

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base font-bold text-slate-100 font-display">
              Compendium &amp; Session Notes
            </h2>
            <p className="text-xs text-slate-400">
              Homebrew rules compendium and persistent campaign scratchpad with quick notes and pinning.
            </p>
          </div>
        </div>

        {/* Tab Switcher & Export/Import */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('scratchpad')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'scratchpad' ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Notes Scratchpad ({notes.length})
            </button>
            <button
              onClick={() => setActiveTab('homebrew')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'homebrew' ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Homebrew Rules Compendium
            </button>
          </div>

          <button
            onClick={handleExportData}
            title="Export all notes and pins as JSON backup"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Notes</span>
          </button>

          <button
            onClick={() => importFileInputRef.current?.click()}
            title="Import notes backup JSON file"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import Notes</span>
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Notification Toast */}
      {importNotification && (
        <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importNotification}</span>
        </div>
      )}

      {/* VIEW 1: IMPROVED NOTES SCRATCHPAD (MATCHING USER SCREENSHOT SPEC) */}
      {activeTab === 'scratchpad' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: JOT QUICK NOTE FORM & CATEGORY FILTERS */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-lg">
            <h3 className="text-base font-bold text-slate-100 font-display tracking-wider">
              JOT QUICK NOTE
            </h3>

            <form onSubmit={handleSaveQuickNote} className="space-y-4">
              {/* Category Dropdown */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Category
                </label>
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value as NoteCategory)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
                >
                  {NOTE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note Content Textarea */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Note Content
                </label>
                <textarea
                  rows={5}
                  placeholder="Jot initiative order, tavern name, riddle clues..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs leading-relaxed rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 resize-none font-sans"
                  required
                />
              </div>

              {/* Save Note Action Button */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold text-xs text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>+ Save Note</span>
              </button>
            </form>

            {/* Filter Notes Section (As in Screenshot) */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <span className="text-xs font-semibold text-slate-400 block">
                Filter Notes
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`text-[11px] px-3 py-1 rounded-lg border font-medium transition cursor-pointer ${
                    filterCategory === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  All
                </button>
                {NOTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilterCategory(cat.id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer ${
                      filterCategory === cat.id
                        ? 'bg-slate-800 text-amber-300 border-amber-400/80 font-bold shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {cat.badgeLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: PINNED & SAVED NOTES (SIDE DISPLAY AS IN SCREENSHOT) */}
          <div className="lg:col-span-8 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg min-h-[460px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-display">
                  PINNED &amp; SAVED NOTES
                </h3>
                <span className="text-xs text-slate-500">({filteredNotes.length})</span>
              </div>

              {/* Copy All as Markdown Action (As in Screenshot) */}
              <button
                type="button"
                onClick={handleCopyAllAsMarkdown}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All as Markdown</span>
              </button>
            </div>

            {/* Note Cards Grid (Display notes on the side as in screenshot) */}
            {filteredNotes.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <FileText className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                <p className="text-sm font-medium text-slate-400">No notes found in this category.</p>
                <p className="text-xs text-slate-500">
                  Use the "Jot Quick Note" panel on the left to write session clues, loot, NPCs, and tactics.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredNotes.map((note) => {
                  const catCfg = NOTE_CATEGORIES.find((c) => c.id === note.category) || NOTE_CATEGORIES[0];
                  const timeStr = new Date(note.createdAt || note.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isEditing = editingNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        note.isPinned
                          ? 'bg-slate-950/90 border-amber-500/60 shadow-md ring-1 ring-amber-500/20'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isEditing ? (
                        /* Inline Edit Form */
                        <form onSubmit={(e) => handleSaveEdit(note.id, e)} className="space-y-2">
                          <div className="flex items-center justify-between pb-1">
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value as NoteCategory)}
                              className="px-2 py-0.5 text-[11px] rounded bg-slate-900 border border-slate-700 text-amber-300"
                            >
                              {NOTE_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="text-slate-400 hover:text-slate-200 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                          <textarea
                            rows={3}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-0.5 text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      ) : (
                        /* Standard Note Card Display (As in screenshot) */
                        <>
                          <div>
                            {/* Card Top Row: Category Badge, Timestamp, Pin Icon & Close */}
                            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/60">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catCfg.badgeClass}`}
                              >
                                {catCfg.badgeLabel}
                              </span>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-400">
                                  {timeStr}
                                </span>

                                {/* Pin / Unpin Button (Red pin as in screenshot) */}
                                <button
                                  type="button"
                                  onClick={(e) => handleTogglePin(note.id, e)}
                                  title={note.isPinned ? 'Unpin Note' : 'Pin to Top'}
                                  className={`p-0.5 rounded transition cursor-pointer ${
                                    note.isPinned
                                      ? 'text-red-400 hover:text-red-300 scale-110'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  📌
                                </button>

                                {/* Delete Cross (✕ as in screenshot) */}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteNote(note.id, e)}
                                  title="Delete Note"
                                  className="text-slate-500 hover:text-rose-400 text-xs p-0.5 transition cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {/* Note Content Text */}
                            <div className="pt-2 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                              {note.content}
                            </div>
                          </div>

                          {/* Quick Edit Trigger on Hover / Click */}
                          <div className="flex justify-end pt-2 mt-2 border-t border-slate-800/40 opacity-40 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(note, e)}
                              className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: HOMEBREW RULES COMPENDIUM */}
      {activeTab === 'homebrew' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-300 font-display">
                Official Campaign Homebrew Compendium
              </h3>
              <p className="text-xs text-slate-300">
                Custom world rules for potions, tactical flat-bonus flanking, massive damage &amp; unstable, rest cycles, universal units currency, and resurrection rituals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* 1. Combat & Action Economy */}
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Heart className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-slate-100 font-display">
                  Combat &amp; Action Economy
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🧪 Healing Potions</span>
                  <p className="text-slate-300 leading-relaxed">
                    • <strong>Bonus Action:</strong> Drink and roll healing dice normally.<br />
                    • <strong>Full Action:</strong> Drink and receive <em>maximum possible healing</em> (no roll needed).<br />
                    • <strong>Administering to an ally:</strong> Follows the exact same rules (Bonus Action = roll; Action = max heal).
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">⚔️ Flat Bonus Flanking</span>
                  <p className="text-slate-300 leading-relaxed">
                    Grants flat attack bonuses instead of advantage:<br />
                    • <strong>2 Allies:</strong> +1 flat attack bonus.<br />
                    • <strong>3 Allies:</strong> +2 flat attack bonus.<br />
                    • <strong>4+ Allies:</strong> +3 flat attack bonus.<br />
                    • <span className="text-slate-400">Immunity:</span> Creatures with all-around vision, high perception, Blindsight/Tremorsense, or who are 2+ sizes larger cannot be flanked.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">💥 Massive Damage &amp; Unstable</span>
                  <p className="text-slate-300 leading-relaxed">
                    • Taking single-source damage &gt; 50% of maximum HP inflicts <strong>Unstable</strong> (lose all reactions until stabilized).<br />
                    • <strong>Recovery:</strong> An ally can use an Action to steady you, or you must succeed on a <strong>DC 10 Constitution saving throw</strong> at the start of your turn. On a failure, you are Incapacitated until the end of that turn.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🩸 Lingering Injury Trigger</span>
                  <p className="text-slate-300 leading-relaxed">
                    Triggered <strong>only</strong> when dropped to 0 HP by a Critical Hit, or from single-source damage exceeding your maximum HP. DM rolls on the lingering injury table.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">📢 Status Callouts</span>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-1.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-center">
                      <strong>Hurt</strong><br />&gt; 50% HP
                    </div>
                    <div className="p-1.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-center">
                      <strong>Bloodied</strong><br />≤ 50% HP
                    </div>
                    <div className="p-1.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-center">
                      <strong>Critical</strong><br />Single-digit HP
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Movement & Environment */}
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 font-display">
                  Movement &amp; Environment
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🪂 Flat Fall Damage</span>
                  <p className="text-slate-300 leading-relaxed">
                    • <strong>1 flat damage per foot fallen beyond 15 feet</strong> (e.g. 30ft fall = 15 damage).<br />
                    • <strong>Incapacitated creatures:</strong> Take 1 damage per foot starting from 0 feet.<br />
                    <span className="text-cyan-400">💡 Interactive calculator available under 3D Geometry tab.</span>
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🦘 Streamlined Jumping</span>
                  <p className="text-slate-300 leading-relaxed">
                    • <strong>No check required:</strong> Jump distance is limited only by your total movement speed.<br />
                    • <strong>Standing Jump:</strong> 5 ft. + STR or DEX modifier (whichever is higher).<br />
                    • <strong>Running Jump (10-ft lead):</strong> 10 ft. + STR or DEX modifier (whichever is higher).<br />
                    <span className="text-cyan-400">💡 Interactive calculator available under 3D Geometry tab.</span>
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🛡️ Prone, Duck &amp; Crouch Cost</span>
                  <p className="text-slate-300 leading-relaxed">
                    Dropping, crawling, or clearing improvised maneuvers costs a flat <strong>15 feet of movement</strong> (instead of half your speed).
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🏋️ Lifting &amp; Dragging Capacity</span>
                  <p className="text-slate-300 leading-relaxed">
                    • <strong>Base Capacity:</strong> 15 × Strength score (in pounds).<br />
                    • <strong>Size Multipliers:</strong> Double for each size above Medium:<br />
                    <span className="text-slate-400 font-mono">Large (×2) · Huge (×4) · Gargantuan (×8)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Rest & Recovery */}
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Skull className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100 font-display">
                  Rest, Attunement &amp; Resurrection
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">⏱️ 10-Minute Short Rest</span>
                  <p className="text-slate-300 leading-relaxed">
                    • Takes only <strong>10 minutes</strong>.<br />
                    • Limited to uses per day equal to your <strong>Proficiency Bonus</strong>.<br />
                    • Each additional short rest before a long rest incurs <strong>1 level of Exhaustion</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">⏳ Attunement &amp; Long Rest</span>
                  <p className="text-slate-300 leading-relaxed">
                    • <strong>Magic Item Attunement:</strong> Takes 1 hour.<br />
                    • <strong>Long Rest:</strong> 8 hours.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <span className="font-bold text-amber-300 block">✨ Dynamic Resurrection Ritual</span>
                  <p className="text-slate-300 leading-relaxed">
                    • <strong>Base DC:</strong> 8 + previous deaths of the target.<br />
                    • <strong>Player Contributions (Secret roll to DM):</strong> Up to 3 allies make a skill check or roleplay aid:<br />
                    <span className="text-emerald-400 font-mono">Success = -1 DC (Nat 20 = -3 DC)</span><br />
                    <span className="text-rose-400 font-mono">Failure = +1 DC (Nat 1 = +3 DC)</span><br />
                    • <strong>Final Check:</strong> Caster rolls d20 + spellcasting ability modifier against the modified DC in secret to DM.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. World & Dice Systems */}
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Dices className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 font-display">
                  World Currency &amp; Dice Systems
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🪙 Universal Currency (Units)</span>
                  <p className="text-slate-300 leading-relaxed">
                    Standardized alloy: Copper (33%), Silver (33%), Gold (33%), Platinum (1%).<br />
                    • <strong>Coin:</strong> 1 Unit<br />
                    • <strong>Cube:</strong> 25 Units<br />
                    • <strong>Bar:</strong> 100 Units
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">🎲 Emphasis Rolls (Binary Dramatic Outcome)</span>
                  <p className="text-slate-300 leading-relaxed">
                    Used when an absolute, binary dramatic outcome is needed without modifiers.<br />
                    • Roll <strong>2d20</strong>.<br />
                    • The die <strong>farthest from 10</strong> dictates the outcome.<br />
                    • <strong>Both above 10:</strong> Grand Success!<br />
                    • <strong>Both below 10:</strong> Grand Failure!
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-amber-300 block">⚔️ Mass Combat Warfare</span>
                  <p className="text-slate-300 leading-relaxed">
                    Contested group checks at initiative counts 20 and 10:<br />
                    • <strong>Init 20 (Fate Roll):</strong> 1d20 Ally Group vs. 1d20 Enemy Group (determines situational fate).<br />
                    • <strong>Init 10 (Execution Roll):</strong> Contested d20 rolls to execute fate.<br />
                    • <strong>Round Outcome:</strong><br />
                    - Win/Win = Decisive Advance<br />
                    - Win/Loss or Loss/Win = Stalemate / Hold<br />
                    - Loss/Loss = Decisive Setback
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
