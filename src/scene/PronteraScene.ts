import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PronteraAudio } from '../audio/ambientAudio';
import {
  SWORDSMAN_ATTACK_COOLDOWN,
  SWORDSMAN_MELEE_RANGE,
  applyDamageToMob,
  computeSwordDamage,
  expForNextLevel,
  findNearestAliveMob,
} from '../world/combat';
import { PRONTERA_NAV, Point2D } from '../world/pathfinding';
import {
  LANDMARKS,
  NPCS,
  PLAYER_SPAWN,
  getDistrictAt,
  groundHeightAt,
  isCobbleRoad,
} from '../world/pronteraLayout';
import {
  buildCentralFountain,
  buildCitadelWallsAndGates,
  buildInstancedNatureAndLanterns,
  buildPronteraBuildings,
  buildTerrainAndRoads,
} from './architectureBuilder';
import {
  HeroAttackAnimState,
  MobActor,
  animateHeroGait,
  buildFieldMobs,
  buildHeroCharacter,
  buildNpcCharacter,
} from './characterBuilder';
import { createPronteraMaterials } from './materials';
import {
  createDiabloEnvironmentRig,
  createPbrUniforms,
  upgradeSceneMaterialsToAdvancedPBR,
} from './pbrMaterialSystem';
import { createWeatherUniforms } from './weatherShaders';
import { WeatherMode, createWeatherSystem } from './weatherSystem';

export type TimeOfDay = 'day' | 'sunset' | 'evening';
export type CameraPreset = 'classic' | 'wide' | 'close';
export type { WeatherMode };

export interface CombatPopup {
  id: number;
  text: string;
  kind: 'hit' | 'crit' | 'reward' | 'levelup';
  screenX: number;
  screenY: number;
  opacity: number;
}

export interface TargetMobSnapshot {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
}

export interface HudSnapshot {
  x: number;
  z: number;
  yaw: number;
  camYaw: number;
  district: string;
  isMoving: boolean;
  level: number;
  exp: number;
  expNext: number;
  zeny: number;
  kills: number;
  targetMob: TargetMobSnapshot | null;
  popups: CombatPopup[];
}

