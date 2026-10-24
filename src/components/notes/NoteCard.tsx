import React, { useState, useRef, useEffect } from 'react';
import {
  Pin,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Eye,
  EyeOff,
  Maximize2,
  ArrowUpRight,
  Radio,
} from 'lucide-react';
import { NoteItem, NoteCategory, NOTE_THEME_CONFIG } from '../../types/notes';
import { copyToClipboard } from '../../utils/clipboard';
import { renderMarkdown, toggleMarkdownTask } from '../../utils/markdownRenderer';

export const CATEGORY_STYLES: Record<
  NoteCategory,
  { borderL: string; badge: string; text: string; activePill: string }
> = {
  General: {
    borderL: 'border-l-slate-500',
    badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
    text: 'text-slate-400',
    activePill: 'border-slate-400 bg-slate-800/80 text-slate-100 font-bold',
  },
  NPC: {
    borderL: 'border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    text: 'text-amber-400',
    activePill: 'border-amber-500 bg-amber-950/40 text-amber-200 font-bold',
  },
  Quest: {
    borderL: 'border-l-sky-500',
    badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
    text: 'text-sky-400',
    activePill: 'border-sky-500 bg-sky-950/40 text-sky-200 font-bold',
  },
  Combat: {
    borderL: 'border-l-rose-500',
    badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    text: 'text-rose-400',
    activePill: 'border-rose-500 bg-rose-950/40 text-rose-200 font-bold',
  },
  Loot: {
    borderL: 'border-l-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    text: 'text-emerald-400',
    activePill: 'border-emerald-500 bg-emerald-950/40 text-emerald-200 font-bold',
  },
  Location: {
    borderL: 'border-l-purple-500',
    badge: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
    text: 'text-purple-400',
    activePill: 'border-purple-500 bg-purple-950/40 text-purple-200 font-bold',
  },
  Scene: {
    borderL: 'border-l-indigo-500',
    badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    text: 'text-indigo-300',
    activePill: 'border-indigo-500 bg-indigo-950/40 text-indigo-200 font-bold',
  },
  Hook: {
    borderL: 'border-l-fuchsia-500',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30',
    text: 'text-fuchsia-300',
    activePill: 'border-fuchsia-500 bg-fuchsia-950/40 text-fuchsia-200 font-bold',
  },
};

export const CATEGORY_PILL_ACTIVE_STYLES: Record<string, string> = {
  All: 'border-amber-500 bg-amber-950/40 font-bold text-slate-100',
  General: CATEGORY_STYLES.General.activePill,
  NPC: CATEGORY_STYLES.NPC.activePill,
  Quest: CATEGORY_STYLES.Quest.activePill,
  Combat: CATEGORY_STYLES.Combat.activePill,
  Loot: CATEGORY_STYLES.Loot.activePill,
  Location: CATEGORY_STYLES.Location.activePill,
  Scene: CATEGORY_STYLES.Scene.activePill,
  Hook: CATEGORY_STYLES.Hook.activePill,
};

