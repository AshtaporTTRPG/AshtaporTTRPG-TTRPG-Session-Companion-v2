// Reliable Cross-Device WebRTC & Multi-Tab Session Room Synchronization Utility
// Connects remote devices (phones, tablets, PCs) via PeerJS (WebRTC) using public cloud brokering
// and public STUN servers, backed by native BroadcastChannel for local multi-tab sync.

import Peer, { type DataConnection } from 'peerjs';

export interface PeerInfo {
  id: string;
  name: string;
  isDm: boolean;
  lastSeen: number;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface PresenceState {
  peers: PeerInfo[];
  connectedCount: number;
  isHosted: boolean;
  hostName?: string;
  status: ConnectionStatus;
  statusText: string;
}

export interface RoomMessage {
  type:
    | 'DICE_ROLL'
    | 'MAP_PIN_SYNC'
    | 'MAP_PIN_DELETE'
    | 'MAP_UPLOAD'
    | 'MAP_DELETE'
    | 'MAP_SWITCH'
    | 'MAP_METADATA_UPDATE'
    | 'COMBAT_SYNC'
    | 'COMBAT_FEED_EVENT'
    | 'COMBAT_TURN_ANNOUNCEMENT'
    | 'PEER_PING'
    | 'ROOM_STATE_REQUEST'
    | 'FEED_CLEAR'
    | 'ROOM_HOST_CLAIM'
    | 'ROOM_HOST_RELEASE'
    | 'PLAYER_HELLO'
    | 'ROOM_PRESENCE_SYNC'
    | 'INITIAL_STATE_SYNC';
  senderId: string;
  senderName: string;
  isDm: boolean;
  payload: any;
  timestamp: number;
  roomCode?: string;
  msgId?: string;
}

type MessageCallback = (msg: RoomMessage) => void;
type PresenceCallback = (state: PresenceState) => void;

// Public STUN servers for WebRTC NAT traversal
const PEER_ICE_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
};

function sanitizeRoomCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
}

function getHostPeerId(roomCode: string): string {
  const sanitized = sanitizeRoomCode(roomCode);
  return `ashtapor-v1-${sanitized}-host`;
}

function getPlayerPeerId(roomCode: string): string {
  const sanitized = sanitizeRoomCode(roomCode);
  const rand = Math.random().toString(36).substring(2, 8);
  return `ashtapor-v1-${sanitized}-p-${rand}`;
}

class RoomSyncManager {
  private roomCode: string = 'DRAGON-77';
  private peerId: string = `peer-${Math.random().toString(36).substring(2, 9)}`;
  private peerName: string = 'Adventurer';
  private isDm: boolean = true;
  private status: ConnectionStatus = 'idle';
  private statusText: string = 'Not Connected';

  // WebRTC PeerJS instances
  private peerInstance: Peer | null = null;
  private hostConnection: DataConnection | null = null; // Used by players connecting to DM
  private clientConnections: Map<string, DataConnection> = new Map(); // Used by DM host
  private reconnectTimer: any = null;

  // Local multi-tab channel
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private presenceListeners: Set<PresenceCallback> = new Set();
  private peers: Map<string, PeerInfo> = new Map();
  private pingInterval: any = null;
  private processedMsgIds: Set<string> = new Set();

