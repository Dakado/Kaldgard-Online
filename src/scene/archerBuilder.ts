import * as THREE from 'three';
import { PronteraMaterials } from './materials';
import { HeroAttackAnimState } from './characterBuilder';

export interface ArcherRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
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
  leftWrist: THREE.Group;
  rightWrist: THREE.Group;
  capePivot: THREE.Group;
  capeGeo: THREE.PlaneGeometry;
  capeBasePositions: Float32Array;
  quiverGroup: THREE.Group;
  backBowGroup: THREE.Group;
  handBowGroup: THREE.Group;
  nockedArrowMesh: THREE.Group;
  bowStringLine: THREE.Line;
  bowStringGeo: THREE.BufferGeometry;
  shadowDisc: THREE.Mesh;
}

export interface FlyingArrow {
  id: number;
  mesh: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetMobId: string | null;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  progress: number;
  maxDistance: number;
  damage: number;
  isCrit: boolean;
  spawnTime: number;
  trailMesh: THREE.Line;
  trailPositions: Float32Array;
}

/**
 * Creates an anatomical sculpted feminine elven head with pronounced cheekbones,
 * refined jawline, sculpted nose bridge, and long pointed elven ears.
 */
function createElvenSculptedHeadGeo(radius = 0.12): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, 32, 24);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / radius;
    const ny = v.y / radius;
    const nz = v.z / radius;

    // Slender elven cranium
    v.x *= 0.85;
    v.y *= 1.10;
    v.z *= 0.95;

    // Tapered graceful jaw and delicate pointed chin
    if (ny < 0.05) {
      const lowerT = Math.min(1, (-ny + 0.05) / 1.05);
      v.x *= 1.0 - lowerT * 0.44;
      if (nz > 0.1) {
        v.z += lowerT * 0.015 * nz;
        if (ny < -0.55) {
          v.z += (1.0 - Math.min(1, Math.abs(nx) * 3.0)) * 0.014;
          v.y -= 0.007;
        }
      }
    }

    // High sculpted elven cheekbones
    if (nz > 0.22 && ny > -0.30 && ny < 0.08) {
      const cheek = Math.exp(-Math.pow((Math.abs(nx) - 0.44) / 0.20, 2)) *
        Math.exp(-Math.pow((ny + 0.12) / 0.18, 2));
      v.z += cheek * 0.012;
      v.x += Math.sign(nx) * cheek * 0.005;
    }

    // Gentle orbital recess and slender brow
    if (nz > 0.40) {
      const eyeSocket = Math.exp(-Math.pow((Math.abs(nx) - 0.35) / 0.16, 2)) *
        Math.exp(-Math.pow((ny - 0.06) / 0.14, 2));
      v.z -= eyeSocket * 0.013;
    }

    // Refined slender elven nose
    if (nz > 0.50 && Math.abs(nx) < 0.18 && ny > -0.26 && ny < 0.22) {
      const lateral = Math.exp(-Math.pow(nx / 0.085, 2));
      const vertT = (0.22 - ny) / 0.48;
      const bridgeProfile = vertT < 0.70
        ? Math.sin((vertT / 0.70) * Math.PI * 0.5)
        : Math.max(0, 1.0 - (vertT - 0.70) / 0.30);
      v.z += lateral * bridgeProfile * 0.026;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates long pointed elven ears protruding backward and upward.
 */
function createElvenEarGeo(scale = 1.0): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.022 * scale, 0.095 * scale, 6);
  geo.rotateZ(Math.PI * 0.46);
  geo.rotateX(-0.25);
  geo.scale(1.0, 0.45, 1.35);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a draped hooded cowl covering the crown, back of head, and neck.
 */
