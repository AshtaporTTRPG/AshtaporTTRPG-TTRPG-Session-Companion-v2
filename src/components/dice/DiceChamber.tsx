/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  DiceRollResult,
  DieType,
  RollVisibility,
  RollDisplayMode,
  CustomMacro,
  RollInstance,
} from '../../types/ttrpg';
import {
  executeDiceRoll,
  parseDiceFormula,
  parseMacroFormula,
  rollSingleDie,
  addDieToFormula,
  setFormulaModifier,
} from './DiceEngine';
import { liveFeedSync } from '../../utils/liveFeedSync';
import {
  loadCustomMacros,
  addCustomMacro,
  updateCustomMacro,
  duplicateCustomMacro,
  deleteCustomMacro,
} from '../../utils/macroStorage';
import {
  Dices,
  Sparkles,
  Plus,
  RotateCcw,
  Edit2,
  Trash2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  Layers,
  SlidersHorizontal,
  Check,
  FileText,
  Copy,
} from 'lucide-react';
import { AddCustomMacroModal } from './AddCustomMacroModal';
import { EditCustomMacroModal } from './EditCustomMacroModal';
import { RollFeedCard } from './RollFeedCard';
import { CalculatorDock, CalcViewMode } from './CalculatorDock';

export type RollResult = DiceRollResult;

export interface DiceChamberProps {
  isGM?: boolean;
  isDm?: boolean;
  playerName?: string;
}

type MacroSlot = 'primary' | 'secondary';

interface StagedMacroItem {
  key: string;
  macro: CustomMacro;
  slot: MacroSlot;
  count: number;
}

const INTERACTIVE_DICE: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
const ACTIVE_PROFILE_STORAGE_KEY = 'ashtapor_macro_active_profile';

function getEffectiveGroup(macro: CustomMacro): string {
  return macro.group && macro.group.trim() ? macro.group.trim() : 'General';
}

/**
 * Doubles the number of dice in a formula for 5e Critical Hits while keeping flat modifiers unchanged.
 * Example: "2d6+1d8+3" -> "4d6+2d8+3"
 */
function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_match, countStr, sidesStr) => {
    const count = countStr ? parseInt(countStr, 10) : 1;
    return `${count * 2}d${sidesStr}`;
  });
}

