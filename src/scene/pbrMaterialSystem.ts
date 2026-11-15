import * as THREE from 'three';
import type { WeatherShaderUniforms, WorldWeatherShaderOptions } from './weatherShaders';

export type PbrSurfaceKind =
  | 'stone'
  | 'roof'
  | 'plaster'
  | 'wood'
  | 'metal'
  | 'leather'
  | 'cloth'
  | 'foliage'
  | 'grassGround'
  | 'skin'
  | 'slime';

export type PbrClassification = PbrSurfaceKind | 'skip';

export type PbrTimeOfDay = 'day' | 'sunset' | 'evening';

export interface PbrSurfaceProfile {
  kind: PbrSurfaceKind;
  microFreq: number;
  microNormalStrength: number;
  microRoughnessVar: number;
  microAlbedoVar: number;
  cavityAoStrength: number;
  contactAoHeight: number;
  contactAoStrength: number;
  edgeWearBoost: number;
  fresnelReflectStrength: number;
  useLocalCoords: boolean;
  anisotropicStretch: number;
}

export interface PbrShaderUniforms {
  uPbrTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uSkyColor: { value: THREE.Color };
  uGroundColor: { value: THREE.Color };
  uWetness: { value: number };
  uSnow: { value: number };
  uLightning: { value: number };
  uMoodContrast: { value: number };
}

export interface DiabloEnvironmentRig {
  getTexture: (mode: PbrTimeOfDay) => THREE.Texture;
  dispose: () => void;
}

