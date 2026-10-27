/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { Crown, Shield, Volume2, VolumeX, EyeOff, Radio, X, Copy, Check } from 'lucide-react';
import { isAudioEnabled, toggleAudio } from './utils/audio';
import { copyToClipboard } from './utils/clipboard';
import { runBootSanitizerOnce } from './utils/notesSanitizer';
import { WhiteboardTracker } from './components/combat/WhiteboardTracker';
import { DiceChamber } from './components/dice/DiceChamber';
import { RangeTab } from './components/range/RangeTab';
import { Grimoire } from './components/Grimoire';
import { NotesTab, BroadcastNotePayload, OBR_BROADCAST_NOTE_KEY } from './components/notes/NotesTab';
import { NOTE_THEME_CONFIG } from './types/notes';
import { renderMarkdown } from './utils/markdownRenderer';
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

  // Table Broadcast Note State
  const [broadcastNote, setBroadcastNote] = useState<BroadcastNotePayload | null>(null);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(null);
  const [broadcastCopied, setBroadcastCopied] = useState<boolean>(false);

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
        setPlayerName(name);
        liveFeedSync.setIdentity(name, isGmRole, playerId);

        if (isGmRole) {
          try {
            // Room Metadata Audit (ReadOnly)
            const meta = await OBR.room.getMetadata();
            console.log('RAW ROOM METADATA:', meta);
            console.log('=== ROOM METADATA AUDIT ===');
            let totalBytes = 0;
            for (const [key, value] of Object.entries(meta)) {
              if (value !== undefined && value !== null) {
                const keyBytes = JSON.stringify(value).length;
                totalBytes += keyBytes;
                console.log(`Key: "${key}" | Size: ${keyBytes} bytes`);
              }
            }
            console.log(`TOTAL ROOM USAGE: ${totalBytes} / 16384 bytes`);
            console.log('===========================');
          } catch (auditErr) {
            console.error('Metadata audit failed:', auditErr);
          }
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

  useEffect(() => {
    if (!isReady || !OBR.isReady) return;
    const unsub = OBR.player.onChange((player) => {
      const isGmRole = player.role ? player.role === 'GM' : isGM;
      if (player.role) setIsGM(isGmRole);
      if (player.name) setPlayerName(player.name);
      liveFeedSync.setIdentity(player.name || playerName, isGmRole, player.id);
    });
    return () => unsub();
  }, [isReady, isGM, playerName]);

  useEffect(() => {
    if (!isReady || typeof OBR === 'undefined' || !OBR.isReady) return;
    const unsub = OBR.room.onMetadataChange((meta) => {
      const live = meta[OBR_BROADCAST_NOTE_KEY] as BroadcastNotePayload | undefined;
      setBroadcastNote(live || null);
      if (!live) setDismissedBroadcastId(null);
    });
    return () => unsub();
  }, [isReady]);

  const handleToggleSound = () => {
    const next = toggleAudio();
    setSoundOn(next);
  };

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

  const handleStopRevealing = async () => {
    try {
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        await OBR.room.setMetadata({ [OBR_BROADCAST_NOTE_KEY]: {} });
      }
      setBroadcastNote(null);
      setDismissedBroadcastId(null);
    } catch (err) {
      console.error('Error stopping broadcast:', err);
      setBroadcastNote(null);
      setDismissedBroadcastId(null);
    }
  };

  const shouldShowBroadcastModal = broadcastNote && dismissedBroadcastId !== broadcastNote.id;

  if (!isReady) {
    return (
      <div className="w-full max-w-[480px] h-[820px] max-h-[820px] mx-auto bg-[#0b0f17] text-slate-200 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden border border-slate-800 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5 mb-5">
          <div className="w-7 h-7 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
        </div>
        <h2 className="text-base font-bold font-display tracking-wide text-amber-300 mb-1.5">
          Connecting to Tabletop...
        </h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Loading Ashtapor Companion for Owlbear Rodeo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[820px] w-full max-w-[480px] bg-neutral-950 text-neutral-100 overflow-hidden select-none mx-auto border border-neutral-800 shadow-2xl relative">
      <header className="shrink-0 z-40 bg-neutral-900/95 border-b border-neutral-800">
        <div className="h-6 px-2.5 bg-neutral-950/90 border-b border-neutral-800/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs leading-none">⚔️</span>
            <span className="font-bold text-[11px] font-display text-neutral-200 tracking-wide">
              Ashtapor
            </span>
            <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[120px]">
              · {playerName}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleHelp}
              className="relative w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 flex items-center justify-center font-bold text-xs transition-colors shrink-0 cursor-pointer"
              title="Quick Guide (Help)"
            >
              ?
              {!hasSeenHelp && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                isGM
                  ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
                  : 'bg-cyan-950/80 border-cyan-600/70 text-cyan-300'
              }`}
            >
              {isGM ? (
                <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              ) : (
                <Shield className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              )}
              <span>{isGM ? 'GM' : 'PC'}</span>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              title={soundOn ? 'Mute Audio' : 'Unmute Audio'}
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

        <nav className="w-full grid grid-cols-5 gap-1 p-1 bg-neutral-900 select-none overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab('combat')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition cursor-pointer truncate ${
              activeTab === 'combat'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <span className="text-xs leading-none">⚔️</span>
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
          >
            <span className="text-xs leading-none">🎲</span>
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
          >
            <span className="text-xs leading-none">📐</span>
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
          >
            <span className="text-xs leading-none">📖</span>
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
          >
            <span className="text-xs leading-none">📝</span>
            <span className="truncate">Notes</span>
          </button>
        </nav>
      </header>

      <ContextualHelpTooltip
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <main className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col">
        <div className={activeTab === 'combat' ? 'flex flex-col h-full' : 'hidden'}>
          <WhiteboardTracker isGM={isGM} />
        </div>
        <div className={activeTab === 'dice' ? 'flex flex-col h-full' : 'hidden'}>
          <DiceChamber isGM={isGM} playerName={playerName} />
        </div>
        <div className={activeTab === 'range' || (activeTab as string) === 'geometry' ? 'flex flex-col h-full' : 'hidden'}>
          <RangeTab />
        </div>
        <div className={activeTab === 'grimoire' ? 'flex flex-col h-full' : 'hidden'}>
          <Grimoire isGM={isGM} />
        </div>
        <div className={activeTab === 'notes' ? 'flex flex-col h-full' : 'hidden'}>
          <NotesTab isGM={isGM} playerName={playerName} />
        </div>
      </main>

      {shouldShowBroadcastModal && (() => {
        const themeCfg = broadcastNote.theme
          ? NOTE_THEME_CONFIG[broadcastNote.theme] || NOTE_THEME_CONFIG.slate
          : NOTE_THEME_CONFIG.slate;

        return (
          <div className="absolute inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
            <div className={`w-full max-w-sm rounded-2xl p-4 shadow-2xl space-y-3 border-2 ring-1 ring-amber-400/40 ${themeCfg.cardClasses}`}>
              <div className="flex items-center justify-between pb-2 border-b border-inherit/30">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                      Table Broadcast
                    </span>
                    <h3 className="text-xs font-bold truncate">
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
                        : 'bg-black/30 hover:bg-black/50 text-inherit border-white/20 hover:border-amber-400/50'
                    }`}
                  >
                    {broadcastCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={isGM ? handleStopRevealing : () => setDismissedBroadcastId(broadcastNote.id)}
                    className="opacity-70 hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`p-3 rounded-xl border text-xs leading-relaxed max-h-56 overflow-y-auto select-text cursor-text selection:bg-amber-500/30 selection:text-amber-200 ${themeCfg.contentClasses}`}>
                {renderMarkdown(broadcastNote.content)}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-inherit/30">
                <span className="text-[10px] opacity-60 font-mono">
                  Revealed by Game Master (GM)
                </span>

                <div className="flex items-center gap-2">
                  {isGM ? (
                    <button
                      type="button"
                      onClick={handleStopRevealing}
                      className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Stop Revealing
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDismissedBroadcastId(broadcastNote.id)}
                      className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
