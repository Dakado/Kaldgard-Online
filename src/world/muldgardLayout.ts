/**
 * Muldgard — pouštní město ve stylu Morrocu (medina s palácovým jezerem).
 * Rozložení podle referenční minimapy: obdélné hradby s rohovými baštami
 * a 4 branami (S/V/Z + severní křídlo u chrámu), centrální vodní plocha
 * s palácovým ostrovem uprostřed, mosty S-J a V-Z přes jezero, okružní
 * třída kolem jezera, bloky domů mezi okruhem a hradbami, bazarové stany
 * u jižního náměstí, karavanseraje u cest, palmy podél tříd, sochy strážců
 * u bran, pyramidy v poušti. Cesty a domy drží logiku mediny: třídy vedou
 * k branám, náměstí a bazar jsou uzly, nic nestojí v cestě.
 */
import type { CircleCollider, LandmarkSpec, NpcSpec, RectCollider, StallSpec } from './pronteraLayout';

export type MuldgardBuildingKind = 'palace' | 'pavilion' | 'temple' | 'house' | 'shop' | 'caravan';

export interface MuldgardBuildingSpec {
  id: string;
  name: string;
  kind: MuldgardBuildingKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotY: number;
}

export interface MuldgardPalmSpec {
  x: number;
  z: number;
  scale: number;
}

export interface MuldgardStatueSpec {
  x: number;
  z: number;
  rotY: number;
}

export interface MuldgardPyramidSpec {
  id: string;
  x: number;
  z: number;
  size: number;
  height: number;
}

