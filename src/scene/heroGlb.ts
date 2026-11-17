import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HeroAttackAnimState, HeroWeaponId } from './characterBuilder';

export const HERO_MODEL_URL = '/models/elven_swordsman_animated.glb';
const HERO_TARGET_HEIGHT = 1.86;

const BONE_NAME_FALLBACKS = {
  pelvis: ['Hips', 'mixamorig:Hips', 'mixamorigHips'],
  torso: ['Chest', 'Spine', 'mixamorig:Spine1', 'mixamorigSpine1'],
  head: ['Head', 'mixamorig:Head', 'mixamorigHead'],
  leftLeg: ['UpperLeg.L', 'UpperLeg_L', 'mixamorig:LeftUpLeg', 'mixamorigLeftUpLeg'],
  leftKnee: ['LowerLeg.L', 'LowerLeg_L', 'mixamorig:LeftLeg', 'mixamorigLeftLeg'],
  leftAnkle: ['Foot.L', 'Foot_L', 'mixamorig:LeftFoot', 'mixamorigLeftFoot'],
  rightLeg: ['UpperLeg.R', 'UpperLeg_R', 'mixamorig:RightUpLeg', 'mixamorigRightUpLeg'],
  rightKnee: ['LowerLeg.R', 'LowerLeg_R', 'mixamorig:RightLeg', 'mixamorigRightLeg'],
  rightAnkle: ['Foot.R', 'Foot_R', 'mixamorig:RightFoot', 'mixamorigRightFoot'],
  leftArm: ['UpperArm.L', 'UpperArm_L', 'mixamorig:LeftArm', 'mixamorigLeftArm'],
  leftElbow: ['ForeArm.L', 'ForeArm_L', 'mixamorig:LeftForeArm', 'mixamorigLeftForeArm'],
  rightArm: ['UpperArm.R', 'UpperArm_R', 'mixamorig:RightArm', 'mixamorigRightArm'],
  rightElbow: ['ForeArm.R', 'ForeArm_R', 'mixamorig:RightForeArm', 'mixamorigRightForeArm'],
} as const;

type BoneKey = keyof typeof BONE_NAME_FALLBACKS;

interface HeroBone {
  bone: THREE.Object3D;
  restPos: THREE.Vector3;
  restWorldQ: THREE.Quaternion;
  parentRestWorldQInv: THREE.Quaternion;
  cur: THREE.Vector3;
}

export interface HeroGlbModel {
  root: THREE.Group;
  meshGroup: THREE.Group;
  bones: Record<BoneKey, HeroBone>;
  /** Kotva zbrane v prave ruce - mec se meni pres setGlbWeapon. */
  weaponAnchor: THREE.Group;
  handSwordGroup: THREE.Group;
  backSwordGroup: THREE.Group;
  weaponId: HeroWeaponId;
  mixer?: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  activeAction?: THREE.AnimationAction | null;
  currentActionName?: string;
  lastComboIndex?: number;
  builtinSword?: THREE.Object3D | null;
  hasSkeletalAnimations: boolean;
}

function findBone(scene: THREE.Object3D, candidates: readonly string[]): THREE.Object3D | null {
  for (const name of candidates) {
    const obj = scene.getObjectByName(name) || scene.getObjectByName(name.replace(':', ''));
    if (obj) return obj;
  }
  return null;
}

const GLB_BASE_POSE: Record<BoneKey, THREE.Vector3> = {
  pelvis: new THREE.Vector3(0, 0, 0),
  torso: new THREE.Vector3(0.02, 0, 0),
  head: new THREE.Vector3(0, 0, 0),
  leftLeg: new THREE.Vector3(0, 0, 0),
  leftKnee: new THREE.Vector3(0, 0, 0),
  leftAnkle: new THREE.Vector3(0, 0, 0),
  rightLeg: new THREE.Vector3(0, 0, 0),
  rightKnee: new THREE.Vector3(0, 0, 0),
  rightAnkle: new THREE.Vector3(0, 0, 0),
  leftArm: new THREE.Vector3(0, 0, -1.25),
  leftElbow: new THREE.Vector3(-0.2, 0, 0),
  rightArm: new THREE.Vector3(0, 0, 1.25),
  rightElbow: new THREE.Vector3(-0.2, 0, 0),
};

