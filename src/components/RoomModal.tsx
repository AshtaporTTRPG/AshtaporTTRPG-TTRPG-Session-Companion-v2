import React, { useState, useEffect } from 'react';
import { roomSync, PeerInfo, ConnectionStatus } from '../utils/roomSync';
import {
  Users,
  Copy,
  Check,
  Radio,
  LogIn,
  Crown,
  Shield,
  X,
  RefreshCw,
  AlertCircle,
  Square,
  Link,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDm: boolean;
  currentRoomCode: string;
  onUpdateRoom: (code: string, name: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  isDm,
  currentRoomCode,
  onUpdateRoom,
}) => {
  const [roomInput, setRoomInput] = useState(currentRoomCode);
  const [nameInput, setNameInput] = useState(roomSync.getPeerName());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [connectedCount, setConnectedCount] = useState<number>(1);
  const [isHosted, setIsHosted] = useState<boolean>(false);
  const [hostName, setHostName] = useState<string | undefined>(undefined);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [statusText, setStatusText] = useState<string>('Not Connected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRoomInput(currentRoomCode);
      setNameInput(roomSync.getPeerName());
      setErrorMessage(null);
      setPeers(roomSync.getPeers());
      setConnectedCount(roomSync.getConnectedCount());

      const hostInfo = roomSync.getHostInfo();
      setIsHosted(hostInfo.isHosted);
      setHostName(hostInfo.hostName);

      const conn = roomSync.getConnectionStatus();
      setConnectionStatus(conn.status);
      setStatusText(conn.statusText);

      const unsub = roomSync.subscribePresence((state) => {
        setPeers(state.peers);
        setConnectedCount(state.connectedCount);
        setIsHosted(state.isHosted);
        setHostName(state.hostName);
        setConnectionStatus(state.status);
        setStatusText(state.statusText);
      });
      return () => unsub();
    }
  }, [isOpen, currentRoomCode]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!roomInput.trim()) return;

    const cleanRoom = roomInput.trim().toUpperCase();
    const cleanName = nameInput.trim() || (isDm ? 'Dungeon Master' : 'Player');

    // Role Enforcement check: only DM can host
    if (isDm) {
      const check = roomSync.canClaimDm();
      if (!check.allowed && cleanRoom === currentRoomCode) {
        setErrorMessage(
          `Cannot host as DM: ${check.existingDmName || 'Another DM'} is already active in room ${cleanRoom}. Only one DM is permitted per room.`
        );
        return;
      }
      roomSync.connect(cleanRoom, cleanName, true);
      roomSync.hostRoom();
    } else {
      // Player mode: connect as player directly to DM host via WebRTC
      roomSync.connect(cleanRoom, cleanName, false);
    }

    onUpdateRoom(cleanRoom, cleanName);
    onClose();
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomInput.toUpperCase());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const joinLink = roomSync.getShareableJoinLink();
    navigator.clipboard?.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerateRandomCode = () => {
    const prefixes = ['DRAGON', 'DUNGEON', 'MYTHIC', 'TAVERN', 'REALM', 'HERO'];
    const num = Math.floor(Math.random() * 900) + 100;
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    setRoomInput(`${prefix}-${num}`);
  };

  const handleUnhostRoom = () => {
    roomSync.unhostRoom();
    setIsHosted(false);
  };

  const handleRetry = () => {
    roomSync.retryConnection();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${isHosted || connectionStatus === 'connected' ? 'text-emerald-400 animate-pulse' : connectionStatus === 'connecting' ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
            <h3 className="text-base sm:text-lg font-bold text-slate-100 font-display">
              {isDm ? 'Host & Manage Session Room' : 'Join Tabletop Session Room'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Networking & Connection State Status Banner */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            connectionStatus === 'connected' || (isDm && isHosted)
              ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200'
              : connectionStatus === 'connecting'
              ? 'bg-amber-950/60 border-amber-500/70 text-amber-200'
              : connectionStatus === 'disconnected'
              ? 'bg-rose-950/60 border-rose-500/70 text-rose-200'
              : 'bg-slate-950/90 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              {(connectionStatus === 'connected' || (isDm && isHosted)) && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              {connectionStatus === 'connecting' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  connectionStatus === 'connected' || (isDm && isHosted)
                    ? 'bg-emerald-400'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : connectionStatus === 'disconnected'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              ></span>
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold font-display uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>Status:</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    connectionStatus === 'connected' || (isDm && isHosted)
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 animate-pulse'
                      : connectionStatus === 'disconnected'
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {connectionStatus === 'connected'
                    ? isDm
                      ? 'HOSTING LIVE'
                      : 'CONNECTED'
                    : connectionStatus === 'connecting'
                    ? 'CONNECTING...'
                    : connectionStatus === 'disconnected'
                    ? 'HOST DISCONNECTED'
                    : 'OFFLINE'}
                </span>
                <span className="text-[11px] text-slate-400 font-sans normal-case truncate">
                  ({statusText})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {isDm
                  ? isHosted
                    ? `Hosting remote WebRTC session in room ${roomInput}. Share join link with players.`
                    : 'Click "Host & Start Room" below to start hosting on any network.'
                  : connectionStatus === 'connected'
                  ? `Connected to DM (${hostName || 'Host'}). Rolls and combat sync in real time.`
                  : connectionStatus === 'connecting'
                  ? 'Establishing peer connection to DM host instance...'
                  : connectionStatus === 'disconnected'
                  ? 'Host is currently disconnected or offline. You can retry anytime.'
                  : 'Enter the Room Code provided by the DM to join.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isDm && connectionStatus === 'disconnected' && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1"
                title="Retry connecting to host"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Retry</span>
              </button>
            )}

            {isDm && isHosted && (
              <button
                type="button"
                onClick={handleUnhostRoom}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1 shrink-0"
                title="Stop hosting and mark room as offline"
              >
                <Square className="w-3 h-3 text-rose-400" />
                <span>Unhost</span>
              </button>
            )}
          </div>
        </div>

        {/* Error notification if role conflict */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Cross-device Networking Info Banner */}
        <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="font-semibold text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isDm ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Shield className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{isDm ? 'Dungeon Master (Host Instance)' : 'Player Remote Companion'}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <Wifi className="w-3 h-3" />
              <span>WebRTC Peer-to-Peer</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {isDm
              ? 'Host from your laptop. Players join from phones, tablets, or computers from any network. No custom server required.'
              : 'Directly connects to the DM host instance to sync initiative order, combatants, rolls, and live feed messages.'}
          </p>
        </div>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Room Code / ID *
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Share with your table</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="e.g. DRAGON-77"
                className="flex-1 px-3 py-2 text-sm font-mono font-bold tracking-wider rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 uppercase"
                required
              />
              {isDm && (
                <button
                  type="button"
                  onClick={handleGenerateRandomCode}
                  title="Generate new random room code"
                  className="px-2.5 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Random</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Room Code"
                className="px-2.5 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Code'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                title="Copy direct Join Link for players"
                className="px-3 py-2 text-xs font-medium rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5 text-amber-400" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Join Link'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Your Display Name *
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Dungeon Master, Valerius, Lyra"
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          {/* Active Connected Peers List & Counter */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Connected in Room ({connectedCount}):
              </span>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                ● Live Cross-Device Sync
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-200">
                {isDm ? <Crown className="w-3 h-3 text-amber-400" /> : <Shield className="w-3 h-3 text-cyan-400" />}
                <span className="font-semibold">{nameInput || 'You'}</span> (You - {isDm ? 'DM Host' : 'Player'})
              </span>

              {peers.map((peer) => (
                <span
                  key={peer.id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                >
                  {peer.isDm ? <Crown className="w-3 h-3 text-amber-400" /> : <Shield className="w-3 h-3 text-slate-400" />}
                  <span>{peer.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono">({peer.isDm ? 'DM' : 'Player'})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-bold rounded-lg cursor-pointer transition shadow-md flex items-center gap-1.5 ${
                isDm
                  ? 'text-slate-950 bg-amber-400 hover:bg-amber-300'
                  : 'text-slate-950 bg-cyan-400 hover:bg-cyan-300'
              }`}
            >
              {isDm ? <Crown className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isDm ? 'Host & Start Room' : 'Join Room'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