export interface MuldgardGardenSpec {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface MuldgardWellSpec {
  x: number;
  z: number;
}

export const MULD_WALL_POS = 72;
export const MULD_WALL_HALF_THICK = 2.1;
export const MULD_GATE_HALF_OPENING = 6.5;

// Palácové jezero: vodní plocha s ostrovem a mosty (srdce podle reference).
// Mosty mají nájezdy z pevniny: pochozí pás je širší než paluba nad vodou.
export const MULD_LAKE = { x1: -26, z1: -30, x2: 26, z2: 26 };
export const MULD_ISLAND = { x1: -13, z1: -15, x2: 13, z2: 13 };
export const MULD_BRIDGE_NS = { x1: -3, z1: -39, x2: 3, z2: 35 };
export const MULD_BRIDGE_EW = { x1: -35, z1: -3, x2: 35, z2: 3 };
// Paluba nad vodou (bez nájezdů) — pro geometrii mostu
export const MULD_DECK_NS = { x1: -3, z1: -31, x2: 3, z2: 27 };
export const MULD_DECK_EW = { x1: -27, z1: -3, x2: 27, z2: 3 };
export const MULD_PLAZA_S = { x1: -14, z1: 44, x2: 14, z2: 64 };
export const MULD_FOUNTAIN_S = { x: 0, z: 51, r: 2.5 };

export const MULD_NAV_MIN = -140;
export const MULD_NAV_MAX = 140;

export const MULD_PLAYER_SPAWN = {
  x: 0,
  z: 44,
  yaw: Math.PI, // čelem na sever — přes náměstí a jezero k paláci
};

export const MULD_LANDMARKS: LandmarkSpec[] = [
  { id: 'muld_lake', name: 'Muldgardské jezero', subtitle: 'Palác na vodě', x: 0, z: 20, facingYaw: Math.PI },
  { id: 'muld_palace', name: 'Palác Muldgard', subtitle: 'Ostrovní citadela', x: 0, z: 12, facingYaw: Math.PI },
  { id: 'muld_temple', name: 'Chrám písků', subtitle: 'Stupňovitá pyramida na severu', x: 0, z: -44, facingYaw: Math.PI },
  { id: 'muld_bazaar', name: 'Velký bazar', subtitle: 'Tržiště u jižního náměstí', x: -22, z: 54, facingYaw: -Math.PI * 0.75 },
  { id: 'muld_caravan', name: 'Karavanseraj', subtitle: 'Východní odpočívadlo karavan', x: 40, z: -16, facingYaw: Math.PI * 0.5 },
  { id: 'muld_south_gate', name: 'Jižní brána', subtitle: 'Výpadovka do hluboké pouště', x: 0, z: 88, facingYaw: 0 },
  { id: 'muld_east_gate', name: 'Východní brána', subtitle: 'Cesta k pyramidám', x: 88, z: 0, facingYaw: Math.PI * 0.5 },
];

export const MULD_BUILDINGS: MuldgardBuildingSpec[] = [
  // Palác na ostrově + 2 pavilony
  { id: 'muld_palace', name: 'Palác Muldgard', kind: 'palace', x: 0, z: -1, width: 20, depth: 12, height: 13, rotY: 0 },
  { id: 'muld_pavilion_a', name: 'Západní pavilon', kind: 'pavilion', x: -8, z: 9, width: 5, depth: 5, height: 5, rotY: 0 },
  { id: 'muld_pavilion_b', name: 'Východní pavilon', kind: 'pavilion', x: 8, z: -11, width: 5, depth: 5, height: 5, rotY: 0 },
  // Severní pás: chrám uprostřed, kasárna a sklad po stranách
  { id: 'muld_temple', name: 'Chrám písků', kind: 'temple', x: 0, z: -53, width: 20, depth: 12, height: 13, rotY: 0 },
  { id: 'muld_barracks', name: 'Kasárna stráží', kind: 'caravan', x: -26, z: -53, width: 14, depth: 10, height: 7, rotY: 0 },
  { id: 'muld_storehouse', name: 'Sklad karavan', kind: 'caravan', x: 26, z: -53, width: 14, depth: 10, height: 7, rotY: 0 },
  // Řemesla: kovárna západ, hrnčířství východ
  { id: 'muld_forge', name: 'Kovárna', kind: 'shop', x: -51, z: -38, width: 12, depth: 10, height: 6.5, rotY: Math.PI / 2 },
  { id: 'muld_pottery', name: 'Hrnčířství', kind: 'shop', x: 51, z: -38, width: 12, depth: 10, height: 6.5, rotY: -Math.PI / 2 },
  // Obchody u jižního náměstí
  { id: 'muld_weapon', name: 'Zbrojíř', kind: 'shop', x: -44, z: 53, width: 12, depth: 10, height: 6, rotY: 0 },
  { id: 'muld_tool', name: 'Kupec s potřebami', kind: 'shop', x: 44, z: 53, width: 12, depth: 10, height: 6, rotY: 0 },
  // Karavanseraje u cest
  { id: 'muld_caravan_w', name: 'Západní karavanseraj', kind: 'caravan', x: -51, z: -16, width: 12, depth: 14, height: 7.5, rotY: Math.PI / 2 },
  { id: 'muld_caravan_e', name: 'Východní karavanseraj', kind: 'caravan', x: 51, z: -16, width: 12, depth: 14, height: 7.5, rotY: -Math.PI / 2 },
  // Obytné domy západ / východ
  { id: 'muld_house_w1', name: 'Měšťanský dům', kind: 'house', x: -51, z: 14, width: 12, depth: 10, height: 6, rotY: Math.PI / 2 },
  { id: 'muld_house_w2', name: 'Řemeslnický dům', kind: 'house', x: -51, z: 34, width: 12, depth: 10, height: 6.4, rotY: Math.PI / 2 },
  { id: 'muld_house_e1', name: 'Bylinkářství', kind: 'house', x: 51, z: 14, width: 12, depth: 10, height: 6, rotY: -Math.PI / 2 },
  { id: 'muld_house_e2', name: 'Krejčovství', kind: 'house', x: 51, z: 34, width: 12, depth: 10, height: 6.4, rotY: -Math.PI / 2 },
  // Domy u jižního náměstí
  { id: 'muld_house_sw', name: 'Dům u bazaru', kind: 'house', x: -28, z: 53, width: 12, depth: 10, height: 6, rotY: Math.PI },
  { id: 'muld_house_se', name: 'Dům u brány', kind: 'house', x: 28, z: 53, width: 12, depth: 10, height: 6, rotY: Math.PI },
];

export const MULD_TENTS: StallSpec[] = [
  { id: 'muld_tent_1', x: -20, z: 50, rotY: 0, canopyColor: 0xe6dcc0, accentColor: 0x2e6e46, goods: 'fabrics' },
  { id: 'muld_tent_2', x: 20, z: 50, rotY: 0, canopyColor: 0xd68c28, accentColor: 0xfff3d8, goods: 'produce' },
  { id: 'muld_tent_3', x: -20, z: 58, rotY: Math.PI, canopyColor: 0x3b7a57, accentColor: 0xf4e3c1, goods: 'weapons' },
  { id: 'muld_tent_4', x: 20, z: 58, rotY: Math.PI, canopyColor: 0xe6dcc0, accentColor: 0x2e6e46, goods: 'potions' },
  { id: 'muld_tent_5', x: -38, z: -2, rotY: Math.PI / 2, canopyColor: 0xa83232, accentColor: 0xf6e6c4, goods: 'fruits' },
  { id: 'muld_tent_6', x: 38, z: -2, rotY: -Math.PI / 2, canopyColor: 0xc47b27, accentColor: 0xfaf0d7, goods: 'orchard' },
];

export const MULD_GARDENS: MuldgardGardenSpec[] = [
  { id: 'muld_garden_w', x1: -22, z1: 24, x2: -10, z2: 32 },
];

export const MULD_WELLS: MuldgardWellSpec[] = [
  { x: -16, z: 28 },
];

export const MULD_STATUES: MuldgardStatueSpec[] = [
  { x: -10, z: 72, rotY: 0 },
  { x: 10, z: 72, rotY: 0 },
  { x: -72, z: -10, rotY: Math.PI / 2 },
  { x: -72, z: 10, rotY: Math.PI / 2 },
  { x: 72, z: -10, rotY: -Math.PI / 2 },
  { x: 72, z: 10, rotY: -Math.PI / 2 },
  { x: -8, z: -40, rotY: 0 },
  { x: 8, z: -40, rotY: 0 },
];

export const MULD_PYRAMIDS: MuldgardPyramidSpec[] = [
  { id: 'muld_pyramid_kings', x: 120, z: -110, size: 26, height: 18 },
  { id: 'muld_pyramid_queens', x: -125, z: -95, size: 20, height: 14 },
  { id: 'muld_pyramid_sun', x: 110, z: 120, size: 22, height: 15 },
];

export const MULD_NPCS: NpcSpec[] = [
  { id: 'muld_kafra', name: 'Správkyně Kafra', role: 'Průvodkyně jezera', x: -5, z: 47, rotY: Math.PI * 0.25, tunicColor: 0x264b8c, hairColor: 0x3b2c4e, hatKind: 'kafra' },
  { id: 'muld_guide', name: 'Průvodce Said', role: 'Znalec pouště', x: 0, z: 47, rotY: Math.PI, tunicColor: 0x8b5e2e, hairColor: 0x2b211c, hatKind: 'merchant' },
  { id: 'muld_healer', name: 'Léčitelka Amira', role: 'Strážkyně vody', x: 5, z: 47, rotY: -Math.PI * 0.25, tunicColor: 0x3a6a9c, hairColor: 0xd9a74e, hatKind: 'cleric' },
  { id: 'muld_warper', name: 'Převaděč Omar', role: 'Pán karavan', x: 5, z: 60, rotY: Math.PI, tunicColor: 0x5c2e8b, hairColor: 0x4c3728, hatKind: 'knight' },
  { id: 'muld_weapon_dealer', name: 'Zbrojíř Hassan', role: 'Mistr bazaru', x: -40, z: 60, rotY: Math.PI, tunicColor: 0x8f2828, hairColor: 0x4c3728, hatKind: 'smith' },
  { id: 'muld_tool_dealer', name: 'Kupkyně Layla', role: 'Obchodnice', x: 40, z: 60, rotY: Math.PI, tunicColor: 0x8b5e2e, hairColor: 0x5c4033, hatKind: 'merchant' },
  { id: 'muld_guard_bridge', name: 'Kapitán stráží', role: 'Stráž mostu', x: 0, z: -42, rotY: 0, tunicColor: 0x8f2828, hairColor: 0x2b211c, hatKind: 'knight' },
  { id: 'muld_guard_south', name: 'Strážný Jusuf', role: 'Hlídka brány', x: 6, z: 80, rotY: 0, tunicColor: 0x6b5a2e, hairColor: 0x3a2c1e, hatKind: 'knight' },
  { id: 'muld_caravan_master', name: 'Karavanbaši Farid', role: 'Pán velbloudů', x: -43, z: -16, rotY: Math.PI / 2, tunicColor: 0x2e6e70, hairColor: 0x1e1a14, hatKind: 'merchant' },
  { id: 'muld_water', name: 'Nosič vody', role: 'Dar jezera', x: 30, z: 0, rotY: -Math.PI / 2, tunicColor: 0x2e6e70, hairColor: 0x1e1a14, hatKind: 'cleric' },
];

// Palmy: aleje podél tříd + okruh kolem jezera + konce mostů + zahrada
function buildMuldgardPalms(): MuldgardPalmSpec[] {
  const list: MuldgardPalmSpec[] = [
    // S-J třída (mimo průchod)
    { x: 10, z: -56 }, { x: -10, z: -56 },
    { x: 10, z: 44 }, { x: -10, z: 44 },
    { x: 10, z: 66 }, { x: -10, z: 66 },
    // V-Z třída (mimo budovy i cestu)
    { x: -58, z: 10 }, { x: -58, z: -26 },
    { x: 58, z: 10 }, { x: 58, z: -26 },
    // kolem jezera (vně vodní plochy, vedle okruhu)
    { x: -38, z: -28 }, { x: 38, z: -28 },
    { x: -38, z: 24 }, { x: 38, z: 24 },
    // konce mostů
    { x: 9, z: -33 }, { x: -9, z: -33 },
    { x: 9, z: 29 }, { x: -9, z: 29 },
    // zahrada
    { x: -21, z: 25 }, { x: -11, z: 25 },
    // měřítko doladí builder (1.0)
  ].map((p) => ({ ...p, scale: 1.0 }));

  // Vnější pouštní háje (deterministické, mimo cesty k branám a pyramidy)
  let seed = 7711;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 90; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 86 + rand() * 44;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x) < 13 || Math.abs(z) < 13) continue; // koridory k branám
    if (Math.abs(x) > 132 || Math.abs(z) > 132) continue;
    let nearPyramid = false;
    for (const p of MULD_PYRAMIDS) {
      if (Math.hypot(x - p.x, z - p.z) < p.size) { nearPyramid = true; break; }
    }
    if (nearPyramid) continue;
    list.push({ x, z, scale: 0.85 + rand() * 0.5 });
  }
  return list;
}

