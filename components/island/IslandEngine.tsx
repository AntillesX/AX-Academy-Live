"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLUEPRINTS, BUILDINGS, HAZARDS, ZONES, createInitialState } from "@/lib/island/data";
import { C, LAND_Z, ZONE_ANCHOR_DEG, buildTiles, coastR, hash2, ringPoint, roadR, tileAt, wrapDeg, zoneCentroid, zoneTiles, type Tile } from "@/lib/island/layout";
import { applyAction, step, zoneParams, type LoggedAction } from "@/lib/island/sim";
import { RESOURCES, ZONE_IDS, type Action, type GameEvent, type GameState, type HazardType, type ResourceId, type WeatherPhase, type ZoneId } from "@/lib/island/types";

/* =====================================================================================================================
 * ISLAND RESILIENCE 360: low-poly voxel engine (Canvas 2D, isometric, depth-sorted prisms).
 * Simulation -> renderer contract: every visual below reads GameState (integrity, power, buildings, weather, hazard).
 * ===================================================================================================================== */

const W = 1100, H = 840, TW = 54, TH = 27, VH = 13, OX = W / 2, OY = 118;
const sx = (x: number, y: number) => OX + ((x - y) * TW) / 2;
const sy = (x: number, y: number, z: number) => OY + ((x + y) * TH) / 2 - z * VH;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const RES_COLOR: Record<ResourceId, string> = { food: "#5cc85c", water: "#46b8f0", energy: "#ffd23f", materials: "#e08a3c", antx: "#ffb703" };
const RES_LABEL: Record<ResourceId, string> = { food: "Food", energy: "Energy", water: "Water", materials: "Materials", antx: "ANTX" };

/* ---------- colour helpers ---------- */
const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
const shadeCache = new Map<string, string>();
function shade(hex: string, k: number) {
  const key = hex + k;
  let v = shadeCache.get(key);
  if (!v) { const [r, g, b] = hexRgb(hex); v = toHex(r * k, g * k, b * k); shadeCache.set(key, v); }
  return v;
}
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexRgb(a), [r2, g2, b2] = hexRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/* ---------- frame (everything the renderer reads from the simulation) ---------- */
interface F {
  g: CanvasRenderingContext2D; t: number;
  dmg: Record<ZoneId, number>; pow: Record<ZoneId, boolean>; built: Record<ZoneId, string[]>;
  hover: ZoneId | null; sel: ZoneId | null;
  ph: WeatherPhase; wi: number; sway: number; hz: HazardType | null;
  festival: boolean; blocked: boolean; reduced: boolean; flood: number; warn: boolean; roadZ: number;
  risk: Partial<Record<ZoneId, number>>; tick: number;
}

/* ---------- primitives ---------- */
function poly(g: CanvasRenderingContext2D, p: number[], fill: string, stroke?: string) {
  g.beginPath(); g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath(); g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}
const faces = (c: string) => [c, shade(c, 0.84), shade(c, 0.66)] as const;
function box(g: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number, c: string) {
  const f = faces(c), t = z + h;
  poly(g, [sx(x, y), sy(x, y, t), sx(x + w, y), sy(x + w, y, t), sx(x + w, y + d), sy(x + w, y + d, t), sx(x, y + d), sy(x, y + d, t)], f[0]);
  poly(g, [sx(x, y + d), sy(x, y + d, t), sx(x + w, y + d), sy(x + w, y + d, t), sx(x + w, y + d), sy(x + w, y + d, z), sx(x, y + d), sy(x, y + d, z)], f[1]);
  poly(g, [sx(x + w, y), sy(x + w, y, t), sx(x + w, y + d), sy(x + w, y + d, t), sx(x + w, y + d), sy(x + w, y + d, z), sx(x + w, y), sy(x + w, y, z)], f[2]);
}
/** A flat rectangle painted on a box face. side L = the y+d face, R = the x+w face. u in 0..1 across the face, v in voxel units. */
function facePoly(g: CanvasRenderingContext2D, side: "L" | "R", x: number, y: number, z: number, w: number, d: number, u0: number, v0: number, u1: number, v1: number, c: string) {
  if (side === "L") { const Y = y + d; poly(g, [sx(x + u0 * w, Y), sy(x + u0 * w, Y, z + v1), sx(x + u1 * w, Y), sy(x + u1 * w, Y, z + v1), sx(x + u1 * w, Y), sy(x + u1 * w, Y, z + v0), sx(x + u0 * w, Y), sy(x + u0 * w, Y, z + v0)], c); }
  else { const X = x + w; poly(g, [sx(X, y + u0 * d), sy(X, y + u0 * d, z + v1), sx(X, y + u1 * d), sy(X, y + u1 * d, z + v1), sx(X, y + u1 * d), sy(X, y + u1 * d, z + v0), sx(X, y + u0 * d), sy(X, y + u0 * d, z + v0)], c); }
}
function faceText(g: CanvasRenderingContext2D, txt: string, x: number, y: number, z: number, w: number, d: number, h: number, side: "L" | "R", color: string) {
  g.save();
  if (side === "L") g.transform(TW / 200, TH / 200, 0, VH / 100, sx(x, y + d), sy(x, y + d, z + h));
  else g.transform(-TW / 200, TH / 200, 0, VH / 100, sx(x + w, y), sy(x + w, y, z + h));
  g.font = "800 17px system-ui, sans-serif"; g.textAlign = "center"; g.fillStyle = color;
  g.fillText(txt, ((side === "L" ? w : d) * 100) / 2, h * 100 * 0.7);
  g.restore();
}
function pyramid(g: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number, c1: string, c2: string) {
  const ax = sx(x + w / 2, y + d / 2), ay = sy(x + w / 2, y + d / 2, z + h);
  const strip = (ax0: number, ay0: number, ax1: number, ay1: number, shadeK: number) => {
    for (let i = 0; i < 4; i++) {
      const a = i / 4, b = (i + 1) / 4;
      poly(g, [ax0 + (ax1 - ax0) * a, ay0 + (ay1 - ay0) * a, ax0 + (ax1 - ax0) * b, ay0 + (ay1 - ay0) * b, ax, ay], shade(i % 2 ? c2 : c1, shadeK));
    }
  };
  strip(sx(x, y + d), sy(x, y + d, z), sx(x + w, y + d), sy(x + w, y + d, z), 0.9);
  strip(sx(x + w, y + d), sy(x + w, y + d, z), sx(x + w, y), sy(x + w, y, z), 0.7);
}
function person(g: CanvasRenderingContext2D, x: number, y: number, z: number, shirt: string, t: number, wave = false, vest = false) {
  const b = Math.sin(t * 3 + x * 5) * 0.03;
  box(g, x - 0.07, y - 0.04, z, 0.06, 0.08, 0.28, "#2b3a55"); box(g, x + 0.02, y - 0.04, z, 0.06, 0.08, 0.28, "#2b3a55");
  box(g, x - 0.1, y - 0.07, z + 0.28, 0.22, 0.14, 0.3 + b, vest ? "#e8f03a" : shirt);
  if (wave) box(g, x + 0.12, y - 0.04, z + 0.42 + Math.abs(Math.sin(t * 6)) * 0.2, 0.06, 0.06, 0.22, "#f1c8a0");
  box(g, x - 0.08, y - 0.06, z + 0.58 + b, 0.18, 0.18, 0.18, "#f1c8a0");
  box(g, x - 0.09, y - 0.07, z + 0.7 + b, 0.2, 0.2, 0.08, vest ? "#f5c518" : "#5b3b24");
}

/* ---------- scene ---------- */
interface Item { k: number; z: number; zone: ZoneId | null; draw: (f: F) => void; pick?: [number, number, number, number, number, number]; tile?: Tile }
interface Scene { items: Item[]; edges: Map<Tile, number> }
let SCENE: Scene | null = null;
const zAt = (x: number, y: number) => tileAt(Math.floor(x), Math.floor(y))?.z ?? 0;

const ZONE_BASE: Record<string, string> = { grass: "#7ccb52", jungle: "#3f9d46", housing: "#88d35a", sand: "#f2d89b", carnivalLane: "#ea74d8", path: "#c9a56d", asphalt: "#5a6170", hub: "#d6dce4", port: "#9ba3ae" };
const POND = { x: C + 3.9 * Math.cos((-100 * Math.PI) / 180) * 1.0, y: C + 3.9 * Math.sin((-100 * Math.PI) / 180) * 1.0 };
const START_DEG = 31;
function tileColor(t: Tile): string {
  const h = hash2(t.x, t.y, 1), v = 0.95 + h * 0.08;
  if (t.kind === "road") {
    if (Math.abs(t.deg - START_DEG) < 2.2) return (t.x + t.y) % 2 ? "#f4f4f4" : "#25272d";
    return shade(ZONE_BASE.asphalt, v);
  }
  if (t.kind === "path") return shade(ZONE_BASE.path, v);
  if (t.kind === "plaza") return t.zone === "port" ? ((t.x + t.y) % 2 ? "#9ba3ae" : "#929aa6") : (t.x + t.y) % 2 ? "#d6dce4" : "#cdd4de";
  if (t.kind === "sand") return shade(ZONE_BASE.sand, v);
  switch (t.zone) {
    case "mountain": { const e = t.z - LAND_Z; return e >= 5 ? "#e4d2b0" : e >= 3 ? "#c4a07f" : e >= 1 ? "#a9805c" : shade(ZONE_BASE.grass, v); }
    case "jungle":
      if (Math.hypot(t.x + 0.5 - POND.x, t.y + 0.5 - POND.y) < 0.8) return "#5ec0ea";
      return shade(ZONE_BASE.jungle, v);
    case "farm": return t.r > 4.1 ? ((t.y % 2) ? shade("#5fae3f", v) : shade("#8b5e3c", v)) : shade(ZONE_BASE.grass, v);
    case "carnival": return Math.abs(t.r - 5.4) < 0.55 && t.deg > -60 && t.deg < 28 ? ((t.x + t.y) % 2 ? "#ea74d8" : "#f59be6") : shade(ZONE_BASE.grass, v);
    case "housing": return shade(ZONE_BASE.housing, v);
    default: return shade(ZONE_BASE.grass, v);
  }
}

/* ---- trees ---- */
type TreeKind = "broad" | "palm" | "pine" | "jungle";
function drawTree(f: F, kind: TreeKind, x: number, y: number, z: number, rr: number, zone: ZoneId, big = 1) {
  const g = f.g, dm = f.dmg[zone], broken = rr < dm * 1.5, dead = rr < dm * 0.7, sw = f.sway * (0.5 + rr * 0.6) * (f.ph === "hurricane" ? 1.8 : 1);
  if (kind === "palm") {
    if (dead) { box(g, x - 0.5, y - 0.1, z, 1.3, 0.2, 0.2, "#8a5a35"); box(g, x + 0.7, y - 0.3, z, 0.5, 0.5, 0.18, "#3aa545"); return; }
    for (let i = 0; i < 4; i++) { g.save(); g.translate((sw * i) / 4 * (broken ? 2 : 1), 0); box(g, x - 0.1, y - 0.1, z + i * 0.4 * big, 0.2, 0.2, 0.42 * big, i % 2 ? "#a06a3a" : "#8a5a35"); g.restore(); }
    const px = sx(x, y) + (sw * (broken ? 2 : 1)), py = sy(x, y, z + 1.65 * big);
    const n = broken ? 4 : 7;
    for (let k = 0; k < n; k++) {
      const a = (k * Math.PI * 2) / n + rr * 3, len = 24 * big, droop = broken ? 16 : 6 + Math.sin(f.t * 2 + k) * (2 + f.wi * 4);
      const tx = px + Math.cos(a) * len, ty = py + Math.sin(a) * len * 0.5 + droop;
      poly(g, [px, py, px + Math.cos(a - 0.35) * len * 0.6, py + Math.sin(a - 0.35) * len * 0.3 - 3, tx, ty, px + Math.cos(a + 0.35) * len * 0.6, py + Math.sin(a + 0.35) * len * 0.3 + 3], k % 2 ? "#37a444" : "#2c8a3a");
    }
    box(g, x - 0.1, y - 0.1, z + 1.6 * big, 0.2, 0.2, 0.15, "#6b4423");
    return;
  }
  if (kind === "pine") {
    box(g, x - 0.1, y - 0.1, z, 0.2, 0.2, 0.35, "#7a4f2a");
    if (dead) { box(g, x, y - 0.1, z, 0.8, 0.2, 0.2, "#5a3a1f"); return; }
    g.save(); g.translate(sw * 0.7, 0);
    box(g, x - 0.45, y - 0.45, z + 0.3, 0.9, 0.9, 0.45, "#2f7d3f"); box(g, x - 0.33, y - 0.33, z + 0.75, 0.66, 0.66, 0.4, "#348a45");
    if (!broken) box(g, x - 0.2, y - 0.2, z + 1.15, 0.4, 0.4, 0.4, "#3a984c");
    g.restore(); return;
  }
  const jun = kind === "jungle", s = big * (jun ? 1.35 : 1), c1 = jun ? "#2f8a3c" : "#46b04d", c2 = jun ? "#3aa447" : "#58c25a", c3 = jun ? "#47b955" : "#6dd06a";
  const th = (jun ? 1.3 : 0.9) * big;
  box(g, x - 0.13 * s, y - 0.13 * s, z, 0.26 * s, 0.26 * s, th, "#7d5230");
  if (dead) { box(g, x - 0.1, y - 0.1, z, 1.1, 0.24, 0.24, "#6b4423"); return; }
  g.save(); g.translate(sw * (broken ? 2 : 1), 0);
  box(g, x - 0.6 * s, y - 0.6 * s, z + th, 1.2 * s, 1.2 * s, 0.55 * s, c1);
  box(g, x - 0.45 * s, y - 0.45 * s, z + th + 0.55 * s, 0.9 * s, 0.9 * s, 0.5 * s, c2);
  if (!broken) box(g, x - 0.28 * s, y - 0.28 * s, z + th + 1.05 * s, 0.56 * s, 0.56 * s, 0.4 * s, c3);
  g.restore();
}

