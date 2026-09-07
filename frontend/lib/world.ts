export type ShapeType = 'shield' | 'platform' | 'bean' | 'leaf' | 'island' | 'compact' | 'ice' | 'shard' | 'spark';
export type Terrain = 'ridge' | 'terraces' | 'plain' | 'slope' | 'hills' | 'ice';
export type Point = [number, number];
export const familiarityColors = ['#D8D4C3', '#B8C4A3', '#93A883', '#718A66'] as const;
export const coverage = { ocean: .60, land: .32, ice: .08 };

export interface Region {
  id: string; name: string; description: string; detail: string; symbol: string;
  size: 'large' | 'medium' | 'islands' | 'polar' | 'tiny';
  shapeType: ShapeType; terrainBias: Terrain; ruggedness: number;
  defaultFamiliarity: 0 | 1 | 2 | 3; landWeight: number;
  latitude: number; longitude: number; islandCount: number;
  buildingCount: number; treeCount: number; landmark: string;
}

export const regions: Region[] = [
  { id: 'research', name: 'Research', description: 'A home for deeper questions.', detail: 'Research, papers & connected knowledge', symbol: '✧', size: 'large', shapeType: 'shield', terrainBias: 'ridge', ruggedness: .65, defaultFamiliarity: 3, landWeight: 18, latitude: 22, longitude: -28, islandCount: 3, buildingCount: 5, treeCount: 5, landmark: 'observatory' },
  { id: 'workbench', name: 'Workbench', description: 'Where ideas become real.', detail: 'Projects, experiments & things you make', symbol: '▧', size: 'large', shapeType: 'platform', terrainBias: 'terraces', ruggedness: .5, defaultFamiliarity: 2, landWeight: 16, latitude: -35, longitude: 35, islandCount: 2, buildingCount: 7, treeCount: 3, landmark: 'workshop' },
  { id: 'living', name: 'Living', description: 'Make yourself at home.', detail: 'Daily life, plans & familiar comforts', symbol: '☼', size: 'large', shapeType: 'bean', terrainBias: 'plain', ruggedness: .1, defaultFamiliarity: 2, landWeight: 18, latitude: -10, longitude: -112, islandCount: 1, buildingCount: 5, treeCount: 12, landmark: 'home' },
  { id: 'growth', name: 'Growth', description: 'A little further, every day.', detail: 'Learning, languages & next steps', symbol: '↟', size: 'medium', shapeType: 'leaf', terrainBias: 'slope', ruggedness: .3, defaultFamiliarity: 1, landWeight: 12, latitude: 16, longitude: 78, islandCount: 0, buildingCount: 3, treeCount: 5, landmark: 'lighthouse' },
  { id: 'hobby', name: 'Hobby Isles', description: 'Take the scenic route.', detail: 'Mountains, movement & creative detours', symbol: '❋', size: 'islands', shapeType: 'island', terrainBias: 'hills', ruggedness: .75, defaultFamiliarity: 2, landWeight: 10, latitude: -46, longitude: -172, islandCount: 6, buildingCount: 1, treeCount: 15, landmark: 'camp' },
  { id: 'archive', name: 'Archive', description: 'Keep what matters close.', detail: 'Memories, reflections & collected things', symbol: '▤', size: 'medium', shapeType: 'compact', terrainBias: 'terraces', ruggedness: .12, defaultFamiliarity: 2, landWeight: 8, latitude: 0, longitude: 151, islandCount: 0, buildingCount: 3, treeCount: 3, landmark: 'archive' },
  { id: 'exploration', name: 'Exploration Ice', description: 'There is still more out there.', detail: 'Someday, maybe & the unexplored', symbol: '❄', size: 'polar', shapeType: 'ice', terrainBias: 'ice', ruggedness: .85, defaultFamiliarity: 0, landWeight: 0, latitude: 90, longitude: 0, islandCount: 5, buildingCount: 1, treeCount: 0, landmark: 'beacon' },
  { id: 'spark', name: 'Spark Islands', description: 'Every idea starts somewhere.', detail: 'Loose thoughts, drafts & little sparks', symbol: '✦', size: 'tiny', shapeType: 'spark', terrainBias: 'plain', ruggedness: .6, defaultFamiliarity: 0, landWeight: 2.5, latitude: 0, longitude: 0, islandCount: 8, buildingCount: 1, treeCount: 0, landmark: 'mailbox' },
];

