import React, { useState, useEffect } from 'react';
import {
  DiceRollResult,
  DieType,
  RollVisibility,
  RollDisplayMode,
  PairedD20Roll,
  CustomMacro,
} from '../types/ttrpg';
import {
  executeDiceRoll,
  parseDiceFormula,
  addDieToFormula,
  setFormulaModifier,
  combineFormulaWithModifier,
} from '../utils/dice';
import { liveFeedSync } from '../utils/liveFeedSync';
import {
  loadCustomMacros,
  addCustomMacro,
  updateCustomMacro,
  deleteCustomMacro,
} from '../utils/macroStorage';
import {
  Dices,
  Sparkles,
  Minus,
  Plus,
  RotateCcw,
  Zap,
  Edit2,
  Trash2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  X,
  Check,
} from 'lucide-react';

interface DiceChamberProps {
  isDm: boolean;
  playerName?: string;
}

const INTERACTIVE_DICE: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export const DiceChamber: React.FC<DiceChamberProps> = ({ isDm, playerName }) => {
  const rollerName = playerName?.trim() || (isDm ? 'Game Master' : 'Adventurer');

  // Row 1: Formula Bar State
  const [formulaInput, setFormulaInput] = useState<string>('1d20+5');

  // Row 2: Multi-D20 Engine State
  const [count, setCount] = useState<number>(1);
  const [advantageMode, setAdvantageMode] = useState<'advantage' | 'normal' | 'disadvantage'>('normal');
  const [displayMode, setDisplayMode] = useState<RollDisplayMode>('sum');
  const [modifier, setModifier] = useState<number>(0);
  const [visibility, setVisibility] = useState<RollVisibility>('public');

  // Custom Macros State
  const [macros, setMacros] = useState<CustomMacro[]>(() => loadCustomMacros());
  const [isMacrosOpen, setIsMacrosOpen] = useState<boolean>(true);
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
          });
        }
      }
      setRollHistory(diceRolls.slice(0, 40));
    });
    return () => unsub();
  }, []);

  // EXECUTE MULTI-D20 ROLL (Prevent double dispatch)
  const handleRollMultiD20 = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    const currentUserId = liveFeedSync.getPlayerId();
    const result = executeDiceRoll({
      diceType: 'd20',
      count,
      advantageMode,
      displayMode,
      modifier,
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      rollType: 'Straight roll',
      label: count > 1 ? `Multi-D20 (${count}d20)` : 'd20 Roll',
    });

    // Sole dispatcher: liveFeedSync notifies listeners, updating rollHistory with deduplication
    liveFeedSync.recordDiceRoll(result, true);
  };

  // EXECUTE FORMULA ROLL (Respects Advantage/Straight/Disadvantage toggle for d20s)
  const handleRollFormula = (customExpr?: string, customMode?: 'normal' | 'advantage' | 'disadvantage', customMod?: number) => {
    const expr = customExpr !== undefined ? customExpr : formulaInput;
    if (!expr.trim()) return;

    const currentUserId = liveFeedSync.getPlayerId();
    const parsed = parseDiceFormula(expr);
    const activeAdvMode = customMode !== undefined ? customMode : advantageMode;
    const finalMod = customMod !== undefined ? customMod : (parsed ? parsed.modifier : modifier);

    if (!parsed) {
      // Fallback: roll 1d20 with modifier
      const fallback = executeDiceRoll({
        diceType: 'd20',
        count: 1,
        advantageMode: activeAdvMode,
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
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility,
      label: expr,
    });

    liveFeedSync.recordDiceRoll(result, true);
  };

  // INTERACTIVE DICE STAGING: Appends die or increments count in staged pool without rolling
  const handleDieButtonClick = (die: DieType) => {
    setFormulaInput((prev) => addDieToFormula(prev, die));
  };

  // CLEAR STAGED FORMULA
  const handleClearFormula = () => {
    setFormulaInput('');
    setModifier(0);
  };

  // STEP MODIFIER (Syncs with formula)
  const handleModifierStep = (delta: number) => {
    const newMod = modifier + delta;
    setModifier(newMod);
    setFormulaInput((prev) => setFormulaModifier(prev, newMod));
  };

  // ROLL CUSTOM MACRO: Combines staged tray modifier with macro formula
  const handleRollMacro = (macro: CustomMacro, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const mode = macro.advantageMode || 'normal';

    // If active modifier is not 0, combine staged UI modifier with the macro formula
    // (e.g. 2d6+2 with active mod +3 evaluates as 2d6 + 5; 1d20 with active mod +4 evaluates as 1d20 + 4)
    if (modifier !== 0) {
      const { formula: combinedFormula, combinedModifier } = combineFormulaWithModifier(
        macro.formula,
        modifier
      );
      setFormulaInput(combinedFormula);
      handleRollFormula(combinedFormula, mode, combinedModifier);
    } else {
      setFormulaInput(macro.formula);
      handleRollFormula(macro.formula, mode, macro.modifier ?? 0);
    }
  };

  // OPEN ADD MACRO FORM
  const handleOpenAddMacro = () => {
    setEditingMacro(null);
    setMacroName('');
    setMacroFormula(formulaInput || '1d20+5');
    setMacroMode(advantageMode);
    setMacroMod(modifier);
    setIsAddMacroOpen(true);
  };

  // OPEN EDIT MACRO FORM
  const handleOpenEditMacro = (m: CustomMacro, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMacro(m);
    setMacroName(m.name);
    setMacroFormula(m.formula);
    setMacroMode(m.advantageMode || 'normal');
    setMacroMod(m.modifier ?? 0);
    setIsAddMacroOpen(true);
  };

  // SAVE MACRO (ADD OR EDIT)
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

  // DELETE MACRO
  const handleDeleteMacro = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomMacro(id);
    setMacros(updated);
  };

  // RELIABLE CLEAR FEED
  const handleClearFeed = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    liveFeedSync.clearFeed();
    setRollHistory([]);
  };

  // Format modifier string
  const formattedMod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '+0';

  // Dynamic Action Label based on active selections
  const getDynamicRollLabel = () => {
    let modeTag = '';
    if (advantageMode === 'advantage') {
      modeTag = ' (Adv)';
    } else if (advantageMode === 'disadvantage') {
      modeTag = ' (Dis)';
    } else if (count > 1) {
      modeTag = displayMode === 'individual' ? ' (Indiv)' : ' (Sum)';
    }

    let modTag = '';
    if (modifier > 0) {
      modTag = ` + ${modifier}`;
    } else if (modifier < 0) {
      modTag = ` - ${Math.abs(modifier)}`;
    }

    return `🎲 Roll ${count}d20${modeTag}${modTag}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#0b0f17] select-none p-1.5 gap-2">
      {/* 1. COMPACT TOP VISIBILITY STRIP */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <Dices className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold font-display text-slate-200">Dice Tray</h2>
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

      {/* 2. ROW 1: FORMULA BAR & INTERACTIVE DICE ROW */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          {/* Formula Text Input with clear button */}
          <div className="relative flex-1 min-w-0 flex items-center">
            <input
              type="text"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRollFormula();
                }
              }}
              placeholder="e.g. 1d8 + 1d6 + 1d4 + 4"
              className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 transition pr-6"
            />
            {formulaInput && (
              <button
                type="button"
                onClick={handleClearFormula}
                className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-200 transition"
                title="Clear formula"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Roll Button */}
          <button
            type="button"
            onClick={() => handleRollFormula()}
            className="h-7 px-3 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition shadow cursor-pointer shrink-0"
          >
            Roll
          </button>
        </div>

        {/* Interactive Dice Selection Button Row: [d4] [d6] [d8] [d10] [d12] [d20] [d100] */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0 font-semibold">
            Stage Pool:
          </span>
          <div className="flex items-center gap-1 flex-1 justify-end overflow-x-auto">
            {INTERACTIVE_DICE.map((die) => (
              <button
                key={die}
                type="button"
                onClick={() => handleDieButtonClick(die)}
                className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-amber-300 hover:text-amber-200 transition cursor-pointer shadow-sm shrink-0"
                title={`Click to append or increment ${die} in staged pool`}
              >
                +{die}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. MULTI-D20 PANEL: 2-ROW CONSOLIDATION (OPTION 2) */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-2.5 flex flex-col gap-2 shrink-0 shadow-sm">
        {/* Row 1: Dice & State (Quantity + Advantage + Output Mode) */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          {/* Quantity Stepper */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCount((prev) => Math.max(1, prev - 1))}
              className="w-7 h-7 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition cursor-pointer"
              title="Decrease dice count"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-amber-400 text-sm px-1 min-w-[20px] text-center tabular-nums">
              {count}
            </span>
            <button
              type="button"
              onClick={() => setCount((prev) => Math.min(10, prev + 1))}
              className="w-7 h-7 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition cursor-pointer"
              title="Increase dice count"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-neutral-400 font-semibold ml-1">d20</span>
          </div>

          {/* Advantage / Disadvantage Mode Segment */}
          <div className="flex items-center p-0.5 bg-neutral-950/80 rounded-md border border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={() => setAdvantageMode('advantage')}
              className={`py-1 px-2 text-[11px] font-medium rounded transition text-center cursor-pointer ${
                advantageMode === 'advantage'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Advantage: Roll pairs and keep highest"
            >
              Adv
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('normal')}
              className={`py-1 px-2 text-[11px] font-medium rounded transition text-center cursor-pointer ${
                advantageMode === 'normal'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Straight roll"
            >
              Straight
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('disadvantage')}
              className={`py-1 px-2 text-[11px] font-medium rounded transition text-center cursor-pointer ${
                advantageMode === 'disadvantage'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Disadvantage: Roll pairs and keep lowest"
            >
              Dis
            </button>
          </div>

          {/* Output Mode Segment */}
          <div className="flex items-center p-0.5 bg-neutral-950/80 rounded-md border border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={() => setDisplayMode('sum')}
              className={`py-1 px-2 text-[11px] font-medium rounded transition text-center cursor-pointer ${
                displayMode === 'sum'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Sum: Grand total all dice"
            >
              Sum
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('individual')}
              className={`py-1 px-2 text-[11px] font-medium rounded transition text-center cursor-pointer ${
                displayMode === 'individual'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Indiv: Individual line item outputs without grand total"
            >
              Indiv
            </button>
          </div>
        </div>

        {/* Row 2: Flat Math & Fire (Modifier + Dynamic Primary Action Button) */}
        <div className="flex items-center gap-2 w-full">
          {/* Modifier Stepper */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-neutral-400 font-medium">Mod:</span>
            <button
              type="button"
              onClick={() => handleModifierStep(-1)}
              className="w-7 h-7 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition cursor-pointer"
              title="Decrease modifier"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-neutral-200 min-w-[28px] text-center tabular-nums">
              {formattedMod}
            </span>
            <button
              type="button"
              onClick={() => handleModifierStep(1)}
              className="w-7 h-7 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition cursor-pointer"
              title="Increase modifier"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Roll Button */}
          <button
            type="button"
            onClick={handleRollMultiD20}
            className="flex-1 h-9 py-1.5 px-3 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer truncate"
            title="Execute Multi-D20 Roll"
          >
            <span className="truncate">{getDynamicRollLabel()}</span>
          </button>
        </div>
      </div>

      {/* 4. CUSTOM MACROS DRAWER/SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMacrosOpen(!isMacrosOpen)}
            className="flex items-center gap-1 text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer"
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

        {/* Macro Chips Grid */}
        {isMacrosOpen && (
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
            {macros.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic py-1">
                No custom macros. Click "+ Add Macro" to create one.
              </div>
            ) : (
              macros.map((m) => (
                <div
                  key={m.id}
                  onClick={(e) => handleRollMacro(m, e)}
                  className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/80 transition cursor-pointer shadow-sm text-xs"
                  title={`1-Click Roll: ${m.name} (${m.formula})`}
                >
                  <span className="font-semibold text-slate-200 group-hover:text-amber-300 truncate max-w-[90px]">
                    {m.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {m.formula}
                  </span>
                  {m.advantageMode && m.advantageMode !== 'normal' && (
                    <span className={`text-[9px] px-1 rounded font-bold ${
                      m.advantageMode === 'advantage' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                    }`}>
                      {m.advantageMode === 'advantage' ? 'Adv' : 'Dis'}
                    </span>
                  )}
                  {/* Inline Edit & Delete Controls */}
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

      {/* 5. ROLL FEED (Expanded with reclaimed vertical space) */}
      <div className="flex-1 min-h-[220px] overflow-y-auto rounded-lg border border-neutral-800/80 bg-neutral-950/60 p-2 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-neutral-200 font-display">Roll Feed</span>
            <span className="text-[10px] text-neutral-400 font-mono">({rollHistory.length})</span>
          </div>
          {rollHistory.length > 0 && (
            <button
              type="button"
              onClick={handleClearFeed}
              className="text-[10px] text-neutral-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-rose-950/40 border border-neutral-800 transition cursor-pointer flex items-center gap-1"
              title="Immediately wipe roll feed"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Dynamic vertical space container */}
        <div className="flex-1 min-h-0 overflow-y-auto pt-0.5 space-y-1.5 pr-0.5">
          {rollHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-500">
              <p className="text-xs">No recent rolls.</p>
              <span className="text-[10px] text-slate-600">Roll multi-d20, formula, or custom macros above</span>
            </div>
          ) : (
            rollHistory.map((roll) => {
              const hasPairs = roll.pairedRolls && roll.pairedRolls.length > 0;
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
                      {new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={roll.id}
                  className={`p-2 rounded-lg border text-xs select-none transition ${
                    roll.isCrit
                      ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-400/30'
                      : roll.isFumble
                      ? 'bg-rose-950/40 border-rose-600/80 ring-1 ring-rose-500/30'
                      : isGmOnly
                      ? 'bg-purple-950/30 border-purple-800/60'
                      : 'bg-slate-950/80 border-slate-800/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-slate-300 truncate max-w-[90px]">
                        {roll.rollerName || roll.sender}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {roll.formula || `${roll.count}${roll.diceType}`}
                      </span>
                      {isGmOnly ? (
                        <span className="text-[9px] text-purple-300 font-semibold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700/70 inline-flex items-center gap-1">
                          <span>🔒</span>
                          <span>Secret to GM</span>
                        </span>
                      ) : roll.visibility === 'self' ? (
                        <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Self
                        </span>
                      ) : null}
                    </div>

                    {/* Mode Indicator or Total Score */}
                    {roll.displayMode === 'individual' ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/70 text-amber-300">
                          Indiv ({roll.count} {roll.count === 1 ? 'roll' : 'rolls'})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400">Total:</span>
                        <span
                          className={`text-sm font-mono font-bold tabular-nums ${
                            roll.isCrit
                              ? 'text-amber-400'
                              : roll.isFumble
                              ? 'text-rose-400'
                              : 'text-slate-100'
                          }`}
                        >
                          {roll.total}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rolls Breakdown */}
                  {roll.displayMode === 'individual' ? (
                    <div className="pt-1.5 mt-1 border-t border-slate-800/80 space-y-1 text-[11px] font-mono">
                      {hasPairs ? (
                        roll.pairedRolls!.map((pair: PairedD20Roll) => (
                          <div
                            key={pair.pairIndex}
                            className="flex items-center justify-between text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/60"
                          >
                            <span className="text-slate-400 font-semibold">Roll {pair.pairIndex}:</span>
                            <span className="tabular-nums">
                              [{pair.selected},{' '}
                              <span className="line-through text-slate-500">
                                {pair.discarded}
                              </span>
                              ]
                              {roll.modifier !== 0 && (
                                <span className="text-slate-400">
                                  {roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`}
                                </span>
                              )}{' '}
                              ={' '}
                              <strong className="text-amber-300 font-bold">
                                {pair.totalWithModifier ?? (pair.selected + (roll.modifier || 0))}
                              </strong>
                            </span>
                          </div>
                        ))
                      ) : roll.individualLineItems && roll.individualLineItems.length > 0 ? (
                        roll.individualLineItems
                          .filter((line) => !line.startsWith('Total:') && !line.startsWith('Modifier:'))
                          .map((line, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/60"
                            >
                              <span className="font-semibold text-slate-200">{line}</span>
                            </div>
                          ))
                      ) : (
                        roll.rolls.map((r, idx) => {
                          const modVal = roll.modifier || 0;
                          const evaluated = r + modVal;
                          const modStr = modVal > 0 ? ` + ${modVal}` : modVal < 0 ? ` - ${Math.abs(modVal)}` : '';
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/60"
                            >
                              <span className="text-slate-400 font-semibold">Roll {idx + 1}:</span>
                              <span className="tabular-nums">
                                [{r}]{modStr} = <strong className="text-amber-300 font-bold">{evaluated}</strong>
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : hasPairs ? (
                    <div className="pt-1.5 mt-1 border-t border-slate-800/80 space-y-0.5">
                      {roll.pairedRolls!.map((pair: PairedD20Roll) => (
                        <div
                          key={pair.pairIndex}
                          className="flex items-center justify-between text-[11px] font-mono text-slate-300"
                        >
                          <span className="text-slate-400">Roll {pair.pairIndex}:</span>
                          <span className="tabular-nums">
                            [{pair.selected},{' '}
                            <span className="line-through text-slate-500">
                              {pair.discarded}
                            </span>
                            ]
                            {roll.modifier !== 0 && (
                              <span className="text-slate-400">
                                {roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`}
                              </span>
                            )}{' '}
                            ={' '}
                            <strong className="text-amber-300">
                              {pair.totalWithModifier ?? (pair.selected + (roll.modifier || 0))}
                            </strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : roll.individualLineItems && roll.individualLineItems.length > 0 ? (
                    <div className="pt-1 mt-1 border-t border-slate-800/80 space-y-0.5 text-[11px] font-mono">
                      {roll.individualLineItems.map((line, idx) => {
                        const isTotal = line.startsWith('Total:');
                        const isMod = line.startsWith('Modifier:');
                        const parts = line.split(':');
                        const label = parts[0];
                        const val = parts.slice(1).join(':').trim();
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between ${
                              isTotal
                                ? 'font-bold text-amber-300 pt-0.5 border-t border-slate-800/60'
                                : isMod
                                ? 'text-slate-400 font-medium'
                                : 'text-slate-300'
                            }`}
                          >
                            <span>{label}:</span>
                            <span className="tabular-nums font-semibold">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-slate-400 pt-0.5">
                      Rolls: [{roll.rolls.join(', ')}]
                      {roll.modifier !== 0 && ` (${roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier})`}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: ADD / EDIT MACRO */}
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
                  placeholder="e.g. 1d20+5, 2d6+3, 8d6"
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
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 shadow"
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
