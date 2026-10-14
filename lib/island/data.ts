import { arcCrossesMountain } from "./layout";
import type { BlueprintDef, BuildingDef, GameState, HazardDef, HazardType, Season, Stock, TradeRoute, ZoneDef, ZoneId } from "./types";

/** Single source of truth for balance. Exported as JSON (schema/island-economy.sample.json) for designers and admin tools. */
export const BALANCE_VERSION = "2.0.0";
export const TICKS_PER_SEASON = 240;
export const REAL_MS_PER_TICK = 500;
export const SEASONS: Season[] = ["dry", "early_rains", "hurricane", "late_rains"];

/** Per-run ceilings for session credits. The server enforces lower daily caps on top. */
export const RUN_CAPS = { xp: 2000, antx: 150 } as const;
/** A source zone never ships its last units: shipments leave this much behind. */
export const ROUTE_RESERVE = 20;
/** Defence grading: population-weighted damage taken as a share of what the hazard would have done with no buildings. */
export const GRADE = { perfect: 0.45, solid: 0.7, minExposure: 0.3 } as const;
/** Focus Score (platform supplied, 0..100) gives up to +8% productivity above 50. It never reduces output. */
export const FOCUS_BONUS_MAX = 0.08;
export const JUNGLE_BUFFER = 0.15; // flood + landslide damage removed island-wide at full jungle integrity
export const AFTERMATH_TICKS = 60;
export const CARNIVAL_MIN_INTEGRITY = 60;

export const BLUEPRINTS: BlueprintDef[] = [
  { id: "coastal_eng", name: "Coastal Engineering", cost: 30 },
  { id: "hurricane_code", name: "Hurricane Building Code", cost: 40 },
  { id: "drainage_eng", name: "Drainage Engineering", cost: 25 },
  { id: "desal", name: "Desalination", cost: 35 },
  { id: "microgrid", name: "Solar Microgrids", cost: 30 },
];

const ALL_BUT_JUNGLE: ZoneId[] = ["hub", "housing", "farm", "beach", "mountain", "port", "carnival"];

export const BUILDINGS: BuildingDef[] = [
  { id: "sea_wall", name: "Sea Wall", cost: { materials: 30 }, mitigates: { hurricane: 0.15, flash_flood: 0.1, coastal_erosion: 0.7 }, requires: ["coastal_eng"], zones: ["beach", "port", "carnival"] },
  { id: "concrete_roofs", name: "Concrete Roofs", cost: { materials: 40 }, mitigates: { hurricane: 0.45 }, requires: ["hurricane_code"], zones: ALL_BUT_JUNGLE },
  { id: "storm_shutters", name: "Storm Shutters", cost: { materials: 20 }, mitigates: { hurricane: 0.2 }, zones: ["hub", "housing", "beach", "carnival", "port"] },
  { id: "windbreak", name: "Windbreak Trees", cost: { materials: 15 }, mitigates: { hurricane: 0.12, landslide: 0.1 }, zones: ["farm", "housing", "mountain", "jungle"] },
  { id: "solar_microgrid", name: "Solar Microgrid", cost: { materials: 35 }, mitigates: { hurricane: 0.1 }, produces: { energy: 0.8 }, keepsPower: true, requires: ["microgrid"], zones: ["hub", "housing", "port", "farm", "mountain", "carnival"] },
  { id: "aquaponics", name: "Aquaponics", cost: { materials: 30 }, mitigates: { flash_flood: 0.2 }, produces: { food: 0.8 }, zones: ["beach", "hub", "housing"] },
  { id: "drainage", name: "Drainage Channels", cost: { materials: 25 }, mitigates: { flash_flood: 0.55, landslide: 0.35 }, requires: ["drainage_eng"] },
  { id: "terracing", name: "Slope Terracing", cost: { materials: 30 }, mitigates: { landslide: 0.5, flash_flood: 0.15 }, zones: ["mountain", "farm", "jungle"] },
  { id: "pump_station", name: "Pump Station", cost: { materials: 20 }, mitigates: { flash_flood: 0.4 }, zones: ["farm", "housing", "hub", "port", "beach", "carnival"] },
  { id: "desal_plant", name: "Desalination Plant", cost: { materials: 45 }, mitigates: {}, produces: { water: 1.0 }, requires: ["desal"], zones: ["beach", "port"] },
  { id: "mangroves", name: "Mangrove Buffer", cost: { materials: 25 }, mitigates: { coastal_erosion: 0.5, hurricane: 0.1, flash_flood: 0.1 }, zones: ["beach", "port"] },
];

