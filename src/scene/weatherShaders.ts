import * as THREE from 'three';

export interface WeatherShaderUniforms {
  uTime: { value: number };
  uWetness: { value: number };
  uSnow: { value: number };
  uLightning: { value: number };
  uDaylight: { value: number };
}

export function createWeatherUniforms(): WeatherShaderUniforms {
  return {
    uTime: { value: 0 },
    uWetness: { value: 0 },
    uSnow: { value: 0 },
    uLightning: { value: 0 },
    uDaylight: { value: 1.0 },
  };
}

export interface WorldWeatherShaderOptions {
  allowPuddles?: boolean;
  snowAmount?: number;
  wetDarken?: number;
  swayAmp?: number;
  swayHeightOffset?: number;
}

const GLSL_NOISE_HELPERS = /* glsl */ `
// Artifact-free 2D Simplex Noise (eliminates square/axis-aligned grid blocks!)
vec3 pronteraMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 pronteraMod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 pronteraPermute(vec3 x) { return pronteraMod289(((x * 34.0) + 1.0) * x); }

float pronteraSnoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = pronteraMod289_2(i);
  vec3 p = pronteraPermute(pronteraPermute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 0.5 + 0.5 * (130.0 * dot(m, g));
}

// 4-Octave Rotated FBM (organic natural drifts with zero grid artifacts)
float pronteraFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * pronteraSnoise(p);
    p = rot * p * 2.07 + vec2(13.7, 29.3);
    a *= 0.5;
  }
  return v;
}

// Organic Warped Snow Drift FBM
float pronteraSnowDrift(vec2 p) {
  vec2 q = vec2(pronteraFbm(p * 0.075), pronteraFbm(p * 0.075 + vec2(5.2, 1.3)));
  return pronteraFbm(p * 0.11 + q * 1.35);
}
`;

