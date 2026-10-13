import React, { useState, useEffect, useCallback, useRef } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import {
  User,
  Scroll,
  Lock,
  Clock,
  Check,
} from 'lucide-react';
import {
  NoteItem,
  DmSecretNote,
  BroadcastNotePayload,
  NotesScope,
  OBR_TABLE_NOTES_KEY,
  OBR_LEGACY_TABLE_NOTES_KEY,
  OBR_BROADCAST_NOTE_KEY,
  LOCAL_MY_NOTES_KEY,
  LOCAL_LEGACY_PLAYER_NOTES_KEY,
  LOCAL_TABLE_NOTES_KEY,
  LOCAL_DM_NOTES_KEY,
} from '../../types/notes';
import { ROOM_METADATA_KEY } from '../../utils/obrCombatSync';
import { NoteCardList } from './NoteCardList';
import { DmNotesVault } from '../DmNotesVault';

// Re-export for App.tsx and external consumers
export type { BroadcastNotePayload, NotesScope } from '../../types/notes';
export { OBR_BROADCAST_NOTE_KEY, OBR_TABLE_NOTES_KEY } from '../../types/notes';

export const LOCAL_EXPANDED_NOTES_KEY = 'ashtapor_notes_expanded_ids';

const DEFAULT_MY_NOTES: NoteItem[] = [
  {
    id: 'my-note-1',
    title: 'Personal Objectives',
    category: 'General',
    content:
      '• Track down the apothecary who sold the cursed draught.\n• Restock rations, sharpen daggers, prepare protection scrolls.\n• Intuitions: The hooded guide in the tavern seemed unusually familiar with the crypt.',
    isPinned: true,
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'my-note-2',
    title: 'Elara & Town Contacts',
    category: 'NPC',
    content:
      '• Elara the Herbalist: Owed 20 GP for dried belladonna.\n• Captain Kenneth: Guard captain, fair-minded but under pressure from the magistrate.\n• Malakor the Blind: Mystic hermit in the marsh; warned of stone statues that walk at night.',
    isPinned: false,
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'my-note-3',
    title: 'Purse & Magic Items',
    category: 'Loot',
    content:
      '• My Purse: 45 GP, 12 SP\n• Valerius: +1 Longsword (attuned)\n• Elara: Wand of Magic Missiles (4 charges remaining)\n• Personal Bag: 50ft silk rope, 3 torches, pouch of crushed obsidian',
    isPinned: false,
    updatedAt: new Date(Date.now() - 10800000).toISOString(),
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: 'my-note-4',
    title: 'Purple Rune Clue',
    category: 'Quest',
    content:
      '• Purple rune etched on the crypt lintel matches the abjuration sigil from the ruined temple.\n• Cipher snippet: "When the eclipse turns the obsidian spire red."',
    isPinned: false,
    updatedAt: new Date(Date.now() - 14400000).toISOString(),
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
];

const DEFAULT_TABLE_NOTES: NoteItem[] = [
  {
    id: 'table-note-1',
    title: 'Campaign Shared Objectives',
    category: 'Quest',
    content:
      '• Primary Quest: Infiltrate the Sunken Catacombs beneath Ashtapor.\n• Active Bounty: Recover the stolen Relic of the Sun Father.\n• Investigate the disappearance of the merchant caravan along the south road.',
    isPinned: true,
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    authorRole: 'GM',
    authorName: 'Game Master',
  },
  {
    id: 'table-note-2',
    title: 'Party Treasury & Shared Gear',
    category: 'Loot',
    content:
      '• Party Treasury: 580 GP, 110 SP, 3 uncut amethyst gems (50 GP each)\n• Shared Cart: 4x Potion of Healing, 2x Antitoxin vials, 100ft hempen rope, heavy crowbar.\n• Rations: 18 days of party rations remaining.',
    isPinned: false,
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    authorRole: 'GM',
    authorName: 'Game Master',
  },
  {
    id: 'table-note-3',
    title: 'The Brazen Anchor Tavern',
    category: 'Location',
    content:
      '• 3rd floor suite reserved for 5 nights.\n• Local contacts: Barkeep Jonas (friendly), Guard Patrol (suspicious).\n• Cellar door has a sturdy iron padlock.',
    isPinned: false,
    updatedAt: new Date(Date.now() - 10800000).toISOString(),
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    authorRole: 'GM',
    authorName: 'Game Master',
  },
];

const DEFAULT_DM_NOTES: DmSecretNote[] = [
  {
    id: 'dm-note-1',
    title: 'Ambush at the Sunken Bridge',
    content:
      'Trigger: When the party advances past the broken gargoyle, 4 Shadow Archers fire from murder holes (AC 13, HP 14, +5 to hit, 1d8+3 piercing + 1d6 necrotic).\n\nTrap DC 15 Perception: Hidden pressure plate at bridge center trips a falling portcullis (DC 14 Dex save or 2d10 bludgeoning and pinned).',
    category: 'Combat',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'dm-note-2',
    title: 'The Inquisitor’s True Identity',
    content:
      'Inquisitor Vane is secretly a doppelganger working under the orders of the Crimson Veil. If inspected with True Seeing or Divine Sense, detects as Monstrosity (Shapechanger).\n\nIf captured alive, carries a silver ring bearing the serpent crest of House Ashtapor.',
    category: 'NPC',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
];

/**
 * Helper to read stored expanded IDs from localStorage
 */
function loadExpandedIdsFromStorage(): Set<string> | null {
  try {
    const raw = localStorage.getItem(LOCAL_EXPANDED_NOTES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set<string>(parsed);
      }
    }
  } catch (e) {
    console.warn('Could not read stored expanded notes from localStorage:', e);
  }
  return null;
}

/**
 * Helper to save expanded IDs to localStorage
 */
function persistExpandedIdsToStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_EXPANDED_NOTES_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.warn('Could not save expanded notes to localStorage:', e);
  }
}

