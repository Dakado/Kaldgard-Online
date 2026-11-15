import * as THREE from 'three';
import {
  MOB_TEMPLATES,
  MobCombatEntity,
  MobKind,
  getMobSpawnsForZone,
} from '../world/combat';
import type { ZoneId } from '../world/fieldMaps';
import { NpcSpec } from '../world/pronteraLayout';
import { PronteraMaterials } from './materials';

export interface HeroRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  capePivot: THREE.Group;
  capeGeo: THREE.PlaneGeometry;
  capeBasePositions: Float32Array;
  headGroup: THREE.Group;
  backSwordGroup: THREE.Group;
  handSwordGroup: THREE.Group;
  slashArcMesh: THREE.Mesh;
  slashArcMat: THREE.MeshBasicMaterial;
  shadowDisc: THREE.Mesh;
}

export interface HeroAttackAnimState {
  timer: number;
  duration: number;
  comboIndex: number;
  drawHoldTimer?: number;
}

export interface MobActor extends MobCombatEntity {
  group: THREE.Group;
  bodyMesh: THREE.Object3D;
  shadowMesh: THREE.Mesh;
  hitTarget: THREE.Mesh;
  hpBarGroup: THREE.Group;
  hpFillMesh: THREE.Mesh;
  jellyMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  baseColor: number;
  baseScale: number;
  homeX: number;
  homeZ: number;
  angle: number;
  hopPhase: number;
  hopSpeed: number;
  hitFlashTimer: number;
  deathTimer: number;
  knockVx: number;
  knockVz: number;
  wolfLegs?: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  headGroup?: THREE.Group;
  tailGroup?: THREE.Group;
}

/**
 * Sculpts a high-polygon anatomical human head with integrated brow ridge,
 * orbital recesses, sculpted nose bridge & tip, cheekbones, and tapered jawline/chin
 * so characters never look like Lego/low-poly primitives.
 */
function createSculptedHeadGeo(radius = 0.128, jawTaper = 0.88): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, 34, 26);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / radius;
    const ny = v.y / radius;
    const nz = v.z / radius;

    // Cranium elongation & slight temporal narrow
    v.x *= 0.88;
    v.y *= 1.12;
    v.z *= 0.96;

    // Jaw taper & natural masculine/feminine chin projection
    if (ny < 0.05) {
      const lowerT = Math.min(1, (-ny + 0.05) / 1.05);
      v.x *= 1.0 - lowerT * (1.0 - jawTaper) * 0.42;
      if (nz > 0.1) {
        v.z += lowerT * 0.012 * nz;
        if (ny < -0.58) {
          // Subtle cleft/chin point
          v.z += (1.0 - Math.min(1, Math.abs(nx) * 2.5)) * 0.011;
          v.y -= 0.008;
        }
      }
    }

    // Cheekbone fullness
    if (nz > 0.25 && ny > -0.35 && ny < 0.05) {
      const cheek = Math.exp(-Math.pow((Math.abs(nx) - 0.46) / 0.22, 2)) *
        Math.exp(-Math.pow((ny + 0.14) / 0.20, 2));
      v.z += cheek * 0.010;
      v.x += Math.sign(nx) * cheek * 0.004;
    }

    // Brow ridge & subtle orbital recess
    if (nz > 0.42) {
      const brow = Math.exp(-Math.pow((ny - 0.25) / 0.13, 2)) * (1.0 - Math.min(1, Math.abs(nx) * 0.8));
      v.z += brow * 0.011;

      const eyeSocket = Math.exp(-Math.pow((Math.abs(nx) - 0.36) / 0.17, 2)) *
        Math.exp(-Math.pow((ny - 0.08) / 0.15, 2));
      v.z -= eyeSocket * 0.014;
    }

    // Integrated anatomical nose bridge & tip
    if (nz > 0.52 && Math.abs(nx) < 0.22 && ny > -0.28 && ny < 0.25) {
      const lateralFall = Math.exp(-Math.pow(nx / 0.105, 2));
      const vertT = (0.25 - ny) / 0.53; // 0 at bridge, 1 near tip
      const bridgeProfile = vertT < 0.72
        ? Math.sin((vertT / 0.72) * Math.PI * 0.5)
        : Math.max(0, 1.0 - (vertT - 0.72) / 0.28);
      v.z += lateralFall * bridgeProfile * 0.029;
    }

    // Subtle upper/lower lip ridge
    if (nz > 0.58 && Math.abs(nx) < 0.28 && ny > -0.52 && ny < -0.26) {
      const lipHoriz = Math.exp(-Math.pow(nx / 0.16, 2));
      const lipWave = Math.sin(((ny + 0.52) / 0.26) * Math.PI);
      v.z += lipHoriz * lipWave * 0.009;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * High-segment anatomical muscle-contoured limb segment via LatheGeometry.
 */
function createMuscleLimbGeo(
  topR: number,
  bellyR: number,
  botR: number,
  length: number,
  radialSegs = 22,
): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(botR * 0.85, 0),
    new THREE.Vector2(botR, length * 0.08),
    new THREE.Vector2(botR * 1.06, length * 0.24),
    new THREE.Vector2(bellyR, length * 0.56),
    new THREE.Vector2((bellyR + topR) * 0.52, length * 0.80),
    new THREE.Vector2(topR, length * 0.96),
    new THREE.Vector2(topR * 0.82, length),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  geo.translate(0, -length, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Contoured leather adventurer boot foot (rounded toe-box, arched instep, distinct heel).
 */
function createSculptedBootFootGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.062, 20, 14);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Elongate along Z (heel back to z=-0.09, toe to z=+0.17)
    v.z *= 2.15;
    v.x *= 0.94;
    v.y *= 0.72;
    // Flatten sole at bottom
    if (v.y < -0.022) v.y = -0.025;
    // Raise ankle instep at rear
    if (v.z < 0.0 && v.y > 0) v.y *= 1.35;
    // Taper toe width gently
    if (v.z > 0.05) {
      const t = (v.z - 0.05) / 0.11;
      v.x *= 1.0 - t * 0.24;
      v.y *= 1.0 - t * 0.25;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addSculptedHand(
  parent: THREE.Object3D,
  y: number,
  palmMat: THREE.Material,
  fingerMat: THREE.Material,
  knucklePlateMat?: THREE.Material,
  scale = 1.0,
): void {
  const hand = new THREE.Group();
  hand.position.set(0, y, 0.008);

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042 * scale, 14, 12), palmMat);
  palm.scale.set(0.95, 1.15, 0.62);
  hand.add(palm);

  // Articulated curled finger silhouette (4 fingers + opposable thumb)
  for (let f = 0; f < 4; f++) {
    const fx = (-0.022 + f * 0.0145) * scale;
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0085 * scale, 0.032 * scale, 4, 8),
      fingerMat,
    );
    finger.position.set(fx, -0.045 * scale, 0.012 * scale);
    finger.rotation.x = 0.28;
    hand.add(finger);
  }
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0095 * scale, 0.026 * scale, 4, 8),
    fingerMat,
  );
  thumb.position.set(-0.036 * scale, -0.018 * scale, 0.022 * scale);
  thumb.rotation.z = 0.55;
  thumb.rotation.x = 0.35;
  hand.add(thumb);

  if (knucklePlateMat) {
    const knuckle = new THREE.Mesh(
      new THREE.SphereGeometry(0.040 * scale, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      knucklePlateMat,
    );
    knuckle.scale.set(0.98, 0.55, 0.72);
    knuckle.rotation.x = Math.PI * 0.52;
    knuckle.position.set(0, -0.012 * scale, 0.018 * scale);
    hand.add(knuckle);
  }

  parent.add(hand);
}

function addRealisticEyesAndBrows(
  headGroup: THREE.Group,
  irisColor: number,
  browColor: number,
  scale = 1.0,
): void {
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xeae5dc, roughness: 0.32 });
  scleraMat.userData.pbrSkip = true;
  const irisMat = new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.22 });
  irisMat.userData.pbrSkip = true;
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0b0e14 });
  const browMat = new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.76 });
  browMat.userData.pbrSkip = true;

  for (const s of [-1, 1]) {
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.0165 * scale, 12, 10),
      scleraMat,
    );
    sclera.scale.set(1.22, 0.68, 0.45);
    sclera.position.set(s * 0.044 * scale, 0.012 * scale, 0.114 * scale);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.0096 * scale, 10, 8),
      irisMat,
    );
    iris.scale.set(1.0, 1.0, 0.48);
    iris.position.set(s * 0.044 * scale, 0.012 * scale, 0.120 * scale);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.0052 * scale, 8, 6),
      pupilMat,
    );
    pupil.scale.set(1.0, 1.0, 0.48);
    pupil.position.set(s * 0.044 * scale, 0.012 * scale, 0.1225 * scale);

    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0045 * scale, 0.030 * scale, 4, 8),
      browMat,
    );
    brow.rotation.z = Math.PI * 0.5 - s * 0.10;
    brow.position.set(s * 0.044 * scale, 0.032 * scale, 0.121 * scale);

    headGroup.add(sclera, iris, pupil, brow);
  }
}