const SURFACE_PROFILES: Record<PbrSurfaceKind, PbrSurfaceProfile> = {
  stone: {
    kind: 'stone',
    microFreq: 9.5,
    microNormalStrength: 0.34,
    microRoughnessVar: 0.18,
    microAlbedoVar: 0.095,
    cavityAoStrength: 0.58,
    contactAoHeight: 1.45,
    contactAoStrength: 0.44,
    edgeWearBoost: 0.18,
    fresnelReflectStrength: 0.24,
    useLocalCoords: false,
    anisotropicStretch: 1.0,
  },
  roof: {
    kind: 'roof',
    microFreq: 11.0,
    microNormalStrength: 0.28,
    microRoughnessVar: 0.15,
    microAlbedoVar: 0.08,
    cavityAoStrength: 0.50,
    contactAoHeight: 0.0,
    contactAoStrength: 0.0,
    edgeWearBoost: 0.16,
    fresnelReflectStrength: 0.30,
    useLocalCoords: false,
    anisotropicStretch: 1.35,
  },
  plaster: {
    kind: 'plaster',
    microFreq: 13.5,
    microNormalStrength: 0.24,
    microRoughnessVar: 0.13,
    microAlbedoVar: 0.07,
    cavityAoStrength: 0.44,
    contactAoHeight: 1.35,
    contactAoStrength: 0.40,
    edgeWearBoost: 0.07,
    fresnelReflectStrength: 0.11,
    useLocalCoords: false,
    anisotropicStretch: 1.0,
  },
  wood: {
    kind: 'wood',
    microFreq: 14.0,
    microNormalStrength: 0.30,
    microRoughnessVar: 0.16,
    microAlbedoVar: 0.095,
    cavityAoStrength: 0.48,
    contactAoHeight: 0.90,
    contactAoStrength: 0.22,
    edgeWearBoost: 0.14,
    fresnelReflectStrength: 0.22,
    useLocalCoords: true,
    anisotropicStretch: 2.6,
  },
  metal: {
    kind: 'metal',
    microFreq: 26.0,
    microNormalStrength: 0.16,
    microRoughnessVar: 0.14,
    microAlbedoVar: 0.06,
    cavityAoStrength: 0.44,
    contactAoHeight: 0.45,
    contactAoStrength: 0.16,
    edgeWearBoost: 0.36,
    fresnelReflectStrength: 0.56,
    useLocalCoords: true,
    anisotropicStretch: 3.0,
  },
  leather: {
    kind: 'leather',
    microFreq: 28.0,
    microNormalStrength: 0.26,
    microRoughnessVar: 0.15,
    microAlbedoVar: 0.075,
    cavityAoStrength: 0.44,
    contactAoHeight: 0.45,
    contactAoStrength: 0.16,
    edgeWearBoost: 0.24,
    fresnelReflectStrength: 0.32,
    useLocalCoords: true,
    anisotropicStretch: 1.0,
  },
  cloth: {
    kind: 'cloth',
    microFreq: 34.0,
    microNormalStrength: 0.22,
    microRoughnessVar: 0.11,
    microAlbedoVar: 0.065,
    cavityAoStrength: 0.36,
    contactAoHeight: 0.45,
    contactAoStrength: 0.14,
    edgeWearBoost: 0.10,
    fresnelReflectStrength: 0.20,
    useLocalCoords: true,
    anisotropicStretch: 1.4,
  },
  foliage: {
    kind: 'foliage',
    microFreq: 12.0,
    microNormalStrength: 0.18,
    microRoughnessVar: 0.13,
    microAlbedoVar: 0.095,
    cavityAoStrength: 0.36,
    contactAoHeight: 0.85,
    contactAoStrength: 0.22,
    edgeWearBoost: 0.06,
    fresnelReflectStrength: 0.18,
    useLocalCoords: false,
    anisotropicStretch: 1.0,
  },
  grassGround: {
    kind: 'grassGround',
    microFreq: 8.5,
    microNormalStrength: 0.28,
    microRoughnessVar: 0.14,
    microAlbedoVar: 0.10,
    cavityAoStrength: 0.44,
    contactAoHeight: 0.0,
    contactAoStrength: 0.0,
    edgeWearBoost: 0.05,
    fresnelReflectStrength: 0.12,
    useLocalCoords: false,
    anisotropicStretch: 1.0,
  },
  skin: {
    kind: 'skin',
    microFreq: 38.0,
    microNormalStrength: 0.10,
    microRoughnessVar: 0.07,
    microAlbedoVar: 0.03,
    cavityAoStrength: 0.24,
    contactAoHeight: 0.0,
    contactAoStrength: 0.0,
    edgeWearBoost: 0.03,
    fresnelReflectStrength: 0.22,
    useLocalCoords: true,
    anisotropicStretch: 1.0,
  },
  slime: {
    kind: 'slime',
    microFreq: 18.0,
    microNormalStrength: 0.06,
    microRoughnessVar: 0.05,
    microAlbedoVar: 0.03,
    cavityAoStrength: 0.16,
    contactAoHeight: 0.35,
    contactAoStrength: 0.18,
    edgeWearBoost: 0.14,
    fresnelReflectStrength: 0.50,
    useLocalCoords: true,
    anisotropicStretch: 1.0,
  },
};

export function createPbrUniforms(): PbrShaderUniforms {
  return {
    uPbrTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.55, 0.72, 0.42).normalize() },
    uSunColor: { value: new THREE.Color(0xffddb0) },
    uSkyColor: { value: new THREE.Color(0x84baf0) },
    uGroundColor: { value: new THREE.Color(0x261f18) },
    uWetness: { value: 0 },
    uSnow: { value: 0 },
    uLightning: { value: 0 },
    uMoodContrast: { value: 1.0 },
  };
}

export function getPbrSurfaceProfile(kind: PbrSurfaceKind): PbrSurfaceProfile {
  return SURFACE_PROFILES[kind];
}

