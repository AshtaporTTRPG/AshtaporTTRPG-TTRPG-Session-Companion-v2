import React, { useState, useEffect, useRef } from 'react';
import { Combatant, CombatantType, isCombatantFoW, sortInitiativeStrictDescending } from '../types/ttrpg';
import { QuickGlanceInitiative } from './QuickGlanceInitiative';
import { CombatantCard } from './CombatantCard';
import { LiveCombatFeed } from './LiveCombatFeed';
import { liveFeedSync } from '../utils/liveFeedSync';
import { roomSync, RoomMessage } from '../utils/roomSync';
import { playTurnSound } from '../utils/audio';
import {
  Swords,
  Plus,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  X,
  Sparkles,
  AlertTriangle,
  Trash2,
  Dices,
  Play,
} from 'lucide-react';

interface CombatTrackerProps {
  isDm: boolean;
  roomCode?: string;
}

export const CombatTracker: React.FC<CombatTrackerProps> = ({ isDm, roomCode }) => {
  const currentRoomCode = roomCode || roomSync.getRoomCode();

  // Combat State - initialized to an empty array [] if no active session data exists
  const [combatants, setCombatants] = useState<Combatant[]>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_combatants');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Track active turn primarily by unique combatant ID to preserve turn through sorts and edits
  const [activeCombatantId, setActiveCombatantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ttrpg_active_combatant_id') || null;
    } catch {
      return null;
    }
  });

  // Secondary index pointer for numeric display / turn order math
  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_active_turn_index');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [round, setRound] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_combat_round');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });

  // Combat Status: 'setup' | 'active'
  const [combatStatus, setCombatStatus] = useState<'setup' | 'active'>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_combat_status');
      return saved === 'active' ? 'active' : 'setup';
    } catch {
      return 'setup';
    }
  });

  // Turn Announcement Alert Banner (Floating, non-layout-shifting)
  const [playerTurnAlert, setPlayerTurnAlert] = useState<string | null>(null);

  // Floating Damage Alert Toast: Obfuscated for FoW combatants on player view
  const [damageToastAlert, setDamageToastAlert] = useState<string | null>(null);
  const damageToastTimerRef = useRef<any>(null);

  // Add Combatant Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CombatantType>('player');
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newInitiative, setNewInitiative] = useState(10);
  const [newAc, setNewAc] = useState(14);
  const [newHp, setNewHp] = useState(25);
  const [newHidden, setNewHidden] = useState(false);

  // Clear Combat ("Blank Slate") Confirmation Modal State
  const [isClearCombatModalOpen, setIsClearCombatModalOpen] = useState(false);

  // Keep activeCombatantId and activeTurnIndex synchronized with combatants array
  useEffect(() => {
    if (combatants.length === 0) {
      if (activeCombatantId !== null) setActiveCombatantId(null);
      if (activeTurnIndex !== 0) setActiveTurnIndex(0);
      return;
    }

    // Check if activeCombatantId exists in current combatants list
    if (activeCombatantId) {
      const foundIdx = combatants.findIndex((c) => c.id === activeCombatantId);
      if (foundIdx !== -1) {
        if (foundIdx !== activeTurnIndex) {
          setActiveTurnIndex(foundIdx);
        }
        return;
      }
    }

    // If activeCombatantId is missing or invalid, resolve to activeTurnIndex or first combatant
    const safeIdx = Math.min(Math.max(0, activeTurnIndex), combatants.length - 1);
    const resolvedCombatant = combatants[safeIdx];
    if (resolvedCombatant) {
      setActiveCombatantId(resolvedCombatant.id);
      setActiveTurnIndex(safeIdx);
    }
  }, [combatants, activeCombatantId, activeTurnIndex]);

  // Persist locally across component remounts, route changes, and tab switches
  useEffect(() => {
    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(combatants));
      localStorage.setItem('ttrpg_active_turn_index', activeTurnIndex.toString());
      if (activeCombatantId) {
        localStorage.setItem('ttrpg_active_combatant_id', activeCombatantId);
      } else {
        localStorage.removeItem('ttrpg_active_combatant_id');
      }
      localStorage.setItem('ttrpg_combat_round', round.toString());
      localStorage.setItem('ttrpg_combat_status', combatStatus);
    } catch {}
  }, [combatants, activeTurnIndex, activeCombatantId, round, combatStatus]);

  // Listen for real-time room sync
  useEffect(() => {
    const unsub = roomSync.subscribe((msg: RoomMessage) => {
      if (msg.type === 'COMBAT_SYNC' && msg.payload) {
        if (Array.isArray(msg.payload.combatants)) setCombatants(msg.payload.combatants);
        if (msg.payload.activeCombatantId !== undefined) {
          setActiveCombatantId(msg.payload.activeCombatantId);
        }
        if (typeof msg.payload.activeTurnIndex === 'number') {
          setActiveTurnIndex(msg.payload.activeTurnIndex);
        }
        if (typeof msg.payload.round === 'number') setRound(msg.payload.round);
        if (msg.payload.combatStatus) setCombatStatus(msg.payload.combatStatus);
      }

      // Sync real-time damage toast alert across peers
      if (msg.type === 'COMBAT_FEED_EVENT' && msg.payload?.event) {
        const evt = msg.payload.event;
        if (evt.type === 'combat') {
          const alertMsg = !isDm && evt.playerMessage ? evt.playerMessage : evt.message;
          if (alertMsg && (alertMsg.includes('took') || alertMsg.includes('damage'))) {
            setDamageToastAlert(alertMsg.replace(/^[⚔️💚⚡⚙️✨💀➕]\s*/u, ''));
            if (damageToastTimerRef.current) clearTimeout(damageToastTimerRef.current);
            damageToastTimerRef.current = setTimeout(() => setDamageToastAlert(null), 4000);
          }
        }
      }
    });
    return () => unsub();
  }, [isDm]);

  // Broadcast combat updates when state is modified (DM and authorized player PC/Ally updates)
  const broadcastCombat = (
    updatedCombatants: Combatant[],
    updatedTurn: number,
    updatedRound: number,
    updatedActiveCombatantId?: string | null,
    updatedCombatStatus?: 'setup' | 'active'
  ) => {
    const statusToBroadcast = updatedCombatStatus || combatStatus;
    roomSync.broadcast('COMBAT_SYNC', {
      combatants: updatedCombatants,
      activeTurnIndex: updatedTurn,
      activeCombatantId:
        updatedActiveCombatantId !== undefined ? updatedActiveCombatantId : activeCombatantId,
      round: updatedRound,
      combatStatus: statusToBroadcast,
    });
  };

  // Scroll position preservation helper to eliminate layout jump and unwanted auto-scroll
  const preserveScroll = (action: () => void) => {
    const currentScrollY = window.scrollY;
    action();
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - currentScrollY) > 0) {
        window.scrollTo({ top: currentScrollY, behavior: 'instant' as ScrollBehavior });
      }
    });
  };

  // Helper to log into unified live feed and trigger damage toast alert
  const addFeedLog = (dmMessage: string, playerMessage?: string) => {
    liveFeedSync.recordCombatLog(dmMessage, true, playerMessage);
    const alertMsg = !isDm && playerMessage ? playerMessage : dmMessage;
    if (alertMsg.includes('took') || alertMsg.includes('damage')) {
      setDamageToastAlert(alertMsg.replace(/^[⚔️💚⚡⚙️✨💀➕]\s*/u, ''));
      if (damageToastTimerRef.current) clearTimeout(damageToastTimerRef.current);
      damageToastTimerRef.current = setTimeout(() => setDamageToastAlert(null), 4000);
    }
  };

  // ADVANCE TURN LOGIC & PLAYER TURN NOTIFICATION (Zero layout shift & scroll jump)
  const handleNextTurn = () => {
    preserveScroll(() => {
      if (combatants.length === 0) return;

      const currentIdx = activeCombatantId
        ? combatants.findIndex((c) => c.id === activeCombatantId)
        : activeTurnIndex;
      const validCurrentIdx = currentIdx >= 0 ? currentIdx : activeTurnIndex;

      let nextIndex = validCurrentIdx + 1;
      let nextRound = round;

      if (nextIndex >= combatants.length) {
        nextIndex = 0;
        nextRound = round + 1;
        liveFeedSync.recordCombatLog(`🔔 --- Round ${nextRound} Began ---`, true);
      }

      const activeCombatant = combatants[nextIndex];
      const nextId = activeCombatant ? activeCombatant.id : null;

      setActiveCombatantId(nextId);
      setActiveTurnIndex(nextIndex);
      setRound(nextRound);
      playTurnSound();

      if (activeCombatant) {
        const announcement = `⚔️ Turn ${nextIndex + 1}/${combatants.length}: It is ${activeCombatant.name}'s turn! (Round ${nextRound})`;
        liveFeedSync.recordTurnAnnouncement(announcement, true);

        // If active combatant is a Player (PC), trigger prominent floating visual feedback
        if (activeCombatant.type === 'player') {
          setPlayerTurnAlert(`⚔️ IT IS ${activeCombatant.name.toUpperCase()}'S TURN!`);
          setTimeout(() => setPlayerTurnAlert(null), 5000);
        } else {
          setPlayerTurnAlert(null);
        }
      }

      broadcastCombat(combatants, nextIndex, nextRound, nextId, combatStatus);
    });
  };

  // PREVIOUS TURN LOGIC
  const handlePrevTurn = () => {
    preserveScroll(() => {
      if (combatants.length === 0) return;

      const currentIdx = activeCombatantId
        ? combatants.findIndex((c) => c.id === activeCombatantId)
        : activeTurnIndex;
      const validCurrentIdx = currentIdx >= 0 ? currentIdx : activeTurnIndex;

      let prevIndex = validCurrentIdx - 1;
      let prevRound = round;

      if (prevIndex < 0) {
        prevIndex = Math.max(0, combatants.length - 1);
        prevRound = Math.max(1, round - 1);
      }

      const activeCombatant = combatants[prevIndex];
      const prevId = activeCombatant ? activeCombatant.id : null;

      setActiveCombatantId(prevId);
      setActiveTurnIndex(prevIndex);
      setRound(prevRound);
      broadcastCombat(combatants, prevIndex, prevRound, prevId, combatStatus);
    });
  };

  // BUG FIX: RESET ROUND COUNTER (Direct, zero window.confirm blocker, synchronizes room & live feed)
  const handleResetRound = () => {
    preserveScroll(() => {
      setRound(1);
      liveFeedSync.recordCombatLog('🔄 Round counter has been reset to Round 1 by the DM.', true);
      broadcastCombat(combatants, activeTurnIndex, 1, activeCombatantId, combatStatus);
    });
  };

  // ENCOUNTER RESET ("BLANK SLATE") WITH SAFETY CONFIRMATION FLOW
  const handleConfirmClearCombat = () => {
    preserveScroll(() => {
      setCombatants([]);
      setActiveCombatantId(null);
      setActiveTurnIndex(0);
      setRound(1);
      setCombatStatus('setup');
      setPlayerTurnAlert(null);
      setIsClearCombatModalOpen(false);

      // Explicitly persist blank slate so tab switches or page refreshes keep the encounter empty
      try {
        localStorage.setItem('ttrpg_combatants', JSON.stringify([]));
        localStorage.removeItem('ttrpg_active_combatant_id');
        localStorage.setItem('ttrpg_active_turn_index', '0');
        localStorage.setItem('ttrpg_combat_round', '1');
        localStorage.setItem('ttrpg_combat_status', 'setup');
      } catch {}

      liveFeedSync.recordCombatLog(
        '⚔️ Encounter cleared by the DM. Blank slate prepared for a new battle.',
        true
      );
      broadcastCombat([], 0, 1, null, 'setup');
    });
  };

  // DETERMINISTIC FIRST TURN ON "START COMBAT"
  // When the DM clicks "Start Combat":
  // 1. Strictly sort descending (b.initiative - a.initiative)
  // 2. Explicitly set active combatant index to 0
  // 3. Reset active turn pointers so combat never starts on previous index, random index, or bottom
  // 4. Lock round counter to Round 1
  // 5. Highlight, active turn banner, and turn pointer lock onto combatant with highest initiative
  // 6. Broadcast across peers with combatStatus = 'active'
  const handleStartCombat = () => {
    preserveScroll(() => {
      if (combatants.length === 0) {
        setIsAddModalOpen(true);
        return;
      }

      // 1. Strict Descending Sort: Highest total initiative score at index 0
      const sorted = sortInitiativeStrictDescending(combatants);
      const firstCombatant = sorted[0];

      // 2. Deterministic First Turn: Explicitly set active combatant index to 0, round to 1
      const targetIndex = 0;
      const targetId = firstCombatant ? firstCombatant.id : null;
      const targetRound = 1;
      const targetStatus: 'active' = 'active';

      setCombatants(sorted);
      setActiveTurnIndex(targetIndex);
      setActiveCombatantId(targetId);
      setRound(targetRound);
      setCombatStatus(targetStatus);

      playTurnSound();

      // 3. Highlight and active turn banner lock onto combatant with highest initiative
      if (firstCombatant) {
        if (firstCombatant.type === 'player') {
          setPlayerTurnAlert(`⚔️ IT IS ${firstCombatant.name.toUpperCase()}'S TURN!`);
          setTimeout(() => setPlayerTurnAlert(null), 5000);
        } else {
          setPlayerTurnAlert(null);
        }

        liveFeedSync.recordCombatLog(
          `⚔️ Combat Started! Round 1 begins with ${firstCombatant.name} (Initiative ${firstCombatant.initiative}) taking the first turn.`,
          true
        );
        liveFeedSync.recordTurnAnnouncement(
          `⚔️ Turn 1/${sorted.length}: It is ${firstCombatant.name}'s turn! (Round 1)`,
          true
        );
      }

      // 4. Broadcast cleanly to all connected peers
      broadcastCombat(sorted, targetIndex, targetRound, targetId, targetStatus);
    });
  };

  // STRICT DESCENDING INITIATIVE SORT (b.initiative - a.initiative)
  // Enforces highest initiative score at index 0 at the top of the tracker
  const handleSortInitiative = () => {
    preserveScroll(() => {
      if (combatants.length === 0) return;

      // Identify currently active combatant ID before sort
      const currentActiveId =
        activeCombatantId || combatants[activeTurnIndex]?.id || null;

      // Reorder strictly in descending order of initiative score
      const sorted = sortInitiativeStrictDescending(combatants);

      // Find new index of the active combatant in the sorted list
      let newActiveIndex = 0;
      if (currentActiveId) {
        const foundIndex = sorted.findIndex((c) => c.id === currentActiveId);
        if (foundIndex !== -1) {
          newActiveIndex = foundIndex;
        }
      }

      setCombatants(sorted);
      if (currentActiveId) {
        setActiveCombatantId(currentActiveId);
      }
      setActiveTurnIndex(newActiveIndex);

      const activeName = currentActiveId
        ? sorted.find((c) => c.id === currentActiveId)?.name
        : 'Active combatant';

      liveFeedSync.recordCombatLog(
        `⚡ Initiative sorted in strict descending order. Active turn on ${activeName || 'current combatant'} preserved.`,
        true
      );
      broadcastCombat(sorted, newActiveIndex, round, currentActiveId, combatStatus);
    });
  };

  // ROLL INITIATIVE FOR A SINGLE COMBATANT
  // Rolls 1d20, modifies initiative, strictly sorts descending, and syncs
  const handleRollInitiative = (combatantId: string) => {
    preserveScroll(() => {
      const target = combatants.find((c) => c.id === combatantId);
      if (!target) return;
      const isTargetFoW = isCombatantFoW(target);
      const isTargetPlayerOrAlly = target.type === 'player' || target.type === 'ally';
      if (!isDm && (!isTargetPlayerOrAlly || isTargetFoW)) return;

      const roll = Math.floor(Math.random() * 20) + 1;
      const updated = combatants.map((c) =>
        c.id === combatantId ? { ...c, initiative: roll } : c
      );

      // Strict descending sort on roll
      const sorted = sortInitiativeStrictDescending(updated);

      let targetIndex = activeTurnIndex;
      if (activeCombatantId) {
        const found = sorted.findIndex((c) => c.id === activeCombatantId);
        if (found !== -1) targetIndex = found;
      }

      setCombatants(sorted);
      setActiveTurnIndex(targetIndex);

      liveFeedSync.recordCombatLog(
        `🎲 ${target.name} rolled 1d20 for Initiative: ${roll}!`,
        true
      );
      broadcastCombat(sorted, targetIndex, round, activeCombatantId, combatStatus);
    });
  };

  // ROLL ALL INITIATIVES (DM Action)
  // Rolls 1d20 for all combatants and enforces strict descending sort
  const handleRollAllInitiatives = () => {
    preserveScroll(() => {
      if (!isDm || combatants.length === 0) return;

      const updated = combatants.map((c) => {
        const roll = Math.floor(Math.random() * 20) + 1;
        return { ...c, initiative: roll };
      });

      // Strict descending sort
      const sorted = sortInitiativeStrictDescending(updated);
      let targetIndex = 0;
      let targetId = sorted[0]?.id || null;

      if (combatStatus === 'active' && activeCombatantId) {
        const found = sorted.findIndex((c) => c.id === activeCombatantId);
        if (found !== -1) {
          targetIndex = found;
          targetId = activeCombatantId;
        }
      } else {
        targetId = sorted[0]?.id || null;
        targetIndex = 0;
      }

      setCombatants(sorted);
      setActiveTurnIndex(targetIndex);
      if (targetId) setActiveCombatantId(targetId);

      liveFeedSync.recordCombatLog(
        `🎲 All initiatives rolled by the DM and sorted in strict descending order.`,
        true
      );
      broadcastCombat(sorted, targetIndex, round, targetId, combatStatus);
    });
  };

  // MANUAL TIE-BREAKING / REORDERING
  const handleMoveCombatant = (fromIndex: number, toIndex: number) => {
    preserveScroll(() => {
      if (toIndex < 0 || toIndex >= combatants.length) return;
      const currentActiveId =
        activeCombatantId || combatants[activeTurnIndex]?.id || null;

      const copy = [...combatants];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);

      // Recalculate index of active combatant
      let newActiveIdx = 0;
      if (currentActiveId) {
        const found = copy.findIndex((c) => c.id === currentActiveId);
        if (found !== -1) newActiveIdx = found;
      }

      setCombatants(copy);
      setActiveTurnIndex(newActiveIdx);
      if (currentActiveId) setActiveCombatantId(currentActiveId);
      broadcastCombat(copy, newActiveIdx, round, currentActiveId, combatStatus);
    });
  };

  // TOGGLE VISIBILITY (DM Fog of War)
  const handleToggleVisibility = (combatantId: string) => {
    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, hidden: !c.hidden } : c
    );
    setCombatants(updated);
    const target = combatants.find((c) => c.id === combatantId);
    if (target) {
      liveFeedSync.recordCombatLog(
        `👁️ ${target.name} is now ${target.hidden ? 'revealed to players' : 'hidden from players'}.`,
        true
      );
    }
    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // UPDATE COMBATANT (Permission Enforced: Players can ONLY edit non-FoW Player and Ally combatants)
  // When initiative is modified, enforce strict descending order
  const handleUpdateCombatant = (id: string, updates: Partial<Combatant>) => {
    const target = combatants.find((c) => c.id === id);
    if (!target) return;
    const isTargetFoW = isCombatantFoW(target);
    const isTargetPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && (!isTargetPlayerOrAlly || isTargetFoW)) {
      return;
    }

    let updated = combatants.map((c) => (c.id === id ? { ...c, ...updates } : c));

    let targetIndex = activeTurnIndex;
    let targetId = activeCombatantId;

    // Strict descending sort when initiative is modified
    if (updates.initiative !== undefined) {
      updated = sortInitiativeStrictDescending(updated);
      if (activeCombatantId) {
        const found = updated.findIndex((c) => c.id === activeCombatantId);
        if (found !== -1) targetIndex = found;
      }
    }

    setCombatants(updated);
    setActiveTurnIndex(targetIndex);
    broadcastCombat(updated, targetIndex, round, targetId, combatStatus);
  };

  // DELETE COMBATANT (DM only)
  const handleDeleteCombatant = (id: string) => {
    if (!isDm) return;
    const target = combatants.find((c) => c.id === id);
    const updated = combatants.filter((c) => c.id !== id);
    setCombatants(updated);
    if (target) liveFeedSync.recordCombatLog(`💀 ${target.name} was removed from combat.`, true);

    let nextActiveId = activeCombatantId;
    let nextActiveIdx = 0;

    if (activeCombatantId === id) {
      // If the deleted combatant was active, advance to next or first available
      const wasIndex = combatants.findIndex((c) => c.id === id);
      const nextCandidate = updated[wasIndex] || updated[0] || null;
      nextActiveId = nextCandidate ? nextCandidate.id : null;
      nextActiveIdx = nextCandidate ? updated.findIndex((c) => c.id === nextCandidate.id) : 0;
    } else if (activeCombatantId) {
      nextActiveIdx = updated.findIndex((c) => c.id === activeCombatantId);
      if (nextActiveIdx === -1) nextActiveIdx = 0;
    }

    setActiveCombatantId(nextActiveId);
    setActiveTurnIndex(nextActiveIdx);
    broadcastCombat(updated, nextActiveIdx, round, nextActiveId, combatStatus);
  };

  // ADD COMBATANT FORM SUBMISSION (Players can add "Player (PC)" and "NPC / Ally")
  const handleSaveNewCombatant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Enforce role permission: players may ONLY add Player (PC) or Ally / NPC
    const allowedType: CombatantType =
      !isDm && newType !== 'player' && newType !== 'ally' ? 'player' : newType;

    const isFoWCombatant =
      isDm && (newHidden || allowedType === 'monster' || allowedType === 'boss' || allowedType === 'custom');

    const newCombatant: Combatant = {
      id: `combatant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newName.trim(),
      type: allowedType,
      customRoleLabel: isDm && allowedType === 'custom' && newCustomLabel.trim() ? newCustomLabel.trim() : undefined,
      initiative: newInitiative,
      armorClass: newAc,
      hpCurrent: newHp,
      hpMax: newHp,
      hpTemp: 0,
      conditions: [],
      hidden: isDm ? newHidden : false,
      fogOfWar: isFoWCombatant,
    };

    // Strictly sort descending by initiative
    const updated = sortInitiativeStrictDescending([...combatants, newCombatant]);
    setCombatants(updated);

    // If this was the first combatant added to an empty slate, make it active immediately
    let targetActiveId = activeCombatantId;
    let targetActiveIndex = activeTurnIndex;
    if (combatants.length === 0) {
      targetActiveId = newCombatant.id;
      targetActiveIndex = 0;
      setActiveCombatantId(newCombatant.id);
      setActiveTurnIndex(0);
    } else if (activeCombatantId) {
      const found = updated.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetActiveIndex = found;
      setActiveTurnIndex(targetActiveIndex);
    }

    liveFeedSync.recordCombatLog(
      `➕ Added ${newCombatant.name} (${newCombatant.type === 'player' ? 'Player (PC)' : newCombatant.type === 'ally' ? 'NPC / Ally' : newCombatant.type.toUpperCase()}) with Initiative ${newCombatant.initiative}.`,
      true
    );
    broadcastCombat(updated, targetActiveIndex, round, targetActiveId, combatStatus);

    // Reset Form
    setIsAddModalOpen(false);
    setNewName('');
    setNewType('player');
    setNewCustomLabel('');
    setNewInitiative(10);
    setNewAc(14);
    setNewHp(25);
    setNewHidden(false);
  };

  // Filter center cards based on DM vs Player Fog of War
  const visibleCombatants = combatants.filter((c) => isDm || !c.hidden);

  // LAYOUT UX: ACTIVE TURN PRIORITIZATION IN MAIN CENTER DISPLAY
  // Dynamically reorder center combatant cards so the active combatant (current turn) is anchored at the top.
  // Remaining combatants follow in immediate turn order (upcoming turns, cycling back to the top of the sequence).
  const orderedCenterCombatants = (() => {
    if (visibleCombatants.length === 0) return [];
    const currentActiveId = activeCombatantId || combatants[activeTurnIndex]?.id;
    let vActiveIndex = visibleCombatants.findIndex((c) => c.id === currentActiveId);
    if (vActiveIndex === -1) {
      vActiveIndex = 0;
    }
    return [
      ...visibleCombatants.slice(vActiveIndex),
      ...visibleCombatants.slice(0, vActiveIndex),
    ];
  })();

  return (
    <div className="space-y-4 relative">
      {/* FLOATING TURN ALERT: Isolated from page layout flow (Zero Layout Shift) */}
      {playerTurnAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-6 py-3 rounded-2xl bg-amber-500/90 text-slate-950 font-display font-bold text-sm shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-fadeIn ring-2 ring-amber-300">
          <Sparkles className="w-5 h-5 text-slate-950 shrink-0" />
          <span>{playerTurnAlert}</span>
          <span className="text-xs font-sans font-semibold opacity-90 hidden sm:inline">
            — Ready your Action, Bonus Action, and Movement!
          </span>
        </div>
      )}

      {/* FLOATING DAMAGE TOAST ALERT: Obfuscated for FoW combatants on Player view */}
      {damageToastAlert && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-5 py-2.5 rounded-2xl bg-rose-950/95 border border-rose-600/80 text-rose-200 font-sans font-semibold text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fadeIn ring-1 ring-rose-500/40">
          <Swords className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{damageToastAlert}</span>
        </div>
      )}

      {/* Top Combat Navigation & Action Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        {/* Title, Round Counter & Turn Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 font-display">
                Combat Tracker
              </h2>
              {/* Round Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950 border border-amber-500/60 text-amber-300">
                Round {round}
              </span>
              {combatStatus === 'active' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500/60 text-emerald-300 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  In Combat
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-400">
                  Setup
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {combatants.length > 0
                ? `Active Turn: ${(combatants.find((c) => c.id === activeCombatantId) || combatants[activeTurnIndex])?.name || 'None'} (${((activeCombatantId ? combatants.findIndex((c) => c.id === activeCombatantId) : activeTurnIndex) >= 0 ? (activeCombatantId ? combatants.findIndex((c) => c.id === activeCombatantId) : activeTurnIndex) : 0) + 1}/${combatants.length})`
                : 'No combatants added yet'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Start Combat Trigger (DM Only - Locks Turn 1 to highest initiative roller) */}
          {isDm && (
            <button
              type="button"
              onClick={handleStartCombat}
              disabled={combatants.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 transition cursor-pointer shadow-md"
              title="Start combat: sort descending by initiative, lock Turn 1 onto highest score, reset round to 1"
            >
              <Swords className="w-4 h-4 stroke-[2.5]" />
              <span>Start Combat</span>
            </button>
          )}

          {/* Previous Turn */}
          <button
            type="button"
            onClick={handlePrevTurn}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
            title="Go to previous combatant turn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          {/* Next Turn (Primary Action) */}
          <button
            type="button"
            onClick={handleNextTurn}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow-md"
            title="Advance to next turn"
          >
            <span>Next Turn</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Sort by Initiative (Strict descending order) */}
          {isDm && (
            <button
              type="button"
              onClick={handleSortInitiative}
              disabled={combatants.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer disabled:opacity-40"
              title="Sort all combatants in strict descending initiative order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sort</span>
            </button>
          )}

          {/* Roll All Initiatives (DM Only) */}
          {isDm && (
            <button
              type="button"
              onClick={handleRollAllInitiatives}
              disabled={combatants.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer disabled:opacity-40"
              title="Roll 1d20 initiative for all combatants and sort descending"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Roll All</span>
            </button>
          )}

          {/* Bug Fix: Reset Round Counter Button */}
          {isDm && (
            <button
              type="button"
              onClick={handleResetRound}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer"
              title="Reset Round Counter back to Round 1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Reset Round</span>
            </button>
          )}

          {/* Clear Combat / Blank Slate Button (DM Only) */}
          {isDm && (
            <button
              type="button"
              onClick={() => setIsClearCombatModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/70 text-rose-300 hover:text-white transition cursor-pointer shadow-sm"
              title="End combat and clear all combatants (Blank Slate)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Clear Combat</span>
            </button>
          )}

          {/* Add Combatant Trigger (Available to DM and Players for PC / Ally) */}
          <button
            type="button"
            onClick={() => {
              setNewType('player');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer shadow"
            title={isDm ? 'Add combatant to encounter' : 'Add Player (PC) or NPC / Ally to encounter'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isDm ? 'Add Combatant' : 'Add PC / Ally'}</span>
          </button>
        </div>
      </div>

      {/* THREE-COLUMN DASHBOARD LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUMN 1: LEFT - QUICK-GLANCE INITIATIVE LIST (3/12 cols) */}
        <div className="lg:col-span-3">
          <QuickGlanceInitiative
            combatants={combatants}
            activeTurnIndex={activeTurnIndex}
            activeCombatantId={activeCombatantId}
            isDm={isDm}
            onSelectCombatant={(idx, id) =>
              preserveScroll(() => {
                setActiveTurnIndex(idx);
                const selectedId = id || combatants[idx]?.id || null;
                if (selectedId) {
                  setActiveCombatantId(selectedId);
                  broadcastCombat(combatants, idx, round, selectedId, combatStatus);
                }
              })
            }
            onMoveCombatant={handleMoveCombatant}
            onToggleVisibility={(id) => preserveScroll(() => handleToggleVisibility(id))}
          />
        </div>

        {/* COLUMN 2: CENTER - MAIN COMBATANT CARDS VIEW (6/12 cols) - ACTIVE TURN ANCHORED AT TOP */}
        <div className="lg:col-span-6 space-y-3.5">
          {/* Setup Banner if Encounter Ready but Combat not started */}
          {combatStatus === 'setup' && combatants.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <Swords className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold font-display text-amber-300 uppercase tracking-wider">
                    Encounter Prepared ({combatants.length} Combatant{combatants.length > 1 ? 's' : ''})
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Ready to begin? Click &ldquo;Start Combat&rdquo; to sort initiative strictly descending and lock Turn 1 onto the highest score.
                  </p>
                </div>
              </div>
              {isDm && (
                <button
                  type="button"
                  onClick={handleStartCombat}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition cursor-pointer shadow flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Combat</span>
                </button>
              )}
            </div>
          )}

          {visibleCombatants.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border-2 border-dashed border-slate-800 space-y-3">
              <Swords className="w-10 h-10 text-slate-500 mx-auto opacity-40" />
              <h3 className="text-sm font-bold text-slate-300 font-display">
                {combatants.length === 0 ? 'Blank Slate Encounter' : 'No Combatants Currently Visible'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {combatants.length === 0
                  ? 'All combatants have been cleared. Click "+ Add Combatant" to create new entities for the encounter.'
                  : isDm
                  ? 'Click "+ Add Combatant" above to spawn players, monsters, bosses, or custom environmental initiatives.'
                  : 'Waiting for the Dungeon Master to reveal active combatants.'}
              </p>
              {combatants.length === 0 && (
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewType('player');
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl cursor-pointer transition shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isDm ? 'Add First Combatant' : 'Add First PC / Ally'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            orderedCenterCombatants.map((combatant) => {
              const isActive = combatant.id === (activeCombatantId || combatants[activeTurnIndex]?.id);

              return (
                <CombatantCard
                  key={combatant.id}
                  combatant={combatant}
                  isActive={isActive}
                  isDm={isDm}
                  onUpdate={(updates) => handleUpdateCombatant(combatant.id, updates)}
                  onDelete={() => handleDeleteCombatant(combatant.id)}
                  onAddLog={addFeedLog}
                  onRollInitiative={() => handleRollInitiative(combatant.id)}
                />
              );
            })
          )}
        </div>

        {/* COLUMN 3: RIGHT - LIVE ROOM & DICE CHAMBER FEED (3/12 cols) */}
        <div className="lg:col-span-3">
          <LiveCombatFeed
            roomCode={currentRoomCode}
            isDm={isDm}
          />
        </div>
      </div>

      {/* MODAL: ADD COMBATANT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-display">
                  {isDm ? 'Add Combatant to Encounter' : 'Add PC / Ally to Encounter'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCombatant} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Name / Identifier *
                </label>
                <input
                  type="text"
                  placeholder={isDm ? "e.g. Goblin Archer, Valerius, Lair Collapse" : "e.g. Valerius, Sir Gareth, Ranger Companion"}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              {/* Role Type Selection: Players only have access to Player (PC) and NPC / Ally */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Entity Role / Type *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CombatantType)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
                >
                  <option value="player">Player (PC) - Full Details Visible</option>
                  <option value="ally">NPC / Ally - Full Details Visible</option>
                  {isDm && (
                    <>
                      <option value="monster">Monster - Fog of War (Stats Hidden)</option>
                      <option value="boss">Boss - Fog of War (Stats Hidden)</option>
                      <option value="custom">Custom (Lair Action, Hazard, Event) - Fog of War</option>
                    </>
                  )}
                </select>
              </div>

              {/* Free-text field for CUSTOM role label (DM only) */}
              {isDm && newType === 'custom' && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/40 space-y-1">
                  <label className="text-xs font-semibold text-amber-300 block">
                    Custom Initiative Label (Free-text)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lair Action, Regional Effect, Mass Combat Phase, Hazard"
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Label displayed on the initiative tile and card header.
                  </p>
                </div>
              )}

              {/* Numerical Stats: Initiative, AC, Max HP */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Initiative
                  </label>
                  <input
                    type="number"
                    value={newInitiative}
                    onChange={(e) => setNewInitiative(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 text-center"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Armor Class
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newAc}
                    onChange={(e) => setNewAc(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 text-center"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Max HP
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newHp}
                    onChange={(e) => setNewHp(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 text-center"
                  />
                </div>
              </div>

              {/* Fog of War Toggle: Hidden from Players initially (DM Only) */}
              {isDm && (
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newHidden}
                    onChange={(e) => setNewHidden(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-400 focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-200 block">
                      Conceal from Player View (Stealth / Unrevealed)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Will remain completely hidden until revealed with the eye toggle.
                    </span>
                  </div>
                </label>
              )}

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow"
                >
                  Save &amp; Enter Combat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: CLEAR COMBAT / BLANK SLATE CONFIRMATION (TWO-STEP VERIFICATION) */}
      {isClearCombatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-rose-800/80 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Clear Combat Encounter?
                </h3>
                <p className="text-xs text-rose-300 font-medium">
                  Two-step safety confirmation (Blank Slate)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to end this combat and clear all combatants? This action cannot be undone.
            </p>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1.5 font-mono">
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Purges all active combatants &amp; custom roles</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Wipes all initiative scores &amp; active status conditions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Resets round counter back to Round 1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Prepares a clean blank slate for a brand-new encounter</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearCombatModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCombat}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-md shadow-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Clear Combat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
