import React, { useState, useEffect, useRef } from 'react';
import { liveFeedSync, UnifiedFeedItem } from '../utils/liveFeedSync';
import { playDiceRollSound } from '../utils/audio';
import { executeDiceRoll } from '../utils/dice';
import { DieType } from '../types/ttrpg';
import {
  Radio,
  Dices,
  Swords,
  Send,
  Trash2,
} from 'lucide-react';

interface LiveCombatFeedProps {
  isDm: boolean;
  playerName?: string;
}

export const LiveCombatFeed: React.FC<LiveCombatFeedProps> = ({ isDm, playerName }) => {
  const currentUserName = playerName || liveFeedSync.getPlayerName();
  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>(() => liveFeedSync.getFeed());
  const [chatInput, setChatInput] = useState('');
  const [advantageMode, setAdvantageMode] = useState<'normal' | 'adv' | 'dis'>('normal');

  // Ref to the INTERNAL scrollable div only - NEVER use scrollIntoView on window
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = liveFeedSync.subscribe((items) => {
      setFeedItems([...items]);
      // Scroll ONLY the inner container gently to the bottom, without scrolling the page/window
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 25);
    });

    return () => unsub();
  }, []);

  // Quick Dice Roll Function - Connected to shared liveFeedSync
  const handleQuickRoll = (sides: number) => {
    playDiceRollSound();
    const rollerName = currentUserName;
    const currentUserId = liveFeedSync.getPlayerId();
    const advMode =
      sides === 20
        ? advantageMode === 'adv'
          ? 'advantage'
          : advantageMode === 'dis'
          ? 'disadvantage'
          : 'normal'
        : 'normal';

    const rollObj = executeDiceRoll({
      diceType: `d${sides}` as DieType,
      count: 1,
      advantageMode: advMode,
      sender: rollerName,
      rollerName,
      rollerId: currentUserId,
      isDm,
      visibility: 'public',
      rollType: 'Straight roll',
    });

    liveFeedSync.recordDiceRoll(rollObj, true);
  };

  // Send Chat / Tactical Callout
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const senderName = currentUserName;
    liveFeedSync.recordChat(senderName, isDm, chatInput.trim(), true);
    setChatInput('');
  };

  // Clear Feed Log strictly locally for this client
  const handleClearLog = () => {
    liveFeedSync.clearFeed();
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
            Live Table Feed
          </h3>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            ({feedItems.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Table Feed
          </span>
          {/* Clear Log button consistently available across all tabs for BOTH DM and Players */}
          {feedItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearLog}
              className="text-slate-400 hover:text-rose-300 text-xs px-2 py-0.5 rounded bg-slate-950/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/60 transition cursor-pointer flex items-center gap-1 shadow-sm"
              title="Clear Local Feed Log (clears only your view, does not affect others)"
            >
              <Trash2 className="w-3 h-3 text-slate-400 group-hover:text-rose-400" />
              <span>Clear Log</span>
            </button>
          )}
        </div>
      </div>

      {/* Internal Scrollable Message Container - ONLY this element scrolls */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[260px] sm:min-h-[320px] max-h-[460px] sm:max-h-[500px]"
      >
        {feedItems.length === 0 ? (
          <div className="text-center p-8 text-slate-500 text-xs italic">
            Feed is clear. Rolls, combat logs, and callouts will appear here live.
          </div>
        ) : (
          feedItems.map((evt) => {
            const time = new Date(evt.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            // Turn change announcement
            if (evt.type === 'turn') {
              return (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs shadow-sm flex items-start gap-2"
                >
                  <Swords className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-100">{evt.message}</div>
                    <span className="text-[10px] text-amber-400/80 font-mono">{time}</span>
                  </div>
                </div>
              );
            }

            // Dice Roll event - Unified with Dice Chamber
            if (evt.type === 'dice') {
              const visibility = evt.rollDetails?.visibility || (evt.isSecretRoll ? 'gm_only' : 'public');
              const isGmOnly = visibility === 'gm_only';
              const isSelf = visibility === 'self';

              const currentUserId = liveFeedSync.getPlayerId();
              const rollerId = evt.rollerId || evt.rollDetails?.rollerId;
              const rollerName = evt.rollerName || evt.rollDetails?.rollerName || evt.sender;

              const isRoller = (rollerId && rollerId === currentUserId) || (rollerName === currentUserName);
              const isGm = isDm || liveFeedSync.getIsGm();
              const canSeeSecretRoll = isGm || isRoller;

              // If visibility === 'self': Only render on the roller's local client
              if (isSelf && !isRoller) {
                return null;
              }

              // Other Players (role !== 'GM' and not the roller): Mask the roll completely.
              // Render ONLY a subtle notification card: "${rollerName} made a secret roll to the DM 🔒"
              // (Hide all formula text, dice values, modifiers, and total sums completely).
              if (isGmOnly && !canSeeSecretRoll) {
                return (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs shadow-sm flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 text-purple-300">
                      <Dices className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-medium text-slate-200">
                        {rollerName} made a secret roll to the DM 🔒
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{time}</span>
                  </div>
                );
              }

              const isNat20 = evt.rollDetails?.isCrit || evt.rollDetails?.total === 20;
              const isNat1 = evt.rollDetails?.isFumble || evt.rollDetails?.total === 1;
              const rollType = evt.rollDetails?.rollType;
              const label = evt.rollDetails?.label;
              const formula = evt.rollDetails?.formula;
              const rolls = evt.rollDetails?.rolls;
              const total = evt.rollDetails?.total;
              const isIndividual = evt.rollDetails?.displayMode === 'individual';
              const poolBreakdown = evt.rollDetails?.poolBreakdown;
              const modifier = evt.rollDetails?.modifier;
              const pairedRolls = evt.rollDetails?.pairedRolls;
              const advantageModeVal = evt.rollDetails?.advantageMode;

              return (
                <div
                  key={evt.id}
                  className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all shadow-sm ${
                    isNat20
                      ? 'bg-amber-950/40 border-amber-500/70 shadow-amber-950/30'
                      : isNat1
                      ? 'bg-rose-950/40 border-rose-500/60 shadow-rose-950/30'
                      : isGmOnly
                      ? 'bg-purple-950/30 border-purple-800/60'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5 flex-wrap">
                      <Dices className="w-3.5 h-3.5 text-amber-400" />
                      <span>{rollerName}</span>
                      {evt.isDm && (
                        <span className="text-[9px] text-amber-400 font-semibold px-1 py-0.2 rounded bg-amber-950/70 border border-amber-800/60">
                          DM
                        </span>
                      )}
                      {isGmOnly && (
                        <span className="text-[9px] text-purple-300 font-semibold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700/70 inline-flex items-center gap-1">
                          <span>🔒</span>
                          <span>Secret to GM</span>
                        </span>
                      )}
                      {rollType && rollType !== 'Straight roll' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300 font-medium">
                          {rollType}
                        </span>
                      )}
                      {isIndividual && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 font-bold">
                          Individual
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{time}</span>
                  </div>

                  {label && (
                    <div className="text-[11px] text-amber-300 font-medium italic">
                      "{label}"
                    </div>
                  )}

                  {isIndividual ? (
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold text-amber-300">
                          Individual Rolls ({formula || `${rolls?.length || 1}d20`}):
                        </span>
                        {modifier !== undefined && modifier !== 0 && (
                          <span className="text-slate-400">
                            Mod: {modifier > 0 ? `+${modifier}` : modifier}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 font-mono text-xs">
                        {pairedRolls && pairedRolls.length > 0 ? (
                          pairedRolls.map((pair) => {
                            const pairNat20 = pair.selected === 20;
                            const pairNat1 = pair.selected === 1;
                            const modVal = pair.modifier ?? modifier ?? 0;
                            const modStr = modVal > 0 ? ` + ${modVal}` : modVal < 0 ? ` - ${Math.abs(modVal)}` : '';
                            const totalVal = pair.totalWithModifier ?? (pair.selected + modVal);
                            return (
                              <div
                                key={pair.pairIndex}
                                className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-slate-400 font-bold">Roll {pair.pairIndex}:</span>
                                  <span className="inline-flex items-center">
                                    <span>[</span>
                                    <span
                                      className={`font-bold px-0.5 rounded ${
                                        pairNat20
                                          ? 'bg-amber-400 text-slate-950'
                                          : pairNat1
                                          ? 'bg-rose-600 text-white'
                                          : 'text-amber-300'
                                      }`}
                                    >
                                      {pair.selected}
                                    </span>
                                    <span>, </span>
                                    <span className="line-through decoration-rose-500 text-slate-500 font-semibold px-0.5">
                                      {pair.discarded}
                                    </span>
                                    <span>]</span>
                                  </span>
                                  {modStr && <span className="text-slate-300">{modStr}</span>}
                                  <span className="text-slate-400">=</span>
                                  <span
                                    className={`font-bold ${
                                      pairNat20 ? 'text-amber-300' : pairNat1 ? 'text-rose-400' : 'text-slate-100'
                                    }`}
                                  >
                                    {totalVal}
                                  </span>
                                </div>
                                {(pairNat20 || pairNat1) && (
                                  <span className={`text-[9px] font-bold uppercase font-sans ${pairNat20 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {pairNat20 ? 'NAT 20' : 'NAT 1'}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          (rolls || []).map((r, rIdx) => {
                            const rNat20 = (evt.rollDetails?.diceType === 'd20' || !evt.rollDetails?.diceType) && r === 20;
                            const rNat1 = (evt.rollDetails?.diceType === 'd20' || !evt.rollDetails?.diceType) && r === 1;
                            const modVal = modifier ?? 0;
                            const modStr = modVal > 0 ? ` + ${modVal}` : modVal < 0 ? ` - ${Math.abs(modVal)}` : '';
                            const totalVal = r + modVal;
                            return (
                              <div
                                key={rIdx}
                                className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-slate-400 font-bold">Roll {rIdx + 1}:</span>
                                  <span className="inline-flex items-center">
                                    <span>[</span>
                                    <span
                                      className={`font-bold px-0.5 rounded ${
                                        rNat20
                                          ? 'bg-amber-400 text-slate-950'
                                          : rNat1
                                          ? 'bg-rose-600 text-white'
                                          : 'text-amber-300'
                                      }`}
                                    >
                                      {r}
                                    </span>
                                    <span>]</span>
                                  </span>
                                  {modStr && <span className="text-slate-300">{modStr}</span>}
                                  <span className="text-slate-400">=</span>
                                  <span
                                    className={`font-bold ${
                                      rNat20 ? 'text-amber-300' : rNat1 ? 'text-rose-400' : 'text-slate-100'
                                    }`}
                                  >
                                    {totalVal}
                                  </span>
                                </div>
                                {(rNat20 || rNat1) && (
                                  <span className={`text-[9px] font-bold uppercase font-sans ${rNat20 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {rNat20 ? 'NAT 20' : 'NAT 1'}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-0.5">
                      {pairedRolls && pairedRolls.length > 0 ? (
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-xs font-mono text-slate-300 flex items-center flex-wrap gap-1.5">
                            {pairedRolls.map((pair) => (
                              <span
                                key={pair.pairIndex}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/80 shadow-sm"
                              >
                                <span>[</span>
                                <span
                                  className={`font-bold ${
                                    pair.selected === 20
                                      ? 'text-amber-400'
                                      : pair.selected === 1
                                      ? 'text-rose-400'
                                      : 'text-amber-200'
                                  }`}
                                  title={`Kept: ${pair.selected}`}
                                >
                                  {pair.selected}
                                </span>
                                <span className="text-slate-500">,</span>
                                <span
                                  className="line-through decoration-rose-500 text-slate-500 font-semibold opacity-75"
                                  title={`Discarded: ${pair.discarded}`}
                                >
                                  {pair.discarded}
                                </span>
                                <span>]</span>
                              </span>
                            ))}

                            {modifier !== undefined && modifier !== 0 && (
                              <span className="text-slate-400 font-semibold">
                                {modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`}
                              </span>
                            )}

                            <span className="text-slate-400 font-bold">=</span>

                            <span
                              className={`text-base font-bold font-mono ${
                                isNat20
                                  ? 'text-amber-300'
                                  : isNat1
                                  ? 'text-rose-400'
                                  : 'text-slate-100'
                              }`}
                            >
                              {total}
                            </span>

                            <span className="text-[10px] font-semibold text-amber-400/90 ml-0.5">
                              for {advantageModeVal === 'advantage' ? 'Advantage' : 'Disadvantage'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isNat20 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-bold text-[9px] tracking-wider animate-pulse">
                                NAT 20
                              </span>
                            )}
                            {isNat1 && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold text-[9px] tracking-wider">
                                NAT 1
                              </span>
                            )}
                          </div>
                        </div>
                      ) : evt.rollDetails?.individualLineItems && evt.rollDetails.individualLineItems.length > 1 ? (
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-mono font-bold text-amber-300">
                              {formula || evt.message}
                            </span>
                            <span className="text-base font-bold font-mono text-slate-100">
                              {total}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5 text-[11px] font-mono">
                            {evt.rollDetails.individualLineItems.map((line, idx) => {
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
                        </div>
                      ) : (
                        <div className="flex items-baseline justify-between">
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-[200px] sm:max-w-none">
                            {formula || evt.message}
                            {rolls && rolls.length > 0 && (
                              <span className="text-slate-500 ml-1">
                                [{rolls.join(', ')}]
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isNat20 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-bold text-[9px] tracking-wider animate-pulse">
                                NAT 20
                              </span>
                            )}
                            {isNat1 && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold text-[9px] tracking-wider">
                                NAT 1
                              </span>
                            )}
                            {typeof total === 'number' && (
                              <span
                                className={`text-base font-bold font-mono ${
                                  isNat20
                                    ? 'text-amber-300'
                                    : isNat1
                                    ? 'text-rose-400'
                                    : 'text-slate-100'
                                }`}
                              >
                                {total}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Combat action log (Damage, Healing, Conditions)
            if (evt.type === 'combat') {
              const displayMessage = !isDm && evt.playerMessage ? evt.playerMessage : evt.message;
              const isDamage = displayMessage.includes('took');
              const isHeal = displayMessage.includes('healed');

              return (
                <div
                  key={evt.id}
                  className={`p-2 rounded-xl border text-xs space-y-0.5 ${
                    isDamage
                      ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                      : isHeal
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                      : 'bg-slate-950/80 border-slate-800/80 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">{evt.sender}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{time}</span>
                  </div>
                  <p className="font-medium">{displayMessage}</p>
                </div>
              );
            }

            // Chat message
            return (
              <div
                key={evt.id}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    {evt.sender}
                    {evt.isDm && <span className="text-[9px] text-amber-400 font-semibold">(DM)</span>}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{time}</span>
                </div>
                <p className="text-slate-300 whitespace-pre-wrap">{evt.message}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Dice Chamber Bar */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Dices className="w-3.5 h-3.5 text-amber-400" /> Quick Roll:
          </span>

          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => setAdvantageMode('normal')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                advantageMode === 'normal' ? 'bg-slate-800 text-amber-300 font-bold' : 'text-slate-400'
              }`}
            >
              Norm
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('adv')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                advantageMode === 'adv' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-slate-400'
              }`}
            >
              Adv
            </button>
            <button
              type="button"
              onClick={() => setAdvantageMode('dis')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                advantageMode === 'dis' ? 'bg-rose-950 text-rose-300 font-bold' : 'text-slate-400'
              }`}
            >
              Dis
            </button>
          </div>
        </div>

        {/* Dice buttons - responsive grid */}
        <div className="grid grid-cols-6 gap-1">
          {[20, 12, 10, 8, 6, 4].map((sides) => (
            <button
              key={sides}
              type="button"
              onClick={() => handleQuickRoll(sides)}
              className="py-1 text-xs font-mono font-bold rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-400 text-slate-200 hover:text-amber-300 transition cursor-pointer shadow-sm text-center"
            >
              d{sides}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Message Input */}
      <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-1">
        <input
          type="text"
          placeholder="Combat callout or note..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          className="p-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shrink-0"
          title="Send Callout to Room"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
