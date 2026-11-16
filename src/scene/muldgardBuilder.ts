/**
 * Stavitel pouštního města Muldgard (Morroc styl) pro Kaldgard Online.
 * Vše procedurální, žádné externí assety: pískové textury se generují
 * do canvasu, geometrie je low-poly (adobe kvádry s atikou, kopule,
 * stanové jehlany, palmy, pyramidy, sochy strážců).
 * Fyzických portálů sem nevede žádný — příchozí cesta je jen UI teleport.
 */
import * as THREE from 'three';
import {
  MULD_BRIDGE_EW,
  MULD_BRIDGE_NS,
  MULD_BUSHES,
  MULD_BUILDINGS,
  MULD_FOUNTAIN_S,
  MULD_GARDENS,
  MULD_GATE_HALF_OPENING,
  MULD_ISLAND,
  MULD_LAKE,
  MULD_NPCS,
  MULD_PALMS,
  MULD_PYRAMIDS,
  MULD_STATUES,
  MULD_TENTS,
  MULD_WALL_POS,
  MULD_WELLS,
  MuldgardBuildingKind,
  muldgardHeightAt,
} from '../world/muldgardLayout';
import type { PortalVisual } from './architectureBuilder';
import { buildFieldMobs, buildNpcCharacter, MobActor } from './characterBuilder';
import type { PronteraMaterials } from './materials';

export interface BuiltMuldgardZone {
  group: THREE.Group;
  groundPickMesh: THREE.Mesh;
  waterMeshes: THREE.Mesh[];
  portals: PortalVisual[];
  mobActors: MobActor[];
  mobHitTargets: THREE.Mesh[];
  lanternLights: THREE.PointLight[];
  lanternHalos: THREE.Sprite[];
  dispose: () => void;
}

// ---------- procedurální pískové textury (žádné externí soubory) ----------

function makeSandTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const d = c.getContext('2d')!;
  d.fillStyle = '#d9b380';
  d.fillRect(0, 0, S, S);
  let seed = 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // velké měkké skvrny (pestrý písek)
  for (let i = 0; i < 90; i++) {
    const x = rand() * S, y = rand() * S, r = 20 + rand() * 60;
    const v = Math.floor(rand() * 24) - 12;
    const g = d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${217 + v},${179 + v},${128 + v},0.20)`);
    g.addColorStop(1, 'rgba(217,179,128,0)');
    d.fillStyle = g;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  }
  // jemné zrnění
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(rand() * 30) - 15;
    d.fillStyle = `rgb(${217 + v},${179 + v},${128 + v})`;
    d.fillRect(Math.floor(rand() * S), Math.floor(rand() * S), 2, 2);
  }
  // oblázky
  for (let i = 0; i < 130; i++) {
    const v = Math.floor(rand() * 40) - 28;
    d.fillStyle = `rgb(${190 + v},${158 + v},${118 + v})`;
    d.beginPath();
    d.arc(rand() * S, rand() * S, 1 + rand() * 2.2, 0, Math.PI * 2);
    d.fill();
  }
  // jemné vlnky dun
  d.strokeStyle = 'rgba(190,150,105,0.30)';
  d.lineWidth = 2;
  for (let y = 12; y < S; y += 44) {
    d.beginPath();
    for (let x = 0; x <= S; x += 16) {
      const yy = y + Math.sin(x * 0.05 + y) * 6;
      if (x === 0) d.moveTo(x, yy);
      else d.lineTo(x, yy);
    }
    d.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeSandstoneTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const d = c.getContext('2d')!;
  d.fillStyle = '#c9a878';
  d.fillRect(0, 0, S, S);
  let seed = 917;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rh = 64;
  const bw = 128;
  for (let ry = 0; ry < S; ry += rh) {
    const off = (ry / rh) % 2 === 0 ? 0 : bw / 2;
    for (let cx = -bw; cx < S + bw; cx += bw) {
      const v = Math.floor(rand() * 30) - 15;
      d.fillStyle = `rgb(${205 + v},${172 + v},${122 + v})`;
      d.fillRect(cx + off + 3, ry + 3, bw - 6, rh - 6);
      d.fillStyle = 'rgba(255,240,210,0.35)';
      d.fillRect(cx + off + 3, ry + 3, bw - 6, 3);
      d.fillStyle = 'rgba(90,64,36,0.35)';
      d.fillRect(cx + off + 3, ry + rh - 6, bw - 6, 3);
    }
  }
  for (let i = 0; i < 3500; i++) {
    const v = Math.floor(rand() * 22) - 11;
    d.fillStyle = `rgb(${200 + v},${168 + v},${120 + v})`;
    d.fillRect(Math.floor(rand() * S), Math.floor(rand() * S), 2, 2);
  }
  d.strokeStyle = 'rgba(110,84,50,0.9)';
  d.lineWidth = 3;
  for (let ry = 0; ry <= S; ry += rh) {
    d.beginPath();
    d.moveTo(0, ry);
    d.lineTo(S, ry);
    d.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeAdobeTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const d = c.getContext('2d')!;
  d.fillStyle = '#d8b98e';
  d.fillRect(0, 0, S, S);
  let seed = 5150;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 140; i++) {
    const x = rand() * S, y = rand() * S, r = 14 + rand() * 44;
    const v = Math.floor(rand() * 22) - 11;
    const g = d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${218 + v},${184 + v},${142 + v},0.35)`);
    g.addColorStop(1, 'rgba(216,185,142,0)');
    d.fillStyle = g;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  }
  for (let i = 0; i < 4000; i++) {
    const v = Math.floor(rand() * 20) - 10;
    d.fillStyle = `rgb(${214 + v},${180 + v},${140 + v})`;
    d.fillRect(Math.floor(rand() * S), Math.floor(rand() * S), 2, 2);
  }
  // vlásečnicové praskliny
  d.strokeStyle = 'rgba(120,90,58,0.35)';
  d.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    let x = rand() * S, y = rand() * S;
    d.beginPath();
    d.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 40;
      y += (rand() - 0.5) * 40;
      d.lineTo(x, y);
    }
    d.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeTrunkTexture(): THREE.CanvasTexture {
  const W = 256, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const d = c.getContext('2d')!;
  d.fillStyle = '#8a6a42';
  d.fillRect(0, 0, W, H);
  let seed = 777;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // svislá vlákna
  for (let i = 0; i < 380; i++) {
    const x = rand() * W;
    const v = Math.floor(rand() * 36) - 18;
    d.fillStyle = `rgba(${138 + v},${106 + v},${66 + v},0.55)`;
    d.fillRect(x, 0, 2 + rand() * 3, H);
  }
  // kroužky po odpadlých listech
  for (let y = 8; y < H; y += 26) {
    d.fillStyle = 'rgba(64,42,22,0.9)';
    d.fillRect(0, y, W, 5);
    d.fillStyle = 'rgba(196,158,104,0.8)';
    d.fillRect(0, y + 5, W, 3);
    // kosočtverečné jizvy
    for (let x = 12; x < W; x += 34) {
      d.strokeStyle = 'rgba(64,42,22,0.7)';
      d.lineWidth = 2;
      d.beginPath();
      d.moveTo(x - 10, y + 14);
      d.lineTo(x, y + 8);
      d.lineTo(x + 10, y + 14);
      d.stroke();
    }
  }
  // praskliny
  d.strokeStyle = 'rgba(50,32,16,0.8)';
  d.lineWidth = 2.5;
  for (let i = 0; i < 10; i++) {
    let x = rand() * W, y = rand() * H;
    d.beginPath();
    d.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rand() - 0.5) * 14;
      y += rand() * 40;
      d.lineTo(x, y);
    }
    d.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// List palmy: zpeřený (žebro + lístky po stranách), alfa-výřez
function makePalmFrondTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const d = c.getContext('2d')!;
  d.clearRect(0, 0, S, S);
  let seed = 42421;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cx = S / 2;
  // postranní lístky od špičky (y=8) k bázi (y=500)
  for (let i = 0; i < 52; i++) {
    const t = i / 52;
    const y = 14 + t * 470;
    const len = 225 * (1 - t * 0.72);
    const droop = 26 + t * 40;
    for (const side of [-1, 1]) {
      const v = Math.floor(rand() * 36) - 18;
      const g = 118 + v, gg = 158 + v;
      d.strokeStyle = `rgb(${52 + v},${g},${44 + v})`;
      d.lineWidth = 5.5 - t * 2.5;
      d.lineCap = 'round';
      d.beginPath();
      d.moveTo(cx, y);
      d.quadraticCurveTo(
        cx + side * len * 0.55, y + droop * 0.35,
        cx + side * len, y + droop,
      );
      d.stroke();
      // světlejší střední žilka lístku
      d.strokeStyle = `rgba(${110 + v},${gg + 20},${80 + v},0.8)`;
      d.lineWidth = 1.5;
      d.beginPath();
      d.moveTo(cx, y);
      d.quadraticCurveTo(
        cx + side * len * 0.55, y + droop * 0.35,
        cx + side * len, y + droop,
      );
      d.stroke();
    }
  }
  // středové žebro
  const rib = d.createLinearGradient(cx - 8, 0, cx + 8, 0);
  rib.addColorStop(0, '#5a7a34');
  rib.addColorStop(0.5, '#8aa050');
  rib.addColorStop(1, '#5a7a34');
  d.fillStyle = rib;
  d.fillRect(cx - 7, 8, 14, 496);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

interface MuldgardMats {
  sand: THREE.MeshStandardMaterial;
  sandDark: THREE.MeshStandardMaterial;
  sandstone: THREE.MeshStandardMaterial;
  adobe: THREE.MeshStandardMaterial;
  dome: THREE.MeshStandardMaterial;
  palmTrunk: THREE.MeshStandardMaterial;
  palmLeaf: THREE.MeshStandardMaterial;
  palmLeafDark: THREE.MeshStandardMaterial;
  bushDry: THREE.MeshStandardMaterial;
  stalkDry: THREE.MeshStandardMaterial;
  stoneGray: THREE.MeshStandardMaterial;
  gardenGreen: THREE.MeshStandardMaterial;
  tentWood: THREE.MeshStandardMaterial;
  textures: THREE.CanvasTexture[];
}

function createMuldgardMats(): MuldgardMats {
  const sandTex = makeSandTexture();
  sandTex.repeat.set(40, 40);
  const sandstoneTex = makeSandstoneTexture();
  const adobeTex = makeAdobeTexture();
  const trunkTex = makeTrunkTexture();
  const frondTex = makePalmFrondTexture();
  const sand = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1.0 });
  const sandDark = new THREE.MeshStandardMaterial({ color: 0xb98f5f, roughness: 1.0 });
  // teplý nádech, ať písek nezšedne ve studeném světle
  const sandstone = new THREE.MeshStandardMaterial({ map: sandstoneTex, roughness: 0.95, color: 0xffe9c4 });
  const adobe = new THREE.MeshStandardMaterial({ map: adobeTex, roughness: 0.95, color: 0xfff0d6 });
  const dome = new THREE.MeshStandardMaterial({ color: 0x4a4a62, roughness: 0.55, metalness: 0.25 });
  const palmTrunk = new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 1.0 });
  const palmLeaf = new THREE.MeshStandardMaterial({
    map: frondTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85,
  });
  const palmLeafDark = new THREE.MeshStandardMaterial({
    map: frondTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85, color: 0xcfe0c0,
  });
  const bushDry = new THREE.MeshStandardMaterial({ color: 0x7a7a3a, roughness: 1.0 });
  const stalkDry = new THREE.MeshStandardMaterial({ color: 0xb09a5e, roughness: 1.0 });
  const stoneGray = new THREE.MeshStandardMaterial({ color: 0x9a8f7e, roughness: 1.0 });
  const gardenGreen = new THREE.MeshStandardMaterial({ color: 0x4e7a34, roughness: 1.0 });
  const tentWood = new THREE.MeshStandardMaterial({ color: 0x5c422a, roughness: 0.9 });
  for (const m of [sandstone]) {
    m.userData.pbrKind = 'stone';
  }
  for (const m of [sand, adobe]) {
    m.userData.pbrKind = 'plaster';
  }
  dome.userData.pbrKind = 'metal';
  return {
    sand, sandDark, sandstone, adobe, dome, palmTrunk, palmLeaf,
    palmLeafDark, bushDry, stalkDry, stoneGray, gardenGreen, tentWood,
    textures: [sandTex, sandstoneTex, adobeTex, trunkTex, frondTex],
  };
}

