import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  X,
  Users,
  ChevronDown,
  MessageSquare,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pencil,
  Crown,
  Sparkles,
  Shield,
  EyeOff,
  Dices,
  Swords,
  Ruler,
  FileText,
  Radio,
} from 'lucide-react';

export type HelpTab = 'combat' | 'dice' | 'range' | 'notes';

export interface ContextualHelpTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  activeAppTab: string;
  isGM: boolean;
}

const mapAppTabToHelpTab = (tab: string): HelpTab => {
  if (tab === 'combat') return 'combat';
  if (tab === 'dice') return 'dice';
  if (tab === 'range' || tab === 'geometry') return 'range';
  if (tab === 'notes') return 'notes';
  return 'combat';
};

export const ContextualHelpTooltip: React.FC<ContextualHelpTooltipProps> = ({
  isOpen,
  onClose,
  activeAppTab,
  isGM,
}) => {
  const [selectedTab, setSelectedTab] = useState<HelpTab>(() => mapAppTabToHelpTab(activeAppTab));
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-default to the currently active application tab when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedTab(mapAppTabToHelpTab(activeAppTab));
    }
  }, [isOpen, activeAppTab]);

  // Outside click detection and Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-help-trigger]')) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute top-11 right-2 w-80 max-h-[520px] overflow-hidden z-50 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md flex flex-col text-slate-200 animate-fadeIn"
      role="dialog"
      aria-label="Quick Guide"
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800/80 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <HelpCircle className="w-3.5 h-3.5" /> Quick Guide
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xs p-1 rounded hover:bg-slate-800 transition cursor-pointer"
            title="Close Guide (Esc)"
            aria-label="Close Guide"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sub-Tab Navigation Micro-Pills */}
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setSelectedTab('combat')}
            className={`py-1 px-1 rounded text-center transition cursor-pointer truncate ${
              selectedTab === 'combat'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Combat
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('dice')}
            className={`py-1 px-1 rounded text-center transition cursor-pointer truncate ${
              selectedTab === 'dice'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Dice
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('range')}
            className={`py-1 px-1 rounded text-center transition cursor-pointer truncate ${
              selectedTab === 'range'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            3D Range
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('notes')}
            className={`py-1 px-1 rounded text-center transition cursor-pointer truncate ${
              selectedTab === 'notes'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Notes
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs leading-relaxed">
        {selectedTab === 'combat' && (
          <div className="space-y-3">
            {/* General Combat Help */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                <Swords className="w-3 h-3 text-amber-400" />
                Combat Lifecycle & Mechanics
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-1.5 text-[11px]">
                <p>
                  <strong className="text-amber-300 font-semibold">Staging (Round 0):</strong> Before combat begins, players join from <Users className="inline w-3 h-3 text-amber-400 align-text-bottom" /> <strong>Roster</strong>. Turn progression is locked while the party rolls initiative.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">DM Initiative Alert:</strong> When the GM calls for initiative, a pulsing amber banner alerts all players: <em>"⚔️ DM called for Initiative! Open Roster to join."</em> Tap to open Roster and join with 1 tap.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Active Combat (Round 1+):</strong> GM initiates Round 1. Turns advance in sub-30ms raw WebSocket sync. The active combatant glows gold and plays an audible turn chime.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">1-Tap Health:</strong> In compact rows, click HP numbers (<code className="text-amber-300 font-mono text-[10px] px-1 py-0.5 rounded bg-slate-800">30/30</code>) directly to log damage/healing without expanding the row.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">
                    Row Expand (<ChevronDown className="inline w-3 h-3 text-slate-400 align-text-bottom" />):
                  </strong>{' '}
                  Access <code className="text-amber-300 font-mono text-[10px]">-5/-1/+1/+5</code> quick tallies, Temp HP, and condition tags.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Death Saves:</strong> Pop up automatically at 0 HP for PCs. Pips sync live across table and reset when healed.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">End Combat (Roster Unlock):</strong> When the GM ends the encounter with <code className="text-rose-400 font-semibold font-mono text-[10px]">🛑 End Combat</code>, all character locks are immediately released back to <em>"Not in battle"</em>.
                </p>
              </div>
            </div>

            {/* GM Exclusives */}
            {isGM && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  GM Exclusives
                </div>
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2 space-y-1.5 text-[11px]">
                  <p>
                    <strong className="text-amber-300 font-semibold">Staging Workflow:</strong> Click <strong className="text-amber-400">⚔️ Roll for Initiative</strong> to broadcast table alerts. Click <strong className="text-amber-400">⇅ Sort Init</strong> to sort descending. Click <strong className="text-emerald-400">▶ Start Round 1</strong> to begin.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Cassette Transport:</strong> <code className="text-amber-300 font-mono text-[10px]">⏮</code> Rewinds strictly to Round 1, Turn 1. <code className="text-amber-300 font-mono text-[10px]">◀</code> Prev Turn, <code className="text-amber-300 font-mono text-[10px]">▶</code> Next Turn advances turns with instant sub-30ms WebSocket delivery.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">🛑 End Combat:</strong> Prompts confirmation, resets turns to 0, clears the active tracker, and instantly unlocks player rosters.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Hostile Masking:</strong> Monster HP is automatically masked (<code className="text-amber-300 font-mono text-[10px]">???/???</code>) for player terminals.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'dice' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                <Dices className="w-3 h-3 text-amber-400" />
                Dice Engine: Roll Sum vs Roll Indiv
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-2 text-[11px]">
                <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/40 space-y-1">
                  <strong className="text-amber-300 font-bold block">[ 🎲 ROLL SUM ] (Grand Totals):</strong>
                  <p className="text-slate-300">
                    Evaluates all dice and modifiers into <strong>one single combined total</strong>.
                  </p>
                  <p className="text-slate-400">
                    • <strong>Skill Challenges:</strong> Party pooled efforts (e.g. <code className="text-amber-300 font-mono text-[10px]">5d20 + 1d4 + 15</code> vs DC 100/120).
                  </p>
                  <p className="text-slate-400">
                    • <strong>AoE & Spells:</strong> Fireball (<code className="text-amber-300 font-mono text-[10px]">8d6</code>), weapon damage (<code className="text-amber-300 font-mono text-[10px]">2d6 + 3</code>), or mass healing pools.
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/40 space-y-1">
                  <strong className="text-indigo-300 font-bold block">[ 📊 ROLL INDIV ] (Separate Batches):</strong>
                  <p className="text-slate-300">
                    Rolls separate instances without summing them together.
                  </p>
                  <p className="text-slate-400">
                    • <strong>Multi-attacks & Mobs:</strong> <code className="text-indigo-300 font-mono text-[10px]">5d20 + 4</code> rolls 5 distinct goblin attacks, applying <code className="text-indigo-300 font-mono text-[10px]">+4</code> to each attack individually.
                  </p>
                  <p className="text-slate-400">
                    • <strong>Adv / Dis on Batches:</strong> When <code className="text-amber-300 font-mono text-[10px]">Adv</code> is selected with <code className="text-indigo-300 font-mono text-[10px]">3d20 + 5</code>, each individual attack rolls 2d20, takes the higher face, and applies +5.
                  </p>
                  <p className="text-slate-400">
                    • <strong>Contested Checks & Stats:</strong> Ability score generation (<code className="text-indigo-300 font-mono text-[10px]">4d6</code>) or simultaneous perception checks.
                  </p>
                </div>

                <p>
                  <strong className="text-amber-300 font-semibold">Quick D20:</strong> Tap <code className="text-amber-300 font-mono text-[10px]">d20</code>, <code className="text-amber-300 font-mono text-[10px]">Adv</code>, or <code className="text-amber-300 font-mono text-[10px]">Dis</code> at the top for instant sandboxed rolls without modifying your staged formula.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Clean-Slate Formula Bar:</strong> Click die chips (<code className="text-amber-300 font-mono text-[10px]">d6</code>, <code className="text-amber-300 font-mono text-[10px]">d8</code>) to stage clean expressions (<code className="text-amber-300 font-mono text-[10px]">2d6</code>, <code className="text-amber-300 font-mono text-[10px]">8d6 + 4</code>) with zero phantom d20 injection.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Docked Calculator:</strong> Tap the calculator icon to compute complex modifiers and inject directly with <em>➔ Apply</em>.
                </p>
              </div>
            </div>

            {/* GM Exclusives */}
            {isGM && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  GM Exclusives
                </div>
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2 space-y-1.5 text-[11px]">
                  <p>
                    <strong className="text-amber-300 font-semibold">Secret Rolls:</strong> <strong className="text-amber-200">GM Only</strong> rolls bypass public room metadata and remain strictly hidden from player roll feeds.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'range' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                <Ruler className="w-3 h-3 text-amber-400" />
                3D Range & Ballistics
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-1.5 text-[11px]">
                <p>
                  <strong className="text-amber-300 font-semibold">True Diagonal:</strong> Enter ground distance and height to calculate the exact 3D spell/attack range against airborne targets.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Jump Tool:</strong> Auto-calculates standing and running high/long jump distances based on Strength.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'notes' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                <FileText className="w-3 h-3 text-amber-400" />
                Note Taking & Scoped Vaults
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-1.5 text-[11px]">
                <p>
                  <strong className="text-amber-300 font-semibold">Scoped Vaults:</strong> <strong className="text-slate-100">My Notes</strong> is local and private; <strong className="text-slate-100">Table Notes</strong> syncs live across the whole party; <strong className="text-rose-400">DM Notes</strong> is GM-encrypted prep storage.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Gated Table Broadcast:</strong> Table-wide broadcasting is an exclusive GM feature located strictly in the <strong className="text-amber-400">DM Notes</strong> tab. Clicking the broadcast radio icon (<Radio className="inline w-3 h-3 text-amber-400 align-text-bottom" />) reveals a popup on all players' screens with 1-click clipboard copy.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">1-Tap Reader View (<Maximize2 className="inline w-3 h-3 text-amber-400 align-text-bottom" />):</strong> Tap directly from collapsed note headers to open full distraction-free reading mode with word counts.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Note Transfers:</strong> Move or copy notes between My Notes and Table Notes seamlessly via the card action strip.
                </p>
              </div>
            </div>

            {/* GM Exclusives */}
            {isGM && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  GM Exclusives
                </div>
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2 space-y-1.5 text-[11px]">
                  <p>
                    <strong className="text-amber-300 font-semibold">Story Categories:</strong> Access to <span className="text-indigo-400 font-semibold">Scene</span> (indigo) and <span className="text-fuchsia-400 font-semibold">Hook</span> (fuchsia) categories for adventure prep.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Broadcast Teardown:</strong> 1-click <em>Stop Revealing & Close</em> clears the broadcast from all player screens immediately.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Utility Strip */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950 text-[10px] text-slate-500 font-mono text-center select-none flex items-center justify-between">
        <span>Ashtapor v2.0.28</span>
        <span>Press Esc to close</span>
      </div>
    </div>
  );
};
