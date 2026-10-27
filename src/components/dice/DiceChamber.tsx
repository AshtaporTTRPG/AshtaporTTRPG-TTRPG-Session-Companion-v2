/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  DiceRollResult,
  DieType,
  RollVisibility,
  RollDisplayMode,
  CustomMacro,
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

interface StagedMacroItem {
  macro: CustomMacro;
  count: number;
}

const INTERACTIVE_DICE: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export const DiceChamber: React.FC<DiceChamberProps> = ({ isGM, isDm = false, playerName }) => {
  const isGameMaster = isGM !== undefined ? isGM : isDm;
  const rollerName = playerName?.trim() || (isGameMaster ? 'Game Master' : 'Adventurer');

  // Input & Formula State
  const [formulaInput, setFormulaInput] = useState<string>('');
  const [advantageMode, setAdvantageMode] = useState<'advantage' | 'normal' | 'disadvantage'>('normal');
  const [modifier, setModifier] = useState<number>(0);
  const [visibility, setVisibility] = useState<RollVisibility>('public');

  // Permanently Docked Calculator State (defaults to compact 'docked' mini-bar)
  const [calcMode, setCalcMode] = useState<CalcViewMode>('docked');

  // Custom Macros & Queue State
  const [macros, setMacros] = useState<CustomMacro[]>(() => loadCustomMacros());
  const [isMacrosOpen, setIsMacrosOpen] = useState<boolean>(false);
  const [editingMacro, setEditingMacro] = useState<CustomMacro | null>(null);
  const [isAddMacroOpen, setIsAddMacroOpen] = useState<boolean>(false);
  const [macroMode, setMacroMode] = useState<'instant' | 'queue'>('instant');
  const [stagedQueue, setStagedQueue] = useState<StagedMacroItem[]>([]);

  // Active Roll Feed State
  const [rollFeed, setRollFeed] = useState<RollResult[]>([]);

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

  // Evaluates a single macro returning formatted output and metadata
  const evaluateMacro = (macro: CustomMacro) => {
    let activeAdvMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
    const rawMode = (macro as any).rollMode || macro.advantageMode;
    if (rawMode === 'advantage' || rawMode === 'Adv' || rawMode === 'adv') {
      activeAdvMode = 'advantage';
    } else if (rawMode === 'disadvantage' || rawMode === 'Dis' || rawMode === 'dis') {
      activeAdvMode = 'disadvantage';
    }

    const expr = macro.formula.trim();
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
        const breakdownLine = `${macro.name} (${count}d${sides} ${isAdv ? 'Adv' : 'Dis'}): [${winningFace}, ~~${discardedFace}~~]${modStr} = ${total}`;

        return {
          total,
          breakdownLine,
          isCrit,
          isFumble,
          isD20,
          label: macro.name,
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
        label: macro.name,
      });

      const line = `${macro.name}: ${res.breakdown && res.breakdown.length > 0 ? res.breakdown[0] : `${res.total}`}`;
      return {
        total: res.total,
        breakdownLine: line,
        isCrit: res.isCrit,
        isFumble: res.isFumble,
        isD20,
        label: macro.name,
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
      label: macro.name || expr,
    });

    const isD20 = (parsed?.pool?.some((p) => p.diceType === 'd20')) || expr.includes('d20');
    const line = `${macro.name}: ${res.breakdown && res.breakdown.length > 0 ? res.breakdown.join(' | ') : `${res.total}`}`;

    return {
      total: res.total,
      breakdownLine: line,
      isCrit: res.isCrit,
      isFumble: res.isFumble,
      isD20,
      label: macro.name,
    };
  };

  const handleRollMacro = (macro: CustomMacro, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const evaluated = evaluateMacro(macro);
    const currentUserId = liveFeedSync.getPlayerId();

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
      modifier: 0,
      rolls: [evaluated.total],
      rawRolls: [evaluated.total],
      total: evaluated.total,
      advantageMode: 'normal',
      breakdown: [evaluated.breakdownLine],
      formula: macro.formula,
      label: macro.name,
      macroName: macro.name,
      isCrit: evaluated.isCrit,
      isFumble: evaluated.isFumble,
      displayMode: 'sum',
    };

    liveFeedSync.recordDiceRoll(result, true);
  };

  // Queue Handling Functions
  const handleStageMacro = (macro: CustomMacro, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setStagedQueue((prev) => {
      const idx = prev.findIndex((item) => item.macro.id === macro.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], count: next[idx].count + 1 };
        return next;
      }
      return [...prev, { macro, count: 1 }];
    });
  };

  const handleRemoveStagedMacro = (macroId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setStagedQueue((prev) => {
      const target = prev.find((item) => item.macro.id === macroId);
      if (!target) return prev;
      if (target.count > 1) {
        return prev.map((item) =>
          item.macro.id === macroId ? { ...item, count: item.count - 1 } : item
        );
      }
      return prev.filter((item) => item.macro.id !== macroId);
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
    let hasD20 = false;
    let hasCrit = false;
    let hasFumble = false;
    let totalSum = 0;
    const comboNames: string[] = [];

    stagedQueue.forEach((item) => {
      for (let i = 0; i < item.count; i++) {
        const evalRes = evaluateMacro(item.macro);
        breakdowns.push(evalRes.breakdownLine);
        rollTotals.push(evalRes.total);
        totalSum += evalRes.total;
        if (evalRes.isD20) hasD20 = true;
        if (evalRes.isCrit) hasCrit = true;
        if (evalRes.isFumble) hasFumble = true;
      }
      comboNames.push(item.count > 1 ? `${item.macro.name} ×${item.count}` : item.macro.name);
    });

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
      {/* 1. QUICK D20 ACTIONS + VISIBILITY SELECTOR */}
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
            Public
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
            GM
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
            Self
          </button>
        </div>
      </div>

      {/* 2. FORMULA BAR & CONTROLS (Calculator icon removed to maximize formula space) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="relative flex items-center h-9 w-full gap-1.5">
          <div className="relative flex-1 h-full flex items-center min-w-0">
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
              className="w-full h-9 px-2.5 pr-7 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 transition placeholder:text-slate-600"
            />
            {formulaInput && (
              <button
                type="button"
                onClick={handleClearFormula}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-amber-300 rounded transition cursor-pointer"
                title="Clear expression & modifier"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                handleExecuteRoll('sum');
                triggerRollFlash('sum');
              }}
              className={`h-9 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-lg shadow-md active:scale-95 transition-transform flex items-center gap-1 cursor-pointer font-sans tracking-wide uppercase ${
                rollFlash === 'sum' ? 'ring-2 ring-white brightness-125 scale-95' : ''
              }`}
              title="Roll sum: Evaluates all dice once and sums grand total"
            >
              <span>🎲</span>
              <span>ROLL SUM</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleExecuteRoll('individual');
                triggerRollFlash('indiv');
              }}
              className={`h-9 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-lg shadow-md border border-indigo-500/30 active:scale-95 transition-transform flex items-center gap-1 cursor-pointer font-sans tracking-wide uppercase ${
                rollFlash === 'indiv' ? 'ring-2 ring-white brightness-125 scale-95' : ''
              }`}
              title="Roll individual: Attacks & checks (flat modifier applied to each d20 roll individually)"
            >
              <span>📊</span>
              <span>ROLL INDIV</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 h-6.5">
          <div className="flex items-center gap-1 shrink-0">
            {INTERACTIVE_DICE.map((die) => {
              const isD20 = die === 'd20';
              return (
                <button
                  key={die}
                  type="button"
                  onClick={() => handleDieButtonClick(die)}
                  className={`h-6 px-1.5 text-xs rounded transition-colors shrink-0 flex items-center justify-center cursor-pointer ${
                    isD20
                      ? 'font-bold bg-amber-950/25 text-amber-400 border border-amber-500/60 hover:bg-amber-900/30'
                      : 'font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                  title={`Add ${die} to formula`}
                >
                  {die}
                </button>
              );
            })}
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setAdvantageMode('advantage')}
              className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
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
              className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
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
              className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
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
      </div>

      {/* 3. PERMANENTLY DOCKED MINI-CALCULATOR */}
      <CalculatorDock
        viewMode={calcMode === 'closed' ? 'docked' : calcMode}
        onChangeViewMode={(mode) => setCalcMode(mode)}
        isOpen={true}
        onApply={handleApplyFromCalculator}
      />

      {/* 4. CUSTOM MACROS DRAWER & QUEUE TRAY */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMacrosOpen(!isMacrosOpen)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Custom Macros</span>
            <span className="text-[10px] text-slate-500 font-mono">
              ({macros.length}
              {totalQueuedCount > 0 && ` · ${totalQueuedCount} staged`})
            </span>
            {isMacrosOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-[10px] shrink-0">
              <button
                type="button"
                onClick={() => setMacroMode('instant')}
                className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                  macroMode === 'instant'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="1-Click Mode: Tap any macro to roll immediately"
              >
                <Zap className="w-2.5 h-2.5" />
                <span>1-Click</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMacroMode('queue');
                  if (!isMacrosOpen) setIsMacrosOpen(true);
                }}
                className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                  macroMode === 'queue'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Queue Mode: Tap macros to stage combo attacks and roll them together"
              >
                <Layers className="w-2.5 h-2.5" />
                <span>Queue</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenAddMacro}
              className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-500/40 transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {isMacrosOpen && (
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pt-0.5">
            {macros.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic py-1">
                No custom macros. Click "+ Add" to save one.
              </div>
            ) : (
              macros.map((m) => {
                const stagedItem = stagedQueue.find((item) => item.macro.id === m.id);
                const isStaged = Boolean(stagedItem);

                return (
                  <div
                    key={m.id}
                    onClick={(e) => (macroMode === 'queue' ? handleStageMacro(m, e) : handleRollMacro(m, e))}
                    className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg border transition cursor-pointer shadow-sm text-xs ${
                      isStaged
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                        : macroMode === 'queue'
                        ? 'bg-slate-950 hover:bg-amber-950/20 border-slate-700 hover:border-amber-400/60'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 hover:border-amber-400/80'
                    }`}
                    title={
                      macroMode === 'queue'
                        ? `Tap to stage "${m.name}" for combo roll`
                        : `1-Click Roll: ${m.name} (${m.formula})`
                    }
                  >
                    <span className="font-semibold text-slate-200 group-hover:text-amber-300 truncate max-w-[90px]">
                      {m.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{m.formula}</span>

                    {m.advantageMode && m.advantageMode !== 'normal' && (
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

                    {isStaged && stagedItem && (
                      <span className="px-1 py-0.2 bg-amber-500 text-slate-950 rounded font-black text-[9px]">
                        ×{stagedItem.count}
                      </span>
                    )}

                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 ml-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditMacro(m, e)}
                        className="p-0.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-700"
                        title="Edit macro"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMacro(m.id, e)}
                        className="p-0.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-700"
                        title="Delete macro"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

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
              {stagedQueue.map((item) => (
                <div
                  key={item.macro.id}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-[11px] text-slate-200"
                >
                  <span className="font-semibold text-amber-300 truncate max-w-[100px]">
                    {item.macro.name}
                  </span>
                  {item.count > 1 && (
                    <span className="px-1 py-0.2 bg-amber-500/30 text-amber-200 rounded font-bold text-[9px]">
                      ×{item.count}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveStagedMacro(item.macro.id, e)}
                    className="p-0.5 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                    title="Remove one from queue"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
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

      {/* 5. ROLL FEED (Immutable Audit Log) */}
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

      {/* 6. MODALS: ADD / EDIT MACRO */}
      <AddCustomMacroModal
        isOpen={isAddMacroOpen && !editingMacro}
        onClose={() => setIsAddMacroOpen(false)}
        initialFormula={formulaInput || '1d20+5'}
        initialMode={advantageMode}
        onSave={({ name, formula, advantageMode }) => {
          const created = addCustomMacro(name, formula, advantageMode, 0);
          setMacros((prev) => [...prev, created]);
        }}
      />

      <EditCustomMacroModal
        isOpen={isAddMacroOpen && Boolean(editingMacro)}
        macro={editingMacro}
        onClose={() => {
          setIsAddMacroOpen(false);
          setEditingMacro(null);
        }}
        onSave={({ id, name, formula, advantageMode }) => {
          const updated = updateCustomMacro(id, {
            name,
            formula,
            advantageMode,
          });
          setMacros(updated);
        }}
      />
    </div>
  );
};

export default DiceChamber;
