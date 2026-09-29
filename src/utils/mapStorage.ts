/**
 * Persistent IndexedDB Storage Layer for Virtual Tabletop Maps & Tactical Grids.
 * Avoids localStorage 5MB quota errors by storing Blobs, ArrayBuffers, and rich metadata in IndexedDB.
 * Manages object URL lifecycles to prevent memory leaks across tab switches while keeping references valid.
 */

export interface MapGridSettings {
  enabled: boolean;
  cellSize: number; // in pixels (e.g. 50px)
  offsetX: number;
  offsetY: number;
  color: string;
  opacity: number;
}

export interface MapViewportSettings {
  scale: number;
  position: { x: number; y: number };
}

export type MapCategoryType =
  | 'Battle Map'
  | 'Dungeon'
  | 'Overland / Regional'
  | 'City / Settlement'
  | 'Interior / Building'
  | 'Custom'
  | 'continent'
  | 'city'
  | 'town'
  | 'region'
  | string;

export const STANDARD_MAP_TYPES = [
  'Battle Map',
  'Dungeon',
  'Overland / Regional',
  'City / Settlement',
  'Interior / Building',
  'Custom',
] as const;

export function getMapTypeBadge(type: string): { label: string; badgeClass: string; icon: string } {
  switch (type) {
    case 'Battle Map':
      return { label: 'Battle Map', badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-800/80', icon: '⚔️' };
    case 'Dungeon':
      return { label: 'Dungeon', badgeClass: 'bg-purple-950/70 text-purple-300 border-purple-800/80', icon: '🗝️' };
    case 'Overland / Regional':
    case 'continent':
    case 'region':
      return { label: 'Overland / Regional', badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80', icon: '🌄' };
    case 'City / Settlement':
    case 'city':
    case 'town':
      return { label: 'City / Settlement', badgeClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80', icon: '🏰' };
    case 'Interior / Building':
      return { label: 'Interior / Building', badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-800/80', icon: '🏛️' };
    case 'Custom':
    default:
      return { label: type || 'Custom', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700', icon: '📜' };
  }
}

export interface StoredCampaignMap {
  id: string;
  name: string;
  type: MapCategoryType;
  author: string;
  createdAt: number;
  updatedAt?: number;
  imageBlob?: Blob;
  dataUrl?: string; // fallback or compressed preview
  gridSettings?: MapGridSettings;
  viewport?: MapViewportSettings;
}

const DB_NAME = 'ttrpg_campaign_map_storage';
const DB_VERSION = 1;
const MAPS_STORE = 'campaign_maps';
const META_STORE = 'map_meta';

// Registry of generated Object URLs for memory management & garbage collection
const objectUrlRegistry = new Set<string>();
const mapIdToBlobUrlMap = new Map<string, string>();

// Clean up all blob URLs when window unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    revokeAllMapBlobUrls();
  });
}

/**
 * Open or upgrade the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB database.'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for maps
      if (!db.objectStoreNames.contains(MAPS_STORE)) {
        const mapsStore = db.createObjectStore(MAPS_STORE, { keyPath: 'id' });
        mapsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Store for active session metadata (last selected map, zoom, pan)
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Storage Quota Safety Check
 * Verifies that the browser has enough storage quota and warns if the file exceeds safe limits (50MB).
 */
export async function checkStorageQuota(
  fileSize: number
): Promise<{ ok: boolean; message?: string; availableBytes?: number }> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const available = quota - usage;

      // Warn if file is larger than 50MB
      if (fileSize > 50 * 1024 * 1024) {
        return {
          ok: false,
          message: 'File exceeds 50MB maximum limit. Please select a smaller map image (PNG, JPG, or WebP).',
          availableBytes: available,
        };
      }

      // Warn if storage quota is full
      if (quota > 0 && fileSize > available) {
        return {
          ok: false,
          message: `Storage quota full (${Math.round(usage / (1024 * 1024))}MB used of ${Math.round(
            quota / (1024 * 1024)
          )}MB). Please delete unused maps to free space.`,
          availableBytes: available,
        };
      }

      return { ok: true, availableBytes: available };
    }
  } catch (err) {
    console.warn('Unable to estimate storage quota:', err);
  }

  // Fallback safety check for file size
  if (fileSize > 50 * 1024 * 1024) {
    return { ok: false, message: 'File is too large (maximum 50MB allowed).' };
  }

  return { ok: true };
}

