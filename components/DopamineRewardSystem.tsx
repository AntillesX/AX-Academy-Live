'use client';
import { useState } from 'react';
import StreakShield from './StreakShield';
import LootChestModal from './LootChestModal';
export default function DopamineRewardSystem() { const [lootOpen, setLootOpen] = useState(false); return <div className="grid gap-4 md:grid-cols-2"><StreakShield /><section className="rounded-[2rem] bg-[#d8ff45] p-5"><p className="text-[10px] font-black uppercase tracking-[.28em]">Reward loop</p><h2 className="mt-2 text-3xl font-black tracking-[-.07em]">Play, learn, unlock.</h2><p className="mt-4 max-w-sm text-sm text-black/60">Complete a game, protect your streak, and open a surprise avatar reward when the signal meter is full.</p><button onClick={() => setLootOpen(true)} className="mt-8 rounded-full bg-black px-5 py-3 text-sm font-bold text-white">Open mystery chest</button></section><LootChestModal open={lootOpen} onClose={() => setLootOpen(false)} /></div>; }
