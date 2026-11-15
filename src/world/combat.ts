import { ZoneId, createZoneNavGrid, getPortalsForZone } from './fieldMaps';

export type MobKind =
  | 'mire_slime'
  | 'ember_beetle'
  | 'briar_boar'
  | 'frost_wisp'
  | 'venom_spitter'
  | 'wolf'
  | 'goblin'
  | 'ent';

export interface MobTemplate {
  kind: MobKind;
  name: string;
  level: number;
  maxHp: number;
  color: number;
  scale: number;
  zenyReward: number;
  expReward: number;
  hopSpeed: number;
}

export const MOB_TEMPLATES: Record<MobKind, MobTemplate> = {
  mire_slime: {
    kind: 'mire_slime',
    name: 'Bahenní sliz',
    level: 1,
    maxHp: 32,
    color: 0x4ca866,
    scale: 0.96,
    zenyReward: 14,
    expReward: 16,
    hopSpeed: 3.4,
  },
  ember_beetle: {
    kind: 'ember_beetle',
    name: 'Žhnoucí brouk',
    level: 3,
    maxHp: 48,
    color: 0xd47a2c,
    scale: 1.02,
    zenyReward: 20,
    expReward: 24,
    hopSpeed: 4.1,
  },
  briar_boar: {
    kind: 'briar_boar',
    name: 'Trnový divočák',
    level: 4,
    maxHp: 62,
    color: 0x5a4334,
    scale: 1.06,
    zenyReward: 26,
    expReward: 30,
    hopSpeed: 4.7,
  },
  frost_wisp: {
    kind: 'frost_wisp',
    name: 'Mrazivý blud',
    level: 5,
    maxHp: 68,
    color: 0x6cd4f5,
    scale: 1.04,
    zenyReward: 30,
    expReward: 36,
    hopSpeed: 3.5,
  },
  wolf: {
    kind: 'wolf',
    name: 'Vlk',
    level: 6,
    maxHp: 82,
    color: 0x7a6554,
    scale: 1.08,
    zenyReward: 42,
    expReward: 48,
    hopSpeed: 5.2,
  },
  venom_spitter: {
    kind: 'venom_spitter',
    name: 'Jedovatý plivník',
    level: 7,
    maxHp: 94,
    color: 0x7abf48,
    scale: 1.16,
    zenyReward: 48,
    expReward: 55,
    hopSpeed: 3.6,
  },
  goblin: {
    kind: 'goblin',
    name: 'Skřet',
    level: 8,
    maxHp: 112,
    color: 0x587846,
    scale: 1.06,
    zenyReward: 62,
    expReward: 74,
    hopSpeed: 4.2,
  },
  ent: {
    kind: 'ent',
    name: 'Stromový ent',
    level: 11,
    maxHp: 165,
    color: 0x5c4632,
    scale: 1.28,
    zenyReward: 98,
    expReward: 120,
    hopSpeed: 2.1,
  },
};

export interface MobSpawnSpec {
  id: string;
  kind: MobKind;
  x: number;
  z: number;
}

export const FIELD_MOB_SPAWNS: MobSpawnSpec[] = [
  // Southern Kaldgard Fields (dense hunting ground right below South Gate)
  { id: 'mob_s1', kind: 'mire_slime', x: -10, z: 91 },
  { id: 'mob_s2', kind: 'mire_slime', x: 11, z: 92 },
  { id: 'mob_s3', kind: 'ember_beetle', x: -17, z: 97 },
  { id: 'mob_s4', kind: 'briar_boar', x: 16, z: 99 },
  { id: 'mob_s5', kind: 'mire_slime', x: -5, z: 103 },
  { id: 'mob_s6', kind: 'ember_beetle', x: 8, z: 105 },
  { id: 'mob_s7', kind: 'briar_boar', x: -24, z: 108 },
  { id: 'mob_s8', kind: 'frost_wisp', x: 24, z: 108 },
  { id: 'mob_s9', kind: 'wolf', x: -13, z: 114 },
  { id: 'mob_s10', kind: 'venom_spitter', x: 2, z: 118 },
  { id: 'mob_s11', kind: 'briar_boar', x: 14, z: 117 },
  { id: 'mob_s12', kind: 'frost_wisp', x: -26, z: 121 },
  { id: 'mob_s13', kind: 'goblin', x: 28, z: 122 },
  { id: 'mob_s14', kind: 'venom_spitter', x: -8, z: 126 },
  // Eastern & Western Kaldgard Outskirts
  { id: 'mob_e1', kind: 'mire_slime', x: 93, z: 14 },
  { id: 'mob_e2', kind: 'wolf', x: 96, z: -13 },
  { id: 'mob_e3', kind: 'ember_beetle', x: 104, z: 8 },
  { id: 'mob_w1', kind: 'mire_slime', x: -92, z: 15 },
  { id: 'mob_w2', kind: 'goblin', x: -95, z: -14 },
  { id: 'mob_w3', kind: 'briar_boar', x: -104, z: -6 },
];

const FIELD_ZONE_POOLS: Record<Exclude<ZoneId, 'prontera'>, MobKind[]> = {
  prt_fild08: [
    'wolf',
    'wolf',
    'goblin',
    'goblin',
    'ent',
    'mire_slime',
    'briar_boar',
    'venom_spitter',
    'wolf',
    'goblin',
    'ent',
  ],
  prt_fild06: [
    'ent',
    'ent',
    'wolf',
    'wolf',
    'goblin',
    'venom_spitter',
    'frost_wisp',
    'ent',
    'wolf',
  ],
  prt_fild05: [
    'goblin',
    'goblin',
    'wolf',
    'wolf',
    'ent',
    'ember_beetle',
    'briar_boar',
    'goblin',
  ],
  prt_fild01: [
    'ent',
    'wolf',
    'goblin',
    'ent',
    'wolf',
    'goblin',
    'venom_spitter',
    'frost_wisp',
  ],
};