function createHoodCowlGeo(scale = 1.0): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.148 * scale, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.78);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Elongate backward to create cowl peak
    if (v.z < 0) {
      v.z *= 1.25;
      v.y += (-v.z) * 0.18;
    }
    // Flare lower rim outwards over mantle
    if (v.y < -0.04 * scale) {
      const flare = (-v.y - 0.04 * scale) / (0.12 * scale);
      v.x *= 1.0 + flare * 0.45;
      v.z *= 1.0 + flare * 0.40;
    }
    // Carve face opening in front
    if (v.z > 0.04 * scale && v.y > -0.06 * scale && v.y < 0.08 * scale) {
      if (Math.abs(v.x) < 0.085 * scale) {
        v.z -= 0.025 * scale;
      }
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the composite recurve elven bow with carved limbs and central riser.
 */
export function buildElvenRecurveBow(mats: PronteraMaterials): {
  group: THREE.Group;
  stringLine: THREE.Line;
  stringGeo: THREE.BufferGeometry;
} {
  const bow = new THREE.Group();

  const woodMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d2719,
    roughness: 0.42,
    metalness: 0.15,
    clearcoat: 0.35,
    clearcoatRoughness: 0.30,
  });

  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xd9b35b,
    roughness: 0.28,
    metalness: 0.88,
  });

  const gripLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x241812,
    roughness: 0.65,
    metalness: 0.05,
  });

  // Central grip riser
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.18, 12), gripLeatherMat);
  grip.castShadow = true;
  bow.add(grip);

  // Upper & Lower recurve curved limbs using smooth Spline curves
  for (const s of [1, -1]) {
    const limbCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, s * 0.08, 0),
      new THREE.Vector3(0, s * 0.28, -0.035),
      new THREE.Vector3(0, s * 0.48, -0.065),
      new THREE.Vector3(0, s * 0.62, -0.045),
      new THREE.Vector3(0, s * 0.72, 0.025), // Recurve tip flick
    ]);

    const limbGeo = new THREE.TubeGeometry(limbCurve, 20, 0.014, 8, false);
    const limbMesh = new THREE.Mesh(limbGeo, woodMat);
    limbMesh.castShadow = true;
    bow.add(limbMesh);

    // Golden leaf filigree accents on outer limb
    const leafGeo = new THREE.ConeGeometry(0.015, 0.08, 4);
    leafGeo.rotateZ(s * 0.4);
    const leafMesh = new THREE.Mesh(leafGeo, goldAccentMat);
    leafMesh.position.set(0, s * 0.45, -0.07);
    bow.add(leafMesh);

    // Tip horn nock
    const nockMesh = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), goldAccentMat);
    nockMesh.position.set(0, s * 0.72, 0.025);
    bow.add(nockMesh);
  }

  // Taut silver bowstring connecting upper and lower nocks
  const stringPositions = new Float32Array([
    0, 0.72, 0.025,   // Upper nock
    0, 0.0, 0.015,    // Center nock point (pulled back dynamically during draw)
    0, -0.72, 0.025,  // Lower nock
  ]);
  const stringGeo = new THREE.BufferGeometry();
  stringGeo.setAttribute('position', new THREE.BufferAttribute(stringPositions, 3));

  const stringMat = new THREE.LineBasicMaterial({
    color: 0xebf2fc,
    linewidth: 1.5,
  });
  const stringLine = new THREE.Line(stringGeo, stringMat);
  bow.add(stringLine);

  return { group: bow, stringLine, stringGeo };
}

/**
 * Builds an elven arrow mesh with fletchings, steel bodkin head, and wooden shaft.
 */
export function buildArrowMesh(): THREE.Group {
  const arrow = new THREE.Group();

  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x9e7f5b,
    roughness: 0.55,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.25,
    metalness: 0.9,
  });

  const fletchMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e1,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  // Shaft (points along +Z)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.82, 8), shaftMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.41;
  arrow.add(shaft);

  // Arrowhead at tip (Z = 0)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.07, 4), headMat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.035;
  arrow.add(head);

  // 3-vaned feather fletching at back (Z = -0.75)
  for (let f = 0; f < 3; f++) {
    const angle = (f * Math.PI * 2) / 3;
    const vane = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.11), fletchMat);
    vane.position.set(Math.cos(angle) * 0.016, Math.sin(angle) * 0.016, -0.72);
    vane.rotation.z = angle + Math.PI / 2;
    arrow.add(vane);
  }

  return arrow;
}

/**
 * Builds the leather back quiver packed with arrows.
 */
export function buildQuiverWithArrows(): THREE.Group {
  const quiver = new THREE.Group();

  const quiverMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b1c13,
    roughness: 0.52,
    metalness: 0.08,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4ad55,
    roughness: 0.32,
    metalness: 0.85,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.042, 0.62, 14),
    quiverMat,
  );
  body.castShadow = true;
  quiver.add(body);

  // Gold rim trim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.006, 8, 16), goldMat);
  rim.position.y = 0.31;
  rim.rotation.x = Math.PI / 2;
  quiver.add(rim);

  // Arrows packed inside protruding at top
  const fletchMat = new THREE.MeshStandardMaterial({ color: 0xede4ce, roughness: 0.6 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x8a6b47, roughness: 0.5 });

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const r = (i % 2 === 0 ? 0.028 : 0.015);
    const ax = Math.cos(angle) * r;
    const az = Math.sin(angle) * r;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6), shaftMat);
    shaft.position.set(ax, 0.40, az);
    const fletch = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.08, 4), fletchMat);
    fletch.position.set(ax, 0.49, az);
    quiver.add(shaft, fletch);
  }

  return quiver;
}

