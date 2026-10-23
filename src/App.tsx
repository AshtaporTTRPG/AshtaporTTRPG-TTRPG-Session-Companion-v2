/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { Crown, Shield, Volume2, VolumeX, Eye, EyeOff, Radio, X, Copy, Check } from 'lucide-react';
import { isAudioEnabled, toggleAudio } from './utils/audio';
import { copyToClipboard } from './utils/clipboard';
import { runBootSanitizerOnce } from './utils/notesSanitizer';
import { WhiteboardTracker } from './types/WhiteboardTracker';
import { DiceChamber } from './components/DiceChamber';
import { RangeTab } from './components/range/RangeTab';
import { Grimoire } from './components/Grimoire';
import { NotesTab, BroadcastNotePayload, OBR_BROADCAST_NOTE_KEY } from './components/notes/NotesTab';
import { liveFeedSync } from './utils/liveFeedSync';
import { ContextualHelpTooltip } from './components/common/ContextualHelpTooltip';

export type ActiveTab = 'combat' | 'dice' | 'range' | 'grimoire' | 'notes';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('combat');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isGM, setIsGM] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Adventurer');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [hasSeenHelp, setHasSeenHelp] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ashtapor_help_seen') === 'true';
    } catch {
      return false;
    }
  });
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      return isAudioEnabled();
    } catch {
      return true;
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
  const [broadcastCopied, setBroadcastCopied] = useState<boolean>(false);

  // Table-wide Alert State (e.g. DM Called for Initiative)
  const [tableAlert, setTableAlert] = useState<string | null>(null);

  const isGmRef = useRef<boolean>(isGM);
  useEffect(() => {
    isGmRef.current = isGM;
  }, [isGM]);

  // Live combat state snapshot ref for replying to player sync requests
  const liveCombatSnapshotRef = useRef<{
    combatants: any[];
    round: number;
    activeIndex: number;
    activeCombatantId: string | null;
  }>({
    combatants: [],
    round: 0,
    activeIndex: 0,
    activeCombatantId: null,
  });

  // Track live snapshot updates dispatched from CombatTracker
  useEffect(() => {
    const handleSnapshot = (e: any) => {
      if (e.detail) {
        liveCombatSnapshotRef.current = e.detail;
      }
    };
    window.addEventListener('ashtapor-combat-snapshot', handleSnapshot);
    return () => window.removeEventListener('ashtapor-combat-snapshot', handleSnapshot);
  }, []);

  // Initialize OBR Lifecycle, boot sanitizer, and read initial pin preference
  useEffect(() => {
    runBootSanitizerOnce();
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
        isGmRef.current = isGmRole;
        setPlayerName(name);
        liveFeedSync.setIdentity(name, isGmRole, playerId);

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
        isGmRef.current = true;
        setPlayerName('GM (Standalone)');
        liveFeedSync.setIdentity('GM (Standalone)', true);
        setIsReady(true);
      }
    }, 1500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  // Static root broadcast listener for turn sync, table alerts, and cold-start handshake
  useEffect(() => {
    if (!isReady || !OBR.isReady) return;
    const obrAny = OBR as any;
    if (!obrAny.broadcast) return;

    // 1. Sub-30ms Raw WebSocket Turn Sync Listener
    const unsubTurnSync = obrAny.broadcast.onMessage('ashtapor/turn_sync', (event: any) => {
      const data = event.data as any;
      if (data && typeof data.round === 'number' && typeof data.activeIndex === 'number') {
        window.dispatchEvent(new CustomEvent('ashtapor-turn-sync', { detail: data }));
      }
    });

    // 2. Table Alert Listener ("Call for Initiative")
    const unsubTableAlert = obrAny.broadcast.onMessage('ashtapor/table_alert', (event: any) => {
      const data = event.data as any;
      if (data && data.type === 'ROLL_FOR_INITIATIVE') {
        if (!isGmRef.current) {
          setTableAlert('⚔️ DM called for Initiative! Open Roster to join.');
        }
        window.dispatchEvent(new CustomEvent('ashtapor-table-alert', { detail: data }));
      }
    });

    // 3. Combat Ended Listener (immediately clears locks and table alerts)
    const unsubCombatEnded = obrAny.broadcast.onMessage('ashtapor/combat_ended', (event: any) => {
      setTableAlert(null);
      window.dispatchEvent(new CustomEvent('ashtapor-combat-ended', { detail: event.data }));
    });

    // 4. Cold-Start Sync Handshake
    // GM client catches sync requests from newly mounted players and replies immediately in <50ms
    const unsubSyncReq = obrAny.broadcast.onMessage('ashtapor/sync_request', async (event: any) => {
      if (!isGmRef.current) return;
      const data = event.data as any;
      try {
        let snapshot = liveCombatSnapshotRef.current;
        // If snapshot is empty, fallback to reading room metadata
        if (!snapshot.combatants || snapshot.combatants.length === 0) {
          const roomMeta = await OBR.room.getMetadata();
          const rawRoster = roomMeta['ashtapor/roster'] as any;
          const combatantsList = Array.isArray(rawRoster)
            ? rawRoster
            : Array.isArray(rawRoster?.combatants)
            ? rawRoster.combatants
            : [];
          const rawTurn = roomMeta['ashtapor/turn'] as any;
          snapshot = {
            combatants: combatantsList,
            round: rawTurn?.currentRound ?? rawTurn?.round ?? 0,
            activeIndex: rawTurn?.currentTurnIndex ?? rawTurn?.activeIndex ?? 0,
            activeCombatantId: rawTurn?.activeCombatantId ?? null,
          };
        }

        obrAny.broadcast.sendMessage('ashtapor/sync_response', {
          targetId: data?.senderId,
          combatants: snapshot.combatants,
          round: snapshot.round,
          activeIndex: snapshot.activeIndex,
          activeCombatantId: snapshot.activeCombatantId,
        });
      } catch (err) {
        console.warn('Error replying to sync_request:', err);
      }
    });

    // Player client catches sync response from GM and hydrates state in <50ms
    const unsubSyncResp = obrAny.broadcast.onMessage('ashtapor/sync_response', (event: any) => {
      if (isGmRef.current) return;
      const data = event.data as any;
      if (data) {
        window.dispatchEvent(new CustomEvent('ashtapor-sync-response', { detail: data }));
      }
    });

    // Send cold-start request if player
    if (!isGmRef.current) {
      OBR.player.getId().then((myId) => {
        obrAny.broadcast.sendMessage('ashtapor/sync_request', { senderId: myId });
      }).catch(() => {
        obrAny.broadcast.sendMessage('ashtapor/sync_request', { senderId: 'player' });
      });
    }

    return () => {
      if (typeof unsubTurnSync === 'function') unsubTurnSync();
      if (typeof unsubTableAlert === 'function') unsubTableAlert();
      if (typeof unsubCombatEnded === 'function') unsubCombatEnded();
      if (typeof unsubSyncReq === 'function') unsubSyncReq();
      if (typeof unsubSyncResp === 'function') unsubSyncResp();
    };
  }, [isReady]);

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
    if (!isReady || typeof OBR === 'undefined' || !OBR.isReady) return;
    const unsub = OBR.room.onMetadataChange((meta) => {
      const live = meta[OBR_BROADCAST_NOTE_KEY] as BroadcastNotePayload | undefined;
      setBroadcastNote(live || null);
      if (!live) {
        setDismissedBroadcastId(null);
      }
    });
    return () => {
      if (unsub) unsub();
    };
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

  // Quick Help Guide Toggle Handler
  const handleToggleHelp = () => {
    const next = !isHelpOpen;
    setIsHelpOpen(next);
    if (!hasSeenHelp) {
      setHasSeenHelp(true);
      try {
        localStorage.setItem('ashtapor_help_seen', 'true');
      } catch {}
    }
  };

  // Stop broadcasting note (GM Action) - 1-Click Broadcast Teardown
  const handleStopRevealing = async () => {
    try {
      if (OBR.isReady) {
        await OBR.room.setMetadata({
          [OBR_BROADCAST_NOTE_KEY]: undefined,
        });
      }
      try {
        localStorage.removeItem('ashtapor_broadcast_note');
      } catch {}
      window.dispatchEvent(new CustomEvent('ashtapor-broadcast-note', { detail: null }));

      setBroadcastNote(null);
      setDismissedBroadcastId(null);
    } catch (err) {
      console.error('Error stopping broadcast:', err);
      setBroadcastNote(null);
      setDismissedBroadcastId(null);
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

          {/* Right: Relocated Utility Controls (Help Guide, GM badge, Audio Toggle, Pin Button) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Guide Trigger Button [ ? ] immediately adjacent to GM/PC badge */}
            <button
              type="button"
              data-help-trigger="true"
              onClick={handleToggleHelp}
              className="relative w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 flex items-center justify-center font-bold text-xs transition-colors shrink-0 cursor-pointer"
              title="Quick Guide (Help)"
              aria-label="Quick Guide (Help)"
            >
              ?
              {!hasSeenHelp && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

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
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-neutral-500" />
              )}
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

      {/* 1.5 TABLE ALERT BANNER (e.g. DM Called for Initiative) */}
      {tableAlert && !isGM && (
        <div className="bg-amber-500/20 border-b border-amber-500/50 px-2.5 py-1.5 flex items-center justify-between text-xs text-amber-200 animate-pulse z-30 shrink-0">
          <div className="flex items-center gap-1.5 font-bold truncate">
            <span>⚔️</span>
            <span className="truncate">{tableAlert}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('combat');
                setTableAlert(null);
                window.dispatchEvent(new CustomEvent('ashtapor-open-roster'));
              }}
              className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 font-bold text-[11px] hover:bg-amber-300 transition cursor-pointer"
            >
              Open Roster
            </button>
            <button
              type="button"
              onClick={() => setTableAlert(null)}
              className="p-0.5 text-amber-400/80 hover:text-amber-200 transition cursor-pointer"
              title="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Contextual Help Guide Tooltip */}
      <ContextualHelpTooltip
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* 2. MAIN CONTENT AREA: Keep-Alive Persistent DOM Mounting (Preserves scroll, inputs & states across tab switches) */}
      <main className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col">
     <div className={activeTab === 'combat' ? 'flex flex-col h-full' : 'hidden'}>
          <WhiteboardTracker isGM={isGM} />
        </div>
        <div className={activeTab === 'dice' ? 'flex flex-col h-full' : 'hidden'}>
          <DiceChamber isDm={isGM} playerName={playerName} />
        </div>
        <div className={activeTab === 'range' || (activeTab as string) === 'geometry' ? 'flex flex-col h-full' : 'hidden'}>
          <RangeTab />
        </div>
        <div className={activeTab === 'grimoire' ? 'flex flex-col h-full' : 'hidden'}>
          <Grimoire isDm={isGM} />
        </div>
        <div className={activeTab === 'notes' ? 'flex flex-col h-full' : 'hidden'}>
          <NotesTab isDm={isGM} playerName={playerName} />
        </div>
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

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const text = `${broadcastNote.title}\n\n${broadcastNote.content}`;
                    const ok = await copyToClipboard(text);
                    if (ok) {
                      setBroadcastCopied(true);
                      setTimeout(() => setBroadcastCopied(false), 1500);
                    }
                  }}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    broadcastCopied
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700 hover:border-amber-400/50'
                  }`}
                  title="Copy message to clipboard"
                >
                  {broadcastCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy Message</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={isGM ? handleStopRevealing : () => setDismissedBroadcastId(broadcastNote.id)}
                  className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-800 transition cursor-pointer"
                  title={isGM ? "Stop Revealing & Close" : "Dismiss"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Note Text Content */}
            <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800 text-xs text-neutral-200 font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto select-text cursor-text selection:bg-amber-500/30 selection:text-amber-200">
              {broadcastNote.content}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
              <span className="text-[10px] text-neutral-500 font-mono">
                Revealed by Game Master
              </span>

              <div className="flex items-center gap-2">
                {isGM ? (
                  <button
                    type="button"
                    onClick={handleStopRevealing}
                    className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Stop Revealing & Close
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDismissedBroadcastId(broadcastNote.id)}
                    className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow transition cursor-pointer"
                  >
                    Dismiss / Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
