export interface GameDefinition { id: string; title: string; route: string; description: string; component: string; }
export const games: readonly GameDefinition[] = [
  { id: 'neon-drift', title: 'NEON//DRIFT 4D', route: '/arcade', description: 'A responsive 3D racing focus run.', component: 'AntxVelocity4D' },
  { id: 'island-resilience', title: 'Island Resilience 360', route: '/arcade/island-resilience', description: 'An eight-zone eco-strategy simulator.', component: 'IslandEngine' },
  { id: 'coastal-fishing', title: 'Coastal Fishing', route: '/games/coastal-fishing', description: 'Tide & Net: practise sustainable fishing decisions.', component: 'CoastalFishing' },
];