function worldScaledBox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  tileSize = 5.0,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (Math.max(w, d) / tileSize), uv.getY(i) * (h / tileSize));
  }
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- terén a cesty ----------

function buildMuldgardTerrain(dm: MuldgardMats, mats: PronteraMaterials): { group: THREE.Group; groundPickMesh: THREE.Mesh; waterMeshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const waterMeshes: THREE.Mesh[] = [];

  // Písková pláň 400x400 (rovina, výška 0)
  const groundGeo = new THREE.PlaneGeometry(400, 400, 48, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, dm.sand);
  ground.receiveShadow = true;
  group.add(ground);

  // Neviditelná rovina pro klikání (stejně jako Prontera)
  const pickGeo = new THREE.PlaneGeometry(290, 290);
  pickGeo.rotateX(-Math.PI / 2);
  const groundPickMesh = new THREE.Mesh(
    pickGeo,
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  groundPickMesh.position.y = 0.02;
  group.add(groundPickMesh);

  // Pískové cesty — vrstvy s mírně odlišnou výškou, aby se nepřekrývaly (žádný z-fighting)
  const addRoad = (x: number, z: number, w: number, d: number, yCenter = 0.03) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), dm.sandDark);
    m.position.set(x, yCenter, z);
    m.receiveShadow = true;
    group.add(m);
  };
  addRoad(0, 54, 48, 20, 0.034); // jižní náměstí s bazarem
  addRoad(0, 22, 13, 172, 0.03); // S-J třída (jih, přes jižní most)
  addRoad(0, -40, 13, 48, 0.03); // S-J třída (sever, přes severní most)
  addRoad(0, 0, 216, 13, 0.032); // V-Z třída (přes mosty)
  addRoad(0, -51.5, 42, 25, 0.03); // nádvoří chrámu
  // okružní třída: 4 na sebe navazující pásy BEZ překryvu (jen společné hrany)
  addRoad(-31.5, 0, 7, 64, 0.026);
  addRoad(31.5, 0, 7, 64, 0.026);
  addRoad(0, -35.5, 70, 7, 0.026);
  addRoad(0, 35.5, 70, 7, 0.026);

  // Palácové jezero: vodní plocha s ostrůvkem a mosty (srdce podle reference)
  const lakeW = MULD_LAKE.x2 - MULD_LAKE.x1;
  const lakeD = MULD_LAKE.z2 - MULD_LAKE.z1;
  const lakeCx = (MULD_LAKE.x1 + MULD_LAKE.x2) / 2;
  const lakeCz = (MULD_LAKE.z1 + MULD_LAKE.z2) / 2;
  const lakeWater = new THREE.Mesh(
    new THREE.PlaneGeometry(lakeW, lakeD),
    mats.waterFountain,
  );
  lakeWater.rotation.x = -Math.PI / 2;
  lakeWater.position.set(lakeCx, 0.5, lakeCz);
  lakeWater.userData.baseY = 0.5;
  group.add(lakeWater);
  waterMeshes.push(lakeWater);
  // kamenná obruba jezera
  const rimT = 0.8;
  const rimH = 0.6;
  const rimN = worldScaledBox(lakeW + rimT * 2, rimH, rimT, dm.sandstone, 4.0);
  rimN.position.set(lakeCx, rimH / 2, MULD_LAKE.z1 - rimT / 2);
  const rimS = rimN.clone();
  rimS.position.z = MULD_LAKE.z2 + rimT / 2;
  const rimW = worldScaledBox(rimT, rimH, lakeD, dm.sandstone, 4.0);
  rimW.position.set(MULD_LAKE.x1 - rimT / 2, rimH / 2, lakeCz);
  const rimE = rimW.clone();
  rimE.position.x = MULD_LAKE.x2 + rimT / 2;
  group.add(rimN, rimS, rimW, rimE);
  // ostrovní platforma s palácem
  const isleW = MULD_ISLAND.x2 - MULD_ISLAND.x1;
  const isleD = MULD_ISLAND.z2 - MULD_ISLAND.z1;
  const isleCx = (MULD_ISLAND.x1 + MULD_ISLAND.x2) / 2;
  const isleCz = (MULD_ISLAND.z1 + MULD_ISLAND.z2) / 2;
  const isle = worldScaledBox(isleW, 1.0, isleD, dm.sandstone, 5.0);
  isle.position.set(isleCx, 0.5, isleCz);
  group.add(isle);
  // mosty přes jezero: paluba jen nad vodou + svažující se nájezdy na pevninu
  const addBridgeDeck = (x: number, z: number, w: number, d: number) => {
    const deck = worldScaledBox(w, 0.5, d, dm.sandstone, 4.0);
    deck.position.set(x, 0.55, z);
    group.add(deck);
    const alongX = w > d;
    for (const side of [-1, 1]) {
      const rail = worldScaledBox(alongX ? w : 0.4, 0.7, alongX ? 0.4 : d, dm.sandstone, 3.0);
      rail.position.set(
        alongX ? x : x + side * (w / 2 - 0.2),
        1.1,
        alongX ? z + side * (d / 2 - 0.2) : z,
      );
      group.add(rail);
    }
  };
  // S-J paluba nad vodou (z -31..27), nájezdy z[-39,-31] a z[27,35]
  addBridgeDeck(0, -2, 6, 58);
  // V-Z paluba nad vodou (x -27..27), nájezdy x[-35,-27] a x[27,35]
  addBridgeDeck(0, 0, 54, 6);
  // nájezdy: skloněné desky z terénu (0) na palubu (0.8)
  const rampAngle = Math.atan2(0.8, 8);
  const addRampNS = (zc: number, dir: 1 | -1) => {
    const ramp = worldScaledBox(6, 0.4, 8.1, dm.sandstone, 4.0);
    ramp.position.set(0, 0.2, zc);
    ramp.rotation.x = dir * rampAngle;
    group.add(ramp);
  };
  const addRampEW = (xc: number, dir: 1 | -1) => {
    const ramp = worldScaledBox(8.1, 0.4, 6, dm.sandstone, 4.0);
    ramp.position.set(xc, 0.2, 0);
    ramp.rotation.z = dir * rampAngle;
    group.add(ramp);
  };
  addRampNS(-35, -1); // severní nájezd (stoupá k +z)
  addRampNS(31, 1); // jižní nájezd (stoupá k -z)
  addRampEW(-31, 1); // západní nájezd (stoupá k +x)
  addRampEW(31, -1); // východní nájezd (stoupá k -x)

  // Jižní kašna na náměstí (malý bazének se zlatou koulí)
  const fBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(MULD_FOUNTAIN_S.r + 0.6, MULD_FOUNTAIN_S.r + 0.9, 0.7, 20),
    dm.sandstone,
  );
  fBasin.position.set(MULD_FOUNTAIN_S.x, 0.3, MULD_FOUNTAIN_S.z);
  fBasin.receiveShadow = true;
  group.add(fBasin);
  const fWater = new THREE.Mesh(
    new THREE.CircleGeometry(MULD_FOUNTAIN_S.r, 24),
    mats.waterFountain,
  );
  fWater.rotation.x = -Math.PI / 2;
  fWater.position.set(MULD_FOUNTAIN_S.x, 0.62, MULD_FOUNTAIN_S.z);
  fWater.userData.baseY = 0.62;
  group.add(fWater);
  waterMeshes.push(fWater);
  const fOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    mats.goldTrim,
  );
  fOrb.position.set(MULD_FOUNTAIN_S.x, 1.5, MULD_FOUNTAIN_S.z);
  group.add(fOrb);

  // Duny daleko za městem (nízké valy, jen silueta na obzoru)
  let duneSeed = 31337;
  const drand = () => {
    duneSeed = (duneSeed * 1664525 + 1013904223) >>> 0;
    return duneSeed / 4294967296;
  };
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + drand() * 0.4;
    const dist = 178 + drand() * 22;
    const dune = new THREE.Mesh(
      new THREE.SphereGeometry(18 + drand() * 12, 12, 8),
      dm.sandDark,
    );
    dune.scale.y = 0.06 + drand() * 0.04;
    dune.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    dune.receiveShadow = true;
    group.add(dune);
  }

  return { group, groundPickMesh, waterMeshes };
}

