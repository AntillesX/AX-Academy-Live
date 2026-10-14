import {
  AFTERMATH_TICKS, BLUEPRINTS, BUILDINGS, CARNIVAL_MIN_INTEGRITY, FOCUS_BONUS_MAX, GRADE, HAZARDS, HAZARD_GAP, HAZARD_ODDS, JUNGLE_BUFFER,
  ROUTE_RESERVE, RUN_CAPS, SEASONS, TICKS_PER_SEASON, createInitialState,
} from "./data";
import type { Action, ActiveHazard, GameEvent, GameState, HazardType, Season, Stock, WeatherPhase, Zone, ZoneId } from "./types";

/**
 * Deterministic simulation. Pure functions over GameState (cloned per call), so the same code runs in the browser for
 * play and on the server to replay {seed, focus, action log} before any XP/ANTX is awarded.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
const STORAGE_CAP = 400, ANTX_CAP = 50;
const HAZARD_TYPES = Object.keys(HAZARDS) as HazardType[];
const zoneOf = (s: GameState, id: ZoneId) => s.zones.find((z) => z.id === id)!;

function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const seasonFor = (tick: number): Season => SEASONS[Math.floor(tick / TICKS_PER_SEASON) % SEASONS.length];

function emit(s: GameState, out: GameEvent[], e: Omit<GameEvent, "id" | "tick">) {
  out.push({ id: ++s.eventSeq, tick: s.tick, ...e });
}

/** Grants XP/ANTX, clamped to the per-run caps. Returns what was actually granted. */
function award(s: GameState, xp: number, antx: number) {
  const gx = clamp(Math.floor(xp), 0, RUN_CAPS.xp - s.totals.xp);
  const ga = clamp(Math.floor(antx), 0, RUN_CAPS.antx - s.totals.antx);
  s.xp += gx; s.antx += ga; s.totals.xp += gx; s.totals.antx += ga;
  return { xp: gx, antx: ga };
}

/* ---------- zone parameters: everything the renderer and HUD read comes from here ---------- */

/** Share of damage removed for a hazard in a zone: buildings stack multiplicatively, plus the jungle buffer. Capped at 90%. */
export function mitigation(s: GameState, z: Zone, hazard: HazardType): number {
  let left = 1;
  for (const id of z.buildings) left *= 1 - (BY_ID[id]?.mitigates[hazard] ?? 0);
  if ((hazard === "flash_flood" || hazard === "landslide") && z.id !== "jungle") left *= 1 - JUNGLE_BUFFER * (zoneOf(s, "jungle").integrity / 100);
  return Math.min(0.9, 1 - left);
}

export const focusMultiplier = (focus: number) => 1 + FOCUS_BONUS_MAX * clamp((focus - 50) / 50, 0, 1);

export interface ZoneParams {
  productivity: number;
  parts: { integrity: number; power: number; energy: number; focus: number; festival: number };
  production: Partial<Stock>; // per tick, after productivity
  net: Partial<Stock>; // per tick, production minus consumption
  exposure: Record<HazardType, number>;
  mitigation: Record<HazardType, number>;
  /** Expected integrity points lost if this hazard hit now at intensity 0.7. */
  risk: Record<HazardType, number>;
  status: "ok" | "damaged" | "critical" | "outage";
}

