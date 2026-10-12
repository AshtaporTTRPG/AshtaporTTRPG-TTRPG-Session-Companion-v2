import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Pin,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import { NoteItem, NoteCategory, NOTE_CATEGORIES, NotesExportPayload } from '../../types/notes';
import { NoteCard, CATEGORY_STYLES } from './NoteCard';

export { CATEGORY_STYLES } from './NoteCard';

export interface NoteCardListProps {
  notes: NoteItem[];
  expandedIds?: Set<string>;
  onToggleExpand?: (id: string, e?: React.MouseEvent) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onSaveNote: (note: NoteItem) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  onImportNotes?: (importedNotes: NoteItem[]) => void;
  allowImportExport?: boolean;
  currentRole: 'GM' | 'PLAYER';
  currentAuthorName: string;
  emptyMessage?: string;
  emptySubtitle?: string;
  headerInfo?: React.ReactNode;
}

const CATEGORY_ORDER: NoteCategory[] = ['NPC', 'Quest', 'Combat', 'Loot', 'Location', 'General'];

const CATEGORY_PILL_THEMES: Record<string, string> = {
  All: 'bg-amber-400/20 border-amber-400 text-amber-300 font-semibold shadow-sm',
  NPC: 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold shadow-sm',
  Quest: 'bg-sky-500/20 border-sky-500 text-sky-300 font-semibold shadow-sm',
  Combat: 'bg-rose-500/20 border-rose-500 text-rose-300 font-semibold shadow-sm',
  Loot: 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold shadow-sm',
  Location: 'bg-purple-500/20 border-purple-500 text-purple-300 font-semibold shadow-sm',
  General: 'bg-slate-700/50 border-slate-400 text-slate-100 font-semibold shadow-sm',
};

