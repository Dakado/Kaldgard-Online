import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_MOB_SPAWNS,
  MOB_TEMPLATES,
  MobCombatEntity,
  SWORDSMAN_MELEE_RANGE,
  applyDamageToMob,
  computeSwordDamage,
  findNearestAliveMob,
} from './combat';
import { PRONTERA_NAV } from './pathfinding';

test('field mob spawns sit outside Prontera walls in walkable field spots', () => {
  const southMobs = FIELD_MOB_SPAWNS.filter((m) => m.z >= 88);
  assert.ok(southMobs.length >= 12, 'Expected dense hunting ground south of Prontera');
  for (const m of FIELD_MOB_SPAWNS) {
    assert.equal(
      PRONTERA_NAV.pointHitsCollider(m.x, m.z, 0.5),
      false,
      `Mob ${m.id} (${m.x}, ${m.z}) should not spawn inside a collider`,
    );
  }
});

test('sword damage scales with combo and awards zeny/exp on kill', () => {
  const tmpl = MOB_TEMPLATES.poring;
  const mob: MobCombatEntity = {
    id: 'test_poring',
    kind: 'poring',
    name: tmpl.name,
    level: tmpl.level,
    x: 0,
    z: 92,
    hp: 30,
    maxHp: 30,
    alive: true,
    respawnTimer: 0,
    zenyReward: tmpl.zenyReward,
    expReward: tmpl.expReward,
  };

  const hit1 = computeSwordDamage(0, 1, 0.4);
  const res1 = applyDamageToMob(mob, hit1.damage, hit1.isCrit);
  assert.equal(res1.killed, false);
  assert.ok(mob.hp < 30 && mob.hp > 0);

  const hit3 = computeSwordDamage(2, 1, 0.9);
  assert.equal(hit3.isCrit, true);
  const res2 = applyDamageToMob(mob, mob.hp + 5, hit3.isCrit);
  assert.equal(res2.killed, true);
  assert.equal(mob.alive, false);
  assert.equal(res2.zenyEarned, tmpl.zenyReward);
  assert.equal(res2.expEarned, tmpl.expReward);
});

test('findNearestAliveMob selects closest living mob within range', () => {
  const mobs = [
    { id: 'dead', alive: false, x: 0, z: 90 },
    { id: 'far', alive: true, x: 0, z: 100 },
    { id: 'near', alive: true, x: 1.2, z: 91.2 },
  ];
  const found = findNearestAliveMob(mobs, 0, 90, SWORDSMAN_MELEE_RANGE);
  assert.equal(found?.id, 'near');
});
