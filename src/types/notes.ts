/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NoteCategory =
  | 'General'
  | 'Loot'
  | 'NPC'
  | 'Location'
  | 'Combat'
  | 'Scene'
  | 'Hook'
  | 'Clue'
  | 'Quest'; // Retained for backward-compatibility with existing room metadata

export const NOTE_CATEGORIES: NoteCategory[] = [
  'General',
  'Loot',
  'NPC',
  'Location',
  'Combat',
  'Scene',
  'Hook',
  'Clue',
];

// All categories available to players and GM for session scribbles
export const PLAYER_NOTE_CATEGORIES: NoteCategory[] = NOTE_CATEGORIES;
export const GM_NOTE_CATEGORIES: NoteCategory[] = NOTE_CATEGORIES;

export function getAvailableCategories(_isGM?: boolean): NoteCategory[] {
  return NOTE_CATEGORIES;
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
  isRevealed?: boolean;
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

// Unified GM types: GmSecretNote uses NoteItem schema
export type GmSecretNote = NoteItem;

// Backward-compatibility alias for existing components during transition
export type DmSecretNote = NoteItem;
export type Note = NoteItem;

export interface BroadcastNotePayload {
  id: string;
  title: string;
  content: string;
  theme?: NoteTheme;
  author?: string;
  timestamp?: number;
  broadcastAt?: number;
}

export type NoteTransferAction =
  | 'copy_to_table'
  | 'move_to_table'
  | 'copy_to_my'
  | 'move_to_my'
  | 'copy_to_gm'
  | 'move_to_gm'
  | 'move_to_dm'; // Backward-compatibility alias

export type NotesScope =
  | 'my-notes'
  | 'table-notes'
  | 'gm-notes'
  | 'myNotes'
  | 'tableNotes'
  | 'gmNotes'
  | 'dmNotes'; // Backward-compatibility alias

// Room Metadata Keys
export const OBR_TABLE_NOTES_KEY = 'ashtapor/table_notes';
export const OBR_LEGACY_TABLE_NOTES_KEY = 'com.ashtapor.session-companion/table-notes';
export const OBR_PREV_TABLE_NOTES_KEY = 'com.ashtapor.companion/table-notes';
export const OBR_BROADCAST_NOTE_KEY = 'ashtapor/broadcast_note';

// Client Local Storage Keys
export const LOCAL_MY_NOTES_KEY = 'ashtapor_my_notes';
export const LOCAL_LEGACY_PLAYER_NOTES_KEY = 'ashtapor_player_notes_v2';
export const LOCAL_TABLE_NOTES_KEY = 'ashtapor_table_notes_cache';
export const LOCAL_GM_NOTES_KEY = 'ashtapor_gm_notes';
export const LOCAL_DM_NOTES_KEY = 'ashtapor_dm_secret_notes'; // Legacy fallback
export const LOCAL_EXPANDED_NOTES_KEY = 'ashtapor_notes_expanded_ids';
export const LOCAL_COLLAPSED_NOTES_KEY = 'ashtapor_notes_collapsed_v1';

export type NotesSubTab = 'myNotes' | 'tableNotes' | 'gmNotes' | 'gm' | 'dmNotes';

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
