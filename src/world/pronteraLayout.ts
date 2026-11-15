export interface RectCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleCollider {
  id: string;
  x: number;
  z: number;
  r: number;
}

export type BuildingKind =
  | 'castle'
  | 'cathedral'
  | 'chivalry'
  | 'forge'
  | 'tavern'
  | 'library'
  | 'guildhouse'
  | 'cottage';

export interface BuildingSpec {
  id: string;
  name: string;
  kind: BuildingKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Facing angle in radians around Y (0 = faces +Z south, Math.PI = faces -Z north) */
  rotY: number;
  roofTone: 'cobalt' | 'terracotta' | 'slate' | 'royal';
}

export interface StallSpec {
  id: string;
  x: number;
  z: number;
  rotY: number;
  canopyColor: number;
  accentColor: number;
  goods: 'potions' | 'fabrics' | 'produce' | 'weapons' | 'fruits' | 'orchard' | 'berries';
}

export interface TreeSpec {
  x: number;
  z: number;
  scale: number;
  kind: 'oak' | 'cypress' | 'pine';
  tint: number;
}

export interface LanternSpec {
  x: number;
  z: number;
}

export interface NpcSpec {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  rotY: number;
  tunicColor: number;
  hairColor: number;
  hatKind: 'kafra' | 'knight' | 'cleric' | 'merchant' | 'smith';
}

export interface LandmarkSpec {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  facingYaw: number;
}

export const CITY_WALL_POS = 72;
export const CITY_WALL_HALF_THICK = 2.1;
export const GATE_HALF_OPENING = 6.5;
export const MOAT_INNER = 77.5;
export const MOAT_OUTER = 83.5;

export const PLAYER_SPAWN = {
  x: 0,
  z: 14,
  yaw: Math.PI, // Facing north (-Z) toward Central Fountain & Castle
};

export const LANDMARKS: LandmarkSpec[] = [
  {
    id: 'fountain',
    name: 'Centrální kašna',
    subtitle: 'Srdce královského náměstí',
    x: 0,
    z: 13,
    facingYaw: Math.PI,
  },
  {
    id: 'castle',
    name: 'Hrad Kaldgard',
    subtitle: 'Královská citadela na severu',
    x: 0,
    z: -48,
    facingYaw: Math.PI,
  },
  {
    id: 'cathedral',
    name: 'Katedrála Kaldgard',
    subtitle: 'Severovýchodní svatyně',
    x: 52,
    z: -36,
    facingYaw: Math.PI,
  },
  {
    id: 'chivalry',
    name: 'Cech rytířů',
    subtitle: 'Severozápadní posádka a kovárna',
    x: -52,
    z: -36,
    facingYaw: Math.PI,
  },
  {
    id: 'market',
    name: 'Velké tržiště',
    subtitle: 'Jihozápadní obchodní čtvrť',
    x: -22,
    z: 22,
    facingYaw: -Math.PI * 0.75,
  },
  {
    id: 'tavern',
    name: 'Krčma U Zlatého gryfa',
    subtitle: 'Jihovýchodní hostinec a knihovna',
    x: 24,
    z: 29,
    facingYaw: Math.PI,
  },
  {
    id: 'south_gate',
    name: 'Jižní louky',
    subtitle: 'Lov lesních bestií za jižní branou',
    x: 0,
    z: 88,
    facingYaw: 0,
  },
  {
    id: 'east_gate',
    name: 'Východní brána',
    subtitle: 'Výpadovka k východním lesům',
    x: 64,
    z: 0,
    facingYaw: Math.PI * 0.5,
  },
];