export interface NoteCardProps {
  note: NoteItem;
  isExpanded: boolean;
  isRevealed?: boolean;
  isGM?: boolean;
  activeSubTab?: 'my' | 'table' | 'dm';
  currentVault?: 'myNotes' | 'tableNotes' | 'dmNotes';
  onToggleExpand: (e?: React.MouseEvent) => void;
  onTogglePin?: () => void;
  onDelete: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onSaveNote?: (note: NoteItem) => void;
  onToggleReveal?: () => void;
  onBroadcastNote?: (note: NoteItem) => void;
  onOpenReader?: (id: string) => void;
  onTransfer?: (noteId: string, action: 'copy_to_table' | 'move_to_table' | 'copy_to_my' | 'move_to_my' | 'move_to_dm') => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isExpanded,
  isRevealed = false,
  isGM = false,
  activeSubTab,
  currentVault = 'myNotes',
  onToggleExpand,
  onTogglePin,
  onDelete,
  onEdit,
  onSaveNote,
  onToggleReveal,
  onBroadcastNote,
  onOpenReader,
  onTransfer,
}) => {
  const [copied, setCopied] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const transferRef = useRef<HTMLDivElement>(null);

  const handleBroadcastNote = (targetNote: NoteItem) => {
    if (onBroadcastNote) {
      onBroadcastNote(targetNote);
    } else if (onToggleReveal) {
      onToggleReveal();
    }
  };

  useEffect(() => {
    if (!isTransferOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (transferRef.current && !transferRef.current.contains(e.target as Node)) {
        setIsTransferOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTransferOpen]);

  const cat = (
    note.category && CATEGORY_STYLES[note.category] ? note.category : 'General'
  ) as NoteCategory;
  const catStyle = CATEGORY_STYLES[cat] || CATEGORY_STYLES.General;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${note.title}\n[${cat}]\n\n${note.content}`;
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  let formattedDate = 'Recently';
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

  const wordCount =
    note.content && note.content.trim() ? note.content.trim().split(/\s+/).length : 0;

  const themeCfg = note.theme ? NOTE_THEME_CONFIG[note.theme] || NOTE_THEME_CONFIG.slate : NOTE_THEME_CONFIG.slate;

  const handleToggleTask = (lineIndex: number) => {
    const newContent = toggleMarkdownTask(note.content, lineIndex);
    const updated: NoteItem = {
      ...note,
      content: newContent,
      updatedAt: typeof note.updatedAt === 'number' ? Date.now() : new Date().toISOString(),
    };
    if (onSaveNote) {
      onSaveNote(updated);
    }
  };

  return (
    <div
      className={`rounded-xl border border-l-[3px] ${catStyle.borderL} transition-all flex flex-col ${themeCfg.cardClasses} ${
        isRevealed
          ? 'ring-2 ring-amber-400 shadow-md'
          : note.isPinned
          ? 'border-amber-500/80 ring-1 ring-amber-400/40 shadow-sm'
          : ''
      }`}
    >
      {/* 1. COLLAPSED PRIMARY HEADER ROW (Clean title line with 1-Tap Reader View Access) */}
      <div
        className="p-2.5 flex items-center justify-between gap-1.5 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Accordion Chevron */}
          <button
            type="button"
            onClick={onToggleExpand}
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

          {/* Full Note Title with theme-consistent font */}
          <h4
            className="text-xs font-bold truncate flex-1 min-w-0 hover:text-amber-300 transition"
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

          {/* Collaborative Author Badge */}
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

        {/* Collapsed Right Micro-Icons: 1-Tap Broadcast + 1-Tap Reader View + Pin */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Direct 1-Click Broadcast Button for GM: Only on Table Notes and GM Notes */}
          {isGM && currentVault !== 'myNotes' && (onBroadcastNote || onToggleReveal) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBroadcastNote(note);
              }}
              title={isRevealed ? 'Stop Revealing & Close' : 'Broadcast Note to Table'}
              aria-label={isRevealed ? 'Stop Revealing & Close' : 'Broadcast Note to Table'}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isRevealed
                  ? 'text-amber-400 bg-amber-950/60 ring-1 ring-amber-400'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isRevealed ? 'animate-pulse' : ''}`} />
            </button>
          )}

          {/* Direct Full Reader View Button */}
          {onOpenReader && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(note.id);
              }}
              title="Open Full Reader View"
              aria-label="Open Full Reader View"
              className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Pin Icon */}
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
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

      {/* 2. EXPANDED VIEW WITH ACTION TOOLBAR */}
      {isExpanded && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-slate-800/70">
          {/* Secondary Action Strip Toolbar: [ 📋 Copy ] [ ↗ Transfer ] [ ⛶ Full View ] [ ✏️ Edit ] [ 🗑️ Delete ] */}
          <div className="flex items-center justify-between gap-1 py-1 px-1 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-1 flex-wrap">
              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                title={copied ? 'Copied!' : 'Copy note content'}
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Transfer Menu (Available to Players and GM) */}
              {onTransfer && (
                <div className="relative" ref={transferRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTransferOpen((prev) => !prev);
                    }}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Transfer note across vaults"
                  >
                    <ArrowUpRight className="w-3 h-3 text-amber-400" />
                    <span>Transfer</span>
                  </button>

                  {isTransferOpen && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 flex flex-col text-[11px] font-sans">
                      {currentVault !== 'tableNotes' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTransferOpen(false);
                            onTransfer(note.id, 'copy_to_table');
                          }}
                          className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>📋</span>
                          <span>Copy to Table Notes</span>
                        </button>
                      )}
                      {currentVault !== 'tableNotes' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTransferOpen(false);
                            onTransfer(note.id, 'move_to_table');
                          }}
                          className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>➔</span>
                          <span>Move to Table Notes</span>
                        </button>
                      )}
                      {currentVault !== 'myNotes' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTransferOpen(false);
                            onTransfer(note.id, 'copy_to_my');
                          }}
                          className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-sky-300 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>📋</span>
                          <span>Copy to My Notes</span>
                        </button>
                      )}
                      {currentVault !== 'myNotes' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTransferOpen(false);
                            onTransfer(note.id, 'move_to_my');
                          }}
                          className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-sky-300 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>👤</span>
                          <span>Move to My Notes</span>
                        </button>
                      )}
                      {isGM && currentVault !== 'dmNotes' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTransferOpen(false);
                            onTransfer(note.id, 'move_to_dm');
                          }}
                          className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-rose-300 flex items-center gap-1.5 transition cursor-pointer border-t border-slate-800"
                        >
                          <span>🔒</span>
                          <span>Move to GM Notes</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Full View Button */}
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

              {/* Broadcast Reveal Toggle for GM: Only on Table Notes and GM Notes */}
              {isGM && currentVault !== 'myNotes' && (onBroadcastNote || onToggleReveal) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBroadcastNote(note);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border ${
                    isRevealed
                      ? 'bg-amber-950/80 border-amber-500/80 text-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border-slate-800'
                  }`}
                  title={isRevealed ? 'Stop Revealing & Close' : 'Broadcast to Table'}
                >
                  {isRevealed ? <Eye className="w-3 h-3 text-amber-400 animate-pulse" /> : <EyeOff className="w-3 h-3" />}
                  <span>{isRevealed ? 'Broadcasting' : 'Broadcast'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Edit Button */}
              <button
                type="button"
                onClick={onEdit}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 transition cursor-pointer"
                title="Edit note"
                aria-label="Edit note"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete note "${note.title}"?`)) {
                    onDelete();
                  }
                }}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition cursor-pointer"
                title="Delete note"
                aria-label="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Note Text Content with Lightweight Markdown Rendering */}
          <div
            className={`text-xs leading-relaxed max-h-48 overflow-y-auto p-2.5 rounded-lg border shadow-inner select-text cursor-text selection:bg-amber-500/30 selection:text-amber-200 ${themeCfg.contentClasses}`}
          >
            {renderMarkdown(note.content, handleToggleTask)}
          </div>

          {/* Card Footer */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
            <div className="flex items-center gap-2">
              <span>
                {formattedDate} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
              {note.authorName && (
                <span className="text-slate-400">by {note.authorName}</span>
              )}
            </div>

            <span
              className="text-[10px] text-slate-500 flex items-center gap-1 select-none"
              title="Note saved"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              <span>Saved</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCard;
