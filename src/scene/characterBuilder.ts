import * as THREE from 'three';
import {
  FIELD_MOB_SPAWNS,
  MOB_TEMPLATES,
  MobCombatEntity,
  MobKind,
} from '../world/combat';
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
}

function addRealisticEyesAndBrows(
  headGroup: THREE.Group,
  irisColor: number,
  browColor: number,
  scale = 1.0,
): void {
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xebe6de, roughness: 0.35 });
  scleraMat.userData.pbrSkip = true;
  const irisMat = new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.25 });
  irisMat.userData.pbrSkip = true;
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0d1016 });
  const browMat = new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.78 });
  browMat.userData.pbrSkip = true;

  for (const s of [-1, 1]) {
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.017 * scale, 10, 8),
      scleraMat,
    );
    sclera.scale.set(1.25, 0.72, 0.45);
    sclera.position.set(s * 0.048 * scale, 0.012 * scale, 0.125 * scale);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.010 * scale, 10, 8),
      irisMat,
    );
    iris.scale.set(1.0, 1.0, 0.5);
    iris.position.set(s * 0.048 * scale, 0.012 * scale, 0.130 * scale);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.0055 * scale, 8, 6),
      pupilMat,
    );
    pupil.scale.set(1.0, 1.0, 0.5);
    pupil.position.set(s * 0.048 * scale, 0.012 * scale, 0.133 * scale);

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.044 * scale, 0.0085 * scale, 0.016 * scale),
      browMat,
    );
    brow.position.set(s * 0.048 * scale, 0.032 * scale, 0.132 * scale);
    brow.rotation.z = -s * 0.10;

    headGroup.add(sclera, iris, pupil, brow);
  }
}

