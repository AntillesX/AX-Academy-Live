export interface GameDefinition {
  id: string;
  title: string;
  route: string;
  description: string;
  component: string;
  accent: string;
  label: string;
}

export const games: readonly GameDefinition[] = [
  { id: 'neon-drift', title: 'NEON//DRIFT 4D', route: '/arcade', description: 'A responsive 3D racing focus run.', component: 'AntxVelocity4D', accent: 'red', label: 'Racing focus' },
  { id: 'island-resilience', title: 'Island Resilience 360', route: '/arcade/island-resilience', description: 'An eight-zone eco-strategy simulator.', component: 'IslandEngine', accent: 'amber', label: 'Eco-strategy' },
  { id: 'carib-cargo', title: 'CARIB CARGO', route: '/games/carib-cargo', description: 'Route safe cargo through the island logistics network.', component: 'CargoGame', accent: 'yellow', label: 'Logistics sim' },
  { id: 'carib-skydive', title: 'SKY FAAAALLL', route: '/games/carib-skydive', description: 'A true 3D Theo Island run through FOOD, MEDICAL, SOLAR, and WATER rings.', component: 'SkyFaaalll', accent: 'cyan', label: '3D skydiving' },
  { id: 'coastal-fishing', title: 'FISH & TIDE', route: '/games/tide-net', description: 'Theo Island East Port fishing and tide-cycle supply run.', component: 'FishAndTide', accent: 'cyan', label: 'Marine survey' },
  { id: 'agri-tech', title: 'AGRI-TECH', route: '/curriculum', description: 'Optimise food systems with science and data.', component: 'CurriculumHub', accent: 'lime', label: 'Precision farming' },
  { id: 'eco-shield', title: 'ECO-SHIELD', route: '/arcade/island-resilience', description: 'Coordinate resilience planning across eight zones.', component: 'IslandEngine', accent: 'emerald', label: 'Resilience ops' },
  { id: 'carnival-flow', title: 'CARNIVAL FLOW', route: '/community', description: 'Balance culture, events, and community energy.', component: 'CommunityHub', accent: 'fuchsia', label: 'Culture + rhythm' },
];
