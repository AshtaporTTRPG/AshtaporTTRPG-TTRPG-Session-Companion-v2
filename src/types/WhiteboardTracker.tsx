import React, { useState, useEffect, useRef } from 'react';
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
  GripVertical 
} from 'lucide-react';
import { WhiteboardCombatant, WhiteboardState } from './whiteboard';

const WHITEBOARD_KEY = 'ashtapor/whiteboard';

const DEFAULT_STATE: WhiteboardState = {
  round: 1,
  activeIndex: 0,
  combatants: []
};

const QUICK_CONDITIONS = ['Concentrating', 'Prone', 'Poisoned', 'Bless', 'Bane'];

interface WhiteboardTrackerProps {
  isGM?: boolean;
}

export const WhiteboardTracker: React.FC<WhiteboardTrackerProps> = ({ isGM = false }) => {
  const [board, setBoard] = useState<WhiteboardState>(DEFAULT_STATE);
  const hasLoadedRoomRef = useRef<boolean>(false);

  // New Combatant Input State
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');

  // Condition Tag Popover State
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState('');

  // 1. Initial Mount & Live Room Sync with Safe OBR Readiness & Mount Guard
  useEffect(() => {
    if (typeof OBR === 'undefined') return;

    let unsub: (() => void) | undefined;

    const attach = async () => {
      try {
        if (!OBR.isReady) return;

        // Fetch initial room metadata before allowing outgoing writes
        const meta = await OBR.room.getMetadata();
        const existing = meta[WHITEBOARD_KEY] as WhiteboardState | undefined;
        if (existing && Array.isArray(existing.combatants)) {
          setBoard(existing);
        }
        hasLoadedRoomRef.current = true;

        // Subscribe to live metadata changes
        unsub = OBR.room.onMetadataChange((incomingMeta) => {
          const live = incomingMeta[WHITEBOARD_KEY] as WhiteboardState | undefined;
          if (live && Array.isArray(live.combatants)) {
            setBoard(live);
          }
        });
      } catch (err) {
        console.warn('Could not initialize whiteboard room sync:', err);
        hasLoadedRoomRef.current = true;
      }
    };

    if (OBR.isReady) {
      attach();
    } else {
      OBR.onReady(() => {
        attach();
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 2. Direct Network Writer (Protected by Mount Guard)
  const commitBoard = async (newState: WhiteboardState) => {
    setBoard(newState);
    try {
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        if (!hasLoadedRoomRef.current) return;
        await OBR.room.setMetadata({ [WHITEBOARD_KEY]: newState });
      }
    } catch (err) {
      console.error('Failed to commit whiteboard metadata:', err);
    }
  };

  // 3. GM Controls: Turn Progression & Sorting
  const handleSort = () => {
    const sorted = [...board.combatants].sort((a, b) => b.initiative - a.initiative);
    commitBoard({ ...board, combatants: sorted });
  };

  const handleNextTurn = () => {
    if (board.combatants.length === 0) return;
    let nextIndex = board.activeIndex + 1;
    let nextRound = board.round;

    if (nextIndex >= board.combatants.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    // Skip downed combatants if active ones exist
    const activeCount = board.combatants.filter(c => !c.isDowned).length;
    if (activeCount > 0) {
      let attempts = 0;
      while (board.combatants[nextIndex]?.isDowned && attempts < board.combatants.length) {
        nextIndex++;
        if (nextIndex >= board.combatants.length) {
          nextIndex = 0;
          nextRound += 1;
        }
        attempts++;
      }
    }

    commitBoard({ ...board, activeIndex: nextIndex, round: nextRound });
  };

  const handlePrevTurn = () => {
    if (board.combatants.length === 0) return;
    let prevIndex = board.activeIndex - 1;
    let prevRound = board.round;

    if (prevIndex < 0) {
      prevIndex = board.combatants.length - 1;
      prevRound = Math.max(1, prevRound - 1);
    }

    commitBoard({ ...board, activeIndex: prevIndex, round: prevRound });
  };

  const handleRewind = () => {
    commitBoard({ ...board, round: 1, activeIndex: 0 });
  };

  const handleClearBoard = () => {
    if (window.confirm('Clear all combatants from the Whiteboard?')) {
      commitBoard(DEFAULT_STATE);
    }
  };

  // 4. Combatant Actions
  const handleAddCombatant = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName.trim()) return;

    const parsedInit = parseFloat(newInit) || 0;
    const newCombatant: WhiteboardCombatant = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      initiative: parsedInit,
      color: newColor,
      conditions: [],
      isDowned: false
    };

    const updated = [...board.combatants, newCombatant];
    commitBoard({ ...board, combatants: updated });

    setNewName('');
    setNewInit('');
  };

  const updateCombatant = (id: string, patch: Partial<WhiteboardCombatant>) => {
    const updated = board.combatants.map(c => c.id === id ? { ...c, ...patch } : c);
    commitBoard({ ...board, combatants: updated });
  };

  const handleDeleteCombatant = (id: string) => {
    const updated = board.combatants.filter(c => c.id !== id);
    const newActiveIndex = board.activeIndex >= updated.length ? Math.max(0, updated.length - 1) : board.activeIndex;
    commitBoard({ ...board, combatants: updated, activeIndex: newActiveIndex });
  };

  const handleAddCondition = (combatantId: string, tag: string) => {
    if (!tag.trim()) return;
    const combatant = board.combatants.find(c => c.id === combatantId);
    if (!combatant || combatant.conditions.includes(tag.trim())) return;

    updateCombatant(combatantId, {
      conditions: [...combatant.conditions, tag.trim()]
    });
    setCustomTag('');
    setActiveTagId(null);
  };

  const handleRemoveCondition = (combatantId: string, tagIndex: number) => {
    const combatant = board.combatants.find(c => c.id === combatantId);
    if (!combatant) return;

    updateCombatant(combatantId, {
      conditions: combatant.conditions.filter((_, idx) => idx !== tagIndex)
    });
  };

  // 5. Drag-and-Drop Reordering (GM Only)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    if (!isGM) return;
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (!isGM || draggedIdx === null || draggedIdx === idx) return;

    const list = [...board.combatants];
    const [moved] = list.splice(draggedIdx, 1);
    list.splice(idx, 0, moved);

    setDraggedIdx(idx);
    commitBoard({ ...board, combatants: list });
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const currentCombatant = board.combatants[board.activeIndex];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100 select-text">
      {/* HEADER / CASSETTE BAR */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
            R{board.round}
          </span>
          <span className="text-xs font-semibold text-slate-300 truncate max-w-[150px]">
            {currentCombatant ? `Turn: ${currentCombatant.name}` : 'No Combatants'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* SORT BUTTON: VISIBLE EXCLUSIVELY TO GM */}
          {isGM && (
            <button
              onClick={handleSort}
              title="Sort descending by Initiative"
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 active:scale-95"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort</span>
            </button>
          )}

          {/* TURN NAVIGATION: VISIBLE EXCLUSIVELY TO GM */}
          {isGM && (
            <div className="flex items-center gap-0.5 ml-1 border-l border-slate-700 pl-1">
              <button
                onClick={handleRewind}
                title="Rewind to Round 1, Turn 1"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handlePrevTurn}
                title="Previous Turn"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextTurn}
                title="Next Turn"
                className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded shadow active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Next</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* COMBATANT TILES LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
        {board.combatants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
            <p>Battle Board is empty.</p>
            <p className="mt-1">Add an entry below to begin initiative.</p>
          </div>
        ) : (
          board.combatants.map((c, idx) => {
            const isActive = idx === board.activeIndex;
            return (
              <div
                key={c.id}
                draggable={isGM}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative flex flex-col gap-1.5 p-2 rounded-lg border transition-all ${
                  isActive
                    ? 'ring-2 ring-amber-400 bg-amber-500/10 border-amber-400/50 shadow-md animate-pulse'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                } ${c.isDowned ? 'opacity-40 grayscale-[50%]' : ''}`}
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: c.color || '#3B82F6'
                }}
              >
                {/* TILE HEADER ROW */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {isGM && (
                      <span className="cursor-grab text-slate-600 hover:text-slate-400">
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* Initiative Pill (Editable) */}
                    <input
                      type="number"
                      value={c.initiative}
                      onChange={(e) => updateCombatant(c.id, { initiative: parseFloat(e.target.value) || 0 })}
                      className="w-10 px-1 py-0.5 text-center text-xs font-mono font-bold bg-slate-950 border border-slate-700 rounded text-amber-300 focus:outline-none focus:border-amber-400"
                      title="Initiative Score"
                    />

                    {/* Character / Monster Name */}
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => updateCombatant(c.id, { name: e.target.value })}
                      className={`flex-1 bg-transparent text-sm font-semibold text-slate-100 focus:outline-none focus:bg-slate-950/60 rounded px-1 ${
                        c.isDowned ? 'line-through text-slate-400' : ''
                      }`}
                    />
                  </div>

                  {/* Actions Strip */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Native Color Swatch */}
                    <label
                      className="relative w-4 h-4 rounded-full cursor-pointer border border-white/20 shadow-sm hover:scale-110 transition-transform shrink-0"
                      style={{ backgroundColor: c.color || '#3B82F6' }}
                      title="Change Color"
                    >
                      <input
                        type="color"
                        value={c.color || '#3B82F6'}
                        onChange={(e) => updateCombatant(c.id, { color: e.target.value })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>

                    {/* Downed Toggle */}
                    <button
                      onClick={() => updateCombatant(c.id, { isDowned: !c.isDowned })}
                      title={c.isDowned ? 'Mark Active' : 'Mark Downed (💀)'}
                      className={`p-1 rounded transition-colors ${
                        c.isDowned ? 'text-rose-400 bg-rose-950/50' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Skull className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Entry */}
                    <button
                      onClick={() => handleDeleteCombatant(c.id)}
                      title="Remove from board"
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* CONDITIONS & NOTE ROW */}
                <div className="flex flex-wrap items-center gap-1 text-xs pt-1 border-t border-slate-800/60">
                  {/* Active Condition Tags */}
                  {c.conditions.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 border border-slate-700"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveCondition(c.id, tIdx)}
                        className="hover:text-rose-400"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}

                  {/* Add Condition Trigger */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveTagId(activeTagId === c.id ? null : c.id)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/80 transition-colors"
                    >
                      + Tag
                    </button>

                    {/* Popover Opens DOWNWARD with Backdrop */}
                    {activeTagId === c.id && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setActiveTagId(null)}
                        />
                        <div className="absolute left-0 top-full mt-1 z-30 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {QUICK_CONDITIONS.map((qTag) => (
                              <button
                                key={qTag}
                                type="button"
                                onClick={() => handleAddCondition(c.id, qTag)}
                                className="px-1.5 py-0.5 text-[9px] bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 rounded border border-slate-700 transition-colors"
                              >
                                {qTag}
                              </button>
                            ))}
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
                                  handleAddCondition(c.id, customTag);
                                }
                              }}
                              className="flex-1 px-1.5 py-0.5 text-[10px] bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-400"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleAddCondition(c.id, customTag)}
                              className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 active:scale-95"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Freeform Scratchpad Note */}
                  <input
                    type="text"
                    placeholder="+ add note (e.g. AC 15)"
                    value={c.note || ''}
                    onChange={(e) => updateCombatant(c.id, { note: e.target.value })}
                    className="flex-1 min-w-[100px] bg-transparent text-[10px] text-slate-400 placeholder:text-slate-600 focus:outline-none focus:text-slate-200 px-1"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* BOTTOM INLINE ADD ROW */}
      <div className="p-2 border-t border-slate-800 bg-slate-900/90 shrink-0">
        <form onSubmit={handleAddCombatant} className="flex items-center gap-1.5">
          <input
            type="number"
            placeholder="Init"
            value={newInit}
            onChange={(e) => setNewInit(e.target.value)}
            className="w-12 px-2 py-1 text-xs font-mono font-bold bg-slate-950 border border-slate-700 rounded text-amber-300 focus:outline-none focus:border-amber-400 text-center"
          />
          <input
            type="text"
            placeholder="Name (e.g. Goblin 1, Aria)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />

          <label
            className="relative w-6 h-6 rounded-full cursor-pointer border border-white/20 shadow-sm shrink-0 flex items-center justify-center"
            style={{ backgroundColor: newColor }}
            title="Choose Marker Color"
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
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded shadow active:scale-95"
          >
            Add
          </button>

          {isGM && board.combatants.length > 0 && (
            <button
              type="button"
              onClick={handleClearBoard}
              title="Reset Board"
              className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};