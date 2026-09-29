import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StoredCampaignMap,
  MapViewportSettings,
  MapGridSettings,
  saveMapToIndexedDB,
  getAllMapsFromIndexedDB,
  deleteMapFromIndexedDB,
  saveActiveMapSession,
  getActiveMapSession,
  updateMapSettings,
  updateMapMetadata as updateMapMetadataInDB,
  checkStorageQuota,
  createMapBlobUrl,
  getOrCreateMapBlobUrl,
  revokeBlobUrlForMapId,
  dataUrlToBlob,
  generateStarterFantasyMapDataUrl,
} from '../utils/mapStorage';
import { processMapImageFile } from '../utils/imageProcess';
import { roomSync } from '../utils/roomSync';

export interface CampaignMapWithBlob {
  id: string;
  name: string;
  type: string;
  url: string;
  author: string;
  createdAt: number;
  updatedAt?: number;
  viewport?: MapViewportSettings;
  gridSettings?: MapGridSettings;
}

// Module-level in-memory cache to ensure INSTANT rehydration across tab switches without flicker
let cachedMaps: CampaignMapWithBlob[] | null = null;
let cachedActiveMapId: string | null = null;
let cachedViewport: MapViewportSettings | null = null;

export function useMapStorage(isDm: boolean) {
  // Initialize state with in-memory cache if available (instant 0ms mount when switching tabs)
  const [maps, setMaps] = useState<CampaignMapWithBlob[]>(() => cachedMaps || []);
  const [selectedMapId, setSelectedMapIdState] = useState<string>(() => cachedActiveMapId || '');
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedMaps);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Viewport for active map
  const [initialViewport, setInitialViewport] = useState<MapViewportSettings>(() => {
    return cachedViewport || { scale: 1, position: { x: 0, y: 0 } };
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to trigger temporary "Map Saved" notification
  const triggerSaveFeedback = useCallback(() => {
    setSaveSuccess(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveSuccess(false);
    }, 2800);
  }, []);

  // 1. Rehydrate maps and active session from IndexedDB on mount
  useEffect(() => {
    let isCancelled = false;

    async function loadMapsAndSession() {
      try {
        if (!cachedMaps) {
          setIsLoading(true);
        }

        const storedMaps = await getAllMapsFromIndexedDB();
        const activeSession = await getActiveMapSession();

        if (isCancelled) return;

        // Convert stored Blobs to Object URLs (reusing existing valid blob URLs to avoid duplicates)
        const loadedMaps: CampaignMapWithBlob[] = [];
        storedMaps.forEach((sm) => {
          let url = sm.dataUrl || '';
          if (sm.imageBlob) {
            url = getOrCreateMapBlobUrl(sm.id, sm.imageBlob);
          }

          loadedMaps.push({
            id: sm.id,
            name: sm.name,
            type: sm.type,
            url,
            author: sm.author,
            createdAt: sm.createdAt,
            viewport: sm.viewport,
            gridSettings: sm.gridSettings,
          });
        });

        // Update module cache
        cachedMaps = loadedMaps;
        setMaps(loadedMaps);

        // Determine which map to select:
        // Prioritize session activeMapId if it exists in loaded maps, else fallback
        let targetMapId = '';
        if (cachedActiveMapId && loadedMaps.some((m) => m.id === cachedActiveMapId)) {
          targetMapId = cachedActiveMapId;
        } else if (activeSession?.activeMapId && loadedMaps.some((m) => m.id === activeSession.activeMapId)) {
          targetMapId = activeSession.activeMapId;
        } else if (loadedMaps.length > 0) {
          targetMapId = loadedMaps[0].id;
        }

        cachedActiveMapId = targetMapId;
        setSelectedMapIdState(targetMapId);

        // Restore viewport if saved in session or map
        const targetMap = loadedMaps.find((m) => m.id === targetMapId);
        let restoredViewport: MapViewportSettings = { scale: 1, position: { x: 0, y: 0 } };
        if (activeSession?.viewport) {
          restoredViewport = activeSession.viewport;
        } else if (targetMap?.viewport) {
          restoredViewport = targetMap.viewport;
        }

        cachedViewport = restoredViewport;
        setInitialViewport(restoredViewport);
      } catch (err: any) {
        console.error('Failed to rehydrate maps from IndexedDB:', err);
        setErrorMessage('Failed to load saved maps from local storage.');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadMapsAndSession();

    return () => {
      isCancelled = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // NOTE: We deliberately do NOT revoke active map blob URLs here because the user
      // is only switching tabs inside the application. URLs remain in objectUrlRegistry
      // and will be cleaned up on window beforeunload or when individual maps are deleted.
    };
  }, []);

  // Set selected map and persist session
  const setSelectedMapId = useCallback(
    (id: string) => {
      setSelectedMapIdState(id);
      cachedActiveMapId = id;

      const chosenMap = maps.find((m) => m.id === id);
      const nextViewport = chosenMap?.viewport || { scale: 1, position: { x: 0, y: 0 } };
      cachedViewport = nextViewport;
      setInitialViewport(nextViewport);

      saveActiveMapSession({
        activeMapId: id,
        viewport: nextViewport,
      });
    },
    [maps]
  );

  // 2. Upload and save a new map
  const uploadAndSaveMap = useCallback(
    async ({
      file,
      name,
      type,
      author,
    }: {
      file: File;
      name: string;
      type: string;
      author: string;
    }): Promise<CampaignMapWithBlob> => {
      setIsSaving(true);
      setErrorMessage(null);

      try {
        // Storage quota safety check
        const quotaCheck = await checkStorageQuota(file.size);
        if (!quotaCheck.ok) {
          throw new Error(quotaCheck.message || 'Storage quota exceeded.');
        }

        // Process and compress image client-side to friendly dimensions
        const optimizedDataUrl = await processMapImageFile(file, 2400, 0.84);
        const imageBlob = await dataUrlToBlob(optimizedDataUrl);

        const newMapId = `map-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const objectUrl = createMapBlobUrl(imageBlob);

        const storedMap: StoredCampaignMap = {
          id: newMapId,
          name: name.trim() || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          type,
          author: author || (isDm ? 'Dungeon Master' : 'Player'),
          createdAt: Date.now(),
          imageBlob,
          dataUrl: optimizedDataUrl,
          viewport: { scale: 1, position: { x: 0, y: 0 } },
          gridSettings: {
            enabled: false,
            cellSize: 50,
            offsetX: 0,
            offsetY: 0,
            color: '#38bdf8',
            opacity: 0.35,
          },
        };

        // Commit to IndexedDB
        await saveMapToIndexedDB(storedMap);

        const campaignMap: CampaignMapWithBlob = {
          id: storedMap.id,
          name: storedMap.name,
          type: storedMap.type,
          url: objectUrl,
          author: storedMap.author,
          createdAt: storedMap.createdAt,
          viewport: storedMap.viewport,
          gridSettings: storedMap.gridSettings,
        };

        const updatedMaps = [campaignMap, ...maps.filter((m) => m.id !== newMapId)];
        cachedMaps = updatedMaps;
        cachedActiveMapId = campaignMap.id;
        cachedViewport = campaignMap.viewport || { scale: 1, position: { x: 0, y: 0 } };

        setMaps(updatedMaps);
        setSelectedMapIdState(campaignMap.id);
        setInitialViewport(cachedViewport);

        // Persist session
        await saveActiveMapSession({
          activeMapId: campaignMap.id,
          viewport: campaignMap.viewport,
        });

        // Broadcast to party room safely
        try {
          roomSync.broadcast('MAP_UPLOAD', {
            map: {
              id: campaignMap.id,
              name: campaignMap.name,
              type: campaignMap.type,
              url: optimizedDataUrl,
              author: campaignMap.author,
              createdAt: campaignMap.createdAt,
            },
          });
        } catch (syncErr) {
          console.warn('Room sync broadcast skipped for map upload:', syncErr);
        }

        triggerSaveFeedback();
        return campaignMap;
      } catch (err: any) {
        const msg = err.message || 'Failed to save map.';
        setErrorMessage(msg);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [isDm, maps, triggerSaveFeedback]
  );

  // 3. Load starter fantasy map (Instant one-click map setup)
  const loadStarterFantasyMap = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const dataUrl = generateStarterFantasyMapDataUrl();
      const imageBlob = await dataUrlToBlob(dataUrl);

      const newMapId = `map-starter-${Date.now()}`;
      const objectUrl = createMapBlobUrl(imageBlob);

      const storedMap: StoredCampaignMap = {
        id: newMapId,
        name: 'The Sword Coast Frontier',
        type: 'continent',
        author: isDm ? 'Dungeon Master' : 'Cartographer',
        createdAt: Date.now(),
        imageBlob,
        dataUrl,
        viewport: { scale: 1, position: { x: 0, y: 0 } },
        gridSettings: {
          enabled: true,
          cellSize: 50,
          offsetX: 0,
          offsetY: 0,
          color: '#38bdf8',
          opacity: 0.25,
        },
      };

      await saveMapToIndexedDB(storedMap);

      // Seed starter pins into localStorage for this map
      const starterPins = [
        {
          id: `pin-starter-1`,
          x: 44.5,
          y: 22.8,
          title: 'Highspire Citadel',
          category: 'landmark',
          description: 'The ancient stone citadel guarding the King\'s High Road against goblin raids.',
          privacy: 'shared',
          author: 'Dungeon Master',
          isRevealed: true,
        },
        {
          id: `pin-starter-2`,
          x: 39.8,
          y: 57.5,
          title: 'The Drowned Sailor Tavern',
          category: 'tavern',
          description: 'Cozy roadside tavern renowned for spiced honey mead and clandestine smugglers\' trade.',
          privacy: 'shared',
          author: 'Dungeon Master',
          isRevealed: true,
        },
        {
          id: `pin-starter-3`,
          x: 18.5,
          y: 44.2,
          title: 'Sunken Isle of Az\'gorath',
          category: 'secret',
          description: 'A mist-shrouded isle said to conceal an obsidian vault from the Netherese Empire.',
          privacy: 'dm',
          author: 'Dungeon Master',
          dmNotes: 'Submerged tunnel accessible only at low tide. Contains 3 Water Elementals and a Chest of the Deep.',
          isRevealed: false,
        },
      ];

      try {
        localStorage.setItem(`ttrpg_map_pins_${newMapId}`, JSON.stringify(starterPins));
      } catch {}

      const campaignMap: CampaignMapWithBlob = {
        id: storedMap.id,
        name: storedMap.name,
        type: storedMap.type,
        url: objectUrl,
        author: storedMap.author,
        createdAt: storedMap.createdAt,
        viewport: storedMap.viewport,
        gridSettings: storedMap.gridSettings,
      };

      const updatedMaps = [campaignMap, ...maps];
      cachedMaps = updatedMaps;
      cachedActiveMapId = campaignMap.id;
      cachedViewport = campaignMap.viewport || { scale: 1, position: { x: 0, y: 0 } };

      setMaps(updatedMaps);
      setSelectedMapIdState(campaignMap.id);
      setInitialViewport(cachedViewport);

      await saveActiveMapSession({
        activeMapId: campaignMap.id,
        viewport: campaignMap.viewport,
      });

      triggerSaveFeedback();
      return campaignMap;
    } catch (err: any) {
      const msg = err.message || 'Failed to load starter fantasy map.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [isDm, maps, triggerSaveFeedback]);

  // 4. Delete a map
  const deleteMap = useCallback(
    async (mapId: string) => {
      try {
        // Clean up IndexedDB and blob URL registry
        await deleteMapFromIndexedDB(mapId);
        revokeBlobUrlForMapId(mapId);

        // Clean up pins from localStorage
        try {
          localStorage.removeItem(`ttrpg_map_pins_${mapId}`);
        } catch {}

        const remaining = maps.filter((m) => m.id !== mapId);
        cachedMaps = remaining;

        let nextMapId = selectedMapId;
        if (selectedMapId === mapId) {
          nextMapId = remaining.length > 0 ? remaining[0].id : '';
          cachedActiveMapId = nextMapId;
          setSelectedMapIdState(nextMapId);

          const nextViewport = remaining[0]?.viewport || { scale: 1, position: { x: 0, y: 0 } };
          cachedViewport = nextViewport;
          setInitialViewport(nextViewport);

          saveActiveMapSession({
            activeMapId: nextMapId,
            viewport: nextViewport,
          });
        }

        setMaps(remaining);

        try {
          roomSync.broadcast('MAP_DELETE', { mapId });
        } catch {}
      } catch (err: any) {
        console.error('Error deleting map from storage:', err);
        setErrorMessage('Failed to delete map from storage.');
      }
    },
    [maps, selectedMapId]
  );

  // 5. Update and persist viewport (pan/zoom)
  const saveViewport = useCallback(
    (mapId: string, viewport: MapViewportSettings) => {
      cachedViewport = viewport;
      setMaps((prev) =>
        prev.map((m) => (m.id === mapId ? { ...m, viewport } : m))
      );

      if (cachedMaps) {
        cachedMaps = cachedMaps.map((m) => (m.id === mapId ? { ...m, viewport } : m));
      }

      // Persist in IndexedDB
      updateMapSettings(mapId, { viewport }).catch(() => {});
      saveActiveMapSession({ activeMapId: mapId, viewport }).catch(() => {});
    },
    []
  );

  // 6. Update and persist tactical grid settings
  const saveGridSettings = useCallback(
    (mapId: string, gridSettings: MapGridSettings) => {
      setMaps((prev) =>
        prev.map((m) => (m.id === mapId ? { ...m, gridSettings } : m))
      );

      if (cachedMaps) {
        cachedMaps = cachedMaps.map((m) => (m.id === mapId ? { ...m, gridSettings } : m));
      }

      updateMapSettings(mapId, { gridSettings })
        .then(() => triggerSaveFeedback())
        .catch(() => {});
    },
    [triggerSaveFeedback]
  );

  // 7. Update map metadata (Name & Type) without re-encoding or re-uploading image
  const updateMapMetadata = useCallback(
    async (mapId: string, updates: { name: string; type: string }) => {
      try {
        setIsSaving(true);
        const trimmedName = updates.name.trim();
        const mapType = updates.type;

        // Persist only metadata fields in IndexedDB
        await updateMapMetadataInDB(mapId, {
          name: trimmedName,
          type: mapType,
          updatedAt: Date.now(),
        });

        // Update state and memory cache immediately
        setMaps((prev) => {
          const updated = prev.map((m) =>
            m.id === mapId ? { ...m, name: trimmedName, type: mapType, updatedAt: Date.now() } : m
          );
          cachedMaps = updated;
          return updated;
        });

        // Broadcast to party room safely
        try {
          roomSync.broadcast('MAP_METADATA_UPDATE', {
            mapId,
            name: trimmedName,
            type: mapType,
          });
        } catch {}

        triggerSaveFeedback();
      } catch (err: any) {
        console.error('Failed to update map metadata:', err);
        setErrorMessage(err.message || 'Failed to update map metadata.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [triggerSaveFeedback]
  );

  // Find active map
  const activeMap = maps.find((m) => m.id === selectedMapId) || (maps.length > 0 ? maps[0] : null);

  return {
    maps,
    setMaps,
    selectedMapId,
    setSelectedMapId,
    activeMap,
    initialViewport,
    isLoading,
    isSaving,
    saveSuccess,
    errorMessage,
    setErrorMessage,
    uploadAndSaveMap,
    loadStarterFantasyMap,
    deleteMap,
    updateMapMetadata,
    saveViewport,
    saveGridSettings,
    triggerSaveFeedback,
  };
}
