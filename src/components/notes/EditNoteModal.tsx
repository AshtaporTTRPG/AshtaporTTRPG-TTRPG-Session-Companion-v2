/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Pin,
  X,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Minus,
  List,
  CheckSquare,
} from 'lucide-react';
import {
  NoteCategory,
  NoteItem,
  GmSecretNote,
  DmSecretNote,
  NoteTheme,
  NOTE_THEMES,
  NOTE_THEME_CONFIG,
  getAvailableCategories,
  normalizeCategory,
} from '../../types/notes';
import { applyMarkdownSyntax } from '../../utils/markdownRenderer';

export const SANDBOX_PREP_TEMPLATES: Record<string, string> = {
  General: `### Review consequences of previous actions
- [ ] Consequence 1
- [ ] Consequence 2
---
### Timeline events / messages
- [ ] Event 1
- [ ] Event 2
- [ ] Message 1
- [ ] Message 2
---
### Potential encounters / scenes
- [ ] Scene 1
- [ ] Scene 2
---
### End-of-session
- [ ] Recap
- [ ] What's next`,

  NPC: `# [NPC Name]
- **Role/Faction:** [Relationship / Affiliation]
- **Nature:** [Friendly / Neutral / Hostile]
- **Immediate Want:** [Goal]
- **What They Know:** [Key information or lead]
- **Leverage / DC:** [Persuasion DC 14 / Intimidation DC 16 / Bribe]
- **Mannerism / Tell:** [Voice, phrase, or physical quirk]`,

  Location: `# [Region Name]
[environment description]
- **Key Features:** [Notable landmark, door, altar, or hazard]
- **Search DC:** [Any Skill checks]
- **Hidden items / Lore:** [List]`,

  Loot: `# Loot: [Source Name]
- **Coin / Valuables:** [Units or gemstones]
- **Items / Potions:** [Consumables or gear]
- **Special / Magic Item:** [Item name, attunement, 1-line mechanic]`,

  Encounters: `# Encounter: [Name / Threat Level]
- **Type / Vibe:** [Combat / Trap / Social / Vision]
- **Opening / Trigger:** [What starts it or what players see]
- **Tactics / Mechanics:** [Target priority, DC 14 check, hazard]
- **Recycle Hook:** [Where else this can take place if bypassed]`,

  Leads: `# Lead: [Title / Inscription]
"[Exact rumor, inscription text, or letter content]"
- **Source:** [Who tells them or where it is found]
- **Check / Verify:** [What a check reveals]
- **Points To:** [Target NPC, faction, or location]`,
};

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
    theme?: NoteTheme;
  }) => void;
}

