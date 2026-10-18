/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteItem } from '../types/notes';

export const DEMO_NOTE_TITLES = new Set([
  'campaign shared objectives',
  'party treasury & shared gear',
  'the brazen anchor tavern',
  'personal objectives',
  'elara & town contacts',
  'purple rune clue',
  'purse & magic items',
]);

/**
 * Filter out hardcoded demo notes from any array of notes.
 */
export function sanitizeNotesList<T extends { title?: string }>(notes: T[]): T[] {
  if (!Array.isArray(notes)) return [];
  return notes.filter((n) => {
    if (!n || typeof n !== 'object') return false;
    const title = (n.title || '').trim().toLowerCase();
    return !DEMO_NOTE_TITLES.has(title);
  });
}

const BOOT_SANITIZED_KEY = 'ashtapor_demo_notes_purged_v2_0_23';

/**
 * One-time boot sanitizer filtering out hardcoded demo titles from existing local storage.
 */
export function runBootSanitizerOnce(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(BOOT_SANITIZED_KEY) === 'true') return;

    const storageKeys = [
      'ashtapor_my_notes',
      'ashtapor_table_notes',
      'ashtapor_legacy_player_notes',
      'ashtapor_table_notes_backup',
      'ashtapor_my_roster',
    ];

    for (const key of storageKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            if (key === 'ashtapor_my_roster') {
              const cleaned = parsed.filter(
                (m) => m && m.id !== 'roster-valerius' && m.name?.trim().toLowerCase() !== 'valerius'
              );
              localStorage.setItem(key, JSON.stringify(cleaned));
            } else {
              const cleaned = sanitizeNotesList(parsed);
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        } catch {}
      }
    }

    localStorage.setItem(BOOT_SANITIZED_KEY, 'true');
  } catch (err) {
    console.warn('Boot sanitizer error:', err);
  }
}
