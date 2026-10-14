import type { ZoneId } from "./types";

/**
 * Island geometry. Pure and deterministic, shared by the economy (road arcs -> which trade routes a landslide can
 * block) and the renderer (tiles, zones, ring road). One 28x28 voxel grid; the island is a rounded square with a
 * wobbly coast. Layout, front to back on screen:
 *   centre: School / AX-Academy Hub        ring road ("racing track") loops the whole island at radius ~8.8
 *   inside the ring (5 equal sectors): Mountain (back), Carnival (right), Farm (front-right), Housing (front-left), Jungle (left)
 *   outside the ring (front): Market Port (front-right), Beach & Fishing Dock (front-left)
 */

export const N = 28;
export const C = 14;
export const P = 3; // superellipse exponent: rounded square
export const R_HUB = 2.8;
export const R_COAST_ZONES = 6.6; // beyond this radius, the front arcs belong to the port and beach
export const ROAD_GAP = 0.45; // ring road floats just off the coast, like the reference
export const ROAD_WIDTH = 1.25;
export const MOUNTAIN_ROAD_DEG = -140;
export const MOUNTAIN_ROAD_HALF = 24;

export type TileKind = "shallow" | "sand" | "grass" | "road" | "plaza" | "path";
export interface Tile { x: number; y: number; kind: TileKind; zone: ZoneId | null; z: number; deg: number; r: number }

export const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
export const superR = (dx: number, dy: number) => (Math.abs(dx) ** P + Math.abs(dy) ** P) ** (1 / P);
export const angleDeg = (dx: number, dy: number) => (Math.atan2(dy, dx) * 180) / Math.PI;

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const rad = (d: number) => (d * Math.PI) / 180;
export const coastR = (deg: number) => 9.0 + 0.7 * Math.cos(rad(deg - 60)) + 0.3 * Math.sin(rad(deg * 3) + 1) + 0.25 * Math.sin(rad(deg * 5));
/** Radius of the ring road centre line at an angle: it follows the coast. */
export const roadR = (deg: number) => coastR(deg) + ROAD_GAP + ROAD_WIDTH / 2;

/** Sector centres inside the ring. Voronoi in angle, so each gets 72 degrees. */
export const SECTOR_CENTER: Partial<Record<ZoneId, number>> = { mountain: -140, jungle: -78, carnival: -18, farm: 105, housing: 165 };
/** Where each zone meets the ring road (used for convoys and route blocking). */
export const ZONE_ANCHOR_DEG: Record<ZoneId, number> = { hub: 45, housing: 165, farm: 112, beach: 88, port: 22, mountain: -140, jungle: -78, carnival: -18 };

export function ringPoint(deg: number, r = roadR(deg)) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const k = r / (Math.abs(c) ** P + Math.abs(s) ** P) ** (1 / P);
  return { x: C + k * c, y: C + k * s };
}

/** True if the shortest ring-road arc between two zones passes the mountain stretch. */
export function arcCrossesMountain(from: ZoneId, to: ZoneId): boolean {
  const a = ZONE_ANCHOR_DEG[from], d = wrapDeg(ZONE_ANCHOR_DEG[to] - a);
  const steps = Math.max(1, Math.ceil(Math.abs(d) / 4));
  for (let i = 0; i <= steps; i++) if (Math.abs(wrapDeg(a + (d * i) / steps - MOUNTAIN_ROAD_DEG)) <= MOUNTAIN_ROAD_HALF) return true;
  return from === "mountain" || to === "mountain";
}

function zoneFor(r: number, deg: number): ZoneId {
  if (r < R_HUB) return "hub";
  if (r >= R_COAST_ZONES) {
    if (deg > -8 && deg <= 62) return "port";
    if (deg > 62 && deg <= 140) return "beach";
  }
  let best: ZoneId = "farm", bd = 999;
  for (const [z, c] of Object.entries(SECTOR_CENTER) as [ZoneId, number][]) {
    const d = Math.abs(wrapDeg(deg - c));
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}

const M1 = { x: C + 5.0 * Math.cos(rad(-140)), y: C + 5.0 * Math.sin(rad(-140)) };
const M2 = { x: C + 5.4 * Math.cos(rad(-112)), y: C + 5.4 * Math.sin(rad(-112)) };
function mountainHeight(cx: number, cy: number, r: number, coast: number) {
  const p1 = Math.max(0, 1 - Math.hypot(cx - M1.x, cy - M1.y) / 5.0);
  const p2 = 0.75 * Math.max(0, 1 - Math.hypot(cx - M2.x, cy - M2.y) / 3.8);
  const taper = Math.min(1, Math.max(0, (coast - 0.6 - r) / 1.2));
  return Math.round(Math.pow(Math.max(p1, p2), 1.05) * 8 * taper);
}

export const LAND_Z = 2;
let cache: { tiles: Tile[]; at: Map<number, Tile> } | null = null;

export function buildTiles() {
  if (cache) return cache;
  const tiles: Tile[] = [], at = new Map<number, Tile>();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = x + 0.5, cy = y + 0.5, dx = cx - C, dy = cy - C;
    const r = superR(dx, dy), deg = angleDeg(dx, dy), coast = coastR(deg);
    const roadOuter = coast + ROAD_GAP + ROAD_WIDTH;
    if (r > roadOuter + 1.0) continue;
    let t: Tile;
    if (r > roadOuter) t = { x, y, kind: "shallow", zone: null, z: 0, deg, r };
    else if (r >= coast + ROAD_GAP) t = { x, y, kind: "road", zone: null, z: LAND_Z - 0.4, deg, r };
    else if (r > coast) t = { x, y, kind: "shallow", zone: null, z: 0, deg, r };
    else {
      const zone = zoneFor(r, deg);
      const lateral = (d0: number) => Math.abs(wrapDeg(deg - d0)) * (Math.PI / 180) * r;
      const ringPath = r >= R_HUB + 0.35 && r < R_HUB + 1.15;
      const spoke = r >= R_HUB && r < coast - 1.6 && (lateral(45) < 0.55 || Object.values(ZONE_ANCHOR_DEG).some((a0) => lateral(a0) < 0.42));
      if (r < R_HUB) t = { x, y, kind: "plaza", zone: "hub", z: LAND_Z + 1, deg, r };
      else if (ringPath || spoke) t = { x, y, kind: "path", zone, z: LAND_Z, deg, r };
      else if (zone === "port") t = { x, y, kind: "plaza", zone, z: r > coast - 1.0 ? LAND_Z - 0.5 : LAND_Z, deg, r };
      else {
        let z = LAND_Z;
        if (zone === "mountain") z += mountainHeight(cx, cy, r, coast);
        else if (zone === "jungle" && hash2(x, y, 3) > 0.62) z += 1;
        else if (zone === "beach") z = r > coast - 1.2 ? LAND_Z - 1 : LAND_Z;
        t = { x, y, kind: zone === "beach" ? "sand" : "grass", zone, z, deg, r };
      }
    }
    tiles.push(t); at.set(y * N + x, t);
  }
  cache = { tiles, at };
  return cache;
}

export const tileAt = (x: number, y: number) => buildTiles().at.get(y * N + x);

export function zoneTiles(z: ZoneId) { return buildTiles().tiles.filter((t) => t.zone === z); }
export function zoneCentroid(z: ZoneId) {
  const ts = zoneTiles(z);
  const n = Math.max(1, ts.length);
  return { x: ts.reduce((a, t) => a + t.x + 0.5, 0) / n, y: ts.reduce((a, t) => a + t.y + 0.5, 0) / n, z: Math.max(0, ...ts.map((t) => t.z)) };
}
