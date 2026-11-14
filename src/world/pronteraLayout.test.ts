import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANDMARKS,
  PLAYER_SPAWN,
  getDistrictAt,
  groundHeightAt,
  isCobbleRoad,
} from './pronteraLayout';
import { PRONTERA_NAV } from './pathfinding';

test('player spawn is walkable, on cobble road, and grounded at y=0', () => {
  assert.equal(groundHeightAt(PLAYER_SPAWN.x, PLAYER_SPAWN.z), 0);
  assert.equal(isCobbleRoad(PLAYER_SPAWN.x, PLAYER_SPAWN.z), true);
  assert.equal(
    PRONTERA_NAV.pointHitsCollider(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0.55),
    false,
  );
});

test('all landmarks are reachable from player spawn via A* pathfinding', () => {
  for (const lm of LANDMARKS) {
    assert.equal(
      PRONTERA_NAV.pointHitsCollider(lm.x, lm.z, 0.55),
      false,
      `Landmark ${lm.id} should not collide with obstacles`,
    );
    const path = PRONTERA_NAV.findPath(
      PLAYER_SPAWN.x,
      PLAYER_SPAWN.z,
      lm.x,
      lm.z,
    );
    assert.ok(
      path.length > 0,
      `Expected valid path from spawn to ${lm.id} (${lm.x}, ${lm.z})`,
    );
  }
});

test('south, east, and west gates allow walking out to the fields', () => {
  const southOut = PRONTERA_NAV.findPath(0, 50, 0, 96);
  assert.ok(southOut.length > 0, 'South gate bridge should be passable');

  const eastOut = PRONTERA_NAV.findPath(50, 0, 96, 0);
  assert.ok(eastOut.length > 0, 'East gate bridge should be passable');

  const westOut = PRONTERA_NAV.findPath(-50, 0, -96, 0);
  assert.ok(westOut.length > 0, 'West gate bridge should be passable');
});

test('solid walls and fountain basin block direct entry and resolveCollision pushes cleanly', () => {
  assert.equal(PRONTERA_NAV.pointHitsCollider(0, 0, 0.5), true);
  assert.equal(PRONTERA_NAV.pointHitsCollider(40, 72, 0.5), true);

  const pushed = PRONTERA_NAV.resolveCollision(0, 1.5, 0.58);
  const distFromCenter = Math.hypot(pushed.x, pushed.z);
  assert.ok(distFromCenter >= 5.5, `Expected push outside fountain, got ${distFromCenter}`);
});

test('district lookup returns accurate Czech Prontera district names', () => {
  assert.equal(getDistrictAt(0, 14), 'Centrální kašna');
  assert.equal(getDistrictAt(0, -48), 'Nádvoří hradu Prontera');
  assert.equal(getDistrictAt(52, -36), 'Katedrální čtvrť');
  assert.equal(getDistrictAt(-52, -36), 'Cech rytířů');
  assert.equal(getDistrictAt(-22, 22), 'Velké tržiště');
  assert.equal(getDistrictAt(0, 95), 'Jižní pronterské louky');
});