/**
 * Builds the complete high-fidelity Elven Archer Character Rig.
 */
export function buildElvenArcherCharacter(mats: PronteraMaterials): ArcherRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 32),
    mats.contactShadow,
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.03;
  root.add(shadowDisc);

  // PBR Materials matching reference photo:
  // Fair elven skin
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xecd9ca,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.15,
    clearcoatRoughness: 0.35,
  });

  // Dark weathered harness leather
  const harnessLeatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x221711,
    roughness: 0.50,
    metalness: 0.10,
    clearcoat: 0.20,
    clearcoatRoughness: 0.45,
  });

  // Trousers leather (brown with buckle bands)
  const pantsLeatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x483526,
    roughness: 0.62,
    metalness: 0.06,
  });

  // Hood & cowl dark cloth/leather
  const hoodMat = new THREE.MeshPhysicalMaterial({
    color: 0x332822,
    roughness: 0.72,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  // Silver / Platinum elven hair
  const platinumHairMat = new THREE.MeshStandardMaterial({
    color: 0xf2f4f8,
    roughness: 0.40,
    metalness: 0.12,
  });

  // Silver buckle & filigree trim
  const silverTrimMat = new THREE.MeshStandardMaterial({
    color: 0xced6e0,
    roughness: 0.24,
    metalness: 0.90,
  });

  // 1. Pelvis / Hips (athletic elven waist)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.92, 0);
  bodyGroup.add(pelvisGroup);

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.125, 0.17, 18),
    pantsLeatherMat,
  );
  pelvisMesh.scale.set(1.15, 1.0, 0.78);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  // Ornate silver belt & hip ring accents
  const beltMesh = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 8, 24), silverTrimMat);
  beltMesh.rotation.x = Math.PI / 2;
  beltMesh.scale.set(1.16, 0.80, 1.0);
  pelvisGroup.add(beltMesh);

  // 2. Torso (toned midriff + leather crop top harness)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.14, 0);
  pelvisGroup.add(torsoGroup);

  // Exposed midriff (fair elven skin)
  const midriff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.135, 0.18, 16),
    skinMat,
  );
  midriff.position.set(0, 0.08, 0);
  midriff.scale.set(1.08, 1.0, 0.75);
  midriff.castShadow = true;
  torsoGroup.add(midriff);

  // Leather crop top / bralette bust
  const bustGroup = new THREE.Group();
  bustGroup.position.set(0, 0.24, 0.04);
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), harnessLeatherMat);
    cup.scale.set(1.0, 0.9, 0.8);
    cup.position.set(s * 0.055, 0, 0.015);
    cup.castShadow = true;
    bustGroup.add(cup);

    // Cross harness strap over shoulder
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.22, 6), harnessLeatherMat);
    strap.rotation.z = s * 0.42;
    strap.position.set(s * 0.065, 0.08, -0.01);
    bustGroup.add(strap);
  }
  torsoGroup.add(bustGroup);

  // Upper back & shoulders
  const upperTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.16, 18),
    harnessLeatherMat,
  );
  upperTorso.position.set(0, 0.26, -0.01);
  upperTorso.scale.set(1.18, 1.0, 0.74);
  torsoGroup.add(upperTorso);

  // 3. Head & Cowl
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.38, 0);
  torsoGroup.add(headGroup);

  // Face
  const headMesh = new THREE.Mesh(createElvenSculptedHeadGeo(0.11), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Hooded Cowl
  const hoodMesh = new THREE.Mesh(createHoodCowlGeo(1.0), hoodMat);
  hoodMesh.position.set(0, 0.02, 0.01);
  hoodMesh.castShadow = true;
  headGroup.add(hoodMesh);

  // Pointed Elven Ears protruding from hood sides
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(createElvenEarGeo(1.0), skinMat);
    ear.position.set(s * 0.105, 0.01, -0.01);
    ear.rotation.y = s * 0.35;
    headGroup.add(ear);
  }

  // Long flowing platinum hair locks cascading down shoulders & back
  for (let h = 0; h < 6; h++) {
    const s = h % 2 === 0 ? -1 : 1;
    const strandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * (0.05 + (h % 3) * 0.025), 0.02, -0.02),
      new THREE.Vector3(s * (0.09 + (h % 3) * 0.02), -0.16, 0.02),
      new THREE.Vector3(s * (0.08 + (h % 3) * 0.015), -0.38, -0.04),
      new THREE.Vector3(s * (0.06 + (h % 3) * 0.01), -0.58, -0.08),
    ]);
    const strandGeo = new THREE.TubeGeometry(strandCurve, 14, 0.015 - h * 0.0015, 6, false);
    const strandMesh = new THREE.Mesh(strandGeo, platinumHairMat);
    strandMesh.castShadow = true;
    headGroup.add(strandMesh);
  }

  // Emerald Eyes
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x36a66d, roughness: 0.2 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x05080c });
  for (const s of [-1, 1]) {
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), irisMat);
    iris.position.set(s * 0.038, 0.012, 0.104);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 6, 6), pupilMat);
    pupil.position.set(s * 0.038, 0.012, 0.107);
    headGroup.add(iris, pupil);
  }

  // 4. Back Quiver (mounted over right shoulder, diagonal)
  const quiverGroup = buildQuiverWithArrows();
  quiverGroup.position.set(0.12, 0.26, -0.14);
  quiverGroup.rotation.set(-0.25, 0.20, -0.45);
  torsoGroup.add(quiverGroup);

  // 5. Back Bow (slung across back when idle/running)
  const { group: backBowGroup, stringLine, stringGeo } = buildElvenRecurveBow(mats);
  backBowGroup.position.set(-0.10, 0.25, -0.15);
  backBowGroup.rotation.set(-0.35, -0.30, 0.65);
  backBowGroup.scale.setScalar(0.92);
  torsoGroup.add(backBowGroup);

  // 6. Left Arm (Bow-holding arm)
  const leftArm = new THREE.Group();
  leftArm.position.set(0.18, 0.28, 0);
  torsoGroup.add(leftArm);

  const leftShoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), skinMat);
  const leftBicepMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.24, 10), skinMat);
  leftBicepMesh.position.y = -0.12;
  leftArm.add(leftShoulderMesh, leftBicepMesh);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.24, 0);
  leftArm.add(leftElbow);

  // Left Forearm with scale-patterned Archer's Vambrace/Bracer
  const leftForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.035, 0.22, 12), harnessLeatherMat);
  leftForearmMesh.position.y = -0.11;
  leftElbow.add(leftForearmMesh);

  const leftWrist = new THREE.Group();
  leftWrist.position.set(0, -0.22, 0);
  leftElbow.add(leftWrist);

  const leftHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.028), harnessLeatherMat);
  leftHandMesh.position.y = -0.03;
  leftWrist.add(leftHandMesh);

  // Bow in hand (active when shooting)
  const { group: handBowGroup } = buildElvenRecurveBow(mats);
  handBowGroup.scale.setScalar(0.92);
  handBowGroup.rotation.set(0, Math.PI / 2, 0);
  handBowGroup.position.set(0, -0.04, 0.02);
  handBowGroup.visible = false;
  leftWrist.add(handBowGroup);

  // 7. Right Arm (Arrow drawing arm)
  const rightArm = new THREE.Group();
  rightArm.position.set(-0.18, 0.28, 0);
  torsoGroup.add(rightArm);

  const rightShoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), skinMat);
  const rightBicepMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.24, 10), skinMat);
  rightBicepMesh.position.y = -0.12;
  rightArm.add(rightShoulderMesh, rightBicepMesh);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.24, 0);
  rightArm.add(rightElbow);

  const rightForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.22, 10), harnessLeatherMat);
  rightForearmMesh.position.y = -0.11;
  rightElbow.add(rightForearmMesh);

  const rightWrist = new THREE.Group();
  rightWrist.position.set(0, -0.22, 0);
  rightElbow.add(rightWrist);

  const rightHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.028), harnessLeatherMat);
  rightHandMesh.position.y = -0.03;
  rightWrist.add(rightHandMesh);

  // Arrow held in right drawing fingers
  const nockedArrowMesh = buildArrowMesh();
  nockedArrowMesh.scale.setScalar(0.9);
  nockedArrowMesh.position.set(0, -0.03, 0.40);
  nockedArrowMesh.visible = false;
  rightWrist.add(nockedArrowMesh);

  // 8. Legs & Laced Ranger Boots
  const leftLeg = new THREE.Group();
  leftLeg.position.set(0.10, -0.08, 0);
  pelvisGroup.add(leftLeg);

  const leftThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.052, 0.42, 12), pantsLeatherMat);
  leftThighMesh.position.y = -0.21;
  leftLeg.add(leftThighMesh);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.42, 0);
  leftLeg.add(leftKnee);

  // High laced boots
  const leftShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.044, 0.44, 12), harnessLeatherMat);
  leftShinMesh.position.y = -0.22;
  leftKnee.add(leftShinMesh);

  const leftAnkle = new THREE.Group();
  leftAnkle.position.set(0, -0.44, 0);
  leftKnee.add(leftAnkle);

  const leftFootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.16), harnessLeatherMat);
  leftFootMesh.position.set(0, -0.03, 0.04);
  leftAnkle.add(leftFootMesh);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(-0.10, -0.08, 0);
  pelvisGroup.add(rightLeg);

  const rightThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.052, 0.42, 12), pantsLeatherMat);
  rightThighMesh.position.y = -0.21;
  rightLeg.add(rightThighMesh);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.42, 0);
  rightLeg.add(rightKnee);

  const rightShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.044, 0.44, 12), harnessLeatherMat);
  rightShinMesh.position.y = -0.22;
  rightKnee.add(rightShinMesh);

  const rightAnkle = new THREE.Group();
  rightAnkle.position.set(0, -0.44, 0);
  rightKnee.add(rightAnkle);

  const rightFootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.16), harnessLeatherMat);
  rightFootMesh.position.set(0, -0.03, 0.04);
  rightAnkle.add(rightFootMesh);

  // 9. Floating Cloak / Cowl Tails behind her
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.32, -0.12);
  torsoGroup.add(capePivot);

  const capeGeo = new THREE.PlaneGeometry(0.36, 0.72, 8, 12);
  capeGeo.translate(0, -0.36, 0);
  const capeBasePositions = capeGeo.attributes.position.array.slice() as Float32Array;
  const capeMesh = new THREE.Mesh(capeGeo, hoodMat);
  capeMesh.castShadow = true;
  capePivot.add(capeMesh);

  return {
    root,
    bodyGroup,
    pelvisGroup,
    torsoGroup,
    headGroup,
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
    leftWrist,
    rightWrist,
    capePivot,
    capeGeo,
    capeBasePositions,
    quiverGroup,
    backBowGroup,
    handBowGroup,
    nockedArrowMesh,
    bowStringLine: stringLine,
    bowStringGeo: stringGeo,
    shadowDisc,
  };
}

