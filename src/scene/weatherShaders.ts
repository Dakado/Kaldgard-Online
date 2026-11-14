import * as THREE from 'three';

export interface WeatherShaderUniforms {
  uTime: { value: number };
  uWetness: { value: number };
  uSnow: { value: number };
  uLightning: { value: number };
}

export function createWeatherUniforms(): WeatherShaderUniforms {
  return {
    uTime: { value: 0 },
    uWetness: { value: 0 },
    uSnow: { value: 0 },
    uLightning: { value: 0 },
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
  mat.customProgramCacheKey = () => `prontera-water-hd-v3-${waveScale.toFixed(2)}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWetness = uniforms.uWetness;

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
          float w1 = sin(wWp.x * 1.3 * s + wWp.z * 0.8 * s + t * 2.2);
          float w2 = cos(wWp.z * 1.7 * s - wWp.x * 1.1 * s - t * 1.7);
          transformed.y += (w1 + w2) * 0.008;
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
        varying vec3 vWaterWorldPos;
        ${GLSL_NOISE_HELPERS}

        // Sharp organic water caustic cellular web (no circular polka-dot blobs!)
        float pronteraWaterWaveHeight(vec2 p, float t) {
          float h = 0.0;
          h += pronteraSnoise(p * 0.85 + vec2(t * 0.24, t * 0.16)) * 0.50;
          h += pronteraSnoise(p * 1.95 + vec2(-t * 0.34, t * 0.29)) * 0.28;
          h += pronteraSnoise(p * 4.20 + vec2(t * 0.45, -t * 0.42)) * 0.14;
          h += pronteraSnoise(p * 8.50 + vec2(-t * 0.62, -t * 0.51)) * 0.08;
          return h;
        }

        float pronteraCausticFilament(vec2 p, float t) {
          float n1 = abs(pronteraSnoise(p * 1.25 + vec2(t * 0.22, -t * 0.18)) - 0.5);
          float n2 = abs(pronteraSnoise(p * 1.65 + vec2(-t * 0.28, t * 0.21)) - 0.5);
          float web = 1.0 - smoothstep(0.0, 0.13, min(n1, n2));
          return web * web;
        }
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        {
          float t = uTime;
          vec2 wp = vWaterWorldPos.xz * ${waveScale.toFixed(2)};
          float h = pronteraWaterWaveHeight(wp, t);
          float caustics = pronteraCausticFilament(wp * 0.85, t);

          // Concentric fountain ripple shimmer near central fountain jets
          float rOrigin = length(vWaterWorldPos.xz);
          float fountainRing = 0.0;
          if (rOrigin < 4.55) {
            float wave = sin(rOrigin * 10.5 - t * 5.4) * 0.5 + 0.5;
            fountainRing = pow(wave, 3.0) * 0.22 * (1.0 - smoothstep(2.5, 4.4, rOrigin));
          }

          // Deep translucent river/basin color gradient + crisp sunlit caustic filaments
          vec3 abyssCol = diffuseColor.rgb * 0.58 + vec3(0.0, 0.03, 0.06);
          vec3 shallowCol = diffuseColor.rgb * 1.08 + vec3(0.02, 0.09, 0.12);
          vec3 waterCol = mix(abyssCol, shallowCol, clamp(h * 0.85 + 0.15, 0.0, 1.0));
          waterCol += vec3(0.24, 0.52, 0.64) * (caustics * 0.42 + fountainRing);

          // Subtle moat stone-edge shallow turquoise glow
          float absX = abs(vWaterWorldPos.x);
          float absZ = abs(vWaterWorldPos.z);
          float moatEdge = max(
            min(abs(absX - 77.5), abs(absX - 83.5)),
            0.0
          );
          float moatEdgeZ = min(abs(absZ - 77.5), abs(absZ - 83.5));
          float bankDist = min(moatEdge, moatEdgeZ);
          if (rOrigin > 20.0 && bankDist < 0.75) {
            float foamEdge = (1.0 - smoothstep(0.0, 0.72, bankDist)) * (0.45 + 0.55 * pronteraSnoise(wp * 3.5 + t * 0.4));
            waterCol = mix(waterCol, vec3(0.56, 0.78, 0.88), foamEdge * 0.45);
          }

          diffuseColor.rgb = waterCol;
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
          float eps = 0.08;
          float hC = pronteraWaterWaveHeight(p, t);
          float hX = pronteraWaterWaveHeight(p + vec2(eps, 0.0), t);
          float hZ = pronteraWaterWaveHeight(p + vec2(0.0, eps), t);

          float dHx = (hC - hX) / eps;
          float dHz = (hC - hZ) / eps;

          // Concentric fountain jet ripples in normal space
          float rOrigin = length(vWaterWorldPos.xz);
          if (rOrigin < 4.55 && rOrigin > 0.25) {
            float ringSlope = cos(rOrigin * 10.5 - t * 5.4) * 0.38 * (1.0 - smoothstep(1.8, 4.4, rOrigin));
            vec2 dir = vWaterWorldPos.xz / rOrigin;
            dHx += dir.x * ringSlope;
            dHz += dir.y * ringSlope;
          }

          if (uWetness > 0.01) {
            vec2 rp = p * 1.9;
            float distR = length(fract(rp) - 0.5);
            float rainRing = sin(distR * 32.0 - t * 14.0) * (1.0 - smoothstep(0.15, 0.48, distR)) * 0.28 * uWetness;
            dHx += rainRing;
            dHz -= rainRing;
          }

          // Transform world-space wave gradient cleanly into view space!
          vec3 worldGrad = vec3(dHx * 0.28, 0.0, dHz * 0.28);
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
          // Physical Schlick Fresnel sky/environment grazing reflection + bank contact AO
          float wDotNV = saturate(dot(geometryNormal, geometryViewDir));
          float wFresnel = mix(0.02, 1.0, pow(1.0 - wDotNV, 5.0));
          reflectedLight.indirectSpecular *= mix(0.72, 1.55, wFresnel);

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
): void {
  mat.userData.pbrHandled = true;
  mat.customProgramCacheKey = () => 'prontera-grass-blades-v3';
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
        vBladeHeight = clamp(position.y / 0.52, 0.0, 1.0);
        vec4 gWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gWp = instanceMatrix * gWp;
        #endif
        gWp = modelMatrix * gWp;
        float wind1 = sin(uTime * 2.3 + gWp.x * 0.28 + gWp.z * 0.22);
        float wind2 = sin(uTime * 4.7 + gWp.x * 0.72 - gWp.z * 0.61) * 0.4;
        float bend = vBladeHeight * vBladeHeight;
        transformed.x += (wind1 + wind2) * 0.14 * bend;
        transformed.z += cos(uTime * 1.9 + gWp.z * 0.31) * 0.09 * bend;
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
        float aoRoot = mix(0.42, 1.12, smoothstep(0.0, 0.85, vBladeHeight));
        diffuseColor.rgb *= aoRoot;
        if (uWetness > 0.01) {
          diffuseColor.rgb *= mix(1.0, 0.76, uWetness);
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
        roughnessFactor = mix(0.84, 0.48, vBladeHeight);
        if (uWetness > 0.01) {
          roughnessFactor = mix(roughnessFactor, 0.18, uWetness * vBladeHeight);
        }
        `,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `
        #include <aomap_fragment>
        float bladeAO = mix(0.45, 1.0, smoothstep(0.0, 0.72, vBladeHeight));
        reflectedLight.indirectDiffuse *= bladeAO;
        reflectedLight.indirectSpecular *= bladeAO;
        `,
      );
  };
}
