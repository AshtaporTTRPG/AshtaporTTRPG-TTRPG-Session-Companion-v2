import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Shield,
  Crown,
  Swords,
  Dices,
  Ruler,
} from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../utils/audio';

interface HeaderProps {
  activeTab: 'combat' | 'dice' | 'geometry';
  setActiveTab: (tab: 'combat' | 'dice' | 'geometry') => void;
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
    <header className="h-10 px-2.5 bg-slate-950 border-b border-slate-800/90 flex items-center justify-between shrink-0 select-none z-30">
      {/* Brand wordmark - compact */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-bold tracking-wider text-amber-400 font-display flex items-center gap-1">
          <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden xs:inline">Ashtapor</span>
        </span>
      </div>

      {/* Center: 3 Compact Icon Tabs [Combat] [Dice] [3D Range] */}
      <nav className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('combat')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'combat'
              ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Unified Combat Tracker"
        >
          <Swords className="w-3.5 h-3.5 shrink-0" />
          <span>Combat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dice')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'dice'
              ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Dice Tray & Multi-D20 Engine"
        >
          <Dices className="w-3.5 h-3.5 shrink-0" />
          <span>Dice</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('geometry')}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'geometry'
              ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="3D Range & Triangle Geometry"
        >
          <Ruler className="w-3.5 h-3.5 shrink-0" />
          <span>3D Range</span>
        </button>
      </nav>

      {/* Right: Role indicator & Sound Toggle */}
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
          title={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
          aria-label={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
        >
          {soundOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>
    </header>
  );
};
