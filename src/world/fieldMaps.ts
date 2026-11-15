import { NavigationGrid, PRONTERA_NAV } from './pathfinding';
import {
  CircleCollider,
  LandmarkSpec,
  LANDMARKS,
  PLAYER_SPAWN,
  RectCollider,
  TreeSpec,
  WORLD_COLLIDERS,
  getDistrictAt,
  groundHeightAt,
} from './pronteraLayout';

export type ZoneId =
  | 'prontera'
  | 'prt_fild08'
  | 'prt_fild06'
  | 'prt_fild05'
  | 'prt_fild01';

export interface PortalSpec {
  id: string;
  fromZone: ZoneId;
  toZone: ZoneId;
  label: string;
  subtitle: string;
  x: number;
  z: number;
  rotY: number;
  targetX: number;
  targetZ: number;
  targetYaw: number;
  color: number;
}

export interface TerraceHillSpec {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  height: number;
  rot?: number;
  flatTop?: number; // 0..1 fraction of radius that stays plateau-flat before cliff drop
}

export interface WaterCoveSpec {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
}

export interface BridgeSpec {
  x: number;
  z: number;
  length: number;
  width: number;
  rotY: number;
}

export interface BoulderSpec {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  kind: 'cliff' | 'mossy';
}

export interface FieldTreeSpec extends Omit<TreeSpec, 'kind'> {
  kind: 'oak' | 'cypress' | 'pine' | 'birch';
}

export interface FieldMapSpec {
  id: Exclude<ZoneId, 'prontera'>;
  name: string;
  subtitle: string;
  directionLabel: string;
  playableExtent: number; // +/- extent (205 => 410x410m playable)
  renderExtent: number; // +/- extent (255 => 510x510m rendered)
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  cityWallEdge: 'north' | 'south' | 'east' | 'west';
  cityWallCoord: number; // wall center along that axis
  /** Multi-point winding dirt trails (each polyline is [x, z][]) */
  trails: [number, number][][];
  trailWidth: number;
  terraces: TerraceHillSpec[];
  waterCoves: WaterCoveSpec[];
  bridges: BridgeSpec[];
  /** Forest grove centers [cx, cz, radius, density] */
  groves: [number, number, number, number][];
  /** Named sub-regions for HUD district label */
  regions: { name: string; x: number; z: number; radius: number }[];
  portals: PortalSpec[];
  trees: FieldTreeSpec[];
  boulders: BoulderSpec[];
}

export const PRONTERA_PORTALS: PortalSpec[] = [
  {
    id: 'portal_to_south',
    fromZone: 'prontera',
    toZone: 'prt_fild08',
    label: 'Jižní kaldgardské louky (kld_fild08)',
    subtitle: 'Rozlehlá jarní pole, vlci, skřeti a prastaří enti',
    x: 0,
    z: 99,
    rotY: 0,
    targetX: 0,
    targetZ: -170,
    targetYaw: 0,
    color: 0x38e8b0,
  },
  {
    id: 'portal_to_east',
    fromZone: 'prontera',
    toZone: 'prt_fild06',
    label: 'Východní kaldgardské údolí (kld_fild06)',
    subtitle: 'Hluboké háje, bystřina, enti a smečky vlků',
    x: 99,
    z: 0,
    rotY: Math.PI / 2,
    targetX: -170,
    targetZ: 0,
    targetYaw: Math.PI / 2,
    color: 0x52e0ff,
  },
  {
    id: 'portal_to_west',
    fromZone: 'prontera',
    toZone: 'prt_fild05',
    label: 'Západní kaldgardské pastviny (kld_fild05)',
    subtitle: 'Terasovité kopce, kaňony, skřeti a vlci',
    x: -99,
    z: 0,
    rotY: -Math.PI / 2,
    targetX: 170,
    targetZ: 0,
    targetYaw: -Math.PI / 2,
    color: 0xffb84d,
  },
  {
    id: 'portal_to_north',
    fromZone: 'prontera',
    toZone: 'prt_fild01',
    label: 'Severní kaldgardský hvozd (kld_fild01)',
    subtitle: 'Horské louky za hradem, enti, vlci a skřeti',
    x: 0,
    z: -56.5,
    rotY: 0,
    targetX: 0,
    targetZ: 170,
    targetYaw: Math.PI,
    color: 0x9c82ff,
  },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function distToSegmentSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) return wx * wx + wz * wz;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const cx = ax + vx * t;
  const cz = az + vz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

function computeTrailMinDist(x: number, z: number, trails: [number, number][][]): number {
  let minSq = 1e9;
  for (let t = 0; t < trails.length; t++) {
    const pts = trails[t];
    for (let i = 0; i < pts.length - 1; i++) {
      const dSq = distToSegmentSq(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (dSq < minSq) minSq = dSq;
    }
  }
  return Math.sqrt(minSq);
}

function isOnBridge(x: number, z: number, bridges: BridgeSpec[], pad = 0.6): boolean {
  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    const cos = Math.cos(-b.rotY);
    const sin = Math.sin(-b.rotY);
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= b.width * 0.5 + pad && Math.abs(lz) <= b.length * 0.5 + pad) {
      return true;
    }
  }
  return false;
}