// ---------- hradby a brány ----------

function buildMuldgardWalls(dm: MuldgardMats, mats: PronteraMaterials, lanternLights: THREE.PointLight[], lanternHalos: THREE.Sprite[]): THREE.Group {
  const group = new THREE.Group();
  const wPos = MULD_WALL_POS;
  const gOpen = MULD_GATE_HALF_OPENING;
  const wallH = 7.5;
  const wallT = 3.6;

  const buildWallRun = (x: number, z: number, len: number, alongX: boolean) => {
    const run = new THREE.Group();
    run.position.set(x, 0, z);
    if (!alongX) run.rotation.y = Math.PI / 2;
    const wall = worldScaledBox(len, wallH, wallT, dm.sandstone, 5.5);
    wall.position.y = wallH / 2;
    run.add(wall);
    // cimbuří
    const merlonCount = Math.max(2, Math.floor(len / 3.2));
    const step = len / merlonCount;
    for (let i = 0; i < merlonCount; i++) {
      const mx = -len / 2 + (i + 0.5) * step;
      for (const side of [-1, 1]) {
        const merlon = worldScaledBox(1.4, 1.0, 0.6, dm.sandstone, 3.0);
        merlon.position.set(mx, wallH + 0.5, side * (wallT / 2 - 0.3));
        run.add(merlon);
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
  // Severní křídla kolem paláce (palác sedí v proluce jako kaldgardský hrad)
  const nLen = wPos - 14;
  buildWallRun(-14 - nLen / 2, -wPos, nLen, true);
  buildWallRun(14 + nLen / 2, -wPos, nLen, true);

  // Rohové bašty: válec + kopule (morroc věže)
  const addBastion = (cx: number, cz: number) => {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.8, 2.0, 16),
      dm.sandstone,
    );
    base.position.set(cx, 1.0, cz);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.3, 10.5, 16),
      dm.sandstone,
    );
    body.position.set(cx, 7.0, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    const domeCap = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      dm.dome,
    );
    domeCap.position.set(cx, 12.2, cz);
    domeCap.castShadow = true;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      mats.goldTrim,
    );
    tip.position.set(cx, 15.6, cz);
    group.add(base, body, domeCap, tip);
  };
  addBastion(-wPos, -wPos);
  addBastion(wPos, -wPos);
  addBastion(-wPos, wPos);
  addBastion(wPos, wPos);

  // Brány J/Z/V: 2 pilíře + překlad + kopulka + ohniště
  const buildGate = (x: number, z: number, rotY: number) => {
    const gate = new THREE.Group();
    gate.position.set(x, 0, z);
    gate.rotation.y = rotY;
    for (const s of [-1, 1]) {
      const pillar = worldScaledBox(2.2, 7.5, 2.2, dm.sandstone, 4.0);
      pillar.position.set(s * 7.6, 3.75, 0);
      gate.add(pillar);
      const capDome = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        dm.dome,
      );
      capDome.position.set(s * 7.6, 7.5, 0);
      capDome.castShadow = true;
      gate.add(capDome);
      // ohniště před pilířem
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.22, 0.5, 10),
        mats.wroughtIron,
      );
      bowl.position.set(s * 5.2, 1.1, 2.6);
      const embers = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 8),
        mats.emberGlow,
      );
      embers.position.set(s * 5.2, 1.35, 2.6);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: mats.haloGlowTex,
          color: 0xffa842,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.position.set(s * 5.2, 1.6, 2.6);
      glow.scale.set(3.0, 3.0, 1);
      gate.add(bowl, embers, glow);
      lanternHalos.push(glow);
    }
    const lintel = worldScaledBox(17.4, 1.2, 2.4, dm.sandstone, 4.0);
    lintel.position.set(0, 8.1, 0);
    gate.add(lintel);
    const centerDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      dm.dome,
    );
    centerDome.position.set(0, 8.7, 0);
    centerDome.castShadow = true;
    gate.add(centerDome);
    group.add(gate);
  };
  buildGate(0, wPos, 0);
  buildGate(-wPos, 0, Math.PI / 2);
  buildGate(wPos, 0, -Math.PI / 2);

  // Pár skutečných světel k branám (noc), zbytek jen emissive + halo
  const gateLightPos: [number, number][] = [[-5.2, wPos + 2.6], [5.2, wPos + 2.6], [-wPos - 2.6, 5.2], [wPos + 2.6, -5.2]];
  for (const [lx, lz] of gateLightPos) {
    const pl = new THREE.PointLight(0xffa842, 12, 16, 1.8);
    pl.position.set(lx, 2.2, lz);
    group.add(pl);
    lanternLights.push(pl);
  }

  return group;
}

