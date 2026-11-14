export type MobKind = 'poring' | 'drops' | 'marin' | 'lunatic' | 'poporing';

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
  poring: {
    kind: 'poring',
    name: 'Poring',
    level: 1,
    maxHp: 30,
    color: 0xff7da0,
    scale: 0.95,
    zenyReward: 12,
    expReward: 15,
    hopSpeed: 3.6,
  },
  drops: {
    kind: 'drops',
    name: 'Drops',
    level: 3,
    maxHp: 45,
    color: 0xffb24c,
    scale: 1.0,
    zenyReward: 18,
    expReward: 22,
    hopSpeed: 3.9,
  },
  lunatic: {
    kind: 'lunatic',
    name: 'Lunatic',
    level: 4,
    maxHp: 55,
    color: 0xf4eee4,
    scale: 1.05,
    zenyReward: 24,
    expReward: 28,
    hopSpeed: 4.5,
  },
  marin: {
    kind: 'marin',
    name: 'Marin',
    level: 5,
    maxHp: 65,
    color: 0x5cc9e8,
    scale: 1.05,
    zenyReward: 28,
    expReward: 34,
    hopSpeed: 3.4,
  },
  poporing: {
    kind: 'poporing',
    name: 'Poporing',
    level: 7,
    maxHp: 90,
    color: 0x6cd688,
    scale: 1.24,
    zenyReward: 45,
    expReward: 52,
    hopSpeed: 3.1,
  },
};

export interface MobSpawnSpec {
  id: string;
  kind: MobKind;
  x: number;
  z: number;
}

export const FIELD_MOB_SPAWNS: MobSpawnSpec[] = [
  // Southern Prontera Fields (dense classic hunting ground right below South Gate!)
  { id: 'mob_s1', kind: 'poring', x: -10, z: 91 },
  { id: 'mob_s2', kind: 'poring', x: 11, z: 92 },
  { id: 'mob_s3', kind: 'drops', x: -17, z: 97 },
  { id: 'mob_s4', kind: 'lunatic', x: 16, z: 99 },
  { id: 'mob_s5', kind: 'poring', x: -5, z: 103 },
  { id: 'mob_s6', kind: 'drops', x: 8, z: 105 },
  { id: 'mob_s7', kind: 'lunatic', x: -24, z: 108 },
  { id: 'mob_s8', kind: 'marin', x: 24, z: 108 },
  { id: 'mob_s9', kind: 'poring', x: -13, z: 114 },
  { id: 'mob_s10', kind: 'poporing', x: 2, z: 118 },
  { id: 'mob_s11', kind: 'lunatic', x: 14, z: 117 },
  { id: 'mob_s12', kind: 'marin', x: -26, z: 121 },
  { id: 'mob_s13', kind: 'drops', x: 28, z: 122 },
  { id: 'mob_s14', kind: 'poporing', x: -8, z: 126 },
  // Eastern & Western Prontera Fields
  { id: 'mob_e1', kind: 'poring', x: 93, z: 14 },
  { id: 'mob_e2', kind: 'lunatic', x: 96, z: -13 },
  { id: 'mob_e3', kind: 'drops', x: 104, z: 8 },
  { id: 'mob_w1', kind: 'poring', x: -92, z: 15 },
  { id: 'mob_w2', kind: 'marin', x: -95, z: -14 },
  { id: 'mob_w3', kind: 'lunatic', x: -104, z: -6 },
];

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