const exp = (e: Partial<Record<ZoneId, number>>): Record<ZoneId, number> => ({ hub: 0, housing: 0, farm: 0, beach: 0, mountain: 0, jungle: 0, port: 0, carnival: 0, ...e });

export const HAZARDS: Record<HazardType, HazardDef> = {
  hurricane: { type: "hurricane", name: "Hurricane", warnTicks: 40, durationTicks: 50, baseDamage: 38, causesOutage: true, blocksRoads: false,
    exposure: exp({ beach: 1, port: 0.9, carnival: 0.7, housing: 0.6, farm: 0.6, jungle: 0.5, hub: 0.45, mountain: 0.4 }) },
  landslide: { type: "landslide", name: "Landslide", warnTicks: 25, durationTicks: 20, baseDamage: 18, causesOutage: false, blocksRoads: true,
    exposure: exp({ mountain: 1, jungle: 0.5, farm: 0.15, housing: 0.05 }) },
  flash_flood: { type: "flash_flood", name: "Flash Flood", warnTicks: 30, durationTicks: 30, baseDamage: 24, causesOutage: false, blocksRoads: false,
    exposure: exp({ mountain: 0.8, farm: 0.7, housing: 0.6, beach: 0.6, jungle: 0.5, port: 0.5, hub: 0.3, carnival: 0.3 }) },
  coastal_erosion: { type: "coastal_erosion", name: "Coastal Erosion", warnTicks: 10, durationTicks: 120, baseDamage: 12, causesOutage: false, blocksRoads: false,
    exposure: exp({ beach: 1, port: 0.6, carnival: 0.1, housing: 0.1 }) },
};

export const HAZARD_ODDS: Record<Season, Record<HazardType, number>> = {
  dry: { hurricane: 0, landslide: 0.2, flash_flood: 0.1, coastal_erosion: 0.7 },
  early_rains: { hurricane: 0.05, landslide: 0.35, flash_flood: 0.4, coastal_erosion: 0.2 },
  hurricane: { hurricane: 0.4, landslide: 0.2, flash_flood: 0.25, coastal_erosion: 0.15 },
  late_rains: { hurricane: 0.15, landslide: 0.3, flash_flood: 0.35, coastal_erosion: 0.2 },
};
export const HAZARD_GAP: Record<Season, [number, number]> = { dry: [320, 520], early_rains: [200, 320], hurricane: [140, 230], late_rains: [200, 320] };

export const ZONES: ZoneDef[] = [
  { id: "hub", name: "Central Hub", label: "CENTRAL HUB", population: 150, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { energy: 1.4, antx: 0.05 }, consumes: { food: 0.5, water: 0.35, energy: 0.3 }, note: "Solar roof, learning lab and the island's emergency radio." },
  { id: "housing", name: "Housing Row", label: "HOUSING ROW", population: 260, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { materials: 0.3 }, consumes: { food: 1.2, water: 0.9, energy: 0.5 }, note: "Most of the island lives here. Roofs and shutters matter most." },
  { id: "farm", name: "Farm & Animals", label: "FARM & ANIMALS", population: 70, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { food: 3.4 }, consumes: { water: 0.8, energy: 0.2 }, note: "Feeds the island. Floods flatten crops." },
  { id: "beach", name: "Beach & Fishing Dock", label: "BEACH & FISHING DOCK", population: 90, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { food: 2.0, water: 0.3 }, consumes: { food: 0.3, water: 0.2, energy: 0.1 }, note: "First in the path of every storm surge." },
  { id: "mountain", name: "Mountain Countryside", label: "MOUNTAIN COUNTRYSIDE", population: 60, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { water: 2.8, materials: 1.2, energy: 0.7 }, consumes: { food: 0.5, water: 0.2, energy: 0.2 }, note: "Springs, timber and hydro. Landslides can cut the road." },
  { id: "jungle", name: "Rainforest Jungle", label: "RAINFOREST JUNGLE", population: 20, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { water: 1.0, food: 0.8, materials: 0.3 }, consumes: {}, note: "A living buffer: a healthy forest soaks up flood and landslide damage island-wide." },
  { id: "port", name: "Port Cargo", label: "PORT CARGO", population: 130, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { materials: 1.3, energy: 0.5 }, consumes: { food: 0.6, water: 0.5, energy: 0.4 }, note: "Imports materials for every rebuild." },
  { id: "carnival", name: "Carnival Parade Route", label: "CARNIVAL PARADE ROUTE", population: 40, startingStock: { food: 60, water: 60, materials: 60, energy: 60 },
    produces: { materials: 0.2 }, consumes: { food: 0.3, water: 0.2, energy: 0.4 }, note: "Festivals can only start when the parade route is in good repair." },
];

