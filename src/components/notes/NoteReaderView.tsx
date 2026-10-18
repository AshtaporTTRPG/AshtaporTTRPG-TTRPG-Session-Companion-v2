import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Copy, Check, Pencil } from 'lucide-react';
import { NoteItem, DmSecretNote, NoteCategory } from '../../types/notes';
import { CATEGORY_STYLES } from './NoteCard';

export interface NoteReaderViewProps {
  note: NoteItem | DmSecretNote;
  onBack: () => void;
  onEdit: () => void;
}

export const NoteReaderView: React.FC<NoteReaderViewProps> = ({
  note,
  onBack,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);

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

  const cat = (
    note.category && CATEGORY_STYLES[note.category] ? note.category : 'General'
  ) as NoteCategory;
  const catStyle = CATEGORY_STYLES[cat] || CATEGORY_STYLES.General;

  const handleCopyFullNote = () => {
    const textToCopy = `${note.title}\n[${cat}]\n\n${note.content}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
    return note.content.trim().split(/\s+/).length;
  }, [note.content]);

  const author = useMemo(() => {
    const item = note as NoteItem;
    if (item.authorName) return item.authorName;
    if (item.authorRole) return item.authorRole;
    return 'GM';
  }, [note]);

  return (
    <div className="flex flex-col h-full bg-slate-950 p-3 select-text overflow-hidden rounded-xl border border-slate-800">
      {/* Sticky Utility Header (34px) */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 shrink-0">
        {/* Left: Back Button & Category Pill */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md transition-colors cursor-pointer shrink-0"
            title="Back to Notes (Esc)"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" /> Back
          </button>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${catStyle.badge}`}
          >
            {cat}
          </span>
          {/* Center / Title */}
          <h2
            className="text-sm font-bold text-slate-100 truncate max-w-[200px] ml-2"
            title={note.title}
          >
            {note.title}
          </h2>
        </div>

        {/* Right Action Icons: Copy All & Edit */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyFullNote}
            title={copied ? 'Copied to clipboard!' : 'Copy Full Note'}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded cursor-pointer transition"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit Note"
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded cursor-pointer transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Reading Text Body */}
      <div className="flex-1 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-sans selection:bg-amber-500/30 selection:text-amber-200">
        {note.content}
      </div>

      {/* Footer Meta Strip */}
      <div className="pt-2 mt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <span>
          {formattedDate} · {wordCount} {wordCount === 1 ? 'word' : 'words'} · {author}
        </span>
        <span className="text-[10px] text-slate-600 font-mono select-none">
          Esc to return
        </span>
      </div>
    </div>
  );
};

export default NoteReaderView;