/* ---- houses ---- */
function drawHouse(f: F, x: number, y: number, z: number, wall: string, roof: string, rr: number) {
  const g = f.g, dm = f.dmg.housing, dead = rr < dm * 0.7, broken = rr < dm * 1.5, lit = f.pow.housing, b = f.built.housing;
  const w = 1.7, d = 1.4, hh = dead ? 0.45 : 1.05, concrete = b.includes("concrete_roofs"), shutters = b.includes("storm_shutters");
  box(g, x, y, z, w, d, hh, wall);
  if (!dead) {
    const rc = concrete ? "#9aabbd" : roof;
    box(g, x - 0.12, y - 0.12, z + hh, w + 0.24, d + 0.24, 0.32, rc);
    if (broken && rr < dm * 1.0) {
      poly(g, [sx(x + 0.5, y + 0.4), sy(x + 0.5, y + 0.4, z + hh + 0.32), sx(x + 1.2, y + 0.4), sy(x + 1.2, y + 0.4, z + hh + 0.32), sx(x + 1.2, y + 1.0), sy(x + 1.2, y + 1.0, z + hh + 0.32), sx(x + 0.5, y + 1.0), sy(x + 0.5, y + 1.0, z + hh + 0.32)], "#3b82c4");
    } else box(g, x + 0.25, y + 0.2, z + hh + 0.32, w - 0.5, d - 0.4, 0.3, shade(rc, 1.08));
    if (b.includes("solar_microgrid") && !broken) box(g, x + 0.4, y + 0.3, z + hh + 0.62, 0.8, 0.55, 0.06, "#1f3a7a");
    const wc = lit ? "#fff0b0" : "#3d4d63";
    for (const [u0, u1] of [[0.14, 0.38], [0.62, 0.86]]) {
      facePoly(g, "L", x, y, z, w, d, u0, 0.35, u1, 0.8, wc);
      if (shutters) { facePoly(g, "L", x, y, z, w, d, u0 - 0.06, 0.35, u0, 0.8, "#2f6fb0"); facePoly(g, "L", x, y, z, w, d, u1, 0.35, u1 + 0.06, 0.8, "#2f6fb0"); }
    }
    facePoly(g, "L", x, y, z, w, d, 0.44, 0, 0.56, 0.62, "#7a4a2a");
    facePoly(g, "R", x, y, z, w, d, 0.3, 0.35, 0.6, 0.8, wc);
    if (dm > 0.25 && rr < dm * 2) { g.strokeStyle = "rgba(40,30,20,.7)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx(x + 0.2, y + d), sy(x + 0.2, y + d, z + 0.95)); g.lineTo(sx(x + 0.34, y + d), sy(x + 0.34, y + d, z + 0.6)); g.lineTo(sx(x + 0.26, y + d), sy(x + 0.26, y + d, z + 0.3)); g.stroke(); }
  } else {
    for (let i = 0; i < 4; i++) box(g, x + 0.2 + i * 0.35, y + 0.3 + (i % 2) * 0.5, z + hh, 0.3, 0.3, 0.15 + (i % 3) * 0.1, i % 2 ? "#a07a5a" : "#8a8f98");
  }
  for (let i = 0; i < 6; i++) { box(g, x - 0.15 + i * 0.36, y + d + 0.4, z, 0.07, 0.07, 0.3, "#ffffff"); }
  box(g, x - 0.15, y + d + 0.4, z + 0.18, 2.1, 0.04, 0.05, "#ffffff");
}

/* ---- hub (school) ---- */
function drawHub(f: F, x: number, y: number, z: number) {
  const g = f.g, dm = f.dmg.hub, b = f.built.hub, lit = f.pow.hub, w = 4.2, d = 2.6, concrete = b.includes("concrete_roofs"), rc = concrete ? "#8fa3b8" : "#3b6fd4";
  box(g, x, y, z, w, d, 1.6, "#f2e4c4");
  box(g, x - 0.1, y - 0.1, z + 1.6, w + 0.2, d + 0.2, 0.35, rc);
  box(g, x + 0.5, y + 0.35, z + 1.95, w - 1.0, d - 0.7, 0.35, shade(rc, 1.1));
  if (dm > 0.5) poly(g, [sx(x + 1.2, y + 0.7), sy(x + 1.2, y + 0.7, z + 2.3), sx(x + 2.2, y + 0.7), sy(x + 2.2, y + 0.7, z + 2.3), sx(x + 2.2, y + 1.4), sy(x + 2.2, y + 1.4, z + 2.3), sx(x + 1.2, y + 1.4), sy(x + 1.2, y + 1.4, z + 2.3)], "#3b82c4");
  const tx = x + w / 2 - 0.6, ty = y + d / 2 - 0.6;
  box(g, tx, ty, z + 2.3, 1.2, 1.2, 1.1, "#f2e4c4"); box(g, tx - 0.15, ty - 0.15, z + 3.4, 1.5, 1.5, 0.4, rc); box(g, tx + 0.45, ty + 0.45, z + 3.8, 0.3, 0.3, 0.5, "#e9edf3");
  const wc = lit ? "#fff0b0" : "#3d4d63";
  for (let i = 0; i < 5; i++) { facePoly(g, "L", x, y, z, w, d, 0.07 + i * 0.19, 0.55, 0.07 + i * 0.19 + 0.1, 1.3, wc); if (b.includes("storm_shutters")) facePoly(g, "L", x, y, z, w, d, 0.07 + i * 0.19 - 0.025, 0.55, 0.07 + i * 0.19, 1.3, "#2f6fb0"); }
  for (let i = 0; i < 3; i++) facePoly(g, "R", x, y, z, w, d, 0.12 + i * 0.3, 0.55, 0.12 + i * 0.3 + 0.16, 1.3, wc);
  facePoly(g, "L", x, y, z, w, d, 0.42, 0, 0.58, 0.9, "#7a4a2a");
  box(g, x + w * 0.38, y + d, z, w * 0.24, 0.45, 0.14, "#ffffff");
  for (let i = 0; i < 4; i++) box(g, x + w * 0.38 + i * 0.2, y + d + 0.1, z + 0.14, 0.1, 0.1, 1.45, "#ffffff");
  box(g, x + w * 0.36, y + d + 0.05, z + 1.6, w * 0.28, 0.2, 0.18, "#e8edf5");
  if (b.includes("solar_microgrid") && dm < 0.5) for (let i = 0; i < 3; i++) box(g, x + 0.7 + i * 0.85, y + 0.5, z + 2.3, 0.7, 0.5, 0.06, "#1f3a7a");
  if (f.warn) { const a = 0.35 + 0.35 * Math.sin(f.t * 8); g.fillStyle = `rgba(255,170,30,${a})`; g.beginPath(); g.arc(sx(tx + 0.6, ty + 0.6), sy(tx + 0.6, ty + 0.6, z + 4.4), 14, 0, 7); g.fill(); }
  if (dm > 0.3) { g.strokeStyle = "rgba(40,30,20,.7)"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(sx(x + 0.3, y + d), sy(x + 0.3, y + d, z + 1.5)); g.lineTo(sx(x + 0.5, y + d), sy(x + 0.5, y + d, z + 1.0)); g.lineTo(sx(x + 0.4, y + d), sy(x + 0.4, y + d, z + 0.5)); g.stroke(); }
}

/* ---- port ---- */
const CONT = ["#2fa7a8", "#e08a3c", "#8a5a3a", "#2f8fb0"];
function drawStack(f: F, x: number, y: number, z: number, seed: number) {
  const g = f.g, dm = f.dmg.port;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const lay = 1 + Math.floor(hash2(i + seed, j, 4) * 3), rr = hash2(i + seed, j, 5);
    for (let l = 0; l < lay; l++) {
      const gone = rr < dm * 0.9 && l === lay - 1 && dm > 0.2;
      const fall = rr < dm * 1.5 && dm > 0.2;
      const cx = x + i * 1.25 + (fall ? (rr - 0.5) * 0.5 : 0), cy = y + j * 0.62, zz = gone ? 0 : z + l * 0.5;
      const col = CONT[Math.floor(hash2(i + seed, j + l, 6) * CONT.length)];
      box(g, cx, cy, zz, 1.2, 0.55, 0.5, col);
      for (let r = 1; r < 5; r++) facePoly(g, "L", cx, cy, zz, 1.2, 0.55, r * 0.2 - 0.02, 0.04, r * 0.2 + 0.01, 0.46, shade(col, 0.75));
      if (j === 1 && hash2(i + seed, l, 7) > 0.35) faceText(g, "CARIB CARGO", cx, cy, zz, 1.2, 0.55, 0.5, "L", "#e8fbff");
    }
  }
}
function drawCrane(f: F, x: number, y: number, z: number) {
  const g = f.g, tr = 0.4 + 0.9 * (0.5 + 0.5 * Math.sin(f.t * 0.6 * (f.ph === "hurricane" ? 0 : 1))), c = f.dmg.port > 0.5 ? "#8a5a3a" : "#d9822b";
  box(g, x, y, z, 0.22, 0.22, 2.7, c); box(g, x + 2.0, y, z, 0.22, 0.22, 2.7, c); box(g, x, y + 1.0, z, 0.22, 0.22, 2.7, c); box(g, x + 2.0, y + 1.0, z, 0.22, 0.22, 2.7, c);
  box(g, x - 0.1, y, z + 2.7, 2.5, 1.22, 0.22, "#c9741f"); box(g, x + tr, y + 0.4, z + 2.4, 0.4, 0.4, 0.3, "#333b48");
  box(g, x + tr + 0.18, y + 0.58, z + 1.6, 0.04, 0.04, 0.8, "#222"); box(g, x + tr - 0.2, y + 0.4, z + 1.2, 0.8, 0.4, 0.4, "#2fa7a8");
}
function drawShip(f: F, x: number, y: number) {
  const g = f.g, bob = Math.sin(f.t * 1.3) * 0.06 * (1 + f.wi * 3);
  box(g, x, y, 0.15 + bob, 4.6, 1.4, 0.7, "#2d4a6b"); box(g, x, y, 0.85 + bob, 4.6, 1.4, 0.12, "#e9edf3");
  for (let i = 0; i < 3; i++) box(g, x + 0.3 + i * 1.05, y + 0.2, 0.97 + bob, 0.95, 0.5, 0.5, CONT[i]);
  box(g, x + 3.5, y + 0.2, 0.97 + bob, 0.9, 0.9, 1.0, "#f2f4f7"); box(g, x + 3.6, y + 0.3, 1.97 + bob, 0.7, 0.7, 0.3, "#d9822b");
}

