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
  getMobSpawnsForZone,
} from './combat';
import { FIELD_MAPS, ZoneId, createZoneNavGrid, zoneHeightAt, zoneTrailMaskAt } from './fieldMaps';
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

test('all 4 Prontera field maps spawn Wolves, Goblins, and Tree Ents on walkable terrain', () => {
  const fieldIds: Exclude<ZoneId, 'prontera'>[] = [
    'prt_fild08',
    'prt_fild06',
    'prt_fild05',
    'prt_fild01',
  ];
  for (const zoneId of fieldIds) {
    const spawns = getMobSpawnsForZone(zoneId);
    const nav = createZoneNavGrid(zoneId);
    assert.ok(spawns.length >= 30, `Expected rich hunting ground in ${zoneId}, got ${spawns.length}`);
    const kinds = new Set(spawns.map((s) => s.kind));
    assert.ok(kinds.has('wolf'), `${zoneId} should spawn wolves`);
    assert.ok(kinds.has('goblin'), `${zoneId} should spawn goblins`);
    assert.ok(kinds.has('ent'), `${zoneId} should spawn tree ents`);
    for (const s of spawns) {
      assert.equal(
        nav.pointHitsCollider(s.x, s.z, 0.55),
        false,
        `Field mob ${s.id} (${s.x}, ${s.z}) in ${zoneId} should not clip collider/cliff/water`,
      );
    }
  }
});

test('sword damage scales with combo and awards zeny/exp on kill', () => {
  const tmpl = MOB_TEMPLATES.mire_slime;
  const mob: MobCombatEntity = {
    id: 'test_slime',
    kind: 'mire_slime',
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

test('every elevated rocky terrace across all 4 field maps has a walkable ascent path to its summit', () => {
  const fieldIds: Exclude<ZoneId, 'prontera'>[] = [
    'prt_fild08',
    'prt_fild06',
    'prt_fild05',
    'prt_fild01',
  ];
  for (const zoneId of fieldIds) {
    const spec = FIELD_MAPS[zoneId];
    const nav = createZoneNavGrid(zoneId);
    for (let i = 0; i < spec.terraces.length; i++) {
      const t = spec.terraces[i];
      const path = nav.findPath(spec.spawnX, spec.spawnZ, t.cx, t.cz);
      assert.ok(
        path.length > 0,
        `${zoneId} terrace #${i} (${t.cx}, ${t.cz}) should be reachable via winding path`,
      );
      const last = path[path.length - 1];
      const distToCenter = Math.hypot(last.x - t.cx, last.z - t.cz);
      assert.ok(
        distToCenter < 5.0,
        `${zoneId} terrace #${i} path ended ${distToCenter.toFixed(2)}m from summit`,
      );
      const summitY = zoneHeightAt(zoneId, last.x, last.z);
      assert.ok(
        summitY >= t.height * 0.72,
        `${zoneId} terrace #${i} summit elevation ${summitY.toFixed(2)}m should reach plateau height ${t.height}`,
      );
      if (t.ascentSamples && t.ascentSamples.length > 4) {
        const upperPt = t.ascentSamples[Math.floor(t.ascentSamples.length * 0.82)];
        const trailMask = zoneTrailMaskAt(zoneId, upperPt.x, upperPt.z);
        assert.ok(
          trailMask < 0.15,
          `${zoneId} terrace #${i} upper ascent (${upperPt.x.toFixed(1)}, ${upperPt.z.toFixed(1)}) should remain grassy (trailMask=${trailMask.toFixed(2)})`,
        );
      }
    }
  }
});

test('bridges on east and south field maps connect flush with riverbanks and are collision-free', () => {
  const bridgedZones: Exclude<ZoneId, 'prontera'>[] = ['prt_fild08', 'prt_fild06'];
  for (const zoneId of bridgedZones) {
    const spec = FIELD_MAPS[zoneId];
    const nav = createZoneNavGrid(zoneId);
    assert.ok(spec.bridges.length > 0);
    for (const b of spec.bridges) {
      const halfW = b.width * 0.5;
      const cos = Math.cos(b.rotY);
      const sin = Math.sin(b.rotY);
      const leftX = b.x - (halfW - 0.5) * cos;
      const leftZ = b.z + (halfW - 0.5) * sin;
      const rightX = b.x + (halfW - 0.5) * cos;
      const rightZ = b.z - (halfW - 0.5) * sin;
      const bankLeftX = b.x - (halfW + 1.8) * cos;
      const bankLeftZ = b.z + (halfW + 1.8) * sin;
      const bankRightX = b.x + (halfW + 1.8) * cos;
      const bankRightZ = b.z - (halfW + 1.8) * sin;

      const path = nav.findPath(bankLeftX - 4 * cos, bankLeftZ, bankRightX + 4 * cos, bankRightZ);
      assert.ok(path.length > 0, `Bridge at (${b.x}, ${b.z}) in ${zoneId} must be traversable`);

      const hBridgeL = zoneHeightAt(zoneId, leftX, leftZ);
      const hBankL = zoneHeightAt(zoneId, bankLeftX, bankLeftZ);
      const hBridgeR = zoneHeightAt(zoneId, rightX, rightZ);
      const hBankR = zoneHeightAt(zoneId, bankRightX, bankRightZ);
      const hMid = zoneHeightAt(zoneId, b.x, b.z);

      assert.ok(
        Math.abs(hBridgeL - hBankL) < 0.35,
        `${zoneId} bridge left landing delta too big: bridge=${hBridgeL.toFixed(2)}, bank=${hBankL.toFixed(2)}`,
      );
      assert.ok(
        Math.abs(hBridgeR - hBankR) < 0.35,
        `${zoneId} bridge right landing delta too big: bridge=${hBridgeR.toFixed(2)}, bank=${hBankR.toFixed(2)}`,
      );
      assert.ok(hMid > hBridgeL + 0.35, `${zoneId} bridge center should arch gently above bridge ends`);
    }
  }
});


