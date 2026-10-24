import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pin, X, Bold, Italic, List, CheckSquare } from 'lucide-react';
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
  currentVault?: 'myNotes' | 'tableNotes' | 'dmNotes';
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
  currentVault = 'myNotes',
  defaultCategory = 'General',
  onClose,
  onSave,
}) => {
  const isSecretVaultNote = isGMSecretNote || isDmSecretNote || currentVault === 'dmNotes';

  // Gate category options based on isGM role:
  const availableCategories = useMemo<NoteCategory[]>(() => {
    return isGM ? GM_NOTE_CATEGORIES : PLAYER_NOTE_CATEGORIES;
  }, [isGM]);

  // Pin to top checkbox: GM only for Table/GM notes; personal in My Notes
  const canPin = isGM || currentVault === 'myNotes';

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
      isPinned: canPin ? isPinned : false,
      theme,
    });
  };

  const liveWordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const currentThemeConfig = NOTE_THEME_CONFIG[theme] || NOTE_THEME_CONFIG.slate;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {/* Modal Container: h-[85vh] max-h-[800px] flex flex-col */}
      <div
        className={`w-full max-w-2xl h-[85vh] max-h-[800px] rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col border transition-colors ${currentThemeConfig.cardClasses}`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-2">
          {/* Row 1 (Header): Inline title input with subtle border & placeholder "Note Title...", compact theme selector, close [X] */}
          <div className="flex items-center gap-2 pb-2 border-b border-inherit/30 shrink-0">
            <input
              type="text"
              placeholder="Note Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg bg-black/30 border border-white/20 text-inherit placeholder:opacity-50 focus:outline-none focus:border-amber-400 transition"
              required
              autoFocus
            />

            {/* Compact Theme Selector: Slate, Parchment, Tablet, Scroll, Journal (Available for ALL users) */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as NoteTheme)}
              aria-label="Note theme selector"
              className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-black/40 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 cursor-pointer shrink-0"
              title="Theme (Slate, Parchment, Tablet, Scroll, Journal)"
            >
              {NOTE_THEMES.map((t) => (
                <option key={t} value={t} className="bg-slate-900 text-slate-100">
                  {NOTE_THEME_CONFIG[t]?.name || t}
                </option>
              ))}
            </select>

            {/* Close [X] Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/20 transition cursor-pointer shrink-0"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2 (Utility Bar): Single slim flex row with Category dropdown, Pin to Top (GM only for Table/GM notes), Markdown helpers */}
          <div className="flex items-center justify-between gap-2 py-1 shrink-0 text-xs flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Selector Dropdown */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
                aria-label="Category selector"
                className="px-2 py-1 text-xs rounded-lg bg-black/30 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-slate-100">
                    {cat}
                  </option>
                ))}
              </select>

              {/* Pin to Top Checkbox (GM only for Table/GM notes, or personal in My Notes) */}
              {canPin && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950 cursor-pointer"
                  />
                  <span className="font-medium flex items-center gap-1 opacity-90">
                    <Pin className="w-3 h-3 text-amber-400" />
                    Pin to Top
                  </span>
                </label>
              )}
            </div>

            {/* Markdown Helper Buttons: [B] [I] [• List] [☑ Task] */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'bold', content, setContent)}
                className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Bold (**text**)"
              >
                <Bold className="w-2.5 h-2.5" />
                <span>B</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'italic', content, setContent)}
                className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] font-serif italic flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Italic (*text*)"
              >
                <Italic className="w-2.5 h-2.5" />
                <span>I</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'list', content, setContent)}
                className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] flex items-center gap-1 cursor-pointer transition hover:text-amber-400"
                title="Bullet List (- item)"
              >
                <List className="w-2.5 h-2.5" />
                <span>• List</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'task', content, setContent)}
                className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] flex items-center gap-1 cursor-pointer transition hover:text-amber-400"
                title="Task Checkbox (- [ ] task)"
              >
                <CheckSquare className="w-2.5 h-2.5" />
                <span>☑ Task</span>
              </button>
            </div>
          </div>

          {/* Row 3 (Typing Canvas): flex-1 w-full min-h-[300px] resize-none displaying 20-25 lines */}
          <textarea
            ref={textareaRef}
            placeholder={
              isSecretVaultNote
                ? 'Write boxed text scenes, plot hooks, secret DCs, or encounter tactics...\nTip: Use # for encounters, ## for sub-sections, - lists, or - [ ] tasks.'
                : 'Write note details, dialogue, lore, reminders, or inventory...\nTip: Use # for encounters, ## for sub-sections, - lists, or - [ ] tasks.'
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`flex-1 w-full min-h-[300px] resize-none p-3 text-xs sm:text-sm rounded-xl border border-white/20 focus:outline-none focus:border-amber-400 leading-relaxed font-sans ${currentThemeConfig.contentClasses}`}
            required
          />

          {/* Row 4 (Footer): Word count on left; Cancel and Save Changes buttons on right */}
          <div className="flex items-center justify-between pt-2 border-t border-inherit/30 shrink-0">
            <span className="text-[11px] font-mono opacity-70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{liveWordCount} {liveWordCount === 1 ? 'word' : 'words'}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer transition"
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
