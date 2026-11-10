/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NoteColor =
  | 'slate'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'purple';

export const NOTE_COLORS: NoteColor[] = [
  'slate',
  'rose',
  'amber',
  'emerald',
  'teal',
  'sky',
  'purple',
];

export interface NoteColorConfig {
  id: NoteColor;
  name: string;
  dotColor: string;
  cardClasses: string;
  borderClass: string;
  tagClass: string;
}

export const NOTE_COLOR_CONFIG: Record<NoteColor, NoteColorConfig> = {
  slate: {
    id: 'slate',
    name: 'Default Slate',
    dotColor: 'bg-slate-600',
    cardClasses: 'bg-slate-900/90 border-slate-700/80 text-slate-100',
    borderClass: 'border-l-slate-500',
    tagClass: 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-slate-100',
  },
  rose: {
    id: 'rose',
    name: 'Crimson / Combat',
    dotColor: 'bg-rose-600',
    cardClasses: 'bg-rose-950/20 border-rose-900/60 text-rose-100',
    borderClass: 'border-l-rose-500',
    tagClass: 'bg-rose-950/60 text-rose-300 border-rose-800/80 hover:border-rose-500 hover:text-rose-100',
  },
  amber: {
    id: 'amber',
    name: 'Amber / Quests',
    dotColor: 'bg-amber-500',
    cardClasses: 'bg-amber-950/20 border-amber-900/60 text-amber-100',
    borderClass: 'border-l-amber-500',
    tagClass: 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:border-amber-500 hover:text-amber-100',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald / Loot',
    dotColor: 'bg-emerald-600',
    cardClasses: 'bg-emerald-950/20 border-emerald-900/60 text-emerald-100',
    borderClass: 'border-l-emerald-500',
    tagClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:border-emerald-500 hover:text-emerald-100',
  },
  teal: {
    id: 'teal',
    name: 'Teal / Leads',
    dotColor: 'bg-teal-600',
    cardClasses: 'bg-teal-950/20 border-teal-900/60 text-teal-100',
    borderClass: 'border-l-teal-500',
    tagClass: 'bg-teal-950/60 text-teal-300 border-teal-800/80 hover:border-teal-500 hover:text-teal-100',
  },
  sky: {
    id: 'sky',
    name: 'Sky / Magic',
    dotColor: 'bg-sky-600',
    cardClasses: 'bg-sky-950/20 border-sky-900/60 text-sky-100',
    borderClass: 'border-l-sky-500',
    tagClass: 'bg-sky-950/60 text-sky-300 border-sky-800/80 hover:border-sky-500 hover:text-sky-100',
  },
  purple: {
    id: 'purple',
    name: 'Purple / Arcana',
    dotColor: 'bg-purple-600',
    cardClasses: 'bg-purple-950/20 border-purple-900/60 text-purple-100',
    borderClass: 'border-l-purple-500',
    tagClass: 'bg-purple-950/60 text-purple-300 border-purple-800/80 hover:border-purple-500 hover:text-purple-100',
  },
};

/**
 * Resolves color from new color property or maps legacy theme/category losslessly.
 */
export function resolveNoteColor(rawColor?: string, rawTheme?: string, rawCat?: string): NoteColor {
  if (rawColor && rawColor in NOTE_COLOR_CONFIG) return rawColor as NoteColor;
  if (rawTheme && rawTheme in NOTE_COLOR_CONFIG) return rawTheme as NoteColor;
  if (rawTheme === 'parchment' || rawTheme === 'scroll') return 'amber';
  if (rawTheme === 'tablet') return 'sky';
  if (rawCat === 'Encounters' || rawCat === 'Combat') return 'rose';
  if (rawCat === 'NPC') return 'amber';
  if (rawCat === 'Loot') return 'emerald';
  if (rawCat === 'Leads' || rawCat === 'Clue' || rawCat === 'Quest') return 'teal';
  if (rawCat === 'Location') return 'purple';
  return 'slate';
}

export type NoteCategory =
  | 'General'
  | 'NPC'
  | 'Location'
  | 'Loot'
  | 'Encounters'
  | 'Leads';

export const NOTE_CATEGORIES: NoteCategory[] = [
  'General',
  'NPC',
  'Location',
  'Loot',
  'Encounters',
  'Leads',
];

export function normalizeCategory(rawCat?: string): NoteCategory {
  if (!rawCat) return 'General';
  if (rawCat === 'Combat' || rawCat === 'Scene') return 'Encounters';
  if (rawCat === 'Hook' || rawCat === 'Clue' || rawCat === 'Quest') return 'Leads';
  if (NOTE_CATEGORIES.includes(rawCat as NoteCategory)) return rawCat as NoteCategory;
  return 'General';
}

