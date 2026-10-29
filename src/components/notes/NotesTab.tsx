/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  Radio,
  EyeOff,
} from 'lucide-react';
import {
  Note,
  NoteItem,
  NoteCategory,
  NOTE_CATEGORIES,
  NotesExportPayload,
  BroadcastNotePayload,
  NotesScope,
  NoteTheme,
  NoteTransferAction,
  normalizeCategory,
  OBR_TABLE_NOTES_KEY as SDK_TABLE_NOTES_KEY,
  OBR_BROADCAST_NOTE_KEY as SDK_BROADCAST_NOTE_KEY,
  LOCAL_MY_NOTES_KEY,
  LOCAL_LEGACY_PLAYER_NOTES_KEY,
  LOCAL_GM_NOTES_KEY,
  LOCAL_DM_NOTES_KEY,
  LOCAL_EXPANDED_NOTES_KEY,
} from '../../types/notes';
import { NoteCardList, CATEGORY_PILL_ACTIVE_STYLES } from './NoteCardList';
import { CreateNoteModal } from './CreateNoteModal';
import { NoteReaderView } from './NoteReaderView';
import { sanitizeNotesList } from '../../utils/notesSanitizer';

// Constants for Room Metadata Synchronization
export const TABLE_NOTES_KEY = SDK_TABLE_NOTES_KEY;
export const BROADCAST_KEY = SDK_BROADCAST_NOTE_KEY;

// Re-export for App.tsx and external consumers
export type { BroadcastNotePayload, NotesScope, Note } from '../../types/notes';
export const OBR_TABLE_NOTES_KEY = TABLE_NOTES_KEY;
export const OBR_BROADCAST_NOTE_KEY = BROADCAST_KEY;

const CATEGORY_ORDER: NoteCategory[] = [
  'General',
  'NPC',
  'Location',
  'Loot',
  'Encounters',
  'Leads',
];

export const CATEGORY_ABBREVIATIONS: Record<string, string> = {
  All: 'All',
  General: 'Gen',
  NPC: 'NPC',
  Location: 'Loc',
  Loot: 'Loot',
  Encounters: 'Enc',
  Leads: 'Lead',
};

const DEFAULT_MY_NOTES: NoteItem[] = [];
const DEFAULT_TABLE_NOTES: NoteItem[] = [];
const DEFAULT_GM_NOTES: NoteItem[] = [];

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

function persistExpandedIdsToStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_EXPANDED_NOTES_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.warn('Could not save expanded notes to localStorage:', e);
  }
}

function migrateToNoteCards(
  raw: any,
  fallbackDefaults: NoteItem[],
  defaultAuthor?: { role: 'GM' | 'PLAYER'; name: string }
): NoteItem[] {
  if (!raw) return fallbackDefaults;

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
        category: normalizeCategory(item.category),
        content: typeof item.content === 'string' ? item.content : '',
        theme: item.theme,
        isPinned: !!item.isPinned,
        updatedAt: item.updatedAt || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
        authorRole: item.authorRole || defaultAuthor?.role,
        authorName: item.authorName || defaultAuthor?.name,
      };
    });
  }

  return fallbackDefaults;
}

export interface NotesTabProps {
  isGM: boolean;
  playerName?: string;
  isDm?: boolean;
  isReady?: boolean;
}

export type SubTabType = 'myNotes' | 'tableNotes' | 'gmNotes';