export function classifyPbrSurfaceKind(mat: THREE.Material): PbrClassification {
  if (mat.userData?.pbrSkip || mat.userData?.pbrHandled) {
    return 'skip';
  }
  const explicit = mat.userData?.pbrKind as PbrClassification | undefined;
  if (explicit && (explicit === 'skip' || explicit in SURFACE_PROFILES)) {
    return explicit;
  }

  if (
    !(mat instanceof THREE.MeshStandardMaterial) &&
    !(mat instanceof THREE.MeshPhysicalMaterial)
  ) {
    return 'skip';
  }

  if (!mat.visible) return 'skip';

  if (mat.emissiveIntensity >= 0.45 && mat.emissive.getHex() !== 0x000000) {
    return 'skip';
  }
  if (mat.transparent && mat.opacity < 0.75) {
    return 'skip';
  }
  if (mat.transparent && mat.opacity >= 0.75) {
    return 'slime';
  }
  if (mat.metalness >= 0.65) {
    return 'metal';
  }
  if (mat instanceof THREE.MeshPhysicalMaterial && mat.sheen > 0.25) {
    return 'cloth';
  }
  if (mat instanceof THREE.MeshPhysicalMaterial && mat.clearcoat > 0.1) {
    return 'leather';
  }
  if (mat.alphaTest > 0.1) {
    return 'foliage';
  }
  if (mat.roughness <= 0.45) {
    return 'stone';
  }
  return 'cloth';
}

/**
 * Program cache key varies only on structural shader branches (hasWeather, hasSway)
 * while all per-material PBR profile and weather strengths live in uniforms,
 * enabling maximum WebGLProgram sharing and instant shader compilation.
 */
export function computePbrProgramCacheKey(
  _kind: PbrSurfaceKind,
  weatherOpts?: WorldWeatherShaderOptions,
): string {
  const hasWeather = weatherOpts ? 1 : 0;
  const hasSway = (weatherOpts?.swayAmp ?? 0) > 0.0001 ? 1 : 0;
  return `diablo-pbr-v2-w${hasWeather}-s${hasSway}`;
}

const GLSL_PBR_FAST_NOISE = /* glsl */ `
float pbrHash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float pbrHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float pbrNoise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(pbrHash21(i), pbrHash21(i + vec2(1.0, 0.0)), u.x),
    mix(pbrHash21(i + vec2(0.0, 1.0)), pbrHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float pbrFbm2(vec2 p) {
  float v = 0.55 * pbrNoise2D(p);
  p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.07 + vec2(13.7, 29.3);
  v += 0.30 * pbrNoise2D(p);
  p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.07 + vec2(7.1, 19.9);
  v += 0.15 * pbrNoise2D(p);
  return v;
}

float pbrSnowDrift(vec2 p) {
  vec2 q = vec2(pbrNoise2D(p * 0.075), pbrNoise2D(p * 0.075 + vec2(5.2, 1.3)));
  return pbrFbm2(p * 0.11 + q * 1.35);
}

// Analytical 3D value noise: vec4(val [0..1], dVal/dx, dVal/dy, dVal/dz)
vec4 pbrNoise3DGrad(vec3 x) {
  vec3 i = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);

  float a = pbrHash31(i);
  float b = pbrHash31(i + vec3(1.0, 0.0, 0.0));
  float c = pbrHash31(i + vec3(0.0, 1.0, 0.0));
  float d = pbrHash31(i + vec3(1.0, 1.0, 0.0));
  float e = pbrHash31(i + vec3(0.0, 0.0, 1.0));
  float f = pbrHash31(i + vec3(1.0, 0.0, 1.0));
  float g = pbrHash31(i + vec3(0.0, 1.0, 1.0));
  float h = pbrHash31(i + vec3(1.0, 1.0, 1.0));

  float k0 = a;
  float k1 = b - a;
  float k2 = c - a;
  float k3 = e - a;
  float k4 = a - b - c + d;
  float k5 = a - c - e + g;
  float k6 = a - b - e + f;
  float k7 = -a + b + c - d + e - f - g + h;

  float val = k0 + k1 * u.x + k2 * u.y + k3 * u.z
            + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;

  vec3 grad = du * vec3(
    k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
    k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
    k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y
  );
  return vec4(val, grad);
}
`;