export function zoneParams(s: GameState, z: Zone): ZoneParams {
  const parts = {
    integrity: clamp(z.integrity / 100, 0.25, 1),
    power: z.powered ? 1 : 0.5,
    energy: z.stock.energy >= (z.consumes.energy ?? 0) ? 1 : 0.7,
    focus: focusMultiplier(s.focus),
    festival: s.tick < s.festivalUntilTick ? 1.15 : 1,
  };
  const productivity = parts.integrity * parts.power * parts.energy * parts.focus * parts.festival;
  const base: Partial<Stock> = { ...z.produces };
  for (const b of z.buildings) for (const [k, v] of Object.entries(BY_ID[b]?.produces ?? {})) base[k as keyof Stock] = (base[k as keyof Stock] ?? 0) + (v as number);
  const production: Partial<Stock> = {}, net: Partial<Stock> = {};
  for (const [k, v] of Object.entries(base)) production[k as keyof Stock] = (v as number) * productivity;
  for (const k of new Set([...Object.keys(production), ...Object.keys(z.consumes)]) as Set<keyof Stock>) net[k] = (production[k] ?? 0) - (z.consumes[k] ?? 0);
  const exposure = {} as Record<HazardType, number>, mit = {} as Record<HazardType, number>, risk = {} as Record<HazardType, number>;
  for (const t of HAZARD_TYPES) {
    exposure[t] = HAZARDS[t].exposure[z.id]; mit[t] = mitigation(s, z, t);
    risk[t] = +(HAZARDS[t].baseDamage * 0.7 * exposure[t] * (1 - mit[t])).toFixed(1);
  }
  const status = !z.powered ? "outage" : z.integrity < 40 ? "critical" : z.integrity < 80 ? "damaged" : "ok";
  return { productivity, parts, production, net, exposure, mitigation: mit, risk, status };
}

/* ---------- hazards ---------- */

function startHazard(s: GameState, out: GameEvent[], type: HazardType) {
  const def = HAZARDS[type];
  const lo = type === "hurricane" && s.season === "hurricane" ? 0.55 : 0.4;
  const intensity = +(lo + rand(s) * (1 - lo)).toFixed(2);
  const h: ActiveHazard = {
    type, startedTick: s.tick, warnUntilTick: s.tick + def.warnTicks, endsTick: s.tick + def.warnTicks + def.durationTicks, intensity,
    targets: s.zones.filter((z) => def.exposure[z.id] > 0).map((z) => z.id), damageTaken: {}, rawDamage: {},
  };
  s.hazard = h; s.hazardsSeen += 1; s.aftermathUntilTick = 0;
  const cat = type === "hurricane" ? ` (Category ${clamp(Math.round(1 + intensity * 4), 1, 5)})` : "";
  emit(s, out, { kind: "warning", label: `${def.name} warning${cat}: prepare now!` });
}

function pickHazard(s: GameState): HazardType {
  const odds = HAZARD_ODDS[s.season];
  const entries = HAZARD_TYPES.filter((k) => odds[k] > 0);
  let r = rand(s) * entries.reduce((a, k) => a + odds[k], 0);
  for (const k of entries) { r -= odds[k]; if (r <= 0) return k; }
  return entries[entries.length - 1];
}

function scheduleNext(s: GameState) {
  const [lo, hi] = HAZARD_GAP[s.season];
  s.nextHazardTick = s.tick + Math.floor(lo + rand(s) * (hi - lo));
}

function finishHazard(s: GameState, out: GameEvent[]) {
  const h = s.hazard!;
  const def = HAZARDS[h.type];
  const rated = h.targets.filter((id) => def.exposure[id] >= GRADE.minExposure);
  const pop = (id: ZoneId) => zoneOf(s, id).population;
  const rawW = rated.reduce((a, id) => a + (h.rawDamage[id] ?? 0) * pop(id), 0);
  const takenW = rated.reduce((a, id) => a + (h.damageTaken[id] ?? 0) * pop(id), 0);
  const worst = rawW > 0 ? takenW / rawW : 0;
  const dmg = h.targets.map((id) => h.damageTaken[id] ?? 0);
  const avg = dmg.reduce((a, b) => a + b, 0) / Math.max(1, dmg.length);
  const grade = rated.length > 0 && worst <= GRADE.perfect ? "perfect" : worst <= GRADE.solid ? "solid" : "rough";
  if (grade !== "rough") s.hazardsPrepared += 1;
  if (grade === "perfect") {
    const bonus = Math.min(5, s.defenseStreak) * 20;
    s.defenseStreak += 1; s.totals.perfectDefenses += 1;
    const g = award(s, 100 + bonus, 8);
    emit(s, out, { kind: "defense", label: `Perfect Storm Defense x${s.defenseStreak}!`, ...g });
    if (s.defenseStreak % 3 === 0) {
      const carn = zoneOf(s, "carnival");
      if (carn.integrity >= CARNIVAL_MIN_INTEGRITY && carn.powered) {
        s.festivalUntilTick = s.tick + 80;
        const f = award(s, 150, 10);
        emit(s, out, { kind: "festival", zoneId: "carnival", label: "Carnival parade! Production +15%", ...f });
      } else emit(s, out, { kind: "info", zoneId: "carnival", label: "The parade route needs repairs before the carnival can start" });
    }
  } else if (grade === "solid") {
    const g = award(s, 60, 0);
    emit(s, out, { kind: "defense", label: `${def.name} weathered. Check the damage and rebuild.`, ...g });
  } else {
    s.defenseStreak = 0;
    const g = award(s, Math.max(0, Math.round(40 - avg * 2)), 0);
    emit(s, out, { kind: "defense", label: `${def.name} survived. Time to rebuild.`, ...g });
  }
  s.lastHazard = { type: h.type, endedTick: s.tick, intensity: h.intensity, grade };
  s.aftermathUntilTick = s.tick + AFTERMATH_TICKS;
  s.hazard = null;
  scheduleNext(s);
}