/* ---- farm / beach / mountain / jungle / carnival extras ---- */
function drawBarn(f: F, x: number, y: number, z: number) {
  const g = f.g, dm = f.dmg.farm, rc = f.built.farm.includes("concrete_roofs") ? "#98a9bb" : "#7a4a2a";
  box(g, x, y, z, 2.0, 1.5, 1.0, "#b5432f");
  box(g, x - 0.1, y - 0.1, z + 1.0, 2.2, 1.7, 0.3, rc);
  if (dm < 0.55) box(g, x + 0.3, y + 0.25, z + 1.3, 1.4, 1.0, 0.3, shade(rc, 1.1));
  facePoly(g, "L", x, y, z, 2.0, 1.5, 0.3, 0, 0.7, 0.75, "#ead8bd");
  g.strokeStyle = "#b5432f"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx(x + 0.6, y + 1.5), sy(x + 0.6, y + 1.5, z)); g.lineTo(sx(x + 1.5, y + 1.5), sy(x + 1.5, y + 1.5, z + 0.75)); g.moveTo(sx(x + 1.5, y + 1.5), sy(x + 1.5, y + 1.5, z)); g.lineTo(sx(x + 0.6, y + 1.5), sy(x + 0.6, y + 1.5, z + 0.75)); g.stroke();
  box(g, x + 2.5, y + 0.3, z, 0.8, 0.8, 1.8, "#c7ccd4"); box(g, x + 2.4, y + 0.2, z + 1.8, 1.0, 1.0, 0.3, "#8d96a3");
}
function drawCow(f: F, x: number, y: number, z: number, rr: number, goat = false) {
  const g = f.g, calm = f.ph === "hurricane" || f.ph === "storm", ox = calm ? 0 : Math.sin(f.t * 0.4 + rr * 9) * 0.35;
  const c = goat ? "#c9a37a" : rr > 0.5 ? "#ffffff" : "#f0ece4";
  box(g, x + ox, y, z, 0.62, 0.32, 0.34, c); box(g, x + ox + 0.55, y + 0.02, z + 0.2, 0.22, 0.26, 0.26, c);
  if (!goat) box(g, x + ox + 0.15, y - 0.01, z + 0.12, 0.2, 0.34, 0.22, "#2b2b2b");
  box(g, x + ox + 0.04, y + 0.02, z - 0.0, 0.08, 0.08, 0.04, "#444");
}
function drawUmbrella(f: F, x: number, y: number, z: number, c1: string) {
  const g = f.g; box(g, x - 0.03, y - 0.03, z, 0.06, 0.06, 0.9, "#fff");
  pyramid(g, x - 0.55, y - 0.55, z + 0.9, 1.1, 1.1, 0.3, c1, "#ffffff");
}
function drawPier(f: F) {
  const g = f.g, dm = f.dmg.beach, x0 = C - 0.45, y0 = C + coastR(90) - 2.0, y1 = C + coastR(90) + 3.6;
  for (let y = y0; y < y1; y += 0.7) {
    const rr = hash2(Math.round(y * 10), 3, 11), missing = rr < dm * 0.9 && dm > 0.3;
    if (missing) continue;
    box(g, x0, y, 1.45, 0.95, 0.66, 0.12, Math.round((y - y0) / 0.7) % 2 ? "#a8743f" : "#9a6a38");
  }
  for (let y = y0 + 0.4; y < y1; y += 1.4) { box(g, x0 - 0.05, y, 0.1, 0.1, 0.1, 1.4, "#6b4423"); box(g, x0 + 0.9, y, 0.1, 0.1, 0.1, 1.4, "#6b4423"); }
}
function drawBoat(f: F, x: number, y: number, rr: number) {
  const g = f.g, dm = f.dmg.beach, sunk = rr < dm * 0.8 && dm > 0.35, bob = Math.sin(f.t * 1.6 + rr * 7) * 0.05 * (1 + f.wi * 4);
  box(g, x, y, (sunk ? -0.1 : 0.25) + bob, 1.1, 0.55, 0.3, "#8a5a35"); box(g, x + 0.1, y + 0.1, (sunk ? 0 : 0.5) + bob, 0.9, 0.35, 0.05, "#c4986a");
  if (!sunk) { box(g, x + 0.45, y + 0.2, 0.55 + bob, 0.18, 0.18, 0.18, "#3b82c4"); person(g, x + 0.25, y + 0.28, 0.55 + bob, "#3b82c4", f.t); }
}
function drawTent(f: F, x: number, y: number, z: number) {
  const g = f.g; pyramid(g, x, y, z, 1.2, 1.2, 0.9, "#e9d9a8", "#d9c58e"); facePoly(g, "L", x, y, z, 1.2, 1.2, 0.38, 0, 0.38, 0.45, "#6b4f2a");
}
function drawStage(f: F, x: number, y: number, z: number) {
  const g = f.g, dm = f.dmg.carnival, k = dm > 0.55 ? 0.6 : 1, cols = ["#ff6fb5", "#ffd23f", "#3fd0d4", "#a66bff"];
  box(g, x, y, z, 2.6, 1.8, 0.4, shade(cols[0], k)); box(g, x + 0.2, y + 0.2, z + 0.4, 2.2, 1.4, 0.4, shade(cols[1], k));
  box(g, x + 0.4, y + 0.35, z + 0.8, 1.8, 1.1, 0.4, shade(cols[2], k)); box(g, x + 0.7, y + 0.5, z + 1.2, 1.2, 0.8, 0.4, shade(cols[3], k));
  box(g, x + 1.1, y + 0.7, z + 1.6, 0.4, 0.4, 0.4, shade("#ff6fb5", k));
  box(g, x + 0.1, y + 1.8, z, 2.4, 0.4, 0.15, "#fff3c4");
}
function bunting(f: F, x1: number, y1: number, x2: number, y2: number, z: number, n = 10) {
  const g = f.g, a = [sx(x1, y1), sy(x1, y1, z)], b = [sx(x2, y2), sy(x2, y2, z)], torn = f.dmg.carnival;
  const cols = ["#ff5d8f", "#ffd23f", "#3fd0d4", "#7bd957", "#a66bff"];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 9;
    if (hash2(i, Math.round(x1 * 3), 12) < torn * 0.8) continue;
    const fl = Math.sin(f.t * 4 + i) * (1 + f.wi * 3);
    poly(g, [px - 4, py, px + 4, py, px + fl, py + 10], cols[i % cols.length]);
  }
  g.strokeStyle = "#7a5a3a"; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 18, b[0], b[1]); g.stroke();
}
function ferris(f: F, x: number, y: number, z: number) {
  const g = f.g, cx = sx(x, y), cy = sy(x, y, z + 3.1), r = 36, spin = f.reduced ? 0 : f.t * 0.35 * (f.dmg.carnival > 0.7 ? 0.3 : 1);
  box(g, x - 0.5, y, z, 0.12, 0.12, 3.0, "#d8dce3"); box(g, x + 0.5, y, z, 0.12, 0.12, 3.0, "#d8dce3");
  g.strokeStyle = "#f2f4f8"; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, r * 0.85, r, 0, 0, 7); g.stroke();
  g.lineWidth = 1.2; g.beginPath();
  for (let i = 0; i < 6; i++) { const a = spin + (i * Math.PI) / 3; g.moveTo(cx - Math.cos(a) * r * 0.85, cy - Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r); }
  g.stroke();
  const cols = ["#ff5d8f", "#ffd23f", "#3fd0d4", "#7bd957", "#a66bff", "#ff9f43"];
  for (let i = 0; i < 6; i++) { const a = spin + (i * Math.PI) / 3; g.fillStyle = cols[i]; g.fillRect(cx + Math.cos(a) * r * 0.85 - 4, cy + Math.sin(a) * r - 3, 8, 8); }
}
function drawDebris(f: F, x: number, y: number, z: number, rr: number, zone: ZoneId) {
  if (f.dmg[zone] < 0.06 + rr * 0.5) return;
  const g = f.g, k = Math.floor(rr * 4);
  if (k === 0) { box(g, x, y, z, 0.7, 0.12, 0.08, "#a07a4a"); box(g, x + 0.2, y + 0.2, z, 0.12, 0.6, 0.08, "#8a6238"); }
  else if (k === 1) box(g, x, y, z, 0.5, 0.4, 0.2, "#8a8f98");
  else if (k === 2) { poly(g, [sx(x, y), sy(x, y, z + 0.02), sx(x + 0.7, y), sy(x + 0.7, y, z + 0.02), sx(x + 0.7, y + 0.5), sy(x + 0.7, y + 0.5, z + 0.02), sx(x, y + 0.5), sy(x, y + 0.5, z + 0.02)], "#3b82c4"); }
  else { box(g, x, y, z, 0.9, 0.14, 0.14, "#5a3a1f"); box(g, x + 0.5, y + 0.1, z, 0.4, 0.3, 0.1, "#3f8f3f"); }
}

/* ---- annexes: one visual per buildable structure ---- */
const ANNEX: Record<string, (f: F, x: number, y: number, z: number) => void> = {
  solar_microgrid: (f, x, y, z) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { box(f.g, x + i * 0.75, y + j * 0.55, z + 0.25, 0.65, 0.45, 0.07, "#1f3a7a"); box(f.g, x + i * 0.75 + 0.3, y + j * 0.55 + 0.18, z, 0.06, 0.06, 0.25, "#9aa3ad"); } },
  aquaponics: (f, x, y, z) => { box(f.g, x, y, z, 1.3, 0.9, 0.55, "#bfe9f2"); box(f.g, x + 0.1, y + 0.1, z + 0.55, 1.1, 0.7, 0.2, "#d8f4fa"); box(f.g, x + 0.2, y + 0.2, z + 0.1, 0.9, 0.5, 0.2, "#5cc85c"); },
  drainage: (f, x, y, z) => { box(f.g, x, y, z + 0.02, 2.2, 0.35, 0.05, "#46b8f0"); box(f.g, x - 0.05, y - 0.08, z, 2.3, 0.08, 0.12, "#9aa3ad"); box(f.g, x - 0.05, y + 0.35, z, 2.3, 0.08, 0.12, "#9aa3ad"); },
  terracing: (f, x, y, z) => { box(f.g, x, y, z, 1.6, 0.8, 0.28, "#8a6a48"); box(f.g, x + 0.15, y + 0.1, z + 0.28, 1.3, 0.6, 0.28, "#9a7a54"); box(f.g, x + 0.3, y + 0.2, z + 0.56, 1.0, 0.4, 0.28, "#6fb04a"); },
  pump_station: (f, x, y, z) => { box(f.g, x, y, z, 0.8, 0.7, 0.55, "#c7ccd4"); box(f.g, x - 0.05, y - 0.05, z + 0.55, 0.9, 0.8, 0.12, "#3b82c4"); box(f.g, x + 0.8, y + 0.3, z + 0.1, 0.7, 0.14, 0.14, "#46b8f0"); },
  desal_plant: (f, x, y, z) => { box(f.g, x, y, z, 0.9, 0.9, 0.9, "#e9edf3"); box(f.g, x - 0.05, y - 0.05, z + 0.9, 1.0, 1.0, 0.12, "#46b8f0"); box(f.g, x + 0.95, y + 0.35, z + 0.1, 0.7, 0.14, 0.14, "#3b82c4"); },
  windbreak: (f, x, y, z) => { for (let i = 0; i < 3; i++) box(f.g, x + i * 0.5, y, z, 0.38, 0.38, 0.7 + (i % 2) * 0.2, "#2f7d3f"); },
  mangroves: (f, x, y, z) => { for (let i = 0; i < 3; i++) { box(f.g, x + i * 0.45, y, z, 0.07, 0.07, 0.3, "#6b4423"); box(f.g, x + i * 0.45 - 0.15, y - 0.15, z + 0.3, 0.4, 0.4, 0.3, "#2f8a3c"); } },
};