export const BUILDINGS: BuildingSpec[] = [
  // Grand Kaldgard Castle crowning the North Citadel Wall
  {
    id: 'castle_main',
    name: 'Hrad Kaldgard',
    kind: 'castle',
    x: 0,
    z: -74,
    width: 44,
    depth: 20,
    height: 18,
    rotY: 0,
    roofTone: 'royal',
  },
  // NE Quadrant: Cathedral & Sanctuary Pavilion
  {
    id: 'cathedral_main',
    name: 'Katedrála Kaldgard',
    kind: 'cathedral',
    x: 53,
    z: -53,
    width: 19,
    depth: 18,
    height: 15,
    rotY: 0,
    roofTone: 'cobalt',
  },
  {
    id: 'sanctuary_hall',
    name: 'Klášterní zahrada',
    kind: 'guildhouse',
    x: 22,
    z: -22,
    width: 13,
    depth: 11,
    height: 7.5,
    rotY: 0,
    roofTone: 'cobalt',
  },
  {
    id: 'cleric_house',
    name: 'Dům léčitelů',
    kind: 'cottage',
    x: 53,
    z: -21,
    width: 12,
    depth: 11,
    height: 6.5,
    rotY: -Math.PI / 2,
    roofTone: 'slate',
  },
  // NW Quadrant: Knight Chivalry & Blacksmith Forge
  {
    id: 'chivalry_hall',
    name: 'Cech rytířů',
    kind: 'chivalry',
    x: -53,
    z: -53,
    width: 20,
    depth: 16,
    height: 11,
    rotY: 0,
    roofTone: 'slate',
  },
  {
    id: 'blacksmith_forge',
    name: 'Královská kovárna',
    kind: 'forge',
    x: -22,
    z: -20,
    width: 12,
    depth: 11,
    height: 7,
    rotY: 0,
    roofTone: 'terracotta',
  },
  // SW Quadrant: Market Guildhouses & Residences
  {
    id: 'merchant_guild',
    name: 'Obchodní dům',
    kind: 'guildhouse',
    x: -53,
    z: 21,
    width: 14,
    depth: 12,
    height: 8.5,
    rotY: Math.PI / 2,
    roofTone: 'terracotta',
  },
  {
    id: 'sw_house_1',
    name: 'Měšťanský dům',
    kind: 'cottage',
    x: -21,
    z: 52,
    width: 12,
    depth: 11,
    height: 6.8,
    rotY: Math.PI,
    roofTone: 'terracotta',
  },
  {
    id: 'sw_house_2',
    name: 'Řemeslnický dům',
    kind: 'cottage',
    x: -53,
    z: 52,
    width: 13,
    depth: 12,
    height: 7.2,
    rotY: Math.PI,
    roofTone: 'cobalt',
  },
  // SE Quadrant: Tavern, Library & Cozy Homes
  {
    id: 'tavern_inn',
    name: 'Krčma U Zlatého gryfa',
    kind: 'tavern',
    x: 22,
    z: 20,
    width: 14,
    depth: 11,
    height: 8.2,
    rotY: 0,
    roofTone: 'terracotta',
  },
  {
    id: 'royal_library',
    name: 'Královská knihovna',
    kind: 'library',
    x: 53,
    z: 21,
    width: 14,
    depth: 13,
    height: 9.5,
    rotY: -Math.PI / 2,
    roofTone: 'cobalt',
  },
  {
    id: 'se_house_1',
    name: 'Bylinkářství',
    kind: 'cottage',
    x: 22,
    z: 52,
    width: 12,
    depth: 11,
    height: 6.8,
    rotY: Math.PI,
    roofTone: 'slate',
  },
  {
    id: 'se_house_2',
    name: 'Krejčovství',
    kind: 'cottage',
    x: 53,
    z: 52,
    width: 13,
    depth: 12,
    height: 7.4,
    rotY: Math.PI,
    roofTone: 'terracotta',
  },
];

export const MARKET_STALLS: StallSpec[] = [
  {
    id: 'stall_1',
    x: -28,
    z: 14,
    rotY: 0,
    canopyColor: 0xc94238,
    accentColor: 0xf4e3c1,
    goods: 'potions',
  },
  {
    id: 'stall_2',
    x: -15,
    z: 14,
    rotY: 0,
    canopyColor: 0x2e6499,
    accentColor: 0xf4e3c1,
    goods: 'fabrics',
  },
  {
    id: 'stall_3',
    x: -28,
    z: 28,
    rotY: Math.PI,
    canopyColor: 0xd68c28,
    accentColor: 0xfff3d8,
    goods: 'produce',
  },
  {
    id: 'stall_4',
    x: -15,
    z: 28,
    rotY: Math.PI,
    canopyColor: 0x3b7a57,
    accentColor: 0xf4e3c1,
    goods: 'weapons',
  },
  // New Fruit, Citrus, Grape & Melon Orchard Stalls in Market Square & Tavern Lane
  {
    id: 'stall_5',
    x: -29.5,
    z: 21,
    rotY: Math.PI / 2,
    canopyColor: 0xa83232,
    accentColor: 0xf6e6c4,
    goods: 'fruits',
  },
  {
    id: 'stall_6',
    x: -13.5,
    z: 21,
    rotY: -Math.PI / 2,
    canopyColor: 0xc47b27,
    accentColor: 0xfaf0d7,
    goods: 'orchard',
  },
  {
    id: 'stall_7',
    x: -21.5,
    z: 30,
    rotY: Math.PI,
    canopyColor: 0x6b3a75,
    accentColor: 0xf5e8cf,
    goods: 'berries',
  },
  {
    id: 'stall_8',
    x: 16,
    z: 28,
    rotY: Math.PI,
    canopyColor: 0x2f6b4b,
    accentColor: 0xf4e3c1,
    goods: 'fruits',
  },
];