export const NoteCardList: React.FC<NoteCardListProps> = ({
  notes,
  expandedIds: externalExpandedIds,
  onToggleExpand: externalToggleExpand,
  onExpandAll: externalExpandAll,
  onCollapseAll: externalCollapseAll,
  onSaveNote,
  onDeleteNote,
  onTogglePin,
  onImportNotes,
  allowImportExport = false,
  currentRole,
  currentAuthorName,
  emptyMessage = 'No notes found.',
  emptySubtitle = 'Click "+ New Note" to create one.',
  headerInfo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Fallback internal expansion state if not provided externally
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(() => {
    return new Set(notes.map((n) => n.id));
  });

  const expandedIds = externalExpandedIds ?? internalExpandedIds;

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (externalToggleExpand) {
      externalToggleExpand(id, e);
    } else {
      if (e) e.stopPropagation();
      setInternalExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  };

  const handleExpandAll = () => {
    if (externalExpandAll) {
      externalExpandAll();
    } else {
      setInternalExpandedIds(new Set(notes.map((n) => n.id)));
    }
  };

  const handleCollapseAll = () => {
    if (externalCollapseAll) {
      externalCollapseAll();
    } else {
      setInternalExpandedIds(new Set());
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<NoteCategory>('General');
  const [formContent, setFormContent] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Export Notes to JSON: ashtapor-notes-YYYY-MM-DD.json
  const handleExportJSON = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `ashtapor-notes-${dateStr}.json`;
    const payload: NotesExportPayload = {
      version: '2.0.9',
      exportedAt: now.toISOString(),
      source: 'ashtapor-session-companion',
      notes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger hidden file input for JSON Import
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  // Handle JSON Import file selection and safe merge validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let rawNotes: any[] = [];
      if (Array.isArray(parsed)) {
        rawNotes = parsed;
      } else if (parsed && Array.isArray(parsed.notes)) {
        rawNotes = parsed.notes;
      } else if (parsed && typeof parsed === 'object') {
        rawNotes = Object.values(parsed);
      }

      if (!Array.isArray(rawNotes) || rawNotes.length === 0) {
        alert('No valid notes found in the selected JSON file.');
        return;
      }

      const validList: NoteItem[] = [];
      for (const item of rawNotes) {
        if (item && (typeof item.title === 'string' || typeof item.content === 'string')) {
          const categoryVal =
            item.category && NOTE_CATEGORIES.includes(item.category)
              ? item.category
              : 'General';
          validList.push({
            id: item.id || `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: (item.title || 'Untitled Note').trim(),
            category: categoryVal,
            content: typeof item.content === 'string' ? item.content : '',
            isPinned: !!item.isPinned,
            updatedAt: item.updatedAt || new Date().toISOString(),
            createdAt: item.createdAt || new Date().toISOString(),
            authorRole: item.authorRole,
            authorName: item.authorName,
          });
        }
      }

      if (validList.length === 0) {
        alert('The selected JSON file does not contain compatible note data.');
        return;
      }

      if (onImportNotes) {
        onImportNotes(validList);
      }
    } catch (err) {
      console.error('Failed to import JSON file:', err);
      alert('Unable to parse the selected file. Please verify it is valid JSON.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormCategory('General');
    setFormContent('');
    setFormIsPinned(false);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(note);
    setFormTitle(note.title);
    setFormCategory(note.category || 'General');
    setFormContent(note.content);
    setFormIsPinned(!!note.isPinned);
    setIsEditorOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    const id =
      editingNote?.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

    const updatedNote: NoteItem = {
      id,
      title: formTitle.trim(),
      category: formCategory,
      content: formContent.trim(),
      isPinned: formIsPinned,
      updatedAt: new Date().toISOString(),
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      authorRole: editingNote?.authorRole || currentRole,
      authorName: editingNote?.authorName || currentAuthorName,
    };

    onSaveNote(updatedNote);
    setIsEditorOpen(false);
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormIsPinned(false);
  };

  // Category counts computation for dynamic badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: notes.length,
      NPC: 0,
      Quest: 0,
      Combat: 0,
      Loot: 0,
      Location: 0,
      General: 0,
    };
    notes.forEach((n) => {
      const cat = n.category && NOTE_CATEGORIES.includes(n.category) ? n.category : 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [notes]);

  // Categories to display: 'All' is always visible; others only if count > 0
  const visibleCategories = useMemo(() => {
    const list = ['All'];
    CATEGORY_ORDER.forEach((cat) => {
      if ((categoryCounts[cat] || 0) > 0) {
        list.push(cat);
      }
    });
    return list;
  }, [categoryCounts]);

  const handleCategoryPillClick = (cat: string) => {
    if (selectedCategory === cat || cat === 'All') {
      setSelectedCategory('All');
    } else {
      setSelectedCategory(cat);
    }
  };

  // Filter and Sort Notes:
  // Group 1: Notes where isPinned === true, sorted alphabetically by title (localeCompare, case-insensitive)
  // Group 2: All unpinned notes, sorted alphabetically by title (localeCompare, case-insensitive)
  const filteredAndSortedNotes = useMemo(() => {
    return [...notes]
      .filter((note) => {
        const matchesCategory =
          selectedCategory === 'All' || (note.category || 'General') === selectedCategory;
        if (!matchesCategory) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const inTitle = note.title.toLowerCase().includes(q);
        const inContent = note.content.toLowerCase().includes(q);
        const inCategory = (note.category || '').toLowerCase().includes(q);
        const inAuthor = (note.authorName || '').toLowerCase().includes(q);
        return inTitle || inContent || inCategory || inAuthor;
      })
      .sort((a, b) => {
        const aPinned = !!a.isPinned;
        const bPinned = !!b.isPinned;

        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      });
  }, [notes, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Hidden File Input for JSON Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Optional Top Header Info (e.g. Sync status or room banner) */}
      {headerInfo && <div className="shrink-0">{headerInfo}</div>}

      {/* Top Utility & Filter Container */}
      <div className="shrink-0 flex flex-col gap-1.5 p-2 bg-slate-900/90 border border-slate-800 rounded-xl shadow-sm">
        {/* Row 1: Search Input & Utility Action Icons */}
        <div className="flex items-center gap-1.5">
          {/* Search Input Container */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Icons Bar: Expand All, Collapse All, Export, Import, + New Note */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Expand All Notes */}
            <button
              type="button"
              onClick={handleExpandAll}
              title="Expand All"
              aria-label="Expand All"
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 transition cursor-pointer"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>

            {/* Collapse All Notes */}
            <button
              type="button"
              onClick={handleCollapseAll}
              title="Collapse All"
              aria-label="Collapse All"
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 transition cursor-pointer"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>

            {/* JSON Export Button */}
            {allowImportExport && (
              <button
                type="button"
                onClick={handleExportJSON}
                title="Export Notes as JSON"
                aria-label="Export Notes as JSON"
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* JSON Import Button */}
            {allowImportExport && (
              <button
                type="button"
                onClick={handleTriggerImport}
                title="Import Notes from JSON"
                aria-label="Import Notes from JSON"
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
              </button>
            )}

            {/* + New Note Button */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
              title="Create a new note"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">+ New Note</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* Row 2: Category Filter Pills with Dynamic Count Badges (Horizontally Scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {visibleCategories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = categoryCounts[cat] || 0;
            const activeStyle = CATEGORY_PILL_THEMES[cat] || CATEGORY_PILL_THEMES.All;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryPillClick(cat)}
                className={`transition-colors whitespace-nowrap cursor-pointer text-[11px] px-2 py-0.5 rounded-full border ${
                  isSelected
                    ? activeStyle
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border-slate-800'
                }`}
                title={`Filter by ${cat} (${count})`}
              >
                <span>{cat}</span>
                <span className="ml-1 opacity-80 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note Cards List (Accordion & Scroll Container) */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
        {filteredAndSortedNotes.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <FileText className="w-8 h-8 opacity-30 text-slate-400" />
            <p className="text-xs font-medium text-slate-300">{emptyMessage}</p>
            <p className="text-[11px] text-slate-500">{emptySubtitle}</p>
            {(searchQuery || selectedCategory !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="mt-2 text-xs text-amber-400 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isExpanded={expandedIds.has(note.id)}
              onToggleExpand={(e) => toggleExpand(note.id, e)}
              onTogglePin={() => onTogglePin(note.id)}
              onDelete={() => onDeleteNote(note.id)}
              onEdit={(e) => handleOpenEdit(note, e)}
            />
          ))
        )}
      </div>

      {/* Modal: Create or Edit Note */}
      {isEditorOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>{editingNote ? 'Edit Note' : 'Create New Note'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Guard Captain Kenneth, Crypt Riddle, Wand of Magic Missiles"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as NoteCategory)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans cursor-pointer"
                  >
                    {NOTE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium flex items-center gap-1">
                      <Pin className="w-3 h-3 text-amber-400" />
                      Pin to top
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Content *
                </label>
                <textarea
                  rows={5}
                  placeholder="Write note details, dialogue, lore, reminders, or tactics..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full p-2.5 font-sans text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                  <span>Auto-saved locally</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer"
                  >
                    {editingNote ? 'Save Changes' : 'Create Note'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCardList;
