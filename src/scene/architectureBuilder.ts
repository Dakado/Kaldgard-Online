import * as THREE from 'three';
import {
  BUILDINGS,
  BuildingSpec,
  CITY_WALL_POS,
  GATE_HALF_OPENING,
  LANTERNS,
  MARKET_STALLS,
  MOAT_INNER,
  MOAT_OUTER,
  TREES,
  groundHeightAt,
  isCobbleRoad,
} from '../world/pronteraLayout';
import { PronteraMaterials } from './materials';

function getRoofMaterial(tone: BuildingSpec['roofTone'], mats: PronteraMaterials) {
  switch (tone) {
    case 'cobalt':
      return mats.roofCobalt;
    case 'terracotta':
      return mats.roofTerracotta;
    case 'slate':
      return mats.roofSlate;
    case 'royal':
      return mats.roofRoyal;
  }
}

function worldScaledBox(
  w: number,
  h: number,
  d: number,
  tileSize = 5.0,
  offsetX = 0,
  offsetZ = 0,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));

    if (ny > 0.5) {
      uv.setXY(i, (x + offsetX) / tileSize, (z + offsetZ) / tileSize);
    } else if (nx > 0.5) {
      uv.setXY(i, (z + offsetZ) / tileSize, y / tileSize);
    } else {
      uv.setXY(i, (x + offsetX) / tileSize, y / tileSize);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function createPitchedRoofGeometry(width: number, depth: number, ridgeHeight: number): THREE.ExtrudeGeometry {
  const hw = width / 2 + 0.72;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(0, ridgeHeight);
  shape.lineTo(hw, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth + 1.3,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -(depth + 1.3) / 2);

  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / 3.4, uv.getY(i) / 3.4);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createGableTriangleGeometry(width: number, depth: number, ridgeHeight: number): THREE.ExtrudeGeometry {
  const hw = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(0, ridgeHeight - 0.1);
  shape.lineTo(hw, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -depth / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / 5.0, uv.getY(i) / 5.0);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createStoneArchGeometry(
  outerW: number,
  outerH: number,
  innerR: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const hw = outerW / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, outerH);
  shape.lineTo(hw, outerH);
  shape.lineTo(hw, 0);
  shape.lineTo(innerR, 0);
  shape.lineTo(innerR, outerH * 0.48);
  shape.absarc(0, outerH * 0.48, innerR, 0, Math.PI, false);
  shape.lineTo(-innerR, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function addGroundAoSkirt(parent: THREE.Object3D, w: number, d: number, mats: PronteraMaterials, y = 0.032) {
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 1.4, d + 1.4),
    mats.aoSkirt,
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = y;
  parent.add(skirt);
}

export function buildTerrainAndRoads(mats: PronteraMaterials): {
  group: THREE.Group;
  groundPickMesh: THREE.Mesh;
  moatWaterMeshes: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const moatWaterMeshes: THREE.Mesh[] = [];

  // 1. Sculpted outer countryside & base grass ground (high resolution so moat trench carves cleanly)
  const groundGeo = new THREE.PlaneGeometry(460, 460, 144, 144);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeightAt(x, z));
  }
  groundGeo.computeVertexNormals();

  const grassMesh = new THREE.Mesh(groundGeo, mats.grass);
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // Invisible flat raycast plane for silky RO click-to-move
  const pickGeo = new THREE.PlaneGeometry(280, 280);
  pickGeo.rotateX(-Math.PI / 2);
  const groundPickMesh = new THREE.Mesh(
    pickGeo,
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  groundPickMesh.position.y = 0.02;
  group.add(groundPickMesh);

  // 2. Seamless Cobblestone Road Network + Carved Stone Curbstones (strictly separated Y layers)
  const addCobbleRect = (x: number, z: number, w: number, d: number, yCenter = 0.028, h = 0.044, withCurb = false) => {
    const m = new THREE.Mesh(worldScaledBox(w, h, d, 5.0, x, z), mats.cobble);
    m.position.set(x, yCenter, z);
    m.receiveShadow = true;
    group.add(m);

    if (withCurb) {
      const curb = new THREE.Mesh(
        worldScaledBox(w + 0.56, 0.036, d + 0.56, 4.0, x, z),
        mats.curbStone,
      );
      curb.position.set(x, 0.018, z);
      curb.receiveShadow = true;
      group.add(curb);
    }
  };

  // Central Plaza & Avenues
  addCobbleRect(0, 0, 33, 33, 0.036, 0.048, true); // top = 0.060
  addCobbleRect(0, 22, 13, 172, 0.028, 0.044, true); // top = 0.050
  addCobbleRect(0, 0, 216, 13, 0.028, 0.044, true); // top = 0.050
  addCobbleRect(0, -51.5, 42, 25, 0.032, 0.046, true); // top = 0.055

  // Inner Ring Boulevard
  addCobbleRect(-36, 0, 7, 116, 0.026, 0.042, true);
  addCobbleRect(36, 0, 7, 116, 0.026, 0.042, true);
  addCobbleRect(0, -36, 116, 7, 0.026, 0.042, true);
  addCobbleRect(0, 36, 116, 7, 0.026, 0.042, true);

  // District Plazas
  addCobbleRect(-22, 22, 24, 24, 0.030, 0.044, true);
  addCobbleRect(23, 23.5, 20, 19, 0.030, 0.044, true);
  addCobbleRect(53, -38.5, 22, 11, 0.030, 0.044, true);
  addCobbleRect(-53, -38.5, 22, 11, 0.030, 0.044, true);

  // Carved Stone Inlay Octagonal Plaza Ring & Diagonal Compass Spokes around Fountain
  // Layered cleanly above cobble top (0.060): spokes at 0.062..0.068, rings at 0.070..0.071
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.008, 23.0), mats.plazaAccentStone);
    spoke.rotation.y = (i * Math.PI) / 4;
    spoke.position.y = 0.0625 + i * 0.0008;
    spoke.receiveShadow = true;
    group.add(spoke);
  }

  const ringBorder = new THREE.Mesh(
    new THREE.RingGeometry(11.3, 13.4, 8),
    mats.plazaAccentStone,
  );
  ringBorder.rotation.x = -Math.PI / 2;
  ringBorder.rotation.z = Math.PI / 8;
  ringBorder.position.y = 0.070;
  ringBorder.receiveShadow = true;
  group.add(ringBorder);

  const innerRingBorder = new THREE.Mesh(
    new THREE.RingGeometry(6.1, 6.9, 16),
    mats.plazaAccentStone,
  );
  innerRingBorder.rotation.x = -Math.PI / 2;
  innerRingBorder.position.y = 0.071;
  innerRingBorder.receiveShadow = true;
  group.add(innerRingBorder);

  // Dirt country trails extending beyond the cobble bridges
  const addDirt = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mats.dirtPath);
    m.position.set(x, 0.015, z);
    m.receiveShadow = true;
    group.add(m);
  };
  addDirt(0, 140, 10, 68);
  addDirt(140, 0, 68, 10);
  addDirt(-140, 0, 68, 10);

  // 3. Outer Citadel Water Moat & Stone Retaining Walls
  const moatW = MOAT_OUTER - MOAT_INNER;
  const moatMid = (MOAT_OUTER + MOAT_INNER) / 2;
  const addMoatSegment = (x: number, z: number, w: number, d: number) => {
    const bed = new THREE.Mesh(
      worldScaledBox(w, 0.35, d, 4.0, x, z),
      mats.marbleTrim,
    );
    bed.position.set(x, -0.45, z);
    bed.receiveShadow = true;
    group.add(bed);

    // Stone bank retaining edges so the moat looks like an engineered medieval canal
    const alongX = w > d;
    for (const side of [-1, 1]) {
      const bank = new THREE.Mesh(
        worldScaledBox(alongX ? w : 0.42, 0.48, alongX ? 0.42 : d, 3.0),
        mats.curbStone,
      );
      bank.position.set(
        alongX ? x : x + side * (w / 2 - 0.16),
        -0.06,
        alongX ? z + side * (d / 2 - 0.16) : z,
      );
      bank.receiveShadow = true;
      group.add(bank);
    }

    const waterW = Math.max(0.5, w - 0.5);
    const waterD = Math.max(0.5, d - 0.5);
    const waterGeo = new THREE.PlaneGeometry(waterW, waterD, 24, 12);
    const uvAttr = waterGeo.attributes.uv as THREE.BufferAttribute;
    for (let u = 0; u < uvAttr.count; u++) {
      uvAttr.setXY(u, uvAttr.getX(u) * (waterW / 8.0), uvAttr.getY(u) * (waterD / 8.0));
    }
    const water = new THREE.Mesh(waterGeo, mats.waterMoat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.085, z);
    water.frustumCulled = false;
    group.add(water);
    moatWaterMeshes.push(water);
  };

  addMoatSegment(-45.5, moatMid, 76, moatW);
  addMoatSegment(45.5, moatMid, 76, moatW);
  addMoatSegment(0, -moatMid - 5, 167, moatW);
  addMoatSegment(-moatMid, -47, moatW, 81);
  addMoatSegment(-moatMid, 45.5, moatW, 76);
  addMoatSegment(moatMid, -47, moatW, 81);
  addMoatSegment(moatMid, 45.5, moatW, 76);

  // Stone bridge parapets with finial pillars
  const buildBridgeParapet = (x: number, z: number, vertical: boolean) => {
    for (const s of [-1, 1]) {
      const curb = new THREE.Mesh(
        worldScaledBox(vertical ? 0.9 : 8.8, 0.95, vertical ? 8.8 : 0.9, 3.0),
        mats.castleWall,
      );
      curb.position.set(
        vertical ? x + s * 6.8 : x,
        0.48,
        vertical ? z : z + s * 6.8,
      );
      curb.castShadow = true;
      curb.receiveShadow = true;
      group.add(curb);

      for (const end of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 1.15), mats.marbleTrim);
        cap.position.set(
          vertical ? x + s * 6.8 : x + end * 4.2,
          0.65,
          vertical ? z + end * 4.2 : z + s * 6.8,
        );
        cap.castShadow = true;
        group.add(cap);
      }
    }
  };
  buildBridgeParapet(0, moatMid, true);
  buildBridgeParapet(-moatMid, 0, false);
  buildBridgeParapet(moatMid, 0, false);

  // 4. Instanced Countryside Meadow Boulders outside moat
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const warp = 0.82 + 0.25 * Math.sin(vx * 3.1 + vz * 2.4 + vy * 1.9);
    rPos.setXYZ(i, vx * warp, vy * 0.65 * warp, vz * warp);
  }
  rockGeo.computeVertexNormals();
  const rockCount = 56;
  const rockInst = new THREE.InstancedMesh(rockGeo, mats.curbStone, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const rCol = new THREE.Color();
  let seed = 7731;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let placed = 0;
  for (let i = 0; i < 160 && placed < rockCount; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 92 + rand() * 88;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    if (Math.abs(rx) < 14 || Math.abs(rz) < 14) continue;
    const gy = groundHeightAt(rx, rz);
    const sc = 0.65 + rand() * 1.5;
    dummy.position.set(rx, gy + sc * 0.22, rz);
    dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    dummy.scale.set(sc * (0.9 + rand() * 0.4), sc * 0.75, sc * (0.9 + rand() * 0.4));
    dummy.updateMatrix();
    rockInst.setMatrixAt(placed, dummy.matrix);
    const shade = 0.76 + rand() * 0.24;
    rCol.setRGB(shade, shade * 0.98, shade * 0.94);
    rockInst.setColorAt(placed, rCol);
    placed++;
  }
  rockInst.count = placed;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  return { group, groundPickMesh, moatWaterMeshes };
}

