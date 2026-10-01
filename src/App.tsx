/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CombatTracker } from './components/CombatTracker';
import { DiceChamber } from './components/DiceChamber';
import { GeometryCalculator } from './components/GeometryCalculator';
import { InteractiveMap } from './components/InteractiveMap';
import { NotesAndReference } from './components/NotesAndReference';
import { RecommendationsModal } from './components/RecommendationsModal';
import { RoomModal } from './components/RoomModal';
import { roomSync } from './utils/roomSync';

export default function App() {
  const [activeTab, setActiveTab] = useState<'combat' | 'dice' | 'geometry' | 'map' | 'notes'>('combat');

  // Check stored state on page load/mount:
  // If the user was in Player Mode, initialize the application directly in Player Mode (do not default to DM Mode)
  const [isDm, setIsDm] = useState<boolean>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('room')) return false; // Joining via shareable link defaults to Player Mode
      const savedRole = localStorage.getItem('ttrpg_user_role') || sessionStorage.getItem('ttrpg_user_role');
      if (savedRole === 'player') return false;
      if (savedRole === 'dm') return true;
      const savedDm = localStorage.getItem('ttrpg_user_is_dm');
      if (savedDm !== null) return savedDm === 'true';
    } catch {}
    return true; // Default to DM only if no prior stored state
  });

  const [isRoadmapOpen, setIsRoadmapOpen] = useState<boolean>(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>(() => roomSync.getRoomCode());
  const [displayName, setDisplayName] = useState<string>(() => roomSync.getPeerName());
  const [connectionStatus, setConnectionStatus] = useState<string>(() => roomSync.getConnectionStatus().status);

  useEffect(() => {
    const unsub = roomSync.subscribePresence((state) => {
      setConnectionStatus(state.status);
      setDisplayName(roomSync.getPeerName());
    });
    return () => unsub();
  }, []);

  // Handle joining via URL parameters (e.g. ?room=DRAGON-77)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryRoom = urlParams.get('room');
      if (queryRoom) {
        const clean = queryRoom.trim().toUpperCase();
        setRoomCode(clean);
        setIsDm(false); // Joining via shareable link defaults to Player Mode
        roomSync.configure(clean, roomSync.getPeerName(), false);
        setIsRoomModalOpen(true); // Open modal with prefilled code for 1-click Join
      }
    } catch {}
  }, []);

  // Keep roomSync updated when role or room code changes
  useEffect(() => {
    roomSync.configure(roomCode, displayName, isDm);
  }, [isDm, roomCode, displayName]);

  // Handle safe switch to DM mode with single-DM role enforcement
  const handleSwitchToDm = () => {
    const check = roomSync.canClaimDm();
    if (!check.allowed) {
      alert(
        `Cannot switch to DM Mode: ${check.existingDmName || 'Another DM'} is already hosting as the Dungeon Master in room ${roomCode}. Only one DM is permitted per room.`
      );
      return;
    }
    setIsDm(true);
    roomSync.configure(roomCode, displayName, true);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-200 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDm={isDm}
        setIsDm={(newDmState) => {
          if (newDmState) {
            handleSwitchToDm();
          } else {
            setIsDm(false);
            roomSync.configure(roomCode, displayName, false);
          }
        }}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
        roomCode={roomCode}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Quick Mode Status Banner if in Player Mode */}
        {!isDm && (
          <div className="mb-4 px-3.5 sm:px-4 py-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <span>
              <strong>Player Companion View:</strong> Monster exact HP &amp; secret DM notes on pins are currently hidden.
            </span>
            <button
              onClick={handleSwitchToDm}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline underline-offset-2 shrink-0"
            >
              Switch to DM Mode
            </button>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'combat' && <CombatTracker isDm={isDm} />}
        {activeTab === 'dice' && <DiceChamber isDm={isDm} playerName={displayName} />}
        {activeTab === 'geometry' && <GeometryCalculator />}
        {activeTab === 'map' && <InteractiveMap isDm={isDm} />}
        {activeTab === 'notes' && <NotesAndReference />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/70 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-slate-400">Grimoire &amp; Grid</span>
            <span>·</span>
            <span>Tabletop Session Companion</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <button
              onClick={() => setIsRoomModalOpen(true)}
              className="text-slate-400 hover:text-amber-300 font-mono transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'hosting' || connectionStatus === 'connected'
                    ? 'bg-emerald-400'
                    : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                    ? 'bg-amber-400 animate-pulse'
                    : connectionStatus === 'disconnected' || connectionStatus === 'error'
                    ? 'bg-rose-400'
                    : 'bg-slate-500'
                }`}
              />
              <span>
                Room {roomCode} ({
                  connectionStatus === 'hosting'
                    ? 'Hosting Live'
                    : connectionStatus === 'connected'
                    ? 'Connected'
                    : connectionStatus === 'reconnecting'
                    ? 'Reconnecting to Host...'
                    : connectionStatus === 'connecting'
                    ? 'Connecting'
                    : connectionStatus === 'disconnected'
                    ? 'Disconnected'
                    : connectionStatus === 'error'
                    ? 'Error'
                    : 'Offline'
                })
              </span>
            </button>
            <span>·</span>
            <button
              onClick={() => setIsRoadmapOpen(true)}
              className="hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Improvement Architecture &amp; Next Steps</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Room Hosting & Joining Modal */}
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        isDm={isDm}
        currentRoomCode={roomCode}
        onUpdateRoom={(newCode, newName) => {
          setRoomCode(newCode);
          if (newName) setDisplayName(newName);
        }}
      />

      {/* Recommendations & Improvement Roadmap Modal */}
      <RecommendationsModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsRoadmapOpen(false);
        }}
      />
    </div>
  );
}