export function getAvailableCategories(_isGM?: boolean): NoteCategory[] {
  return NOTE_CATEGORIES;
}

export type NoteTheme = NoteColor | 'parchment' | 'tablet' | 'scroll' | 'journal';

export const NOTE_THEMES: NoteTheme[] = [
  'slate',
  'rose',
  'amber',
  'emerald',
  'teal',
  'sky',
  'purple',
];

export const NOTE_THEME_CONFIG: Record<string, { name: string; cardClasses: string; contentClasses: string }> = {
  slate: {
    name: 'Slate',
    cardClasses: 'bg-slate-900/90 border-slate-700/80 text-slate-100',
    contentClasses: 'bg-slate-950/60 border-slate-800 text-slate-200',
  },
  rose: {
    name: 'Crimson',
    cardClasses: 'bg-rose-950/20 border-rose-900/60 text-rose-100',
    contentClasses: 'bg-rose-950/40 border-rose-900/80 text-rose-200',
  },
  amber: {
    name: 'Amber',
    cardClasses: 'bg-amber-950/20 border-amber-900/60 text-amber-100',
    contentClasses: 'bg-amber-950/40 border-amber-900/80 text-amber-200',
  },
  emerald: {
    name: 'Emerald',
    cardClasses: 'bg-emerald-950/20 border-emerald-900/60 text-emerald-100',
    contentClasses: 'bg-emerald-950/40 border-emerald-900/80 text-emerald-200',
  },
  teal: {
    name: 'Teal',
    cardClasses: 'bg-teal-950/20 border-teal-900/60 text-teal-100',
    contentClasses: 'bg-teal-950/40 border-teal-900/80 text-teal-200',
  },
  sky: {
    name: 'Sky',
    cardClasses: 'bg-sky-950/20 border-sky-900/60 text-sky-100',
    contentClasses: 'bg-sky-950/40 border-sky-900/80 text-sky-200',
  },
  purple: {
    name: 'Purple',
    cardClasses: 'bg-purple-950/20 border-purple-900/60 text-purple-100',
    contentClasses: 'bg-purple-950/40 border-purple-900/80 text-purple-200',
  },
  parchment: {
    name: 'Amber',
    cardClasses: 'bg-amber-950/20 border-amber-900/60 text-amber-100',
    contentClasses: 'bg-amber-950/40 border-amber-900/80 text-amber-200',
  },
  tablet: {
    name: 'Sky',
    cardClasses: 'bg-sky-950/20 border-sky-900/60 text-sky-100',
    contentClasses: 'bg-sky-950/40 border-sky-900/80 text-sky-200',
  },
  scroll: {
    name: 'Amber',
    cardClasses: 'bg-amber-950/20 border-amber-900/60 text-amber-100',
    contentClasses: 'bg-amber-950/40 border-amber-900/80 text-amber-200',
  },
  journal: {
    name: 'Slate',
    cardClasses: 'bg-slate-900/90 border-slate-700/80 text-slate-100',
    contentClasses: 'bg-slate-950/60 border-slate-800 text-slate-200',
  },
};

export interface NoteItem {
  id: string;
  title: string;
  category?: NoteCategory;
  content: string;
  theme?: string;
  color?: NoteColor;
  isPinned?: boolean;
  updatedAt?: string | number;
  createdAt?: string | number;
  authorRole?: 'GM' | 'PLAYER';
  authorName?: string;
}

export type Note = NoteItem;
export type GmSecretNote = NoteItem;
export type DmSecretNote = NoteItem;

export interface BroadcastNotePayload {
  id: string;
  title: string;
  content: string;
  theme: NoteTheme;
  author: string;
  timestamp: number;
}

export type NotesScope = 'myNotes' | 'tableNotes' | 'gmNotes';

export type NoteTransferAction =
  | 'copy_to_table'
  | 'move_to_table'
  | 'copy_to_my'
  | 'move_to_my'
  | 'copy_to_gm'
  | 'move_to_gm';

export interface NotesExportPayload {
  version: string;
  exportedAt: string;
  source: string;
  notes: NoteItem[];
}

export const OBR_TABLE_NOTES_KEY = 'ashtapor/table_notes';
export const OBR_BROADCAST_NOTE_KEY = 'ashtapor/broadcast_note';

export const LOCAL_MY_NOTES_KEY = 'ashtapor_my_notes';
export const LOCAL_LEGACY_PLAYER_NOTES_KEY = 'ashtapor_player_notes';
export const LOCAL_GM_NOTES_KEY = 'ashtapor_gm_notes';
export const LOCAL_DM_NOTES_KEY = 'ashtapor_dm_secret_notes';
export const LOCAL_EXPANDED_NOTES_KEY = 'ashtapor_expanded_notes';
