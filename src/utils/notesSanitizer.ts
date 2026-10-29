/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteItem, normalizeCategory } from '../types/notes';

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
