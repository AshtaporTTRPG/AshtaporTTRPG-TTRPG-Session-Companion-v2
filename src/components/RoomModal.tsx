import React, { useState, useEffect } from 'react';
import { roomSync, PeerInfo } from '../utils/roomSync';
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
  Play,
  Square,
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
  const [copied, setCopied] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [isHosted, setIsHosted] = useState<boolean>(false);
  const [hostName, setHostName] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRoomInput(currentRoomCode);
      setNameInput(roomSync.getPeerName());
      setErrorMessage(null);
      setPeers(roomSync.getPeers());
      const hostInfo = roomSync.getHostInfo();
      setIsHosted(hostInfo.isHosted);
      setHostName(hostInfo.hostName);

      const unsub = roomSync.subscribePresence((state) => {
        setPeers(state.peers);
        setIsHosted(state.isHosted);
        setHostName(state.hostName);
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
      // Player mode: connect as player only
      roomSync.connect(cleanRoom, cleanName, false);
    }

    onUpdateRoom(cleanRoom, cleanName);
    onClose();
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomInput.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${isHosted ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
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

        {/* Room Live / Offline Visual Status Badge */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isHosted
              ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200'
              : 'bg-slate-950/90 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              {isHosted && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isHosted ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              ></span>
            </span>
            <div>
              <div className="text-xs font-bold font-display uppercase tracking-wider flex items-center gap-2">
                <span>Room Status: {isHosted ? 'Hosted & Live' : 'Not Hosted / Offline'}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isHosted
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isHosted ? 'ACTIVE GREEN' : 'MUTED IDLE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isHosted
                  ? `Dungeon Master (${hostName || 'DM'}) is hosting live session.`
                  : isDm
                  ? 'Click "Host & Start Room" below to start hosting the session.'
                  : 'Waiting for the Dungeon Master to host and start the room.'}
              </p>
            </div>
          </div>

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

        {/* Error notification if role conflict */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Role Enforcement Explanation */}
        <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
          <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
            {isDm ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Shield className="w-3.5 h-3.5 text-cyan-400" />}
            <span>Role: {isDm ? 'Dungeon Master (Host Authority)' : 'Player Companion'}</span>
          </div>
          {isDm ? (
            <p>
              As the Dungeon Master, only you can host and start the room. Only one DM can exist per room to guarantee campaign integrity.
            </p>
          ) : (
            <p>
              Players connect using the Room Code provided by the DM. Players cannot start or host the room.
            </p>
          )}
        </div>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Room Code *
            </label>
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
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Random</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Room Code"
                className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
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

          {/* Active Connected Peers List */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Connected in Room ({peers.length + 1}):
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                ● Zero-Drop Sync
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
