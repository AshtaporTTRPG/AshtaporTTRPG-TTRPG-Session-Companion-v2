import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Lock, Pin, X } from 'lucide-react';
import {
  NoteCategory,
  NoteItem,
  DmSecretNote,
  PLAYER_NOTE_CATEGORIES,
  GM_NOTE_CATEGORIES,
} from '../../types/notes';

export interface CreateNoteModalProps {
  isOpen: boolean;
  isGM: boolean;
  editingNote?: NoteItem | DmSecretNote | null;
  isDmSecretNote?: boolean;
  defaultCategory?: NoteCategory;
  onClose: () => void;
  onSave: (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
  }) => void;
}

export const CreateNoteModal: React.FC<CreateNoteModalProps> = ({
  isOpen,
  isGM,
  editingNote = null,
  isDmSecretNote = false,
  defaultCategory = 'General',
  onClose,
  onSave,
}) => {
  // Strictly gate category options based on isGM role:
  // GM: ['General', 'NPC', 'Quest', 'Combat', 'Loot', 'Location', 'Scene', 'Hook']
  // Player (!isGM): ['General', 'NPC', 'Quest', 'Loot', 'Location']
  const availableCategories = useMemo<NoteCategory[]>(() => {
    return isGM ? GM_NOTE_CATEGORIES : PLAYER_NOTE_CATEGORIES;
  }, [isGM]);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NoteCategory>('General');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingNote) {
      setTitle(editingNote.title || '');
      const initialCat = editingNote.category || 'General';
      if (isGM || availableCategories.includes(initialCat)) {
        setCategory(initialCat);
      } else {
        setCategory('General');
      }
      setContent(editingNote.content || '');
      setIsPinned(Boolean(editingNote.isPinned));
    } else {
      setTitle('');
      const fallbackCat = availableCategories.includes(defaultCategory)
        ? defaultCategory
        : 'General';
      setCategory(fallbackCat);
      setContent('');
      setIsPinned(false);
    }
  }, [isOpen, editingNote, isGM, availableCategories, defaultCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const finalCategory: NoteCategory = availableCategories.includes(category)
      ? category
      : 'General';

    onSave({
      title: title.trim(),
      category: finalCategory,
      content: content.trim(),
      isPinned,
    });
  };

  const liveWordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
            {isDmSecretNote ? (
              <Lock className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {editingNote
                ? isDmSecretNote
                  ? 'Edit Secret DM Note'
                  : 'Edit Note'
                : isDmSecretNote
                ? 'Create Secret DM Note'
                : 'Create New Note'}
            </span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-1">
              Title *
            </label>
            <input
              type="text"
              placeholder={
                isDmSecretNote
                  ? 'e.g. Throne Room Scene, Crimson Veil Hook, Crypt Ambush'
                  : 'e.g. Guard Captain Kenneth, Crypt Riddle, Wand of Magic Missiles'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans cursor-pointer"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950 cursor-pointer"
                />
                <span className="text-[11px] font-medium flex items-center gap-1">
                  <Pin className="w-3 h-3 text-amber-400" />
                  Pin to top
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-1">
              Content *
            </label>
            <textarea
              rows={5}
              placeholder={
                isDmSecretNote
                  ? 'Write boxed text scenes, plot hooks, secret DCs, or encounter tactics...'
                  : 'Write note details, dialogue, lore, reminders, or inventory...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2.5 font-sans text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              <span>
                ● Auto-saved locally · {liveWordCount} words
              </span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer"
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

export default CreateNoteModal;
