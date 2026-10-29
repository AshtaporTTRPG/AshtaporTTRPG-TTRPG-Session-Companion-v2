/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

/**
 * Lossless migration helper converting legacy categories into the 6-category sandbox model.
 */
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

export type NoteTheme = 'slate' | 'parchment' | 'tablet' | 'scroll' | 'journal';

export const NOTE_THEMES: NoteTheme[] = [
  'slate',
  'parchment',
  'tablet',
  'scroll',
  'journal',
];

export interface NoteThemeConfig {
  name: string;
  cardClasses: string;
  contentClasses: string;
}

export const NOTE_THEME_CONFIG: Record<NoteTheme, NoteThemeConfig> = {
  slate: {
    name: 'Slate',
    cardClasses: 'bg-slate-900/90 border-slate-700/80 text-slate-100',
    contentClasses: 'bg-slate-950/60 border-slate-800 text-slate-200',
  },
  parchment: {
    name: 'Parchment',
    cardClasses: 'bg-[#f4ecd8] border-[#c8b79b] text-[#2c1d11]',
    contentClasses: 'bg-[#ede0c4] border-[#d4c3a3] text-[#2c1d11]',
  },
  tablet: {
    name: 'Tablet',
    cardClasses: 'bg-[#18232c] border-[#2e414e] text-[#d6e2e9]',
    contentClasses: 'bg-[#101820] border-[#243442] text-[#c4d4dc]',
  },
  scroll: {
    name: 'Scroll',
    cardClasses: 'bg-[#faf3e0] border-[#d8cbb5] text-[#332211]',
    contentClasses: 'bg-[#f0e4c8] border-[#cbbba0] text-[#332211]',
  },
  journal: {
    name: 'Journal',
    cardClasses: 'bg-[#2b221b] border-[#4a3b30] text-[#f2e6d8]',
    contentClasses: 'bg-[#1e1712] border-[#3d2f26] text-[#ded0bf]',
  },
};

export interface NoteItem {
  id: string;
  title: string;
  category: NoteCategory;
  content: string;
  theme?: NoteTheme;
  isPinned?: boolean;
  updatedAt?: string | number;
  createdAt?: string | number;
  authorRole?: 'GM' | 'PLAYER';
  authorName?: string;
}

// Legacy aliases for backward compatibility
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

// Room Metadata Keys
export const OBR_TABLE_NOTES_KEY = 'ashtapor/table_notes';
export const OBR_BROADCAST_NOTE_KEY = 'ashtapor/broadcast_note';

// Local Storage Keys
export const LOCAL_MY_NOTES_KEY = 'ashtapor_my_notes';
export const LOCAL_LEGACY_PLAYER_NOTES_KEY = 'ashtapor_player_notes';
export const LOCAL_GM_NOTES_KEY = 'ashtapor_gm_notes';
export const LOCAL_DM_NOTES_KEY = 'ashtapor_dm_secret_notes';
export const LOCAL_EXPANDED_NOTES_KEY = 'ashtapor_expanded_notes';