export interface PronteraController {
  setPlaying: (playing: boolean) => void;
  setTimeOfDay: (mode: TimeOfDay) => void;
  setWeather: (weather: WeatherMode) => void;
  triggerLightning: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  resetCameraNorth: () => void;
  teleportToLandmark: (landmarkId: string) => void;
  walkToWorldPoint: (x: number, z: number) => void;
  attackNearest: () => void;
  toggleMute: () => boolean;
  dispose: () => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _targetSky = new THREE.Color();
const _targetSun = new THREE.Color();
const _targetRim = new THREE.Color();
const _targetHemiSky = new THREE.Color();
const _targetHemiGround = new THREE.Color();
const _lightningTint = new THREE.Color(0xd2e6ff);
const _sunDirScratch = new THREE.Vector3();

export function detectSoftwareWebGL(): boolean {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) || '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export function mountPronteraScene(
  container: HTMLElement,
  initialMode: 'title' | 'playing',
  onHudUpdate: (snap: HudSnapshot) => void,
  onContextLostChange?: (lost: boolean) => void,
): PronteraController {
  const isSoftwareGl = detectSoftwareWebGL();
  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initW, initH);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0x6397c7);
  scene.background = skyColor;
  const fog = new THREE.FogExp2(0x6397c7, 0.0044);
  scene.fog = fog;

  const diabloEnvRig = createDiabloEnvironmentRig(renderer);
  scene.environment = diabloEnvRig.getTexture('day');
  scene.environmentIntensity = 0.48;

  const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.5, 420);

  // Three-Point Atmospheric Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0x88bef0, 0x261f18, 0.36);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffddb0, 1.95);
  sunLight.position.set(54, 50, 36);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 8;
  sunLight.shadow.camera.far = 185;
  const shadowHalf = 42;
  sunLight.shadow.camera.left = -shadowHalf;
  sunLight.shadow.camera.right = shadowHalf;
  sunLight.shadow.camera.top = shadowHalf;
  sunLight.shadow.camera.bottom = -shadowHalf;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.024;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0x88b8f0, 0.45);
  rimLight.position.set(-48, 34, -44);
  scene.add(rimLight);
  scene.add(rimLight.target);

  const weatherUniforms = createWeatherUniforms();
  const pbrUniforms = createPbrUniforms();

  // Build World Geometry & PBR Materials
  const mats = createPronteraMaterials(renderer, isSoftwareGl, weatherUniforms);
  const { group: terrainGroup, groundPickMesh, moatWaterMeshes } = buildTerrainAndRoads(mats);
  scene.add(terrainGroup);

  const { group: fountainGroup, waterMesh: fountainWater, sprayGroup } = buildCentralFountain(mats);
  scene.add(fountainGroup);

  const wallsGroup = buildCitadelWallsAndGates(mats);
  scene.add(wallsGroup);

  const buildingsGroup = buildPronteraBuildings(mats);
  scene.add(buildingsGroup);

  const { group: natureGroup, lanternLights, lanternHalos } = buildInstancedNatureAndLanterns(mats);
  scene.add(natureGroup);

  const npcGroup = new THREE.Group();
  for (const npc of NPCS) {
    npcGroup.add(buildNpcCharacter(npc, mats));
  }
  scene.add(npcGroup);

  const { group: mobGroup, actors: mobActors, hitTargets: mobHitTargets } = buildFieldMobs(mats);
  scene.add(mobGroup);
  const mobById = new Map<string, MobActor>(mobActors.map((m) => [m.id, m]));

  const hero = buildHeroCharacter(mats);
  hero.root.position.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  hero.root.rotation.y = PLAYER_SPAWN.yaw;
  scene.add(hero.root);

  const cursorRingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.75),
    mats.cursorRing,
  );
  cursorRingMesh.rotation.x = -Math.PI / 2;
  cursorRingMesh.position.y = 0.065;
  cursorRingMesh.visible = false;
  scene.add(cursorRingMesh);

  // Dynamic Rain, Snow, World-Pinned Splash Ripples, Fireflies & Lightning
  const weatherSystem = createWeatherSystem();
  scene.add(weatherSystem.group);

  // Upgrade every eligible world, architecture, foliage, character & mob material to unified Diablo IV PBR
  upgradeSceneMaterialsToAdvancedPBR(scene, pbrUniforms, weatherUniforms);

  // Post-Processing Composer (Bloom + ACES OutputPass) on GPU
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  if (!isSoftwareGl) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(initW, initH),
      0.28,
      0.50,
      0.82,
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    renderer.compile(scene, camera);
  }

  // Simulation, Combat & Camera State
  const audio = new PronteraAudio();
  let isPlaying = initialMode === 'playing';
  let timeOfDay: TimeOfDay = 'day';
  let activeEnvMode: TimeOfDay = 'day';
  let weatherMode: WeatherMode = 'clear';

  let playerX = PLAYER_SPAWN.x;
  let playerZ = PLAYER_SPAWN.z;
  let playerYaw = PLAYER_SPAWN.yaw;
  let walkPhase = 0;
  let lastStepHalf = 0;

  let playerLevel = 1;
  let playerExp = 0;
  let playerZeny = 0;
  let playerKills = 0;
  let targetMobId: string | null = null;
  let pendingAttackMobId: string | null = null;
  let attackCooldown = 0;
  let comboCounter = 0;
  const attackAnim: HeroAttackAnimState = {
    timer: 0,
    duration: 0.34,
    comboIndex: 0,
    drawHoldTimer: 0,
  };

  interface ActiveWorldPopup {
    id: number;
    text: string;
    kind: 'hit' | 'crit' | 'reward' | 'levelup';
    wx: number;
    wy: number;
    wz: number;
    life: number;
    maxLife: number;
  }
  let nextPopupId = 1;
  const activePopups: ActiveWorldPopup[] = [];

  let activePath: Point2D[] = [];
  let cursorRingLife = 0;

  let targetCamYaw = 0;
  let camYaw = 0;
  let targetCamPitch = 0.62;
  let camPitch = 0.62;
  let targetCamDist = 20.5;
  let camDist = 20.5;

  const camLookAt = new THREE.Vector3(playerX, 1.45, playerZ);
  const camCurrentPos = new THREE.Vector3(0, 22, 34);
  if (isPlaying) {
    camCurrentPos.set(
      playerX + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
      1.45 + Math.sin(camPitch) * camDist,
      playerZ + Math.cos(camYaw) * Math.cos(camPitch) * camDist,
    );
  } else {
    camCurrentPos.set(22, 14.5, 34);
    camLookAt.set(0, 5.2, -16);
  }
  camera.position.copy(camCurrentPos);
  camera.lookAt(camLookAt);
  camera.updateMatrixWorld();

  const spawnPopup = (
    text: string,
    kind: ActiveWorldPopup['kind'],
    wx: number,
    wy: number,
    wz: number,
  ) => {
    activePopups.push({
      id: nextPopupId++,
      text,
      kind,
      wx,
      wy,
      wz,
      life: kind === 'reward' || kind === 'levelup' ? 1.45 : 0.95,
      maxLife: kind === 'reward' || kind === 'levelup' ? 1.45 : 0.95,
    });
    if (activePopups.length > 10) activePopups.shift();
  };

  const performSwordSwing = (mob: MobActor | null) => {
    if (attackCooldown > 0) return;
    attackCooldown = SWORDSMAN_ATTACK_COOLDOWN;
    const combo = comboCounter % 3;
    comboCounter++;
    attackAnim.comboIndex = combo;
    attackAnim.duration = combo === 2 ? 0.40 : 0.32;
    attackAnim.timer = attackAnim.duration;
    attackAnim.drawHoldTimer = 2.4;

    if (mob && mob.alive) {
      playerYaw = Math.atan2(mob.x - playerX, mob.z - playerZ);
      const { damage, isCrit } = computeSwordDamage(combo, playerLevel);
      const result = applyDamageToMob(mob, damage, isCrit);
      audio.playSwordSlash(combo);
      audio.playMobHit(result.killed);

      mob.hitFlashTimer = 0.16;
      const dx = mob.x - playerX;
      const dz = mob.z - playerZ;
      const dist = Math.max(0.1, Math.hypot(dx, dz));
      const push = result.killed ? 7.0 : combo === 2 ? 5.2 : 3.2;
      mob.knockVx = (dx / dist) * push;
      mob.knockVz = (dz / dist) * push;

      const py = groundHeightAt(mob.x, mob.z);
      spawnPopup(
        isCrit ? `CRIT -${result.damage}!` : `-${result.damage}`,
        isCrit ? 'crit' : 'hit',
        mob.x,
        py + 1.55,
        mob.z,
      );

      if (result.killed) {
        mob.deathTimer = 0.34;
        mob.hpBarGroup.visible = false;
        playerZeny += result.zenyEarned;
        playerKills += 1;
        playerExp += result.expEarned;
        spawnPopup(
          `+${result.zenyEarned} Zeny`,
          'reward',
          mob.x,
          py + 2.05,
          mob.z,
        );
        while (playerExp >= expForNextLevel(playerLevel)) {
          playerExp -= expForNextLevel(playerLevel);
          playerLevel += 1;
          spawnPopup(
            `LEVEL UP! Lv.${playerLevel}`,
            'levelup',
            playerX,
            groundHeightAt(playerX, playerZ) + 2.3,
            playerZ,
          );
        }
      } else {
        mob.hpBarGroup.visible = true;
      }
      emitHudSnapshot();
    } else {
      audio.playSwordSlash(combo);
    }
  };

  const triggerMeleeAttack = () => {
    if (!isPlaying || attackCooldown > 0) return;
    let target: MobActor | null = targetMobId ? mobById.get(targetMobId) ?? null : null;
    if (
      !target ||
      !target.alive ||
      Math.hypot(target.x - playerX, target.z - playerZ) > SWORDSMAN_MELEE_RANGE + 1.4
    ) {
      target = findNearestAliveMob(mobActors, playerX, playerZ, SWORDSMAN_MELEE_RANGE + 1.4);
    }
    if (target) {
      targetMobId = target.id;
      const dist = Math.hypot(target.x - playerX, target.z - playerZ);
      if (dist > SWORDSMAN_MELEE_RANGE) {
        // Short lunge step closer to connect cleanly
        const step = Math.min(dist - 1.35, 1.3);
        const vx = (target.x - playerX) / Math.max(0.01, dist);
        const vz = (target.z - playerZ) / Math.max(0.01, dist);
        const res = PRONTERA_NAV.resolveCollision(playerX + vx * step, playerZ + vz * step, 0.58);
        playerX = res.x;
        playerZ = res.z;
      }
      activePath = [];
      pendingAttackMobId = null;
      cursorRingMesh.visible = false;
      performSwordSwing(target);
    } else {
      performSwordSwing(null);
    }
  };

  // Input Tracking
  const keys = new Set<string>();
  let isLeftDown = false;
  let isRightDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let holdMoveCooldown = 0;
  let lastRightClickTime = 0;

  const updatePointerNdc = (clientX: number, clientY: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const issueClickAction = (clientX: number, clientY: number, playChime: boolean, allowMobTarget: boolean) => {
    if (!isPlaying) return;
    updatePointerNdc(clientX, clientY);
    _raycaster.setFromCamera(_pointerNdc, camera);

    if (allowMobTarget) {
      const mobHits = _raycaster.intersectObjects(mobHitTargets, false);
      for (const hit of mobHits) {
        const mobId = hit.object.userData?.mobId as string | undefined;
        const mob = mobId ? mobById.get(mobId) : undefined;
        if (mob && mob.alive) {
          targetMobId = mob.id;
          const dist = Math.hypot(mob.x - playerX, mob.z - playerZ);
          if (dist <= SWORDSMAN_MELEE_RANGE) {
            activePath = [];
            pendingAttackMobId = null;
            cursorRingMesh.visible = false;
            performSwordSwing(mob);
          } else {
            pendingAttackMobId = mob.id;
            const path = PRONTERA_NAV.findPath(playerX, playerZ, mob.x, mob.z);
            if (path.length > 0) {
              activePath = path;
              cursorRingMesh.position.set(mob.x, groundHeightAt(mob.x, mob.z) + 0.065, mob.z);
              cursorRingMesh.visible = true;
              cursorRingLife = 1.2;
              if (playChime) audio.playMoveClick();
            }
          }
          return;
        }
      }
    }

    pendingAttackMobId = null;
    const hits = _raycaster.intersectObject(groundPickMesh, false);
    if (hits.length > 0) {
      const pt = hits[0].point;
      const path = PRONTERA_NAV.findPath(playerX, playerZ, pt.x, pt.z);
      if (path.length > 0) {
        activePath = path;
        const dest = path[path.length - 1];
        cursorRingMesh.position.set(dest.x, groundHeightAt(dest.x, dest.z) + 0.065, dest.z);
        cursorRingMesh.visible = true;
        cursorRingLife = 1.4;
        if (playChime) audio.playMoveClick();
      }
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!isPlaying) return;
    if (e.button === 0) {
      isLeftDown = true;
      holdMoveCooldown = 0.16;
      issueClickAction(e.clientX, e.clientY, true, true);
    } else if (e.button === 2) {
      const now = performance.now();
      if (now - lastRightClickTime < 300) {
        targetCamYaw = 0;
      }
      lastRightClickTime = now;
      isRightDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (isRightDragging) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      targetCamYaw -= dx * 0.0075;
      targetCamPitch = THREE.MathUtils.clamp(targetCamPitch + dy * 0.0045, 0.48, 1.22);
    } else if (isLeftDown) {
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) isLeftDown = false;
    if (e.button === 2) isRightDragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    if (!isPlaying) return;
    e.preventDefault();
    targetCamDist = THREE.MathUtils.clamp(targetCamDist + e.deltaY * 0.018, 10, 46);
  };

  const onContextMenu = (e: MouseEvent) => e.preventDefault();
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (isPlaying && (e.code === 'Space' || e.code === 'KeyF')) {
      e.preventDefault();
      triggerMeleeAttack();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const clearHeldInputs = () => {
    keys.clear();
    isLeftDown = false;
    isRightDragging = false;
  };

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearHeldInputs);

  const onVisibility = () => {
    if (document.hidden) clearHeldInputs();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onContextLost = (e: Event) => {
    e.preventDefault();
    onContextLostChange?.(true);
  };
  const onContextRestored = () => {
    onContextLostChange?.(false);
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
    bloomPass?.resolution.set(w, h);
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  });
  resizeObserver.observe(container);

  // Calibrated Atmospheric Lighting & Weather Targets (Crisp Snow Visibility!)
  const getLightingTargets = (mode: TimeOfDay, weather: WeatherMode) => {
    let base = {
      sky: 0x6296c6,
      sun: 0xffddb0,
      sunInt: 1.95,
      sunOffset: [54, 50, 36] as [number, number, number],
      rim: 0x82b4ed,
      rimInt: 0.56,
      hemiSky: 0x84baf0,
      hemiGround: 0x261f18,
      hemiInt: 0.36,
      envInt: 0.48,
      fogDensity: 0.0044,
      emissiveWin: 0.55,
      emissiveLantern: 0.95,
      lanternPointInt: 0.7,
      haloOpacity: 0.16,
    };

    if (mode === 'sunset') {
      base = {
        sky: 0xb86d4d,
        sun: 0xff9140,
        sunInt: 1.95,
        sunOffset: [64, 24, 34],
        rim: 0x6b80c4,
        rimInt: 0.58,
        hemiSky: 0xd99272,
        hemiGround: 0x2a1d15,
        hemiInt: 0.38,
        envInt: 0.46,
        fogDensity: 0.0052,
        emissiveWin: 1.45,
        emissiveLantern: 1.85,
        lanternPointInt: 3.8,
        haloOpacity: 0.50,
      };
    } else if (mode === 'evening') {
      base = {
        sky: 0x0b1220,
        sun: 0x769ce6,
        sunInt: 0.94,
        sunOffset: [-42, 48, -42],
        rim: 0x5274bd,
        rimInt: 0.56,
        hemiSky: 0x2c4270,
        hemiGround: 0x161922,
        hemiInt: 0.44,
        envInt: 0.50,
        fogDensity: 0.0058,
        emissiveWin: 2.25,
        emissiveLantern: 2.85,
        lanternPointInt: 6.8,
        haloOpacity: 0.82,
      };
    }

    if (weather === 'rain') {
      base.sky = mode === 'evening' ? 0x080d17 : mode === 'sunset' ? 0x433b42 : 0x344454;
      base.sunInt *= 0.42;
      base.hemiSky = mode === 'evening' ? 0x1d2b45 : 0x4f647a;
      base.hemiInt *= 0.78;
      base.fogDensity += 0.0024;
      base.emissiveWin = Math.max(base.emissiveWin, 1.55);
      base.emissiveLantern = Math.max(base.emissiveLantern, 2.05);
      base.lanternPointInt = Math.max(base.lanternPointInt, 4.4);
      base.haloOpacity = Math.max(base.haloOpacity, 0.58);
      base.envInt *= 0.82;
    } else if (weather === 'snow') {
      // Crisp, clear winter air — keep fog low so buildings, roads, moat and fields remain sharply legible
      base.sky = mode === 'evening' ? 0x101c33 : mode === 'sunset' ? 0x8c787c : 0x6f8fb0;
      base.sunInt *= 0.90;
      base.hemiSky = mode === 'evening' ? 0x364d78 : 0xaac4de;
      base.fogDensity = mode === 'evening' ? 0.0036 : mode === 'sunset' ? 0.0028 : 0.0022;
      base.emissiveWin = Math.max(base.emissiveWin, 1.35);
      base.emissiveLantern = Math.max(base.emissiveLantern, 1.8);
      base.lanternPointInt = Math.max(base.lanternPointInt, 3.2);
      base.haloOpacity = Math.max(base.haloOpacity, 0.44);
    }

    return base;
  };

  let moveSpeedGlobal = 0;

  function emitHudSnapshot() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const tMob = targetMobId ? mobById.get(targetMobId) : undefined;
    const targetMob: TargetMobSnapshot | null =
      tMob && tMob.alive
        ? {
            id: tMob.id,
            name: tMob.name,
            level: tMob.level,
            hp: tMob.hp,
            maxHp: tMob.maxHp,
          }
        : null;

    const popups: CombatPopup[] = [];
    for (const p of activePopups) {
      const age = 1 - p.life / p.maxLife;
      _projVec.set(p.wx, p.wy + age * 1.15, p.wz);
      _projVec.project(camera);
      if (_projVec.z < 1) {
        popups.push({
          id: p.id,
          text: p.text,
          kind: p.kind,
          screenX: (_projVec.x * 0.5 + 0.5) * w,
          screenY: (-_projVec.y * 0.5 + 0.5) * h,
          opacity: Math.min(1, p.life / (p.maxLife * 0.45)),
        });
      }
    }

    onHudUpdate({
      x: Math.round(playerX),
      z: Math.round(playerZ),
      yaw: playerYaw,
      camYaw,
      district: getDistrictAt(playerX, playerZ),
      isMoving: moveSpeedGlobal > 0.25 || activePath.length > 0,
      level: playerLevel,
      exp: playerExp,
      expNext: expForNextLevel(playerLevel),
      zeny: playerZeny,
      kills: playerKills,
      targetMob,
      popups,
    });
  }

  let frameId = 0;
  let disposed = false;
  let lastTime = performance.now();
  let elapsed = 0;
  let hudTimer = 0;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.ALREADY_SIGNALED;
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  const sunOffsetCurr = new THREE.Vector3(46, 56, 42);

  const tick = () => {
    if (disposed) return;
    const now = performance.now();
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    const atmDt = Math.min(rawDt, 0.35);
    elapsed += atmDt;

    if (attackCooldown > 0) attackCooldown = Math.max(0, attackCooldown - dt);
    if (attackAnim.timer > 0) attackAnim.timer = Math.max(0, attackAnim.timer - dt);
    if ((attackAnim.drawHoldTimer ?? 0) > 0) {
      attackAnim.drawHoldTimer = Math.max(0, (attackAnim.drawHoldTimer ?? 0) - dt);
    }

    // 1. Update Dynamic Weather & Lightning System
    const focusX = isPlaying ? playerX : 0;
    const focusZ = isPlaying ? playerZ : -10;
    const lightningFlash = weatherSystem.update(
      atmDt,
      elapsed,
      focusX,
      focusZ,
      weatherMode,
      timeOfDay,
      () => audio.playThunder(),
    );

    const wBlend = 1 - Math.exp(-1.9 * atmDt);
    weatherUniforms.uTime.value = elapsed;
    weatherUniforms.uWetness.value += ((weatherMode === 'rain' ? 1 : 0) - weatherUniforms.uWetness.value) * wBlend;
    weatherUniforms.uSnow.value += ((weatherMode === 'snow' ? 1 : 0) - weatherUniforms.uSnow.value) * wBlend;
    weatherUniforms.uLightning.value = lightningFlash;

    // 2. Smoothly blend Time-of-Day & Weather Lighting Rig
    const lt = getLightingTargets(timeOfDay, weatherMode);
    const atmK = 1 - Math.exp(-4.2 * atmDt);
    _targetSky.setHex(lt.sky);
    if (lightningFlash > 0.01) {
      _targetSky.lerp(_lightningTint, Math.min(0.75, lightningFlash * 0.72));
    }
    skyColor.lerp(_targetSky, atmK);
    fog.color.copy(skyColor);
    fog.density += (lt.fogDensity - fog.density) * atmK;

    _targetSun.setHex(lt.sun);
    sunLight.color.lerp(_targetSun, atmK);
    sunLight.intensity += (lt.sunInt - sunLight.intensity) * atmK;
    sunOffsetCurr.x += (lt.sunOffset[0] - sunOffsetCurr.x) * atmK;
    sunOffsetCurr.y += (lt.sunOffset[1] - sunOffsetCurr.y) * atmK;
    sunOffsetCurr.z += (lt.sunOffset[2] - sunOffsetCurr.z) * atmK;

    _targetRim.setHex(lt.rim);
    rimLight.color.lerp(_targetRim, atmK);
    rimLight.intensity += (lt.rimInt - rimLight.intensity) * atmK;

    _targetHemiSky.setHex(lt.hemiSky);
    _targetHemiGround.setHex(lt.hemiGround);
    hemiLight.color.lerp(_targetHemiSky, atmK);
    hemiLight.groundColor.lerp(_targetHemiGround, atmK);
    hemiLight.intensity += (lt.hemiInt - hemiLight.intensity) * atmK;
    scene.environmentIntensity += (lt.envInt - scene.environmentIntensity) * atmK;
    if (activeEnvMode !== timeOfDay) {
      activeEnvMode = timeOfDay;
      scene.environment = diabloEnvRig.getTexture(timeOfDay);
    }

    mats.windowGlow.emissiveIntensity += (lt.emissiveWin - mats.windowGlow.emissiveIntensity) * atmK;
    mats.stainedGlass.emissiveIntensity = mats.windowGlow.emissiveIntensity * 1.15;
    mats.lanternGlow.emissiveIntensity += (lt.emissiveLantern - mats.lanternGlow.emissiveIntensity) * atmK;

    for (let i = 0; i < lanternLights.length; i++) {
      const flicker = 0.92 + Math.sin(elapsed * 7.5 + i * 2.1) * 0.06 + Math.sin(elapsed * 13.0 + i) * 0.04;
      const targetPl = (i === lanternLights.length - 1 ? Math.max(2.8, lt.lanternPointInt) : lt.lanternPointInt) * flicker;
      lanternLights[i].intensity += (targetPl - lanternLights[i].intensity) * atmK;
    }
    for (let i = 0; i < lanternHalos.length; i++) {
      const m = lanternHalos[i].material as THREE.SpriteMaterial;
      m.opacity += (lt.haloOpacity - m.opacity) * atmK;
    }

    // 3. Player Movement & Pending Mob Attack Pursuit
    let moveSpeed = 0;
    if (isPlaying) {
      if (keys.has('KeyQ')) targetCamYaw += 1.9 * dt;
      if (keys.has('KeyE')) targetCamYaw -= 1.9 * dt;

      if (isLeftDown && !isRightDragging) {
        holdMoveCooldown -= dt;
        if (holdMoveCooldown <= 0) {
          holdMoveCooldown = 0.16;
          issueClickAction(lastPointerX, lastPointerY, false, false);
        }
      }

      if (pendingAttackMobId) {
        const pm = mobById.get(pendingAttackMobId);
        if (!pm || !pm.alive) {
          pendingAttackMobId = null;
        } else if (Math.hypot(pm.x - playerX, pm.z - playerZ) <= SWORDSMAN_MELEE_RANGE) {
          activePath = [];
          pendingAttackMobId = null;
          cursorRingMesh.visible = false;
          performSwordSwing(pm);
        }
      }

      let inX = 0;
      let inZ = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) inZ -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) inZ += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) inX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) inX += 1;

      const walkSpeed = 7.4;

      if (inX !== 0 || inZ !== 0) {
        activePath = [];
        pendingAttackMobId = null;
        cursorRingMesh.visible = false;
        const len = Math.hypot(inX, inZ);
        const nx = inX / len;
        const nz = inZ / len;
        const cosY = Math.cos(camYaw);
        const sinY = Math.sin(camYaw);
        const wx = nx * cosY + nz * sinY;
        const wz = -nx * sinY + nz * cosY;

        const nextX = playerX + wx * walkSpeed * dt;
        const nextZ = playerZ + wz * walkSpeed * dt;
        const resolved = PRONTERA_NAV.resolveCollision(nextX, nextZ, 0.58);
        const moved = Math.hypot(resolved.x - playerX, resolved.z - playerZ);
        playerX = resolved.x;
        playerZ = resolved.z;
        moveSpeed = moved / Math.max(dt, 0.001);

        const targetAngle = Math.atan2(wx, wz);
        let diff = targetAngle - playerYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        playerYaw += diff * (1 - Math.exp(-16 * dt));
      } else if (activePath.length > 0) {
        const wp = activePath[0];
        const dx = wp.x - playerX;
        const dz = wp.z - playerZ;
        const dist = Math.hypot(dx, dz);
        const step = walkSpeed * dt;

        if (dist <= step) {
          playerX = wp.x;
          playerZ = wp.z;
          activePath.shift();
          moveSpeed = walkSpeed;
        } else {
          const vx = dx / dist;
          const vz = dz / dist;
          const resolved = PRONTERA_NAV.resolveCollision(
            playerX + vx * step,
            playerZ + vz * step,
            0.58,
          );
          playerX = resolved.x;
          playerZ = resolved.z;
          moveSpeed = walkSpeed;

          const targetAngle = Math.atan2(vx, vz);
          let diff = targetAngle - playerYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          playerYaw += diff * (1 - Math.exp(-16 * dt));
        }
      }
    }
    moveSpeedGlobal = moveSpeed;

    const groundY = groundHeightAt(playerX, playerZ);
    hero.root.position.set(playerX, groundY, playerZ);
    hero.root.rotation.y = playerYaw;

    if (moveSpeed > 0.25) {
      walkPhase += moveSpeed * dt * 1.45;
      const stepHalf = Math.floor(walkPhase / Math.PI);
      if (stepHalf !== lastStepHalf) {
        lastStepHalf = stepHalf;
        audio.playFootstep(isCobbleRoad(playerX, playerZ));
      }
    }
    animateHeroGait(hero, moveSpeed, walkPhase, elapsed, dt, attackAnim);

    // 4. Cursor Ring Pulse & Rotation
    if (cursorRingMesh.visible) {
      cursorRingMesh.rotation.z += dt * 2.4;
      const pulse = 0.92 + Math.sin(elapsed * 7) * 0.1;
      cursorRingMesh.scale.set(pulse, pulse, 1);
      if (activePath.length === 0) {
        cursorRingLife -= dt;
        if (cursorRingLife <= 0) {
          cursorRingMesh.visible = false;
        }
      }
    }

    // 5. Fountain & Moat Water Shimmer + Field Mobs Simulation & Respawn
    fountainWater.rotation.z = elapsed * 0.15;
    sprayGroup.scale.y = 0.96 + Math.sin(elapsed * 5.2) * 0.04;
    for (let i = 0; i < moatWaterMeshes.length; i++) {
      moatWaterMeshes[i].position.y = 0.085 + Math.sin(elapsed * 1.6 + i) * 0.012;
    }

    for (let i = 0; i < mobActors.length; i++) {
      const m = mobActors[i];
      if (!m.alive) {
        m.respawnTimer -= dt;
        if (m.deathTimer > 0) {
          m.deathTimer = Math.max(0, m.deathTimer - dt);
          const dFrac = m.deathTimer / 0.34;
          m.x += m.knockVx * dt;
          m.z += m.knockVz * dt;
          m.knockVx *= Math.exp(-8 * dt);
          m.knockVz *= Math.exp(-8 * dt);
          m.group.position.set(m.x, groundHeightAt(m.x, m.z), m.z);
          m.bodyMesh.scale.set(
            m.baseScale * (1.35 - dFrac * 0.35),
            m.baseScale * Math.max(0.06, dFrac),
            m.baseScale * (1.35 - dFrac * 0.35),
          );
          m.shadowMesh.scale.setScalar(m.baseScale * dFrac);
          if (m.deathTimer <= 0) {
            m.group.visible = false;
          }
        }
        if (m.respawnTimer <= 0) {
          m.alive = true;
          m.hp = m.maxHp;
          m.x = m.homeX;
          m.z = m.homeZ;
          m.knockVx = 0;
          m.knockVz = 0;
          m.hitFlashTimer = 0;
          m.group.visible = true;
          m.hpBarGroup.visible = false;
          m.bodyMesh.scale.setScalar(m.baseScale);
          m.shadowMesh.scale.setScalar(m.baseScale);
        }
        continue;
      }

      // Hit flash feedback
      if (m.hitFlashTimer > 0) {
        m.hitFlashTimer = Math.max(0, m.hitFlashTimer - dt);
        m.jellyMat.emissive.setHex(0xffffff);
        m.jellyMat.emissiveIntensity = (m.hitFlashTimer / 0.16) * 0.9;
      } else if (m.jellyMat.emissiveIntensity > 0) {
        m.jellyMat.emissiveIntensity = 0;
      }

      // Knockback velocity + gentle idle roaming around spawn
      if (Math.hypot(m.knockVx, m.knockVz) > 0.05) {
        const kx = m.x + m.knockVx * dt;
        const kz = m.z + m.knockVz * dt;
        if (groundHeightAt(kx, kz) >= -0.05) {
          m.x = kx;
          m.z = kz;
        }
        m.knockVx *= Math.exp(-9 * dt);
        m.knockVz *= Math.exp(-9 * dt);
      } else {
        m.hopPhase += m.hopSpeed * dt;
        const hopSine = Math.sin(m.hopPhase);
        const air = Math.max(0, hopSine);
        if (air > 0.02) {
          m.angle += 0.36 * dt;
          const nx = m.homeX + Math.cos(m.angle + i) * 2.4;
          const nz = m.homeZ + Math.sin(m.angle + i) * 2.4;
          m.x += (nx - m.x) * Math.min(1, dt * 4);
          m.z += (nz - m.z) * Math.min(1, dt * 4);
        }
        m.group.rotation.y = Math.atan2(-Math.sin(m.angle + i), Math.cos(m.angle + i));
        m.bodyMesh.position.y = air * 0.58;
        const squash = air > 0.05 ? 1 + air * 0.16 : 1 - Math.abs(hopSine) * 0.14;
        const stretchXZ = 1 / Math.sqrt(squash);
        m.bodyMesh.scale.set(
          m.baseScale * stretchXZ,
          m.baseScale * squash,
          m.baseScale * stretchXZ,
        );
        m.shadowMesh.scale.setScalar(m.baseScale * (1 - air * 0.22));
      }

      const py = groundHeightAt(m.x, m.z);
      m.group.position.set(m.x, py, m.z);

      if (m.hpBarGroup.visible) {
        m.hpBarGroup.quaternion.copy(camera.quaternion);
        m.hpFillMesh.scale.x = Math.max(0.01, m.hp / m.maxHp);
      }
    }

    // Update floating combat popups lifetime
    for (let i = activePopups.length - 1; i >= 0; i--) {
      activePopups[i].life -= dt;
      if (activePopups[i].life <= 0) {
        activePopups.splice(i, 1);
      }
    }

    // 6. Camera Choreography
    const camK = 1 - Math.exp(-10 * atmDt);
    if (!isPlaying) {
      const orbitAngle = elapsed * 0.14;
      _vec3A.set(
        Math.sin(orbitAngle) * 31,
        14.5 + Math.sin(elapsed * 0.25) * 1.6,
        23 + Math.cos(orbitAngle) * 24,
      );
      _vec3B.set(0, 5.0, -14);
      camCurrentPos.lerp(_vec3A, 1 - Math.exp(-3.5 * atmDt));
      camLookAt.lerp(_vec3B, 1 - Math.exp(-3.5 * atmDt));
      camera.position.copy(camCurrentPos);
      camera.lookAt(camLookAt);
    } else {
      camYaw += (targetCamYaw - camYaw) * camK;
      camPitch += (targetCamPitch - camPitch) * camK;
      camDist += (targetCamDist - camDist) * camK;

      _vec3B.set(playerX, groundY + 1.45, playerZ);
      camLookAt.lerp(_vec3B, 1 - Math.exp(-14 * atmDt));

      const horiz = Math.cos(camPitch) * camDist;
      _vec3A.set(
        camLookAt.x + Math.sin(camYaw) * horiz,
        camLookAt.y + Math.sin(camPitch) * camDist,
        camLookAt.z + Math.cos(camYaw) * horiz,
      );
      camCurrentPos.lerp(_vec3A, 1 - Math.exp(-14 * atmDt));
      camera.position.copy(camCurrentPos);
      camera.lookAt(camLookAt);
    }

    // Center Key Sun & Rim Shadow Frustums on Focus
    sunLight.position.set(focusX + sunOffsetCurr.x, sunOffsetCurr.y, focusZ + sunOffsetCurr.z);
    sunLight.target.position.set(focusX, 0, focusZ);
    sunLight.target.updateMatrixWorld();

    rimLight.position.set(focusX - sunOffsetCurr.x * 0.9, 36, focusZ - sunOffsetCurr.z * 0.9);
    rimLight.target.position.set(focusX, 0, focusZ);
    rimLight.target.updateMatrixWorld();

    // Sync Diablo IV PBR uniforms (zero per-frame heap allocations)
    _sunDirScratch.copy(sunLight.position).sub(sunLight.target.position).normalize();
    pbrUniforms.uPbrTime.value = elapsed;
    pbrUniforms.uSunDir.value.copy(_sunDirScratch);
    pbrUniforms.uSunColor.value
      .copy(sunLight.color)
      .multiplyScalar(Math.min(1.65, Math.max(0.45, sunLight.intensity * 0.65)));
    pbrUniforms.uSkyColor.value.copy(hemiLight.color);
    pbrUniforms.uGroundColor.value.copy(hemiLight.groundColor);
    pbrUniforms.uWetness.value = weatherUniforms.uWetness.value;
    pbrUniforms.uSnow.value = weatherUniforms.uSnow.value;
    pbrUniforms.uLightning.value = lightningFlash;
    const targetContrast = timeOfDay === 'evening' ? 1.22 : timeOfDay === 'sunset' ? 1.12 : 1.04;
    pbrUniforms.uMoodContrast.value += (targetContrast - pbrUniforms.uMoodContrast.value) * atmK;

    audio.updateAmbient(dt);

    hudTimer += dt;
    const hudInterval = activePopups.length > 0 ? 0.05 : 0.125;
    if (hudTimer >= hudInterval) {
      hudTimer = 0;
      emitHudSnapshot();
    }

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  };

  if (isSoftwareGl) {
    renderer.render(scene, camera);
    afterDraw(tick);
  } else {
    frameId = requestAnimationFrame(tick);
  }

  return {
    setPlaying: (playing: boolean) => {
      isPlaying = playing;
      if (playing) {
        const gy = groundHeightAt(playerX, playerZ);
        camYaw = targetCamYaw;
        camPitch = targetCamPitch;
        camDist = targetCamDist;
        camLookAt.set(playerX, gy + 1.45, playerZ);
        const horiz = Math.cos(camPitch) * camDist;
        camCurrentPos.set(
          camLookAt.x + Math.sin(camYaw) * horiz,
          camLookAt.y + Math.sin(camPitch) * camDist,
          camLookAt.z + Math.cos(camYaw) * horiz,
        );
        camera.position.copy(camCurrentPos);
        camera.lookAt(camLookAt);
      } else {
        clearHeldInputs();
      }
    },
    setTimeOfDay: (mode: TimeOfDay) => {
      timeOfDay = mode;
      activeEnvMode = mode;
      scene.environment = diabloEnvRig.getTexture(mode);
    },
    setWeather: (weather: WeatherMode) => {
      weatherMode = weather;
      audio.setWeather(weather);
      if (weather === 'rain') {
        weatherSystem.triggerLightning(() => audio.playThunder());
      }
    },
    triggerLightning: () => {
      weatherSystem.triggerLightning(() => audio.playThunder());
    },
    setCameraPreset: (preset: CameraPreset) => {
      if (preset === 'classic') {
        targetCamPitch = 0.62;
        targetCamDist = 20.5;
      } else if (preset === 'wide') {
        targetCamPitch = 0.94;
        targetCamDist = 38;
      } else {
        targetCamPitch = 0.44;
        targetCamDist = 10.5;
      }
    },
    resetCameraNorth: () => {
      targetCamYaw = 0;
      targetCamPitch = 0.62;
      targetCamDist = 20.5;
    },
    teleportToLandmark: (landmarkId: string) => {
      const lm = LANDMARKS.find((l) => l.id === landmarkId);
      if (!lm) return;
      activePath = [];
      pendingAttackMobId = null;
      cursorRingMesh.visible = false;
      playerX = lm.x;
      playerZ = lm.z;
      playerYaw = lm.facingYaw;
      const gy = groundHeightAt(playerX, playerZ);
      camLookAt.set(playerX, gy + 1.45, playerZ);
      const horiz = Math.cos(camPitch) * camDist;
      camCurrentPos.set(
        camLookAt.x + Math.sin(camYaw) * horiz,
        camLookAt.y + Math.sin(camPitch) * camDist,
        camLookAt.z + Math.cos(camYaw) * horiz,
      );
      audio.playMoveClick();
    },
    walkToWorldPoint: (x: number, z: number) => {
      const path = PRONTERA_NAV.findPath(playerX, playerZ, x, z);
      if (path.length > 0) {
        activePath = path;
        pendingAttackMobId = null;
        const dest = path[path.length - 1];
        cursorRingMesh.position.set(dest.x, groundHeightAt(dest.x, dest.z) + 0.065, dest.z);
        cursorRingMesh.visible = true;
        cursorRingLife = 1.4;
        audio.playMoveClick();
      }
    },
    attackNearest: () => {
      triggerMeleeAttack();
    },
    toggleMute: () => audio.toggleMute(),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      audio.dispose();
      weatherSystem.dispose();
      composer?.dispose();
      diabloEnvRig.dispose();
      mats.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    },
  };
}