export async function loadHeroGlb(): Promise<HeroGlbModel> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(HERO_MODEL_URL);
  console.log('Loaded photorealistic animated Elven Swordsman with clips:', gltf.animations?.map((a: any) => a.name));

  const scene = gltf.scene;

  // Compute exact bounding dimensions
  const box = new THREE.Box3().setFromObject(scene);
  const height = box.max.y - box.min.y;
  const s = HERO_TARGET_HEIGHT / (height > 0.01 ? height : 1.0);

  const root = new THREE.Group();
  const meshGroup = new THREE.Group();

  scene.scale.setScalar(s);
  scene.position.set(
    -((box.min.x + box.max.x) / 2) * s,
    -box.min.y * s,
    -((box.min.z + box.max.z) / 2) * s,
  );
  meshGroup.add(scene);
  root.add(meshGroup);

  // High-fidelity PBR material enhancement
  scene.traverse((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mat = mesh.material;
      if (mat) {
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.envMapIntensity = 1.15;
              m.roughness = Math.max(0.24, m.roughness ?? 0.45);
            }
          });
        } else if (mat instanceof THREE.MeshStandardMaterial) {
          mat.envMapIntensity = 1.15;
          mat.roughness = Math.max(0.24, mat.roughness ?? 0.45);
        }
      }
    }
  });

  const swordOld = scene.getObjectByName('Sword');
  if (swordOld) swordOld.visible = false;

  root.updateMatrixWorld(true);
  const sceneQInv = scene.getWorldQuaternion(new THREE.Quaternion()).invert();

  const bones = {} as Record<BoneKey, HeroBone>;
  for (const key of Object.keys(BONE_NAME_FALLBACKS) as BoneKey[]) {
    const candidates = BONE_NAME_FALLBACKS[key];
    const bone = findBone(scene, candidates);
    if (bone) {
      const restWorldQ = sceneQInv.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
      const parentQ = bone.parent
        ? sceneQInv.clone().multiply(bone.parent.getWorldQuaternion(new THREE.Quaternion()))
        : new THREE.Quaternion();
      bones[key] = {
        bone,
        restPos: bone.position.clone(),
        restWorldQ,
        parentRestWorldQInv: parentQ.invert(),
        cur: new THREE.Vector3(),
      };
    }
  }

  // Setup Weapon Anchors (Hand & Back)
  const handBone = findBone(scene, ['Hand.R', 'HandR', 'mixamorig:RightHand', 'mixamorigRightHand']);
  const chestBone = findBone(scene, ['Chest', 'Spine', 'mixamorig:Spine2', 'mixamorig:Spine1']);

  const handSwordGroup = new THREE.Group();
  const backSwordGroup = new THREE.Group();
  const weaponAnchor = new THREE.Group();

  if (handBone) {
    // Weapon sits naturally in palm, blade extends forward along strike axis
    weaponAnchor.position.set(0.01, -0.04, 0.04);
    weaponAnchor.rotation.set(-Math.PI * 0.45, 0.12, -0.22);
    handSwordGroup.add(weaponAnchor);
    handBone.add(handSwordGroup);
    handSwordGroup.visible = false; // Hidden during idle / run, drawn during attack
  }

  if (chestBone) {
    // Greatsword strapped diagonally across back: pommel rises over right shoulder, blade extends down past left hip
    backSwordGroup.position.set(-0.02, 0.12, -0.17);
    backSwordGroup.rotation.set(-0.15, 0.15, 0.52);
    chestBone.add(backSwordGroup);
    backSwordGroup.visible = true; // Visible during idle / run
  }

  const builtinSword = scene.getObjectByName('Swordsman_Sword') || null;

  // Setup AnimationMixer for baked Blender animations
  const mixer = new THREE.AnimationMixer(scene);
  const actions: Record<string, THREE.AnimationAction> = {};
  const hasSkeletalAnimations = Boolean(gltf.animations && gltf.animations.length > 0);

  if (hasSkeletalAnimations) {
    for (const clip of gltf.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
  }

  let activeAction: THREE.AnimationAction | null = null;
  let currentActionName = 'Idle';
  if (actions['Idle']) {
    activeAction = actions['Idle'];
    activeAction.play();
  }

  return {
    root,
    meshGroup,
    bones,
    weaponAnchor,
    handSwordGroup,
    backSwordGroup,
    weaponId: 'greatsword' as HeroWeaponId,
    mixer,
    actions,
    activeAction,
    currentActionName,
    lastComboIndex: -1,
    builtinSword,
    hasSkeletalAnimations,
  };
}

