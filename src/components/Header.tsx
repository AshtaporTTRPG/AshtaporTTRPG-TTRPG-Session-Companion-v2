import React from 'react';
import { Volume2, VolumeX, Shield, Users, Sparkles, Radio, Crown } from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../utils/audio';

interface HeaderProps {
  activeTab: 'combat' | 'dice' | 'geometry' | 'map' | 'notes';
  setActiveTab: (tab: 'combat' | 'dice' | 'geometry' | 'map' | 'notes') => void;
  isDm: boolean;
  setIsDm: (isDm: boolean) => void;
  onOpenRoadmap: () => void;
  roomCode: string;
  onOpenRoomModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDm,
  setIsDm,
  onOpenRoadmap,
  roomCode,
  onOpenRoomModal,
}) => {
  const [soundOn, setSoundOn] = React.useState(isAudioEnabled());

  const handleToggleSound = () => {
    const newState = toggleAudio();
    setSoundOn(newState);
  };

  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('combat');
          }}
          className="text-lg font-bold tracking-wider text-amber-300 font-display transition-colors hover:text-amber-200"
        >
          Ashtapor TTRPG
        </a>
      </div>

      {/* Zone 2: Clean Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('combat')}
          className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
            activeTab === 'combat' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
          }`}
        >
          Combat Tracker
        </button>
        <button
          onClick={() => setActiveTab('dice')}
          className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
            activeTab === 'dice' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
          }`}
        >
          Dice Chamber
        </button>
        <button
          onClick={() => setActiveTab('geometry')}
          className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
            activeTab === 'geometry' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
          }`}
        >
          3D Geometry
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
            activeTab === 'map' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
          }`}
        >
          Maps
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
            activeTab === 'notes' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
          }`}
        >
          Notes &amp; Reference
        </button>
      </nav>

      {/* Zone 3: Primary Actions (Room, DM Mode, Audio, Roadmap) */}
      <div className="flex items-center gap-2.5">
        {/* Room Connection Button (Host / Join Room) */}
        <button
          onClick={onOpenRoomModal}
          title={isDm ? "Host Room Settings" : "Join or Switch Room"}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-emerald-950/80 border border-emerald-500/70 text-emerald-300 hover:bg-emerald-900 transition-all cursor-pointer shadow-sm"
        >
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>{roomCode}</span>
          <span className="text-[10px] text-emerald-400/80 font-normal hidden sm:inline">
            ({isDm ? 'Host' : 'Joined'})
          </span>
        </button>

        {/* Role Switcher */}
        <button
          onClick={() => setIsDm(!isDm)}
          title={`Switch to ${isDm ? 'Player' : 'Dungeon Master'} Mode`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          {isDm ? (
            <>
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>DM Mode</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Player Mode</span>
            </>
          )}
        </button>

        {/* Audio Toggle */}
        <button
          onClick={handleToggleSound}
          title={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
          aria-label={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>

        {/* Improvement Architecture Guide Button */}
        <button
          onClick={onOpenRoadmap}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-950" />
          <span>Guide</span>
        </button>
      </div>
    </header>
  );
};