// Authored outlines preserve each region's silhouette, bays and peninsula.
export const outlines: Record<ShapeType, Point[]> = {
  shield: [[-.14,1.1],[.16,.83],[.24,.55],[.50,.65],[.57,.33],[.83,.35],[.60,.04],[1.18,-.08],[1.28,-.27],[.65,-.23],[.77,-.58],[.40,-.84],[.05,-1],[-.29,-.86],[-.62,-.93],[-.88,-.66],[-.95,-.25],[-.67,-.12],[-.88,.17],[-.67,.45],[-.40,.40],[-.43,.76]],
  platform: [[-.72,.83],[.40,.83],[.44,.62],[.85,.59],[.90,.26],[.53,.26],[.53,.02],[.93,.02],[.89,-.57],[.53,-.57],[.43,-.85],[-.23,-.85],[-.23,-.51],[-.46,-.51],[-.46,-.81],[-.87,-.58],[-.87,-.12],[-.57,-.12],[-.57,.12],[-1,.12],[-1,.55],[-.72,.55]],
  bean: [[.08,.87],[.48,.85],[.82,.65],[1,.30],[.99,-.08],[.82,-.45],[.51,-.72],[.10,-.85],[-.33,-.79],[-.72,-.55],[-.96,-.20],[-1,.17],[-.85,.50],[-.54,.73],[-.30,.66]],
  leaf: [[.08,1.35],[.42,1.01],[.53,.61],[.44,.23],[.27,-.10],[.30,-.47],[.49,-.83],[.30,-1.12],[-.04,-1.01],[-.36,-.65],[-.48,-.22],[-.43,.15],[-.21,.42],[-.05,.77]],
  compact: [[-.66,.63],[.60,.63],[.86,.42],[.91,-.33],[.64,-.59],[-.61,-.59],[-.84,-.36],[-.88,.15],[-.72,.22],[-.88,.34]],
  island: [[-.3,.92],[.1,.72],[.46,.86],[.6,.4],[.91,.19],[.67,-.1],[.78,-.49],[.32,-.62],[.02,-.96],[-.26,-.71],[-.64,-.73],[-.56,-.27],[-.95,-.07],[-.69,.22],[-.74,.64]],
  ice: [[-.2,1],[.11,.85],[.34,1.03],[.48,.66],[.78,.73],[.72,.38],[1,.2],[.72,.02],[.91,-.31],[.58,-.42],[.66,-.77],[.27,-.65],[.1,-1],[-.14,-.8],[-.49,-.94],[-.48,-.61],[-.81,-.68],[-.69,-.31],[-1,-.17],[-.75,.07],[-.91,.42],[-.53,.48],[-.55,.82]],
  shard: [[-.85,.35],[-.22,.77],[.68,.51],[.80,-.26],[.17,-.72],[-.63,-.49]],
  spark: [[-.31,.8],[.58,.56],[.85,-.09],[.13,-.76],[-.68,-.34],[-.83,.18]],
};

export interface Landmass {
  id: string; regionId: string; latitude: number; longitude: number;
  shapeType: ShapeType; surfaceShare: number; familiarity: number; main: boolean; rotation: number;
}
const weightTotal = regions.reduce((sum, r) => sum + r.landWeight, 0);
export const regionSurfaceShare = (r: Region) => r.id === 'exploration' ? coverage.ice : coverage.land * r.landWeight / weightTotal;

export const landmasses: Landmass[] = regions.flatMap(region => {
  const share = regionSurfaceShare(region);
  const piece = (i: number, lat: number, lon: number, fraction: number, shape = region.shapeType, main = false): Landmass => ({
    id: `${region.id}-${i}`, regionId: region.id, latitude: lat, longitude: lon,
    shapeType: shape, surfaceShare: share * fraction, familiarity: region.defaultFamiliarity,
    main, rotation: main ? 0 : i * .63,
  });
  if (region.id === 'hobby') return [
    piece(0, -35, -172, .44, 'island', true), piece(1, -49, -132, .20),
    piece(2, -68, -154, .15), piece(3, -56, 150, .09), piece(4, -13, 179, .07), piece(5, -23, -146, .05),
  ].map((p, i) => ({ ...p, familiarity: [3, 2, 1, 2, 0, 1][i] }));
  if (region.id === 'spark') return [[-8,-64],[-57,-41],[-66,67],[-21,99],[23,121],[43,-101],[-36,-82],[2,30]].map(([lat, lon], i) => piece(i, lat, lon, 1 / 8, 'spark', i === 0));
  if (region.id === 'exploration') return [piece(0, 90, 0, .86, 'ice', true), ...[4,122,172,230,280].map((lon, i) => piece(i + 1, 47, lon, .14 / 5, 'shard'))];
  const neighbors: Record<string, Point[]> = { research: [[4,6],[-5,1],[9,-69]], workbench: [[-22,-12],[-70,4]], living: [[-7,-151]] };
  const islands = neighbors[region.id] ?? [];
  return [piece(0, region.latitude, region.longitude, islands.length ? .94 : 1, region.shapeType, true), ...islands.map(([lat, lon], i) => piece(i + 1, lat, lon, .06 / islands.length, 'island'))];
});

export function surfacePoint(latitude: number, longitude: number, radius = 2.5): [number, number, number] {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}




