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

export interface NoteItem {
  id: string;
  title: string;
  category?: NoteCategory;
  content: string;
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
  isRevealed?: boolean;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BroadcastNotePayload {
  id: string;
  title: string;
  content: string;
  broadcastAt: number;
}

export type NotesScope = 'my-notes' | 'table-notes' | 'dm-notes' | 'myNotes' | 'tableNotes' | 'dmNotes';

export const OBR_TABLE_NOTES_KEY = 'com.ashtapor.session-companion/table-notes';
export const OBR_LEGACY_TABLE_NOTES_KEY = 'com.ashtapor.companion/table-notes';
export const OBR_BROADCAST_NOTE_KEY = 'com.ashtapor.companion/broadcast-note';

export const LOCAL_MY_NOTES_KEY = 'ashtapor_my_notes';
export const LOCAL_LEGACY_PLAYER_NOTES_KEY = 'ashtapor_player_notes_v2';
export const LOCAL_TABLE_NOTES_KEY = 'ashtapor_table_notes_cache';
export const LOCAL_DM_NOTES_KEY = 'ashtapor_dm_secret_notes';
export const LOCAL_DM_COLLAPSED_KEY = 'ashtapor_dm_notes_collapsed_v1';
export const LOCAL_COLLAPSED_NOTES_KEY = 'ashtapor_notes_collapsed_v1';
