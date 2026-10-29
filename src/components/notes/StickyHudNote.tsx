/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pin, ChevronDown, ChevronUp, X, Edit2, Check } from 'lucide-react';
import {
  NoteItem,
  NoteTheme,
  NOTE_THEME_CONFIG,
  normalizeCategory,
} from '../../types/notes';
import { renderMarkdown, toggleMarkdownTask } from '../../utils/markdownRenderer';

export const LOCAL_HUD_PIN_KEY = 'ashtapor_hud_pinned_note';
export const HUD_PIN_EVENT = 'ashtapor:hud_note_updated';

const CATEGORY_BADGES: Record<string, string> = {
  General: 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
  NPC: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  Location: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  Loot: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  Encounters: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
  Leads: 'bg-teal-500/10 text-teal-400 border border-teal-500/30',
};

export function getPinnedHudNote(): NoteItem | null {
  try {
    const raw = localStorage.getItem(LOCAL_HUD_PIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NoteItem;
  } catch {
    return null;
  }
}

export function setPinnedHudNote(note: NoteItem | null): void {
  try {
    if (note) {
      localStorage.setItem(LOCAL_HUD_PIN_KEY, JSON.stringify(note));
    } else {
      localStorage.removeItem(LOCAL_HUD_PIN_KEY);
    }
  } catch (err) {
    console.warn('Failed to update pinned HUD note in localStorage:', err);
  }
  window.dispatchEvent(new CustomEvent(HUD_PIN_EVENT, { detail: note }));
}

export const StickyHudNote: React.FC = () => {
  const [pinnedNote, setPinnedNote] = useState<NoteItem | null>(() => getPinnedHudNote());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Inline draft state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleUpdate = () => {
      const cur = getPinnedHudNote();
      setPinnedNote(cur);
      if (!cur) {
        setIsExpanded(false);
        setIsEditing(false);
      }
    };

    window.addEventListener(HUD_PIN_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(HUD_PIN_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleUnpin = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedHudNote(null);
    setIsExpanded(false);
    setIsEditing(false);
  }, []);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pinnedNote) return;
    setEditTitle(pinnedNote.title);
    setEditContent(pinnedNote.content);
    setIsExpanded(true);
    setIsEditing(true);
  }, [pinnedNote]);

  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pinnedNote) return;
    setEditTitle(pinnedNote.title);
    setEditContent(pinnedNote.content);
    setIsEditing(false);
  }, [pinnedNote]);

  const handleSaveEdit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pinnedNote || !editTitle.trim() || !editContent.trim()) return;

    const updated: NoteItem = {
      ...pinnedNote,
      title: editTitle.trim(),
      content: editContent.trim(),
      updatedAt: Date.now(),
    };

    setPinnedHudNote(updated);
    setPinnedNote(updated);
    setIsEditing(false);

    // Broadcast update so NotesTab updates the source vault (My Notes, GM Notes, or Table Notes)
    window.dispatchEvent(new CustomEvent('ashtapor:note_saved_from_hud', { detail: updated }));
  }, [pinnedNote, editTitle, editContent]);

  const handleToggleTask = useCallback((lineIndex: number) => {
    if (!pinnedNote) return;
    const newContent = toggleMarkdownTask(pinnedNote.content, lineIndex);
    const updated: NoteItem = {
      ...pinnedNote,
      content: newContent,
      updatedAt: Date.now(),
    };
    setPinnedHudNote(updated);
    setPinnedNote(updated);

    window.dispatchEvent(new CustomEvent('ashtapor:note_saved_from_hud', { detail: updated }));
  }, [pinnedNote]);

  if (!pinnedNote) {
    return null;
  }

  const cat = normalizeCategory(pinnedNote.category);
  const badgeStyle = CATEGORY_BADGES[cat] || CATEGORY_BADGES.General;
  const themeKey: NoteTheme = pinnedNote.theme || 'slate';
  const themeCfg = NOTE_THEME_CONFIG[themeKey] || NOTE_THEME_CONFIG.slate;
  const editWordCount = editContent.trim() ? editContent.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="shrink-0 border-b border-amber-500/40 bg-slate-950/95 text-slate-100 select-none shadow-md">
      {/* 22px Slim Glance Strip */}
      <div
        onClick={() => {
          if (!isEditing) {
            setIsExpanded((prev) => !prev);
          }
        }}
        className="h-[22px] px-2 flex items-center justify-between gap-1.5 cursor-pointer hover:bg-slate-900 transition"
        title={isEditing ? 'Editing HUD Note' : 'Click to toggle HUD glance drawer'}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />

          <span
            className={`text-[9px] font-bold px-1 py-0.2 rounded border uppercase tracking-wider shrink-0 ${badgeStyle}`}
          >
            {cat}
          </span>

          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Note Title..."
              className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/50 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 flex-1 min-w-0 h-4"
              required
              autoFocus
            />
          ) : (
            <span className="text-[11px] font-bold truncate text-slate-200 hover:text-amber-300 transition">
              {pinnedNote.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Edit / Pencil Button */}
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="p-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer"
              title="Edit note in HUD"
              aria-label="Edit note in HUD"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          ) : null}

          {/* Expand / Collapse Chevron */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing) {
                setIsEditing(false);
              }
              setIsExpanded((prev) => !prev);
            }}
            className="p-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer"
            title={isExpanded ? 'Collapse HUD Note' : 'Expand HUD Note'}
            aria-label={isExpanded ? 'Collapse HUD Note' : 'Expand HUD Note'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Unpin Button */}
          <button
            type="button"
            onClick={handleUnpin}
            className="p-0.5 text-slate-500 hover:text-rose-400 transition ml-0.5 cursor-pointer"
            title="Unpin HUD Note"
            aria-label="Unpin HUD Note"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="border-t border-inherit/20">
          {isEditing ? (
            /* Inline Edit Form */
            <form onSubmit={handleSaveEdit} className="p-2 space-y-1.5 bg-black/60">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className={`w-full resize-y rounded p-2 text-xs focus:outline-none focus:border-amber-400 leading-relaxed border border-white/20 ${themeCfg.contentClasses}`}
                placeholder="Write note contents... (- [ ] task, - list, --- divider)"
                required
              />

              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-[10px] opacity-70 font-mono">
                  {editWordCount} {editWordCount === 1 ? 'word' : 'words'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Markdown Glance View */
            <div
              className={`max-h-44 overflow-y-auto p-2 text-xs leading-relaxed ${themeCfg.contentClasses}`}
            >
              {renderMarkdown(pinnedNote.content, handleToggleTask)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StickyHudNote;
