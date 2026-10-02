import React, { useState, useEffect } from 'react';
import {
  DiceRollResult,
  DieType,
  RollVisibility,
  RollDisplayMode,
  PairedD20Roll,
} from '../types/ttrpg';
import { executeDiceRoll, parseDiceFormula } from '../utils/dice';
import { liveFeedSync } from '../utils/liveFeedSync';
import {
  Dices,
  Sparkles,
  Minus,
  Plus,
  RotateCcw,
  Zap,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

interface DiceChamberProps {
  isDm: boolean;
  playerName?: string;
}

const QUICK_CHIPS: DieType[] = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4'];

export const DiceChamber: React.FC<DiceChamberProps> = ({ isDm, playerName }) => {
  const rollerName = playerName?.trim() || (isDm ? 'Game Master' : 'Adventurer');

  // Row 1: Formula Bar State
  const [formulaInput, setFormulaInput] = useState<string>('2d20+4');

  // Row 2: Multi-D20 Engine State
  const [count, setCount] = useState<number>(2);
  const [advantageMode, setAdvantageMode] = useState<'advantage' | 'normal' | 'disadvantage'>('normal');
  const [displayMode, setDisplayMode] = useState<RollDisplayMode>('sum');
  const [modifier, setModifier] = useState<number>(0);
  const [visibility, setVisibility] = useState<RollVisibility>('public');

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
          isDm: !!item.isDm,
          visibility: (item.rollDetails.visibility as RollVisibility) || 'public',
          rollType: item.rollDetails.rollType || 'Straight roll',
          diceType: item.rollDetails.diceType || 'd20',
          count: item.rollDetails.count || 1,
          modifier: item.rollDetails.modifier || 0,
          rolls: item.rollDetails.rolls || [item.rollDetails.total],
          total: item.rollDetails.total,
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
    return list.slice(0, 30);
  });

  // Sync with live feed
  useEffect(() => {
    const unsub = liveFeedSync.subscribe((items, newItem) => {
      if (items.length === 0) {
        setRollHistory([]);
        return;
      }
      if (newItem && newItem.type === 'dice' && newItem.rollDetails) {
        const rollObj: DiceRollResult = {
          id: newItem.id,
          timestamp: newItem.timestamp,
          sender: newItem.sender,
          isDm: !!newItem.isDm,
          visibility: (newItem.rollDetails.visibility as RollVisibility) || 'public',
          rollType: newItem.rollDetails.rollType || 'Straight roll',
          diceType: newItem.rollDetails.diceType || 'd20',
          count: newItem.rollDetails.count || 1,
          modifier: newItem.rollDetails.modifier || 0,
          rolls: newItem.rollDetails.rolls || [newItem.rollDetails.total],
          total: newItem.rollDetails.total,
          advantageMode: newItem.rollDetails.advantageMode || 'normal',
          isCrit: newItem.rollDetails.isCrit,
          isFumble: newItem.rollDetails.isFumble,
          label: newItem.rollDetails.label,
          displayMode: newItem.rollDetails.displayMode || 'sum',
          poolBreakdown: newItem.rollDetails.poolBreakdown,
          formula: newItem.rollDetails.formula,
          individualSummary: newItem.rollDetails.individualSummary,
          individualLineItems: newItem.rollDetails.individualLineItems,
          pairedRolls: newItem.rollDetails.pairedRolls,
          rawRolls: newItem.rollDetails.rawRolls,
        };
        setRollHistory((prev) => {
          if (prev.some((r) => r.id === rollObj.id)) return prev;
          return [rollObj, ...prev.slice(0, 29)];
        });
      }
    });
    return () => unsub();
  }, []);

  // EXECUTE MULTI-D20 ROLL
  const handleRollMultiD20 = () => {
    const result = executeDiceRoll({
      diceType: 'd20',
      count,
      advantageMode,
      displayMode,
      modifier,
      sender: rollerName,
      isDm,
      visibility,
      rollType: 'Straight roll',
      label: count > 1 ? `Multi-D20 (${count}d20)` : 'd20 Roll',
    });

    liveFeedSync.recordDiceRoll(result, true);
    setRollHistory((prev) => [result, ...prev.slice(0, 29)]);
  };

  // EXECUTE FORMULA ROLL
  const handleRollFormula = (customExpr?: string) => {
    const expr = customExpr !== undefined ? customExpr : formulaInput;
    if (!expr.trim()) return;

    const parsed = parseDiceFormula(expr);
    if (!parsed) {
      // Fallback: roll 1d20
      const fallback = executeDiceRoll({
        diceType: 'd20',
        count: 1,
        sender: rollerName,
        isDm,
        visibility,
        label: expr,
      });
      liveFeedSync.recordDiceRoll(fallback, true);
      setRollHistory((prev) => [fallback, ...prev.slice(0, 29)]);
      return;
    }

    const result = executeDiceRoll({
      pool: parsed.pool,
      modifier: parsed.modifier,
      sender: rollerName,
      isDm,
      visibility,
      label: expr,
    });

    liveFeedSync.recordDiceRoll(result, true);
    setRollHistory((prev) => [result, ...prev.slice(0, 29)]);
  };

  // QUICK CHIP ROLL: Sets formula and immediately executes
  const handleQuickChip = (die: DieType) => {
    const formula = modifier !== 0 ? `1${die}${modifier > 0 ? `+${modifier}` : modifier}` : `1${die}`;
    setFormulaInput(formula);
    handleRollFormula(formula);
  };

  // Format modifier string
  const formattedMod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '+0';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-2.5 gap-2.5">
      {/* COMPACT TOP VISIBILITY STRIP */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <Dices className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold font-display text-slate-200">Zero-Scroll Dice Tray</span>
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
            onClick={() => setVisibility('dm')}
            className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
              visibility === 'dm'
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

      {/* ROW 1: FORMULA BAR (Single horizontal row with formula input, Roll button, and Quick-macro chips) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          {/* Formula Text Input */}
          <input
            type="text"
            value={formulaInput}
            onChange={(e) => setFormulaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRollFormula();
            }}
            placeholder="e.g. 2d20+4, 4d6+2"
            className="flex-1 min-w-0 px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 transition"
          />

          {/* Roll Button */}
          <button
            type="button"
            onClick={() => handleRollFormula()}
            className="h-7 px-3 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition shadow cursor-pointer shrink-0"
          >
            Roll
          </button>
        </div>

        {/* Quick-macro chips: [d20], [d12], [d10], [d8], [d6], [d4] */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
            Quick:
          </span>
          <div className="flex items-center gap-1 flex-1 justify-end">
            {QUICK_CHIPS.map((die) => (
              <button
                key={die}
                type="button"
                onClick={() => handleQuickChip(die)}
                className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/60 text-amber-300 transition cursor-pointer shadow-sm shrink-0"
                title={`Quick roll 1${die}`}
              >
                {die}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 2: MULTI-D20 ENGINE (Compact unified grid) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shrink-0 space-y-2.5 shadow-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Count Stepper: [-] [Count: 1-10] [+] */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Count:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCount((prev) => Math.max(1, prev - 1))}
                className="h-6 w-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Decrease dice count"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono font-bold text-amber-300 text-xs w-6 text-center tabular-nums">
                {count}
              </span>
              <button
                type="button"
                onClick={() => setCount((prev) => Math.min(10, prev + 1))}
                className="h-6 w-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Increase dice count (max 10)"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Modifier Input: [-] [Mod: +0] [+] */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Modifier:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setModifier((prev) => prev - 1)}
                className="h-6 w-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Decrease modifier"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono font-bold text-slate-200 text-xs w-8 text-center tabular-nums">
                {formattedMod}
              </span>
              <button
                type="button"
                onClick={() => setModifier((prev) => prev + 1)}
                className="h-6 w-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Increase modifier"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Mode Toggles: Roll Mode & Output Mode */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Roll Mode Toggle: Segmented pills for [Adv] [Straight] [Dis] */}
          <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setAdvantageMode('advantage')}
              className={`flex-1 py-1 rounded font-semibold transition text-center cursor-pointer ${
                advantageMode === 'advantage'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Adv
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('normal')}
              className={`flex-1 py-1 rounded font-semibold transition text-center cursor-pointer ${
                advantageMode === 'normal'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Straight
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('disadvantage')}
              className={`flex-1 py-1 rounded font-semibold transition text-center cursor-pointer ${
                advantageMode === 'disadvantage'
                  ? 'bg-rose-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dis
            </button>
          </div>

          {/* Output Mode Toggle: Segmented pills for [Sum] [Indiv] */}
          <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setDisplayMode('sum')}
              className={`flex-1 py-1 rounded font-semibold transition text-center cursor-pointer ${
                displayMode === 'sum'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sum
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('individual')}
              className={`flex-1 py-1 rounded font-semibold transition text-center cursor-pointer ${
                displayMode === 'individual'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Indiv
            </button>
          </div>
        </div>

        {/* Primary "Roll Multi-D20" Button */}
        <button
          type="button"
          onClick={handleRollMultiD20}
          className="w-full py-2 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow flex items-center justify-center gap-1.5"
        >
          <Dices className="w-4 h-4 stroke-[2.5]" />
          <span>
            Roll Multi-D20 ({count}d20
            {advantageMode === 'advantage'
              ? ' Adv'
              : advantageMode === 'disadvantage'
              ? ' Dis'
              : ''}
            {modifier !== 0 ? ` ${formattedMod}` : ''})
          </span>
        </button>
      </div>

      {/* ROW 3: COLLAPSIBLE FEED (Fixed-height container h-40 max with overflow-y-auto displaying rolled pairs with strike-through notation and totals) */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-slate-300 font-display">Roll Feed</span>
          </div>
          {rollHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setRollHistory([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition cursor-pointer flex items-center gap-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Fixed max-height feed list (h-40 max) */}
        <div className="flex-1 max-h-40 overflow-y-auto pt-1.5 space-y-1.5 pr-0.5">
          {rollHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-500">
              <p className="text-xs">No recent rolls.</p>
              <span className="text-[10px] text-slate-600">Roll multi-d20 or formula above</span>
            </div>
          ) : (
            rollHistory.map((roll) => {
              const hasPairs = roll.pairedRolls && roll.pairedRolls.length > 0;

              return (
                <div
                  key={roll.id}
                  className={`p-2 rounded-lg border text-xs select-none transition ${
                    roll.isCrit
                      ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-400/30'
                      : roll.isFumble
                      ? 'bg-rose-950/40 border-rose-600/80 ring-1 ring-rose-500/30'
                      : 'bg-slate-950/80 border-slate-800/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-slate-300 truncate max-w-[90px]">
                        {roll.sender}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {roll.formula || `${roll.count}${roll.diceType}`}
                      </span>
                      {roll.visibility !== 'public' && (
                        <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {roll.visibility}
                        </span>
                      )}
                    </div>

                    {/* Total Score */}
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
                  </div>

                  {/* Paired Multi-d20 Breakdown with Strike-Through Notation */}
                  {hasPairs ? (
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
                  ) : roll.individualLineItems && roll.individualLineItems.length > 1 ? (
                    <div className="pt-1 mt-1 border-t border-slate-800/80 space-y-0.5 text-[11px] font-mono text-slate-400">
                      {roll.individualLineItems.map((line, idx) => (
                        <div key={idx} className="truncate">
                          {line}
                        </div>
                      ))}
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
    </div>
  );
};
