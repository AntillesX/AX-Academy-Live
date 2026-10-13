'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Text } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Level = { name: string; sky: string; ground: string; accent: string; description: string };
type Hazard = { id: number; lane: number; z: number; type: string; icon: string };
const LEVELS: Level[] = [
  { name: 'Sunset Coastline', sky: '#18234a', ground: '#51384a', accent: '#fb7185', description: 'Pastel homes · ocean horizon · palm-lined coast' },
  { name: 'Mountain Countryside', sky: '#102d38', ground: '#183d32', accent: '#86efac', description: 'Lush valley · rural cottages · mountain fog' },
  { name: 'Central Market Port', sky: '#111827', ground: '#172554', accent: '#fbbf24', description: 'Vendor stalls · harbor backdrop · neon docks' },
];
const HAZARDS = [
  { type: 'Chicken', icon: '🐔' }, { type: 'Dog', icon: '🐕' }, { type: 'Cat', icon: '🐈' },
  { type: 'Goat', icon: '🐐' }, { type: 'Resident', icon: '🙋' }, { type: 'Pedestrian', icon: '🚶' },
];
const LANES = [-3, 0, 3];

function LevelScenery({ level }: { level: Level }) {
  const palms = useMemo(() => [-6.3, 6.3, -7.1, 7.1], []);
  return <group>
    <mesh position={[0, 3.4, -24]}><planeGeometry args={[50, 16]} /><meshBasicMaterial color={level.sky} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, -12]}><planeGeometry args={[50, 70]} /><meshBasicMaterial color={level.ground} /></mesh>
    {level.name === 'Sunset Coastline' && <>
      <mesh position={[0, 0.7, -29]}><planeGeometry args={[32, 7]} /><meshBasicMaterial color="#0e7490" /></mesh>
      {[-5, -2, 2, 5].map((x, i) => <group key={x} position={[x, 0, -12 - i * 3]}><mesh><boxGeometry args={[2, 1.5, 1.2]} /><meshBasicMaterial color={['#fda4af', '#fde68a', '#93c5fd', '#c4b5fd'][i]} /></mesh><mesh position={[0, 1, 0]} rotation={[0, 0, Math.PI / 4]}><coneGeometry args={[1.5, .75, 4]} /><meshBasicMaterial color="#7c2d12" /></mesh></group>)}
      {palms.map((x, i) => <group key={x} position={[x, 0, -10 - i * 7]}><mesh position={[0, 1, 0]}><cylinderGeometry args={[.12, .2, 2.2, 8]} /><meshBasicMaterial color="#92400e" /></mesh><mesh position={[0, 2.2, 0]}><sphereGeometry args={[.85, 8, 4]} /><meshBasicMaterial color="#34d399" /></mesh></group>)}
    </>}
    {level.name === 'Mountain Countryside' && <>
      {[-10, -6, 6, 10].map((x, i) => <mesh key={x} position={[x, 3 + (i % 2), -25]} rotation={[0, 0, i % 2 ? .12 : -.12]}><coneGeometry args={[5, 8, 5]} /><meshBasicMaterial color={i % 2 ? '#166534' : '#14532d'} /></mesh>)}
      {[-5, 5].map(x => <group key={x} position={[x, 0, -13]}><mesh><boxGeometry args={[2.2, 1.4, 1.5]} /><meshBasicMaterial color="#d6d3d1" /></mesh><mesh position={[0, 1, 0]} rotation={[0, 0, Math.PI / 4]}><coneGeometry args={[1.7, .8, 4]} /><meshBasicMaterial color="#b45309" /></mesh></group>)}
      <mesh position={[0, 2.5, -20]}><planeGeometry args={[24, 5]} /><meshBasicMaterial color="#d1fae5" transparent opacity={.12} /></mesh>
    </>}
    {level.name === 'Central Market Port' && <>
      <mesh position={[0, .1, -28]}><planeGeometry args={[30, 9]} /><meshBasicMaterial color="#075985" /></mesh>
      {[-6, 6].map(x => <mesh key={x} position={[x, .7, -13]}><boxGeometry args={[2.4, 1.5, 1.5]} /><meshBasicMaterial color={x < 0 ? '#f59e0b' : '#ec4899'} /></mesh>)}
      {[-4.5, -1.5, 1.5, 4.5].map(x => <group key={x} position={[x, 1.4, -20]}><mesh><cylinderGeometry args={[.05, .05, 3, 6]} /><meshBasicMaterial color="#fbbf24" /></mesh><mesh position={[0, -.5, 0]}><boxGeometry args={[2, 1, 1]} /><meshBasicMaterial color="#7c3aed" /></mesh></group>)}
    </>}
  </group>;
}