export const EditNoteModal: React.FC<EditNoteModalProps> = ({
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
  const isSecretVaultNote =
    isGMSecretNote || isDmSecretNote || currentVault === 'gmNotes' || currentVault === 'dmNotes';

  const availableCategories = useMemo<NoteCategory[]>(() => {
    return getAvailableCategories(isGM);
  }, [isGM]);

  // Pin to top: GM only for Table/GM notes; personal in My Notes
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
      const initialCat = normalizeCategory(editingNote.category);
      setCategory(initialCat);
      setContent(editingNote.content || '');
      setIsPinned(Boolean(editingNote.isPinned));
      setTheme(editingNote.theme || 'slate');
    } else {
      setTitle('');
      const fallbackCat = normalizeCategory(defaultCategory);
      setCategory(fallbackCat);
      setContent('');
      setIsPinned(false);
      setTheme('slate');
    }
  }, [isOpen, editingNote, defaultCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const finalCategory: NoteCategory = normalizeCategory(category);

    onSave({
      title: title.trim(),
      category: finalCategory,
      content: content.trim(),
      isPinned: canPin ? isPinned : false,
      theme,
    });
  };

  const handleInsertTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (!selected || !SANDBOX_PREP_TEMPLATES[selected]) return;

    const template = SANDBOX_PREP_TEMPLATES[selected];

    if (!content.trim()) {
      setContent(template);
    } else {
      setContent((prev) => `${prev.trim()}\n\n---\n\n${template}`);
    }

    setCategory(normalizeCategory(selected));
    e.target.value = '';
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const currentThemeConfig = NOTE_THEME_CONFIG[theme] || NOTE_THEME_CONFIG.slate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full h-[96vh] max-h-[96vh] flex flex-col overflow-hidden rounded-xl shadow-2xl border transition-all ${currentThemeConfig.cardClasses}`}
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

            {/* Theme Selector */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as NoteTheme)}
              aria-label="Note theme selector"
              className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-black/40 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 cursor-pointer shrink-0"
              title="Handout Theme (Slate, Parchment, Tablet, Scroll, Journal)"
            >
              {NOTE_THEMES.map((t) => (
                <option key={t} value={t} className="bg-slate-900 text-slate-100 font-sans">
                  {NOTE_THEME_CONFIG[t]?.name || t}
                </option>
              ))}
            </select>

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

          {/* Toolbar */}
          <div className="shrink-0 px-3 py-1.5 border-b border-inherit/30 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Dropdown */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
                aria-label="Category selector"
                className="px-2 py-1 text-xs rounded-lg bg-black/30 border border-white/20 text-inherit focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-slate-100 font-sans">
                    {cat}
                  </option>
                ))}
              </select>

              {/* 1-Click Sandbox Template Dropdown */}
              <select
                onChange={handleInsertTemplate}
                defaultValue=""
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 focus:outline-none focus:border-amber-400 cursor-pointer transition"
                title="Insert Sandbox Prep Template"
                aria-label="Insert Sandbox Prep Template"
              >
                <option value="" disabled className="bg-slate-900 text-slate-300">
                  📋 Insert Template...
                </option>
                <option value="General" className="bg-slate-900 text-slate-100 font-sans">
                  General: Session Agenda
                </option>
                <option value="NPC" className="bg-slate-900 text-slate-100 font-sans">
                  NPC: Contact
                </option>
                <option value="Location" className="bg-slate-900 text-slate-100 font-sans">
                  Location: Waypoint
                </option>
                <option value="Loot" className="bg-slate-900 text-slate-100 font-sans">
                  Loot: Treasure or Parcels
                </option>
                <option value="Encounters" className="bg-slate-900 text-slate-100 font-sans">
                  Encounters: Combat or Social
                </option>
                <option value="Leads" className="bg-slate-900 text-slate-100 font-sans">
                  Leads: Clues or Hooks
                </option>
              </select>

              {/* Pin to Top */}
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

            {/* Markdown Helper Tools */}
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
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
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'underline', content, setContent)}
                className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] underline flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Underline (__text__)"
              >
                <UnderlineIcon className="w-2.5 h-2.5" />
                <span>U</span>
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
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarkdownSyntax(textareaRef.current, 'divider', content, setContent)}
                className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 text-[11px] flex items-center gap-0.5 cursor-pointer transition hover:text-amber-400"
                title="Line Divider (---)"
              >
                <Minus className="w-2.5 h-2.5" />
                <span>Line</span>
              </button>
            </div>
          </div>

          {/* Textarea Canvas */}
          <div className="flex-1 min-h-0 p-3 flex flex-col">
            <textarea
              ref={textareaRef}
              className={`w-full flex-1 min-h-0 resize-none rounded-lg p-3 text-xs sm:text-sm focus:outline-none focus:border-amber-500/60 leading-relaxed overflow-y-auto border border-white/20 ${currentThemeConfig.contentClasses}`}
              placeholder={
                isSecretVaultNote
                  ? 'Write boxed text scenes, plot hooks, secret DCs, encounter tactics, or riddles...\nTip: Choose "📋 Insert Template..." above to scaffold structured notes instantly.'
                  : 'Write note details, dialogue, clues, reminders, or inventory...\nTip: Choose "📋 Insert Template..." above to scaffold structured notes instantly.'
              }
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