export const MULD_PALMS: MuldgardPalmSpec[] = buildMuldgardPalms();

// Suché keře ve městě (deterministické)
function buildMuldgardBushes(): { x: number; z: number; scale: number }[] {
  const spots: [number, number][] = [
    [-30, -44], [30, -44], [-30, 40], [30, 40], [-44, -30], [44, -30],
    [-44, 30], [44, 30], [-8, 68], [8, 68], [-64, -44], [64, -44],
    [-64, 44], [64, 44], [0, -68], [-20, -68], [20, -68],
  ];
  return spots.map(([x, z], i) => ({ x, z, scale: 0.8 + ((i * 37) % 10) / 22 }));
}

export const MULD_BUSHES = buildMuldgardBushes();

/** Vodní plocha jezera: blokuje vše kromě mostů (i se zábradlím) a ostrova. */
export function isMuldgardLakeBlocked(x: number, z: number): boolean {
  const inLake =
    x >= MULD_LAKE.x1 && x <= MULD_LAKE.x2 && z >= MULD_LAKE.z1 && z <= MULD_LAKE.z2;
  if (!inLake) return false;
  const onIsland =
    x >= MULD_ISLAND.x1 && x <= MULD_ISLAND.x2 && z >= MULD_ISLAND.z1 && z <= MULD_ISLAND.z2;
  if (onIsland) return false;
  const onBridgeNS =
    x >= MULD_BRIDGE_NS.x1 && x <= MULD_BRIDGE_NS.x2 && z >= MULD_BRIDGE_NS.z1 && z <= MULD_BRIDGE_NS.z2;
  const onBridgeEW =
    x >= MULD_BRIDGE_EW.x1 && x <= MULD_BRIDGE_EW.x2 && z >= MULD_BRIDGE_EW.z1 && z <= MULD_BRIDGE_EW.z2;
  // zábradlí mostu (krajní 0.8 m paluby) je pevné
  if (onBridgeNS) return Math.abs(x) > 2.2;
  if (onBridgeEW) return Math.abs(z) > 2.2;
  return true;
}

