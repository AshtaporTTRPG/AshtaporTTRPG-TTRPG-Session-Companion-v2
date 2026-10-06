import React, { useState, useEffect, useRef, useCallback } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import {
  User,
  Scroll,
  Lock,
  FileText,
  Users,
  Coins,
  Search,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Check,
  Copy,
  Clock,
  Radio,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export type NotesScope = 'my-notes' | 'table-notes' | 'dm-notes';
export type PlayerCategory = 'general' | 'npcs' | 'loot' | 'clues';

export interface PlayerNotesState {
  general: string;
  npcs: string;
  loot: string;
  clues: string;
}

export interface DmSecretNote {
  id: string;
  title: string;
  content: string;
  isRevealed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BroadcastNotePayload {
  id: string;
  title: string;
  content: string;
  broadcastAt: number;
}

export const OBR_TABLE_NOTES_KEY = 'com.ashtapor.companion/table-notes';
export const OBR_BROADCAST_NOTE_KEY = 'com.ashtapor.companion/broadcast-note';
export const LOCAL_PLAYER_NOTES_KEY = 'ashtapor_player_notes_v2';
export const LOCAL_TABLE_NOTES_KEY = 'ashtapor_table_notes_cache';
export const LOCAL_DM_NOTES_KEY = 'ashtapor_dm_secret_notes';

const INITIAL_PLAYER_NOTES: PlayerNotesState = {
  general: '• Personal goals: Track down the apothecary who sold the cursed draught.\n• Reminders: Restock rations, sharpen daggers, prepare protection scrolls.\n• Intuitions: The hooded guide in the tavern seemed unusually familiar with the crypt.',
  npcs: '• Elara the Herbalist: Owed 20 GP for dried belladonna.\n• Captain Kenneth: Guard captain, fair-minded but under pressure from the magistrate.\n• Malakor the Blind: Mystic hermit in the marsh; warned of stone statues that walk at night.',
  loot: '• My Purse: 45 GP, 12 SP\n• Valerius: +1 Longsword (attuned)\n• Elara: Wand of Magic Missiles (4 charges remaining)\n• Personal Bag: 50ft silk rope, 3 torches, pouch of crushed obsidian',
  clues: '• Purple rune etched on the crypt lintel matches the abjuration sigil from the ruined temple.\n• Cipher snippet: "When the eclipse turns the obsidian spire red."',
};

const INITIAL_TABLE_NOTES =
  '⚔️ CAMPAIGN SHARED OBJECTIVES\n• Primary Quest: Infiltrate the Sunken Catacombs beneath Ashtapor.\n• Active Bounty: Recover the stolen Relic of the Sun Father.\n\n🎒 GROUP LOOT & SUPPLIES\n• Party Treasury: 580 GP, 110 SP, 3 uncut amethyst gems (50 GP each)\n• Shared Cart: 4x Potion of Healing, 2x Antitoxin vials, 100ft hempen rope, heavy crowbar.\n\n🗺️ CURRENT LOCATION\n• The Brazen Anchor Tavern - 3rd floor suite reserved for 5 nights.';

const INITIAL_DM_NOTES: DmSecretNote[] = [
  {
    id: 'dm-note-1',
    title: 'Ambush at the Sunken Bridge',
    content:
      'Trigger: When the party advances past the broken gargoyle, 4 Shadow Archers fire from murder holes (AC 13, HP 14, +5 to hit, 1d8+3 piercing + 1d6 necrotic).\n\nTrap DC 15 Perception: Hidden pressure plate at bridge center trips a falling portcullis (DC 14 Dex save or 2d10 bludgeoning and pinned).',
    isRevealed: false,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'dm-note-2',
    title: 'The Inquisitor’s True Identity',
    content:
      'Inquisitor Vane is secretly a doppelganger working under the orders of the Crimson Veil. If inspected with True Seeing or Divine Sense, detects as Monstrosity (Shapechanger).\n\nIf captured alive, carries a silver ring bearing the serpent crest of House Ashtapor.',
    isRevealed: false,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
];

interface NotesTabProps {
  isDm: boolean;
  playerName?: string;
}

export const NotesTab: React.FC<NotesTabProps> = ({ isDm }) => {
  // 1. Top-Level Scope Selector State
  const [scope, setScope] = useState<NotesScope>('my-notes');

  // 2. "My Notes" State (Strictly Local)
  const [myCategory, setMyCategory] = useState<PlayerCategory>('general');
  const [myNotes, setMyNotes] = useState<PlayerNotesState>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PLAYER_NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          general: typeof parsed.general === 'string' ? parsed.general : INITIAL_PLAYER_NOTES.general,
          npcs: typeof parsed.npcs === 'string' ? parsed.npcs : INITIAL_PLAYER_NOTES.npcs,
          loot: typeof parsed.loot === 'string' ? parsed.loot : INITIAL_PLAYER_NOTES.loot,
          clues: typeof parsed.clues === 'string' ? parsed.clues : INITIAL_PLAYER_NOTES.clues,
        };
      }
    } catch (e) {
      console.error('Failed to load my notes:', e);
    }
    return INITIAL_PLAYER_NOTES;
  });
  const [mySaveStatus, setMySaveStatus] = useState<'saved' | 'saving'>('saved');

  // 3. "Table Notes" State (Collaborative Room Metadata)
  const [tableNotesText, setTableNotesText] = useState<string>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_TABLE_NOTES_KEY);
      if (cached) return cached;
    } catch {}
    return INITIAL_TABLE_NOTES;
  });
  const [tableSaveStatus, setTableSaveStatus] = useState<'saved' | 'saving'>('saved');
  const isTypingTableRef = useRef<boolean>(false);
  const tableDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 4. "DM Notes" State (Secret Vault + Table Broadcast)
  const [dmNotes, setDmNotes] = useState<DmSecretNote[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_DM_NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_DM_NOTES;
  });
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<DmSecretNote | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');

  // Collapsed / Expanded DM note states persisted per note ID in local storage
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ashtapor_dm_notes_collapsed_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const toggleNoteCollapsed = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNotes((prev) => {
      const next = { ...prev, [noteId]: !prev[noteId] };
      try {
        localStorage.setItem('ashtapor_dm_notes_collapsed_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Safety: non-GMs must never access DM Notes
  useEffect(() => {
    if (!isDm && scope === 'dm-notes') {
      setScope('my-notes');
    }
  }, [isDm, scope]);

  // Persist My Notes to localStorage
  const saveMyNotes = useCallback((updated: PlayerNotesState) => {
    setMySaveStatus('saving');
    try {
      localStorage.setItem(LOCAL_PLAYER_NOTES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed saving player notes to localStorage:', e);
    }
    setTimeout(() => {
      setMySaveStatus('saved');
    }, 150);
  }, []);

  const handleMyTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const updated = {
      ...myNotes,
      [myCategory]: val,
    };
    setMyNotes(updated);
    saveMyNotes(updated);
  };

  // Sync Table Notes with OBR Room Metadata on mount
  useEffect(() => {
    if (!OBR.isReady) return;

    OBR.room
      .getMetadata()
      .then((meta) => {
        const remoteText = meta[OBR_TABLE_NOTES_KEY];
        if (typeof remoteText === 'string') {
          setTableNotesText(remoteText);
          try {
            localStorage.setItem(LOCAL_TABLE_NOTES_KEY, remoteText);
          } catch {}
        }
      })
      .catch((err) => console.warn('Could not fetch table notes metadata:', err));

    const unsub = OBR.room.onMetadataChange((meta) => {
      const remoteText = meta[OBR_TABLE_NOTES_KEY];
      if (typeof remoteText === 'string') {
        // If local user is not actively typing, sync smoothly
        if (!isTypingTableRef.current) {
          setTableNotesText(remoteText);
          try {
            localStorage.setItem(LOCAL_TABLE_NOTES_KEY, remoteText);
          } catch {}
        }
      }
    });

    return () => unsub();
  }, []);

  // 400ms Debounced Auto-Save for Table Notes
  const triggerDebouncedTableSave = useCallback((text: string) => {
    setTableSaveStatus('saving');
    isTypingTableRef.current = true;

    if (tableDebounceTimerRef.current) {
      clearTimeout(tableDebounceTimerRef.current);
    }

    tableDebounceTimerRef.current = setTimeout(async () => {
      try {
        localStorage.setItem(LOCAL_TABLE_NOTES_KEY, text);
        if (OBR.isReady) {
          await OBR.room.setMetadata({
            [OBR_TABLE_NOTES_KEY]: text,
          });
        } else {
          // Standalone preview fallback: dispatch storage event
          window.dispatchEvent(
            new CustomEvent('ashtapor-table-notes-sync', { detail: { text } })
          );
        }
      } catch (err) {
        console.error('Error saving table notes:', err);
      } finally {
        isTypingTableRef.current = false;
        setTableSaveStatus('saved');
      }
    }, 400);
  }, []);

  const handleTableTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTableNotesText(val);
    triggerDebouncedTableSave(val);
  };

  // Persist DM Notes to GM localStorage
  const saveDmNotes = (updated: DmSecretNote[]) => {
    setDmNotes(updated);
    try {
      localStorage.setItem(LOCAL_DM_NOTES_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Toggle "Reveal to Table" for a DM Secret Note
  const handleToggleReveal = async (note: DmSecretNote) => {
    const nextRevealed = !note.isRevealed;

    const updated = dmNotes.map((n) => {
      if (n.id === note.id) {
        return { ...n, isRevealed: nextRevealed, updatedAt: Date.now() };
      }
      // If toggling ON, unreveal any previously revealed note to avoid overlap
      if (nextRevealed && n.isRevealed) {
        return { ...n, isRevealed: false };
      }
      return n;
    });

    saveDmNotes(updated);

    try {
      if (nextRevealed) {
        const payload: BroadcastNotePayload = {
          id: note.id,
          title: note.title,
          content: note.content,
          broadcastAt: Date.now(),
        };

        if (OBR.isReady) {
          await OBR.room.setMetadata({
            [OBR_BROADCAST_NOTE_KEY]: payload,
          });
        }
        // Local/standalone fallback
        localStorage.setItem('ashtapor_broadcast_note', JSON.stringify(payload));
        window.dispatchEvent(
          new CustomEvent('ashtapor-broadcast-note', { detail: payload })
        );
      } else {
        if (OBR.isReady) {
          await OBR.room.setMetadata({
            [OBR_BROADCAST_NOTE_KEY]: undefined,
          });
        }
        localStorage.removeItem('ashtapor_broadcast_note');
        window.dispatchEvent(
          new CustomEvent('ashtapor-broadcast-note', { detail: null })
        );
      }
    } catch (err) {
      console.error('Failed to broadcast note to room:', err);
    }
  };

  // Create or Update DM Secret Note
  const handleSaveDmNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    if (editingNote) {
      const updated = dmNotes.map((n) =>
        n.id === editingNote.id
          ? {
              ...n,
              title: newNoteTitle.trim(),
              content: newNoteContent.trim(),
              updatedAt: Date.now(),
            }
          : n
      );
      saveDmNotes(updated);

      // If this note is currently revealed, update the broadcast payload
      if (editingNote.isRevealed) {
        const payload: BroadcastNotePayload = {
          id: editingNote.id,
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
          broadcastAt: Date.now(),
        };
        if (OBR.isReady) {
          OBR.room.setMetadata({ [OBR_BROADCAST_NOTE_KEY]: payload }).catch(() => {});
        }
        localStorage.setItem('ashtapor_broadcast_note', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('ashtapor-broadcast-note', { detail: payload }));
      }
    } else {
      const created: DmSecretNote = {
        id: `dm-note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        isRevealed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveDmNotes([created, ...dmNotes]);
    }

    setIsNoteEditorOpen(false);
    setEditingNote(null);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  // Delete DM Secret Note
  const handleDeleteDmNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = dmNotes.find((n) => n.id === id);
    if (!target) return;

    if (window.confirm(`Delete secret note "${target.title}"?`)) {
      if (target.isRevealed) {
        // Clear broadcast
        if (OBR.isReady) {
          await OBR.room.setMetadata({ [OBR_BROADCAST_NOTE_KEY]: undefined }).catch(() => {});
        }
        localStorage.removeItem('ashtapor_broadcast_note');
        window.dispatchEvent(new CustomEvent('ashtapor-broadcast-note', { detail: null }));
      }
      const updated = dmNotes.filter((n) => n.id !== id);
      saveDmNotes(updated);
    }
  };

  const handleOpenEditDmNote = (note: DmSecretNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(note);
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setIsNoteEditorOpen(true);
  };

  const handleOpenCreateDmNote = () => {
    setEditingNote(null);
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsNoteEditorOpen(true);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(label);
    setTimeout(() => setCopiedNotice(null), 1800);
  };

  // Stats for "My Notes"
  const currentMyText = myNotes[myCategory] || '';
  const myWordCount = currentMyText.trim() ? currentMyText.trim().split(/\s+/).length : 0;
  const myCharCount = currentMyText.length;

  // Stats for "Table Notes"
  const tableWordCount = tableNotesText.trim() ? tableNotesText.trim().split(/\s+/).length : 0;
  const tableCharCount = tableNotesText.length;

  // Check if any DM note is currently revealed
  const activeRevealedNote = dmNotes.find((n) => n.isRevealed);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-2 gap-2 relative">
      {/* 1. TOP SCOPE SELECTOR: [👤 My Notes] [📜 Table Notes] [🔒 DM Notes (GM Only)] */}
      <div className="shrink-0 p-1 bg-slate-900/95 border border-slate-800 rounded-xl shadow-sm">
        <div
          className={`grid gap-1 w-full ${
            isDm ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            onClick={() => setScope('my-notes')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer truncate ${
              scope === 'my-notes'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Private Player Scratchpad (Stored locally on your machine)"
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">My Notes</span>
          </button>

          <button
            type="button"
            onClick={() => setScope('table-notes')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer truncate ${
              scope === 'table-notes'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Table Notes (Shared collaborative pad in real time across the room)"
          >
            <Scroll className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Table Notes</span>
          </button>

          {isDm && (
            <button
              type="button"
              onClick={() => setScope('dm-notes')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer truncate ${
                scope === 'dm-notes'
                  ? 'bg-rose-500 text-slate-950 font-bold shadow-sm'
                  : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50'
              }`}
              title="DM Notes Vault & Broadcast (GM Only)"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">DM Notes</span>
              {activeRevealedNote && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. SCOPE 1: "MY NOTES" (PRIVATE PLAYER SCRATCHPAD) */}
      {scope === 'my-notes' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {/* Sub-Category Pills that wrap or fit cleanly without horizontal scrolling */}
          <div className="flex items-center justify-between gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
            <div className="flex flex-wrap items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => setMyCategory('general')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  myCategory === 'general'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>General</span>
              </button>

              <button
                type="button"
                onClick={() => setMyCategory('npcs')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  myCategory === 'npcs'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>NPCs</span>
              </button>

              <button
                type="button"
                onClick={() => setMyCategory('loot')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  myCategory === 'loot'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span>Loot</span>
              </button>

              <button
                type="button"
                onClick={() => setMyCategory('clues')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  myCategory === 'clues'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>Clues</span>
              </button>
            </div>

            {/* Privacy indicator */}
            <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-400 font-semibold">
              <span>Private Scratchpad</span>
            </div>
          </div>

          {/* Full-width auto-saving text area */}
          <div className="flex-1 min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col shadow-sm gap-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 font-display capitalize">
                  {myCategory}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {myWordCount} words · {myCharCount} chars
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Auto-save status */}
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {mySaveStatus === 'saving' ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      <span>Saved</span>
                    </span>
                  )}
                </div>

                {/* Copy & Clear */}
                <button
                  type="button"
                  onClick={() => copyText(currentMyText, 'My Notes')}
                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title="Copy category text to clipboard"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Clear text in [${myCategory}]?`)) {
                      const updated = { ...myNotes, [myCategory]: '' };
                      setMyNotes(updated);
                      saveMyNotes(updated);
                    }
                  }}
                  className="p-1 rounded bg-slate-950 hover:bg-rose-950/60 border border-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Clear text"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <textarea
              value={currentMyText}
              onChange={handleMyTextChange}
              placeholder={`Write private ${myCategory} scratchpad notes (auto-saved locally)...`}
              spellCheck={false}
              className="flex-1 w-full p-2.5 bg-slate-950/90 text-slate-100 placeholder-slate-600 border border-slate-800/80 rounded-xl focus:outline-none focus:border-amber-400/80 font-mono text-xs leading-relaxed resize-none shadow-inner"
            />

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 shrink-0">
              <span>Strictly private · Stored in local browser storage</span>
              <span className="font-mono text-slate-400">ashtapor_player_notes_v2</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. SCOPE 2: "TABLE NOTES" (SHARED COLLABORATIVE PAD) */}
      {scope === 'table-notes' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {/* Table Banner */}
          <div className="flex items-center justify-between p-2 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
            <div className="flex items-center gap-2">
              <Scroll className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-slate-100 font-display">
                  Table Collaborative Pad
                </h4>
                <p className="text-[10px] text-slate-400">
                  Shared across the entire table in real time. Any player or DM can contribute.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-[10px] font-mono text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Sync</span>
            </div>
          </div>

          {/* Full-width collaborative editor with 400ms debounced auto-save */}
          <div className="flex-1 min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col shadow-sm gap-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 font-display">Campaign Notes</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {tableWordCount} words · {tableCharCount} chars
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 400ms Auto-save status */}
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {tableSaveStatus === 'saving' ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      <span>Saving (400ms)...</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      <span>Synced</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => copyText(tableNotesText, 'Table Notes')}
                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title="Copy table notes to clipboard"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all collaborative table notes? This updates for everyone.')) {
                      setTableNotesText('');
                      triggerDebouncedTableSave('');
                    }
                  }}
                  className="p-1 rounded bg-slate-950 hover:bg-rose-950/60 border border-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Clear all table notes"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <textarea
              value={tableNotesText}
              onChange={handleTableTextChange}
              placeholder="Shared campaign objectives, group loot, active bounties, shared clues..."
              spellCheck={false}
              className="flex-1 w-full p-2.5 bg-slate-950/90 text-slate-100 placeholder-slate-600 border border-slate-800/80 rounded-xl focus:outline-none focus:border-amber-400/80 font-mono text-xs leading-relaxed resize-none shadow-inner"
            />

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 shrink-0">
              <span>Synchronized via OBR room metadata with 400ms debounce</span>
              <span className="font-mono text-slate-400">com.ashtapor.companion/table-notes</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. SCOPE 3: "DM NOTES" (SECRET DM VAULT WITH TABLE BROADCAST) */}
      {scope === 'dm-notes' && isDm && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {/* DM Vault Top Bar */}
          <div className="flex items-center justify-between p-2 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
                  <span>Secret DM Vault</span>
                  <span className="text-[10px] text-rose-400 font-sans font-semibold">
                    (GM Only · {dmNotes.length} notes)
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Manage secret cards. Use "👁️ Reveal to Table" to broadcast to player screens.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateDmNote}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Note</span>
            </button>
          </div>

          {/* Active Broadcast Announcement Banner */}
          {activeRevealedNote && (
            <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/70 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm shrink-0 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-slate-100">Live Table Broadcast: </span>
                  <span className="text-amber-300 font-medium">"{activeRevealedNote.title}"</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleReveal(activeRevealedNote)}
                className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer shrink-0"
              >
                Hide
              </button>
            </div>
          )}

          {/* Multi-Note Management Card List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
            {dmNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Lock className="w-8 h-8 opacity-30 text-slate-400" />
                <p className="text-xs font-medium text-slate-400">No secret DM notes yet.</p>
                <p className="text-[11px] text-slate-500">
                  Click "+ New Note" above to write encounter tactics, NPC statblocks, or riddles.
                </p>
              </div>
            ) : (
              dmNotes.map((note) => {
                const isCollapsed = !!collapsedNotes[note.id];
                const timeStr = new Date(note.updatedAt || note.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={note.id}
                    className={`p-2.5 rounded-xl border transition flex flex-col gap-2 ${
                      note.isRevealed
                        ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-400/40'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Card Header Row */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Collapse/Expand Toggle button (▼ / ▶) */}
                        <button
                          type="button"
                          onClick={(e) => toggleNoteCollapsed(note.id, e)}
                          className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center shrink-0 transition cursor-pointer"
                          title={isCollapsed ? 'Expand note (▶)' : 'Collapse note (▼)'}
                          aria-label={isCollapsed ? 'Expand note' : 'Collapse note'}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />

                        {/* Note Title fully legible in header row */}
                        <h4
                          className="text-xs font-bold text-slate-100 font-display truncate flex-1 min-w-0 cursor-pointer hover:text-amber-300 transition"
                          title={note.title}
                          onClick={(e) => toggleNoteCollapsed(note.id, e)}
                        >
                          {note.title}
                        </h4>
                      </div>

                      {/* Header Actions: Broadcast Button & Delete Button always accessible */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Broadcast: "👁️ Reveal to Table" button */}
                        <button
                          type="button"
                          onClick={() => handleToggleReveal(note)}
                          className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0 ${
                            note.isRevealed
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-1 ring-amber-300'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-400/60'
                          }`}
                          title={
                            note.isRevealed
                              ? 'Click to hide this note from player screens'
                              : 'Click to broadcast this note in a center modal on all player screens'
                          }
                        >
                          {note.isRevealed ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Hide</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 text-amber-400" />
                              <span>👁️ Reveal to Table</span>
                            </>
                          )}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditDmNote(note, e)}
                          className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer shrink-0"
                          title="Edit note"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        {/* Delete Button (🗑️) */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDmNote(note.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer shrink-0"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded State: Full text area for reading and editing */}
                    {!isCollapsed && (
                      <div className="space-y-2 pt-1 border-t border-slate-800/80">
                        <div
                          onClick={(e) => handleOpenEditDmNote(note, e)}
                          title="Click to edit full note"
                          className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/60 shadow-inner cursor-pointer hover:border-slate-700 transition"
                        >
                          {note.content}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
                          <span>
                            {timeStr} · {note.content.length} characters
                          </span>
                          {note.isRevealed ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span>Visible to players on table</span>
                            </span>
                          ) : (
                            <span>Hidden from table</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Copy Notification Toast */}
      {copiedNotice && (
        <div className="absolute bottom-4 right-4 z-40 px-3 py-1.5 rounded-lg bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-xl animate-fadeIn">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Copied {copiedNotice} to clipboard!</span>
        </div>
      )}

      {/* MODAL: CREATE / EDIT DM SECRET NOTE */}
      {isNoteEditorOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>{editingNote ? 'Edit Secret Note' : 'Create Secret DM Note'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsNoteEditorOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDmNote} className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Note Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Crypt Ambush, Traitor in the Guard, Tomb Riddle"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Secret Content / DM Details *
                </label>
                <textarea
                  rows={6}
                  placeholder="Secret triggers, DCs, monster statblocks, puzzle solutions, or lore you may reveal..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500">
                  Can be revealed to table anytime.
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsNoteEditorOpen(false)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow"
                  >
                    {editingNote ? 'Save Changes' : 'Save Note'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
