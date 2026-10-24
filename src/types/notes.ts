export type NoteCategory =
  | 'General'
  | 'NPC'
  | 'Quest'
  | 'Combat'
  | 'Loot'
  | 'Location'
  | 'Scene'
  | 'Hook';

export const NOTE_CATEGORIES: NoteCategory[] = [
  'General',
  'NPC',
  'Quest',
  'Combat',
  'Loot',
  'Location',
  'Scene',
  'Hook',
];

export const PLAYER_NOTE_CATEGORIES: NoteCategory[] = [
  'General',
  'NPC',
  'Quest',
  'Loot',
  'Location',
];

export const GM_NOTE_CATEGORIES: NoteCategory[] = [
  'General',
  'NPC',
  'Quest',
  'Combat',
  'Loot',
  'Location',
  'Scene',
  'Hook',
];

export function getAvailableCategories(isGM: boolean): NoteCategory[] {
  return isGM ? GM_NOTE_CATEGORIES : PLAYER_NOTE_CATEGORIES;
}

export type NoteTheme = 'slate' | 'parchment' | 'tablet' | 'scroll' | 'journal';

export const NOTE_THEMES: NoteTheme[] = ['slate', 'parchment', 'tablet', 'scroll', 'journal'];

export interface NoteItem {
  id: string;
  title: string;
  category?: NoteCategory;
  content: string;
  theme?: NoteTheme;
  isPinned?: boolean;
  updatedAt: string | number;
  createdAt?: string | number;
  authorRole?: 'GM' | 'PLAYER';
  authorName?: string;
}

export interface NotesExportPayload {
  version: string;
  exportedAt: string;
  source: 'ashtapor-session-companion';
  notes: NoteItem[];
}

export interface DmSecretNote {
  id: string;
  title: string;
  content: string;
  category?: NoteCategory;
  theme?: NoteTheme;
  isRevealed?: boolean;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type GmSecretNote = DmSecretNote;

export interface BroadcastNotePayload {
  id: string;
  title: string;
  content: string;
  theme?: NoteTheme;
  broadcastAt: number;
}

export type NotesScope =
  | 'my-notes'
  | 'table-notes'
  | 'dm-notes'
  | 'gm-notes'
  | 'myNotes'
  | 'tableNotes'
  | 'dmNotes'
  | 'gmNotes';

export const OBR_TABLE_NOTES_KEY = 'com.ashtapor.session-companion/table-notes';
export const OBR_LEGACY_TABLE_NOTES_KEY = 'com.ashtapor.companion/table-notes';
export const OBR_BROADCAST_NOTE_KEY = 'com.ashtapor.companion/broadcast-note';

export const LOCAL_MY_NOTES_KEY = 'ashtapor_my_notes';
export const LOCAL_LEGACY_PLAYER_NOTES_KEY = 'ashtapor_player_notes_v2';
export const LOCAL_TABLE_NOTES_KEY = 'ashtapor_table_notes_cache';
export const LOCAL_DM_NOTES_KEY = 'ashtapor_dm_secret_notes';
export const LOCAL_DM_COLLAPSED_KEY = 'ashtapor_dm_notes_collapsed_v1';
export const LOCAL_COLLAPSED_NOTES_KEY = 'ashtapor_notes_collapsed_v1';

export type NotesSubTab = 'myNotes' | 'tableNotes' | 'gm' | 'dmNotes';

export const NOTE_THEME_CONFIG: Record<
  NoteTheme,
  {
    name: string;
    cardClasses: string;
    contentClasses: string;
    textClasses: string;
    previewClasses: string;
  }
> = {
  slate: {
    name: 'Slate',
    cardClasses: 'bg-slate-900 border-slate-700/60 text-slate-100 font-sans',
    contentClasses: 'bg-slate-950/70 border-slate-800/70 text-slate-200 font-sans',
    textClasses: 'text-slate-100 font-sans',
    previewClasses: 'bg-slate-900 border-slate-700 text-slate-100',
  },
  parchment: {
    name: 'Parchment',
    cardClasses: 'bg-[#f4ebd0] border-amber-800/40 text-stone-900 font-serif',
    contentClasses: 'bg-amber-100/70 border-amber-800/30 text-stone-900 font-serif',
    textClasses: 'text-stone-900 font-serif',
    previewClasses: 'bg-[#f4ebd0] border-amber-800/40 text-stone-900',
  },
  tablet: {
    name: 'Tablet',
    cardClasses: 'bg-zinc-900 border-zinc-600 text-zinc-100 font-mono uppercase tracking-wide',
    contentClasses: 'bg-zinc-950 border-zinc-700 text-zinc-200 font-mono tracking-wide',
    textClasses: 'text-zinc-100 font-mono uppercase',
    previewClasses: 'bg-zinc-900 border-zinc-600 text-zinc-100',
  },
  scroll: {
    name: 'Scroll',
    cardClasses: 'bg-slate-950 border-indigo-500/60 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
    contentClasses: 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100 font-sans',
    textClasses: 'text-indigo-100 font-sans',
    previewClasses: 'bg-slate-950 border-indigo-500 text-indigo-100',
  },
  journal: {
    name: 'Journal',
    cardClasses: 'bg-[#241c15] border-amber-900/50 text-amber-100/90 font-serif',
    contentClasses: 'bg-[#18120c] border-amber-900/40 text-amber-100/90 font-serif',
    textClasses: 'text-amber-100 font-serif',
    previewClasses: 'bg-[#241c15] border-amber-900 text-amber-100',
  },
};

