/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Minus,
  List,
  CheckSquare,
  Heading1,
  Heading2,
  Palette,
} from 'lucide-react';
import {
  NoteItem,
  NoteCategory,
  NoteColor,
  NOTE_COLORS,
  NOTE_COLOR_CONFIG,
  resolveNoteColor,
  NoteTransferAction,
  normalizeCategory,
} from '../../types/notes';
import { copyToClipboard } from '../../utils/clipboard';
import {
  renderMarkdown,
  toggleMarkdownTask,
  applyMarkdownSyntax,
  extractTags,
} from '../../utils/markdownRenderer';
import { getPinnedHudNote, setPinnedHudNote, HUD_PIN_EVENT } from './StickyHudNote';

export interface NoteCardProps {
  note: NoteItem;
  isExpanded: boolean;
  isRevealed?: boolean;
  isGM?: boolean;
  currentVault?: 'myNotes' | 'tableNotes' | 'gmNotes' | 'dmNotes';
  onToggleExpand: (e?: React.MouseEvent) => void;
  onTogglePin?: () => void;
  onDelete: () => void;
  onSaveNote?: (note: NoteItem) => void;
  onToggleReveal?: () => void;
  onBroadcastNote?: (note: NoteItem) => void;
  onOpenReader?: (id: string) => void;
  onTransfer?: (noteId: string, action: NoteTransferAction) => void;
  onTagClick?: (tag: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isExpanded,
  isRevealed = false,
  isGM = false,
  currentVault = 'myNotes',
  onToggleExpand,
  onTogglePin,
  onDelete,
  onSaveNote,
  onToggleReveal,
  onBroadcastNote,
  onOpenReader,
  onTransfer,
  onTagClick,
}) => {
  const [copied, setCopied] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const transferRef = useRef<HTMLDivElement>(null);

  // HUD Pin State
  const [isHudPinned, setIsHudPinned] = useState(() => {
    const cur = getPinnedHudNote();
    return cur?.id === note.id;
  });

  useEffect(() => {
    const handleHudUpdate = () => {
      const cur = getPinnedHudNote();
      setIsHudPinned(cur?.id === note.id);
    };
    window.addEventListener(HUD_PIN_EVENT, handleHudUpdate);
    return () => window.removeEventListener(HUD_PIN_EVENT, handleHudUpdate);
  }, [note.id]);

  const handleToggleHudPin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isHudPinned) {
      setPinnedHudNote(null);
    } else {
      setPinnedHudNote(note);
    }
  };

  const colorKey = resolveNoteColor(note.color, note.theme, note.category);
  const colorCfg = NOTE_COLOR_CONFIG[colorKey] || NOTE_COLOR_CONFIG.slate;

  // Inline editing state
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editColor, setEditColor] = useState<NoteColor>(colorKey);
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isInlineEditing) {
      setEditTitle(note.title);
      setEditContent(note.content);
      setEditColor(colorKey);
    }
  }, [note, isInlineEditing, colorKey]);

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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${note.title}\n\n${note.content}`;
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
    note.content && note.content.trim() ? note.content.trim().split(/\s+/).filter(Boolean).length : 0;

  const inlineEditWordCount = editContent.trim()
    ? editContent.trim().split(/\s+/).filter(Boolean).length
    : 0;

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

  const handleStartInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(colorKey);
    setIsInlineEditing(true);
  };

  const handleCancelInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(colorKey);
    setIsInlineEditing(false);
  };

  const handleSaveInlineEdit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editTitle.trim() || !editContent.trim()) return;

    const updated: NoteItem = {
      ...note,
      title: editTitle.trim(),
      content: editContent.trim(),
      color: editColor,
      theme: editColor,
      updatedAt: typeof note.updatedAt === 'number' ? Date.now() : new Date().toISOString(),
    };

    if (onSaveNote) {
      onSaveNote(updated);
    }
    setIsInlineEditing(false);
  };

  const noteTags = extractTags(note.content, note.title);

  return (
    <div
      className={`rounded-xl border border-l-[4px] ${colorCfg.borderClass} transition-all flex flex-col ${colorCfg.cardClasses} ${
        isRevealed
          ? 'ring-2 ring-amber-400 shadow-md'
          : note.isPinned
          ? 'border-amber-500/80 ring-1 ring-amber-400/40 shadow-sm'
          : ''
      }`}
    >
      {/* 1. Header Row */}
      <div
        className="p-2.5 flex items-center justify-between gap-1.5 cursor-pointer select-none"
        onClick={isInlineEditing ? undefined : onToggleExpand}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center shrink-0 transition cursor-pointer"
            title={isExpanded ? 'Collapse note' : 'Expand note'}
            aria-label={isExpanded ? 'Collapse note' : 'Expand note'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          <h4
            className="text-xs font-bold truncate flex-1 min-w-0 hover:text-amber-300 transition"
            title={note.title}
          >
            {note.title}
          </h4>

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

        {/* Right Micro-Icons */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {onOpenReader && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(note.id);
              }}
              title="Open Full Reader View"
              aria-label="Open Full Reader View"
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

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

      {/* 2. Expanded View */}
      {isExpanded && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-inherit/30">
          {isInlineEditing ? (
            /* INLINE EDIT MODE */
            <form onSubmit={handleSaveInlineEdit} className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Note Title..."
                  className="flex-1 min-w-[120px] px-2 py-1 text-xs font-bold rounded bg-black/40 border border-white/20 text-inherit focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />

                {/* Color Swatches */}
                <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                  <Palette className="w-3 h-3 text-slate-400" />
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-3 h-3 rounded-full transition-transform cursor-pointer border ${
                        editColor === c
                          ? 'ring-2 ring-amber-400 scale-125 border-white'
                          : 'border-white/20 hover:scale-110 opacity-70 hover:opacity-100'
                      } ${NOTE_COLOR_CONFIG[c].dotColor}`}
                      title={NOTE_COLOR_CONFIG[c].name}
                    />
                  ))}
                </div>
              </div>

              {/* Inline Typography Formatting Toolbar */}
              <div className="flex items-center gap-1 flex-wrap py-1 px-1 rounded bg-black/30 border border-white/10 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'h1', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Heading 1"
                >
                  <Heading1 className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'h2', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Heading 2"
                >
                  <Heading2 className="w-2.5 h-2.5" />
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'bold', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Bold"
                >
                  <Bold className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'italic', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] font-serif italic flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Italic"
                >
                  <Italic className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'underline', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] underline flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Underline"
                >
                  <UnderlineIcon className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'strike', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] line-through flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Strikethrough"
                >
                  <Strikethrough className="w-2.5 h-2.5" />
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'list', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Bullet List"
                >
                  <List className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'task', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Task Checkbox"
                >
                  <CheckSquare className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMarkdownSyntax(inlineTextareaRef.current, 'divider', editContent, setEditContent)}
                  className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] flex items-center gap-0.5 cursor-pointer hover:text-amber-400 transition"
                  title="Line Divider"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
              </div>

              <textarea
                ref={inlineTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="w-full resize-y rounded-lg p-2.5 text-xs focus:outline-none focus:border-amber-400 leading-relaxed border border-white/20 bg-slate-900/90 text-slate-100 font-sans"
                placeholder="Write note contents... (- [ ] task, #tags, etc.)"
                required
              />

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[10px] opacity-70 font-mono">
                  {inlineEditWordCount} {inlineEditWordCount === 1 ? 'word' : 'words'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCancelInlineEdit}
                    className="px-2.5 py-1 text-xs rounded bg-black/40 hover:bg-black/60 text-inherit border border-white/10 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STANDARD READ VIEW */
            <>
              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-1 py-1 px-1 rounded-lg bg-black/40 border border-inherit/20 text-xs">
                <div className="flex items-center gap-1 flex-wrap">
                  {/* Copy */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2 py-1 rounded bg-black/30 hover:bg-black/50 text-inherit border border-white/10 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title={copied ? 'Copied!' : 'Copy note content'}
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* Pin to HUD */}
                  <button
                    type="button"
                    onClick={handleToggleHudPin}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border ${
                      isHudPinned
                        ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/60 shadow-sm'
                        : 'bg-black/30 hover:bg-black/50 text-inherit border-white/10'
                    }`}
                    title={isHudPinned ? 'Unpin from HUD' : 'Pin to HUD (keep visible across tabs)'}
                  >
                    <Pin className={`w-3 h-3 text-amber-400 ${isHudPinned ? 'fill-amber-400' : ''}`} />
                    <span>{isHudPinned ? 'HUD Pinned' : 'HUD Pin'}</span>
                  </button>

                  {/* Transfer Menu */}
                  {onTransfer && (
                    <div className="relative" ref={transferRef}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsTransferOpen((prev) => !prev);
                        }}
                        className="px-2 py-1 rounded bg-black/30 hover:bg-black/50 text-inherit border border-white/10 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Transfer note across vaults"
                      >
                        <ArrowUpRight className="w-3 h-3 text-amber-400" />
                        <span>Transfer</span>
                      </button>

                      {isTransferOpen && (
                        <div className="absolute left-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 flex flex-col text-[11px] font-sans text-slate-100">
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
                              <span>Copy to Handouts</span>
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
                              <span>Move to Handouts</span>
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
                              <span>Copy to My Prep</span>
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
                              <span>Move to My Prep</span>
                            </button>
                          )}
                          {isGM && currentVault !== 'gmNotes' && currentVault !== 'dmNotes' && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsTransferOpen(false);
                                  onTransfer(note.id, 'copy_to_gm');
                                }}
                                className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-rose-300 flex items-center gap-1.5 transition cursor-pointer border-t border-slate-800"
                              >
                                <span>📋</span>
                                <span>Copy to GM Secrets</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsTransferOpen(false);
                                  onTransfer(note.id, 'move_to_gm');
                                }}
                                className="px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-rose-300 flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <span>🔒</span>
                                <span>Move to GM Secrets</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Broadcast */}
                  {isGM && currentVault === 'gmNotes' && (onBroadcastNote || onToggleReveal) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBroadcastNote(note);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border ${
                        isRevealed
                          ? 'bg-amber-950/80 border-amber-500/80 text-amber-300'
                          : 'bg-black/30 hover:bg-black/50 text-inherit border-white/10 hover:border-amber-400/40'
                      }`}
                      title={isRevealed ? 'Stop Revealing & Close' : 'Broadcast to Table'}
                    >
                      {isRevealed ? <Eye className="w-3 h-3 text-amber-400 animate-pulse" /> : <EyeOff className="w-3 h-3" />}
                      <span>{isRevealed ? 'Broadcasting' : 'Broadcast'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleStartInlineEdit}
                    className="p-1 rounded bg-black/30 hover:bg-black/50 text-inherit border border-white/10 transition cursor-pointer"
                    title="Edit note in place"
                    aria-label="Edit note in place"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete note "${note.title}"?`)) {
                        if (isHudPinned) {
                          setPinnedHudNote(null);
                        }
                        onDelete();
                      }
                    }}
                    className="p-1 rounded bg-black/30 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-800 transition cursor-pointer"
                    title="Delete note"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content Body */}
              <div
                className="text-xs leading-relaxed max-h-48 overflow-y-auto p-2.5 rounded-lg border border-white/10 bg-slate-950/60 shadow-inner select-text cursor-text selection:bg-amber-500/30 selection:text-amber-200"
              >
                {renderMarkdown(note.content, { onToggleTask: handleToggleTask, onTagClick })}
              </div>

              {/* Clickable Card Tag Chips */}
              {noteTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {noteTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick?.(t);
                      }}
                      className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded border transition cursor-pointer ${colorCfg.tagClass}`}
                      title={`Filter by #${t}`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-[10px] opacity-70 font-mono px-0.5">
                <div className="flex items-center gap-2">
                  <span>
                    {formattedDate} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                  {note.authorName && <span>by {note.authorName}</span>}
                </div>

                <span className="flex items-center gap-1 select-none" title="Note saved">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                  <span>Saved</span>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NoteCard;
