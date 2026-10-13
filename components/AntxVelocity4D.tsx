'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Line } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function Track({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null);
  const lanes = useMemo(() => [-3, 0, 3], []);
  useFrame((_, delta) => { if (group.current) group.current.position.z = (group.current.position.z + delta * speed * 5) % 8; });
  return <group ref={group}>{[...Array(14)].map((_, i) => <group key={i} position={[0, 0, -i * 8]}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}><planeGeometry args={[13, 7]} /><meshBasicMaterial color="#07152e" wireframe /></mesh>{lanes.map(x => <mesh key={x} position={[x, -1.18, 0]}><boxGeometry args={[0.08, 0.05, 7]} /><meshBasicMaterial color="#22d3ee" /></mesh>)}<mesh position={[-6, 0, 0]}><boxGeometry args={[0.12, 2.5, 7]} /><meshBasicMaterial color="#a78bfa" /></mesh><mesh position={[6, 0, 0]}><boxGeometry args={[0.12, 2.5, 7]} /><meshBasicMaterial color="#34d399" /></mesh></group>)}</group>;
}
function Vehicle({ lane, speed }: { lane: number; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) { ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, lane, delta * 7); ref.current.position.y = -0.7 + Math.sin(Date.now() * 0.004) * 0.04; } });
  return <group ref={ref} position={[lane, -0.7, 1]}><mesh><boxGeometry args={[1.35, .35, 2.5]} /><meshStandardMaterial color="#22d3ee" emissive="#0e7490" emissiveIntensity={2 + speed / 10} /></mesh><mesh position={[0, .3, -.25]}><boxGeometry args={[.8, .22, 1]} /><meshStandardMaterial color="#e0f2fe" emissive="#67e8f9" emissiveIntensity={1} /></mesh><pointLight color="#22d3ee" intensity={4} distance={5} /></group>;
}
export default function AntxVelocity4D() {
  const [lane, setLane] = useState(0); const [speed, setSpeed] = useState(5); const [score, setScore] = useState(0);
  const move = (direction: number) => { setLane(value => THREE.MathUtils.clamp(value + direction, -3, 3)); setScore(value => value + 25); };
  return <div className="relative overflow-hidden rounded-3xl border border-cyan-300/25 bg-[#020617] shadow-2xl shadow-cyan-950/40"><div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center justify-between gap-3 text-xs font-black"><span className="rounded-full border border-cyan-300/30 bg-slate-950/75 px-3 py-2 text-cyan-200">NEON//DRIFT 4D · {speed * 10} km/h</span><span className="rounded-full border border-violet-300/30 bg-slate-950/75 px-3 py-2 text-violet-200">Focus score {score}</span></div><div className="h-[420px] sm:h-[520px]"><Canvas camera={{ position: [0, 2.5, 7], fov: 58 }} dpr={[1, 1.5]}><color attach="background" args={['#020617']} /><fog attach="fog" args={['#020617', 8, 42]} /><ambientLight intensity={.4} /><directionalLight position={[3, 8, 4]} intensity={2} color="#a5f3fc" /><Stars radius={80} depth={40} count={1400} factor={3} saturation={1} fade speed={speed / 10} /><Track speed={speed} /><Vehicle lane={lane} speed={speed} /><Line points={[[-6, 2, -35], [0, 4, -22], [6, 2, -35]]} color="#8b5cf6" lineWidth={1} transparent opacity={.6} /></Canvas></div><div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" onClick={() => move(-3)} className="btn-secondary" aria-label="Move left">← Shift left</button><button type="button" onClick={() => move(3)} className="btn-secondary" aria-label="Move right">Shift right →</button></div><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">Speed <input aria-label="Speed" type="range" min="2" max="9" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label></div></div>;
}