/** Výška terénu: rovina 0, ostrov 1.0, paluba mostu 0.8, nájezdy plynulá rampa. */
export function muldgardHeightAt(x: number, z: number): number {
  const onIsland =
    x >= MULD_ISLAND.x1 && x <= MULD_ISLAND.x2 && z >= MULD_ISLAND.z1 && z <= MULD_ISLAND.z2;
  if (onIsland) return 1.0;
  const lerpRamp = (t: number) => Math.max(0, Math.min(1, t)) * 0.8;
  // S-J most: severní nájezd z[-39,-31], paluba z[-31,27], jižní nájezd z[27,35]
  if (x >= MULD_BRIDGE_NS.x1 && x <= MULD_BRIDGE_NS.x2) {
    if (z >= -31 && z <= 27) return 0.8;
    if (z > -39 && z < -31) return lerpRamp((z + 39) / 8);
    if (z > 27 && z < 35) return lerpRamp((35 - z) / 8);
  }
  // V-Z most: západní nájezd x[-35,-27], paluba x[-27,27], východní x[27,35]
  if (z >= MULD_BRIDGE_EW.z1 && z <= MULD_BRIDGE_EW.z2) {
    if (x >= -27 && x <= 27) return 0.8;
    if (x > -35 && x < -27) return lerpRamp((x + 35) / 8);
    if (x > 27 && x < 35) return lerpRamp((35 - x) / 8);
  }
  return 0;
}