/** Vymeni zbran v ruce a na zadech GLB rytire (kotvy automaticky sleduji kosti). */
export function setGlbWeapon(model: HeroGlbModel, weapon: THREE.Group, id: HeroWeaponId): void {
  while (model.weaponAnchor.children.length > 0) {
    model.weaponAnchor.remove(model.weaponAnchor.children[0]);
  }
  while (model.backSwordGroup.children.length > 0) {
    model.backSwordGroup.remove(model.backSwordGroup.children[0]);
  }

  if (weapon && weapon.children.length > 0) {
    // Hand weapon
    model.weaponAnchor.add(weapon);

    // Back weapon (identical cloned greatsword, inverted so blade points down into scabbard)
    const backWeapon = weapon.clone();
    backWeapon.rotation.z = Math.PI;
    backWeapon.position.y = 0.60;
    backWeapon.scale.setScalar(0.88);
    model.backSwordGroup.add(backWeapon);

    if (model.builtinSword) model.builtinSword.visible = false;
  } else {
    if (model.builtinSword) model.builtinSword.visible = true;
  }
  model.weaponId = id;
}

const _delta = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _final = new THREE.Vector3();

function applyBone(hb: HeroBone, target: THREE.Vector3): void {
  if (!hb || !hb.bone) return;
  _euler.set(target.x, target.y, target.z, 'XYZ');
  _delta.setFromEuler(_euler);
  hb.bone.quaternion.copy(hb.parentRestWorldQInv).multiply(_delta).multiply(hb.restWorldQ);
}

function easeBone(hb: HeroBone, target: THREE.Vector3, k: number): void {
  if (!hb) return;
  hb.cur.x += (target.x - hb.cur.x) * k;
  hb.cur.y += (target.y - hb.cur.y) * k;
  hb.cur.z += (target.z - hb.cur.z) * k;
}

const _t: Record<BoneKey, THREE.Vector3> = {
  pelvis: new THREE.Vector3(),
  torso: new THREE.Vector3(),
  head: new THREE.Vector3(),
  leftLeg: new THREE.Vector3(),
  leftKnee: new THREE.Vector3(),
  leftAnkle: new THREE.Vector3(),
  rightLeg: new THREE.Vector3(),
  rightKnee: new THREE.Vector3(),
  rightAnkle: new THREE.Vector3(),
  leftArm: new THREE.Vector3(),
  leftElbow: new THREE.Vector3(),
  rightArm: new THREE.Vector3(),
  rightElbow: new THREE.Vector3(),
};

function playClip(model: HeroGlbModel, name: string, fadeDuration: number, loop: boolean): void {
  const newAction = model.actions[name];
  if (!newAction) return;

  if (model.activeAction && model.activeAction !== newAction) {
    model.activeAction.fadeOut(fadeDuration);
  }

  newAction.reset();
  newAction.setEffectiveTimeScale(1);
  newAction.setEffectiveWeight(1);
  if (!loop) {
    newAction.setLoop(THREE.LoopOnce, 1);
    newAction.clampWhenFinished = true;
  } else {
    newAction.setLoop(THREE.LoopRepeat, Infinity);
  }
  newAction.fadeIn(fadeDuration);
  newAction.play();

  model.activeAction = newAction;
  model.currentActionName = name;
}