/**
 * Animates the Elven Archer's gait and fluid bow draw & loose mechanics.
 */
export function animateArcherGait(
  rig: ArcherRig,
  speed: number,
  walkPhase: number,
  elapsed: number,
  dt: number,
  attack: HeroAttackAnimState,
  onShootArrow?: () => void,
): void {
  const isMoving = speed > 0.25;
  const normSpd = Math.min(1.0, speed / 7.2);
  const isAttacking = attack.timer > 0;
  const attackProgress = isAttacking
    ? 1 - Math.max(0, Math.min(1, attack.timer / attack.duration))
    : 0;

  // 1. Lower Body Gait
  if (isMoving) {
    const sinP = Math.sin(walkPhase);
    const cosP = Math.cos(walkPhase);

    rig.leftLeg.rotation.x = -sinP * 0.54 * normSpd;
    rig.rightLeg.rotation.x = sinP * 0.54 * normSpd;

    rig.leftKnee.rotation.x = Math.max(0.06, (sinP > 0 ? sinP * 0.70 : -sinP * 0.24) * normSpd + 0.08);
    rig.rightKnee.rotation.x = Math.max(0.06, (sinP < 0 ? -sinP * 0.70 : sinP * 0.24) * normSpd + 0.08);

    rig.leftAnkle.rotation.x = cosP * 0.22 * normSpd;
    rig.rightAnkle.rotation.x = -cosP * 0.22 * normSpd;

    rig.pelvisGroup.position.y = 0.92 + Math.abs(sinP) * 0.035 * normSpd;
    rig.pelvisGroup.rotation.y = sinP * 0.12 * normSpd;
    rig.pelvisGroup.rotation.z = cosP * 0.04 * normSpd;
  } else {
    const breathe = Math.sin(elapsed * 2.2);
    rig.leftLeg.rotation.set(0.03, 0, 0.02);
    rig.rightLeg.rotation.set(-0.03, 0, -0.02);
    rig.leftKnee.rotation.set(0.04, 0, 0);
    rig.rightKnee.rotation.set(0.04, 0, 0);
    rig.leftAnkle.rotation.set(0, 0, 0);
    rig.rightAnkle.rotation.set(0, 0, 0);
    rig.pelvisGroup.position.y = 0.92 + breathe * 0.008;
    rig.pelvisGroup.rotation.set(0, 0, 0);
  }

  // 2. Cloak wind flutter
  const capePos = rig.capeGeo.attributes.position;
  for (let i = 0; i < capePos.count; i++) {
    const baseZ = rig.capeBasePositions[i * 3 + 2];
    const y = rig.capeBasePositions[i * 3 + 1];
    const drop = Math.abs(y);
    const wave = Math.sin(elapsed * 5.5 + y * 4.2) * 0.045 * drop * (1.0 + normSpd * 1.5);
    capePos.setZ(i, baseZ - drop * normSpd * 0.22 + wave);
  }
  rig.capeGeo.computeVertexNormals();
  capePos.needsUpdate = true;

  // 3. Upper Body & Bow Draw / Loose Mechanic
  if (isAttacking) {
    // Bow is in left hand, back bow is hidden!
    rig.backBowGroup.visible = false;
    rig.handBowGroup.visible = true;

    // Attack phase:
    // 0.0 -> 0.35: Draw arrow from quiver, raise bow
    // 0.35 -> 0.65: Full draw, aim at target, string pulled taut
    // 0.65: Release arrow (fires projectile)!
    // 0.65 -> 1.0: Recoil / loose follow-through, bow returns
    const p = attackProgress;

    // Torso aims slightly sideways into archer stance
    rig.torsoGroup.rotation.y = -0.75 + Math.sin(p * Math.PI) * 0.15;
    rig.torsoGroup.rotation.x = -0.05;
    rig.headGroup.rotation.y = 0.72; // Head looks toward arrow target

    // Left Arm holds bow firmly forward
    rig.leftArm.rotation.set(-1.45, 0.35, -0.25);
    rig.leftElbow.rotation.set(-0.15, 0, 0);
    rig.leftWrist.rotation.set(0.2, 0.4, 0);

    if (p < 0.65) {
      // Drawing arrow back to cheek
      const drawT = p / 0.65;
      rig.rightArm.rotation.set(-1.10 * drawT, -0.65 * drawT, 0.45 * drawT);
      rig.rightElbow.rotation.set(-1.40 * drawT, 0, 0);
      rig.nockedArrowMesh.visible = true;
      // Position nocked arrow extending along bow
      rig.nockedArrowMesh.position.set(0, -0.02, 0.15 + (1 - drawT) * 0.25);
    } else {
      // Loose / follow-through
      const looseT = (p - 0.65) / 0.35;
      rig.rightArm.rotation.set(-1.10 + looseT * 0.45, -0.65 - looseT * 0.35, 0.45);
      rig.rightElbow.rotation.set(-1.40 + looseT * 0.6, 0, 0);
      rig.nockedArrowMesh.visible = false; // Arrow has flown!

      // Trigger projectile spawn once at loose frame
      if (onShootArrow && !attack.drawHoldTimer) {
        attack.drawHoldTimer = 1;
        onShootArrow();
      }
    }
  } else {
    // Idle / Running: Bow on back, arms swing naturally
    rig.backBowGroup.visible = true;
    rig.handBowGroup.visible = false;
    rig.nockedArrowMesh.visible = false;
    attack.drawHoldTimer = 0;

    rig.headGroup.rotation.set(0, 0, 0);
    rig.torsoGroup.rotation.set(isMoving ? 0.08 * normSpd : 0, 0, 0);

    if (isMoving) {
      const sinP = Math.sin(walkPhase);
      rig.leftArm.rotation.set(sinP * 0.42 * normSpd, 0, -0.15);
      rig.leftElbow.rotation.set(-0.25 - Math.max(0, -sinP) * 0.2, 0, 0);
      rig.rightArm.rotation.set(-sinP * 0.42 * normSpd, 0, 0.15);
      rig.rightElbow.rotation.set(-0.25 - Math.max(0, sinP) * 0.2, 0, 0);
    } else {
      const breathe = Math.sin(elapsed * 2.2);
      rig.leftArm.rotation.set(0.04, 0, -0.18 + breathe * 0.015);
      rig.leftElbow.rotation.set(-0.16, 0, 0);
      rig.rightArm.rotation.set(0.04, 0, 0.18 - breathe * 0.015);
      rig.rightElbow.rotation.set(-0.16, 0, 0);
    }
  }
}
