/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NoteItem,
  normalizeCategory,
  LOCAL_MY_NOTES_KEY,
  LOCAL_LEGACY_PLAYER_NOTES_KEY,
  LOCAL_GM_NOTES_KEY,
  LOCAL_DM_NOTES_KEY,
} from '../types/notes';

/**
 * Sanitizes an array of notes, migrating legacy categories into the 6-category sandbox model.
 */
export function sanitizeNotesList(rawList: any[]): NoteItem[] {
  if (!Array.isArray(rawList)) return [];

  return rawList
    .filter((item) => item && (typeof item.title === 'string' || typeof item.content === 'string'))
    .map((item, idx) => ({
      id: item.id || `sanitized-${Date.now()}-${idx}`,
      title: (item.title || 'Untitled Note').trim(),
      category: normalizeCategory(item.category),
      content: typeof item.content === 'string' ? item.content : '',
      theme: item.theme || 'slate',
      isPinned: Boolean(item.isPinned),
      updatedAt: item.updatedAt || new Date().toISOString(),
      createdAt: item.createdAt || new Date().toISOString(),
      authorRole: item.authorRole || 'GM',
      authorName: item.authorName || 'Game Master',
    }));
}

let hasRunBootSanitizer = false;

/**
 * Runs a single boot-time pass across local storage to normalize legacy note categories.
 */
export function runBootSanitizerOnce(): void {
  if (hasRunBootSanitizer) return;
  hasRunBootSanitizer = true;

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    const keys = [
      LOCAL_MY_NOTES_KEY,
      LOCAL_LEGACY_PLAYER_NOTES_KEY,
      LOCAL_GM_NOTES_KEY,
      LOCAL_DM_NOTES_KEY,
    ];

    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = sanitizeNotesList(parsed);
            localStorage.setItem(key, JSON.stringify(sanitized));
          }
        } catch {
          // Ignore parse errors on malformed entries
        }
      }
    });
  } catch (err) {
    console.warn('Failed running boot notes sanitizer:', err);
  }
}
