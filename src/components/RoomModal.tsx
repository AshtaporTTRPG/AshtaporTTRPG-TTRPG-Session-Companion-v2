import React, { useState, useEffect } from 'react';
import { roomSync, PeerInfo } from '../utils/roomSync';
import { Users, Copy, Check, Radio, LogIn, Crown, Shield, X, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      setRoomInput(currentRoomCode);
      setPeers(roomSync.getPeers());
      const interval = setInterval(() => {
        setPeers(roomSync.getPeers());
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, currentRoomCode]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    const cleanRoom = roomInput.trim().toUpperCase();
    const cleanName = nameInput.trim() || (isDm ? 'Dungeon Master' : 'Player');
    roomSync.connect(cleanRoom, cleanName, isDm);
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold text-slate-100 font-display">
              {isDm ? 'Host Tabletop Session Room' : 'Join Tabletop Session Room'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {isDm
            ? 'Host a synchronized room for your party. Connected players will see public dice rolls, and shared map pins and revealed notes in real time with zero dropouts.'
            : 'Enter the Room Code provided by your Dungeon Master to synchronize dice rolls and shared campaign map pins.'}
        </p>

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
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Random</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Room Code"
                className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Your Name / Character *
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
                Active in Room {currentRoomCode}:
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                ● Reliable Zero-Drop Sync
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-200">
                {isDm ? <Crown className="w-3 h-3 text-amber-400" /> : <Shield className="w-3 h-3 text-cyan-400" />}
                {nameInput || 'You'} (You)
              </span>

              {peers.map((peer) => (
                <span
                  key={peer.id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                >
                  {peer.isDm ? <Crown className="w-3 h-3 text-amber-400" /> : <Users className="w-3 h-3 text-slate-400" />}
                  {peer.name}
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
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer transition shadow-md flex items-center gap-1.5"
            >
              {isDm ? <Crown className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isDm ? 'Host Room' : 'Join Room'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