export function applyWorldWeatherShader(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  uniforms: WeatherShaderUniforms,
  opts: WorldWeatherShaderOptions = {},
): void {
  mat.userData.pronteraWeatherOpts = opts;
  const allowPuddles = opts.allowPuddles ? 1.0 : 0.0;
  const snowAmount = opts.snowAmount ?? 1.0;
  const wetDarken = opts.wetDarken ?? 0.36;
  const swayAmp = opts.swayAmp ?? 0.0;
  const swayHeightOffset = opts.swayHeightOffset ?? 0.0;

  mat.customProgramCacheKey = () =>
    `prontera-weather-v2-${allowPuddles}-${snowAmount.toFixed(2)}-${wetDarken.toFixed(2)}-${swayAmp.toFixed(2)}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uSnow = uniforms.uSnow;
    shader.uniforms.uLightning = uniforms.uLightning;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        varying vec3 vPronteraWorldPos;
        varying vec3 vPronteraWorldNormal;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        ${
          swayAmp > 0.0001
            ? /* glsl */ `
        {
          vec4 swayWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            swayWp = instanceMatrix * swayWp;
          #endif
          swayWp = modelMatrix * swayWp;
          float hFactor = clamp((transformed.y - ${swayHeightOffset.toFixed(2)}) * 0.45, 0.0, 1.5);
          float gust = sin(uTime * 1.9 + swayWp.x * 0.25 + swayWp.z * 0.21) * 0.65
                     + sin(uTime * 3.4 + swayWp.x * 0.55 - swayWp.z * 0.43) * 0.35;
          transformed.x += gust * ${swayAmp.toFixed(4)} * hFactor;
          transformed.z += cos(uTime * 1.6 + swayWp.z * 0.3) * ${swayAmp.toFixed(4)} * 0.6 * hFactor;
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
          vPronteraWorldPos = pWp.xyz;

          vec3 pWn = objectNormal;
          #ifdef USE_INSTANCING
            pWn = mat3(instanceMatrix) * pWn;
          #endif
          vPronteraWorldNormal = normalize(mat3(modelMatrix) * pWn);
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
        varying vec3 vPronteraWorldPos;
        varying vec3 vPronteraWorldNormal;
        ${GLSL_NOISE_HELPERS}
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        float pMacroNoise = pronteraFbm(vPronteraWorldPos.xz * 0.14);
        float pMicroNoise = pronteraSnoise(vPronteraWorldPos.xz * 2.4);
        float pPuddleMask = 0.0;
        if (${allowPuddles.toFixed(1)} > 0.5 && vPronteraWorldNormal.y > 0.72) {
          pPuddleMask = smoothstep(0.42, 0.59, pMacroNoise + (pMicroNoise - 0.5) * 0.12);
        }

        // Rain wetness darkening + glossy puddle tint (preserved exactly)
        if (uWetness > 0.001) {
          float wetAmt = uWetness * (0.74 + 0.26 * pMacroNoise);
          diffuseColor.rgb *= mix(1.0, 1.0 - ${wetDarken.toFixed(2)}, wetAmt);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.52 + vec3(0.02, 0.035, 0.055), pPuddleMask * uWetness * 0.82);
        }

        // Smooth, organic domain-warped snow drifts with mortar/surface-detail feathering
        float pSnowMask = 0.0;
        if (uSnow > 0.001 && ${snowAmount.toFixed(2)} > 0.01) {
          float upFacing = smoothstep(0.30, 0.82, vPronteraWorldNormal.y);
          float drift = pronteraSnowDrift(vPronteraWorldPos.xz);
          float fineGrain = pronteraSnoise(vPronteraWorldPos.xz * 4.8);
          float sparkle = smoothstep(0.76, 0.96, pronteraSnoise(vPronteraWorldPos.xz * 14.0));
          // Let darker mortar seams / shadowed grass roots catch subtle frost rather than blocky patches
          float baseLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float seamBias = mix(0.14, -0.06, clamp(baseLuma, 0.0, 1.0));
          float snowField = drift * 0.78 + fineGrain * 0.22 + seamBias;
          float snowPatch = smoothstep(0.28, 0.74, snowField);
          float maxCap = ${allowPuddles.toFixed(1)} > 0.5 ? 0.54 : 0.70;
          pSnowMask = clamp(upFacing * snowPatch * uSnow * ${snowAmount.toFixed(2)}, 0.0, maxCap);
          vec3 snowShadowTint = vec3(0.76, 0.84, 0.94);
          vec3 snowBrightTint = vec3(0.94, 0.97, 1.0);
          vec3 snowAlbedo = mix(snowShadowTint, snowBrightTint, clamp(fineGrain + sparkle * 0.35, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, snowAlbedo, pSnowMask);
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        if (uWetness > 0.001) {
          roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.50, uWetness);
          roughnessFactor = mix(roughnessFactor, 0.04, pPuddleMask * uWetness);
        }
        if (uSnow > 0.001) {
          roughnessFactor = mix(roughnessFactor, 0.38 + pMicroNoise * 0.14, pSnowMask);
        }
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        if (uWetness > 0.001 && pPuddleMask > 0.05) {
          vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec2 rp = vPronteraWorldPos.xz * 2.2;
          float r1 = sin(length(fract(rp) - 0.5) * 26.0 - uTime * 11.0);
          float r2 = cos(length(fract(rp * 1.37 + 0.4) - 0.5) * 24.0 - uTime * 9.5);
          vec3 rippleOffset = vec3((r1 + r2) * 0.045, 0.0, (r1 - r2) * 0.045) * uWetness;
          normal = normalize(mix(normal, normalize(upView + rippleOffset), pPuddleMask * uWetness * 0.88));
        }
        `,
      );
  };
}

export function applyWaterRippleShader(
  mat: THREE.MeshPhysicalMaterial,
  uniforms: WeatherShaderUniforms,
  waveScale = 1.0,
): void {
  mat.userData.pbrHandled = true;
  mat.customProgramCacheKey = () => `kaldgard-water-photoreal-v5-${waveScale.toFixed(2)}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uDaylight = uniforms.uDaylight;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        varying vec3 vWaterWorldPos;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        {
          vec4 wWp = modelMatrix * vec4(transformed, 1.0);
          float t = uTime;
          float s = ${waveScale.toFixed(2)};
          float w1 = sin(wWp.x * 0.95 * s + wWp.z * 0.65 * s + t * 1.65);
          float w2 = cos(wWp.z * 1.35 * s - wWp.x * 0.85 * s - t * 1.30);
          float w3 = sin((wWp.x - wWp.z) * 2.10 * s + t * 2.35) * 0.45;
          transformed.y += (w1 + w2 + w3) * 0.009;
        }
        `,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        #include <project_vertex>
        vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform float uWetness;
        uniform float uDaylight;
        varying vec3 vWaterWorldPos;
        ${GLSL_NOISE_HELPERS}

        // Multi-directional physical Gerstner + capillary FBM wave height (zero cellular Voronoi grid!)
        float pronteraWaterWaveHeight(vec2 p, float t) {
          vec2 d1 = vec2(0.82, 0.57);
          vec2 d2 = vec2(-0.64, 0.77);
          vec2 d3 = vec2(0.36, -0.93);
          float swell1 = sin(dot(p, d1) * 1.45 + t * 1.42) * 0.30;
          float swell2 = cos(dot(p, d2) * 2.25 - t * 1.78) * 0.20;
          float swell3 = sin(dot(p, d3) * 3.60 + t * 2.15) * 0.12;
          float fbmCap = pronteraFbm(p * 0.62 + vec2(t * 0.14, -t * 0.11)) * 0.26;
          float micro = pronteraSnoise(p * 2.95 + vec2(-t * 0.28, t * 0.22)) * 0.12;
          return 0.5 + 0.5 * (swell1 + swell2 + swell3) + (fbmCap - 0.13) + (micro - 0.06);
        }
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        {
          float t = uTime;
          float dayAmt = clamp(uDaylight, 0.0, 1.0);
          vec2 wp = vWaterWorldPos.xz * ${waveScale.toFixed(2)};
          float h = pronteraWaterWaveHeight(wp, t);
          float sediment = pronteraFbm(wp * 0.18 + vec2(3.7, -7.1));

          // Natural optical water absorption (Beer-Lambert deep emerald-slate to shallow river teal)
          vec3 abyssDay = vec3(0.035, 0.115, 0.165);
          vec3 shallowDay = vec3(0.075, 0.225, 0.275);
          vec3 abyssNight = vec3(0.014, 0.036, 0.056);
          vec3 shallowNight = vec3(0.024, 0.058, 0.082);

          vec3 abyssCol = mix(abyssNight, abyssDay, dayAmt);
          vec3 shallowCol = mix(shallowNight, shallowDay, dayAmt);

          float depthMix = clamp(h * 0.52 + sediment * 0.48, 0.0, 1.0);
          vec3 waterCol = mix(abyssCol, shallowCol, depthMix);

          // Subtle daytime-only subsurface crest scatter (zero in night mode)
          float crest = smoothstep(0.60, 0.90, h);
          waterCol += vec3(0.04, 0.13, 0.16) * crest * dayAmt * 0.45;

          // Concentric fountain ripple in central plaza basin
          float rOrigin = length(vWaterWorldPos.xz);
          if (rOrigin < 4.55) {
            float wave = sin(rOrigin * 9.5 - t * 4.6) * 0.5 + 0.5;
            float ring = pow(wave, 2.5) * 0.12 * (1.0 - smoothstep(2.4, 4.4, rOrigin)) * dayAmt;
            waterCol += vec3(0.08, 0.18, 0.22) * ring;
          }

          diffuseColor.rgb = waterCol;
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        {
          float dayAmt = clamp(uDaylight, 0.0, 1.0);
          // At night, raise surface roughness to completely prevent sharp specular glints
          roughnessFactor = mix(0.88, max(roughnessFactor, 0.10), dayAmt);
        }
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        {
          float t = uTime;
          vec2 p = vWaterWorldPos.xz * ${waveScale.toFixed(2)};
          float eps = 0.09;
          float hC = pronteraWaterWaveHeight(p, t);
          float hX = pronteraWaterWaveHeight(p + vec2(eps, 0.0), t);
          float hZ = pronteraWaterWaveHeight(p + vec2(0.0, eps), t);

          float dHx = (hC - hX) / eps;
          float dHz = (hC - hZ) / eps;

          // Concentric fountain jet ripples in normal space
          float rOrigin = length(vWaterWorldPos.xz);
          if (rOrigin < 4.55 && rOrigin > 0.25) {
            float ringSlope = cos(rOrigin * 9.5 - t * 4.6) * 0.28 * (1.0 - smoothstep(1.8, 4.4, rOrigin));
            vec2 dir = vWaterWorldPos.xz / rOrigin;
            dHx += dir.x * ringSlope;
            dHz += dir.y * ringSlope;
          }

          if (uWetness > 0.01) {
            vec2 rp = p * 1.9;
            float distR = length(fract(rp) - 0.5);
            float rainRing = sin(distR * 32.0 - t * 14.0) * (1.0 - smoothstep(0.15, 0.48, distR)) * 0.22 * uWetness;
            dHx += rainRing;
            dHz -= rainRing;
          }

          // Transform world-space wave gradient cleanly into view space
          vec3 worldGrad = vec3(dHx * 0.34, 0.0, dHz * 0.34);
          vec3 viewPerturb = (viewMatrix * vec4(worldGrad, 0.0)).xyz;
          normal = normalize(normal + viewPerturb);
        }
        `,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `
        #include <aomap_fragment>
        {
          float dayAmt = clamp(uDaylight, 0.0, 1.0);
          // Physical Schlick Fresnel sky reflection during day, strictly ZERO reflections in night mode!
          float wDotNV = saturate(dot(geometryNormal, geometryViewDir));
          float wFresnel = mix(0.04, 0.92, pow(1.0 - wDotNV, 4.0));
          reflectedLight.directSpecular *= dayAmt * 0.72;
          reflectedLight.indirectSpecular *= mix(0.45, 1.15, wFresnel) * dayAmt;
          #ifdef USE_CLEARCOAT
            clearcoatSpecularDirect *= dayAmt * 0.65;
            clearcoatSpecularIndirect *= dayAmt * 0.75;
          #endif

          float rOrig = length(vWaterWorldPos.xz);
          float bankAO = 1.0;
          if (rOrig > 20.0) {
            float absX = abs(vWaterWorldPos.x);
            float absZ = abs(vWaterWorldPos.z);
            float bDist = min(min(abs(absX - 77.5), abs(absX - 83.5)), min(abs(absZ - 77.5), abs(absZ - 83.5)));
            bankAO = mix(0.62, 1.0, smoothstep(0.0, 0.85, bDist));
          } else if (rOrig > 3.6) {
            bankAO = mix(0.66, 1.0, 1.0 - smoothstep(3.6, 4.42, rOrig));
          }
          reflectedLight.indirectDiffuse *= bankAO;
        }
        `,
      );
  };
}