function addSculptedBeard(
  headGroup: THREE.Group,
  hairMat: THREE.Material,
  fullness: 'stubble' | 'trimmed' | 'full',
  scale = 1.0,
): void {
  const r = fullness === 'full' ? 0.112 : fullness === 'trimmed' ? 0.104 : 0.098;
  const geo = new THREE.SphereGeometry(r * scale, 22, 16, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.56);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    x *= 0.88;
    z *= 0.94;
    if (z > 0.02 * scale && y < -0.02 * scale) {
      y -= fullness === 'full' ? 0.028 * scale : 0.010 * scale;
      z += fullness === 'full' ? 0.018 * scale : 0.006 * scale;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const beard = new THREE.Mesh(geo, hairMat);
  beard.position.set(0, -0.030 * scale, 0.016 * scale);
  beard.castShadow = true;
  headGroup.add(beard);
}

function buildGreatswordMesh(
  mats: PronteraMaterials,
  leatherMat: THREE.Material,
  bladeLength = 1.08,
): THREE.Group {
  const sword = new THREE.Group();

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.023, 0.30, 14),
    leatherMat,
  );
  grip.castShadow = true;

  const pommel = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.034, 1),
    mats.darkSteel,
  );
  pommel.scale.set(1.0, 1.35, 0.85);
  pommel.position.y = -0.175;

  const guardCenter = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.036, 0.044),
    mats.darkSteel,
  );
  guardCenter.position.y = 0.16;

  for (const s of [-1, 1]) {
    const quillon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.015, 0.155, 10),
      mats.darkSteel,
    );
    quillon.rotation.z = s * (Math.PI * 0.44);
    quillon.position.set(s * 0.09, 0.175, 0);
    sword.add(quillon);
  }

  // Sculpted diamond-section double-edged greatsword blade
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.044, bladeLength, 4),
    mats.steelArmor,
  );
  blade.rotation.y = Math.PI / 4;
  blade.scale.set(1.25, 1.0, 0.22);
  blade.position.y = 0.16 + bladeLength * 0.5;
  blade.castShadow = true;

  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, bladeLength * 0.78, 0.016),
    mats.darkSteel,
  );
  fuller.position.y = 0.16 + bladeLength * 0.44;

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.034, 0.17, 4),
    mats.steelArmor,
  );
  tip.rotation.y = Math.PI / 4;
  tip.scale.set(1.25, 1.0, 0.22);
  tip.position.y = 0.16 + bladeLength + 0.085;

  sword.add(grip, pommel, guardCenter, blade, fuller, tip);
  return sword;
}