export function buildCentralFountain(mats: PronteraMaterials): {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  sprayGroup: THREE.Group;
} {
  const group = new THREE.Group();

  // Circular soft contact shadow matched cleanly to the round fountain apron (eliminates square z-fighting!)
  const fountainShadow = new THREE.Mesh(
    new THREE.CircleGeometry(6.15, 32),
    mats.contactShadow,
  );
  fountainShadow.rotation.x = -Math.PI / 2;
  fountainShadow.position.y = 0.073;
  group.add(fountainShadow);

  // Outer stepped stone apron
  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(5.35, 5.7, 0.28, 28),
    mats.marbleTrim,
  );
  apron.position.y = 0.16;
  apron.receiveShadow = true;
  group.add(apron);

  // Main carved basin outer wall (top at y = 0.92, cleanly below basin floor & water!)
  const basinWall = new THREE.Mesh(
    new THREE.CylinderGeometry(4.68, 4.82, 0.76, 28),
    mats.marble,
  );
  basinWall.position.y = 0.54;
  basinWall.castShadow = true;
  basinWall.receiveShadow = true;
  group.add(basinWall);

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.96, 0.38), mats.marbleTrim);
    pilaster.position.set(Math.cos(ang) * 4.72, 0.58, Math.sin(ang) * 4.72);
    pilaster.rotation.y = -ang;
    pilaster.castShadow = true;
    group.add(pilaster);
  }

  // Carved Rim Torus cradling the water basin
  const rimTorus = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.25, 14, 32),
    mats.marble,
  );
  rimTorus.rotation.x = Math.PI / 2;
  rimTorus.position.y = 1.09;
  rimTorus.castShadow = true;
  group.add(rimTorus);

  // Deep teal basin floor cleanly above basinWall top (0.92)
  const basinFloorMat = new THREE.MeshStandardMaterial({ color: 0x0a3852, roughness: 0.65 });
  basinFloorMat.userData.pbrKind = 'stone';
  const basinFloor = new THREE.Mesh(
    new THREE.CircleGeometry(4.42, 32),
    basinFloorMat,
  );
  basinFloor.rotation.x = -Math.PI / 2;
  basinFloor.position.y = 0.935;
  group.add(basinFloor);

  // Rippling reflective turquoise-azure water surface clearly brimming in basin
  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(4.42, 36),
    mats.waterFountain,
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 1.06;
  group.add(waterMesh);

  // White water foam splash rings where the 4 fountain jets land
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe6f8ff,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.38, 18), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(Math.cos(ang) * 3.15, 1.072, Math.sin(ang) * 3.15);
    group.add(foam);
  }

  // Sculpted Multi-Tier Fountain Spire
  const tierProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.5, 0.0),
    new THREE.Vector2(1.25, 0.85),
    new THREE.Vector2(0.68, 1.35),
    new THREE.Vector2(1.98, 1.88),
    new THREE.Vector2(1.82, 2.1),
    new THREE.Vector2(0.52, 2.38),
    new THREE.Vector2(0.48, 3.25),
    new THREE.Vector2(1.22, 3.7),
    new THREE.Vector2(1.04, 3.88),
    new THREE.Vector2(0.30, 4.08),
    new THREE.Vector2(0.24, 4.95),
    new THREE.Vector2(0.0, 5.4),
  ];
  const centerColumn = new THREE.Mesh(
    new THREE.LatheGeometry(tierProfile, 28),
    mats.marble,
  );
  centerColumn.position.y = 0.42;
  centerColumn.castShadow = true;
  centerColumn.receiveShadow = true;
  group.add(centerColumn);

  // Golden Prontera Crest Armillary Finial atop Fountain
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 16),
    mats.goldTrim,
  );
  orb.position.y = 5.92;
  orb.castShadow = true;
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 10, 24), mats.goldTrim);
  ringA.position.y = 5.92;
  ringA.rotation.x = 0.6;
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 10, 24), mats.goldTrim);
  ringB.position.y = 5.92;
  ringB.rotation.y = 0.8;
  group.add(orb, ringA, ringB);

  // 4 Sculpted Gilded Spout Finials + Water Jet Arcs
  const sprayGroup = new THREE.Group();
  const sprayMat = new THREE.MeshPhysicalMaterial({
    color: 0xb2e6ff,
    emissive: new THREE.Color(0x185570),
    emissiveIntensity: 0.32,
    roughness: 0.05,
    transparent: true,
    opacity: 0.56,
    clearcoat: 1.0,
  });

  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const spout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.34), mats.goldTrim);
    spout.position.set(Math.cos(ang) * 1.05, 3.92, Math.sin(ang) * 1.05);
    spout.rotation.y = -ang + Math.PI / 2;
    group.add(spout);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 1.1, 3.9, Math.sin(ang) * 1.1),
      new THREE.Vector3(Math.cos(ang) * 2.05, 4.3, Math.sin(ang) * 2.05),
      new THREE.Vector3(Math.cos(ang) * 2.95, 2.3, Math.sin(ang) * 2.95),
      new THREE.Vector3(Math.cos(ang) * 3.15, 0.98, Math.sin(ang) * 3.15),
    ]);
    const jet = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 18, 0.056, 8, false),
      sprayMat,
    );
    sprayGroup.add(jet);
  }
  group.add(sprayGroup);

  // 4 Cozy Carved Oak & Wrought-Iron Plaza Benches
  const benchPositions: [number, number, number][] = [
    [0, 7.6, 0],
    [0, -7.6, Math.PI],
    [7.6, 0, -Math.PI / 2],
    [-7.6, 0, Math.PI / 2],
  ];
  for (const [bx, bz, rot] of benchPositions) {
    const bench = new THREE.Group();
    bench.position.set(bx, 0, bz);
    bench.rotation.y = rot;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.68), mats.oakWood);
    seat.position.y = 0.48;
    seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.44, 0.12), mats.oakWood);
    back.position.set(0, 0.78, 0.27);
    back.castShadow = true;
    for (const sx of [-1.1, 1.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.48, 0.62), mats.wroughtIron);
      leg.position.set(sx, 0.24, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.56), mats.wroughtIron);
      arm.position.set(sx, 0.62, 0);
      bench.add(leg, arm);
    }
    bench.add(seat, back);
    group.add(bench);
  }

  return { group, waterMesh, sprayGroup };
}

