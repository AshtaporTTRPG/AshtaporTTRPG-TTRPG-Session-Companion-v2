import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Pin,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
  Upload,
  X,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { NoteItem, NoteCategory, NOTE_CATEGORIES, NotesExportPayload } from '../types/notes';

interface NoteCardListProps {
  notes: NoteItem[];
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

export const CATEGORY_STYLES: Record<
  NoteCategory,
  { borderL: string; badge: string; text: string }
> = {
  NPC: {
    borderL: 'border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    text: 'text-amber-400',
  },
  Quest: {
    borderL: 'border-l-sky-500',
    badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
    text: 'text-sky-400',
  },
  Combat: {
    borderL: 'border-l-rose-500',
    badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    text: 'text-rose-400',
  },
  Loot: {
    borderL: 'border-l-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    text: 'text-emerald-400',
  },
  Location: {
    borderL: 'border-l-purple-500',
    badge: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
    text: 'text-purple-400',
  },
  General: {
    borderL: 'border-l-slate-500',
    badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
    text: 'text-slate-400',
  },
};

export const NoteCardList: React.FC<NoteCardListProps> = ({
  notes,
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(notes.map((n) => n.id));
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<NoteCategory>('General');
  const [formContent, setFormContent] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Toggle single accordion note
  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expand All notes
  const handleExpandAll = () => {
    setExpandedIds(new Set(notes.map((n) => n.id)));
  };

  // Collapse All notes
  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Export Notes to JSON: ashtapor-notes-YYYY-MM-DD.json
  const handleExportJSON = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `ashtapor-notes-${dateStr}.json`;
    const payload: NotesExportPayload = {
      version: '2.0.6',
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
        // Expand newly imported notes
        setExpandedIds((prev) => {
          const next = new Set(prev);
          validList.forEach((n) => next.add(n.id));
          return next;
        });
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
    setExpandedIds((prev) => new Set(prev).add(id));
    setIsEditorOpen(false);
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormIsPinned(false);
  };

  const handleCopy = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${note.title}\n[${note.category || 'General'}]\n\n${note.content}`;
    navigator.clipboard?.writeText(textToCopy);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 1500);
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

  const categoriesWithAll = ['All', 'General', 'NPC', 'Quest', 'Loot', 'Combat', 'Location'];

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

      {/* Top Utility Bar */}
      <div className="shrink-0 flex flex-col gap-1.5 p-2 bg-slate-900/90 border border-slate-800 rounded-xl shadow-sm">
        {/* Row 1: Search Input & Action Icons (Expand All, Collapse All, Export, Import, + New Note) */}
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

          {/* Action Icons Bar: Compact Icon Buttons with Native Title Tooltips */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Expand All Notes */}
            <button
              type="button"
              onClick={handleExpandAll}
              title="Expand All Notes"
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 transition cursor-pointer"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>

            {/* Collapse All Notes */}
            <button
              type="button"
              onClick={handleCollapseAll}
              title="Collapse All Notes"
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

        {/* Row 2: Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {categoriesWithAll.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-bold border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
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
            {searchQuery && (
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
          filteredAndSortedNotes.map((note) => {
            const isExpanded = expandedIds.has(note.id);
            const cat = note.category || 'General';
            const catStyle = CATEGORY_STYLES[cat] || CATEGORY_STYLES.General;

            let formattedDate = '';
            try {
              const d =
                typeof note.updatedAt === 'number'
                  ? new Date(note.updatedAt)
                  : new Date(note.updatedAt || Date.now());
              formattedDate = d.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
            } catch {
              formattedDate = 'Recently';
            }

            return (
              <div
                key={note.id}
                className={`rounded-xl border border-l-[3px] ${catStyle.borderL} transition-all flex flex-col ${
                  note.isPinned
                    ? 'bg-slate-900/95 border-amber-500/70 shadow-md ring-1 ring-amber-400/30'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Header Row: Accordion toggle, Pin, Title flex-1 min-w-0 truncate, Category Pill, Actions */}
                <div
                  className="p-2.5 flex items-center justify-between gap-1.5 cursor-pointer select-none"
                  onClick={() => toggleExpand(note.id)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Accordion Chevron */}
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(note.id, e)}
                      className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center shrink-0 transition"
                      title={isExpanded ? 'Collapse note' : 'Expand note'}
                      aria-label={isExpanded ? 'Collapse note' : 'Expand note'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Pin / Unpin Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(note.id);
                      }}
                      className={`p-1 rounded transition cursor-pointer shrink-0 ${
                        note.isPinned
                          ? 'text-amber-400 hover:text-amber-300 bg-amber-950/60 ring-1 ring-amber-400/60 shadow-sm'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                      title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                      aria-label={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                    >
                      <Pin className={`w-3 h-3 ${note.isPinned ? 'fill-amber-400' : ''}`} />
                    </button>

                    {/* Title Container flex-1 min-w-0 with truncate */}
                    <h4
                      className="text-xs font-bold text-slate-100 font-display truncate flex-1 min-w-0 hover:text-amber-300 transition"
                      title={note.title}
                    >
                      {note.title}
                    </h4>

                    {/* Category Pill with designated badge colors */}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${catStyle.badge}`}
                    >
                      {cat}
                    </span>

                    {/* Author Attribution Badge (if Table Note) */}
                    {note.authorRole && (
                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded border uppercase shrink-0 ${
                          note.authorRole === 'GM'
                            ? 'bg-rose-950/70 border-rose-800/80 text-rose-300 font-bold'
                            : 'bg-cyan-950/70 border-cyan-800/80 text-cyan-300'
                        }`}
                        title={`Author: ${note.authorName || note.authorRole}`}
                      >
                        {note.authorRole}
                      </span>
                    )}
                  </div>

                  {/* Header Actions: Edit & Delete buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {/* Inline Edit Button (pencil) */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(note, e)}
                      className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                      title="Edit note"
                      aria-label="Edit note"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete Button (trash) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete note "${note.title}"?`)) {
                          onDeleteNote(note.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Expanded Content View */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-slate-800/70">
                    <div
                      onClick={(e) => handleOpenEdit(note, e)}
                      title="Click to edit"
                      className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70 shadow-inner cursor-pointer hover:border-slate-700 transition"
                    >
                      {note.content}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
                      <div className="flex items-center gap-2">
                        <span>
                          {formattedDate} · {note.content.length} chars
                        </span>
                        {note.authorName && (
                          <span className="text-slate-400">by {note.authorName}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopy(note, e)}
                        className="text-slate-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                        title="Copy note content"
                      >
                        {copiedNoteId === note.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
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

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