/**
 * Convert a Data URL or Blob to a stored Blob object.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Register and manage Blob Object URLs.
 * Reuses existing blob URL if one is already registered for this mapId.
 */
export function getOrCreateMapBlobUrl(mapId: string, blob: Blob): string {
  if (mapIdToBlobUrlMap.has(mapId)) {
    const existingUrl = mapIdToBlobUrlMap.get(mapId)!;
    // Check if still in registry
    if (objectUrlRegistry.has(existingUrl)) {
      return existingUrl;
    }
  }

  const url = URL.createObjectURL(blob);
  objectUrlRegistry.add(url);
  mapIdToBlobUrlMap.set(mapId, url);
  return url;
}

export function createMapBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  objectUrlRegistry.add(url);
  return url;
}

export function revokeMapBlobUrl(url: string): void {
  if (url && url.startsWith('blob:') && objectUrlRegistry.has(url)) {
    URL.revokeObjectURL(url);
    objectUrlRegistry.delete(url);

    // Remove from mapId lookup
    for (const [mapId, registeredUrl] of mapIdToBlobUrlMap.entries()) {
      if (registeredUrl === url) {
        mapIdToBlobUrlMap.delete(mapId);
        break;
      }
    }
  }
}

export function revokeBlobUrlForMapId(mapId: string): void {
  if (mapIdToBlobUrlMap.has(mapId)) {
    const url = mapIdToBlobUrlMap.get(mapId)!;
    revokeMapBlobUrl(url);
  }
}

export function revokeAllMapBlobUrls(): void {
  objectUrlRegistry.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  });
  objectUrlRegistry.clear();
  mapIdToBlobUrlMap.clear();
}

/**
 * Save or update a map in IndexedDB.
 */
export async function saveMapToIndexedDB(map: StoredCampaignMap): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MAPS_STORE], 'readwrite');
    const store = tx.objectStore(MAPS_STORE);

    // Save map record
    const request = store.put(map);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to save map in IndexedDB.'));
  });
}

/**
 * Retrieve all maps from IndexedDB sorted by most recent first.
 */
export async function getAllMapsFromIndexedDB(): Promise<StoredCampaignMap[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([MAPS_STORE], 'readonly');
      const store = tx.objectStore(MAPS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const maps: StoredCampaignMap[] = request.result || [];
        // Sort by createdAt descending (most recent first)
        maps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(maps);
      };

      request.onerror = () => reject(request.error || new Error('Failed to retrieve maps from IndexedDB.'));
    });
  } catch (err) {
    console.warn('Failed to access IndexedDB maps store:', err);
    return [];
  }
}

/**
 * Retrieve a specific map by ID.
 */
export async function getMapFromIndexedDB(id: string): Promise<StoredCampaignMap | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MAPS_STORE], 'readonly');
    const store = tx.objectStore(MAPS_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(`Failed to retrieve map ${id}.`));
  });
}

/**
 * Delete a map by ID from IndexedDB.
 */