export function buildCitadelWallsAndGates(mats: PronteraMaterials): THREE.Group {
  const group = new THREE.Group();
  const wPos = CITY_WALL_POS;
  const gOpen = GATE_HALF_OPENING;
  const wallH = 8.6;
  const wallT = 4.0;

  const buildWallRun = (x: number, z: number, len: number, alongX: boolean) => {
    const run = new THREE.Group();
    run.position.set(x, 0, z);
    if (!alongX) run.rotation.y = Math.PI / 2;

    addGroundAoSkirt(run, len, wallT + 0.8, mats, 0.032);

    const plinth = new THREE.Mesh(
      worldScaledBox(len, 1.35, wallT + 0.65, 5.0),
      mats.marbleTrim,
    );
    plinth.position.y = 0.675;
    plinth.receiveShadow = true;
    run.add(plinth);

    const wall = new THREE.Mesh(
      worldScaledBox(len, wallH - 1.35, wallT, 5.5),
      mats.castleWall,
    );
    wall.position.y = 1.35 + (wallH - 1.35) / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    run.add(wall);

    // Projecting Stone Cornice Band below Battlements
    const cornice = new THREE.Mesh(
      worldScaledBox(len, 0.42, wallT + 0.48, 4.0),
      mats.marbleTrim,
    );
    cornice.position.y = wallH - 0.15;
    cornice.castShadow = true;
    run.add(cornice);

    // Merlons with Stone Capstones
    const merlonCount = Math.max(2, Math.floor(len / 3.4));
    const step = len / merlonCount;
    for (let i = 0; i < merlonCount; i++) {
      const mx = -len / 2 + (i + 0.5) * step;
      for (const side of [-1, 1]) {
        const merlon = new THREE.Mesh(
          worldScaledBox(1.55, 1.15, 0.72, 3.0),
          mats.castleWall,
        );
        merlon.position.set(mx, wallH + 0.58, side * (wallT / 2 - 0.35));
        merlon.castShadow = true;
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.18, 0.84),
          mats.marbleTrim,
        );
        cap.position.set(mx, wallH + 1.2, side * (wallT / 2 - 0.35));
        run.add(merlon, cap);
      }
    }

    group.add(run);
  };

  const halfSpan = (wPos - gOpen) / 2;
  const midSpan = gOpen + halfSpan;

  buildWallRun(-midSpan, wPos, halfSpan * 2, true);
  buildWallRun(midSpan, wPos, halfSpan * 2, true);
  buildWallRun(-wPos, -midSpan, halfSpan * 2, false);
  buildWallRun(-wPos, midSpan, halfSpan * 2, false);
  buildWallRun(wPos, -midSpan, halfSpan * 2, false);
  buildWallRun(wPos, midSpan, halfSpan * 2, false);

  const nLen = wPos - 22;
  buildWallRun(-22 - nLen / 2, -wPos, nLen, true);
  buildWallRun(22 + nLen / 2, -wPos, nLen, true);

  // 4 Corner Bastion Towers with Machicolation Rings
  const corners: [number, number][] = [
    [-wPos, -wPos],
    [wPos, -wPos],
    [-wPos, wPos],
    [wPos, wPos],
  ];
  for (const [cx, cz] of corners) {
    const bastion = new THREE.Group();
    bastion.position.set(cx, 0, cz);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.85, 4.25, 2.0, 20),
      mats.marbleTrim,
    );
    base.position.y = 1.0;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.65, 11.4, 20),
      mats.castleWall,
    );
    body.position.y = 7.4;
    body.castShadow = true;
    body.receiveShadow = true;

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(3.85, 3.5, 0.65, 20),
      mats.marbleTrim,
    );
    ring.position.y = 13.0;

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 4.8, 20),
      mats.roofRoyal,
    );
    roof.position.y = 15.6;
    roof.castShadow = true;
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 1.5, 10),
      mats.goldTrim,
    );
    spire.position.y = 18.4;

    bastion.add(base, body, ring, roof, spire);
    group.add(bastion);
  }

  // 3 Grand Arched Gatehouses (South, West, East) with Braziers & Fluttering Banners
  const bannerGeo = new THREE.PlaneGeometry(1.15, 3.6, 4, 8);
  const buildGatehouse = (x: number, z: number, rotY: number) => {
    const gate = new THREE.Group();
    gate.position.set(x, 0, z);
    gate.rotation.y = rotY;

    const archGeo = createStoneArchGeometry(16, 11.8, 5.2, 5.2);
    const archMesh = new THREE.Mesh(archGeo, mats.castleWall);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    gate.add(archMesh);

    // Raised iron portcullis lattice
    for (let i = -4; i <= 4; i++) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.3, 8),
        mats.wroughtIron,
      );
      bar.position.set(i * 0.9, 6.2, 0);
      gate.add(bar);
    }
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.18, 0.18), mats.wroughtIron);
    crossBar.position.set(0, 6.4, 0);
    gate.add(crossBar);

    for (const s of [-1, 1]) {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(3.05, 3.35, 13.8, 20),
        mats.castleWall,
      );
      tower.position.set(s * 9.2, 6.9, 0);
      tower.castShadow = true;
      tower.receiveShadow = true;

      const cornice = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.1, 0.6, 20),
        mats.marbleTrim,
      );
      cornice.position.set(s * 9.2, 13.8, 0);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(3.7, 4.4, 20),
        mats.roofRoyal,
      );
      cap.position.set(s * 9.2, 16.2, 0);
      cap.castShadow = true;

      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 10),
        mats.goldTrim,
      );
      finial.position.set(s * 9.2, 18.5, 0);

      const banner = new THREE.Mesh(bannerGeo, mats.bannerBlue);
      banner.position.set(s * 9.2, 8.4, 3.22);
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.25, 0.14),
        mats.goldTrim,
      );
      trim.position.set(s * 9.2, 10.2, 3.22);

      // Gatehouse Flanking Wrought-Iron Torch Braziers
      const brazierBowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.22, 0.5, 10),
        mats.wroughtIron,
      );
      brazierBowl.position.set(s * 6.0, 2.2, 2.85);
      const brazierStand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 2.0, 8),
        mats.wroughtIron,
      );
      brazierStand.position.set(s * 6.0, 1.0, 2.85);
      const embers = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        mats.emberGlow,
      );
      embers.position.set(s * 6.0, 2.45, 2.85);

      const glowSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: mats.haloGlowTex,
          color: 0xffa842,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glowSprite.position.set(s * 6.0, 2.65, 2.85);
      glowSprite.scale.set(3.2, 3.2, 1);

      gate.add(tower, cornice, cap, finial, banner, trim, brazierBowl, brazierStand, embers, glowSprite);
    }

    group.add(gate);
  };

  buildGatehouse(0, wPos, 0);
  buildGatehouse(-wPos, 0, Math.PI / 2);
  buildGatehouse(wPos, 0, -Math.PI / 2);

  return group;
}

