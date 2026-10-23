import React, { useState, useMemo } from 'react';
import {
  Lock,
  Search,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  Radio,
  X,
  Copy,
  Check,
  Pin,
  Maximize2,
  ArrowUpRight,
} from 'lucide-react';
import {
  DmSecretNote,
  BroadcastNotePayload,
  NoteCategory,
  NOTE_CATEGORIES,
  NOTE_THEME_CONFIG,
  NoteTheme,
} from '../types/notes';
import { CATEGORY_STYLES, CATEGORY_PILL_ACTIVE_STYLES } from './notes/NoteCard';
import { CreateNoteModal } from './notes/CreateNoteModal';
import { copyToClipboard } from '../utils/clipboard';
import { renderMarkdown } from '../utils/markdownRenderer';

interface DmNotesVaultProps {
  dmNotes: DmSecretNote[];
  activeBroadcast?: BroadcastNotePayload | null;
  onSaveDmNote: (note: DmSecretNote) => void;
  onDeleteDmNote: (id: string) => void;
  onToggleReveal: (note: DmSecretNote) => void;
  onTogglePinDmNote?: (id: string) => void;
  expandedIds?: Set<string>;
  onToggleExpand?: (id: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  hideControls?: boolean;
  externalSearchQuery?: string;
  externalSelectedCategory?: string;
  onExternalResetFilters?: () => void;
  onExternalEditDmNote?: (note: DmSecretNote, e: React.MouseEvent) => void;
  onOpenReader?: (id: string) => void;
  onTransfer?: (noteId: string, action: 'copy_to_table' | 'move_to_table' | 'move_to_dm' | 'move_to_my') => void;
}

const CATEGORY_ORDER: NoteCategory[] = [
  'General',
  'NPC',
  'Quest',
  'Combat',
  'Loot',
  'Location',
  'Scene',
  'Hook',
];

const CATEGORY_ABBREVIATIONS: Record<string, string> = {
  All: 'All',
  General: 'Gen',
  NPC: 'NPC',
  Quest: 'Qst',
  Combat: 'Cbt',
  Loot: 'Loot',
  Location: 'Loc',
  Scene: 'Scene',
  Hook: 'Hook',
};

export const DmNotesVault: React.FC<DmNotesVaultProps> = ({
  dmNotes,
  activeBroadcast,
  onSaveDmNote,
  onDeleteDmNote,
  onToggleReveal,
  onTogglePinDmNote,
  expandedIds,
  onToggleExpand,
  onExpandAll: externalExpandAll,
  onCollapseAll: externalCollapseAll,
  hideControls = false,
  externalSearchQuery,
  externalSelectedCategory,
  onExternalResetFilters,
  onExternalEditDmNote,
  onOpenReader,
  onTransfer,
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<string>('All');
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ashtapor_dm_notes_collapsed_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DmSecretNote | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);

  const searchQuery =
    externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const selectedCategory =
    externalSelectedCategory !== undefined
      ? externalSelectedCategory
      : internalSelectedCategory;

  const isNoteExpanded = (id: string): boolean => {
    if (expandedIds) {
      return expandedIds.has(id);
    }
    return !collapsedNotes[id];
  };

  const toggleCollapse = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand(id);
      return;
    }
    setCollapsedNotes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('ashtapor_dm_notes_collapsed_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Derive active revealed note directly from activeBroadcast as single source of truth
  const activeRevealedNote = useMemo(() => {
    if (!activeBroadcast) return null;
    return dmNotes.find((n) => n.id === activeBroadcast.id) || null;
  }, [dmNotes, activeBroadcast]);

  const handleExpandAll = () => {
    setCollapsedNotes({});
    try {
      localStorage.setItem('ashtapor_dm_notes_collapsed_v1', JSON.stringify({}));
    } catch {}
    if (externalExpandAll) externalExpandAll();
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    dmNotes.forEach((n) => {
      allCollapsed[n.id] = true;
    });
    setCollapsedNotes(allCollapsed);
    try {
      localStorage.setItem('ashtapor_dm_notes_collapsed_v1', JSON.stringify(allCollapsed));
    } catch {}
    if (externalCollapseAll) externalCollapseAll();
  };

  const handleOpenCreate = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note: DmSecretNote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExternalEditDmNote) {
      onExternalEditDmNote(note, e);
      return;
    }
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSaveFromModal = (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
    theme?: NoteTheme;
  }) => {
    if (editingNote) {
      const updated: DmSecretNote = {
        ...editingNote,
        title: data.title,
        category: data.category,
        content: data.content,
        isPinned: data.isPinned,
        theme: data.theme,
        updatedAt: Date.now(),
      };
      onSaveDmNote(updated);
    } else {
      const created: DmSecretNote = {
        id: `dm-note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: data.title,
        category: data.category,
        content: data.content,
        isPinned: data.isPinned,
        theme: data.theme,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onSaveDmNote(created);
    }

    setIsEditorOpen(false);
    setEditingNote(null);
  };

  const handleCopy = async (note: DmSecretNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const cat = note.category || 'General';
    const ok = await copyToClipboard(`${note.title}\n[${cat}]\n\n${note.content}`);
    if (ok) {
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: dmNotes.length,
      General: 0,
      NPC: 0,
      Quest: 0,
      Combat: 0,
      Loot: 0,
      Location: 0,
      Scene: 0,
      Hook: 0,
    };
    dmNotes.forEach((n) => {
      const cat =
        n.category && NOTE_CATEGORIES.includes(n.category) ? n.category : 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [dmNotes]);

  const visibleCategories = useMemo(() => {
    const list = ['All'];
    CATEGORY_ORDER.forEach((cat) => {
      if ((categoryCounts[cat] || 0) > 0) {
        list.push(cat);
      }
    });
    return list;
  }, [categoryCounts]);

  const filteredNotes = useMemo(() => {
    return [...dmNotes]
      .filter((n) => {
        const cat = n.category || 'General';
        const matchesCat = selectedCategory === 'All' || cat === selectedCategory;
        if (!matchesCat) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aPinned = !!a.isPinned;
        const bPinned = !!b.isPinned;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      });
  }, [dmNotes, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5">
      {/* Standalone DM Vault Controls (hidden when unified in NotesTab) */}
      {!hideControls && (
        <div className="shrink-0 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setInternalSearchQuery(e.target.value)}
                placeholder="Search secret GM notes..."
                className="w-full h-7 pl-8 pr-6 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setInternalSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleExpandAll}
                title="Expand All"
                aria-label="Expand All"
                className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center justify-center"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                title="Collapse All"
                aria-label="Collapse All"
                className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center justify-center"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Create New Note"
              >
                +
              </button>
            </div>
          </div>

          <div className="h-6 flex items-center gap-1 overflow-x-hidden flex-nowrap py-0.5 px-0.5">
            {visibleCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              const abbr = CATEGORY_ABBREVIATIONS[cat] || cat;
              const activeStyle =
                CATEGORY_PILL_ACTIVE_STYLES[cat] || CATEGORY_PILL_ACTIVE_STYLES.All;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setInternalSelectedCategory(
                      selectedCategory === cat || cat === 'All' ? 'All' : cat
                    )
                  }
                  className={
                    isSelected
                      ? `px-1.5 py-0.5 text-[10px] font-bold rounded-full border transition-colors shrink-0 cursor-pointer text-slate-100 ${activeStyle}`
                      : 'px-1.5 py-0.5 text-[10px] font-semibold rounded-full border transition-colors shrink-0 cursor-pointer bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                  }
                  title={`Filter by ${cat} (${count})`}
                >
                  {abbr} {count}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Broadcast Announcement Banner */}
      {activeRevealedNote && (
        <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/70 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="font-bold text-slate-100">Live Broadcast: </span>
              <span className="text-amber-300 font-medium">"{activeRevealedNote.title}"</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleReveal(activeRevealedNote)}
            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition cursor-pointer shrink-0 flex items-center gap-1 shadow-sm"
            title="Stop broadcasting this note to all player screens"
          >
            <EyeOff className="w-3 h-3" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* GM Note Card List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
        {filteredNotes.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Lock className="w-8 h-8 opacity-30 text-rose-400" />
            <p className="text-xs font-medium text-slate-400">
              {searchQuery || selectedCategory !== 'All'
                ? 'No matching secret notes found.'
                : 'No secret GM notes yet.'}
            </p>
            <p className="text-[11px] text-slate-500">
              Click "+" above to write scenes, plot hooks, encounter tactics, or riddles.
            </p>
            {(searchQuery || selectedCategory !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  if (onExternalResetFilters) {
                    onExternalResetFilters();
                  } else {
                    setInternalSearchQuery('');
                    setInternalSelectedCategory('All');
                  }
                }}
                className="mt-2 text-xs text-amber-400 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const expanded = isNoteExpanded(note.id);
            const isRevealed = Boolean(activeBroadcast && activeBroadcast.id === note.id);
            const cat = (
              note.category && CATEGORY_STYLES[note.category] ? note.category : 'General'
            ) as NoteCategory;
            const catStyle = CATEGORY_STYLES[cat] || CATEGORY_STYLES.General;
            const themeCfg = note.theme ? NOTE_THEME_CONFIG[note.theme] || NOTE_THEME_CONFIG.slate : NOTE_THEME_CONFIG.slate;

            const timeStr = new Date(note.updatedAt || note.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });
            const wordCount =
              note.content && note.content.trim()
                ? note.content.trim().split(/\s+/).length
                : 0;

            return (
              <div
                key={note.id}
                className={`rounded-xl border border-l-[3px] ${catStyle.borderL} transition flex flex-col ${
                  isRevealed
                    ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-400/40'
                    : note.isPinned
                    ? 'bg-slate-900/95 border-amber-500/70 shadow-md ring-1 ring-amber-400/30'
                    : themeCfg.cardClasses
                }`}
              >
                {/* Card Header Row */}
                <div
                  className="p-2.5 flex items-center justify-between gap-1.5 min-w-0 cursor-pointer select-none"
                  onClick={(e) => toggleCollapse(note.id, e)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => toggleCollapse(note.id, e)}
                      className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center shrink-0 transition cursor-pointer"
                      title={expanded ? 'Collapse note' : 'Expand note'}
                      aria-label={expanded ? 'Collapse note' : 'Expand note'}
                    >
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <Lock className="w-3 h-3 text-rose-400 shrink-0" />

                    <h4
                      className="text-xs font-bold text-slate-100 font-display truncate flex-1 min-w-0 hover:text-amber-300 transition"
                      title={note.title}
                    >
                      {note.title}
                    </h4>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${catStyle.badge}`}
                    >
                      {cat}
                    </span>
                  </div>

                  {/* Collapsed Header Micro-Icons: 1-Tap Broadcast + 1-Tap Reader View + Pin */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {/* Direct 1-Click Broadcast Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleReveal(note);
                      }}
                      title={isRevealed ? 'Hide from Table' : 'Broadcast Note to Table'}
                      aria-label="Broadcast Note to Table"
                      className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                        isRevealed
                          ? 'text-amber-400 bg-amber-950/60 ring-1 ring-amber-400/60 shadow-sm'
                          : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                      }`}
                    >
                      <Radio className={`w-3.5 h-3.5 ${isRevealed ? 'animate-pulse text-amber-400' : ''}`} />
                    </button>

                    {/* Reader View Launch Trigger */}
                    {onOpenReader && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReader(note.id);
                        }}
                        aria-label="Open Full Reader View"
                        title="Open Full Reader View"
                        className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onTogglePinDmNote && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinDmNote(note.id);
                        }}
                        className={`p-1 rounded transition cursor-pointer shrink-0 ${
                          note.isPinned
                            ? 'text-amber-400 hover:text-amber-300 bg-amber-950/60 ring-1 ring-amber-400/60 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                        title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                        aria-label={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-amber-400' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded State: Action strip + full text area */}
                {expanded && (
                  <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-slate-800/80">
                    {/* Secondary Action Strip Toolbar: [ 📋 Copy ] [ ↗ Transfer ] [ ⛶ Full View ] [ 👁️ Broadcast ] [ ✏️ Edit ] [ 🗑️ Delete ] */}
                    <div className="flex items-center justify-between gap-1 py-1 px-1 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Copy Button */}
                        <button
                          type="button"
                          onClick={(e) => handleCopy(note, e)}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                          title={copiedId === note.id ? 'Copied!' : 'Copy note content'}
                        >
                          {copiedId === note.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{copiedId === note.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* Transfer Menu */}
                        {onTransfer && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTransferId((prev) => (prev === note.id ? null : note.id));
                              }}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Transfer note across vaults"
                            >
                              <ArrowUpRight className="w-3 h-3 text-amber-400" />
                              <span>Transfer</span>
                            </button>

                            {activeTransferId === note.id && (
                              <div className="absolute left-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 flex flex-col text-[11px] font-sans">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTransferId(null);
                                    onTransfer(note.id, 'copy_to_table');
                                  }}
                                  className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <span>📋</span>
                                  <span>Copy to Table Notes</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTransferId(null);
                                    onTransfer(note.id, 'move_to_table');
                                  }}
                                  className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <span>➔</span>
                                  <span>Move to Table Notes</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTransferId(null);
                                    onTransfer(note.id, 'move_to_my');
                                  }}
                                  className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-sky-300 flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <span>👤</span>
                                  <span>Move to My Notes</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Full View */}
                        {onOpenReader && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenReader(note.id);
                            }}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Open Full Reader View"
                          >
                            <Maximize2 className="w-3 h-3 text-amber-400" />
                            <span>Full View</span>
                          </button>
                        )}

                        {/* Broadcast to Table */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleReveal(note);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border ${
                            isRevealed
                              ? 'bg-amber-950/80 border-amber-500/80 text-amber-300'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border-slate-800'
                          }`}
                          title={isRevealed ? 'Hide from Table' : 'Broadcast to Table'}
                        >
                          {isRevealed ? (
                            <Eye className="w-3 h-3 text-amber-400 animate-pulse" />
                          ) : (
                            <EyeOff className="w-3 h-3" />
                          )}
                          <span>{isRevealed ? 'Broadcasting' : 'Broadcast'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit Note */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(note, e)}
                          aria-label="Edit note"
                          title="Edit note"
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Note */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete secret note "${note.title}"?`)) {
                              onDeleteDmNote(note.id);
                            }
                          }}
                          aria-label="Delete note"
                          title="Delete note"
                          className="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`text-xs leading-relaxed max-h-48 overflow-y-auto p-2.5 rounded-lg border shadow-inner select-text cursor-text selection:bg-amber-500/30 selection:text-amber-200 ${themeCfg.contentClasses}`}
                    >
                      {renderMarkdown(note.content)}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
                      <span>
                        {timeStr} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
                      </span>

                      <div className="flex items-center gap-2">
                        {isRevealed ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>Broadcast Active</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Private to GM</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create / Edit DM Secret Note (when used standalone) */}
      <CreateNoteModal
        isOpen={isEditorOpen}
        isGM={true}
        isDmSecretNote={true}
        editingNote={editingNote}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveFromModal}
      />
    </div>
  );
};

export default DmNotesVault;