export async function deleteMapFromIndexedDB(id: string): Promise<void> {
  revokeBlobUrlForMapId(id);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MAPS_STORE], 'readwrite');
    const store = tx.objectStore(MAPS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to delete map ${id}.`));
  });
}

/**
 * Save Active Session state (active map ID, zoom level, pan position).
 */
export async function saveActiveMapSession(state: {
  activeMapId: string;
  viewport?: MapViewportSettings;
}): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE], 'readwrite');
      const store = tx.objectStore(META_STORE);
      const request = store.put({
        key: 'active_session',
        activeMapId: state.activeMapId,
        viewport: state.viewport,
        updatedAt: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to save active session.'));
    });
  } catch (err) {
    console.warn('Failed to save active session state in IndexedDB:', err);
  }
}

/**
 * Load Active Session state from IndexedDB.
 */
export async function getActiveMapSession(): Promise<{
  activeMapId: string;
  viewport?: MapViewportSettings;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE], 'readonly');
      const store = tx.objectStore(META_STORE);
      const request = store.get('active_session');

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            activeMapId: request.result.activeMapId,
            viewport: request.result.viewport,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Update map viewport or grid settings without re-reading the entire image blob.
 */
export async function updateMapSettings(
  id: string,
  updates: Partial<Pick<StoredCampaignMap, 'viewport' | 'gridSettings' | 'name'>>
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([MAPS_STORE], 'readwrite');
      const store = tx.objectStore(MAPS_STORE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing: StoredCampaignMap = getReq.result;
        if (!existing) {
          resolve();
          return;
        }

        const merged: StoredCampaignMap = {
          ...existing,
          ...updates,
        };

        const putReq = store.put(merged);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error || new Error('Failed to update map settings.'));
      };

      getReq.onerror = () => reject(getReq.error || new Error('Failed to read map for update.'));
    });
  } catch (err) {
    console.warn('Failed to update map settings in IndexedDB:', err);
  }
}

/**
 * Update map metadata (Name, Type, updatedAt) in IndexedDB without re-reading or altering image binaries.
 * This guarantees high efficiency and zero image re-compression overhead.
 */
export async function updateMapMetadata(
  id: string,
  metadata: { name?: string; type?: string; updatedAt?: number }
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MAPS_STORE], 'readwrite');
    const store = tx.objectStore(MAPS_STORE);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing: StoredCampaignMap = getReq.result;
      if (!existing) {
        reject(new Error(`Map with ID ${id} not found.`));
        return;
      }

      const merged: StoredCampaignMap = {
        ...existing,
        ...(metadata.name !== undefined ? { name: metadata.name.trim() } : {}),
        ...(metadata.type !== undefined ? { type: metadata.type as any } : {}),
        updatedAt: metadata.updatedAt || Date.now(),
      };

      const putReq = store.put(merged);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error || new Error('Failed to update map metadata in IndexedDB.'));
    };

    getReq.onerror = () => reject(getReq.error || new Error('Failed to read map for metadata update.'));
  });
}

/**
 * Generates an SVG Starter Fantasy Map that can be loaded into IndexedDB with zero external network dependencies.
 */
export function generateStarterFantasyMapDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
    <defs>
      <radialGradient id="oceanGrad" cx="30%" cy="40%" r="80%">
        <stop offset="0%" stop-color="#0a192f"/>
        <stop offset="60%" stop-color="#071324"/>
        <stop offset="100%" stop-color="#030914"/>
      </radialGradient>
      <linearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="40%" stop-color="#162032"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="parchmentBorder" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#d97706"/>
        <stop offset="50%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
      <pattern id="tacticalGridPattern" width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#38bdf8" stroke-width="0.75" stroke-opacity="0.15"/>
      </pattern>
    </defs>

    <!-- Deep Ocean Water -->
    <rect width="1600" height="1000" fill="url(#oceanGrad)"/>

    <!-- Subtle Depth Wave Lines -->
    <path d="M 50 200 Q 200 180 350 210 T 650 200 T 950 220" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-opacity="0.25"/>
    <path d="M 80 450 Q 240 430 400 460 T 700 440" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-opacity="0.2"/>
    <path d="M 120 700 Q 300 680 500 710 T 800 690" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-opacity="0.2"/>

    <!-- Mainland Landmass (High Coast & Mountain Range) -->
    <path d="M 400 0 
             Q 450 120 520 200 
             Q 590 280 540 380 
             Q 490 480 580 580 
             Q 660 670 630 780 
             Q 600 880 700 1000 
             L 1600 1000 
             L 1600 0 Z" 
          fill="url(#landGrad)" stroke="#d97706" stroke-width="3" stroke-opacity="0.7"/>

    <!-- Island of Solitude -->
    <path d="M 220 380 Q 290 350 330 410 Q 360 480 300 520 Q 230 540 190 470 Z" 
          fill="url(#landGrad)" stroke="#f59e0b" stroke-width="2" stroke-opacity="0.6"/>

    <!-- Whispering Isle -->
    <path d="M 150 160 Q 220 140 240 190 Q 250 240 190 260 Q 130 250 120 200 Z" 
          fill="url(#landGrad)" stroke="#f59e0b" stroke-width="1.8" stroke-opacity="0.6"/>

    <!-- Tactical Grid Overlay -->
    <rect width="1600" height="1000" fill="url(#tacticalGridPattern)"/>

    <!-- River Serpents -->
    <path d="M 1600 350 Q 1300 340 1100 400 T 750 420 T 540 380" fill="none" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 1600 720 Q 1250 700 1020 660 T 630 780" fill="none" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round"/>

    <!-- Mountain Peaks (Dragonspire Spine) -->
    <g fill="#334155" stroke="#94a3b8" stroke-width="2">
      <!-- Peak 1 -->
      <polygon points="900,180 840,290 960,290" />
      <polygon points="980,140 910,270 1050,270" fill="#475569" />
      <polygon points="1060,200 1000,310 1120,310" />
      <!-- Peak 2 -->
      <polygon points="870,450 800,560 940,560" />
      <polygon points="950,400 880,530 1020,530" fill="#475569" />
      <polygon points="1030,470 970,580 1090,580" />
      <!-- Peak 3 -->
      <polygon points="920,720 850,830 990,830" />
      <polygon points="1010,680 940,810 1080,810" fill="#475569" />
      <polygon points="1100,740 1040,850 1160,850" />
    </g>

    <!-- Whispering Forest Canopy Circles -->
    <g fill="#065f46" fill-opacity="0.6" stroke="#10b981" stroke-width="1.2">
      <circle cx="680" cy="220" r="28"/>
      <circle cx="720" cy="240" r="34"/>
      <circle cx="760" cy="200" r="26"/>
      <circle cx="710" cy="180" r="22"/>

      <circle cx="750" cy="560" r="32"/>
      <circle cx="790" cy="590" r="38"/>
      <circle cx="830" cy="540" r="30"/>

      <circle cx="1200" cy="300" r="35"/>
      <circle cx="1250" cy="320" r="40"/>
      <circle cx="1300" cy="290" r="32"/>
    </g>

    <!-- King's High Road -->
    <path d="M 600 950 Q 640 800 680 640 T 730 400 T 620 150 L 610 0" 
          fill="none" stroke="#d97706" stroke-width="2.5" stroke-dasharray="6,4" stroke-opacity="0.8"/>

    <!-- Compass Rose -->
    <g transform="translate(180, 820)">
      <circle cx="0" cy="0" r="70" fill="#0f172a" stroke="#d97706" stroke-width="2.5" fill-opacity="0.85"/>
      <circle cx="0" cy="0" r="54" fill="none" stroke="#fbbf24" stroke-width="1" stroke-dasharray="3,3"/>
      <!-- North Star Spike -->
      <polygon points="0,-64 12,0 0,0" fill="#f59e0b"/>
      <polygon points="0,-64 -12,0 0,0" fill="#d97706"/>
      <!-- South Spike -->
      <polygon points="0,64 10,0 0,0" fill="#64748b"/>
      <polygon points="0,64 -10,0 0,0" fill="#475569"/>
      <!-- East Spike -->
      <polygon points="64,0 0,10 0,0" fill="#d97706"/>
      <polygon points="64,0 0,-10 0,0" fill="#f59e0b"/>
      <!-- West Spike -->
      <polygon points="-64,0 0,10 0,0" fill="#475569"/>
      <polygon points="-64,0 0,-10 0,0" fill="#64748b"/>
      <circle cx="0" cy="0" r="6" fill="#fbbf24"/>
      <text x="0" y="-72" text-anchor="middle" fill="#fbbf24" font-family="serif" font-size="16" font-weight="bold">N</text>
    </g>

    <!-- Map Title Banner Box -->
    <g transform="translate(1120, 60)">
      <rect width="420" height="95" rx="8" fill="#0b1120" stroke="url(#parchmentBorder)" stroke-width="2.5" fill-opacity="0.9"/>
      <text x="210" y="40" text-anchor="middle" fill="#fef3c7" font-family="serif" font-size="24" font-weight="bold" letter-spacing="2">THE SWORD COAST</text>
      <text x="210" y="66" text-anchor="middle" fill="#f59e0b" font-family="sans-serif" font-size="12" font-weight="600" letter-spacing="3">WESTERN FRONTIER &amp; DRAGONSPIRE</text>
      <text x="210" y="84" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="10">1 Grid Cell = 50 ft · Scale 1:600</text>
    </g>

    <!-- Outer Decorative Border Frame -->
    <rect x="15" y="15" width="1570" height="970" fill="none" stroke="url(#parchmentBorder)" stroke-width="3"/>
    <rect x="22" y="22" width="1556" height="956" fill="none" stroke="#d97706" stroke-width="1" stroke-opacity="0.5"/>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
