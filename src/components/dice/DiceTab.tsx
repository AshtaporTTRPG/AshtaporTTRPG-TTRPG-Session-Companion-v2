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
  combineFormulaWithModifier,
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
  Calculator,
} from 'lucide-react';
import { AddCustomMacroModal } from './AddCustomMacroModal';
import { EditCustomMacroModal } from './EditCustomMacroModal';
import { RollFeedCard } from './RollFeedCard';
import { CalculatorDock } from './CalculatorDock';

export interface DiceTabProps {
  isDm: boolean;
  playerName?: string;
}

const INTERACTIVE_DICE: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export const DiceTab: React.FC<DiceTabProps> = ({ isDm, playerName }) => {
  const rollerName = playerName?.trim() || (isDm ? 'Game Master' : 'Adventurer');

  // Input & Formula State
  const [formulaInput, setFormulaInput] = useState<string>('1d20+5');
  const [advantageMode, setAdvantageMode] = useState<'advantage' | 'normal' | 'disadvantage'>('normal');
  const [modifier, setModifier] = useState<number>(5);
  const [visibility, setVisibility] = useState<RollVisibility>('public');

  // Inline Docked Calculator State (collapsible, placed directly above Custom Macros)
  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);

  // Custom Macros State (collapsed by default to maximize roll feed space)
  const [macros, setMacros] = useState<CustomMacro[]>(() => loadCustomMacros());
  const [isMacrosOpen, setIsMacrosOpen] = useState<boolean>(false);
  const [editingMacro, setEditingMacro] = useState<CustomMacro | null>(null);
  const [isAddMacroOpen, setIsAddMacroOpen] = useState<boolean>(false);

  // Dice History Feed State
  const [rollHistory, setRollHistory] = useState<DiceRollResult[]>(() => {
    const feed = liveFeedSync.getFeed();
    const list: DiceRollResult[] = [];
    for (let i = feed.length - 1; i >= 0; i--) {
      const item = feed[i];
      if (item.type === 'dice' && item.rollDetails) {
        list.push({
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
    return list.slice(0, 40);
  });

  // Sync with live feed strictly through liveFeedSync subscriber
  useEffect(() => {
    const unsub = liveFeedSync.subscribe((items) => {
      if (items.length === 0) {
        setRollHistory([]);
        return;
      }
      const diceRolls: DiceRollResult[] = [];
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
      setRollHistory(diceRolls.slice(0, 40));
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

  // Sync typed formula input with modifier
  const handleFormulaInputChange = (text: string) => {
    setFormulaInput(text);
    const parsed = parseDiceFormula(text);
    if (parsed) {
      setModifier(parsed.modifier);
    } else if (!text.trim()) {
      setModifier(0);
    }
  };

  // Apply result from Math Calculator directly to formula
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

  // CLEAR STAGED FORMULA & RESET MODIFIER
  const handleClearFormula = () => {
    setFormulaInput('');
    setModifier(0);
  };

  // STAGE POOL BUTTON CLICK: Appends die or increments count in staged pool
  const handleDieButtonClick = (die: DieType) => {
    setFormulaInput((prev) => addDieToFormula(prev, die));
  };

  // EXECUTE ROLL (Normalized non-cloning tabletop evaluation)
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
      // Fallback: roll 1d20 with modifier
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

  // 1-TAP ISOLATED QUICK D20 ROLL (Sandboxed: completely ignores staged formula, modifier, dice)
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

  // REROLL FROM FEED CARD
  const handleReroll = (roll: DiceRollResult, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let pool = roll.poolBreakdown?.map((pb) => ({
      diceType: pb.dieType,
      count: pb.rolls.length,
    }));

    if (!pool || pool.length === 0) {
      if (roll.formula) {
        const parsed = parseDiceFormula(roll.formula);
        if (parsed) pool = parsed.pool;
      }
    }

    const currentUserId = liveFeedSync.getPlayerId();
    const result = executeDiceRoll({
      pool,
      diceType: roll.diceType,
      count: roll.count,
      modifier: roll.modifier,
      advantageMode: roll.advantageMode || 'normal',
      displayMode: roll.displayMode || 'sum',
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility: roll.visibility || 'public',
      label: roll.label,
      macroName: roll.macroName,
    });

    liveFeedSync.recordDiceRoll(result, true);
  };

  // ROLL CUSTOM MACRO (Universal formula parsing with regex ^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$)
  const handleRollMacro = (macro: CustomMacro, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Map advantage/rollMode strictly from the macro
    let activeAdvMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
    const rawMode = (macro as any).rollMode || macro.advantageMode;
    if (rawMode === 'advantage' || rawMode === 'Adv' || rawMode === 'adv') {
      activeAdvMode = 'advantage';
    } else if (rawMode === 'disadvantage' || rawMode === 'Dis' || rawMode === 'dis') {
      activeAdvMode = 'disadvantage';
    }

    const expr = macro.formula.trim();
    if (!expr) return;

    const currentUserId = liveFeedSync.getPlayerId();
    const parsedMacro = parseMacroFormula(expr);

    if (parsedMacro) {
      const { count, sides, modifier: macroMod, dieType } = parsedMacro;

      if (activeAdvMode === 'advantage' || activeAdvMode === 'disadvantage') {
        const valA = rollSingleDie(sides);
        const valB = rollSingleDie(sides);
        const isAdv = activeAdvMode === 'advantage';
        const winningFace = isAdv ? Math.max(valA, valB) : Math.min(valA, valB);
        const discardedFace = isAdv ? Math.min(valA, valB) : Math.max(valA, valB);
        const total = winningFace + macroMod;
        const isCrit = sides === 20 && winningFace === 20;
        const isFumble = sides === 20 && winningFace === 1;

        const modStr = macroMod !== 0 ? (macroMod > 0 ? ` + ${macroMod}` : ` - ${Math.abs(macroMod)}`) : '';
        const breakdownLine = `${count}d${sides} (${isAdv ? 'Adv' : 'Dis'}): [${winningFace}, ~~${discardedFace}~~]${modStr} = ${total}`;

        const result: DiceRollResult = {
          id: `roll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
          sender: rollerName,
          rollerName,
          rollerId: currentUserId,
          isDm,
          visibility,
          rollType: 'Straight roll',
          diceType: dieType || 'd20',
          count: 1,
          modifier: macroMod,
          rolls: [winningFace],
          rawRolls: [valA, valB],
          pairedRolls: [
            {
              pairIndex: 1,
              die1: valA,
              die2: valB,
              selected: winningFace,
              discarded: discardedFace,
              modifier: macroMod,
              totalWithModifier: total,
              lineItem: `[${winningFace}, ~~${discardedFace}~~]${modStr}`,
            },
          ],
          total,
          advantageMode: activeAdvMode,
          breakdown: [breakdownLine],
          formula: `${expr} (${isAdv ? 'Advantage' : 'Disadvantage'})`,
          label: macro.name,
          macroName: macro.name,
          isCrit,
          isFumble,
          displayMode: 'sum',
        };

        liveFeedSync.recordDiceRoll(result, true);
        return;
      }

      const result = executeDiceRoll({
        diceType: dieType || 'd20',
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
        macroName: macro.name,
      });

      liveFeedSync.recordDiceRoll(result, true);
      return;
    }

    // Fallback if multi-pool formula (e.g. 2d20+1d8+5)
    const parsed = parseDiceFormula(expr);
    const finalMacroModifier = parsed ? parsed.modifier : 0;

    const result = executeDiceRoll({
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
      macroName: macro.name,
    });

    liveFeedSync.recordDiceRoll(result, true);
  };

  // MACRO MODAL CONTROLS
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
  };

  // CLEAR FEED
  const handleClearFeed = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    liveFeedSync.clearFeed();
    setRollHistory([]);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#0b0f17] select-none p-2 gap-2 text-slate-100">
      {/* 1. ROW 1: QUICK D20 MICRO-LABEL & SANDBOXED ACTIONS + VISIBILITY SELECTOR */}
      <div className="flex items-center justify-between gap-1.5 shrink-0 px-0.5">
        {/* Left: Quick D20 Section */}
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

        {/* Right: Visibility Selector [ Public | GM | Self ] */}
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

      {/* 2. COMPACT CONTROLS AREA (Formula Bar + Equalized Roll Buttons + Polyhedrals) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        {/* Row 2: Formula Bar with Calculator Toggle & Equalized Roll Buttons */}
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
              className="w-full h-9 px-2.5 pr-14 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 transition placeholder:text-slate-600"
            />
            <div className="absolute right-1 flex items-center gap-0.5">
              {formulaInput && (
                <button
                  type="button"
                  onClick={handleClearFormula}
                  className="p-1 text-slate-400 hover:text-amber-300 rounded transition cursor-pointer"
                  title="Clear expression & modifier"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCalcOpen((prev) => !prev)}
                className={`p-1 rounded transition cursor-pointer ${
                  isCalcOpen
                    ? 'text-amber-400 bg-slate-800 ring-1 ring-amber-400/50'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                }`}
                title="Toggle Quick Math Calculator"
                aria-label="Toggle Quick Math Calculator"
              >
                <Calculator className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Equalized Roll Action Triggers: [ 🎲 ROLL SUM ] & [ 📊 ROLL INDIV ] */}
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
              title="Roll sum: Evaluates all dice once and sums grand total (Skill Challenges & Damage Pools)"
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

        {/* Row 3: Polyhedrals (Left) + D20 Roll Mode (Right: Adv | Straight | Dis) */}
        <div className="flex items-center justify-between gap-1 h-6.5">
          {/* Left: Polyhedral Chips */}
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

          {/* Right: D20 Roll Mode Segmented Control [ Adv | Straight | Dis ] */}
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

      {/* 3. INLINE DOCKED CALCULATOR (Docked directly above Custom Macros, zero screen blocking) */}
      {isCalcOpen && (
        <CalculatorDock
          isOpen={isCalcOpen}
          onClose={() => setIsCalcOpen(false)}
          onApply={handleApplyFromCalculator}
        />
      )}

      {/* 4. CUSTOM MACROS DRAWER (Collapsed by default to maximize roll history) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMacrosOpen(!isMacrosOpen)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Custom Macros</span>
            <span className="text-[10px] text-slate-500 font-mono">({macros.length})</span>
            {isMacrosOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenAddMacro}
            className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-500/40 transition cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Add Macro</span>
          </button>
        </div>

        {isMacrosOpen && (
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
            {macros.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic py-1">
                No custom macros. Click "+ Add Macro" to save one.
              </div>
            ) : (
              macros.map((m) => (
                <div
                  key={m.id}
                  onClick={(e) => handleRollMacro(m, e)}
                  className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/80 transition cursor-pointer shadow-sm text-xs"
                  title={`1-Click Roll: ${m.name} (${m.formula})`}
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
              ))
            )}
          </div>
        )}
      </div>

      {/* 5. ROLL FEED (Expanded with maximized vertical space) */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/60 p-2 flex flex-col gap-2">
        {/* Roll Feed Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-slate-200 font-display">Roll Feed</span>
            <span className="text-[10px] text-slate-400 font-mono">({rollHistory.length})</span>
          </div>
          {rollHistory.length > 0 && (
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

        {/* Scrollable Feed Container */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {rollHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
              <p className="text-xs">No recent rolls.</p>
              <span className="text-[10px] text-slate-600">
                Roll attack batches, damage expressions, or custom macros above
              </span>
            </div>
          ) : (
            rollHistory.map((roll) => {
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
                        {roll.rollerName || roll.sender} made a secret roll to the DM 🔒
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
                  onReroll={handleReroll}
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

export default DiceTab;
