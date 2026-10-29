/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Pin, ChevronDown, ChevronUp, X } from 'lucide-react';
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

  useEffect(() => {
    const handleUpdate = () => {
      setPinnedNote(getPinnedHudNote());
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
  }, []);

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

  return (
    <div className="shrink-0 border-b border-amber-500/40 bg-slate-950/95 text-slate-100 select-none shadow-md">
      {/* 22px Slim Glance Strip */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="h-[22px] px-2 flex items-center justify-between gap-1.5 cursor-pointer hover:bg-slate-900 transition"
        title="Click to toggle HUD glance drawer"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />

          <span
            className={`text-[9px] font-bold px-1 py-0.2 rounded border uppercase tracking-wider shrink-0 ${badgeStyle}`}
          >
            {cat}
          </span>

          <span className="text-[11px] font-bold truncate text-slate-200 hover:text-amber-300 transition">
            {pinnedNote.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="p-0.5 text-slate-400 hover:text-amber-300 transition"
            title={isExpanded ? 'Collapse HUD Note' : 'Expand HUD Note'}
            aria-label={isExpanded ? 'Collapse HUD Note' : 'Expand HUD Note'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleUnpin}
            className="p-0.5 text-slate-500 hover:text-rose-400 transition ml-0.5"
            title="Unpin HUD Note"
            aria-label="Unpin HUD Note"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Markdown Glance Drawer */}
      {isExpanded && (
        <div
          className={`max-h-44 overflow-y-auto p-2 text-xs leading-relaxed border-t border-inherit/20 ${themeCfg.contentClasses}`}
        >
          {renderMarkdown(pinnedNote.content, handleToggleTask)}
        </div>
      )}
    </div>
  );
};

export default StickyHudNote;