export function buildHeroCharacter(mats: PronteraMaterials): HeroRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 32),
    mats.contactShadow,
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.03;
  root.add(shadowDisc);

  const linenSleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0x9e9a8f,
    roughness: 0.86,
    metalness: 0.02,
    sheen: 0.48,
    sheenRoughness: 0.64,
  });
  linenSleeveMat.userData.pbrKind = 'cloth';

  const trouserMat = new THREE.MeshStandardMaterial({
    color: 0x32261e,
    roughness: 0.88,
    metalness: 0.03,
  });
  trouserMat.userData.pbrKind = 'cloth';

  const darkLeatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x221a16,
    roughness: 0.52,
    metalness: 0.10,
    clearcoat: 0.18,
    clearcoatRoughness: 0.46,
  });
  darkLeatherMat.userData.pbrKind = 'leather';

  const collarCrimsonMat = new THREE.MeshStandardMaterial({
    color: 0x4b181b,
    roughness: 0.78,
    metalness: 0.04,
  });
  collarCrimsonMat.userData.pbrKind = 'cloth';

  const silverTrimMat = new THREE.MeshStandardMaterial({
    color: 0x959eaa,
    roughness: 0.34,
    metalness: 0.82,
  });
  silverTrimMat.userData.pbrKind = 'metal';

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9ad8e,
    roughness: 0.56,
    metalness: 0.02,
    sheen: 0.24,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xffb599),
  });
  skinMat.userData.pbrKind = 'skin';

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x261a13,
    roughness: 0.70,
    metalness: 0.06,
  });
  hairMat.userData.pbrKind = 'cloth';

  const thighGeo = createMuscleLimbGeo(0.098, 0.088, 0.072, 0.44, 22);
  const bootShaftGeo = createMuscleLimbGeo(0.082, 0.076, 0.062, 0.40, 22);
  const bootFootGeo = createSculptedBootFootGeo();

  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.125, 0.90, 0);

    const thigh = new THREE.Mesh(thighGeo, trouserMat);
    thigh.castShadow = true;
    leg.add(thigh);

    const kneeCop = new THREE.Mesh(
      new THREE.SphereGeometry(0.076, 18, 14),
      mats.darkSteel,
    );
    kneeCop.scale.set(0.95, 1.0, 1.08);
    kneeCop.position.set(0, -0.44, 0.012);
    kneeCop.castShadow = true;
    leg.add(kneeCop);

    const bootUpper = new THREE.Mesh(bootShaftGeo, darkLeatherMat);
    bootUpper.position.y = -0.44;
    bootUpper.castShadow = true;
    leg.add(bootUpper);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.082, 0.068, 20),
      darkLeatherMat,
    );
    cuff.position.y = -0.46;
    leg.add(cuff);

    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.011, 8, 20),
      silverTrimMat,
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.y = -0.50;
    leg.add(strap);

    const foot = new THREE.Mesh(bootFootGeo, darkLeatherMat);
    foot.position.set(0, -0.855, 0.042);
    foot.castShadow = true;
    leg.add(foot);

    return leg;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyGroup.add(leftLeg, rightLeg);

  // High-detail sculpted Brigandine Chest Cuirass with ribcage & clavicle anatomy
  const chestProfile = [
    new THREE.Vector2(0.0, 0.85),
    new THREE.Vector2(0.184, 0.85),
    new THREE.Vector2(0.172, 1.02),
    new THREE.Vector2(0.198, 1.14),
    new THREE.Vector2(0.222, 1.26),
    new THREE.Vector2(0.236, 1.38),
    new THREE.Vector2(0.146, 1.48),
    new THREE.Vector2(0.0, 1.48),
  ];
  const cuirassGeo = new THREE.LatheGeometry(chestProfile, 34);
  const cuirass = new THREE.Mesh(cuirassGeo, mats.quiltedLeather);
  cuirass.scale.set(1.08, 1.0, 0.82);
  cuirass.castShadow = true;
  bodyGroup.add(cuirass);

  const standCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.114, 0.138, 0.085, 24, 1, true),
    collarCrimsonMat,
  );
  standCollar.position.y = 1.49;
  bodyGroup.add(standCollar);

  // Cross-chest Baldric & Silver Lion Medallion
  const baldricCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.17, 1.43, 0.12),
    new THREE.Vector3(0.0, 1.23, 0.185),
    new THREE.Vector3(-0.19, 0.96, 0.13),
    new THREE.Vector3(-0.18, 0.94, -0.15),
    new THREE.Vector3(0.02, 1.18, -0.185),
    new THREE.Vector3(0.18, 1.42, -0.11),
  ]);
  const baldric = new THREE.Mesh(
    new THREE.TubeGeometry(baldricCurve, 32, 0.022, 10, true),
    darkLeatherMat,
  );
  baldric.scale.set(1.0, 1.0, 0.85);
  bodyGroup.add(baldric);

  const chestMedallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.024, 24),
    mats.steelArmor,
  );
  chestMedallion.rotation.x = Math.PI / 2;
  chestMedallion.position.set(0, 1.24, 0.184);
  bodyGroup.add(chestMedallion);

  const medallionRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.056, 0.0085, 10, 24),
    silverTrimMat,
  );
  medallionRing.position.set(0, 1.24, 0.197);
  bodyGroup.add(medallionRing);

  // Double Belts & Hip Chain
  const mainBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.184, 0.195, 0.075, 28),
    darkLeatherMat,
  );
  mainBelt.scale.set(1.08, 1.0, 0.84);
  mainBelt.position.y = 0.98;
  bodyGroup.add(mainBelt);

  const beltBuckle = new THREE.Mesh(
    new THREE.TorusGeometry(0.042, 0.011, 10, 18),
    mats.steelArmor,
  );
  beltBuckle.position.set(0.02, 0.98, 0.168);
  bodyGroup.add(beltBuckle);

  const subBelt = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.022, 10, 28),
    darkLeatherMat,
  );
  subBelt.scale.set(1.09, 0.86, 1.0);
  subBelt.rotation.x = Math.PI / 2 + 0.16;
  subBelt.rotation.y = -0.14;
  subBelt.position.y = 0.90;
  bodyGroup.add(subBelt);

  const chainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.175, 0.95, 0.08),
    new THREE.Vector3(0.215, 0.78, 0.02),
    new THREE.Vector3(0.185, 0.84, -0.12),
  ]);
  const hipChain = new THREE.Mesh(
    new THREE.TubeGeometry(chainCurve, 16, 0.008, 8, false),
    silverTrimMat,
  );
  bodyGroup.add(hipChain);

  // Split Obsidian Coat Skirt with natural cloth wave folds along hem
  const coatSkirtGeo = new THREE.CylinderGeometry(
    0.195,
    0.34,
    0.72,
    36,
    6,
    true,
    Math.PI * 0.22,
    Math.PI * 1.56,
  );
  const cPos = coatSkirtGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const px = cPos.getX(i);
    const py = cPos.getY(i);
    const pz = cPos.getZ(i);
    const ang = Math.atan2(pz, px);
    const hemFactor = Math.max(0, (0.36 - py) / 0.72);
    const fold = Math.sin(ang * 9.0) * 0.024 * hemFactor;
    const rad = Math.hypot(px, pz);
    if (rad > 0.05) {
      cPos.setX(i, px + (px / rad) * fold);
      cPos.setZ(i, pz + (pz / rad) * fold);
    }
  }
  coatSkirtGeo.computeVertexNormals();
  const coatSkirt = new THREE.Mesh(coatSkirtGeo, mats.darkCoat);
  coatSkirt.scale.set(1.08, 1.0, 0.88);
  coatSkirt.position.y = 0.60;
  coatSkirt.castShadow = true;
  bodyGroup.add(coatSkirt);

  const coatHemTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.335,
      0.343,
      0.032,
      36,
      1,
      true,
      Math.PI * 0.22,
      Math.PI * 1.56,
    ),
    silverTrimMat,
  );
  coatHemTrim.scale.set(1.08, 1.0, 0.88);
  coatHemTrim.position.y = 0.255;
  bodyGroup.add(coatHemTrim);

  // Layered Articulated Pauldron (Right) & Leather Shoulder Guard (Left)
  const rightPauldron = new THREE.Group();
  rightPauldron.position.set(0.245, 1.38, 0);
  rightPauldron.rotation.z = -0.36;

  for (let lame = 0; lame < 3; lame++) {
    const r = 0.125 - lame * 0.012;
    const plate = new THREE.Mesh(
      new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      mats.darkSteel,
    );
    plate.scale.set(1.06, 0.88, 1.12);
    plate.position.set(lame * 0.016, -lame * 0.048, 0);
    plate.castShadow = true;
    rightPauldron.add(plate);
  }
  const pauldronRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.118, 0.011, 10, 22),
    silverTrimMat,
  );
  pauldronRim.rotation.x = Math.PI / 2;
  pauldronRim.position.y = -0.01;
  rightPauldron.add(pauldronRim);
  bodyGroup.add(rightPauldron);

  const leftShoulderCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    darkLeatherMat,
  );
  leftShoulderCap.position.set(-0.235, 1.36, 0);
  leftShoulderCap.rotation.z = 0.36;
  leftShoulderCap.castShadow = true;
  bodyGroup.add(leftShoulderCap);

  // Articulated Arms with Anatomical Muscle Lathe + Gauntlets & Sculpted Fingers
  const upperArmGeo = createMuscleLimbGeo(0.068, 0.064, 0.054, 0.26, 20);
  const vambraceGeo = createMuscleLimbGeo(0.058, 0.055, 0.044, 0.24, 20);

  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.245, 1.34, 0);

    const sleeve = new THREE.Mesh(upperArmGeo, linenSleeveMat);
    sleeve.castShadow = true;
    arm.add(sleeve);

    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.064, 18, 14),
      mats.darkSteel,
    );
    elbow.scale.set(1.0, 1.0, 1.14);
    elbow.position.set(0, -0.265, -0.008);
    elbow.castShadow = true;
    arm.add(elbow);

    const vambrace = new THREE.Mesh(vambraceGeo, mats.darkSteel);
    vambrace.position.y = -0.27;
    vambrace.castShadow = true;
    arm.add(vambrace);

    addSculptedHand(arm, -0.53, darkLeatherMat, skinMat, mats.darkSteel, 1.02);
    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  bodyGroup.add(leftArm, rightArm);

  const capePivot = new THREE.Group();
  capePivot.position.set(0, 1.38, -0.16);
  const capeGeo = new THREE.PlaneGeometry(0.32, 0.32, 4, 4);
  const capeBasePositions = new Float32Array(capeGeo.attributes.position.array);
  bodyGroup.add(capePivot);

  // Two-Handed Greatsword
  const backSwordGroup = new THREE.Group();
  backSwordGroup.position.set(0.02, 1.05, -0.19);
  backSwordGroup.rotation.z = -0.48;
  backSwordGroup.rotation.x = 0.08;

  const backScabbard = new THREE.Mesh(
    new THREE.BoxGeometry(0.072, 1.06, 0.032),
    darkLeatherMat,
  );
  backScabbard.position.y = -0.16;
  const backChape = new THREE.Mesh(
    new THREE.ConeGeometry(0.036, 0.12, 4),
    silverTrimMat,
  );
  backChape.rotation.x = Math.PI;
  backChape.position.y = -0.75;
  const backSwordVisual = buildGreatswordMesh(mats, darkLeatherMat, 1.04);
  backSwordVisual.position.y = 0.22;
  backSwordGroup.add(backScabbard, backChape, backSwordVisual);
  bodyGroup.add(backSwordGroup);

  const handSwordGroup = buildGreatswordMesh(mats, darkLeatherMat, 1.06);
  handSwordGroup.position.set(0.0, -0.55, 0.04);
  handSwordGroup.rotation.x = Math.PI * 0.42;
  handSwordGroup.visible = false;
  rightArm.add(handSwordGroup);

  // Steel Slash Trail
  const slashCanvas = document.createElement('canvas');
  slashCanvas.width = 128;
  slashCanvas.height = 128;
  const sctx = slashCanvas.getContext('2d')!;
  const radGrad = sctx.createRadialGradient(64, 64, 28, 64, 64, 62);
  radGrad.addColorStop(0.0, 'rgba(255,255,255,0)');
  radGrad.addColorStop(0.58, 'rgba(210,232,255,0.18)');
  radGrad.addColorStop(0.85, 'rgba(235,245,255,0.92)');
  radGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
  sctx.fillStyle = radGrad;
  sctx.beginPath();
  sctx.arc(64, 64, 62, -Math.PI * 0.44, Math.PI * 0.44);
  sctx.arc(64, 64, 28, Math.PI * 0.44, -Math.PI * 0.44, true);
  sctx.closePath();
  sctx.fill();
  const slashTex = new THREE.CanvasTexture(slashCanvas);
  slashTex.colorSpace = THREE.SRGBColorSpace;

  const slashArcGeo = new THREE.PlaneGeometry(3.2, 3.2);
  slashArcGeo.rotateX(-Math.PI / 2);
  const slashArcMat = new THREE.MeshBasicMaterial({
    color: 0xd8ecff,
    map: slashTex,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const slashArcMesh = new THREE.Mesh(slashArcGeo, slashArcMat);
  slashArcMesh.position.set(0, 1.12, 0.30);
  slashArcMesh.visible = false;
  bodyGroup.add(slashArcMesh);

  // High-Detail Sculpted Male Hero Head (no cone nose or Lego ball jaw!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.66, 0.01);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.068, 0.15, 20),
    skinMat,
  );
  neck.position.y = -0.14;
  headGroup.add(neck);

  const heroCranium = new THREE.Mesh(createSculptedHeadGeo(0.130, 0.90), skinMat);
  heroCranium.castShadow = true;
  headGroup.add(heroCranium);

  addSculptedBeard(headGroup, hairMat, 'stubble', 1.0);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), skinMat);
    ear.scale.set(0.38, 1.15, 0.68);
    ear.position.set(s * 0.114, -0.008, -0.006);
    headGroup.add(ear);
  }

  addRealisticEyesAndBrows(headGroup, 0x3a4a5e, 0x1d140f, 1.0);

  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.136, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.64),
    hairMat,
  );
  hairTop.scale.set(0.92, 1.08, 1.0);
  hairTop.rotation.x = -0.20;
  hairTop.castShadow = true;
  headGroup.add(hairTop);

  const waveLocks: [number, number, number, number][] = [
    [-0.075, 0.085, 0.095, -0.25],
    [-0.015, 0.105, 0.105, 0.12],
    [0.065, 0.09, 0.098, 0.35],
    [-0.112, 0.045, 0.03, -0.55],
    [0.112, 0.045, 0.03, 0.55],
    [-0.07, 0.04, -0.095, -0.2],
    [0.07, 0.04, -0.095, 0.2],
  ];
  for (const [lx, ly, lz, tilt] of waveLocks) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(lx * 0.65, ly + 0.04, lz * 0.65),
      new THREE.Vector3(lx, ly, lz + 0.012),
      new THREE.Vector3(lx * 1.08, ly - 0.085, lz - 0.005),
    ]);
    const lock = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 10, 0.023, 8, false),
      hairMat,
    );
    lock.rotation.z = tilt * 0.12;
    lock.castShadow = true;
    headGroup.add(lock);
  }

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    capePivot,
    capeGeo,
    capeBasePositions,
    headGroup,
    backSwordGroup,
    handSwordGroup,
    slashArcMesh,
    slashArcMat,
    shadowDisc,
  };
}

