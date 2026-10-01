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
    | 'ROOM_STATE_REQUEST'
    | 'FEED_CLEAR'
    | 'ROOM_HOST_CLAIM'
    | 'ROOM_HOST_RELEASE';
  senderId: string;
  senderName: string;
  isDm: boolean;
  payload: any;
  timestamp: number;
  roomCode?: string;
}

type MessageCallback = (msg: RoomMessage) => void;
type PresenceCallback = (state: {
  peers: PeerInfo[];
  connectedCount: number;
  isHosted: boolean;
  hostName?: string;
}) => void;

class RoomSyncManager {
  private roomCode: string = 'DRAGON-77';
  private peerId: string = `peer-${Math.random().toString(36).substring(2, 9)}`;
  private peerName: string = 'Adventurer';
  private isDm: boolean = true;
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private presenceListeners: Set<PresenceCallback> = new Set();
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
    window.removeEventListener('storage', this.handleStorageEvent);
    window.addEventListener('storage', this.handleStorageEvent);

    // Heartbeat ping every 3 seconds
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.broadcast('PEER_PING', {
        online: true,
        isHosted: this.isRoomHosted(),
      });
      this.cleanStalePeers();
      this.notifyPresence();
    }, 3000);

    // Initial ping
    this.broadcast('PEER_PING', {
      online: true,
      isHosted: this.isRoomHosted(),
    });
    this.notifyPresence();
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
    if (e.key === `ttrpg_room_host_${this.roomCode}`) {
      this.notifyPresence();
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

    if (data.type === 'ROOM_HOST_CLAIM') {
      try {
        localStorage.setItem(
          `ttrpg_room_host_${this.roomCode}`,
          JSON.stringify({
            hostPeerId: data.senderId,
            hostName: data.senderName,
            isHosted: true,
            timestamp: Date.now(),
          })
        );
      } catch {}
    } else if (data.type === 'ROOM_HOST_RELEASE') {
      try {
        localStorage.removeItem(`ttrpg_room_host_${this.roomCode}`);
      } catch {}
    }

    // Notify listeners
    this.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch {}
    });

    this.notifyPresence();
  }

  private cleanStalePeers() {
    const cutoff = Date.now() - 10000;
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
    const msg: RoomMessage = {
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

  public subscribePresence(cb: PresenceCallback): () => void {
    this.presenceListeners.add(cb);
    // Initial call
    cb({
      peers: this.getPeers(),
      connectedCount: this.getConnectedCount(),
      isHosted: this.isRoomHosted(),
      hostName: this.getHostInfo().hostName,
    });
    return () => this.presenceListeners.delete(cb);
  }

  private notifyPresence() {
    const hostInfo = this.getHostInfo();
    const state = {
      peers: this.getPeers(),
      connectedCount: this.getConnectedCount(),
      isHosted: hostInfo.isHosted,
      hostName: hostInfo.hostName,
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
    return this.getPeers().length + 1;
  }

  /**
   * Check if another active peer in the room is currently a DM.
   * Only one DM is permitted per room.
   */
  public getActiveDm(): PeerInfo | null {
    this.cleanStalePeers();
    for (const peer of this.peers.values()) {
      if (peer.isDm) {
        return peer;
      }
    }
    return null;
  }

  /**
   * Enforce that only one DM can exist per room.
   * Returns whether claiming DM is allowed, or who the existing DM is.
   */
  public canClaimDm(): { allowed: boolean; existingDmName?: string } {
    const existing = this.getActiveDm();
    if (existing && existing.id !== this.peerId) {
      return { allowed: false, existingDmName: existing.name };
    }
    return { allowed: true };
  }

  /**
   * Check if the room is currently Hosted / Live.
   * A room is Hosted / Live if:
   * 1. The current user is a DM who hosted the room, OR
   * 2. An active DM peer is currently connected and hosting in this room, OR
   * 3. An active host flag is present in localStorage and the host has been active.
   */
  public isRoomHosted(): boolean {
    if (this.isDm) {
      // Current user is DM; room is hosted
      return true;
    }
    const dmPeer = this.getActiveDm();
    if (dmPeer) {
      return true;
    }
    try {
      const raw = localStorage.getItem(`ttrpg_room_host_${this.roomCode}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.isHosted) {
          return true;
        }
      }
    } catch {}
    return false;
  }

  public getHostInfo(): { isHosted: boolean; hostName?: string; hostPeerId?: string } {
    if (this.isDm) {
      return {
        isHosted: true,
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

    try {
      localStorage.setItem(
        `ttrpg_room_host_${this.roomCode}`,
        JSON.stringify({
          hostPeerId: this.peerId,
          hostName: this.peerName,
          isHosted: true,
          timestamp: Date.now(),
        })
      );
    } catch {}

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
    this.notifyPresence();
  }
}

export const roomSync = new RoomSyncManager();
