import * as THREE from 'three';

export type WeatherMode = 'clear' | 'rain' | 'snow';

export interface WeatherSystem {
  group: THREE.Group;
  flashLight: THREE.DirectionalLight;
  update: (
    dt: number,
    elapsed: number,
    focusX: number,
    focusZ: number,
    weather: WeatherMode,
    timeOfDay: 'day' | 'sunset' | 'evening',
    onThunder?: () => void,
  ) => number; // returns current lightning intensity 0..1
  triggerLightning: (onThunder?: () => void) => void;
  dispose: () => void;
}

function createRadialParticleTexture(soft = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, soft ? 2 : 6, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, soft ? 'rgba(240,248,255,0.75)' : 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSplashRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(215, 236, 255, 0.85)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(32, 32, 23, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(215, 236, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 32, 14, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWeatherSystem(): WeatherSystem {
  const group = new THREE.Group();

  // Secondary directional flash light for dramatic Diablo-style storm lightning
  const flashLight = new THREE.DirectionalLight(0xcbe2ff, 0);
  flashLight.position.set(-45, 72, -30);
  group.add(flashLight);

  // 1. Rain Streak System (LineSegments with per-drop position wrapping around focus)
  const RAIN_COUNT = 2000;
  const RAIN_SPAN = 60;
  const RAIN_HEIGHT = 32;
  const rainPositions = new Float32Array(RAIN_COUNT * 6);
  const rainData = new Float32Array(RAIN_COUNT * 4); // ox, y, oz, speed

  for (let i = 0; i < RAIN_COUNT; i++) {
    const ox = (Math.random() - 0.5) * RAIN_SPAN;
    const y = Math.random() * RAIN_HEIGHT;
    const oz = (Math.random() - 0.5) * RAIN_SPAN;
    const spd = 28 + Math.random() * 14;
    rainData[i * 4] = ox;
    rainData[i * 4 + 1] = y;
    rainData[i * 4 + 2] = oz;
    rainData[i * 4 + 3] = spd;
  }

  const rainGeo = new THREE.BufferGeometry();
  const rainPosAttr = new THREE.BufferAttribute(rainPositions, 3);
  rainPosAttr.setUsage(THREE.DynamicDrawUsage);
  rainGeo.setAttribute('position', rainPosAttr);

  const rainMat = new THREE.LineBasicMaterial({
    color: 0xd8ebff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  rainLines.visible = false;
  group.add(rainLines);

  // 2. Rain Ground Splash Ripples (InstancedMesh)
  const SPLASH_COUNT = 90;
  const splashTex = createSplashRingTexture();
  const splashGeo = new THREE.PlaneGeometry(0.65, 0.65);
  splashGeo.rotateX(-Math.PI / 2);
  const splashMat = new THREE.MeshBasicMaterial({
    map: splashTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const splashInst = new THREE.InstancedMesh(splashGeo, splashMat, SPLASH_COUNT);
  splashInst.frustumCulled = false;
  splashInst.visible = false;
  const splashState = Array.from({ length: SPLASH_COUNT }, () => ({
    wx: (Math.random() - 0.5) * 44,
    wz: (Math.random() - 0.5) * 44,
    phase: Math.random(),
    speed: 1.8 + Math.random() * 1.4,
  }));
  group.add(splashInst);

  // 3. Snowfall System (Points with swirling drift)
  const SNOW_COUNT = 2200;
  const SNOW_SPAN = 64;
  const SNOW_HEIGHT = 30;
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowData = new Float32Array(SNOW_COUNT * 4); // ox, y, oz, seed
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowData[i * 4] = (Math.random() - 0.5) * SNOW_SPAN;
    snowData[i * 4 + 1] = Math.random() * SNOW_HEIGHT;
    snowData[i * 4 + 2] = (Math.random() - 0.5) * SNOW_SPAN;
    snowData[i * 4 + 3] = Math.random() * Math.PI * 2;
  }
  const snowGeo = new THREE.BufferGeometry();
  const snowPosAttr = new THREE.BufferAttribute(snowPositions, 3);
  snowPosAttr.setUsage(THREE.DynamicDrawUsage);
  snowGeo.setAttribute('position', snowPosAttr);

  const particleTex = createRadialParticleTexture(true);
  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    map: particleTex,
    size: 0.36,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.frustumCulled = false;
  snowPoints.visible = false;
  group.add(snowPoints);

  // 4. Warm Atmospheric Fireflies / Golden Dust Motes (Clear weather life)
  const MOTE_COUNT = 160;
  const motePositions = new Float32Array(MOTE_COUNT * 3);
  const moteSeeds = Array.from({ length: MOTE_COUNT }, () => ({
    ox: (Math.random() - 0.5) * 64,
    oy: 0.6 + Math.random() * 7.5,
    oz: (Math.random() - 0.5) * 64,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.9,
  }));
  const moteGeo = new THREE.BufferGeometry();
  const motePosAttr = new THREE.BufferAttribute(motePositions, 3);
  motePosAttr.setUsage(THREE.DynamicDrawUsage);
  moteGeo.setAttribute('position', motePosAttr);

  const moteMat = new THREE.PointsMaterial({
    color: 0xffd27a,
    map: particleTex,
    size: 0.28,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.frustumCulled = false;
  group.add(motePoints);

  // Lightning state
  let lightningTimer = 2.2;
  let lightningPulse = 0;
  let lightningSecondStrikeAt = -1;
  let rainAlpha = 0;
  let snowAlpha = 0;
  let moteAlpha = 0.6;

  const dummy = new THREE.Object3D();

  const triggerLightning = (onThunder?: () => void) => {
    lightningPulse = 1.0;
    lightningSecondStrikeAt = 0.14;
    // Randomize sky direction slightly for dramatic shadows
    const ang = Math.random() * Math.PI * 2;
    flashLight.position.set(Math.cos(ang) * 65, 78, Math.sin(ang) * 65);
    onThunder?.();
  };

  const update = (
    dt: number,
    elapsed: number,
    focusX: number,
    focusZ: number,
    weather: WeatherMode,
    timeOfDay: 'day' | 'sunset' | 'evening',
    onThunder?: () => void,
  ): number => {
    const blendK = 1 - Math.exp(-4.8 * dt);
    rainAlpha += ((weather === 'rain' ? 1 : 0) - rainAlpha) * blendK;
    snowAlpha += ((weather === 'snow' ? 1 : 0) - snowAlpha) * blendK;
    const targetMote = weather === 'clear' ? (timeOfDay === 'day' ? 0.35 : 0.88) : 0.08;
    moteAlpha += (targetMote - moteAlpha) * blendK;

    // Update Rain
    if (rainAlpha > 0.02) {
      rainLines.visible = true;
      rainMat.opacity = rainAlpha * 0.68;
      splashInst.visible = true;
      splashMat.opacity = rainAlpha * 0.62;

      const windX = -4.2;
      const windZ = -1.8;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 4;
        let ox = rainData[idx] + windX * dt;
        let y = rainData[idx + 1] - rainData[idx + 3] * dt;
        let oz = rainData[idx + 2] + windZ * dt;

        if (y < 0) {
          y += RAIN_HEIGHT;
          ox = (Math.random() - 0.5) * RAIN_SPAN;
          oz = (Math.random() - 0.5) * RAIN_SPAN;
        }
        rainData[idx] = ox;
        rainData[idx + 1] = y;
        rainData[idx + 2] = oz;

        const wx = focusX + ox;
        const wz = focusZ + oz;
        const pIdx = i * 6;
        rainPositions[pIdx] = wx;
        rainPositions[pIdx + 1] = y;
        rainPositions[pIdx + 2] = wz;
        rainPositions[pIdx + 3] = wx - windX * 0.065;
        rainPositions[pIdx + 4] = y + 1.85;
        rainPositions[pIdx + 5] = wz - windZ * 0.065;
      }
      rainPosAttr.needsUpdate = true;

      for (let i = 0; i < SPLASH_COUNT; i++) {
        const sp = splashState[i];
        sp.phase += sp.speed * dt;
        if (sp.phase >= 1) {
          sp.phase -= 1;
          sp.wx = focusX + (Math.random() - 0.5) * 44;
          sp.wz = focusZ + (Math.random() - 0.5) * 44;
        }
        const scale = 0.28 + sp.phase * 1.25;
        dummy.position.set(sp.wx, 0.072, sp.wz);
        dummy.scale.set(scale, 1, scale);
        dummy.updateMatrix();
        splashInst.setMatrixAt(i, dummy.matrix);
      }
      splashInst.instanceMatrix.needsUpdate = true;
    } else {
      rainLines.visible = false;
      splashInst.visible = false;
    }

    // Update Snow
    if (snowAlpha > 0.02) {
      snowPoints.visible = true;
      snowMat.opacity = snowAlpha * 0.84;
      for (let i = 0; i < SNOW_COUNT; i++) {
        const idx = i * 4;
        const seed = snowData[idx + 3];
        let ox = snowData[idx] + (Math.sin(elapsed * 1.1 + seed) * 1.3 - 0.6) * dt;
        let y = snowData[idx + 1] - (2.6 + (seed % 1.4)) * dt;
        let oz = snowData[idx + 2] + Math.cos(elapsed * 0.9 + seed) * 1.1 * dt;

        if (y < 0) {
          y += SNOW_HEIGHT;
          ox = (Math.random() - 0.5) * SNOW_SPAN;
          oz = (Math.random() - 0.5) * SNOW_SPAN;
        }
        snowData[idx] = ox;
        snowData[idx + 1] = y;
        snowData[idx + 2] = oz;

        const pIdx = i * 3;
        snowPositions[pIdx] = focusX + ox;
        snowPositions[pIdx + 1] = y;
        snowPositions[pIdx + 2] = focusZ + oz;
      }
      snowPosAttr.needsUpdate = true;
    } else {
      snowPoints.visible = false;
    }

    // Update Fireflies / Dust Motes
    if (moteAlpha > 0.03) {
      motePoints.visible = true;
      moteMat.opacity = moteAlpha;
      moteMat.color.setHex(timeOfDay === 'day' ? 0xfff3c4 : 0xffb84d);
      for (let i = 0; i < MOTE_COUNT; i++) {
        const m = moteSeeds[i];
        const t = elapsed * m.speed + m.phase;
        const pIdx = i * 3;
        motePositions[pIdx] = focusX + m.ox + Math.sin(t) * 1.8;
        motePositions[pIdx + 1] = m.oy + Math.sin(t * 1.3) * 0.7;
        motePositions[pIdx + 2] = focusZ + m.oz + Math.cos(t * 0.85) * 1.8;
      }
      motePosAttr.needsUpdate = true;
    } else {
      motePoints.visible = false;
    }

    // Lightning Storm Cycle during Rain
    if (weather === 'rain') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 7.0 + Math.random() * 8.5;
        triggerLightning(onThunder);
      }
    } else {
      lightningTimer = 2.0;
    }

    if (lightningSecondStrikeAt > 0) {
      lightningSecondStrikeAt -= dt;
      if (lightningSecondStrikeAt <= 0) {
        lightningPulse = Math.max(lightningPulse, 0.85);
      }
    }

    lightningPulse = Math.max(0, lightningPulse - dt * 5.2);
    flashLight.intensity = lightningPulse * 6.5;

    return lightningPulse;
  };

  return {
    group,
    flashLight,
    update,
    triggerLightning,
    dispose: () => {
      rainGeo.dispose();
      rainMat.dispose();
      splashGeo.dispose();
      splashMat.dispose();
      splashTex.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      moteGeo.dispose();
      moteMat.dispose();
      particleTex.dispose();
    },
  };
}