function buildGreatswordMesh(
  mats: PronteraMaterials,
  leatherMat: THREE.Material,
  bladeLength = 1.08,
): THREE.Group {
  const sword = new THREE.Group();

  // Long dark leather two-handed grip
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.023, 0.30, 12),
    leatherMat,
  );
  grip.castShadow = true;

  // Faceted dark-steel pommel
  const pommel = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.034, 0),
    mats.darkSteel,
  );
  pommel.scale.set(1.0, 1.35, 0.85);
  pommel.position.y = -0.175;

  // Wide gothic crossguard (slightly swept arms)
  const guardCenter = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.036, 0.044),
    mats.darkSteel,
  );
  guardCenter.position.y = 0.16;

  for (const s of [-1, 1]) {
    const quillon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.014, 0.145, 8),
      mats.darkSteel,
    );
    quillon.rotation.z = s * (Math.PI * 0.44);
    quillon.position.set(s * 0.088, 0.175, 0);
    sword.add(quillon);
  }

  // Broad steel blade with beveled central fuller
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, bladeLength, 0.014),
    mats.steelArmor,
  );
  blade.position.y = 0.16 + bladeLength * 0.5;
  blade.castShadow = true;

  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, bladeLength * 0.78, 0.018),
    mats.darkSteel,
  );
  fuller.position.y = 0.16 + bladeLength * 0.44;

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.038, 0.16, 4),
    mats.steelArmor,
  );
  tip.rotation.y = Math.PI / 4;
  tip.scale.set(1.2, 1.0, 0.28);
  tip.position.y = 0.16 + bladeLength + 0.08;

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

  // Realistic Dark-Fantasy Knight / Swordsman Material Palette (matching reference)
  const linenSleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0x9c988e,
    roughness: 0.86,
    metalness: 0.02,
    sheen: 0.45,
    sheenRoughness: 0.65,
  });
  linenSleeveMat.userData.pbrKind = 'cloth';

  const trouserMat = new THREE.MeshStandardMaterial({
    color: 0x332720,
    roughness: 0.88,
    metalness: 0.03,
  });
  trouserMat.userData.pbrKind = 'cloth';

  const darkLeatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x201916,
    roughness: 0.54,
    metalness: 0.10,
    clearcoat: 0.16,
    clearcoatRoughness: 0.50,
  });
  darkLeatherMat.userData.pbrKind = 'leather';

  const collarCrimsonMat = new THREE.MeshStandardMaterial({
    color: 0x45181a,
    roughness: 0.78,
    metalness: 0.04,
  });
  collarCrimsonMat.userData.pbrKind = 'cloth';

  const silverTrimMat = new THREE.MeshStandardMaterial({
    color: 0x8e96a3,
    roughness: 0.36,
    metalness: 0.78,
  });
  silverTrimMat.userData.pbrKind = 'metal';

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9ad8e,
    roughness: 0.58,
    metalness: 0.02,
    sheen: 0.22,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xffb599),
  });
  skinMat.userData.pbrKind = 'skin';

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x251a14,
    roughness: 0.72,
    metalness: 0.06,
  });
  hairMat.userData.pbrKind = 'cloth';

  // 1. Realistic Proportioned Legs (Hip at y = 0.90, total character height ~ 1.88m)
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.125, 0.90, 0);

    // Thigh (dark umber trousers)
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.076, 0.44, 18),
      trouserMat,
    );
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);

    // Knee joint
    const knee = new THREE.Mesh(
      new THREE.SphereGeometry(0.074, 14, 12),
      trouserMat,
    );
    knee.position.y = -0.44;
    leg.add(knee);

    // Tall laced dark leather adventurer boots (knee-high!)
    const bootUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.068, 0.40, 18),
      darkLeatherMat,
    );
    bootUpper.position.y = -0.63;
    bootUpper.castShadow = true;
    leg.add(bootUpper);

    // Boot cuff & buckled straps
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.087, 0.084, 0.065, 18),
      darkLeatherMat,
    );
    cuff.position.y = -0.46;
    leg.add(cuff);

    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.078, 0.011, 8, 18),
      silverTrimMat,
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.y = -0.49;
    leg.add(strap);

    // Sculpted leather boot foot + sole
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.115, 0.082, 0.245),
      darkLeatherMat,
    );
    foot.position.set(0, -0.845, 0.048);
    foot.castShadow = true;
    leg.add(foot);

    const toeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      darkLeatherMat,
    );
    toeCap.scale.set(0.95, 0.72, 1.35);
    toeCap.position.set(0, -0.855, 0.145);
    leg.add(toeCap);

    return leg;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyGroup.add(leftLeg, rightLeg);

  // 2. Quilted Studded Charcoal Leather Brigandine Chest (LatheGeometry, y = 0.86..1.48)
  const chestProfile = [
    new THREE.Vector2(0.0, 0.86),
    new THREE.Vector2(0.185, 0.86),
    new THREE.Vector2(0.172, 1.02), // athletic tapered waist
    new THREE.Vector2(0.215, 1.24), // muscular ribcage
    new THREE.Vector2(0.235, 1.38), // broad shoulders
    new THREE.Vector2(0.145, 1.48),
    new THREE.Vector2(0.0, 1.48),
  ];
  const cuirass = new THREE.Mesh(
    new THREE.LatheGeometry(chestProfile, 26),
    mats.quiltedLeather,
  );
  cuirass.scale.set(1.08, 1.0, 0.82);
  cuirass.castShadow = true;
  bodyGroup.add(cuirass);

  // High crimson-lined stand collar
  const standCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.138, 0.085, 20, 1, true),
    collarCrimsonMat,
  );
  standCollar.position.y = 1.49;
  bodyGroup.add(standCollar);

  // Diagonal leather cross-chest baldric strap + central Silver Lion Medallion Clasp!
  const baldricCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.17, 1.43, 0.12),
    new THREE.Vector3(0.0, 1.23, 0.185),
    new THREE.Vector3(-0.19, 0.96, 0.13),
    new THREE.Vector3(-0.18, 0.94, -0.15),
    new THREE.Vector3(0.02, 1.18, -0.185),
    new THREE.Vector3(0.18, 1.42, -0.11),
  ]);
  const baldric = new THREE.Mesh(
    new THREE.TubeGeometry(baldricCurve, 28, 0.022, 8, true),
    darkLeatherMat,
  );
  baldric.scale.set(1.0, 1.0, 0.85);
  bodyGroup.add(baldric);

  const chestMedallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.024, 20),
    mats.steelArmor,
  );
  chestMedallion.rotation.x = Math.PI / 2;
  chestMedallion.position.set(0, 1.24, 0.182);
  bodyGroup.add(chestMedallion);

  const medallionRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.056, 0.008, 8, 20),
    silverTrimMat,
  );
  medallionRing.position.set(0, 1.24, 0.195);
  bodyGroup.add(medallionRing);

  // 3. Double Heavy Leather Waist Belts + Buckle + Hanging Steel Hip Chain
  const mainBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.185, 0.195, 0.075, 24),
    darkLeatherMat,
  );
  mainBelt.scale.set(1.08, 1.0, 0.84);
  mainBelt.position.y = 0.98;
  bodyGroup.add(mainBelt);

  const beltBuckle = new THREE.Mesh(
    new THREE.TorusGeometry(0.042, 0.011, 8, 14),
    mats.steelArmor,
  );
  beltBuckle.position.set(0.02, 0.98, 0.168);
  bodyGroup.add(beltBuckle);

  // Slanted secondary sword-belt + buckle
  const subBelt = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.022, 8, 24),
    darkLeatherMat,
  );
  subBelt.scale.set(1.09, 0.86, 1.0);
  subBelt.rotation.x = Math.PI / 2 + 0.16;
  subBelt.rotation.y = -0.14;
  subBelt.position.y = 0.90;
  bodyGroup.add(subBelt);

  // Hanging silver hip chain on right side
  const chainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.175, 0.95, 0.08),
    new THREE.Vector3(0.215, 0.78, 0.02),
    new THREE.Vector3(0.185, 0.84, -0.12),
  ]);
  const hipChain = new THREE.Mesh(
    new THREE.TubeGeometry(chainCurve, 14, 0.008, 6, false),
    silverTrimMat,
  );
  bodyGroup.add(hipChain);

  // 4. Long Split Obsidian/Charcoal Coat Skirt (open front showing trousers & boots!)
  const coatSkirtGeo = new THREE.CylinderGeometry(
    0.195,
    0.34,
    0.72,
    24,
    4,
    true,
    Math.PI * 0.22,
    Math.PI * 1.56,
  );
  const coatSkirt = new THREE.Mesh(coatSkirtGeo, mats.darkCoat);
  coatSkirt.scale.set(1.08, 1.0, 0.88);
  coatSkirt.position.y = 0.60;
  coatSkirt.castShadow = true;
  bodyGroup.add(coatSkirt);

  // Subtle silver filigree border trim along bottom coat hem
  const coatHemTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.335,
      0.343,
      0.035,
      24,
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

  // 5. Asymmetric Layered Dark-Steel Pauldron (Right Shoulder) + Left Leather/Steel Trim
  const rightPauldron = new THREE.Group();
  rightPauldron.position.set(0.245, 1.38, 0);
  rightPauldron.rotation.z = -0.36;

  for (let lame = 0; lame < 3; lame++) {
    const r = 0.125 - lame * 0.012;
    const plate = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      mats.darkSteel,
    );
    plate.scale.set(1.06, 0.88, 1.12);
    plate.position.set(lame * 0.016, -lame * 0.048, 0);
    plate.castShadow = true;
    rightPauldron.add(plate);
  }
  const pauldronRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.118, 0.011, 8, 18),
    silverTrimMat,
  );
  pauldronRim.rotation.x = Math.PI / 2;
  pauldronRim.position.y = -0.01;
  rightPauldron.add(pauldronRim);
  bodyGroup.add(rightPauldron);

  const leftShoulderCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    darkLeatherMat,
  );
  leftShoulderCap.position.set(-0.235, 1.36, 0);
  leftShoulderCap.rotation.z = 0.36;
  leftShoulderCap.castShadow = true;
  bodyGroup.add(leftShoulderCap);

  // 6. Articulated Arms: Crinkled Linen Sleeves, Steel Elbow Poleyns, Dark Steel Vambraces & Gauntlets
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.245, 1.34, 0);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.056, 0.26, 16),
      linenSleeveMat,
    );
    sleeve.position.y = -0.14;
    sleeve.castShadow = true;
    arm.add(sleeve);

    // Crinkled fabric band at elbow
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.066, 14, 12),
      mats.darkSteel,
    );
    elbow.scale.set(1.0, 1.0, 1.15);
    elbow.position.set(0, -0.27, -0.01);
    elbow.castShadow = true;
    arm.add(elbow);

    // Dark-steel articulated vambrace / bracer
    const vambrace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.048, 0.24, 16),
      mats.darkSteel,
    );
    vambrace.position.y = -0.40;
    vambrace.castShadow = true;
    arm.add(vambrace);

    // Plated fingerless gauntlet hand
    const gauntlet = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.095, 0.082),
      darkLeatherMat,
    );
    gauntlet.position.y = -0.54;
    arm.add(gauntlet);

    const knucklePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.076, 0.042, 0.052),
      mats.darkSteel,
    );
    knucklePlate.position.set(0, -0.53, 0.024);
    arm.add(knucklePlate);

    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  bodyGroup.add(leftArm, rightArm);

  // Hidden/minimal back cape rig (kept compatible with HeroRig interface, flat dark trim)
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 1.38, -0.16);
  const capeGeo = new THREE.PlaneGeometry(0.32, 0.32, 4, 4);
  const capeBasePositions = new Float32Array(capeGeo.attributes.position.array);
  bodyGroup.add(capePivot);

  // 7. Two-Handed Greatsword (Back-Slung at Rest + Hand-Drawn During Combat!)
  const backSwordGroup = new THREE.Group();
  backSwordGroup.position.set(0.02, 1.05, -0.19);
  backSwordGroup.rotation.z = -0.48;
  backSwordGroup.rotation.x = 0.08;

  const backScabbard = new THREE.Mesh(
    new THREE.BoxGeometry(0.074, 1.06, 0.036),
    darkLeatherMat,
  );
  backScabbard.position.y = -0.16;
  const backChape = new THREE.Mesh(
    new THREE.ConeGeometry(0.038, 0.12, 4),
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

  // 8. Sleek Metallic Steel Slash Crescent Trail
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

  // 9. Realistic Sculpted Male Head (1:7.5 proportion, sculpted jawline, beard & wavy dark hair)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.66, 0.01);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.068, 0.14, 14),
    skinMat,
  );
  neck.position.y = -0.14;
  headGroup.add(neck);

  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.132, 22, 18),
    skinMat,
  );
  cranium.scale.set(0.90, 1.08, 0.96);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Sculpted jawline & light groomed dark beard
  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.114, 16, 12),
    hairMat,
  );
  jaw.scale.set(0.86, 0.72, 0.92);
  jaw.position.set(0, -0.056, 0.018);
  headGroup.add(jaw);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.016, 0.048, 8),
    skinMat,
  );
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, -0.010, 0.135);
  headGroup.add(nose);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), skinMat);
    ear.scale.set(0.42, 1.15, 0.72);
    ear.position.set(s * 0.122, -0.008, -0.005);
    headGroup.add(ear);
  }

  addRealisticEyesAndBrows(headGroup, 0x3a4a5e, 0x1d140f, 1.0);

  // Tousled wavy dark brown hair (swept curves framing forehead and nape — zero anime spikes)
  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.140, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.64),
    hairMat,
  );
  hairTop.scale.set(0.94, 1.05, 1.0);
  hairTop.rotation.x = -0.20;
  hairTop.castShadow = true;
  headGroup.add(hairTop);

  const waveLocks: [number, number, number, number][] = [
    [-0.075, 0.085, 0.095, -0.25],
    [-0.015, 0.105, 0.105, 0.12],
    [0.065, 0.09, 0.098, 0.35],
    [-0.115, 0.045, 0.03, -0.55],
    [0.115, 0.045, 0.03, 0.55],
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
      new THREE.TubeGeometry(curve, 8, 0.025, 7, false),
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

  // Greatsword 3-Hit Combo Swing Animation
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
    new THREE.CircleGeometry(0.68, 24),
    mats.contactShadow,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);

  const tunicMat = new THREE.MeshPhysicalMaterial({
    color: spec.tunicColor,
    roughness: 0.76,
    metalness: 0.08,
    sheen: 0.42,
    sheenRoughness: 0.62,
  });
  tunicMat.userData.pbrKind = 'cloth';
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xd9d2c3,
    roughness: 0.82,
  });
  creamMat.userData.pbrKind = 'cloth';
  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b1d15,
    roughness: 0.58,
    metalness: 0.08,
    clearcoat: 0.12,
  });
  leatherMat.userData.pbrKind = 'leather';
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xdcb193,
    roughness: 0.58,
  });
  skinMat.userData.pbrKind = 'skin';
  const hairMat = new THREE.MeshStandardMaterial({
    color: spec.hairColor,
    roughness: 0.72,
  });
  hairMat.userData.pbrKind = 'cloth';

  // Realistic Adult Medieval RPG Proportions (~1.78m tall, 1:7.2 head ratio)
  // Legs & Leather Boots (0..0.84)
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.066, 0.50, 14),
      leatherMat,
    );
    leg.position.set(s * 0.11, 0.58, 0);
    leg.castShadow = true;
    const boot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.062, 0.34, 14),
      leatherMat,
    );
    boot.position.set(s * 0.11, 0.18, 0);
    boot.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.075, 0.21), leatherMat);
    foot.position.set(s * 0.11, 0.04, 0.04);
    g.add(leg, boot, foot);
  }

  // Tailored Medieval Coat / Tunic Skirt + Fitted Torso (0.42..1.42)
  const coatProfile = [
    new THREE.Vector2(0.0, 0.34),
    new THREE.Vector2(0.28, 0.34),
    new THREE.Vector2(0.22, 0.74),
    new THREE.Vector2(0.175, 0.96),
    new THREE.Vector2(0.215, 1.24),
    new THREE.Vector2(0.145, 1.40),
    new THREE.Vector2(0.0, 1.40),
  ];
  const coat = new THREE.Mesh(
    new THREE.LatheGeometry(coatProfile, 22),
    spec.hatKind === 'knight' ? mats.quiltedLeather : tunicMat,
  );
  coat.scale.set(1.06, 1.0, 0.84);
  coat.castShadow = true;
  g.add(coat);

  // Leather belt & steel buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.185, 0.195, 0.07, 20),
    leatherMat,
  );
  belt.scale.set(1.06, 1.0, 0.85);
  belt.position.y = 0.95;
  g.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.035), mats.steelArmor);
  buckle.position.set(0, 0.95, 0.165);
  g.add(buckle);

  // Shoulder collar / mantle
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, 0.12, 18),
    spec.hatKind === 'cleric' ? creamMat : leatherMat,
  );
  collar.position.y = 1.36;
  g.add(collar);

  // Articulated Arms + Leather Gloves
  for (const s of [-1, 1]) {
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.052, 0.26, 12),
      spec.hatKind === 'smith' ? creamMat : tunicMat,
    );
    upper.position.set(s * 0.23, 1.18, 0.01);
    upper.rotation.z = s * 0.14;
    upper.castShadow = true;

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.044, 0.24, 12),
      spec.hatKind === 'knight' ? mats.darkSteel : leatherMat,
    );
    forearm.position.set(s * 0.26, 0.95, 0.03);
    forearm.rotation.z = s * 0.10;
    forearm.castShadow = true;

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), skinMat);
    hand.position.set(s * 0.27, 0.82, 0.04);
    g.add(upper, forearm, hand);
  }

  // Realistic Sculpted NPC Head (y = 1.56, radius = 0.13)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0.01);
  g.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.12, 12), skinMat);
  neck.position.y = -0.12;
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.126, 20, 16), skinMat);
  head.scale.set(0.90, 1.08, 0.95);
  head.castShadow = true;
  headGroup.add(head);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 8), skinMat);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, -0.01, 0.128);
  headGroup.add(nose);

  const irisHex = spec.hatKind === 'cleric' ? 0x3a6e7c : 0x33261d;
  addRealisticEyesAndBrows(headGroup, irisHex, spec.hairColor, 0.95);

  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.134, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
    hairMat,
  );
  hairCrown.scale.set(0.94, 1.04, 1.0);
  hairCrown.rotation.x = -0.20;
  headGroup.add(hairCrown);

  // Distinct Realistic Role Attire & Gear
  if (spec.hatKind === 'kafra') {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 0.03), creamMat);
    apron.position.set(0, 0.66, 0.185);
    apron.rotation.x = -0.10;
    const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), hairMat);
    hairBun.position.set(0, 0.05, -0.12);
    const circlet = new THREE.Mesh(
      new THREE.TorusGeometry(0.128, 0.015, 8, 18, Math.PI),
      creamMat,
    );
    circlet.position.set(0, 0.08, 0.03);
    const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.045), mats.carpetRoyal);
    ledger.position.set(0.24, 0.88, 0.16);
    ledger.rotation.x = -0.42;
    headGroup.add(hairBun, circlet);
    g.add(apron, ledger);
  } else if (spec.hatKind === 'knight') {
    const steelChest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.195, 0.34, 20),
      mats.darkSteel,
    );
    steelChest.scale.set(1.06, 1.0, 0.86);
    steelChest.position.y = 1.18;
    for (const s of [-1, 1]) {
      const pauldron = new THREE.Mesh(
        new THREE.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mats.darkSteel,
      );
      pauldron.position.set(s * 0.23, 1.32, 0);
      pauldron.rotation.z = -s * 0.35;
      g.add(pauldron);
    }
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      mats.darkSteel,
    );
    helm.position.y = 0.02;
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 8), mats.carpetRoyal);
    crest.position.set(0, 0.18, -0.02);
    headGroup.add(helm, crest);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 2.25, 10),
      mats.darkTimber,
    );
    pole.position.set(0.32, 1.12, 0.08);
    const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.34, 6), mats.steelArmor);
    spearHead.position.set(0.32, 2.34, 0.08);
    g.add(steelChest, pole, spearHead);
  } else if (spec.hatKind === 'cleric') {
    const stole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.03), mats.goldTrim);
    stole.position.set(0, 0.86, 0.175);
    const veil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.24, 16, 1, true, -Math.PI * 0.65, Math.PI * 1.3),
      creamMat,
    );
    veil.position.set(0, 0.02, -0.02);
    headGroup.add(veil);

    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 1.85, 10),
      mats.oakWood,
    );
    staff.position.set(0.30, 0.92, 0.06);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), mats.goldTrim);
    orb.position.set(0.30, 1.90, 0.06);
    g.add(stole, staff, orb);
  } else if (spec.hatKind === 'merchant') {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), hairMat);
    beard.scale.set(0.84, 0.72, 0.9);
    beard.position.set(0, -0.055, 0.015);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.30, 0.028, 20),
      leatherMat,
    );
    brim.position.y = 0.095;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.145, 0.13, 18),
      leatherMat,
    );
    crown.position.y = 0.165;
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.18, 6), mats.goldTrim);
    feather.position.set(0.13, 0.18, 0.02);
    feather.rotation.z = -0.45;
    headGroup.add(beard, brim, crown, feather);
  } else if (spec.hatKind === 'smith') {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 10), hairMat);
    beard.scale.set(0.86, 0.78, 0.92);
    beard.position.set(0, -0.058, 0.015);
    headGroup.add(beard);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.72, 0.045), leatherMat);
    apron.position.set(0, 0.72, 0.175);
    const hammerHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, 0.68, 10),
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