function Track({ speed, level }: { speed: number; level: Level }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (group.current) group.current.position.z = (group.current.position.z + delta * speed * 5) % 8; });
  return <group ref={group}>{[...Array(14)].map((_, i) => <group key={i} position={[0, 0, -i * 8]}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}><planeGeometry args={[13, 7]} /><meshBasicMaterial color={level.ground} wireframe /></mesh>{LANES.map(x => <mesh key={x} position={[x, -1.18, 0]}><boxGeometry args={[0.08, 0.05, 7]} /><meshBasicMaterial color={level.accent} /></mesh>)}<mesh position={[-6, 0, 0]}><boxGeometry args={[0.12, 2.5, 7]} /><meshBasicMaterial color={level.accent} /></mesh><mesh position={[6, 0, 0]}><boxGeometry args={[0.12, 2.5, 7]} /><meshBasicMaterial color={level.accent} /></mesh></group>)}</group>;
}
function Vehicle({ lane, speed, damaged }: { lane: number; speed: number; damaged: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) { ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, lane, delta * 7); ref.current.position.y = -0.7 + Math.sin(Date.now() * 0.004) * 0.04; } });
  return <group ref={ref} position={[lane, -0.7, 1]}><mesh><boxGeometry args={[1.35, .35, 2.5]} /><meshStandardMaterial color={damaged ? '#f87171' : '#22d3ee'} emissive={damaged ? '#991b1b' : '#0e7490'} emissiveIntensity={2 + speed / 10} /></mesh><mesh position={[0, .3, -.25]}><boxGeometry args={[.8, .22, 1]} /><meshStandardMaterial color="#e0f2fe" emissive="#67e8f9" emissiveIntensity={1} transparent opacity={damaged ? .45 : 1} /></mesh>{damaged && <Text position={[0, .65, 0]} fontSize={.28} color="#fca5a5" anchorX="center">CRACKED</Text>}<pointLight color={damaged ? '#ef4444' : '#22d3ee'} intensity={4} distance={5} /></group>;
}
function HazardEntity({ hazard }: { hazard: Hazard }) { return <group position={[hazard.lane, -.55, hazard.z]}><Text fontSize={.65} anchorX="center" anchorY="middle" outlineWidth={.03} outlineColor="#020617">{hazard.icon}</Text><mesh position={[0, -.45, 0]}><boxGeometry args={[1.1, .03, .6]} /><meshBasicMaterial color="#facc15" /></mesh></group>; }

