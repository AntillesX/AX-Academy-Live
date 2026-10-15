"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

type GateKind = "FOOD" | "MEDICAL" | "SOLAR" | "WATER";
type FlightMode = "glide" | "dive" | "parachute";
type Gate = { kind: GateKind; scored: boolean };
type Telemetry = { speed: number; altitude: number };
type BurstParticle = { position: THREE.Vector3; velocity: THREE.Vector3; age: number; life: number };
type Vec3Tuple = [number, number, number];

type GameSceneProps = {
  steering: MutableRefObject<THREE.Vector2>;
  mode: FlightMode;
  combo: number;
  burstId: number;
  burstOrigin: Vec3Tuple;
  onGate: (kind: GateKind, origin: Vec3Tuple) => void;
  onMiss: () => void;
  onTelemetry: (value: Telemetry) => void;
};

const GATE_KINDS: GateKind[] = ["FOOD", "MEDICAL", "SOLAR", "WATER"];
const GATE_COLORS: Record<GateKind, string> = {
  FOOD: "#53f4c0",
  MEDICAL: "#ff6372",
  SOLAR: "#ffd447",
  WATER: "#48d9ff",
};

/** Exact torus-distance check along a swept sphere segment, refined around the closest sample. */
export function sweptSphereHitsTorus(
  start: THREE.Vector3,
  end: THREE.Vector3,
  majorRadius: number,
  tubeRadius: number,
  sphereRadius: number,
): boolean {
  const steps = 16;
  const distanceSquaredAt = (t: number) => {
    const x = THREE.MathUtils.lerp(start.x, end.x, t);
    const y = THREE.MathUtils.lerp(start.y, end.y, t);
    const z = THREE.MathUtils.lerp(start.z, end.z, t);
    const radialOffset = Math.hypot(x, y) - majorRadius;
    return radialOffset * radialOffset + z * z;
  };

  let bestT = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const distance = distanceSquaredAt(t);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestT = t;
    }
  }

  let low = Math.max(0, bestT - 1 / steps);
  let high = Math.min(1, bestT + 1 / steps);
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const left = low + (high - low) / 3;
    const right = high - (high - low) / 3;
    if (distanceSquaredAt(left) <= distanceSquaredAt(right)) high = right;
    else low = left;
  }
  bestDistance = Math.min(bestDistance, distanceSquaredAt((low + high) / 2));

  // A clean pass through the aperture is also a successful gate crossing.
  const dz = end.z - start.z;
  if (Math.abs(dz) > 1e-6) {
    const planeT = -start.z / dz;
    if (planeT >= 0 && planeT <= 1) {
      const x = THREE.MathUtils.lerp(start.x, end.x, planeT);
      const y = THREE.MathUtils.lerp(start.y, end.y, planeT);
      if (Math.hypot(x, y) <= majorRadius - sphereRadius) return true;
    }
  }

  const combinedRadius = tubeRadius + sphereRadius;
  return bestDistance <= combinedRadius * combinedRadius;
}