/* ---- scene construction ---- */
function buildScene(): Scene {
  if (SCENE) return SCENE;
  const { tiles } = buildTiles();
  const items: Item[] = [], occ: { x: number; y: number; r: number }[] = [], edges = new Map<Tile, number>();
  const free = (x: number, y: number, r: number) => occ.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r);
  const claim = (x: number, y: number, r: number) => occ.push({ x, y, r });
  const add = (x: number, y: number, w: number, d: number, zone: ZoneId | null, draw: (f: F) => void, pick?: [number, number, number, number, number], z0?: number) => {
    const z = z0 ?? zAt(x + w / 2, y + d / 2);
    items.push({ k: x + w + y + d - 0.5, z, zone, draw, pick: pick ? [x, y, z, w, d, pick[4]] : undefined });
  };
  const spots = (zone: ZoneId, n: number, r: number, seed: number, pred: (t: Tile) => boolean = () => true, kinds: Tile["kind"][] = ["grass", "sand"]) => {
    const cand = tiles.filter((t) => t.zone === zone && kinds.includes(t.kind) && pred(t)).sort((a, b) => hash2(a.x, a.y, seed) - hash2(b.x, b.y, seed));
    const out: { x: number; y: number; t: Tile }[] = [];
    for (const t of cand) {
      if (out.length >= n) break;
      const x = t.x + 0.5 + (hash2(t.x, t.y, seed + 1) - 0.5) * 0.4, y = t.y + 0.5 + (hash2(t.x, t.y, seed + 2) - 0.5) * 0.4;
      if (free(x, y, r)) { claim(x, y, r); out.push({ x, y, t }); }
    }
    return out;
  };

  // terrain
  for (const t of tiles) {
    let m = 0;
    const nb = (dx: number, dy: number) => tileAt(t.x + dx, t.y + dy)?.zone ?? null;
    if (t.zone) { if (nb(0, -1) !== t.zone) m |= 1; if (nb(1, 0) !== t.zone) m |= 2; if (nb(0, 1) !== t.zone) m |= 4; if (nb(-1, 0) !== t.zone) m |= 8; }
    edges.set(t, m);
    items.push({ k: t.x + t.y, z: t.z - 10, zone: t.zone, draw: (f) => drawTile(f, t, m), tile: t });
  }

  // hub: school building at the centre, plaza dressing
  const hx = C - 2.1, hy = C - 1.45, hz = LAND_Z + 1;
  claim(C, C, 3.2);
  add(hx, hy, 4.2, 2.6, "hub", (f) => drawHub(f, hx, hy, hz), [0, 0, 0, 0, 3.6]);
  add(C + 2.6, C - 1.0, 0.2, 0.2, "hub", (f) => { box(f.g, C + 2.6, C - 1.0, hz, 0.08, 0.08, 2.4, "#cfd6e0"); const fl = Math.sin(f.t * 5) * (2 + f.wi * 6); poly(f.g, [sx(C + 2.68, C - 1.0), sy(C + 2.68, C - 1.0, hz + 2.4), sx(C + 2.68, C - 1.0) + 24 + fl, sy(C + 2.68, C - 1.0, hz + 2.3), sx(C + 2.68, C - 1.0), sy(C + 2.68, C - 1.0, hz + 2.0)], "#3b6fd4"); });
  [[-1.0, 2.2, "#e5484d"], [0.0, 2.35, "#3b82c4"], [1.0, 2.2, "#f5c518"], [0.4, 2.55, "#7bd957"]].forEach(([dx, dy, col], i) => add(C + (dx as number), C + (dy as number), 0.3, 0.3, "hub", (f) => person(f.g, C + (dx as number), C + (dy as number), hz, col as string, f.t, i === 1), undefined, hz));
  spots("hub", 3, 0.7, 21, (t) => t.r > 1.9, ["plaza"]).forEach((p, i) => add(p.x, p.y, 0.3, 0.3, "hub", (f) => drawTree(f, "broad", p.x, p.y, hz, hash2(i, 5, 31), "hub", 0.85), undefined, hz));

  // housing: a row of houses
  const HC = [["#ffd9e6", "#f58ab5"], ["#cfeaf6", "#4c78c8"], ["#fff1b8", "#4c78c8"], ["#ffd9c4", "#e8654a"], ["#d9f3d0", "#3b9c9c"], ["#fbe3ff", "#9b6ad8"]];
  spots("housing", 6, 1.1, 41, (t) => t.r > 3.4 && t.r < 7.8).forEach((p, i) => {
    const [wall, roof] = HC[i % HC.length], rr = hash2(i, 3, 17), x = p.x - 0.85, y = p.y - 0.7;
    add(x, y, 1.7, 1.4, "housing", (f) => drawHouse(f, x, y, p.t.z, wall, roof, rr), [0, 0, 0, 0, 1.8]);
    if (i % 2 === 0) add(p.x + 1.1, p.y + 0.9, 0.3, 0.3, "housing", (f) => person(f.g, p.x + 1.1, p.y + 0.9, p.t.z, ["#e5484d", "#f58ab5", "#3b82c4"][i % 3], f.t, true));
  });

  // farm
  const barn = spots("farm", 1, 1.9, 51, (t) => t.r > 4.4 && t.r < 6.4)[0];
  if (barn) add(barn.x - 1, barn.y - 0.75, 3.2, 1.5, "farm", (f) => drawBarn(f, barn.x - 1, barn.y - 0.75, barn.t.z), [0, 0, 0, 0, 1.6]);
  for (const t of tiles) if (t.zone === "farm" && t.kind === "grass" && t.r > 4.1 && t.y % 2 === 1) {
    const rr = hash2(t.x, t.y, 61);
    add(t.x, t.y, 1, 1, "farm", (f) => {
      const dm = f.dmg.farm, flat = rr < dm * 1.3, h = flat ? 0.12 : 0.34 + rr * 0.15, flooded = f.flood > 0.2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) box(f.g, t.x + 0.12 + i * 0.45, t.y + 0.12 + j * 0.45, t.z, 0.3, 0.3, h, flat || flooded ? "#7a6a3a" : (i + j) % 2 ? "#2f8f3b" : "#3aa545");
      if (!flat) box(f.g, t.x + 0.27, t.y + 0.27, t.z + h, 0.16, 0.16, 0.08, rr > 0.5 ? "#ffd23f" : "#ff9f43");
    }, undefined, t.z + 0.0);
  }
  spots("farm", 4, 0.9, 71, (t) => t.r > 3.4 && t.r < 6.8).forEach((p, i) => add(p.x, p.y, 0.8, 0.4, "farm", (f) => drawCow(f, p.x, p.y, p.t.z, hash2(i, 9, 3), i === 3)));
  spots("farm", 3, 0.6, 73).forEach((p, i) => add(p.x, p.y, 0.5, 0.5, "farm", (f) => { box(f.g, p.x, p.y, p.t.z, 0.5, 0.5, 0.4, "#e8c548"); box(f.g, p.x + 0.05, p.y + 0.05, p.t.z + 0.4, 0.4, 0.4, 0.05, "#d4af37"); }));

  // beach
  const pierX = C - 0.45;
  add(pierX, C + coastR(90) - 2.0, 1, 5.6, "beach", (f) => drawPier(f), undefined, LAND_Z - 0.4);
  claim(C, C + coastR(90) - 0.5, 2.0);
  const py1 = C + coastR(90) + 3.6;
  [[C - 1.9, py1 - 0.1], [C + 1.2, py1 + 0.2]].forEach(([bx, by], i) => add(bx, by, 1.1, 0.55, null, (f) => drawBoat(f, bx, by, hash2(i, 2, 19)), undefined, 0));
  add(C - 0.05, py1 - 2.6, 0.3, 0.3, "beach", (f) => { person(f.g, C + 0.0, py1 - 2.6, 1.6, "#3b82c4", f.t); f.g.strokeStyle = "#333"; f.g.lineWidth = 1; f.g.beginPath(); f.g.moveTo(sx(C + 0.1, py1 - 2.5), sy(C + 0.1, py1 - 2.5, 2.2)); f.g.lineTo(sx(C + 0.8, py1 - 1.6), sy(C + 0.8, py1 - 1.6, 1.8)); f.g.stroke(); }, undefined, 1.6);
  spots("beach", 7, 0.8, 81, (t) => t.r > 6.7).forEach((p, i) => { if (i < 5) add(p.x, p.y, 0.3, 0.3, "beach", (f) => drawTree(f, "palm", p.x, p.y, p.t.z, hash2(i, 4, 23), "beach", 1)); else add(p.x, p.y, 1, 1, "beach", (f) => drawUmbrella(f, p.x, p.y, p.t.z, ["#ff5d8f", "#ffd23f"][i % 2])); });
  spots("beach", 2, 0.7, 82, (t) => t.r > 6.7).forEach((p, i) => add(p.x, p.y, 1.1, 1.1, "beach", (f) => drawUmbrella(f, p.x, p.y, p.t.z, ["#3fd0d4", "#a66bff"][i % 2])));
  spots("beach", 2, 0.6, 83).forEach((p) => add(p.x, p.y, 0.5, 0.5, "beach", (f) => { box(f.g, p.x, p.y, p.t.z, 0.45, 0.45, 0.4, "#a8743f"); box(f.g, p.x + 0.05, p.y + 0.05, p.t.z + 0.4, 0.35, 0.35, 0.05, "#c4986a"); }));

  // mountain
  spots("mountain", 12, 0.75, 91, (t) => t.z <= LAND_Z + 3).forEach((p, i) => add(p.x, p.y, 0.3, 0.3, "mountain", (f) => drawTree(f, "pine", p.x, p.y, p.t.z, hash2(i, 6, 29), "mountain", 1)));
  spots("mountain", 3, 0.7, 92, (t) => t.z >= LAND_Z + 1).forEach((p, i) => add(p.x, p.y, 0.6, 0.5, "mountain", (f) => { box(f.g, p.x, p.y, p.t.z, 0.6, 0.5, 0.35, i % 2 ? "#8d96a3" : "#7e8794"); box(f.g, p.x + 0.1, p.y + 0.1, p.t.z + 0.35, 0.4, 0.3, 0.2, "#9aa3ad"); }));
  const tent = spots("mountain", 1, 0.9, 93, (t) => t.z === LAND_Z)[0];
  if (tent) add(tent.x - 0.6, tent.y - 0.6, 1.2, 1.2, "mountain", (f) => drawTent(f, tent.x - 0.6, tent.y - 0.6, tent.t.z));
  spots("mountain", 2, 0.8, 94, (t) => t.z === LAND_Z).forEach((p, i) => add(p.x, p.y, 0.8, 0.4, "mountain", (f) => drawCow(f, p.x, p.y, p.t.z, hash2(i, 1, 3) + 0.2, true)));
  tiles.filter((t) => t.zone === "mountain" && t.z >= LAND_Z + 4).forEach((t) => {
    if (hash2(t.x, t.y, 95) < 0.3) add(t.x + 0.2, t.y + 0.2, 0.6, 0.6, "mountain", (f) => { box(f.g, t.x + 0.2, t.y + 0.2, t.z, 0.6, 0.6, 0.35, "#ebdcc0"); box(f.g, t.x + 0.35, t.y + 0.35, t.z + 0.35, 0.3, 0.3, 0.3, "#f6efe0"); });
  });

  // jungle
  spots("jungle", 15, 0.8, 101).forEach((p, i) => add(p.x, p.y, 0.4, 0.4, "jungle", (f) => drawTree(f, i % 5 === 0 ? "palm" : "jungle", p.x, p.y, p.t.z, hash2(i, 8, 37), "jungle", 1)));
  const ruin = spots("jungle", 1, 1.0, 102, (t) => t.deg > -85 && t.deg < -60)[0];
  if (ruin) add(ruin.x - 0.7, ruin.y - 0.7, 1.4, 1.4, "jungle", (f) => { const dm = f.dmg.jungle * 0.2; box(f.g, ruin.x - 0.7, ruin.y - 0.7, ruin.t.z, 1.4, 1.4, 0.4, "#9aa08f"); box(f.g, ruin.x - 0.5, ruin.y - 0.5, ruin.t.z + 0.4, 1.0, 1.0, 0.4 - dm, "#a7ad9a"); box(f.g, ruin.x - 0.3, ruin.y - 0.3, ruin.t.z + 0.8 - dm, 0.6, 0.6, 0.4, "#b4baa6"); });
  const wf = tiles.filter((t) => t.zone === "mountain" && t.z >= LAND_Z + 2 && t.deg > -118 && t.deg < -100).sort((a, b) => b.z - a.z)[0];
  if (wf) add(wf.x + 0.3, wf.y + 0.3, 0.5, 0.5, "mountain", (f) => {
    const hgt = wf.z - LAND_Z;
    box(f.g, wf.x + 0.5, wf.y + 0.5, LAND_Z, 0.4, 0.4, hgt, "#6ecbf2");
    f.g.strokeStyle = "rgba(255,255,255,.8)"; f.g.lineWidth = 1.4; f.g.beginPath();
    for (let i = 0; i < 3; i++) { const o = ((f.t * 1.6 + i / 3) % 1); f.g.moveTo(sx(wf.x + 0.9, wf.y + 0.9) - 4 + i * 4, sy(wf.x + 0.9, wf.y + 0.9, wf.z - o * hgt)); f.g.lineTo(sx(wf.x + 0.9, wf.y + 0.9) - 4 + i * 4, sy(wf.x + 0.9, wf.y + 0.9, wf.z - o * hgt - 0.35)); }
    f.g.stroke();
  }, undefined, LAND_Z);

  // port
  const stacks = spots("port", 2, 1.7, 111, (t) => t.r > 5.2 && t.r < 7.2, ["plaza"]);
  stacks.forEach((p, i) => add(p.x - 1.2, p.y - 0.6, 2.5, 1.25, "port", (f) => drawStack(f, p.x - 1.2, p.y - 0.6, p.t.z, i * 3), [0, 0, 0, 0, 1.6]));
  const crane = spots("port", 1, 1.5, 112, (t) => t.r > 6.6, ["plaza"])[0];
  if (crane) add(crane.x - 1, crane.y - 0.5, 2.3, 1.3, "port", (f) => drawCrane(f, crane.x - 1, crane.y - 0.5, crane.t.z), [0, 0, 0, 0, 2.9]);
  const shipP = ringPoint(40, coastR(40) + 3.4);
  add(shipP.x - 2.3, shipP.y - 0.7, 4.6, 1.4, null, (f) => drawShip(f, shipP.x - 2.3, shipP.y - 0.7), undefined, 0);
  spots("port", 3, 0.5, 113, (t) => t.r > 5.2, ["plaza"]).forEach((p, i) => add(p.x, p.y, 0.3, 0.3, "port", (f) => person(f.g, p.x, p.y, p.t.z, "#e8f03a", f.t, i === 0, true)));
  spots("port", 3, 0.7, 114, undefined, ["plaza"]).forEach((p) => add(p.x, p.y, 0.6, 0.5, "port", (f) => { box(f.g, p.x, p.y, p.t.z, 0.6, 0.5, 0.4, "#b98a52"); box(f.g, p.x + 0.05, p.y + 0.05, p.t.z + 0.4, 0.5, 0.4, 0.05, "#d4a96a"); }));

  // carnival
  const stage = spots("carnival", 1, 2.0, 121, (t) => t.r > 3.6 && t.r < 5.0 && t.deg > -50 && t.deg < 10)[0];
  if (stage) {
    const sx0 = stage.x - 1.3, sy0 = stage.y - 0.9;
    add(sx0, sy0, 2.6, 1.8, "carnival", (f) => drawStage(f, sx0, sy0, stage.t.z), [0, 0, 0, 0, 2.0]);
    add(sx0 - 1.0, sy0 - 0.2, 0.2, 0.2, "carnival", (f) => { box(f.g, sx0 - 1.0, sy0 - 0.2, stage.t.z, 0.12, 0.12, 2.2, "#7a5a3a"); box(f.g, sx0 + 3.4, sy0 + 0.2, stage.t.z, 0.12, 0.12, 2.2, "#7a5a3a"); bunting(f, sx0 - 1.0, sy0 - 0.2, sx0 + 3.4, sy0 + 0.2, stage.t.z + 2.1, 12); });
  }
  spots("carnival", 2, 1.2, 122, (t) => t.r > 4.6 && t.r < 7.0 && Math.abs(t.r - 5.4) > 0.8).forEach((p, i) => add(p.x - 0.6, p.y - 0.6, 1.2, 1.2, "carnival", (f) => { const dm = f.dmg.carnival, c = i ? ["#ff5d8f", "#ffffff"] : ["#3fd0d4", "#ffd23f"]; box(f.g, p.x - 0.6, p.y - 0.6, p.t.z, 1.2, 1.2, 0.6, "#fff3d6"); if (dm < 0.6 || hash2(i, 1, 2) > 0.5) pyramid(f.g, p.x - 0.7, p.y - 0.7, p.t.z + 0.6, 1.4, 1.4, 0.8, c[0], c[1]); }, [0, 0, 0, 0, 1.4]));
  const fw = spots("carnival", 1, 1.2, 123, (t) => t.r > 5.5 && t.deg > -35 && t.deg < 10 && Math.abs(t.r - 5.4) > 0.9)[0];
  if (fw) add(fw.x - 0.5, fw.y - 0.1, 1.2, 0.3, "carnival", (f) => ferris(f, fw.x, fw.y, fw.t.z));
  spots("carnival", 4, 0.7, 124).forEach((p, i) => add(p.x, p.y, 0.3, 0.3, "carnival", (f) => drawTree(f, "broad", p.x, p.y, p.t.z, hash2(i, 7, 41), "carnival", 0.9)));

  // generic trees for hub-adjacent / farm / housing greenery
  (["housing", "farm"] as ZoneId[]).forEach((z) => spots(z, 5, 0.8, 131).forEach((p, i) => add(p.x, p.y, 0.3, 0.3, z, (f) => drawTree(f, "broad", p.x, p.y, p.t.z, hash2(i, 9, 43), z, 0.9))));
  spots("housing", 2, 0.8, 132).forEach((p, i) => add(p.x, p.y, 0.3, 0.3, "housing", (f) => drawTree(f, "palm", p.x, p.y, p.t.z, hash2(i, 9, 44), "housing", 0.9)));

  // buildable annexes and debris, per zone
  for (const zid of ZONE_IDS) {
    for (const bd of BUILDINGS) {
      if (bd.zones && !bd.zones.includes(zid)) continue;
      if (bd.id === "concrete_roofs" || bd.id === "storm_shutters") continue;
      if (bd.id === "sea_wall") continue;
      const coastal = bd.id === "mangroves" || bd.id === "desal_plant";
      const sp = spots(zid, 1, 1.1, 140 + bd.id.length * 3 + zid.length, coastal ? (t) => t.r > coastR(t.deg) - 2.4 : undefined, ["grass", "sand", "plaza"])[0];
      const draw = ANNEX[bd.id];
      if (sp && draw) add(sp.x - 0.5, sp.y - 0.4, 1.4, 1.0, zid, (f) => { if (f.built[zid].includes(bd.id)) draw(f, sp.x - 0.5, sp.y - 0.4, sp.t.z); }, [0, 0, 0, 0, 0.9]);
    }
    spots(zid, 6, 0.4, 150).forEach((p, i) => add(p.x, p.y, 0.9, 0.6, zid, (f) => drawDebris(f, p.x, p.y, p.t.z, hash2(i, 13, 3), zid)));
  }
  // sea walls follow the coast
  for (const zid of ["beach", "port"] as ZoneId[]) {
    const [a, b] = zid === "beach" ? [64, 138] : [-4, 60];
    for (let dg = a; dg <= b; dg += 4) {
      const p = ringPoint(dg, coastR(dg) - 0.25);
      add(p.x - 0.4, p.y - 0.4, 0.8, 0.8, zid, (f) => { if (f.built[zid].includes("sea_wall")) box(f.g, p.x - 0.4, p.y - 0.4, zAt(p.x, p.y) - 0.2, 0.8, 0.8, 0.85, "#b8c0cc"); }, undefined, zAt(p.x, p.y));
    }
  }
  // landslide barrier on the mountain stretch of the ring road
  { const p = ringPoint(-140);
    add(p.x - 1, p.y - 1, 2, 2, null, (f) => { if (!f.blocked) return; for (let i = 0; i < 6; i++) box(f.g, p.x - 0.8 + (i % 3) * 0.6, p.y - 0.6 + Math.floor(i / 3) * 0.7, f.roadZ, 0.55, 0.5, 0.3 + (i % 3) * 0.12, i % 2 ? "#8a6a48" : "#7a5a3a"); box(f.g, p.x + 0.6, p.y + 0.8, f.roadZ, 0.18, 0.18, 0.5, "#ff8c1a"); box(f.g, p.x - 0.8, p.y + 0.9, f.roadZ, 0.18, 0.18, 0.5, "#ff8c1a"); }, undefined, LAND_Z - 0.4);
  }
  items.sort((a, b) => a.k - b.k || a.z - b.z);
  return (SCENE = { items, edges });
}

