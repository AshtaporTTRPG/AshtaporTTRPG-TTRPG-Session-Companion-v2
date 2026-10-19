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
                Combat Mechanics
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-1.5 text-[11px]">
                <p>
                  <strong className="text-amber-300 font-semibold">Join Combat:</strong> Save your PC in{' '}
                  <Users className="inline w-3 h-3 text-amber-400 align-text-bottom" /> <strong>Roster</strong> and tap{' '}
                  <strong className="text-slate-100">Join Combat</strong> to roll initiative automatically.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Active Turn:</strong> The current turn glows gold; a notification chime sounds when your turn begins.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">1-Tap Health:</strong> In compact mode, click HP numbers (<code className="text-amber-300 font-mono text-[10px] px-1 py-0.5 rounded bg-slate-800">30/30</code>) directly to log damage/healing without expanding the card.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">
                    Expand (<ChevronDown className="inline w-3 h-3 text-slate-400 align-text-bottom" />):
                  </strong>{' '}
                  Access <code className="text-amber-300 font-mono text-[10px]">-5/-1/+1/+5</code> quick tallies, Temp HP, and condition tags.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Death Saves:</strong> Pop up at 0 HP. Clicks sync live to the table and clear automatically upon healing.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Table Feed:</strong> Tap{' '}
                  <MessageSquare className="inline w-3 h-3 text-amber-400 align-text-bottom" /> <strong>Feed</strong> at the bottom to view real-time logs.
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
                    <strong className="text-amber-300 font-semibold">Combat Lifecycle:</strong> In Prep (Idle), sort initiative or launch encounter with <strong className="text-amber-400">⚔️ Start Combat</strong>. In Active mode, cassette controls (<code className="text-amber-300 font-mono text-[10px]">⏮</code> Rewind to R1 T1, <code className="text-amber-300 font-mono text-[10px]">◀</code> Prev, <code className="text-amber-300 font-mono text-[10px]">▶</code> Next) drive turn flow.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Linked Allies:</strong> Link allies to PCs for synchronized turns; displays clean integer initiative while strictly preserving order.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Hostile Masking:</strong> Hostile HP is automatically masked (<code className="text-amber-300 font-mono text-[10px]">???/???</code>) and monster healing is silenced in player feeds.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Smart Reset:</strong> Clear hostiles only or trigger a complete encounter teardown.
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
                Dice Mechanics
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-1.5 text-[11px]">
                <p>
                  <strong className="text-amber-300 font-semibold">Quick D20:</strong> Tap <code className="text-amber-300 font-mono text-[10px]">d20</code>, <code className="text-amber-300 font-mono text-[10px]">Adv</code>, or <code className="text-amber-300 font-mono text-[10px]">Dis</code> at the top for instant rolls. These are sandboxed and will not disturb staged dice below.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Combined Roll Buttons:</strong> Use <strong className="text-amber-400">Roll (Sum)</strong> for combined totals, or <strong className="text-slate-200">Indiv</strong> for individual die result breakdowns.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Direct Formula Modifiers:</strong> Tap quick chips (<code className="text-amber-300 font-mono text-[10px]">+1</code> to <code className="text-amber-300 font-mono text-[10px]">+5</code>, <code className="text-rose-400 font-mono text-[10px]">-1</code>, <code className="text-rose-400 font-mono text-[10px]">-2</code>) to append directly into your formula.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Math Calculator:</strong> Tap the calculator icon next to the formula input to compute complex modifiers and inject results with 1 tap.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Visibility:</strong> Toggle <strong className="text-slate-100">Public</strong> (table-wide), <strong className="text-slate-100">GM Only</strong> (secret DM whisper), or <strong className="text-slate-100">Self</strong> (private test roll).
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Macros:</strong> Save weapon attacks or complex spell expressions under <strong className="text-slate-100">+ Add Macro</strong> for 1-click rolling.
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
                    <strong className="text-amber-300 font-semibold">Secret Crits:</strong> <strong className="text-amber-200">GM Only</strong> rolls bypass public room metadata and remain completely hidden from player roll feeds.
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
                Note Taking & Vault
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 space-y-1.5 text-[11px]">
                <p>
                  <strong className="text-amber-300 font-semibold">Sub-Tabs:</strong> <strong className="text-slate-100">My Notes</strong> is local and private; <strong className="text-slate-100">Table Notes</strong> syncs live across the whole party.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">1-Tap Reader View (<Maximize2 className="inline w-3 h-3 text-amber-400 align-text-bottom" />):</strong> Tap directly from collapsed note headers to open full distraction-free reading mode.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">Note Transfers:</strong> Both players and GM can copy or move notes between My Notes and Table Notes seamlessly.
                </p>
                <p>
                  <strong className="text-amber-300 font-semibold">
                    Editing (<Pencil className="inline w-3 h-3 text-slate-400 align-text-bottom" />):
                  </strong>{' '}
                  Click the pencil icon to edit; clicking note text highlights it for copying rather than opening the editor.
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
                    <strong className="text-amber-300 font-semibold">DM Notes Vault:</strong> Encrypted, private GM prep storage.
                  </p>
                  <p>
                    <strong className="text-amber-300 font-semibold">Story Categories:</strong> Access to <span className="text-indigo-400 font-semibold">Scene</span> (indigo) and <span className="text-fuchsia-400 font-semibold">Hook</span> (fuchsia) categories for adventure prep.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Utility Strip */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950 text-[10px] text-slate-500 font-mono text-center select-none flex items-center justify-between">
        <span>Ashtapor v2.0.24</span>
        <span>Press Esc to close</span>
      </div>
    </div>
  );
};