function buildSlimeMesh(
  kind: MobKind,
  color: number,
  bodyGeo: THREE.LatheGeometry,
  coreGeo: THREE.SphereGeometry,
  eyeGeo: THREE.SphereGeometry,
  eyeMat: THREE.MeshBasicMaterial,
): { bodyMesh: THREE.Group; jellyMat: THREE.MeshPhysicalMaterial } {
  const bodyMesh = new THREE.Group();
  const jellyMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.12,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.86,
    envMapIntensity: 1.35,
  });
  jellyMat.userData.pbrKind = 'slime';

  const shell = new THREE.Mesh(bodyGeo, jellyMat);
  shell.castShadow = true;
  bodyMesh.add(shell);

  const coreMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.36;
  bodyMesh.add(core);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.9, 1.35, 0.6);
    eye.position.set(side * 0.15, 0.42, 0.47);
    bodyMesh.add(eye);
  }

  if (kind === 'poporing' || kind === 'drops') {
    const stem = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.16, 8),
      jellyMat,
    );
    stem.position.set(0, 1.05, 0);
    stem.rotation.z = 0.25;
    bodyMesh.add(stem);
  }

  return { bodyMesh, jellyMat };
}

function buildLunaticMesh(): {
  bodyMesh: THREE.Group;
  furMat: THREE.MeshStandardMaterial;
} {
  const bodyMesh = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({
    color: 0xf7f2ea,
    roughness: 0.78,
    metalness: 0.02,
  });
  furMat.userData.pbrKind = 'cloth';
  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xf09bb0,
    roughness: 0.6,
  });
  pinkMat.userData.pbrKind = 'skin';
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e1318 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 16), furMat);
  body.scale.set(0.95, 0.92, 1.15);
  body.position.set(0, 0.40, 0);
  body.castShadow = true;
  bodyMesh.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 16), furMat);
  head.position.set(0, 0.76, 0.22);
  head.castShadow = true;
  bodyMesh.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 6, 10), furMat);
    ear.position.set(side * 0.15, 1.18, 0.16);
    ear.rotation.z = -side * 0.22;
    ear.rotation.x = -0.15;
    ear.castShadow = true;
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.26, 4, 8), pinkMat);
    inner.position.set(side * 0.15, 1.17, 0.205);
    inner.rotation.z = -side * 0.22;
    inner.rotation.x = -0.15;
    bodyMesh.add(ear, inner);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), eyeMat);
    eye.position.set(side * 0.115, 0.80, 0.49);
    bodyMesh.add(eye);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), pinkMat);
  nose.position.set(0, 0.72, 0.53);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), furMat);
  tail.position.set(0, 0.38, -0.48);
  bodyMesh.add(nose, tail);

  return { bodyMesh, furMat };
}