export const LANTERNS: LanternSpec[] = [
  // Central Fountain corners
  { x: -10, z: -10 },
  { x: 10, z: -10 },
  { x: -10, z: 10 },
  { x: 10, z: 10 },
  // North-South Avenue
  { x: -8.5, z: -26 },
  { x: 8.5, z: -26 },
  { x: -8.5, z: -44 },
  { x: 8.5, z: -44 },
  { x: -8.5, z: 26 },
  { x: 8.5, z: 26 },
  { x: -8.5, z: 48 },
  { x: 8.5, z: 48 },
  // East-West Avenue
  { x: -26, z: -8.5 },
  { x: -26, z: 8.5 },
  { x: -50, z: -8.5 },
  { x: -50, z: 8.5 },
  { x: 26, z: -8.5 },
  { x: 26, z: 8.5 },
  { x: 50, z: -8.5 },
  { x: 50, z: 8.5 },
  // Outer Gate Bridges
  { x: -8, z: 85 },
  { x: 8, z: 85 },
  { x: -85, z: -8 },
  { x: -85, z: 8 },
  { x: 85, z: -8 },
  { x: 85, z: 8 },
];

export const NPCS: NpcSpec[] = [
  {
    id: 'kafra_plaza',
    name: 'Správkyně Kafra',
    role: 'Průvodkyně náměstí',
    x: -11.5,
    z: 11.5,
    rotY: Math.PI * 0.25,
    tunicColor: 0x264b8c,
    hairColor: 0x3b2c4e,
    hatKind: 'kafra',
  },
  {
    id: 'knight_captain',
    name: 'Velitel rytířů',
    role: 'Strážce cechu',
    x: -44,
    z: -41,
    rotY: 0,
    tunicColor: 0x8f2828,
    hairColor: 0x4c3728,
    hatKind: 'knight',
  },
  {
    id: 'cathedral_sister',
    name: 'Sestra Marie',
    role: 'Akolytka chrámu',
    x: 47,
    z: -41,
    rotY: 0,
    tunicColor: 0x3a6a9c,
    hairColor: 0xd9a74e,
    hatKind: 'cleric',
  },
  {
    id: 'market_merchant',
    name: 'Kupec Alois',
    role: 'Mistr tržiště',
    x: -21.5,
    z: 18,
    rotY: Math.PI * 0.15,
    tunicColor: 0x8b5e2e,
    hairColor: 0x5c4033,
    hatKind: 'merchant',
  },
  {
    id: 'blacksmith_master',
    name: 'Kovář Břetislav',
    role: 'Zbrojíř',
    x: -22,
    z: -28,
    rotY: 0,
    tunicColor: 0x4a3d35,
    hairColor: 0x2b211c,
    hatKind: 'smith',
  },
];