/* ---- tiles ---- */
const ZONE_GLOW: Record<ZoneId, string> = { hub: "#3b82ff", housing: "#d68cff", farm: "#5bd45b", beach: "#1fb5d4", mountain: "#d49a64", jungle: "#9bd13a", port: "#ffa64d", carnival: "#ff4fd8" };
function drawTile(f: F, t: Tile, mask: number) {
  const g = f.g, x = t.x, y = t.y;
  if (t.kind === "shallow") {
    const a = 0.9 + 0.08 * Math.sin(f.t * 1.3 + x * 0.6 + y * 0.4);
    g.globalAlpha = a; poly(g, [sx(x, y), sy(x, y, 0), sx(x + 1, y), sy(x + 1, y, 0), sx(x + 1, y + 1), sy(x + 1, y + 1, 0), sx(x, y + 1), sy(x, y + 1, 0)], "#a9e4f4"); g.globalAlpha = 1; return;
  }
  const z = t.kind === "road" ? f.roadZ : t.z;
  let col = tileColor(t);
  const dm = t.zone ? f.dmg[t.zone] : 0;
  if (t.zone && dm > 0.1 && t.kind !== "road" && hash2(x, y, 9) < dm * 0.95) col = mix(col, "#7a5a3a", 0.5);
  if (t.zone && t.zone === f.hover) col = mix(col, "#ffffff", 0.22); else if (t.zone && t.zone === f.sel) col = mix(col, "#ffffff", 0.12);
  const fc = faces(col), nl = tileAt(x, y + 1)?.z ?? 0, nr = tileAt(x + 1, y)?.z ?? 0, nlz = tileAt(x, y + 1)?.kind === "shallow" ? 0 : nl, nrz = tileAt(x + 1, y)?.kind === "shallow" ? 0 : nr;
  poly(g, [sx(x, y), sy(x, y, z), sx(x + 1, y), sy(x + 1, y, z), sx(x + 1, y + 1), sy(x + 1, y + 1, z), sx(x, y + 1), sy(x, y + 1, z)], fc[0], t.kind === "road" ? undefined : "rgba(255,255,255,.10)");
  const sideCol = (k: 1 | 2) => (t.kind === "road" ? shade("#8b93a1", k === 1 ? 0.9 : 0.75) : fc[k]);
  if (z > nlz + 0.01) poly(g, [sx(x, y + 1), sy(x, y + 1, z), sx(x + 1, y + 1), sy(x + 1, y + 1, z), sx(x + 1, y + 1), sy(x + 1, y + 1, nlz), sx(x, y + 1), sy(x, y + 1, nlz)], sideCol(1));
  if (z > nrz + 0.01) poly(g, [sx(x + 1, y), sy(x + 1, y, z), sx(x + 1, y + 1), sy(x + 1, y + 1, z), sx(x + 1, y + 1), sy(x + 1, y + 1, nrz), sx(x + 1, y), sy(x + 1, y, nrz)], sideCol(2));
  if (t.kind === "road" && Math.abs(t.r - roadR(t.deg)) < 0.55 && Math.floor((t.deg + 360) / 3.2) % 2 === 0 && Math.abs(t.deg - START_DEG) > 2.5) {
    const a = (t.deg * Math.PI) / 180, tx = -Math.sin(a) * 0.32, ty = Math.cos(a) * 0.32, cx = x + 0.5, cy = y + 0.5;
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(sx(cx - tx, cy - ty), sy(cx - tx, cy - ty, z)); g.lineTo(sx(cx + tx, cy + ty), sy(cx + tx, cy + ty, z)); g.stroke();
  }
  if ((nlz <= 0 && z > 0) || (nrz <= 0 && z > 0)) {
    const sz = 0.5 + f.wi * 1.1, a = clamp(0.45 + 0.3 * Math.sin(f.t * 2 + x + y) + f.wi * 0.4, 0.2, 1);
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2 + f.wi * 2; g.beginPath();
    if (nlz <= 0) { g.moveTo(sx(x, y + 1) + 2, sy(x, y + 1, 0) + sz); g.lineTo(sx(x + 1, y + 1) - 2, sy(x + 1, y + 1, 0) + sz); }
    if (nrz <= 0) { g.moveTo(sx(x + 1, y + 1) + 2, sy(x + 1, y + 1, 0) + sz); g.lineTo(sx(x + 1, y) - 2, sy(x + 1, y, 0) + sz); }
    g.stroke();
  }
  if (f.flood > 0.05 && t.zone && t.kind !== "road" && t.z <= LAND_Z + 0.5 && (f.hz === "flash_flood" || f.hz === "hurricane") && hash2(x, y, 14) < (f.hz === "hurricane" ? (t.r > coastR(t.deg) - 2.8 ? 0.95 : 0.1) : 0.75) * clamp(f.flood * 1.6, 0, 1)) {
    const wz = z + 0.12 + Math.sin(f.t * 2 + x) * 0.04;
    poly(g, [sx(x, y), sy(x, y, wz), sx(x + 1, y), sy(x + 1, y, wz), sx(x + 1, y + 1), sy(x + 1, y + 1, wz), sx(x, y + 1), sy(x, y + 1, wz)], f.hz === "hurricane" ? "rgba(70,170,230,.55)" : "rgba(139,107,74,.55)");
  }
  if (t.zone && (t.zone === f.hover || t.zone === f.sel) && mask) {
    g.strokeStyle = t.zone === f.hover ? "#ffffff" : ZONE_GLOW[t.zone]; g.lineWidth = 3; g.lineCap = "round"; g.beginPath();
    const N = [sx(x, y), sy(x, y, z)], E = [sx(x + 1, y), sy(x + 1, y, z)], S = [sx(x + 1, y + 1), sy(x + 1, y + 1, z)], Wp = [sx(x, y + 1), sy(x, y + 1, z)];
    if (mask & 1) { g.moveTo(N[0], N[1]); g.lineTo(E[0], E[1]); } if (mask & 2) { g.moveTo(E[0], E[1]); g.lineTo(S[0], S[1]); }
    if (mask & 4) { g.moveTo(S[0], S[1]); g.lineTo(Wp[0], Wp[1]); } if (mask & 8) { g.moveTo(Wp[0], Wp[1]); g.lineTo(N[0], N[1]); }
    g.stroke(); g.lineCap = "butt";
  }
}

