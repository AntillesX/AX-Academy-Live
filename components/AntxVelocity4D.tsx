'use client';

import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** NEON//DRIFT 4D — self-contained client component. No remote model/texture loads.
 * Units: metres, seconds, km/h. Simulation is ref-backed; React HUD updates at 10 Hz.
 * Mount in a height-constrained container or use the default viewport height.
 */
export type SoundtrackEvent = 'start' | 'level' | 'boost' | 'damage' | 'reset' | 'pause' | 'resume' | 'complete';
export type LevelConfig = { name: string; distance: number; speed: number; spawnEvery: number; sky: string; youtubeId?: string };
export const DEFAULT_LEVELS: readonly LevelConfig[] = [
  { name: 'Sunset Coastline', distance: 1000, speed: 125, spawnEvery: 2.8, sky: '#233645' },
  { name: 'Palm Boulevard', distance: 1200, speed: 150, spawnEvery: 2.4, sky: '#172b40' },
  { name: 'Central Market Port', distance: 1400, speed: 187, spawnEvery: 2.0, sky: '#091a2c' },
  { name: 'Stormwater Causeway', distance: 1600, speed: 210, spawnEvery: 1.8, sky: '#13172b' },
  { name: 'Neon Harbour Run', distance: 1800, speed: 235, spawnEvery: 1.6, sky: '#121e33' },
];
export type AntxVelocity4DProps = {
  className?: string;
  /** Exactly five configurations. Override these to retain your existing route names/audio. */
  levels?: readonly LevelConfig[];
  initialLevel?: number;
  soundtrackVideoId?: string;
  onSoundtrackTrigger?: (event: SoundtrackEvent, level: number) => void;
  onLevelChange?: (level: number) => void;
  onDamage?: (hits: number, integrity: number) => void;
  onReset?: () => void;
  onComplete?: (score: number) => void;
};
type Notice = { id: number; text: string; sub: string; until: number };
type Crack = { x: number; y: number; seed: number };
type AnimalKind = 'chicken' | 'dog' | 'cat' | 'cow';
type Hazard = { id: number; kind: AnimalKind; x: number; z: number; vx: number; size: number; judged: boolean; active: boolean; phase: number };
type Snapshot = { running: boolean; paused: boolean; complete: boolean; level: number; speed: number; score: number; xp: number; streak: number; integrity: number; hits: number; elapsed: number; distance: number; throttle: number; boost: number; boostCooldown: number; notice: Notice | null; cracks: Crack[] };
type Engine = Snapshot & { x: number; lane: number; invulnerable: number; spawn: number; publish: number; shake: number; hazards: Hazard[]; sequence: number };
type EngineRef = React.MutableRefObject<Engine>;
const LANES = [-2.5, 0, 2.5];
const clamp = THREE.MathUtils.clamp;
function makeEngine(level: number): Engine {
  return { running: false, paused: false, complete: false, level, speed: 0, score: 0, xp: 0, streak: 0, integrity: 100, hits: 0, elapsed: 0, distance: 0, throttle: .75, boost: 0, boostCooldown: 0, notice: null, cracks: [], x: 0, lane: 1, invulnerable: 0, spawn: 1.2, publish: 0, shake: 0, sequence: 0,
    hazards: Array.from({ length: 12 }, (_, id) => ({ id, kind: 'chicken', x: 0, z: -120, vx: 0, size: .35, judged: false, active: false, phase: 0 })) };
}
function snapshot(s: Engine): Snapshot {
  return { running: s.running, paused: s.paused, complete: s.complete, level: s.level, speed: s.speed, score: s.score, xp: s.xp, streak: s.streak, integrity: s.integrity, hits: s.hits, elapsed: s.elapsed, distance: s.distance, throttle: s.throttle, boost: s.boost, boostCooldown: s.boostCooldown, notice: s.notice, cracks: [...s.cracks] };
}
const timeText = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}.${Math.floor((s % 1) * 100).toString().padStart(2, '0')}`;
function seeded(seed: number) { let a = seed >>> 0; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

class RenderBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="nd-gpu-error" role="alert">The 3D renderer could not start. Enable hardware acceleration and reload.</div> : this.props.children; }
}

export default function AntxVelocity4D(props: AntxVelocity4DProps) {
  const levels = props.levels ?? DEFAULT_LEVELS;
  if (levels.length !== 5 || levels.some(l => !Number.isFinite(l.distance) || l.distance <= 0 || !Number.isFinite(l.speed) || l.speed <= 0 || !Number.isFinite(l.spawnEvery) || l.spawnEvery <= 0)) throw new Error('NEON//DRIFT requires five valid, positive-distance level configurations.');
  const firstLevel = clamp(Math.floor(props.initialLevel ?? 1), 1, 5);
  const engine = useRef<Engine>(makeEngine(firstLevel));
  const callbacks = useRef(props);
  callbacks.current = props;
  const root = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Snapshot>(() => snapshot(engine.current));
  const [muted, setMuted] = useState(true);
  const iframe = useRef<HTMLIFrameElement>(null);
  const publish = useCallback(() => setHud(snapshot(engine.current)), []);
  const emit = useCallback((event: SoundtrackEvent) => callbacks.current.onSoundtrackTrigger?.(event, engine.current.level), []);
  const notify = useCallback((text: string, sub: string) => { const s = engine.current; s.notice = { id: ++s.sequence, text, sub, until: s.elapsed + 2.8 }; }, []);
  const shift = useCallback((direction: number) => {
    const s = engine.current;
    if (!s.running || s.paused || s.complete) return;
    s.lane = clamp(s.lane + direction, 0, 2);
  }, []);
  const boost = useCallback(() => {
    const s = engine.current;
    if (!s.running || s.paused || s.boostCooldown > 0) return;
    s.boost = 2.4; s.boostCooldown = 9; emit('boost'); notify('FOCUS BURST', 'THRUST MULTIPLIER ×1.3'); publish();
  }, [emit, notify, publish]);
  const pause = useCallback(() => { const s = engine.current; if (!s.running) return; s.paused = !s.paused; emit(s.paused ? 'pause' : 'resume'); publish(); }, [emit, publish]);
  const start = useCallback(() => {
    engine.current.running = true; engine.current.paused = false;
    emit('start'); callbacks.current.onLevelChange?.(engine.current.level); publish(); root.current?.focus({ preventScroll: true });
  }, [emit, publish]);
  const reset = useCallback(() => { engine.current = makeEngine(firstLevel); emit('reset'); callbacks.current.onReset?.(); publish(); }, [firstLevel, emit, publish]);
  const setThrottle = useCallback((value: number) => { engine.current.throttle = clamp(value, 0, 1); publish(); }, [publish]);
  const hit = useCallback((x: number) => {
    const s = engine.current;
    if (s.invulnerable > 0) return;
    s.hits++; s.integrity = s.hits === 1 ? 78 : 0; s.invulnerable = 1.4; s.shake = .8; s.streak = 0;
    s.cracks = [...s.cracks, { x: clamp(50 + x * 7, 22, 78), y: 58 + (s.hits - 1) * -18, seed: 92 + s.sequence++ }];
    emit('damage'); callbacks.current.onDamage?.(s.hits, s.integrity);
    if (s.hits >= 2) { s.running = false; s.speed = 0; notify('SYSTEM OFFLINE', 'TWO IMPACTS · RESET REQUIRED'); }
    else notify('WINDSHIELD IMPACT', 'SHIELD 78% · NEXT IMPACT ENDS THE RUN');
    publish();
  }, [emit, notify, publish]);
  const nextLevel = useCallback(() => {
    const s = engine.current;
    if (s.level === 5) { s.complete = true; s.running = false; emit('complete'); callbacks.current.onComplete?.(s.score); }
    else { s.level++; s.distance = 0; s.spawn = 2; s.hazards.forEach(h => { h.active = false; }); emit('level'); callbacks.current.onLevelChange?.(s.level); notify(`LEVEL ${s.level} / 5`, levels[s.level - 1].name.toUpperCase()); }
    publish();
  }, [levels, emit, notify, publish]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      // The focused throttle slider keeps native up/down; every other game key still works.
      if (event.target instanceof HTMLInputElement && (key === 'arrowup' || key === 'arrowdown')) return;
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' ', 'p', 'escape'].includes(key)) return;
      event.preventDefault();
      if (key === 'arrowup' || key === 'w') { setThrottle(engine.current.throttle + .05); return; }
      if (key === 'arrowdown' || key === 's') { setThrottle(engine.current.throttle - .05); return; }
      if (event.repeat) return;
      if (key === 'arrowleft' || key === 'a') shift(-1);
      if (key === 'arrowright' || key === 'd') shift(1);
      if (key === ' ') boost();
      if (key === 'p' || key === 'escape') pause();
    };
    const hide = () => { if (document.hidden && engine.current.running && !engine.current.paused) pause(); };
    // Scope keyboard handling to this game, not the entire host page.
    el.addEventListener('keydown', down); document.addEventListener('visibilitychange', hide);
    return () => { el.removeEventListener('keydown', down); document.removeEventListener('visibilitychange', hide); };
  }, [boost, pause, shift, setThrottle]);

  const videoId = levels[hud.level - 1].youtubeId ?? props.soundtrackVideoId;
  const validVideo = videoId && /^[\w-]{11}$/.test(videoId) ? videoId : undefined;
  // No global YouTube API or competing script loader. Commands go to this iframe only.
  const command = useCallback((func: string) => {
    iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), 'https://www.youtube.com');
  }, []);
  useEffect(() => { command(hud.running && !hud.paused ? 'playVideo' : 'pauseVideo'); }, [command, hud.running, hud.paused, validVideo]);
  useEffect(() => { command(muted ? 'mute' : 'unMute'); }, [command, muted]);
  const level = levels[hud.level - 1];
  const xp = hud.xp % 2000;
  const percent = Math.round(xp / 2000 * 100);
  const isGameOver = hud.hits >= 2;
  const blocked = !hud.running || hud.paused;

  return <div ref={root} tabIndex={0} className={`nd-root ${props.className ?? ''} ${hud.hits ? 'nd-damaged' : ''}`} aria-label="NEON DRIFT racing game" onPointerDown={() => root.current?.focus({ preventScroll: true })}>
    <style>{STYLES}</style>
    <RenderBoundary><Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [0, 1.6, 5], fov: 72, near: .06, far: 230 }} fallback={<div className="nd-gpu-error">WebGL is unavailable on this device.</div>}>
      <Suspense fallback={null}><World engine={engine} levels={levels} publish={publish} hit={hit} nextLevel={nextLevel} notify={notify} /></Suspense>
    </Canvas></RenderBoundary>
    <div className="nd-vignette" aria-hidden="true" />
    <div className="nd-glass" aria-hidden="true"><RainGlass /><CrackedGlass cracks={hud.cracks} /></div>
    <div className="nd-hud">
      <div className="nd-top-cards">
        <section className="nd-panel nd-score backdrop-blur-md bg-slate-900/80 border border-cyan-500/30 text-cyan-400 font-mono" aria-label="Focus score">
          <span className="nd-label">FOCUS SCORE</span><strong className="nd-number">{hud.score}</strong>
          <div className="nd-xp-row"><span>XP</span><div className="nd-xp-track"><i style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div>
          <div className="nd-micro">LVL {hud.level} · XP {xp}/2000</div>
        </section>
        <section className="nd-panel nd-speed backdrop-blur-md bg-slate-900/80 border border-cyan-500/30 text-cyan-400 font-mono" aria-label="Speed">
          <span className="nd-label nd-speed-label">SPEED <i /></span><div><strong className="nd-number">{Math.round(hud.speed)}</strong><b className="nd-unit">KM/H</b></div>
          <button className="nd-boost" disabled={blocked || hud.boostCooldown > 0} onClick={boost} aria-label="Activate boost, space key">{hud.boost > 0 ? 'BURST ACTIVE' : hud.boostCooldown > 0 ? `RECHARGE ${Math.ceil(hud.boostCooldown)}s` : 'BOOST READY'} · ×1.3</button>
        </section>
      </div>
      <div className="nd-route"><span className="nd-logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 18L10 5h6L9 18M13 18l7-13" /></svg></span>NEON//DRIFT 4D <span>· LEVEL {hud.level}/5 · {level.name} · Caribbean</span></div>
      <div className="nd-callout-slot" aria-live="polite" aria-atomic="true">{hud.notice && <div key={hud.notice.id} className="nd-callout"><b>{hud.notice.text}</b><span>{hud.notice.sub}</span></div>}</div>
      {hud.streak >= 3 && <div className="nd-streak"><b><span aria-hidden="true">🔥</span> STREAK ×{hud.streak}</b><span>FOCUS BONUS ACTIVE</span></div>}
      <div className="nd-throttle nd-panel">
        <label htmlFor="nd-throttle">ACCEL</label><div className="nd-throttle-rail"><div className="nd-throttle-fill" style={{ height: `${hud.throttle * 100}%` }} /><input id="nd-throttle" type="range" min="0" max="100" step="1" value={Math.round(hud.throttle * 100)} onChange={e => setThrottle(Number(e.target.value) / 100)} aria-label="Acceleration thrust percentage" /></div>
        <span>THRUST<br /><b>{Math.round(hud.throttle * 100)}%</b></span>
      </div>
      <div className="nd-burst-status">{hud.boost > 0 ? 'FOCUS BURST · ACTIVE' : 'NEURAL LINK · ONLINE'}</div>
      <div className="nd-cluster">
        <div className="nd-timer">STREAK ×{hud.streak} · {timeText(hud.elapsed)}</div>
        <section className="nd-panel nd-integrity" aria-label="Vehicle integrity">
          <span className="nd-label">INTEGRITY</span><div className="nd-integrity-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6z" /></svg><b>{hud.integrity}/100</b><div className="nd-health-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hud.integrity}><i style={{ width: `${hud.integrity}%` }} /></div><b>{hud.integrity}%</b></div>
          <div className="nd-micro">{isGameOver ? 'SYSTEM OFFLINE' : hud.hits ? 'GLASS DAMAGED' : 'SYSTEM OK'} · SHIELD {hud.integrity}%</div>
        </section>
      </div>
      <button className="nd-shift nd-left" disabled={blocked} onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); shift(-1); }} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); shift(-1); } }} aria-label="Shift left"><span>◄</span><b>SHIFT LEFT</b></button>
      <button className="nd-shift nd-right" disabled={blocked} onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); shift(1); }} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); shift(1); } }} aria-label="Shift right"><span>►</span><b>SHIFT RIGHT</b></button>
      <div className="nd-utility"><button onClick={pause} disabled={!hud.running} aria-label={hud.paused ? 'Resume game' : 'Pause game'}>{hud.paused ? 'RESUME' : 'PAUSE'}</button><button onClick={() => setMuted(!muted)} disabled={!validVideo}>{!validVideo ? 'AUDIO: NOT SET' : muted ? 'SOUND: OFF' : 'SOUND: ON'}</button><span>{(hud.distance / 1000).toFixed(2)} / {(level.distance / 1000).toFixed(1)} KM</span></div>
    </div>
    {blocked && <div className="nd-modal-backdrop"><div className="nd-modal nd-panel" role="dialog" aria-modal="true" aria-labelledby="nd-dialog-title">
      <span className="nd-eyebrow">CARIBBEAN · AFTER HOURS</span><h1 id="nd-dialog-title">{hud.complete ? 'RUN COMPLETE' : isGameOver ? 'SIGNAL LOST' : hud.paused ? 'DRIFT PAUSED' : 'NEON//DRIFT'}<small>4D</small></h1>
      <p>{hud.complete ? `Five routes cleared. ${hud.score} focus points.` : isGameOver ? 'Two impacts. Your windshield and shield need a reset.' : hud.paused ? 'Your route is waiting. No simulation time elapses while paused.' : 'A rain-soaked hypercar run through the neon port. Shift around crossing animals. Stay precise.'}</p>
      <div className="nd-controls-legend"><span>← → / A D <b>SHIFT</b></span><span>↑ ↓ / W S <b>THRUST</b></span><span>SPACE <b>BOOST</b></span><span>P / ESC <b>PAUSE</b></span></div>
      <button className="nd-start" onClick={hud.paused ? pause : hud.complete || isGameOver ? reset : start}>{hud.paused ? 'RESUME RUN' : hud.complete || isGameOver ? 'RESET RUN' : 'ENTER COCKPIT'} <span>→</span></button>
      <div className="nd-micro">5 LEVELS · 2 IMPACTS · TOUCH + KEYBOARD</div>
    </div></div>}
    {validVideo && <iframe ref={iframe} className="nd-youtube" title="YouTube soundtrack" src={`https://www.youtube.com/embed/${validVideo}?enablejsapi=1&autoplay=${hud.running ? 1 : 0}&mute=1&loop=1&playlist=${validVideo}&playsinline=1${typeof window !== 'undefined' && window.location.origin !== 'null' ? `&origin=${encodeURIComponent(window.location.origin)}` : ''}`} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { command(muted ? 'mute' : 'unMute'); command(hud.running && !hud.paused ? 'playVideo' : 'pauseVideo'); }} />}
  </div>;
}