export function animateHeroGait(
  rig: HeroRig,
  speed: number,
  walkPhase: number,
  elapsed: number,
  dt: number,
  attackState?: HeroAttackAnimState,
): void {
  const isMoving = speed > 0.25;
  const k = 1 - Math.exp(-14 * dt);

  const swordInHand =
    Boolean(attackState && attackState.timer > 0) ||
    Boolean(attackState && (attackState.drawHoldTimer ?? 0) > 0);
  rig.handSwordGroup.visible = swordInHand;
  rig.backSwordGroup.visible = !swordInHand;

  if (isMoving) {
    const swing = Math.sin(walkPhase) * 0.62;
    const bounce = Math.abs(Math.sin(walkPhase)) * 0.055;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftArm.rotation.x = -swing * 0.52;
    rig.rightArm.rotation.x = swordInHand ? -0.35 + swing * 0.22 : swing * 0.52;
    rig.rightArm.rotation.z = 0;
    rig.rightArm.rotation.y = 0;
    rig.bodyGroup.position.y = bounce;
    rig.bodyGroup.rotation.y += (0 - rig.bodyGroup.rotation.y) * k;
    rig.bodyGroup.rotation.z = Math.cos(walkPhase) * 0.02;
    rig.headGroup.rotation.y = Math.sin(walkPhase * 0.5) * 0.035;
  } else {
    rig.leftLeg.rotation.x += (0 - rig.leftLeg.rotation.x) * k;
    rig.rightLeg.rotation.x += (0 - rig.rightLeg.rotation.x) * k;
    rig.leftArm.rotation.x += ((swordInHand ? -0.22 : 0.04) - rig.leftArm.rotation.x) * k;
    rig.rightArm.rotation.x += ((swordInHand ? -0.34 : 0.04) - rig.rightArm.rotation.x) * k;
    rig.rightArm.rotation.z += ((swordInHand ? -0.14 : -0.06) - rig.rightArm.rotation.z) * k;
    rig.rightArm.rotation.y += (0 - rig.rightArm.rotation.y) * k;
    const breathe = Math.sin(elapsed * 2.0) * 0.012;
    rig.bodyGroup.position.y += (breathe - rig.bodyGroup.position.y) * k;
    rig.bodyGroup.rotation.y += (0 - rig.bodyGroup.rotation.y) * k;
    rig.bodyGroup.rotation.z += (0 - rig.bodyGroup.rotation.z) * k;
  }

  if (attackState && attackState.timer > 0) {
    const p = 1 - Math.max(0, Math.min(1, attackState.timer / attackState.duration));
    const combo = attackState.comboIndex % 3;

    if (combo === 0) {
      const sweep = Math.sin(p * Math.PI);
      rig.rightArm.rotation.x = -1.7 + p * 2.45;
      rig.rightArm.rotation.z = -0.82 + p * 1.45;
      rig.rightArm.rotation.y = 0.85 - p * 1.95;
      rig.bodyGroup.rotation.y = 0.52 - p * 1.1;
      rig.leftArm.rotation.x = -0.45;
      rig.slashArcMesh.visible = p > 0.14 && p < 0.86;
      rig.slashArcMesh.rotation.set(0.18, p * 2.3 - 1.15, -0.20);
      rig.slashArcMesh.scale.setScalar(1.0);
      rig.slashArcMat.color.setHex(0xd8ecff);
      rig.slashArcMat.opacity = sweep * 0.78;
    } else if (combo === 1) {
      const sweep = Math.sin(p * Math.PI);
      rig.rightArm.rotation.x = -1.35 + Math.sin(p * Math.PI) * 0.55;
      rig.rightArm.rotation.z = 0.85 - p * 1.75;
      rig.rightArm.rotation.y = -1.05 + p * 2.1;
      rig.bodyGroup.rotation.y = -0.52 + p * 1.1;
      rig.slashArcMesh.visible = p > 0.14 && p < 0.86;
      rig.slashArcMesh.rotation.set(-0.18, -p * 2.3 + 1.15, 0.24);
      rig.slashArcMesh.scale.setScalar(1.05);
      rig.slashArcMat.color.setHex(0xbde2ff);
      rig.slashArcMat.opacity = sweep * 0.78;
    } else {
      const hop = Math.sin(p * Math.PI) * 0.24;
      const sweep = Math.sin(p * Math.PI);
      rig.bodyGroup.position.y += hop;
      rig.rightArm.rotation.x = -2.35 + p * 3.05;
      rig.rightArm.rotation.z = -0.15;
      rig.rightArm.rotation.y = 0;
      rig.bodyGroup.rotation.x = -0.12 + p * 0.26;
      rig.slashArcMesh.visible = p > 0.18 && p < 0.88;
      rig.slashArcMesh.rotation.set(p * 1.7 - 0.55, 0, Math.PI * 0.5);
      rig.slashArcMesh.scale.setScalar(1.22);
      rig.slashArcMat.color.setHex(0xffdfa6);
      rig.slashArcMat.opacity = sweep * 0.86;
    }
  } else {
    rig.bodyGroup.rotation.x += (0 - rig.bodyGroup.rotation.x) * k;
    rig.slashArcMesh.visible = false;
    rig.slashArcMat.opacity = 0;
  }
}