// ---------- budovy ----------

function addMuldgardWindow(
  parent: THREE.Group,
  dm: MuldgardMats,
  mats: PronteraMaterials,
  wx: number,
  wy: number,
  wz: number,
  rotY = 0,
  scale = 1,
) {
  const win = new THREE.Group();
  win.position.set(wx, wy, wz);
  win.rotation.y = rotY;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.1 * scale, 1.4 * scale, 0.2),
    dm.tentWood,
  );
  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(0.8 * scale, 1.1 * scale, 0.22),
    mats.windowGlow,
  );
  const mullV = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale, 1.1 * scale, 0.24),
    dm.tentWood,
  );
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(1.3 * scale, 0.14 * scale, 0.3),
    dm.sandstone,
  );
  sill.position.y = -0.75 * scale;
  win.add(frame, pane, mullV, sill);
  parent.add(win);
}

function addMuldgardDoor(
  parent: THREE.Group,
  dm: MuldgardMats,
  mats: PronteraMaterials,
  dx: number,
  dz: number,
  scale = 1,
) {
  const doorG = new THREE.Group();
  doorG.position.set(dx, 0, dz);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.3 * scale, 3.0 * scale, 0.4),
    dm.sandstone,
  );
  frame.position.y = 1.5 * scale;
  const wood = new THREE.Mesh(
    new THREE.BoxGeometry(1.7 * scale, 2.6 * scale, 0.46),
    dm.tentWood,
  );
  wood.position.y = 1.3 * scale;
  const sconce = new THREE.Mesh(
    new THREE.SphereGeometry(0.15 * scale, 8, 8),
    mats.lanternGlow,
  );
  sconce.position.set(1.4 * scale, 2.4 * scale, 0.3);
  doorG.add(frame, wood, sconce);
  parent.add(doorG);
}

/** Plochá adobe střecha s atikou (žádné sedlové střechy — poušť). */
function addParapetRoof(parent: THREE.Group, dm: MuldgardMats, w: number, d: number, topY: number) {
  const slab = worldScaledBox(w + 0.5, 0.3, d + 0.5, dm.sandstone, 5.0);
  slab.position.y = topY;
  parent.add(slab);
  const h = 0.7;
  const t = 0.35;
  const n = worldScaledBox(w + 0.5, h, t, dm.adobe, 4.0);
  n.position.set(0, topY + h / 2, -d / 2 + t / 2);
  const s = n.clone();
  s.position.z = d / 2 - t / 2;
  const wSide = worldScaledBox(t, h, d + 0.5, dm.adobe, 4.0);
  wSide.position.set(-w / 2 + t / 2, topY + h / 2, 0);
  const eSide = wSide.clone();
  eSide.position.x = w / 2 - t / 2;
  parent.add(n, s, wSide, eSide);
}

