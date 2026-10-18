import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import {
  User,
  Scroll,
  Lock,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  MoreVertical,
  Download,
  Upload,
  X,
} from 'lucide-react';
import {
  NoteItem,
  NoteCategory,
  NOTE_CATEGORIES,
  NotesExportPayload,
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
import { NoteCardList, CATEGORY_PILL_ACTIVE_STYLES } from './NoteCardList';
import { DmNotesVault } from '../DmNotesVault';
import { CreateNoteModal } from './CreateNoteModal';
import { NoteReaderView } from './NoteReaderView';

// Re-export for App.tsx and external consumers
export type { BroadcastNotePayload, NotesScope } from '../../types/notes';
export { OBR_BROADCAST_NOTE_KEY, OBR_TABLE_NOTES_KEY } from '../../types/notes';

export const LOCAL_EXPANDED_NOTES_KEY = 'ashtapor_notes_expanded_ids';

const CATEGORY_ORDER: NoteCategory[] = [
  'General',
  'NPC',
  'Quest',
  'Combat',
  'Loot',
  'Location',
  'Scene',
  'Hook',
];

export const CATEGORY_ABBREVIATIONS: Record<string, string> = {
  All: 'All',
  General: 'Gen',
  NPC: 'NPC',
  Quest: 'Qst',
  Combat: 'Cbt',
  Loot: 'Loot',
  Location: 'Loc',
  Scene: 'Scene',
  Hook: 'Hook',
};

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
    isPinned: true,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'dm-note-2',
    title: 'The Inquisitor’s True Identity',
    content:
      'Inquisitor Vane is secretly a doppelganger working under the orders of the Crimson Veil. If inspected with True Seeing or Divine Sense, detects as Monstrosity (Shapechanger).\n\nIf captured alive, carries a silver ring bearing the serpent crest of House Ashtapor.',
    category: 'NPC',
    isPinned: false,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
  {
    id: 'dm-note-3',
    title: 'Cathedral of Ashen Glass (Read-Aloud)',
    content:
      'Pillars of fused black obsidian arch into the gloom overhead. Pale violet braziers cast long, flickering shadows across a cracked mosaic of the Sun Father, while the faint chime of unseen censer bells echoes from the reliquary vault.',
    category: 'Scene',
    isPinned: false,
    createdAt: Date.now() - 10800000,
    updatedAt: Date.now() - 10800000,
  },
  {
    id: 'dm-note-4',
    title: 'The Missing Caravan Ledger',
    content:
      'A blood-stained manifest found in the wrecked wagon lists three crates of "Star-Iron Ingots" delivered to the Magistrate’s private estate—implicating the town council in smuggling arms to the cult.',
    category: 'Hook',
    isPinned: false,
    createdAt: Date.now() - 14400000,
    updatedAt: Date.now() - 14400000,
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
      const validCat: NoteCategory =
        item.category && NOTE_CATEGORIES.includes(item.category)
          ? item.category
          : 'General';
      return {
        id: item.id || `note-${Date.now()}-${index}`,
        title: item.title || 'Untitled Note',
        category: validCat,
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

  // Reader View State (In-place viewport takeover)
  const [activeReaderNoteId, setActiveReaderNoteId] = useState<string | null>(null);

  // Author details
  const currentRole: 'GM' | 'PLAYER' = isDm ? 'GM' : 'PLAYER';
  const authorName = playerName || (isDm ? 'Game Master' : 'Player');

  // Per-sub-tab Search & Category Filter state (retained across sub-tab switches & reader returns)
  const [searchByTab, setSearchByTab] = useState<Record<SubTabType, string>>({
    myNotes: '',
    tableNotes: '',
    dmNotes: '',
  });
  const [categoryByTab, setCategoryByTab] = useState<Record<SubTabType, string>>({
    myNotes: 'All',
    tableNotes: 'All',
    dmNotes: 'All',
  });

  // Maintenance Dropdown (`⋮`) state & ref
  const [isMaintenanceMenuOpen, setIsMaintenanceMenuOpen] = useState(false);
  const maintenanceMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create / Edit Note Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | DmSecretNote | null>(null);

  useEffect(() => {
    if (!isMaintenanceMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        maintenanceMenuRef.current &&
        !maintenanceMenuRef.current.contains(e.target as Node)
      ) {
        setIsMaintenanceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMaintenanceMenuOpen]);

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
    const initial = new Set<string>();
    myNotes.forEach((n) => initial.add(n.id));
    tableNotes.forEach((n) => initial.add(n.id));
    dmNotes.forEach((n) => initial.add(n.id));
    persistExpandedIdsToStorage(initial);
    return initial;
  });

  // Ensure expandedNoteIds is continually locked in localStorage under ashtapor_notes_expanded_ids
  useEffect(() => {
    persistExpandedIdsToStorage(expandedNoteIds);
  }, [expandedNoteIds]);

  // Derive active note for Reader View
  const activeReaderNote = useMemo(() => {
    if (!activeReaderNoteId) return null;
    return (
      myNotes.find((n) => n.id === activeReaderNoteId) ||
      tableNotes.find((n) => n.id === activeReaderNoteId) ||
      dmNotes.find((n) => n.id === activeReaderNoteId) ||
      null
    );
  }, [activeReaderNoteId, myNotes, tableNotes, dmNotes]);

  // Graceful fallback if active reader note is deleted
  useEffect(() => {
    if (activeReaderNoteId && !activeReaderNote) {
      setActiveReaderNoteId(null);
    }
  }, [activeReaderNoteId, activeReaderNote]);

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

  // Expand / Collapse All for DM Notes
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

  const handleExpandAllActiveTab = () => {
    if (activeSubTab === 'myNotes') handleExpandAllMyNotes();
    else if (activeSubTab === 'tableNotes') handleExpandAllTableNotes();
    else handleExpandAllDmNotes();
  };

  const handleCollapseAllActiveTab = () => {
    if (activeSubTab === 'myNotes') handleCollapseAllMyNotes();
    else if (activeSubTab === 'tableNotes') handleCollapseAllTableNotes();
    else handleCollapseAllDmNotes();
  };

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

          if (loadExpandedIdsFromStorage() === null) {
            setExpandedNoteIds((prev) => {
              const next = new Set(prev);
              loaded.forEach((n) => next.add(n.id));
              persistExpandedIdsToStorage(next);
              return next;
            });
          }

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
    setExpandedNoteIds((prev) => {
      const next = new Set(prev).add(note.id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleDeleteDmNote = async (id: string) => {
    if (activeBroadcast && activeBroadcast.id === id) {
      await handleStopBroadcast();
    }
    const updated = dmNotes.filter((n) => n.id !== id);
    saveDmNotes(updated);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleTogglePinDmNote = (id: string) => {
    const updated = dmNotes.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
    );
    saveDmNotes(updated);
  };

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

  // Active sub-tab notes list for category counts
  const activeNotesList = useMemo<Array<{ category?: NoteCategory }>>(() => {
    if (activeSubTab === 'myNotes') return myNotes;
    if (activeSubTab === 'tableNotes') return tableNotes;
    return dmNotes;
  }, [activeSubTab, myNotes, tableNotes, dmNotes]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: activeNotesList.length,
      General: 0,
      NPC: 0,
      Quest: 0,
      Combat: 0,
      Loot: 0,
      Location: 0,
      Scene: 0,
      Hook: 0,
    };
    activeNotesList.forEach((n) => {
      const cat =
        n.category && NOTE_CATEGORIES.includes(n.category) ? n.category : 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activeNotesList]);

  // Only show categories with count > 0 (always keep All visible at index 0)
  const visibleCategories = useMemo(() => {
    const list = ['All'];
    CATEGORY_ORDER.forEach((cat) => {
      if ((categoryCounts[cat] || 0) > 0) {
        list.push(cat);
      }
    });
    return list;
  }, [categoryCounts]);

  const activeSearchQuery = searchByTab[activeSubTab] || '';
  const activeSelectedCategory = categoryByTab[activeSubTab] || 'All';

  const handleSearchChange = (value: string) => {
    setSearchByTab((prev) => ({
      ...prev,
      [activeSubTab]: value,
    }));
  };

  const handleSelectCategory = (cat: string) => {
    setCategoryByTab((prev) => {
      const current = prev[activeSubTab] || 'All';
      const next = current === cat || cat === 'All' ? 'All' : cat;
      return {
        ...prev,
        [activeSubTab]: next,
      };
    });
  };

  const handleResetActiveFilters = () => {
    setSearchByTab((prev) => ({ ...prev, [activeSubTab]: '' }));
    setCategoryByTab((prev) => ({ ...prev, [activeSubTab]: 'All' }));
  };

  // Auto-fallback to 'All' if selected category count drops to 0
  useEffect(() => {
    if (activeSelectedCategory !== 'All' && (categoryCounts[activeSelectedCategory] || 0) === 0) {
      setCategoryByTab((prev) => ({
        ...prev,
        [activeSubTab]: 'All',
      }));
    }
  }, [activeSelectedCategory, categoryCounts, activeSubTab]);

  // JSON Export Backup (`⋮` Maintenance Dropdown)
  const handleExportJSON = () => {
    setIsMaintenanceMenuOpen(false);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `ashtapor-notes-${dateStr}.json`;
    const notesToExport: NoteItem[] =
      activeSubTab === 'tableNotes'
        ? tableNotes
        : activeSubTab === 'dmNotes'
        ? dmNotes.map((d) => ({
            id: d.id,
            title: d.title,
            category: d.category || 'General',
            content: d.content,
            isPinned: !!d.isPinned,
            updatedAt: new Date(d.updatedAt).toISOString(),
            createdAt: new Date(d.createdAt).toISOString(),
            authorRole: 'GM',
            authorName,
          }))
        : myNotes;

    const payload: NotesExportPayload = {
      version: '2.0.21',
      exportedAt: now.toISOString(),
      source: 'ashtapor-session-companion',
      notes: notesToExport,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // JSON Import Backup (`⋮` Maintenance Dropdown)
  const handleTriggerImport = () => {
    setIsMaintenanceMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let rawNotes: any[] = [];
      if (Array.isArray(parsed)) {
        rawNotes = parsed;
      } else if (parsed && Array.isArray(parsed.notes)) {
        rawNotes = parsed.notes;
      } else if (parsed && typeof parsed === 'object') {
        rawNotes = Object.values(parsed);
      }

      if (!Array.isArray(rawNotes) || rawNotes.length === 0) {
        return;
      }

      const validList: NoteItem[] = [];
      for (const item of rawNotes) {
        if (item && (typeof item.title === 'string' || typeof item.content === 'string')) {
          const categoryVal: NoteCategory =
            item.category && NOTE_CATEGORIES.includes(item.category)
              ? item.category
              : 'General';
          validList.push({
            id:
              item.id ||
              `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: (item.title || 'Untitled Note').trim(),
            category: categoryVal,
            content: typeof item.content === 'string' ? item.content : '',
            isPinned: !!item.isPinned,
            updatedAt: item.updatedAt || new Date().toISOString(),
            createdAt: item.createdAt || new Date().toISOString(),
            authorRole: item.authorRole,
            authorName: item.authorName,
          });
        }
      }

      if (validList.length > 0) {
        handleImportMyNotes(validList);
      }
    } catch (err) {
      console.error('Failed to import JSON file:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Open Create Modal (`+` button)
  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal from NoteCard or DmNotesVault
  const handleOpenEditNote = (note: NoteItem | DmSecretNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(note);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal directly from Reader View
  const handleOpenEditFromReader = (note: NoteItem | DmSecretNote) => {
    setEditingNote(note);
    setIsCreateModalOpen(true);
  };

  // Open In-Place Reader View
  const handleOpenReader = (id: string) => {
    setActiveReaderNoteId(id);
  };

  const handleSaveFromModal = (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
  }) => {
    if (activeSubTab === 'dmNotes') {
      if (editingNote) {
        const updatedDm: DmSecretNote = {
          ...(editingNote as DmSecretNote),
          title: data.title,
          category: data.category,
          content: data.content,
          isPinned: data.isPinned,
          updatedAt: Date.now(),
        };
        handleSaveDmNote(updatedDm);
      } else {
        const createdDm: DmSecretNote = {
          id: `dm-note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: data.title,
          category: data.category,
          content: data.content,
          isPinned: data.isPinned,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        handleSaveDmNote(createdDm);
      }
    } else {
      const id =
        editingNote?.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

      const updatedNote: NoteItem = {
        id,
        title: data.title,
        category: data.category,
        content: data.content,
        isPinned: data.isPinned,
        updatedAt: new Date().toISOString(),
        createdAt: editingNote?.createdAt || new Date().toISOString(),
        authorRole: (editingNote as NoteItem)?.authorRole || currentRole,
        authorName: (editingNote as NoteItem)?.authorName || authorName,
      };

      if (activeSubTab === 'tableNotes') {
        handleSaveTableNote(updatedNote);
      } else {
        handleSaveMyNote(updatedNote);
      }
    }

    setIsCreateModalOpen(false);
    setEditingNote(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-1.5 gap-1.5 relative">
      {/* Hidden File Input for JSON Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* CONDITIONAL IN-PLACE VIEWPORT TAKEOVER: READER VIEW */}
      {activeReaderNoteId !== null && activeReaderNote ? (
        <NoteReaderView
          note={activeReaderNote}
          onBack={() => setActiveReaderNoteId(null)}
          onEdit={() => handleOpenEditFromReader(activeReaderNote)}
        />
      ) : (
        <>
          {/* 1. COMPACT SUB-TAB NAVIGATION BAR (h-7 Segmented Pill Control) */}
          <div className="h-7 shrink-0 flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
            {/* My Notes Trigger */}
            <button
              type="button"
              onClick={() => setActiveSubTab('myNotes')}
              className={
                activeSubTab === 'myNotes'
                  ? 'text-xs font-bold bg-amber-500 text-slate-950 px-2.5 py-1 rounded-md shadow flex items-center justify-center flex-1 h-full cursor-pointer truncate'
                  : 'text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center justify-center flex-1 h-full cursor-pointer truncate'
              }
              title="My Notes (Stored locally on your machine)"
            >
              <User className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">My Notes</span>
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 border border-slate-700/60 text-slate-200 font-mono">
                {myNotes.length}
              </span>
            </button>

            {/* Table Notes Trigger */}
            <button
              type="button"
              onClick={() => setActiveSubTab('tableNotes')}
              className={
                activeSubTab === 'tableNotes'
                  ? 'text-xs font-bold bg-amber-500 text-slate-950 px-2.5 py-1 rounded-md shadow flex items-center justify-center flex-1 h-full cursor-pointer truncate'
                  : 'text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center justify-center flex-1 h-full cursor-pointer truncate'
              }
              title="Table Notes (Shared collaborative cards across the room)"
            >
              <Scroll className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Table Notes</span>
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 border border-slate-700/60 text-slate-200 font-mono">
                {tableNotes.length}
              </span>
            </button>

            {/* DM Notes Trigger (GM Only) */}
            {isDm && (
              <button
                type="button"
                onClick={() => setActiveSubTab('dmNotes')}
                className={
                  activeSubTab === 'dmNotes'
                    ? 'text-xs font-bold bg-rose-600 text-white px-2.5 py-1 rounded-md shadow flex items-center justify-center flex-1 h-full cursor-pointer truncate'
                    : 'text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center justify-center flex-1 h-full cursor-pointer truncate'
                }
                title="DM Notes Vault & Broadcast (GM Only)"
              >
                <Lock className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate">DM Notes</span>
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 border border-slate-700/60 text-slate-200 font-mono">
                  {dmNotes.length}
                </span>
                {activeBroadcast && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1 shrink-0" />
                )}
              </button>
            )}
          </div>

          {/* 2. STREAMLINED UTILITY BAR & MAINTENANCE DROPDOWN (`⋮`) */}
          <div className="shrink-0 flex items-center gap-1.5">
            {/* Search Input (h-7 text-xs) */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={activeSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search notes..."
                className="w-full h-7 pl-8 pr-6 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans transition"
              />
              {activeSearchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compact Icon Utilities: Expand All, Collapse All, Maintenance Menu (`⋮`), + New Note */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleExpandAllActiveTab}
                title="Expand All"
                aria-label="Expand All"
                className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleCollapseAllActiveTab}
                title="Collapse All"
                aria-label="Collapse All"
                className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
              </button>

              {/* Maintenance Dropdown (`⋮`) for JSON Export & JSON Import */}
              <div className="relative" ref={maintenanceMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsMaintenanceMenuOpen((prev) => !prev)}
                  title="Backup & Maintenance"
                  aria-label="Backup & Maintenance"
                  className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {isMaintenanceMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 flex flex-col text-xs">
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>⬇ Export JSON Backup</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerImport}
                      className="px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>⬆ Import JSON Backup</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Compact `+` New Note Icon Button */}
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Create New Note"
              >
                +
              </button>
            </div>
          </div>

          {/* 3. HIGH-DENSITY CATEGORY MICRO-PILLS STRIP (Zero Parentheses, 440px Interior Fit) */}
          <div className="h-6 shrink-0 flex items-center gap-1 overflow-x-hidden flex-nowrap py-0.5">
            {visibleCategories.map((cat) => {
              const isSelected = activeSelectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              const abbr = CATEGORY_ABBREVIATIONS[cat] || cat;
              const activeStyle =
                CATEGORY_PILL_ACTIVE_STYLES[cat] || CATEGORY_PILL_ACTIVE_STYLES.All;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={
                    isSelected
                      ? `px-1.5 py-0.5 text-[10px] font-bold rounded-full border transition-colors shrink-0 cursor-pointer text-slate-100 ${activeStyle}`
                      : 'px-1.5 py-0.5 text-[10px] font-semibold rounded-full border transition-colors shrink-0 cursor-pointer bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                  }
                  title={`Filter by ${cat} (${count})`}
                >
                  {abbr} {count}
                </button>
              );
            })}
          </div>

          {/* 4. SUB-TAB 1: "MY NOTES" VIEW (KEEP-ALIVE STATE RETENTION) */}
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
              emptySubtitle="Click '+' above to create cards for quests, loot, NPCs, or scenes."
              hideControls={true}
              externalSearchQuery={searchByTab.myNotes}
              externalSelectedCategory={categoryByTab.myNotes}
              onExternalResetFilters={handleResetActiveFilters}
              onExternalEditNote={handleOpenEditNote}
              onOpenReader={handleOpenReader}
            />
          </div>

          {/* 5. SUB-TAB 2: "TABLE NOTES" VIEW (KEEP-ALIVE STATE RETENTION) */}
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
              hideControls={true}
              externalSearchQuery={searchByTab.tableNotes}
              externalSelectedCategory={categoryByTab.tableNotes}
              onExternalResetFilters={handleResetActiveFilters}
              onExternalEditNote={handleOpenEditNote}
              onOpenReader={handleOpenReader}
            />
          </div>

          {/* 6. SUB-TAB 3: "DM NOTES" VIEW (GM ONLY, KEEP-ALIVE STATE RETENTION) */}
          {isDm && (
            <div className={activeSubTab === 'dmNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
              <DmNotesVault
                dmNotes={dmNotes}
                activeBroadcast={activeBroadcast}
                onSaveDmNote={handleSaveDmNote}
                onDeleteDmNote={handleDeleteDmNote}
                onToggleReveal={handleToggleRevealDmNote}
                onTogglePinDmNote={handleTogglePinDmNote}
                expandedIds={expandedNoteIds}
                onToggleExpand={handleToggleExpandNote}
                onExpandAll={handleExpandAllDmNotes}
                onCollapseAll={handleCollapseAllDmNotes}
                hideControls={true}
                externalSearchQuery={searchByTab.dmNotes}
                externalSelectedCategory={categoryByTab.dmNotes}
                onExternalResetFilters={handleResetActiveFilters}
                onExternalEditDmNote={handleOpenEditNote}
                onOpenReader={handleOpenReader}
              />
            </div>
          )}
        </>
      )}

      {/* 7. UNIFIED CREATE / EDIT NOTE MODAL (GM-Gated Scene & Hook Categories) */}
      <CreateNoteModal
        isOpen={isCreateModalOpen}
        isGM={isDm}
        isDmSecretNote={activeSubTab === 'dmNotes'}
        editingNote={editingNote}
        defaultCategory={
          activeSelectedCategory !== 'All'
            ? (activeSelectedCategory as NoteCategory)
            : 'General'
        }
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveFromModal}
      />
    </div>
  );
};

export default NotesTab;