export function buildNpcCharacter(spec: NpcSpec, mats: PronteraMaterials): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 28),
    mats.contactShadow,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);

  const tunicMat = new THREE.MeshPhysicalMaterial({
    color: spec.tunicColor,
    roughness: 0.74,
    metalness: 0.06,
    sheen: 0.48,
    sheenRoughness: 0.58,
  });
  tunicMat.userData.pbrKind = 'cloth';
  const creamMat = new THREE.MeshPhysicalMaterial({
    color: 0xdad3c4,
    roughness: 0.78,
    sheen: 0.42,
    sheenRoughness: 0.62,
  });
  creamMat.userData.pbrKind = 'cloth';
  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c1d15,
    roughness: 0.52,
    metalness: 0.08,
    clearcoat: 0.16,
  });
  leatherMat.userData.pbrKind = 'leather';
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcb193,
    roughness: 0.56,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xffb599),
  });
  skinMat.userData.pbrKind = 'skin';
  const hairMat = new THREE.MeshStandardMaterial({
    color: spec.hairColor,
    roughness: 0.70,
  });
  hairMat.userData.pbrKind = 'cloth';

  const isFemale = spec.hatKind === 'kafra' || spec.hatKind === 'cleric';

  // Sculpted Anatomical Legs & Contoured Leather Boots
  const npcThighGeo = createMuscleLimbGeo(0.084, 0.076, 0.062, 0.48, 20);
  const npcBootGeo = createMuscleLimbGeo(0.072, 0.066, 0.056, 0.36, 20);
  const npcFootGeo = createSculptedBootFootGeo();

  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(npcThighGeo, leatherMat);
    leg.position.set(s * 0.11, 0.86, 0);
    leg.castShadow = true;

    const boot = new THREE.Mesh(npcBootGeo, leatherMat);
    boot.position.set(s * 0.11, 0.40, 0);
    boot.castShadow = true;

    const bootCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.072, 0.055, 18),
      leatherMat,
    );
    bootCuff.position.set(s * 0.11, 0.40, 0);

    const foot = new THREE.Mesh(npcFootGeo, leatherMat);
    foot.position.set(s * 0.11, 0.025, 0.04);
    foot.castShadow = true;

    g.add(leg, boot, bootCuff, foot);
  }

  // Sculpted Contoured Medieval Garment / Coat with natural vertical cloth drape
  const coatProfile = isFemale
    ? [
        new THREE.Vector2(0.0, 0.28),
        new THREE.Vector2(0.32, 0.28),
        new THREE.Vector2(0.24, 0.66),
        new THREE.Vector2(0.155, 0.96),
        new THREE.Vector2(0.195, 1.24),
        new THREE.Vector2(0.135, 1.40),
        new THREE.Vector2(0.0, 1.40),
      ]
    : [
        new THREE.Vector2(0.0, 0.34),
        new THREE.Vector2(0.28, 0.34),
        new THREE.Vector2(0.22, 0.74),
        new THREE.Vector2(0.178, 0.96),
        new THREE.Vector2(0.225, 1.25),
        new THREE.Vector2(0.148, 1.41),
        new THREE.Vector2(0.0, 1.41),
      ];
  const coatGeo = new THREE.LatheGeometry(coatProfile, 32);
  const cPos = coatGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const px = cPos.getX(i);
    const py = cPos.getY(i);
    const pz = cPos.getZ(i);
    if (py < 0.85) {
      const ang = Math.atan2(pz, px);
      const t = (0.85 - py) / 0.57;
      const pleat = Math.sin(ang * 10) * 0.016 * t;
      const r = Math.hypot(px, pz);
      if (r > 0.05) {
        cPos.setX(i, px + (px / r) * pleat);
        cPos.setZ(i, pz + (pz / r) * pleat);
      }
    }
  }
  coatGeo.computeVertexNormals();

  const coat = new THREE.Mesh(
    coatGeo,
    spec.hatKind === 'knight' ? mats.quiltedLeather : tunicMat,
  );
  coat.scale.set(1.06, 1.0, 0.84);
  coat.castShadow = true;
  g.add(coat);

  // Leather belt & ornate steel/brass buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(isFemale ? 0.165 : 0.186, isFemale ? 0.175 : 0.196, 0.068, 26),
    leatherMat,
  );
  belt.scale.set(1.06, 1.0, 0.85);
  belt.position.y = 0.96;
  g.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.009, 8, 16),
    spec.hatKind === 'cleric' || spec.hatKind === 'merchant' ? mats.goldTrim : mats.steelArmor,
  );
  buckle.position.set(0, 0.96, isFemale ? 0.148 : 0.168);
  g.add(buckle);

  // Tailored Mantle Collar & Lapels
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.225, 0.125, 24),
    spec.hatKind === 'cleric' || spec.hatKind === 'kafra' ? creamMat : leatherMat,
  );
  collar.scale.set(1.06, 1.0, 0.86);
  collar.position.y = 1.36;
  g.add(collar);

  // High-Poly Muscle-Lathed Arms + Sculpted Articulated Hands
  const upperNpcGeo = createMuscleLimbGeo(0.060, 0.056, 0.048, 0.25, 18);
  const lowerNpcGeo = createMuscleLimbGeo(0.050, 0.048, 0.038, 0.23, 18);

  for (const s of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(s * (isFemale ? 0.205 : 0.232), 1.33, 0);
    armPivot.rotation.z = s * 0.12;

    const upper = new THREE.Mesh(upperNpcGeo, spec.hatKind === 'smith' ? creamMat : tunicMat);
    upper.castShadow = true;

    const forearm = new THREE.Mesh(
      lowerNpcGeo,
      spec.hatKind === 'knight' ? mats.darkSteel : leatherMat,
    );
    forearm.position.y = -0.24;
    forearm.rotation.x = -0.12;
    forearm.castShadow = true;

    addSculptedHand(forearm, -0.23, skinMat, skinMat, spec.hatKind === 'knight' ? mats.darkSteel : undefined, 0.92);

    armPivot.add(upper, forearm);
    g.add(armPivot);
  }

  // Sculpted High-Polygon NPC Head (y = 1.56)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0.01);
  g.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.060, 0.13, 18), skinMat);
  neck.position.y = -0.12;
  headGroup.add(neck);

  const head = new THREE.Mesh(
    createSculptedHeadGeo(0.124, isFemale ? 0.78 : 0.92),
    skinMat,
  );
  head.castShadow = true;
  headGroup.add(head);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), skinMat);
    ear.scale.set(0.38, 1.12, 0.65);
    ear.position.set(s * 0.110, -0.008, -0.006);
    headGroup.add(ear);
  }

  const irisHex = spec.hatKind === 'cleric' ? 0x3a6e7c : spec.hatKind === 'kafra' ? 0x456b8e : 0x33261d;
  addRealisticEyesAndBrows(headGroup, irisHex, spec.hairColor, 0.94);

  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.130, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.65),
    hairMat,
  );
  hairCrown.scale.set(0.92, 1.08, 1.0);
  hairCrown.rotation.x = -0.20;
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  // Side hair locks framing the face naturally
  for (const s of [-1, 1]) {
    const sideLockCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.09, 0.08, 0.03),
      new THREE.Vector3(s * 0.115, 0.01, 0.04),
      new THREE.Vector3(s * 0.105, isFemale ? -0.12 : -0.05, 0.01),
    ]);
    const sideLock = new THREE.Mesh(
      new THREE.TubeGeometry(sideLockCurve, 10, 0.019, 8, false),
      hairMat,
    );
    headGroup.add(sideLock);
  }

  // Distinct High-Detail Role Gear
  if (spec.hatKind === 'kafra') {
    const apronCurve = new THREE.CylinderGeometry(0.16, 0.29, 0.62, 18, 2, true, -Math.PI * 0.25, Math.PI * 0.5);
    const apron = new THREE.Mesh(apronCurve, creamMat);
    apron.position.set(0, 0.64, 0.01);
    const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), hairMat);
    hairBun.position.set(0, 0.045, -0.12);
    const circlet = new THREE.Mesh(
      new THREE.TorusGeometry(0.124, 0.014, 10, 22, Math.PI),
      creamMat,
    );
    circlet.position.set(0, 0.075, 0.025);
    const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.042), mats.carpetRoyal);
    ledger.position.set(0.24, 0.88, 0.16);
    ledger.rotation.x = -0.42;
    headGroup.add(hairBun, circlet);
    g.add(apron, ledger);
  } else if (spec.hatKind === 'knight') {
    const steelChest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.192, 0.34, 24),
      mats.darkSteel,
    );
    steelChest.scale.set(1.06, 1.0, 0.86);
    steelChest.position.y = 1.18;
    for (const s of [-1, 1]) {
      for (let lame = 0; lame < 2; lame++) {
        const pauldron = new THREE.Mesh(
          new THREE.SphereGeometry(0.115 - lame * 0.012, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
          mats.darkSteel,
        );
        pauldron.position.set(s * (0.23 + lame * 0.014), 1.33 - lame * 0.045, 0);
        pauldron.rotation.z = -s * 0.35;
        g.add(pauldron);
      }
    }
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      mats.darkSteel,
    );
    helm.position.y = 0.02;
    const plume = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.16, 0.04),
          new THREE.Vector3(0, 0.24, -0.04),
          new THREE.Vector3(0, 0.12, -0.16),
        ]),
        12,
        0.028,
        8,
        false,
      ),
      mats.carpetRoyal,
    );
    headGroup.add(helm, plume);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.025, 2.25, 12),
      mats.darkTimber,
    );
    pole.position.set(0.32, 1.12, 0.08);
    const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.34, 4), mats.steelArmor);
    spearHead.scale.set(1.1, 1.0, 0.45);
    spearHead.position.set(0.32, 2.34, 0.08);
    g.add(steelChest, pole, spearHead);
  } else if (spec.hatKind === 'cleric') {
    const stole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.024), mats.goldTrim);
    stole.position.set(0, 0.86, 0.168);
    const veil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.128, 0.165, 0.25, 22, 1, true, -Math.PI * 0.65, Math.PI * 1.3),
      creamMat,
    );
    veil.position.set(0, 0.02, -0.02);
    headGroup.add(veil);

    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.025, 1.85, 12),
      mats.oakWood,
    );
    staff.position.set(0.28, 0.92, 0.06);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.072, 2), mats.goldTrim);
    orb.position.set(0.28, 1.90, 0.06);
    g.add(stole, staff, orb);
  } else if (spec.hatKind === 'merchant') {
    addSculptedBeard(headGroup, hairMat, 'trimmed', 0.96);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.30, 0.026, 26),
      leatherMat,
    );
    brim.position.y = 0.092;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.122, 0.142, 0.13, 22),
      leatherMat,
    );
    crown.position.y = 0.162;
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.18, 6), mats.goldTrim);
    feather.position.set(0.13, 0.18, 0.02);
    feather.rotation.z = -0.45;
    headGroup.add(brim, crown, feather);
  } else if (spec.hatKind === 'smith') {
    addSculptedBeard(headGroup, hairMat, 'full', 0.98);
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.24, 0.72, 16, 1, true, -Math.PI * 0.3, Math.PI * 0.6),
      leatherMat,
    );
    apron.position.set(0, 0.68, 0.025);
    const hammerHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, 0.68, 12),
      mats.oakWood,
    );
    hammerHandle.position.set(0.28, 0.80, 0.12);
    hammerHandle.rotation.x = 0.55;
    const hammerHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.12, 0.12),
      mats.wroughtIron,
    );
    hammerHead.position.set(0.28, 1.00, 0.32);
    g.add(apron, hammerHandle, hammerHead);
  }

  return g;
}

/**
 * Bahenní sliz (mire_slime) — layered mossy swamp ooze with suspended marsh stones
 * and bioluminescent emerald core (zero Ragnarok Poring/apple stem shape).
 */
function buildMireSlimeMesh(color: number): {
  bodyMesh: THREE.Group;
  jellyMat: THREE.MeshPhysicalMaterial;
} {
  const bodyMesh = new THREE.Group();
  const jellyMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.88,
    envMapIntensity: 1.15,
  });
  jellyMat.userData.pbrKind = 'slime';

  // Organic multi-lobed marsh ooze mound
  const mireProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.54, 0.02),
    new THREE.Vector2(0.62, 0.16),
    new THREE.Vector2(0.55, 0.38),
    new THREE.Vector2(0.46, 0.62),
    new THREE.Vector2(0.28, 0.80),
    new THREE.Vector2(0.0, 0.88),
  ];
  const oozeGeo = new THREE.LatheGeometry(mireProfile, 24);
  const pos = oozeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ang = Math.atan2(pz, px);
    const ripple = Math.sin(ang * 5 + py * 4.0) * 0.045;
    pos.setX(i, px + Math.cos(ang) * ripple);
    pos.setZ(i, pz + Math.sin(ang) * ripple);
  }
  oozeGeo.computeVertexNormals();
  const shell = new THREE.Mesh(oozeGeo, jellyMat);
  shell.castShadow = true;
  bodyMesh.add(shell);

  // Inner glowing marsh nucleus & mossy stones suspended inside
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x8cff9e,
    transparent: true,
    opacity: 0.62,
  });
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), coreMat);
  core.position.set(0, 0.38, 0.04);
  bodyMesh.add(core);

  const mossMat = new THREE.MeshStandardMaterial({ color: 0x2a4526, roughness: 0.88 });
  mossMat.userData.pbrKind = 'foliage';
  for (const [rx, ry, rz, rs] of [
    [-0.22, 0.24, 0.18, 0.11],
    [0.24, 0.30, -0.16, 0.12],
    [0.05, 0.68, -0.12, 0.10],
  ]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), mossMat);
    rock.position.set(rx, ry, rz);
    bodyMesh.add(rock);
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8ff72 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), eyeMat);
    eye.scale.set(1.1, 0.75, 0.7);
    eye.position.set(side * 0.17, 0.46, 0.46);
    bodyMesh.add(eye);
  }

  return { bodyMesh, jellyMat };
}

