/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { Header } from './components/Header';
import { CombatTracker } from './components/CombatTracker';
import { DiceChamber } from './components/DiceChamber';
import { GeometryCalculator } from './components/GeometryCalculator';
import { InteractiveMap } from './components/InteractiveMap';
import { NotesAndReference } from './components/NotesAndReference';
import { RecommendationsModal } from './components/RecommendationsModal';
import { liveFeedSync } from './utils/liveFeedSync';

export default function App() {
  const [activeTab, setActiveTab] = useState<'combat' | 'dice' | 'geometry' | 'map' | 'notes'>('combat');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isGM, setIsGM] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Adventurer');
  const [isRoadmapOpen, setIsRoadmapOpen] = useState<boolean>(false);

  // Initialize OBR Lifecycle
  useEffect(() => {
    OBR.onReady(async () => {
      try {
        const role = await OBR.player.getRole();
        const isGmRole = role === 'GM';
        const name = (await OBR.player.getName()) || (isGmRole ? 'Game Master' : 'Player');

        setIsGM(isGmRole);
        setPlayerName(name);
        liveFeedSync.setIdentity(name, isGmRole);
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
    }, 2000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  // Listen for native OBR player identity and role updates
  useEffect(() => {
    if (!isReady || !OBR.isReady) return;
    const unsub = OBR.player.onChange((player) => {
      if (player.role) {
        const isGmRole = player.role === 'GM';
        setIsGM(isGmRole);
        liveFeedSync.setIdentity(player.name || playerName, isGmRole);
      }
      if (player.name) {
        setPlayerName(player.name);
        liveFeedSync.setIdentity(player.name, isGM);
      }
    });
    return () => unsub();
  }, [isReady, isGM, playerName]);

  // Fallback loader if OBR is not yet ready
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-200 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-bold font-display tracking-wide text-amber-300 mb-2">
          Waiting for Owlbear Rodeo...
        </h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Connecting to your Owlbear Rodeo session tabletop. Please run this inside an Owlbear Rodeo room.
        </p>

        {/* Standalone preview fallback for AI Studio / dev browser testing */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsGM(true);
              setPlayerName('GM (Preview)');
              liveFeedSync.setIdentity('GM (Preview)', true);
              setIsReady(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition cursor-pointer"
          >
            Preview as GM
          </button>
          <button
            onClick={() => {
              setIsGM(false);
              setPlayerName('Player (Preview)');
              liveFeedSync.setIdentity('Player (Preview)', false);
              setIsReady(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition cursor-pointer"
          >
            Preview as Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-200 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDm={isGM}
        playerName={playerName}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Tab Views */}
        {activeTab === 'combat' && <CombatTracker isDm={isGM} playerName={playerName} />}
        {activeTab === 'dice' && <DiceChamber isDm={isGM} playerName={playerName} />}
        {activeTab === 'geometry' && <GeometryCalculator />}
        {activeTab === 'map' && <InteractiveMap isDm={isGM} playerName={playerName} />}
        {activeTab === 'notes' && <NotesAndReference />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/70 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-slate-400">Ashtapor Companion</span>
            <span>·</span>
            <span className="text-amber-400/90 font-medium">Owlbear Rodeo Extension v2.0</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Tabletop Synchronized ({isGM ? 'GM' : 'Player'})</span>
            </div>
            <span>·</span>
            <button
              onClick={() => setIsRoadmapOpen(true)}
              className="hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Architecture Guide</span>
            </button>
          </div>
        </div>
      </footer>

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