// Generate deterministic trees inside town gardens and lush countryside outside the moat
function buildTrees(): TreeSpec[] {
  const list: TreeSpec[] = [
    // Inner city pocket parks & avenues
    { x: 12, z: -13, scale: 0.92, kind: 'oak', tint: 0xffffff },
    { x: -12, z: -13, scale: 0.9, kind: 'oak', tint: 0xf4f9e8 },
    { x: 30, z: -13, scale: 0.95, kind: 'oak', tint: 0xeff8e6 },
    { x: 43, z: -26, scale: 1.05, kind: 'cypress', tint: 0xedf6e4 },
    { x: 63, z: -26, scale: 1.0, kind: 'cypress', tint: 0xf2fae8 },
    { x: 42, z: -44, scale: 1.1, kind: 'cypress', tint: 0xe8f5df },
    { x: 64, z: -44, scale: 1.08, kind: 'cypress', tint: 0xf0f9e5 },
    { x: -42, z: -22, scale: 1.0, kind: 'oak', tint: 0xf5f9e8 },
    { x: -62, z: -22, scale: 0.95, kind: 'oak', tint: 0xecf5e3 },
    { x: 13, z: 45, scale: 0.95, kind: 'oak', tint: 0xf3fae9 },
    { x: 31, z: 45, scale: 0.9, kind: 'oak', tint: 0xeef7e4 },
    { x: -13, z: 45, scale: 0.92, kind: 'oak', tint: 0xf1f8e7 },
    { x: -31, z: 45, scale: 0.96, kind: 'oak', tint: 0xe9f3de },
    { x: 62, z: 42, scale: 0.95, kind: 'oak', tint: 0xf0f8e6 },
    { x: -62, z: 42, scale: 0.95, kind: 'oak', tint: 0xeef6e2 },
    // Royal Castle forecourt trees
    { x: -24, z: -56, scale: 1.12, kind: 'cypress', tint: 0xeaf4df },
    { x: 24, z: -56, scale: 1.12, kind: 'cypress', tint: 0xf1f8e7 },
    { x: -24, z: -45, scale: 1.05, kind: 'cypress', tint: 0xeef6e3 },
    { x: 24, z: -45, scale: 1.05, kind: 'cypress', tint: 0xf3fae9 },
  ];

  // Outer Prontera Fields forest ring (deterministic pseudo-random)
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 150; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 94 + rand() * 98;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Keep clear of the 4 cardinal approach roads
    if (Math.abs(x) < 13 || Math.abs(z) < 13) continue;
    // Keep clear of moat band
    if (Math.abs(x) < 88 && Math.abs(z) < 88) continue;

    const r = rand();
    const kind: TreeSpec['kind'] = r < 0.55 ? 'oak' : r < 0.82 ? 'pine' : 'cypress';
    const scale = 0.85 + rand() * 0.55;
    const shade = 0.88 + rand() * 0.2;
    const tint =
      (Math.round(235 * shade) << 16) |
      (Math.round(248 * shade) << 8) |
      Math.round(220 * shade);

    list.push({ x, z, scale, kind, tint });
  }

  return list;
}

export const TREES: TreeSpec[] = buildTrees();

/**
 * Ground elevation: flat 0 inside the city & along cardinal bridges/roads,
 * gentle rolling Prontera meadow hills outside the moat.
 */
export function groundHeightAt(x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);

  // Carve moat channel depression below water level (excluding stone bridges across S/W/E)
  const inSouthBridge = ax <= GATE_HALF_OPENING + 1.2 && z > 0;
  const inSideBridge = az <= GATE_HALF_OPENING + 1.2;
  const inMoatSouth = z >= MOAT_INNER && z <= MOAT_OUTER && ax <= MOAT_OUTER && !inSouthBridge;
  const inMoatNorth = z <= -MOAT_INNER - 5 && z >= -MOAT_OUTER - 5 && ax <= MOAT_OUTER;
  const inMoatSides =
    ax >= MOAT_INNER && ax <= MOAT_OUTER && z >= -MOAT_OUTER - 5 && z <= MOAT_OUTER && !inSideBridge;
  if (inMoatSouth || inMoatNorth || inMoatSides) {
    return -0.58;
  }

  // Keep inner city, moat banks, and cardinal approach roads flat at y = 0
  if (ax <= 94 && az <= 94) return 0;
  if ((ax <= 14 || az <= 14) && ax <= 125 && az <= 125) return 0;

  const distFromBox = Math.max(ax - 94, az - 94, 0);
  const blend = Math.min(1, distFromBox / 28);
  const roadFade = Math.min(1, Math.min(ax, az) / 22);
  const hill =
    (Math.sin(x * 0.045) * Math.cos(z * 0.045) * 2.6 +
      Math.sin(x * 0.02 + z * 0.025) * 2.0 +
      1.2) *
    blend *
    roadFade;
  return Math.max(0, hill);
}