function applyHazardTick(s: GameState, out: GameEvent[]) {
  const h = s.hazard!;
  const def = HAZARDS[h.type];
  const first = s.tick === h.warnUntilTick + 1;
  for (const z of s.zones) {
    const exp = def.exposure[z.id];
    if (exp <= 0) continue;
    const raw = (def.baseDamage * h.intensity * exp) / def.durationTicks;
    const d = raw * (1 - mitigation(s, z, h.type));
    z.integrity = Math.max(5, z.integrity - d);
    h.damageTaken[z.id] = (h.damageTaken[z.id] ?? 0) + d;
    h.rawDamage[z.id] = (h.rawDamage[z.id] ?? 0) + raw;
    if (d > 0.01) z.lastDamagedTick = s.tick;
    if (first && def.causesOutage && exp >= 0.4 && !z.buildings.some((b) => BY_ID[b]?.keepsPower)) {
      z.powered = false; z.outageUntilTick = h.endsTick + 25;
      emit(s, out, { kind: "damage", zoneId: z.id, label: `Power out in ${z.name}` });
    }
  }
  if (first && def.blocksRoads) {
    const mtn = zoneOf(s, "mountain");
    if (rand(s) > mitigation(s, mtn, h.type)) {
      s.roadBlockedUntilTick = s.tick + 70;
      for (const r of s.routes) if (r.viaMountainRoad) r.blockedUntilTick = s.roadBlockedUntilTick;
      emit(s, out, { kind: "damage", zoneId: "mountain", label: "Mountain road blocked! Convoys are cut off" });
    } else emit(s, out, { kind: "info", zoneId: "mountain", label: "Drainage held: the road stayed open" });
  }
}

function weatherTarget(s: GameState): { phase: WeatherPhase; target: number } {
  const h = s.hazard;
  if (h) {
    if (s.tick <= h.warnUntilTick) {
      const p = (s.tick - h.startedTick) / Math.max(1, h.warnUntilTick - h.startedTick);
      return { phase: "warning", target: h.type === "coastal_erosion" ? 0.12 : 0.15 + 0.45 * p };
    }
    if (h.type === "hurricane") return { phase: "hurricane", target: 0.6 + 0.4 * h.intensity };
    if (h.type === "coastal_erosion") return { phase: "storm", target: 0.3 };
    return { phase: "storm", target: 0.5 + 0.3 * h.intensity };
  }
  if (s.tick < s.aftermathUntilTick) return { phase: "aftermath", target: 0.3 * ((s.aftermathUntilTick - s.tick) / AFTERMATH_TICKS) };
  return { phase: "clear", target: 0 };
}

/* ---------- tick ---------- */

