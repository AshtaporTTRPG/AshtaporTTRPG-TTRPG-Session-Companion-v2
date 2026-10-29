/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Copy, Check, Pencil, ArrowUpRight, Trash2, Pin } from 'lucide-react';
import {
  NoteItem,
  DmSecretNote,
  GmSecretNote,
  NoteCategory,
  NOTE_THEME_CONFIG,
  NoteTransferAction,
  normalizeCategory,
} from '../../types/notes';
import { CATEGORY_STYLES } from './NoteCard';
import { copyToClipboard } from '../../utils/clipboard';
import { renderMarkdown, toggleMarkdownTask } from '../../utils/markdownRenderer';
import { getPinnedHudNote, setPinnedHudNote, HUD_PIN_EVENT } from './StickyHudNote';

export interface NoteReaderViewProps {
  note: NoteItem | GmSecretNote | DmSecretNote;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onSaveNote?: (note: NoteItem | GmSecretNote | DmSecretNote) => void;
  isGM?: boolean;
  currentVault?: 'myNotes' | 'tableNotes' | 'gmNotes' | 'dmNotes';
  onTransfer?: (action: NoteTransferAction) => void;
}

export const NoteReaderView: React.FC<NoteReaderViewProps> = ({
  note,
  onBack,
  onEdit,
  onDelete,
  onSaveNote,
  isGM = false,
  currentVault = 'myNotes',
  onTransfer,
}) => {
  const [copied, setCopied] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const transferRef = useRef<HTMLDivElement>(null);

  // HUD Pin State
  const [isHudPinned, setIsHudPinned] = useState(() => {
    const current = getPinnedHudNote();
    return current?.id === note.id;
  });

  useEffect(() => {
    const handleHudUpdate = () => {
      const current = getPinnedHudNote();
      setIsHudPinned(current?.id === note.id);
    };
    window.addEventListener(HUD_PIN_EVENT, handleHudUpdate);
    return () => window.removeEventListener(HUD_PIN_EVENT, handleHudUpdate);
  }, [note.id]);

  const handleToggleHudPin = () => {
    if (isHudPinned) {
      setPinnedHudNote(null);
    } else {
      setPinnedHudNote(note as NoteItem);
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

  // Keyboard shortcut: Esc to return to standard notes view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const cat = normalizeCategory(note.category);
  const catStyle = CATEGORY_STYLES[cat] || CATEGORY_STYLES.General;

  const handleCopyFullNote = async () => {
    const textToCopy = `${note.title}\n[${cat}]\n\n${note.content}`;
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const formattedDate = useMemo(() => {
    try {
      const raw = note.updatedAt || note.createdAt;
      const d =
        typeof raw === 'number'
          ? new Date(raw)
          : new Date(raw || Date.now());
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  }, [note.updatedAt, note.createdAt]);

  const wordCount = useMemo(() => {
    if (!note.content || !note.content.trim()) return 0;
    return note.content.trim().split(/\s+/).filter(Boolean).length;
  }, [note.content]);

  const author = useMemo(() => {
    const item = note as NoteItem;
    if (item.authorName) return item.authorName;
    if (item.authorRole) return item.authorRole;
    return 'GM';
  }, [note]);

  const themeCfg = note.theme
    ? NOTE_THEME_CONFIG[note.theme] || NOTE_THEME_CONFIG.slate
    : NOTE_THEME_CONFIG.slate;

  const handleToggleTask = (lineIndex: number) => {
    const newContent = toggleMarkdownTask(note.content, lineIndex);
    const updated = {
      ...note,
      content: newContent,
      updatedAt: typeof note.updatedAt === 'number' ? Date.now() : new Date().toISOString(),
    };
    if (onSaveNote) {
      onSaveNote(updated);
    }
  };

  return (
    <div className={`flex flex-col h-full p-2.5 select-text overflow-hidden rounded-xl border ${themeCfg.cardClasses}`}>
      {/* Utility Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-inherit/30 shrink-0 gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-black/40 hover:bg-black/60 text-inherit border border-white/10 rounded-md transition-colors cursor-pointer shrink-0"
            title="Back to Notes (Esc)"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" /> Back
          </button>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${catStyle.badge}`}
          >
            {cat}
          </span>
          <h2
            className="text-xs font-bold truncate min-w-0 flex-1 ml-1"
            title={note.title}
          >
            {note.title}
          </h2>
        </div>

        {/* Right Action Icons: Copy, HUD Pin, Transfer, Edit & Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyFullNote}
            title={copied ? 'Copied to clipboard!' : 'Copy Full Note'}
            className="p-1.5 text-inherit opacity-80 hover:opacity-100 bg-black/30 hover:bg-black/50 border border-white/10 rounded cursor-pointer transition flex items-center gap-1 text-xs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden xs:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Pin to HUD */}
          <button
            type="button"
            onClick={handleToggleHudPin}
            title={isHudPinned ? 'Unpin from HUD' : 'Pin to HUD (keep visible across tabs)'}
            className={`px-2 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer flex items-center gap-1 ${
              isHudPinned
                ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/60 shadow-sm'
                : 'bg-black/30 hover:bg-black/50 text-inherit opacity-80 hover:opacity-100 border-white/10'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 text-amber-400 ${isHudPinned ? 'fill-amber-400' : ''}`} />
            <span className="hidden xs:inline">{isHudPinned ? 'HUD Pinned' : 'HUD Pin'}</span>
          </button>

          {/* Transfer Menu */}
          {onTransfer && (
            <div className="relative" ref={transferRef}>
              <button
                type="button"
                onClick={() => setIsTransferOpen((prev) => !prev)}
                title="Transfer note across vaults"
                className="px-2 py-1 text-xs font-semibold rounded bg-black/30 hover:bg-black/50 text-inherit opacity-80 hover:opacity-100 border border-white/10 transition cursor-pointer flex items-center gap-1"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Transfer</span>
              </button>

              {isTransferOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 flex flex-col text-xs font-sans text-slate-100">
                  {currentVault !== 'tableNotes' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferOpen(false);
                        onTransfer('copy_to_table');
                      }}
                      className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>📋</span>
                      <span>Copy to Table Notes</span>
                    </button>
                  )}
                  {currentVault !== 'tableNotes' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferOpen(false);
                        onTransfer('move_to_table');
                      }}
                      className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>➔</span>
                      <span>Move to Table Notes</span>
                    </button>
                  )}
                  {currentVault !== 'myNotes' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferOpen(false);
                        onTransfer('copy_to_my');
                      }}
                      className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-sky-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>📋</span>
                      <span>Copy to My Notes</span>
                    </button>
                  )}
                  {currentVault !== 'myNotes' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferOpen(false);
                        onTransfer('move_to_my');
                      }}
                      className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-sky-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>👤</span>
                      <span>Move to My Notes</span>
                    </button>
                  )}
                  {isGM && currentVault !== 'gmNotes' && currentVault !== 'dmNotes' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTransferOpen(false);
                          onTransfer('copy_to_gm');
                        }}
                        className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-rose-300 flex items-center gap-1.5 transition cursor-pointer border-t border-slate-800"
                      >
                        <span>📋</span>
                        <span>Copy to GM Notes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTransferOpen(false);
                          onTransfer('move_to_gm');
                        }}
                        className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-rose-300 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>🔒</span>
                        <span>Move to GM Notes</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Edit Note */}
          <button
            type="button"
            onClick={onEdit}
            title="Edit Note"
            className="p-1.5 text-inherit opacity-80 hover:opacity-100 bg-black/30 hover:bg-black/50 border border-white/10 rounded cursor-pointer transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Delete Note */}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete note "${note.title}"?`)) {
                  if (isHudPinned) {
                    setPinnedHudNote(null);
                  }
                  onDelete();
                  onBack();
                }
              }}
              title="Delete Note"
              className="p-1.5 text-slate-400 hover:text-rose-400 bg-black/30 hover:bg-black/50 border border-white/10 rounded cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Reading Text Body */}
      <div className={`flex-1 overflow-y-auto pr-1 text-sm leading-relaxed p-2.5 rounded-lg border selection:bg-amber-500/30 selection:text-amber-200 ${themeCfg.contentClasses}`}>
        {renderMarkdown(note.content, handleToggleTask)}
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-inherit/30 flex items-center justify-between text-[11px] opacity-70 shrink-0">
        <span>
          {formattedDate} · {wordCount} {wordCount === 1 ? 'word' : 'words'} · {author}
        </span>
        <span className="text-[10px] font-mono select-none">
          Esc to return
        </span>
      </div>
    </div>
  );
};

export default NoteReaderView;
