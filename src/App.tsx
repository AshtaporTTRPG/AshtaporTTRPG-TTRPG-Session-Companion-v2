/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { Crown, Shield, Volume2, VolumeX, Eye, EyeOff, Radio, X } from 'lucide-react';
import { isAudioEnabled, toggleAudio } from './utils/audio';
import { CombatTracker } from './components/CombatTracker';
import { DiceChamber } from './components/DiceChamber';
import { GeometryCalculator } from './components/GeometryCalculator';
import { Grimoire } from './components/Grimoire';
import { NotesTab, BroadcastNotePayload, OBR_BROADCAST_NOTE_KEY } from './components/NotesTab';
import { liveFeedSync } from './utils/liveFeedSync';

export type ActiveTab = 'combat' | 'dice' | 'range' | 'grimoire' | 'notes';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('combat');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isGM, setIsGM] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Adventurer');
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      return isAudioEnabled();
    } catch {
      return true;
    }
  });
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ashtapor_pinned') === 'true';
    } catch {
      return false;
    }
  });

  // Table Broadcast Note State (revealed by GM to entire table)
  const [broadcastNote, setBroadcastNote] = useState<BroadcastNotePayload | null>(() => {
    try {
      const cached = localStorage.getItem('ashtapor_broadcast_note');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(null);

  // Initialize OBR Lifecycle and read initial pin preference
  useEffect(() => {
    OBR.onReady(async () => {
      try {
        const role = await OBR.player.getRole();
        const isGmRole = role === 'GM';
        const name = (await OBR.player.getName()) || (isGmRole ? 'Game Master' : 'Player');
        let playerId = '';
        try {
          playerId = await OBR.player.getId();
        } catch {}

        setIsGM(isGmRole);
        setPlayerName(name);
        liveFeedSync.setIdentity(name, isGmRole, playerId);

        // Read ashtapor_pinned from localStorage and apply the initial disableClickAway setting
        const savedPinned = localStorage.getItem('ashtapor_pinned') === 'true';
        setIsPinned(savedPinned);
        try {
          const popoverApi = (OBR as any).popover;
          if (popoverApi && typeof popoverApi.setProperties === 'function') {
            await popoverApi.setProperties({ disableClickAway: savedPinned });
          }
        } catch (popoverErr) {
          console.warn('Could not set initial popover properties:', popoverErr);
        }

        // Fetch initial broadcast note if any
        try {
          const meta = await OBR.room.getMetadata();
          const broadcast = meta[OBR_BROADCAST_NOTE_KEY] as BroadcastNotePayload | undefined;
          if (broadcast && broadcast.title) {
            setBroadcastNote(broadcast);
          }
        } catch {}

        setIsReady(true);
      } catch (err) {
        console.error('Error during OBR initialization:', err);
        setIsReady(true);
      }
    });

    // Auto-fallback if opened in a standalone browser tab / dev environment outside of Owlbear Rodeo
    const fallbackTimer = setTimeout(() => {
      if (!OBR.isAvailable) {
        setIsGM(true);
        setPlayerName('GM (Standalone)');
        liveFeedSync.setIdentity('GM (Standalone)', true);
        setIsReady(true);
      }
    }, 1500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  // Listen for native OBR player identity and role updates
  useEffect(() => {
    if (!isReady || !OBR.isReady) return;
    const unsub = OBR.player.onChange((player) => {
      const isGmRole = player.role ? player.role === 'GM' : isGM;
      if (player.role) {
        setIsGM(isGmRole);
      }
      if (player.name) {
        setPlayerName(player.name);
      }
      liveFeedSync.setIdentity(player.name || playerName, isGmRole, player.id);
    });
    return () => unsub();
  }, [isReady, isGM, playerName]);

  // Listen for remote OBR Broadcast Note updates
  useEffect(() => {
    if (!isReady || !OBR.isReady) return;

    const unsub = OBR.room.onMetadataChange((meta) => {
      const broadcast = meta[OBR_BROADCAST_NOTE_KEY] as BroadcastNotePayload | undefined;
      if (broadcast && broadcast.title) {
        setBroadcastNote(broadcast);
        setDismissedBroadcastId((prev) => (prev === broadcast.id ? prev : null));
      } else {
        setBroadcastNote(null);
        setDismissedBroadcastId(null);
      }
    });

    return () => unsub();
  }, [isReady]);

  // Standalone event listener fallback for local browser testing
  useEffect(() => {
    const handleLocalBroadcast = (e: any) => {
      const detail = e.detail as BroadcastNotePayload | null;
      if (detail && detail.title) {
        setBroadcastNote(detail);
        setDismissedBroadcastId(null);
      } else {
        setBroadcastNote(null);
        setDismissedBroadcastId(null);
      }
    };
    window.addEventListener('ashtapor-broadcast-note', handleLocalBroadcast);
    return () => window.removeEventListener('ashtapor-broadcast-note', handleLocalBroadcast);
  }, []);

  // Audio Toggle Handler
  const handleToggleSound = () => {
    const next = toggleAudio();
    setSoundOn(next);
  };

  // Window Pin Toggle Handler: saves preference and calls OBR.popover.setProperties
  const handleTogglePin = async () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    try {
      localStorage.setItem('ashtapor_pinned', nextPinned ? 'true' : 'false');
    } catch {}

    try {
      const popoverApi = (OBR as any).popover;
      if (popoverApi && typeof popoverApi.setProperties === 'function') {
        await popoverApi.setProperties({ disableClickAway: nextPinned });
      }
    } catch (err) {
      console.warn('Could not set popover disableClickAway:', err);
    }
  };

  // Stop broadcasting note (GM Action)
  const handleStopBroadcasting = async () => {
    try {
      if (OBR.isReady) {
        await OBR.room.setMetadata({
          [OBR_BROADCAST_NOTE_KEY]: undefined,
        });
      }
      localStorage.removeItem('ashtapor_broadcast_note');
      window.dispatchEvent(new CustomEvent('ashtapor-broadcast-note', { detail: null }));
      setBroadcastNote(null);
    } catch (err) {
      console.error('Error stopping broadcast:', err);
    }
  };

  const shouldShowBroadcastModal = broadcastNote && dismissedBroadcastId !== broadcastNote.id;

  // Fallback loader if OBR is not yet ready (sized to expanded 820px height)
  if (!isReady) {
    return (
      <div className="w-full max-w-[480px] h-[820px] max-h-[820px] mx-auto bg-[#0b0f17] text-slate-200 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden border border-slate-800 shadow-2xl">
        <div className="relative mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <div className="w-7 h-7 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          </div>
        </div>
        <h2 className="text-base font-bold font-display tracking-wide text-amber-300 mb-1.5">
          Connecting to Tabletop...
        </h2>
        <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
          Loading Ashtapor Companion for Owlbear Rodeo.
        </p>

        {/* Standalone preview buttons for testing outside Owlbear */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setIsGM(true);
              setPlayerName('GM (Preview)');
              liveFeedSync.setIdentity('GM (Preview)', true);
              setIsReady(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition cursor-pointer"
          >
            Preview GM
          </button>
          <button
            onClick={() => {
              setIsGM(false);
              setPlayerName('Player (Preview)');
              liveFeedSync.setIdentity('Player (Preview)', false);
              setIsReady(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition cursor-pointer"
          >
            Preview Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[820px] w-full max-w-[480px] bg-neutral-950 text-neutral-100 overflow-hidden select-none mx-auto border border-neutral-800 shadow-2xl relative">
      {/* 1. TOP HEADER: RELOCATED UTILITY MICRO-BAR (22px) + ZERO-SCROLL FULL-WIDTH 5 TABS */}
      <header className="shrink-0 z-40 bg-neutral-900/95 border-b border-neutral-800">
        {/* Row A: Slim Utility Micro-Bar (22px height) */}
        <div className="h-6 px-2.5 bg-neutral-950/90 border-b border-neutral-800/80 flex items-center justify-between text-[11px]">
          {/* Left: App Identity & Player Tag */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs leading-none">⚔️</span>
            <span className="font-bold text-[11px] font-display text-neutral-200 tracking-wide">
              Ashtapor
            </span>
            <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[120px]">
              · {playerName}
            </span>
          </div>

          {/* Right: Relocated Utility Controls (GM badge, Audio Toggle, Pin Button) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Ultra-compact GM / PC Role Badge */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                isGM
                  ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
                  : 'bg-cyan-950/80 border-cyan-600/70 text-cyan-300'
              }`}
              title={`Role: ${isGM ? 'Game Master (GM)' : 'Player (PC)'} - ${playerName}`}
            >
              {isGM ? (
                <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              ) : (
                <Shield className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              )}
              <span>{isGM ? 'GM' : 'PC'}</span>
            </div>

            {/* Audio Mute/Unmute Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundOn ? 'Mute Audio' : 'Unmute Audio'}
              aria-label={soundOn ? 'Mute Audio' : 'Unmute Audio'}
              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
            >
              {soundOn ? (
                <Volume2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <VolumeX className="w-3 h-3 text-neutral-500" />
              )}
            </button>

            {/* Pin Toggle Button (📌): Disables popover click-away in Owlbear */}
            <button
              type="button"
              onClick={handleTogglePin}
              title={isPinned ? 'Window Pinned (Click-away disabled)' : 'Pin Window (Prevent auto-closing)'}
              aria-label={isPinned ? 'Window Pinned (Click-away disabled)' : 'Pin Window (Prevent auto-closing)'}
              className={`px-1 py-0.5 text-[11px] rounded border transition cursor-pointer flex items-center justify-center ${
                isPinned
                  ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/50 shadow-sm'
                  : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              <span className={`leading-none ${isPinned ? 'scale-110 drop-shadow' : 'opacity-70'}`}>
                📌
              </span>
            </button>
          </div>
        </div>

        {/* Row B: 5 Navigation Tabs (Exact 5-column grid: ZERO horizontal scroll, perfectly visible) */}
        <nav className="w-full grid grid-cols-5 gap-1 p-1 bg-neutral-900 select-none overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab('combat')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
              activeTab === 'combat'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Unified Combat Tracker & Combat Feed"
          >
            <span className="text-xs leading-none select-none">⚔️</span>
            <span className="truncate">Combat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dice')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
              activeTab === 'dice'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Dice Tray (formula bar, staged dice pool, multi-d20 engine, macros, roll feed)"
          >
            <span className="text-xs leading-none select-none">🎲</span>
            <span className="truncate">Dice</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('range')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
              activeTab === 'range' || (activeTab as string) === 'geometry'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="3D Range Finder & Homebrew Jump/Fall damage tools"
          >
            <span className="text-xs leading-none select-none">📐</span>
            <span className="truncate">3D Range</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grimoire')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
              activeTab === 'grimoire'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Ashtapor Homebrew Rules reference with search"
          >
            <span className="text-xs leading-none select-none">📖</span>
            <span className="truncate">Grimoire</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
              activeTab === 'notes'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Scoped 3-tier Notes: My Notes, Table Notes, DM Notes"
          >
            <span className="text-xs leading-none select-none">📝</span>
            <span className="truncate">Notes</span>
          </button>
        </nav>
      </header>

      {/* 2. MAIN CONTENT AREA: flex-1 min-h-0 overflow-y-auto p-2 */}
      <main className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col">
        {activeTab === 'combat' && (
          <CombatTracker isDm={isGM} playerName={playerName} />
        )}
        {activeTab === 'dice' && (
          <DiceChamber isDm={isGM} playerName={playerName} />
        )}
        {(activeTab === 'range' || (activeTab as string) === 'geometry') && (
          <GeometryCalculator />
        )}
        {activeTab === 'grimoire' && (
          <Grimoire isDm={isGM} />
        )}
        {activeTab === 'notes' && (
          <NotesTab isDm={isGM} playerName={playerName} />
        )}
      </main>

      {/* 3. TABLE BROADCAST NOTE MODAL OVERLAY (ALL CONNECTED CLIENTS) */}
      {shouldShowBroadcastModal && (
        <div className="absolute inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="w-full max-w-sm bg-neutral-900 border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl space-y-3 ring-1 ring-amber-400/40">
            {/* Broadcast Banner Header */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div className="truncate">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                    Table Broadcast
                  </span>
                  <h3 className="text-xs font-bold text-neutral-100 font-display truncate">
                    {broadcastNote.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDismissedBroadcastId(broadcastNote.id)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-800 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Note Text Content */}
            <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800 text-xs text-neutral-200 font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
              {broadcastNote.content}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
              <span className="text-[10px] text-neutral-500 font-mono">
                Revealed by Game Master
              </span>

              <div className="flex items-center gap-2">
                {isGM && (
                  <button
                    type="button"
                    onClick={handleStopBroadcasting}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition cursor-pointer flex items-center gap-1"
                    title="Stop broadcasting this note to all player screens"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>Stop Revealing</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDismissedBroadcastId(broadcastNote.id)}
                  className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow transition cursor-pointer"
                >
                  Dismiss / Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
