// Island Resilience 360 v2: shared types. The sim is deterministic: same seed + focus + player actions = same run.

export const RESOURCES = ["food", "energy", "water", "materials", "antx"] as const;
export type ResourceId = (typeof RESOURCES)[number];
export type Stock = Record<ResourceId, number>;

/** The eight interactive zones, exactly as labelled on the art-direction reference. */
export const ZONE_IDS = ["hub", "housing", "farm", "beach", "mountain", "jungle", "port", "carnival"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export type HazardType = "hurricane" | "landslide" | "flash_flood" | "coastal_erosion";
/** clear -> warning (hazard incoming) -> storm / hurricane (hazard active) -> aftermath (recovery window) -> clear */
export type WeatherPhase = "clear" | "warning" | "storm" | "hurricane" | "aftermath";
export type Season = "dry" | "early_rains" | "hurricane" | "late_rains";

export interface BuildingDef {
  id: string;
  name: string;
  cost: Partial<Stock>;
  /** Fraction of damage removed for each hazard (0..1). Multiple buildings stack multiplicatively (capped at 90%). */
  mitigates: Partial<Record<HazardType, number>>;
  produces?: Partial<Stock>;
  requires?: string[]; // blueprint ids
  keepsPower?: boolean;
  /** Zones where this can be placed. Omitted = anywhere. */
  zones?: ZoneId[];
}

export interface BlueprintDef {
  id: string;
  name: string;
  cost: number; // ANTX session credits
}

/** Static definition of a zone (balance data). */
export interface ZoneDef {
  id: ZoneId;
  name: string; // short name for panels
  label: string; // ribbon text on the map, as in the reference
  population: number;
  startingStock: Partial<Stock>;
  produces: Partial<Stock>; // per tick at 100% productivity
  consumes: Partial<Stock>; // per tick
  note: string;
}

export interface Zone {
  id: ZoneId;
  name: string;
  label: string;
  population: number;
  stock: Stock;
  produces: Partial<Stock>;
  consumes: Partial<Stock>;
  buildings: string[];
  integrity: number; // 0..100
  powered: boolean;
  outageUntilTick: number;
  cutOff: boolean; // reached only over a blocked road
  lastDamagedTick: number | null;
}

export interface TradeRoute {
  id: string;
  from: ZoneId;
  to: ZoneId;
  /** Shipped from `from` to `to`. */
  give: { resource: ResourceId; amount: number };
  /** Optional barter: shipped back from `to` to `from`. */
  get?: { resource: ResourceId; amount: number };
  everyTicks: number;
  enabled: boolean;
  /** True when the convoy uses the mountain stretch of the ring road, which landslides can block. */
  viaMountainRoad: boolean;
  blockedUntilTick: number;
  seasonal?: Partial<Record<Season, number>>;
}

export interface HazardDef {
  type: HazardType;
  name: string;
  warnTicks: number;
  durationTicks: number;
  exposure: Record<ZoneId, number>; // 0..1 per zone
  baseDamage: number; // integrity points at intensity 1, exposure 1, no mitigation
  causesOutage: boolean;
  blocksRoads: boolean;
}

export interface ActiveHazard {
  type: HazardType;
  startedTick: number;
  warnUntilTick: number;
  endsTick: number;
  intensity: number; // 0.4..1
  targets: ZoneId[];
  damageTaken: Partial<Record<ZoneId, number>>;
  /** What the damage would have been with no buildings; used to grade the defence. */
  rawDamage: Partial<Record<ZoneId, number>>;
}

export type RewardKind = "resource" | "trade" | "defense" | "rebuild" | "festival" | "drone";

export interface GameEvent {
  id: number;
  tick: number;
  kind: RewardKind | "warning" | "damage" | "info";
  zoneId?: ZoneId;
  /** Trade events carry the destination so the renderer can run a convoy along the ring road. */
  toZoneId?: ZoneId;
  label: string;
  xp?: number;
  antx?: number;
}

export interface GameState {
  tick: number;
  seed: number;
  rng: number;
  /** Platform-supplied focus score (0..100). Fixed for the run; mildly boosts productivity (never penalises). */
  focus: number;
  season: Season;
  weather: { phase: WeatherPhase; intensity: number; windDir: number };
  hazard: ActiveHazard | null;
  lastHazard: { type: HazardType; endedTick: number; intensity: number; grade: "perfect" | "solid" | "rough" } | null;
  aftermathUntilTick: number;
  roadBlockedUntilTick: number;
  nextHazardTick: number;
  zones: Zone[];
  routes: TradeRoute[];
  blueprints: string[];
  xp: number;
  antx: number;
  defenseStreak: number;
  resilience: number; // 0..100 island average integrity
  eventSeq: number;
  festivalUntilTick: number;
  droneCooldownUntil: number;
  hazardsSeen: number;
  hazardsPrepared: number;
  totals: { xp: number; antx: number; perfectDefenses: number; rebuilds: number };
}

export type Action =
  | { type: "build"; zoneId: ZoneId; buildingId: string }
  | { type: "repair"; zoneId: ZoneId }
  | { type: "toggleRoute"; routeId: string }
  | { type: "drone" }
  | { type: "unlock"; blueprintId: string }
  | { type: "forceHazard"; hazard: HazardType }; // demo/testing only; the server never trusts this