export function animateHeroModel(
  model: HeroGlbModel,
  speed: number,
  walkPhase: number,
  elapsed: number,
  dt: number,
  attack: HeroAttackAnimState,
): void {
  // 1. Skeletal Keyframe Animation via AnimationMixer
  if (model.mixer && model.hasSkeletalAnimations && Object.keys(model.actions).length > 0) {
    const isAttacking = attack.timer > 0;
    const isMoving = speed > 0.25;
    const drawTimer = attack.drawHoldTimer ?? 0;

    let targetAction = 'Idle';
    let speedScale = 1.0;
    let fadeDuration = 0.16;
    let loop = true;

    if (isAttacking) {
      loop = false;
      fadeDuration = 0.05;
      const combo = attack.comboIndex % 3;
      let targetAttack = 'Attack1_HorizontalSlash';
      if (combo === 1) targetAttack = 'Attack2_DiagonalSlash';
      else if (combo === 2) targetAttack = 'Attack3_VerticalCleave';

      if (!model.actions[targetAttack] && model.actions['Attack3_Thrust']) {
        targetAttack = 'Attack3_Thrust';
      }
      targetAction = targetAttack;

      // Greatsword wielded firmly in hand during active combat swing
      if (model.handSwordGroup) model.handSwordGroup.visible = true;
      if (model.backSwordGroup) model.backSwordGroup.visible = false;

      if (model.currentActionName !== targetAttack || model.lastComboIndex !== attack.comboIndex) {
        model.lastComboIndex = attack.comboIndex;
        playClip(model, targetAttack, 0.05, false);
      }
      const action = model.actions[targetAttack];
      if (action) {
        const clip = action.getClip();
        // Natural full swing playback matched to realistic attack duration
        action.timeScale = clip.duration / Math.max(0.3, attack.duration);
      }
    } else {
      model.lastComboIndex = -1;

      if (isMoving) {
        // While moving, greatsword is secured in back scabbard
        if (model.handSwordGroup) model.handSwordGroup.visible = false;
        if (model.backSwordGroup) model.backSwordGroup.visible = true;

        if (speed > 4.5 && model.actions['Run']) {
          targetAction = 'Run';
          speedScale = Math.max(0.9, Math.min(1.8, speed / 4.8));
        } else if (model.actions['Walk']) {
          targetAction = 'Walk';
          speedScale = Math.max(0.7, Math.min(1.4, speed / 2.2));
        }
      } else {
        // Standing still: handle combat guard hold, smooth Sheathe animation, or peaceful Idle
        if (drawTimer > 1.15) {
          // Combat guard stance holding blade in hand
          targetAction = 'Idle';
          if (model.handSwordGroup) model.handSwordGroup.visible = true;
          if (model.backSwordGroup) model.backSwordGroup.visible = false;
        } else if (drawTimer > 0 && model.actions['Sheathe']) {
          // Sheathe animation: 28 frames / 1.125s
          targetAction = 'Sheathe';
          loop = false;
          fadeDuration = 0.12;

          // Frames 1-14: hand brings sword to shoulder socket (drawTimer > 0.55s)
          // Frame 14: sword docks into back scabbard socket (drawTimer <= 0.55s)
          // Frames 15-28: hand releases hilt and lowers arm smoothly
          const swordDocked = drawTimer <= 0.55;
          if (model.handSwordGroup) model.handSwordGroup.visible = !swordDocked;
          if (model.backSwordGroup) model.backSwordGroup.visible = swordDocked;
        } else {
          // Peaceful idle with sword docked on back
          targetAction = 'Idle';
          if (model.handSwordGroup) model.handSwordGroup.visible = false;
          if (model.backSwordGroup) model.backSwordGroup.visible = true;
        }
      }

      if (model.currentActionName !== targetAction) {
        playClip(model, targetAction, fadeDuration, loop);
      }
      if (model.activeAction && targetAction !== 'Sheathe') {
        model.activeAction.timeScale = speedScale;
      }
    }

    model.mixer.update(dt);
    return;
  }

  // 2. Procedural Animation Fallback (if raw static mesh without mixer clips)
  const k = 1 - Math.exp(-15 * dt);
  const normSpd = Math.min(1.0, speed / 7.8);
  const isMoving = speed > 0.25;
  const swordInHand = attack.timer > 0 || (attack.drawHoldTimer ?? 0) > 0;
  if (model.handSwordGroup) model.handSwordGroup.visible = swordInHand;
  if (model.backSwordGroup) model.backSwordGroup.visible = !swordInHand;
  const t = _t;

  if (isMoving) {
    const sinP = Math.sin(walkPhase);
    const cosP = Math.cos(walkPhase);
    t.leftLeg.set(-sinP * 0.56 * normSpd, 0, 0);
    t.rightLeg.set(sinP * 0.56 * normSpd, 0, 0);
    t.leftKnee.set(Math.max(0.08, (sinP > 0 ? sinP * 0.72 : -sinP * 0.26) * normSpd + 0.12), 0, 0);
    t.rightKnee.set(Math.max(0.08, (sinP < 0 ? -sinP * 0.72 : sinP * 0.26) * normSpd + 0.12), 0, 0);
    t.leftAnkle.set(cosP * 0.24 * normSpd, 0, 0);
    t.rightAnkle.set(-cosP * 0.24 * normSpd, 0, 0);
    t.pelvis.set(0, sinP * 0.1 * normSpd, cosP * 0.03 * normSpd);
    t.torso.set(0.12 * normSpd, -sinP * 0.13 * normSpd, 0);
    t.head.set(-0.06 * normSpd, sinP * 0.04 * normSpd, 0);
    t.leftArm.set(sinP * 0.44 * normSpd, 0, -0.16);
    t.leftElbow.set(-0.32 - Math.max(0, -sinP) * 0.24, 0, 0);
    if (swordInHand) {
      t.rightArm.set(0.18 - sinP * 0.18, -0.10, 0.28);
      t.rightElbow.set(-0.36, 0, 0);
    } else {
      t.rightArm.set(-sinP * 0.44 * normSpd, 0, 0.16);
      t.rightElbow.set(-0.32 - Math.max(0, sinP) * 0.24, 0, 0);
    }
  } else {
    const breathe = Math.sin(elapsed * 2.1);
    t.leftLeg.set(0.04, 0, 0);
    t.rightLeg.set(-0.04, 0, 0);
    t.leftKnee.set(0.05, 0, 0);
    t.rightKnee.set(0.05, 0, 0);
    t.leftAnkle.set(0, 0, 0);
    t.rightAnkle.set(0, 0, 0);
    t.pelvis.set(0, 0, 0);
    t.torso.set(0.02 + breathe * 0.015, 0, 0);
    t.head.set(0, Math.sin(elapsed * 0.7) * 0.04, 0);
    t.leftArm.set(swordInHand ? -0.06 : 0.03, 0, -0.21);
    t.leftElbow.set(swordInHand ? -0.26 : -0.18, 0, 0);
    t.rightArm.set(swordInHand ? 0.08 : 0.03, swordInHand ? -0.10 : 0, swordInHand ? 0.28 : 0.21);
    t.rightElbow.set(swordInHand ? -0.34 : -0.18, 0, 0);
  }

  const keys = Object.keys(t) as BoneKey[];
  const attacking = attack.timer > 0;
  for (const key of keys) {
    const hb = model.bones[key];
    if (hb) {
      if (!attacking) easeBone(hb, t[key], k);
      else hb.cur.copy(t[key]);
    }
  }

  if (attacking) {
    const p = 1 - Math.max(0, Math.min(1, attack.timer / attack.duration));
    const combo = attack.comboIndex % 3;
    const b = model.bones;
    if (b.rightArm && b.rightElbow && b.torso) {
      if (combo === 0) {
        b.rightArm.cur.set(-1.35 + p * 2.15, 0.85 - p * 1.95, -0.82 + p * 1.45);
        b.rightElbow.cur.set(-0.45 + p * 0.25, 0, 0);
        b.torso.cur.set(0, 0.48 - p * 1.05, 0);
        if (b.leftArm) b.leftArm.cur.set(-0.45, 0, -0.16);
      } else if (combo === 1) {
        b.rightArm.cur.set(-1.15 + Math.sin(p * Math.PI) * 0.45, -1.05 + p * 2.1, 0.85 - p * 1.75);
        b.rightElbow.cur.set(-0.35, 0, 0);
        b.torso.cur.set(0, -0.48 + p * 1.05, 0);
      } else {
        b.rightArm.cur.set(-1.95 + p * 2.65, 0, -0.15);
        b.rightElbow.cur.set(-0.32, 0, 0);
        b.torso.cur.set(-0.10 + p * 0.28, 0, 0);
        if (b.pelvis) b.pelvis.cur.set(0, 0, 0);
      }
    }
  }

  for (const key of keys) {
    const hb = model.bones[key];
    if (hb) {
      _final.copy(hb.cur).add(GLB_BASE_POSE[key]);
      applyBone(hb, _final);
    }
  }
}
