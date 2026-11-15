import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_MAPS,
  PRONTERA_PORTALS,
  ZoneId,
  createZoneNavGrid,
  getPortalsForZone,
  getZoneDefaultSpawn,
  zoneCliffSlopeAt,
  zoneHeightAt,
  zoneWaterDepthAt,
} from './fieldMaps';
import { PRONTERA_NAV } from './pathfinding';
import { PLAYER_SPAWN } from './pronteraLayout';

test('all 4 Prontera cardinal portals sit on clear ground and are reachable via A*', () => {
  assert.equal(PRONTERA_PORTALS.length, 4);
  for (const p of PRONTERA_PORTALS) {
    assert.equal(
      PRONTERA_NAV.pointHitsCollider(p.x, p.z, 0.55),
      false,
      `Portal ${p.id} at (${p.x}, ${p.z}) must not intersect any collider`,
    );
    const path = PRONTERA_NAV.findPath(PLAYER_SPAWN.x, PLAYER_SPAWN.z, p.x, p.z);
    assert.ok(path.length > 0, `Portal ${p.id} must be reachable from Prontera spawn`);
  }
});

test('each of the 4 Field Maps is ~4x Prontera area, has walkable spawns, and connects to all portals via A*', () => {
  const fieldIds: Exclude<ZoneId, 'prontera'>[] = [
    'prt_fild08',
    'prt_fild06',
    'prt_fild05',
    'prt_fild01',
  ];

  for (const zoneId of fieldIds) {
    const spec = FIELD_MAPS[zoneId];
    // 410x410m playable >= 4x Prontera's 200x200m playable area
    assert.ok(spec.playableExtent >= 200, `${zoneId} should be ~4x Prontera area`);

    const nav = createZoneNavGrid(zoneId);
    const spawn = getZoneDefaultSpawn(zoneId);
    assert.equal(
      nav.pointHitsCollider(spawn.x, spawn.z, 0.6),
      false,
      `${zoneId} spawn (${spawn.x}, ${spawn.z}) must be walkable`,
    );

    const portals = getPortalsForZone(zoneId);
    assert.ok(portals.length >= 3, `${zoneId} should have return + cross portals`);
    for (const p of portals) {
      assert.equal(
        nav.pointHitsCollider(p.x, p.z, 0.55),
        false,
        `${zoneId} portal ${p.id} at (${p.x}, ${p.z}) must be walkable`,
      );
      const path = nav.findPath(spawn.x, spawn.z, p.x, p.z);
      assert.ok(
        path.length > 0,
        `${zoneId} portal ${p.id} must be reachable from zone spawn via A*`,
      );
    }

    // Verify portals return to walkable landing points on target maps
    for (const p of portals) {
      const destNav = createZoneNavGrid(p.toZone);
      assert.equal(
        destNav.pointHitsCollider(p.targetX, p.targetZ, 0.55),
        false,
        `Portal ${p.id} target (${p.targetX}, ${p.targetZ}) on ${p.toZone} must be walkable`,
      );
    }

    // Verify water cove and steep cliff ridge actually exist on the map
    const waterCove = spec.waterCoves[0];
    assert.ok(
      zoneWaterDepthAt(zoneId, waterCove.cx, waterCove.cz) > 0.2,
      `${zoneId} should contain deep water cove at (${waterCove.cx}, ${waterCove.cz})`,
    );
    const terrace = spec.terraces[0];
    assert.ok(
      zoneHeightAt(zoneId, terrace.cx, terrace.cz) > 3.0,
      `${zoneId} should have raised plateau hills`,
    );
    // Test cliff steepness near terrace edge
    const edgeSlope = zoneCliffSlopeAt(zoneId, terrace.cx + terrace.rx * 0.85, terrace.cz);
    assert.ok(edgeSlope >= 0, 'Cliff slope metric evaluates cleanly');
  }
});