const World = React.memo(function World({ engine, levels, publish, hit, nextLevel, notify }: { engine: EngineRef; levels: readonly LevelConfig[]; publish: () => void; hit: (x: number) => void; nextLevel: () => void; notify: (text: string, sub: string) => void }) {
  const { camera } = useThree();
  const scene = useThree(s => s.scene);
  const colors = useMemo(() => levels.map(l => new THREE.Color(l.sky)), [levels]);
  const clock = useRef(0);
  useFrame((_, rawDt) => {
    const s = engine.current;
    const dt = Math.min(rawDt, .05);
    clock.current += dt;
    scene.background = colors[s.level - 1];
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(colors[s.level - 1]);
    if (s.running && !s.paused) {
      const level = levels[s.level - 1];
      const previousX = s.x;
      // ~70 ms lane response: ref-backed inputs are consumed on the next render frame.
      s.x = THREE.MathUtils.damp(s.x, LANES[s.lane], 35, dt);
      s.speed = THREE.MathUtils.damp(s.speed, level.speed * (.22 + s.throttle * .78) * (s.boost > 0 ? 1.3 : 1), 3.5, dt);
      const travel = s.speed / 3.6 * dt;
      s.elapsed += dt; s.distance += travel; s.spawn -= dt;
      s.invulnerable = Math.max(0, s.invulnerable - dt); s.shake = Math.max(0, s.shake - dt);
      s.boost = Math.max(0, s.boost - dt); s.boostCooldown = Math.max(0, s.boostCooldown - dt);
      if (s.notice && s.elapsed > s.notice.until) s.notice = null;
      if (s.spawn <= 0) {
        const h = s.hazards.find(h => !h.active);
        if (h) {
          const kinds: AnimalKind[] = ['chicken', 'dog', 'cat', 'cow'];
          h.kind = kinds[Math.floor(Math.random() * (s.level === 1 ? 3 : 4))];
          h.size = h.kind === 'cow' ? 1 : h.kind === 'dog' ? .6 : .42;
          const direction = Math.random() > .5 ? 1 : -1;
          h.x = -direction * 6.8; h.z = -70 - Math.random() * 20;
          // Aim crossing near the car's arrival time, but vary arrival lane for variety.
          const arrival = (3.4 - h.z) / Math.max(10, s.speed / 3.6);
          h.vx = direction * (5 + Math.random() * 4) / arrival;
          h.active = true; h.judged = false; h.phase = 0;
        }
        s.spawn = level.spawnEvery + Math.random() * .5;
      }
      for (const h of s.hazards) {
        if (!h.active) continue;
        const oldZ = h.z, oldX = h.x;
        h.z += travel; h.x += h.vx * dt; h.phase += dt * 13;
        // Swept crossing test avoids tunnelling at high speed / low framerate.
        if (!h.judged && oldZ <= 3.4 && h.z >= 3.4) {
          h.judged = true;
          const t = clamp((3.4 - oldZ) / Math.max(.001, h.z - oldZ), 0, 1);
          const dx = Math.abs(THREE.MathUtils.lerp(oldX, h.x, t) - THREE.MathUtils.lerp(previousX, s.x, t));
          if (dx < .68 + h.size) hit(h.x - s.x);
          else if (dx < 2.15 + h.size) { s.streak++; const points = s.streak >= 3 ? 75 : 50; s.score += points; s.xp += points; notify(`+${points} NEAR MISS!`, 'PRECISION DRIFT · +' + points + ' XP'); }
          else { s.score += 10; s.xp += 10; s.streak = 0; }
        }
        if (h.z > 10 || Math.abs(h.x) > 11) h.active = false;
      }
      if (s.running && s.distance >= level.distance) nextLevel();
      s.publish += dt;
      if (s.publish >= .1) { s.publish = 0; publish(); }
    }
    const shake = s.shake * .018;
    camera.position.set(s.x + Math.sin(clock.current * 67) * shake, 1.6 + Math.sin(clock.current * 51) * shake, 5);
    camera.rotation.set(-.035, 0, -(LANES[s.lane] - s.x) * .012);
  });
  return <>
    <fog attach="fog" args={['#102133', 35, 195]} />
    <ambientLight intensity={.65} color="#79c7de" /><hemisphereLight args={['#8bc6e2', '#112a30', 1.0]} />
    <directionalLight position={[15, 26, -20]} color="#e7c4a3" intensity={1.2} />
    <pointLight position={[0, 5, -30]} color="#14efff" intensity={60} distance={45} decay={2} />
    <Road engine={engine} /><Streets engine={engine} /><Rain engine={engine} />
    {engine.current.hazards.map((_, index) => <Animal key={index} engine={engine} index={index} />)}
    <Cockpit engine={engine} />
  </>;
});

