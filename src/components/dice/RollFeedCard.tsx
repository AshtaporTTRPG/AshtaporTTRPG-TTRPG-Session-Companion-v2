/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DiceRollResult } from '../../types/ttrpg';

export interface RollFeedCardProps {
  roll: DiceRollResult;
  isGM?: boolean;
  isDm?: boolean;
  playerName?: string;
}

/**
 * Highlights "= <number>" at the end of breakdown lines in bright Amber/Gold
 * so final roll numbers pop immediately without scanning through raw dice brackets.
 */
const renderFormattedBreakdown = (text: string) => {
  const eqMatch = text.match(/^(.*?)(=\s*-?\d+(?:\s*\|\s*.*)?)$/);
  const mainBody = eqMatch ? eqMatch[1] : text;
  const trailingTotal = eqMatch ? eqMatch[2] : null;
  const isDamageLine = /\bDmg\b/i.test(mainBody);

  const renderStrikethrough = (str: string) => {
    if (!str.includes('~~')) return str;
    const parts = str.split(/(~~.*?~~)/g);
    return parts.map((part, i) => {
      if (part.startsWith('~~') && part.endsWith('~~')) {
        return (
          <span key={i} className="line-through text-slate-500 font-normal">
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <span className="flex items-center justify-between gap-2 w-full">
      <span className="min-w-0 break-words">{renderStrikethrough(mainBody)}</span>
      {trailingTotal && (
        <span
          className={`px-1.5 py-0.2 rounded border font-black font-mono tabular-nums shrink-0 ${
            isDamageLine
              ? 'bg-cyan-950/80 border-cyan-600/60 text-cyan-300'
              : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
          }`}
        >
          {trailingTotal}
        </span>
      )}
    </span>
  );
};

export const RollFeedCard: React.FC<RollFeedCardProps> = ({
  roll,
  isDm = false,
}) => {
  const isGmOnly = roll.visibility === 'gm_only' || roll.visibility === 'dm';
  const isIndividual = roll.displayMode === 'individual';
  const hasInstances = isIndividual && Boolean(roll.instances && roll.instances.length > 0);

  const isFormulaLabel =
    roll.label &&
    (roll.label.trim() === roll.formula?.trim() ||
      /^\d*d\d+/i.test(roll.label.trim()) ||
      roll.label.startsWith('1d20') ||
      roll.label.startsWith('Initiative'));

  const macroName = roll.macroName || (!isFormulaLabel ? roll.label : undefined);

  // Extract any "📝 ..." note lines carried through synced breakdown arrays
  const noteLinesFromBreakdown: string[] = [];
  const cleanBreakdownLines: string[] = [];

  (roll.breakdown || []).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('📝')) {
      const stripped = trimmed.replace(/^📝\s*/, '').trim();
      if (stripped && !noteLinesFromBreakdown.includes(stripped)) {
        noteLinesFromBreakdown.push(stripped);
      }
    } else {
      cleanBreakdownLines.push(line);
    }
  });

  const resolvedNotes =
    roll.notes?.trim() ||
    (noteLinesFromBreakdown.length > 0 ? noteLinesFromBreakdown.join(' | ') : undefined);

  const headerSummaryText = isIndividual
    ? roll.individualSummary
      ? roll.individualSummary.includes(':')
        ? roll.individualSummary
        : `Results: ${roll.individualSummary}`
      : `Results: ${
          hasInstances
            ? roll.instances!.map((i) => i.total).join(', ')
            : roll.rolls.join(', ')
        }`
    : `Total: ${roll.total}`;

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
      {/* Compact Header Row: Sender + Macro Badge + Formula + Bright Total */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <span
            className="font-bold text-slate-200 truncate max-w-[85px]"
            title={roll.rollerName || roll.sender}
          >
            {roll.rollerName || roll.sender}
          </span>

          {macroName && (
            <span
              className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold truncate max-w-[175px]"
              title={macroName}
            >
              🏷️ {macroName}
            </span>
          )}

          {!macroName && (
            <span
              className="text-[11px] text-slate-400 font-mono truncate"
              title={roll.formula || `${roll.count}${roll.diceType}`}
            >
              {roll.formula || `${roll.count}${roll.diceType}`}
            </span>
          )}

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

        <div className="flex items-center shrink-0">
          <span
            className={`font-mono font-black text-xs tabular-nums px-1.5 py-0.2 rounded border ${
              roll.isCrit
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
            }`}
          >
            {headerSummaryText}
          </span>
        </div>
      </div>

      {/* Mode A: Individual Attacks, Checks & Paired Queues */}
      {isIndividual ? (
        hasInstances ? (
          <div className="space-y-1">
            {roll.instances!.map((inst) => (
              <div
                key={inst.index}
                className="flex items-center justify-between gap-1.5 py-0.5 px-1.5 rounded bg-slate-950/70 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-slate-400 font-semibold text-[11px] shrink-0">
                    Roll {inst.index}:
                  </span>

                  <span className="bg-slate-800 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-slate-700 font-mono tabular-nums shrink-0 inline-flex items-center gap-1">
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

                  {inst.isCrit && (
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-1 font-black rounded uppercase shrink-0">
                      CRIT
                    </span>
                  )}

                  {inst.isFumble && (
                    <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] px-1 font-black rounded uppercase shrink-0">
                      FUMBLE
                    </span>
                  )}

                  {inst.riders.map((r, rIdx) => (
                    <span key={rIdx} className="text-slate-300 font-mono text-[11px] shrink-0 inline-flex items-center gap-1">
                      <span>+ {r.count}{r.diceType}[{r.rolls.join(', ')}]</span>
                      <span className="text-cyan-300 font-bold">(= {r.sum})</span>
                    </span>
                  ))}

                  {inst.modifier !== 0 && (
                    <span className="text-slate-400 font-mono text-[11px] shrink-0">
                      {inst.modifier > 0
                        ? `+ ${inst.modifier}`
                        : `- ${Math.abs(inst.modifier)}`}
                    </span>
                  )}
                </div>

                <span
                  className={`font-black font-mono text-xs tabular-nums shrink-0 ml-auto px-1.5 py-0.2 rounded border ${
                    inst.isCrit
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  }`}
                >
                  = {inst.total}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 text-[11px] font-mono">
            {cleanBreakdownLines.length > 0 ? (
              cleanBreakdownLines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-slate-300 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800/80"
                >
                  {renderFormattedBreakdown(line)}
                </div>
              ))
            ) : (
              <div className="text-slate-400">
                Rolls: [{roll.rolls.join(', ')}]
              </div>
            )}
          </div>
        )
      ) : (
        /* Mode B: Pooled Sum (Inline Die Subtotal Chips — Zero Redundant Footer) */
        <div>
          {roll.poolBreakdown && roll.poolBreakdown.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              {roll.poolBreakdown.map((pool, pIdx) => {
                const poolSubtotal = pool.rolls.reduce((sum, val) => sum + val, 0);
                return (
                  <div
                    key={pIdx}
                    className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded bg-slate-950/80 border border-slate-800/90"
                  >
                    <span className="font-bold text-slate-200">
                      {pool.rolls.length}{pool.dieType}
                    </span>
                    <span className="text-slate-400">
                      [{pool.rolls.join(', ')}]
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-950/90 border border-cyan-700/70 text-cyan-300 font-black tabular-nums">
                      = {poolSubtotal}
                    </span>
                  </div>
                );
              })}

              {roll.modifier !== 0 && (
                <div className="inline-flex items-center gap-1 py-0.5 px-2 rounded bg-slate-950/80 border border-slate-800/90 text-slate-200 font-bold tabular-nums">
                  {roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-300 bg-slate-950/70 px-2 py-1 rounded border border-slate-800/80 text-[11px] font-mono space-y-1">
              {cleanBreakdownLines.length > 0
                ? cleanBreakdownLines.map((line, idx) => (
                    <div key={idx}>{renderFormattedBreakdown(line)}</div>
                  ))
                : `Rolls: [${roll.rolls.join(', ')}]${
                    roll.modifier
                      ? ` (${roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier})`
                      : ''
                  }`}
            </div>
          )}
        </div>
      )}

      {/* Optional Effects / Notes Callout Banner */}
      {resolvedNotes && (
        <div className="px-2 py-1 rounded bg-cyan-950/40 border border-cyan-700/60 text-cyan-200 text-[11px] font-sans flex items-start gap-1.5">
          <span className="shrink-0">📝</span>
          <span className="leading-snug">{resolvedNotes}</span>
        </div>
      )}
    </div>
  );
};

export default RollFeedCard;
