/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  NoteItem,
  NoteColor,
  NOTE_COLOR_STYLES,
  extractHashtags,
} from '../../types/notes';
import { MarkdownRenderer, toggleCheckboxAtLine } from '../../utils/markdownRenderer';
import {
  Pin,
  Edit3,
  Trash2,
  Radio,
  ArrowRightLeft,
  Monitor,
  Copy,
  Check,
} from 'lucide-react';

export interface NoteCardProps {
  note: NoteItem;
  isGM: boolean;
  isHudPinned: boolean;
  selectedTag?: string | null;
  onSelectTag?: (tag: string) => void;
  onOpenReader: (note: NoteItem) => void;
  onTogglePin: (noteId: string) => void;
  onToggleHudPin: (note: NoteItem) => void;
  onChangeColor: (noteId: string, color: NoteColor) => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (noteId: string) => void;
  onBroadcast: (note: NoteItem) => void;
  onTransfer: (note: NoteItem) => void;
  onUpdateContent: (noteId: string, newContent: string) => void;
}

const COLOR_SWATCHES: { id: NoteColor; label: string; dotClass: string }[] = [
  { id: 'slate', label: 'Slate', dotClass: 'bg-slate-600' },
  { id: 'crimson', label: 'Crimson', dotClass: 'bg-rose-500' },
  { id: 'amber', label: 'Amber', dotClass: 'bg-amber-400' },
  { id: 'emerald', label: 'Emerald', dotClass: 'bg-emerald-400' },
  { id: 'teal', label: 'Teal', dotClass: 'bg-teal-400' },
  { id: 'sky', label: 'Sky', dotClass: 'bg-sky-400' },
  { id: 'purple', label: 'Purple', dotClass: 'bg-purple-400' },
];

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isGM,
  isHudPinned,
  selectedTag,
  onSelectTag,
  onOpenReader,
  onTogglePin,
  onToggleHudPin,
  onEdit,
  onDelete,
  onBroadcast,
  onTransfer,
  onUpdateContent,
}) => {
  const [copied, setCopied] = React.useState(false);

  const colorKey: NoteColor = note.color && NOTE_COLOR_STYLES[note.color] ? note.color : 'slate';
  const style = NOTE_COLOR_STYLES[colorKey];
  const tags = extractHashtags(`${note.title} ${note.content}`);

  const handleToggleCheckbox = (lineIndex: number, boxIndex: number = 0) => {
    const nextContent = toggleCheckboxAtLine(note.content, lineIndex, boxIndex);
    if (nextContent !== note.content) {
      onUpdateContent(note.id, nextContent);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${note.title}\n\n${note.content}`.trim();
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={() => onOpenReader(note)}
      className={`group relative rounded-xl border border-l-4 p-2.5 transition cursor-pointer shadow-sm hover:shadow-md flex flex-col gap-1.5 ${style.cardBg} ${style.border} ${style.accentStrip}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {note.isPinned && (
            <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
          )}
          <h4 className="font-bold text-xs text-slate-100 truncate font-display">
            {note.title || 'Untitled Note'}
          </h4>
        </div>

        {/* Quick Action Icons */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-85 group-hover:opacity-100 transition"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onToggleHudPin(note)}
            className={`p-1 rounded transition cursor-pointer ${
              isHudPinned
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/70'
            }`}
            title={isHudPinned ? 'Unpin from Top HUD' : 'Pin to Top HUD Drawer'}
          >
            <Monitor className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => onTogglePin(note.id)}
            className={`p-1 rounded transition cursor-pointer ${
              note.isPinned
                ? 'text-amber-400 hover:bg-slate-800/70'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/70'
            }`}
            title={note.isPinned ? 'Unpin from top of list' : 'Pin to top of list'}
          >
            <Pin className={`w-3 h-3 ${note.isPinned ? 'fill-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition cursor-pointer"
            title="Copy note text"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>

          {isGM && note.scope === 'gm' && (
            <button
              type="button"
              onClick={() => onBroadcast(note)}
              className="p-1 rounded text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 transition cursor-pointer"
              title="Broadcast Handout to Players"
            >
              <Radio className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onTransfer(note)}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/70 transition cursor-pointer"
            title="Move or Copy to another vault"
          >
            <ArrowRightLeft className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(note)}
            className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800/70 transition cursor-pointer"
            title="Edit note"
          >
            <Edit3 className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800/70 transition cursor-pointer"
            title="Delete note"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Rendered Markdown Preview */}
      {note.content && (
        <div className="max-h-36 overflow-hidden relative">
          <MarkdownRenderer
            content={note.content}
            onToggleCheckbox={handleToggleCheckbox}
            compact
          />
        </div>
      )}

      {/* Hashtag Chips + Author Footer */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/50">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {tags.map((tag) => {
            const isActive = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTag?.(tag);
                }}
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono border transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                    : `${style.badgeBg} ${style.badgeText} border-current/25 hover:border-amber-400/60`
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <span className="text-[9px] text-slate-500 font-mono shrink-0">
          {note.authorName}
        </span>
      </div>
    </div>
  );
};

export default NoteCard;