type RouteSeed = Omit<TradeRoute, "blockedUntilTick" | "viaMountainRoad" | "enabled" | "everyTicks"> & { everyTicks?: number };
const R = (id: string, from: ZoneId, to: ZoneId, give: TradeRoute["give"], get?: TradeRoute["get"], seasonal?: TradeRoute["seasonal"]): RouteSeed => ({ id, from, to, give, get, seasonal });
const ROUTE_SEEDS: RouteSeed[] = [
  R("r_farm_housing", "farm", "housing", { resource: "food", amount: 28 }),
  R("r_farm_hub", "farm", "hub", { resource: "food", amount: 12 }),
  R("r_farm_mountain", "farm", "mountain", { resource: "food", amount: 12 }),
  R("r_beach_port", "beach", "port", { resource: "food", amount: 14 }, { resource: "materials", amount: 6 }, { hurricane: 1.25 }),
  R("r_beach_carnival", "beach", "carnival", { resource: "food", amount: 7 }),
  R("r_mtn_farm_w", "mountain", "farm", { resource: "water", amount: 18 }),
  R("r_mtn_housing_w", "mountain", "housing", { resource: "water", amount: 20 }),
  R("r_mtn_hub_w", "mountain", "hub", { resource: "water", amount: 8 }),
  R("r_jungle_port_w", "jungle", "port", { resource: "water", amount: 12 }),
  R("r_jungle_carnival_w", "jungle", "carnival", { resource: "water", amount: 5 }),
  R("r_hub_housing_e", "hub", "housing", { resource: "energy", amount: 12 }),
  R("r_hub_carnival_e", "hub", "carnival", { resource: "energy", amount: 10 }),
  R("r_mtn_farm_e", "mountain", "farm", { resource: "energy", amount: 5 }),
  R("r_mtn_beach_e", "mountain", "beach", { resource: "energy", amount: 3 }),
  R("r_port_hub_m", "port", "hub", { resource: "materials", amount: 6 }),
  R("r_port_farm_m", "port", "farm", { resource: "materials", amount: 6 }),
  R("r_port_beach_m", "port", "beach", { resource: "materials", amount: 6 }),
];
export const ROUTES: Omit<TradeRoute, "blockedUntilTick">[] = ROUTE_SEEDS.map((r) => ({
  ...r, everyTicks: r.everyTicks ?? 20, enabled: true, viaMountainRoad: arcCrossesMountain(r.from, r.to),
}));

const stock = (s: Partial<Stock> = {}): Stock => ({ food: 0, energy: 0, water: 0, materials: 0, antx: 0, ...s });

export function createInitialState(seed = 360, focus = 92): GameState {
  return {
    tick: 0, seed, rng: seed >>> 0 || 1, focus: Math.min(100, Math.max(0, Math.round(focus))), season: "dry",
    weather: { phase: "clear", intensity: 0, windDir: 0.6 },
    hazard: null, lastHazard: null, aftermathUntilTick: 0, roadBlockedUntilTick: 0, nextHazardTick: 220,
    zones: ZONES.map((z) => ({ id: z.id, name: z.name, label: z.label, population: z.population, stock: stock(z.startingStock), produces: { ...z.produces }, consumes: { ...z.consumes },
      buildings: [], integrity: 100, powered: true, outageUntilTick: 0, cutOff: false, lastDamagedTick: null })),
    routes: ROUTES.map((r) => ({ ...r, blockedUntilTick: 0 })),
    blueprints: [], xp: 0, antx: 30, defenseStreak: 0, resilience: 100, eventSeq: 0, festivalUntilTick: 0, droneCooldownUntil: 0,
    hazardsSeen: 0, hazardsPrepared: 0,
    totals: { xp: 0, antx: 0, perfectDefenses: 0, rebuilds: 0 },
  };
}
