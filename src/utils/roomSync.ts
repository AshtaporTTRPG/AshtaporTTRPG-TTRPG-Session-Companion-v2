// Reliable Cross-Device WebRTC & Multi-Tab Session Room Synchronization Utility
// Connects remote devices (phones, tablets, PCs) via PeerJS (WebRTC) using public cloud brokering
// and Google STUN servers, backed by native BroadcastChannel for local multi-tab sync.

import Peer, { type DataConnection } from 'peerjs';

export interface PeerInfo {
  id: string;
  name: string;
  isDm: boolean;
  lastSeen: number;
}

export interface RosterMember {
  id: string;
  name: string;
  isDm: boolean;
  isLocal: boolean;
  lastSeen?: number;
}

export type ConnectionStatus =
  | 'offline'
  | 'connecting'
  | 'reconnecting'
  | 'hosting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface PresenceState {
  peers: PeerInfo[];
  roster: RosterMember[];
  connectedCount: number;
  isHosted: boolean;
  hostName?: string;
  status: ConnectionStatus;
  statusText: string;
  lastError?: string | null;
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
    | 'PLAYER_LEAVE'
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

// Public reliable Google STUN servers for WebRTC NAT traversal across remote/carrier networks
export const PEER_ICE_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};

export function sanitizeRoomCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
}

export function getHostPeerId(roomCode: string): string {
  const sanitized = sanitizeRoomCode(roomCode);
  return `ashtapor-room-${sanitized}`;
}

export function getPlayerPeerId(roomCode: string): string {
  const sanitized = sanitizeRoomCode(roomCode);
  const rand = Math.random().toString(36).substring(2, 8);
  return `ashtapor-player-${sanitized}-${rand}`;
}

class RoomSyncManager {
  private roomCode: string = 'DRAGON-77';
  private peerId: string = `local-${Math.random().toString(36).substring(2, 9)}`;
  private peerName: string = 'Adventurer';
  private isDm: boolean = true;
  private status: ConnectionStatus = 'offline';
  private statusText: string = 'Offline';
  private lastError: string | null = null;
  private activeHostName: string | null = null;

  // WebRTC PeerJS instances
  private peerInstance: Peer | null = null;
  private hostConnection: DataConnection | null = null; // Used by players connecting to DM
  private clientConnections: Map<string, DataConnection> = new Map(); // Used by DM host
  private reconnectTimer: any = null;
  private clientReconnectTimer: any = null;
  private clientReconnectDeadline: any = null;
  private wasExplicitLeave: boolean = false;
  private isAutoRecoveringHost: boolean = false;
  private hostRecoveryAttempts: number = 0;

  // Local multi-tab channel
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private presenceListeners: Set<PresenceCallback> = new Set();
  private peers: Map<string, PeerInfo> = new Map();
  private pingInterval: any = null;
  private processedMsgIds: Set<string> = new Set();

  constructor() {
    try {
      const savedRoom = localStorage.getItem('ttrpg_active_room') || sessionStorage.getItem('ttrpg_active_room');
      if (savedRoom && savedRoom.trim()) this.roomCode = savedRoom.trim().toUpperCase();
      const savedName = localStorage.getItem('ttrpg_player_name') || sessionStorage.getItem('ttrpg_player_name');
      if (savedName && savedName.trim()) this.peerName = savedName.trim();
      const savedRole = localStorage.getItem('ttrpg_user_role') || sessionStorage.getItem('ttrpg_user_role');
      if (savedRole === 'player') {
        this.isDm = false;
      } else if (savedRole === 'dm') {
        this.isDm = true;
      } else {
        const savedDm = localStorage.getItem('ttrpg_user_is_dm') ?? sessionStorage.getItem('ttrpg_user_is_dm');
        if (savedDm !== null) this.isDm = savedDm === 'true';
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // If DM is actively hosting, preserve hosting flag across refresh
        if (this.status === 'hosting' && this.isDm) {
          try {
            localStorage.setItem('ttrpg_is_hosting', 'true');
            sessionStorage.setItem('ttrpg_is_hosting', 'true');
          } catch {}
        }
        // If player was actively connected or reconnecting, preserve player_joined flag across refresh
        if (!this.isDm && (this.status === 'connected' || this.status === 'reconnecting' || this.status === 'connecting')) {
          try {
            localStorage.setItem('ttrpg_player_joined', 'true');
            sessionStorage.setItem('ttrpg_player_joined', 'true');
            localStorage.setItem('ttrpg_connection_active', 'true');
            sessionStorage.setItem('ttrpg_connection_active', 'true');
          } catch {}
        }
        this.cleanupPeer();
      });
    }