/**
 * Žhnoucí brouk (ember_beetle) — armored chitinous scarab with glowing ember
 * dorsal seam, curved mandibles, and 6 articulated insect legs.
 */
function buildEmberBeetleMesh(color: number): {
  bodyMesh: THREE.Group;
  carapaceMat: THREE.MeshPhysicalMaterial;
} {
  const bodyMesh = new THREE.Group();
  const carapaceMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    metalness: 0.32,
    clearcoat: 0.82,
    clearcoatRoughness: 0.16,
  });
  carapaceMat.userData.pbrKind = 'metal';

  const darkChitinMat = new THREE.MeshStandardMaterial({
    color: 0x241812,
    roughness: 0.45,
    metalness: 0.25,
  });
  darkChitinMat.userData.pbrKind = 'metal';

  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff8a2b });

  // Domed armored elytra shell
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 16), carapaceMat);
  shell.scale.set(0.96, 0.68, 1.28);
  shell.position.set(0, 0.38, -0.05);
  shell.castShadow = true;
  bodyMesh.add(shell);

  // Glowing dorsal magma seam
  const seam = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.56, 6, 10), emberMat);
  seam.rotation.x = Math.PI / 2;
  seam.position.set(0, 0.64, -0.04);
  bodyMesh.add(seam);

  // Pronotum & head with pincer mandibles
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), darkChitinMat);
  head.scale.set(1.1, 0.78, 0.95);
  head.position.set(0, 0.36, 0.46);
  head.castShadow = true;
  bodyMesh.add(head);

  for (const s of [-1, 1]) {
    const mandible = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.26, 8), darkChitinMat);
    mandible.rotation.x = Math.PI * 0.48;
    mandible.rotation.z = s * 0.32;
    mandible.position.set(s * 0.13, 0.30, 0.68);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), emberMat);
    eye.position.set(s * 0.14, 0.42, 0.56);
    bodyMesh.add(mandible, eye);

    for (const lz of [-0.28, 0.02, 0.30]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.28, 4, 8), darkChitinMat);
      leg.position.set(s * 0.44, 0.20, lz);
      leg.rotation.z = s * 0.68;
      leg.castShadow = true;
      bodyMesh.add(leg);
    }
  }

  return { bodyMesh, carapaceMat };
}

/**
 * Trnový divočák (briar_boar) — muscular forest razorback boar with dark bristled
 * dorsal ridge, curved ivory tusks, and 4 articulated legs.
 */
function buildBriarBoarMesh(): {
  bodyMesh: THREE.Group;
  peltMat: THREE.MeshStandardMaterial;
  wolfLegs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  headGroup: THREE.Group;
} {
  const bodyMesh = new THREE.Group();
  const peltMat = new THREE.MeshStandardMaterial({
    color: 0x5a4334,
    roughness: 0.86,
    metalness: 0.02,
  });
  peltMat.userData.pbrKind = 'cloth';

  const bristleMat = new THREE.MeshStandardMaterial({
    color: 0x2b1e16,
    roughness: 0.90,
  });
  bristleMat.userData.pbrKind = 'cloth';

  const tuskMat = new THREE.MeshStandardMaterial({
    color: 0xede4d2,
    roughness: 0.32,
  });
  tuskMat.userData.pbrKind = 'stone';

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff6e2e });

  // Barrel-chested boar torso
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), peltMat);
  torso.scale.set(0.94, 0.96, 1.34);
  torso.position.set(0, 0.54, 0);
  torso.castShadow = true;
  bodyMesh.add(torso);

  // Dorsal briar spines along the back
  for (let i = 0; i < 5; i++) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 6), bristleMat);
    spine.position.set(0, 0.98 - i * 0.03, 0.28 - i * 0.16);
    spine.rotation.x = -0.28;
    bodyMesh.add(spine);
  }

  // Head, snout & curved ivory tusks
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0.56);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), peltMat);
  skull.scale.set(0.95, 0.92, 1.12);
  skull.castShadow = true;
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.26, 12), bristleMat);
  snout.rotation.x = Math.PI * 0.52;
  snout.position.set(0, -0.06, 0.24);
  headGroup.add(skull, snout);

  for (const s of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 8), tuskMat);
    tusk.position.set(s * 0.14, -0.02, 0.26);
    tusk.rotation.x = 0.38;
    tusk.rotation.z = -s * 0.28;
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), bristleMat);
    ear.position.set(s * 0.18, 0.20, -0.02);
    ear.rotation.z = -s * 0.45;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
    eye.position.set(s * 0.13, 0.06, 0.18);
    headGroup.add(tusk, ear, eye);
  }
  bodyMesh.add(headGroup);

  // 4 Sturdy Boar Legs
  const legGeo = createMuscleLimbGeo(0.085, 0.072, 0.055, 0.42, 12);
  const makeBoarLeg = (lx: number, ly: number, lz: number) => {
    const leg = new THREE.Group();
    leg.position.set(lx, ly, lz);
    const m = new THREE.Mesh(legGeo, bristleMat);
    m.castShadow = true;
    leg.add(m);
    bodyMesh.add(leg);
    return leg;
  };
  const fr = makeBoarLeg(0.20, 0.42, 0.34);
  const fl = makeBoarLeg(-0.20, 0.42, 0.34);
  const br = makeBoarLeg(0.19, 0.42, -0.34);
  const bl = makeBoarLeg(-0.19, 0.42, -0.34);

  return { bodyMesh, peltMat, wolfLegs: [fr, fl, br, bl], headGroup };
}

/**
 * Mrazivý blud (frost_wisp) — hovering glacial elemental core surrounded by
 * orbiting ice crystal shards.
 */
function buildFrostWispMesh(color: number): {
  bodyMesh: THREE.Group;
  crystalMat: THREE.MeshPhysicalMaterial;
  tailGroup: THREE.Group;
} {
  const bodyMesh = new THREE.Group();
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.14,
    metalness: 0.10,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.88,
  });
  crystalMat.userData.pbrKind = 'slime';

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), crystalMat);
  core.scale.set(0.88, 1.35, 0.88);
  core.position.set(0, 0.78, 0);
  core.castShadow = true;
  bodyMesh.add(core);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8ffff });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), eyeMat);
    eye.position.set(s * 0.12, 0.84, 0.31);
    bodyMesh.add(eye);
  }

  // Orbiting ice shard ring stored in tailGroup for continuous rotation
  const shardRing = new THREE.Group();
  shardRing.position.set(0, 0.74, 0);
  const shardGeo = new THREE.OctahedronGeometry(0.12, 0);
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI * 2) / 6;
    const shard = new THREE.Mesh(shardGeo, crystalMat);
    shard.scale.set(0.65, 1.75, 0.65);
    shard.position.set(Math.cos(ang) * 0.56, (i % 2 === 0 ? 1 : -1) * 0.08, Math.sin(ang) * 0.56);
    shard.rotation.z = 0.25;
    shardRing.add(shard);
  }
  bodyMesh.add(shardRing);

  return { bodyMesh, crystalMat, tailGroup: shardRing };
}

/**
 * Jedovatý plivník (venom_spitter) — spiny venomous marsh crawler with glowing
 * venom sacs, dorsal thorns, and predatory mandibles.
 */
function buildVenomSpitterMesh(color: number): {
  bodyMesh: THREE.Group;
  hideMat: THREE.MeshPhysicalMaterial;
} {
  const bodyMesh = new THREE.Group();
  const hideMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.34,
    metalness: 0.06,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
  hideMat.userData.pbrKind = 'slime';

  const sacMat = new THREE.MeshBasicMaterial({
    color: 0xb8ff3d,
    transparent: true,
    opacity: 0.82,
  });
  const thornMat = new THREE.MeshStandardMaterial({
    color: 0x38223d,
    roughness: 0.55,
  });
  thornMat.userData.pbrKind = 'leather';

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 16), hideMat);
  body.scale.set(1.05, 0.82, 1.25);
  body.position.set(0, 0.44, 0);
  body.castShadow = true;
  bodyMesh.add(body);

  // Pulsing lateral venom sacs & dorsal thorns
  for (const s of [-1, 1]) {
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), sacMat);
    sac.position.set(s * 0.36, 0.52, -0.06);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), sacMat);
    eye.position.set(s * 0.16, 0.56, 0.46);
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.20, 6), thornMat);
    fang.rotation.x = Math.PI * 0.58;
    fang.position.set(s * 0.12, 0.36, 0.56);
    bodyMesh.add(sac, eye, fang);
  }
  for (let i = 0; i < 4; i++) {
    const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 6), thornMat);
    thorn.position.set(0, 0.84 - i * 0.04, 0.18 - i * 0.16);
    thorn.rotation.x = -0.35;
    bodyMesh.add(thorn);
  }

  return { bodyMesh, hideMat };
}