export function step(prev: GameState): { state: GameState; events: GameEvent[] } {
  const s = structuredClone(prev);
  const out: GameEvent[] = [];
  s.tick += 1;

  const season = seasonFor(s.tick);
  if (season !== s.season) {
    s.season = season;
    emit(s, out, { kind: "info", label: season === "hurricane" ? "Hurricane season begins. Prepare the island!" : `Season: ${season.replace("_", " ")}` });
  }

  if (!s.hazard && s.tick >= s.nextHazardTick) startHazard(s, out, pickHazard(s));
  if (s.hazard && s.tick > s.hazard.warnUntilTick) applyHazardTick(s, out);
  if (s.hazard && s.tick >= s.hazard.endsTick) finishHazard(s, out);

  const wt = weatherTarget(s);
  s.weather.intensity += (wt.target - s.weather.intensity) * 0.08;
  s.weather.phase = wt.phase;
  s.weather.windDir += (rand(s) - 0.5) * 0.02;

  s.zones.forEach((z, idx) => {
    if (!z.powered && s.tick >= z.outageUntilTick) z.powered = true;
    const p = zoneParams(s, z);
    for (const [k, v] of Object.entries(p.production)) z.stock[k as keyof Stock] += v as number;
    let short = false;
    for (const [k, v] of Object.entries(z.consumes)) {
      const key = k as keyof Stock;
      if (z.stock[key] >= (v as number)) z.stock[key] -= v as number;
      else { z.stock[key] = 0; if (key === "food" || key === "water") short = true; }
    }
    if (short) z.integrity = Math.max(5, z.integrity - 0.04);
    for (const k of Object.keys(z.stock) as (keyof Stock)[]) z.stock[k] = Math.min(z.stock[k], k === "antx" ? ANTX_CAP : STORAGE_CAP);

    if (z.stock.antx >= 1) {
      const whole = Math.floor(z.stock.antx); z.stock.antx -= whole;
      const g = award(s, 0, whole);
      if (g.antx > 0) emit(s, out, { kind: "resource", zoneId: z.id, label: `+${g.antx} ANTX`, antx: g.antx });
    }
    if ((s.tick + idx * 3) % 20 === 0) {
      const top = Object.entries(p.production).filter(([k]) => k !== "antx").sort((a, b) => (b[1] as number) - (a[1] as number))[0];
      if (top) emit(s, out, { kind: "resource", zoneId: z.id, label: `+${Math.round((top[1] as number) * 20)} ${top[0]}` });
    }
  });

  s.routes.forEach((r, idx) => {
    if (!r.enabled || (s.tick + idx) % r.everyTicks !== 0) return;
    if (r.viaMountainRoad && s.tick < r.blockedUntilTick) return;
    const a = zoneOf(s, r.from), b = zoneOf(s, r.to);
    const mult = r.seasonal?.[s.season] ?? 1;
    const back = r.get ? { resource: r.get.resource, amount: Math.round(r.get.amount * mult) } : null;
    if (a.stock[r.give.resource] < r.give.amount + ROUTE_RESERVE || b.stock[r.give.resource] + r.give.amount > STORAGE_CAP) return;
    if (back && b.stock[back.resource] < back.amount + ROUTE_RESERVE) return;
    a.stock[r.give.resource] -= r.give.amount; b.stock[r.give.resource] += r.give.amount;
    if (back) { b.stock[back.resource] -= back.amount; a.stock[back.resource] += back.amount; }
    // Convoys pay no XP: passive loops must not be farmable.
    emit(s, out, { kind: "trade", zoneId: a.id, toZoneId: b.id, label: `${r.give.resource} to ${b.name}` });
  });

  for (const z of s.zones) z.cutOff = z.id === "mountain" && s.tick < s.roadBlockedUntilTick;
  s.resilience = Math.round(s.zones.reduce((a, z) => a + z.integrity, 0) / s.zones.length);
  return { state: s, events: out };
}