/**
 * Returns true if world position (x, z) lies on paved Prontera stone cobbles.
 */
export function isCobbleRoad(x: number, z: number): boolean {
  const ax = Math.abs(x);
  const az = Math.abs(z);

  // Central Fountain Plaza
  if (ax <= 16.5 && az <= 16.5) return true;
  // Main North-South Avenue (South Field bridge -> Fountain -> Castle)
  if (ax <= 6.5 && z >= -64 && z <= 108) return true;
  // Main East-West Avenue (West Field bridge -> Fountain -> East Field bridge)
  if (az <= 6.5 && ax <= 108) return true;
  // Castle Royal Forecourt
  if (ax <= 21 && z >= -64 && z <= -39) return true;
  // Inner Ring Boulevard
  if (ax >= 32.5 && ax <= 39.5 && az <= 58) return true;
  if (az >= 32.5 && az <= 39.5 && ax <= 58) return true;
  // Market Square (SW)
  if (x >= -34 && x <= -10 && z >= 10 && z <= 34) return true;
  // Tavern Terrace (SE)
  if (x >= 13 && x <= 33 && z >= 14 && z <= 33) return true;
  // Cathedral Parvis (NE)
  if (x >= 42 && x <= 64 && z >= -44 && z <= -33) return true;
  // Knight Chivalry Courtyard (NW)
  if (x >= -64 && x <= -42 && z >= -44 && z <= -33) return true;

  return false;
}

export function buildColliders(): {
  rects: RectCollider[];
  circles: CircleCollider[];
} {
  const rects: RectCollider[] = [];
  const circles: CircleCollider[] = [];

  // 1. Central Fountain basin
  circles.push({ id: 'fountain_basin', x: 0, z: 0, r: 5.0 });

  // 2. City Walls with Gate openings (South, West, East) and Castle North wall
  const wPos = CITY_WALL_POS;
  const ht = CITY_WALL_HALF_THICK;
  const gOpen = GATE_HALF_OPENING;

  // South Wall (left & right of South Gate)
  rects.push({ id: 'wall_s_w', minX: -wPos - ht, maxX: -gOpen, minZ: wPos - ht, maxZ: wPos + ht });
  rects.push({ id: 'wall_s_e', minX: gOpen, maxX: wPos + ht, minZ: wPos - ht, maxZ: wPos + ht });
  // West Wall (north & south of West Gate)
  rects.push({ id: 'wall_w_n', minX: -wPos - ht, maxX: -wPos + ht, minZ: -wPos - ht, maxZ: -gOpen });
  rects.push({ id: 'wall_w_s', minX: -wPos - ht, maxX: -wPos + ht, minZ: gOpen, maxZ: wPos + ht });
  // East Wall (north & south of East Gate)
  rects.push({ id: 'wall_e_n', minX: wPos - ht, maxX: wPos + ht, minZ: -wPos - ht, maxZ: -gOpen });
  rects.push({ id: 'wall_e_s', minX: wPos - ht, maxX: wPos + ht, minZ: gOpen, maxZ: wPos + ht });
  // North Wall (flanks Prontera Castle)
  rects.push({ id: 'wall_n_w', minX: -wPos - ht, maxX: -22, minZ: -wPos - ht, maxZ: -wPos + ht });
  rects.push({ id: 'wall_n_e', minX: 22, maxX: wPos + ht, minZ: -wPos - ht, maxZ: -wPos + ht });

  // 3. Moat water barrier outside walls (open across South, West, East bridges)
  // South moat segments
  rects.push({ id: 'moat_s_w', minX: -MOAT_OUTER, maxX: -gOpen - 1, minZ: MOAT_INNER, maxZ: MOAT_OUTER });
  rects.push({ id: 'moat_s_e', minX: gOpen + 1, maxX: MOAT_OUTER, minZ: MOAT_INNER, maxZ: MOAT_OUTER });
  // North moat behind castle
  rects.push({ id: 'moat_n', minX: -MOAT_OUTER, maxX: MOAT_OUTER, minZ: -MOAT_OUTER - 5, maxZ: -MOAT_INNER - 5 });
  // West moat segments
  rects.push({ id: 'moat_w_n', minX: -MOAT_OUTER, maxX: -MOAT_INNER, minZ: -MOAT_OUTER - 5, maxZ: -gOpen - 1 });
  rects.push({ id: 'moat_w_s', minX: -MOAT_OUTER, maxX: -MOAT_INNER, minZ: gOpen + 1, maxZ: MOAT_OUTER });
  // East moat segments
  rects.push({ id: 'moat_e_n', minX: MOAT_INNER, maxX: MOAT_OUTER, minZ: -MOAT_OUTER - 5, maxZ: -gOpen - 1 });
  rects.push({ id: 'moat_e_s', minX: MOAT_INNER, maxX: MOAT_OUTER, minZ: gOpen + 1, maxZ: MOAT_OUTER });

  // 4. Gatehouse flanking towers
  const gateTowers: [number, number][] = [
    [-9.2, wPos],
    [9.2, wPos],
    [-wPos, -9.2],
    [-wPos, 9.2],
    [wPos, -9.2],
    [wPos, 9.2],
    [-72, -72],
    [72, -72],
    [-72, 72],
    [72, 72],
  ];
  gateTowers.forEach(([tx, tz], idx) => {
    circles.push({ id: `tower_${idx}`, x: tx, z: tz, r: 3.1 });
  });

  // 5. Buildings (respecting rotY swap for 90-degree rotations)
  for (const b of BUILDINGS) {
    const rotated = Math.abs(Math.sin(b.rotY)) > 0.7;
    const hw = (rotated ? b.depth : b.width) / 2 + 0.35;
    const hd = (rotated ? b.width : b.depth) / 2 + 0.35;
    rects.push({
      id: `bldg_${b.id}`,
      minX: b.x - hw,
      maxX: b.x + hw,
      minZ: b.z - hd,
      maxZ: b.z + hd,
    });
  }

  // 6. Market stalls (respecting rotY swap for east/west facing stalls)
  for (const s of MARKET_STALLS) {
    const rotated = Math.abs(Math.sin(s.rotY)) > 0.7;
    const hw = rotated ? 1.55 : 2.3;
    const hd = rotated ? 2.3 : 1.55;
    rects.push({
      id: s.id,
      minX: s.x - hw,
      maxX: s.x + hw,
      minZ: s.z - hd,
      maxZ: s.z + hd,
    });
  }

  // 7. Trees (trunk collision)
  TREES.forEach((t, i) => {
    circles.push({ id: `tree_${i}`, x: t.x, z: t.z, r: 0.65 * t.scale });
  });

  // 8. NPCs
  NPCS.forEach((n) => {
    circles.push({ id: `npc_${n.id}`, x: n.x, z: n.z, r: 0.65 });
  });

  return { rects, circles };
}