function buildMuldgardBuilding(
  kind: MuldgardBuildingKind,
  w: number,
  d: number,
  h: number,
  dm: MuldgardMats,
  mats: PronteraMaterials,
): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'palace') {
    // Palác na vodě: velký pískovcový blok + cimbuří + centrální kopule
    const main = worldScaledBox(w, h * 0.8, d, dm.sandstone, 6.0);
    main.position.y = (h * 0.8) / 2;
    g.add(main);
    const rim = worldScaledBox(w + 0.8, 0.5, d + 0.8, dm.sandstone, 5.0);
    rim.position.y = h * 0.8 + 0.2;
    g.add(rim);
    for (let i = 0; i < 8; i++) {
      const mx = -w / 2 + ((i + 0.5) / 8) * w;
      for (const side of [-1, 1]) {
        const merlon = worldScaledBox(1.2, 0.8, 0.5, dm.sandstone, 3.0);
        merlon.position.set(mx, h * 0.8 + 0.8, side * (d / 2 + 0.15));
        g.add(merlon);
      }
    }
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 5.0, 2.0, 20),
      dm.sandstone,
    );
    drum.position.y = h * 0.8 + 1.2;
    drum.castShadow = true;
    g.add(drum);
    const domeCap = new THREE.Mesh(
      new THREE.SphereGeometry(4.8, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      dm.dome,
    );
    domeCap.position.y = h * 0.8 + 2.2;
    domeCap.castShadow = true;
    g.add(domeCap);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 10),
      mats.goldTrim,
    );
    tip.position.y = h * 0.8 + 7.4;
    g.add(tip);
    // 4 rohové věžičky s kopulkami
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.7, 1.9, h * 0.9, 14),
        dm.sandstone,
      );
      tower.position.set(sx * (w / 2 - 1), (h * 0.9) / 2, sz * (d / 2 - 1));
      tower.castShadow = true;
      const small = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        dm.dome,
      );
      small.position.set(sx * (w / 2 - 1), h * 0.9 + 0.4, sz * (d / 2 - 1));
      g.add(tower, small);
    }
    addMuldgardDoor(g, dm, mats, 0, d / 2 + 0.05, 1.6);
    for (const wx of [-9, -4.5, 4.5, 9]) {
      addMuldgardWindow(g, dm, mats, wx, 5.2, d / 2 + 0.08, 0, 1.1);
    }
    return g;
  }

  if (kind === 'temple') {
    // Stupňovitá pyramida + svatyně nahoře (odkaz na morroc pyramidy)
    const step1 = worldScaledBox(w, 2.4, d, dm.sandstone, 5.0);
    step1.position.y = 1.2;
    const step2 = worldScaledBox(w * 0.72, 2.4, d * 0.72, dm.sandstone, 5.0);
    step2.position.y = 3.6;
    const step3 = worldScaledBox(w * 0.46, 2.6, d * 0.46, dm.adobe, 4.0);
    step3.position.y = 6.1;
    g.add(step1, step2, step3);
    const shrine = worldScaledBox(w * 0.46, 2.2, d * 0.46, dm.adobe, 4.0);
    shrine.position.y = 8.5;
    g.add(shrine);
    addParapetRoof(g, dm, w * 0.46, d * 0.46, 9.7);
    const sun = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.25, 20),
      mats.goldTrim,
    );
    sun.rotation.x = Math.PI / 2;
    sun.position.set(0, 8.6, (d * 0.46) / 2 + 0.15);
    g.add(sun);
    addMuldgardDoor(g, dm, mats, 0, (d * 0.46) / 2 + 0.05, 1.0);
    return g;
  }

  if (kind === 'pavilion') {
    // malý altánek s kopulkou na ostrově
    const body = worldScaledBox(w, h * 0.7, d, dm.adobe, 4.0);
    body.position.y = (h * 0.7) / 2;
    g.add(body);
    addParapetRoof(g, dm, w, d, h * 0.7);
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.6, 0.8, 12),
      dm.sandstone,
    );
    drum.position.y = h * 0.7 + 0.7 + 0.4;
    drum.castShadow = true;
    g.add(drum);
    const domeCap = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      dm.dome,
    );
    domeCap.position.y = h * 0.7 + 0.7 + 0.8;
    domeCap.castShadow = true;
    g.add(domeCap);
    addMuldgardDoor(g, dm, mats, 0, d / 2 + 0.05, 0.9);
    addMuldgardWindow(g, dm, mats, -w * 0.22, 2.0, d / 2 + 0.06, 0, 0.8);
    addMuldgardWindow(g, dm, mats, w * 0.22, 2.0, d / 2 + 0.06, 0, 0.8);
    return g;
  }

  // Běžné domy / obchody / karavanseraje: adobe kvádr + atika
  const groundH = h * 0.55;
  const upperH = h * 0.45;
  const base = worldScaledBox(w, groundH, d, dm.adobe, 5.0);
  base.position.y = groundH / 2;
  g.add(base);
  const upper = worldScaledBox(w + 0.4, upperH, d + 0.4, dm.adobe, 5.0);
  upper.position.y = groundH + upperH / 2;
  g.add(upper);
  addParapetRoof(g, dm, w + 0.4, d + 0.4, groundH + upperH);
  addMuldgardDoor(g, dm, mats, 0, d / 2 + 0.05, 1.0);
  addMuldgardWindow(g, dm, mats, -w * 0.28, 2.2, d / 2 + 0.06, 0, 0.9);
  addMuldgardWindow(g, dm, mats, w * 0.28, 2.2, d / 2 + 0.06, 0, 0.9);
  addMuldgardWindow(g, dm, mats, -w * 0.2, groundH + upperH * 0.5, (d + 0.4) / 2 + 0.06, 0, 0.9);
  addMuldgardWindow(g, dm, mats, w * 0.2, groundH + upperH * 0.5, (d + 0.4) / 2 + 0.06, 0, 0.9);

  if (kind === 'shop') {
    // plátěná markýza nad výkladem (pruhovaná béžovo-zelená)
    const awningMat = mats.createAwningMaterial(0xe6dcc0, 0x2e6e46);
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, 0.14, 2.2),
      awningMat,
    );
    awning.position.set(0, 3.4, d / 2 + 1.0);
    awning.rotation.x = 0.28;
    awning.castShadow = true;
    g.add(awning);
  }
  if (kind === 'caravan') {
    // dřevěný balkón pro karavanseraj
    const balcony = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8, 0.2, 1.0),
      dm.tentWood,
    );
    balcony.position.set(0, groundH, d / 2 + 0.5);
    g.add(balcony);
  }
  return g;
}

// ---------- stany, palmy, sochy, pyramidy, zahrady ----------

