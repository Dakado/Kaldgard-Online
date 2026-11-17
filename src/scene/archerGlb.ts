import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HeroAttackAnimState } from './characterBuilder';
import { buildElvenRecurveBow, buildQuiverWithArrows, buildArrowMesh } from './archerBuilder';

export const ARCHER_ANIMATED_URL = '/models/elven_archer_animated.glb';
const ARCHER_TARGET_HEIGHT = 1.76;

export interface ArcherGlbModel {
  root: THREE.Group;
  meshGroup: THREE.Group;
  targetHeight: number;
  mixer?: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  activeAction?: THREE.AnimationAction | null;
  currentActionName?: string;
  hasSkeletalAnimations: boolean;
  backBowGroup?: THREE.Group;
  quiverGroup?: THREE.Group;
  handBowGroup?: THREE.Group;
  drawnArrowMesh?: THREE.Group;
  handBowStringGeo?: THREE.BufferGeometry;
}

/**
 * Loads the rigged animated Elven Archer model (or falls back to Trellis static GLB),
 * sets up AnimationMixer with all animation action clips (Idle, Walk, Run, Shoot_Bow),
 * and attaches weapons (back bow, quiver, hand bow, drawn arrow) to the armature bones.
 */
export async function loadArcherGlb(): Promise<ArcherGlbModel> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(ARCHER_ANIMATED_URL);
  console.log('Loaded animated Elven Archer with animations:', gltf.animations?.map((a: any) => a.name));

  const scene = gltf.scene;

  // Compute exact bounding dimensions
  const box = new THREE.Box3().setFromObject(scene);
  const height = box.max.y - box.min.y;
  const s = ARCHER_TARGET_HEIGHT / (height > 0.01 ? height : 1.0);

  const root = new THREE.Group();
  const meshGroup = new THREE.Group();

  scene.scale.setScalar(s);
  scene.position.set(
    -((box.min.x + box.max.x) / 2) * s,
    -box.min.y * s,
    -((box.min.z + box.max.z) / 2) * s,
  );

  // Traverse and tune standard materials and shadow casting
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
              m.envMapIntensity = 0.85;
              m.roughness = Math.max(0.28, m.roughness ?? 0.5);
            }
          });
        } else if (mat instanceof THREE.MeshStandardMaterial) {
          mat.envMapIntensity = 0.85;
          mat.roughness = Math.max(0.28, mat.roughness ?? 0.5);
        }
      }
    }
  });

  meshGroup.add(scene);
  root.add(meshGroup);

  // Attach weapons to humanoid armature bones
  const chestBone = scene.getObjectByName('Chest');
  const handLBone = scene.getObjectByName('HandL') || scene.getObjectByName('Hand.L');
  const handRBone = scene.getObjectByName('HandR') || scene.getObjectByName('Hand.R');

  let backBowGroup: THREE.Group | undefined;
  let quiverGroup: THREE.Group | undefined;
  let handBowGroup: THREE.Group | undefined;
  let drawnArrowMesh: THREE.Group | undefined;
  let handBowStringGeo: THREE.BufferGeometry | undefined;

  if (chestBone) {
    // 1. Recurve bow slung diagonally across the back
    const { group: backBow } = buildElvenRecurveBow(null as any);
    backBow.scale.setScalar(0.95);
    backBow.position.set(-0.06, 0.08, -0.14);
    backBow.rotation.set(-0.25, -0.22, 0.65);
    backBow.visible = true;
    chestBone.add(backBow);
    backBowGroup = backBow;

    // 2. Leather back quiver packed with arrows
    const quiver = buildQuiverWithArrows();
    quiver.scale.setScalar(0.95);
    quiver.position.set(0.12, 0.06, -0.13);
    quiver.rotation.set(-0.25, 0.20, -0.45);
    quiver.visible = true;
    chestBone.add(quiver);
    quiverGroup = quiver;
  }

  if (handLBone) {
    // 3. Recurve bow held in left hand during combat (physically calibrated vertical & forward)
    const { group: handBow, stringGeo } = buildElvenRecurveBow(null as any);
    handBow.scale.setScalar(0.92);
    handBow.rotation.set(-1.40, 0.245, -0.158);
    handBow.position.set(0, 0, 0);
    handBow.visible = false;
    handLBone.add(handBow);
    handBowGroup = handBow;
    handBowStringGeo = stringGeo;

    // 4. Arrow nocked on bow shelf during draw
    const arrow = buildArrowMesh();
    arrow.scale.setScalar(0.90);
    arrow.rotation.y = 0;
    arrow.position.set(0, 0, 0.24);
    arrow.visible = false;
    handBow.add(arrow);
    drawnArrowMesh = arrow;
  }

  // Set up AnimationMixer for Blender skeletal actions
  const hasSkeletalAnimations = Array.isArray(gltf.animations) && gltf.animations.length > 0;
  const mixer = hasSkeletalAnimations ? new THREE.AnimationMixer(scene) : undefined;
  const actions: Record<string, THREE.AnimationAction> = {};

  let activeAction: THREE.AnimationAction | null = null;
  let currentActionName = 'Idle';

  if (mixer && gltf.animations) {
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      if (clip.name === 'Shoot_Bow') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      actions[clip.name] = action;
    }
    // Start with Idle if available
    if (actions['Idle']) {
      activeAction = actions['Idle'];
      activeAction.play();
    } else if (gltf.animations.length > 0) {
      activeAction = actions[gltf.animations[0].name];
      activeAction.play();
    }
  }

  return {
    root,
    meshGroup,
    targetHeight: ARCHER_TARGET_HEIGHT,
    mixer,
    actions,
    activeAction,
    currentActionName,
    hasSkeletalAnimations,
    backBowGroup,
    quiverGroup,
    handBowGroup,
    drawnArrowMesh,
    handBowStringGeo,
  };
}