/**
 * Timber Wolf (Vlk) with muscular Lathe torso, neck ruff, sculpted snout & fangs,
 * glowing amber eyes, bushy tail, and 4 articulated legs.
 */
function buildWolfMesh(): {
  bodyMesh: THREE.Group;
  peltMat: THREE.MeshStandardMaterial;
  wolfLegs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
} {
  const bodyMesh = new THREE.Group();
  const peltMat = new THREE.MeshStandardMaterial({
    color: 0x6b5a4d,
    roughness: 0.84,
    metalness: 0.03,
  });
  peltMat.userData.pbrKind = 'cloth';

  const ruffMat = new THREE.MeshStandardMaterial({
    color: 0x3b322c,
    roughness: 0.88,
  });
  ruffMat.userData.pbrKind = 'cloth';

  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xffb838 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.35 });
  noseMat.userData.pbrSkip = true;

  // Sculpted wolf ribcage + narrow flank
  const torsoProfile = [
    new THREE.Vector2(0.0, -0.58),
    new THREE.Vector2(0.20, -0.46),
    new THREE.Vector2(0.23, -0.10),
    new THREE.Vector2(0.27, 0.25),
    new THREE.Vector2(0.31, 0.48),
    new THREE.Vector2(0.21, 0.64),
    new THREE.Vector2(0.0, 0.68),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 22);
  torsoGeo.rotateX(Math.PI / 2);
  const torso = new THREE.Mesh(torsoGeo, peltMat);
  torso.scale.set(0.90, 1.06, 1.0);
  torso.position.set(0, 0.66, 0);
  torso.castShadow = true;
  bodyMesh.add(torso);

  // Dark shoulder ruff mane
  const ruff = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), ruffMat);
  ruff.scale.set(0.95, 1.05, 1.08);
  ruff.position.set(0, 0.72, 0.36);
  ruff.castShadow = true;
  bodyMesh.add(ruff);

  // Head & sculpted lupine muzzle
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.84, 0.62);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), peltMat);
  skull.scale.set(0.92, 0.90, 1.08);
  skull.castShadow = true;

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.125, 0.30, 12), peltMat);
  muzzle.rotation.x = Math.PI * 0.52;
  muzzle.position.set(0, -0.04, 0.24);
  muzzle.castShadow = true;

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), noseMat);
  nose.position.set(0, -0.02, 0.39);
  headGroup.add(skull, muzzle, nose);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.22, 6), ruffMat);
    ear.position.set(s * 0.12, 0.21, -0.02);
    ear.rotation.z = -s * 0.22;
    ear.rotation.x = 0.15;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), eyeGlowMat);
    eye.position.set(s * 0.088, 0.04, 0.19);
    headGroup.add(ear, eye);
  }
  bodyMesh.add(headGroup);

  // Bushy tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.68, -0.56);
  const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.44, 6, 10), ruffMat);
  tailMesh.rotation.x = -0.82;
  tailMesh.position.set(0, -0.14, -0.18);
  tailMesh.castShadow = true;
  tailGroup.add(tailMesh);
  bodyMesh.add(tailGroup);

  // 4 Articulated Lupine Legs
  const upperGeo = createMuscleLimbGeo(0.085, 0.072, 0.052, 0.34, 14);
  const lowerGeo = createMuscleLimbGeo(0.052, 0.046, 0.036, 0.30, 12);
  const makeWolfLeg = (lx: number, ly: number, lz: number) => {
    const leg = new THREE.Group();
    leg.position.set(lx, ly, lz);
    const up = new THREE.Mesh(upperGeo, peltMat);
    up.castShadow = true;
    const lo = new THREE.Mesh(lowerGeo, ruffMat);
    lo.position.y = -0.32;
    lo.castShadow = true;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), ruffMat);
    paw.scale.set(0.9, 0.55, 1.35);
    paw.position.set(0, -0.60, 0.03);
    leg.add(up, lo, paw);
    bodyMesh.add(leg);
    return leg;
  };

  const fr = makeWolfLeg(0.18, 0.62, 0.36);
  const fl = makeWolfLeg(-0.18, 0.62, 0.36);
  const br = makeWolfLeg(0.17, 0.62, -0.38);
  const bl = makeWolfLeg(-0.17, 0.62, -0.38);

  return { bodyMesh, peltMat, wolfLegs: [fr, fl, br, bl], headGroup, tailGroup };
}

/**
 * Forest Goblin (Skřet) with hunched green-skinned torso, tattered leather armor,
 * pointed ears, glowing yellow eyes, and iron cleaver + spiked wooden shield.
 */
function buildGoblinMesh(mats: PronteraMaterials): {
  bodyMesh: THREE.Group;
  skinMat: THREE.MeshStandardMaterial;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
} {
  const bodyMesh = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0x557544,
    roughness: 0.68,
    metalness: 0.04,
  });
  skinMat.userData.pbrKind = 'skin';

  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b271b,
    roughness: 0.62,
    clearcoat: 0.10,
  });
  leatherMat.userData.pbrKind = 'leather';

  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd242 });

  // Squat muscular goblin legs
  const legGeo = createMuscleLimbGeo(0.075, 0.068, 0.052, 0.44, 14);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, skinMat);
    leg.position.set(s * 0.13, 0.46, 0);
    leg.castShadow = true;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), leatherMat);
    foot.scale.set(1.0, 0.62, 1.45);
    foot.position.set(s * 0.13, 0.03, 0.04);
    bodyMesh.add(leg, foot);
  }

  // Hunched armored torso + tattered belt & skirt
  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.36),
        new THREE.Vector2(0.22, 0.36),
        new THREE.Vector2(0.19, 0.56),
        new THREE.Vector2(0.24, 0.82),
        new THREE.Vector2(0.16, 0.98),
        new THREE.Vector2(0.0, 0.98),
      ],
      20,
    ),
    leatherMat,
  );
  torso.scale.set(1.12, 1.0, 0.88);
  torso.rotation.x = 0.18;
  torso.castShadow = true;
  bodyMesh.add(torso);

  // Snarling Goblin Head with long pointed ears & hooked nose
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.12, 0.14);
  const cranium = new THREE.Mesh(createSculptedHeadGeo(0.16, 0.82), skinMat);
  cranium.scale.set(1.06, 0.94, 1.0);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const hookedNose = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.11, 8), skinMat);
  hookedNose.rotation.x = Math.PI * 0.56;
  hookedNose.position.set(0, -0.015, 0.175);
  headGroup.add(hookedNose);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.24, 6), skinMat);
    ear.rotation.z = -s * 1.15;
    ear.rotation.y = -s * 0.32;
    ear.position.set(s * 0.22, 0.02, -0.01);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), eyeGlowMat);
    eye.position.set(s * 0.056, 0.02, 0.145);
    headGroup.add(ear, eye);
  }
  bodyMesh.add(headGroup);

  // Arms + Iron Cleaver + Wooden Shield
  const armGeo = createMuscleLimbGeo(0.062, 0.056, 0.044, 0.38, 14);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 0.92, 0.08);
  const lMesh = new THREE.Mesh(armGeo, skinMat);
  lMesh.castShadow = true;
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 12), mats.oakWood);
  shield.rotation.z = Math.PI / 2;
  shield.position.set(-0.08, -0.26, 0.06);
  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mats.wroughtIron);
  shieldBoss.position.set(-0.11, -0.26, 0.06);
  leftArm.add(lMesh, shield, shieldBoss);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 0.92, 0.08);
  const rMesh = new THREE.Mesh(armGeo, skinMat);
  rMesh.castShadow = true;
  const cleaverHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.24, 8), mats.oakWood);
  cleaverHandle.rotation.x = Math.PI / 2;
  cleaverHandle.position.set(0, -0.36, 0.08);
  const cleaverBlade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.32), mats.darkSteel);
  cleaverBlade.position.set(0, -0.34, 0.28);
  rightArm.add(rMesh, cleaverHandle, cleaverBlade);

  bodyMesh.add(leftArm, rightArm);

  return { bodyMesh, skinMat, leftArm, rightArm };
}

/**
 * Ancient Forest Tree Ent (Stromový ent) with twisted gnarled trunk torso,
 * mossy shoulder branches, leafy spring foliage crown, glowing spirit eyes,
 * and massive wooden bough arms.
 */