function seededRand(seedInit: number): () => number {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function computeRawFieldHeight(spec: FieldMapSpec, x: number, z: number, trailDist: number): number {
  // Natural rolling hills + multi-scale meadow knolls & undulations (terénní nerovnosti)
  const wallProx =
    spec.cityWallEdge === 'north'
      ? smoothstep(-185, -148, z)
      : spec.cityWallEdge === 'south'
        ? smoothstep(185, 148, z)
        : spec.cityWallEdge === 'west'
          ? smoothstep(-185, -148, x)
          : smoothstep(185, 148, x);

  const macroWave =
    Math.sin(x * 0.022 + z * 0.017) * 1.65 +
    Math.cos(x * 0.015 - z * 0.027) * 1.30 +
    Math.sin(x * 0.036 - z * 0.032) * 0.85;
  const microKnolls =
    Math.sin(x * 0.068 + z * 0.054) * Math.cos(x * 0.049 - z * 0.062) * 0.72 +
    Math.sin(x * 0.115 - z * 0.095) * 0.28;

  // Dampen micro-hummocks right on the road centerline so roads remain smooth and comfortable
  const offRoadFactor = smoothstep(spec.trailWidth * 0.45, spec.trailWidth * 1.9, trailDist);
  const rolling = (2.65 + macroWave + microKnolls * (0.35 + 0.65 * offRoadFactor)) * wallProx;

  // Terraced plateaus with rocky cliff escarpments
  let terraceLift = 0;
  for (let i = 0; i < spec.terraces.length; i++) {
    const t = spec.terraces[i];
    const dx = x - t.cx;
    const dz = z - t.cz;
    const rot = t.rot ?? 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const lx = (dx * cos - dz * sin) / t.rx;
    const lz = (dx * sin + dz * cos) / t.rz;
    const wobble = 0.09 * Math.sin(lx * 4.2 + lz * 3.1) + 0.05 * Math.cos(lx * 7.5 - lz * 6.2);
    const r = Math.hypot(lx, lz) + wobble;
    const flatTop = t.flatTop ?? 0.64;
    // Sharp cliff rise from r=1.02 down to plateau flatTop
    const ramp = 1 - smoothstep(flatTop, 1.02, r);
    if (ramp > 0.001) {
      terraceLift = Math.max(terraceLift, t.height * ramp);
    }
  }

  // Smooth trails gently ramp across terraces so roads stay walkable (zero impassable road cliffs!)
  const trailFlatten = 1 - smoothstep(spec.trailWidth * 0.65, spec.trailWidth * 2.1, trailDist);
  const effectiveTerrace = terraceLift * (1 - trailFlatten * 0.72);

  // Outer perimeter mountain rim beyond playable extent (205..255)
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  const rimT = smoothstep(200, 248, edgeDist);
  // Keep portal corridors open against border wall edge
  let portalNotch = 1;
  for (let i = 0; i < spec.portals.length; i++) {
    const p = spec.portals[i];
    if (Math.hypot(x - p.x, z - p.z) < 22) {
      portalNotch = 0;
      break;
    }
  }
  const rimHill = rimT * 13.5 * portalNotch * wallProx;

  // Carve water coves smoothly down to -1.75m lakebed (below water level -0.35m)
  let waterMask = 0;
  for (let i = 0; i < spec.waterCoves.length; i++) {
    const c = spec.waterCoves[i];
    const lx = (x - c.cx) / c.rx;
    const lz = (z - c.cz) / c.rz;
    const wobble = 0.1 * Math.sin(lx * 3.5 + lz * 4.2);
    const r = Math.hypot(lx, lz) + wobble;
    const coveMask = 1 - smoothstep(0.58, 1.04, r);
    if (coveMask > waterMask) waterMask = coveMask;
  }

  // Keep spawn & portal pads gently leveled
  let padFlatten = 1;
  for (let i = 0; i < spec.portals.length; i++) {
    const p = spec.portals[i];
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < 16) padFlatten = Math.min(padFlatten, smoothstep(8, 16, d));
  }
  const dSpawn = Math.hypot(x - spec.spawnX, z - spec.spawnZ);
  if (dSpawn < 16) padFlatten = Math.min(padFlatten, smoothstep(8, 16, dSpawn));

  const dryHeight = (rolling * 0.86 + effectiveTerrace + rimHill) * (0.2 + 0.8 * padFlatten);
  return dryHeight * (1 - waterMask) + -1.75 * waterMask;
}