/**
 * Migration helper: converts legacy data (string, old object, or array) into NoteItem[]
 */
function migrateToNoteCards(
  raw: any,
  fallbackDefaults: NoteItem[],
  defaultAuthor?: { role: 'GM' | 'PLAYER'; name: string }
): NoteItem[] {
  if (!raw) return fallbackDefaults;

  // Case 1: Raw string note (from legacy single textarea)
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return fallbackDefaults;
    return [
      {
        id: 'legacy-1',
        title: 'Imported Note',
        content: trimmed,
        category: 'General',
        isPinned: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: defaultAuthor?.role,
        authorName: defaultAuthor?.name,
      },
    ];
  }

  // Case 2: Array of items
  if (Array.isArray(raw)) {
    if (raw.length === 0) return fallbackDefaults;
    return raw.map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `legacy-${index + 1}`,
          title: `Note ${index + 1}`,
          content: item,
          category: 'General',
          isPinned: false,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
      }
      return {
        id: item.id || `note-${Date.now()}-${index}`,
        title: item.title || 'Untitled Note',
        category: item.category || 'General',
        content: typeof item.content === 'string' ? item.content : '',
        isPinned: !!item.isPinned,
        updatedAt: item.updatedAt || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
        authorRole: item.authorRole || defaultAuthor?.role,
        authorName: item.authorName || defaultAuthor?.name,
      };
    });
  }

  // Case 3: Legacy Player Object { general, npcs, loot, clues }
  if (typeof raw === 'object') {
    const cards: NoteItem[] = [];
    if (raw.general && typeof raw.general === 'string' && raw.general.trim()) {
      cards.push({
        id: 'migrated-general',
        title: 'General Notes',
        category: 'General',
        content: raw.general.trim(),
        isPinned: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (raw.npcs && typeof raw.npcs === 'string' && raw.npcs.trim()) {
      cards.push({
        id: 'migrated-npcs',
        title: 'NPC Contacts',
        category: 'NPC',
        content: raw.npcs.trim(),
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (raw.loot && typeof raw.loot === 'string' && raw.loot.trim()) {
      cards.push({
        id: 'migrated-loot',
        title: 'Purse & Loot',
        category: 'Loot',
        content: raw.loot.trim(),
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (raw.clues && typeof raw.clues === 'string' && raw.clues.trim()) {
      cards.push({
        id: 'migrated-clues',
        title: 'Clues & Rumors',
        category: 'Quest',
        content: raw.clues.trim(),
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (cards.length > 0) return cards;
  }

  return fallbackDefaults;
}

interface NotesTabProps {
  isDm: boolean;
  playerName?: string;
}

export type SubTabType = 'myNotes' | 'tableNotes' | 'dmNotes';

export const NotesTab: React.FC<NotesTabProps> = ({ isDm, playerName = 'Adventurer' }) => {
  // 1. Active Sub-Tab State ('myNotes' | 'tableNotes' | 'dmNotes')
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('myNotes');

  // Author details
  const currentRole: 'GM' | 'PLAYER' = isDm ? 'GM' : 'PLAYER';
  const authorName = playerName || (isDm ? 'Game Master' : 'Player');

  // 2. "My Notes" State (Strictly Local)
  const [myNotes, setMyNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_MY_NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return migrateToNoteCards(parsed, DEFAULT_MY_NOTES);
      }

      const legacySaved = localStorage.getItem(LOCAL_LEGACY_PLAYER_NOTES_KEY);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        const migrated = migrateToNoteCards(parsed, DEFAULT_MY_NOTES);
        try {
          localStorage.setItem(LOCAL_MY_NOTES_KEY, JSON.stringify(migrated));
        } catch {}
        return migrated;
      }
    } catch (e) {
      console.warn('Failed to load my notes:', e);
    }
    return DEFAULT_MY_NOTES;
  });

  // 3. "Table Notes" State (Offline Cache Hydration First for Resilience)
  const [tableNotes, setTableNotes] = useState<NoteItem[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_TABLE_NOTES_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return migrateToNoteCards(parsed, DEFAULT_TABLE_NOTES, {
          role: currentRole,
          name: authorName,
        });
      }
    } catch {}
    return DEFAULT_TABLE_NOTES;
  });
  const [tableSaveStatus, setTableSaveStatus] = useState<'synced' | 'saving'>('synced');
  const tableDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 4. "DM Notes" State (Secret Vault)
  const [dmNotes, setDmNotes] = useState<DmSecretNote[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_DM_NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_DM_NOTES;
  });

  // 5. Single Source of Truth for Broadcast State: derived in memory
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastNotePayload | null>(() => {
    try {
      const cached = localStorage.getItem('ashtapor_broadcast_note');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  // 6. Persistent Expansion State: Loaded from ashtapor_notes_expanded_ids in localStorage
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(() => {
    const stored = loadExpandedIdsFromStorage();
    if (stored !== null) {
      return stored;
    }
    // First run / initial load default: expand all notes by default
    const initial = new Set<string>();
    myNotes.forEach((n) => initial.add(n.id));
    tableNotes.forEach((n) => initial.add(n.id));
    persistExpandedIdsToStorage(initial);
    return initial;
  });

  // Ensure expandedNoteIds is continually locked in localStorage under ashtapor_notes_expanded_ids
  useEffect(() => {
    persistExpandedIdsToStorage(expandedNoteIds);
  }, [expandedNoteIds]);

  // Safety: non-GMs must never access DM Notes
  useEffect(() => {
    if (!isDm && activeSubTab === 'dmNotes') {
      setActiveSubTab('myNotes');
    }
  }, [isDm, activeSubTab]);

  // Persist My Notes to localStorage
  const saveMyNotes = useCallback((updated: NoteItem[]) => {
    setMyNotes(updated);
    try {
      localStorage.setItem(LOCAL_MY_NOTES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed saving my notes to localStorage:', e);
    }
  }, []);

  // Individual Card Expansion Toggle
  const handleToggleExpandNote = useCallback((id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, []);

  // Expand / Collapse All for My Notes
  const handleExpandAllMyNotes = useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      myNotes.forEach((n) => next.add(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [myNotes]);

  const handleCollapseAllMyNotes = useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      myNotes.forEach((n) => next.delete(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [myNotes]);

  // Expand / Collapse All for Table Notes
  const handleExpandAllTableNotes = useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      tableNotes.forEach((n) => next.add(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [tableNotes]);

  const handleCollapseAllTableNotes = useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      tableNotes.forEach((n) => next.delete(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [tableNotes]);

  const handleSaveMyNote = (note: NoteItem) => {
    const exists = myNotes.some((n) => n.id === note.id);
    const updated = exists
      ? myNotes.map((n) => (n.id === note.id ? note : n))
      : [note, ...myNotes];
    saveMyNotes(updated);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev).add(note.id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleDeleteMyNote = (id: string) => {
    const updated = myNotes.filter((n) => n.id !== id);
    saveMyNotes(updated);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleTogglePinMyNote = (id: string) => {
    const updated = myNotes.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n
    );
    saveMyNotes(updated);
  };

  // Safe Merge Import for My Notes: matching IDs update existing notes; new IDs append
  const handleImportMyNotes = (imported: NoteItem[]) => {
    const mergedMap = new Map<string, NoteItem>();
    myNotes.forEach((n) => mergedMap.set(n.id, n));
    imported.forEach((n) => mergedMap.set(n.id, n));
    const merged = Array.from(mergedMap.values());
    saveMyNotes(merged);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      imported.forEach((n) => next.add(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  // Sync Table Notes with OBR Room Metadata on Mount & Subscription + Mirror to Local Cache
  useEffect(() => {
    if (!OBR.isReady) return;

    OBR.room
      .getMetadata()
      .then((meta) => {
        const remoteData = meta[OBR_TABLE_NOTES_KEY] ?? meta[OBR_LEGACY_TABLE_NOTES_KEY];
        if (remoteData !== undefined && remoteData !== null) {
          const loaded = migrateToNoteCards(remoteData, DEFAULT_TABLE_NOTES, {
            role: currentRole,
            name: authorName,
          });
          setTableNotes(loaded);

          // If first-run with no saved expansion preference, expand newly loaded table notes
          if (loadExpandedIdsFromStorage() === null) {
            setExpandedNoteIds((prev) => {
              const next = new Set(prev);
              loaded.forEach((n) => next.add(n.id));
              persistExpandedIdsToStorage(next);
              return next;
            });
          }

          // Offline caching resilience
          try {
            localStorage.setItem(LOCAL_TABLE_NOTES_KEY, JSON.stringify(loaded));
          } catch {}
        }
      })
      .catch((err) => console.warn('Could not fetch table notes metadata:', err));

    const unsub = OBR.room.onMetadataChange((meta) => {
      const remoteData = meta[OBR_TABLE_NOTES_KEY];
      if (remoteData !== undefined && remoteData !== null) {
        const loaded = migrateToNoteCards(remoteData, DEFAULT_TABLE_NOTES, {
          role: currentRole,
          name: authorName,
        });
        setTableNotes(loaded);
        try {
          localStorage.setItem(LOCAL_TABLE_NOTES_KEY, JSON.stringify(loaded));
        } catch {}
      }
    });

    return () => unsub();
  }, [currentRole, authorName]);

  // Debounced Room Sync for Table Notes
  const triggerDebouncedTableSync = useCallback((notesToSync: NoteItem[]) => {
    setTableSaveStatus('saving');

    if (tableDebounceTimerRef.current) {
      clearTimeout(tableDebounceTimerRef.current);
    }

    tableDebounceTimerRef.current = setTimeout(async () => {
      try {
        localStorage.setItem(LOCAL_TABLE_NOTES_KEY, JSON.stringify(notesToSync));
        if (OBR.isReady) {
          await OBR.room.setMetadata({
            [OBR_TABLE_NOTES_KEY]: notesToSync,
          });
        } else {
          window.dispatchEvent(
            new CustomEvent('ashtapor-table-notes-sync', { detail: notesToSync })
          );
        }
      } catch (err) {
        console.error('Error syncing table notes:', err);
      } finally {
        setTableSaveStatus('synced');
      }
    }, 350);
  }, []);

  const handleSaveTableNote = (note: NoteItem) => {
    const exists = tableNotes.some((n) => n.id === note.id);
    const updated = exists
      ? tableNotes.map((n) => (n.id === note.id ? note : n))
      : [note, ...tableNotes];
    setTableNotes(updated);
    try {
      localStorage.setItem(LOCAL_TABLE_NOTES_KEY, JSON.stringify(updated));
    } catch {}
    setExpandedNoteIds((prev) => {
      const next = new Set(prev).add(note.id);
      persistExpandedIdsToStorage(next);
      return next;
    });
    triggerDebouncedTableSync(updated);
  };

  const handleDeleteTableNote = (id: string) => {
    const updated = tableNotes.filter((n) => n.id !== id);
    setTableNotes(updated);
    try {
      localStorage.setItem(LOCAL_TABLE_NOTES_KEY, JSON.stringify(updated));
    } catch {}
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistExpandedIdsToStorage(next);
      return next;
    });
    triggerDebouncedTableSync(updated);
  };

  const handleTogglePinTableNote = (id: string) => {
    const updated = tableNotes.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n
    );
    setTableNotes(updated);
    try {
      localStorage.setItem(LOCAL_TABLE_NOTES_KEY, JSON.stringify(updated));
    } catch {}
    triggerDebouncedTableSync(updated);
  };

  // DM Notes State Operations (No independent note.isRevealed flag stored)
  const saveDmNotes = (updated: DmSecretNote[]) => {
    setDmNotes(updated);
    try {
      localStorage.setItem(LOCAL_DM_NOTES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleSaveDmNote = (note: DmSecretNote) => {
    const exists = dmNotes.some((n) => n.id === note.id);
    const updated = exists
      ? dmNotes.map((n) => (n.id === note.id ? note : n))
      : [note, ...dmNotes];
    saveDmNotes(updated);
  };

  const handleDeleteDmNote = async (id: string) => {
    if (activeBroadcast && activeBroadcast.id === id) {
      await handleStopBroadcast();
    }
    const updated = dmNotes.filter((n) => n.id !== id);
    saveDmNotes(updated);
  };

  const handleExpandAllDmNotes = useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      dmNotes.forEach((n) => next.add(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [dmNotes]);

  const handleCollapseAllDmNotes = useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      dmNotes.forEach((n) => next.delete(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [dmNotes]);

  // Atomic 1-Click Broadcast Teardown
  const handleStopBroadcast = async () => {
    setActiveBroadcast(null);
    try {
      if (OBR.isReady) {
        await OBR.room.setMetadata({
          [OBR_BROADCAST_NOTE_KEY]: undefined,
          [ROOM_METADATA_KEY]: { activeBroadcast: null } as any,
        });
      }
    } catch (err) {
      console.error('Error stopping broadcast:', err);
    }
    try {
      localStorage.removeItem('ashtapor_broadcast_note');
    } catch {}
    window.dispatchEvent(new CustomEvent('ashtapor-broadcast-note', { detail: null }));
  };

  // Toggle reveal for DM note (derived from activeBroadcast single source of truth)
  const handleToggleRevealDmNote = async (note: DmSecretNote) => {
    const isCurrentlyRevealed = activeBroadcast !== null && activeBroadcast.id === note.id;

    if (isCurrentlyRevealed) {
      await handleStopBroadcast();
    } else {
      const payload: BroadcastNotePayload = {
        id: note.id,
        title: note.title,
        content: note.content,
        broadcastAt: Date.now(),
      };

      setActiveBroadcast(payload);

      try {
        if (OBR.isReady) {
          await OBR.room.setMetadata({
            [OBR_BROADCAST_NOTE_KEY]: payload,
            [ROOM_METADATA_KEY]: { activeBroadcast: payload } as any,
          });
        }
      } catch (err) {
        console.error('Failed to broadcast note to room:', err);
      }

      try {
        localStorage.setItem('ashtapor_broadcast_note', JSON.stringify(payload));
      } catch {}
      window.dispatchEvent(
        new CustomEvent('ashtapor-broadcast-note', { detail: payload })
      );
    }
  };

  // Listen for broadcast events from App.tsx or other clients to immediately sync activeBroadcast
  useEffect(() => {
    const handleBroadcastEvent = (e: any) => {
      const detail = e.detail as BroadcastNotePayload | null;
      setActiveBroadcast(detail || null);
    };

    window.addEventListener('ashtapor-broadcast-note', handleBroadcastEvent);
    return () => window.removeEventListener('ashtapor-broadcast-note', handleBroadcastEvent);
  }, []);

  // Listen for remote OBR broadcast note metadata changes
  useEffect(() => {
    if (!OBR.isReady) return;
    const unsub = OBR.room.onMetadataChange((meta) => {
      const remoteBroadcast = (meta[OBR_BROADCAST_NOTE_KEY] ||
        (meta[ROOM_METADATA_KEY] as any)?.activeBroadcast) as BroadcastNotePayload | undefined;
      if (remoteBroadcast && remoteBroadcast.title) {
        setActiveBroadcast(remoteBroadcast);
      } else {
        setActiveBroadcast(null);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-2 gap-2 relative">
      {/* 1. SUB-TAB HEADER: [👤 My Notes (N)] [📜 Table Notes (N)] [🔒 DM Notes (N) (GM Only)] */}
      <div className="shrink-0 p-1 bg-slate-900/95 border border-slate-800 rounded-xl shadow-sm">
        <div
          className={`grid gap-1 w-full ${
            isDm ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {/* My Notes Sub-Tab Trigger with Badge */}
          <button
            type="button"
            onClick={() => setActiveSubTab('myNotes')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer truncate ${
              activeSubTab === 'myNotes'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Private Player Scratchpad (Stored locally on your machine)"
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">My Notes</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] border font-mono ${
                activeSubTab === 'myNotes'
                  ? 'bg-slate-950 text-amber-400 border-slate-800'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {myNotes.length}
            </span>
          </button>

          {/* Table Notes Sub-Tab Trigger with Badge */}
          <button
            type="button"
            onClick={() => setActiveSubTab('tableNotes')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer truncate ${
              activeSubTab === 'tableNotes'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Table Notes (Shared collaborative cards in real time across the room)"
          >
            <Scroll className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Table Notes</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] border font-mono ${
                activeSubTab === 'tableNotes'
                  ? 'bg-slate-950 text-amber-400 border-slate-800'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {tableNotes.length}
            </span>
          </button>

          {/* DM Notes Sub-Tab Trigger with Badge (GM Only) */}
          {isDm && (
            <button
              type="button"
              onClick={() => setActiveSubTab('dmNotes')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer truncate ${
                activeSubTab === 'dmNotes'
                  ? 'bg-rose-500 text-slate-950 font-bold shadow-sm'
                  : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50'
              }`}
              title="DM Notes Vault & Broadcast (GM Only)"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">DM Notes</span>
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] border font-mono ${
                  activeSubTab === 'dmNotes'
                    ? 'bg-slate-950 text-rose-400 border-slate-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {dmNotes.length}
              </span>
              {activeBroadcast && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. SUB-TAB 1: "MY NOTES" VIEW (KEEP-ALIVE STATE RETENTION) */}
      <div className={activeSubTab === 'myNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
        <NoteCardList
          notes={myNotes}
          expandedIds={expandedNoteIds}
          onToggleExpand={handleToggleExpandNote}
          onExpandAll={handleExpandAllMyNotes}
          onCollapseAll={handleCollapseAllMyNotes}
          onSaveNote={handleSaveMyNote}
          onDeleteNote={handleDeleteMyNote}
          onTogglePin={handleTogglePinMyNote}
          onImportNotes={handleImportMyNotes}
          allowImportExport={true}
          currentRole={currentRole}
          currentAuthorName={authorName}
          emptyMessage="No personal notes yet."
          emptySubtitle="Create organized cards for quests, loot, NPCs, and secrets."
          headerInfo={
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/70 border border-slate-800/80 rounded-xl text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-slate-200">Private Scratchpad</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">
                ashtapor_my_notes
              </span>
            </div>
          }
        />
      </div>

      {/* 3. SUB-TAB 2: "TABLE NOTES" VIEW (KEEP-ALIVE STATE RETENTION WITH EXPAND/COLLAPSE ALL PARITY) */}
      <div className={activeSubTab === 'tableNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
        <NoteCardList
          notes={tableNotes}
          expandedIds={expandedNoteIds}
          onToggleExpand={handleToggleExpandNote}
          onExpandAll={handleExpandAllTableNotes}
          onCollapseAll={handleCollapseAllTableNotes}
          onSaveNote={handleSaveTableNote}
          onDeleteNote={handleDeleteTableNote}
          onTogglePin={handleTogglePinTableNote}
          allowImportExport={false}
          currentRole={currentRole}
          currentAuthorName={authorName}
          emptyMessage="No table notes shared yet."
          emptySubtitle="Any player or DM can add shared quests, clues, or inventory."
          headerInfo={
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/70 border border-slate-800/80 rounded-xl text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Scroll className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold text-slate-200 truncate">Shared Campaign Table</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {tableSaveStatus === 'saving' ? (
                  <span className="text-amber-400 flex items-center gap-1 text-[10px] font-mono">
                    <Clock className="w-3 h-3 animate-spin" />
                    <span>Syncing...</span>
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-mono font-medium">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>Room Synced</span>
                  </span>
                )}
              </div>
            </div>
          }
        />
      </div>

      {/* 4. SUB-TAB 3: "DM NOTES" VIEW (GM ONLY, KEEP-ALIVE STATE RETENTION) */}
      {isDm && (
        <div className={activeSubTab === 'dmNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
          <DmNotesVault
            dmNotes={dmNotes}
            activeBroadcast={activeBroadcast}
            onSaveDmNote={handleSaveDmNote}
            onDeleteDmNote={handleDeleteDmNote}
            onToggleReveal={handleToggleRevealDmNote}
            onExpandAll={handleExpandAllDmNotes}
            onCollapseAll={handleCollapseAllDmNotes}
          />
        </div>
      )}
    </div>
  );
};

export default NotesTab;