export const DiceChamber: React.FC<DiceChamberProps> = ({ isGM, isDm = false, playerName }) => {
  const isGameMaster = isGM !== undefined ? isGM : isDm;
  const rollerName = playerName?.trim() || (isGameMaster ? 'Game Master' : 'Adventurer');

  // Input & Formula State
  const [formulaInput, setFormulaInput] = useState<string>('');
  const [advantageMode, setAdvantageMode] = useState<'advantage' | 'normal' | 'disadvantage'>('normal');
  const [modifier, setModifier] = useState<number>(0);
  const [visibility, setVisibility] = useState<RollVisibility>('public');

  // Docked Calculator State
  const [calcMode, setCalcMode] = useState<CalcViewMode>('docked');

  // Custom Macros, Profile Dropdown, Batch Multiplier, Crit & Manage Mode State
  const [macros, setMacros] = useState<CustomMacro[]>(() => loadCustomMacros());
  const [isMacrosOpen, setIsMacrosOpen] = useState<boolean>(true);
  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || 'All';
    } catch {
      return 'All';
    }
  });
  const [isManageMode, setIsManageMode] = useState<boolean>(false);
  const [batchMultiplier, setBatchMultiplier] = useState<number>(1);
  const [isCritMode, setIsCritMode] = useState<boolean>(false);
  const [editingMacro, setEditingMacro] = useState<CustomMacro | null>(null);
  const [isAddMacroOpen, setIsAddMacroOpen] = useState<boolean>(false);
  const [macroMode, setMacroMode] = useState<'instant' | 'queue'>('instant');
  const [stagedQueue, setStagedQueue] = useState<StagedMacroItem[]>([]);

  // Active Roll Feed State
  const [rollFeed, setRollFeed] = useState<RollResult[]>([]);

  // Persist active profile selection across reloads
  const handleSelectGroup = (nextGroup: string) => {
    setSelectedGroup(nextGroup);
    try {
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, nextGroup);
    } catch {
      // Ignore storage quota errors
    }
  };

  const cycleBatchMultiplier = () => {
    setBatchMultiplier((prev) => (prev >= 4 ? 1 : prev + 1));
  };

  // Compute available profile groups and counts
  const { availableGroups, groupCounts } = useMemo(() => {
    const counts: Record<string, number> = { All: macros.length };
    const groupSet = new Set<string>();

    macros.forEach((m) => {
      const grp = getEffectiveGroup(m);
      groupSet.add(grp);
      counts[grp] = (counts[grp] || 0) + 1;
    });

    const sortedGroups = Array.from(groupSet).sort((a, b) => {
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    return {
      availableGroups: sortedGroups,
      groupCounts: counts,
    };
  }, [macros]);

  // Filter macros by active profile
  const filteredMacros = useMemo(() => {
    if (selectedGroup === 'All') return macros;
    return macros.filter((m) => getEffectiveGroup(m) === selectedGroup);
  }, [macros, selectedGroup]);

  // Auto-reset profile filter if active group becomes empty
  useEffect(() => {
    if (selectedGroup !== 'All' && filteredMacros.length === 0) {
      handleSelectGroup('All');
    }
  }, [selectedGroup, filteredMacros.length]);

  // Real-Time Roll Feed Synchronization via liveFeedSync subscriber
  useEffect(() => {
    const unsub = liveFeedSync.subscribe((items) => {
      if (items.length === 0) {
        setRollFeed([]);
        return;
      }
      const diceRolls: RollResult[] = [];
      const seenIds = new Set<string>();

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.type === 'dice' && item.rollDetails && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          diceRolls.push({
            id: item.id,
            timestamp: item.timestamp,
            sender: item.sender,
            rollerName: item.rollerName || item.rollDetails.rollerName || item.sender,
            rollerId: item.rollerId || item.rollDetails.rollerId,
            isDm: !!item.isDm,
            visibility: (item.rollDetails.visibility as RollVisibility) || 'public',
            rollType: item.rollDetails.rollType || 'Straight roll',
            diceType: item.rollDetails.diceType || 'd20',
            count: item.rollDetails.count || 1,
            modifier: item.rollDetails.modifier || 0,
            rolls: item.rollDetails.rolls || [item.rollDetails.total || 0],
            breakdown: item.rollDetails.breakdown,
            total: item.rollDetails.total ?? 0,
            advantageMode: item.rollDetails.advantageMode || 'normal',
            isCrit: item.rollDetails.isCrit,
            isFumble: item.rollDetails.isFumble,
            label: item.rollDetails.label,
            displayMode: item.rollDetails.displayMode || 'sum',
            poolBreakdown: item.rollDetails.poolBreakdown,
            formula: item.rollDetails.formula,
            individualSummary: item.rollDetails.individualSummary,
            individualLineItems: item.rollDetails.individualLineItems,
            pairedRolls: item.rollDetails.pairedRolls,
            rawRolls: item.rollDetails.rawRolls,
            instances: item.rollDetails.instances,
            macroName: item.rollDetails.macroName,
            notes: item.rollDetails.notes,
          });
        }
      }
      setRollFeed(diceRolls.slice(0, 40));
    });
    return () => unsub();
  }, []);

  const [rollFlash, setRollFlash] = useState<'sum' | 'indiv' | null>(null);

  const triggerRollFlash = (mode: 'sum' | 'indiv') => {
    setRollFlash(mode);
    setTimeout(() => {
      setRollFlash(null);
    }, 180);
  };

  const handleFormulaInputChange = (text: string) => {
    setFormulaInput(text);
    const parsed = parseDiceFormula(text);
    if (parsed) {
      setModifier(parsed.modifier);
    } else if (!text.trim()) {
      setModifier(0);
    }
  };

  const handleApplyFromCalculator = (valOrStr: string | number) => {
    const val = typeof valOrStr === 'number' ? valOrStr : parseFloat(valOrStr) || 0;
    setFormulaInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        const sign = val >= 0 ? `+${val}` : `${val}`;
        setModifier(val);
        return sign;
      }
      const parsed = parseDiceFormula(trimmed);
      if (parsed && parsed.pool && parsed.pool.length > 0) {
        const newMod = parsed.modifier + val;
        setModifier(newMod);
        return setFormulaModifier(trimmed, newMod);
      }
      const sign = val >= 0 ? `+${val}` : `${val}`;
      const next = `${trimmed}${sign}`;
      const reParsed = parseDiceFormula(next);
      if (reParsed) setModifier(reParsed.modifier);
      return next;
    });
  };

  const handleClearFormula = () => {
    setFormulaInput('');
    setModifier(0);
  };

  const handleDieButtonClick = (die: DieType) => {
    setFormulaInput((prev) => addDieToFormula(prev, die));
  };

  const handleExecuteRoll = (
    mode: RollDisplayMode,
    customExpr?: string,
    customAdv?: 'normal' | 'advantage' | 'disadvantage',
    customMod?: number
  ) => {
    const expr = (customExpr !== undefined ? customExpr : formulaInput).trim();
    if (!expr) return;

    const currentUserId = liveFeedSync.getPlayerId();
    const parsed = parseDiceFormula(expr);
    const activeAdvMode = customAdv !== undefined ? customAdv : advantageMode;
    const finalMod = customMod !== undefined ? customMod : (parsed ? parsed.modifier : modifier);

    if (!parsed) {
      const fallback = executeDiceRoll({
        diceType: 'd20',
        count: 1,
        advantageMode: activeAdvMode,
        displayMode: mode,
        modifier: finalMod,
        sender: rollerName,
        rollerName,
        rollerId: currentUserId,
        isDm,
        visibility,
        label: expr,
      });
      liveFeedSync.recordDiceRoll(fallback, true);
      return;
    }

    const result = executeDiceRoll({
      pool: parsed.pool,
      modifier: finalMod,
      advantageMode: activeAdvMode,
      displayMode: mode,
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      label: expr,
    });

    liveFeedSync.recordDiceRoll(result, true);
  };

  const handleQuickD20Roll = (mode: 'normal' | 'advantage' | 'disadvantage') => {
    const currentUserId = liveFeedSync.getPlayerId();
    const label =
      mode === 'advantage'
        ? '1d20 (Advantage)'
        : mode === 'disadvantage'
        ? '1d20 (Disadvantage)'
        : '1d20';

    const result = executeDiceRoll({
      diceType: 'd20',
      count: 1,
      modifier: 0,
      advantageMode: mode,
      displayMode: 'sum',
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      label,
    });

    liveFeedSync.recordDiceRoll(result, true);
  };

  const evaluateMacro = (
    macro: CustomMacro,
    slot: MacroSlot = 'primary',
    applyCrit: boolean = false
  ) => {
    const hasPrimary = Boolean(macro.formula && macro.formula.trim());
    const hasSecondary = Boolean(macro.secondaryFormula && macro.secondaryFormula.trim());
    const isPaired = hasPrimary && hasSecondary;

    const rawExpr =
      slot === 'secondary' && hasSecondary
        ? macro.secondaryFormula!.trim()
        : (macro.formula || macro.secondaryFormula || '').trim();

    const parsedCheck = parseDiceFormula(rawExpr);
    const isD20Formula =
      (parsedCheck?.pool?.some((p) => p.diceType === 'd20')) || /\bd20\b/i.test(rawExpr);

    // Double dice when Crit mode is enabled on Damage/Secondary or non-d20 damage macros
    const shouldDoubleDice = applyCrit && (slot === 'secondary' || (!isPaired && !isD20Formula));
    const expr = shouldDoubleDice ? doubleDiceInFormula(rawExpr) : rawExpr;

    const baseLabel = isPaired
      ? `${macro.name} (${slot === 'secondary' ? 'Dmg' : 'Atk'})`
      : macro.name;
    const displayLabel = shouldDoubleDice ? `${baseLabel} [CRIT ×2 Dice]` : baseLabel;

    // Show after-effects only on Secondary (Damage) when paired, or on the single roll when standalone
    const shouldIncludeNotes = !isPaired || slot === 'secondary';
    const resolvedNotes = shouldIncludeNotes && macro.notes?.trim() ? macro.notes.trim() : undefined;

    let activeAdvMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
    if (slot === 'primary' && hasPrimary) {
      const rawMode = (macro as any).rollMode || macro.advantageMode;
      if (rawMode === 'advantage' || rawMode === 'Adv' || rawMode === 'adv') {
        activeAdvMode = 'advantage';
      } else if (rawMode === 'disadvantage' || rawMode === 'Dis' || rawMode === 'dis') {
        activeAdvMode = 'disadvantage';
      }
    }

    const currentUserId = liveFeedSync.getPlayerId();
    const parsedMacro = parseMacroFormula(expr);

    if (parsedMacro) {
      const { count, sides, modifier: macroMod } = parsedMacro;
      const isD20 = sides === 20;

      if (activeAdvMode === 'advantage' || activeAdvMode === 'disadvantage') {
        const valA = rollSingleDie(sides);
        const valB = rollSingleDie(sides);
        const isAdv = activeAdvMode === 'advantage';
        const winningFace = isAdv ? Math.max(valA, valB) : Math.min(valA, valB);
        const discardedFace = isAdv ? Math.min(valA, valB) : Math.max(valA, valB);
        const total = winningFace + macroMod;
        const isCrit = isD20 && winningFace === 20;
        const isFumble = isD20 && winningFace === 1;

        const modStr = macroMod !== 0 ? (macroMod > 0 ? ` + ${macroMod}` : ` - ${Math.abs(macroMod)}`) : '';
        const breakdownLine = `${displayLabel} (${count}d${sides} ${isAdv ? 'Adv' : 'Dis'}): [${winningFace}, ~~${discardedFace}~~]${modStr} = ${total}`;

        return {
          total,
          formula: expr,
          breakdownLine,
          isCrit: isCrit || shouldDoubleDice,
          isFumble,
          isD20,
          d20Chosen: winningFace,
          d20Discarded: discardedFace,
          modifier: macroMod,
          poolBreakdown: [
            {
              dieType: parsedMacro.dieType || 'd20',
              rolls: [winningFace],
              rawRolls: [valA, valB],
            },
          ],
          label: displayLabel,
          notes: resolvedNotes,
          didCritDouble: shouldDoubleDice,
        };
      }

      const res = executeDiceRoll({
        diceType: parsedMacro.dieType || 'd20',
        count,
        modifier: macroMod,
        advantageMode: 'normal',
        displayMode: 'sum',
        sender: rollerName,
        rollerName,
        rollerId: currentUserId,
        isDm,
        visibility,
        label: displayLabel,
      });

      const line = `${displayLabel}: ${res.breakdown && res.breakdown.length > 0 ? res.breakdown[0] : `${res.total}`}`;
      return {
        total: res.total,
        formula: expr,
        breakdownLine: line,
        isCrit: Boolean(res.isCrit || shouldDoubleDice),
        isFumble: Boolean(res.isFumble),
        isD20,
        d20Chosen: res.rolls[0] ?? res.total,
        d20Discarded: undefined,
        modifier: macroMod,
        poolBreakdown: res.poolBreakdown,
        label: displayLabel,
        notes: resolvedNotes,
        didCritDouble: shouldDoubleDice,
      };
    }

    const parsed = parseDiceFormula(expr);
    const finalMacroModifier = parsed ? parsed.modifier : 0;
    const res = executeDiceRoll({
      pool: parsed?.pool,
      modifier: finalMacroModifier,
      advantageMode: activeAdvMode,
      displayMode: 'sum',
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      label: displayLabel || expr,
    });

    const isD20 = (parsed?.pool?.some((p) => p.diceType === 'd20')) || expr.includes('d20');
    const line = `${displayLabel}: ${res.breakdown && res.breakdown.length > 0 ? res.breakdown.join(' | ') : `${res.total}`}`;

    return {
      total: res.total,
      formula: expr,
      breakdownLine: line,
      isCrit: Boolean(res.isCrit || shouldDoubleDice),
      isFumble: Boolean(res.isFumble),
      isD20,
      d20Chosen: res.rolls[0] ?? res.total,
      d20Discarded: undefined,
      modifier: finalMacroModifier,
      poolBreakdown: res.poolBreakdown,
      label: displayLabel,
      notes: resolvedNotes,
      didCritDouble: shouldDoubleDice,
    };
  };

  const handleRollMacro = (macro: CustomMacro, e: React.MouseEvent, slot: MacroSlot = 'primary') => {
    e.preventDefault();
    e.stopPropagation();

    const currentUserId = liveFeedSync.getPlayerId();
    const countToRoll = batchMultiplier;

    // Single execution (×1)
    if (countToRoll === 1) {
      const evaluated = evaluateMacro(macro, slot, isCritMode);
      if (evaluated.didCritDouble) {
        setIsCritMode(false);
      }

      const result: RollResult = {
        id: `roll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        sender: rollerName,
        rollerName,
        rollerId: currentUserId,
        isDm,
        visibility,
        rollType: 'Straight roll',
        diceType: evaluated.isD20 ? 'd20' : 'd6',
        count: 1,
        modifier: evaluated.modifier,
        rolls: [evaluated.total],
        rawRolls: [evaluated.total],
        total: evaluated.total,
        advantageMode: 'normal',
        breakdown: [evaluated.breakdownLine],
        poolBreakdown: evaluated.poolBreakdown,
        formula: evaluated.formula,
        label: evaluated.label,
        macroName: evaluated.label,
        notes: evaluated.notes,
        isCrit: evaluated.isCrit,
        isFumble: evaluated.isFumble,
        displayMode: 'sum',
      };

      liveFeedSync.recordDiceRoll(result, true);
      return;
    }

    // Batch execution (×2, ×3, ×4)
    const breakdowns: string[] = [];
    const rollTotals: number[] = [];
    const instances: RollInstance[] = [];
    let hasD20 = false;
    let hasCrit = false;
    let hasFumble = false;
    let totalSum = 0;
    let formulaUsed = '';
    let baseMacroLabel = '';
    let resolvedNote: string | undefined;
    let didAnyCritDouble = false;

    for (let i = 1; i <= countToRoll; i++) {
      const evaluated = evaluateMacro(macro, slot, isCritMode);
      if (evaluated.didCritDouble) didAnyCritDouble = true;
      formulaUsed = evaluated.formula;
      baseMacroLabel = evaluated.label;
      if (evaluated.notes) resolvedNote = evaluated.notes;

      breakdowns.push(`#${i} · ${evaluated.breakdownLine}`);
      rollTotals.push(evaluated.total);
      totalSum += evaluated.total;
      if (evaluated.isD20) hasD20 = true;
      if (evaluated.isCrit) hasCrit = true;
      if (evaluated.isFumble) hasFumble = true;

      if (evaluated.isD20) {
        instances.push({
          index: i,
          d20Chosen: evaluated.d20Chosen,
          d20Discarded: evaluated.d20Discarded,
          isCrit: evaluated.d20Chosen === 20,
          isFumble: evaluated.d20Chosen === 1,
          riders: [],
          modifier: evaluated.modifier,
          total: evaluated.total,
        });
      }
    }

    if (didAnyCritDouble) {
      setIsCritMode(false);
    }

    const batchTitle = `${baseMacroLabel} (×${countToRoll})`;
    const batchResult: RollResult = {
      id: `roll-batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      rollType: 'Straight roll',
      diceType: hasD20 ? 'd20' : 'd6',
      count: countToRoll,
      modifier: 0,
      rolls: rollTotals,
      rawRolls: rollTotals,
      total: totalSum,
      advantageMode: 'normal',
      breakdown: breakdowns,
      formula: `${formulaUsed} (×${countToRoll})`,
      label: batchTitle,
      macroName: batchTitle,
      notes: resolvedNote,
      isCrit: hasCrit,
      isFumble: hasFumble,
      displayMode: hasD20 ? 'individual' : 'sum',
      instances: hasD20 ? instances : undefined,
    };

    liveFeedSync.recordDiceRoll(batchResult, true);
  };

  const handleStageMacro = (macro: CustomMacro, e: React.MouseEvent, slot: MacroSlot = 'primary') => {
    e.preventDefault();
    e.stopPropagation();

    const key = `${macro.id}:${slot}`;
    const addCount = batchMultiplier;

    setStagedQueue((prev) => {
      const idx = prev.findIndex((item) => item.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], count: next[idx].count + addCount };
        return next;
      }
      return [...prev, { key, macro, slot, count: addCount }];
    });
  };

  const handleRemoveStagedMacro = (itemKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setStagedQueue((prev) => {
      const target = prev.find((item) => item.key === itemKey);
      if (!target) return prev;
      if (target.count > 1) {
        return prev.map((item) =>
          item.key === itemKey ? { ...item, count: item.count - 1 } : item
        );
      }
      return prev.filter((item) => item.key !== itemKey);
    });
  };

  const handleClearQueue = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStagedQueue([]);
  };

  const handleExecuteComboRoll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (stagedQueue.length === 0) return;

    const currentUserId = liveFeedSync.getPlayerId();
    const breakdowns: string[] = [];
    const rollTotals: number[] = [];
    const uniqueNotes = new Set<string>();
    let hasD20 = false;
    let hasCrit = false;
    let hasFumble = false;
    let totalSum = 0;
    const comboNames: string[] = [];
    let didAnyCritDouble = false;

    stagedQueue.forEach((item) => {
      const hasPrimary = Boolean(item.macro.formula && item.macro.formula.trim());
      const hasSecondary = Boolean(item.macro.secondaryFormula && item.macro.secondaryFormula.trim());
      const isPaired = hasPrimary && hasSecondary;
      const itemDisplayName = isPaired
        ? `${item.macro.name} (${item.slot === 'secondary' ? 'Dmg' : 'Atk'})`
        : item.macro.name;

      for (let i = 0; i < item.count; i++) {
        const evalRes = evaluateMacro(item.macro, item.slot, isCritMode);
        if (evalRes.didCritDouble) didAnyCritDouble = true;
        breakdowns.push(evalRes.breakdownLine);
        rollTotals.push(evalRes.total);
        totalSum += evalRes.total;
        if (evalRes.isD20) hasD20 = true;
        if (evalRes.isCrit) hasCrit = true;
        if (evalRes.isFumble) hasFumble = true;
        if (evalRes.notes) uniqueNotes.add(evalRes.notes);
      }
      comboNames.push(item.count > 1 ? `${itemDisplayName} ×${item.count}` : itemDisplayName);
    });

    if (didAnyCritDouble) {
      setIsCritMode(false);
    }

    const combinedNotes = uniqueNotes.size > 0 ? Array.from(uniqueNotes).join(' | ') : undefined;
    const isIndividual = hasD20;
    const totalRollsCount = stagedQueue.reduce((acc, curr) => acc + curr.count, 0);

    const comboResult: RollResult = {
      id: `roll-combo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      rollType: 'Straight roll',
      diceType: hasD20 ? 'd20' : 'd6',
      count: totalRollsCount,
      modifier: 0,
      rolls: rollTotals,
      rawRolls: rollTotals,
      total: totalSum,
      advantageMode: 'normal',
      breakdown: breakdowns,
      formula: `Combo (${comboNames.join(', ')})`,
      label: `Combo (${totalRollsCount} rolls)`,
      macroName: `Combo (${totalRollsCount})`,
      notes: combinedNotes,
      isCrit: hasCrit,
      isFumble: hasFumble,
      displayMode: isIndividual ? 'individual' : 'sum',
    };

    liveFeedSync.recordDiceRoll(comboResult, true);
    triggerRollFlash('sum');
    setStagedQueue([]);
  };

  const handleOpenAddMacro = () => {
    setEditingMacro(null);
    setIsAddMacroOpen(true);
  };

  const handleOpenEditMacro = (m: CustomMacro, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMacro(m);
    setIsAddMacroOpen(true);
  };

  const handleDuplicateMacro = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = duplicateCustomMacro(id);
    setMacros(updated);
  };

  const handleDeleteMacro = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomMacro(id);
    setMacros(updated);
    setStagedQueue((prev) => prev.filter((item) => item.macro.id !== id));
  };

  const handleClearFeed = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    liveFeedSync.clearFeed();
    setRollFeed([]);
  };

  const totalQueuedCount = stagedQueue.reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto min-h-0 pr-1 select-text scrollbar-thin scrollbar-thumb-slate-800 bg-[#0b0f17] p-2 gap-2 text-slate-100">
      
      {/* 1. TOP FORMULA INPUT BAR */}
      <div className="relative flex items-center h-9 w-full shrink-0">
        <input
          type="text"
          value={formulaInput}
          onChange={(e) => handleFormulaInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleExecuteRoll('sum');
              triggerRollFlash('sum');
            }
          }}
          placeholder="e.g. 1d20+5, 5d20+1d4+15, 8d6"
          className="w-full h-9 px-3 pr-8 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 transition placeholder:text-slate-600 shadow-inner"
        />
        {formulaInput && (
          <button
            type="button"
            onClick={handleClearFormula}
            className="absolute right-2 p-1 text-slate-400 hover:text-amber-300 rounded transition cursor-pointer"
            title="Clear formula expression & modifier"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. DEDICATED ACTION CARDS */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            handleExecuteRoll('individual');
            triggerRollFlash('indiv');
          }}
          className={`h-11 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md border border-indigo-400/30 active:scale-[0.98] transition flex flex-col items-center justify-center cursor-pointer select-none ${
            rollFlash === 'indiv' ? 'ring-2 ring-white brightness-125' : ''
          }`}
          title="Roll separate checks: each d20 check evaluated individually against AC or DC"
        >
          <span className="text-[11px] font-black uppercase tracking-wide leading-none">
            ⚔️ ATTACKS / CHECKS
          </span>
          <span className="text-[9px] font-semibold opacity-85 mt-0.5 tracking-tight leading-none">
            & SAVING THROWS
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            handleExecuteRoll('sum');
            triggerRollFlash('sum');
          }}
          className={`h-11 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-md active:scale-[0.98] transition flex flex-col items-center justify-center cursor-pointer select-none ${
            rollFlash === 'sum' ? 'ring-2 ring-white brightness-125' : ''
          }`}
          title="Roll sum: all dice and flat modifiers pooled into one grand total"
        >
          <span className="text-[11px] font-black uppercase tracking-wide leading-none">
            💥 HEALING / DAMAGE
          </span>
          <span className="text-[9px] font-black opacity-90 mt-0.5 tracking-tight leading-none">
            & SKILLS CHALLENGE
          </span>
        </button>
      </div>

      {/* 3. DIE SELECTION STRIP (d4 to d100) + ADVANTAGE TOGGLES */}
      <div className="flex items-center justify-between gap-1 h-7 shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          {INTERACTIVE_DICE.map((die) => {
            const isD20 = die === 'd20';
            return (
              <button
                key={die}
                type="button"
                onClick={() => handleDieButtonClick(die)}
                className={`h-7 px-2 text-xs rounded transition-colors shrink-0 flex items-center justify-center cursor-pointer ${
                  isD20
                    ? 'font-bold bg-amber-950/30 text-amber-400 border border-amber-500/60 hover:bg-amber-900/40'
                    : 'font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
                title={`Add ${die} to formula`}
              >
                {die}
              </button>
            );
          })}
        </div>

        <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 shrink-0 h-7">
          <button
            type="button"
            onClick={() => setAdvantageMode('advantage')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
              advantageMode === 'advantage'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Advantage: Roll 2d20, keep highest"
          >
            Adv
          </button>
          <button
            type="button"
            onClick={() => setAdvantageMode('normal')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
              advantageMode === 'normal'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Straight roll"
          >
            Straight
          </button>
          <button
            type="button"
            onClick={() => setAdvantageMode('disadvantage')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
              advantageMode === 'disadvantage'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Disadvantage: Roll 2d20, keep lowest"
          >
            Dis
          </button>
        </div>
      </div>

      {/* 4. QUICK D20 SHORTCUTS + VISIBILITY SELECTOR STRIP */}
      <div className="flex items-center justify-between gap-1.5 shrink-0 px-0.5">
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500/80 mr-1 shrink-0 select-none">
            Quick D20:
          </span>
          <button
            type="button"
            onClick={() => handleQuickD20Roll('normal')}
            className="h-7 px-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700/80 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
            title="Quick Flat 1d20 Roll"
          >
            <span>🎲</span>
            <span>d20</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickD20Roll('advantage')}
            className="h-7 px-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700/80 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
            title="Quick Advantage Roll (2d20, Keep Highest)"
          >
            <span>⚔️</span>
            <span>Adv</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickD20Roll('disadvantage')}
            className="h-7 px-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700/80 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
            title="Quick Disadvantage Roll (2d20, Keep Lowest)"
          >
            <span>🛡️</span>
            <span>Dis</span>
          </button>
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-950 border border-slate-800 rounded-md h-7 text-[10px] shrink-0">
          <button
            type="button"
            onClick={() => setVisibility('public')}
            className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
              visibility === 'public'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Public: Visible to all players & GM"
          >
            👁️ Public
          </button>
          <button
            type="button"
            onClick={() => setVisibility('gm_only')}
            className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
              visibility === 'gm_only' || visibility === 'dm'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="GM Only: Hidden from other players"
          >
            🛡️ GM
          </button>
          <button
            type="button"
            onClick={() => setVisibility('self')}
            className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
              visibility === 'self'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Self: Visible only to you"
          >
            🔒 Self
          </button>
        </div>
      </div>

      {/* 5. DOCKED CALCULATOR */}
      <CalculatorDock
        viewMode={calcMode === 'closed' ? 'docked' : calcMode}
        onChangeViewMode={(mode) => setCalcMode(mode)}
        isOpen={true}
        onApply={handleApplyFromCalculator}
      />

      {/* 6. CUSTOM MACROS DRAWER (ULTRA-COMPACT SINGLE-ROW HEADER) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="flex items-center justify-between gap-1">
          {/* Left: Collapse Chevron + Profile Dropdown */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setIsMacrosOpen(!isMacrosOpen)}
              className="p-0.5 text-amber-400 hover:text-amber-300 rounded hover:bg-slate-800 transition cursor-pointer shrink-0 flex items-center"
              title={isMacrosOpen ? 'Collapse Macros' : 'Expand Macros'}
            >
              <Bookmark className="w-3.5 h-3.5" />
              {isMacrosOpen ? (
                <ChevronUp className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <select
              value={selectedGroup}
              onChange={(e) => {
                handleSelectGroup(e.target.value);
                if (!isMacrosOpen) setIsMacrosOpen(true);
              }}
              aria-label="Select Macro Profile"
              title="Filter macros by Monster / Encounter Profile"
              className="min-w-0 max-w-[125px] px-1.5 py-0.5 text-[11px] font-bold rounded-md bg-slate-950 border border-slate-700/90 text-amber-300 hover:border-amber-400/70 focus:outline-none focus:border-amber-400 cursor-pointer truncate"
            >
              <option value="All" className="bg-slate-900 text-slate-100">
                All ({groupCounts.All || 0})
              </option>
              {availableGroups.map((grp) => (
                <option key={grp} value={grp} className="bg-slate-900 text-slate-100">
                  {grp} ({groupCounts[grp] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Right: Single Mode Pill + Batch Multiplier (×1–×4) + Crit + Manage + Add */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Single-Pill Mode Toggle (1-Click <-> Queue) */}
            <button
              type="button"
              onClick={() => {
                const nextMode = macroMode === 'instant' ? 'queue' : 'instant';
                setMacroMode(nextMode);
                if (nextMode === 'queue' && !isMacrosOpen) setIsMacrosOpen(true);
              }}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold transition cursor-pointer flex items-center gap-0.5 shrink-0 ${
                macroMode === 'queue'
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-amber-400 hover:border-slate-700'
              }`}
              title={
                macroMode === 'instant'
                  ? 'Currently 1-Click Mode (Click to switch to Combo Queue Mode)'
                  : 'Currently Combo Queue Mode (Click to switch to 1-Click Mode)'
              }
            >
              {macroMode === 'instant' ? (
                <>
                  <Zap className="w-2.5 h-2.5" />
                  <span>1-Click</span>
                </>
              ) : (
                <>
                  <Layers className="w-2.5 h-2.5" />
                  <span>Queue</span>
                </>
              )}
            </button>

            {/* Batch Multiplier Cycle Pill (×1 -> ×2 -> ×3 -> ×4) */}
            <button
              type="button"
              onClick={cycleBatchMultiplier}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-black transition cursor-pointer shrink-0 ${
                batchMultiplier > 1
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={`Batch Multiplier: ×${batchMultiplier} (Click to cycle ×1, ×2, ×3, ×4 for mob attacks)`}
            >
              ×{batchMultiplier}
            </button>

            {/* Critical Hit (Doubles Dice Count on Damage) */}
            <button
              type="button"
              onClick={() => setIsCritMode((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold transition cursor-pointer shrink-0 ${
                isCritMode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-slate-700'
              }`}
              title="Crit Mode: Doubles number of dice rolled on next Damage roll (flat modifier unchanged)"
            >
              Crit
            </button>

            {/* Manage Mode Toggle (Icon-only until active) */}
            {macros.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsManageMode((prev) => !prev);
                  if (!isMacrosOpen) setIsMacrosOpen(true);
                }}
                className={`p-1 rounded border transition cursor-pointer flex items-center gap-0.5 shrink-0 ${
                  isManageMode
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 px-1.5 text-[10px] font-bold'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
                title={isManageMode ? 'Exit Manage Mode' : 'Manage Macros (Clone / Edit / Delete)'}
              >
                {isManageMode ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </>
                ) : (
                  <SlidersHorizontal className="w-3 h-3" />
                )}
              </button>
            )}

            {/* + Add Macro */}
            <button
              type="button"
              onClick={handleOpenAddMacro}
              className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-500/40 transition cursor-pointer flex items-center gap-0.5 shrink-0"
              title="Create a new macro"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Hybrid Macro Grid */}
        {isMacrosOpen && (
          <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pt-0.5 pr-0.5">
            {filteredMacros.length === 0 ? (
              <div className="col-span-2 text-[11px] text-slate-500 italic py-1">
                No custom macros in this profile. Click "+ Add" to create one.
              </div>
            ) : (
              filteredMacros.map((m) => {
                const hasPrimary = Boolean(m.formula && m.formula.trim());
                const hasSecondary = Boolean(m.secondaryFormula && m.secondaryFormula.trim());
                const isPaired = hasPrimary && hasSecondary;
                const isDamageOnly = !hasPrimary && hasSecondary;

                const primaryStaged = stagedQueue.find((item) => item.key === `${m.id}:primary`);
                const secondaryStaged = stagedQueue.find((item) => item.key === `${m.id}:secondary`);
                const hasNotes = Boolean(m.notes && m.notes.trim());

                const displayPrimary = m.formula || '';
                const displaySecondary = m.secondaryFormula
                  ? isCritMode
                    ? doubleDiceInFormula(m.secondaryFormula)
                    : m.secondaryFormula
                  : '';

                const tooltipText = [
                  `${m.name}${hasPrimary ? ` | Atk: ${m.formula}` : ''}${
                    hasSecondary ? ` | Dmg: ${m.secondaryFormula}` : ''
                  }`,
                  hasNotes ? `Notes: ${m.notes}` : '',
                ]
                  .filter(Boolean)
                  .join('\n');

                /* CASE A: PAIRED ATTACK + DAMAGE ROW (Full-Width) */
                if (isPaired) {
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => {
                        if (isManageMode) {
                          handleOpenEditMacro(m, e);
                        }
                      }}
                      className={`col-span-2 flex items-center justify-between gap-2 px-2 py-1 rounded-lg border transition shadow-sm text-xs min-w-0 ${
                        isManageMode
                          ? 'bg-slate-950/90 border-cyan-800/60 hover:border-cyan-400 cursor-pointer'
                          : primaryStaged || secondaryStaged
                          ? 'bg-slate-950 border-amber-500/70'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                      title={tooltipText}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-semibold text-slate-200 truncate">
                          {m.name}
                        </span>
                        {m.advantageMode && m.advantageMode !== 'normal' && (
                          <span
                            className={`text-[9px] px-1 rounded font-bold shrink-0 ${
                              m.advantageMode === 'advantage'
                                ? 'bg-emerald-950 text-emerald-300'
                                : 'bg-rose-950 text-rose-300'
                            }`}
                          >
                            {m.advantageMode === 'advantage' ? 'Adv' : 'Dis'}
                          </span>
                        )}
                        {hasNotes && (
                          <span
                            className="text-cyan-400/80 shrink-0 flex items-center"
                            title={m.notes}
                          >
                            <FileText className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {isManageMode ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-mono text-slate-500 mr-0.5">
                            {m.formula} / {m.secondaryFormula}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDuplicateMacro(m.id, e)}
                            className="p-0.5 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 cursor-pointer"
                            title="Clone / Duplicate macro"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditMacro(m, e)}
                            className="p-0.5 text-cyan-300 hover:text-amber-300 rounded hover:bg-slate-800 cursor-pointer"
                            title="Edit macro"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMacro(m.id, e)}
                            className="p-0.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                            title="Delete macro"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Primary (Attack / Check) Button */}
                          <button
                            type="button"
                            onClick={(e) =>
                              macroMode === 'queue'
                                ? handleStageMacro(m, e, 'primary')
                                : handleRollMacro(m, e, 'primary')
                            }
                            className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                              primaryStaged
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                                : 'bg-indigo-950/50 hover:bg-indigo-600/80 border-indigo-500/40 text-indigo-200 hover:text-white'
                            }`}
                            title={
                              macroMode === 'queue'
                                ? `Stage Attack: ${displayPrimary}`
                                : `Roll Attack: ${displayPrimary}${batchMultiplier > 1 ? ` (×${batchMultiplier})` : ''}`
                            }
                          >
                            <span>⚔️</span>
                            <span>{displayPrimary}</span>
                            {primaryStaged && (
                              <span className="px-1 bg-white text-indigo-950 rounded font-black text-[9px]">
                                ×{primaryStaged.count}
                              </span>
                            )}
                          </button>

                          {/* Secondary (Damage / Effect) Button */}
                          <button
                            type="button"
                            onClick={(e) =>
                              macroMode === 'queue'
                                ? handleStageMacro(m, e, 'secondary')
                                : handleRollMacro(m, e, 'secondary')
                            }
                            className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                              isCritMode
                                ? 'bg-emerald-950/70 hover:bg-emerald-500 border-emerald-400 text-emerald-300 hover:text-slate-950'
                                : secondaryStaged
                                ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-sm'
                                : 'bg-amber-950/40 hover:bg-amber-500/90 border-amber-500/40 text-amber-300 hover:text-slate-950'
                            }`}
                            title={
                              macroMode === 'queue'
                                ? `Stage Damage: ${displaySecondary}`
                                : `Roll Damage: ${displaySecondary}${batchMultiplier > 1 ? ` (×${batchMultiplier})` : ''}`
                            }
                          >
                            <span>💥</span>
                            <span>{displaySecondary}</span>
                            {secondaryStaged && (
                              <span className="px-1 bg-slate-950 text-amber-300 rounded font-black text-[9px]">
                                ×{secondaryStaged.count}
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                /* CASE B: STANDALONE SINGLE-FORMULA PILL (Primary-Only OR Damage-Only) */
                const activeSlot: MacroSlot = isDamageOnly ? 'secondary' : 'primary';
                const activeStaged = isDamageOnly ? secondaryStaged : primaryStaged;
                const isStaged = Boolean(activeStaged);
                const rawFormula = isDamageOnly ? m.secondaryFormula! : m.formula!;
                const isD20Single = /\bd20\b/i.test(rawFormula);
                const shownFormula =
                  isCritMode && !isD20Single ? doubleDiceInFormula(rawFormula) : rawFormula;

                return (
                  <div
                    key={m.id}
                    onClick={(e) => {
                      if (isManageMode) {
                        handleOpenEditMacro(m, e);
                      } else if (macroMode === 'queue') {
                        handleStageMacro(m, e, activeSlot);
                      } else {
                        handleRollMacro(m, e, activeSlot);
                      }
                    }}
                    className={`group flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg border transition cursor-pointer shadow-sm text-xs min-w-0 ${
                      isManageMode
                        ? 'bg-slate-950/90 border-cyan-800/60 hover:border-cyan-400'
                        : isStaged
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                        : isDamageOnly
                        ? 'bg-amber-950/15 hover:bg-amber-950/35 border-amber-800/50 hover:border-amber-400/80'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 hover:border-amber-400/80'
                    }`}
                    title={tooltipText}
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="font-semibold text-slate-200 group-hover:text-amber-300 truncate">
                        {m.name}
                      </span>
                      {hasNotes && (
                        <span className="text-cyan-400/80 shrink-0" title={m.notes}>
                          <FileText className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-mono ${
                          isCritMode && !isD20Single
                            ? 'text-emerald-300 font-bold'
                            : isDamageOnly
                            ? 'text-amber-300/90'
                            : 'text-slate-400'
                        }`}
                      >
                        {isDamageOnly ? `💥 ${shownFormula}` : shownFormula}
                      </span>

                      {!isDamageOnly && m.advantageMode && m.advantageMode !== 'normal' && (
                        <span
                          className={`text-[9px] px-1 rounded font-bold ${
                            m.advantageMode === 'advantage'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          {m.advantageMode === 'advantage' ? 'Adv' : 'Dis'}
                        </span>
                      )}

                      {!isManageMode && isStaged && activeStaged && (
                        <span className="px-1 py-0.2 bg-amber-500 text-slate-950 rounded font-black text-[9px]">
                          ×{activeStaged.count}
                        </span>
                      )}

                      {isManageMode && (
                        <div className="flex items-center gap-0.5 ml-0.5">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicateMacro(m.id, e)}
                            className="p-0.5 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 cursor-pointer"
                            title="Clone / Duplicate macro"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditMacro(m, e)}
                            className="p-0.5 text-cyan-300 hover:text-amber-300 rounded hover:bg-slate-800 cursor-pointer"
                            title="Edit macro"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMacro(m.id, e)}
                            className="p-0.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                            title="Delete macro"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Staged Combo Queue Tray */}
        {stagedQueue.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex flex-col gap-1.5 bg-slate-950/70 p-2 rounded-lg border border-amber-500/40 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Staged Combo ({totalQueuedCount})</span>
              </div>
              <button
                type="button"
                onClick={handleClearQueue}
                className="text-[10px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                title="Clear all staged macros"
              >
                Clear Queue
              </button>
            </div>

            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {stagedQueue.map((item) => {
                const hasPrimary = Boolean(item.macro.formula && item.macro.formula.trim());
                const hasSecondary = Boolean(item.macro.secondaryFormula && item.macro.secondaryFormula.trim());
                const isPaired = hasPrimary && hasSecondary;
                const chipLabel = isPaired
                  ? `${item.macro.name} (${item.slot === 'secondary' ? 'Dmg' : 'Atk'})`
                  : item.macro.name;

                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-[11px] text-slate-200"
                  >
                    <span className="font-semibold text-amber-300 truncate max-w-[140px]">
                      {chipLabel}
                    </span>
                    {item.count > 1 && (
                      <span className="px-1 py-0.2 bg-amber-500/30 text-amber-200 rounded font-bold text-[9px]">
                        ×{item.count}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveStagedMacro(item.key, e)}
                      className="p-0.5 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                      title="Remove one from queue"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleExecuteComboRoll}
              className="w-full h-8 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-lg shadow-md flex items-center justify-center gap-1.5 transition uppercase tracking-wider cursor-pointer"
            >
              <span>🎲</span>
              <span>ROLL COMBO ({totalQueuedCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* 7. ROLL FEED (Audit Log) */}
      <div className="flex-1 min-h-[220px] rounded-xl border border-slate-800/90 bg-slate-950/60 p-2 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-slate-200 font-display">Roll Feed</span>
            <span className="text-[10px] text-slate-400 font-mono">({rollFeed.length})</span>
          </div>
          {rollFeed.length > 0 && (
            <button
              type="button"
              onClick={handleClearFeed}
              className="text-[10px] text-slate-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-rose-950/40 border border-slate-800 transition cursor-pointer flex items-center gap-1"
              title="Clear roll feed"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="flex-1 min-h-[160px] overflow-y-auto space-y-2 pr-1">
          {rollFeed.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
              <p className="text-xs">No recent rolls.</p>
              <span className="text-[10px] text-slate-600">
                Roll attack batches, damage expressions, or custom macros above
              </span>
            </div>
          ) : (
            rollFeed.map((roll) => {
              const isGmOnly = roll.visibility === 'gm_only' || roll.visibility === 'dm' || roll.isSecret;
              const isSelf = roll.visibility === 'self';
              const currentUserId = liveFeedSync.getPlayerId();
              const isRoller =
                (roll.rollerId && roll.rollerId === currentUserId) ||
                roll.sender === rollerName ||
                roll.rollerName === rollerName;
              const canSeeSecret = isDm || liveFeedSync.getIsGm() || isRoller;

              if (isSelf && !isRoller) {
                return null;
              }

              if (isGmOnly && !canSeeSecret) {
                return (
                  <div
                    key={roll.id}
                    className="p-2 rounded-lg bg-purple-950/20 border border-purple-800/40 text-xs select-none shadow-sm flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 text-purple-300">
                      <Dices className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-medium text-slate-200">
                        {roll.rollerName || roll.sender} made a secret roll to the GM 🔒
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(roll.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              }

              return (
                <RollFeedCard
                  key={roll.id}
                  roll={roll}
                  isDm={isDm}
                  playerName={rollerName}
                />
              );
            })
          )}
        </div>
      </div>

      {/* 8. MODALS: ADD / EDIT MACRO */}
      <AddCustomMacroModal
        isOpen={isAddMacroOpen && !editingMacro}
        onClose={() => setIsAddMacroOpen(false)}
        initialFormula={formulaInput || ''}
        initialMode={advantageMode}
        existingGroups={availableGroups}
        defaultGroup={selectedGroup}
        onSave={({ name, formula, secondaryFormula, notes, advantageMode, group }) => {
          const created = addCustomMacro(
            name,
            formula,
            advantageMode,
            0,
            'Straight roll',
            group,
            secondaryFormula,
            notes
          );
          setMacros((prev) => [...prev, created]);
          if (group && group.trim()) {
            handleSelectGroup(group.trim());
          }
        }}
      />

      <EditCustomMacroModal
        isOpen={isAddMacroOpen && Boolean(editingMacro)}
        macro={editingMacro}
        existingGroups={availableGroups}
        onClose={() => {
          setIsAddMacroOpen(false);
          setEditingMacro(null);
        }}
        onSave={({ id, name, formula, secondaryFormula, notes, advantageMode, group }) => {
          const updated = updateCustomMacro(id, {
            name,
            formula,
            secondaryFormula,
            notes,
            advantageMode,
            group,
          });
          setMacros(updated);
        }}
      />
    </div>
  );
};

export default DiceChamber;
