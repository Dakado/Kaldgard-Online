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
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightAnkle: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  coatSkirt: THREE.Mesh;
  capePivot: THREE.Group;
  capeGeo: THREE.PlaneGeometry;
  capeBasePositions: Float32Array;
  headGroup: THREE.Group;
  backSwordGroup: THREE.Group;
  handSwordGroup: THREE.Group;
  /** Aktualne nasazena zbran ve slotu ruky (vymenitelna pres setHeroWeapon). */
  weaponId: string;
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
  bladeLength = 1.16,
): THREE.Group {
  const sword = new THREE.Group();

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.020, 0.29, 12),
    leatherMat,
  );
  grip.castShadow = true;

  const pommel = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.030, 1),
    mats.darkSteel,
  );
  pommel.scale.set(0.95, 1.45, 0.75);
  pommel.position.y = -0.165;

  const guardCenter = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, 0.034, 0.042),
    mats.darkSteel,
  );
  guardCenter.position.y = 0.155;

  // Ornate barbed gothic crossguard quillions
  for (const s of [-1, 1]) {
    const quillon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.014, 0.165, 8),
      mats.darkSteel,
    );
    quillon.rotation.z = s * (Math.PI * 0.42);
    quillon.position.set(s * 0.092, 0.175, 0);
    sword.add(quillon);

    const spur = new THREE.Mesh(
      new THREE.ConeGeometry(0.011, 0.048, 4),
      mats.darkSteel,
    );
    spur.rotation.z = -s * 0.52;
    spur.position.set(s * 0.062, 0.215, 0);
    sword.add(spur);
  }

  // Slender dark-forged gothic greatsword blade (zero GPU bloom glare)
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.036, bladeLength, 4),
    mats.forgedBlade,
  );
  blade.rotation.y = Math.PI / 4;
  blade.scale.set(1.22, 1.0, 0.20);
  blade.position.y = 0.155 + bladeLength * 0.5;
  blade.castShadow = true;

  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, bladeLength * 0.78, 0.014),
    mats.darkSteel,
  );
  fuller.position.y = 0.155 + bladeLength * 0.44;

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.026, 0.18, 4),
    mats.forgedBlade,
  );
  tip.rotation.y = Math.PI / 4;
  tip.scale.set(1.22, 1.0, 0.20);
  tip.position.y = 0.155 + bladeLength + 0.09;

  sword.add(grip, pommel, guardCenter, blade, fuller, tip);
  return sword;
}

export type HeroWeaponId = 'greatsword' | 'arming';
export const HERO_WEAPON_IDS: HeroWeaponId[] = ['greatsword', 'arming'];

/** Vyska nasazeni zbrane v zadech (pover rotated) aby jilec koukal pres rameno. */
const HERO_WEAPON_BACK_Y: Record<HeroWeaponId, number> = {
  greatsword: 0.6,
  arming: 0.55,
};

const heroWeaponMats = new WeakMap<HeroRig, PronteraMaterials>();

/**
 * Postavi drzenou zbran jako samostatny objekt (pocetak = stred rukoveti,
 * cepel +Y). Stejnou instanci lze pridat do kotvy v ruce GLB hrdiny.
 */
export function buildHeroWeaponMesh(id: HeroWeaponId, mats: PronteraMaterials): THREE.Group {
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x2b1e16,
    roughness: 0.6,
    metalness: 0.08,
  });
  return id === 'arming'
    ? buildArmingSwordMesh(mats, gripMat)
    : buildGreatswordMesh(mats, gripMat, 1.16);
}

/**
 * Jednorucni rytirsky mec (arming sword) - kratsi cepele, kulova hlavice.
 * Smlouva slotu: pocatek = stred rukoveti, cepel +Y, jako u buildGreatswordMesh.
 */
function buildArmingSwordMesh(
  mats: PronteraMaterials,
  leatherMat: THREE.Material,
  bladeLength = 0.78,
): THREE.Group {
  const sword = new THREE.Group();

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.2, 10),
    leatherMat,
  );
  grip.castShadow = true;

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 12, 10),
    mats.darkSteel,
  );
  pommel.scale.set(1.0, 0.8, 1.0);
  pommel.position.y = -0.115;

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.026, 0.034),
    mats.darkSteel,
  );
  guard.position.y = 0.11;
  guard.castShadow = true;

  for (const s of [-1, 1]) {
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 6),
      mats.darkSteel,
    );
    finial.position.set(s * 0.11, 0.11, 0);
    sword.add(finial);
  }

  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, bladeLength, 4),
    mats.forgedBlade,
  );
  blade.rotation.y = Math.PI / 4;
  blade.scale.set(1.1, 1.0, 0.22);
  blade.position.y = 0.11 + bladeLength * 0.5;
  blade.castShadow = true;

  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, bladeLength * 0.7, 0.012),
    mats.darkSteel,
  );
  fuller.position.y = 0.11 + bladeLength * 0.4;

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.021, 0.14, 4),
    mats.forgedBlade,
  );
  tip.rotation.y = Math.PI / 4;
  tip.scale.set(1.1, 1.0, 0.22);
  tip.position.y = 0.11 + bladeLength + 0.07;

  sword.add(grip, pommel, guard, blade, fuller, tip);
  return sword;
}

/**
 * Vymeni zbran v ruce i na zadech. Zbran je samostatny objekt v kotve ruky,
 * takze animace ruky ji nese s sebou a jde nahradit jakoukoliv jinou
 * (externi GLB s pocatkem v rukoveti a cepeli +Y staci pridat do kotvy).
 */
export function setHeroWeapon(rig: HeroRig, id: HeroWeaponId): void {
  const mats = heroWeaponMats.get(rig);
  if (!mats) return;
  while (rig.handSwordGroup.children.length > 0) {
    rig.handSwordGroup.remove(rig.handSwordGroup.children[0]);
  }
  while (rig.backSwordGroup.children.length > 2) {
    rig.backSwordGroup.remove(rig.backSwordGroup.children[2]);
  }
  rig.handSwordGroup.add(buildHeroWeaponMesh(id, mats));
  const backWeapon = buildHeroWeaponMesh(id, mats);
  backWeapon.rotation.z = Math.PI;
  backWeapon.position.y = HERO_WEAPON_BACK_Y[id];
  rig.backSwordGroup.add(backWeapon);
  rig.weaponId = id;
}

export function cycleHeroWeapon(rig: HeroRig): HeroWeaponId {
  const idx = HERO_WEAPON_IDS.indexOf(rig.weaponId as HeroWeaponId);
  const next = HERO_WEAPON_IDS[(idx + 1) % HERO_WEAPON_IDS.length];
  setHeroWeapon(rig, next);
  return next;
}

/**
 * Sculpts a dark-fantasy V-chevron fluted gothic steel breastplate with
 * sharp central sternum ridge, muscular chest bevels, and narrow athletic waist.
 */