export const NotesTab: React.FC<NotesTabProps> = ({
  isGM,
  isDm,
  playerName = 'Adventurer',
  isReady: propIsReady,
}) => {
  const isReady =
    propIsReady !== undefined ? propIsReady : typeof OBR !== 'undefined' && OBR.isReady;
  const isGameMaster = isGM !== undefined ? isGM : Boolean(isDm);

  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('myNotes');
  const [activeReaderNoteId, setActiveReaderNoteId] = useState<string | null>(null);

  const currentRole: 'GM' | 'PLAYER' = isGameMaster ? 'GM' : 'PLAYER';
  const authorName = playerName || (isGameMaster ? 'Game Master' : 'Player');

  const [searchByTab, setSearchByTab] = useState<Record<SubTabType, string>>({
    myNotes: '',
    tableNotes: '',
    gmNotes: '',
  });
  const [categoryByTab, setCategoryByTab] = useState<Record<SubTabType, string>>({
    myNotes: 'All',
    tableNotes: 'All',
    gmNotes: 'All',
  });

  const [isMaintenanceMenuOpen, setIsMaintenanceMenuOpen] = useState(false);
  const maintenanceMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

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

  // "My Notes" State (Strictly Local)
  const [myNotes, setMyNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_MY_NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return sanitizeNotesList(migrateToNoteCards(parsed, DEFAULT_MY_NOTES));
      }

      const legacySaved = localStorage.getItem(LOCAL_LEGACY_PLAYER_NOTES_KEY);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        const migrated = sanitizeNotesList(migrateToNoteCards(parsed, DEFAULT_MY_NOTES));
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

  // "Table Notes" State (Synced via OBR Room Metadata)
  const [tableNotes, setTableNotes] = useState<NoteItem[]>([]);
  const tableNotesRef = useRef<NoteItem[]>([]);
  tableNotesRef.current = tableNotes;

  // "GM Notes" State (Strictly Local with legacy DM migration)
  const [gmNotes, setGmNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_GM_NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return sanitizeNotesList(migrateToNoteCards(parsed, DEFAULT_GM_NOTES));
        }
      }

      const legacySaved = localStorage.getItem(LOCAL_DM_NOTES_KEY);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = sanitizeNotesList(migrateToNoteCards(parsed, DEFAULT_GM_NOTES));
          try {
            localStorage.setItem(LOCAL_GM_NOTES_KEY, JSON.stringify(migrated));
          } catch {}
          return migrated;
        }
      }
    } catch (e) {
      console.warn('Failed to load GM notes:', e);
    }
    return DEFAULT_GM_NOTES;
  });

  // Active Broadcast State
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastNotePayload | null>(null);

  // Expansion State
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(() => {
    const stored = loadExpandedIdsFromStorage();
    if (stored !== null) {
      return stored;
    }
    const initial = new Set<string>();
    myNotes.forEach((n) => initial.add(n.id));
    tableNotes.forEach((n) => initial.add(n.id));
    gmNotes.forEach((n) => initial.add(n.id));
    persistExpandedIdsToStorage(initial);
    return initial;
  });

  useEffect(() => {
    persistExpandedIdsToStorage(expandedNoteIds);
  }, [expandedNoteIds]);

  const activeReaderNote = useMemo(() => {
    if (!activeReaderNoteId) return null;
    return (
      myNotes.find((n) => n.id === activeReaderNoteId) ||
      tableNotes.find((n) => n.id === activeReaderNoteId) ||
      gmNotes.find((n) => n.id === activeReaderNoteId) ||
      null
    );
  }, [activeReaderNoteId, myNotes, tableNotes, gmNotes]);

  useEffect(() => {
    if (activeReaderNoteId && !activeReaderNote) {
      setActiveReaderNoteId(null);
    }
  }, [activeReaderNoteId, activeReaderNote]);

  useEffect(() => {
    if (!isGameMaster && activeSubTab === 'gmNotes') {
      setActiveSubTab('myNotes');
    }
  }, [isGameMaster, activeSubTab]);

  const saveMyNotes = useCallback((updated: NoteItem[]) => {
    setMyNotes(updated);
    try {
      localStorage.setItem(LOCAL_MY_NOTES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed saving my notes to localStorage:', e);
    }
  }, []);

  const saveGmNotes = useCallback((updated: NoteItem[]) => {
    setGmNotes(updated);
    try {
      localStorage.setItem(LOCAL_GM_NOTES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed saving GM notes to localStorage:', e);
    }
  }, []);

  const commitTableNotes = useCallback(async (updatedTableNotes: NoteItem[]) => {
    tableNotesRef.current = updatedTableNotes;
    setTableNotes(updatedTableNotes);

    if (typeof OBR !== 'undefined' && OBR.isReady) {
      await OBR.room.setMetadata({ [TABLE_NOTES_KEY]: updatedTableNotes });
    }
  }, []);

  // TWO-WAY SYNCHRONIZATION: Listen for edits saved inside Sticky HUD Note
  useEffect(() => {
    const handleHudSaved = (e: Event) => {
      const customEvent = e as CustomEvent<NoteItem>;
      const updated = customEvent.detail;
      if (!updated || !updated.id) return;

      // 1. Check Table Notes
      setTableNotes((prevTable) => {
        const idx = prevTable.findIndex((n) => n.id === updated.id);
        if (idx !== -1) {
          const next = [...prevTable];
          next[idx] = { ...next[idx], ...updated };
          commitTableNotes(next);
          return next;
        }
        return prevTable;
      });

      // 2. Check GM Notes
      setGmNotes((prevGm) => {
        const idx = prevGm.findIndex((n) => n.id === updated.id);
        if (idx !== -1) {
          const next = [...prevGm];
          next[idx] = { ...next[idx], ...updated };
          try {
            localStorage.setItem(LOCAL_GM_NOTES_KEY, JSON.stringify(next));
          } catch (err) {
            console.warn('Failed saving GM notes from HUD event:', err);
          }
          return next;
        }
        return prevGm;
      });

      // 3. Check My Notes
      setMyNotes((prevMy) => {
        const idx = prevMy.findIndex((n) => n.id === updated.id);
        if (idx !== -1) {
          const next = [...prevMy];
          next[idx] = { ...next[idx], ...updated };
          try {
            localStorage.setItem(LOCAL_MY_NOTES_KEY, JSON.stringify(next));
          } catch (err) {
            console.warn('Failed saving My notes from HUD event:', err);
          }
          return next;
        }
        return prevMy;
      });

      // 4. Update live broadcast note if currently matching
      setActiveBroadcast((prevBroadcast) => {
        if (prevBroadcast && prevBroadcast.id === updated.id) {
          const nextPayload: BroadcastNotePayload = {
            ...prevBroadcast,
            title: updated.title,
            content: updated.content,
            theme: updated.theme || prevBroadcast.theme,
          };
          if (typeof OBR !== 'undefined' && OBR.isReady) {
            OBR.room.setMetadata({ [BROADCAST_KEY]: nextPayload });
          }
          return nextPayload;
        }
        return prevBroadcast;
      });
    };

    window.addEventListener('ashtapor:note_saved_from_hud', handleHudSaved);
    return () => {
      window.removeEventListener('ashtapor:note_saved_from_hud', handleHudSaved);
    };
  }, [commitTableNotes]);

  const handleToggleExpandNote = useCallback((id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, []);

  const handleExpandAllActiveTab = () => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      const targetList =
        activeSubTab === 'myNotes'
          ? myNotes
          : activeSubTab === 'tableNotes'
          ? tableNotes
          : gmNotes;
      targetList.forEach((n) => next.add(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleCollapseAllActiveTab = () => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      const targetList =
        activeSubTab === 'myNotes'
          ? myNotes
          : activeSubTab === 'tableNotes'
          ? tableNotes
          : gmNotes;
      targetList.forEach((n) => next.delete(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
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

  const handleImportNotes = (imported: NoteItem[]) => {
    if (activeSubTab === 'tableNotes') {
      const current = tableNotesRef.current;
      const mergedMap = new Map<string, NoteItem>();
      current.forEach((n) => mergedMap.set(n.id, n));
      imported.forEach((n) => mergedMap.set(n.id, n));
      commitTableNotes(Array.from(mergedMap.values()));
    } else if (activeSubTab === 'gmNotes') {
      const mergedMap = new Map<string, NoteItem>();
      gmNotes.forEach((n) => mergedMap.set(n.id, n));
      imported.forEach((n) => mergedMap.set(n.id, n));
      saveGmNotes(Array.from(mergedMap.values()));
    } else {
      const mergedMap = new Map<string, NoteItem>();
      myNotes.forEach((n) => mergedMap.set(n.id, n));
      imported.forEach((n) => mergedMap.set(n.id, n));
      saveMyNotes(Array.from(mergedMap.values()));
    }

    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      imported.forEach((n) => next.add(n.id));
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  // TABLE NOTES REAL-TIME OBR METADATA SYNCHRONIZATION
  useEffect(() => {
    let unsub: (() => void) | undefined;

    OBR.onReady(() => {
      OBR.room.getMetadata().then((meta) => {
        if (meta && Array.isArray(meta[TABLE_NOTES_KEY])) setTableNotes(meta[TABLE_NOTES_KEY]);
      });
      unsub = OBR.room.onMetadataChange((meta) => {
        if (meta && Array.isArray(meta[TABLE_NOTES_KEY])) {
          setTableNotes(meta[TABLE_NOTES_KEY]);
        }
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleSaveTableNote = useCallback(async (note: NoteItem) => {
    const current = tableNotesRef.current;
    const exists = current.some((n) => n.id === note.id);
    const updatedTableNotes = exists ? current.map((n) => (n.id === note.id ? note : n)) : [note, ...current];
    commitTableNotes(updatedTableNotes);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev).add(note.id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [commitTableNotes]);

  const handleDeleteTableNote = useCallback(async (id: string) => {
    const current = tableNotesRef.current;
    const updatedTableNotes = current.filter((n) => n.id !== id);
    commitTableNotes(updatedTableNotes);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  }, [commitTableNotes]);

  const handleTogglePinTableNote = useCallback(async (id: string) => {
    const current = tableNotesRef.current;
    const updatedTableNotes = current.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n
    );
    commitTableNotes(updatedTableNotes);
  }, [commitTableNotes]);

  // GM Notes State Operations
  const handleSaveGmNote = (note: NoteItem) => {
    const exists = gmNotes.some((n) => n.id === note.id);
    const updated = exists
      ? gmNotes.map((n) => (n.id === note.id ? note : n))
      : [note, ...gmNotes];
    saveGmNotes(updated);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev).add(note.id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleDeleteGmNote = async (id: string) => {
    if (activeBroadcast && activeBroadcast.id === id) {
      await handleStopBroadcast();
    }
    const updated = gmNotes.filter((n) => n.id !== id);
    saveGmNotes(updated);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistExpandedIdsToStorage(next);
      return next;
    });
  };

  const handleTogglePinGmNote = (id: string) => {
    const updated = gmNotes.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n
    );
    saveGmNotes(updated);
  };

  const handleStopBroadcast = async () => {
    setActiveBroadcast(null);
    if (typeof OBR !== 'undefined' && OBR.isReady) {
      await OBR.room.setMetadata({
        [BROADCAST_KEY]: undefined,
      });
    }
  };

  const handleBroadcast = async (note: NoteItem) => {
    const payload: BroadcastNotePayload = {
      id: note.id,
      title: note.title,
      content: note.content,
      theme: note.theme || 'slate',
      author: note.authorName || 'Game Master',
      timestamp: Date.now(),
    };

    setActiveBroadcast(payload);

    if (typeof OBR !== 'undefined' && OBR.isReady) {
      await OBR.room.setMetadata({
        [BROADCAST_KEY]: payload,
      });
    }
  };

  const handleToggleRevealNote = async (note: NoteItem) => {
    const isCurrentlyRevealed = activeBroadcast !== null && activeBroadcast.id === note.id;

    if (isCurrentlyRevealed) {
      await handleStopBroadcast();
    } else {
      await handleBroadcast(note);
    }
  };

  useEffect(() => {
    let unsub: (() => void) | undefined;

    OBR.onReady(() => {
      OBR.room.getMetadata().then((meta) => {
        const live = meta && (meta[BROADCAST_KEY] as BroadcastNotePayload | undefined);
        if (live && live.id && live.title) {
          setActiveBroadcast(live);
        } else {
          setActiveBroadcast(null);
        }
      });

      unsub = OBR.room.onMetadataChange((incomingMeta) => {
        const live = incomingMeta && (incomingMeta[BROADCAST_KEY] as BroadcastNotePayload | undefined);
        if (live && live.id && live.title) {
          setActiveBroadcast(live);
        } else {
          setActiveBroadcast(null);
        }
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const activeNotesList = useMemo<NoteItem[]>(() => {
    if (activeSubTab === 'myNotes') return myNotes;
    if (activeSubTab === 'tableNotes') return tableNotes;
    return gmNotes;
  }, [activeSubTab, myNotes, tableNotes, gmNotes]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: activeNotesList.length,
      General: 0,
      NPC: 0,
      Location: 0,
      Loot: 0,
      Encounters: 0,
      Leads: 0,
    };
    activeNotesList.forEach((n) => {
      const cat = normalizeCategory(n.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activeNotesList]);

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

  useEffect(() => {
    if (activeSelectedCategory !== 'All' && (categoryCounts[activeSelectedCategory] || 0) === 0) {
      setCategoryByTab((prev) => ({
        ...prev,
        [activeSubTab]: 'All',
      }));
    }
  }, [activeSelectedCategory, categoryCounts, activeSubTab]);

  const handleExportJSON = () => {
    setIsMaintenanceMenuOpen(false);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `ashtapor-notes-${dateStr}.json`;
    const notesToExport: NoteItem[] =
      activeSubTab === 'tableNotes'
        ? tableNotes
        : activeSubTab === 'gmNotes'
        ? gmNotes
        : myNotes;

    const payload: NotesExportPayload = {
      version: '2.0.27',
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

      if (!Array.isArray(rawNotes) || rawNotes.length === 0) return;

      const validList: NoteItem[] = [];
      for (const item of rawNotes) {
        if (item && (typeof item.title === 'string' || typeof item.content === 'string')) {
          validList.push({
            id:
              item.id ||
              `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: (item.title || 'Untitled Note').trim(),
            category: normalizeCategory(item.category),
            content: typeof item.content === 'string' ? item.content : '',
            theme: item.theme,
            isPinned: !!item.isPinned,
            updatedAt: item.updatedAt || new Date().toISOString(),
            createdAt: item.createdAt || new Date().toISOString(),
            authorRole: item.authorRole,
            authorName: item.authorName,
          });
        }
      }

      if (validList.length > 0) {
        handleImportNotes(validList);
      }
    } catch (err) {
      console.error('Failed to import JSON file:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTransferNote = useCallback((
    noteId: string,
    action: NoteTransferAction,
    sourceVault: SubTabType = activeSubTab
  ) => {
    let sourceNote: NoteItem | undefined;
    if (sourceVault === 'myNotes') sourceNote = myNotes.find((n) => n.id === noteId);
    else if (sourceVault === 'tableNotes') sourceNote = tableNotes.find((n) => n.id === noteId);
    else sourceNote = gmNotes.find((n) => n.id === noteId);

    if (!sourceNote) return;

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const normalizedCat = normalizeCategory(sourceNote.category);

    if (action === 'copy_to_table') {
      const copyItem: NoteItem = {
        id: newId,
        title: sourceNote.title,
        category: normalizedCat,
        content: sourceNote.content,
        theme: sourceNote.theme,
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: currentRole,
        authorName,
      };
      handleSaveTableNote(copyItem);
    } else if (action === 'move_to_table') {
      const moveItem: NoteItem = {
        id: newId,
        title: sourceNote.title,
        category: normalizedCat,
        content: sourceNote.content,
        theme: sourceNote.theme,
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: currentRole,
        authorName,
      };
      handleSaveTableNote(moveItem);
      if (sourceVault === 'myNotes') handleDeleteMyNote(noteId);
      else if (sourceVault === 'gmNotes') handleDeleteGmNote(noteId);
    } else if (action === 'copy_to_my') {
      const copyMyItem: NoteItem = {
        id: newId,
        title: sourceNote.title,
        category: normalizedCat,
        content: sourceNote.content,
        theme: sourceNote.theme,
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: currentRole,
        authorName,
      };
      handleSaveMyNote(copyMyItem);
    } else if (action === 'move_to_my') {
      const myItem: NoteItem = {
        id: newId,
        title: sourceNote.title,
        category: normalizedCat,
        content: sourceNote.content,
        theme: sourceNote.theme,
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: currentRole,
        authorName,
      };
      handleSaveMyNote(myItem);
      if (sourceVault === 'gmNotes') handleDeleteGmNote(noteId);
      else if (sourceVault === 'tableNotes') handleDeleteTableNote(noteId);
    } else if (action === 'copy_to_gm') {
      const gmItem: NoteItem = {
        id: newId,
        title: sourceNote.title,
        category: normalizedCat,
        content: sourceNote.content,
        theme: sourceNote.theme,
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: 'GM',
        authorName,
      };
      handleSaveGmNote(gmItem);
    } else if (action === 'move_to_gm' || (action as string) === 'move_to_dm') {
      const gmItem: NoteItem = {
        id: newId,
        title: sourceNote.title,
        category: normalizedCat,
        content: sourceNote.content,
        theme: sourceNote.theme,
        isPinned: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorRole: 'GM',
        authorName,
      };
      handleSaveGmNote(gmItem);
      if (sourceVault === 'myNotes') handleDeleteMyNote(noteId);
      else if (sourceVault === 'tableNotes') handleDeleteTableNote(noteId);
    }
  }, [
    activeSubTab,
    myNotes,
    tableNotes,
    gmNotes,
    authorName,
    currentRole,
    handleSaveTableNote,
    handleDeleteMyNote,
    handleDeleteGmNote,
    handleSaveGmNote,
    handleDeleteTableNote,
    handleSaveMyNote,
  ]);

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditFromReader = (note: NoteItem) => {
    setEditingNote(note);
    setIsCreateModalOpen(true);
  };

  const handleOpenReader = (id: string) => {
    setActiveReaderNoteId(id);
  };

  const handleSaveFromModal = (data: {
    title: string;
    category: NoteCategory;
    content: string;
    isPinned: boolean;
    theme?: NoteTheme;
  }) => {
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
      theme: data.theme,
      isPinned: data.isPinned,
      updatedAt: new Date().toISOString(),
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      authorRole: editingNote?.authorRole || (activeSubTab === 'gmNotes' ? 'GM' : currentRole),
      authorName: editingNote?.authorName || authorName,
    };

    if (activeSubTab === 'tableNotes') {
      handleSaveTableNote(updatedNote);
    } else if (activeSubTab === 'gmNotes') {
      handleSaveGmNote(updatedNote);
    } else {
      handleSaveMyNote(updatedNote);
    }

    setIsCreateModalOpen(false);
    setEditingNote(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-1.5 gap-1.5 relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {activeReaderNoteId !== null && activeReaderNote ? (
        <NoteReaderView
          note={activeReaderNote}
          onBack={() => setActiveReaderNoteId(null)}
          onEdit={() => handleOpenEditFromReader(activeReaderNote)}
          onDelete={() => {
            if (activeSubTab === 'myNotes') handleDeleteMyNote(activeReaderNote.id);
            else if (activeSubTab === 'tableNotes') handleDeleteTableNote(activeReaderNote.id);
            else handleDeleteGmNote(activeReaderNote.id);
            setActiveReaderNoteId(null);
          }}
          onSaveNote={(updated) => {
            if (activeSubTab === 'gmNotes') {
              handleSaveGmNote(updated);
            } else if (activeSubTab === 'tableNotes') {
              handleSaveTableNote(updated);
            } else {
              handleSaveMyNote(updated);
            }
          }}
          isGM={isGameMaster}
          currentVault={activeSubTab}
          onTransfer={(action) => handleTransferNote(activeReaderNote.id, action, activeSubTab)}
        />
      ) : (
        <>
          {/* Sub-Tab Navigation Header */}
          <div className="h-7 shrink-0 flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
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

            {isGameMaster && (
              <button
                type="button"
                onClick={() => setActiveSubTab('gmNotes')}
                className={
                  activeSubTab === 'gmNotes'
                    ? 'text-xs font-bold bg-rose-600 text-white px-2.5 py-1 rounded-md shadow flex items-center justify-center flex-1 h-full cursor-pointer truncate'
                    : 'text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center justify-center flex-1 h-full cursor-pointer truncate'
                }
                title="GM Notes Vault & Broadcast (GM Only)"
              >
                <Lock className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate">GM Notes</span>
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 border border-slate-700/60 text-slate-200 font-mono">
                  {gmNotes.length}
                </span>
                {activeBroadcast && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1 shrink-0" />
                )}
              </button>
            )}
          </div>

          {/* Active Broadcast Announcement Banner */}
          {isGameMaster && activeBroadcast && (
            <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/70 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm shrink-0 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-slate-100">Live Broadcast: </span>
                  <span className="text-amber-300 font-medium">"{activeBroadcast.title}"</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStopBroadcast}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition cursor-pointer shrink-0 flex items-center gap-1 shadow-sm"
                title="Stop broadcasting this note to all player screens"
              >
                <EyeOff className="w-3 h-3" />
                <span>Stop</span>
              </button>
            </div>
          )}

          {/* Search, Filter & Utility Bar */}
          <div className="shrink-0 flex items-center gap-1.5">
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
                  <div className="absolute right-0 mt-1 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 flex flex-col text-xs">
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

          {/* Category Filter Pills Strip */}
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

          {/* 1. My Notes View */}
          <div className={activeSubTab === 'myNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <NoteCardList
              notes={myNotes}
              expandedIds={expandedNoteIds}
              onToggleExpand={handleToggleExpandNote}
              onExpandAll={handleExpandAllActiveTab}
              onCollapseAll={handleCollapseAllActiveTab}
              onSaveNote={handleSaveMyNote}
              onDeleteNote={handleDeleteMyNote}
              onTogglePin={handleTogglePinMyNote}
              onImportNotes={handleImportNotes}
              allowImportExport={true}
              currentRole={currentRole}
              currentAuthorName={authorName}
              emptyMessage="No personal notes yet."
              emptySubtitle="Click '+' above to create cards for clues, loot, NPCs, or reminders."
              hideControls={true}
              externalSearchQuery={searchByTab.myNotes}
              externalSelectedCategory={categoryByTab.myNotes}
              onExternalResetFilters={handleResetActiveFilters}
              onOpenReader={handleOpenReader}
              isGM={isGameMaster}
              currentVault="myNotes"
              onTransfer={(id, action) => handleTransferNote(id, action, 'myNotes')}
              activeBroadcastId={activeBroadcast?.id || null}
            />
          </div>

          {/* 2. Table Notes View */}
          <div className={activeSubTab === 'tableNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <NoteCardList
              notes={tableNotes}
              expandedIds={expandedNoteIds}
              onToggleExpand={handleToggleExpandNote}
              onExpandAll={handleExpandAllActiveTab}
              onCollapseAll={handleCollapseAllActiveTab}
              onSaveNote={handleSaveTableNote}
              onDeleteNote={handleDeleteTableNote}
              onTogglePin={handleTogglePinTableNote}
              onImportNotes={handleImportNotes}
              allowImportExport={true}
              currentRole={currentRole}
              currentAuthorName={authorName}
              emptyMessage="No table notes shared yet."
              emptySubtitle="Any player or GM can add shared clues, loot, or inventory."
              hideControls={true}
              externalSearchQuery={searchByTab.tableNotes}
              externalSelectedCategory={categoryByTab.tableNotes}
              onExternalResetFilters={handleResetActiveFilters}
              onOpenReader={handleOpenReader}
              isGM={isGameMaster}
              currentVault="tableNotes"
              onTransfer={(id, action) => handleTransferNote(id, action, 'tableNotes')}
              activeBroadcastId={activeBroadcast?.id || null}
            />
          </div>

          {/* 3. GM Notes View */}
          {isGameMaster && (
            <div className={activeSubTab === 'gmNotes' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
              <NoteCardList
                notes={gmNotes}
                expandedIds={expandedNoteIds}
                onToggleExpand={handleToggleExpandNote}
                onExpandAll={handleExpandAllActiveTab}
                onCollapseAll={handleCollapseAllActiveTab}
                onSaveNote={handleSaveGmNote}
                onDeleteNote={handleDeleteGmNote}
                onTogglePin={handleTogglePinGmNote}
                onImportNotes={handleImportNotes}
                allowImportExport={true}
                currentRole="GM"
                currentAuthorName={authorName}
                emptyMessage="No secret GM notes yet."
                emptySubtitle="Click '+' above to write secret scenes, encounter tactics, or riddles."
                hideControls={true}
                externalSearchQuery={searchByTab.gmNotes}
                externalSelectedCategory={categoryByTab.gmNotes}
                onExternalResetFilters={handleResetActiveFilters}
                onOpenReader={handleOpenReader}
                isGM={true}
                currentVault="gmNotes"
                onTransfer={(id, action) => handleTransferNote(id, action, 'gmNotes')}
                onBroadcastNote={handleToggleRevealNote}
                activeBroadcastId={activeBroadcast?.id || null}
              />
            </div>
          )}
        </>
      )}

      {/* Large Note Modal */}
      <CreateNoteModal
        isOpen={isCreateModalOpen}
        isGM={isGameMaster}
        isGMSecretNote={activeSubTab === 'gmNotes'}
        currentVault={activeSubTab}
        editingNote={editingNote}
        defaultCategory={
          activeSelectedCategory !== 'All'
            ? (normalizeCategory(activeSelectedCategory))
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