function populateFieldProps(spec: FieldMapSpec, seedOffset: number) {
  const rand = seededRand(9001 + seedOffset * 1337);
  const trees: FieldTreeSpec[] = [];
  const boulders: BoulderSpec[] = [];

  const isNearPortalOrTrail = (x: number, z: number, trailPad = 5.2, portalPad = 14) => {
    for (const p of spec.portals) {
      if (Math.hypot(x - p.x, z - p.z) < portalPad) return true;
    }
    if (Math.hypot(x - spec.spawnX, z - spec.spawnZ) < 12) return true;
    if (computeTrailMinDist(x, z, spec.trails) < spec.trailWidth + trailPad) return true;
    if (isOnBridge(x, z, spec.bridges, 4.0)) return true;
    return false;
  };

  const isNearCityWall = (x: number, z: number) => {
    const wc = spec.cityWallCoord;
    if (spec.cityWallEdge === 'north' && z < wc + 10) return true;
    if (spec.cityWallEdge === 'south' && z > wc - 10) return true;
    if (spec.cityWallEdge === 'west' && x < wc + 10) return true;
    if (spec.cityWallEdge === 'east' && x > wc - 10) return true;
    return false;
  };

  const tryPlaceTree = (x: number, z: number) => {
    if (Math.abs(x) > 202 || Math.abs(z) > 202) return;
    if (isNearCityWall(x, z)) return;
    if (isNearPortalOrTrail(x, z, 4.6, 13)) return;
    const tDist = computeTrailMinDist(x, z, spec.trails);
    const h = computeRawFieldHeight(spec, x, z, tDist);
    if (h < 0.05) return; // avoid water coves & wet shoreline

    // Keep trees off steep sheer cliff drops
    const hx = computeRawFieldHeight(spec, x + 2.0, z, tDist);
    const hz = computeRawFieldHeight(spec, x, z + 2.0, tDist);
    const slope = Math.hypot((hx - h) / 2.0, (hz - h) / 2.0);
    if (slope > 0.58) return;

    // Avoid overlapping other trees
    for (let i = 0; i < trees.length; i++) {
      const dx = trees[i].x - x;
      const dz = trees[i].z - z;
      if (dx * dx + dz * dz < 22) return; // >= 4.7m spacing
    }

    const r = rand();
    const kind: FieldTreeSpec['kind'] =
      r < 0.44 ? 'oak' : r < 0.72 ? 'pine' : r < 0.88 ? 'birch' : 'cypress';
    const scale = 0.92 + rand() * 0.68;
    const shade = 0.86 + rand() * 0.22;
    const tint =
      kind === 'birch'
        ? ((Math.round(244 * shade) << 16) | (Math.round(246 * shade) << 8) | Math.round(205 * shade))
        : ((Math.round(224 * shade) << 16) | (Math.round(244 * shade) << 8) | Math.round(212 * shade));
    trees.push({ x, z, scale, kind, tint });
  };

  // 1. Place dense natural forest groves across Kaldgard fields
  for (const [gx, gz, rad, target] of spec.groves) {
    const boostedTarget = Math.round(target * 1.25);
    let placed = 0;
    for (let attempt = 0; attempt < boostedTarget * 6 && placed < boostedTarget; attempt++) {
      const ang = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * rad;
      const before = trees.length;
      tryPlaceTree(gx + Math.cos(ang) * d, gz + Math.sin(ang) * d);
      if (trees.length > before) placed++;
    }
  }

  // 2. Scatter roadside & hillside specimen trees
  for (let attempt = 0; attempt < 560 && trees.length < 368; attempt++) {
    const x = (rand() * 2 - 1) * 195;
    const z = (rand() * 2 - 1) * 195;
    tryPlaceTree(x, z);
  }

  // 3. Place rocky cliff boulders along steep ridge edges and mossy meadow outcrops
  for (let attempt = 0; attempt < 1350 && boulders.length < 185; attempt++) {
    const x = (rand() * 2 - 1) * 198;
    const z = (rand() * 2 - 1) * 198;
    if (isNearCityWall(x, z)) continue;
    if (isNearPortalOrTrail(x, z, 3.6, 14)) continue;
    const tDist = computeTrailMinDist(x, z, spec.trails);
    const h = computeRawFieldHeight(spec, x, z, tDist);
    if (h < -0.1) continue;
    const hx = computeRawFieldHeight(spec, x + 2.2, z, tDist);
    const hz = computeRawFieldHeight(spec, x, z + 2.2, tDist);
    const slope = Math.hypot((hx - h) / 2.2, (hz - h) / 2.2);

    // Prefer cliff edges & natural meadow rock outcrops
    if (slope < 0.30 && rand() > 0.24) continue;

    let tooClose = false;
    for (const b of boulders) {
      const dx = b.x - x;
      const dz = b.z - z;
      if (dx * dx + dz * dz < 13) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    boulders.push({
      x,
      z,
      scale: slope >= 0.32 ? 1.35 + rand() * 1.95 : 0.72 + rand() * 1.25,
      rotY: rand() * Math.PI * 2,
      kind: slope >= 0.32 ? 'cliff' : 'mossy',
    });
  }

  spec.trees = trees;
  spec.boulders = boulders;
}

const PRT_FILD08: FieldMapSpec = {
  id: 'prt_fild08',
  name: 'Jižní kaldgardské louky',
  subtitle: 'kld_fild08 — Jarní louky, skalní terasy a lesní háje',
  directionLabel: 'Jih od Kaldgardu',
  playableExtent: 205,
  renderExtent: 255,
  spawnX: 0,
  spawnZ: -170,
  spawnYaw: 0,
  cityWallEdge: 'north',
  cityWallCoord: -194,
  trailWidth: 6.4,
  trails: [
    // Main winding south road
    [
      [0, -186],
      [0, -155],
      [-18, -125],
      [-32, -88],
      [-14, -46],
      [14, -8],
      [34, 34],
      [18, 86],
      [-14, 134],
      [12, 184],
    ],
    // West winding loop toward West Canyon Portal
    [
      [-32, -88],
      [-74, -74],
      [-115, -45],
      [-142, -8],
      [-182, 12],
    ],
    [
      [-115, -45],
      [-98, 12],
      [-118, 68],
      [-86, 128],
      [-14, 134],
    ],
    // East trail across bridge toward Lakeside Portal
    [
      [14, -8],
      [66, -18],
      [108, -6],
      [148, 0],
      [184, 0],
    ],
    // South-East highland terrace loop
    [
      [34, 34],
      [88, 54],
      [112, 108],
      [74, 152],
      [12, 184],
    ],
  ],
  terraces: [
    // Central-north wooded plateau island
    { cx: -6, cz: -72, rx: 22, rz: 20, height: 6.8, flatTop: 0.58 },
    // NW rocky ridge overlooking road
    { cx: -145, cz: -125, rx: 46, rz: 42, height: 9.4, rot: 0.35, flatTop: 0.62 },
    // Mid-west canyon wall ridge
    { cx: -158, cz: 58, rx: 38, rz: 44, height: 10.5, rot: -0.2, flatTop: 0.58 },
    // SW terraced hunting plateau
    { cx: -115, cz: 145, rx: 58, rz: 45, height: 8.6, rot: 0.25, flatTop: 0.65 },
    // Central-east escarpment
    { cx: 78, cz: -84, rx: 42, rz: 36, height: 7.5, rot: -0.4, flatTop: 0.60 },
    // SE rocky ridge flanking bridge
    { cx: 88, cz: 105, rx: 34, rz: 30, height: 6.2, rot: 0.2, flatTop: 0.64 },
  ],
  waterCoves: [
    { cx: 158, cz: -84, rx: 46, rz: 42 },
    { cx: 154, cz: 92, rx: 44, rz: 52 },
    { cx: 150, cz: 0, rx: 22, rz: 48 }, // stream under East bridge!
  ],
  bridges: [
    { x: 150, z: 0, length: 11, width: 56, rotY: 0 },
  ],
  groves: [
    [-58, -135, 34, 24],
    [54, -142, 36, 26],
    [28, -58, 28, 20],
    [-68, -14, 30, 22],
    [-56, 78, 34, 25],
    [56, 24, 30, 20],
    [118, -136, 26, 18],
    [116, 152, 28, 18],
  ],
  regions: [
    { name: 'Severní brána do Kaldgardu', x: 0, z: -165, radius: 38 },
    { name: 'Východní pobřežní most', x: 145, z: 0, radius: 42 },
    { name: 'Západní skalní průsmyk', x: -145, z: 10, radius: 48 },
    { name: 'Jižní mýtina Entů', x: 18, z: 135, radius: 55 },
  ],
  portals: [
    {
      id: 'f08_to_prontera',
      fromZone: 'prt_fild08',
      toZone: 'prontera',
      label: 'Brána do Kaldgardu',
      subtitle: 'Návrat do hlavního města Kaldgard',
      x: 0,
      z: -186,
      rotY: 0,
      targetX: 0,
      targetZ: 88,
      targetYaw: Math.PI,
      color: 0x38e8b0,
    },
    {
      id: 'f08_to_east',
      fromZone: 'prt_fild08',
      toZone: 'prt_fild06',
      label: 'Východní kaldgardské údolí',
      subtitle: 'Přechod do kld_fild06',
      x: 184,
      z: 0,
      rotY: Math.PI / 2,
      targetX: -168,
      targetZ: 0,
      targetYaw: Math.PI / 2,
      color: 0x52e0ff,
    },
    {
      id: 'f08_to_west',
      fromZone: 'prt_fild08',
      toZone: 'prt_fild05',
      label: 'Západní kaldgardské pastviny',
      subtitle: 'Přechod do kld_fild05',
      x: -184,
      z: 12,
      rotY: -Math.PI / 2,
      targetX: 168,
      targetZ: 0,
      targetYaw: -Math.PI / 2,
      color: 0xffb84d,
    },
    {
      id: 'f08_south_shrine',
      fromZone: 'prt_fild08',
      toZone: 'prt_fild01',
      label: 'Cesta k Severnímu hvozdu',
      subtitle: 'Portál do horského hvozdu kld_fild01',
      x: 12,
      z: 184,
      rotY: Math.PI,
      targetX: 0,
      targetZ: 168,
      targetYaw: Math.PI,
      color: 0x9c82ff,
    },
  ],
  trees: [],
  boulders: [],
};

const PRT_FILD06: FieldMapSpec = {
  id: 'prt_fild06',
  name: 'Východní kaldgardské údolí',
  subtitle: 'kld_fild06 — Prastaré háje, bystřiny a lesní mýtiny',
  directionLabel: 'Východ od Kaldgardu',
  playableExtent: 205,
  renderExtent: 255,
  spawnX: -170,
  spawnZ: 0,
  spawnYaw: Math.PI / 2,
  cityWallEdge: 'west',
  cityWallCoord: -194,
  trailWidth: 6.2,
  trails: [
    [
      [-186, 0],
      [-142, 0],
      [-92, 22],
      [-40, 12],
      [18, -14],
      [76, -8],
      [135, 16],
      [184, 0],
    ],
    [
      [-92, 22],
      [-64, 88],
      [-12, 136],
      [58, 128],
      [112, 74],
      [135, 16],
    ],
    [
      [-40, 12],
      [-55, -72],
      [-18, -135],
      [62, -142],
      [118, -88],
      [76, -8],
    ],
    [
      [-18, -135],
      [0, -184],
    ],
  ],
  terraces: [
    { cx: -95, cz: -128, rx: 44, rz: 36, height: 8.2, rot: -0.3, flatTop: 0.6 },
    { cx: 145, cz: -135, rx: 48, rz: 42, height: 9.6, rot: 0.4, flatTop: 0.6 },
    { cx: -115, cz: 138, rx: 46, rz: 38, height: 7.8, rot: 0.2, flatTop: 0.62 },
    { cx: 142, cz: 132, rx: 45, rz: 42, height: 8.8, rot: -0.25, flatTop: 0.6 },
    { cx: 18, cz: 58, rx: 24, rz: 20, height: 5.5, flatTop: 0.56 },
  ],
  waterCoves: [
    { cx: 0, cz: -85, rx: 32, rz: 26 },
    { cx: 28, cz: 158, rx: 42, rz: 28 },
    { cx: 52, cz: -4, rx: 18, rz: 54 }, // winding brook crossed at (52, -10)
  ],
  bridges: [
    { x: 52, z: -10, length: 11, width: 48, rotY: 0 },
  ],
  groves: [
    [-128, -56, 36, 28],
    [-124, 68, 34, 26],
    [-46, -120, 32, 24],
    [54, -84, 34, 28],
    [98, 42, 36, 28],
    [-24, 96, 32, 24],
    [136, -54, 30, 22],
    [82, 138, 30, 20],
  ],
  regions: [
    { name: 'Západní brána ke Kaldgardu', x: -165, z: 0, radius: 40 },
    { name: 'Bystřinný most', x: 52, z: -10, radius: 36 },
    { name: 'Hvozd prastarých Entů', x: 96, z: 58, radius: 55 },
    { name: 'Severní lesní stezka', x: 0, z: -165, radius: 42 },
  ],
  portals: [
    {
      id: 'f06_to_prontera',
      fromZone: 'prt_fild06',
      toZone: 'prontera',
      label: 'Východní brána Kaldgardu',
      subtitle: 'Návrat do hlavního města Kaldgard',
      x: -186,
      z: 0,
      rotY: Math.PI / 2,
      targetX: 88,
      targetZ: 0,
      targetYaw: -Math.PI / 2,
      color: 0x38e8b0,
    },
    {
      id: 'f06_to_south',
      fromZone: 'prt_fild06',
      toZone: 'prt_fild08',
      label: 'Jižní kaldgardské louky',
      subtitle: 'Přechod na kld_fild08',
      x: 184,
      z: 0,
      rotY: -Math.PI / 2,
      targetX: 168,
      targetZ: 0,
      targetYaw: -Math.PI / 2,
      color: 0x52e0ff,
    },
    {
      id: 'f06_to_north',
      fromZone: 'prt_fild06',
      toZone: 'prt_fild01',
      label: 'Severní kaldgardský hvozd',
      subtitle: 'Přechod do kld_fild01',
      x: 0,
      z: -184,
      rotY: 0,
      targetX: 0,
      targetZ: 168,
      targetYaw: Math.PI,
      color: 0x9c82ff,
    },
  ],
  trees: [],
  boulders: [],
};

const PRT_FILD05: FieldMapSpec = {
  id: 'prt_fild05',
  name: 'Západní kaldgardské pastviny',
  subtitle: 'kld_fild05 — Terasovité kopce, skály a tábory skřetů',
  directionLabel: 'Západ od Kaldgardu',
  playableExtent: 205,
  renderExtent: 255,
  spawnX: 170,
  spawnZ: 0,
  spawnYaw: -Math.PI / 2,
  cityWallEdge: 'east',
  cityWallCoord: 194,
  trailWidth: 6.4,
  trails: [
    [
      [186, 0],
      [135, 0],
      [88, -28],
      [34, -18],
      [-24, 16],
      [-86, 8],
      [-142, -24],
      [-184, 0],
    ],
    [
      [88, -28],
      [54, -95],
      [-12, -135],
      [-76, -112],
      [-142, -24],
    ],
    [
      [34, -18],
      [48, 68],
      [8, 128],
      [-64, 134],
      [-118, 76],
      [-86, 8],
    ],
    [
      [8, 128],
      [0, 184],
    ],
  ],
  terraces: [
    { cx: 105, cz: 118, rx: 46, rz: 40, height: 9.2, rot: -0.35, flatTop: 0.6 },
    { cx: 112, cz: -126, rx: 42, rz: 36, height: 8.6, rot: 0.3, flatTop: 0.62 },
    { cx: -125, cz: -125, rx: 48, rz: 44, height: 10.4, rot: -0.25, flatTop: 0.58 },
    { cx: -138, cz: 122, rx: 52, rz: 42, height: 9.8, rot: 0.25, flatTop: 0.6 },
    { cx: -22, cz: -56, rx: 28, rz: 22, height: 6.8, flatTop: 0.58 },
  ],
  waterCoves: [
    { cx: -158, cz: -64, rx: 32, rz: 28 },
    { cx: -62, cz: 168, rx: 36, rz: 26 },
  ],
  bridges: [],
  groves: [
    [125, 58, 30, 22],
    [122, -66, 28, 20],
    [32, 92, 32, 22],
    [-46, 56, 30, 22],
    [-58, -68, 30, 22],
    [-125, 32, 34, 24],
    [28, -148, 26, 18],
  ],
  regions: [
    { name: 'Východní brána do Kaldgardu', x: 165, z: 0, radius: 40 },
    { name: 'Skalnatý kaňon skřetů', x: -58, z: -20, radius: 52 },
    { name: 'Západní průsmyk', x: -165, z: 0, radius: 42 },
    { name: 'Jižní vlčí pastviny', x: 12, z: 145, radius: 50 },
  ],
  portals: [
    {
      id: 'f05_to_prontera',
      fromZone: 'prt_fild05',
      toZone: 'prontera',
      label: 'Západní brána Kaldgardu',
      subtitle: 'Návrat do hlavního města Kaldgard',
      x: 186,
      z: 0,
      rotY: Math.PI / 2,
      targetX: -88,
      targetZ: 0,
      targetYaw: Math.PI / 2,
      color: 0x38e8b0,
    },
    {
      id: 'f05_to_south',
      fromZone: 'prt_fild05',
      toZone: 'prt_fild08',
      label: 'Jižní kaldgardské louky',
      subtitle: 'Přechod na kld_fild08',
      x: 0,
      z: 184,
      rotY: 0,
      targetX: -168,
      targetZ: 12,
      targetYaw: Math.PI / 2,
      color: 0xffb84d,
    },
    {
      id: 'f05_to_north',
      fromZone: 'prt_fild05',
      toZone: 'prt_fild01',
      label: 'Severní kaldgardský hvozd',
      subtitle: 'Přechod do kld_fild01',
      x: -184,
      z: 0,
      rotY: Math.PI / 2,
      targetX: 0,
      targetZ: 168,
      targetYaw: Math.PI,
      color: 0x9c82ff,
    },
  ],
  trees: [],
  boulders: [],
};

const PRT_FILD01: FieldMapSpec = {
  id: 'prt_fild01',
  name: 'Severní kaldgardský hvozd',
  subtitle: 'kld_fild01 — Podhorské louky, horské hřebeny a staré duby',
  directionLabel: 'Sever od Kaldgardu',
  playableExtent: 205,
  renderExtent: 255,
  spawnX: 0,
  spawnZ: 170,
  spawnYaw: Math.PI,
  cityWallEdge: 'south',
  cityWallCoord: 194,
  trailWidth: 6.2,
  trails: [
    [
      [0, 186],
      [0, 140],
      [26, 92],
      [18, 32],
      [-18, -22],
      [-28, -82],
      [12, -135],
      [0, -184],
    ],
    [
      [18, 32],
      [82, 48],
      [136, 18],
      [184, 0],
    ],
    [
      [-18, -22],
      [-82, -12],
      [-136, -24],
      [-184, 0],
    ],
    [
      [26, 92],
      [-58, 108],
      [-115, 62],
      [-82, -12],
    ],
  ],
  terraces: [
    { cx: -125, cz: -128, rx: 52, rz: 46, height: 11.2, rot: 0.3, flatTop: 0.58 },
    { cx: 128, cz: -124, rx: 50, rz: 44, height: 10.8, rot: -0.3, flatTop: 0.58 },
    { cx: -124, cz: 132, rx: 44, rz: 36, height: 8.6, rot: -0.2, flatTop: 0.62 },
    { cx: 126, cz: 128, rx: 44, rz: 38, height: 8.4, rot: 0.25, flatTop: 0.62 },
    { cx: 46, cz: -46, rx: 28, rz: 24, height: 6.8, flatTop: 0.58 },
  ],
  waterCoves: [
    { cx: 102, cz: -52, rx: 32, rz: 26 },
    { cx: -72, cz: 42, rx: 26, rz: 22 },
  ],
  bridges: [],
  groves: [
    [-58, 146, 30, 22],
    [58, 146, 30, 22],
    [-46, -98, 34, 26],
    [66, -110, 32, 24],
    [118, 56, 34, 26],
    [-122, 26, 32, 24],
    [0, -112, 24, 18],
  ],
  regions: [
    { name: 'Severní hradní cesta', x: 0, z: 165, radius: 40 },
    { name: 'Údolí horských vlků', x: -18, z: -20, radius: 55 },
    { name: 'Východní jezero Entů', x: 120, z: -10, radius: 52 },
    { name: 'Severní průsmyk', x: 0, z: -165, radius: 42 },
  ],
  portals: [
    {
      id: 'f01_to_prontera',
      fromZone: 'prt_fild01',
      toZone: 'prontera',
      label: 'Brána Hradu Kaldgard',
      subtitle: 'Návrat na nádvoří Hradu Kaldgard',
      x: 0,
      z: 186,
      rotY: 0,
      targetX: 0,
      targetZ: -49,
      targetYaw: 0,
      color: 0x38e8b0,
    },
    {
      id: 'f01_to_east',
      fromZone: 'prt_fild01',
      toZone: 'prt_fild06',
      label: 'Východní kaldgardské údolí',
      subtitle: 'Přechod do kld_fild06',
      x: 184,
      z: 0,
      rotY: Math.PI / 2,
      targetX: 0,
      targetZ: -168,
      targetYaw: 0,
      color: 0x52e0ff,
    },
    {
      id: 'f01_to_west',
      fromZone: 'prt_fild01',
      toZone: 'prt_fild05',
      label: 'Západní kaldgardské pastviny',
      subtitle: 'Přechod do kld_fild05',
      x: -184,
      z: 0,
      rotY: Math.PI / 2,
      targetX: -168,
      targetZ: 0,
      targetYaw: Math.PI / 2,
      color: 0xffb84d,
    },
    {
      id: 'f01_to_north_ridge',
      fromZone: 'prt_fild01',
      toZone: 'prt_fild08',
      label: 'Portál na Jižní louky',
      subtitle: 'Přímý přechod na kld_fild08',
      x: 0,
      z: -184,
      rotY: 0,
      targetX: 12,
      targetZ: 168,
      targetYaw: Math.PI,
      color: 0x9c82ff,
    },
  ],
  trees: [],
  boulders: [],
};

export const FIELD_MAPS: Record<Exclude<ZoneId, 'prontera'>, FieldMapSpec> = {
  prt_fild08: PRT_FILD08,
  prt_fild06: PRT_FILD06,
  prt_fild05: PRT_FILD05,
  prt_fild01: PRT_FILD01,
};

populateFieldProps(PRT_FILD08, 1);
populateFieldProps(PRT_FILD06, 2);
populateFieldProps(PRT_FILD05, 3);
populateFieldProps(PRT_FILD01, 4);

export function getZoneName(zoneId: ZoneId): string {
  if (zoneId === 'prontera') return 'Hlavní město Kaldgard';
  return FIELD_MAPS[zoneId].name;
}

export function getPortalsForZone(zoneId: ZoneId): PortalSpec[] {
  if (zoneId === 'prontera') return PRONTERA_PORTALS;
  return FIELD_MAPS[zoneId].portals;
}

export function zoneTerrainHeightAt(zoneId: ZoneId, x: number, z: number): number {
  if (zoneId === 'prontera') return groundHeightAt(x, z);
  const spec = FIELD_MAPS[zoneId];
  const tDist = computeTrailMinDist(x, z, spec.trails);
  const raw = computeRawFieldHeight(spec, x, z, tDist);
  if (isOnBridge(x, z, spec.bridges, 0.5)) {
    return Math.min(raw, 0.12);
  }
  return raw;
}

export function zoneHeightAt(zoneId: ZoneId, x: number, z: number): number {
  if (zoneId === 'prontera') return groundHeightAt(x, z);
  const spec = FIELD_MAPS[zoneId];
  const tDist = computeTrailMinDist(x, z, spec.trails);
  const raw = computeRawFieldHeight(spec, x, z, tDist);
  if (isOnBridge(x, z, spec.bridges, 0.35)) {
    return Math.max(0.58, raw);
  }
  return raw;
}

export function zoneTrailMaskAt(zoneId: ZoneId, x: number, z: number): number {
  if (zoneId === 'prontera') return 0;
  const spec = FIELD_MAPS[zoneId];
  const d = computeTrailMinDist(x, z, spec.trails);
  const edgeWobble = Math.sin(x * 0.25 + z * 0.21) * 0.85 + Math.cos(x * 0.43 - z * 0.37) * 0.45;
  return 1 - smoothstep(spec.trailWidth * 0.55 + edgeWobble, spec.trailWidth * 1.18 + edgeWobble, d);
}

export function zoneWaterDepthAt(zoneId: ZoneId, x: number, z: number): number {
  if (zoneId === 'prontera') return 0;
  const spec = FIELD_MAPS[zoneId];
  if (isOnBridge(x, z, spec.bridges, 0.35)) return 0;
  const h = zoneHeightAt(zoneId, x, z);
  return Math.max(0, -0.35 - h);
}

export function zoneCliffSlopeAt(zoneId: ZoneId, x: number, z: number): number {
  if (zoneId === 'prontera') return 0;
  const spec = FIELD_MAPS[zoneId];
  const rawAt = (px: number, pz: number) =>
    computeRawFieldHeight(spec, px, pz, computeTrailMinDist(px, pz, spec.trails));
  const eps = 1.6;
  const hL = rawAt(x - eps, z);
  const hR = rawAt(x + eps, z);
  const hD = rawAt(x, z - eps);
  const hU = rawAt(x, z + eps);
  const gx = (hR - hL) / (eps * 2);
  const gz = (hU - hD) / (eps * 2);
  return Math.hypot(gx, gz);
}

export function isFieldTerrainBlocked(zoneId: Exclude<ZoneId, 'prontera'>, x: number, z: number): boolean {
  const spec = FIELD_MAPS[zoneId];
  const lim = spec.playableExtent - 4;
  if (Math.abs(x) > lim || Math.abs(z) > lim) return true;
  if (isOnBridge(x, z, spec.bridges, 0.35)) return false;
  if (zoneWaterDepthAt(zoneId, x, z) > 0.08) return true;
  // Steep rocky cliff ridges block walking unless on a bridge or road pass
  if (zoneTrailMaskAt(zoneId, x, z) < 0.35 && zoneCliffSlopeAt(zoneId, x, z) > 0.62) {
    return true;
  }
  return false;
}

export function buildZoneColliders(zoneId: ZoneId): {
  rects: RectCollider[];
  circles: CircleCollider[];
} {
  if (zoneId === 'prontera') return WORLD_COLLIDERS;
  const spec = FIELD_MAPS[zoneId];
  const rects: RectCollider[] = [];
  const circles: CircleCollider[] = [];

  // City border wall with gate opening around return portal
  const wc = spec.cityWallCoord;
  const gateOpen = 7.5;
  if (spec.cityWallEdge === 'north') {
    rects.push({ id: 'wall_n_l', minX: -250, maxX: -gateOpen, minZ: wc - 3, maxZ: wc + 3 });
    rects.push({ id: 'wall_n_r', minX: gateOpen, maxX: 250, minZ: wc - 3, maxZ: wc + 3 });
  } else if (spec.cityWallEdge === 'south') {
    rects.push({ id: 'wall_s_l', minX: -250, maxX: -gateOpen, minZ: wc - 3, maxZ: wc + 3 });
    rects.push({ id: 'wall_s_r', minX: gateOpen, maxX: 250, minZ: wc - 3, maxZ: wc + 3 });
  } else if (spec.cityWallEdge === 'west') {
    rects.push({ id: 'wall_w_t', minX: wc - 3, maxX: wc + 3, minZ: -250, maxZ: -gateOpen });
    rects.push({ id: 'wall_w_b', minX: wc - 3, maxX: wc + 3, minZ: gateOpen, maxZ: 250 });
  } else {
    rects.push({ id: 'wall_e_t', minX: wc - 3, maxX: wc + 3, minZ: -250, maxZ: -gateOpen });
    rects.push({ id: 'wall_e_b', minX: wc - 3, maxX: wc + 3, minZ: gateOpen, maxZ: 250 });
  }

  spec.trees.forEach((t, i) => {
    circles.push({ id: `ftree_${i}`, x: t.x, z: t.z, r: 0.72 * t.scale });
  });
  spec.boulders.forEach((b, i) => {
    circles.push({ id: `frock_${i}`, x: b.x, z: b.z, r: 0.95 * b.scale });
  });

  return { rects, circles };
}

export function createZoneNavGrid(zoneId: ZoneId): NavigationGrid {
  if (zoneId === 'prontera') return PRONTERA_NAV;
  const spec = FIELD_MAPS[zoneId];
  const { rects, circles } = buildZoneColliders(zoneId);
  return new NavigationGrid({
    minCoord: -spec.playableExtent,
    maxCoord: spec.playableExtent,
    cellSize: 2.5,
    rects,
    circles,
    actorRadius: 0.7,
    isBlockedFn: (x, z) => isFieldTerrainBlocked(zoneId, x, z),
  });
}

export function getZoneDistrictAt(zoneId: ZoneId, x: number, z: number): string {
  if (zoneId === 'prontera') return getDistrictAt(x, z);
  const spec = FIELD_MAPS[zoneId];
  let best = spec.name;
  let bestD = 1e9;
  for (const r of spec.regions) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d <= r.radius && d < bestD) {
      bestD = d;
      best = r.name;
    }
  }
  return best;
}