function buildMuldgardTent(
  dm: MuldgardMats,
  mats: PronteraMaterials,
  canopyColor: number,
  accentColor: number,
): THREE.Group {
  const g = new THREE.Group();
  for (const [px, pz] of [[-1.7, -1.0], [1.7, -1.0], [-1.7, 1.0], [1.7, 1.0]] as [number, number][]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 2.6, 8),
      dm.tentWood,
    );
    post.position.set(px, 1.3, pz);
    post.castShadow = true;
    g.add(post);
  }
  const counter = worldScaledBox(3.0, 0.9, 1.4, dm.tentWood, 3.0);
  counter.position.set(0, 0.45, 0.6);
  g.add(counter);
  // stanový jehlan z pruhované plachty
  const canopyMat = mats.createAwningMaterial(canopyColor, accentColor);
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(3.1, 1.5, 4),
    canopyMat,
  );
  canopy.position.y = 3.3;
  canopy.rotation.y = Math.PI / 4;
  canopy.castShadow = true;
  g.add(canopy);
  // zboží: koše s ovocem/kořením (sdílené ovocné materiály)
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.32, 0.3, 10),
    mats.wickerMat,
  );
  basket.position.set(-0.8, 1.05, 0.6);
  g.add(basket);
  const goods = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    mats.orangeMat,
  );
  goods.position.set(-0.8, 1.3, 0.6);
  g.add(goods);
  const basket2 = basket.clone();
  basket2.position.set(0.8, 1.05, 0.6);
  const goods2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    mats.appleRedMat,
  );
  goods2.position.set(0.8, 1.3, 0.6);
  g.add(basket2, goods2);
  return g;
}

// List palmy: prohnutý pás s V-profilem; textura kreslí zpeřené lístky s alfa-výřezem
function createPalmFrondGeometry(len: number, droop: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(2.0, len, 1, 8);
  geo.translate(0, len / 2, 0); // báze v počátku, špička +Y
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = Math.min(1, Math.max(0, y / len));
    const taperedX = x * (1 - t * 0.82);
    const bendZ = -droop * t * t * len; // prohnutí dolů
    const foldZ = Math.abs(taperedX) * 0.55; // mělký V-profil
    pos.setXYZ(i, taperedX, y, bendZ + foldZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildMuldgardPalm(dm: MuldgardMats, scale: number): THREE.Group {
  const g = new THREE.Group();
  // lehce prohnutý kmen ze 3 dílů + kořenový nástavec
  const lean = 0.35;
  const segH = 1.6;
  let px = 0;
  for (let i = 0; i < 3; i++) {
    const r0 = 0.42 - i * 0.07;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r0 - 0.06, r0, segH, 8),
      dm.palmTrunk,
    );
    px += lean * 0.28;
    seg.position.set(px, segH / 2 + i * segH, 0);
    seg.rotation.z = -lean * 0.12;
    seg.castShadow = true;
    g.add(seg);
  }
  const flare = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 0.9, 8),
    dm.palmTrunk,
  );
  flare.position.y = 0.35;
  g.add(flare);
  const topX = px + lean * 0.3;
  const topY = segH * 3 + 0.1;
  // koruna: 2 patra ohnutých listů + vrcholový výhon
  const layers = [
    { count: 7, len: 3.6, droop: 0.42, pitch: -1.02 },
    { count: 6, len: 2.9, droop: 0.30, pitch: -0.52 },
    { count: 4, len: 2.0, droop: 0.12, pitch: -0.08 },
  ];
  let li = 0;
  for (const L of layers) {
    const geo = createPalmFrondGeometry(L.len, L.droop);
    for (let i = 0; i < L.count; i++) {
      const yaw = (i / L.count) * Math.PI * 2 + li * 0.35 + topY;
      const frond = new THREE.Mesh(geo, li % 2 === 0 ? dm.palmLeaf : dm.palmLeafDark);
      frond.position.set(topX, topY, 0);
      frond.rotation.order = 'YXZ';
      frond.rotation.y = yaw;
      frond.rotation.x = L.pitch;
      frond.castShadow = true;
      g.add(frond);
      li++;
    }
  }
  // datle pod korunou
  for (const [dx, dz] of [[-0.45, 0.25], [0.45, -0.25], [0, 0.5]] as [number, number][]) {
    const date = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      dm.tentWood,
    );
    date.position.set(topX + dx, topY - 0.55, dz);
    g.add(date);
  }
  g.scale.setScalar(scale);
  return g;
}

function buildMuldgardStatue(dm: MuldgardMats): THREE.Group {
  const g = new THREE.Group();
  const base = worldScaledBox(1.7, 0.7, 1.7, dm.sandstone, 3.0);
  base.position.y = 0.35;
  const body = worldScaledBox(1.1, 2.3, 1.1, dm.sandstone, 3.0);
  body.position.y = 1.85;
  const shoulders = worldScaledBox(1.5, 0.7, 1.0, dm.sandstone, 3.0);
  shoulders.position.y = 3.2;
  const head = worldScaledBox(0.8, 0.9, 0.8, dm.sandstone, 3.0);
  head.position.y = 3.95;
  g.add(base, body, shoulders, head);
  return g;
}

function buildMuldgardPyramid(dm: MuldgardMats, size: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(size * 0.72, height, 4);
  // UV přes celou texturu by roztáhlo kvádry — škáluj podle velikosti
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (size / 5), uv.getY(i) * (height / 5));
  }
  const m = new THREE.Mesh(geo, dm.sandstone);
  m.position.y = height / 2;
  m.rotation.y = Math.PI / 4;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

function buildMuldgardWell(dm: MuldgardMats): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.4, 1.1, 14),
    dm.sandstone,
  );
  ring.position.y = 0.55;
  ring.castShadow = true;
  ring.receiveShadow = true;
  g.add(ring);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8),
      dm.tentWood,
    );
    post.position.set(s * 1.2, 1.3, 0);
    g.add(post);
  }
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 1.0, 4),
    dm.dome,
  );
  roof.position.y = 3.0;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  return g;
}

// ---------- sestavení celé zóny ----------