export const WORLD_COLLIDERS = buildColliders();

export function getDistrictAt(x: number, z: number): string {
  if (Math.abs(x) > 76 || Math.abs(z) > 76) {
    if (z > 76) return 'Jižní kaldgardské louky';
    if (x > 76) return 'Východní předměstí';
    if (x < -76) return 'Západní předměstí';
    return 'Severní hradní hvozd';
  }
  if (Math.hypot(x, z) <= 18) return 'Centrální kašna';
  if (Math.abs(x) <= 10 && z >= 62) return 'Jižní brána';
  if (Math.abs(x) <= 10 && z <= -62) return 'Brána Hradu Kaldgard';
  if (Math.abs(z) <= 10 && x >= 62) return 'Východní brána';
  if (Math.abs(z) <= 10 && x <= -62) return 'Západní brána';
  if (Math.abs(x) <= 22 && z <= -38) return 'Nádvoří hradu Kaldgard';
  if (x > 36 && z < -10) return 'Katedrální čtvrť';
  if (x > 8 && z < -8) return 'Klášterní zahrady';
  if (x < -36 && z < -10) return 'Cech rytířů';
  if (x < -8 && z < -8) return 'Zbrojnice a kovárna';
  if (x < -8 && z > 8 && x > -38 && z < 38) return 'Velké tržiště';
  if (x < -8 && z > 8) return 'Jihozápadní měšťanská čtvrť';
  if (x > 8 && z > 8 && x < 38 && z < 38) return 'Krčma U Zlatého gryfa';
  if (x > 8 && z > 8) return 'Knihovna a jihovýchodní čtvrť';
  return 'Královská třída Kaldgardu';
}