function seededMobRand(seedInit: number): () => number {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const zoneSpawnCache = new Map<ZoneId, MobSpawnSpec[]>();

export function getMobSpawnsForZone(zoneId: ZoneId): MobSpawnSpec[] {
  if (zoneId === 'prontera') return FIELD_MOB_SPAWNS;
  const cached = zoneSpawnCache.get(zoneId);
  if (cached) return cached;

  const nav = createZoneNavGrid(zoneId);
  const portals = getPortalsForZone(zoneId);
  const pool = FIELD_ZONE_POOLS[zoneId];
  const seedNum =
    zoneId === 'prt_fild08'
      ? 8080
      : zoneId === 'prt_fild06'
        ? 6060
        : zoneId === 'prt_fild05'
          ? 5050
          : 1010;
  const rand = seededMobRand(seedNum);

  const spawns: MobSpawnSpec[] = [];
  const targetCount = 46;

  // Curated welcome hunting pack near spawn trail so players meet Wolves/Goblins/Ents quickly
  const starterCoords: [number, number][] =
    zoneId === 'prt_fild08'
      ? [
          [-18, -142],
          [16, -138],
          [-24, -104],
          [22, -96],
          [-44, -84],
          [32, -46],
        ]
      : zoneId === 'prt_fild06'
        ? [
            [-140, -18],
            [-134, 22],
            [-95, -24],
            [-85, 36],
            [-58, -16],
          ]
        : zoneId === 'prt_fild05'
          ? [
              [138, -20],
              [132, 24],
              [96, -42],
              [78, 22],
              [48, -28],
            ]
          : [
              [-20, 140],
              [24, 136],
              [34, 82],
              [-32, 92],
              [12, 46],
            ];

  starterCoords.forEach(([sx, sz], idx) => {
    if (!nav.pointHitsCollider(sx, sz, 1.25)) {
      spawns.push({
        id: `${zoneId}_starter_${idx}`,
        kind: pool[idx % pool.length],
        x: sx,
        z: sz,
      });
    }
  });

  for (let attempt = 0; attempt < 900 && spawns.length < targetCount; attempt++) {
    const x = Math.round((rand() * 2 - 1) * 182);
    const z = Math.round((rand() * 2 - 1) * 182);
    if (nav.pointHitsCollider(x, z, 1.35)) continue;

    // Keep clear of portal trigger rings
    let nearPortal = false;
    for (const p of portals) {
      if (Math.hypot(x - p.x, z - p.z) < 16) {
        nearPortal = true;
        break;
      }
    }
    if (nearPortal) continue;

    // Space out mobs naturally
    let tooClose = false;
    for (const s of spawns) {
      if (Math.hypot(x - s.x, z - s.z) < 16) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const kind = pool[spawns.length % pool.length];
    spawns.push({
      id: `${zoneId}_mob_${spawns.length}`,
      kind,
      x,
      z,
    });
  }

  zoneSpawnCache.set(zoneId, spawns);
  return spawns;
}

export interface MobCombatEntity {
  id: string;
  kind: MobKind;
  name: string;
  level: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  zenyReward: number;
  expReward: number;
}

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  killed: boolean;
  zenyEarned: number;
  expEarned: number;
}

export const SWORDSMAN_MELEE_RANGE = 2.75;
export const SWORDSMAN_ATTACK_COOLDOWN = 0.44;
export const MOB_RESPAWN_SECONDS = 8.0;

export function computeSwordDamage(comboIndex: number, playerLevel: number, roll = Math.random()): {
  damage: number;
  isCrit: boolean;
} {
  const base = 14 + (playerLevel - 1) * 4 + (comboIndex === 2 ? 7 : comboIndex * 2);
  const variance = Math.floor((roll * 7) - 2);
  const isCrit = roll > 0.78 || comboIndex === 2;
  const raw = Math.max(8, base + variance);
  return {
    damage: isCrit ? Math.round(raw * 1.45) : raw,
    isCrit,
  };
}

export function applyDamageToMob(
  mob: MobCombatEntity,
  damage: number,
  isCrit: boolean,
): DamageResult {
  if (!mob.alive) {
    return { damage: 0, isCrit: false, killed: false, zenyEarned: 0, expEarned: 0 };
  }
  mob.hp = Math.max(0, mob.hp - damage);
  const killed = mob.hp <= 0;
  if (killed) {
    mob.alive = false;
    mob.respawnTimer = MOB_RESPAWN_SECONDS;
    return {
      damage,
      isCrit,
      killed: true,
      zenyEarned: mob.zenyReward,
      expEarned: mob.expReward,
    };
  }
  return {
    damage,
    isCrit,
    killed: false,
    zenyEarned: 0,
    expEarned: 0,
  };
}

export function findNearestAliveMob<T extends { alive: boolean; x: number; z: number }>(
  mobs: T[],
  px: number,
  pz: number,
  maxDist: number,
): T | null {
  let best: T | null = null;
  let bestD = maxDist;
  for (const m of mobs) {
    if (!m.alive) continue;
    const d = Math.hypot(m.x - px, m.z - pz);
    if (d <= bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

export function expForNextLevel(level: number): number {
  return 60 + (level - 1) * 45;
}