export function CaribSkydive() {
  const steering = useRef(new THREE.Vector2(0, 0));
  const heldKeys = useRef(new Set<string>());
  const activePointer = useRef<number | null>(null);
  const [mode, setMode] = useState<FlightMode>("glide");
  const [telemetry, setTelemetry] = useState<Telemetry>({ speed: 160, altitude: 12000 });
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lastGate, setLastGate] = useState<GateKind | null>(null);
  const [burst, setBurst] = useState<{ id: number; origin: Vec3Tuple }>({ id: 0, origin: [0, 0, 0] });
  const [runId, setRunId] = useState(0);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });

  const updateSteeringFromKeys = useCallback(() => {
    const keys = heldKeys.current;
    const x = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
    const y = Number(keys.has("arrowup") || keys.has("w")) - Number(keys.has("arrowdown") || keys.has("s"));
    steering.current.set(x, y);
    if (keys.has(" ")) setMode("dive");
    else if (keys.has("shift")) setMode("parachute");
    else setMode("glide");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "shift"].includes(event.key.toLowerCase())) event.preventDefault();
      heldKeys.current.add(event.key.toLowerCase());
      updateSteeringFromKeys();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      heldKeys.current.delete(event.key.toLowerCase());
      updateSteeringFromKeys();
    };
    const onBlur = () => {
      heldKeys.current.clear();
      steering.current.set(0, 0);
      setMode("glide");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [updateSteeringFromKeys]);

  const handleGate = useCallback((kind: GateKind, origin: Vec3Tuple) => {
    setScore((current) => current + 100);
    setCoins((current) => current + 25);
    setCombo((current) => {
      const next = current + 1;
      setBestCombo((best) => Math.max(best, next));
      return next;
    });
    setLastGate(kind);
    setBurst((current) => ({ id: current.id + 1, origin }));
  }, []);

  const handleMiss = useCallback(() => {
    setCombo(0);
    setLastGate(null);
  }, []);

  const handleTelemetry = useCallback((value: Telemetry) => setTelemetry(value), []);

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width * 0.36;
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    const x = THREE.MathUtils.clamp((dx * scale) / radius, -1, 1);
    const y = THREE.MathUtils.clamp((-dy * scale) / radius, -1, 1);
    steering.current.set(x, y);
    setJoystick({ x, y });
  };

  const beginJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystick(event);
  };

  const moveJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current === event.pointerId) updateJoystick(event);
  };

  const endJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    steering.current.set(0, 0);
    setJoystick({ x: 0, y: 0 });
  };

  const restart = () => {
    steering.current.set(0, 0);
    heldKeys.current.clear();
    setMode("glide");
    setScore(0);
    setCoins(0);
    setCombo(0);
    setBestCombo(0);
    setLastGate(null);
    setTelemetry({ speed: 160, altitude: 12000 });
    setBurst({ id: 0, origin: [0, 0, 0] });
    setRunId((value) => value + 1);
  };

  const holdMode = (nextMode: FlightMode) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setMode(nextMode);
  };
  const releaseMode = () => setMode("glide");

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pb-8 pt-24 sm:px-5 lg:px-8" aria-labelledby="skydive-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Caribbean altitude run · arcade flight</p>
          <h1 id="skydive-title" className="module-heading text-4xl md:text-6xl">Carib <span className="text-signal">Skydive</span></h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">Thread the island signal gates. Steer with the glass joystick, dive for speed, and deploy the chute to settle your line.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip"><span className="status-dot" /> LIVE FLIGHT</span>
          <button type="button" onClick={restart} className="quiet-button px-4 py-2 text-xs">Restart drop</button>
        </div>
      </div>

      <div className="relative h-[calc(100svh-12rem)] min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#06111b] shadow-[0_26px_100px_rgba(0,0,0,.45)]" aria-label="Carib Skydive 3D game viewport">
        <Canvas key={runId} dpr={[1, 1.5]} camera={{ position: [0, 1.1, 9.5], fov: 60, near: 0.1, far: 180 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <SkyScene
            steering={steering}
            mode={mode}
            combo={combo}
            burstId={burst.id}
            burstOrigin={burst.origin}
            onGate={handleGate}
            onMiss={handleMiss}
            onTelemetry={handleTelemetry}
          />
        </Canvas>

        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-3 top-3 flex flex-col gap-2 sm:left-5 sm:top-5">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 shadow-lg backdrop-blur-xl">
              <p className="telemetry">Altitude</p><p className="mt-1 font-mono text-2xl font-black tabular-nums text-white">{telemetry.altitude.toLocaleString()}<span className="ml-1 text-xs text-slate-400">m</span></p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 shadow-lg backdrop-blur-xl">
              <p className="telemetry">Velocity</p><p className="mt-1 font-mono text-xl font-black tabular-nums text-signal">{telemetry.speed}<span className="ml-1 text-xs text-slate-400">km/h</span></p>
            </div>
          </div>

          <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-right shadow-lg backdrop-blur-xl">
              <p className="telemetry">Signal score</p><p className="mt-1 font-mono text-2xl font-black tabular-nums text-white">{score.toLocaleString()}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-amber-300">{coins} island coins</p>
            </div>
            <div className="flex max-w-[12rem] flex-wrap justify-end gap-1.5 rounded-2xl border border-white/10 bg-slate-950/55 p-2 backdrop-blur-xl" aria-label="Signal gate legend">
              {GATE_KINDS.map((kind) => <span key={kind} className="rounded-full border px-2 py-1 text-[8px] font-black tracking-[.08em]" style={{ borderColor: `${GATE_COLORS[kind]}66`, color: GATE_COLORS[kind] }}>{kind}</span>)}
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 sm:bottom-6 sm:left-6 sm:right-6">
            <div
              className="relative h-32 w-32 touch-none select-none rounded-full border border-white/25 bg-slate-950/25 shadow-[inset_0_0_30px_rgba(0,242,254,.12)] backdrop-blur-md sm:h-36 sm:w-36"
              role="group"
              aria-label="Transparent joystick steering control"
              onPointerDown={beginJoystick}
              onPointerMove={moveJoystick}
              onPointerUp={endJoystick}
              onPointerCancel={endJoystick}
              onLostPointerCapture={endJoystick}
            >
              <span className="absolute inset-2 rounded-full border border-white/10" />
              <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35" />
              <span
                className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-signal/60 bg-signal/20 shadow-[0_0_25px_rgba(0,242,254,.25)] backdrop-blur-md"
                style={{ transform: `translate(calc(-50% + ${joystick.x * 28}px), calc(-50% - ${joystick.y * 28}px))` }}
              ><span className="h-2 w-2 rounded-full bg-signal" /></span>
              <span className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-black uppercase tracking-[.16em] text-white/55">Steer</span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-[9px] font-black uppercase tracking-[.15em] text-slate-200 backdrop-blur-xl">
                {lastGate ? <span style={{ color: GATE_COLORS[lastGate] }}>+100 · {lastGate} GATE</span> : "Thread all four signals"}
                <span className="ml-3 text-amber-300">COMBO {combo} / BEST {bestCombo}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-2xl border px-5 py-4 text-xs font-black uppercase tracking-[.13em] shadow-xl backdrop-blur-xl transition active:scale-95 ${mode === "dive" ? "border-signal bg-signal/25 text-signal" : "border-signal/35 bg-slate-950/55 text-white hover:bg-signal/15"}`}
                  onPointerDown={holdMode("dive")}
                  onPointerUp={releaseMode}
                  onPointerLeave={releaseMode}
                  onPointerCancel={releaseMode}
                  aria-label="Hold to dive and accelerate"
                >Dive <span className="ml-1 text-signal">↓</span></button>
                <button
                  type="button"
                  className={`rounded-2xl border px-5 py-4 text-xs font-black uppercase tracking-[.13em] shadow-xl backdrop-blur-xl transition active:scale-95 ${mode === "parachute" ? "border-amber-300 bg-amber-300/20 text-amber-200" : "border-white/20 bg-slate-950/55 text-white hover:border-amber-300/50"}`}
                  onPointerDown={holdMode("parachute")}
                  onPointerUp={releaseMode}
                  onPointerLeave={releaseMode}
                  onPointerCancel={releaseMode}
                  aria-label="Hold to deploy parachute and slow down"
                >Parachute <span className="ml-1 text-amber-300">◇</span></button>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/55 px-4 py-2 text-[9px] font-semibold text-slate-300 backdrop-blur-xl md:block">
            WASD / arrows steer · Space dive · Shift parachute
          </div>
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-slate-950/55 px-5 py-3 text-center text-xs font-black uppercase tracking-[.22em] text-white shadow-xl backdrop-blur-xl transition-opacity ${combo >= 5 ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            PRISM WAKE · COMBO {combo}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Dive to widen the lens · recover with the chute · combo five ignites the rainbow wake</p>
    </section>
  );
}

function SkyScene({ steering, mode, combo, burstId, burstOrigin, onGate, onMiss, onTelemetry }: GameSceneProps) {
  const { camera } = useThree();
  const perspectiveCamera = camera as THREE.PerspectiveCamera;
  const playerRef = useRef<THREE.Group>(null);
  const gateRefs = useRef<Array<THREE.Group | null>>([]);
  const flight = useRef({ x: 0, y: 0, previousX: 0, previousY: 0, speed: 20, altitude: 12000, hudTimer: 0 });
  const gates = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    kind: GATE_KINDS[index % GATE_KINDS.length],
    scored: false,
    x: Math.sin(index * 1.7) * 1.15,
    y: Math.cos(index * 1.31) * 0.9,
    z: -18 - index * 8.5,
  })), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.04);
    const current = flight.current;
    current.previousX = current.x;
    current.previousY = current.y;
    const targetSpeed = mode === "dive" ? 40 : mode === "parachute" ? 13 : 23;
    current.speed = THREE.MathUtils.damp(current.speed, targetSpeed, 1.8, dt);
    current.x = THREE.MathUtils.clamp(current.x + steering.current.x * dt * 3.2, -3.5, 3.5);
    current.y = THREE.MathUtils.clamp(current.y + steering.current.y * dt * 2.6, -2.3, 2.3);
    current.altitude -= current.speed * dt * 3;
    if (current.altitude <= 0) current.altitude = 12000;
    current.hudTimer += dt;

    const targetFov = mode === "dive" ? 90 : mode === "parachute" ? 60 : 68;
    perspectiveCamera.fov = THREE.MathUtils.damp(perspectiveCamera.fov, targetFov, 3.2, dt);
    perspectiveCamera.updateProjectionMatrix();
    const time = state.clock.elapsedTime;
    const wakeShake = mode === "dive" ? 0.035 + current.speed * 0.0012 : mode === "parachute" ? 0.004 : 0.01;
    camera.position.set(
      current.x * 0.12 + Math.sin(time * 39) * wakeShake,
      1.1 + current.y * 0.08 + Math.cos(time * 31) * wakeShake * 0.7,
      9.5,
    );
    camera.lookAt(current.x * 0.14, current.y * 0.16, -4.2);

    if (playerRef.current) {
      playerRef.current.position.set(current.x, current.y, 0);
      playerRef.current.rotation.z = -steering.current.x * 0.18;
      playerRef.current.rotation.x = mode === "dive" ? -0.26 : mode === "parachute" ? 0.12 : -0.06;
    }

    for (let index = 0; index < gates.length; index += 1) {
      const gate = gates[index];
      const ring = gateRefs.current[index];
      if (!ring) continue;
      const previousZ = ring.position.z;
      ring.position.z += current.speed * dt * 0.23;
      ring.rotation.z += dt * (0.25 + (index % 3) * 0.08);
      const start = new THREE.Vector3(current.previousX - ring.position.x, current.previousY - ring.position.y, -previousZ);
      const end = new THREE.Vector3(current.x - ring.position.x, current.y - ring.position.y, -ring.position.z);
      if (!gate.scored && sweptSphereHitsTorus(start, end, 1.42, 0.12, 0.3)) {
        gate.scored = true;
        onGate(gate.kind, [current.x, current.y, 0]);
      }
      if (ring.position.z > 1.8) {
        if (!gate.scored) onMiss();
        gate.scored = false;
        const resetOffset = time * 0.7 + index * 1.3;
        ring.position.set(Math.sin(resetOffset) * 1.2, Math.cos(resetOffset * 0.83) * 0.92, -125 - (index % 5) * 7.5);
      }
    }

    if (current.hudTimer >= 0.12) {
      current.hudTimer = 0;
      onTelemetry({ speed: Math.round(current.speed * 8), altitude: Math.round(current.altitude) });
    }
  });

  return (
    <>
      <color attach="background" args={["#07131d"]} />
      <fog attach="fog" args={["#07131d", 22, 120]} />
      <ambientLight intensity={1.4} color="#b9e9ff" />
      <directionalLight position={[3, 7, 9]} intensity={2.3} color="#d7f8ff" />
      <pointLight position={[-5, 2, -10]} intensity={24} distance={34} color="#00f2fe" />
      <pointLight position={[5, -4, -22]} intensity={18} distance={30} color="#53f4c0" />
      <CloudBank />
      <group ref={playerRef}>
        <mesh position={[0, 0, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.62, 5, 10]} />
          <meshStandardMaterial color="#eef8ff" metalness={0.22} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.54, 0.02]} castShadow>
          <sphereGeometry args={[0.21, 16, 12]} />
          <meshStandardMaterial color="#d89a72" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.58, 0.19]}>
          <sphereGeometry args={[0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          <meshStandardMaterial color="#00dce8" metalness={0.72} roughness={0.18} />
        </mesh>
        <mesh position={[0, -0.04, -0.25]} castShadow>
          <boxGeometry args={[0.43, 0.54, 0.24]} />
          <meshStandardMaterial color="#102f3e" emissive="#00a9bb" emissiveIntensity={0.38} metalness={0.52} roughness={0.3} />
        </mesh>
        <mesh position={[-0.39, 0.04, 0]} rotation={[0, 0, -0.75]}>
          <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
          <meshStandardMaterial color="#d9eff7" />
        </mesh>
        <mesh position={[0.39, 0.04, 0]} rotation={[0, 0, 0.75]}>
          <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
          <meshStandardMaterial color="#d9eff7" />
        </mesh>
        <mesh position={[-0.14, -0.56, 0]} rotation={[0, 0, -0.1]}>
          <capsuleGeometry args={[0.09, 0.43, 4, 8]} />
          <meshStandardMaterial color="#284c5c" />
        </mesh>
        <mesh position={[0.14, -0.56, 0]} rotation={[0, 0, 0.1]}>
          <capsuleGeometry args={[0.09, 0.43, 4, 8]} />
          <meshStandardMaterial color="#284c5c" />
        </mesh>
        <group visible={mode === "parachute"} position={[0, 1.15, -0.45]}>
          <mesh scale={[1.15, 0.43, 0.58]}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={0.45} side={THREE.DoubleSide} transparent opacity={0.82} />
          </mesh>
          {[-0.7, -0.25, 0.25, 0.7].map((x) => <mesh key={x} position={[x, -0.34, 0]} rotation={[0, 0, x * 0.25]}>
            <cylinderGeometry args={[0.012, 0.012, 0.95, 5]} />
            <meshBasicMaterial color="#d9fbff" />
          </mesh>)}
        </group>
      </group>

      {gates.map((gate, index) => (
        <group
          key={`gate-${index}`}
          ref={(node) => { gateRefs.current[index] = node; }}
          position={[gate.x, gate.y, gate.z]}
        >
          <mesh>
            <torusGeometry args={[1.42, 0.12, 14, 72]} />
            <meshStandardMaterial color={GATE_COLORS[gate.kind]} emissive={GATE_COLORS[gate.kind]} emissiveIntensity={0.85} metalness={0.42} roughness={0.2} />
          </mesh>
          <mesh scale={1.035}>
            <torusGeometry args={[1.42, 0.025, 8, 72]} />
            <meshBasicMaterial color={GATE_COLORS[gate.kind]} transparent opacity={0.62} />
          </mesh>
          <GateLabel kind={gate.kind} />
        </group>
      ))}
      <RainbowTrail active={combo >= 5} />
      <CoinBurst burstId={burstId} origin={burstOrigin} />
    </>
  );
}

function GateLabel({ kind }: { kind: GateKind }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 80;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "rgba(4, 14, 22, 0.88)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = GATE_COLORS[kind];
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.fillStyle = GATE_COLORS[kind];
    context.font = "900 34px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(kind, canvas.width / 2, canvas.height / 2 + 2);
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    setTexture(nextTexture);
    return () => nextTexture.dispose();
  }, [kind]);

  return texture ? <mesh position={[0, 1.76, 0.03]}>
    <planeGeometry args={[1.65, 0.42]} />
    <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
  </mesh> : null;
}

function CloudBank() {
  const clouds = useMemo(() => Array.from({ length: 14 }, (_, index) => ({
    x: Math.sin(index * 4.31) * 13,
    y: Math.cos(index * 2.17) * 9,
    z: -19 - index * 6.5,
    scale: 1.6 + (index % 4) * 0.62,
  })), []);
  return <group>
    {clouds.map((cloud, index) => <group key={`cloud-${index}`} position={[cloud.x, cloud.y, cloud.z]} scale={cloud.scale}>
      <mesh position={[-0.5, 0, 0]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#91ddec" transparent opacity={0.07} depthWrite={false} /></mesh>
      <mesh position={[0.35, 0.16, 0.12]} scale={[1.2, 0.8, 0.8]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#b7f6ff" transparent opacity={0.075} depthWrite={false} /></mesh>
      <mesh position={[1.05, -0.06, -0.08]} scale={[0.8, 0.65, 0.75]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#73c9dc" transparent opacity={0.06} depthWrite={false} /></mesh>
    </group>)}
  </group>;
}

function RainbowTrail({ active }: { active: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <mesh position={[0, 0, -1.55]} visible={active}>
    <planeGeometry args={[0.95, 3.4, 1, 32]} />
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      vertexShader={`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float phase = vUv.y * 6.28318 + uTime * 1.5;
          vec3 color = 0.5 + 0.5 * cos(phase + vec3(0.0, 2.1, 4.2));
          float edge = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
          float tail = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
          gl_FragColor = vec4(color, edge * tail * 0.9);
        }
      `}
    />
  </mesh>;
}

function CoinBurst({ burstId, origin }: { burstId: number; origin: Vec3Tuple }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<BurstParticle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.OctahedronGeometry(0.085, 0), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd447", emissive: "#f6a800", emissiveIntensity: 0.7, metalness: 0.82, roughness: 0.18 }), []);
  const count = 36;

  useEffect(() => {
    if (burstId === 0) return;
    particles.current = Array.from({ length: count }, () => ({
      position: new THREE.Vector3(origin[0], origin[1], origin[2]),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 6 + 1, (Math.random() - 0.5) * 5),
      age: 0,
      life: 0.55 + Math.random() * 0.65,
    }));
  }, [burstId, origin]);

  useFrame((_, delta) => {
    const instance = mesh.current;
    if (!instance) return;
    const dt = Math.min(delta, 0.04);
    for (let index = 0; index < count; index += 1) {
      const particle = particles.current[index];
      if (particle && particle.age < particle.life) {
        particle.age += dt;
        particle.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 3.8 * dt;
        particle.velocity.multiplyScalar(1 - dt * 0.22);
        const scale = Math.max(0, 1 - particle.age / particle.life) * 0.8;
        dummy.position.copy(particle.position);
        dummy.rotation.set(particle.age * 8, particle.age * 5, particle.age * 6);
        dummy.scale.setScalar(scale);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}
