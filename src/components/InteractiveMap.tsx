import React, { useState, useRef, useEffect } from 'react';
import { MapPin, PinCategory, PinPrivacy } from '../types/ttrpg';
import { roomSync } from '../utils/roomSync';
import { processMapImageFile } from '../utils/imageProcess';
import { useMapStorage, CampaignMapWithBlob } from '../hooks/useMapStorage';
import { MapGridSettings, getMapTypeBadge, STANDARD_MAP_TYPES } from '../utils/mapStorage';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin as PinIcon,
  Eye,
  EyeOff,
  Trash2,
  X,
  Compass,
  Upload,
  Image as ImageIcon,
  Lock,
  Globe,
  Search,
  Edit2,
  Check,
  Save,
  Grid,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FolderOpen,
  Tag,
} from 'lucide-react';

interface InteractiveMapProps {
  isDm: boolean;
  playerName?: string;
}

export type UploadedCampaignMap = CampaignMapWithBlob;

const PIN_CATEGORY_CONFIG: Record<
  PinCategory,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  general: { label: 'General', color: 'text-blue-400', bgColor: 'bg-blue-600', icon: '📜' },
  npc: { label: 'NPC', color: 'text-amber-400', bgColor: 'bg-amber-600', icon: '👤' },
  quest: { label: 'Quest', color: 'text-yellow-400', bgColor: 'bg-yellow-600', icon: '⚔️' },
  loot: { label: 'Loot', color: 'text-emerald-400', bgColor: 'bg-emerald-600', icon: '💰' },
  secret: { label: 'Secret', color: 'text-purple-400', bgColor: 'bg-purple-600', icon: '👁️' },
  landmark: { label: 'Landmark', color: 'text-teal-400', bgColor: 'bg-teal-600', icon: '🏛️' },
  tavern: { label: 'Tavern', color: 'text-orange-400', bgColor: 'bg-orange-600', icon: '🍺' },
  settlement: { label: 'Settlement', color: 'text-cyan-400', bgColor: 'bg-cyan-600', icon: '🏰' },
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ isDm }) => {
  // Persistent IndexedDB Map Storage Hook
  const {
    maps,
    setMaps,
    selectedMapId,
    setSelectedMapId,
    activeMap,
    initialViewport,
    isLoading: isMapsLoading,
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
  } = useMapStorage(isDm);

  // Pins state for the selected map
  const [pins, setPins] = useState<MapPin[]>([]);

  // Map Management: Library Modal, Delete Confirmation Dialog & Edit Metadata Modal
  const [isMapLibraryOpen, setIsMapLibraryOpen] = useState(false);
  const [mapLibraryFilter, setMapLibraryFilter] = useState<string>('all');
  const [mapToDelete, setMapToDelete] = useState<CampaignMapWithBlob | null>(null);
  const [mapToEdit, setMapToEdit] = useState<CampaignMapWithBlob | null>(null);
  const [editMapName, setEditMapName] = useState('');
  const [editMapType, setEditMapType] = useState<string>('Battle Map');
  const [isSubmittingMetadata, setIsSubmittingMetadata] = useState(false);

  // Pan & Zoom
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const isUserInteractingRef = useRef(false);

  // Grid Controls Popover
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);

  // Tool Modes
  const [isPinMode, setIsPinMode] = useState(false);
  const [selectedPinCategory, setSelectedPinCategory] = useState<PinCategory>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Active Pin viewing & editing
  const [activePin, setActivePin] = useState<MapPin | null>(null);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<PinCategory>('general');
  const [editSharedNote, setEditSharedNote] = useState('');
  const [editPersonalNote, setEditPersonalNote] = useState('');
  const [editDmNote, setEditDmNote] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<PinPrivacy>('shared');

  // New Pin Draft coordinates
  const [pendingPinCoords, setPendingPinCoords] = useState<{ x: number; y: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<PinCategory>('general');
  const [draftSharedNote, setDraftSharedNote] = useState('');
  const [draftPersonalNote, setDraftPersonalNote] = useState('');
  const [draftDmNote, setDraftDmNote] = useState('');
  const [draftPrivacy, setDraftPrivacy] = useState<PinPrivacy>('shared');

  // Custom Map Upload Form
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMapName, setUploadMapName] = useState('');
  const [uploadMapType, setUploadMapType] = useState<string>('Battle Map');
  const [uploadMapUrl, setUploadMapUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore initial viewport when active map or session rehydrates
  useEffect(() => {
    if (initialViewport) {
      isUserInteractingRef.current = false;
      setScale(initialViewport.scale || 1);
      setPosition(initialViewport.position || { x: 0, y: 0 });
    }
  }, [initialViewport]);

  // Persist viewport changes to IndexedDB only when user interacts (prevents race-condition overwriting)
  useEffect(() => {
    if (!selectedMapId || !isUserInteractingRef.current) return;
    const timer = setTimeout(() => {
      saveViewport(selectedMapId, { scale, position });
      isUserInteractingRef.current = false;
    }, 350);
    return () => clearTimeout(timer);
  }, [scale, position, selectedMapId, saveViewport]);

  // Load pins for currently selected map
  useEffect(() => {
    if (!selectedMapId) {
      setPins([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`ttrpg_map_pins_${selectedMapId}`);
      if (saved) {
        setPins(JSON.parse(saved));
      } else {
        setPins([]);
      }
    } catch {
      setPins([]);
    }
    setActivePin(null);
    setIsEditingPin(false);
  }, [selectedMapId]);

  // Persist pins whenever they change
  useEffect(() => {
    if (selectedMapId) {
      try {
        localStorage.setItem(`ttrpg_map_pins_${selectedMapId}`, JSON.stringify(pins));
      } catch {}
    }
  }, [pins, selectedMapId]);

  // Real-time multi-user room sync
  useEffect(() => {
    const unsubscribe = roomSync.subscribe((msg) => {
      if (msg.type === 'MAP_UPLOAD' && msg.payload?.map) {
        const incomingMap: UploadedCampaignMap = msg.payload.map;
        setMaps((prev) => {
          if (prev.some((m) => m.id === incomingMap.id)) return prev;
          return [incomingMap, ...prev];
        });
        setSelectedMapId(incomingMap.id);
      }

      if (msg.type === 'MAP_DELETE' && msg.payload?.mapId) {
        setMaps((prev) => prev.filter((m) => m.id !== msg.payload.mapId));
        if (selectedMapId === msg.payload.mapId) {
          setSelectedMapId('');
        }
      }

      if (msg.type === 'MAP_METADATA_UPDATE' && msg.payload?.mapId) {
        setMaps((prev) =>
          prev.map((m) =>
            m.id === msg.payload.mapId
              ? { ...m, name: msg.payload.name, type: msg.payload.type }
              : m
          )
        );
      }

      if (msg.type === 'MAP_PIN_SYNC' && msg.payload?.mapId === selectedMapId) {
        const incomingPin: MapPin = msg.payload.pin;
        setPins((prev) => {
          const index = prev.findIndex((p) => p.id === incomingPin.id);
          if (index >= 0) {
            const copy = [...prev];
            copy[index] = incomingPin;
            return copy;
          }
          return [...prev, incomingPin];
        });
        if (activePin?.id === incomingPin.id) {
          setActivePin(incomingPin);
        }
      }

      if (msg.type === 'MAP_PIN_DELETE' && msg.payload?.mapId === selectedMapId) {
        setPins((prev) => prev.filter((p) => p.id !== msg.payload.pinId));
        if (activePin?.id === msg.payload.pinId) setActivePin(null);
      }
    });

    return () => unsubscribe();
  }, [selectedMapId, activePin]);

  // Zoom handlers
  const handleZoomChange = (newScale: number) => {
    isUserInteractingRef.current = true;
    const clamped = Math.min(4.0, Math.max(0.4, Math.round(newScale * 100) / 100));
    setScale(clamped);
  };

  const handleResetZoom = () => {
    isUserInteractingRef.current = true;
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    isUserInteractingRef.current = true;
    const zoomStep = e.deltaY < 0 ? 0.12 : -0.12;
    handleZoomChange(scale + zoomStep);
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPinMode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isPinMode) return;
    isUserInteractingRef.current = true;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Precise pin dropping on map image
  const handleMapImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPinMode || !imageElementRef.current) return;

    const imgRect = imageElementRef.current.getBoundingClientRect();
    if (
      e.clientX < imgRect.left ||
      e.clientX > imgRect.right ||
      e.clientY < imgRect.top ||
      e.clientY > imgRect.bottom
    ) {
      return;
    }

    const rawPctX = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const rawPctY = ((e.clientY - imgRect.top) / imgRect.height) * 100;

    const clampedX = Math.round(Math.max(0.5, Math.min(99.5, rawPctX)) * 10) / 10;
    const clampedY = Math.round(Math.max(0.5, Math.min(99.5, rawPctY)) * 10) / 10;

    setPendingPinCoords({ x: clampedX, y: clampedY });
    setDraftTitle('');
    setDraftCategory(selectedPinCategory);
    setDraftSharedNote('');
    setDraftPersonalNote('');
    setDraftDmNote('');
    setDraftPrivacy('shared');
    setIsPinMode(false);
  };

  // Save new pin
  const handleSaveDraftPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPinCoords || !draftTitle.trim() || !selectedMapId) return;

    const newPin: MapPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: pendingPinCoords.x,
      y: pendingPinCoords.y,
      title: draftTitle.trim(),
      category: draftCategory,
      description: draftSharedNote.trim(),
      privacy: draftPrivacy,
      author: roomSync.getPeerName() || (isDm ? 'Dungeon Master' : 'Adventurer'),
      personalNotes: draftPersonalNote.trim() || undefined,
      dmNotes: isDm && draftDmNote.trim() ? draftDmNote.trim() : undefined,
      isRevealed: draftPrivacy !== 'dm',
    };

    setPins((prev) => [...prev, newPin]);
    setActivePin(newPin);
    setPendingPinCoords(null);

    if (newPin.privacy === 'shared') {
      roomSync.broadcast('MAP_PIN_SYNC', { mapId: selectedMapId, pin: newPin });
    }
  };

  // Start editing active pin
  const handleStartEditPin = () => {
    if (!activePin) return;
    setEditTitle(activePin.title);
    setEditCategory(activePin.category);
    setEditSharedNote(activePin.description || '');
    setEditPersonalNote(activePin.personalNotes || '');
    setEditDmNote(activePin.dmNotes || '');
    setEditPrivacy(activePin.privacy);
    setIsEditingPin(true);
  };

  // Save edited pin
  const handleSaveEditedPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePin || !editTitle.trim()) return;

    const updatedPin: MapPin = {
      ...activePin,
      title: editTitle.trim(),
      category: editCategory,
      description: editSharedNote.trim(),
      personalNotes: editPersonalNote.trim() || undefined,
      dmNotes: isDm ? (editDmNote.trim() || undefined) : activePin.dmNotes,
      privacy: editPrivacy,
    };

    setPins((prev) => prev.map((p) => (p.id === activePin.id ? updatedPin : p)));
    setActivePin(updatedPin);
    setIsEditingPin(false);

    roomSync.broadcast('MAP_PIN_SYNC', { mapId: selectedMapId, pin: updatedPin });
  };

  // DM Reveal Pin Intel to Party
  const handleRevealPinToPlayers = (pinId: string) => {
    setPins((prev) =>
      prev.map((p) => {
        if (p.id !== pinId) return p;
        const revealedDescription = p.dmNotes
          ? `${p.description ? p.description + '\n\n' : ''}✨ [REVEALED INTEL]: ${p.dmNotes}`
          : p.description;

        const updated: MapPin = {
          ...p,
          privacy: 'shared',
          isRevealed: true,
          description: revealedDescription,
        };

        roomSync.broadcast('MAP_PIN_SYNC', { mapId: selectedMapId, pin: updated });
        if (activePin?.id === pinId) setActivePin(updated);
        return updated;
      })
    );
  };

  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    roomSync.broadcast('MAP_PIN_DELETE', { mapId: selectedMapId, pinId });
    if (activePin?.id === pinId) {
      setActivePin(null);
      setIsEditingPin(false);
    }
  };

  // Process File Upload with quota verification and compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadFile(file);
      setIsProcessingFile(true);
      setUploadStatus('Verifying storage quota and compressing map...');
      const optimizedDataUrl = await processMapImageFile(file, 2400, 0.84);
      setUploadMapUrl(optimizedDataUrl);
      if (!uploadMapName) {
        setUploadMapName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
      setUploadStatus(`Ready to import (${(file.size / (1024 * 1024)).toFixed(1)} MB)!`);
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message || 'Failed to process file'}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleSaveMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!uploadFile && !uploadMapUrl) || !uploadMapName.trim()) return;

    try {
      setIsProcessingFile(true);
      setUploadStatus('Saving map to IndexedDB persistent storage...');

      let targetFile: File;
      if (uploadFile) {
        targetFile = uploadFile;
      } else {
        try {
          const res = await fetch(uploadMapUrl);
          if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
          }
          const blob = await res.blob();
          targetFile = new File([blob], uploadMapName.trim() + '.jpg', { type: blob.type || 'image/jpeg' });
        } catch {
          throw new Error('Unable to download image directly from this URL due to browser cross-origin (CORS) security restrictions. Please save the image file to your device and choose "Select Image File" above.');
        }
      }

      await uploadAndSaveMap({
        file: targetFile,
        name: uploadMapName.trim(),
        type: uploadMapType,
        author: roomSync.getPeerName() || (isDm ? 'Dungeon Master' : 'Player'),
      });

      setIsUploadModalOpen(false);
      setUploadMapName('');
      setUploadMapUrl('');
      setUploadFile(null);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message || 'Failed to save map'}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleStartEditMap = (map: CampaignMapWithBlob) => {
    setMapToEdit(map);
    setEditMapName(map.name);
    setEditMapType(map.type || 'Battle Map');
  };

  const handleSaveMapMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapToEdit || !editMapName.trim()) return;

    try {
      setIsSubmittingMetadata(true);
      await updateMapMetadata(mapToEdit.id, {
        name: editMapName.trim(),
        type: editMapType,
      });
      setMapToEdit(null);
    } catch (err: any) {
      console.error('Failed to update map metadata:', err);
    } finally {
      setIsSubmittingMetadata(false);
    }
  };

  const handleConfirmDeleteMap = async () => {
    if (!mapToDelete) return;
    const targetId = mapToDelete.id;
    setMapToDelete(null);
    await deleteMap(targetId);
  };

  const getPinsCountForMap = (mapId: string): number => {
    if (mapId === selectedMapId) return pins.length;
    try {
      const raw = localStorage.getItem(`ttrpg_map_pins_${mapId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    return 0;
  };

  // Filter visible pins
  const visiblePins = pins.filter((p) => {
    if (!isDm) {
      if (p.privacy === 'dm' && !p.isRevealed) return false;
      if (p.privacy === 'personal' && p.author !== roomSync.getPeerName()) return false;
    }
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchAuthor = p.author?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchAuthor) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Map Control Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Map:</span>
            {maps.length > 0 ? (
              <select
                value={selectedMapId}
                onChange={(e) => {
                  const newId = e.target.value;
                  isUserInteractingRef.current = false;
                  setSelectedMapId(newId);
                  const chosenMap = maps.find((m) => m.id === newId);
                  if (chosenMap?.viewport) {
                    setScale(chosenMap.viewport.scale || 1);
                    setPosition(chosenMap.viewport.position || { x: 0, y: 0 });
                  } else {
                    setScale(1);
                    setPosition({ x: 0, y: 0 });
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer max-w-[220px] truncate"
              >
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.type})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-400 italic">No maps uploaded yet</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>+ Upload Map</span>
          </button>

          {maps.length === 0 && !isSaving && (
            <button
              type="button"
              onClick={() => loadStarterFantasyMap()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 transition cursor-pointer shadow-sm"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Load Starter Map</span>
            </button>
          )}

          {activeMap && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border shadow-sm ${
                getMapTypeBadge(activeMap.type).badgeClass
              }`}
            >
              <span>{getMapTypeBadge(activeMap.type).icon}</span>
              <span>{getMapTypeBadge(activeMap.type).label}</span>
            </span>
          )}

          {activeMap && (
            <button
              type="button"
              onClick={() => handleStartEditMap(activeMap)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer border border-transparent hover:border-slate-700"
              title="Edit map name and type"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {activeMap && (
            <button
              type="button"
              onClick={() => setMapToDelete(activeMap)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer border border-transparent hover:border-slate-700"
              title="Delete this uploaded map from persistent storage"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMapLibraryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer shadow-sm"
            title="Browse and manage map library"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Library ({maps.length})</span>
          </button>

          {/* Map Saved indicator & feedback */}
          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-semibold shadow-md animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Map Saved</span>
            </div>
          )}

          {isSaving && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-semibold shadow-md">
              <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </div>
          )}

          {isMapsLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading maps...</span>
            </div>
          )}
        </div>

        {activeMap && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPinMode(!isPinMode)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-sm ${
                isPinMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 animate-pulse'
                  : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Click then click anywhere on the map to drop a pin"
            >
              <PinIcon className="w-3.5 h-3.5" />
              <span>{isPinMode ? 'Click Map to Drop Pin' : 'Drop Pin'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Persistent Storage Error Message Banner */}
      {errorMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 p-1 cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Map Viewport & Pins Layout */}
      {!activeMap ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border-2 border-dashed border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-300">
            <Compass className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 font-display">
              No Campaign Maps Uploaded Yet
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              Upload your city, continent, town, or regional map image. Maps and active viewport settings are saved securely in persistent IndexedDB storage so you never lose your progress when switching tabs.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-lg cursor-pointer transition"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Custom Map File</span>
            </button>
            <button
              type="button"
              onClick={() => loadStarterFantasyMap()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 shadow-lg cursor-pointer transition"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Load Starter Fantasy Map</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Map Canvas Viewport (Column 8/12) */}
          <div
            ref={mapContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheelZoom}
            className={`lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative shadow-lg h-[640px] flex items-center justify-center select-none ${
              isPinMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* FLOATING ZOOM & GRID HUD */}
            <div
              className="absolute top-3 right-3 z-30 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-xl p-2 flex items-center gap-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleZoomChange(scale - 0.2)}
                className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.05"
                value={scale}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-24 sm:w-32 accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                title="Zoom Slider"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(scale + 0.2)}
                className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-mono font-bold text-amber-300 w-10 text-center tabular-nums">
                {Math.round(scale * 100)}%
              </span>

              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer border-l border-slate-800 pl-1.5"
                title="Reset Zoom & Pan (100%)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Tactical Grid Toggle */}
              <button
                type="button"
                onClick={() => {
                  const currentGrid = activeMap.gridSettings || {
                    enabled: false,
                    cellSize: 50,
                    offsetX: 0,
                    offsetY: 0,
                    color: '#38bdf8',
                    opacity: 0.35,
                  };
                  saveGridSettings(activeMap.id, {
                    ...currentGrid,
                    enabled: !currentGrid.enabled,
                  });
                }}
                className={`p-1 rounded text-xs flex items-center gap-1 transition cursor-pointer border-l border-slate-700 pl-2 ${
                  activeMap.gridSettings?.enabled
                    ? 'text-cyan-300 bg-cyan-950/80 font-bold border border-cyan-500/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Tactical Grid Overlay"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>

              {activeMap.gridSettings?.enabled && (
                <button
                  type="button"
                  onClick={() => setIsGridSettingsOpen(!isGridSettingsOpen)}
                  className={`p-1 rounded transition cursor-pointer ${
                    isGridSettingsOpen ? 'text-amber-300 bg-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Configure Grid Settings"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Grid Settings Popover */}
            {isGridSettingsOpen && activeMap.gridSettings?.enabled && (
              <div
                className="absolute top-16 right-3 z-30 bg-slate-900/95 border border-slate-700 backdrop-blur-md rounded-xl p-3 shadow-2xl w-64 space-y-2.5 text-xs text-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5" />
                    <span>Tactical Grid Settings</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsGridSettingsOpen(false)}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Cell Size</span>
                    <span className="font-mono text-cyan-300">{activeMap.gridSettings.cellSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    step="5"
                    value={activeMap.gridSettings.cellSize}
                    onChange={(e) =>
                      saveGridSettings(activeMap.id, {
                        ...activeMap.gridSettings!,
                        cellSize: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Offset X</label>
                    <input
                      type="number"
                      value={activeMap.gridSettings.offsetX}
                      onChange={(e) =>
                        saveGridSettings(activeMap.id, {
                          ...activeMap.gridSettings!,
                          offsetX: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Offset Y</label>
                    <input
                      type="number"
                      value={activeMap.gridSettings.offsetY}
                      onChange={(e) =>
                        saveGridSettings(activeMap.id, {
                          ...activeMap.gridSettings!,
                          offsetY: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Transform Container with Pan & Zoom */}
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              }}
              onClick={handleMapImageClick}
              className={`relative inline-block max-w-full max-h-full ${
                isPinMode ? 'cursor-crosshair' : ''
              }`}
            >
              <img
                ref={imageElementRef}
                src={activeMap.url}
                alt={activeMap.name}
                draggable={false}
                className="max-h-[580px] w-auto object-contain rounded-lg shadow-2xl block pointer-events-none"
              />

              {/* Tactical Grid Overlay Layer */}
              {activeMap.gridSettings?.enabled && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-lg"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${activeMap.gridSettings.color}44 1px, transparent 1px), linear-gradient(to bottom, ${activeMap.gridSettings.color}44 1px, transparent 1px)`,
                    backgroundSize: `${activeMap.gridSettings.cellSize}px ${activeMap.gridSettings.cellSize}px`,
                    backgroundPosition: `${activeMap.gridSettings.offsetX}px ${activeMap.gridSettings.offsetY}px`,
                  }}
                />
              )}

              {/* REDUCED PIN SIZE: SLEEK, UNCLUTTERED, MAP REMAINS FULLY VISIBLE */}
              {visiblePins.map((pin) => {
                const config = PIN_CATEGORY_CONFIG[pin.category] || PIN_CATEGORY_CONFIG.general;
                const isSelected = activePin?.id === pin.id;
                const isDmSecret = pin.privacy === 'dm';
                const isPersonal = pin.privacy === 'personal';

                return (
                  <div
                    key={pin.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePin(pin);
                      setIsEditingPin(false);
                    }}
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-full cursor-pointer transition-transform group z-20 ${
                      isSelected ? 'scale-130 z-30 ring-2 ring-amber-400 rounded-full' : 'hover:scale-130 hover:z-30'
                    }`}
                  >
                    {/* Micro 10px marker (reduced to half size, leaving map completely clear) */}
                    <div
                      className={`relative flex items-center justify-center w-2.5 h-2.5 rounded-full border shadow-sm transition-all ${
                        isDmSecret
                          ? 'bg-purple-600 border-purple-300 ring-1 ring-purple-400/60'
                          : isPersonal
                          ? 'bg-cyan-500 border-cyan-200 ring-1 ring-cyan-400/60'
                          : `${config.bgColor} border-white ring-1 ring-black/40`
                      }`}
                    >
                      {/* Micro glowing center dot */}
                      <div className="w-1 h-1 rounded-full bg-white/95" />

                      {/* Small Privacy Indicator Dot */}
                      {isDmSecret && (
                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-purple-300 border border-slate-950" />
                      )}
                      {isPersonal && (
                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-300 border border-slate-950" />
                      )}
                    </div>

                    {/* Needle pointer tip */}
                    <div className="w-0.5 h-0.5 bg-white mx-auto -mt-0.5 rotate-45" />

                    {/* Tooltip on Hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded bg-slate-950/95 border border-slate-700 text-white text-[10px] font-semibold whitespace-nowrap shadow-xl pointer-events-none flex items-center gap-1 z-30">
                      <span>{config.icon}</span>
                      <span>{pin.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instruction Floating Watermark at bottom left */}
            <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none backdrop-blur-sm">
              <span>🖱️ Drag to pan</span>
              <span>·</span>
              <span>📜 Scroll or use slider to zoom</span>
              <span>·</span>
              <span className="text-amber-300 font-semibold">{visiblePins.length} pins</span>
            </div>
          </div>

          {/* Right Column: FILTERS MOVED TO TOP, Followed by Pin Inspector & Editor (Column 4/12) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* 1. FILTER PINS OPTION MOVED TO TOP */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  Filter Map Pins
                </h4>
                <span className="text-[11px] text-slate-500">{visiblePins.length} shown</span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search pins or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  All
                </button>
                {(Object.keys(PIN_CATEGORY_CONFIG) as PinCategory[]).map((cat) => {
                  const cfg = PIN_CATEGORY_CONFIG[cat];
                  const count = pins.filter((p) => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-[11px] px-2 py-1 rounded-md border flex items-center gap-1 transition cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-slate-800 text-amber-300 border-amber-500/60 font-semibold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                      {count > 0 && <span className="text-[10px] text-slate-500">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ACTIVE PIN INSPECTOR & EDIT FORM */}
            {activePin ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3.5 shadow-xl ring-1 ring-amber-500/20">
                {isEditingPin ? (
                  /* EDIT PIN MODE FORM */
                  <form onSubmit={handleSaveEditedPin} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Pin &amp; Notes
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingPin(false)}
                        className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Title *</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">Category</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as PinCategory)}
                          className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                        >
                          {(Object.keys(PIN_CATEGORY_CONFIG) as PinCategory[]).map((cat) => (
                            <option key={cat} value={cat}>
                              {PIN_CATEGORY_CONFIG[cat].icon} {PIN_CATEGORY_CONFIG[cat].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">Privacy Level</label>
                        <select
                          value={editPrivacy}
                          onChange={(e) => setEditPrivacy(e.target.value as PinPrivacy)}
                          className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
                        >
                          <option value="shared">🌐 Shared with Party</option>
                          <option value="personal">🔒 Personal Note</option>
                          {isDm && <option value="dm">👁️ DM Secret</option>}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Shared Party Note
                      </label>
                      <textarea
                        rows={3}
                        value={editSharedNote}
                        onChange={(e) => setEditSharedNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-cyan-300 block mb-1">
                        Personal Private Note
                      </label>
                      <input
                        type="text"
                        value={editPersonalNote}
                        onChange={(e) => setEditPersonalNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-950 border border-slate-700 text-cyan-200 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {isDm && (
                      <div>
                        <label className="text-[11px] font-semibold text-purple-300 block mb-1">
                          DM Secret Notes (Hidden from Players)
                        </label>
                        <textarea
                          rows={2}
                          value={editDmNote}
                          onChange={(e) => setEditDmNote(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-950 border border-purple-800 text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsEditingPin(false)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1 px-4 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded cursor-pointer transition shadow"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* VIEW PIN MODE */
                  <>
                    <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{PIN_CATEGORY_CONFIG[activePin.category]?.icon}</span>
                          <h3 className="text-sm font-bold text-slate-100">{activePin.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                            {PIN_CATEGORY_CONFIG[activePin.category]?.label}
                          </span>
                          <span className="text-slate-600 text-[10px]">·</span>
                          <span className="text-[10px] text-slate-400">By {activePin.author}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleStartEditPin}
                          title="Edit this pin and notes"
                          className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 cursor-pointer transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActivePin(null)}
                          className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Shared Party Notes */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-emerald-400" />
                        Shared Party Note:
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                        {activePin.description || 'No shared notes recorded yet.'}
                      </p>
                    </div>

                    {/* Personal Notes (Player Private) */}
                    {(activePin.personalNotes || activePin.author === roomSync.getPeerName()) && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-cyan-400" />
                          Personal Note (Private to You):
                        </span>
                        <p className="text-xs text-cyan-200/90 leading-relaxed bg-cyan-950/40 p-2.5 rounded-lg border border-cyan-800/40 whitespace-pre-wrap">
                          {activePin.personalNotes || 'No personal scratchpad notes added.'}
                        </p>
                      </div>
                    )}

                    {/* DM Private Notes (DM Only) with Reveal Button */}
                    {isDm && activePin.dmNotes && (
                      <div className="space-y-1.5 p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                            <EyeOff className="w-3 h-3 text-purple-400" />
                            DM Secret Notes:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevealPinToPlayers(activePin.id)}
                            className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded cursor-pointer transition shadow-sm flex items-center gap-1"
                            title="Reveal secret notes to players in the room"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Make Public</span>
                          </button>
                        </div>
                        <p className="text-xs text-purple-200 leading-relaxed whitespace-pre-wrap">
                          {activePin.dmNotes}
                        </p>
                      </div>
                    )}

                    {/* Actions Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={handleStartEditPin}
                        className="flex items-center gap-1 text-slate-300 hover:text-amber-300 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Edit Pin</span>
                      </button>

                      <div className="ml-auto flex items-center gap-2">
                        {isDm && activePin.privacy === 'dm' && !activePin.isRevealed && (
                          <button
                            type="button"
                            onClick={() => handleRevealPinToPlayers(activePin.id)}
                            className="flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer mr-2"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Reveal to Party</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeletePin(activePin.id)}
                          className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-center text-xs text-slate-400">
                <PinIcon className="w-6 h-6 text-amber-400/50 mx-auto" />
                <p className="font-semibold text-slate-300">Select any pin on the map</p>
                <p className="text-[11px] text-slate-500">
                  Click a marker to view details, edit its notes, or reveal DM secret intel.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW PIN FORM */}
      {pendingPinCoords && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PinIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Drop Pin on {activeMap?.name} ({pendingPinCoords.x}%, {pendingPinCoords.y}%)
                </h3>
              </div>
              <button
                onClick={() => setPendingPinCoords(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDraftPin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Location / POI Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Iron Gate Tavern, The Ruined Shrine, King's Treasury"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value as PinCategory)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {(Object.keys(PIN_CATEGORY_CONFIG) as PinCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {PIN_CATEGORY_CONFIG[cat].icon} {PIN_CATEGORY_CONFIG[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Privacy Level</label>
                  <select
                    value={draftPrivacy}
                    onChange={(e) => setDraftPrivacy(e.target.value as PinPrivacy)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="shared">🌐 Shared with Party</option>
                    <option value="personal">🔒 Personal Note (Only You)</option>
                    {isDm && <option value="dm">👁️ DM Secret (Hidden until revealed)</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Shared Note (Party knowledge)
                </label>
                <textarea
                  rows={3}
                  placeholder="Details, lore, rumors, or encounter notes..."
                  value={draftSharedNote}
                  onChange={(e) => setDraftSharedNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-cyan-300 block mb-1">
                  Personal Scratchpad Notes (Only you see this)
                </label>
                <input
                  type="text"
                  placeholder="Private reminders or loot items..."
                  value={draftPersonalNote}
                  onChange={(e) => setDraftPersonalNote(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {isDm && (
                <div>
                  <label className="text-xs font-semibold text-purple-300 block mb-1">
                    DM Secret Notes (Hidden until you click "Make Public")
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Secret DC checks, trapped chests, monster stats..."
                    value={draftDmNote}
                    onChange={(e) => setDraftDmNote(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-purple-800 text-purple-200 placeholder:text-purple-600 focus:outline-none focus:border-purple-400 resize-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingPinCoords(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer transition shadow"
                >
                  Save Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD CUSTOM MAP IMAGE */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Upload Campaign Map
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Upload your city, continent, town, or regional map image. It will be compressed client-side and automatically synchronized with everyone in your session room.
            </p>

            <form onSubmit={handleSaveMap} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Map Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ironford Town, Everpeak Continent, Waterdeep"
                  value={uploadMapName}
                  onChange={(e) => setUploadMapName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Map Scale / Type
                </label>
                <select
                  value={uploadMapType}
                  onChange={(e) => setUploadMapType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {STANDARD_MAP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Select Image File (PNG, JPG, WebP)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-300 hover:file:bg-slate-700 cursor-pointer"
                />
                {isProcessingFile && (
                  <div className="text-xs text-amber-400 mt-1.5 flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Processing image...</span>
                  </div>
                )}
                {uploadStatus && !isProcessingFile && (
                  <div className="text-xs text-emerald-400 mt-1">{uploadStatus}</div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Or Paste Direct Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/map.jpg"
                  value={uploadMapUrl}
                  onChange={(e) => setUploadMapUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {uploadMapUrl && (
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-300 font-medium truncate">
                    Ready to upload and broadcast to room
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadMapUrl || !uploadMapName.trim() || isProcessingFile}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg cursor-pointer transition shadow"
                >
                  Upload &amp; Sync to Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAMPAIGN MAP LIBRARY & ASSET MANAGER */}
      {isMapLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                    <span>Campaign Map Library</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400">
                      {maps.length} {maps.length === 1 ? 'map' : 'maps'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Switch active maps, edit metadata tags, or delete saved maps from local IndexedDB storage.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMapLibraryOpen(false);
                    setIsUploadModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Upload Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMapLibraryOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setMapLibraryFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-lg transition font-medium cursor-pointer ${
                  mapLibraryFilter === 'all'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Maps ({maps.length})
              </button>
              {STANDARD_MAP_TYPES.map((t) => {
                const count = maps.filter((m) => m.type === t).length;
                if (count === 0 && mapLibraryFilter !== t) return null;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMapLibraryFilter(t)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition font-medium cursor-pointer ${
                      mapLibraryFilter === t
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t} ({count})
                  </button>
                );
              })}
            </div>

            {/* Map Cards Grid */}
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {maps.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-xl space-y-3">
                  <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No maps found in persistent storage</p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMapLibraryOpen(false);
                        setIsUploadModalOpen(true);
                      }}
                      className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer transition shadow"
                    >
                      Upload Custom Map
                    </button>
                    <button
                      type="button"
                      onClick={() => loadStarterFantasyMap()}
                      className="px-4 py-2 text-xs font-bold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 rounded-lg cursor-pointer transition"
                    >
                      Load Starter Map
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {maps
                    .filter((m) => mapLibraryFilter === 'all' || m.type === mapLibraryFilter)
                    .map((m) => {
                      const isActive = m.id === selectedMapId;
                      const badge = getMapTypeBadge(m.type);
                      const pinCount = getPinsCountForMap(m.id);

                      return (
                        <div
                          key={m.id}
                          className={`rounded-xl border transition-all overflow-hidden flex flex-col bg-slate-950 shadow-md ${
                            isActive
                              ? 'border-amber-400 ring-2 ring-amber-400/30'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Card Preview Image */}
                          <div
                            onClick={() => {
                              setSelectedMapId(m.id);
                              if (m.viewport) {
                                setScale(m.viewport.scale || 1);
                                setPosition(m.viewport.position || { x: 0, y: 0 });
                              }
                            }}
                            className="h-36 bg-slate-900 relative cursor-pointer group overflow-hidden flex items-center justify-center"
                          >
                            <img
                              src={m.url}
                              alt={m.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            {/* Type Badge Overlay */}
                            <div className="absolute top-2 left-2">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border backdrop-blur-md shadow flex items-center gap-1 ${badge.badgeClass}`}
                              >
                                <span>{badge.icon}</span>
                                <span>{badge.label}</span>
                              </span>
                            </div>

                            {/* Active Map Pill */}
                            {isActive && (
                              <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-400 text-slate-950 shadow flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>ACTIVE</span>
                              </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                                <Compass className="w-4 h-4" />
                                <span>{isActive ? 'Currently Active' : 'Switch to this Map'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h4
                                  className="text-sm font-bold text-slate-100 truncate"
                                  title={m.name}
                                >
                                  {m.name}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                <span>By {m.author}</span>
                                <span>•</span>
                                <span>{pinCount} {pinCount === 1 ? 'pin' : 'pins'}</span>
                              </div>
                            </div>

                            {/* Card Action Buttons */}
                            <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMapId(m.id);
                                  if (m.viewport) {
                                    setScale(m.viewport.scale || 1);
                                    setPosition(m.viewport.position || { x: 0, y: 0 });
                                  }
                                  setIsMapLibraryOpen(false);
                                }}
                                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                                  isActive
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                              >
                                {isActive ? 'Active on Canvas' : 'Select Map'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStartEditMap(m)}
                                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="Edit Map Name & Type"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setMapToDelete(m)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="Delete Map from Storage"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT MAP METADATA (NAME & TYPE) */}
      {mapToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-display">
                    Edit Map Metadata
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Update map name and category without re-processing image binaries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapToEdit(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail Preview */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
              <img
                src={mapToEdit.url}
                alt={mapToEdit.name}
                className="w-14 h-14 object-cover rounded-lg border border-slate-800 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">
                  {mapToEdit.name}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  Uploaded by {mapToEdit.author}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveMapMetadata} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Map Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tavern Cellar - Ambush, Forest Road Ambush"
                  value={editMapName}
                  onChange={(e) => setEditMapName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Map Type / Category
                </label>
                <select
                  value={editMapType}
                  onChange={(e) => setEditMapType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {STANDARD_MAP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                ℹ️ <strong>Storage Efficiency:</strong> Only the metadata fields are patched in IndexedDB. Your image file and dropped pins remain intact.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMapToEdit(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editMapName.trim() || isSubmittingMetadata}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg cursor-pointer transition shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmittingMetadata ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION GUARD DIALOG */}
      {mapToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-900/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Delete Campaign Map?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to delete &ldquo;
                  <span className="font-semibold text-rose-300">{mapToDelete.name}</span>
                  &rdquo;? This will remove the map and its dropped pins from your local storage.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300/90 leading-relaxed">
              ⚠️ <strong>Memory Cleanup:</strong> The map binary and associated Object URLs will be immediately revoked from browser memory to free storage.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMapToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMap}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer transition shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Map</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
