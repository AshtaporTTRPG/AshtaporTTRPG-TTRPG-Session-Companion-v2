/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NoteItem } from '../../types/notes';
import { MarkdownRenderer, toggleCheckboxAtLine } from '../../utils/markdownRenderer';
import { Pin, Edit3, ChevronDown, ChevronUp, X, Check } from 'lucide-react';

export interface StickyHudNoteProps {
  pinnedNote: NoteItem | null;
  onUnpin: () => void;
  onSaveInlineEdit: (noteId: string, newTitle: string, newContent: string) => void;
}

export const StickyHudNote: React.FC<StickyHudNoteProps> = ({
  pinnedNote,
  onUnpin,
  onSaveInlineEdit,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  useEffect(() => {
    if (pinnedNote && !isEditing) {
      setDraftTitle(pinnedNote.title || '');
      setDraftContent(pinnedNote.content || '');
    }
  }, [pinnedNote, isEditing]);

  if (!pinnedNote) return null;

  const handleToggleCheckbox = (lineIndex: number, boxIndex: number = 0) => {
    const nextContent = toggleCheckboxAtLine(pinnedNote.content, lineIndex, boxIndex);
    if (nextContent !== pinnedNote.content) {
      onSaveInlineEdit(pinnedNote.id, pinnedNote.title, nextContent);
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTitle(pinnedNote.title || '');
    setDraftContent(pinnedNote.content || '');
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleCommitEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveInlineEdit(pinnedNote.id, draftTitle.trim() || 'HUD Note', draftContent);
    setIsEditing(false);
  };

  const scopeLabel =
    pinnedNote.scope === 'gm'
      ? 'GM'
      : pinnedNote.scope === 'table'
      ? 'TABLE'
      : 'GENERAL';

  return (
    <div className="shrink-0 bg-slate-950 border-b border-amber-500/40 z-30 select-none">
      {/* Slim Top Glance Strip */}
      <div
        onClick={() => {
          if (!isEditing) setIsExpanded((prev) => !prev);
        }}
        className="flex items-center justify-between gap-2 px-2.5 py-1 bg-amber-950/20 hover:bg-amber-950/35 transition cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[9px] font-mono font-bold text-slate-300 shrink-0">
            {scopeLabel}
          </span>
          <span className="text-xs font-bold text-slate-100 truncate">
            {pinnedNote.title || 'Pinned HUD Note'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <button
              type="button"
              onClick={handleCommitEdit}
              className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="Save HUD edits"
            >
              <Check className="w-3 h-3" />
              <span>Save</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
              title="Edit note inline"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title={isExpanded ? 'Collapse HUD drawer' : 'Expand HUD drawer'}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              onUnpin();
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            title="Unpin from HUD"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Drawer Body */}
      {isExpanded && (
        <div className="px-3 py-2 bg-slate-900/95 border-t border-slate-800/80 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
          {isEditing ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-bold text-slate-100 focus:outline-none focus:border-amber-400"
                placeholder="Note title"
              />
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={4}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                placeholder="Type markdown or inline spell slots: 1st - [ ] [ ] [ ] [ ]"
              />
            </div>
          ) : (
            <MarkdownRenderer
              content={pinnedNote.content}
              onToggleCheckbox={handleToggleCheckbox}
              compact
            />
          )}
        </div>
      )}
    </div>
  );
};

export default StickyHudNote;