const ROAD_VERTEX = `varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv; vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const ROAD_FRAGMENT = `
  uniform float distanceRun; uniform float time; varying vec2 vUv; varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    float x=vWorld.x; float z=vWorld.z-distanceRun;
    float ripple=sin(z*8.+sin(x*18.)+time*2.)*.022;
    vec3 c=vec3(.014,.029,.039);
    float noise=hash(floor(vec2(x*160.,z*100.)));
    c+=noise*.027;
    float stripes=mod(z,8.); float dash=step(stripes,4.8);
    float centre=exp(-pow((abs(x)-1.25+ ripple)*29.,2.))*dash;
    float edge=exp(-pow((abs(x)-4.08+ripple)*21.,2.));
    float reflection=exp(-pow((abs(x)-4.+ripple*9.)*2.5,2.))*(.2+.8*noise);
    c+=vec3(.02,.8,.9)*(centre+edge)*1.7+vec3(.0,.42,.52)*reflection*.34;
    float wet=pow(max(0.,sin(z*.83+x*6.+ripple*23.)),12.);
    c+=vec3(.12,.3,.34)*wet*.2;
    float pink=exp(-pow((x+2.7+sin(z*.13)*.5)*1.3,2.))*pow(max(0.,sin(z*1.9)),18.);
    float gold=exp(-pow((x-2.9+sin(z*.16)*.6)*1.2,2.))*pow(max(0.,sin(z*2.6)),20.);
    c+=vec3(.45,.06,.34)*pink*.22+vec3(.6,.3,.08)*gold*.25;
    float fade=smoothstep(-175.,-30.,vWorld.z);c=mix(vec3(.04,.09,.12),c,fade);
    gl_FragColor=vec4(c,1.);
  }`;
function Road({ engine }: { engine: EngineRef }) {
  const uniforms = useMemo(() => ({ distanceRun: { value: 0 }, time: { value: 0 } }), []);
  const distance = useRef(0);
  useFrame((_, dt) => { const s = engine.current; if (s.running && !s.paused) { distance.current += s.speed / 3.6 * Math.min(dt, .05); uniforms.time.value += dt; } uniforms.distanceRun.value = distance.current; });
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.015, -90]}><planeGeometry args={[8.7, 230]} /><shaderMaterial vertexShader={ROAD_VERTEX} fragmentShader={ROAD_FRAGMENT} uniforms={uniforms} /></mesh>
    {[-1, 1].map(side => <React.Fragment key={side}>
      <mesh position={[side * 5.25, -.2, -90]}><boxGeometry args={[1.8, .45, 230]} /><meshStandardMaterial color="#384854" roughness={.6} /></mesh>
    </React.Fragment>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40, -.55, -90]}><planeGeometry args={[70, 260]} /><shaderMaterial vertexShader={ROAD_VERTEX} fragmentShader={WATER_FRAGMENT} uniforms={uniforms} /></mesh>
    <Skyline />
  </>;
}

const WATER_FRAGMENT = `
  uniform float distanceRun; uniform float time; varying vec2 vUv; varying vec3 vWorld;
  void main(){
    float z=vWorld.z-distanceRun*.35; float x=vWorld.x;
    float w=sin(z*1.7+time*1.3)*.5+sin(z*3.1-x*.7+time*2.)*.5;
    vec3 c=vec3(.02,.075,.1)+vec3(.0,.05,.06)*w;
    float far=smoothstep(-60.,-190.,vWorld.z);
    float cols=floor(x/3.);
    float hue=fract(sin(cols*12.9)*43758.5);
    vec3 neon=mix(vec3(.1,.85,.9),mix(vec3(.85,.25,.75),vec3(1.,.65,.25),step(.6,hue)),step(.33,hue));
    float streak=pow(max(0.,sin(x*1.05)),40.)*(.4+.6*max(0.,w))*far;
    c+=neon*streak*.9+vec3(.15,.35,.4)*far*.18;
    gl_FragColor=vec4(c,1.);
  }`;
const SKY_FRAGMENT = `varying vec2 vUv; uniform float time;
  float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
  void main(){ float y=vUv.y; vec3 top=vec3(.012,.03,.055), mid=vec3(.05,.12,.17), glow=vec3(.38,.27,.25);
    vec3 c=mix(mid,top,smoothstep(.25,.9,y)); c=mix(glow,c,smoothstep(.0,.2,y));
    float cl=n(vUv*vec2(6.,3.)+vec2(time*.01,0.))*.6+n(vUv*vec2(14.,7.))*.4; c+=vec3(.07,.1,.13)*smoothstep(.45,.85,cl)*smoothstep(.15,.6,y);
    float flash=step(.995,fract(sin(floor(time*.4))*911.))*.25*(1.-y); c+=vec3(.5,.7,.9)*flash;
    gl_FragColor=vec4(c,1.);}`;
function Skyline() {
  const sky = useMemo(() => ({ time: { value: 0 } }), []);
  const { camera } = useThree();
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { sky.time.value += dt; if (g.current) g.current.position.x = camera.position.x * .9; });
  const rnd = useMemo(() => seeded(7), []);
  const stacks = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: 6 + i * 2.1, h: 1 + Math.floor(rnd() * 4), c: ['#3fc3cf', '#c4589e', '#e09a4a', '#4d78c9', '#8a5cd0'][i % 5] })), [rnd]);
  const town = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ x: -10 - i * 2.4, h: 2 + rnd() * 5, c: ['#d98bb0', '#77c6c0', '#e6c37f', '#a68ad8', '#e7958a'][i % 5] })), [rnd]);
  return <group ref={g}>
    <mesh position={[0, 40, -205]}><planeGeometry args={[520, 110]} /><shaderMaterial fragmentShader={SKY_FRAGMENT} vertexShader={'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}'} uniforms={sky} fog={false} depthWrite={false} /></mesh>
    <mesh position={[-70, 3, -196]} scale={[60, 14, 4]}><sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshBasicMaterial color="#0b1a22" fog={false} /></mesh>
    <group position={[0, 0, -175]}>
      {stacks.map((s, i) => Array.from({ length: s.h }, (_, k) => <mesh key={`${i}-${k}`} position={[s.x, .6 + k * 1.25, (i % 3) * 2.5]}><boxGeometry args={[2, 1.2, 5]} /><meshBasicMaterial color={k % 2 ? s.c : new THREE.Color(s.c).multiplyScalar(.7)} fog={false} /></mesh>))}
      {[18, 32, 47].map((x, i) => <group key={x} position={[x, 0, -8 - i * 3]}>
        <mesh position={[0, 9, 0]}><boxGeometry args={[.6, 18, .6]} /><meshBasicMaterial color="#1d2c37" fog={false} /></mesh>
        <mesh position={[-4, 17.5, 0]}><boxGeometry args={[14, .6, .6]} /><meshBasicMaterial color="#1d2c37" fog={false} /></mesh>
        <mesh position={[-10.5, 17.8, 0]}><sphereGeometry args={[.28, 8, 6]} /><meshBasicMaterial color="#ff4f61" toneMapped={false} fog={false} /></mesh>
        <mesh position={[0, 18.4, 0]}><sphereGeometry args={[.25, 8, 6]} /><meshBasicMaterial color="#ffcf7f" toneMapped={false} fog={false} /></mesh>
      </group>)}
      {town.map((t, i) => <group key={i} position={[t.x, t.h / 2, (i % 2) * 3]}>
        <mesh><boxGeometry args={[2.2, t.h, 3]} /><meshBasicMaterial color={new THREE.Color(t.c).multiplyScalar(.55)} fog={false} /></mesh>
        <mesh position={[0, t.h * .1, 1.52]}><planeGeometry args={[1.6, .25]} /><meshBasicMaterial color={i % 3 ? '#ffd38d' : '#ff6ad5'} toneMapped={false} fog={false} /></mesh>
      </group>)}
    </group>
  </group>;
}
function Pier({ index }: { index: number }) {
  const rnd = useMemo(() => seeded(index * 31 + 5), [index]);
  const d = useMemo(() => ({ boat: rnd() > .45, c: ['#d7e6ea', '#2ec6d1', '#e6b36a'][index % 3], stack: Math.floor(rnd() * 3), hue: ['#3fc3cf', '#c4589e', '#e09a4a', '#8a5cd0'][index % 4] }), [rnd, index]);
  return <group position={[0, 0, 0]}>
    <Box position={[6.3, -.25, 0]} size={[.9, .5, 10]} color="#3a4a55" />
    <Box position={[6.15, .55, 0]} size={[.04, .04, 10]} color="#40eef0" glow />
    {[-4, -1.5, 1, 3.5].map(z => <Box key={z} position={[6.15, .28, z]} size={[.05, .55, .05]} color="#7d8f99" />)}
    {d.boat && <group position={[11 + rnd() * 3, -.35, rnd() * 4 - 2]} rotation={[0, .15, 0]}>
      <mesh scale={[1, .35, 2.6]}><sphereGeometry args={[1.2, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color={d.c} roughness={.4} /></mesh>
      <Box position={[0, .45, -.3]} size={[1.4, .8, 2.2]} color="#e8f1f2" />
      <Box position={[0, .5, .82]} size={[1.2, .3, .02]} color="#8ff0ff" glow />
      <Box position={[0, 2.2, -.6]} size={[.05, 3.5, .05]} color="#c8d3d6" />
    </group>}
    {d.stack > 0 && Array.from({ length: d.stack }, (_, k) => <Box key={k} position={[18 + rnd() * 4, .7 + k * 1.3, 0]} size={[2.4, 1.25, 6]} color={k % 2 ? d.hue : '#36576b'} />)}
  </group>;
}

function Box({ position, size, color, glow = false }: { position: [number, number, number]; size: [number, number, number]; color: string; glow?: boolean }) {
  return <mesh position={position}><boxGeometry args={size} />{glow ? <meshBasicMaterial color={color} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={.72} metalness={.12} />}</mesh>;
}
function Building({ side, index }: { side: number; index: number }) {
  const rnd = useMemo(() => seeded(index * 53 + (side + 2) * 97), [index, side]);
  const data = useMemo(() => ({ height: 4.6 + rnd() * 3.7, color: ['#cf98ac', '#6fbab7', '#b7cba5', '#b58ccc', '#e0b087'][index % 5], neon: ['#2fe4ed', '#ef64cf', '#ffcb86'][index % 3] }), [rnd, index]);
  return <group position={[side * 7.35, 0, 0]}>
    <Box position={[0, data.height / 2, 0]} size={[4.2, data.height, 7]} color={data.color} />
    <Box position={[0, .12, 0]} size={[4.65, .25, 7.7]} color="#526173" />
    <Box position={[0, data.height, 0]} size={[4.5, .25, 7.5]} color="#324859" />
    <mesh position={[0, data.height + .68, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1, .5, 1]}><boxGeometry args={[3.15, 3.15, 7.65]} /><meshStandardMaterial color={index % 2 ? '#47718b' : '#854957'} /></mesh>
    <Box position={[-side * 2.15, 2.9, 0]} size={[.1, .05, 7.1]} color={data.neon} glow />
    <Box position={[-side * 2.52, 2.5, 0]} size={[1, .14, 7]} color="#203c46" />
    {[ -2.5, 0, 2.5 ].map(z => <React.Fragment key={z}>
      <Box position={[-side * 2.14, 4.1, z]} size={[.1, 1.15, 1.2]} color="#15293b" />
      <Box position={[-side * 2.21, 4.1, z]} size={[.09, .04, 1.25]} color={data.neon} glow />
      <Box position={[-side * 2.15, 1.2, z]} size={[.08, 1.5, 1.2]} color="#ffe2a5" glow />
      <Box position={[-side * 2.75, 1.17, z]} size={[.12, 2.4, .12]} color="#75a6a9" />
      <Box position={[-side * 2.5, .65, z]} size={[1.1, .09, .05]} color="#7a9da3" />
    </React.Fragment>)}
    <Box position={[-side * 2.8, 2.66, 0]} size={[1.3, .25, 7.2]} color={index % 2 ? '#aa526d' : '#327e82'} />
  </group>;
}
function Palm({ side, index }: { side: number; index: number }) {
  return <group position={[side * 5.25, 0, -4]} rotation={[0, index, side * .09]}>
    <mesh position={[0, 3.3, 0]}><cylinderGeometry args={[.08, .19, 6.6, 7]} /><meshStandardMaterial color="#2f2928" /></mesh>
    {Array.from({ length: 7 }, (_, i) => <group key={i} position={[0, 6.6, 0]} rotation={[0, i * Math.PI * 2 / 7, -.36]}>
      <mesh position={[1.15, -.2, 0]} rotation={[0, 0, -.2]} scale={[2.4, .18, .46]}><sphereGeometry args={[.65, 7, 4]} /><meshStandardMaterial color="#102c27" roughness={1} /></mesh>
      <mesh position={[2.3, -.66, 0]} rotation={[0, 0, -.65]} scale={[1.1, .11, .35]}><sphereGeometry args={[.6, 6, 4]} /><meshStandardMaterial color="#14352b" /></mesh>
    </group>)}
  </group>;
}
function Streets({ engine }: { engine: EngineRef }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const offset = useRef(0);
  useFrame((_, rawDt) => {
    const s = engine.current;
    if (s.running && !s.paused) offset.current += s.speed / 3.6 * Math.min(rawDt, .05);
    groups.current.forEach((g, i) => { if (g) g.position.z = 12 - ((i * 10 + offset.current) % 200); });
  });
  return <>{Array.from({ length: 20 }, (_, i) => <group ref={g => { groups.current[i] = g; }} key={i} position={[0, 0, 12 - i * 10]}>
    <Building side={-1} index={i} /><Pier index={i} />
    {i % 2 === 0 && <Palm side={-1} index={i} />}{i % 3 === 1 && <Palm side={1} index={i + 1} />}
    {[-1, 1].map(side => <group key={side} position={[side * 4.95, 0, 2]}>
      <mesh position={[0, 2.9, 0]}><cylinderGeometry args={[.035, .045, 5.8, 6]} /><meshStandardMaterial color="#5f686f" /></mesh>
      <Box position={[-side * .27, 5.75, 0]} size={[.6, .06, .15]} color="#ffcc86" glow />
    </group>)}
  </group>)}</>;
}
function Animal({ engine, index }: { engine: EngineRef; index: number }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const legs = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const chicken = useRef<THREE.Group>(null);
  useFrame(() => {
    const h = engine.current.hazards[index]; const g = group.current;
    if (!g) return;
    g.visible = h.active;
    if (!h.active) return;
    const bird = h.kind === 'chicken', cow = h.kind === 'cow', cat = h.kind === 'cat';
    g.position.set(h.x, .02, h.z); g.rotation.y = h.vx > 0 ? 0 : Math.PI;
    g.scale.setScalar(cow ? 1.55 : bird ? .7 : cat ? .72 : .95);
    if (body.current) { body.current.scale.set(1.2, bird ? .78 : .67, .56); (body.current.material as THREE.MeshStandardMaterial).color.set(cow ? '#ddd6bd' : bird ? '#d9bd87' : cat ? '#9295a0' : '#9d6d47'); }
    if (head.current) head.current.position.set(.65, bird ? .8 : .75, 0);
    if (chicken.current) chicken.current.visible = bird;
    legs.current.forEach((l, j) => { if (l) { l.visible = !bird || j < 2; l.rotation.z = Math.sin(h.phase + j * Math.PI) * .46; } });
  });
  return <group ref={group} visible={false}>
    <mesh ref={body} position={[0, .57, 0]}><sphereGeometry args={[.65, 10, 8]} /><meshStandardMaterial roughness={.82} /></mesh>
    <group ref={head} position={[.65, .75, 0]}>
      <mesh><sphereGeometry args={[.27, 8, 6]} /><meshStandardMaterial color="#c29c73" /></mesh>
      <mesh position={[.2, -.045, 0]} scale={[1, .6, .7]}><sphereGeometry args={[.2, 7, 5]} /><meshStandardMaterial color="#b99b79" /></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[.12, .08, side * .22]}><sphereGeometry args={[.04, 6, 5]} /><meshBasicMaterial color="#101a22" /></mesh>)}
      <group ref={chicken}>
        <mesh position={[0, .25, 0]}><coneGeometry args={[.11, .2, 4]} /><meshStandardMaterial color="#e45650" /></mesh>
        <mesh position={[.35, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[.1, .22, 4]} /><meshStandardMaterial color="#fac058" /></mesh>
      </group>
    </group>
    {Array.from({ length: 4 }, (_, i) => <mesh key={i} ref={m => { legs.current[i] = m; }} position={[i < 2 ? .38 : -.38, .22, i % 2 ? .23 : -.23]}><cylinderGeometry args={[.06, .045, .45, 6]} /><meshStandardMaterial color="#8f715b" /></mesh>)}
    <mesh position={[-.68, .67, 0]} rotation={[0, 0, .65]}><cylinderGeometry args={[.04, .07, .46, 5]} /><meshStandardMaterial color="#7a6659" /></mesh>
  </group>;
}

function Rain({ engine }: { engine: EngineRef }) {
  const geometry = useMemo(() => {
    const r = seeded(52), positions = new Float32Array(480 * 6);
    for (let i = 0; i < 480; i++) { const x = (r() - .5) * 38, y = r() * 19, z = -r() * 100; positions.set([x, y, z, x + .025, y - .5, z + .12], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, rawDt) => {
    const s = engine.current; if (s.paused || !s.running) return;
    const dt = Math.min(rawDt, .05), a = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < a.length; i += 6) {
      a[i + 1] -= dt * 9; a[i + 2] += dt * (s.speed / 3.6 + 5);
      if (a[i + 1] < -.3) a[i + 1] = 19;
      if (a[i + 2] > 6) a[i + 2] = -100;
      a[i + 3] = a[i] + .025; a[i + 4] = a[i + 1] - .5; a[i + 5] = a[i + 2] + .12;
    }
    geometry.attributes.position.needsUpdate = true;
  });
  return <lineSegments geometry={geometry} frustumCulled={false}><lineBasicMaterial color="#97cbde" transparent opacity={.26} depthWrite={false} /></lineSegments>;
}

function Cockpit({ engine }: { engine: EngineRef }) {
  const { camera, size } = useThree();
  const group = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const carbon = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) { ctx.fillStyle = '#28323b'; ctx.fillRect(0, 0, 64, 64); for (let x = 0; x < 64; x += 8) for (let y = 0; y < 64; y += 8) { const even = (x + y) % 16 === 0; ctx.fillStyle = even ? '#56636e' : '#151b21'; ctx.fillRect(x, y, even ? 7 : 3, even ? 3 : 7); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 5); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  useEffect(() => () => carbon.dispose(), [carbon]);
  const carbonMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a9b6c1', map: carbon, metalness: .35, roughness: .32 }), [carbon]);
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d3d47', metalness: .35, roughness: .28, emissive: '#021116' }), []);
  const neon = useMemo(() => new THREE.MeshBasicMaterial({ color: '#3cf0f2', toneMapped: false }), []);
  useEffect(() => () => { carbonMat.dispose(); paint.dispose(); neon.dispose(); }, [carbonMat, paint, neon]);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.copy(camera.position); group.current.quaternion.copy(camera.quaternion);
    // Authored for a 1:1 frame; X stretches so the cabin fills portrait and landscape screens.
    group.current.scale.set(clamp(size.width / Math.max(1, size.height), .5, 1.9), 1, 1);
    if (wheel.current) wheel.current.rotation.z = -(LANES[engine.current.lane] - engine.current.x) * .16;
  });
  const strip = (x: number, y: number, z: number, w: number, rz: number, ry = 0, h = .007) => <mesh position={[x, y, z]} rotation={[0, ry, rz]} material={neon}><boxGeometry args={[w, h, .006]} /></mesh>;
  return <group ref={group}>
    {/* Camera-local cockpit; the asphalt remains in world space. */}
    <pointLight position={[0, .1, -.55]} color="#3fe6f0" intensity={1.6} distance={2.2} decay={2} />
    <pointLight position={[0, -.1, -1.6]} color="#ffb98a" intensity={.7} distance={2.5} decay={2} />
    {/* Hood and fender haunches seen through the windshield */}
    <mesh position={[0, -.5, -2.25]} rotation={[.12, 0, 0]} scale={[1, .2, 1]} material={paint}><sphereGeometry args={[1.55, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    {[-1, 1].map(side => <React.Fragment key={side}>
      <mesh position={[side * 1.42, -.47, -2.0]} scale={[.55, .2, 1]} material={paint}><sphereGeometry args={[1, 24, 12]} /></mesh>
      {strip(side * .5, -.335, -2.05, 1.1, side * .05, side * .55)}
      {strip(side * 1.05, -.31, -1.85, .8, side * .2, side * .25)}
    </React.Fragment>)}
    {strip(0, -.35, -2.3, .02, 0, 0, .05)}
    {/* Dashboard */}
    <mesh position={[0, -.45, -1.08]} rotation={[.32, 0, 0]} material={carbonMat}><boxGeometry args={[2.3, .46, .62]} /></mesh>
    <mesh position={[0, dashY(-1.29), -1.29]} material={neon}><boxGeometry args={[.3, .005, .005]} /></mesh>
    <mesh position={[0, -.24, -1.0]} rotation={[.32, 0, 0]}><boxGeometry args={[.36, .13, .06]} /><meshStandardMaterial color="#05090d" metalness={.5} roughness={.4} /></mesh>
    <mesh position={[0, -.23, -.955]} rotation={[.32, 0, 0]}><planeGeometry args={[.3, .08]} /><meshBasicMaterial color="#06252c" toneMapped={false} /></mesh>
    {strip(0, -.205, -.95, .22, 0, 0, .003)}
    {[-1, 1].map(side => <group key={side}>
      {/* Button pods */}
      <group position={[side * .36, -.3, -.95]} rotation={[.4, side * -.2, 0]} scale={.7}>
        <mesh material={carbonMat}><boxGeometry args={[.27, .17, .06]} /></mesh>
        {[0, 1, 2].map(r => [0, 1, 2].map(c => <mesh key={`${r}${c}`} position={[-.08 + c * .08, .05 - r * .05, .034]}><boxGeometry args={[.06, .033, .012]} /><meshStandardMaterial color="#0d151b" metalness={.6} roughness={.5} emissive={r === 0 && c === 1 ? '#2bd8e0' : '#061218'} emissiveIntensity={r === 0 && c === 1 ? 1.2 : .6} /></mesh>))}
      </group>
      {/* Raked side consoles with neon accent */}
      <mesh position={[side * .98, -.36, -.8]} rotation={[.2, side * -.5, side * -.42]} material={carbonMat}><boxGeometry args={[.7, .1, 1.3]} /></mesh>
      {strip(side * .78, -.24, -1.0, .75, side * -.55, side * -.35, .009)}
      {strip(side * .98, -.33, -.75, .55, side * .5, side * .2, .006)}
      {/* A-pillars and roof rail */}
      <mesh position={[side * 1.18, .1, -1.05]} rotation={[0, 0, side * -.5]} material={carbonMat}><boxGeometry args={[.06, 1.35, .08]} /></mesh>
      {strip(side * 1.13, .08, -1.0, .008, side * -.5, 0, 1.25)}
      {/* Vent */}
      <group position={[side * .72, -.21, -1.12]}>
        {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, -i * .014, 0]}><boxGeometry args={[.22, .004, .02]} /><meshStandardMaterial color="#344852" /></mesh>)}
      </group>
    </group>)}
    {[-1, 1].map(side => <React.Fragment key={side}>
      <NeonCurve material={neon} radius={.0035} points={[[side * .16, dashY(-1.27), -1.27], [side * .5, dashY(-1.2) - .01, -1.2], [side * .8, dashY(-1.05) - .06, -1.05], [side * 1.0, -.42, -.9]]} />
      <NeonCurve material={neon} radius={.0025} points={[[side * .28, dashY(-.95), -.95], [side * .55, dashY(-.88) - .03, -.88], [side * .8, -.45, -.8]]} />
    </React.Fragment>)}
    {/* Steering yoke */}
    <group ref={wheel} position={[0, -.5, -.68]} rotation={[-.35, 0, 0]}>
      <mesh scale={[1.25, .8, 1]} material={carbonMat}><torusGeometry args={[.2, .025, 10, 48, Math.PI]} /></mesh>
      {strip(0, .16, .026, .26, 0, 0, .006)}
      <mesh position={[0, 0, 0]} material={carbonMat}><boxGeometry args={[.22, .1, .05]} /></mesh>
      <mesh position={[0, .015, .027]}><planeGeometry args={[.11, .045]} /><meshBasicMaterial color="#38dfe4" toneMapped={false} /></mesh>
      {[-1, 1].map(side => <group key={side} position={[side * .22, .02, .03]}>
        <mesh material={carbonMat}><boxGeometry args={[.06, .13, .04]} /></mesh>
        {[0, 1].map(i => <mesh key={i} position={[0, -.02 + i * .04, .022]}><boxGeometry args={[.03, .012, .006]} /><meshBasicMaterial color={i ? '#46e8ee' : '#8fb2bd'} toneMapped={false} /></mesh>)}
      </group>)}
    </group>
  </group>;
}

/** Height of the dashboard's sloped carbon top (camera-local) at depth z, plus a small lift. */
const dashY = (z: number) => -.33 + clamp((-.71 - z) / .59, 0, 1) * .196 + .006;
function NeonCurve({ points, radius, material }: { points: [number, number, number][]; radius: number; material: THREE.Material }) {
  const key = JSON.stringify(points);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 5, false), [key, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} />;
}
function RainGlass() {
  const drops = useMemo(() => { const r = seeded(49); return Array.from({ length: 75 }, (_, i) => ({ id: i, x: r() * 100, y: r() * 72, scale: 1 + r() * 3, delay: -r() * 10 })); }, []);
  return <div className="nd-droplets">{drops.map(d => <i key={d.id} style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.scale, height: d.scale * 1.8, animationDelay: `${d.delay}s` }} />)}</div>;
}
function CrackedGlass({ cracks }: { cracks: Crack[] }) {
  const paths = useMemo(() => cracks.map(c => {
    const rnd = seeded(c.seed), spokes: { x: number; y: number }[][] = [];
    for (let i = 0; i < 22; i++) {
      const angle = i * Math.PI * 2 / 22 + rnd() * .1, length = 40 + rnd() * 250;
      const points = [{ x: c.x * 10, y: c.y * 10 }];
      for (let k = 1; k <= 5; k++) { const t = k / 5; points.push({ x: c.x * 10 + Math.cos(angle) * length * t + (rnd() - .5) * 10 * t, y: c.y * 10 + Math.sin(angle) * length * t + (rnd() - .5) * 12 * t }); }
      spokes.push(points);
    }
    const segments: string[] = [];
    spokes.forEach((p, i) => { segments.push('M' + p.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join('L')); for (let ring = 1; ring < 4; ring++) { if (rnd() < .2) continue; const a = p[ring], b = spokes[(i + 1) % spokes.length][ring]; segments.push(`M${a.x},${a.y}L${(a.x + b.x) / 2 + (rnd() - .5) * 8},${(a.y + b.y) / 2}L${b.x},${b.y}`); } });
    return { seed: c.seed, d: segments.join(' '), x: c.x * 10, y: c.y * 10 };
  }), [cracks]);
  return <svg className="nd-cracks" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{paths.map(p => <g key={p.seed} className="nd-crack-impact"><path d={p.d} stroke="#062431" strokeWidth="3.5" opacity=".7" fill="none" /><path d={p.d} stroke="#a3f4f6" strokeWidth=".9" opacity=".7" fill="none" /><path d={p.d} stroke="white" strokeWidth=".35" opacity=".8" fill="none" transform="translate(.6 -.6)" /><circle cx={p.x} cy={p.y} r="8" fill="#0c2d37" /><circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#9befef" strokeWidth="1" /></g>)}</svg>;
}

const STYLES = `
.nd-root{--cyan:#80f5f5;--line:rgba(91,226,237,.42);--glass:rgba(6,19,29,.8);position:relative;width:100%;height:100dvh;min-height:560px;overflow:hidden;background:#071722;color:var(--cyan);font-family:'Arial Narrow',Arial,sans-serif;isolation:isolate;outline:none;color-scheme:dark;touch-action:pan-y}
.nd-root *{box-sizing:border-box}.nd-root button,.nd-root input{font:inherit}.nd-root button{color:inherit;cursor:pointer}.nd-root button:disabled{cursor:default}.nd-root button:focus-visible,.nd-root input:focus-visible{outline:2px solid white;outline-offset:5px}.nd-root canvas{display:block}.nd-vignette,.nd-glass{position:absolute;inset:0;pointer-events:none}.nd-vignette{background:radial-gradient(ellipse at 50% 48%,transparent 25%,rgba(0,7,13,.18) 65%,rgba(0,4,10,.65));box-shadow:inset 0 0 110px #0008}.nd-glass{z-index:2}.nd-hud{position:absolute;inset:0;z-index:3;pointer-events:none;padding:0 max(22px,env(safe-area-inset-left));font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.nd-hud button,.nd-hud input,.nd-hud label{pointer-events:auto}.nd-root .nd-panel{background:linear-gradient(145deg,rgba(18,37,49,.88),rgba(5,14,22,.82));border:1px solid var(--line);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:inset 0 1px 0 #ffffff22,0 0 0 3px #06121a66,0 13px 22px #0005;color:var(--cyan)}
.nd-top-cards{position:absolute;left:4.5%;right:4.5%;top:max(32px,env(safe-area-inset-top));display:flex;justify-content:space-between;gap:20px}.nd-score,.nd-speed{padding:18px 22px 14px;width:230px;border-radius:24px 44px 30px 32px;border-bottom:2px solid #64e6e9;box-shadow:0 10px 22px #21d6e52b,inset 0 1px 1px #ddffff22}.nd-speed{text-align:right;border-radius:44px 24px 32px 30px}.nd-label{font-weight:800;display:block;font-size:12px;letter-spacing:.06em}.nd-number{display:inline-block;font-family:Arial,sans-serif;font-weight:900;font-size:70px;line-height:1.05;letter-spacing:-.05em;text-shadow:0 0 20px #40e2e780;color:#9cfbfa}.nd-unit{font-size:14px;padding-left:8px}.nd-micro{font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.015em}.nd-xp-row{display:flex;align-items:center;gap:7px;font-size:10px;margin:7px 0 3px}.nd-xp-track{flex:1;height:8px;background:#183943;overflow:hidden;transform:skew(-20deg)}.nd-xp-track i{display:block;height:100%;background:repeating-linear-gradient(90deg,#7ff5f4 0 6px,transparent 6px 8px);box-shadow:0 0 12px cyan;transition:width .1s}.nd-speed-label{display:flex;justify-content:flex-end;align-items:center;gap:10px}.nd-speed-label i{width:40px;height:7px;background:repeating-linear-gradient(0deg,#78e7e9 0 1px,transparent 1px 3px);opacity:.6}.nd-root .nd-boost{background:none;border:0;border-top:1px solid #68bec341;width:100%;font-size:12px;font-weight:900;padding:9px 0 0;white-space:nowrap}.nd-boost:disabled{opacity:.65}
.nd-route{position:absolute;top:23%;left:50%;transform:translateX(-50%);width:max-content;max-width:93%;border:1px solid #819dac69;border-radius:50px;background:#041725cf;backdrop-filter:blur(12px);padding:10px 17px;font-size:10px;font-weight:700;letter-spacing:.16em;display:flex;align-items:center;gap:8px;text-align:center}.nd-route span:not(.nd-logo){display:inline}.nd-logo{width:17px;height:17px;flex-shrink:0}.nd-logo svg{width:100%;height:100%;stroke:currentColor;stroke-width:2;fill:none}
.nd-callout-slot{position:absolute;top:29%;right:7%;min-height:60px}.nd-callout{border:1px solid #7df8fa;border-right-color:#d5b166;border-radius:14px 5px 15px 5px;background:linear-gradient(110deg,#022631d9,#10212add);padding:12px 18px;box-shadow:0 0 17px #32e5eb42;animation:nd-note 2.8s ease both;transform:skew(-5deg);max-width:310px}.nd-callout b{display:block;font-size:clamp(15px,2vw,23px);font-family:Arial,sans-serif;font-weight:900;text-shadow:0 0 8px #64e1e65c}.nd-callout span{display:block;font-size:9px;font-weight:700;margin-top:4px}.nd-streak{position:absolute;left:9%;top:52%;padding:10px 13px;background:#092533d9;border:1px solid #bfa975;border-radius:13px;box-shadow:0 0 12px #ffe18138}.nd-streak b{font-size:16px;display:block}.nd-streak span{font-size:9px;display:block;margin-top:4px}.nd-streak b span{display:inline;font-size:16px}
.nd-throttle{position:absolute;right:4%;top:41%;height:34%;width:55px;padding:12px 8px;border-radius:14px;display:flex;flex-direction:column;align-items:center;font-size:9px;font-weight:700}.nd-throttle label{margin-bottom:9px}.nd-throttle-rail{position:relative;flex:1;width:8px;border:1px solid #294755;border-radius:9px;background:#112a36;margin-bottom:12px;box-shadow:0 0 0 5px #0c151d66}.nd-throttle-fill{position:absolute;bottom:0;width:100%;background:linear-gradient(#b2ffff,#25e3ee);border-radius:8px;box-shadow:0 0 12px #24e7ed}.nd-throttle input{position:absolute;inset:-3px -14px;width:34px;height:calc(100% + 6px);margin:0;background:transparent;writing-mode:vertical-lr;direction:rtl;appearance:none;-webkit-appearance:none;cursor:ns-resize;touch-action:none}.nd-throttle input::-webkit-slider-runnable-track{background:transparent;width:8px;height:100%}.nd-throttle input::-webkit-slider-thumb{appearance:none;width:30px;height:20px;border:2px solid #b4ffff;border-radius:7px;background:linear-gradient(#61f1f4,#16abb9);box-shadow:0 0 12px #39e5f6}.nd-throttle input::-moz-range-track{background:transparent}.nd-throttle input::-moz-range-thumb{width:28px;height:18px;border:2px solid #b4ffff;border-radius:7px;background:#3cdde8;box-shadow:0 0 12px #39e5f6}.nd-throttle>span{line-height:1.35}.nd-throttle b{font-size:12px}
.nd-burst-status{position:absolute;bottom:35%;left:50%;transform:translateX(-50%);border:1px solid #76ccd42f;border-radius:15px;background:#061924e6;padding:4px 13px;font-size:9px;font-weight:700;white-space:nowrap}.nd-cluster{position:absolute;bottom:12%;left:50%;transform:translateX(-50%);width:340px;max-width:62%}.nd-timer{width:max-content;margin:0 auto 12px;border-radius:22px;border:1px solid #aac7cb52;background:#061823e6;padding:5px 13px;font-size:12px;font-weight:700}.nd-integrity{padding:11px 14px 9px;border-radius:24px;text-align:center}.nd-integrity-row{display:flex;align-items:center;gap:8px;margin:7px 0;font-size:14px;white-space:nowrap}.nd-integrity-row svg{width:22px;height:22px;fill:none;stroke:#88fbf9;stroke-width:2.1;filter:drop-shadow(0 0 4px #57ebed);flex-shrink:0}.nd-health-track{flex:1;height:12px;border:1px solid #517b8869;background:#081c27;min-width:20px;padding:1px}.nd-health-track i{display:block;height:100%;background:linear-gradient(90deg,#25afba,#97fff9);box-shadow:0 0 8px #49e4e78c;transition:width .2s}.nd-damaged .nd-health-track i{background:linear-gradient(90deg,#168c9b,#88e3e9)}
.nd-shift{position:absolute;bottom:4.2%;width:145px;height:85px;border:0;background:linear-gradient(180deg,#132d3bdb,#041420f5);border-radius:24px;box-shadow:0 4px 0 #152a35,0 0 19px #0cb2cc3b;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none}.nd-left{left:4%}.nd-right{right:4%}.nd-shift span{display:flex;align-items:center;justify-content:center;font-size:31px;height:52px;border:2px solid #58e6ebc4;border-radius:18px;box-shadow:inset 0 0 8px #57e6e955,0 0 9px #57e6e96b;margin:3px 7px 7px;transform:perspective(120px) rotateX(20deg);text-shadow:0 0 10px #52e0ed}.nd-shift b{font-size:12px}.nd-shift:active{filter:brightness(1.4);transform:translateY(2px)}.nd-shift:disabled{opacity:.5}.nd-utility{position:absolute;bottom:max(6px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;white-space:nowrap;font-size:8px;color:#7eafba}.nd-root .nd-utility button{padding:4px 0;border:0;background:none;font-size:8px;letter-spacing:.08em}.nd-utility button:disabled{opacity:.45}.nd-utility span{letter-spacing:.02em}
.nd-droplets{position:absolute;inset:0}.nd-droplets i{position:absolute;background:linear-gradient(160deg,#ffffff99,#85a8b70a 40%,#ecffff44);border-radius:50% 50% 45% 45%;box-shadow:1px 1px 2px #000b;animation:nd-drip 14s linear infinite}.nd-cracks{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 0 2px #6be7ef44)}.nd-crack-impact{animation:nd-impact .25s ease-out both}.nd-modal-backdrop{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:#03131d78;backdrop-filter:blur(5px);padding:24px}.nd-modal{max-width:490px;width:100%;padding:34px;border-radius:26px;text-align:left}.nd-eyebrow{font-family:monospace;font-size:10px;letter-spacing:.2em;color:#9ecad2}.nd-modal h1{font-size:38px;line-height:1.07;letter-spacing:-.045em;margin:22px 0 18px;color:#bafff8;font-weight:900;font-style:oblique}.nd-modal h1 small{font-size:17px;display:inline-block;margin-left:8px;letter-spacing:0;color:#48c5d3}.nd-modal p{color:#aec5ce;font-size:14px;line-height:1.65;margin-bottom:24px}.nd-controls-legend{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:26px;font-size:11px;font-family:monospace;color:#d7eef2}.nd-controls-legend b{display:block;color:#648e9e;font-size:9px;margin-top:4px;letter-spacing:.12em}.nd-root .nd-start{display:flex;justify-content:space-between;width:100%;border:1px solid #54d8df;background:#0f5664;padding:16px 20px;border-radius:8px;letter-spacing:.08em;font-size:12px;font-weight:800;box-shadow:0 0 20px #13b6d022;margin-bottom:18px}.nd-modal>.nd-micro{color:#638e9c;font-family:monospace;text-align:center;font-size:9px}.nd-gpu-error{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:white;padding:30px;text-align:center;z-index:20;background:#0a1b28}.nd-youtube{position:absolute;left:0;bottom:0;width:200px;height:200px;opacity:0;pointer-events:none;border:0;z-index:-1}
@keyframes nd-note{0%{opacity:0;translate:0 8px}10%,85%{opacity:1;translate:0 0}100%{opacity:0}}@keyframes nd-impact{0%{opacity:0}35%{opacity:1;filter:brightness(4)}100%{opacity:1;filter:brightness(1)}}@keyframes nd-drip{0%,80%{translate:0 0;opacity:.7}100%{translate:2px 80px;opacity:0}}
@media(min-width:1000px) and (min-aspect-ratio:4/3){.nd-top-cards{left:3%;right:3%;top:26px}.nd-route{top:38px}.nd-score,.nd-speed{width:225px}.nd-callout-slot{top:26%;right:19%}.nd-throttle{right:3%;top:34%;height:38%}.nd-cluster{bottom:8%}.nd-burst-status{bottom:37%}.nd-shift{bottom:6%;width:180px;height:100px}.nd-shift span{height:61px}.nd-streak{top:49%;left:13%}}
@media(max-width:600px){.nd-top-cards{top:28px;left:5%;right:5%;gap:12px}.nd-score,.nd-speed{width:43%;padding:13px 14px 11px;border-radius:21px 32px 24px 26px}.nd-speed{border-radius:32px 21px 26px 24px}.nd-number{font-size:clamp(40px,10.8vw,63px)}.nd-unit{font-size:11px;padding-left:5px}.nd-label{font-size:10px}.nd-root .nd-boost{font-size:9px;padding-top:7px}.nd-micro{font-size:9px}.nd-xp-row{font-size:8px;gap:4px;margin:5px 0 2px}.nd-route{top:21.5%;font-size:8px;padding:8px 10px;letter-spacing:.075em;gap:4px;width:92%;justify-content:center}.nd-logo{width:13px;height:13px}.nd-callout-slot{top:28%;right:7%;max-width:66%}.nd-callout{padding:10px 13px}.nd-callout b{font-size:18px}.nd-callout span{font-size:8px}.nd-throttle{width:45px;right:4%;font-size:8px;top:42%;height:31%;padding:10px 6px}.nd-streak{left:8%;top:51%;padding:8px 10px}.nd-streak b{font-size:13px}.nd-streak span{font-size:8px}.nd-cluster{bottom:13.5%;width:330px;max-width:76%}.nd-integrity-row{font-size:12px;gap:6px}.nd-integrity{padding:10px 12px}.nd-integrity-row svg{width:19px}.nd-timer{font-size:10px;margin-bottom:10px}.nd-shift{width:108px;height:77px;bottom:4.8%}.nd-shift span{height:43px;font-size:25px}.nd-shift b{font-size:10px}.nd-burst-status{font-size:8px;bottom:34%}.nd-utility{font-size:7px;gap:10px}.nd-root .nd-utility button{font-size:7px}.nd-modal{padding:26px}.nd-modal h1{font-size:33px}.nd-controls-legend{font-size:10px}}
@media(max-width:400px){.nd-route{top:21%;font-size:7px}.nd-score,.nd-speed{padding:12px 11px}.nd-unit{font-size:10px}.nd-root .nd-boost{font-size:8px}.nd-modal h1{font-size:29px}.nd-cluster{max-width:80%}.nd-utility{gap:7px}}
@media(max-height:650px) and (min-aspect-ratio:1/1){.nd-root{min-height:360px}.nd-top-cards{top:15px;left:2%;right:2%}.nd-score,.nd-speed{width:170px;padding:10px 14px}.nd-number{font-size:43px}.nd-label{font-size:9px}.nd-unit{font-size:10px}.nd-root .nd-boost{font-size:9px}.nd-route{top:18px;max-width:calc(100% - 390px);font-size:8px;letter-spacing:.03em;line-height:1.5}.nd-logo{display:none}.nd-callout-slot{top:29%;right:17%}.nd-callout b{font-size:17px}.nd-callout{padding:9px 12px}.nd-throttle{top:36%;height:36%;width:43px}.nd-cluster{bottom:11%;width:280px}.nd-integrity{padding:8px 10px}.nd-integrity-row{font-size:11px;margin:4px 0}.nd-timer{margin-bottom:5px;font-size:10px}.nd-shift{width:115px;height:68px;bottom:7%}.nd-shift span{height:37px}.nd-burst-status{bottom:36%;font-size:8px}.nd-streak{top:53%;left:7%}.nd-modal{padding:22px;max-width:440px}.nd-modal h1{margin:12px 0;font-size:30px}.nd-modal p{margin-bottom:14px;font-size:12px}.nd-controls-legend{margin-bottom:14px;gap:7px}.nd-root .nd-start{padding:12px;margin-bottom:10px}}
@media(prefers-reduced-motion:reduce){.nd-callout,.nd-crack-impact,.nd-droplets i{animation:none}.nd-xp-track i,.nd-health-track i{transition:none}}
`;