export function buildMuldgardZone(
  mats: PronteraMaterials,
): BuiltMuldgardZone {
  const dm = createMuldgardMats();
  const group = new THREE.Group();
  const lanternLights: THREE.PointLight[] = [];
  const lanternHalos: THREE.Sprite[] = [];

  const terrain = buildMuldgardTerrain(dm, mats);
  group.add(terrain.group);

  const walls = buildMuldgardWalls(dm, mats, lanternLights, lanternHalos);
  group.add(walls);

  // Budovy podle layoutu (reálná medina — nic nestojí v cestě)
  for (const b of MULD_BUILDINGS) {
    const built = buildMuldgardBuilding(b.kind, b.width, b.depth, b.height, dm, mats);
    built.position.set(b.x, 0, b.z);
    built.rotation.y = b.rotY;
    group.add(built);
  }

  // Bazarové stany
  for (const s of MULD_TENTS) {
    const tent = buildMuldgardTent(dm, mats, s.canopyColor, s.accentColor);
    tent.position.set(s.x, 0, s.z);
    tent.rotation.y = s.rotY;
    group.add(tent);
  }

  // Zahrady: zelený plácek + nízké zídky + studna + keře
  for (const gd of MULD_GARDENS) {
    const w = gd.x2 - gd.x1;
    const d = gd.z2 - gd.z1;
    const cx = (gd.x1 + gd.x2) / 2;
    const cz = (gd.z1 + gd.z2) / 2;
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.08, d),
      dm.gardenGreen,
    );
    lawn.position.set(cx, 0.04, cz);
    lawn.receiveShadow = true;
    group.add(lawn);
    const t = 0.5;
    const h = 0.8;
    const n = worldScaledBox(w, h, t, dm.sandstone, 3.0);
    n.position.set(cx, h / 2, gd.z1);
    const sWall = n.clone();
    sWall.position.z = gd.z2;
    const wWall = worldScaledBox(t, h, d, dm.sandstone, 3.0);
    wWall.position.set(gd.x1, h / 2, cz);
    const eWall = wWall.clone();
    eWall.position.x = gd.x2;
    group.add(n, sWall, wWall, eWall);
  }
  for (const wl of MULD_WELLS) {
    const well = buildMuldgardWell(dm);
    well.position.set(wl.x, 0, wl.z);
    group.add(well);
  }

  // Sochy strážců u bran a nádvoří
  for (const st of MULD_STATUES) {
    const statue = buildMuldgardStatue(dm);
    statue.position.set(st.x, 0, st.z);
    statue.rotation.y = st.rotY;
    group.add(statue);
  }

  // Pyramidy v poušti
  for (const p of MULD_PYRAMIDS) {
    const pyr = buildMuldgardPyramid(dm, p.size, p.height);
    pyr.position.set(p.x, 0, p.z);
    group.add(pyr);
  }

  // Palmy a suché křoviny (pouštní drn: trs stébel + kameny)
  for (const p of MULD_PALMS) {
    const palm = buildMuldgardPalm(dm, p.scale);
    palm.position.set(p.x, muldgardHeightAt(p.x, p.z), p.z);
    palm.rotation.y = (p.x * 13.7 + p.z * 7.3) % (Math.PI * 2);
    group.add(palm);
  }
  const scrubGeo = new THREE.IcosahedronGeometry(0.7, 0);
  const stalkGeo = new THREE.ConeGeometry(0.06, 1.1, 5);
  const stoneGeo = new THREE.DodecahedronGeometry(0.22, 0);
  let scrubSeed = 4451;
  const srand = () => {
    scrubSeed = (scrubSeed * 1664525 + 1013904223) >>> 0;
    return scrubSeed / 4294967296;
  };
  for (const b of MULD_BUSHES) {
    const scrub = new THREE.Group();
    scrub.position.set(b.x, 0, b.z);
    const puff = new THREE.Mesh(scrubGeo, dm.bushDry);
    puff.scale.set(b.scale, b.scale * 0.62, b.scale);
    puff.position.y = 0.35 * b.scale;
    puff.castShadow = true;
    scrub.add(puff);
    for (let s = 0; s < 5; s++) {
      const stalk = new THREE.Mesh(stalkGeo, dm.stalkDry);
      const ang = srand() * Math.PI * 2;
      stalk.position.set(Math.cos(ang) * 0.4 * b.scale, 0.75 * b.scale, Math.sin(ang) * 0.4 * b.scale);
      stalk.rotation.set((srand() - 0.5) * 0.5, 0, (srand() - 0.5) * 0.5);
      scrub.add(stalk);
    }
    for (let s = 0; s < 2; s++) {
      const stone = new THREE.Mesh(stoneGeo, dm.stoneGray);
      stone.position.set((srand() - 0.5) * 1.6 * b.scale, 0.12, (srand() - 0.5) * 1.6 * b.scale);
      scrub.add(stone);
    }
    group.add(scrub);
  }

  // NPC (sdílený stavitel postav)
  for (const npc of MULD_NPCS) {
    group.add(buildNpcCharacter(npc, mats));
  }

  // Moby v poušti za hradbami
  const { group: mobGroup, actors: mobActors, hitTargets: mobHitTargets } = buildFieldMobs(mats, 'muldgard');
  group.add(mobGroup);

  const dispose = () => {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
      }
    });
    for (const t of dm.textures) t.dispose();
    for (const m of [dm.sand, dm.sandDark, dm.sandstone, dm.adobe, dm.dome, dm.palmTrunk, dm.palmLeaf, dm.palmLeafDark, dm.bushDry, dm.stalkDry, dm.stoneGray, dm.gardenGreen, dm.tentWood]) {
      m.dispose();
    }
  };

  return {
    group,
    groundPickMesh: terrain.groundPickMesh,
    waterMeshes: terrain.waterMeshes,
    portals: [] as PortalVisual[],
    mobActors,
    mobHitTargets,
    lanternLights,
    lanternHalos,
    dispose,
  };
}
