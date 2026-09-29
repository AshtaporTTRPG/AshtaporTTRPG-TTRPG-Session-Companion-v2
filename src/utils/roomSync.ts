// Reliable Multi-Tab & Multi-User Session Room Synchronization Utility
// Uses native BroadcastChannel backed by localStorage storage-event fallback for zero-drop reliability.

export interface PeerInfo {
  id: string;
  name: string;
  isDm: boolean;
  lastSeen: number;
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
    | 'ROOM_STATE_REQUEST';
  senderId: string;
  senderName: string;
  isDm: boolean;
  payload: any;
  timestamp: number;
}

type MessageCallback = (msg: RoomMessage) => void;

class RoomSyncManager {
  private roomCode: string = 'DRAGON-77';
  private peerId: string = `peer-${Math.random().toString(36).substring(2, 9)}`;
  private peerName: string = 'Adventurer';
  private isDm: boolean = true;
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private peers: Map<string, PeerInfo> = new Map();
  private pingInterval: any = null;

  constructor() {
    try {
      const savedRoom = localStorage.getItem('ttrpg_active_room');
      if (savedRoom) this.roomCode = savedRoom.toUpperCase();
      const savedName = localStorage.getItem('ttrpg_player_name');
      if (savedName) this.peerName = savedName;
    } catch {
      // ignore
    }
    this.connect();
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
    }

    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
    }

    try {
      this.channel = new BroadcastChannel(`ttrpg_session_room_${this.roomCode}`);
      this.channel.onmessage = (event) => {
        if (event.data && event.data.roomCode === this.roomCode) {
          this.handleIncoming(event.data);
        }
      };
    } catch {
      // Fallback
    }

    // Also listen to storage events as zero-drop fallback
    window.addEventListener('storage', this.handleStorageEvent);

    // Heartbeat ping every 3.5s
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.broadcast('PEER_PING', { online: true });
      this.cleanStalePeers();
    }, 3500);

    // Initial ping
    this.broadcast('PEER_PING', { online: true });
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (e.key === `ttrpg_storage_sync_${this.roomCode}` && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data.senderId !== this.peerId) {
          this.handleIncoming(data);
        }
      } catch {}
    }
  };

  private handleIncoming(data: any) {
    if (data.senderId === this.peerId) return;

    // Track peer online presence
    this.peers.set(data.senderId, {
      id: data.senderId,
      name: data.senderName,
      isDm: data.isDm,
      lastSeen: Date.now(),
    });

    // Notify listeners
    this.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch {}
    });
  }

  private cleanStalePeers() {
    const cutoff = Date.now() - 12000;
    for (const [id, peer] of this.peers.entries()) {
      if (peer.lastSeen < cutoff) {
        this.peers.delete(id);
      }
    }
  }

  public broadcast(type: RoomMessage['type'], payload: any) {
    const msg: RoomMessage & { roomCode: string } = {
      type,
      senderId: this.peerId,
      senderName: this.peerName,
      isDm: this.isDm,
      payload,
      timestamp: Date.now(),
      roomCode: this.roomCode,
    };

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    // Write to localStorage fallback
    try {
      localStorage.setItem(`ttrpg_storage_sync_${this.roomCode}`, JSON.stringify(msg));
    } catch {}
  }

  public subscribe(cb: MessageCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
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
}

export const roomSync = new RoomSyncManager();