export function getZoneLandmarks(zoneId: ZoneId): LandmarkSpec[] {
  if (zoneId === 'prontera') {
    return LANDMARKS;
  }
  const spec = FIELD_MAPS[zoneId];
  const scenicBridge = spec.bridges[0];
  const scenicPoints: LandmarkSpec[] = [
    {
      id: `${zoneId}_crossroads`,
      name: 'Rozcestí',
      subtitle: 'Střed loviště vlků, skřetů a entů',
      x: spec.trails[0]?.[Math.floor((spec.trails[0]?.length ?? 2) / 2)]?.[0] ?? 0,
      z: spec.trails[0]?.[Math.floor((spec.trails[0]?.length ?? 2) / 2)]?.[1] ?? 0,
      facingYaw: 0,
    },
    ...(scenicBridge
      ? [
          {
            id: `${zoneId}_bridge`,
            name: 'Most',
            subtitle: 'Přechod přes lesní zátoku',
            x: scenicBridge.x,
            z: scenicBridge.z,
            facingYaw: scenicBridge.rotY,
          },
        ]
      : []),
  ];
  return [
    ...scenicPoints,
    ...spec.portals.map((p) => ({
      id: p.id,
      name: p.label,
      subtitle: p.subtitle,
      x: p.x === 0 ? 0 : p.x > 0 ? p.x - 10 : p.x + 10,
      z: p.z === 0 ? 0 : p.z > 0 ? p.z - 10 : p.z + 10,
      facingYaw: p.targetYaw,
    })),
  ];
}

export function getZoneDefaultSpawn(zoneId: ZoneId): { x: number; z: number; yaw: number } {
  if (zoneId === 'prontera') return PLAYER_SPAWN;
  const spec = FIELD_MAPS[zoneId];
  return { x: spec.spawnX, z: spec.spawnZ, yaw: spec.spawnYaw };
}