export default function AntxVelocity4D() {
  const [lane, setLane] = useState(0); const [speed, setSpeed] = useState(5); const [score, setScore] = useState(0); const [levelIndex, setLevelIndex] = useState(0); const [distance, setDistance] = useState(0); const [hits, setHits] = useState(0); const [hazards, setHazards] = useState<Hazard[]>([]); const [warning, setWarning] = useState(false); const [wrecked, setWrecked] = useState(false); const [message, setMessage] = useState('Stay alert. Shift lanes when the warning banner appears.');
  const level = LEVELS[levelIndex];
  useEffect(() => { if (wrecked) return; const timer = window.setInterval(() => { const deltaKm = speed * 0.0018; setDistance(value => { const next = value + deltaKm; if (next >= 1) { setLevelIndex(index => (index + 1) % LEVELS.length); setMessage(`Level complete. Entering ${LEVELS[(levelIndex + 1) % LEVELS.length].name}.`); return 0; } return next; }); setHazards(current => { let next = current.map(item => ({ ...item, z: item.z + speed * .12 })).filter(item => item.z < 6); if (Math.random() < .12 && next.length < 2) { const animal = HAZARDS[Math.floor(Math.random() * HAZARDS.length)]; next = [...next, { ...animal, id: Date.now(), lane: LANES[Math.floor(Math.random() * LANES.length)], z: -25 }]; setWarning(true); window.setTimeout(() => setWarning(false), 1400); } const collision = next.find(item => item.z > -.3 && item.z < 1.8 && item.lane === lane); if (collision) { next = next.filter(item => item.id !== collision.id); setHits(previous => { const total = previous + 1; setScore(value => Math.max(0, value - 50)); if (total >= 2) { setWrecked(true); setMessage('CAR WRECKED · Level failed. Resetting level…'); window.setTimeout(() => { setWrecked(false); setHits(0); setDistance(0); setScore(0); setHazards([]); setMessage('Level reset. Keep your eyes on the road.'); }, 2200); } else setMessage(`Impact detected. Focus points deducted. ${2 - total} hit remaining.`); return total; }); } return next; }); }, 250); return () => window.clearInterval(timer); }, [lane, levelIndex, speed, wrecked]);
  const move = (direction: number) => { setLane(value => { const next = THREE.MathUtils.clamp(value + direction, -3, 3); setScore(scoreValue => scoreValue + 25); return next; }); };
  const progress = Math.min(100, distance * 100); const hitLabel = hits === 0 ? 'Vehicle integrity 100%' : hits === 1 ? 'Vehicle integrity 50% · cracked glass' : 'Vehicle wrecked';
  return <div className="relative overflow-hidden rounded-3xl border border-cyan-300/25 bg-[#020617] shadow-2xl shadow-cyan-950/40"><div className="absolute left-4 right-4 top-4 z-10 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black"><span className="rounded-full border border-cyan-300/30 bg-slate-950/85 px-3 py-2 text-cyan-200">NEON//DRIFT 4D · LEVEL {levelIndex + 1}: {level.name}</span><span className="rounded-full border border-violet-300/30 bg-slate-950/85 px-3 py-2 text-violet-200">Focus score {score}</span><span className="rounded-full border border-amber-300/30 bg-slate-950/85 px-3 py-2 text-amber-200">Speed {speed * 10} km/h</span></div><div className="rounded-full border border-white/10 bg-slate-950/80 p-2"><div className="flex items-center justify-between text-[10px] font-black text-slate-300"><span>LAP 1/1 · DISTANCE {distance.toFixed(1)}km / 1.0km</span><span>{hitLabel}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} /></div></div>{warning && <div className="animate-pulse rounded-xl border border-amber-300/60 bg-amber-400/20 px-4 py-2 text-center text-xs font-black tracking-wide text-amber-100">OBSTACLES AHEAD: SLOW DOWN / SHIFT LANES!</div>}</div><div className="h-[420px] sm:h-[520px]"><Canvas camera={{ position: [0, 2.5, 7], fov: 58 }} dpr={[1, 1.5]}><color attach="background" args={[level.sky]} /><fog attach="fog" args={[level.sky, 8, 42]} /><ambientLight intensity={.5} /><directionalLight position={[3, 8, 4]} intensity={2} color="#a5f3fc" /><Stars radius={80} depth={40} count={1400} factor={3} saturation={1} fade speed={speed / 10} /><LevelScenery level={level} /><Track speed={speed} level={level} />{hazards.map(hazard => <HazardEntity key={hazard.id} hazard={hazard} />)}<Vehicle lane={lane} speed={speed} damaged={hits === 1} /></Canvas></div>{wrecked && <div className="absolute inset-0 z-20 grid place-items-center bg-rose-950/75 p-6 text-center backdrop-blur-sm"><div><p className="text-5xl font-black text-rose-200">CAR WRECKED</p><p className="mt-3 text-sm font-bold text-white">LEVEL FAILED · Restarting Level {levelIndex + 1} from 0.0 km</p></div></div>}<div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" onClick={() => move(-3)} className="btn-secondary" aria-label="Move left">← Shift left</button><button type="button" onClick={() => move(3)} className="btn-secondary" aria-label="Move right">Shift right →</button></div><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 text-xs text-slate-300">Speed <input aria-label="Speed" type="range" min="2" max="9" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label></div><div className="absolute bottom-20 left-4 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-[10px] text-slate-400">{level.description} · {message}</div></div>;
}