function createGothicCuirassGeo(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.195, 0.152, 0.58, 30, 14, false);
  geo.translate(0, 0.29, 0);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = Math.max(0, Math.min(1, v.y / 0.58)); // 0=waist, 1=collar
    const angle = Math.atan2(v.x, v.z);
    const frontFace = Math.max(0, Math.cos(angle));
    const sideAmt = Math.abs(Math.sin(angle));

    // Heroic V-taper: trim waist (t=0..0.25), broad chest & upper ribcage (t=0.55..0.85), tapered collarbone
    const widthMul =
      t < 0.28
        ? 0.92 + t * 0.25
        : t < 0.82
          ? 0.99 + ((t - 0.28) / 0.54) * 0.36
          : 1.35 - ((t - 0.82) / 0.18) * 0.38;
    const depthMul =
      t < 0.25
        ? 0.72
        : t < 0.78
          ? 0.72 + ((t - 0.25) / 0.53) * 0.26
          : 0.98 - ((t - 0.78) / 0.22) * 0.26;

    v.x *= widthMul;
    v.z *= depthMul;

    // Prominent central sternum V-keel protruding forward on chest
    if (v.z > 0.02) {
      const centerLine = Math.exp(-Math.pow(v.x / 0.075, 2));
      const chestPeak = Math.sin(Math.min(1, Math.max(0, (t - 0.08) / 0.82)) * Math.PI);
      v.z += centerLine * chestPeak * 0.052;
      // Subtle stepped V-chevron flutes descending down front chest
      const chevronWave = Math.sin((t * 4.5 - Math.abs(v.x) * 6.5) * Math.PI * 2);
      if (t > 0.22 && t < 0.88 && frontFace > 0.45) {
        v.z += chevronWave * 0.0065 * frontFace;
      }
    }

    // Subtle back spine contour & scapular bevel
    if (v.z < -0.02) {
      const spineDip = Math.exp(-Math.pow(v.x / 0.045, 2));
      v.z += spineDip * 0.015;
      if (sideAmt > 0.4 && t > 0.45) {
        v.z -= 0.012 * Math.sin(((t - 0.45) / 0.55) * Math.PI);
      }
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a jagged tattered front chainmail/cloth tabard apron with irregular frayed bottom strips.
 */
function createTatteredApronGeo(width = 0.20, height = 0.54): THREE.BufferGeometry {
  const segX = 12;
  const segY = 10;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  geo.translate(0, -height * 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const drop = Math.max(0, Math.min(1, -y / height));
    const u = x / (width * 0.5); // -1..1
    // Taper gently inward near top belt and flare subtly below, with sawtooth tattered bottom tips
    const wMod = (0.76 + drop * 0.34) * x;
    const shred =
      drop > 0.72
        ? -Math.abs(Math.sin(u * Math.PI * 3.5)) * 0.085 * ((drop - 0.72) / 0.28)
        : 0;
    const drapeZ = 0.015 * Math.cos(u * Math.PI * 2.0) * drop - drop * drop * 0.025;
    pos.setXYZ(i, wMod, y + shred, drapeZ);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpts a tapered, slightly curved ribbon-wedge hair strand with a sharp natural tip
 * and subtle root-to-tip vertex color gradient (darker slate roots into silver-ash ends).
 */
function createTaperedHairLockGeo(
  length: number,
  baseWidth: number,
  thickness: number,
  archOut: number,
  flareSide: number,
  curlBack: number,
): THREE.BufferGeometry {
  const segX = 4;
  const segY = 8;
  const geo = new THREE.BoxGeometry(baseWidth, length, thickness, segX, segY, 1);
  geo.translate(0, -length * 0.5, 0);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rootC = new THREE.Color(0xb9bec8);
  const midC = new THREE.Color(0xdde1e8);
  const tipC = new THREE.Color(0xf2f4f8);
  const tmpC = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = Math.max(0, Math.min(1, -y / length)); // 0=root, 1=tip
    // Smooth taper to pointed lock tip + slight convex blade profile across width
    const widthProfile = (1 - Math.pow(t, 1.55) * 0.88) * (1 + Math.sin(t * Math.PI) * 0.14);
    const thickProfile = 1 - Math.pow(t, 1.35) * 0.78;
    const crownRidge = (1 - Math.min(1, Math.abs(x / (baseWidth * 0.5)))) * 0.008;

    const nx = x * widthProfile + Math.sin(t * Math.PI * 0.75) * flareSide + t * flareSide * 0.35;
    const nz =
      z * thickProfile +
      crownRidge * (z >= 0 ? 1 : -0.4) +
      Math.sin(t * Math.PI * 0.9) * archOut -
      t * t * curlBack;

    pos.setXYZ(i, nx, y, nz);

    if (t < 0.38) {
      tmpC.lerpColors(rootC, midC, t / 0.38);
    } else {
      tmpC.lerpColors(midC, tipC, (t - 0.38) / 0.62);
    }
    colors[i * 3] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildHeroCharacter(mats: PronteraMaterials): HeroRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 32),
    mats.contactShadow,
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.03;
  root.add(shadowDisc);

  // Prošívaná zbrojní vesta/nohavice misto ploche barvy (sdilena kvalitni textura).
  const trouserMat = mats.quiltedLeather.clone();
  trouserMat.color.set(0x9c8468);
  trouserMat.userData.pbrKind = 'cloth';

  const beltLeatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x6e4429,
    roughness: 0.50,
    metalness: 0.08,
    clearcoat: 0.14,
    clearcoatRoughness: 0.48,
  });
  beltLeatherMat.userData.pbrKind = 'leather';

  const darkLeatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b1e16,
    roughness: 0.56,
    metalness: 0.08,
    clearcoat: 0.14,
    clearcoatRoughness: 0.50,
  });
  darkLeatherMat.userData.pbrKind = 'leather';

  const tatteredClothMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a212a,
    roughness: 0.88,
    metalness: 0.04,
    sheen: 0.32,
    sheenRoughness: 0.72,
    side: THREE.DoubleSide,
  });
  tatteredClothMat.userData.pbrKind = 'cloth';

  // Skladana latka (vertikalni faldiky + sum) pro plast a spodni zastery.
  const clothFoldTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d')!;
    x.fillStyle = '#333a30';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i++) {
      const s = 0.5 + 0.5 * Math.sin((i / 256) * Math.PI * 7 + 0.6);
      x.fillStyle = `rgba(0,0,0,${(0.26 * s).toFixed(3)})`;
      x.fillRect(i, 0, 1, 256);
      x.fillStyle = `rgba(255,255,255,${(0.05 * (1 - s)).toFixed(3)})`;
      x.fillRect((i + 2) % 256, 0, 1, 256);
    }
    for (let n = 0; n < 900; n++) {
      const gx = Math.floor(Math.random() * 256);
      const gy = Math.floor(Math.random() * 256);
      x.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.045)`;
      x.fillRect(gx, gy, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  tatteredClothMat.map = clothFoldTex;
  tatteredClothMat.color.set(0xffffff);

  // Predni zelena tunika s tmavym lemem (misto heraldickeho krize).
  const tabardHeraldTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d')!;
    x.fillStyle = '#3d4c3a';
    x.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 1100; n++) {
      const gx = Math.floor(Math.random() * 256);
      const gy = Math.floor(Math.random() * 256);
      x.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.05)`;
      x.fillRect(gx, gy, 1, 1);
    }
    x.strokeStyle = '#2c352a';
    x.lineWidth = 12;
    x.strokeRect(8, 8, 240, 240);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.fillRect(0, 200, 256, 56);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const tabardMat = new THREE.MeshPhysicalMaterial({
    map: tabardHeraldTex,
    roughness: 0.86,
    metalness: 0.02,
    sheen: 0.35,
    sheenRoughness: 0.7,
    side: THREE.DoubleSide,
  });
  tabardMat.userData.pbrKind = 'cloth';

  const armorTrimMat = new THREE.MeshStandardMaterial({
    color: 0xbcc7d4,
    roughness: 0.28,
    metalness: 0.85,
    envMapIntensity: 1.2,
  });
  armorTrimMat.userData.pbrKind = 'metal';
  armorTrimMat.userData.lockEnvIntensity = true;

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0x4e465c,
    roughness: 0.58,
    metalness: 0.02,
    sheen: 0.22,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0x8a7fa0),
  });
  skinMat.userData.pbrKind = 'skin';

  // Silver-white layered swept-back hair with darker ash roots
  const silverHairMat = new THREE.MeshStandardMaterial({
    color: 0xe2e6ec,
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.06,
  });
  silverHairMat.userData.pbrKind = 'cloth';

  const stubbleMat = new THREE.MeshStandardMaterial({
    color: 0x3b312a,
    roughness: 0.80,
    metalness: 0.02,
  });
  stubbleMat.userData.pbrKind = 'cloth';

  // Articulated Pelvis -> Lower Body + Upper Torso Skeleton Hierarchy (realistic ~1.84m proportions)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.94, 0);
  bodyGroup.add(pelvisGroup);

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.02, 0); // World y = 0.96
  pelvisGroup.add(torsoGroup);

  // Articulated Hip -> Knee -> Ankle Legs with Laminated Thigh Tassets, Knee Poleyns & V-Fluted Greaves
  const thighGeo = createMuscleLimbGeo(0.102, 0.092, 0.07, 0.47, 22);
  const shinGeo = createMuscleLimbGeo(0.08, 0.075, 0.055, 0.44, 22);
  const bootFootGeo = createSculptedBootFootGeo();

  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.132, 0, 0);
    hip.rotation.z = side * 0.055; // Grounded shoulder-width warrior stance
    hip.rotation.y = side * 0.12;  // Slight natural outward toe turn

    const thigh = new THREE.Mesh(thighGeo, trouserMat);
    thigh.castShadow = true;
    hip.add(thigh);

    // 4-lame articulated curved steel thigh tassets wrapping front & outer hip
    for (let lame = 0; lame < 4; lame++) {
      const rTop = 0.108 + lame * 0.003;
      const rBot = 0.112 + lame * 0.003;
      const tassetPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, 0.068, 16, 1, false, -Math.PI * 0.40, Math.PI * 0.88),
        mats.gunmetalArmor,
      );
      tassetPlate.position.set(side * 0.012, -0.05 - lame * 0.062, 0.008);
      tassetPlate.rotation.y = side * 0.34;
      tassetPlate.rotation.z = side * 0.08;
      tassetPlate.castShadow = true;
      hip.add(tassetPlate);

      const trimRib = new THREE.Mesh(
        new THREE.TorusGeometry(rBot, 0.0055, 6, 16, Math.PI * 0.88),
        armorTrimMat,
      );
      trimRib.rotation.x = Math.PI / 2;
      trimRib.rotation.z = -Math.PI * 0.40 + side * 0.34;
      trimRib.position.set(side * 0.012, -0.082 - lame * 0.062, 0.008);
      hip.add(trimRib);
    }

    const knee = new THREE.Group();
    knee.position.set(0, -0.47, 0);
    hip.add(knee);

    // Sculpted pointed gothic knee poleyn + outer wing guard
    const kneeCop = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 16, 12),
      mats.gunmetalArmor,
    );
    kneeCop.scale.set(0.95, 1.08, 1.12);
    kneeCop.position.set(0, 0.01, 0.016);
    kneeCop.castShadow = true;
    knee.add(kneeCop);

    const kneeWing = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.075, 4),
      armorTrimMat,
    );
    kneeWing.rotation.z = -side * 0.65;
    kneeWing.position.set(side * 0.062, 0.015, 0.006);
    knee.add(kneeWing);

    const shinUnder = new THREE.Mesh(shinGeo, darkLeatherMat);
    shinUnder.castShadow = true;
    knee.add(shinUnder);

    // Fluted gothic steel shin greave with flared upper cuff & V-chevron ribs
    const greave = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.056, 0.36, 18, 1, false, -Math.PI * 0.44, Math.PI * 0.88),
      mats.gunmetalArmor,
    );
    greave.position.set(0, -0.21, 0.008);
    greave.castShadow = true;
    knee.add(greave);

    const cuffFlare = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.074, 0.062, 18, 1, false, -Math.PI * 0.46, Math.PI * 0.92),
      armorTrimMat,
    );
    cuffFlare.position.set(0, -0.045, 0.012);
    knee.add(cuffFlare);

    // Three stacked V-chevron shin steel ribs
    for (let rib = 0; rib < 3; rib++) {
      const ry = -0.13 - rib * 0.085;
      for (const rs of [-1, 1]) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.048, 0.012, 0.014),
          armorTrimMat,
        );
        bar.position.set(rs * 0.022, ry, 0.066 - rib * 0.005);
        bar.rotation.z = -rs * 0.42;
        bar.rotation.y = rs * 0.25;
        knee.add(bar);
      }
    }

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.44, 0);
    ankle.rotation.z = -side * 0.055; // Keep sabaton soles planted flat on floor
    knee.add(ankle);

    // Armored steel Sabaton foot
    const foot = new THREE.Mesh(bootFootGeo, mats.gunmetalArmor);
    foot.scale.set(0.95, 0.95, 1.06);
    foot.position.set(0, -0.016, 0.045);
    foot.castShadow = true;
    ankle.add(foot);

    const toeCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.042, 0.085, 6),
      armorTrimMat,
    );
    toeCap.rotation.x = Math.PI * 0.5;
    toeCap.scale.set(1.1, 1.0, 0.55);
    toeCap.position.set(0, -0.022, 0.125);
    ankle.add(toeCap);

    return { hip, knee, ankle };
  };

  const leftLegRig = makeLeg(-1);
  const rightLegRig = makeLeg(1);
  const leftLeg = leftLegRig.hip;
  const rightLeg = rightLegRig.hip;
  const leftKnee = leftLegRig.knee;
  const rightKnee = rightLegRig.knee;
  const leftAnkle = leftLegRig.ankle;
  const rightAnkle = rightLegRig.ankle;
  pelvisGroup.add(leftLeg, rightLeg);

  // Tattered Central Front Chainmail Apron + Dark Cloth Underskirt Panels (leaves armored legs clearly exposed!)
  const coatSkirtGeo = createTatteredApronGeo(0.20, 0.54);
  const coatSkirt = new THREE.Mesh(coatSkirtGeo, mats.chainmail);
  coatSkirt.position.set(0, -0.02, 0.135);
  coatSkirt.castShadow = true;
  pelvisGroup.add(coatSkirt);

  const sideUnderskirtGeo = createTatteredApronGeo(0.28, 0.50);
  const backClothApron = new THREE.Mesh(sideUnderskirtGeo, tatteredClothMat);
  backClothApron.position.set(0, -0.02, -0.125);
  backClothApron.rotation.y = Math.PI;
  pelvisGroup.add(backClothApron);

  const frontClothUnder = new THREE.Mesh(createTatteredApronGeo(0.32, 0.52), tabardMat);
  frontClothUnder.position.set(0, -0.02, 0.118);
  pelvisGroup.add(frontClothUnder);

  // Layered Crossed Brown Leather Waist Belts & Forged Buckles
  const mainBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.162, 0.172, 0.072, 26),
    beltLeatherMat,
  );
  mainBelt.scale.set(1.06, 1.0, 0.78);
  mainBelt.position.y = 0.085;
  pelvisGroup.add(mainBelt);

  const upperBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.158, 0.165, 0.052, 26),
    beltLeatherMat,
  );
  upperBelt.scale.set(1.06, 1.0, 0.78);
  upperBelt.position.y = 0.155;
  pelvisGroup.add(upperBelt);

  const subBelt = new THREE.Mesh(
    new THREE.TorusGeometry(0.168, 0.020, 8, 26),
    beltLeatherMat,
  );
  subBelt.scale.set(1.07, 0.80, 1.0);
  subBelt.rotation.x = Math.PI / 2 + 0.20;
  subBelt.rotation.y = -0.18;
  subBelt.position.y = 0.01;
  pelvisGroup.add(subBelt);

  const beltBuckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.054, 0.022),
    armorTrimMat,
  );
  beltBuckle.position.set(-0.02, 0.085, 0.135);
  pelvisGroup.add(beltBuckle);

  // Ocelove cvočky po obvodu opasku.
  for (let i = -4; i <= 4; i++) {
    const a = i * 0.22;
    const stud = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 6),
      armorTrimMat,
    );
    stud.position.set(Math.sin(a) * 0.176, 0.085, Math.cos(a) * 0.138);
    pelvisGroup.add(stud);
  }

  // Zavesne reminky + kapsar na LEVEM boku + dyka na PRAVEM boku.
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.15, 0.014),
      beltLeatherMat,
    );
    strap.position.set(s * 0.055, -0.06, 0.135);
    strap.rotation.x = 0.06;
    strap.castShadow = true;
    pelvisGroup.add(strap);
  }
  const pouch = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.11, 0.05),
    darkLeatherMat,
  );
  pouch.position.set(-0.255, 0.0, 0.05);
  pouch.rotation.y = 0.2;
  pouch.castShadow = true;
  pelvisGroup.add(pouch);
  const pouchButton = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 6),
    armorTrimMat,
  );
  pouchButton.position.set(-0.25, 0.03, 0.077);
  pelvisGroup.add(pouchButton);

  // Mala pobocni dyka na pravem boku (jilec nahoru, cepel do pouzdra).
  // Cela skupina vysunuta vne nabedernich platu, spicka mirne ke stehnu.
  const daggerGroup = new THREE.Group();
  daggerGroup.position.set(0.26, 0.06, 0.04);
  daggerGroup.rotation.z = -0.22;
  pelvisGroup.add(daggerGroup);
  const daggerGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.016, 0.09, 10),
    beltLeatherMat,
  );
  daggerGrip.position.y = 0.04;
  daggerGrip.castShadow = true;
  daggerGroup.add(daggerGrip);
  const daggerGuard = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.016, 0.024),
    mats.darkSteel,
  );
  daggerGuard.position.y = -0.005;
  daggerGroup.add(daggerGuard);
  const daggerBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.15, 0.01),
    mats.forgedBlade,
  );
  daggerBlade.position.y = -0.085;
  daggerBlade.castShadow = true;
  daggerGroup.add(daggerBlade);

  // Sculped Gothic V-Chevron Gunmetal Breastplate + High Armored Gorget in TorsoGroup
  const cuirassGeo = createGothicCuirassGeo();
  const cuirass = new THREE.Mesh(cuirassGeo, mats.gunmetalArmor);
  cuirass.castShadow = true;
  torsoGroup.add(cuirass);

  // Central protruding V-ridge sternum keel + 3 V-chevron steel ribs
  const keelCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.50, 0.162),
    new THREE.Vector3(0, 0.34, 0.202),
    new THREE.Vector3(0, 0.14, 0.148),
  ]);
  const sternumKeel = new THREE.Mesh(
    new THREE.TubeGeometry(keelCurve, 12, 0.011, 6, false),
    armorTrimMat,
  );
  torsoGroup.add(sternumKeel);

  for (let vIdx = 0; vIdx < 3; vIdx++) {
    const vy = 0.24 + vIdx * 0.085;
    for (const s of [-1, 1]) {
      const chevron = new THREE.Mesh(
        new THREE.BoxGeometry(0.135, 0.014, 0.018),
        armorTrimMat,
      );
      chevron.position.set(s * 0.064, vy + 0.038, 0.168 - vIdx * 0.005);
      chevron.rotation.z = s * 0.50;
      chevron.rotation.y = -s * 0.36;
      torsoGroup.add(chevron);
    }
  }

  // Dual Round Engraved Circular Collarbone Clasps / Medallions (L/R)
  for (const s of [-1, 1]) {
    const claspDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.044, 0.022, 20),
      mats.gunmetalArmor,
    );
    claspDisc.rotation.x = Math.PI / 2 - 0.18;
    claspDisc.rotation.z = -s * 0.22;
    claspDisc.position.set(s * 0.118, 0.455, 0.156);
    torsoGroup.add(claspDisc);

    const claspRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.044, 0.007, 8, 20),
      armorTrimMat,
    );
    claspRim.rotation.x = -0.18;
    claspRim.rotation.y = s * 0.22;
    claspRim.position.set(s * 0.118, 0.455, 0.166);
    torsoGroup.add(claspRim);
  }

  // Armored Steel Neck Gorget & Chainmail Cowl Collar
  const mailGorget = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.175, 0.11, 22),
    mats.chainmail,
  );
  mailGorget.scale.set(1.04, 1.0, 0.84);
  mailGorget.position.y = 0.56;
  torsoGroup.add(mailGorget);

  const standCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.122, 0.145, 0.075, 20, 1, true, Math.PI * 0.18, Math.PI * 1.64),
    mats.gunmetalArmor,
  );
  standCollar.position.y = 0.59;
  torsoGroup.add(standCollar);

  // Zeleny satek kolem ramen (elfsky sal) pres zbroj.
  const scarfMat = new THREE.MeshPhysicalMaterial({
    color: 0x44513c,
    roughness: 0.9,
    metalness: 0.02,
    sheen: 0.4,
    sheenRoughness: 0.7,
    side: THREE.DoubleSide,
  });
  scarfMat.userData.pbrKind = 'cloth';
  const shoulderScarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.155, 0.042, 10, 28),
    scarfMat,
  );
  shoulderScarf.rotation.x = Math.PI / 2;
  shoulderScarf.scale.set(1.05, 0.9, 0.75);
  shoulderScarf.position.y = 0.53;
  shoulderScarf.castShadow = true;
  torsoGroup.add(shoulderScarf);

  // Zkrizene kozene pasy pres hrud + diagonalni zadni pas na mec.
  for (const s of [-1, 1]) {
    const chestStrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.5, 0.016),
      beltLeatherMat,
    );
    chestStrap.position.set(s * 0.03, 0.3, 0.19);
    chestStrap.rotation.z = -s * 0.5;
    chestStrap.rotation.x = -0.08;
    chestStrap.castShadow = true;
    torsoGroup.add(chestStrap);
  }
  const baldricCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.155, 0.52, 0.115),
    new THREE.Vector3(0.01, 0.30, 0.165),
    new THREE.Vector3(-0.165, 0.07, 0.115),
    new THREE.Vector3(-0.16, 0.06, -0.135),
    new THREE.Vector3(0.01, 0.28, -0.175),
    new THREE.Vector3(0.16, 0.51, -0.105),
  ]);
  const baldric = new THREE.Mesh(
    new THREE.TubeGeometry(baldricCurve, 28, 0.018, 8, true),
    beltLeatherMat,
  );
  baldric.scale.set(1.0, 1.0, 0.88);
  torsoGroup.add(baldric);

  // Symmetrical 4-Lame Winged Gothic Shoulder Pauldrons (L & R)
  for (const s of [-1, 1]) {
    const pauldron = new THREE.Group();
    pauldron.position.set(s * 0.24, 0.505, 0);
    pauldron.rotation.z = -s * 0.32;

    // Upturned signature gothic inner wing blade rising near collarbone/shoulder
    const shoulderWing = new THREE.Mesh(
      new THREE.ConeGeometry(0.058, 0.195, 4),
      mats.gunmetalArmor,
    );
    shoulderWing.scale.set(0.36, 1.0, 1.30);
    shoulderWing.position.set(-s * 0.052, 0.115, 0);
    shoulderWing.rotation.z = s * 0.34;
    shoulderWing.castShadow = true;
    pauldron.add(shoulderWing);

    // 4 overlapping articulated horizontal curved steel shoulder lames
    for (let lame = 0; lame < 4; lame++) {
      const r = 0.12 - lame * 0.01;
      const plate = new THREE.Mesh(
        new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.54),
        mats.gunmetalArmor,
      );
      plate.scale.set(1.05, 0.62, 1.1);
      plate.position.set(s * lame * 0.016, -lame * 0.044, 0);
      plate.castShadow = true;
      pauldron.add(plate);

      const lameRim = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.98, 0.0065, 6, 20),
        armorTrimMat,
      );
      lameRim.rotation.x = Math.PI / 2;
      lameRim.position.set(s * lame * 0.016, -lame * 0.044 - 0.008, 0);
      pauldron.add(lameRim);
    }
    torsoGroup.add(pauldron);
  }

  // Articulated Chainmail Sleeves + Flared Winged Gothic Vambraces & Gauntlets
  const upperArmGeo = createMuscleLimbGeo(0.078, 0.072, 0.058, 0.29, 18);
  const vambraceGeo = createMuscleLimbGeo(0.07, 0.064, 0.05, 0.26, 18);

  const makeArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.262, 0.460, 0);

    const sleeve = new THREE.Mesh(upperArmGeo, mats.chainmail);
    sleeve.castShadow = true;
    shoulder.add(sleeve);

    const armStrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.058, 0.010, 6, 16),
      beltLeatherMat,
    );
    armStrap.rotation.x = Math.PI / 2;
    armStrap.position.y = -0.18;
    shoulder.add(armStrap);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.29, 0);
    shoulder.add(elbow);

    // Pointed winged gothic elbow/forearm vambrace fin (signature silhouette from reference)
    const elbowFin = new THREE.Mesh(
      new THREE.ConeGeometry(0.046, 0.175, 4),
      mats.gunmetalArmor,
    );
    elbowFin.scale.set(0.32, 1.0, 1.15);
    elbowFin.position.set(side * 0.045, 0.045, -0.012);
    elbowFin.rotation.z = -side * 0.34;
    elbowFin.castShadow = true;
    elbow.add(elbowFin);

    const couter = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 16, 12),
      mats.gunmetalArmor,
    );
    couter.scale.set(1.0, 1.0, 1.12);
    couter.position.set(0, 0, -0.006);
    couter.castShadow = true;
    elbow.add(couter);

    const vambrace = new THREE.Mesh(vambraceGeo, mats.gunmetalArmor);
    vambrace.castShadow = true;
    elbow.add(vambrace);

    const wristStrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.044, 0.055, 14),
      beltLeatherMat,
    );
    wristStrap.position.y = -0.21;
    elbow.add(wristStrap);

    // Rozsirena pancerova manzeta pres zapesti (rukavice pod ni).
    const gauntletCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.06, 0.1, 14),
      mats.gunmetalArmor,
    );
    gauntletCuff.position.y = -0.245;
    gauntletCuff.castShadow = true;
    elbow.add(gauntletCuff);

    addSculptedHand(elbow, -0.27, mats.gunmetalArmor, mats.darkSteel, armorTrimMat, 0.98);
    return { shoulder, elbow };
  };

  const leftArmRig = makeArm(-1);
  const rightArmRig = makeArm(1);
  const leftArm = leftArmRig.shoulder;
  const rightArm = rightArmRig.shoulder;
  const leftElbow = leftArmRig.elbow;
  const rightElbow = rightArmRig.elbow;
  torsoGroup.add(leftArm, rightArm);

  // Slim Weathered Back Battle Half-Cloak (tucked cleanly behind back so front V-taper armor stays crisp)
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.50, -0.165);
  const capeGeo = new THREE.PlaneGeometry(0.44, 1.04, 8, 10);
  capeGeo.translate(0, -0.52, 0);
  const cCapePos = capeGeo.attributes.position;
  for (let i = 0; i < cCapePos.count; i++) {
    const cx = cCapePos.getX(i);
    const cy = cCapePos.getY(i);
    const dropT = Math.min(1, Math.max(0, -cy / 1.04));
    const widthScale = 0.68 + dropT * 0.45;
    const shred = dropT > 0.78 ? -Math.abs(Math.sin(cx * 24.0)) * 0.06 * ((dropT - 0.78) / 0.22) : 0;
    const drapeZ = -0.03 - Math.sin(dropT * Math.PI * 0.85) * 0.06 + Math.cos(cx * 11.0) * 0.018 * dropT;
    cCapePos.setXYZ(i, cx * widthScale, cy + shred, drapeZ);
  }
  capeGeo.computeVertexNormals();
  const capeBasePositions = new Float32Array(capeGeo.attributes.position.array);
  const capeMesh = new THREE.Mesh(capeGeo, tatteredClothMat);
  capeMesh.castShadow = true;
  capePivot.add(capeMesh);
  torsoGroup.add(capePivot);

  // Diagonal Back Greatsword Scabbard (pommel & hilt rise over character's right shoulder; blade sheathed downward past left hip)
  const backSwordGroup = new THREE.Group();
  backSwordGroup.position.set(0.01, 0.22, -0.20);
  backSwordGroup.rotation.z = 0.50;
  backSwordGroup.rotation.x = 0.06;

  const backScabbard = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, 1.14, 0.030),
    darkLeatherMat,
  );
  backScabbard.position.y = -0.17;
  const backChape = new THREE.Mesh(
    new THREE.ConeGeometry(0.032, 0.14, 4),
    armorTrimMat,
  );
  backChape.rotation.x = Math.PI;
  backChape.position.y = -0.78;

  // Kotva zbrane na zadech: pouzdro + chranitko jsou pevne, mec se dosazuje
  // pres setHeroWeapon (otoceny hlavici vzhuru, cepel v pouzdre).
  backSwordGroup.add(backScabbard, backChape);
  torsoGroup.add(backSwordGroup);

  // Kotva zbrane v ruce: drzi klidovou transformaci rukoveti (mece se meni,
  // ruka s kotvou hybe pri chuzi i pri vsech 3 utocich).
  const handSwordGroup = new THREE.Group();
  handSwordGroup.position.set(0.0, -0.29, 0.034);
  handSwordGroup.rotation.x = Math.PI * 0.44;
  handSwordGroup.visible = false;
  rightElbow.add(handSwordGroup);

  // Steel Slash Trail
  const slashCanvas = document.createElement('canvas');
  slashCanvas.width = 128;
  slashCanvas.height = 128;
  const sctx = slashCanvas.getContext('2d')!;
  const radGrad = sctx.createRadialGradient(64, 64, 28, 64, 64, 62);
  radGrad.addColorStop(0.0, 'rgba(255,255,255,0)');
  radGrad.addColorStop(0.58, 'rgba(210,232,255,0.18)');
  radGrad.addColorStop(0.85, 'rgba(235,245,255,0.88)');
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
  slashArcMesh.position.set(0, 0.24, 0.30);
  slashArcMesh.visible = false;
  torsoGroup.add(slashArcMesh);

  // Dark-elven head: cista tvar bez vousu, spicate usi, blede oci.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.75, 0.01);
  torsoGroup.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.066, 0.14, 18),
    skinMat,
  );
  neck.position.y = -0.125;
  headGroup.add(neck);

  const heroCranium = new THREE.Mesh(createSculptedHeadGeo(0.118, 0.87), skinMat);
  heroCranium.castShadow = true;
  headGroup.add(heroCranium);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skinMat);
    ear.scale.set(0.34, 1.1, 0.6);
    ear.position.set(s * 0.104, -0.004, -0.008);
    headGroup.add(ear);
    // Spicata elfsky spicka smerem ven a nahoru.
    const earTip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.055, 8), skinMat);
    earTip.position.set(s * 0.122, 0.032, -0.01);
    earTip.rotation.z = -s * 1.15;
    earTip.castShadow = true;
    headGroup.add(earTip);
  }

  addRealisticEyesAndBrows(headGroup, 0xd5dae2, 0x2e2a24, 0.8);

  // Subtle heavy brow shadow ridge for fierce dark-fantasy expression
  const browShadow = new THREE.Mesh(
    new THREE.BoxGeometry(0.112, 0.012, 0.024),
    skinMat,
  );
  browShadow.position.set(0, 0.028, 0.106);
  headGroup.add(browShadow);

  // Scesane dozadu: zadne clonky pres celo, vse splývá dozadu pres usi a zada.
  const hairLockSpecs: {
    pos: [number, number, number];
    rot: [number, number, number];
    len: number;
    w: number;
    t: number;
    arch: number;
    flare: number;
    curl: number;
  }[] = [
    // Bocni prameny scesane dozadu kolem usi
    { pos: [-0.096, 0.07, -0.01], rot: [0.05, -2.05, -0.1], len: 0.225, w: 0.06, t: 0.017, arch: 0.02, flare: -0.012, curl: 0.01 },
    { pos: [0.096, 0.07, -0.01], rot: [0.05, 2.05, 0.1], len: 0.225, w: 0.06, t: 0.017, arch: 0.02, flare: 0.012, curl: 0.01 },
    // Zadni splývave vrstvy
    { pos: [-0.062, 0.062, -0.088], rot: [-0.16, -2.6, -0.06], len: 0.26, w: 0.07, t: 0.018, arch: 0.018, flare: -0.01, curl: -0.01 },
    { pos: [0.062, 0.062, -0.088], rot: [-0.16, 2.6, 0.06], len: 0.26, w: 0.07, t: 0.018, arch: 0.018, flare: 0.01, curl: -0.01 },
    { pos: [0.0, 0.068, -0.112], rot: [-0.22, Math.PI, 0], len: 0.285, w: 0.09, t: 0.019, arch: 0.018, flare: 0, curl: -0.015 },
    { pos: [-0.032, 0.078, -0.104], rot: [-0.2, -2.95, -0.03], len: 0.235, w: 0.062, t: 0.016, arch: 0.014, flare: -0.006, curl: -0.008 },
    { pos: [0.032, 0.078, -0.104], rot: [-0.2, 2.95, 0.03], len: 0.235, w: 0.062, t: 0.016, arch: 0.014, flare: 0.006, curl: -0.008 },
  ];
  // Stazena koruna vlasu dozadu (zadni objem, celo volne)
  const crownCapGeo = new THREE.SphereGeometry(0.122, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
  const capPos = crownCapGeo.attributes.position;
  const capCol = new Float32Array(capPos.count * 3);
  const cTop = new THREE.Color(0xd4d9e0);
  const cSide = new THREE.Color(0x9aa0ab);
  const cMix = new THREE.Color();
  for (let i = 0; i < capPos.count; i++) {
    const cx = capPos.getX(i);
    const cy = capPos.getY(i);
    const cz = capPos.getZ(i);
    const f = Math.max(0, Math.min(1, cy / 0.122));
    cMix.lerpColors(cSide, cTop, f);
    capCol[i * 3] = cMix.r;
    capCol[i * 3 + 1] = cMix.g;
    capCol[i * 3 + 2] = cMix.b;
    // Slight central part dip at front hairline while keeping forehead covered
    if (cz > 0.03 && Math.abs(cx) < 0.028) {
      capPos.setY(i, cy - 0.008);
    }
  }
  crownCapGeo.setAttribute('color', new THREE.BufferAttribute(capCol, 3));
  crownCapGeo.computeVertexNormals();
  const hairCrown = new THREE.Mesh(crownCapGeo, silverHairMat);
  hairCrown.scale.set(0.9, 0.96, 1.0);
  hairCrown.rotation.x = 0.06; // Tilted slightly forward to cover upper forehead naturally
  hairCrown.position.set(0, 0.018, 0.004);
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  // Prameny scesane dozadu (definovane vyse) se osadi sem.
  for (const spec of hairLockSpecs) {
    const lockGeo = createTaperedHairLockGeo(
      spec.len,
      spec.w,
      spec.t,
      spec.arch,
      spec.flare,
      spec.curl,
    );
    const lock = new THREE.Mesh(lockGeo, silverHairMat);
    lock.position.set(...spec.pos);
    lock.rotation.set(...spec.rot);
    lock.castShadow = true;
    headGroup.add(lock);
  }

  const rig: HeroRig = {
    root,
    bodyGroup,
    pelvisGroup,
    torsoGroup,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
    coatSkirt,
    capePivot,
    capeGeo,
    capeBasePositions,
    headGroup,
    backSwordGroup,
    handSwordGroup,
    weaponId: 'greatsword',
    slashArcMesh,
    slashArcMat,
    shadowDisc,
  };
  heroWeaponMats.set(rig, mats);
  setHeroWeapon(rig, 'greatsword');
  return rig;
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
  const k = 1 - Math.exp(-15 * dt);
  const normSpd = Math.min(1.0, speed / 7.8);

  const swordInHand =
    Boolean(attackState && attackState.timer > 0) ||
    Boolean(attackState && (attackState.drawHoldTimer ?? 0) > 0);
  rig.handSwordGroup.visible = swordInHand;
  rig.backSwordGroup.visible = !swordInHand;

  if (isMoving) {
    // Athletic weighted swordsman gait: hip/shoulder counter-twist, deep knee swing flexion, ankle push-off
    const sinP = Math.sin(walkPhase);
    const cosP = Math.cos(walkPhase);

    const targetHipL = -sinP * 0.56 * normSpd;
    const targetHipR = sinP * 0.56 * normSpd;
    const targetKneeL = Math.max(0.08, (sinP > 0 ? sinP * 0.72 : -sinP * 0.26) * normSpd + 0.12);
    const targetKneeR = Math.max(0.08, (sinP < 0 ? -sinP * 0.72 : sinP * 0.26) * normSpd + 0.12);
    const targetAnkleL = cosP * 0.24 * normSpd;
    const targetAnkleR = -cosP * 0.24 * normSpd;

    rig.leftLeg.rotation.x += (targetHipL - rig.leftLeg.rotation.x) * k;
    rig.rightLeg.rotation.x += (targetHipR - rig.rightLeg.rotation.x) * k;
    rig.leftKnee.rotation.x += (targetKneeL - rig.leftKnee.rotation.x) * k;
    rig.rightKnee.rotation.x += (targetKneeR - rig.rightKnee.rotation.x) * k;
    rig.leftAnkle.rotation.x += (targetAnkleL - rig.leftAnkle.rotation.x) * k;
    rig.rightAnkle.rotation.x += (targetAnkleR - rig.rightAnkle.rotation.x) * k;

    const comBob = (1.0 - Math.abs(cosP)) * 0.038 - Math.abs(sinP) * 0.022;
    rig.pelvisGroup.position.y += (0.94 + comBob * normSpd - rig.pelvisGroup.position.y) * k;
    rig.pelvisGroup.rotation.y += (sinP * 0.10 * normSpd - rig.pelvisGroup.rotation.y) * k;
    rig.pelvisGroup.rotation.z += (cosP * 0.030 * normSpd - rig.pelvisGroup.rotation.z) * k;

    rig.torsoGroup.rotation.y += (-sinP * 0.13 * normSpd - rig.torsoGroup.rotation.y) * k;
    rig.torsoGroup.rotation.x += (0.12 * normSpd - rig.torsoGroup.rotation.x) * k;
    rig.headGroup.rotation.y += (sinP * 0.04 * normSpd - rig.headGroup.rotation.y) * k;
    rig.headGroup.rotation.x += (-0.06 * normSpd - rig.headGroup.rotation.x) * k;

    rig.coatSkirt.rotation.x += ((0.06 + Math.abs(sinP) * 0.12 * normSpd) - rig.coatSkirt.rotation.x) * k;

    rig.leftArm.rotation.x += (sinP * 0.44 * normSpd - rig.leftArm.rotation.x) * k;
    rig.leftArm.rotation.z += (-0.16 - rig.leftArm.rotation.z) * k;
    rig.leftElbow.rotation.x += ((-0.32 - Math.max(0, -sinP) * 0.24) - rig.leftElbow.rotation.x) * k;

    if (swordInHand) {
      // Lowered relaxed diagonal sword carry (zero sun reflection glare, clears tassets)
      rig.rightArm.rotation.x += ((0.18 - sinP * 0.18) - rig.rightArm.rotation.x) * k;
      rig.rightArm.rotation.z += (0.28 - rig.rightArm.rotation.z) * k;
      rig.rightArm.rotation.y += (-0.10 - rig.rightArm.rotation.y) * k;
      rig.rightElbow.rotation.x += (-0.36 - rig.rightElbow.rotation.x) * k;
    } else {
      rig.rightArm.rotation.x += (-sinP * 0.44 * normSpd - rig.rightArm.rotation.x) * k;
      rig.rightArm.rotation.z += (0.16 - rig.rightArm.rotation.z) * k;
      rig.rightArm.rotation.y += (0 - rig.rightArm.rotation.y) * k;
      rig.rightElbow.rotation.x += ((-0.32 - Math.max(0, sinP) * 0.24) - rig.rightElbow.rotation.x) * k;
    }

    rig.capePivot.rotation.x += ((0.18 + normSpd * 0.16) - rig.capePivot.rotation.x) * k;
  } else {
    // Grounded heroic combat-ready A-stance matching reference pose (arms flared clear of tassets)
    const breathe = Math.sin(elapsed * 2.1);
    rig.leftLeg.rotation.x += (0.04 - rig.leftLeg.rotation.x) * k;
    rig.rightLeg.rotation.x += (-0.04 - rig.rightLeg.rotation.x) * k;
    rig.leftKnee.rotation.x += (0.05 - rig.leftKnee.rotation.x) * k;
    rig.rightKnee.rotation.x += (0.05 - rig.rightKnee.rotation.x) * k;
    rig.leftAnkle.rotation.x += (0 - rig.leftAnkle.rotation.x) * k;
    rig.rightAnkle.rotation.x += (0 - rig.rightAnkle.rotation.x) * k;

    rig.pelvisGroup.position.y += (0.935 + breathe * 0.008 - rig.pelvisGroup.position.y) * k;
    rig.pelvisGroup.rotation.y += (0 - rig.pelvisGroup.rotation.y) * k;
    rig.pelvisGroup.rotation.z += (0 - rig.pelvisGroup.rotation.z) * k;
    rig.torsoGroup.rotation.y += (0 - rig.torsoGroup.rotation.y) * k;
    rig.torsoGroup.rotation.x += ((0.02 + breathe * 0.015) - rig.torsoGroup.rotation.x) * k;
    rig.headGroup.rotation.y += (Math.sin(elapsed * 0.7) * 0.04 - rig.headGroup.rotation.y) * k;
    rig.headGroup.rotation.x += (0 - rig.headGroup.rotation.x) * k;
    rig.coatSkirt.rotation.x += (0.04 - rig.coatSkirt.rotation.x) * k;

    rig.leftArm.rotation.x += ((swordInHand ? -0.06 : 0.03) - rig.leftArm.rotation.x) * k;
    rig.leftArm.rotation.z += (-0.21 - rig.leftArm.rotation.z) * k;
    rig.leftElbow.rotation.x += ((swordInHand ? -0.26 : -0.18) - rig.leftElbow.rotation.x) * k;

    rig.rightArm.rotation.x += ((swordInHand ? 0.08 : 0.03) - rig.rightArm.rotation.x) * k;
    rig.rightArm.rotation.z += ((swordInHand ? 0.28 : 0.21) - rig.rightArm.rotation.z) * k;
    rig.rightArm.rotation.y += ((swordInHand ? -0.10 : 0) - rig.rightArm.rotation.y) * k;
    rig.rightElbow.rotation.x += ((swordInHand ? -0.34 : -0.18) - rig.rightElbow.rotation.x) * k;
    rig.capePivot.rotation.x += (0.06 - rig.capePivot.rotation.x) * k;
  }

  // Real-time cloth ripple on cape vertices
  const cPos = rig.capeGeo.attributes.position;
  const base = rig.capeBasePositions;
  const flutterAmp = 0.016 + normSpd * 0.040;
  for (let i = 0; i < cPos.count; i++) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const bz = base[i * 3 + 2];
    const drop = Math.min(1, Math.max(0, -by / 1.04));
    const wave = Math.sin(elapsed * (3.2 + normSpd * 5.0) - drop * 4.5 + bx * 4.0) * flutterAmp * drop;
    cPos.setXYZ(i, bx, by, bz + wave);
  }
  cPos.needsUpdate = true;

  updateHeroSlashArc(rig, attackState);

  if (attackState && attackState.timer > 0) {
    const p = 1 - Math.max(0, Math.min(1, attackState.timer / attackState.duration));
    const combo = attackState.comboIndex % 3;

    if (combo === 0) {
      rig.rightArm.rotation.x = -1.35 + p * 2.15;
      rig.rightArm.rotation.z = -0.82 + p * 1.45;
      rig.rightArm.rotation.y = 0.85 - p * 1.95;
      rig.rightElbow.rotation.x = -0.45 + p * 0.25;
      rig.torsoGroup.rotation.y = 0.48 - p * 1.05;
      rig.leftArm.rotation.x = -0.45;
    } else if (combo === 1) {
      rig.rightArm.rotation.x = -1.15 + Math.sin(p * Math.PI) * 0.45;
      rig.rightArm.rotation.z = 0.85 - p * 1.75;
      rig.rightArm.rotation.y = -1.05 + p * 2.1;
      rig.rightElbow.rotation.x = -0.35;
      rig.torsoGroup.rotation.y = -0.48 + p * 1.05;
    } else {
      const hop = Math.sin(p * Math.PI) * 0.18;
      rig.pelvisGroup.position.y += hop;
      rig.rightArm.rotation.x = -1.95 + p * 2.65;
      rig.rightArm.rotation.z = -0.15;
      rig.rightArm.rotation.y = 0;
      rig.rightElbow.rotation.x = -0.32;
      rig.torsoGroup.rotation.x = -0.10 + p * 0.28;
    }
  } else {
    rig.bodyGroup.rotation.x += (0 - rig.bodyGroup.rotation.x) * k;
  }
}