function buildSingleBuilding(spec: BuildingSpec, mats: PronteraMaterials): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;

  const roofMat = getRoofMaterial(spec.roofTone, mats);
  const w = spec.width;
  const d = spec.depth;
  const h = spec.height;

  addGroundAoSkirt(g, w + 0.45, d + 0.45, mats, 0.044);

  // Recessed gothic/medieval mullioned window with sill & optional flower box
  const addWindow = (wx: number, wy: number, wz: number, rotY = 0, scale = 1, hasFlowerBox = false) => {
    const win = new THREE.Group();
    win.position.set(wx, wy, wz);
    win.rotation.y = rotY;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.36 * scale, 1.78 * scale, 0.22),
      mats.darkTimber,
    );
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(0.96 * scale, 1.42 * scale, 0.25),
      mats.windowGlow,
    );
    // Cross mullions
    const mullionV = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 * scale, 1.44 * scale, 0.28),
      mats.darkTimber,
    );
    const mullionH = new THREE.Mesh(
      new THREE.BoxGeometry(0.98 * scale, 0.08 * scale, 0.28),
      mats.darkTimber,
    );
    // Stone window sill
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(1.52 * scale, 0.16 * scale, 0.34),
      mats.marbleTrim,
    );
    sill.position.y = -0.92 * scale;
    sill.position.z = 0.06;

    win.add(frame, pane, mullionV, mullionH, sill);

    if (hasFlowerBox) {
      const planter = new THREE.Mesh(
        new THREE.BoxGeometry(1.22 * scale, 0.22 * scale, 0.28),
        mats.oakWood,
      );
      planter.position.set(0, -0.78 * scale, 0.18);
      const greenery = new THREE.Mesh(
        new THREE.BoxGeometry(1.1 * scale, 0.2 * scale, 0.22),
        mats.grassBladeMat,
      );
      greenery.position.set(0, -0.62 * scale, 0.18);
      win.add(planter, greenery);
    }

    g.add(win);
  };

  // Arched Oak Entrance Door with Lantern Sconce
  const addFrontDoor = (dx: number, dz: number, scale = 1) => {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(dx, 0, dz);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.5 * scale, 3.3 * scale, 0.42),
      mats.marbleTrim,
    );
    frame.position.y = 1.65 * scale;
    const wood = new THREE.Mesh(
      new THREE.BoxGeometry(1.85 * scale, 2.85 * scale, 0.48),
      mats.darkTimber,
    );
    wood.position.y = 1.425 * scale;
    const ironStrap = new THREE.Mesh(
      new THREE.BoxGeometry(1.75 * scale, 0.12 * scale, 0.51),
      mats.wroughtIron,
    );
    ironStrap.position.y = 1.95 * scale;
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 * scale, 10, 10),
      mats.goldTrim,
    );
    handle.position.set(0.55 * scale, 1.3 * scale, 0.28);

    // Wall lantern next to entrance
    const sconce = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * scale, 10, 8),
      mats.lanternGlow,
    );
    sconce.position.set(1.55 * scale, 2.55 * scale, 0.32);

    doorGroup.add(frame, wood, ironStrap, handle, sconce);
    g.add(doorGroup);
  };

  if (spec.kind === 'castle') {
    const plinth = new THREE.Mesh(
      worldScaledBox(w + 2.2, 1.9, d + 2.2, 5.0),
      mats.marbleTrim,
    );
    plinth.position.y = 0.95;
    plinth.receiveShadow = true;

    const mainKeep = new THREE.Mesh(
      worldScaledBox(w, h * 0.72, d, 6.0),
      mats.castleWall,
    );
    mainKeep.position.y = 1.9 + (h * 0.72) / 2;
    mainKeep.castShadow = true;
    mainKeep.receiveShadow = true;

    const upperKeep = new THREE.Mesh(
      worldScaledBox(w * 0.56, h * 0.55, d * 0.78, 6.0),
      mats.castleWall,
    );
    upperKeep.position.y = h * 0.72 + (h * 0.55) / 2;
    upperKeep.castShadow = true;

    const keepRoof = new THREE.Mesh(
      createPitchedRoofGeometry(w * 0.56, d * 0.78, 6.4),
      roofMat,
    );
    keepRoof.position.y = h * 1.25;
    keepRoof.castShadow = true;

    // Gilded Roof Ridge Crest
    const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, d * 0.8), mats.goldTrim);
    ridgeBeam.position.set(0, h * 1.25 + 6.45, 0);
    g.add(ridgeBeam);

    // 4 Corner Royal Spires with Stone Cornices
    const spireCoords: [number, number, number][] = [
      [-w / 2, -d / 2, 22],
      [w / 2, -d / 2, 22],
      [-w / 2, d / 2, 19.5],
      [w / 2, d / 2, 19.5],
    ];
    for (const [sx, sz, sh] of spireCoords) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 2.95, sh, 20),
        mats.castleWall,
      );
      cyl.position.set(sx, sh / 2, sz);
      cyl.castShadow = true;
      const cornice = new THREE.Mesh(
        new THREE.CylinderGeometry(3.05, 2.7, 0.6, 20),
        mats.marbleTrim,
      );
      cornice.position.set(sx, sh, sz);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, 6.6, 20),
        roofMat,
      );
      cone.position.set(sx, sh + 3.2, sz);
      cone.castShadow = true;
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 12, 10),
        mats.goldTrim,
      );
      tip.position.set(sx, sh + 6.6, sz);
      g.add(cyl, cornice, cone, tip);
    }

    const portico = new THREE.Mesh(
      createStoneArchGeometry(11.4, 10.8, 3.9, 4.4),
      mats.marbleTrim,
    );
    portico.position.set(0, 0, d / 2 + 1.5);
    portico.castShadow = true;

    const castleDoors = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 8.2, 0.52),
      mats.darkTimber,
    );
    castleDoors.position.set(0, 4.1, d / 2 + 0.15);
    const doorDivider = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 8.2, 0.62),
      mats.goldTrim,
    );
    doorDivider.position.set(0, 4.1, d / 2 + 0.22);

    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.08, 18),
      mats.carpetRoyal,
    );
    carpet.position.set(0, 0.055, d / 2 + 9);
    carpet.receiveShadow = true;

    // Royal Castle Banners flanking Gate
    const bannerGeo = new THREE.PlaneGeometry(1.45, 4.6, 4, 8);
    for (const s of [-1, 1]) {
      const banner = new THREE.Mesh(bannerGeo, mats.bannerBlue);
      banner.position.set(s * 7.2, 8.6, d / 2 + 0.25);
      const bTrim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.14), mats.goldTrim);
      bTrim.position.set(s * 7.2, 10.9, d / 2 + 0.25);
      g.add(banner, bTrim);
    }

    for (const wx of [-14, -9.5, 9.5, 14]) {
      addWindow(wx, 8.5, d / 2 + 0.08, 0, 1.38);
    }
    for (const wx of [-6, 0, 6]) {
      addWindow(wx, 17.5, (d * 0.78) / 2 + 0.08, 0, 1.42);
    }

    g.add(plinth, mainKeep, upperKeep, keepRoof, portico, castleDoors, doorDivider, carpet);
    return g;
  }

  if (spec.kind === 'cathedral') {
    const plinth = new THREE.Mesh(
      worldScaledBox(w + 1.4, 1.25, d + 1.4, 5.0),
      mats.marbleTrim,
    );
    plinth.position.y = 0.625;
    const nave = new THREE.Mesh(
      worldScaledBox(w * 0.74, h * 0.72, d, 5.5),
      mats.castleWall,
    );
    nave.position.y = 1.25 + (h * 0.72) / 2;
    nave.castShadow = true;
    nave.receiveShadow = true;

    const naveGable = new THREE.Mesh(
      createGableTriangleGeometry(w * 0.74, d - 0.1, 5.1),
      mats.castleWall,
    );
    naveGable.position.y = 1.25 + h * 0.72;

    const naveRoof = new THREE.Mesh(
      createPitchedRoofGeometry(w * 0.74, d, 5.3),
      roofMat,
    );
    naveRoof.position.y = 1.25 + h * 0.72;
    naveRoof.castShadow = true;
    g.add(naveGable);

    // Gothic Side Buttresses
    for (const s of [-1, 1]) {
      for (const bz of [-5, 0, 5]) {
        const buttress = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, h * 0.65, 1.25),
          mats.marbleTrim,
        );
        buttress.position.set(s * ((w * 0.74) / 2 + 0.4), (h * 0.65) / 2 + 0.8, bz);
        buttress.castShadow = true;
        g.add(buttress);
      }
    }

    // Twin Front Bell Towers
    for (const s of [-1, 1]) {
      const tx = s * (w * 0.36);
      const tz = d * 0.35;
      const tower = new THREE.Mesh(
        worldScaledBox(4.4, h * 1.15, 4.4, 4.5),
        mats.castleWall,
      );
      tower.position.set(tx, (h * 1.15) / 2, tz);
      tower.castShadow = true;

      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(3.25, 6.4, 4),
        roofMat,
      );
      spire.rotation.y = Math.PI / 4;
      spire.position.set(tx, h * 1.15 + 3.1, tz);
      spire.castShadow = true;

      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 0.18), mats.goldTrim);
      crossV.position.set(tx, h * 1.15 + 6.5, tz);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.18, 0.18), mats.goldTrim);
      crossH.position.set(tx, h * 1.15 + 6.75, tz);
      g.add(tower, spire, crossV, crossH);
    }

    // Gothic Stained-Glass Rose Window with Carved Stone Tracery Spokes
    const roseRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.82, 0.24, 12, 28),
      mats.marbleTrim,
    );
    roseRing.position.set(0, 7.6, d / 2 + 0.14);
    const roseGlass = new THREE.Mesh(
      new THREE.CircleGeometry(1.72, 24),
      mats.stainedGlass,
    );
    roseGlass.position.set(0, 7.6, d / 2 + 0.08);
    g.add(roseRing, roseGlass);

    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), mats.marbleTrim);
      spoke.position.set(0, 7.6, d / 2 + 0.14);
      spoke.rotation.z = (i * Math.PI) / 4;
      g.add(spoke);
    }

    addFrontDoor(0, d / 2 + 0.05, 1.35);
    for (const wz of [-4.2, 0, 4.2]) {
      addWindow(-(w * 0.74) / 2 - 0.08, 6.0, wz, -Math.PI / 2, 1.25);
      addWindow((w * 0.74) / 2 + 0.08, 6.0, wz, Math.PI / 2, 1.25);
    }

    g.add(plinth, nave, naveRoof);
    return g;
  }

  // Standard Cozy Medieval Town Buildings (Chivalry, Forge, Tavern, Library, Guildhouse, Cottage)
  const groundH = h * 0.52;
  const upperH = h * 0.48;

  const basePlinth = new THREE.Mesh(
    worldScaledBox(w + 0.85, 0.85, d + 0.85, 4.0),
    mats.marbleTrim,
  );
  basePlinth.position.y = 0.425;
  basePlinth.receiveShadow = true;

  const groundBody = new THREE.Mesh(
    worldScaledBox(w, groundH, d, 5.0),
    mats.castleWall,
  );
  groundBody.position.y = 0.85 + groundH / 2;
  groundBody.castShadow = true;
  groundBody.receiveShadow = true;

  // Exposed Timber Belt Beam separating stories
  const beltBeam = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.82, 0.28, d + 0.82),
    mats.darkTimber,
  );
  beltBeam.position.y = 0.85 + groundH;
  g.add(beltBeam);

  // Overhanging Half-Timbered Upper Story
  const upperBody = new THREE.Mesh(
    worldScaledBox(w + 0.68, upperH, d + 0.68, 5.0),
    mats.plasterTimber,
  );
  upperBody.position.y = 0.85 + groundH + upperH / 2;
  upperBody.castShadow = true;
  upperBody.receiveShadow = true;

  const ridgeH = Math.max(3.3, w * 0.35);
  const gableFill = new THREE.Mesh(
    createGableTriangleGeometry(w + 0.68, d + 0.68, ridgeH),
    mats.plasterTimber,
  );
  gableFill.position.y = 0.85 + groundH + upperH;
  gableFill.castShadow = true;

  const roofMesh = new THREE.Mesh(
    createPitchedRoofGeometry(w + 0.88, d + 0.88, ridgeH),
    roofMat,
  );
  roofMesh.position.y = 0.85 + groundH + upperH;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  g.add(gableFill);

  // Carved Stone Chimney + Terracotta Chimney Cap
  const chX = w * 0.28;
  const chZ = -d * 0.22;
  const chTop = 0.85 + groundH + upperH + ridgeH + 1.3;
  const chimney = new THREE.Mesh(
    worldScaledBox(1.32, ridgeH + 1.8, 1.32, 3.5),
    mats.castleWall,
  );
  chimney.position.set(chX, 0.85 + groundH + upperH + (ridgeH + 1.8) / 2 - 0.5, chZ);
  chimney.castShadow = true;
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 1.62), mats.marbleTrim);
  chimneyCap.position.set(chX, chTop, chZ);
  g.add(chimney, chimneyCap);

  // Front entrance door & upper/lower windows with flower boxes on cottages
  const isCozy = spec.kind === 'cottage' || spec.kind === 'tavern';
  addFrontDoor(0, d / 2 + 0.05, 1.02);
  addWindow(-w * 0.28, 2.35, d / 2 + 0.06, 0, 0.95, isCozy);
  addWindow(w * 0.28, 2.35, d / 2 + 0.06, 0, 0.95, isCozy);
  addWindow(-w * 0.28, 0.85 + groundH + upperH * 0.5, (d + 0.68) / 2 + 0.06, 0, 0.95);
  addWindow(0, 0.85 + groundH + upperH * 0.5, (d + 0.68) / 2 + 0.06, 0, 0.95);
  addWindow(w * 0.28, 0.85 + groundH + upperH * 0.5, (d + 0.68) / 2 + 0.06, 0, 0.95);

  addWindow(-w / 2 - 0.06, 2.35, 0, -Math.PI / 2, 0.9);
  addWindow(w / 2 + 0.06, 2.35, 0, Math.PI / 2, 0.9);

  // Cozy Wooden Barrel & Crate Vignette tucked flush against facade wall (inside collider footprint!)
  for (const bx of [-w * 0.42, -w * 0.34]) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.28, 0.78, 12),
      mats.oakWood,
    );
    barrel.position.set(bx, 0.4, d / 2 + 0.12);
    barrel.castShadow = true;
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.025, 6, 14),
      mats.wroughtIron,
    );
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(bx, 0.58, d / 2 + 0.12);
    g.add(barrel, hoop);
  }

  // Specialty details per building archetype
  if (spec.kind === 'tavern') {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, 0.2, 2.8),
      mats.carpetRoyal,
    );
    awning.position.set(0, 3.65, d / 2 + 1.4);
    awning.rotation.x = 0.24;
    awning.castShadow = true;
    const signPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 1.55),
      mats.wroughtIron,
    );
    signPost.position.set(w * 0.38, 4.65, d / 2 + 0.8);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.92, 0.14),
      mats.goldTrim,
    );
    signBoard.position.set(w * 0.38, 4.05, d / 2 + 1.38);
    g.add(awning, signPost, signBoard);
  } else if (spec.kind === 'chivalry') {
    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.35, h + 3.4, 16),
      mats.castleWall,
    );
    turret.position.set(-w / 2 + 1.2, (h + 3.4) / 2, d / 2 - 1.2);
    turret.castShadow = true;
    const turretRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.7, 3.6, 16),
      mats.roofCobalt,
    );
    turretRoof.position.set(-w / 2 + 1.2, h + 5.0, d / 2 - 1.2);
    turretRoof.castShadow = true;
    g.add(turret, turretRoof);
  } else if (spec.kind === 'forge') {
    const hearth = new THREE.Mesh(
      worldScaledBox(2.7, 1.5, 1.9, 3.0),
      mats.castleWall,
    );
    hearth.position.set(-w * 0.25, 0.75, -d / 2 - 1.2);
    const embers = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 12, 10),
      mats.emberGlow,
    );
    embers.position.set(-w * 0.25, 1.35, -d / 2 - 1.2);
    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.74, 0.58),
      mats.wroughtIron,
    );
    anvil.position.set(w * 0.15, 0.37, -d / 2 - 1.6);
    g.add(hearth, embers, anvil);
  } else if (spec.kind === 'library') {
    const cupola = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.65, 2.8, 16),
      mats.plasterTimber,
    );
    cupola.position.set(0, 0.85 + groundH + upperH + ridgeH * 0.7, 0);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mats.roofCobalt,
    );
    dome.position.set(0, 0.85 + groundH + upperH + ridgeH * 0.7 + 1.4, 0);
    g.add(cupola, dome);
  }

  g.add(basePlinth, groundBody, upperBody, roofMesh);
  return g;
}

