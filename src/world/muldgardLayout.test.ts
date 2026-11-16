import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationGrid } from './pathfinding';
import {
  MULD_BRIDGE_EW,
  MULD_BRIDGE_NS,
  MULD_BUILDINGS,
  MULD_ISLAND,
  MULD_LAKE,
  MULD_LANDMARKS,
  MULD_NPCS,
  MULD_PLAYER_SPAWN,
  MULD_PYRAMIDS,
  buildMuldgardColliders,
  isMuldgardLakeBlocked,
  isSandRoad,
} from './muldgardLayout';

function buildMuldgardNav(padNpcs: boolean): NavigationGrid {
  const { rects, circles } = buildMuldgardColliders();
  return new NavigationGrid({
    minCoord: -140,
    maxCoord: 140,
    cellSize: 2,
    rects,
    circles: padNpcs ? circles : circles.filter((c) => !c.id.startsWith('muld_npc_')),
    actorRadius: 0.7,
  });
}

test('muldgard spawn je walkable na písečné cestě', () => {
  const nav = buildMuldgardNav(true);
  assert.equal(
    nav.pointHitsCollider(MULD_PLAYER_SPAWN.x, MULD_PLAYER_SPAWN.z, 0.6),
    false,
    'spawn musí být walkable',
  );
  assert.equal(
    isSandRoad(MULD_PLAYER_SPAWN.x, MULD_PLAYER_SPAWN.z),
    true,
    'spawn musí ležet na cestě',
  );
});

test('všechny muldgard landmarky jsou dosažitelné ze spawnu', () => {
  const nav = buildMuldgardNav(true);
  for (const lm of MULD_LANDMARKS) {
    const path = nav.findPath(MULD_PLAYER_SPAWN.x, MULD_PLAYER_SPAWN.z, lm.x, lm.z);
    assert.ok(path.length > 0, `landmark ${lm.id} musí být dosažitelný`);
  }
});

test('muldgard brány J/V/Z jsou průchozí', () => {
  const nav = buildMuldgardNav(true);
  for (const [gx, gz] of [[0, 72], [-72, 0], [72, 0]] as [number, number][]) {
    assert.equal(
      nav.pointHitsCollider(gx, gz, 0.55),
      false,
      `brána ${gx},${gz} musí být průchozí`,
    );
  }
});

test('muldgard budovy neblokují hlavní třídy', () => {
  const onAvenue = (x: number, z: number) =>
    (Math.abs(x) <= 6.5 && z >= -64 && z <= 108) || (Math.abs(z) <= 6.5 && Math.abs(x) <= 108);
  // palác s pavilony stojí záměrně na křížení tříd (vedou na něj mosty),
  // chrám uzavírá severní osu jako dominanta (slepé chrámové nádvoří)
  const skip = new Set(['muld_palace', 'muld_pavilion_a', 'muld_pavilion_b', 'muld_temple']);
  for (const b of MULD_BUILDINGS) {
    if (skip.has(b.id)) continue;
    const rotated = Math.abs(Math.sin(b.rotY)) > 0.7;
    const hw = (rotated ? b.depth : b.width) / 2 + 1;
    const hd = (rotated ? b.width : b.depth) / 2 + 1;
    for (let x = Math.floor(b.x - hw); x <= b.x + hw + 1; x++) {
      for (let z = Math.floor(b.z - hd); z <= b.z + hd + 1; z++) {
        assert.equal(onAvenue(x, z), false, `budova ${b.id} blokuje třídu (${x},${z})`);
      }
    }
  }
});

test('muldgard NPC stojí na walkable místě', () => {
  const nav = buildMuldgardNav(false);
  for (const n of MULD_NPCS) {
    assert.equal(
      nav.pointHitsCollider(n.x, n.z, 0.6),
      false,
      `NPC ${n.id} musí stát na walkable místě`,
    );
  }
});

test('muldgard jezero blokuje vodu, mosty a ostrov jsou průchozí', () => {
  // střed jezera mimo mosty/ostrov = voda
  assert.equal(isMuldgardLakeBlocked(20, 20), true, 'voda blokuje');
  assert.equal(isMuldgardLakeBlocked(-20, -20), true, 'voda blokuje');
  // mosty
  assert.equal(
    isMuldgardLakeBlocked(
      (MULD_BRIDGE_NS.x1 + MULD_BRIDGE_NS.x2) / 2,
      (MULD_BRIDGE_NS.z1 + MULD_BRIDGE_NS.z2) / 2,
    ),
    false,
    'severní most průchozí',
  );
  assert.equal(
    isMuldgardLakeBlocked(
      (MULD_BRIDGE_EW.x1 + MULD_BRIDGE_EW.x2) / 2,
      (MULD_BRIDGE_EW.z1 + MULD_BRIDGE_EW.z2) / 2,
    ),
    false,
    'východní most průchozí',
  );
  // ostrov
  assert.equal(
    isMuldgardLakeBlocked(
      (MULD_ISLAND.x1 + MULD_ISLAND.x2) / 2,
      (MULD_ISLAND.z1 + MULD_ISLAND.z2) / 2,
    ),
    false,
    'ostrov průchozí',
  );
  // přes A* se dá dojít ze spawnu na ostrov
  const nav = buildMuldgardNav(true);
  assert.equal(isMuldgardLakeBlocked(MULD_LAKE.x1 + 2, MULD_LAKE.z1 + 2), true);
  const path = nav.findPath(MULD_PLAYER_SPAWN.x, MULD_PLAYER_SPAWN.z, 0, 8);
  assert.ok(path.length > 0, 'ze spawnu na ostrov vede cesta přes most');
});

test('muldgard pyramidy v poušti blokují průchod', () => {
  const nav = buildMuldgardNav(true);
  for (const p of MULD_PYRAMIDS) {
    assert.equal(
      nav.pointHitsCollider(p.x, p.z, 0.5),
      true,
      `pyramida ${p.id} musí blokovat`,
    );
  }
});