  constructor() {
    try {
      const savedRoom = localStorage.getItem('ttrpg_active_room');
      if (savedRoom) this.roomCode = savedRoom.toUpperCase();
      const savedName = localStorage.getItem('ttrpg_player_name');
      if (savedName) this.peerName = savedName;
      const savedDm = localStorage.getItem('ttrpg_user_is_dm');
      if (savedDm !== null) this.isDm = savedDm === 'true';
    } catch {
      // ignore
    }

    // Clean up peer on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanupPeer();
      });
    }

    this.connect(this.roomCode, this.peerName, this.isDm);
  }

  public connect(newRoomCode?: string, name?: string, isDmRole?: boolean) {
    if (newRoomCode) {
      this.roomCode = newRoomCode.trim().toUpperCase();
      try {
        localStorage.setItem('ttrpg_active_room', this.roomCode);
      } catch {}
    }
    if (name) {
      this.peerName = name.trim();
      try {
        localStorage.setItem('ttrpg_player_name', this.peerName);
      } catch {}
    }
    if (isDmRole !== undefined) {
      this.isDm = isDmRole;
      try {
        localStorage.setItem('ttrpg_user_is_dm', String(isDmRole));
      } catch {}
    }

    // Reset local BroadcastChannel
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
    }

    try {
      this.channel = new BroadcastChannel(`ttrpg_session_room_${this.roomCode}`);
      this.channel.onmessage = (event) => {
        if (event.data && event.data.roomCode === this.roomCode) {
          this.handleIncoming(event.data, false);
        }
      };
    } catch {
      // Fallback
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
      window.addEventListener('storage', this.handleStorageEvent);
    }

    // Setup heartbeat ping
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.broadcast('PEER_PING', {
        online: true,
        isHosted: this.isRoomHosted(),
      });
      this.cleanStalePeers();
      this.notifyPresence();
    }, 4000);

    // If DM and room is marked hosted, host the room via WebRTC
    // If player, connect to the DM host via WebRTC
    if (this.isDm) {
      if (this.isRoomHosted()) {
        this.startPeerHost();
      } else {
        this.status = 'idle';
        this.statusText = 'Offline (Not Hosting)';
        this.notifyPresence();
      }
    } else {
      this.startPeerClient();
    }
  }

  /**
   * DM WebRTC Hosting initialization
   */
  private startPeerHost() {
    this.cleanupPeer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.status = 'connecting';
    this.statusText = 'Starting DM Host Server...';
    this.notifyPresence();

    const hostId = getHostPeerId(this.roomCode);

    try {
      const peer = new Peer(hostId, PEER_ICE_CONFIG);
      this.peerInstance = peer;

      peer.on('open', (id) => {
        this.peerId = id;
        this.status = 'connected';
        this.statusText = 'Hosting Live (Waiting for players)';
        this.claimRoomHostLocally();
        this.notifyPresence();
      });

      peer.on('connection', (conn) => {
        this.setupHostDataConnection(conn);
      });

      peer.on('error', (err: any) => {
        console.warn('PeerJS Host Error:', err);
        if (err.type === 'unavailable-id') {
          this.status = 'connecting';
          this.statusText = 'Host ID clearing. Reconnecting in 2s...';
          this.notifyPresence();
          this.reconnectTimer = setTimeout(() => {
            if (this.isDm && this.isRoomHosted()) {
              this.startPeerHost();
            }
          }, 2500);
        } else {
          this.status = 'error';
          this.statusText = `Host error: ${err.message || err.type}`;
          this.notifyPresence();
        }
      });

      peer.on('disconnected', () => {
        if (!peer.destroyed) {
          peer.reconnect();
        }
      });
    } catch (err: any) {
      this.status = 'error';
      this.statusText = `Host failed: ${err.message || 'Error'}`;
      this.notifyPresence();
    }
  }

  /**
   * Setup incoming player data connection on DM host
   */
  private setupHostDataConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.clientConnections.set(conn.peer, conn);

      // Send initial combat & feed snapshot immediately to the connecting player
      const initialPayload = {
        combat: this.getCombatSnapshot(),
        feed: this.getFeedSnapshot(),
        hostName: this.peerName,
        peers: this.getPeers(),
      };

      conn.send({
        type: 'INITIAL_STATE_SYNC',
        senderId: this.peerId,
        senderName: this.peerName,
        isDm: true,
        roomCode: this.roomCode,
        timestamp: Date.now(),
        payload: initialPayload,
      });

      this.statusText = `Hosting Live (${this.clientConnections.size} connected)`;
      this.notifyPresence();
    });

    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'PLAYER_HELLO') {
        const pId = data.senderId || conn.peer;
        const pName = data.senderName || 'Player';
        this.peers.set(pId, {
          id: pId,
          name: pName,
          isDm: false,
          lastSeen: Date.now(),
        });

        // Broadcast updated presence to all connected players
        this.broadcastPresenceToPeers();
        this.statusText = `Hosting Live (${this.clientConnections.size} connected)`;
        this.notifyPresence();
        return;
      }

      // Handle standard message
      this.handleIncoming(data, false);

      // Relay message from this player to all OTHER connected players
      this.clientConnections.forEach((otherConn, otherPeerId) => {
        if (otherPeerId !== conn.peer && otherConn.open) {
          try {
            otherConn.send(data);
          } catch {}
        }
      });
    });

    conn.on('close', () => {
      this.clientConnections.delete(conn.peer);
      this.peers.delete(conn.peer);
      this.broadcastPresenceToPeers();
      this.statusText = `Hosting Live (${this.clientConnections.size} connected)`;
      this.notifyPresence();
    });

    conn.on('error', () => {
      this.clientConnections.delete(conn.peer);
      this.peers.delete(conn.peer);
      this.broadcastPresenceToPeers();
      this.notifyPresence();
    });
  }

  /**
   * Player WebRTC Client initialization
   */
  private startPeerClient() {
    this.cleanupPeer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.status = 'connecting';
    this.statusText = 'Connecting to Dungeon Master...';
    this.notifyPresence();

    const playerId = getPlayerPeerId(this.roomCode);
    const hostId = getHostPeerId(this.roomCode);

    try {
      const peer = new Peer(playerId, PEER_ICE_CONFIG);
      this.peerInstance = peer;

      peer.on('open', (id) => {
        this.peerId = id;
        this.connectToHost(peer, hostId);
      });

      peer.on('error', (err: any) => {
        console.warn('PeerJS Player Client Error:', err);
        if (err.type === 'peer-unavailable') {
          this.status = 'disconnected';
          this.statusText = 'Host Offline / Room Not Found';
          this.notifyPresence();
        } else {
          this.status = 'error';
          this.statusText = `Connection error: ${err.type || err.message}`;
          this.notifyPresence();
        }
      });

      peer.on('disconnected', () => {
        if (!peer.destroyed) {
          peer.reconnect();
        }
      });
    } catch (err: any) {
      this.status = 'error';
      this.statusText = 'Failed to initialize peer client';
      this.notifyPresence();
    }
  }

  private connectToHost(peer: Peer, hostId: string) {
    try {
      const conn = peer.connect(hostId, {
        reliable: true,
      });
      this.hostConnection = conn;

      conn.on('open', () => {
        this.status = 'connected';
        this.statusText = 'Connected to Dungeon Master';

        // Send Player Hello Handshake
        conn.send({
          type: 'PLAYER_HELLO',
          senderId: this.peerId,
          senderName: this.peerName,
          isDm: false,
          timestamp: Date.now(),
          roomCode: this.roomCode,
          payload: { name: this.peerName },
        });

        this.notifyPresence();
      });

      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;

        // Initial State Sync from DM Host
        if (data.type === 'INITIAL_STATE_SYNC' && data.payload) {
          const { combat, feed, hostName, peers } = data.payload;

          if (hostName) {
            this.statusText = `Connected to DM (${hostName})`;
          }

          if (Array.isArray(peers)) {
            this.peers.clear();
            peers.forEach((p: PeerInfo) => {
              if (p.id !== this.peerId) {
                this.peers.set(p.id, p);
              }
            });
          }

          // Restore combat state to localStorage and notify CombatTracker
          if (combat) {
            try {
              if (Array.isArray(combat.combatants)) {
                localStorage.setItem('ttrpg_combatants', JSON.stringify(combat.combatants));
              }
              if (typeof combat.activeTurnIndex === 'number') {
                localStorage.setItem('ttrpg_active_turn_index', combat.activeTurnIndex.toString());
              }
              if (combat.activeCombatantId) {
                localStorage.setItem('ttrpg_active_combatant_id', combat.activeCombatantId);
              }
              if (typeof combat.round === 'number') {
                localStorage.setItem('ttrpg_combat_round', combat.round.toString());
              }
            } catch {}

            // Dispatch local COMBAT_SYNC
            this.handleIncoming(
              {
                type: 'COMBAT_SYNC',
                senderId: data.senderId,
                senderName: data.senderName,
                isDm: true,
                payload: combat,
                timestamp: Date.now(),
                roomCode: this.roomCode,
              },
              false
            );
          }

          // Restore feed state to localStorage if available
          if (Array.isArray(feed) && feed.length > 0) {
            try {
              localStorage.setItem('ttrpg_unified_live_feed', JSON.stringify(feed));
            } catch {}
            // Also notify through feed listener
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new StorageEvent('storage', { key: 'ttrpg_unified_live_feed' }));
            }
          }

          this.notifyPresence();
          return;
        }

        // Room Presence Sync from DM Host
        if (data.type === 'ROOM_PRESENCE_SYNC' && data.payload) {
          if (Array.isArray(data.payload.peers)) {
            this.peers.clear();
            data.payload.peers.forEach((p: PeerInfo) => {
              if (p.id !== this.peerId) {
                this.peers.set(p.id, p);
              }
            });
            this.notifyPresence();
          }
          return;
        }

        // Host released room
        if (data.type === 'ROOM_HOST_RELEASE') {
          this.status = 'disconnected';
          this.statusText = 'Host Disconnected';
          this.notifyPresence();
          return;
        }

        this.handleIncoming(data, false);
      });

      conn.on('close', () => {
        this.status = 'disconnected';
        this.statusText = 'Host Disconnected';
        this.notifyPresence();
      });

      conn.on('error', () => {
        this.status = 'disconnected';
        this.statusText = 'Host Disconnected';
        this.notifyPresence();
      });
    } catch {
      this.status = 'disconnected';
      this.statusText = 'Host Offline / Room Not Found';
      this.notifyPresence();
    }
  }

  private broadcastPresenceToPeers() {
    const peersList = this.getPeers();
    const presenceMsg = {
      type: 'ROOM_PRESENCE_SYNC',
      senderId: this.peerId,
      senderName: this.peerName,
      isDm: true,
      timestamp: Date.now(),
      roomCode: this.roomCode,
      payload: {
        peers: peersList,
        connectedCount: this.clientConnections.size + 1,
      },
    };

    this.clientConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(presenceMsg);
        } catch {}
      }
    });
  }

  private getCombatSnapshot() {
    try {
      const combatantsRaw = localStorage.getItem('ttrpg_combatants');
      const combatants = combatantsRaw ? JSON.parse(combatantsRaw) : [];
      const activeTurnIndex = parseInt(localStorage.getItem('ttrpg_active_turn_index') || '0', 10);
      const activeCombatantId = localStorage.getItem('ttrpg_active_combatant_id') || null;
      const round = parseInt(localStorage.getItem('ttrpg_combat_round') || '1', 10);
      return { combatants, activeTurnIndex, activeCombatantId, round };
    } catch {
      return { combatants: [], activeTurnIndex: 0, activeCombatantId: null, round: 1 };
    }
  }

  private getFeedSnapshot() {
    try {
      const feedRaw = localStorage.getItem('ttrpg_unified_live_feed');
      return feedRaw ? JSON.parse(feedRaw) : [];
    } catch {
      return [];
    }
  }

  private cleanupPeer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {}
      this.hostConnection = null;
    }

    this.clientConnections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.clientConnections.clear();

    if (this.peerInstance) {
      try {
        this.peerInstance.destroy();
      } catch {}
      this.peerInstance = null;
    }
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (e.key === `ttrpg_storage_sync_${this.roomCode}` && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data.senderId !== this.peerId) {
          this.handleIncoming(data, false);
        }
      } catch {}
    }
    if (e.key === `ttrpg_room_host_${this.roomCode}`) {
      this.notifyPresence();
    }
  };

  private handleIncoming(data: any, relayOverWebRtc = true) {
    if (!data || data.senderId === this.peerId) return;

    // Deduplicate
    const msgId = data.msgId;
    if (msgId) {
      if (this.processedMsgIds.has(msgId)) return;
      this.processedMsgIds.add(msgId);
      if (this.processedMsgIds.size > 250) {
        const first = this.processedMsgIds.values().next().value;
        if (first) this.processedMsgIds.delete(first);
      }
    }

    // Track peer online presence
    this.peers.set(data.senderId, {
      id: data.senderId,
      name: data.senderName,
      isDm: data.isDm,
      lastSeen: Date.now(),
    });

    if (data.type === 'ROOM_HOST_CLAIM') {
      this.claimRoomHostLocally(data.senderId, data.senderName);
    } else if (data.type === 'ROOM_HOST_RELEASE') {
      try {
        localStorage.removeItem(`ttrpg_room_host_${this.roomCode}`);
      } catch {}
    }

    // Forward to remote peers if DM host received it via BroadcastChannel
    if (relayOverWebRtc && this.isDm) {
      this.clientConnections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(data);
          } catch {}
        }
      });
    }

    // Notify listeners
    this.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch {}
    });

    this.notifyPresence();
  }

  private claimRoomHostLocally(hostPeerId?: string, hostName?: string) {
    try {
      localStorage.setItem(
        `ttrpg_room_host_${this.roomCode}`,
        JSON.stringify({
          hostPeerId: hostPeerId || this.peerId,
          hostName: hostName || this.peerName,
          isHosted: true,
          timestamp: Date.now(),
        })
      );
    } catch {}
  }

  private cleanStalePeers() {
    const cutoff = Date.now() - 12000;
    let changed = false;
    for (const [id, peer] of this.peers.entries()) {
      if (peer.lastSeen < cutoff) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.notifyPresence();
    }
  }

  public broadcast(type: RoomMessage['type'], payload: any) {
    const msgId = `${this.peerId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const msg: RoomMessage = {
      type,
      senderId: this.peerId,
      senderName: this.peerName,
      isDm: this.isDm,
      payload,
      timestamp: Date.now(),
      roomCode: this.roomCode,
      msgId,
    };

    this.processedMsgIds.add(msgId);

    // 1. Send via WebRTC
    if (this.isDm) {
      // Send to all connected players
      this.clientConnections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(msg);
          } catch {}
        }
      });
    } else {
      // Player sends to DM Host
      if (this.hostConnection && this.hostConnection.open) {
        try {
          this.hostConnection.send(msg);
        } catch {}
      }
    }

    // 2. Send via local BroadcastChannel (for other tabs on same machine)
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    // 3. Write to localStorage fallback
    try {
      localStorage.setItem(`ttrpg_storage_sync_${this.roomCode}`, JSON.stringify(msg));
    } catch {}
  }

  public subscribe(cb: MessageCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public subscribePresence(cb: PresenceCallback): () => void {
    this.presenceListeners.add(cb);
    // Initial call
    const hostInfo = this.getHostInfo();
    cb({
      peers: this.getPeers(),
      connectedCount: this.getConnectedCount(),
      isHosted: hostInfo.isHosted,
      hostName: hostInfo.hostName,
      status: this.status,
      statusText: this.statusText,
    });
    return () => this.presenceListeners.delete(cb);
  }

  private notifyPresence() {
    const hostInfo = this.getHostInfo();
    const state: PresenceState = {
      peers: this.getPeers(),
      connectedCount: this.getConnectedCount(),
      isHosted: hostInfo.isHosted,
      hostName: hostInfo.hostName,
      status: this.status,
      statusText: this.statusText,
    };
    this.presenceListeners.forEach((fn) => {
      try {
        fn(state);
      } catch {}
    });
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getPeerName(): string {
    return this.peerName;
  }

  public getPeers(): PeerInfo[] {
    this.cleanStalePeers();
    return Array.from(this.peers.values());
  }

  public getConnectedCount(): number {
    if (this.isDm) {
      return this.clientConnections.size + 1;
    }
    return this.getPeers().length + 1;
  }

  public getActiveDm(): PeerInfo | null {
    this.cleanStalePeers();
    for (const peer of this.peers.values()) {
      if (peer.isDm) {
        return peer;
      }
    }
    return null;
  }

  public canClaimDm(): { allowed: boolean; existingDmName?: string } {
    const existing = this.getActiveDm();
    if (existing && existing.id !== this.peerId) {
      return { allowed: false, existingDmName: existing.name };
    }
    return { allowed: true };
  }

  public isRoomHosted(): boolean {
    if (this.isDm) {
      try {
        const raw = localStorage.getItem(`ttrpg_room_host_${this.roomCode}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return !!parsed?.isHosted;
        }
      } catch {}
      return false;
    }
    const dmPeer = this.getActiveDm();
    if (dmPeer) return true;
    try {
      const raw = localStorage.getItem(`ttrpg_room_host_${this.roomCode}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return !!parsed?.isHosted;
      }
    } catch {}
    return this.status === 'connected';
  }

  public getHostInfo(): { isHosted: boolean; hostName?: string; hostPeerId?: string } {
    if (this.isDm) {
      return {
        isHosted: this.isRoomHosted(),
        hostName: this.peerName,
        hostPeerId: this.peerId,
      };
    }
    const dmPeer = this.getActiveDm();
    if (dmPeer) {
      return {
        isHosted: true,
        hostName: dmPeer.name,
        hostPeerId: dmPeer.id,
      };
    }
    try {
      const raw = localStorage.getItem(`ttrpg_room_host_${this.roomCode}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.isHosted) {
          return {
            isHosted: true,
            hostName: parsed.hostName || 'Dungeon Master',
            hostPeerId: parsed.hostPeerId,
          };
        }
      }
    } catch {}
    return { isHosted: false };
  }

  public getConnectionStatus(): { status: ConnectionStatus; statusText: string } {
    return {
      status: this.status,
      statusText: this.statusText,
    };
  }

  public getShareableJoinLink(): string {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?room=${encodeURIComponent(this.roomCode)}`;
  }

  /**
   * Only the DM can host / start the room.
   */
  public hostRoom(): { success: boolean; reason?: string } {
    if (!this.isDm) {
      return {
        success: false,
        reason: 'Only a Dungeon Master can host/start the session room.',
      };
    }

    const check = this.canClaimDm();
    if (!check.allowed) {
      return {
        success: false,
        reason: `Room already has an active Dungeon Master (${check.existingDmName}). Only one DM is permitted per room.`,
      };
    }

    this.claimRoomHostLocally();
    this.startPeerHost();

    this.broadcast('ROOM_HOST_CLAIM', {
      hostPeerId: this.peerId,
      hostName: this.peerName,
    });

    this.notifyPresence();
    return { success: true };
  }

  /**
   * End or unhost the room.
   */
  public unhostRoom(): void {
    try {
      localStorage.removeItem(`ttrpg_room_host_${this.roomCode}`);
    } catch {}

    this.broadcast('ROOM_HOST_RELEASE', {
      hostPeerId: this.peerId,
    });

    this.cleanupPeer();
    this.status = 'idle';
    this.statusText = 'Offline (Not Hosting)';
    this.notifyPresence();
  }

  /**
   * Manually trigger a reconnect attempt (e.g. if host was restarted or connection dropped)
   */
  public retryConnection(): void {
    if (this.isDm) {
      if (this.isRoomHosted()) {
        this.startPeerHost();
      }
    } else {
      this.startPeerClient();
    }
  }
}

export const roomSync = new RoomSyncManager();