export function buildPronteraBuildings(mats: PronteraMaterials): THREE.Group {
  const group = new THREE.Group();
  for (const spec of BUILDINGS) {
    group.add(buildSingleBuilding(spec, mats));
  }

  // Market Square colorful Merchant Stalls with pitched striped awnings, rafters, valances & goods
  for (const stall of MARKET_STALLS) {
    const sg = new THREE.Group();
    sg.position.set(stall.x, 0, stall.z);
    sg.rotation.y = stall.rotY;

    const canopyMat = mats.createAwningMaterial(stall.canopyColor, stall.accentColor);
    const solidCanopyMat = new THREE.MeshPhysicalMaterial({
      color: stall.canopyColor,
      roughness: 0.78,
      sheen: 0.45,
      sheenRoughness: 0.55,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: stall.accentColor,
      roughness: 0.82,
    });

    // Timber frame corner posts (taller back posts -> pitched front awning)
    for (const px of [-1.88, 1.88]) {
      const backPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.098, 2.95, 10),
        mats.darkTimber,
      );
      backPost.position.set(px, 1.475, -1.05);
      backPost.castShadow = true;
      const frontPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.098, 2.55, 10),
        mats.darkTimber,
      );
      frontPost.position.set(px, 1.275, 1.05);
      frontPost.castShadow = true;
      sg.add(backPost, frontPost);

      // Angled timber side rafters
      const rafter = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.12, 2.75),
        mats.darkTimber,
      );
      rafter.position.set(px, 2.72, 0.02);
      rafter.rotation.x = 0.20;
      sg.add(rafter);
    }

    // Wooden ridge & eave cross-beams
    const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.12, 0.12), mats.darkTimber);
    ridgeBeam.position.set(0, 3.04, -0.35);
    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.11, 0.11), mats.darkTimber);
    frontBeam.position.set(0, 2.52, 1.06);
    sg.add(ridgeBeam, frontBeam);

    // Pitched dual-slope medieval striped fabric awning
    const frontSlope = new THREE.Mesh(new THREE.BoxGeometry(4.36, 0.08, 2.05), canopyMat);
    frontSlope.position.set(0, 2.81, 0.52);
    frontSlope.rotation.x = 0.25;
    frontSlope.castShadow = true;
    const backSlope = new THREE.Mesh(new THREE.BoxGeometry(4.36, 0.08, 1.28), canopyMat);
    backSlope.position.set(0, 2.93, -0.82);
    backSlope.rotation.x = -0.22;
    backSlope.castShadow = true;
    sg.add(frontSlope, backSlope);

    // Scalloped alternating valance tabs along front & side eaves
    const tabCount = 9;
    const tabW = 4.32 / tabCount;
    for (let t = 0; t < tabCount; t++) {
      const tx = -2.16 + (t + 0.5) * tabW;
      const tab = new THREE.Mesh(
        new THREE.CylinderGeometry(tabW * 0.48, tabW * 0.48, 0.07, 10),
        t % 2 === 0 ? solidCanopyMat : trimMat,
      );
      tab.rotation.x = Math.PI / 2;
      tab.position.set(tx, 2.48, 1.44);
      sg.add(tab);
      const topFill = new THREE.Mesh(
        new THREE.BoxGeometry(tabW * 0.96, 0.2, 0.07),
        t % 2 === 0 ? solidCanopyMat : trimMat,
      );
      topFill.position.set(tx, 2.56, 1.44);
      sg.add(topFill);
    }

    // Hanging stall lantern on right front post
    const stallLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mats.lanternGlow);
    stallLantern.position.set(1.75, 2.22, 1.12);
    sg.add(stallLantern);

    // Oak display counter + backboard shelf
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.92, 1.15), mats.oakWood);
    counter.position.set(0, 0.46, 0.25);
    counter.castShadow = true;
    const backboard = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.85, 0.14), mats.darkTimber);
    backboard.position.set(0, 1.45, -0.98);
    sg.add(counter, backboard);

    // Side oak barrel next to stall
    const sideBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.27, 0.72, 12), mats.oakWood);
    sideBarrel.position.set(-1.55, 0.36, -0.58);
    sideBarrel.castShadow = true;
    sg.add(sideBarrel);

    for (let i = -2; i <= 2; i++) {
      if (stall.goods === 'potions') {
        const flask = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 12, 10),
          i % 2 === 0 ? solidCanopyMat : mats.waterFountain,
        );
        flask.position.set(i * 0.62, 1.06, 0.25);
        sg.add(flask);
      } else if (stall.goods === 'fabrics') {
        const roll = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.82, 12),
          i % 2 === 0 ? solidCanopyMat : trimMat,
        );
        roll.rotation.z = Math.PI / 2;
        roll.position.set(i * 0.66, 1.05, 0.25);
        sg.add(roll);
      } else {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.36, 0.46),
          mats.oakWood,
        );
        crate.position.set(i * 0.65, 1.1, 0.25);
        sg.add(crate);
      }
    }

    group.add(sg);
  }

  return group;
}

