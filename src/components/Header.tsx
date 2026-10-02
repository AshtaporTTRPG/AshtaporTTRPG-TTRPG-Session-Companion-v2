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
} from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../utils/audio';

export type ActiveTab = 'combat' | 'dice' | 'geometry' | 'grimoire';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isDm: boolean;
  playerName: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDm,
  playerName,
}) => {
  const [soundOn, setSoundOn] = useState(isAudioEnabled());

  const handleToggleSound = () => {
    const newState = toggleAudio();
    setSoundOn(newState);
  };

  return (
    <header className="h-11 shrink-0 z-40 border-b border-neutral-800 bg-neutral-900/95 px-2 flex items-center justify-between select-none">
      {/* 4 Compact Tabs on Single Header Row: [⚔️ Combat] [🎲 Dice] [📐 3D Range] [📖 Grimoire] */}
      <nav className="flex items-center gap-1 p-0.5 bg-neutral-950/80 rounded-lg border border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTab('combat')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'combat'
              ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Combat Tracker"
        >
          <Swords className="w-3.5 h-3.5 shrink-0" />
          <span>Combat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dice')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'dice'
              ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Dice Tray & Staged Pool"
        >
          <Dices className="w-3.5 h-3.5 shrink-0" />
          <span>Dice</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('geometry')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'geometry'
              ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="3D Range & Jump/Fall Calculator"
        >
          <Ruler className="w-3.5 h-3.5 shrink-0" />
          <span>3D Range</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grimoire')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'grimoire'
              ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Ashtapor Homebrew Grimoire"
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Grimoire</span>
        </button>
      </nav>

      {/* Right Controls: Role Badge & Sound Mute Toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
            isDm
              ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
              : 'bg-cyan-950/80 border-cyan-600/70 text-cyan-300'
          }`}
          title={`Logged in as ${playerName} (${isDm ? 'GM' : 'Player'})`}
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
      </div>
    </header>
  );
};