export function applyAdvancedPbrShader(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  pbrUniforms: PbrShaderUniforms,
  weatherUniforms: WeatherShaderUniforms,
  kind: PbrSurfaceKind,
  weatherOpts?: WorldWeatherShaderOptions,
): void {
  const profile = getPbrSurfaceProfile(kind);
  const hasWeather = Boolean(weatherOpts);
  const hasSway = (weatherOpts?.swayAmp ?? 0) > 0.0001;
  const allowPuddles = weatherOpts?.allowPuddles ? 1.0 : 0.0;
  const snowAmount = weatherOpts?.snowAmount ?? 0.0;
  const wetDarken = weatherOpts?.wetDarken ?? 0.30;
  const swayAmp = weatherOpts?.swayAmp ?? 0.0;
  const swayHeightOffset = weatherOpts?.swayHeightOffset ?? 0.0;

  // Per-material uniform vectors so distinct surface classes share identical compiled GLSL programs
  const uPbrParams0 = {
    value: new THREE.Vector4(
      profile.microFreq,
      profile.microNormalStrength,
      profile.microRoughnessVar,
      profile.microAlbedoVar,
    ),
  };
  const uPbrParams1 = {
    value: new THREE.Vector4(
      profile.cavityAoStrength,
      profile.contactAoHeight,
      profile.contactAoStrength,
      profile.edgeWearBoost,
    ),
  };
  const uPbrParams2 = {
    value: new THREE.Vector4(
      profile.fresnelReflectStrength,
      profile.useLocalCoords ? 1.0 : 0.0,
      profile.anisotropicStretch,
      allowPuddles,
    ),
  };
  const uWeatherParams = {
    value: new THREE.Vector4(snowAmount, wetDarken, swayAmp, swayHeightOffset),
  };

  mat.userData.pbrHandled = true;
  mat.userData.pbrKind = kind;
  mat.customProgramCacheKey = () => computePbrProgramCacheKey(kind, weatherOpts);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = weatherUniforms.uTime;
    shader.uniforms.uWetness = pbrUniforms.uWetness;
    shader.uniforms.uSnow = pbrUniforms.uSnow;
    shader.uniforms.uLightning = pbrUniforms.uLightning;
    shader.uniforms.uPbrTime = pbrUniforms.uPbrTime;
    shader.uniforms.uSunDir = pbrUniforms.uSunDir;
    shader.uniforms.uSunColor = pbrUniforms.uSunColor;
    shader.uniforms.uSkyColor = pbrUniforms.uSkyColor;
    shader.uniforms.uGroundColor = pbrUniforms.uGroundColor;
    shader.uniforms.uMoodContrast = pbrUniforms.uMoodContrast;

    shader.uniforms.uPbrParams0 = uPbrParams0;
    shader.uniforms.uPbrParams1 = uPbrParams1;
    shader.uniforms.uPbrParams2 = uPbrParams2;
    shader.uniforms.uWeatherParams = uWeatherParams;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform vec4 uWeatherParams;
        varying vec3 vPbrWorldPos;
        varying vec3 vPbrWorldNormal;
        varying vec3 vPbrLocalPos;
        varying vec3 vPbrLocalNormal;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        ${
          hasSway
            ? /* glsl */ `
        {
          vec4 swayWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            swayWp = instanceMatrix * swayWp;
          #endif
          swayWp = modelMatrix * swayWp;
          float hFactor = clamp((transformed.y - uWeatherParams.w) * 0.45, 0.0, 1.5);
          float gust = sin(uTime * 1.9 + swayWp.x * 0.25 + swayWp.z * 0.21) * 0.65
                     + sin(uTime * 3.4 + swayWp.x * 0.55 - swayWp.z * 0.43) * 0.35;
          transformed.x += gust * uWeatherParams.z * hFactor;
          transformed.z += cos(uTime * 1.6 + swayWp.z * 0.3) * uWeatherParams.z * 0.6 * hFactor;
        }
        `
            : ''
        }
        `,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        #include <project_vertex>
        {
          vec4 pWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            pWp = instanceMatrix * pWp;
          #endif
          pWp = modelMatrix * pWp;
          vPbrWorldPos = pWp.xyz;
          vPbrLocalPos = transformed;

          vec3 pWn = objectNormal;
          vPbrLocalNormal = normalize(objectNormal);
          #ifdef USE_INSTANCING
            pWn = mat3(instanceMatrix) * pWn;
          #endif
          vPbrWorldNormal = normalize(mat3(modelMatrix) * pWn);
        }
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform float uWetness;
        uniform float uSnow;
        uniform float uLightning;
        uniform float uPbrTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uGroundColor;
        uniform float uMoodContrast;
        uniform vec4 uPbrParams0;
        uniform vec4 uPbrParams1;
        uniform vec4 uPbrParams2;
        uniform vec4 uWeatherParams;
        varying vec3 vPbrWorldPos;
        varying vec3 vPbrWorldNormal;
        varying vec3 vPbrLocalPos;
        varying vec3 vPbrLocalNormal;
        ${GLSL_PBR_FAST_NOISE}
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        vec3 pbrSamplePos = mix(vPbrWorldPos, vPbrLocalPos, uPbrParams2.y);
        vec3 pbrSampleNorm = normalize(mix(vPbrWorldNormal, vPbrLocalNormal, uPbrParams2.y));

        vec3 pbrCoordBase = vec3(pbrSamplePos.x, pbrSamplePos.y / max(0.5, uPbrParams2.z), pbrSamplePos.z);
        vec4 pbrMicroCoarse = pbrNoise3DGrad(pbrCoordBase * (uPbrParams0.x * 0.45));
        vec4 pbrMicroFine = pbrNoise3DGrad((pbrCoordBase + vec3(3.1, 1.7, 2.3)) * uPbrParams0.x);

        float pbrMicroGrain = pbrMicroCoarse.x * 0.55 + pbrMicroFine.x * 0.45;
        vec3 pbrMicroGrad = pbrMicroCoarse.yzw * 0.45 + pbrMicroFine.yzw * 0.55;
        float pbrCavity = clamp(1.0 - smoothstep(0.18, 0.68, pbrMicroGrain), 0.0, 1.0);
        float pbrRidge = smoothstep(0.60, 0.92, pbrMicroFine.x);

        // Microsurface mineral/grain albedo modulation & subtle Diablo IV edge wear
        diffuseColor.rgb *= 1.0 + (pbrMicroGrain - 0.5) * uPbrParams0.w;
        diffuseColor.rgb *= 1.0 - pbrCavity * (uPbrParams1.x * 0.24);
        diffuseColor.rgb += diffuseColor.rgb * (pbrRidge * uPbrParams1.w * 0.22);

        float pMacroNoise = pbrFbm2(vPbrWorldPos.xz * 0.14);
        float pMicroNoise = pbrNoise2D(vPbrWorldPos.xz * 2.4);
        float pPuddleMask = 0.0;
        float pSnowMask = 0.0;

        ${
          hasWeather
            ? /* glsl */ `
        if (uPbrParams2.w > 0.5 && vPbrWorldNormal.y > 0.72) {
          pPuddleMask = smoothstep(0.42, 0.59, pMacroNoise + (pMicroNoise - 0.5) * 0.12);
        }

        if (uWetness > 0.001) {
          float wetAmt = uWetness * (0.74 + 0.26 * pMacroNoise);
          diffuseColor.rgb *= mix(1.0, 1.0 - uWeatherParams.y, wetAmt);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.52 + vec3(0.02, 0.035, 0.055), pPuddleMask * uWetness * 0.82);
        }

        if (uSnow > 0.001 && uWeatherParams.x > 0.01) {
          float upFacing = smoothstep(0.30, 0.82, vPbrWorldNormal.y);
          float drift = pbrSnowDrift(vPbrWorldPos.xz);
          float fineGrain = pbrNoise2D(vPbrWorldPos.xz * 4.8);
          float sparkle = smoothstep(0.76, 0.96, pbrNoise2D(vPbrWorldPos.xz * 14.0));
          float baseLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float seamBias = mix(0.14, -0.06, clamp(baseLuma, 0.0, 1.0));
          float snowField = drift * 0.78 + fineGrain * 0.22 + seamBias;
          float snowPatch = smoothstep(0.28, 0.74, snowField);
          float maxCap = uPbrParams2.w > 0.5 ? 0.54 : 0.70;
          pSnowMask = clamp(upFacing * snowPatch * uSnow * uWeatherParams.x, 0.0, maxCap);
          vec3 snowShadowTint = vec3(0.76, 0.84, 0.94);
          vec3 snowBrightTint = vec3(0.94, 0.97, 1.0);
          vec3 snowAlbedo = mix(snowShadowTint, snowBrightTint, clamp(fineGrain + sparkle * 0.35, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, snowAlbedo, pSnowMask);
        }
        `
            : /* glsl */ `
        if (uWetness > 0.001) {
          diffuseColor.rgb *= mix(1.0, 0.84, uWetness);
        }
        `
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor += (pbrMicroFine.x - 0.5) * uPbrParams0.z;
        roughnessFactor -= pbrRidge * (uPbrParams1.w * 0.18);
        roughnessFactor += pbrCavity * (uPbrParams1.x * 0.14);

        if (uWetness > 0.001) {
          roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.50, uWetness);
          ${hasWeather ? 'roughnessFactor = mix(roughnessFactor, 0.04, pPuddleMask * uWetness);' : ''}
        }
        ${
          hasWeather
            ? /* glsl */ `
        if (uSnow > 0.001) {
          roughnessFactor = mix(roughnessFactor, 0.38 + pMicroNoise * 0.14, pSnowMask);
        }
        `
            : ''
        }
        roughnessFactor = clamp(roughnessFactor, 0.04, 0.98);
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        {
          // Analytical 3D micro-normal perturbation projected onto tangent plane
          vec3 tangentGrad = pbrMicroGrad - pbrSampleNorm * dot(pbrMicroGrad, pbrSampleNorm);
          float normalAtten = uPbrParams0.y * 0.16 * (1.0 - pSnowMask * 0.82);
          vec3 viewMicro = (viewMatrix * vec4(tangentGrad * normalAtten, 0.0)).xyz;
          normal = normalize(normal - viewMicro);
        }

        ${
          hasWeather
            ? /* glsl */ `
        if (uWetness > 0.001 && pPuddleMask > 0.05) {
          vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec2 rp = vPbrWorldPos.xz * 2.2;
          float r1 = sin(length(fract(rp) - 0.5) * 26.0 - uTime * 11.0);
          float r2 = cos(length(fract(rp * 1.37 + 0.4) - 0.5) * 24.0 - uTime * 9.5);
          vec3 rippleOffset = vec3((r1 + r2) * 0.045, 0.0, (r1 - r2) * 0.045) * uWetness;
          normal = normalize(mix(normal, normalize(upView + rippleOffset), pPuddleMask * uWetness * 0.88));
        }
        `
            : ''
        }
        `,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `
        #include <aomap_fragment>
        {
          // Multi-scale Diablo IV Ambient Occlusion (Cavity + Ground-Contact + Underside)
          float pbrAO = 1.0;

          float cavWeight = (1.0 - pSnowMask * 0.72) * uPbrParams1.x;
          pbrAO *= mix(1.0, 1.0 - pbrCavity * 0.65, cavWeight);

          if (uPbrParams1.z > 0.001 && uPbrParams1.y > 0.01) {
            float notFlatGround = 1.0 - smoothstep(0.68, 0.94, vPbrWorldNormal.y);
            float nearGround = 1.0 - smoothstep(0.02, uPbrParams1.y, max(0.0, vPbrWorldPos.y));
            float contactMask = nearGround * mix(0.35, 1.0, notFlatGround) * (1.0 - pSnowMask * 0.5);
            pbrAO *= (1.0 - contactMask * uPbrParams1.z);
          }

          float underside = smoothstep(0.05, -0.78, vPbrWorldNormal.y);
          pbrAO *= mix(1.0, 0.52, underside);

          pbrAO = clamp(pbrAO, 0.36, 1.0);

          float pbrDotNV = saturate( dot( geometryNormal, geometryViewDir ) );
          float pbrSpecOcc = computeSpecularOcclusion( pbrDotNV, pbrAO, material.roughness );

          reflectedLight.indirectDiffuse *= pbrAO;
          reflectedLight.indirectSpecular *= pbrSpecOcc;

          #if defined( USE_CLEARCOAT )
            clearcoatSpecularIndirect *= pbrAO;
          #endif
          #if defined( USE_SHEEN )
            sheenSpecularIndirect *= pbrAO;
          #endif

          // Realistic Atmospheric Grazing Fresnel & Sun Micro-Glint Reflections (bloom-safe calibrated)
          float pbrFresnel = pow(max(0.0001, 1.0 - pbrDotNV), 4.2);
          float glossMask = 1.0 - smoothstep(0.18, 0.96, material.roughness);
          float reflectGain = (uPbrParams2.x + uWetness * 0.22) * glossMask * pbrSpecOcc;
          vec3 skyBounce = mix(uGroundColor, uSkyColor, saturate(vPbrWorldNormal.y * 0.5 + 0.5));
          reflectedLight.indirectSpecular += skyBounce * pbrFresnel * reflectGain * 0.24;

          vec3 sunViewDir = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          vec3 halfVec = normalize(sunViewDir + geometryViewDir);
          float ndh = saturate(dot(geometryNormal, halfVec));
          float specPow = mix(24.0, 112.0, 1.0 - material.roughness);
          float glintMask = max(pbrRidge * uPbrParams1.w, pSnowMask * 0.30 + uWetness * 0.16);
          float microGlint = pow(max(0.0001, ndh), specPow) * glintMask * pbrSpecOcc;
          reflectedLight.directSpecular += uSunColor * microGlint * 0.12;

          reflectedLight.directDiffuse *= uMoodContrast;
        }
        `,
      );
  };
}