/** Pískové cesty: jižní náměstí + S-J a V-Z třída + nádvoří + okruh kolem jezera. */
export function isSandRoad(x: number, z: number): boolean {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (x >= -24 && x <= 24 && z >= 44 && z <= 64) return true; // jižní náměstí s bazarem
  if (ax <= 6.5 && z >= -64 && z <= 108) return true; // S-J třída
  if (az <= 6.5 && ax <= 108) return true; // V-Z třída
  if (ax <= 21 && z >= -64 && z <= -39) return true; // nádvoří chrámu
  // okružní třída kolem jezera (4 pásy bez překryvu, jen společné hrany)
  const inRingV = ax >= 28 && ax <= 35 && az <= 32;
  const inRingH = az >= 32 && az <= 39 && ax <= 35;
  if (inRingV || inRingH) return true;
  return false;
}

export function getMuldgardDistrictAt(x: number, z: number): string {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax > 76 || az > 76) return 'Poušť za hradbami';
  if (x >= MULD_LAKE.x1 && x <= MULD_LAKE.x2 && z >= MULD_LAKE.z1 && z <= MULD_LAKE.z2) {
    if (x >= MULD_ISLAND.x1 && x <= MULD_ISLAND.x2 && z >= MULD_ISLAND.z1 && z <= MULD_ISLAND.z2) {
      return 'Palác Muldgard';
    }
    return 'Muldgardské jezero';
  }
  if (x >= MULD_PLAZA_S.x1 && x <= MULD_PLAZA_S.x2 && z >= MULD_PLAZA_S.z1 && z <= MULD_PLAZA_S.z2) {
    return 'Velký bazar';
  }
  if (ax <= 10 && z >= 62) return 'Jižní brána';
  if (az <= 10 && x >= 62) return 'Východní brána';
  if (az <= 10 && x <= -62) return 'Západní brána';
  if (ax <= 22 && z <= -38) return 'Nádvoří chrámu';
  if (x > 26 && z < -30) return 'Chrámová čtvrť';
  if (x < -26 && z < -30) return 'Kasárna stráží';
  if (x < -38 && z > 8) return 'Západní obytná čtvrť';
  if (x > 38 && z > 8) return 'Východní obytná čtvrť';
  if (x > 38 && z < -8) return 'Karavanseraj';
  return 'Bazarová třída';
}

