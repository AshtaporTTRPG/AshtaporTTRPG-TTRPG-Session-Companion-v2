import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Shield,
  Radio,
  Crown,
  Sparkles,
  Swords,
  Dices,
  Box,
  Map as MapIcon,
  BookOpen,
  AlertCircle,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { isAudioEnabled, toggleAudio } from '../utils/audio';
import { roomSync } from '../utils/roomSync';

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
  const [soundOn, setSoundOn] = useState(isAudioEnabled());
  const [connectedCount, setConnectedCount] = useState<number>(() => roomSync.getConnectedCount());
  const [isHosted, setIsHosted] = useState<boolean>(() => roomSync.isRoomHosted());
  const [connectionStatus, setConnectionStatus] = useState<string>(() => roomSync.getConnectionStatus().status);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const unsub = roomSync.subscribePresence((state) => {
      setConnectedCount(state.connectedCount);
      setIsHosted(state.isHosted);
      setConnectionStatus(state.status);
    });
    return () => unsub();
  }, [roomCode]);

  const handleToggleSound = () => {
    const newState = toggleAudio();
    setSoundOn(newState);
  };

  const handleSelectDmMode = () => {
    if (isDm) return; // Already DM
    const check = roomSync.canClaimDm();
    if (!check.allowed) {
      setRoleError(
        `Cannot switch to DM Mode: ${check.existingDmName || 'Another user'} is already hosting as the Dungeon Master in room ${roomCode}. Only one DM is permitted per room.`
      );
      return;
    }
    setRoleError(null);
    setIsDm(true);
    roomSync.configure(roomCode, roomSync.getPeerName(), true);
  };

  const handleSelectPlayerMode = () => {
    if (!isDm) return; // Already player
    setRoleError(null);
    setIsDm(false);
    roomSync.configure(roomCode, roomSync.getPeerName(), false);
  };

  const handleCopyJoinLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const joinLink = roomSync.getShareableJoinLink();
    navigator.clipboard?.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <>
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
              <span>Ashtapor TTRPG</span>
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

          {/* Right Zone: Session Button, Distinct Mode Buttons, Audio, Guide */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Session Indicator with Explicit Status & 1-click Copy Join Link */}
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenRoomModal}
                title={`Room ${roomCode} - ${
                  connectionStatus === 'hosting'
                    ? `Hosting: Room ${roomCode}`
                    : connectionStatus === 'connected'
                    ? 'Connected to DM'
                    : connectionStatus === 'reconnecting'
                    ? 'Reconnecting to Host...'
                    : connectionStatus === 'connecting'
                    ? 'Connecting to broker...'
                    : connectionStatus === 'disconnected'
                    ? 'Disconnected / Host Closed'
                    : connectionStatus === 'error'
                    ? 'Connection Failed - Click to Retry'
                    : 'Offline'
                }`}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer shadow-sm ${
                  connectionStatus === 'hosting' || connectionStatus === 'connected'
                    ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 hover:bg-emerald-900/90 hover:border-emerald-400'
                    : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                    ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 hover:bg-amber-900/90'
                    : connectionStatus === 'disconnected' || connectionStatus === 'error'
                    ? 'bg-rose-950/80 border-rose-600/70 text-rose-300 hover:bg-rose-900/90'
                    : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {(connectionStatus === 'hosting' || connectionStatus === 'connected') && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      connectionStatus === 'hosting' || connectionStatus === 'connected'
                        ? 'bg-emerald-400'
                        : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                        ? 'bg-amber-400'
                        : connectionStatus === 'disconnected' || connectionStatus === 'error'
                        ? 'bg-rose-500'
                        : 'bg-slate-500'
                    }`}
                  ></span>
                </span>
                <span className="truncate max-w-[130px] sm:max-w-none">
                  {connectionStatus === 'hosting'
                    ? `Hosting: Room ${roomCode}`
                    : connectionStatus === 'connected'
                    ? 'Connected to DM'
                    : connectionStatus === 'reconnecting'
                    ? 'Reconnecting...'
                    : connectionStatus === 'connecting'
                    ? 'Connecting to broker...'
                    : connectionStatus === 'disconnected'
                    ? 'Disconnected / Host Closed'
                    : connectionStatus === 'error'
                    ? 'Connection Failed'
                    : 'Offline'}
                </span>
                {(connectionStatus === 'hosting' || connectionStatus === 'connected') && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {connectedCount}
                  </span>
                )}
              </button>

              {/* 1-Click Copy Join Link Button when Hosting */}
              {connectionStatus === 'hosting' && (
                <button
                  type="button"
                  onClick={handleCopyJoinLink}
                  title="1-click Copy Join Link for players"
                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden xl:inline text-[11px] font-mono">{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              )}
            </div>

            {/* TWO DISTINCT MODE BUTTONS: DM MODE & PLAYER MODE */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-900/90 border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={handleSelectDmMode}
                title="Dungeon Master Mode - Full combat control, monster HP, secret notes"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  isDm
                    ? 'bg-amber-400 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Crown className={`w-3.5 h-3.5 ${isDm ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>DM Mode</span>
              </button>
              <button
                type="button"
                onClick={handleSelectPlayerMode}
                title="Player Companion Mode - Safe player view with FoW obfuscation"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  !isDm
                    ? 'bg-cyan-500 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Shield className={`w-3.5 h-3.5 ${!isDm ? 'text-slate-950' : 'text-cyan-400'}`} />
                <span>Player Mode</span>
              </button>
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

            {/* Improvement Architecture Guide Button */}
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

      {/* Role Enforcement Conflict Alert Toast */}
      {roleError && (
        <div className="bg-rose-950/95 border-b border-rose-700/80 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{roleError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRoleError(null)}
            className="text-rose-300 hover:text-white p-1 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
