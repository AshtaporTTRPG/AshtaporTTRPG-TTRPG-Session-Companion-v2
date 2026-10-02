/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { Header, ActiveTab } from './components/Header';
import { CombatTracker } from './components/CombatTracker';
import { DiceChamber } from './components/DiceChamber';
import { GeometryCalculator } from './components/GeometryCalculator';
import { Grimoire } from './components/Grimoire';
import { liveFeedSync } from './utils/liveFeedSync';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('combat');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isGM, setIsGM] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Adventurer');

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
    }, 1500);

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
      <div className="w-full max-w-[480px] h-[720px] max-h-[720px] mx-auto bg-[#0b0f17] text-slate-200 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden border border-slate-800 shadow-2xl">
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
    <div className="w-[480px] h-[720px] max-h-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden select-none">
      {/* Static Navigation Header (Row 1): Fixed h-11 shrink-0 z-40 border-b border-neutral-800 bg-neutral-900/95 px-2 flex items-center justify-between */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDm={isGM}
        playerName={playerName}
      />

      {/* Tab Content Container (Row 2): flex-1 min-h-0 overflow-y-auto relative p-2 */}
      <main className="flex-1 min-h-0 overflow-y-auto relative p-2 flex flex-col">
        {activeTab === 'combat' && (
          <CombatTracker isDm={isGM} playerName={playerName} />
        )}
        {activeTab === 'dice' && (
          <DiceChamber isDm={isGM} playerName={playerName} />
        )}
        {activeTab === 'geometry' && (
          <GeometryCalculator />
        )}
        {activeTab === 'grimoire' && (
          <Grimoire isDm={isGM} />
        )}
      </main>
    </div>
  );
}