/* ---- moving things ---- */
function vehicle(g: CanvasRenderingContext2D, x: number, y: number, z: number, vx: number, vy: number, body: string, cab: string, len = 0.9, wid = 0.45, h = 0.28) {
  const horiz = Math.abs(vx) > Math.abs(vy), w = horiz ? len : wid, d = horiz ? wid : len;
  box(g, x - w / 2, y - d / 2, z, w, d, h, body);
  const cw = horiz ? len * 0.45 : wid * 0.8, cd = horiz ? wid * 0.8 : len * 0.45, ox = horiz ? (vx > 0 ? len * 0.15 : -len * 0.15) : 0, oy = horiz ? 0 : (vy > 0 ? len * 0.15 : -len * 0.15);
  box(g, x - cw / 2 + ox, y - cd / 2 + oy, z + h, cw, cd, h * 0.7, cab);
}
interface Convoy { from: number; to: number; t0: number; res: ResourceId }
interface Popup { zone: ZoneId; text: string; color: string; t0: number }
function dynItems(f: F, convoys: Convoy[], now: number): Item[] {
  const out: Item[] = [], g = f.g;
  const hide = f.ph === "warning" || f.ph === "storm" || f.ph === "hurricane";
  const place = (deg: number, off: number, r?: number) => { const p = ringPoint(deg, r ?? roadR(deg) + off), q = ringPoint(deg + 1, r ?? roadR(deg + 1) + off); return { x: p.x, y: p.y, vx: q.x - p.x, vy: q.y - p.y }; };
  if (!hide) {
    [["#8a7be8", "#cfe8ff", 24, 20, 0.25], ["#e5484d", "#ffe3e3", 20, 140, -0.25], ["#f5c518", "#fff6c8", 17, -100, 0.25]].forEach(([body, cab, spd, ph0, off]) => {
      const deg = wrapDeg((ph0 as number) + f.t * (spd as number)), p = place(deg, off as number);
      if (f.blocked && Math.abs(wrapDeg(deg + 140)) < 22) return;
      out.push({ k: p.x + p.y + 0.5, z: f.roadZ, zone: null, draw: () => vehicle(g, p.x, p.y, f.roadZ, p.vx, p.vy, body as string, cab as string) });
    });
  }
  for (const c of convoys) {
    const u = (now - c.t0) / 2.6; if (u < 0 || u > 1) continue;
    const d = wrapDeg(c.to - c.from), deg = c.from + d * (u * u * (3 - 2 * u)), p = place(deg, 0.15);
    out.push({ k: p.x + p.y + 0.5, z: f.roadZ, zone: null, draw: () => vehicle(g, p.x, p.y, f.roadZ, p.vx * Math.sign(d || 1), p.vy * Math.sign(d || 1), RES_COLOR[c.res], "#f4f4f4", 1.0, 0.5, 0.36) });
  }
  const pl = (deg: number) => ringPoint(deg, 5.4);
  const nF = f.festival ? 4 : 1;
  for (let i = 0; i < nF; i++) {
    const deg = -52 + ((f.t * (f.festival ? 9 : 3) + i * 20) % 78), p = pl(deg), q = pl(deg + 1), z = zAt(p.x, p.y);
    if (f.dmg.carnival > 0.7 && !f.festival) continue;
    out.push({ k: p.x + p.y + 0.5, z, zone: "carnival", draw: () => {
      box(g, p.x - 0.5, p.y - 0.5, z, 1.0, 1.0, 0.35, ["#ff5d8f", "#3fd0d4", "#ffd23f", "#a66bff"][i % 4]); box(g, p.x - 0.35, p.y - 0.35, z + 0.35, 0.7, 0.7, 0.5, ["#ffd23f", "#ff5d8f", "#7bd957", "#ff9f43"][i % 4]);
      box(g, p.x - 0.1, p.y - 0.1, z + 0.85, 0.2, 0.2, 0.3, "#fff");
      void q;
    } });
  }
  if ((f.hz === "landslide") && f.ph !== "warning") {
    const a = ringPoint(-125, 3.4), b = ringPoint(-140);
    for (let i = 0; i < 4; i++) { const u = (f.t * 0.5 + i / 4) % 1, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, z = LAND_Z + 4 * (1 - u) + 0.2; out.push({ k: x + y + 0.5, z, zone: "mountain", draw: () => box(g, x, y, z, 0.45, 0.45, 0.4, i % 2 ? "#7a5a3a" : "#8a8f98") }); }
  }
  return out.sort((a, b) => a.k - b.k);
}

/* ---- weather ---- */
function drawSea(f: F) {
  const g = f.g;
  g.fillStyle = f.ph === "hurricane" ? "#3f8fb5" : f.ph === "storm" ? "#5aa8cc" : f.ph === "warning" ? "#69b4d8" : "#72bfe9";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = `rgba(255,255,255,${0.35 + f.wi * 0.4})`; g.lineWidth = 2 + f.wi * 1.5; g.beginPath();
  for (let dg = -180; dg < 180; dg += 5) {
    const o = Math.sin(f.t * (1.1 + f.wi * 1.6) + dg * 0.2) * 0.35, r = roadR(dg) + 1.5 + o + (hash2(dg, 1, 51) * 1.8);
    const p = ringPoint(dg, r), q = ringPoint(dg + 2.2, r);
    if (hash2(dg, 2, 52) > 0.5 + f.wi * 0.4) continue;
    g.moveTo(sx(p.x, p.y), sy(p.x, p.y, 0)); g.lineTo(sx(q.x, q.y), sy(q.x, q.y, 0));
  }
  g.stroke();
  if (f.ph === "clear" || f.ph === "aftermath") {
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < 26; i++) { const x = hash2(i, 1, 61) * W, y = 60 + hash2(i, 2, 62) * (H - 120); if (Math.sin(f.t * 1.5 + i * 2.1) > 0.2) { g.moveTo(x, y); g.lineTo(x + 8, y); } }
    g.stroke();
  }
}
function cloudCol(wi: number) { return mix("#ffffff", "#56606e", clamp(wi * 1.4, 0, 1)); }
function drawClouds(f: F) {
  const g = f.g, n = 3 + Math.floor(f.wi * 10), col = cloudCol(f.wi), alpha = 0.55 + f.wi * 0.3;
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const sp = 6 + hash2(i, 1, 71) * 8, x = ((hash2(i, 2, 72) * (W + 400) + f.t * sp * (1 + f.wi * 3)) % (W + 400)) - 200, y = 90 + hash2(i, 3, 73) * 300, s = 0.8 + hash2(i, 4, 74) * 0.9;
    for (const [dx, dy, w, h] of [[0, 0, 110, 26], [20, -18, 70, 26], [-24, -8, 60, 22], [50, 4, 70, 20]]) { g.fillStyle = col; g.beginPath(); g.roundRect(x + dx * s, y + dy * s, w * s, h * s, 12 * s); g.fill(); }
  }
  g.globalAlpha = 1;
}
function drawRain(f: F) {
  if (f.wi < 0.12 || !(f.ph === "storm" || f.ph === "hurricane" || (f.ph === "warning" && f.wi > 0.3))) return;
  const g = f.g, n = Math.floor((60 + 520 * f.wi) * (f.reduced ? 0.4 : 1)), wind = f.ph === "hurricane" ? 34 : 14;
  g.strokeStyle = f.ph === "hurricane" ? "rgba(220,240,255,.6)" : "rgba(220,240,255,.45)"; g.lineWidth = 1.4; g.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 520 + hash2(i, 1, 81) * 360, x = hash2(i, 2, 82) * (W + 200) - 100, y = ((hash2(i, 3, 83) * H + f.t * sp) % (H + 40)) - 20;
    g.moveTo(x, y); g.lineTo(x - wind * 0.5, y + 16 + hash2(i, 4, 84) * 8);
  }
  g.stroke();
}
function drawSpiral(f: F) {
  if (f.ph !== "hurricane" && !(f.ph === "warning" && f.hz === "hurricane" && f.wi > 0.3)) return;
  const g = f.g, k = f.ph === "hurricane" ? 1 : 0.5, cx = OX + 20, cy = 330, spin = f.t * (f.reduced ? 0.2 : 0.8);
  g.save(); g.translate(cx, cy);
  const grad = g.createRadialGradient(0, 0, 40, 0, 0, 520); grad.addColorStop(0, "rgba(20,35,50,0)"); grad.addColorStop(0.25, `rgba(25,40,58,${0.35 * k})`); grad.addColorStop(1, `rgba(25,40,58,${0.15 * k})`);
  g.fillStyle = grad; g.beginPath(); g.ellipse(0, 0, 560, 300, 0, 0, 7); g.fill();
  g.lineCap = "round";
  for (let arm = 0; arm < 4; arm++) {
    g.beginPath();
    for (let s = 0; s < 70; s++) { const rho = 40 + s * 7.2, a = arm * (Math.PI / 2) + s * 0.1 - spin; const x = Math.cos(a) * rho, y = Math.sin(a) * rho * 0.5; if (s) g.lineTo(x, y); else g.moveTo(x, y); }
    g.strokeStyle = `rgba(210,222,235,${0.28 * k})`; g.lineWidth = 16; g.stroke();
    g.strokeStyle = `rgba(30,45,62,${0.35 * k})`; g.lineWidth = 7; g.stroke();
  }
  g.restore(); g.lineCap = "butt";
}
function drawLightning(f: F) {
  if (f.reduced || !(f.ph === "storm" || f.ph === "hurricane") || f.wi < 0.4) return;
  const g = f.g, slot = Math.floor(f.t * 0.8), ph = f.t * 0.8 - slot;
  if (hash2(slot, 5, 91) > f.wi * 0.55 || ph > 0.22) return;
  const a = 1 - ph / 0.22;
  g.fillStyle = `rgba(255,255,255,${0.28 * a})`; g.fillRect(0, 0, W, H);
  g.strokeStyle = `rgba(255,252,210,${a})`; g.lineWidth = 3; g.beginPath();
  let x = 120 + hash2(slot, 6, 92) * (W - 240), y = 40; g.moveTo(x, y);
  for (let i = 0; i < 8; i++) { x += (hash2(slot, i, 93) - 0.5) * 60; y += 50; g.lineTo(x, y); }
  g.stroke();
}
function drawTint(f: F) {
  const g = f.g;
  const c = f.ph === "hurricane" ? `rgba(10,28,45,${0.28 + 0.22 * f.wi})` : f.ph === "storm" ? `rgba(35,55,85,${0.14 + 0.2 * f.wi})` : f.ph === "warning" ? `rgba(255,160,40,${0.1 * clamp(f.wi / 0.5, 0, 1)})` : f.ph === "aftermath" ? `rgba(170,150,120,${0.1 + 0.2 * clamp(f.wi / 0.3, 0, 1)})` : "";
  if (c) { g.fillStyle = c; g.fillRect(0, 0, W, H); }
}
function drawAftermath(f: F) {
  if (f.ph !== "aftermath") return;
  const g = f.g, fade = clamp(1 - f.wi / 0.3, 0, 1);
  g.save(); g.globalAlpha = 0.12 + 0.2 * fade; g.fillStyle = "#fff6c8";
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(780 + i * 70, -10); g.lineTo(860 + i * 70, -10); g.lineTo(480 + i * 120, 600); g.lineTo(380 + i * 120, 600); g.fill(); }
  g.restore();
  if (fade > 0.55) {
    const cols = ["#ff5d5d", "#ffb347", "#ffe84d", "#6ee06e", "#4db5ff", "#a07bff"];
    g.lineWidth = 5; g.globalAlpha = 0.35 * fade;
    cols.forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.arc(380, 640, 330 + i * 6, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); });
    g.globalAlpha = 1;
  }
  g.fillStyle = "rgba(255,255,255,.16)";
  for (let i = 0; i < 14; i++) { const x = 200 + hash2(i, 1, 101) * 700, y = 260 + hash2(i, 2, 102) * 260 - ((f.t * 14 + i * 20) % 80); g.beginPath(); g.ellipse(x, y, 22, 8, 0, 0, 7); g.fill(); }
}
function drawBirds(f: F) {
  if (f.ph === "warning" || f.ph === "storm" || f.ph === "hurricane") return;
  const g = f.g; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i < 5; i++) { const a = f.t * 0.3 + i * 1.3, x = OX + Math.cos(a) * (360 + i * 30), y = 190 + Math.sin(a) * 90 + i * 40, fl = Math.sin(f.t * 8 + i) * 3; g.moveTo(x - 7, y + fl); g.lineTo(x, y); g.lineTo(x + 7, y + fl); }
  g.stroke();
}