export function applyGrassWindShader(
  mat: THREE.MeshStandardMaterial,
  uniforms: WeatherShaderUniforms,
  heightScale = 0.52,
): void {
  mat.userData.pbrHandled = true;
  mat.customProgramCacheKey = () => `prontera-grass-blades-v4-${heightScale.toFixed(2)}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uSnow = uniforms.uSnow;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        varying float vBladeHeight;
        varying vec3 vBladeWorldPos;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vBladeHeight = clamp(position.y / ${heightScale.toFixed(2)}, 0.0, 1.0);
        vec4 gWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gWp = instanceMatrix * gWp;
        #endif
        gWp = modelMatrix * gWp;
        float wind1 = sin(uTime * 2.3 + gWp.x * 0.28 + gWp.z * 0.22);
        float wind2 = sin(uTime * 4.7 + gWp.x * 0.72 - gWp.z * 0.61) * 0.4;
        float bend = vBladeHeight * vBladeHeight;
        float swayDist = ${heightScale > 0.65 ? '0.22' : '0.14'};
        transformed.x += (wind1 + wind2) * swayDist * bend;
        transformed.z += cos(uTime * 1.9 + gWp.z * 0.31) * (swayDist * 0.65) * bend;
        vBladeWorldPos = gWp.xyz;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uWetness;
        uniform float uSnow;
        varying float vBladeHeight;
        varying vec3 vBladeWorldPos;
        ${GLSL_NOISE_HELPERS}
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        vec3 rootTint = diffuseColor.rgb * vec3(0.58, 0.68, 0.52);
        vec3 tipTint = diffuseColor.rgb * vec3(1.18, 1.24, 0.96);
        diffuseColor.rgb = mix(rootTint, tipTint, smoothstep(0.0, 0.92, vBladeHeight));
        if (uWetness > 0.01) {
          diffuseColor.rgb *= mix(1.0, 0.78, uWetness);
        }
        if (uSnow > 0.01) {
          float frost = smoothstep(0.42, 0.98, vBladeHeight) * uSnow * (0.45 + 0.35 * pronteraSnoise(vBladeWorldPos.xz * 0.9));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.90, 0.97), frost * 0.62);
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(0.82, 0.46, vBladeHeight);
        if (uWetness > 0.01) {
          roughnessFactor = mix(roughnessFactor, 0.18, uWetness * vBladeHeight);
        }
        `,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `
        #include <aomap_fragment>
        float bladeAO = mix(0.68, 1.08, smoothstep(0.0, 0.75, vBladeHeight));
        reflectedLight.indirectDiffuse *= bladeAO;
        reflectedLight.indirectSpecular *= bladeAO;
        `,
      );
  };
}
