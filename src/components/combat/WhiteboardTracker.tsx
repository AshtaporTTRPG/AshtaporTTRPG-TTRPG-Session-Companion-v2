import React, { useState, useEffect, useRef, useCallback } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import {
  Play,
  RotateCcw,
  ChevronLeft,
  ArrowUpDown,
  Trash2,
  Plus,
  X,
  Skull,
  GripVertical,
  Copy,
  Check,
  Tag,
} from 'lucide-react';
import { WhiteboardCombatant, WhiteboardState } from '../../types/whiteboard';

const WHITEBOARD_KEY = 'ashtapor/whiteboard';

const DEFAULT_STATE: WhiteboardState = {
  round: 1,
  activeIndex: 0,
  combatants: [],
};

const QUICK_CONDITIONS = ['Concentrating', 'Prone', 'Poisoned', 'Bless', 'Bane'];

export interface WhiteboardTrackerProps {
  isGM?: boolean;
}

interface CombatantRowProps {
  combatant: WhiteboardCombatant;
  isActive: boolean;
  isGM: boolean;
  idx: number;
  onUpdate: (id: string, patch: Partial<WhiteboardCombatant>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart?: (idx: number) => void;
  onDragOver?: (e: React.DragEvent, idx: number) => void;
  onDragEnd?: () => void;
}

const CombatantRow: React.FC<CombatantRowProps> = ({
  combatant,
  isActive,
  isGM,
  idx,
  onUpdate,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}) => {
  const [localName, setLocalName] = useState(combatant.name);
  const [localInit, setLocalInit] = useState(String(combatant.initiative));
  const [localNote, setLocalNote] = useState(combatant.note || '');

  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [customTag, setCustomTag] = useState('');

  const isNameFocusedRef = useRef(false);
  const isInitFocusedRef = useRef(false);
  const isNoteFocusedRef = useRef(false);

  useEffect(() => {
    if (!isNameFocusedRef.current) setLocalName(combatant.name);
  }, [combatant.name]);

  useEffect(() => {
    if (!isInitFocusedRef.current) setLocalInit(String(combatant.initiative));
  }, [combatant.initiative]);

  useEffect(() => {
    if (!isNoteFocusedRef.current) setLocalNote(combatant.note || '');
  }, [combatant.note]);

  const commitName = useCallback(() => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== combatant.name) {
      onUpdate(combatant.id, { name: trimmed });
    } else if (!trimmed) {
      setLocalName(combatant.name);
    }
  }, [localName, combatant.name, combatant.id, onUpdate]);

  const commitInit = useCallback(() => {
    const parsed = parseFloat(localInit);
    const valid = isNaN(parsed) ? 0 : parsed;
    if (valid !== combatant.initiative) {
      onUpdate(combatant.id, { initiative: valid });
    }
  }, [localInit, combatant.initiative, combatant.id, onUpdate]);

  const commitNote = useCallback(() => {
    const trimmed = localNote.trim();
    const existing = combatant.note || '';
    if (trimmed !== existing) {
      onUpdate(combatant.id, { note: trimmed || undefined });
    }
  }, [localNote, combatant.note, combatant.id, onUpdate]);

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || combatant.conditions.includes(trimmed)) return;
    onUpdate(combatant.id, {
      conditions: [...combatant.conditions, trimmed],
    });
    setCustomTag('');
    setIsTagPickerOpen(false);
  };

  const handleRemoveTag = (tagIndex: number) => {
    onUpdate(combatant.id, {
      conditions: combatant.conditions.filter((_, i) => i !== tagIndex),
    });
  };

  const hasActiveTags = combatant.conditions.length > 0;
  const hasNote = Boolean(combatant.note && combatant.note.trim());
  const shouldRenderRow2 = hasActiveTags || hasNote || isTagPickerOpen;

  return (
    <div
      draggable={isGM}
      onDragStart={() => onDragStart && onDragStart(idx)}
      onDragOver={(e) => onDragOver && onDragOver(e, idx)}
      onDragEnd={onDragEnd}
      className={`relative rounded-lg border transition-all flex flex-col justify-center ${
        isActive
          ? 'ring-2 ring-amber-400 bg-amber-500/10 border-amber-400/50 shadow-md'
          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
      } ${combatant.isDowned ? 'opacity-40 grayscale-[60%]' : ''}`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: combatant.color || '#3B82F6',
      }}
    >
      <div className="flex items-center justify-between gap-1.5 py-1 px-2 min-h-[36px]">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isGM && (
            <span
              className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 shrink-0"
              title="Drag to reorder initiative"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>
          )}

          <input
            type="number"
            value={localInit}
            onFocus={() => { isInitFocusedRef.current = true; }}
            onChange={(e) => setLocalInit(e.target.value)}
            onBlur={() => {
              isInitFocusedRef.current = false;
              commitInit();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="w-10 px-1 py-0.5 text-center text-xs font-mono font-bold bg-slate-950 border border-slate-700 rounded text-amber-300 focus:outline-none focus:border-amber-400 shrink-0"
            title="Initiative Score"
          />

          <input
            type="text"
            value={localName}
            onFocus={() => { isNameFocusedRef.current = true; }}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => {
              isNameFocusedRef.current = false;
              commitName();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={`flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-100 focus:outline-none focus:bg-slate-950/80 rounded px-1.5 py-0.5 truncate transition ${
              combatant.isDowned ? 'line-through text-slate-400' : ''
            }`}
            title="Combatant Name"
          />

          {!shouldRenderRow2 && (
            <button
              type="button"
              onClick={() => setIsTagPickerOpen(true)}
              className="text-[10px] text-slate-500 hover:text-amber-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition flex items-center gap-0.5 shrink-0"
              title="Add Condition Tag or Note"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>+ Tag</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <label
            className="relative w-4 h-4 rounded-full cursor-pointer border border-white/30 shadow-sm hover:scale-110 transition-transform shrink-0 flex items-center justify-center"
            style={{ backgroundColor: combatant.color || '#3B82F6' }}
            title="Change Marker Color"
          >
            <input
              type="color"
              value={combatant.color || '#3B82F6'}
              onChange={(e) => onUpdate(combatant.id, { color: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={() => onUpdate(combatant.id, { isDowned: !combatant.isDowned })}
            title={combatant.isDowned ? 'Mark Active' : 'Mark Downed (💀)'}
            className={`p-1 rounded transition-colors cursor-pointer ${
              combatant.isDowned
                ? 'text-rose-400 bg-rose-950/60 ring-1 ring-rose-500/50'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Skull className="w-3.5 h-3.5" />
          </button>

          {isGM && (
            <>
              <button
                type="button"
                onClick={() => onDuplicate(combatant.id)}
                title="Duplicate Combatant"
                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDelete(combatant.id)}
                title="Remove from board"
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {shouldRenderRow2 && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1.5 pt-0.5 border-t border-slate-800/60 text-xs">
          {combatant.conditions.map((tag, tIdx) => (
            <span
              key={`${tag}-${tIdx}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 border border-slate-700 shadow-sm"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tIdx)}
                className="text-slate-400 hover:text-rose-400 transition"
                title={`Remove ${tag}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTagPickerOpen(!isTagPickerOpen)}
              className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/80 transition-colors flex items-center gap-1"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Tag</span>
            </button>

            {isTagPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsTagPickerOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-40 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold border-b border-slate-800 pb-1">
                    <span>Quick Conditions</span>
                    <button
                      type="button"
                      onClick={() => setIsTagPickerOpen(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {QUICK_CONDITIONS.map((qTag) => {
                      const isApplied = combatant.conditions.includes(qTag);
                      return (
                        <button
                          key={qTag}
                          type="button"
                          disabled={isApplied}
                          onClick={() => handleAddTag(qTag)}
                          className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
                            isApplied
                              ? 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border-slate-700 cursor-pointer'
                          }`}
                        >
                          {qTag}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
                    <input
                      type="text"
                      placeholder="Custom tag..."
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(customTag);
                        }
                      }}
                      className="flex-1 px-1.5 py-0.5 text-[10px] bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-400 font-sans"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag(customTag)}
                      className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <input
            type="text"
            placeholder="+ note (e.g. AC 15, Resist Fire)..."
            value={localNote}
            onFocus={() => { isNoteFocusedRef.current = true; }}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={() => {
              isNoteFocusedRef.current = false;
              commitNote();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="flex-1 min-w-[120px] bg-slate-950/50 hover:bg-slate-950/80 focus:bg-slate-950 border border-transparent focus:border-slate-700 rounded text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:text-slate-100 px-1.5 py-0.5 transition"
            title="Note"
          />
        </div>
      )}
    </div>
  );
};

export const WhiteboardTracker: React.FC<WhiteboardTrackerProps> = ({ isGM = false }) => {
  const [board, setBoard] = useState<WhiteboardState>(DEFAULT_STATE);
  const boardRef = useRef<WhiteboardState>(DEFAULT_STATE);
  boardRef.current = board;
  const hasLoadedRoomRef = useRef<boolean>(false);

  const [isAddStripOpen, setIsAddStripOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const attach = async () => {
      try {
        if (typeof OBR !== 'undefined' && OBR.isReady) {
          const meta = await OBR.room.getMetadata();
          const existing = meta[WHITEBOARD_KEY] as WhiteboardState | undefined;
          if (existing && Array.isArray(existing.combatants)) {
            setBoard(existing);
          }
          hasLoadedRoomRef.current = true;

          unsub = OBR.room.onMetadataChange((incomingMeta) => {
            const live = incomingMeta[WHITEBOARD_KEY] as WhiteboardState | undefined;
            if (live && Array.isArray(live.combatants)) {
              setBoard(live);
            }
          });
        }
      } catch (err) {
        console.warn('Could not initialize whiteboard room sync:', err);
        hasLoadedRoomRef.current = true;
      }
    };

    if (typeof OBR !== 'undefined') {
      if (OBR.isReady) {
        attach();
      } else {
        OBR.onReady(() => attach());
      }
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (isAddStripOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isAddStripOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddStripOpen) {
        e.preventDefault();
        setIsAddStripOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddStripOpen]);

  const commitBoard = useCallback(async (newState: WhiteboardState) => {
    setBoard(newState);
    try {
      localStorage.setItem('ashtapor_whiteboard_state', JSON.stringify(newState));
    } catch {}

    try {
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        await OBR.room.setMetadata({ [WHITEBOARD_KEY]: newState });
      }
    } catch (err) {
      console.error('Failed to commit whiteboard metadata:', err);
    }
  }, []);

  const handleSort = () => {
    if (!isGM) return;
    const sorted = [...boardRef.current.combatants].sort((a, b) => b.initiative - a.initiative);
    commitBoard({ ...boardRef.current, combatants: sorted });
  };

  const handleNextTurn = () => {
    if (!isGM || boardRef.current.combatants.length === 0) return;
    let nextIndex = boardRef.current.activeIndex + 1;
    let nextRound = boardRef.current.round;

    if (nextIndex >= boardRef.current.combatants.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    const activeCount = boardRef.current.combatants.filter((c) => !c.isDowned).length;
    if (activeCount > 0) {
      let attempts = 0;
      while (boardRef.current.combatants[nextIndex]?.isDowned && attempts < boardRef.current.combatants.length) {
        nextIndex++;
        if (nextIndex >= boardRef.current.combatants.length) {
          nextIndex = 0;
          nextRound += 1;
        }
        attempts++;
      }
    }

    commitBoard({ ...boardRef.current, activeIndex: nextIndex, round: nextRound });
  };

  const handlePrevTurn = () => {
    if (!isGM || boardRef.current.combatants.length === 0) return;
    let prevIndex = boardRef.current.activeIndex - 1;
    let prevRound = boardRef.current.round;

    if (prevIndex < 0) {
      prevIndex = boardRef.current.combatants.length - 1;
      prevRound = Math.max(1, prevRound - 1);
    }

    commitBoard({ ...boardRef.current, activeIndex: prevIndex, round: prevRound });
  };

  const handleRewind = () => {
    if (!isGM) return;
    commitBoard({ ...boardRef.current, round: 1, activeIndex: 0 });
  };

  const handleClearBoard = () => {
    if (!isGM) return;
    if (window.confirm('Clear all combatants from the Whiteboard?')) {
      commitBoard(DEFAULT_STATE);
    }
  };

  // Fixed: Guaranteed fresh state via functional update
  const handleConfirmAddCombatant = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isGM || !newName.trim()) return;

    const parsedInit = parseFloat(newInit) || 0;
    const newCombatant: WhiteboardCombatant = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newName.trim(),
      initiative: parsedInit,
      color: newColor,
      conditions: [],
      isDowned: false,
    };

    setBoard((prev) => {
      const nextState = { ...prev, combatants: [...prev.combatants, newCombatant] };
      try {
        localStorage.setItem('ashtapor_whiteboard_state', JSON.stringify(nextState));
      } catch {}
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        OBR.room.setMetadata({ [WHITEBOARD_KEY]: nextState }).catch(console.error);
      }
      return nextState;
    });

    setNewName('');
    setNewInit('');
    setIsAddStripOpen(false);
  };

  const handleUpdateCombatant = useCallback((id: string, patch: Partial<WhiteboardCombatant>) => {
    setBoard((prev) => {
      const updated = prev.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c));
      const nextState = { ...prev, combatants: updated };
      try {
        localStorage.setItem('ashtapor_whiteboard_state', JSON.stringify(nextState));
      } catch {}
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        OBR.room.setMetadata({ [WHITEBOARD_KEY]: nextState }).catch(console.error);
      }
      return nextState;
    });
  }, []);

  const handleDuplicateCombatant = useCallback((id: string) => {
    if (!isGM) return;
    setBoard((prev) => {
      const target = prev.combatants.find((c) => c.id === id);
      if (!target) return prev;

      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `wb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const clone: WhiteboardCombatant = {
        ...target,
        id: newId,
        name: `${target.name} (Copy)`,
        conditions: [...target.conditions],
        isDowned: false,
      };

      const updated = [...prev.combatants, clone];
      const nextState = { ...prev, combatants: updated };
      try {
        localStorage.setItem('ashtapor_whiteboard_state', JSON.stringify(nextState));
      } catch {}
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        OBR.room.setMetadata({ [WHITEBOARD_KEY]: nextState }).catch(console.error);
      }
      return nextState;
    });
  }, [isGM]);

  const handleDeleteCombatant = useCallback((id: string) => {
    if (!isGM) return;
    setBoard((prev) => {
      const updated = prev.combatants.filter((c) => c.id !== id);
      const newActiveIndex =
        prev.activeIndex >= updated.length ? Math.max(0, updated.length - 1) : prev.activeIndex;
      const nextState = { ...prev, combatants: updated, activeIndex: newActiveIndex };
      try {
        localStorage.setItem('ashtapor_whiteboard_state', JSON.stringify(nextState));
      } catch {}
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        OBR.room.setMetadata({ [WHITEBOARD_KEY]: nextState }).catch(console.error);
      }
      return nextState;
    });
  }, [isGM]);

  // Drag and Drop: Local state update only during drag, commits once on DragEnd
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    if (!isGM) return;
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (!isGM || draggedIdx === null || draggedIdx === idx) return;

    const list = [...boardRef.current.combatants];
    const [moved] = list.splice(draggedIdx, 1);
    list.splice(idx, 0, moved);

    setDraggedIdx(idx);
    setBoard((prev) => ({ ...prev, combatants: list }));
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    if (isGM) {
      commitBoard(boardRef.current);
    }
  };

  const currentCombatant = board.combatants[board.activeIndex];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100 select-text">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 bg-slate-900/95 shrink-0 min-h-[38px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded shrink-0">
            R{board.round}
          </span>
          <span className="text-xs font-semibold text-slate-300 truncate max-w-[140px]">
            {currentCombatant ? `Turn: ${currentCombatant.name}` : 'No Combatants'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isGM && (
            <>
              <button
                type="button"
                onClick={() => setIsAddStripOpen(!isAddStripOpen)}
                title={isAddStripOpen ? 'Close creation strip' : 'Add Combatant (GM)'}
                className={`flex items-center justify-center w-6 h-6 rounded border transition active:scale-95 cursor-pointer ${
                  isAddStripOpen
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleSort}
                title="Sort descending by Initiative"
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 active:scale-95 cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Sort</span>
              </button>

              <div className="flex items-center gap-0.5 ml-1 border-l border-slate-700 pl-1">
                <button
                  type="button"
                  onClick={handleRewind}
                  title="Rewind to Round 1, Turn 1"
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevTurn}
                  title="Previous Turn"
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextTurn}
                  title="Next Turn"
                  className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded shadow active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Next</span>
                </button>
              </div>

              {board.combatants.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearBoard}
                  title="Clear all combatants"
                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer ml-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isGM && isAddStripOpen && (
        <form
          onSubmit={handleConfirmAddCombatant}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border-b border-amber-500/50 shadow-md shrink-0 animate-fadeIn text-xs"
        >
          <input
            type="number"
            placeholder="Init"
            value={newInit}
            onChange={(e) => setNewInit(e.target.value)}
            className="w-12 px-1.5 py-1 text-xs font-mono font-bold bg-slate-950 border border-slate-700 rounded text-amber-300 focus:outline-none focus:border-amber-400 text-center"
          />

          <input
            ref={nameInputRef}
            type="text"
            placeholder="Combatant name (e.g. Goblin 1, Aria)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-sans"
          />

          <label
            className="relative w-5 h-5 rounded-full cursor-pointer border border-white/30 shadow-sm shrink-0 flex items-center justify-center hover:scale-105 transition"
            style={{ backgroundColor: newColor }}
            title="Marker Color"
          >
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>

          <button
            type="submit"
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded shadow active:scale-95 cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddStripOpen(false)}
            title="Cancel (Esc)"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
        {board.combatants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center p-4">
            <p className="font-semibold text-slate-400">Battle Board is empty.</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {isGM
                ? 'Click the "+" button in the top header bar to add combatants.'
                : 'Waiting for the GM to add combatants to initiative.'}
            </p>
          </div>
        ) : (
          board.combatants.map((c, idx) => (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActive={idx === board.activeIndex}
              isGM={isGM}
              idx={idx}
              onUpdate={handleUpdateCombatant}
              onDuplicate={handleDuplicateCombatant}
              onDelete={handleDeleteCombatant}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default WhiteboardTracker;