/**
 * Generates procedural atmospheric HDR-like Environment Maps (Day, Sunset, Evening)
 * lazily cached so initial mount builds only 'day' (fast startup & minimal memory).
 */
export function createDiabloEnvironmentRig(renderer: THREE.WebGLRenderer): DiabloEnvironmentRig {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const cache: Partial<Record<PbrTimeOfDay, THREE.Texture>> = {};

  const buildForMode = (mode: PbrTimeOfDay): THREE.Texture => {
    const envScene = new THREE.Scene();

    const palettes: Record<
      PbrTimeOfDay,
      {
        zenith: number;
        horizon: number;
        ground: number;
        sunColor: number;
        sunDir: [number, number, number];
        sunSize: number;
        torchColor: number;
        torchInt: number;
      }
    > = {
      day: {
        zenith: 0x3b6ca8,
        horizon: 0xa8c6e0,
        ground: 0x262018,
        sunColor: 0xfff0cc,
        sunDir: [54, 50, 36],
        sunSize: 1.0,
        torchColor: 0xffa64a,
        torchInt: 0.35,
      },
      sunset: {
        zenith: 0x2b3b66,
        horizon: 0xd97d48,
        ground: 0x211610,
        sunColor: 0xffa042,
        sunDir: [64, 24, 34],
        sunSize: 1.35,
        torchColor: 0xff8b33,
        torchInt: 1.15,
      },
      evening: {
        zenith: 0x091124,
        horizon: 0x1d3156,
        ground: 0x0d0f16,
        sunColor: 0x8fb8ff,
        sunDir: [-42, 48, -42],
        sunSize: 0.85,
        torchColor: 0xff9d3b,
        torchInt: 1.85,
      },
    };

    const p = palettes[mode];
    const domeGeo = new THREE.SphereGeometry(20, 20, 12);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(p.zenith) },
        uHorizon: { value: new THREE.Color(p.horizon) },
        uGround: { value: new THREE.Color(p.ground) },
        uSunColor: { value: new THREE.Color(p.sunColor) },
        uSunDir: { value: new THREE.Vector3(...p.sunDir).normalize() },
        uSunSize: { value: p.sunSize },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uSunSize;
        varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 sky = y >= 0.0
            ? mix(uHorizon, uZenith, pow(y, 0.55))
            : mix(uHorizon * 0.55, uGround, pow(-y, 0.45));
          float sunDot = max(0.0, dot(vDir, uSunDir));
          float sunHalo = pow(sunDot, 10.0) * 0.45 * uSunSize;
          float sunCore = pow(sunDot, 120.0) * 1.45 * uSunSize;
          vec3 col = sky + uSunColor * (sunHalo + sunCore);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    envScene.add(dome);

    const cardGeo = new THREE.PlaneGeometry(6, 3);
    const cardMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.torchColor).multiplyScalar(p.torchInt),
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const card = new THREE.Mesh(cardGeo, cardMat);
      card.position.set(Math.cos(ang) * 14, 1.5, Math.sin(ang) * 14);
      card.lookAt(0, 1.5, 0);
      envScene.add(card);
    }

    const rt = pmrem.fromScene(envScene, 0.035);
    domeGeo.dispose();
    domeMat.dispose();
    cardGeo.dispose();
    cardMat.dispose();
    return rt.texture;
  };

  cache.day = buildForMode('day');

  return {
    getTexture: (mode) => {
      let tex = cache[mode];
      if (!tex) {
        tex = buildForMode(mode);
        cache[mode] = tex;
      }
      return tex;
    },
    dispose: () => {
      pmrem.dispose();
      cache.day?.dispose();
      cache.sunset?.dispose();
      cache.evening?.dispose();
    },
  };
}