export function buildMuldgardColliders(): { rects: RectCollider[]; circles: CircleCollider[] } {
  const rects: RectCollider[] = [];
  const circles: CircleCollider[] = [];

  // 1. Hradby s průchody (J/Z/V) + severní křídla kolem chrámového nádvoří
  const wPos = MULD_WALL_POS;
  const ht = MULD_WALL_HALF_THICK;
  const gOpen = MULD_GATE_HALF_OPENING;
  rects.push({ id: 'muld_wall_s_w', minX: -wPos - ht, maxX: -gOpen, minZ: wPos - ht, maxZ: wPos + ht });
  rects.push({ id: 'muld_wall_s_e', minX: gOpen, maxX: wPos + ht, minZ: wPos - ht, maxZ: wPos + ht });
  rects.push({ id: 'muld_wall_w_n', minX: -wPos - ht, maxX: -wPos + ht, minZ: -wPos - ht, maxZ: -gOpen });
  rects.push({ id: 'muld_wall_w_s', minX: -wPos - ht, maxX: -wPos + ht, minZ: gOpen, maxZ: wPos + ht });
  rects.push({ id: 'muld_wall_e_n', minX: wPos - ht, maxX: wPos + ht, minZ: -wPos - ht, maxZ: -gOpen });
  rects.push({ id: 'muld_wall_e_s', minX: wPos - ht, maxX: wPos + ht, minZ: gOpen, maxZ: wPos + ht });
  rects.push({ id: 'muld_wall_n_w', minX: -wPos - ht, maxX: -21, minZ: -wPos - ht, maxZ: -wPos + ht });
  rects.push({ id: 'muld_wall_n_e', minX: 21, maxX: wPos + ht, minZ: -wPos - ht, maxZ: -wPos + ht });

  // 2. Rohové bašty
  const corners: [number, number][] = [[-wPos, -wPos], [wPos, -wPos], [-wPos, wPos], [wPos, wPos]];
  corners.forEach(([cx, cz], idx) => {
    circles.push({ id: `muld_bastion_${idx}`, x: cx, z: cz, r: 3.1 });
  });

  // 3. Budovy
  for (const b of MULD_BUILDINGS) {
    const rotated = Math.abs(Math.sin(b.rotY)) > 0.7;
    const hw = (rotated ? b.depth : b.width) / 2 + 0.35;
    const hd = (rotated ? b.width : b.depth) / 2 + 0.35;
    rects.push({ id: `muld_bldg_${b.id}`, minX: b.x - hw, maxX: b.x + hw, minZ: b.z - hd, maxZ: b.z + hd });
  }

  // 4. Bazarové stany
  for (const s of MULD_TENTS) {
    const rotated = Math.abs(Math.sin(s.rotY)) > 0.7;
    const hw = rotated ? 1.55 : 2.3;
    const hd = rotated ? 2.3 : 1.55;
    rects.push({ id: s.id, minX: s.x - hw, maxX: s.x + hw, minZ: s.z - hd, maxZ: s.z + hd });
  }

  // 5. Zahradní zídky + studna
  for (const gd of MULD_GARDENS) {
    const t = 0.5;
    rects.push({ id: `${gd.id}_n`, minX: gd.x1, maxX: gd.x2, minZ: gd.z1 - t, maxZ: gd.z1 + t });
    rects.push({ id: `${gd.id}_s`, minX: gd.x1, maxX: gd.x2, minZ: gd.z2 - t, maxZ: gd.z2 + t });
    rects.push({ id: `${gd.id}_w`, minX: gd.x1 - t, maxX: gd.x1 + t, minZ: gd.z1, maxZ: gd.z2 });
    rects.push({ id: `${gd.id}_e`, minX: gd.x2 - t, maxX: gd.x2 + t, minZ: gd.z1, maxZ: gd.z2 });
  }
  MULD_WELLS.forEach((wl, i) => {
    circles.push({ id: `muld_well_${i}`, x: wl.x, z: wl.z, r: 1.6 });
  });

  // 6. Jižní kašna na náměstí
  circles.push({ id: 'muld_fountain_s', x: MULD_FOUNTAIN_S.x, z: MULD_FOUNTAIN_S.z, r: MULD_FOUNTAIN_S.r });

  // 7. Sochy strážců
  MULD_STATUES.forEach((st, i) => {
    circles.push({ id: `muld_statue_${i}`, x: st.x, z: st.z, r: 1.1 });
  });

  // 8. Pyramidy v poušti
  for (const p of MULD_PYRAMIDS) {
    const h = p.size / 2;
    rects.push({ id: p.id, minX: p.x - h, maxX: p.x + h, minZ: p.z - h, maxZ: p.z + h });
  }

  // 9. Palmy a keře
  MULD_PALMS.forEach((t, i) => {
    circles.push({ id: `muld_palm_${i}`, x: t.x, z: t.z, r: 0.65 * t.scale });
  });
  MULD_BUSHES.forEach((b, i) => {
    circles.push({ id: `muld_bush_${i}`, x: b.x, z: b.z, r: 0.55 * b.scale });
  });

  // 10. NPC
  MULD_NPCS.forEach((n) => {
    circles.push({ id: `muld_npc_${n.id}`, x: n.x, z: n.z, r: 0.65 });
  });

  return { rects, circles };
}