/* ---- labels (ribbons from the art direction) ---- */
interface LabelSpec { lines: string[]; fill: string; edge: string; dx: number; dy: number; star?: boolean; sub?: string; zig?: boolean }
const LABELS: Record<ZoneId, LabelSpec> = {
  hub: { lines: ["SCHOOL / AX-ACADEMY HUB"], fill: "#2c6bd6", edge: "#1d4aa0", dx: 40, dy: -118, star: true },
  housing: { lines: ["HOUSING ROW"], fill: "#d79ff0", edge: "#a96bd0", dx: -95, dy: -20 },
  farm: { lines: ["FARM & ANIMALS"], fill: "#5cb85c", edge: "#3b8a3b", dx: -10, dy: 40 },
  beach: { lines: ["BEACH & FISHING", "DOCK"], fill: "#1f7e9c", edge: "#14566b", dx: -120, dy: 70 },
  mountain: { lines: ["MOUNTAIN", "COUNTRYSIDE"], fill: "#8a5a3a", edge: "#5f3b22", dx: 0, dy: -30 },
  jungle: { lines: ["RAINFOREST", "JUNGLE"], fill: "#6b8f23", edge: "#496414", dx: 0, dy: -110, zig: true },
  port: { lines: ["MARKET PORT"], fill: "#c9732b", edge: "#8f4f1a", dx: 40, dy: 70, sub: "CARIB CARGO" },
  carnival: { lines: ["CARNIVAL", "PARADE ROUTE"], fill: "#c43fd6", edge: "#8f2a9e", dx: 30, dy: -70, zig: true },
};
interface Hit { zone: ZoneId; x: number; y: number; w: number; h: number }
function drawLabels(f: F, hits: Hit[]) {
  const g = f.g;
  for (const id of ZONE_IDS) {
    const L = LABELS[id], c = zoneCentroid(id), scale = id === f.hover ? 1.08 : id === f.sel ? 1.04 : 1;
    const cx = sx(c.x, c.y) + L.dx, cy = sy(c.x, c.y, c.z) + L.dy;
    g.save(); g.translate(cx, cy); g.scale(scale, scale);
    g.font = "800 17px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const tw = Math.max(...L.lines.map((s) => g.measureText(s).width)), w = tw + (L.star ? 70 : 34), h = L.lines.length * 23 + 12;
    g.shadowColor = "rgba(0,0,0,.28)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.fillStyle = L.edge; g.beginPath(); g.roundRect(-w / 2, -h / 2 + 4, w, h, 12); g.fill();
    g.shadowColor = "transparent"; g.fillStyle = L.fill; g.beginPath();
    if (L.zig) { const n = 14; g.moveTo(-w / 2, -h / 2); for (let i = 0; i <= n; i++) g.lineTo(-w / 2 + (w * i) / n, -h / 2 + (i % 2 ? 4 : -2)); g.lineTo(w / 2, h / 2); for (let i = n; i >= 0; i--) g.lineTo(-w / 2 + (w * i) / n, h / 2 + (i % 2 ? -4 : 2)); g.closePath(); } else g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fill();
    if (id === f.hover || id === f.sel) { g.strokeStyle = "#fff"; g.lineWidth = 3; g.stroke(); }
    if (L.star) { g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(-w / 2 + 6, 0, 22, 0, 7); g.fill(); g.strokeStyle = "#1d4aa0"; g.lineWidth = 3; g.stroke(); g.fillStyle = "#fff6c8"; star(g, -w / 2 + 6, 0, 13, 5.5); }
    g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 3;
    L.lines.forEach((s, i) => { const ty = (i - (L.lines.length - 1) / 2) * 23, tx = L.star ? 24 : 0; g.strokeText(s, tx, ty); g.fillText(s, tx, ty); });
    if (L.sub) { g.fillStyle = "#f5c518"; g.font = "800 13px system-ui, sans-serif"; g.fillText(L.sub, 0, h / 2 + 12); }
    // live status badge: power out, hazard exposure, damage
    const risk = f.risk[id], badge = !f.pow[id] ? "⚡" : risk && risk >= 4 ? "!" : f.dmg[id] > 0.45 ? "✕" : "";
    if (badge) { const bx = w / 2 - 2, by = -h / 2 - 2, pulse = 1 + 0.12 * Math.sin(f.t * 6); g.fillStyle = badge === "!" ? "#ff9f1a" : "#e5484d"; g.beginPath(); g.arc(bx, by, 13 * pulse, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "800 15px system-ui, sans-serif"; g.fillText(badge, bx, by + 1); }
    g.restore();
    hits.push({ zone: id, x: cx - (w * scale) / 2, y: cy - (h * scale) / 2, w: w * scale, h: h * scale + 8 });
  }
  // racing track ribbon
  const p = ringPoint(-168), rx = sx(p.x, p.y) - 96, ry = sy(p.x, p.y, 2) - 62;
  g.save(); g.translate(rx, ry); g.rotate(-0.2);
  g.fillStyle = "#f5c518"; g.beginPath(); g.roundRect(-110, -30, 220, 60, 6); g.fill(); g.fillStyle = "#d9a50f"; g.fillRect(-110, 24, 220, 6);
  g.fillStyle = "#2b2430"; g.font = "800 26px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("RACING TRACK", 0, -6);
  g.font = "italic 700 13px system-ui, sans-serif"; g.fillText("looping around island", 0, 17); g.restore();
}
function star(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) {
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fill();
}

/* ---- picking ---- */
function inPoly(px: number, py: number, p: number[]) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if (p[i + 1] > py !== p[j + 1] > py && px < ((p[j] - p[i]) * (py - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c;
  return c;
}
function pickZone(px: number, py: number, hits: Hit[]): ZoneId | null {
  for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return h.zone; }
  const { items } = buildScene();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.pick) {
      const [x, y, z, w, d, h] = it.pick, t = z + h;
      if (inPoly(px, py, [sx(x, y), sy(x, y, t), sx(x + w, y), sy(x + w, y, t), sx(x + w, y + d), sy(x + w, y + d, t), sx(x, y + d), sy(x, y + d, t)]) ||
        inPoly(px, py, [sx(x, y + d), sy(x, y + d, t), sx(x + w, y + d), sy(x + w, y + d, t), sx(x + w, y + d), sy(x + w, y + d, z), sx(x, y + d), sy(x, y + d, z)]) ||
        inPoly(px, py, [sx(x + w, y), sy(x + w, y, t), sx(x + w, y + d), sy(x + w, y + d, t), sx(x + w, y + d), sy(x + w, y + d, z), sx(x + w, y), sy(x + w, y, z)])) return it.zone;
    }
    const t = it.tile;
    if (t && t.zone && inPoly(px, py, [sx(t.x, t.y), sy(t.x, t.y, t.z), sx(t.x + 1, t.y), sy(t.x + 1, t.y, t.z), sx(t.x + 1, t.y + 1), sy(t.x + 1, t.y + 1, t.z), sx(t.x, t.y + 1), sy(t.x, t.y + 1, t.z)])) return t.zone;
  }
  return null;
}

/* ---- frame composition ---- */
function makeFrame(g: CanvasRenderingContext2D, t: number, s: GameState, hover: ZoneId | null, sel: ZoneId | null, reduced: boolean): F {
  const dmg = {} as F["dmg"], pow = {} as F["pow"], built = {} as F["built"], risk: F["risk"] = {};
  const hz = s.hazard?.type ?? (s.weather.phase === "aftermath" ? s.lastHazard?.type ?? null : null);
  for (const z of s.zones) {
    dmg[z.id] = clamp(1 - z.integrity / 100, 0, 1); pow[z.id] = z.powered; built[z.id] = z.buildings;
    if (s.hazard && s.tick <= s.hazard.warnUntilTick) risk[z.id] = HAZARDS[s.hazard.type].baseDamage * s.hazard.intensity * HAZARDS[s.hazard.type].exposure[z.id] * (1 - zoneParams(s, z).mitigation[s.hazard.type]);
  }
  const wi = s.weather.intensity, ph = s.weather.phase;
  return {
    g, t, dmg, pow, built, hover, sel, ph, wi, sway: Math.sin(t * 2.4) * (1.5 + wi * 7) * (reduced ? 0.3 : 1), hz,
    festival: s.tick < s.festivalUntilTick, blocked: s.tick < s.roadBlockedUntilTick, reduced,
    flood: (hz === "flash_flood" || hz === "hurricane") && ph !== "warning" && ph !== "clear" ? clamp(ph === "aftermath" ? wi * 2 : wi, 0, 1) : 0,
    warn: ph === "warning", roadZ: LAND_Z - 0.4, risk, tick: s.tick,
  };
}
function renderFrame(f: F, convoys: Convoy[], pops: Popup[], now: number, hits: Hit[]) {
  const g = f.g;
  drawSea(f);
  const scene = buildScene(), dyn = dynItems(f, convoys, now);
  let j = 0;
  for (const it of scene.items) { while (j < dyn.length && dyn[j].k < it.k) dyn[j++].draw(f); it.draw(f); }
  while (j < dyn.length) dyn[j++].draw(f);
  drawBirds(f); drawClouds(f); drawSpiral(f); drawTint(f); drawRain(f); drawAftermath(f); drawLightning(f);
  hits.length = 0; drawLabels(f, hits);
  for (const p of pops) {
    const age = now - p.t0; if (age < 0 || age > 2.2) continue;
    const L = LABELS[p.zone], c = zoneCentroid(p.zone), x = sx(c.x, c.y) + L.dx * 0.2, y = sy(c.x, c.y, c.z) - 20 - age * 26;
    g.globalAlpha = clamp(1 - age / 2.2, 0, 1); g.font = "800 17px system-ui, sans-serif"; g.textAlign = "center";
    g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.55)"; g.strokeText(p.text, x, y); g.fillStyle = p.color; g.fillText(p.text, x, y); g.globalAlpha = 1;
  }
  if (f.festival) { for (let i = 0; i < 40; i++) { const x = (hash2(i, 1, 111) * 500 + 650 + Math.sin(f.t + i) * 10), y = ((hash2(i, 2, 112) * 500 + f.t * 90) % 520) + 120; g.fillStyle = ["#ff5d8f", "#ffd23f", "#3fd0d4", "#7bd957", "#a66bff"][i % 5]; g.fillRect(x, y, 5, 3); } }
}

/* =====================================================================================================================
 * React component
 * ===================================================================================================================== */
const ERR: Record<string, string> = {
  not_enough_antx: "Not enough ANTX credits", blueprint_locked: "Unlock the blueprint first", already_built: "Already built here", not_allowed_here: "That can't be built in this zone",
  not_enough_materials: "Not enough materials in this zone", nothing_to_repair: "Nothing to repair", drone_cooldown: "Drones are recharging", already_unlocked: "Already unlocked", hazard_active: "A hazard is already underway",
};
const panel = "rounded-2xl border border-cyan-500/40 bg-[#0a0f1d]/85 p-4 backdrop-blur-md";
const btn = "min-h-10 rounded-full border border-cyan-400/60 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40";

