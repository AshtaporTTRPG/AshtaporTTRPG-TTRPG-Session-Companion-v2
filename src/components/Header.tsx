import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Shield,
  Crown,
  Swords,
  Dices,
  Ruler,
  BookOpen,
  FileText,
  Pin,
} from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../utils/audio';

export type ActiveTab = 'combat' | 'dice' | 'range' | 'geometry' | 'grimoire' | 'notes';

interface HeaderProps {
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

  const handleToggleSound = () => {
    const newState = toggleAudio();
    setSoundOn(newState);
  };

  return (
    <header className="h-11 shrink-0 z-40 border-b border-neutral-800 bg-neutral-900/95 px-2 flex items-center justify-between select-none gap-1">
      {/* 5 Compact Tabs on Single Header Row: [⚔️ Combat] [🎲 Dice] [📐 3D Range] [📖 Grimoire] [📝 Notes] */}
      <nav className="flex items-center gap-1 p-0.5 bg-neutral-950/80 rounded-lg border border-neutral-800/80 overflow-x-auto min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('combat')}
          className={`flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'combat'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Unified Combat Tracker & Combat Feed"
        >
          <span className="text-xs leading-none select-none">⚔️</span>
          <span>Combat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dice')}
          className={`flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'dice'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Dice Tray (formula bar, staged dice pool, multi-d20 engine, macros, roll feed)"
        >
          <span className="text-xs leading-none select-none">🎲</span>
          <span>Dice</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('range')}
          className={`flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'range' || (activeTab as string) === 'geometry'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="3D Range Finder & Homebrew Jump/Fall damage tools"
        >
          <span className="text-xs leading-none select-none">📐</span>
          <span>3D Range</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grimoire')}
          className={`flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'grimoire'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Ashtapor Homebrew Rules reference with search"
        >
          <span className="text-xs leading-none select-none">📖</span>
          <span>Grimoire</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'notes'
              ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Persistent categorized Notes (General, NPCs, Loot, Clues, GM Tactics)"
        >
          <span className="text-xs leading-none select-none">📝</span>
          <span>Notes</span>
        </button>
      </nav>

      {/* Right Controls: Role Badge, Sound Mute Toggle, and Window Pin Toggle */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
            isDm
              ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
              : 'bg-cyan-950/80 border-cyan-600/70 text-cyan-300'
          }`}
          title={`Role: ${isDm ? 'Game Master (GM)' : 'Player (PC)'} - ${playerName}`}
        >
          {isDm ? (
            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
          ) : (
            <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
          )}
          <span>{isDm ? 'GM' : 'PC'}</span>
        </div>

        <button
          type="button"
          onClick={handleToggleSound}
          title={soundOn ? 'Mute Audio' : 'Unmute Audio'}
          aria-label={soundOn ? 'Mute Audio' : 'Unmute Audio'}
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
        >
          {soundOn ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-neutral-500" />
          )}
        </button>

        {/* Window Pin Toggle Button (📌): Disables popover click-away */}
        <button
          type="button"
          onClick={onTogglePin}
          title={isPinned ? 'Window Pinned (Click-away disabled)' : 'Pin Window (Prevent auto-closing)'}
          aria-label={isPinned ? 'Window Pinned (Click-away disabled)' : 'Pin Window (Prevent auto-closing)'}
          className={`px-1.5 py-0.5 text-xs rounded border transition cursor-pointer flex items-center justify-center gap-0.5 ${
            isPinned
              ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/50 shadow-sm'
              : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <span className={`text-xs leading-none transition-transform ${isPinned ? 'scale-110 drop-shadow' : 'opacity-70'}`}>
            📌
          </span>
        </button>
      </div>
    </header>
  );
};
