import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Shield,
  Crown,
  Sparkles,
  Swords,
  Dices,
  Box,
  Map as MapIcon,
  BookOpen,
} from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../utils/audio';

interface HeaderProps {
  activeTab: 'combat' | 'dice' | 'geometry' | 'map' | 'notes';
  setActiveTab: (tab: 'combat' | 'dice' | 'geometry' | 'map' | 'notes') => void;
  isDm: boolean;
  playerName: string;
  onOpenRoadmap: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDm,
  playerName,
  onOpenRoadmap,
}) => {
  const [soundOn, setSoundOn] = useState(isAudioEnabled());

  const handleToggleSound = () => {
    const newState = toggleAudio();
    setSoundOn(newState);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Left Zone: Brand Wordmark */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('combat');
            }}
            className="text-base sm:text-lg font-bold tracking-wider text-amber-300 font-display transition-colors hover:text-amber-200 flex items-center gap-1.5"
          >
            <Swords className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Ashtapor Companion</span>
          </a>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs sm:text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('combat')}
            className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'combat' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Combat Tracker</span>
          </button>
          <button
            onClick={() => setActiveTab('dice')}
            className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'dice' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Dice Chamber</span>
          </button>
          <button
            onClick={() => setActiveTab('geometry')}
            className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'geometry' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Geometry</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'map' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Maps</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`hover:text-amber-200 transition-colors cursor-pointer pb-0.5 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'notes' ? 'text-amber-300 font-semibold border-b-2 border-amber-400' : ''
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Notes &amp; Reference</span>
          </button>
        </nav>

        {/* Right Zone: Native OBR Role Badge, Audio Toggle, Guide */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Native OBR Identity & Role Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs rounded-lg border shadow-sm ${
              isDm
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
            }`}
            title={`Owlbear Rodeo ${isDm ? 'Game Master' : 'Player'}: ${playerName}`}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            {isDm ? (
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className="font-bold uppercase tracking-wider text-[11px]">
              {isDm ? 'GM' : 'Player'}
            </span>
            <span className="text-slate-400 font-normal truncate max-w-[120px] hidden sm:inline">
              · {playerName}
            </span>
          </div>

          {/* Audio Toggle */}
          <button
            onClick={handleToggleSound}
            title={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
            aria-label={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Guide / Reference Button */}
          <button
            onClick={onOpenRoadmap}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Guide</span>
          </button>
        </div>
      </div>

      {/* Responsive Mobile / Tablet Navigation Tab Bar */}
      <div className="lg:hidden border-t border-slate-800/80 px-2 py-1.5 bg-slate-950 overflow-x-auto scrollbar-none flex items-center gap-1">
        <button
          onClick={() => setActiveTab('combat')}
          className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'combat'
              ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Swords className="w-3 h-3" />
          <span>Combat</span>
        </button>
        <button
          onClick={() => setActiveTab('dice')}
          className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'dice'
              ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dices className="w-3 h-3" />
          <span>Dice</span>
        </button>
        <button
          onClick={() => setActiveTab('geometry')}
          className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'geometry'
              ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-3 h-3" />
          <span>Geometry</span>
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'map'
              ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-3 h-3" />
          <span>Maps</span>
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'notes'
              ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3 h-3" />
          <span>Notes</span>
        </button>
        <button
          onClick={onOpenRoadmap}
          className="md:hidden px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition cursor-pointer flex items-center gap-1 text-amber-300 bg-amber-950/60 border border-amber-800/60 shrink-0"
        >
          <Sparkles className="w-3 h-3" />
          <span>Guide</span>
        </button>
      </div>
    </header>
  );
};