export function updateHeroSlashArc(rig: HeroRig, attackState?: HeroAttackAnimState): void {
  if (attackState && attackState.timer > 0) {
    const p = 1 - Math.max(0, Math.min(1, attackState.timer / attackState.duration));
    const combo = attackState.comboIndex % 3;
    const sweep = Math.sin(p * Math.PI);

    if (combo === 0) {
      rig.slashArcMesh.visible = p > 0.14 && p < 0.86;
      rig.slashArcMesh.rotation.set(0.18, p * 2.3 - 1.15, -0.20);
      rig.slashArcMesh.scale.setScalar(1.0);
      rig.slashArcMat.color.setHex(0xd8ecff);
      rig.slashArcMat.opacity = sweep * 0.52;
    } else if (combo === 1) {
      rig.slashArcMesh.visible = p > 0.14 && p < 0.86;
      rig.slashArcMesh.rotation.set(-0.18, -p * 2.3 + 1.15, 0.24);
      rig.slashArcMesh.scale.setScalar(1.05);
      rig.slashArcMat.color.setHex(0xbde2ff);
      rig.slashArcMat.opacity = sweep * 0.52;
    } else {
      rig.slashArcMesh.visible = p > 0.18 && p < 0.88;
      rig.slashArcMesh.rotation.set(p * 1.7 - 0.55, 0, Math.PI * 0.5);
      rig.slashArcMesh.scale.setScalar(1.22);
      rig.slashArcMat.color.setHex(0xffdfa6);
      rig.slashArcMat.opacity = sweep * 0.58;
    }
  } else {
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
