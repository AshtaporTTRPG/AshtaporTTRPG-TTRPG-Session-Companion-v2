import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Pin,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  Copy,
  Check,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { NoteItem, NoteCategory, NOTE_CATEGORIES } from '../types/notes';

interface NoteCardListProps {
  notes: NoteItem[];
  onSaveNote: (note: NoteItem) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  currentRole: 'GM' | 'PLAYER';
  currentAuthorName: string;
  emptyMessage?: string;
  emptySubtitle?: string;
  headerInfo?: React.ReactNode;
}

const CATEGORY_COLORS: Record<
  NoteCategory,
  { badge: string; border: string; text: string; bg: string }
> = {
  General: {
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    border: 'border-slate-800',
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
  },
  NPC: {
    badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
    border: 'border-cyan-800/40',
    text: 'text-cyan-300',
    bg: 'bg-cyan-950/20',
  },
  Quest: {
    badge: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    border: 'border-amber-800/40',
    text: 'text-amber-300',
    bg: 'bg-amber-950/20',
  },
  Loot: {
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    border: 'border-emerald-800/40',
    text: 'text-emerald-300',
    bg: 'bg-emerald-950/20',
  },
  Combat: {
    badge: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
    border: 'border-rose-800/40',
    text: 'text-rose-300',
    bg: 'bg-rose-950/20',
  },
  Location: {
    badge: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
    border: 'border-purple-800/40',
    text: 'text-purple-300',
    bg: 'bg-purple-950/20',
  },
};

export const NoteCardList: React.FC<NoteCardListProps> = ({
  notes,
  onSaveNote,
  onDeleteNote,
  onTogglePin,
  currentRole,
  currentAuthorName,
  emptyMessage = 'No notes found.',
  emptySubtitle = 'Click "+ New Note" to create one.',
  headerInfo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>({});
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<NoteCategory>('General');
  const [formContent, setFormContent] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  const toggleCollapse = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNotes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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

    const id = editingNote?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

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

  const handleCopy = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${note.title}\n[${note.category || 'General'}]\n\n${note.content}`;
    navigator.clipboard?.writeText(textToCopy);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 1500);
  };

  // Filter and Sort Notes
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
        // Pinned notes sort to the top
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Secondary: newest updatedAt first
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt || 0).getTime();
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
  }, [notes, selectedCategory, searchQuery]);

  const categoriesWithAll = ['All', 'General', 'NPC', 'Quest', 'Loot', 'Combat', 'Location'];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Optional Top Header Info (e.g. Sync status or room banner) */}
      {headerInfo && <div className="shrink-0">{headerInfo}</div>}

      {/* Top Utility Bar */}
      <div className="shrink-0 flex flex-col gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-xl shadow-sm">
        {/* Row 1: Search Input & + New Note Button */}
        <div className="flex items-center gap-1.5">
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
            title="Create a new note"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ New Note</span>
          </button>
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
                className="mt-2 text-xs text-amber-400 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedNotes.map((note) => {
            const isCollapsed = !!collapsedNotes[note.id];
            const cat = note.category || 'General';
            const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.General;

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
                className={`rounded-xl border transition-all flex flex-col ${
                  note.isPinned
                    ? 'bg-slate-900/95 border-amber-500/70 shadow-md ring-1 ring-amber-400/30'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Header Row: Accordion toggle, Pin, Title flex-1 min-w-0 truncate, Category Pill, Actions */}
                <div
                  className="p-2.5 flex items-center justify-between gap-1.5 cursor-pointer select-none"
                  onClick={() => toggleCollapse(note.id)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Accordion Chevron */}
                    <button
                      type="button"
                      onClick={(e) => toggleCollapse(note.id, e)}
                      className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center shrink-0 transition"
                      title={isCollapsed ? 'Expand note' : 'Collapse note'}
                      aria-label={isCollapsed ? 'Expand note' : 'Collapse note'}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
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

                    {/* Category Pill */}
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
                {!isCollapsed && (
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
                        className="text-slate-400 hover:text-amber-300 flex items-center gap-1 transition"
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
                className="text-slate-400 hover:text-slate-200"
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
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950"
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
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow"
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