/**
 * Creates a merged multi-card botanical canopy BufferGeometry (6 angled crossed cards)
 * so instanced trees look volumetric and richly leafed from every camera angle.
 */
function createLeafClusterClusterGeo(
  cards: { x: number; y: number; z: number; size: number; tiltX: number; rotY: number }[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  let vertOffset = 0;
  for (const c of cards) {
    // 2 crossed quads per cluster lobe (X-card + Z-card + slight canopy cap)
    const subRotations = [
      [c.tiltX, c.rotY, 0],
      [c.tiltX + 0.35, c.rotY + Math.PI * 0.5, 0.22],
      [Math.PI * 0.38, c.rotY + 0.4, 0],
    ];
    for (const [rx, ry, rz] of subRotations) {
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      const hs = c.size * 0.5;
      const corners = [
        [-hs, -hs, 0],
        [hs, -hs, 0],
        [hs, hs, 0],
        [-hs, hs, 0],
      ];
      const quadUvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      n.set(0, 0.5, 0.86).applyQuaternion(q).normalize();

      for (let k = 0; k < 4; k++) {
        v.set(corners[k][0], corners[k][1], corners[k][2]).applyQuaternion(q);
        positions.push(v.x + c.x, v.y + c.y, v.z + c.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(quadUvs[k][0], quadUvs[k][1]);
      }
      indices.push(
        vertOffset,
        vertOffset + 1,
        vertOffset + 2,
        vertOffset,
        vertOffset + 2,
        vertOffset + 3,
      );
      vertOffset += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds a gnarled sculpted oak trunk + 3 spreading upper boughs merged into 1 BufferGeometry.
 */
function createGnarledTrunkGeo(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.58, 0.0),
    new THREE.Vector2(0.42, 0.38),
    new THREE.Vector2(0.32, 1.3),
    new THREE.Vector2(0.28, 2.3),
    new THREE.Vector2(0.22, 3.15),
    new THREE.Vector2(0.14, 3.6),
    new THREE.Vector2(0.0, 3.7),
  ];
  return new THREE.LatheGeometry(profile, 12);
}

/**
 * Builds a 4-blade curved 3D grass tuft BufferGeometry (16 triangles per tuft)
 * for lush swaying Diablo-meadow grass.
 */
function createGrassTuftGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let vOffset = 0;
  const blades = 4;
  for (let b = 0; b < blades; b++) {
    const ang = (b / blades) * Math.PI * 2 + (b % 2) * 0.42;
    const rad = 0.08 + (b % 2) * 0.05;
    const ox = Math.cos(ang) * rad;
    const oz = Math.sin(ang) * rad;
    const leanX = Math.cos(ang) * 0.18;
    const leanZ = Math.sin(ang) * 0.18;
    const h = 0.36 + (b % 3) * 0.09;
    const wBase = 0.055;
    const wMid = 0.036;

    const px = -Math.sin(ang);
    const pz = Math.cos(ang);

    // 5 vertices per blade: 2 base, 2 mid, 1 pointed tip
    positions.push(
      ox - px * wBase, 0.0, oz - pz * wBase,
      ox + px * wBase, 0.0, oz + pz * wBase,
      ox + leanX * 0.45 - px * wMid, h * 0.52, oz + leanZ * 0.45 - pz * wMid,
      ox + leanX * 0.45 + px * wMid, h * 0.52, oz + leanZ * 0.45 + pz * wMid,
      ox + leanX, h, oz + leanZ,
    );
    for (let k = 0; k < 5; k++) {
      normals.push(0, 1, 0);
    }
    indices.push(
      vOffset, vOffset + 1, vOffset + 3,
      vOffset, vOffset + 3, vOffset + 2,
      vOffset + 2, vOffset + 3, vOffset + 4,
    );
    vOffset += 5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function isInsideAnyBuildingOrWall(x: number, z: number): boolean {
  // Check buildings + slight margin
  for (const b of BUILDINGS) {
    const rotated = Math.abs(Math.sin(b.rotY)) > 0.7;
    const hw = (rotated ? b.depth : b.width) / 2 + 1.1;
    const hd = (rotated ? b.width : b.depth) / 2 + 1.1;
    if (Math.abs(x - b.x) <= hw && Math.abs(z - b.z) <= hd) return true;
  }
  // Check city walls & moat band
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if ((ax >= 69.5 && ax <= 86) || (az >= 69.5 && az <= 86)) {
    if (ax <= 86 && az <= 86) return true;
  }
  return false;
}

export function buildInstancedNatureAndLanterns(
  mats: PronteraMaterials,
): {
  group: THREE.Group;
  lanternLights: THREE.PointLight[];
  lanternHalos: THREE.Sprite[];
} {
  const group = new THREE.Group();
  const lanternLights: THREE.PointLight[] = [];
  const lanternHalos: THREE.Sprite[] = [];

  // 1. High-Detail Botanical Trees partitioned by species (Oak, Pine, Cypress)
  const oakTrees = TREES.filter((t) => t.kind === 'oak');
  const pineTrees = TREES.filter((t) => t.kind === 'pine');
  const cypressTrees = TREES.filter((t) => t.kind === 'cypress');

  const trunkGeo = createGnarledTrunkGeo();
  const oakCanopyGeo = createLeafClusterClusterGeo([
    { x: 0, y: 4.1, z: 0, size: 3.6, tiltX: 0.15, rotY: 0.2 },
    { x: -1.1, y: 3.5, z: 0.7, size: 2.7, tiltX: 0.25, rotY: 1.1 },
    { x: 1.05, y: 3.65, z: -0.6, size: 2.8, tiltX: -0.2, rotY: 2.3 },
    { x: 0.25, y: 5.05, z: 0.15, size: 2.5, tiltX: 0.1, rotY: 0.8 },
  ]);
  const pineCanopyGeo = createLeafClusterClusterGeo([
    { x: 0, y: 2.4, z: 0, size: 3.3, tiltX: 1.15, rotY: 0.0 },
    { x: 0, y: 3.4, z: 0, size: 2.8, tiltX: 1.12, rotY: 0.7 },
    { x: 0, y: 4.35, z: 0, size: 2.2, tiltX: 1.05, rotY: 1.4 },
    { x: 0, y: 5.2, z: 0, size: 1.5, tiltX: 0.9, rotY: 2.1 },
  ]);
  const cypressCanopyGeo = createLeafClusterClusterGeo([
    { x: 0, y: 2.4, z: 0, size: 2.1, tiltX: 0.2, rotY: 0.3 },
    { x: 0, y: 3.6, z: 0, size: 1.95, tiltX: 0.15, rotY: 1.2 },
    { x: 0, y: 4.8, z: 0, size: 1.65, tiltX: 0.15, rotY: 2.1 },
    { x: 0, y: 5.8, z: 0, size: 1.2, tiltX: 0.1, rotY: 0.5 },
  ]);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Trunks InstancedMesh for all trees
  const trunkInst = new THREE.InstancedMesh(trunkGeo, mats.trunkMat, TREES.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;
  TREES.forEach((t, i) => {
    const gy = groundHeightAt(t.x, t.z);
    dummy.position.set(t.x, gy, t.z);
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    const sx = t.kind === 'cypress' ? t.scale * 0.7 : t.scale;
    const sy = t.kind === 'cypress' ? t.scale * 1.25 : t.kind === 'pine' ? t.scale * 1.15 : t.scale;
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  group.add(trunkInst);

  const buildSpeciesCanopy = (
    list: typeof TREES,
    geo: THREE.BufferGeometry,
    mat: THREE.MeshStandardMaterial,
    sxMul: number,
    syMul: number,
  ) => {
    if (list.length === 0) return;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    list.forEach((t, i) => {
      const gy = groundHeightAt(t.x, t.z);
      dummy.position.set(t.x, gy, t.z);
      dummy.rotation.set(0, (i * 2.13) % (Math.PI * 2), 0);
      dummy.scale.set(t.scale * sxMul, t.scale * syMul, t.scale * sxMul);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(t.tint);
      inst.setColorAt(i, color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  };

  buildSpeciesCanopy(oakTrees, oakCanopyGeo, mats.foliageOakMat, 1.0, 1.0);
  buildSpeciesCanopy(pineTrees, pineCanopyGeo, mats.foliagePineMat, 1.0, 1.12);
  buildSpeciesCanopy(cypressTrees, cypressCanopyGeo, mats.foliageCypressMat, 0.92, 1.18);

  // 2. Lush 3D Instanced Grass Meadow (~4,800 multi-blade tufts = ~19,200 swaying blades!)
  const MAX_GRASS = 4800;
  const grassGeo = createGrassTuftGeo();
  const grassInst = new THREE.InstancedMesh(grassGeo, mats.grassBladeMat, MAX_GRASS);
  grassInst.receiveShadow = true;

  const MAX_FLOWERS = 420;
  const flowerGeo = new THREE.ConeGeometry(0.1, 0.14, 5);
  flowerGeo.rotateX(Math.PI);
  flowerGeo.translate(0, 0.28, 0);
  const flowerInst = new THREE.InstancedMesh(flowerGeo, mats.wildflowerMat, MAX_FLOWERS);

  let gSeed = 9187;
  const gRand = () => {
    gSeed = (gSeed * 1664525 + 1013904223) >>> 0;
    return gSeed / 4294967296;
  };

  let gCount = 0;
  let fCount = 0;
  const flowerPalette = [0xf7eed0, 0xf2c95a, 0xd8a8e8, 0xf28b79];

  // Dense inner city park lawns first, then lush outer meadows
  for (let attempt = 0; attempt < 15000 && gCount < MAX_GRASS; attempt++) {
    const insideCity = attempt < 8200;
    const range = insideCity ? 68 : 138;
    const gx = (gRand() * 2 - 1) * range;
    const gz = (gRand() * 2 - 1) * range;

    if (!insideCity && Math.abs(gx) < 86 && Math.abs(gz) < 86) continue;
    if (isCobbleRoad(gx, gz)) continue;
    if (isInsideAnyBuildingOrWall(gx, gz)) continue;
    // Skip dirt country roads outside gates
    if ((Math.abs(gx) < 6.5 || Math.abs(gz) < 6.5) && (Math.abs(gx) > 85 || Math.abs(gz) > 85)) continue;

    const gy = groundHeightAt(gx, gz);
    const sc = 0.72 + gRand() * 0.65;
    dummy.position.set(gx, gy, gz);
    dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
    dummy.scale.set(sc, sc * (0.85 + gRand() * 0.45), sc);
    dummy.updateMatrix();
    grassInst.setMatrixAt(gCount, dummy.matrix);

    const gHue = 0.24 + (gRand() - 0.5) * 0.05;
    const gSat = 0.34 + gRand() * 0.22;
    const gLit = 0.42 + gRand() * 0.18;
    color.setHSL(gHue, gSat, gLit);
    grassInst.setColorAt(gCount, color);
    gCount++;

    if (fCount < MAX_FLOWERS && gRand() < 0.085) {
      dummy.scale.setScalar(0.8 + gRand() * 0.55);
      dummy.updateMatrix();
      flowerInst.setMatrixAt(fCount, dummy.matrix);
      color.setHex(flowerPalette[fCount % flowerPalette.length]);
      flowerInst.setColorAt(fCount, color);
      fCount++;
    }
  }

  grassInst.count = gCount;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  flowerInst.count = fCount;
  flowerInst.instanceMatrix.needsUpdate = true;
  if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
  flowerInst.computeBoundingSphere();
  group.add(flowerInst);

  // 2b. Low Shrubs & Bushes on Grassy Lawns (3 types: Rounded Boxwood, Flowering Rose Shrub, Woodland Fern)
  const boxwoodGeo = createLeafClusterClusterGeo([
    { x: 0, y: 0.46, z: 0, size: 1.05, tiltX: 0.25, rotY: 0.0 },
    { x: 0.28, y: 0.38, z: 0.22, size: 0.82, tiltX: 0.3, rotY: 1.1 },
    { x: -0.26, y: 0.38, z: -0.2, size: 0.84, tiltX: -0.2, rotY: 2.2 },
  ]);
  const fernGeo = createLeafClusterClusterGeo([
    { x: 0, y: 0.32, z: 0, size: 0.92, tiltX: 0.85, rotY: 0.2 },
    { x: 0.14, y: 0.36, z: -0.1, size: 0.88, tiltX: 0.95, rotY: 1.6 },
    { x: -0.14, y: 0.34, z: 0.12, size: 0.86, tiltX: 0.9, rotY: 2.8 },
  ]);
  const blossomGeo = new THREE.DodecahedronGeometry(0.085, 0);

  const MAX_BOXWOOD = 180;
  const MAX_FLOWER_SHRUB = 120;
  const MAX_FERN = 140;

  const boxwoodInst = new THREE.InstancedMesh(boxwoodGeo, mats.shrubLeafMat, MAX_BOXWOOD);
  boxwoodInst.castShadow = true;
  boxwoodInst.receiveShadow = true;

  const flowerShrubInst = new THREE.InstancedMesh(boxwoodGeo, mats.shrubLeafMat, MAX_FLOWER_SHRUB);
  flowerShrubInst.castShadow = true;
  flowerShrubInst.receiveShadow = true;
  const blossomInst = new THREE.InstancedMesh(blossomGeo, mats.shrubFlowerMat, MAX_FLOWER_SHRUB * 3);

  const fernInst = new THREE.InstancedMesh(fernGeo, mats.shrubLeafMat, MAX_FERN);
  fernInst.receiveShadow = true;

  let bCount = 0;
  let fsCount = 0;
  let blCount = 0;
  let fnCount = 0;
  const blossomPalette = [0xf2647e, 0xf7d060, 0xf4effa, 0xe88b5a];

  for (let attempt = 0; attempt < 2600 && (bCount < MAX_BOXWOOD || fsCount < MAX_FLOWER_SHRUB || fnCount < MAX_FERN); attempt++) {
    const insideCity = attempt < 1500;
    const range = insideCity ? 67 : 134;
    const sx = (gRand() * 2 - 1) * range;
    const sz = (gRand() * 2 - 1) * range;

    if (!insideCity && Math.abs(sx) < 87 && Math.abs(sz) < 87) continue;
    if (isCobbleRoad(sx, sz)) continue;
    if (isInsideAnyBuildingOrWall(sx, sz)) continue;
    if ((Math.abs(sx) < 8.5 || Math.abs(sz) < 8.5) && (Math.abs(sx) > 85 || Math.abs(sz) > 85)) continue;

    // Keep slight padding off road borders so bushes sit cleanly inside grassy beds
    if (
      isCobbleRoad(sx + 1.0, sz) ||
      isCobbleRoad(sx - 1.0, sz) ||
      isCobbleRoad(sx, sz + 1.0) ||
      isCobbleRoad(sx, sz - 1.0)
    ) {
      continue;
    }

    const sy = groundHeightAt(sx, sz);
    const kindRoll = gRand();
    if (kindRoll < 0.42 && bCount < MAX_BOXWOOD) {
      const sc = 0.72 + gRand() * 0.55;
      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
      dummy.scale.set(sc, sc * (0.8 + gRand() * 0.35), sc);
      dummy.updateMatrix();
      boxwoodInst.setMatrixAt(bCount, dummy.matrix);
      color.setHSL(0.26 + (gRand() - 0.5) * 0.04, 0.38, 0.54 + gRand() * 0.14);
      boxwoodInst.setColorAt(bCount, color);
      bCount++;
    } else if (kindRoll < 0.70 && fsCount < MAX_FLOWER_SHRUB) {
      const sc = 0.78 + gRand() * 0.45;
      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
      dummy.scale.set(sc, sc * 0.9, sc);
      dummy.updateMatrix();
      flowerShrubInst.setMatrixAt(fsCount, dummy.matrix);
      color.setHSL(0.27, 0.42, 0.50 + gRand() * 0.12);
      flowerShrubInst.setColorAt(fsCount, color);

      const bCol = blossomPalette[fsCount % blossomPalette.length];
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2 + gRand() * 0.6;
        dummy.position.set(sx + Math.cos(ang) * 0.28 * sc, sy + (0.48 + gRand() * 0.24) * sc, sz + Math.sin(ang) * 0.28 * sc);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        blossomInst.setMatrixAt(blCount, dummy.matrix);
        color.setHex(bCol);
        blossomInst.setColorAt(blCount, color);
        blCount++;
      }
      fsCount++;
    } else if (fnCount < MAX_FERN) {
      const sc = 0.65 + gRand() * 0.55;
      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
      dummy.scale.set(sc, sc * 0.78, sc);
      dummy.updateMatrix();
      fernInst.setMatrixAt(fnCount, dummy.matrix);
      color.setHSL(0.24 + (gRand() - 0.5) * 0.04, 0.44, 0.48 + gRand() * 0.14);
      fernInst.setColorAt(fnCount, color);
      fnCount++;
    }
  }

  boxwoodInst.count = bCount;
  boxwoodInst.instanceMatrix.needsUpdate = true;
  if (boxwoodInst.instanceColor) boxwoodInst.instanceColor.needsUpdate = true;
  boxwoodInst.computeBoundingSphere();

  flowerShrubInst.count = fsCount;
  flowerShrubInst.instanceMatrix.needsUpdate = true;
  if (flowerShrubInst.instanceColor) flowerShrubInst.instanceColor.needsUpdate = true;
  flowerShrubInst.computeBoundingSphere();

  blossomInst.count = blCount;
  blossomInst.instanceMatrix.needsUpdate = true;
  if (blossomInst.instanceColor) blossomInst.instanceColor.needsUpdate = true;
  blossomInst.computeBoundingSphere();

  fernInst.count = fnCount;
  fernInst.instanceMatrix.needsUpdate = true;
  if (fernInst.instanceColor) fernInst.instanceColor.needsUpdate = true;
  fernInst.computeBoundingSphere();

  group.add(boxwoodInst, flowerShrubInst, blossomInst, fernInst);

  // 3. Ornate Wrought-Iron Street Lanterns + Volumetric Glow Halos
  const postGeo = new THREE.CylinderGeometry(0.085, 0.16, 3.65, 10);
  postGeo.translate(0, 1.825, 0);
  const collarGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.2, 8);
  collarGeo.translate(0, 3.45, 0);
  const capGeo = new THREE.ConeGeometry(0.45, 0.42, 6);
  capGeo.translate(0, 4.18, 0);
  const globeGeo = new THREE.SphereGeometry(0.25, 12, 10);
  globeGeo.translate(0, 3.76, 0);

  const lCount = LANTERNS.length;
  const postInst = new THREE.InstancedMesh(postGeo, mats.wroughtIron, lCount);
  const collarInst = new THREE.InstancedMesh(collarGeo, mats.wroughtIron, lCount);
  const capInst = new THREE.InstancedMesh(capGeo, mats.wroughtIron, lCount);
  const globeInst = new THREE.InstancedMesh(globeGeo, mats.lanternGlow, lCount);

  postInst.castShadow = true;

  for (let i = 0; i < lCount; i++) {
    const l = LANTERNS[i];
    dummy.position.set(l.x, 0, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    postInst.setMatrixAt(i, dummy.matrix);
    collarInst.setMatrixAt(i, dummy.matrix);
    capInst.setMatrixAt(i, dummy.matrix);
    globeInst.setMatrixAt(i, dummy.matrix);

    // Volumetric soft amber lantern halo sprite
    const haloMat = new THREE.SpriteMaterial({
      map: mats.haloGlowTex,
      color: 0xffbc5a,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(l.x, 3.76, l.z);
    halo.scale.set(3.4, 3.4, 1);
    group.add(halo);
    lanternHalos.push(halo);
  }
  postInst.instanceMatrix.needsUpdate = true;
  collarInst.instanceMatrix.needsUpdate = true;
  capInst.instanceMatrix.needsUpdate = true;
  globeInst.instanceMatrix.needsUpdate = true;
  postInst.computeBoundingSphere();
  collarInst.computeBoundingSphere();
  capInst.computeBoundingSphere();
  globeInst.computeBoundingSphere();

  group.add(postInst, collarInst, capInst, globeInst);

  // 6 Dynamic Warm PointLights (Central Plaza, Tavern, Market, Cathedral, Forge Hearth)
  const warmHubs: [number, number, number][] = [
    [-10, 4.2, 10],
    [10, 4.2, -10],
    [22, 4.2, 26],
    [-22, 4.2, 20],
    [52, 4.5, -42],
    [-25, 2.2, -27], // Blacksmith forge ember glow!
  ];
  for (const [lx, ly, lz] of warmHubs) {
    const pl = new THREE.PointLight(0xffb154, 0.0, 28, 1.5);
    pl.position.set(lx, ly, lz);
    group.add(pl);
    lanternLights.push(pl);
  }

  return { group, lanternLights, lanternHalos };
}
