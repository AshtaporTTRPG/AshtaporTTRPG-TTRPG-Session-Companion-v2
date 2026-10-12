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
  addDieToFormula,
  setFormulaModifier,
  combineFormulaWithModifier,
} from '../../utils/dice';
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
  Minus,
  Plus,
  RotateCcw,
  Edit2,
  Trash2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

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
  const [displayMode, setDisplayMode] = useState<RollDisplayMode>('sum');
  const [modifier, setModifier] = useState<number>(5);
  const [visibility, setVisibility] = useState<RollVisibility>('public');

  // Custom Macros State (collapsed by default to maximize roll feed space)
  const [macros, setMacros] = useState<CustomMacro[]>(() => loadCustomMacros());
  const [isMacrosOpen, setIsMacrosOpen] = useState<boolean>(false);
  const [editingMacro, setEditingMacro] = useState<CustomMacro | null>(null);
  const [isAddMacroOpen, setIsAddMacroOpen] = useState<boolean>(false);
  const [macroName, setMacroName] = useState<string>('');
  const [macroFormula, setMacroFormula] = useState<string>('1d20+5');
  const [macroMode, setMacroMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [macroMod, setMacroMod] = useState<number>(0);

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
          });
        }
      }
      setRollHistory(diceRolls.slice(0, 40));
    });
    return () => unsub();
  }, []);

  // Sync typed formula input with modifier stepper
  const handleFormulaInputChange = (text: string) => {
    setFormulaInput(text);
    const parsed = parseDiceFormula(text);
    if (parsed) {
      setModifier(parsed.modifier);
    } else if (!text.trim()) {
      setModifier(0);
    }
  };

  // STEP MODIFIER (Syncs with input formula)
  const handleModifierStep = (delta: number) => {
    const newMod = modifier + delta;
    setModifier(newMod);
    setFormulaInput((prev) => setFormulaModifier(prev, newMod));
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

  // EXECUTE ROLL (Dispatches via liveFeedSync with multi-instance payload evaluation)
  const handleExecuteRoll = (
    customExpr?: string,
    customMode?: 'normal' | 'advantage' | 'disadvantage',
    customMod?: number,
    customDisplay?: RollDisplayMode
  ) => {
    const expr = (customExpr !== undefined ? customExpr : formulaInput).trim();
    if (!expr) return;

    const currentUserId = liveFeedSync.getPlayerId();
    const parsed = parseDiceFormula(expr);
    const activeAdvMode = customMode !== undefined ? customMode : advantageMode;
    const finalMod = customMod !== undefined ? customMod : (parsed ? parsed.modifier : modifier);
    const activeDisplay = customDisplay !== undefined ? customDisplay : displayMode;

    if (!parsed) {
      // Fallback: roll 1d20 with modifier
      const fallback = executeDiceRoll({
        diceType: 'd20',
        count: 1,
        advantageMode: activeAdvMode,
        displayMode: activeDisplay,
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
      displayMode: activeDisplay,
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      label: expr,
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
    });

    liveFeedSync.recordDiceRoll(result, true);
  };

  // ROLL CUSTOM MACRO
  const handleRollMacro = (macro: CustomMacro, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const mode = macro.advantageMode || 'normal';

    if (modifier !== 0) {
      const { formula: combinedFormula, combinedModifier } = combineFormulaWithModifier(
        macro.formula,
        modifier
      );
      setFormulaInput(combinedFormula);
      handleExecuteRoll(combinedFormula, mode, combinedModifier);
    } else {
      setFormulaInput(macro.formula);
      handleExecuteRoll(macro.formula, mode, macro.modifier ?? 0);
    }
  };

  // MACRO MODAL CONTROLS
  const handleOpenAddMacro = () => {
    setEditingMacro(null);
    setMacroName('');
    setMacroFormula(formulaInput || '1d20+5');
    setMacroMode(advantageMode);
    setMacroMod(modifier);
    setIsAddMacroOpen(true);
  };

  const handleOpenEditMacro = (m: CustomMacro, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMacro(m);
    setMacroName(m.name);
    setMacroFormula(m.formula);
    setMacroMode(m.advantageMode || 'normal');
    setMacroMod(m.modifier ?? 0);
    setIsAddMacroOpen(true);
  };

  const handleSaveMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!macroName.trim() || !macroFormula.trim()) return;

    if (editingMacro) {
      const updated = updateCustomMacro(editingMacro.id, {
        name: macroName.trim(),
        formula: macroFormula.trim(),
        advantageMode: macroMode,
        modifier: macroMod,
      });
      setMacros(updated);
    } else {
      const created = addCustomMacro(
        macroName.trim(),
        macroFormula.trim(),
        macroMode,
        macroMod
      );
      setMacros((prev) => [...prev, created]);
    }
    setIsAddMacroOpen(false);
    setEditingMacro(null);
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

  const formattedMod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '+0';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#0b0f17] select-none p-2 gap-2 text-slate-100">
      {/* 1. COMPACT TOP VISIBILITY STRIP */}
      <div className="flex items-center justify-between px-0.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Dices className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold font-display text-slate-200">Dice Chamber</h2>
          <span className="text-[10px] text-amber-400/80 font-mono px-1 py-0.2 bg-amber-400/10 rounded border border-amber-400/20">
            v2.0.8
          </span>
        </div>

        {/* 3-way Roll Visibility */}
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[10px]">
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
            GM Only
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

      {/* 2. COMPACT CONTROLS AREA (Optimized for 480px Popover) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        {/* Row A: Top Input Bar (h-8) with single-click ✕ clear button & Quick Roll */}
        <div className="relative flex items-center h-8 w-full gap-1.5">
          <div className="relative flex-1 h-full flex items-center">
            <input
              type="text"
              value={formulaInput}
              onChange={(e) => handleFormulaInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleExecuteRoll();
                }
              }}
              placeholder="e.g. 1d20+5, 2d20 + 1d8 + 5"
              className="w-full h-8 px-2.5 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 transition pr-7 placeholder:text-slate-600"
            />
            {formulaInput && (
              <button
                type="button"
                onClick={handleClearFormula}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-amber-300 rounded transition cursor-pointer"
                title="Clear expression, staged pool & modifier"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleExecuteRoll()}
            className="h-8 px-3 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition shadow cursor-pointer shrink-0 flex items-center gap-1 font-display"
            title="Roll dice expression"
          >
            Roll
          </button>
        </div>

        {/* Row B: Stage Pool Buttons: Compact pills (h-6 px-1.5 text-xs) */}
        <div className="flex items-center justify-between gap-1 w-full pt-0.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0 font-semibold">
            Stage:
          </span>
          <div className="flex items-center gap-1 flex-1 justify-end overflow-x-auto">
            {INTERACTIVE_DICE.map((die) => (
              <button
                key={die}
                type="button"
                onClick={() => handleDieButtonClick(die)}
                className="h-6 px-1.5 text-xs font-mono font-bold rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/80 text-amber-300 hover:text-amber-200 transition cursor-pointer shadow-sm shrink-0 flex items-center justify-center"
                title={`Add ${die} to formula`}
              >
                +{die}
              </button>
            ))}
          </div>
        </div>

        {/* Row C: Modifier & Mode Bar (Syncs with input expression) */}
        <div className="flex items-center justify-between gap-1.5 w-full pt-0.5 flex-wrap">
          {/* Synced Modifier Stepper */}
          <div className="flex items-center gap-0.5 bg-slate-950 rounded-md border border-slate-800 px-1 h-8 shrink-0">
            <span className="text-[10px] text-slate-400 font-semibold px-0.5 uppercase">Mod</span>
            <button
              type="button"
              onClick={() => handleModifierStep(-1)}
              className="w-5 h-6 rounded text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="Decrease modifier (-1)"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-mono font-bold text-amber-300 min-w-[24px] text-center tabular-nums">
              {formattedMod}
            </span>
            <button
              type="button"
              onClick={() => handleModifierStep(1)}
              className="w-5 h-6 rounded text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="Increase modifier (+1)"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Segmented [Adv | Straight | Dis] */}
          <div className="flex items-center p-0.5 bg-slate-950 rounded-md border border-slate-800 h-8 shrink-0">
            <button
              type="button"
              onClick={() => setAdvantageMode('advantage')}
              className={`h-6 px-2 text-[11px] font-semibold rounded transition cursor-pointer ${
                advantageMode === 'advantage'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Advantage: Roll 2d20, keep highest"
            >
              Adv
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('normal')}
              className={`h-6 px-2 text-[11px] font-semibold rounded transition cursor-pointer ${
                advantageMode === 'normal'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Straight roll"
            >
              Straight
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('disadvantage')}
              className={`h-6 px-2 text-[11px] font-semibold rounded transition cursor-pointer ${
                advantageMode === 'disadvantage'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Disadvantage: Roll 2d20, keep lowest"
            >
              Dis
            </button>
          </div>

          {/* Segmented [Sum | Indiv] */}
          <div className="flex items-center p-0.5 bg-slate-950 rounded-md border border-slate-800 h-8 shrink-0">
            <button
              type="button"
              onClick={() => setDisplayMode('sum')}
              className={`h-6 px-2 text-[11px] font-semibold rounded transition cursor-pointer ${
                displayMode === 'sum'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sum: Combine total of all roll instances"
            >
              Sum
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('individual')}
              className={`h-6 px-2 text-[11px] font-semibold rounded transition cursor-pointer ${
                displayMode === 'individual'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Indiv: Individual line item outputs without grand total"
            >
              Indiv
            </button>
          </div>
        </div>
      </div>

      {/* 3. CUSTOM MACROS DRAWER (Collapsed by default to maximize roll history) */}
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

      {/* 4. ROLL FEED (Expanded with maximized vertical space) */}
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

              const hasInstances = roll.instances && roll.instances.length > 0;

              return (
                <div
                  key={roll.id}
                  className={`bg-slate-900/90 border rounded-lg p-2 text-xs select-none shadow-sm transition space-y-1.5 ${
                    roll.isCrit
                      ? 'border-emerald-500/80 bg-emerald-950/15 ring-1 ring-emerald-500/30'
                      : roll.isFumble
                      ? 'border-rose-600/80 bg-rose-950/15 ring-1 ring-rose-500/30'
                      : isGmOnly
                      ? 'border-purple-800/60 bg-purple-950/20'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Header Row: Flex row with Roller name + Expression on left, Bold Total + RotateCcw on right */}
                  <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-800/80">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="font-bold text-slate-200 truncate max-w-[100px]"
                        title={roll.rollerName || roll.sender}
                      >
                        {roll.rollerName || roll.sender}
                      </span>
                      <span
                        className="text-[11px] text-slate-400 font-mono truncate"
                        title={roll.formula || `${roll.count}${roll.diceType}`}
                      >
                        {roll.formula || `${roll.count}${roll.diceType}`}
                      </span>
                      {isGmOnly && (
                        <span className="text-[9px] text-purple-300 font-semibold px-1 py-0.2 rounded bg-purple-950/80 border border-purple-700/70 shrink-0 inline-flex items-center gap-0.5">
                          🔒 GM
                        </span>
                      )}
                      {roll.visibility === 'self' && (
                        <span className="text-[9px] text-slate-400 font-semibold px-1 py-0.2 rounded bg-slate-800 border border-slate-700 shrink-0">
                          Self
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Bold amber/gold total / results */}
                      <span className="font-mono font-bold text-amber-300 text-xs tabular-nums">
                        {roll.displayMode === 'individual'
                          ? `Results: ${
                              hasInstances
                                ? roll.instances!.map((i) => i.total).join(', ')
                                : roll.rolls.join(', ')
                            }`
                          : `Total: ${roll.total}`}
                      </span>

                      {/* Compact RotateCcw re-roll icon button */}
                      <button
                        type="button"
                        onClick={(e) => handleReroll(roll, e)}
                        className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                        title="Reroll"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Body: Multi-Instance Rows or Pure Damage Breakdown */}
                  {hasInstances ? (
                    <div className="space-y-1 pt-0.5">
                      {roll.instances!.map((inst) => (
                        <div
                          key={inst.index}
                          className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded bg-slate-950/60 border border-slate-800/60 text-xs"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-slate-400 font-semibold text-[11px] shrink-0">
                              Roll {inst.index}:
                            </span>

                            {/* Boxed d20 badge */}
                            <span className="bg-slate-800 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-slate-700 font-mono tabular-nums shrink-0 inline-flex items-center gap-1">
                              <span>{inst.d20Chosen}</span>
                              {inst.d20Discarded !== undefined && (
                                <>
                                  <span className="text-slate-600">,</span>
                                  <span className="line-through text-slate-500 font-normal">
                                    {inst.d20Discarded}
                                  </span>
                                </>
                              )}
                            </span>

                            {/* Crit badge */}
                            {inst.isCrit && (
                              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-1 font-black rounded uppercase shrink-0">
                                CRIT
                              </span>
                            )}

                            {/* Fumble badge */}
                            {inst.isFumble && (
                              <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] px-1 font-black rounded uppercase shrink-0">
                                FUMBLE
                              </span>
                            )}

                            {/* Rider dice notation */}
                            {inst.riders.map((r, rIdx) => (
                              <span key={rIdx} className="text-slate-300 font-mono text-[11px] shrink-0">
                                + {r.count}{r.diceType}[{r.rolls.join(', ')}]
                              </span>
                            ))}

                            {/* Modifier notation */}
                            {inst.modifier !== 0 && (
                              <span className="text-slate-400 font-mono text-[11px] shrink-0">
                                {inst.modifier > 0
                                  ? `+ ${inst.modifier}`
                                  : `- ${Math.abs(inst.modifier)}`}
                              </span>
                            )}
                          </div>

                          {/* Instance subtotal: Bold right-aligned value in bright yellow/gold */}
                          <span className="text-amber-300 font-bold font-mono text-xs tabular-nums shrink-0 ml-auto pl-1">
                            = {inst.total}
                          </span>
                        </div>
                      ))}

                      {/* Sum Mode Footer */}
                      {roll.displayMode === 'sum' && (
                        <div className="pt-1 mt-1 border-t border-slate-800 flex items-center justify-between font-bold text-amber-300 text-xs">
                          <span>Combined Total:</span>
                          <span className="font-mono tabular-nums text-sm">{roll.total}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Pure damage or legacy fallback */
                    <div className="pt-0.5 space-y-1 text-[11px] font-mono">
                      {roll.breakdown && roll.breakdown.length > 0 ? (
                        roll.breakdown
                          .filter((line) => !line.startsWith('Total:'))
                          .map((line, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/60"
                            >
                              <span>{line}</span>
                            </div>
                          ))
                      ) : (
                        <div className="text-slate-400">
                          Rolls: [{roll.rolls.join(', ')}]
                          {roll.modifier !== 0 &&
                            ` (${roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier})`}
                        </div>
                      )}

                      {roll.displayMode === 'sum' && (
                        <div className="pt-1 mt-1 border-t border-slate-800 flex items-center justify-between font-bold text-amber-300 text-xs">
                          <span>Combined Total:</span>
                          <span className="font-mono tabular-nums text-sm">{roll.total}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. MODAL: ADD / EDIT MACRO */}
      {isAddMacroOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>{editingMacro ? 'Edit Macro' : 'Add Custom Macro'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddMacroOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveMacro} className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                  Macro Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Greatsword Attack, Sneak Attack"
                  value={macroName}
                  onChange={(e) => setMacroName(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                  Formula *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1d20+5, 2d20+1d8+5, 8d6"
                  value={macroFormula}
                  onChange={(e) => setMacroFormula(e.target.value)}
                  className="w-full px-2 py-1 font-mono rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                    Roll Mode
                  </label>
                  <select
                    value={macroMode}
                    onChange={(e) => setMacroMode(e.target.value as any)}
                    className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200"
                  >
                    <option value="normal">Straight</option>
                    <option value="advantage">Advantage</option>
                    <option value="disadvantage">Disadvantage</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                    Modifier
                  </label>
                  <input
                    type="number"
                    value={macroMod}
                    onChange={(e) => setMacroMod(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-1.5 py-1 font-mono rounded bg-slate-950 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMacroOpen(false)}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer"
                >
                  {editingMacro ? 'Save Changes' : 'Create Macro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiceTab;