/**
 * Traverses the entire Three.js scene and upgrades every eligible MeshStandardMaterial
 * and MeshPhysicalMaterial to the unified Diablo IV PBR + Weather shader pipeline.
 */
export function upgradeSceneMaterialsToAdvancedPBR(
  scene: THREE.Scene,
  pbrUniforms: PbrShaderUniforms,
  weatherUniforms: WeatherShaderUniforms,
): number {
  const seen = new Set<THREE.Material>();
  let upgradedCount = 0;

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh && !(obj as THREE.InstancedMesh).isInstancedMesh) return;
    const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of matList) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);

      const kind = classifyPbrSurfaceKind(mat);
      if (kind === 'skip') continue;

      if (
        mat instanceof THREE.MeshStandardMaterial ||
        mat instanceof THREE.MeshPhysicalMaterial
      ) {
        const weatherOpts = mat.userData?.pronteraWeatherOpts as
          | WorldWeatherShaderOptions
          | undefined;

        if (!mat.userData?.lockEnvIntensity) {
          if (kind === 'metal') {
            mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.55);
          } else if (kind === 'roof') {
            mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.18);
          } else if (kind === 'stone') {
            mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.08);
          } else if (kind === 'leather') {
            mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.12);
          } else {
            mat.envMapIntensity = Math.max(mat.envMapIntensity, 0.92);
          }
        }

        applyAdvancedPbrShader(mat, pbrUniforms, weatherUniforms, kind, weatherOpts);
        mat.needsUpdate = true;
        upgradedCount++;
      }
    }
  });

  return upgradedCount;
}
