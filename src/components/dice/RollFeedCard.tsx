/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DiceRollResult } from '../../types/ttrpg';

export interface RollFeedCardProps {
  roll: DiceRollResult;
  onReroll: (roll: DiceRollResult, e: React.MouseEvent) => void;
  isGM?: boolean;
  isDm?: boolean;
  playerName?: string;
}

export const RollFeedCard: React.FC<RollFeedCardProps> = ({
  roll,
  onReroll,
  isGM,
  isDm = false,
}) => {
  const isGameMaster = isGM !== undefined ? isGM : isDm;
  const isGmOnly = roll.visibility === 'gm_only';
  const hasInstances = roll.instances && roll.instances.length > 0;
  const macroName = roll.macroName || (roll.label && !roll.label.includes('1d20') && !roll.label.startsWith('Initiative') ? roll.label : undefined);

  return (
    <div
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
            onClick={(e) => onReroll(roll, e)}
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
                {macroName && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold mr-1">
                    🏷️ {macroName}
                  </span>
                )}
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
          {macroName && (
            <div className="pb-1">
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold mr-1">
                🏷️ {macroName}
              </span>
            </div>
          )}
          {roll.breakdown && roll.breakdown.length > 0 ? (
            roll.breakdown
              .filter((line) => !line.startsWith('Total:') && !line.startsWith('Combined Total:'))
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
};

export default RollFeedCard;
