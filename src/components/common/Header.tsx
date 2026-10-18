import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Shield,
  Crown,
} from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../../utils/audio';
import { ContextualHelpTooltip } from './ContextualHelpTooltip';

export type ActiveTab = 'combat' | 'dice' | 'range' | 'geometry' | 'grimoire' | 'notes';

export interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isDm: boolean;
  playerName: string;
  isPinned: boolean;
  onTogglePin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDm,
  playerName,
  isPinned,
  onTogglePin,
}) => {
  const [soundOn, setSoundOn] = useState(isAudioEnabled());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [hasSeenHelp, setHasSeenHelp] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ashtapor_help_seen') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSound = () => {
    const newState = toggleAudio();
    setSoundOn(newState);
  };

  const handleToggleHelp = () => {
    const next = !isHelpOpen;
    setIsHelpOpen(next);
    if (!hasSeenHelp) {
      setHasSeenHelp(true);
      try {
        localStorage.setItem('ashtapor_help_seen', 'true');
      } catch {}
    }
  };

  return (
    <header className="shrink-0 z-40 bg-neutral-900/95 border-b border-neutral-800 relative">
      {/* Row A: Slim Utility Micro-Bar (22px height) */}
      <div className="h-6 px-2.5 bg-neutral-950/90 border-b border-neutral-800/80 flex items-center justify-between text-[11px]">
        {/* Left: App Identity & Player Tag */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs leading-none">⚔️</span>
          <span className="font-bold text-[11px] font-display text-neutral-200 tracking-wide">
            Ashtapor
          </span>
          <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[120px]">
            · {playerName}
          </span>
        </div>

        {/* Right: Relocated Utility Controls (Help Guide, GM/PC badge, Audio Toggle, Pin Button) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Guide Trigger Button [ ? ] immediately adjacent to GM/PC badge */}
          <button
            type="button"
            data-help-trigger="true"
            onClick={handleToggleHelp}
            className="relative w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 flex items-center justify-center font-bold text-xs transition-colors shrink-0 cursor-pointer"
            title="Quick Guide (Help)"
            aria-label="Quick Guide (Help)"
          >
            ?
            {!hasSeenHelp && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          {/* Ultra-compact GM / PC Role Badge */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
              isDm
                ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
                : 'bg-cyan-950/80 border-cyan-600/70 text-cyan-300'
            }`}
            title={`Role: ${isDm ? 'Game Master (GM)' : 'Player (PC)'} - ${playerName}`}
          >
            {isDm ? (
              <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            ) : (
              <Shield className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            )}
            <span>{isDm ? 'GM' : 'PC'}</span>
          </div>

          {/* Audio Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundOn ? 'Mute Audio' : 'Unmute Audio'}
            aria-label={soundOn ? 'Mute Audio' : 'Unmute Audio'}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            {soundOn ? (
              <Volume2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <VolumeX className="w-3 h-3 text-neutral-500" />
            )}
          </button>

          {/* Window Pin Toggle Button (📌): Disables popover click-away in Owlbear */}
          <button
            type="button"
            onClick={onTogglePin}
            title={isPinned ? 'Window Pinned (Click-away disabled)' : 'Pin Window (Prevent auto-closing)'}
            aria-label={isPinned ? 'Window Pinned (Click-away disabled)' : 'Pin Window (Prevent auto-closing)'}
            className={`px-1 py-0.5 text-[11px] rounded border transition cursor-pointer flex items-center justify-center ${
              isPinned
                ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/50 shadow-sm'
                : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <span className={`leading-none ${isPinned ? 'scale-110 drop-shadow' : 'opacity-70'}`}>
              📌
            </span>
          </button>
        </div>
      </div>

      {/* Row B: 5 Navigation Tabs (Exact 5-column grid: ZERO horizontal scroll, perfectly visible) */}
      <nav className="w-full grid grid-cols-5 gap-1 p-1 bg-neutral-900 select-none overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('combat')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
            activeTab === 'combat'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Unified Combat Tracker & Combat Feed"
        >
          <span className="text-xs leading-none select-none">⚔️</span>
          <span className="truncate">Combat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dice')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
            activeTab === 'dice'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Dice Tray (formula bar, staged dice pool, multi-d20 engine, macros, roll feed)"
        >
          <span className="text-xs leading-none select-none">🎲</span>
          <span className="truncate">Dice</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('range')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
            activeTab === 'range' || (activeTab as string) === 'geometry'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="3D Range Finder & Homebrew Jump/Fall damage tools"
        >
          <span className="text-xs leading-none select-none">📐</span>
          <span className="truncate">3D Range</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grimoire')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
            activeTab === 'grimoire'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Ashtapor Homebrew Rules reference with search"
        >
          <span className="text-xs leading-none select-none">📖</span>
          <span className="truncate">Grimoire</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
            activeTab === 'notes'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Scoped 3-tier Notes: My Notes, Table Notes, DM Notes"
        >
          <span className="text-xs leading-none select-none">📝</span>
          <span className="truncate">Notes</span>
        </button>
      </nav>

      {/* Floating Contextual Help Tooltip */}
      <ContextualHelpTooltip
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        activeAppTab={activeTab}
        isGM={isDm}
      />
    </header>
  );
};