export function applyAction(prev: GameState, a: Action): { state: GameState; events: GameEvent[]; error?: string } {
  const s = structuredClone(prev);
  const out: GameEvent[] = [];
  const fail = (error: string) => ({ state: prev, events: [], error });

  switch (a.type) {
    case "unlock": {
      const bp = BLUEPRINTS.find((b) => b.id === a.blueprintId);
      if (!bp) return fail("unknown_blueprint");
      if (s.blueprints.includes(bp.id)) return fail("already_unlocked");
      if (s.antx < bp.cost) return fail("not_enough_antx");
      s.antx -= bp.cost; s.blueprints.push(bp.id);
      emit(s, out, { kind: "info", label: `Blueprint unlocked: ${bp.name}` });
      break;
    }
    case "build": {
      const z = s.zones.find((x) => x.id === a.zoneId), def = BY_ID[a.buildingId];
      if (!z || !def) return fail("unknown_target");
      if (def.zones && !def.zones.includes(z.id)) return fail("not_allowed_here");
      if (z.buildings.includes(def.id)) return fail("already_built");
      if (def.requires?.some((r) => !s.blueprints.includes(r))) return fail("blueprint_locked");
      for (const [k, v] of Object.entries(def.cost)) if (z.stock[k as keyof Stock] < (v as number)) return fail("not_enough_" + k);
      for (const [k, v] of Object.entries(def.cost)) z.stock[k as keyof Stock] -= v as number;
      z.buildings.push(def.id); z.integrity = Math.min(100, z.integrity + 5);
      if (s.hazard && s.tick <= s.hazard.warnUntilTick && (def.mitigates[s.hazard.type] ?? 0) > 0) {
        const g = award(s, 25, 0); emit(s, out, { kind: "defense", zoneId: z.id, label: `Prepared in time: ${def.name}`, ...g });
      } else if (z.lastDamagedTick !== null && s.tick - z.lastDamagedTick < 60) {
        s.totals.rebuilds += 1; const g = award(s, 40, 0);
        emit(s, out, { kind: "rebuild", zoneId: z.id, label: `Built back stronger: ${def.name}`, ...g });
      } else emit(s, out, { kind: "info", zoneId: z.id, label: `${def.name} built` });
      break;
    }
    case "repair": {
      const z = s.zones.find((x) => x.id === a.zoneId);
      if (!z) return fail("unknown_target");
      if (z.integrity >= 100 && z.powered) return fail("nothing_to_repair");
      if (z.stock.materials < 12) return fail("not_enough_materials");
      z.stock.materials -= 12; z.integrity = Math.min(100, z.integrity + 20); z.powered = true; z.outageUntilTick = 0;
      const fast = z.lastDamagedTick !== null && s.tick - z.lastDamagedTick < 40;
      if (fast) s.totals.rebuilds += 1;
      const g = award(s, fast ? 25 : 5, 0);
      emit(s, out, { kind: "rebuild", zoneId: z.id, label: fast ? "Rapid response!" : "Repairs done", ...g });
      break;
    }
    case "toggleRoute": {
      const r = s.routes.find((x) => x.id === a.routeId);
      if (!r) return fail("unknown_route");
      r.enabled = !r.enabled;
      break;
    }
    case "drone": {
      if (s.antx < 25) return fail("not_enough_antx");
      if (s.tick < s.droneCooldownUntil) return fail("drone_cooldown");
      s.antx -= 25; s.droneCooldownUntil = s.tick + 60; s.roadBlockedUntilTick = 0;
      for (const r of s.routes) r.blockedUntilTick = 0;
      for (const z of s.zones) { z.powered = true; z.outageUntilTick = 0; }
      const worst = [...s.zones].sort((x, y) => x.integrity - y.integrity)[0];
      worst.integrity = Math.min(100, worst.integrity + 15);
      const g = award(s, 10, 0);
      emit(s, out, { kind: "drone", zoneId: worst.id, label: "Emergency drones deployed: roads and power restored", ...g });
      break;
    }
    case "forceHazard": {
      if (s.hazard) return fail("hazard_active");
      startHazard(s, out, a.hazard);
      break;
    }
  }
  return { state: s, events: out };
}

export interface LoggedAction { tick: number; action: Action }

/** Server-side verification: rebuild a run from {seed, focus, action log}. Compare the result to the client's claim. */
export function replay(seed: number, log: LoggedAction[], untilTick: number, focus = 92): GameState {
  // forceHazard is a demo-only action; a submitted run containing it is invalid, so it is dropped here
  // and the resulting state will not match a client that used it.
  log = log.filter((l) => l.action.type !== "forceHazard");
  let s = createInitialState(seed, focus);
  const sorted = [...log].sort((x, y) => x.tick - y.tick);
  let i = 0;
  while (s.tick < untilTick) {
    while (i < sorted.length && sorted[i].tick <= s.tick) { s = applyAction(s, sorted[i].action).state; i++; }
    s = step(s).state;
  }
  return s;
}
