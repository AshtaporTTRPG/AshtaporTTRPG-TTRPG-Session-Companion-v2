/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
  Upload,
  X,
  FileText,
  MoreVertical,
} from 'lucide-react';
import {
  NoteItem,
  NoteCategory,
  NOTE_CATEGORIES,
  NotesExportPayload,
  NoteTransferAction,
  normalizeCategory,
} from '../../types/notes';
import { NoteCard, CATEGORY_STYLES, CATEGORY_PILL_ACTIVE_STYLES } from './NoteCard';
import { CreateNoteModal } from './CreateNoteModal';

export { CATEGORY_STYLES, CATEGORY_PILL_ACTIVE_STYLES } from './NoteCard';

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
  hideControls?: boolean;
  externalSearchQuery?: string;
  externalSelectedCategory?: string;
  onExternalResetFilters?: () => void;
  onOpenReader?: (id: string) => void;
  isGM?: boolean;
  currentVault?: 'myNotes' | 'tableNotes' | 'gmNotes' | 'dmNotes';
  onTransfer?: (noteId: string, action: NoteTransferAction) => void;
  onBroadcastNote?: (note: NoteItem) => void;
  activeBroadcastId?: string | null;
}

const CATEGORY_ORDER: NoteCategory[] = [
  'General',
  'NPC',
  'Location',
  'Loot',
  'Encounters',
  'Leads',
];

const CATEGORY_ABBREVIATIONS: Record<string, string> = {
  All: 'All',
  General: 'Gen',
  NPC: 'NPC',
  Location: 'Loc',
  Loot: 'Loot',
  Encounters: 'Enc',
  Leads: 'Lead',
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
  emptySubtitle = 'Click "+" to create a new note.',
  headerInfo,
  hideControls = false,
  externalSearchQuery,
  externalSelectedCategory,
  onExternalResetFilters,
  onOpenReader,
  isGM = currentRole === 'GM',
  currentVault = 'myNotes',
  onTransfer,
  onBroadcastNote,
  activeBroadcastId,
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<string>('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const searchQuery =
    externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const selectedCategory =
    externalSelectedCategory !== undefined
      ? externalSelectedCategory
      : internalSelectedCategory;

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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

  const handleExportJSON = () => {
    setIsMenuOpen(false);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `ashtapor-notes-${dateStr}.json`;
    const payload: NotesExportPayload = {
      version: '2.0.27',
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

  const handleTriggerImport = () => {
    setIsMenuOpen(false);
    fileInputRef.current?.click();
  };

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

      if (!Array.isArray(rawNotes) || rawNotes.length === 0) return;

      const validList: NoteItem[] = [];
      for (const item of rawNotes) {
        if (item && (typeof item.title === 'string' || typeof item.content === 'string')) {
          validList.push({
            id:
              item.id ||
              `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: (item.title || 'Untitled Note').trim(),
            category: normalizeCategory(item.category),
            content: typeof item.content === 'string' ? item.content : '',
            theme: item.theme,
            isPinned: !!item.isPinned,
            updatedAt: item.updatedAt || new Date().toISOString(),
            createdAt: item.createdAt || new Date().toISOString(),
            authorRole: item.authorRole,
            authorName: item.authorName,
          });
        }
      }

      if (validList.length > 0 && onImportNotes) {
        onImportNotes(validList);
      }
    } catch (err) {
      console.error('Failed to import JSON file:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleSaveFromModal = (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
  }) => {
    const id =
      editingNote?.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

    const updatedNote: NoteItem = {
      id,
      title: data.title,
      category: data.category,
      content: data.content,
      isPinned: data.isPinned,
      updatedAt: new Date().toISOString(),
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      authorRole: editingNote?.authorRole || currentRole,
      authorName: editingNote?.authorName || currentAuthorName,
    };

    onSaveNote(updatedNote);
    setIsEditorOpen(false);
    setEditingNote(null);
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: notes.length,
      General: 0,
      NPC: 0,
      Location: 0,
      Loot: 0,
      Encounters: 0,
      Leads: 0,
    };
    notes.forEach((n) => {
      const cat = normalizeCategory(n.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [notes]);

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
      setInternalSelectedCategory('All');
    } else {
      setInternalSelectedCategory(cat);
    }
  };

  const filteredAndSortedNotes = useMemo(() => {
    return [...notes]
      .filter((note) => {
        const cat = normalizeCategory(note.category);
        const matchesCategory =
          selectedCategory === 'All' || cat === selectedCategory;
        if (!matchesCategory) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const inTitle = note.title.toLowerCase().includes(q);
        const inContent = note.content.toLowerCase().includes(q);
        const inCategory = cat.toLowerCase().includes(q);
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
    <div className="flex-1 min-h-0 flex flex-col gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {headerInfo && <div className="shrink-0">{headerInfo}</div>}

      {!hideControls && (
        <div className="shrink-0 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setInternalSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full h-7 pl-8 pr-6 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setInternalSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Clear search"
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
                className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleCollapseAll}
                title="Collapse All"
                aria-label="Collapse All"
                className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
              </button>

              {allowImportExport && (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    title="Backup & Restore Options"
                    aria-label="Backup & Restore Options"
                    className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 flex flex-col text-xs">
                      <button
                        type="button"
                        onClick={handleExportJSON}
                        className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>⬇ Export JSON Backup</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerImport}
                        className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>⬆ Import JSON Backup</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenCreateModal}
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
                  onClick={() => handleCategoryPillClick(cat)}
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

      {/* Note Cards List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
        {filteredAndSortedNotes.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <FileText className="w-8 h-8 opacity-30 text-slate-400" />
            <p className="text-xs font-medium text-slate-300">{emptyMessage}</p>
            <p className="text-[11px] text-slate-500">{emptySubtitle}</p>
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
          filteredAndSortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isExpanded={expandedIds.has(note.id)}
              isRevealed={Boolean(activeBroadcastId && activeBroadcastId === note.id)}
              onToggleExpand={(e) => toggleExpand(note.id, e)}
              onTogglePin={() => onTogglePin(note.id)}
              onDelete={() => onDeleteNote(note.id)}
              onSaveNote={onSaveNote}
              onOpenReader={onOpenReader}
              isGM={isGM}
              currentVault={currentVault}
              onTransfer={onTransfer}
              onBroadcastNote={onBroadcastNote}
            />
          ))
        )}
      </div>

      <CreateNoteModal
        isOpen={isEditorOpen}
        isGM={isGM}
        currentVault={currentVault}
        editingNote={editingNote}
        defaultCategory={
          selectedCategory !== 'All' ? (normalizeCategory(selectedCategory)) : 'General'
        }
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveFromModal}
      />
    </div>
  );
};

export default NoteCardList;