export function buildFieldMobs(mats: PronteraMaterials): {
  group: THREE.Group;
  actors: MobActor[];
  hitTargets: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const actors: MobActor[] = [];
  const hitTargets: THREE.Mesh[] = [];

  const slimeProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.45, 0.02),
    new THREE.Vector2(0.56, 0.2),
    new THREE.Vector2(0.52, 0.45),
    new THREE.Vector2(0.35, 0.72),
    new THREE.Vector2(0.14, 0.92),
    new THREE.Vector2(0.0, 1.02),
  ];
  const bodyGeo = new THREE.LatheGeometry(slimeProfile, 26);
  const coreGeo = new THREE.SphereGeometry(0.22, 14, 12);
  const shadowGeo = new THREE.CircleGeometry(0.58, 20);
  const eyeGeo = new THREE.SphereGeometry(0.044, 10, 10);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18101c });
  const hitSphereGeo = new THREE.SphereGeometry(0.95, 10, 8);
  const hitSphereMat = new THREE.MeshBasicMaterial({
    visible: false,
  });

  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x121620, side: THREE.DoubleSide });
  const hpFillGeo = new THREE.PlaneGeometry(1.06, 0.11);
  hpFillGeo.translate(0.53, 0, 0);

  FIELD_MOB_SPAWNS.forEach((spawn, idx) => {
    const tpl = MOB_TEMPLATES[spawn.kind];
    const mobGroup = new THREE.Group();
    mobGroup.position.set(spawn.x, 0, spawn.z);

    let bodyMesh: THREE.Group;
    let jellyMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

    if (spawn.kind === 'lunatic') {
      const built = buildLunaticMesh();
      bodyMesh = built.bodyMesh;
      jellyMat = built.furMat;
    } else {
      const built = buildSlimeMesh(
        spawn.kind,
        tpl.color,
        bodyGeo,
        coreGeo,
        eyeGeo,
        eyeMat,
      );
      bodyMesh = built.bodyMesh;
      jellyMat = built.jellyMat;
    }
    bodyMesh.scale.setScalar(tpl.scale);

    const shadowMesh = new THREE.Mesh(shadowGeo, mats.contactShadow);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.025;
    shadowMesh.scale.setScalar(tpl.scale);

    const hitTarget = new THREE.Mesh(hitSphereGeo, hitSphereMat);
    hitTarget.position.set(0, 0.58, 0);
    hitTarget.userData = { mobId: spawn.id };
    hitTargets.push(hitTarget);

    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, 1.48 * tpl.scale, 0);
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
    });
  });

  return { group, actors, hitTargets };
}