/**
 * Animates the Elven Archer:
 * If skeletal animations are present, controls AnimationMixer action blending (Idle, Walk, Run, Shoot_Bow),
 * projectile firing callback, and dynamic weapon swapping (back bow/quiver vs hand bow/arrow).
 * Otherwise, falls back to dynamic procedural body physics.
 */
export function animateArcherGlb(
  model: ArcherGlbModel,
  speed: number,
  walkPhase: number,
  elapsed: number,
  dt: number,
  attackAnim: HeroAttackAnimState,
  onShootArrow?: () => void,
): void {
  const isMoving = speed > 0.25;
  const isAttacking = attackAnim.timer > 0;
  const attackProgress = attackAnim.duration > 0
    ? 1 - Math.max(0, Math.min(1, attackAnim.timer / attackAnim.duration))
    : 0;

  // Trigger projectile spawn once at loose frame (progress >= 0.65)
  if (isAttacking && attackProgress >= 0.65) {
    if (onShootArrow && !attackAnim.drawHoldTimer) {
      attackAnim.drawHoldTimer = 1;
      onShootArrow();
    }
  }

  // Weapon visibility & dynamic draw tension
  if (model.backBowGroup && model.handBowGroup) {
    if (isAttacking) {
      model.backBowGroup.visible = false;
      model.handBowGroup.visible = true;

      // Dynamic string tension and arrow pull during draw phase
      if (attackProgress < 0.65) {
        const drawFrac = attackProgress / 0.65;
        const pullDistance = Math.sin(drawFrac * Math.PI * 0.5) * 0.26;
        if (model.drawnArrowMesh) {
          model.drawnArrowMesh.visible = true;
          model.drawnArrowMesh.position.set(0, 0, 0.24 - pullDistance);
        }
        if (model.handBowStringGeo) {
          const posAttr = model.handBowStringGeo.attributes.position as THREE.BufferAttribute;
          if (posAttr) {
            posAttr.setXYZ(1, 0, 0, 0.015 - pullDistance);
            posAttr.needsUpdate = true;
          }
        }
      } else {
        // Loose / follow-through snap
        if (model.drawnArrowMesh) {
          model.drawnArrowMesh.visible = false;
        }
        if (model.handBowStringGeo) {
          const posAttr = model.handBowStringGeo.attributes.position as THREE.BufferAttribute;
          if (posAttr) {
            posAttr.setXYZ(1, 0, 0, 0.015);
            posAttr.needsUpdate = true;
          }
        }
      }
    } else {
      model.backBowGroup.visible = true;
      model.handBowGroup.visible = false;
      if (model.drawnArrowMesh) {
        model.drawnArrowMesh.visible = false;
      }
      if (model.handBowStringGeo) {
        const posAttr = model.handBowStringGeo.attributes.position as THREE.BufferAttribute;
        if (posAttr) {
          posAttr.setXYZ(1, 0, 0, 0.015);
          posAttr.needsUpdate = true;
        }
      }
    }
  }

  // 1. Skeletal Animation Mixer handling
  if (model.mixer && model.hasSkeletalAnimations) {
    model.mixer.update(dt);

    let targetActionName = 'Idle';
    if (isAttacking) {
      targetActionName = 'Shoot_Bow';
    } else if (isMoving) {
      targetActionName = speed > 4.5 ? 'Run' : 'Walk';
    } else {
      targetActionName = 'Idle';
    }

    if (model.actions[targetActionName]) {
      const act = model.actions[targetActionName];
      if (targetActionName === 'Shoot_Bow') {
        act.timeScale = act.getClip().duration / Math.max(0.2, attackAnim.duration);
      } else if (targetActionName === 'Walk') {
        act.timeScale = Math.max(0.7, Math.min(1.4, speed / 2.2));
      } else if (targetActionName === 'Run') {
        act.timeScale = Math.max(0.9, Math.min(1.8, speed / 4.8));
      } else {
        act.timeScale = 1.0;
      }
    }

    if (targetActionName !== model.currentActionName && model.actions[targetActionName]) {
      const nextAction = model.actions[targetActionName];
      if (model.activeAction && model.activeAction !== nextAction) {
        const fadeTime = isAttacking || model.currentActionName === 'Shoot_Bow' ? 0.06 : 0.18;
        model.activeAction.fadeOut(fadeTime);
      }
      const fadeInTime = isAttacking || model.currentActionName === 'Shoot_Bow' ? 0.06 : 0.18;
      nextAction.reset().fadeIn(fadeInTime).play();
      model.activeAction = nextAction;
      model.currentActionName = targetActionName;
    } else if (isAttacking && targetActionName === 'Shoot_Bow' && attackProgress < 0.08) {
      // Retrigger shot animation on repeat rapid attacks
      const act = model.actions['Shoot_Bow'];
      if (act && act.time > 0.25) {
        act.reset().play();
      }
    }
    return;
  }

  // 2. Fallback procedural animations
  const normSpd = Math.min(1.0, speed / 7.2);

  if (isAttacking) {
    const attackProgress = 1 - Math.max(0, Math.min(1, attackAnim.timer / attackAnim.duration));
    if (attackProgress < 0.70) {
      const drawT = attackProgress / 0.70;
      model.meshGroup.position.z = -0.04 * drawT;
      model.meshGroup.rotation.y = -0.18 * drawT;
      model.meshGroup.rotation.x = -0.04 * drawT;
    } else {
      const relT = (attackProgress - 0.70) / 0.30;
      model.meshGroup.position.z = -0.04 * (1 - relT);
      model.meshGroup.rotation.y = -0.18 * (1 - relT);
      model.meshGroup.rotation.x = 0.03 * Math.sin(relT * Math.PI);
    }
  } else if (isMoving) {
    const bob = Math.abs(Math.sin(walkPhase * 2)) * 0.045 * normSpd;
    const sway = Math.sin(walkPhase) * 0.032 * normSpd;
    const lean = 0.07 * normSpd;

    model.meshGroup.position.y += (bob - model.meshGroup.position.y) * 12 * dt;
    model.meshGroup.rotation.z += (sway - model.meshGroup.rotation.z) * 10 * dt;
    model.meshGroup.rotation.x += (lean - model.meshGroup.rotation.x) * 10 * dt;
    model.meshGroup.rotation.y += (0 - model.meshGroup.rotation.y) * 10 * dt;
    model.meshGroup.scale.set(1, 1, 1);
  } else {
    const breath = 1.0 + Math.sin(elapsed * 2.2) * 0.009;
    const idleSway = Math.sin(elapsed * 1.3) * 0.016;

    model.meshGroup.position.y += (0 - model.meshGroup.position.y) * 8 * dt;
    model.meshGroup.rotation.z += (0 - model.meshGroup.rotation.z) * 8 * dt;
    model.meshGroup.rotation.x += (0 - model.meshGroup.rotation.x) * 8 * dt;
    model.meshGroup.rotation.y += (idleSway - model.meshGroup.rotation.y) * 6 * dt;
    model.meshGroup.scale.set(1, breath, 1);
  }
}
