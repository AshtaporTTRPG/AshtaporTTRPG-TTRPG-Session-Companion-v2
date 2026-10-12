import React, { useState } from 'react';
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
} from 'lucide-react';
import { NoteItem, NoteCategory } from '../../types/notes';

export const CATEGORY_STYLES: Record<
  NoteCategory,
  { borderL: string; badge: string; text: string }
> = {
  NPC: {
    borderL: 'border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    text: 'text-amber-400',
  },
  Quest: {
    borderL: 'border-l-sky-500',
    badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
    text: 'text-sky-400',
  },
  Combat: {
    borderL: 'border-l-rose-500',
    badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    text: 'text-rose-400',
  },
  Loot: {
    borderL: 'border-l-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    text: 'text-emerald-400',
  },
  Location: {
    borderL: 'border-l-purple-500',
    badge: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
    text: 'text-purple-400',
  },
  General: {
    borderL: 'border-l-slate-500',
    badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
    text: 'text-slate-400',
  },
};

export interface NoteCardProps {
  note: NoteItem;
  isExpanded: boolean;
  isRevealed?: boolean;
  onToggleExpand: (e?: React.MouseEvent) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onToggleReveal?: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isExpanded,
  isRevealed = false,
  onToggleExpand,
  onTogglePin,
  onDelete,
  onEdit,
  onToggleReveal,
}) => {
  const [copied, setCopied] = useState(false);

  const cat = (note.category && CATEGORY_STYLES[note.category] ? note.category : 'General') as NoteCategory;
  const catStyle = CATEGORY_STYLES[cat] || CATEGORY_STYLES.General;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${note.title}\n[${cat}]\n\n${note.content}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const wordCount = note.content && note.content.trim()
    ? note.content.trim().split(/\s+/).length
    : 0;

  return (
    <div
      className={`rounded-xl border border-l-[3px] ${catStyle.borderL} transition-all flex flex-col ${
        isRevealed
          ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-400/40'
          : note.isPinned
          ? 'bg-slate-900/95 border-amber-500/70 shadow-md ring-1 ring-amber-400/30'
          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Card Header Row */}
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

          {/* Title Container flex-1 min-w-0 with truncate */}
          <h4
            className="text-xs font-bold text-slate-100 font-display truncate flex-1 min-w-0 hover:text-amber-300 transition"
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

          {/* Author Attribution Badge (if collaborative table note) */}
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

        {/* Top-Right Header Action Strip */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Optional Broadcast Eye Icon Toggle */}
          {onToggleReveal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReveal();
              }}
              aria-label={isRevealed ? 'Hide from Table' : 'Reveal to Table'}
              title={
                isRevealed
                  ? 'Hide from Table (currently broadcasting)'
                  : 'Reveal to Table (broadcast this note)'
              }
              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                isRevealed
                  ? 'text-amber-400 bg-amber-950/70 border border-amber-500/80 ring-1 ring-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/40 ring-0 hover:ring-1 hover:ring-amber-400/30'
              }`}
            >
              {isRevealed ? (
                <Eye className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              )}
            </button>
          )}

          {/* 1-Click Copy to Clipboard Icon Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
            title={copied ? 'Copied to clipboard!' : 'Copy note to clipboard'}
            aria-label="Copy note to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-amber-400" />
            )}
          </button>

          {/* Pin / Unpin Button */}
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

          {/* Inline Edit Button (pencil) */}
          <button
            type="button"
            onClick={onEdit}
            className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
            title="Edit note"
            aria-label="Edit note"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button (trash) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete note "${note.title}"?`)) {
                onDelete();
              }
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            title="Delete note"
            aria-label="Delete note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Content View */}
      {isExpanded && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-slate-800/70">
          <div
            onClick={onEdit}
            title="Click to edit"
            className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70 shadow-inner cursor-pointer hover:border-slate-700 transition"
          >
            {note.content}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
            <div className="flex items-center gap-2">
              <span>
                {formattedDate} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
              {note.authorName && (
                <span className="text-slate-400">by {note.authorName}</span>
              )}
            </div>

            {/* Inline "Saved" Status Indicator */}
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
