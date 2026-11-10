/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Pin,
  X,
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
  NoteCategory,
  NoteItem,
  GmSecretNote,
  DmSecretNote,
  NoteColor,
  NOTE_COLORS,
  NOTE_COLOR_CONFIG,
  resolveNoteColor,
  normalizeCategory,
} from '../../types/notes';
import { applyMarkdownSyntax } from '../../utils/markdownRenderer';

export interface EditNoteModalProps {
  isOpen: boolean;
  isGM: boolean;
  editingNote?: NoteItem | GmSecretNote | DmSecretNote | null;
  isDmSecretNote?: boolean;
  isGMSecretNote?: boolean;
  currentVault?: 'myNotes' | 'tableNotes' | 'gmNotes' | 'dmNotes';
  defaultCategory?: NoteCategory;
  onClose: () => void;
  onSave: (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
    color?: NoteColor;
    theme?: string;
  }) => void;
}

export const EditNoteModal: React.FC<EditNoteModalProps> = ({
  isOpen,
  isGM,
  editingNote = null,
  currentVault = 'myNotes',
  defaultCategory = 'General',
  onClose,
  onSave,
}) => {
  const canPin = isGM || currentVault === 'myNotes';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [color, setColor] = useState<NoteColor>('slate');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingNote) {
      setTitle(editingNote.title || '');
      setContent(editingNote.content || '');
      setIsPinned(Boolean(editingNote.isPinned));
      setColor(resolveNoteColor((editingNote as NoteItem).color, editingNote.theme, editingNote.category));
    } else {
      setTitle('');
      setContent('');
      setIsPinned(false);
      setColor('slate');
    }
  }, [isOpen, editingNote]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    onSave({
      title: title.trim(),
      category: editingNote ? normalizeCategory(editingNote.category) : normalizeCategory(defaultCategory),
      content: content.trim(),
      isPinned: canPin ? isPinned : false,
      color,
      theme: color,
    });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const colorCfg = NOTE_COLOR_CONFIG[color] || NOTE_COLOR_CONFIG.slate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full h-[90vh] max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-2xl border transition-all ${colorCfg.cardClasses} ${colorCfg.borderClass} border-l-[4px]`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 p-3 border-b border-inherit/30 flex items-center gap-2">
            <input
              type="text"
              placeholder="Note Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg bg-black/30 border border-white/20 text-inherit placeholder:opacity-50 focus:outline-none focus:border-amber-400 transition"
              required
              autoFocus
            />

            {/* Pin to Top */}
            {canPin && (
              <button
                type="button"
                onClick={() => setIsPinned((prev) => !prev)}
                className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs shrink-0 ${
                  isPinned
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-black/30 border-white/20 text-slate-300 hover:text-amber-400'
                }`}
                title={isPinned ? 'Unpin note' : 'Pin note to top'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/20 text-inherit transition cursor-pointer shrink-0"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toolbar with Typography & Color Swatches */}
          <div className="shrink-0 px-3 py-1.5 border-b border-inherit/30 flex items-center justify-between gap-2 flex-wrap text-xs">
            {/* Typography Buttons */}
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'h1', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Heading 1 (# Heading)"
              >
                <Heading1 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'h2', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Heading 2 (## Subheading)"
              >
                <Heading2 className="w-3 h-3" />
              </button>
              <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'bold', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Bold (**text**)"
              >
                <Bold className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'italic', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] font-serif italic flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Italic (*text*)"
              >
                <Italic className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'underline', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] underline flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Underline (__text__)"
              >
                <UnderlineIcon className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'strike', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] line-through flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Strikethrough (~~text~~)"
              >
                <Strikethrough className="w-2.5 h-2.5" />
              </button>
              <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'list', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Bullet List (- item)"
              >
                <List className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'task', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Task Checkbox (- [ ] task)"
              >
                <CheckSquare className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'divider', content, setContent)}
                className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Line Divider (---)"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Keep-Style Color Palette Swatches */}
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
              <Palette className="w-3 h-3 text-slate-400" />
              <div className="flex items-center gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer border ${
                      color === c
                        ? 'ring-2 ring-amber-400 scale-125 border-white'
                        : 'border-white/20 hover:scale-110 opacity-70 hover:opacity-100'
                    } ${NOTE_COLOR_CONFIG[c].dotColor}`}
                    title={NOTE_COLOR_CONFIG[c].name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Textarea Canvas */}
          <div className="flex-1 min-h-0 p-3 flex flex-col">
            <textarea
              ref={textareaRef}
              className="w-full flex-1 min-h-0 resize-none rounded-lg p-3 text-xs sm:text-sm focus:outline-none focus:border-amber-500/60 leading-relaxed overflow-y-auto border border-white/20 bg-slate-900/90 text-slate-100 placeholder-slate-500 font-sans"
              placeholder="Write note contents, dialogue clues, checklists (- [ ]), or #tags (e.g. #npc, #loot, #quest)..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-3 py-2 border-t border-inherit/30 flex items-center justify-between bg-black/40">
            <span className="text-xs opacity-75 font-mono">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-sm transition cursor-pointer"
              >
                {editingNote ? 'Save Changes' : 'Create Note'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNoteModal;