    // Setup local BroadcastChannel for multi-tab sync without starting WebRTC
    this.setupLocalChannel();

    // Persistent Host State: Detect if DM was actively hosting before page reload
    const wasHosting =
      typeof window !== 'undefined' &&
      (localStorage.getItem('ttrpg_is_hosting') === 'true' ||
        sessionStorage.getItem('ttrpg_is_hosting') === 'true');

    if (wasHosting && this.isDm) {
      this.status = 'connecting';
      this.statusText = 'Restoring host session...';
      this.isAutoRecoveringHost = true;
      setTimeout(() => {
        this.startPeerHost(true);
      }, 150);
    } else {
      // Player session recovery if player refreshed while connected
      const wasPlayerJoined =
        typeof window !== 'undefined' &&
        (sessionStorage.getItem('ttrpg_player_joined') === 'true' ||
          localStorage.getItem('ttrpg_player_joined') === 'true' ||
          sessionStorage.getItem('ttrpg_connection_active') === 'true' ||
          localStorage.getItem('ttrpg_connection_active') === 'true');

      if (wasPlayerJoined && !this.isDm) {
        this.status = 'connecting';
        this.statusText = 'Reconnecting to session...';
        setTimeout(() => {
          this.joinRoom();
        }, 150);
      } else {
        this.status = 'offline';
        this.statusText = 'Offline';
      }
    }
  }

  private setupLocalChannel() {
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
    } catch {}

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
      window.addEventListener('storage', this.handleStorageEvent);
    }

    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.cleanStalePeers();
      this.notifyPresence();
    }, 5000);
  }

  /**
   * Configure room code and user details locally without initiating network connection.
   */
  public configure(newRoomCode?: string, name?: string, isDmRole?: boolean): void {
    let roomChanged = false;
    let nameChanged = false;
    if (newRoomCode) {
      const clean = newRoomCode.trim().toUpperCase();
      if (clean && clean !== this.roomCode) {
        this.roomCode = clean;
        roomChanged = true;
        try {
          localStorage.setItem('ttrpg_active_room', this.roomCode);
          sessionStorage.setItem('ttrpg_active_room', this.roomCode);
        } catch {}
      }
    }
    if (name !== undefined) {
      const cleanName = name.trim();
      if (cleanName && cleanName !== this.peerName) {
        this.peerName = cleanName;
        nameChanged = true;
        try {
          localStorage.setItem('ttrpg_player_name', this.peerName);
          sessionStorage.setItem('ttrpg_player_name', this.peerName);
        } catch {}
      }
    }
    if (isDmRole !== undefined) {
      this.isDm = isDmRole;
      try {
        localStorage.setItem('ttrpg_user_is_dm', String(isDmRole));
        sessionStorage.setItem('ttrpg_user_is_dm', String(isDmRole));
        localStorage.setItem('ttrpg_user_role', isDmRole ? 'dm' : 'player');
        sessionStorage.setItem('ttrpg_user_role', isDmRole ? 'dm' : 'player');
      } catch {}
    }

    if (nameChanged) {
      // Broadcast updated display name across WebRTC network immediately
      if (this.status === 'connected' && this.hostConnection && this.hostConnection.open) {
        try {
          this.hostConnection.send({
            type: 'PLAYER_HELLO',
            senderId: this.peerId,
            senderName: this.getPeerName(),
            isDm: this.isDm,
            timestamp: Date.now(),
            roomCode: this.roomCode,
            payload: { name: this.getPeerName() },
          });
        } catch {}
      } else if (this.status === 'hosting') {
        this.broadcastPresenceToPeers();
      }
    }

    if (roomChanged) {
      this.setupLocalChannel();
    }
    this.notifyPresence();
  }

  /**
   * Backward-compatible alias for configure. Does NOT auto-initiate WebRTC unless hosting is active.
   */
  public connect(newRoomCode?: string, name?: string, isDmRole?: boolean): void {
    this.configure(newRoomCode, name, isDmRole);
  }

  /**
   * Host Trigger: Only initialize the PeerJS host instance when the DM explicitly clicks "Host & Start Room".
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

    try {
      localStorage.setItem('ttrpg_is_hosting', 'true');
      sessionStorage.setItem('ttrpg_is_hosting', 'true');
      localStorage.setItem('ttrpg_active_room', this.roomCode);
      sessionStorage.setItem('ttrpg_active_room', this.roomCode);
      localStorage.setItem('ttrpg_user_is_dm', 'true');
      sessionStorage.setItem('ttrpg_user_is_dm', 'true');
      localStorage.setItem('ttrpg_user_role', 'dm');
      sessionStorage.setItem('ttrpg_user_role', 'dm');
    } catch {}

    this.hostRecoveryAttempts = 0;
    this.startPeerHost(false);
    return { success: true };
  }

  /**
   * DM WebRTC Hosting initialization with public STUN servers and deterministic host ID
   */
  private startPeerHost(isAutoRecovery = false, retryCount = 0) {
    this.cleanupPeer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.status = 'connecting';
    this.statusText = isAutoRecovery
      ? retryCount > 0
        ? `Rebinding host ID (attempt ${retryCount}/5)...`
        : 'Restoring host session...'
      : 'Connecting to broker...';
    this.lastError = null;
    this.notifyPresence();

    const hostId = getHostPeerId(this.roomCode);

    try {
      const peer = new Peer(hostId, PEER_ICE_CONFIG);
      this.peerInstance = peer;

      peer.on('open', (id) => {
        this.peerId = id;
        this.status = 'hosting';
        this.statusText = `Hosting: Room ${this.roomCode}`;
        this.lastError = null;
        this.isAutoRecoveringHost = false;
        this.hostRecoveryAttempts = 0;
        try {
          localStorage.setItem('ttrpg_is_hosting', 'true');
          sessionStorage.setItem('ttrpg_is_hosting', 'true');
        } catch {}
        this.claimRoomHostLocally();
        this.broadcast('ROOM_HOST_CLAIM', {
          hostPeerId: this.peerId,
          hostName: this.getPeerName(),
        });
        this.notifyPresence();
      });

      peer.on('connection', (conn) => {
        this.setupHostDataConnection(conn);
      });

      peer.on('error', (err: any) => {
        console.error('PeerJS Host Error:', err);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // If ID is still temporarily held by broker after DM tab refresh, retry automatically with backoff
        if (err?.type === 'unavailable-id' && (isAutoRecovery || retryCount < 5)) {
          const nextAttempt = retryCount + 1;
          this.hostRecoveryAttempts = nextAttempt;
          this.status = 'connecting';
          this.statusText = `Rebinding host ID (attempt ${nextAttempt}/5)...`;
          this.notifyPresence();
          this.reconnectTimer = setTimeout(() => {
            this.cleanupPeer();
            this.startPeerHost(isAutoRecovery, nextAttempt);
          }, 800);
          return;
        }

        this.status = 'error';
        const errorDetail =
          err?.type === 'unavailable-id'
            ? 'Room host ID already registered on broker. Wait a moment or choose another code, then Click to Retry.'
            : err?.message || err?.type || 'Broker connection failed';
        this.lastError = errorDetail;
        this.statusText = 'Connection Failed - Click to Retry';
        this.notifyPresence();
      });

      peer.on('disconnected', () => {
        console.warn('PeerJS Host disconnected from broker signaling server');
        if (this.peerInstance && !this.peerInstance.destroyed) {
          try {
            this.peerInstance.reconnect();
          } catch {}
        }
      });

      peer.on('close', () => {
        if (this.status === 'hosting') {
          this.status = 'disconnected';
          this.statusText = 'Disconnected / Host Closed';
          this.notifyPresence();
        }
      });
    } catch (err: any) {
      console.error('Failed to instantiate Host PeerJS:', err);
      this.status = 'error';
      this.statusText = 'Connection Failed - Click to Retry';
      this.lastError = err?.message || 'Failed to initialize peer';
      this.notifyPresence();
    }
  }

  /**
   * Setup incoming player data connection on DM host:
   * DM binds peer.on('connection', ...) and tracks active client data connections in state,
   * listening for data, close, and error. Pushes full state sync immediately on open.
   */
  private setupHostDataConnection(conn: DataConnection) {
    const handleOpen = () => {
      this.clientConnections.set(conn.peer, conn);

      // Full State Sync on Join:
      // When a player's data channel successfully opens, the DM host must
      // immediately push the current combat tracker state, initiative list, and feed history
      const initialPayload = {
        combat: this.getCombatSnapshot(),
        feed: this.getFeedSnapshot(),
        hostName: this.peerName,
        peers: this.getAllPeersList(),
      };

      try {
        conn.send({
          type: 'INITIAL_STATE_SYNC',
          senderId: this.peerId,
          senderName: this.peerName,
          isDm: true,
          roomCode: this.roomCode,
          timestamp: Date.now(),
          payload: initialPayload,
        });
      } catch (err) {
        console.error('Error sending initial state sync to peer:', err);
      }

      this.broadcastPresenceToPeers();
      this.statusText = `Hosting: Room ${this.roomCode}`;
      this.notifyPresence();
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'PLAYER_HELLO') {
        const pId = data.senderId || conn.peer;
        const pName = data.senderName || data.payload?.name || 'Player';
        this.peers.set(pId, {
          id: pId,
          name: pName,
          isDm: false,
          lastSeen: Date.now(),
        });
        this.broadcastPresenceToPeers();
        this.notifyPresence();
        return;
      }

      if (data.type === 'PLAYER_LEAVE') {
        const pId = data.senderId || conn.peer;
        this.clientConnections.delete(pId);
        this.peers.delete(pId);
        this.broadcastPresenceToPeers();
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
      this.notifyPresence();
    });

    conn.on('error', (err: any) => {
      console.error('Host connection error with client:', conn.peer, err);
      this.clientConnections.delete(conn.peer);
      this.peers.delete(conn.peer);
      this.broadcastPresenceToPeers();
      this.notifyPresence();
    });
  }

  /**
   * Player Client Join Trigger: On clicking "Join Room", connects to the DM host via WebRTC
   */
  public joinRoom(): void {
    this.wasExplicitLeave = false;
    this.isDm = false;
    try {
      sessionStorage.setItem('ttrpg_player_joined', 'true');
      localStorage.setItem('ttrpg_player_joined', 'true');
      sessionStorage.setItem('ttrpg_connection_active', 'true');
      localStorage.setItem('ttrpg_connection_active', 'true');
      localStorage.setItem('ttrpg_active_room', this.roomCode);
      sessionStorage.setItem('ttrpg_active_room', this.roomCode);
      localStorage.setItem('ttrpg_player_name', this.peerName);
      sessionStorage.setItem('ttrpg_player_name', this.peerName);
      localStorage.setItem('ttrpg_user_role', 'player');
      sessionStorage.setItem('ttrpg_user_role', 'player');
      localStorage.setItem('ttrpg_user_is_dm', 'false');
      sessionStorage.setItem('ttrpg_user_is_dm', 'false');
    } catch {}
    this.startPeerClient();
  }

  /**
   * Player WebRTC Client initialization
   */
  private startPeerClient() {
    this.cleanupPeer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.status = 'connecting';
    this.statusText = 'Connecting to broker...';
    this.lastError = null;
    this.notifyPresence();

    const playerId = getPlayerPeerId(this.roomCode);
    const hostId = getHostPeerId(this.roomCode);

    try {
      const peer = new Peer(playerId, PEER_ICE_CONFIG);
      this.peerInstance = peer;

      peer.on('open', (id) => {
        this.peerId = id;
        this.statusText = 'Connecting to DM...';
        this.connectToHost(peer, hostId);
      });

      peer.on('error', (err: any) => {
        console.error('PeerJS Player Client Error:', err);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // If in reconnecting grace period, don't throw terminal error; retry interval will handle it
        if (this.status === 'reconnecting') {
          return;
        }

        if (err.type === 'peer-unavailable') {
          this.status = 'disconnected';
          this.statusText = 'Disconnected / Host Closed';
          this.lastError = 'Room host is not currently online';
        } else {
          this.status = 'error';
          this.statusText = 'Connection Failed - Click to Retry';
          this.lastError = err?.message || err?.type || 'Connection error';
        }
        this.notifyPresence();
      });

      peer.on('disconnected', () => {
        console.warn('PeerJS Client disconnected from broker signaling server');
        if (this.peerInstance && !this.peerInstance.destroyed) {
          try {
            this.peerInstance.reconnect();
          } catch {}
        }
      });

      peer.on('close', () => {
        if (!this.wasExplicitLeave && (this.status === 'connected' || this.status === 'reconnecting')) {
          this.handlePlayerReconnectGracePeriod(hostId);
        } else if (this.status === 'connected' || this.status === 'connecting') {
          this.status = 'disconnected';
          this.statusText = 'Disconnected / Host Closed';
          this.notifyPresence();
        }
      });
    } catch (err: any) {
      console.error('Failed to instantiate Player PeerJS:', err);
      this.status = 'error';
      this.statusText = 'Connection Failed - Click to Retry';
      this.lastError = err?.message || 'Failed to initialize peer client';
      this.notifyPresence();
    }
  }

  /**
   * Player data channel connection to DM host:
   * Binds conn.on('open'), conn.on('data'), conn.on('close'), and conn.on('error')
   */
  private connectToHost(peer: Peer, hostId: string) {
    try {
      const conn = peer.connect(hostId, {
        reliable: true,
      });
      this.hostConnection = conn;

      conn.on('open', () => {
        // Successfully connected/reconnected! Clear reconnect timers and restore connected state
        if (this.clientReconnectTimer) {
          clearInterval(this.clientReconnectTimer);
          this.clientReconnectTimer = null;
        }
        if (this.clientReconnectDeadline) {
          clearTimeout(this.clientReconnectDeadline);
          this.clientReconnectDeadline = null;
        }

        this.status = 'connected';
        this.statusText = 'Connected to DM';
        this.lastError = null;

        // Send Player Hello Handshake strictly with configured display name
        conn.send({
          type: 'PLAYER_HELLO',
          senderId: this.peerId,
          senderName: this.getPeerName(),
          isDm: false,
          timestamp: Date.now(),
          roomCode: this.roomCode,
          payload: { name: this.getPeerName() },
        });

        this.notifyPresence();
      });

      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;

        // Initial Full State Sync from DM Host
        if (data.type === 'INITIAL_STATE_SYNC' && data.payload) {
          const { combat, feed, hostName, peers } = data.payload;

          if (hostName) {
            this.activeHostName = hostName;
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
              if (combat.combatStatus) {
                localStorage.setItem('ttrpg_combat_status', combat.combatStatus);
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

          // Forward INITIAL_STATE_SYNC payload to listeners (e.g. liveFeedSync)
          this.listeners.forEach((fn) => {
            try {
              fn(data);
            } catch {}
          });

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

        // Host released room intentionally
        if (data.type === 'ROOM_HOST_RELEASE') {
          this.wasExplicitLeave = true;
          if (this.clientReconnectTimer) {
            clearInterval(this.clientReconnectTimer);
            this.clientReconnectTimer = null;
          }
          if (this.clientReconnectDeadline) {
            clearTimeout(this.clientReconnectDeadline);
            this.clientReconnectDeadline = null;
          }
          this.status = 'disconnected';
          this.statusText = 'Disconnected / Host Closed';
          this.notifyPresence();
          return;
        }

        this.handleIncoming(data, false);
      });

      conn.on('close', () => {
        if (this.wasExplicitLeave) {
          this.status = 'offline';
          this.statusText = 'Offline';
          this.notifyPresence();
          return;
        }

        // Client Reconnect Grace Period:
        // When a player's connection drops due to a DM tab reload, do not instantly kick them to offline screen.
        // Transition to "Reconnecting to Host..." state with automatic retry window.
        if (this.status === 'connected' || this.status === 'reconnecting') {
          this.handlePlayerReconnectGracePeriod(hostId);
        } else {
          this.status = 'disconnected';
          this.statusText = 'Disconnected / Host Closed';
          this.notifyPresence();
        }
      });

      conn.on('error', (err: any) => {
        console.error('Player connection data channel error:', err);
        if (this.status === 'reconnecting') {
          // Grace period retry interval will handle retrying connection
          return;
        }
        if (this.status === 'connected') {
          this.handlePlayerReconnectGracePeriod(hostId);
        } else {
          this.status = 'error';
          this.statusText = 'Connection Failed - Click to Retry';
          this.lastError = err?.message || 'Data channel error';
          this.notifyPresence();
        }
      });
    } catch (err: any) {
      console.error('Failed to initiate connection to host:', err);
      if (this.status === 'reconnecting') return;
      this.status = 'disconnected';
      this.statusText = 'Disconnected / Host Closed';
      this.lastError = err?.message || 'Failed to connect to host';
      this.notifyPresence();
    }
  }

  /**
   * Client Reconnect Grace Period:
   * Retries connection every 1.5s for up to 10s without kicking the player to offline screen.
   */
  private handlePlayerReconnectGracePeriod(hostId: string) {
    if (this.wasExplicitLeave) return;

    if (this.status === 'reconnecting' && this.clientReconnectTimer) {
      return;
    }

    this.status = 'reconnecting';
    this.statusText = 'Reconnecting to Host...';
    this.lastError = null;
    this.notifyPresence();

    if (this.clientReconnectTimer) {
      clearInterval(this.clientReconnectTimer);
      this.clientReconnectTimer = null;
    }
    if (this.clientReconnectDeadline) {
      clearTimeout(this.clientReconnectDeadline);
      this.clientReconnectDeadline = null;
    }

    // 10s automatic retry window
    const deadlineMs = 10000;
    let attempt = 0;

    this.clientReconnectDeadline = setTimeout(() => {
      if (this.status === 'reconnecting') {
        if (this.clientReconnectTimer) {
          clearInterval(this.clientReconnectTimer);
          this.clientReconnectTimer = null;
        }
        this.status = 'disconnected';
        this.statusText = 'Disconnected / Host Closed';
        this.lastError = 'Host connection timed out. Click to Retry.';
        this.notifyPresence();
      }
    }, deadlineMs);

    const attemptConnect = () => {
      if (this.status === 'connected' || this.wasExplicitLeave) {
        if (this.clientReconnectTimer) {
          clearInterval(this.clientReconnectTimer);
          this.clientReconnectTimer = null;
        }
        return;
      }

      attempt++;
      this.statusText = `Reconnecting to Host (attempt ${attempt})...`;
      this.notifyPresence();

      if (!this.peerInstance || this.peerInstance.destroyed) {
        const playerId = getPlayerPeerId(this.roomCode);
        try {
          const peer = new Peer(playerId, PEER_ICE_CONFIG);
          this.peerInstance = peer;
          peer.on('open', (id) => {
            this.peerId = id;
            this.connectToHost(peer, hostId);
          });
          peer.on('error', (err: any) => {
            console.warn('Player peer error during reconnect attempt:', err?.type || err);
          });
        } catch (err) {
          console.warn('Failed to re-instantiate peer client during grace period:', err);
        }
      } else if (this.peerInstance.disconnected && !this.peerInstance.destroyed) {
        try {
          this.peerInstance.reconnect();
        } catch {}
      } else if (this.peerInstance.open) {
        this.connectToHost(this.peerInstance, hostId);
      }
    };

    // Immediate attempt
    attemptConnect();

    // Repeat every 1.5s
    this.clientReconnectTimer = setInterval(attemptConnect, 1500);
  }

  private broadcastPresenceToPeers() {
    const allPeers = this.getAllPeersList();
    const presenceMsg: RoomMessage = {
      type: 'ROOM_PRESENCE_SYNC',
      senderId: this.peerId,
      senderName: this.getPeerName(),
      isDm: this.isDm,
      timestamp: Date.now(),
      roomCode: this.roomCode,
      payload: {
        peers: allPeers,
        connectedCount: allPeers.length,
      },
    };

    this.clientConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(presenceMsg);
        } catch {}
      }
    });

    if (this.channel) {
      try {
        this.channel.postMessage(presenceMsg);
      } catch {}
    }
  }

  public getCombatStatus(): 'setup' | 'active' {
    try {
      const saved = localStorage.getItem('ttrpg_combat_status');
      return saved === 'active' ? 'active' : 'setup';
    } catch {
      return 'setup';
    }
  }

  private getCombatSnapshot() {
    try {
      const combatantsRaw = localStorage.getItem('ttrpg_combatants');
      const combatants = combatantsRaw ? JSON.parse(combatantsRaw) : [];
      const activeTurnIndex = parseInt(localStorage.getItem('ttrpg_active_turn_index') || '0', 10);
      const activeCombatantId = localStorage.getItem('ttrpg_active_combatant_id') || null;
      const round = parseInt(localStorage.getItem('ttrpg_combat_round') || '1', 10);
      const combatStatus = this.getCombatStatus();
      return { combatants, activeTurnIndex, activeCombatantId, round, combatStatus };
    } catch {
      return { combatants: [], activeTurnIndex: 0, activeCombatantId: null, round: 1, combatStatus: 'setup' };
    }
  }

  private getFeedSnapshot() {
    try {
      const feedRaw =
        localStorage.getItem('ttrpg_unified_live_feed_dm') ||
        localStorage.getItem('ttrpg_unified_live_feed');
      return feedRaw ? JSON.parse(feedRaw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Host Teardown: Properly calls peer.destroy(), clears any pending setTimeout retry timers,
   * closes all active connections, and resets status back to Offline.
   */
  public stopHosting(): void {
    this.unhostRoom();
  }

  public unhostRoom(): void {
    try {
      localStorage.removeItem('ttrpg_is_hosting');
      sessionStorage.removeItem('ttrpg_is_hosting');
      localStorage.removeItem(`ttrpg_room_host_${this.roomCode}`);
    } catch {}

    this.isAutoRecoveringHost = false;
    this.hostRecoveryAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.broadcast('ROOM_HOST_RELEASE', {
      hostPeerId: this.peerId,
    });

    this.cleanupPeer();
    this.status = 'offline';
    this.statusText = 'Offline';
    this.lastError = null;
    this.peers.clear();
    this.notifyPresence();
  }

  /**
   * Player Disconnect / Leave Session
   */
  public disconnect(): void {
    this.leaveRoom();
  }

  public leaveRoom(): void {
    this.wasExplicitLeave = true;
    try {
      sessionStorage.removeItem('ttrpg_player_joined');
      localStorage.removeItem('ttrpg_player_joined');
      sessionStorage.removeItem('ttrpg_connection_active');
      localStorage.removeItem('ttrpg_connection_active');
    } catch {}

    if (this.clientReconnectTimer) {
      clearInterval(this.clientReconnectTimer);
      this.clientReconnectTimer = null;
    }
    if (this.clientReconnectDeadline) {
      clearTimeout(this.clientReconnectDeadline);
      this.clientReconnectDeadline = null;
    }

    if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send({
          type: 'PLAYER_LEAVE',
          senderId: this.peerId,
          senderName: this.getPeerName(),
          isDm: this.isDm,
          timestamp: Date.now(),
          roomCode: this.roomCode,
          payload: {},
        });
      } catch {}
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.cleanupPeer();
    this.status = 'offline';
    this.statusText = 'Offline';
    this.lastError = null;
    this.peers.clear();
    this.notifyPresence();
  }

  /**
   * Manually trigger a retry (No runaway automated retries)
   */
  public retryConnection(): void {
    if (this.isDm) {
      this.hostRoom();
    } else {
      this.joinRoom();
    }
  }

  private cleanupPeer() {
    if (this.clientReconnectTimer) {
      clearInterval(this.clientReconnectTimer);
      this.clientReconnectTimer = null;
    }
    if (this.clientReconnectDeadline) {
      clearTimeout(this.clientReconnectDeadline);
      this.clientReconnectDeadline = null;
    }
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
    } else if (data.type === 'PLAYER_LEAVE') {
      this.peers.delete(data.senderId);
      this.notifyPresence();
      return;
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
    const cutoff = Date.now() - 15000;
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
      roster: this.getConnectedRoster(),
      connectedCount: this.getConnectedCount(),
      isHosted: hostInfo.isHosted,
      hostName: hostInfo.hostName,
      status: this.status,
      statusText: this.statusText,
      lastError: this.lastError,
    });
    return () => this.presenceListeners.delete(cb);
  }

  private notifyPresence() {
    const hostInfo = this.getHostInfo();
    const state: PresenceState = {
      peers: this.getPeers(),
      roster: this.getConnectedRoster(),
      connectedCount: this.getConnectedCount(),
      isHosted: hostInfo.isHosted,
      hostName: hostInfo.hostName,
      status: this.status,
      statusText: this.statusText,
      lastError: this.lastError,
    };
    this.presenceListeners.forEach((fn) => {
      try {
        fn(state);
      } catch {}
    });
  }

  /**
   * Return complete connected session roster listing display names.
   * Marked with isLocal for self, DM host always placed first, followed by players alphabetically.
   * Raw Peer IDs are omitted in favor of display names.
   */
  public getConnectedRoster(): RosterMember[] {
    const roster: RosterMember[] = [];

    // Local user
    roster.push({
      id: this.peerId,
      name: this.getPeerName(),
      isDm: this.isDm,
      isLocal: true,
      lastSeen: Date.now(),
    });

    // Remote peers
    this.cleanStalePeers();
    for (const peer of this.peers.values()) {
      if (peer.id !== this.peerId && !roster.some((m) => m.id === peer.id)) {
        roster.push({
          id: peer.id,
          name: peer.name?.trim() || (peer.isDm ? 'Dungeon Master' : 'Player'),
          isDm: peer.isDm,
          isLocal: false,
          lastSeen: peer.lastSeen,
        });
      }
    }

    // If connected to DM host and host peer is not yet in peers map, include host
    if (!this.isDm && (this.status === 'connected' || this.status === 'reconnecting')) {
      const hostPeerId = getHostPeerId(this.roomCode);
      if (!roster.some((m) => m.isDm)) {
        roster.unshift({
          id: hostPeerId,
          name: this.activeHostName || 'Dungeon Master (Host)',
          isDm: true,
          isLocal: false,
          lastSeen: Date.now(),
        });
      }
    }

    // Sort: DM (Host) first, then alphabetical by display name
    return roster.sort((a, b) => {
      if (a.isDm && !b.isDm) return -1;
      if (!a.isDm && b.isDm) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Returns list of all known peers including self for network broadcast
   */
  public getAllPeersList(): PeerInfo[] {
    const roster = this.getConnectedRoster();
    return roster.map((m) => ({
      id: m.id,
      name: m.name,
      isDm: m.isDm,
      lastSeen: Date.now(),
    }));
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getPeerName(): string {
    try {
      const saved = localStorage.getItem('ttrpg_player_name');
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    if (this.peerName && this.peerName.trim()) return this.peerName.trim();
    return this.isDm ? 'Dungeon Master' : 'Adventurer';
  }

  public getPeers(): PeerInfo[] {
    this.cleanStalePeers();
    return Array.from(this.peers.values());
  }

  public getConnectedCount(): number {
    if (this.status === 'hosting') {
      return this.clientConnections.size + 1;
    }
    if (this.status === 'connected' || this.status === 'reconnecting') {
      return this.peers.size + 1;
    }
    return 1;
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
    return this.status === 'hosting';
  }

  public getHostInfo(): { isHosted: boolean; hostName?: string; hostPeerId?: string } {
    if (this.isDm) {
      return {
        isHosted: this.status === 'hosting',
        hostName: this.getPeerName(),
        hostPeerId: this.peerId,
      };
    }
    if (this.status === 'connected' || this.status === 'reconnecting') {
      return {
        isHosted: true,
        hostName: this.activeHostName || 'Dungeon Master',
        hostPeerId: getHostPeerId(this.roomCode),
      };
    }
    return { isHosted: false };
  }

  public getConnectionStatus(): { status: ConnectionStatus; statusText: string; lastError?: string | null } {
    return {
      status: this.status,
      statusText: this.statusText,
      lastError: this.lastError,
    };
  }

  public getIsDm(): boolean {
    return this.isDm;
  }

  public getRole(): 'dm' | 'player' {
    return this.isDm ? 'dm' : 'player';
  }

  public getShareableJoinLink(): string {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?room=${encodeURIComponent(this.roomCode)}`;
  }
}

export const roomSync = new RoomSyncManager();