function Pill({ icon, children, className = "" }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 rounded-full bg-[#d8ebfb]/95 px-4 py-1.5 font-extrabold text-[#173a8c] shadow-lg ring-2 ring-white/60 sm:gap-3 sm:px-6 sm:py-2 ${className}`}>{icon}<span className="whitespace-nowrap text-[clamp(13px,2.6vw,26px)] leading-none">{children}</span></div>;
}
const IconTarget = () => <svg viewBox="0 0 32 32" className="h-[clamp(20px,3.4vw,34px)] w-[clamp(20px,3.4vw,34px)]" aria-hidden><circle cx="16" cy="16" r="13" fill="none" stroke="#f59e0b" strokeWidth="3" /><circle cx="16" cy="16" r="8" fill="none" stroke="#f59e0b" strokeWidth="3" /><circle cx="16" cy="16" r="3.5" fill="#2563eb" /><path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" /></svg>;
const IconShield = () => <svg viewBox="0 0 32 32" className="h-[clamp(20px,3.4vw,34px)] w-[clamp(20px,3.4vw,34px)]" aria-hidden><path d="M16 2 4 6v9c0 7.5 5 12.5 12 15 7-2.5 12-7.5 12-15V6z" fill="#2f6fe0" stroke="#1d4aa0" strokeWidth="2" /><path d="m10 16 4 4 8-9" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconFlame = () => <svg viewBox="0 0 32 32" className="h-[clamp(20px,3.4vw,34px)] w-[clamp(20px,3.4vw,34px)]" aria-hidden><path d="M17 2c1 6 8 9 8 18a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 4 2 4 0-5-1-9 4-14z" fill="#f97316" /><path d="M16 14c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z" fill="#fbbf24" /></svg>;

/** Top-banner HUD, exact labels from the art direction: "Focus Score: 92", "Integrity: 100%", "Streak: 7 days". */
export function IslandHud({ focusScore, integrity, streakDays }: { focusScore: number; integrity: number; streakDays: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-3 items-center gap-2 p-2 sm:gap-4 sm:p-4" role="status" aria-label="Island HUD">
      <Pill icon={<IconTarget />} className="justify-self-start">Focus Score: {focusScore}</Pill>
      <Pill icon={<IconShield />} className="justify-self-center">Integrity: {integrity}%</Pill>
      <Pill icon={<IconFlame />} className="justify-self-end">Streak: {streakDays} {streakDays === 1 ? "day" : "days"}</Pill>
    </div>
  );
}

const PHASE_COPY: Record<WeatherPhase, string> = { clear: "Clear skies", warning: "Warning issued", storm: "Storm", hurricane: "Hurricane", aftermath: "Aftermath: rebuild" };

export interface IslandEngineProps { seed?: number; focusScore?: number; streakDays?: number; onRunLog?: (seed: number, focus: number, log: LoggedAction[], tick: number) => void }

export default function IslandEngine({ seed = 360, focusScore = 92, streakDays = 7 }: IslandEngineProps) {
  const [state, setState] = useState<GameState>(() => createInitialState(seed, focusScore));
  const [sel, setSel] = useState<ZoneId | null>("hub");
  const [hover, setHover] = useState<ZoneId | null>(null);
  const [speed, setSpeed] = useState(1);
  const [toast, setToast] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef({ state, hover, sel });
  const sim = useRef(state);
  const log = useRef<LoggedAction[]>([]);
  const convoys = useRef<Convoy[]>([]);
  const pops = useRef<Popup[]>([]);
  const hits = useRef<Hit[]>([]);
  const clock = useRef(0);
  live.current = { state, hover, sel };

  const ingest = useCallback((events: GameEvent[]) => {
    const now = clock.current;
    for (const e of events) {
      if (e.kind === "trade" && e.zoneId && e.toZoneId) convoys.current.push({ from: ZONE_ANCHOR_DEG[e.zoneId], to: ZONE_ANCHOR_DEG[e.toZoneId], t0: now, res: (e.label.split(" ")[0] as ResourceId) in RES_COLOR ? (e.label.split(" ")[0] as ResourceId) : "materials" });
      else if (e.zoneId) {
        const color = e.kind === "damage" ? "#ff6b6b" : e.kind === "resource" ? RES_COLOR[(e.label.split(" ")[1] as ResourceId)] ?? "#fff" : "#ffd166";
        const extra = [e.xp ? `+${e.xp} XP` : "", e.antx && e.kind !== "resource" ? `+${e.antx} ANTX` : ""].filter(Boolean).join(" ");
        pops.current.push({ zone: e.zoneId, text: e.kind === "resource" ? e.label : extra ? `${e.label} ${extra}` : e.label, color, t0: now });
      }
    }
    pops.current = pops.current.filter((p) => now - p.t0 < 2.4).slice(-24);
    convoys.current = convoys.current.filter((c) => now - c.t0 < 2.8).slice(-16);
  }, []);

  // simulation clock: pauses in background tabs
  useEffect(() => {
    if (speed === 0) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const r = step(sim.current);
      sim.current = r.state; setState(r.state); ingest(r.events);
    }, 500 / speed);
    return () => clearInterval(id);
  }, [speed, ingest]);

  // render loop
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const g = cv.getContext("2d"); if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const loop = (ms: number) => {
      clock.current = ms / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { state: s, hover: h, sel: se } = live.current;
      renderFrame(makeFrame(g, ms / 1000, s, h, se, !!mq?.matches), convoys.current, pops.current, ms / 1000, hits.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const act = (a: Action) => {
    const tick = sim.current.tick, r = applyAction(sim.current, a);
    if (r.error) { setToast(ERR[r.error] ?? r.error); return; }
    sim.current = r.state; setState(r.state); setToast(""); ingest(r.events);
    if (a.type !== "forceHazard") log.current.push({ tick, action: a });
  };

  const toPoint = (e: React.PointerEvent | React.MouseEvent) => { const r = canvas.current!.getBoundingClientRect(); return { px: ((e.clientX - r.left) * W) / r.width, py: ((e.clientY - r.top) * H) / r.height, cx: e.clientX - r.left, cy: e.clientY - r.top }; };
  const onMove = (e: React.PointerEvent) => { const p = toPoint(e), z = pickZone(p.px, p.py, hits.current); setHover(z); setTip(z ? { x: p.cx, y: p.cy } : null); };
  const onClick = (e: React.MouseEvent) => { const p = toPoint(e), z = pickZone(p.px, p.py, hits.current); if (z) setSel(z); };

  const z = state.zones.find((x) => x.id === sel) ?? null, zp = z ? zoneParams(state, z) : null;
  const hz = state.hazard, warnSecs = hz && state.tick <= hz.warnUntilTick ? Math.ceil((hz.warnUntilTick - state.tick) / 2) : null;
  const hovered = hover ? state.zones.find((x) => x.id === hover) : null, hp = hovered ? zoneParams(state, hovered) : null;
  const seasonLabel = state.season.replace("_", " ");
  const flows = (p: ReturnType<typeof zoneParams>) => RESOURCES.filter((k) => k !== "antx").map((k) => ({ k, v: (p.net[k] ?? 0) * 20 }));
  const zoneLabel = useMemo(() => Object.fromEntries(ZONES.map((d) => [d.id, d.label])) as Record<ZoneId, string>, []);

  return (
    <div className="space-y-4">
      <div ref={wrap} className="relative mx-auto w-full max-w-[1100px] overflow-hidden rounded-3xl border-4 border-white/70 bg-[#72bfe9] shadow-2xl">
        <canvas ref={canvas} role="img" aria-label="Island map. Choose a zone from the list below or tap it on the map." className="block h-auto w-full cursor-pointer touch-manipulation" style={{ aspectRatio: `${W} / ${H}` }}
          onPointerMove={onMove} onPointerLeave={() => { setHover(null); setTip(null); }} onClick={onClick} />
        <IslandHud focusScore={state.focus} integrity={state.resilience} streakDays={streakDays} />
        {warnSecs !== null && hz && <div aria-live="assertive" className="pointer-events-none absolute left-1/2 top-[15%] -translate-x-1/2 animate-pulse rounded-full bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 shadow-lg sm:text-lg">{HAZARDS[hz.type].name.toUpperCase()} WARNING · {warnSecs}s · prepare!</div>}
        {state.weather.phase === "aftermath" && <div aria-live="polite" className="pointer-events-none absolute left-1/2 top-[15%] -translate-x-1/2 rounded-full bg-emerald-200 px-5 py-2 text-sm font-extrabold text-emerald-950 shadow-lg sm:text-lg">AFTERMATH · repair and rebuild</div>}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-bold text-white sm:text-sm">{PHASE_COPY[state.weather.phase]} · {seasonLabel}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2"><div className="rounded-2xl border border-white/40 bg-slate-900/85 px-4 py-1.5 text-center text-[11px] font-semibold text-white sm:text-sm"><b>NAVIGATION:</b> Tap zones · Build defences · Prepare for the storm!</div></div>
        {hovered && hp && tip && (
          <div className="pointer-events-none absolute z-20 w-56 rounded-xl border border-white/30 bg-slate-900/90 p-3 text-xs text-white shadow-xl" style={{ left: clamp(tip.x + 14, 4, (wrap.current?.clientWidth ?? 600) - 232), top: clamp(tip.y + 14, 60, (wrap.current?.clientHeight ?? 400) - 130) }}>
            <b className="block text-sm">{hovered.name}</b>
            <span>Integrity {Math.round(hovered.integrity)}% · Productivity {Math.round(hp.productivity * 100)}%</span>
            <span className="mt-1 block text-slate-300">{hz ? `${HAZARDS[hz.type].name} risk: -${Math.round(hp.risk[hz.type] / 0.7 * (hz.intensity))} integrity` : `Top risk: ${(Object.keys(hp.risk) as HazardType[]).sort((a, b) => hp.risk[b] - hp.risk[a])[0].replace("_", " ")}`}</span>
            {!hovered.powered && <b className="block text-rose-300">Power out</b>}
          </div>
        )}
      </div>

      <div role="group" aria-label="Zones" className="flex flex-wrap gap-2">
        {ZONE_IDS.map((id) => (
          <button key={id} onClick={() => setSel(id)} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(id)} onBlur={() => setHover(null)} aria-pressed={sel === id}
            className={`${btn} ${sel === id ? "!bg-cyan-400 !text-slate-950" : ""}`}>{zoneLabel[id].split(" / ")[0].replace("SCHOOL", "School")}</button>
        ))}
      </div>

      <div role="status" aria-live="polite" className={`${panel} flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white`}>
        <span>XP: <b className="text-amber-300">{state.xp}</b></span>
        <span>ANTX credits: <b className="text-amber-300">{state.antx}</b></span>
        <span>Defense streak: <b className="text-emerald-300">{state.defenseStreak}</b></span>
        {state.lastHazard && <span>Last defence: <b className="capitalize text-cyan-300">{state.lastHazard.grade}</b></span>}
        {state.tick < state.festivalUntilTick && <b className="text-fuchsia-300">Carnival parade on: +15% production</b>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([["Pause", 0], ["1x", 1], ["2x", 2], ["4x", 4]] as const).map(([l, v]) => <button key={l} onClick={() => setSpeed(v)} aria-pressed={speed === v} className={`${btn} ${speed === v ? "!bg-cyan-400 !text-slate-950" : ""}`}>{l}</button>)}
        <button onClick={() => act({ type: "drone" })} disabled={state.antx < 25 || state.tick < state.droneCooldownUntil} className={btn}>Deploy emergency drones (25 ANTX)</button>
        <span className="text-sm text-amber-200">{toast}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${panel} lg:col-span-2`} aria-label="Zone">
          {z && zp ? (
            <>
              <h2 className="text-lg font-bold text-white">{z.name} <span className="text-sm font-normal text-slate-300">pop. {z.population}</span></h2>
              <p className="text-sm text-slate-300">{ZONES.find((d) => d.id === z.id)?.note}</p>
              <p className="mt-1 text-sm text-slate-200">Integrity <b className={z.integrity > 70 ? "text-emerald-300" : "text-amber-300"}>{Math.round(z.integrity)}%</b> · Productivity <b className="text-cyan-300">{Math.round(zp.productivity * 100)}%</b>
                {!z.powered && <b className="ml-2 text-rose-300">Power out</b>}{z.cutOff && <b className="ml-2 text-rose-300">Road blocked</b>}</p>
              <p className="mt-1 text-sm text-slate-200">{flows(zp).map(({ k, v }) => `${RES_LABEL[k]} ${Math.round(z.stock[k])} (${v >= 0 ? "+" : ""}${v.toFixed(1)}/10s)`).join("  ·  ")}</p>
              <p className="mt-1 text-xs text-slate-300">{(Object.keys(zp.risk) as HazardType[]).filter((k) => zp.exposure[k] > 0).map((k) => `${HAZARDS[k].name}: -${zp.risk[k]} pts (${Math.round(zp.mitigation[k] * 100)}% protected)`).join("  ·  ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btn} onClick={() => act({ type: "repair", zoneId: z.id })} disabled={z.integrity >= 100 && z.powered}>Repair (12 materials)</button>
                {BUILDINGS.filter((b) => !b.zones || b.zones.includes(z.id)).map((b) => {
                  const locked = b.requires?.some((r) => !state.blueprints.includes(r)), built = z.buildings.includes(b.id);
                  return <button key={b.id} className={btn} disabled={built || !!locked} title={locked ? "Needs a blueprint" : ""} onClick={() => act({ type: "build", zoneId: z.id, buildingId: b.id })}>{built ? "✓ " : ""}{b.name} ({b.cost.materials})</button>;
                })}
              </div>
            </>
          ) : <p className="text-sm text-slate-200">Tap a zone on the map.</p>}
        </section>

        <section className={panel} aria-label="Blueprints and convoys">
          <h2 className="text-lg font-bold text-white">Blueprints</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {BLUEPRINTS.map((b) => <button key={b.id} className={btn} disabled={state.blueprints.includes(b.id) || state.antx < b.cost} onClick={() => act({ type: "unlock", blueprintId: b.id })}>{state.blueprints.includes(b.id) ? "✓ " : ""}{b.name} ({b.cost} ANTX)</button>)}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-lg font-bold text-white">Convoy routes ({state.routes.filter((r) => r.enabled).length}/{state.routes.length})</summary>
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-sm text-slate-100">
              {state.routes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>{r.from} → {r.to}: {r.give.resource}{r.get ? ` for ${r.get.resource}` : ""}{r.viaMountainRoad && state.tick < r.blockedUntilTick ? " (blocked)" : ""}</span>
                  <button className={btn} onClick={() => act({ type: "toggleRoute", routeId: r.id })} aria-pressed={r.enabled}>{r.enabled ? "On" : "Off"}</button>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      <section className={panel} aria-label="Practice drills">
        <h2 className="text-lg font-bold text-white">Practice drills</h2>
        <p className="text-sm text-slate-200">Start a hazard on demand to rehearse. Drill runs are not eligible for platform rewards.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(HAZARDS) as HazardType[]).map((k) => <button key={k} className={btn} disabled={!!hz} onClick={() => act({ type: "forceHazard", hazard: k })}>{HAZARDS[k].name}</button>)}
        </div>
      </section>
    </div>
  );
}