function buildTreeEntMesh(mats: PronteraMaterials): {
  bodyMesh: THREE.Group;
  barkMat: THREE.MeshStandardMaterial;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
} {
  const bodyMesh = new THREE.Group();
  const barkMat = mats.trunkMat.clone();
  barkMat.color.setHex(0xdec098);
  barkMat.userData.pbrKind = 'wood';

  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0x8eff7a });

  // Two gnarled root legs
  const rootGeo = createMuscleLimbGeo(0.17, 0.15, 0.22, 0.78, 16);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(rootGeo, barkMat);
    leg.position.set(s * 0.24, 0.78, 0);
    leg.castShadow = true;
    bodyMesh.add(leg);
  }

  // Twisted bark torso + hollow brow face
  const trunkProfile = [
    new THREE.Vector2(0.0, 0.65),
    new THREE.Vector2(0.34, 0.72),
    new THREE.Vector2(0.28, 1.15),
    new THREE.Vector2(0.42, 1.62),
    new THREE.Vector2(0.36, 1.98),
    new THREE.Vector2(0.24, 2.25),
    new THREE.Vector2(0.0, 2.35),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkProfile, 20);
  const tPos = trunkGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const px = tPos.getX(i);
    const py = tPos.getY(i);
    const pz = tPos.getZ(i);
    const ang = Math.atan2(pz, px) + py * 1.1;
    const ridge = Math.sin(ang * 6) * 0.045;
    tPos.setX(i, px + Math.cos(ang) * ridge);
    tPos.setZ(i, pz + Math.sin(ang) * ridge);
  }
  trunkGeo.computeVertexNormals();
  const torso = new THREE.Mesh(trunkGeo, barkMat);
  torso.castShadow = true;
  bodyMesh.add(torso);

  // Carved wooden brow ridge & bark nose + glowing emerald spirit eyes
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.14), barkMat);
  brow.position.set(0, 1.72, 0.36);
  brow.rotation.x = 0.18;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 6), barkMat);
  nose.position.set(0, 1.56, 0.43);
  nose.rotation.x = 0.35;
  bodyMesh.add(brow, nose);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 8), eyeGlowMat);
    eye.position.set(s * 0.11, 1.63, 0.40);
    bodyMesh.add(eye);
  }

  // Layered botanical oak foliage crown atop shoulders & head
  const addEntFoliageTuft = (parent: THREE.Object3D, fx: number, fy: number, fz: number, size: number) => {
    const tuft = new THREE.Group();
    tuft.position.set(fx, fy, fz);
    const cardGeo = new THREE.PlaneGeometry(size, size);
    for (let k = 0; k < 3; k++) {
      const card = new THREE.Mesh(cardGeo, mats.foliageOakMat);
      card.rotation.set(0.25 * (k - 1), (k * Math.PI) / 3, 0.15 * (k === 1 ? -1 : 1));
      card.castShadow = true;
      tuft.add(card);
    }
    parent.add(tuft);
  };

  addEntFoliageTuft(bodyMesh, 0, 2.38, 0, 1.35);
  addEntFoliageTuft(bodyMesh, -0.44, 2.06, 0.12, 0.95);
  addEntFoliageTuft(bodyMesh, 0.44, 2.08, -0.10, 0.95);
  addEntFoliageTuft(bodyMesh, 0, 2.12, -0.32, 0.88);

  // Heavy Bough Arms with leafy twigs
  const branchGeo = createMuscleLimbGeo(0.13, 0.11, 0.085, 0.96, 14);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.44, 1.72, 0.02);
  const lb = new THREE.Mesh(branchGeo, barkMat);
  lb.rotation.z = 0.14;
  lb.castShadow = true;
  leftArm.add(lb);
  addEntFoliageTuft(leftArm, -0.14, -0.86, 0.04, 0.62);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.44, 1.72, 0.02);
  const rb = new THREE.Mesh(branchGeo, barkMat);
  rb.rotation.z = -0.14;
  rb.castShadow = true;
  rightArm.add(rb);
  addEntFoliageTuft(rightArm, 0.14, -0.86, 0.04, 0.62);

  bodyMesh.add(leftArm, rightArm);
  return { bodyMesh, barkMat, leftArm, rightArm };
}

export function buildFieldMobs(
  mats: PronteraMaterials,
  zoneId: ZoneId = 'prontera',
): {
  group: THREE.Group;
  actors: MobActor[];
  hitTargets: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const actors: MobActor[] = [];
  const hitTargets: THREE.Mesh[] = [];

  const shadowGeo = new THREE.CircleGeometry(0.62, 20);
  const hitSphereGeo = new THREE.SphereGeometry(1.05, 10, 8);
  const hitSphereMat = new THREE.MeshBasicMaterial({ visible: false });

  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x121620, side: THREE.DoubleSide });
  const hpFillGeo = new THREE.PlaneGeometry(1.06, 0.11);
  hpFillGeo.translate(0.53, 0, 0);

  const spawns = getMobSpawnsForZone(zoneId);

  spawns.forEach((spawn, idx) => {
    const tpl = MOB_TEMPLATES[spawn.kind];
    const mobGroup = new THREE.Group();
    mobGroup.position.set(spawn.x, 0, spawn.z);

    let bodyMesh: THREE.Group;
    let jellyMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
    let wolfLegs: MobActor['wolfLegs'];
    let leftArm: THREE.Group | undefined;
    let rightArm: THREE.Group | undefined;
    let headGroup: THREE.Group | undefined;
    let tailGroup: THREE.Group | undefined;

    if (spawn.kind === 'briar_boar') {
      const built = buildBriarBoarMesh();
      bodyMesh = built.bodyMesh;
      jellyMat = built.peltMat;
      wolfLegs = built.wolfLegs;
      headGroup = built.headGroup;
    } else if (spawn.kind === 'ember_beetle') {
      const built = buildEmberBeetleMesh(tpl.color);
      bodyMesh = built.bodyMesh;
      jellyMat = built.carapaceMat;
    } else if (spawn.kind === 'frost_wisp') {
      const built = buildFrostWispMesh(tpl.color);
      bodyMesh = built.bodyMesh;
      jellyMat = built.crystalMat;
      tailGroup = built.tailGroup;
    } else if (spawn.kind === 'venom_spitter') {
      const built = buildVenomSpitterMesh(tpl.color);
      bodyMesh = built.bodyMesh;
      jellyMat = built.hideMat;
    } else if (spawn.kind === 'wolf') {
      const built = buildWolfMesh();
      bodyMesh = built.bodyMesh;
      jellyMat = built.peltMat;
      wolfLegs = built.wolfLegs;
      headGroup = built.headGroup;
      tailGroup = built.tailGroup;
    } else if (spawn.kind === 'goblin') {
      const built = buildGoblinMesh(mats);
      bodyMesh = built.bodyMesh;
      jellyMat = built.skinMat;
      leftArm = built.leftArm;
      rightArm = built.rightArm;
    } else if (spawn.kind === 'ent') {
      const built = buildTreeEntMesh(mats);
      bodyMesh = built.bodyMesh;
      jellyMat = built.barkMat;
      leftArm = built.leftArm;
      rightArm = built.rightArm;
    } else {
      const built = buildMireSlimeMesh(tpl.color);
      bodyMesh = built.bodyMesh;
      jellyMat = built.jellyMat;
    }
    bodyMesh.scale.setScalar(tpl.scale);

    const shadowMesh = new THREE.Mesh(shadowGeo, mats.contactShadow);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.025;
    shadowMesh.scale.setScalar(
      tpl.scale * (spawn.kind === 'ent' ? 1.45 : spawn.kind === 'wolf' || spawn.kind === 'briar_boar' ? 1.25 : 1.0),
    );

    const hitTarget = new THREE.Mesh(hitSphereGeo, hitSphereMat);
    const hitScale =
      spawn.kind === 'ent'
        ? 1.55
        : spawn.kind === 'wolf' || spawn.kind === 'goblin' || spawn.kind === 'briar_boar'
          ? 1.2
          : 1.0;
    hitTarget.scale.setScalar(hitScale);
    hitTarget.position.set(0, 0.72 * hitScale, 0);
    hitTarget.userData = { mobId: spawn.id };
    hitTargets.push(hitTarget);

    const hpY =
      spawn.kind === 'ent'
        ? 3.15
        : spawn.kind === 'goblin'
          ? 1.95
          : spawn.kind === 'wolf' || spawn.kind === 'briar_boar'
            ? 1.65
            : 1.48 * tpl.scale;

    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, hpY, 0);
    hpBarGroup.visible = false;

    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.16), hpBgMat);
    const hpFillMat = new THREE.MeshBasicMaterial({
      color: 0xe64545,
      side: THREE.DoubleSide,
    });
    const hpFillMesh = new THREE.Mesh(hpFillGeo, hpFillMat);
    hpFillMesh.position.set(-0.53, 0, 0.005);
    hpBarGroup.add(hpBg, hpFillMesh);

    mobGroup.add(shadowMesh, bodyMesh, hitTarget, hpBarGroup);
    group.add(mobGroup);

    actors.push({
      id: spawn.id,
      kind: spawn.kind,
      name: tpl.name,
      level: tpl.level,
      x: spawn.x,
      z: spawn.z,
      hp: tpl.maxHp,
      maxHp: tpl.maxHp,
      alive: true,
      respawnTimer: 0,
      zenyReward: tpl.zenyReward,
      expReward: tpl.expReward,
      group: mobGroup,
      bodyMesh,
      shadowMesh,
      hitTarget,
      hpBarGroup,
      hpFillMesh,
      jellyMat,
      baseColor: tpl.color,
      baseScale: tpl.scale,
      homeX: spawn.x,
      homeZ: spawn.z,
      angle: idx * 1.15,
      hopPhase: idx * 0.85,
      hopSpeed: tpl.hopSpeed + (idx % 3) * 0.25,
      hitFlashTimer: 0,
      deathTimer: 0,
      knockVx: 0,
      knockVz: 0,
      wolfLegs,
      leftArm,
      rightArm,
      headGroup,
      tailGroup,
    });
  });

  return { group, actors, hitTargets };
}
