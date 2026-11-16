/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  NoteItem,
  NoteColor,
  NOTE_COLOR_STYLES,
} from '../../types/notes';
import { MarkdownRenderer, toggleCheckboxAtLine } from '../../utils/markdownRenderer';
import {
  ChevronLeft,
  Pin,
  Edit3,
  Trash2,
  Radio,
  ArrowRightLeft,
  Monitor,
  Copy,
  Check,
} from 'lucide-react';

export interface NoteReaderViewProps {
  note: NoteItem;
  isGM: boolean;
  isHudPinned: boolean;
  onClose: () => void;
  onTogglePin: (noteId: string) => void;
  onToggleHudPin: (note: NoteItem) => void;
  onChangeColor: (noteId: string, color: NoteColor) => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (noteId: string) => void;
  onBroadcast: (note: NoteItem) => void;
  onTransfer: (note: NoteItem) => void;
  onUpdateContent: (noteId: string, newContent: string) => void;
}

export const NoteReaderView: React.FC<NoteReaderViewProps> = ({
  note,
  isGM,
  isHudPinned,
  onClose,
  onTogglePin,
  onToggleHudPin,
  onEdit,
  onDelete,
  onBroadcast,
  onTransfer,
  onUpdateContent,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const colorKey: NoteColor = note.color && NOTE_COLOR_STYLES[note.color] ? note.color : 'slate';
  const style = NOTE_COLOR_STYLES[colorKey];

  const handleToggleCheckbox = (lineIndex: number, boxIndex: number = 0) => {
    const nextContent = toggleCheckboxAtLine(note.content, lineIndex, boxIndex);
    if (nextContent !== note.content) {
      onUpdateContent(note.id, nextContent);
    }
  };

  const handleCopy = () => {
    const text = `${note.title}\n\n${note.content}`.trim();
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const wordCount = note.content.trim()
    ? note.content.trim().split(/\s+/).length
    : 0;

  return (
    <div
      className={`flex flex-col h-full rounded-xl border border-l-4 p-3 gap-2.5 overflow-hidden ${style.cardBg} ${style.border} ${style.accentStrip}`}
    >
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <h3 className="font-bold text-sm text-slate-100 truncate font-display">
            {note.title || 'Untitled Note'}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition cursor-pointer"
            title="Copy note"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onToggleHudPin(note)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isHudPinned
                ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-amber-300'
            }`}
            title={isHudPinned ? 'Unpin from HUD' : 'Pin to Top HUD'}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onTogglePin(note.id)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              note.isPinned
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-amber-300'
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note'}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-amber-400' : ''}`} />
          </button>

          {isGM && note.scope === 'gm' && (
            <button
              type="button"
              onClick={() => onBroadcast(note)}
              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 transition cursor-pointer"
              title="Broadcast Handout"
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onTransfer(note)}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
            title="Transfer note"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(note)}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-amber-300 transition cursor-pointer"
            title="Edit note"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete(note.id);
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-950/60 border border-slate-700/80 text-slate-300 hover:text-rose-400 transition cursor-pointer"
            title="Delete note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Note Content Body */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-slate-950/60 border border-slate-800/80 p-3 scrollbar-thin scrollbar-thumb-slate-800">
        {note.content ? (
          <MarkdownRenderer
            content={note.content}
            onToggleCheckbox={handleToggleCheckbox}
          />
        ) : (
          <p className="text-xs text-slate-500 italic">Empty note.</p>
        )}
      </div>

      {/* Footer Metadata */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/80 shrink-0">
        <span>
          {new Date(note.updatedAt).toLocaleDateString()} · {wordCount} words · {note.authorName}
        </span>
        <span>Esc to return</span>
      </div>
    </div>
  );
};

export default NoteReaderView;
