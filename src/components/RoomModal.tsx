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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [statusText, setStatusText] = useState<string>('Offline');
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
      if (conn.lastError) {
        setErrorMessage(conn.lastError);
      }

      const unsub = roomSync.subscribePresence((state) => {
        setPeers(state.peers);
        setConnectedCount(state.connectedCount);
        setIsHosted(state.isHosted);
        setHostName(state.hostName);
        setConnectionStatus(state.status);
        setStatusText(state.statusText);
        if (state.lastError) {
          setErrorMessage(state.lastError);
        } else if (state.status !== 'error') {
          setErrorMessage(null);
        }
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
      roomSync.configure(cleanRoom, cleanName, true);
      const res = roomSync.hostRoom();
      if (!res.success && res.reason) {
        setErrorMessage(res.reason);
        return;
      }
    } else {
      // Player mode: explicit connect to DM host via WebRTC
      roomSync.configure(cleanRoom, cleanName, false);
      roomSync.joinRoom();
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

  // Host Teardown: Stop hosting, destroy peer instance, reset to Offline
  const handleUnhostRoom = () => {
    roomSync.stopHosting();
    setIsHosted(false);
    setErrorMessage(null);
  };

  // Player Teardown: Disconnect / Leave session, destroy peer instance, reset to Offline
  const handleLeaveRoom = () => {
    roomSync.disconnect();
    setErrorMessage(null);
  };

  const handleRetry = () => {
    setErrorMessage(null);
    roomSync.retryConnection();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-5 h-5 ${
                connectionStatus === 'hosting' || connectionStatus === 'connected'
                  ? 'text-emerald-400 animate-pulse'
                  : connectionStatus === 'connecting'
                  ? 'text-amber-400 animate-spin'
                  : connectionStatus === 'error' || connectionStatus === 'disconnected'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            />
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

        {/* Clear UI Status Indicators:
            1. Offline (Default state)
            2. Connecting to broker...
            3. Hosting: Room [CODE] (with a 1-click Copy Join Link button)
            4. Connected to DM (Player view)
            5. Disconnected / Host Closed
            6. Connection Failed - Click to Retry
        */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            connectionStatus === 'hosting' || connectionStatus === 'connected'
              ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200'
              : connectionStatus === 'connecting'
              ? 'bg-amber-950/60 border-amber-500/70 text-amber-200'
              : connectionStatus === 'disconnected'
              ? 'bg-rose-950/60 border-rose-500/70 text-rose-200'
              : connectionStatus === 'error'
              ? 'bg-rose-950/80 border-rose-500/80 text-rose-200'
              : 'bg-slate-950/90 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              {(connectionStatus === 'hosting' || connectionStatus === 'connected') && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              {connectionStatus === 'connecting' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  connectionStatus === 'hosting' || connectionStatus === 'connected'
                    ? 'bg-emerald-400'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : connectionStatus === 'disconnected' || connectionStatus === 'error'
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
                    connectionStatus === 'hosting' || connectionStatus === 'connected'
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 animate-pulse'
                      : connectionStatus === 'disconnected' || connectionStatus === 'error'
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {connectionStatus === 'hosting'
                    ? `HOSTING: ROOM ${roomInput}`
                    : connectionStatus === 'connected'
                    ? 'CONNECTED TO DM'
                    : connectionStatus === 'connecting'
                    ? 'CONNECTING TO BROKER...'
                    : connectionStatus === 'disconnected'
                    ? 'DISCONNECTED / HOST CLOSED'
                    : connectionStatus === 'error'
                    ? 'CONNECTION FAILED - CLICK TO RETRY'
                    : 'OFFLINE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                {connectionStatus === 'hosting'
                  ? `Hosting live WebRTC session in room ${roomInput}. Share join link with remote players.`
                  : connectionStatus === 'connected'
                  ? `Connected to DM (${hostName || 'Host'}). Combat state and rolls sync in real-time.`
                  : connectionStatus === 'connecting'
                  ? 'Connecting to broker signaling server...'
                  : connectionStatus === 'disconnected'
                  ? 'Host is currently disconnected or session ended. Click to retry.'
                  : connectionStatus === 'error'
                  ? errorMessage || 'Connection failed. Auto-reconnect stopped. Click to Retry.'
                  : isDm
                  ? 'Offline (Default state). Click "Host & Start Room" below to initialize PeerJS.'
                  : 'Offline (Default state). Enter Room Code and click "Join Room" to connect.'}
              </p>
            </div>
          </div>

          {/* Quick action buttons in status banner */}
          <div className="flex items-center gap-2 shrink-0">
            {connectionStatus === 'hosting' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="1-click Copy Shareable Join Link for Players"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Join Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnhostRoom}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-600/60 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Stop Hosting / End Session"
                >
                  <Square className="w-3.5 h-3.5 text-rose-400" />
                  <span>Stop Hosting</span>
                </button>
              </>
            )}

            {connectionStatus === 'connected' && !isDm && (
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 transition cursor-pointer flex items-center gap-1.5"
                title="Disconnect / Leave Session"
              >
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Leave Session</span>
              </button>
            )}

            {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Retry connecting to host"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Click to Retry</span>
              </button>
            )}
          </div>
        </div>

        {/* Error notification if role conflict or connection error */}
        {errorMessage && connectionStatus !== 'error' && (
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
              ? 'Click "Host & Start Room" to initialize WebRTC hosting. Google STUN servers allow players across different networks and devices to connect.'
              : 'Enter the Room Code or open the DM join link. Click "Join Room" to connect to the DM host instance and sync initiative, combat, and feed.'}
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

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div>
              {isDm && connectionStatus === 'hosting' ? (
                <button
                  type="button"
                  onClick={handleUnhostRoom}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Square className="w-3.5 h-3.5 text-rose-400" />
                  <span>Stop Hosting / End Session</span>
                </button>
              ) : !isDm && connectionStatus === 'connected' ? (
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 cursor-pointer flex items-center gap-1.5 transition"
                >
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Leave Session</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {connectionStatus === 'hosting' || connectionStatus === 'connected' ? 'Close' : 'Cancel'}
              </button>

              {!(isDm && connectionStatus === 'hosting') && !(!isDm && connectionStatus === 'connected') && (
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
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
