import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Lock, Pin, X, Bold, Italic, List, CheckSquare } from 'lucide-react';
import {
  NoteCategory,
  NoteItem,
  DmSecretNote,
  PLAYER_NOTE_CATEGORIES,
  GM_NOTE_CATEGORIES,
  NoteTheme,
  NOTE_THEMES,
  NOTE_THEME_CONFIG,
} from '../../types/notes';
import { applyMarkdownSyntax } from '../../utils/markdownRenderer';

export interface CreateNoteModalProps {
  isOpen: boolean;
  isGM: boolean;
  editingNote?: NoteItem | DmSecretNote | null;
  isDmSecretNote?: boolean;
  isGMSecretNote?: boolean;
  defaultCategory?: NoteCategory;
  onClose: () => void;
  onSave: (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
    theme?: NoteTheme;
  }) => void;
}

export const CreateNoteModal: React.FC<CreateNoteModalProps> = ({
  isOpen,
  isGM,
  editingNote = null,
  isDmSecretNote = false,
  isGMSecretNote = false,
  defaultCategory = 'General',
  onClose,
  onSave,
}) => {
  const isSecretVaultNote = isGMSecretNote || isDmSecretNote;

  // Gate category options based on isGM role:
  const availableCategories = useMemo<NoteCategory[]>(() => {
    return isGM ? GM_NOTE_CATEGORIES : PLAYER_NOTE_CATEGORIES;
  }, [isGM]);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NoteCategory>('General');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState<NoteTheme>('slate');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      setTheme(editingNote.theme || 'slate');
    } else {
      setTitle('');
      const fallbackCat = availableCategories.includes(defaultCategory)
        ? defaultCategory
        : 'General';
      setCategory(fallbackCat);
      setContent('');
      setIsPinned(false);
      setTheme('slate');
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
      theme,
    });
  };

  const liveWordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const currentThemeConfig = NOTE_THEME_CONFIG[theme] || NOTE_THEME_CONFIG.slate;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className={`w-full max-w-sm rounded-2xl p-4 shadow-2xl space-y-3 border transition-colors ${currentThemeConfig.cardClasses}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-inherit/40 pb-2">
          <h4 className="text-xs font-bold font-display flex items-center gap-1.5">
            {isSecretVaultNote ? (
              <Lock className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {editingNote
                ? isSecretVaultNote
                  ? 'Edit Secret GM Note'
                  : 'Edit Note'
                : isSecretVaultNote
                ? 'Create Secret GM Note'
                : 'Create New Note'}
            </span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="opacity-60 hover:opacity-100 transition cursor-pointer p-0.5"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          {/* GM Theme Selector (5 Pills: Slate, Parchment, Tablet, Scroll, Journal) */}
          {isGM && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                  Handout Theme
                </label>
                <span className="text-[9px] font-mono opacity-60">
                  {currentThemeConfig.name}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-black/30 border border-white/10">
                {NOTE_THEMES.map((t) => {
                  const isSelected = theme === t;
                  const cfg = NOTE_THEME_CONFIG[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`py-1 px-1 text-[10px] font-semibold rounded transition text-center truncate cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-bold shadow-sm ring-1 ring-amber-300'
                          : 'opacity-70 hover:opacity-100 hover:bg-white/10'
                      }`}
                      title={`${cfg.name} Theme`}
                    >
                      {cfg.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="text-[10px] font-semibold opacity-75 block mb-1">
              Title *
            </label>
            <input
              type="text"
              placeholder={
                isSecretVaultNote
                  ? 'e.g. Throne Room Scene, Crimson Veil Hook, Crypt Ambush'
                  : 'e.g. Guard Captain Kenneth, Crypt Riddle, Wand of Magic Missiles'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-black/40 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 font-sans"
              required
              autoFocus
            />
          </div>

          {/* Category & Pin to top */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold opacity-75 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-black/40 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 font-sans cursor-pointer"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-slate-100">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
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

          {/* Content with Mini Markdown Helper Toolbar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold opacity-75">
                Content *
              </label>

              {/* Mini Markdown Helper Toolbar: [B] [I] [• List] [☑ Task] */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyMarkdownSyntax(textareaRef.current, 'bold', content, setContent)}
                  className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                  title="Bold (**text**)"
                >
                  <Bold className="w-2.5 h-2.5" />
                  <span>B</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyMarkdownSyntax(textareaRef.current, 'italic', content, setContent)}
                  className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[10px] font-serif italic flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                  title="Italic (*text*)"
                >
                  <Italic className="w-2.5 h-2.5" />
                  <span>I</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyMarkdownSyntax(textareaRef.current, 'list', content, setContent)}
                  className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[10px] flex items-center gap-1 cursor-pointer transition hover:text-amber-400"
                  title="Bullet List (- item)"
                >
                  <List className="w-2.5 h-2.5" />
                  <span>• List</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyMarkdownSyntax(textareaRef.current, 'task', content, setContent)}
                  className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[10px] flex items-center gap-1 cursor-pointer transition hover:text-amber-400"
                  title="Task Checkbox (- [ ] task)"
                >
                  <CheckSquare className="w-2.5 h-2.5" />
                  <span>☑ Task</span>
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              rows={5}
              placeholder={
                isSecretVaultNote
                  ? 'Write boxed text scenes, plot hooks, secret DCs, or encounter tactics...\nTip: Use **bold**, *italics*, - lists, or - [ ] tasks.'
                  : 'Write note details, dialogue, lore, reminders, or inventory...\nTip: Use **bold**, *italics*, - lists, or - [ ] tasks.'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`w-full p-2.5 text-xs rounded-xl border border-white/20 focus:outline-none focus:border-amber-400 resize-none leading-relaxed font-sans ${currentThemeConfig.contentClasses}`}
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-inherit/30">
            <span className="text-[10px] font-mono opacity-70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{liveWordCount} words</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer transition"
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
