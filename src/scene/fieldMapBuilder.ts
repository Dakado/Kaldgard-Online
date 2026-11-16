import * as THREE from 'three';
import {
  FIELD_MAPS,
  FieldMapSpec,
  FieldZoneId,
  ZoneId,
  getBridgeDeckY,
  getBridgeLocalCoords,
  zoneCliffSlopeAt,
  zoneHeightAt,
  zoneTerrainHeightAt,
  zoneTrailMaskAt,
  zoneWaterDepthAt,
} from '../world/fieldMaps';
import { PortalVisual, buildPortalArchways } from './architectureBuilder';
import { MobActor, buildFieldMobs } from './characterBuilder';
import { PronteraMaterials } from './materials';
import type { PbrShaderUniforms } from './pbrMaterialSystem';
import type { WeatherShaderUniforms } from './weatherShaders';

export interface BuiltFieldZone {
  group: THREE.Group;
  groundPickMesh: THREE.Mesh;
  waterMeshes: THREE.Mesh[];
  portals: PortalVisual[];
  mobActors: MobActor[];
  mobHitTargets: THREE.Mesh[];
  dispose: () => void;
}

function createFieldTrunkGeo(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.62, -0.35),
    new THREE.Vector2(0.44, 0.32),
    new THREE.Vector2(0.34, 1.28),
    new THREE.Vector2(0.28, 2.32),
    new THREE.Vector2(0.21, 3.20),
    new THREE.Vector2(0.13, 3.70),
    new THREE.Vector2(0.0, 3.82),
  ];
  return new THREE.LatheGeometry(profile, 12);
}

function createFieldLeafClusterGeo(
  cards: { x: number; y: number; z: number; size: number; tiltX: number; rotY: number }[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  let vertOffset = 0;
  for (const c of cards) {
    const subRotations = [
      [c.tiltX, c.rotY, 0],
      [c.tiltX + 0.35, c.rotY + Math.PI * 0.5, 0.22],
      [Math.PI * 0.38, c.rotY + 0.4, 0],
    ];
    for (const [rx, ry, rz] of subRotations) {
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      const hs = c.size * 0.5;
      const corners = [
        [-hs, -hs, 0],
        [hs, -hs, 0],
        [hs, hs, 0],
        [-hs, hs, 0],
      ];
      const quadUvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      n.set(0, 0.5, 0.86).applyQuaternion(q).normalize();

      for (let k = 0; k < 4; k++) {
        v.set(corners[k][0], corners[k][1], corners[k][2]).applyQuaternion(q);
        positions.push(v.x + c.x, v.y + c.y, v.z + c.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(quadUvs[k][0], quadUvs[k][1]);
      }
      indices.push(
        vertOffset,
        vertOffset + 1,
        vertOffset + 2,
        vertOffset,
        vertOffset + 2,
        vertOffset + 3,
      );
      vertOffset += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createFieldGrassTuftGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let vOffset = 0;
  for (let b = 0; b < 5; b++) {
    const ang = (b / 5) * Math.PI * 2 + (b % 2) * 0.42;
    const rad = 0.08 + (b % 2) * 0.05;
    const ox = Math.cos(ang) * rad;
    const oz = Math.sin(ang) * rad;
    const leanX = Math.cos(ang) * 0.19;
    const leanZ = Math.sin(ang) * 0.19;
    const h = 0.40 + (b % 3) * 0.11;
    const wBase = 0.058;
    const wMid = 0.036;

    const px = -Math.sin(ang);
    const pz = Math.cos(ang);

    positions.push(
      ox - px * wBase, 0.0, oz - pz * wBase,
      ox + px * wBase, 0.0, oz + pz * wBase,
      ox + leanX * 0.45 - px * wMid, h * 0.52, oz + leanZ * 0.45 - pz * wMid,
      ox + leanX * 0.45 + px * wMid, h * 0.52, oz + leanZ * 0.45 + pz * wMid,
      ox + leanX, h, oz + leanZ,
    );
    for (let k = 0; k < 5; k++) normals.push(0, 1, 0);
    indices.push(
      vOffset, vOffset + 1, vOffset + 3,
      vOffset, vOffset + 3, vOffset + 2,
      vOffset + 2, vOffset + 3, vOffset + 4,
    );
    vOffset += 5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Multi-blade tall meadow grass clump (vysoká tráva, ~0.88m tall with arched tips).
 */
function createTallGrassClumpGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let vOffset = 0;
  for (let b = 0; b < 7; b++) {
    const ang = (b / 7) * Math.PI * 2 + (b % 3) * 0.31;
    const rad = 0.06 + (b % 3) * 0.055;
    const ox = Math.cos(ang) * rad;
    const oz = Math.sin(ang) * rad;
    const leanX = Math.cos(ang) * 0.34;
    const leanZ = Math.sin(ang) * 0.34;
    const h = 0.72 + (b % 3) * 0.12;
    const wBase = 0.068;
    const wMid = 0.044;

    const px = -Math.sin(ang);
    const pz = Math.cos(ang);

    positions.push(
      ox - px * wBase, 0.0, oz - pz * wBase,
      ox + px * wBase, 0.0, oz + pz * wBase,
      ox + leanX * 0.42 - px * wMid, h * 0.52, oz + leanZ * 0.42 - pz * wMid,
      ox + leanX * 0.42 + px * wMid, h * 0.52, oz + leanZ * 0.42 + pz * wMid,
      ox + leanX, h, oz + leanZ,
    );
    for (let k = 0; k < 5; k++) normals.push(0, 1, 0);
    indices.push(
      vOffset, vOffset + 1, vOffset + 3,
      vOffset, vOffset + 3, vOffset + 2,
      vOffset + 2, vOffset + 3, vOffset + 4,
    );
    vOffset += 5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function createCliffBoulderGeo(variant: 0 | 1 | 2): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.18, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  // Deterministic planar rock cleavage cuts per variant for irregular fractured granite crags
  const planeSets: [number, number, number, number][][] = [
    [
      [0.82, 0.45, 0.34, 0.78],
      [-0.78, 0.52, -0.35, 0.80],
      [0.24, 0.90, -0.36, 0.72],
      [-0.44, 0.30, 0.84, 0.84],
      [0.52, -0.25, -0.82, 0.82],
      [-0.25, -0.32, -0.91, 0.86],
      [0.65, 0.68, -0.34, 0.74],
    ],
    [
      [-0.84, 0.42, 0.32, 0.76],
      [0.72, 0.56, -0.40, 0.82],
      [-0.18, 0.94, 0.28, 0.68],
      [0.36, 0.22, 0.90, 0.84],
      [-0.58, -0.18, 0.79, 0.82],
      [0.48, -0.34, -0.80, 0.84],
      [-0.64, 0.65, -0.40, 0.75],
    ],
    [
      [0.68, 0.54, 0.49, 0.76],
      [-0.62, 0.64, -0.44, 0.74],
      [0.12, 0.92, -0.37, 0.70],
      [-0.86, 0.24, 0.44, 0.84],
      [0.84, 0.16, -0.52, 0.82],
      [0.08, -0.28, 0.95, 0.84],
      [-0.36, 0.32, -0.88, 0.82],
    ],
  ];
  const planes = planeSets[variant];
  const seedShift = variant * 1.93;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Asymmetric angular shear + ridge warp
    const shearX = v.y * (variant === 0 ? 0.22 : variant === 1 ? -0.19 : 0.14);
    const shearZ = v.y * (variant === 2 ? -0.20 : 0.12);
    v.x += shearX;
    v.z += shearZ;

    // Planar cleavage flattening to break any spherical regularity
    for (let p = 0; p < planes.length; p++) {
      const [px, py, pz, dist] = planes[p];
      const d = v.x * px + v.y * py + v.z * pz;
      if (d > dist) {
        const excess = d - dist;
        v.x -= px * excess * 0.82;
        v.y -= py * excess * 0.82;
        v.z -= pz * excess * 0.82;
      }
    }

    // Fine fracture ribs & stepped angular facets
    const ridge = Math.sin(v.x * 3.7 + v.z * 2.9 + seedShift) * Math.cos(v.y * 4.1 - v.x * 2.2);
    v.multiplyScalar(1.0 + ridge * 0.085);

    // Flatten bottom seating so boulders anchor firmly into terrain
    if (v.y < -0.28) {
      v.y = -0.28 + (v.y + 0.28) * 0.28;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function applyMetricBoxUVs(
  geo: THREE.BoxGeometry,
  sx: number,
  sy: number,
  sz: number,
  tileMeters = 2.4,
): void {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !norm || !uv) return;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    if (ny >= nx && ny >= Math.abs(norm.getZ(i))) {
      uv.setXY(i, (x + sx * 0.5) / tileMeters, (z + sz * 0.5) / tileMeters);
    } else if (nx >= Math.abs(norm.getZ(i))) {
      uv.setXY(i, (z + sz * 0.5) / tileMeters, (y + sy * 0.5) / tileMeters);
    } else {
      uv.setXY(i, (x + sx * 0.5) / tileMeters, (y + sy * 0.5) / tileMeters);
    }
  }
  uv.needsUpdate = true;
}

/**
 * Generates a baked RGBA splat map texture encoding dirt trail, cliff slope rock,
 * shallow shoreline pebbles, and lush forest grove moisture across the entire field.
 */
function buildFieldSplatTexture(
  zoneId: Exclude<ZoneId, 'prontera'>,
  spec: FieldMapSpec,
  res = 360,
): THREE.DataTexture {
  const data = new Uint8Array(res * res * 4);
  const span = spec.renderExtent * 2;

  for (let py = 0; py < res; py++) {
    const z = (py / (res - 1)) * span - spec.renderExtent;
    for (let px = 0; px < res; px++) {
      const x = (px / (res - 1)) * span - spec.renderExtent;
      const trail = zoneTrailMaskAt(zoneId, x, z);
      const slope = zoneCliffSlopeAt(zoneId, x, z);
      const h = zoneHeightAt(zoneId, x, z);

      // Cliff rock mask emerges strongly on escarpments & mountain perimeter rim
      const cliffMask = Math.max(0, Math.min(1, (slope - 0.34) / 0.48));
      // Sandy shoreline around lakes (h between -1.5 and 0.45 near waterCoves)
      let nearWater = 0;
      for (let i = 0; i < spec.waterCoves.length; i++) {
        const wc = spec.waterCoves[i];
        const r = Math.hypot((x - wc.cx) / wc.rx, (z - wc.cz) / wc.rz);
        if (r < 1.28) {
          nearWater = Math.max(nearWater, Math.max(0, 1 - Math.max(0, (r - 0.85) / 0.43)));
        }
      }
      const shoreMask = h < 0.45 ? nearWater : 0;

      // Grove lush dark moss/fern under tree clusters
      let groveMask = 0;
      for (let i = 0; i < spec.groves.length; i++) {
        const [gx, gz, gr] = spec.groves[i];
        const dist = Math.hypot(x - gx, z - gz);
        if (dist < gr * 1.15) {
          groveMask = Math.max(groveMask, Math.max(0, 1 - dist / (gr * 1.15)));
        }
      }

      const idx = (py * res + px) * 4;
      data[idx] = Math.round(trail * 255);
      data[idx + 1] = Math.round(cliffMask * 255);
      data[idx + 2] = Math.round(shoreMask * 255);
      data[idx + 3] = Math.round(groveMask * 255);
    }
  }

  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates the Diablo IV-grade multi-layer PBR terrain material blending
 * spring meadow grass, sandy-ochre footpaths, jagged granite cliff rock,
 * damp shorelines, rain puddles & snow drifts seamlessly on 1 heightmap mesh.
 */
function createFieldTerrainMaterial(
  spec: FieldMapSpec,
  splatTex: THREE.DataTexture,
  mats: PronteraMaterials,
  pbrUniforms: PbrShaderUniforms,
  weatherUniforms: WeatherShaderUniforms,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: mats.grassPbrMap,
    normalMap: mats.grassPbrNormal,
    normalScale: new THREE.Vector2(1.22, 1.22),
    roughness: 0.88,
    metalness: 0.02,
  });
  mat.userData.pbrSkip = true;
  mat.customProgramCacheKey = () => 'kaldgard-field-terrain-splat-v4';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSplatTex = { value: splatTex };
    shader.uniforms.uExtent = { value: spec.renderExtent };
    shader.uniforms.uTrailMap = { value: mats.trailPbrMap };
    shader.uniforms.uTrailNormal = { value: mats.trailPbrNormal };
    shader.uniforms.uCliffMap = { value: mats.cliffPbrMap };
    shader.uniforms.uCliffNormal = { value: mats.cliffPbrNormal };
    shader.uniforms.uTime = weatherUniforms.uTime;
    shader.uniforms.uWetness = pbrUniforms.uWetness;
    shader.uniforms.uSnow = pbrUniforms.uSnow;
    shader.uniforms.uMoodContrast = pbrUniforms.uMoodContrast;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vFieldWorldPos;
        varying vec3 vFieldWorldNormal;
        `,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        #include <project_vertex>
        vFieldWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vFieldWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform sampler2D uSplatTex;
        uniform sampler2D uTrailMap;
        uniform sampler2D uTrailNormal;
        uniform sampler2D uCliffMap;
        uniform sampler2D uCliffNormal;
        uniform float uExtent;
        uniform float uTime;
        uniform float uWetness;
        uniform float uSnow;
        uniform float uMoodContrast;
        varying vec3 vFieldWorldPos;
        varying vec3 vFieldWorldNormal;

        float fHash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float fNoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(fHash21(i), fHash21(i + vec2(1.0, 0.0)), u.x),
            mix(fHash21(i + vec2(0.0, 1.0)), fHash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fFbm(vec2 p) {
          float v = 0.55 * fNoise2(p);
          p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.04 + vec2(9.1, 17.3);
          v += 0.30 * fNoise2(p);
          p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.04 + vec2(5.2, 11.7);
          v += 0.15 * fNoise2(p);
          return v;
        }
        vec3 sampleTriplanar(sampler2D tex, vec3 wp, vec3 wn, float sc, float warp) {
          vec3 w = pow(abs(wn), vec3(3.2));
          w /= max(0.0001, w.x + w.y + w.z);
          vec2 wOff = vec2(warp * 0.18, -warp * 0.14);
          vec3 cx = texture2D(tex, wp.zy * sc + wOff).rgb;
          vec3 cy = texture2D(tex, wp.xz * sc + wOff).rgb;
          vec3 cz = texture2D(tex, wp.xy * sc - wOff).rgb;
          return cx * w.x + cy * w.y + cz * w.z;
        }
        `,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 splatUv = (vFieldWorldPos.xz + vec2(uExtent)) / (2.0 * uExtent);
        vec4 splat = texture2D(uSplatTex, clamp(splatUv, 0.0, 1.0));

        vec2 grassUv = vFieldWorldPos.xz * 0.145;
        vec2 grassUv2 = vec2(vFieldWorldPos.x * 0.8 - vFieldWorldPos.z * 0.6, vFieldWorldPos.x * 0.6 + vFieldWorldPos.z * 0.8) * 0.062 + vec2(0.31, 0.67);
        vec2 trailUv = vFieldWorldPos.xz * 0.22;
        vec2 trailUv2 = vec2(vFieldWorldPos.x * 0.6 - vFieldWorldPos.z * 0.8, vFieldWorldPos.x * 0.8 + vFieldWorldPos.z * 0.6) * 0.11 + vec2(0.43, 0.19);

        float macroPatch = fFbm(vFieldWorldPos.xz * 0.038);
        float microGrain = fFbm(vFieldWorldPos.xz * 0.65);
        float cliffWarp = fFbm(vFieldWorldPos.xz * 0.075 + vec2(vFieldWorldPos.y * 0.06));

        vec3 grassCol = mix(texture2D(map, grassUv).rgb, texture2D(map, grassUv2).rgb, 0.44);
        vec3 trailCol = mix(texture2D(uTrailMap, trailUv).rgb, texture2D(uTrailMap, trailUv2).rgb, 0.34);
        vec3 cliffCol = sampleTriplanar(uCliffMap, vFieldWorldPos, vFieldWorldNormal, 0.095, cliffWarp);

        // Rich photorealistic meadow tint variation + dark humus under tree groves
        grassCol *= mix(vec3(0.84, 0.94, 0.76), vec3(1.10, 1.05, 0.86), macroPatch);
        grassCol = mix(grassCol, grassCol * vec3(0.72, 0.84, 0.68), splat.a * 0.58);

        // Blend warm sandy forest footpath with scattered stones naturally into meadow grass
        float trailBlend = smoothstep(0.18, 0.68, splat.r + (microGrain - 0.5) * 0.20);
        float stoneCore = smoothstep(0.42, 0.85, splat.r);
        vec3 roadAlbedo = mix(trailCol * vec3(1.02, 0.96, 0.86), trailCol * vec3(1.06, 1.02, 0.94), stoneCore);
        vec3 finalAlbedo = mix(grassCol, roadAlbedo * (0.94 + macroPatch * 0.14), trailBlend);

        // Blend organic domain-warped triplanar granite cliff rock on slopes & escarpments
        float slopeRaw = 1.0 - clamp(vFieldWorldNormal.y, 0.0, 1.0);
        float cliffBlend = smoothstep(0.18, 0.52, max(splat.g, slopeRaw * 1.65));
        finalAlbedo = mix(finalAlbedo, cliffCol * (0.88 + microGrain * 0.24), cliffBlend);

        // Wet stony-pebble lakebed & shoreline transition
        float shoreBlend = smoothstep(0.15, 0.78, splat.b);
        finalAlbedo = mix(finalAlbedo, mix(vec3(0.28, 0.25, 0.20), cliffCol * 0.72, 0.45), shoreBlend * (1.0 - cliffBlend * 0.5));

        float fPuddle = 0.0;
        if (vFieldWorldNormal.y > 0.78) {
          fPuddle = smoothstep(0.45, 0.62, macroPatch * 0.65 + microGrain * 0.35);
        }
        if (uWetness > 0.001) {
          finalAlbedo *= mix(1.0, 0.66, uWetness * (0.75 + 0.25 * microGrain));
          finalAlbedo = mix(finalAlbedo, finalAlbedo * 0.48 + vec3(0.02, 0.035, 0.055), fPuddle * uWetness * 0.8);
        }

        float fSnowMask = 0.0;
        if (uSnow > 0.001) {
          float upFace = smoothstep(0.32, 0.82, vFieldWorldNormal.y);
          float drift = fFbm(vFieldWorldPos.xz * 0.09);
          fSnowMask = clamp(upFace * smoothstep(0.28, 0.72, drift) * uSnow * 0.68, 0.0, 0.72);
          finalAlbedo = mix(finalAlbedo, vec3(0.88, 0.93, 0.98), fSnowMask);
        }

        diffuseColor.rgb = finalAlbedo * (0.92 + microGrain * 0.16);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(0.88, 0.76, trailBlend);
        roughnessFactor = mix(roughnessFactor, 0.78, cliffBlend);
        roughnessFactor = mix(roughnessFactor, 0.55, shoreBlend);
        if (uWetness > 0.001) {
          roughnessFactor = mix(roughnessFactor, 0.05, fPuddle * uWetness);
        }
        if (uSnow > 0.001) {
          roughnessFactor = mix(roughnessFactor, 0.42, fSnowMask);
        }
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 fNormGrass = texture2D(normalMap, grassUv).xyz * 2.0 - 1.0;
          vec3 fNormTrail = texture2D(uTrailNormal, trailUv).xyz * 2.0 - 1.0;
          vec3 fNormCliff = sampleTriplanar(uCliffNormal, vFieldWorldPos, vFieldWorldNormal, 0.095, cliffWarp) * 2.0 - 1.0;
          vec3 mapN = mix(fNormGrass, fNormTrail * vec3(1.12, 1.12, 1.0), trailBlend);
          mapN = mix(mapN, fNormCliff * vec3(1.25, 1.25, 1.0), cliffBlend);
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);
        #endif
        `,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `
        #include <aomap_fragment>
        {
          // Subtle cliff crevice & cobblestone road cavity AO
          float fAo = mix(1.0, 0.74, cliffBlend * (1.0 - fSnowMask * 0.7));
          reflectedLight.indirectDiffuse *= fAo;
          reflectedLight.directDiffuse *= uMoodContrast;
        }
        `,
      );
  };

  return mat;
}

function buildCityBorderWallSegment(
  spec: FieldMapSpec,
  mats: PronteraMaterials,
): { group: THREE.Group; disposables: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];
  const isHorizontal = spec.cityWallEdge === 'north' || spec.cityWallEdge === 'south';
  const wc = spec.cityWallCoord;

  // Two monumental city wall wings leaving 15m wide Gate Archway at x=0 or z=0
  const wingGeo = new THREE.BoxGeometry(195, 11.5, 5.2);
  const battlementGeo = new THREE.BoxGeometry(2.6, 1.5, 1.1);
  const towerGeo = new THREE.CylinderGeometry(3.6, 4.1, 16.5, 16);
  const towerRoofGeo = new THREE.ConeGeometry(4.4, 5.2, 16);
  disposables.push(wingGeo, battlementGeo, towerGeo, towerRoofGeo);

  const wallGroup = new THREE.Group();
  if (isHorizontal) {
    wallGroup.position.set(0, 0, wc);
    if (spec.cityWallEdge === 'south') wallGroup.rotation.y = Math.PI;
  } else {
    wallGroup.position.set(wc, 0, 0);
    wallGroup.rotation.y = spec.cityWallEdge === 'west' ? Math.PI / 2 : -Math.PI / 2;
  }

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, mats.castleWall);
    wing.position.set(side * 105, 5.75, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
    wallGroup.add(wing);

    for (let bx = 12; bx < 192; bx += 7.5) {
      const merlon = new THREE.Mesh(battlementGeo, mats.castleWall);
      merlon.position.set(side * bx, 12.2, 2.0);
      wallGroup.add(merlon);
    }

    // Gate flanking towers & outer corner towers
    for (const tx of [9.5, 95]) {
      const tower = new THREE.Mesh(towerGeo, mats.castleWall);
      tower.position.set(side * tx, 8.25, 0);
      tower.castShadow = true;
      const roof = new THREE.Mesh(towerRoofGeo, mats.roofCobalt);
      roof.position.set(side * tx, 19.1, 0);
      roof.castShadow = true;
      wallGroup.add(tower, roof);
    }
  }

  // Gatehouse upper bridge lintel connecting both gate towers
  const lintelGeo = new THREE.BoxGeometry(17.5, 4.2, 6.0);
  disposables.push(lintelGeo);
  const lintel = new THREE.Mesh(lintelGeo, mats.castleWall);
  lintel.position.set(0, 9.6, 0);
  lintel.castShadow = true;
  wallGroup.add(lintel);

  group.add(wallGroup);
  return { group, disposables };
}

function buildFieldBridges(
  spec: FieldMapSpec,
  mats: PronteraMaterials,
): { group: THREE.Group; disposables: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];

  for (const b of spec.bridges) {
    const bg = new THREE.Group();
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = b.rotY;

    const halfW = b.width * 0.5;
    const baseY = b.deckBaseY ?? 1.18;
    const plankCount = Math.max(24, Math.round(b.width / 1.55));
    const plankStep = b.width / plankCount;
    const plankW = plankStep * 0.94;

    const plankGeo = new THREE.BoxGeometry(plankW, 0.24, b.length);
    applyMetricBoxUVs(plankGeo, plankW, 0.24, b.length, 2.6);

    const beamSegs = 12;
    const beamStep = b.width / beamSegs;
    const beamLen = Math.hypot(beamStep, 0.25) + 0.14;
    const beamGeo = new THREE.BoxGeometry(beamLen, 0.34, 0.42);
    applyMetricBoxUVs(beamGeo, beamLen, 0.34, 0.42, 2.2);

    const railGeo = new THREE.BoxGeometry(beamLen, 0.18, 0.22);
    applyMetricBoxUVs(railGeo, beamLen, 0.18, 0.22, 2.2);

    const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.28, 10);
    const postCapGeo = new THREE.BoxGeometry(0.34, 0.12, 0.34);
    const pilingGeo = new THREE.CylinderGeometry(0.24, 0.28, 3.6, 10);
    const abutmentGeo = new THREE.BoxGeometry(2.8, baseY + 1.8, b.length + 0.6);
    applyMetricBoxUVs(abutmentGeo, 2.8, baseY + 1.8, b.length + 0.6, 3.0);
    const kerbGeo = new THREE.BoxGeometry(0.95, 0.22, b.length + 0.85);
    applyMetricBoxUVs(kerbGeo, 0.95, 0.22, b.length + 0.85, 2.4);

    disposables.push(
      plankGeo,
      beamGeo,
      railGeo,
      postGeo,
      postCapGeo,
      pilingGeo,
      abutmentGeo,
      kerbGeo,
    );

    // Individual arched cross-planks with non-stretched metric timber UVs
    for (let i = 0; i < plankCount; i++) {
      const lx = -halfW + (i + 0.5) * plankStep;
      const yCurr = getBridgeDeckY(b, lx);
      const yL = getBridgeDeckY(b, lx - 0.5);
      const yR = getBridgeDeckY(b, lx + 0.5);
      const slopeRot = Math.atan2(yR - yL, 1.0);

      const plank = new THREE.Mesh(plankGeo, mats.oakWood);
      plank.position.set(lx, yCurr - 0.12, 0);
      plank.rotation.z = slopeRot;
      plank.castShadow = true;
      plank.receiveShadow = true;
      bg.add(plank);
    }

    // Arched longitudinal stringer beams + side handrails
    for (let s = 0; s < beamSegs; s++) {
      const x0 = -halfW + s * beamStep;
      const x1 = x0 + beamStep;
      const xm = (x0 + x1) * 0.5;
      const y0 = getBridgeDeckY(b, x0);
      const y1 = getBridgeDeckY(b, x1);
      const ym = (y0 + y1) * 0.5;
      const segAngle = Math.atan2(y1 - y0, beamStep);

      for (const bz of [-b.length * 0.44, 0, b.length * 0.44]) {
        const beam = new THREE.Mesh(beamGeo, mats.darkTimber);
        beam.position.set(xm, ym - 0.34, bz);
        beam.rotation.z = segAngle;
        beam.castShadow = true;
        bg.add(beam);
      }

      for (const rz of [-b.length * 0.5 + 0.34, b.length * 0.5 - 0.34]) {
        const topRail = new THREE.Mesh(railGeo, mats.darkTimber);
        topRail.position.set(xm, ym + 0.96, rz);
        topRail.rotation.z = segAngle;
        topRail.castShadow = true;
        const midRail = new THREE.Mesh(railGeo, mats.darkTimber);
        midRail.position.set(xm, ym + 0.48, rz);
        midRail.rotation.z = segAngle;
        bg.add(topRail, midRail);
      }
    }

    // Stone masonry bridge abutments seated cleanly under both riverbanks with flush threshold kerbs
    for (const endSign of [-1, 1]) {
      const abut = new THREE.Mesh(abutmentGeo, mats.castleWall);
      abut.position.set(endSign * (halfW - 0.15), (baseY - 1.8) * 0.5 - 0.18, 0);
      abut.castShadow = true;
      abut.receiveShadow = true;

      const kerb = new THREE.Mesh(kerbGeo, mats.curbStone);
      kerb.position.set(endSign * (halfW + 0.12), baseY - 0.12, 0);
      kerb.receiveShadow = true;
      bg.add(abut, kerb);
    }

    // Railing posts & submerged riverbed timber pilings aligned to the arch
    const postCount = Math.max(8, Math.round(b.width / 4.4));
    for (const sz of [-b.length * 0.5 + 0.34, b.length * 0.5 - 0.34]) {
      for (let pi = 0; pi <= postCount; pi++) {
        const px = -halfW + (pi / postCount) * b.width;
        const py = getBridgeDeckY(b, px);

        const post = new THREE.Mesh(postGeo, mats.darkTimber);
        post.position.set(px, py + 0.54, sz);
        post.castShadow = true;

        const cap = new THREE.Mesh(postCapGeo, mats.curbStone);
        cap.position.set(px, py + 1.18, sz);

        const piling = new THREE.Mesh(pilingGeo, mats.darkTimber);
        piling.position.set(px, py - 1.85, sz);
        piling.castShadow = true;

        bg.add(post, cap, piling);
      }
    }

    group.add(bg);
  }

  return { group, disposables };
}

export function buildFieldZoneScene(
  zoneId: FieldZoneId,
  mats: PronteraMaterials,
  pbrUniforms: PbrShaderUniforms,
  weatherUniforms: WeatherShaderUniforms,
): BuiltFieldZone {
  const spec = FIELD_MAPS[zoneId];
  const group = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];
  const waterMeshes: THREE.Mesh[] = [];

  // 1. Displaced High-Resolution Terrain Heightmap (510x510m, 184x184 quads)
  const span = spec.renderExtent * 2;
  const terrainGeo = new THREE.PlaneGeometry(span, span, 184, 184);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, zoneTerrainHeightAt(zoneId, x, z));
  }
  terrainGeo.computeVertexNormals();
  disposables.push(terrainGeo);

  const splatTex = buildFieldSplatTexture(zoneId, spec, 360);
  const terrainMat = createFieldTerrainMaterial(spec, splatTex, mats, pbrUniforms, weatherUniforms);
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Displaced invisible raycast mesh following terrain + bridges so click-to-move hits elevated plateaus & bridges without parallax offset
  const pickGeo = new THREE.PlaneGeometry(spec.playableExtent * 2.1, spec.playableExtent * 2.1, 96, 96);
  pickGeo.rotateX(-Math.PI / 2);
  const pickPos = pickGeo.attributes.position;
  for (let i = 0; i < pickPos.count; i++) {
    const px = pickPos.getX(i);
    const pz = pickPos.getZ(i);
    pickPos.setY(i, zoneHeightAt(zoneId, px, pz) + 0.05);
  }
  pickGeo.computeVertexNormals();
  disposables.push(pickGeo);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const groundPickMesh = new THREE.Mesh(pickGeo, pickMat);
  group.add(groundPickMesh);

  // 2. Water Cove Planes
  for (const wc of spec.waterCoves) {
    const wGeo = new THREE.CircleGeometry(1.0, 32);
    wGeo.rotateX(-Math.PI / 2);
    wGeo.scale(wc.rx * 0.96, 1.0, wc.rz * 0.96);
    disposables.push(wGeo);
    const wMesh = new THREE.Mesh(wGeo, mats.waterMoat);
    wMesh.position.set(wc.cx, -0.35, wc.cz);
    wMesh.receiveShadow = true;
    group.add(wMesh);
    waterMeshes.push(wMesh);
  }

  // 3. Arched Timber Bridges & Border Prontera City Wall
  const bridges = buildFieldBridges(spec, mats);
  disposables.push(...bridges.disposables);
  group.add(bridges.group);

  const borderWall = buildCityBorderWallSegment(spec, mats);
  disposables.push(...borderWall.disposables);
  group.add(borderWall.group);

  // 4. Multi-Variant Instanced Irregular Fractured Crag Boulders & Trail Kerbstones
  if (spec.boulders.length > 0) {
    const boulderGeos = [
      createCliffBoulderGeo(0),
      createCliffBoulderGeo(1),
      createCliffBoulderGeo(2),
    ];
    disposables.push(...boulderGeos);

    const buckets: typeof spec.boulders[] = [[], [], []];
    spec.boulders.forEach((b, idx) => {
      buckets[idx % 3].push(b);
    });

    const bDummy = new THREE.Object3D();
    const bCol = new THREE.Color();

    buckets.forEach((list, vIdx) => {
      if (list.length === 0) return;
      const bInst = new THREE.InstancedMesh(boulderGeos[vIdx], mats.cliffRock, list.length);
      bInst.castShadow = true;
      bInst.receiveShadow = true;

      list.forEach((b, i) => {
        const gy = zoneHeightAt(zoneId, b.x, b.z);
        const isRim = b.kind === 'rim';
        const sy = isRim ? b.scale * 0.54 : b.scale * (0.76 + (i % 3) * 0.14);
        const sx = isRim ? b.scale * 1.15 : b.scale * (1.06 + ((i + 1) % 3) * 0.12);
        const sz = isRim ? b.scale * 0.96 : b.scale * (0.98 + ((i + 2) % 3) * 0.10);

        bDummy.position.set(b.x, gy - (isRim ? 0.12 : 0.18) * b.scale, b.z);
        bDummy.rotation.set(
          isRim ? (i % 2) * 0.08 : (i % 3) * 0.14,
          b.rotY,
          isRim ? ((i + 1) % 2) * 0.08 : ((i + 1) % 3) * 0.12,
        );
        bDummy.scale.set(sx, sy, sz);
        bDummy.updateMatrix();
        bInst.setMatrixAt(i, bDummy.matrix);

        if (b.kind === 'mossy') {
          bCol.setHex(0xbcc9b2);
        } else if (isRim) {
          bCol.setHex(i % 2 === 0 ? 0xcac1b4 : 0xbdb3a4);
        } else {
          bCol.setHex(0xd8d5ce);
        }
        bInst.setColorAt(i, bCol);
      });

      bInst.instanceMatrix.needsUpdate = true;
      if (bInst.instanceColor) bInst.instanceColor.needsUpdate = true;
      bInst.computeBoundingSphere();
      group.add(bInst);
    });
  }

  // 5. Dense Instanced Botanical Trees (Oak, Pine, Birch, Cypress)
  const trunkGeo = createFieldTrunkGeo();
  const oakGeo = createFieldLeafClusterGeo([
    { x: 0, y: 4.1, z: 0, size: 3.7, tiltX: 0.15, rotY: 0.2 },
    { x: -1.1, y: 3.5, z: 0.7, size: 2.8, tiltX: 0.25, rotY: 1.1 },
    { x: 1.05, y: 3.65, z: -0.6, size: 2.9, tiltX: -0.2, rotY: 2.3 },
    { x: 0.25, y: 5.05, z: 0.15, size: 2.6, tiltX: 0.1, rotY: 0.8 },
  ]);
  const pineGeo = createFieldLeafClusterGeo([
    { x: 0, y: 2.4, z: 0, size: 3.4, tiltX: 1.15, rotY: 0.0 },
    { x: 0, y: 3.4, z: 0, size: 2.9, tiltX: 1.12, rotY: 0.7 },
    { x: 0, y: 4.35, z: 0, size: 2.25, tiltX: 1.05, rotY: 1.4 },
    { x: 0, y: 5.2, z: 0, size: 1.55, tiltX: 0.9, rotY: 2.1 },
  ]);
  const cypressGeo = createFieldLeafClusterGeo([
    { x: 0, y: 2.4, z: 0, size: 2.2, tiltX: 0.2, rotY: 0.3 },
    { x: 0, y: 3.6, z: 0, size: 2.0, tiltX: 0.15, rotY: 1.2 },
    { x: 0, y: 4.8, z: 0, size: 1.65, tiltX: 0.15, rotY: 2.1 },
    { x: 0, y: 5.8, z: 0, size: 1.2, tiltX: 0.1, rotY: 0.5 },
  ]);
  disposables.push(trunkGeo, oakGeo, pineGeo, cypressGeo);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const trunkInst = new THREE.InstancedMesh(trunkGeo, mats.trunkMat, spec.trees.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;
  spec.trees.forEach((t, i) => {
    const gy = zoneHeightAt(zoneId, t.x, t.z);
    dummy.position.set(t.x, gy, t.z);
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    const sx = t.kind === 'cypress' ? t.scale * 0.72 : t.scale;
    const sy = t.kind === 'cypress' ? t.scale * 1.25 : t.kind === 'pine' ? t.scale * 1.15 : t.scale;
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  group.add(trunkInst);

  const addCanopies = (
    list: typeof spec.trees,
    geo: THREE.BufferGeometry,
    mat: THREE.MeshStandardMaterial,
    sxMul: number,
    syMul: number,
  ) => {
    if (list.length === 0) return;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    list.forEach((t, i) => {
      const gy = zoneHeightAt(zoneId, t.x, t.z);
      dummy.position.set(t.x, gy, t.z);
      dummy.rotation.set(0, (i * 2.13) % (Math.PI * 2), 0);
      dummy.scale.set(t.scale * sxMul, t.scale * syMul, t.scale * sxMul);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(t.tint);
      inst.setColorAt(i, color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  };

  addCanopies(spec.trees.filter((t) => t.kind === 'oak'), oakGeo, mats.foliageOakMat, 1.0, 1.0);
  addCanopies(spec.trees.filter((t) => t.kind === 'pine'), pineGeo, mats.foliagePineMat, 1.0, 1.12);
  addCanopies(spec.trees.filter((t) => t.kind === 'birch'), oakGeo, mats.foliageBirchMat, 0.92, 1.08);
  addCanopies(spec.trees.filter((t) => t.kind === 'cypress'), cypressGeo, mats.foliageCypressMat, 0.92, 1.18);

  // 6. Swaying 3D Meadow Grass Tufts (9,600), Balanced Tall Grass Patches (2,200), Shrubs (420) & Wildflowers (820)
  const MAX_GRASS = 9600;
  const MAX_TALL_GRASS = 2200;
  const MAX_SHRUBS = 420;
  const MAX_FLOWERS = 820;
  const grassGeo = createFieldGrassTuftGeo();
  const tallGrassGeo = createTallGrassClumpGeo();
  const shrubGeo = createFieldLeafClusterGeo([
    { x: 0, y: 0.58, z: 0, size: 1.35, tiltX: 0.25, rotY: 0.2 },
    { x: -0.32, y: 0.48, z: 0.22, size: 1.05, tiltX: 0.35, rotY: 1.4 },
    { x: 0.32, y: 0.52, z: -0.22, size: 1.08, tiltX: -0.25, rotY: 2.5 },
  ]);
  const flowerGeo = new THREE.ConeGeometry(0.11, 0.14, 5);
  flowerGeo.rotateX(Math.PI);
  flowerGeo.translate(0, 0.30, 0);
  disposables.push(grassGeo, tallGrassGeo, shrubGeo, flowerGeo);

  const grassInst = new THREE.InstancedMesh(grassGeo, mats.grassBladeMat, MAX_GRASS);
  grassInst.receiveShadow = true;
  const tallGrassInst = new THREE.InstancedMesh(tallGrassGeo, mats.tallGrassBladeMat, MAX_TALL_GRASS);
  tallGrassInst.castShadow = true;
  tallGrassInst.receiveShadow = true;
  const shrubInst = new THREE.InstancedMesh(shrubGeo, mats.shrubLeafMat, MAX_SHRUBS);
  shrubInst.castShadow = true;
  shrubInst.receiveShadow = true;
  const flowerInst = new THREE.InstancedMesh(flowerGeo, mats.wildflowerMat, MAX_FLOWERS);

  let gSeed = zoneId === 'prt_fild08' ? 8811 : zoneId === 'prt_fild06' ? 6611 : zoneId === 'prt_fild05' ? 5511 : 1111;
  const gRand = () => {
    gSeed = (gSeed * 1664525 + 1013904223) >>> 0;
    return gSeed / 4294967296;
  };

  let gCount = 0;
  let tgCount = 0;
  let sCount = 0;
  let fCount = 0;
  const flowerPalette = [0xf7eed0, 0xf2c95a, 0xd8a8e8, 0xf28b79];

  for (let attempt = 0; attempt < 28000 && gCount < MAX_GRASS; attempt++) {
    const gx = (gRand() * 2 - 1) * (spec.playableExtent - 4);
    const gz = (gRand() * 2 - 1) * (spec.playableExtent - 4);
    if (zoneWaterDepthAt(zoneId, gx, gz) > 0.02) continue;
    const trailVal = zoneTrailMaskAt(zoneId, gx, gz);
    if (trailVal > 0.34) continue;
    if (zoneCliffSlopeAt(zoneId, gx, gz) > 0.50) continue;

    // Keep clear of wooden bridge decks & masonry abutments
    let onBridgeDeck = false;
    for (let bi = 0; bi < spec.bridges.length; bi++) {
      const b = spec.bridges[bi];
      const { lx, lz } = getBridgeLocalCoords(b, gx, gz);
      if (Math.abs(lx) <= b.width * 0.5 + 4.4 && Math.abs(lz) <= b.length * 0.5 + 2.4) {
        onBridgeDeck = true;
        break;
      }
    }
    if (onBridgeDeck) continue;

    // Keep clear of city border wall
    if (
      ((spec.cityWallEdge === 'north' || spec.cityWallEdge === 'south') && Math.abs(gz - spec.cityWallCoord) < 6) ||
      ((spec.cityWallEdge === 'west' || spec.cityWallEdge === 'east') && Math.abs(gx - spec.cityWallCoord) < 6)
    ) {
      continue;
    }

    const gy = zoneHeightAt(zoneId, gx, gz);
    const sc = 0.80 + gRand() * 0.72;
    dummy.position.set(gx, gy, gz);
    dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
    dummy.scale.set(sc, sc * (0.85 + gRand() * 0.45), sc);
    dummy.updateMatrix();
    grassInst.setMatrixAt(gCount, dummy.matrix);
    color.setHSL(0.24 + (gRand() - 0.5) * 0.05, 0.38 + gRand() * 0.22, 0.42 + gRand() * 0.16);
    grassInst.setColorAt(gCount, color);
    gCount++;

    // Natural clustered patches of Tall Meadow Grass (vysoká tráva, balanced density away from footpaths)
    const patchWave = Math.sin(gx * 0.065 + gz * 0.045) * Math.cos(gx * 0.042 - gz * 0.072);
    if (tgCount < MAX_TALL_GRASS && trailVal < 0.12 && patchWave > 0.12 && gRand() < 0.46) {
      const tsc = 0.85 + gRand() * 0.52;
      dummy.position.set(gx + (gRand() - 0.5) * 0.8, gy, gz + (gRand() - 0.5) * 0.8);
      dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
      dummy.scale.set(tsc, tsc * (0.92 + gRand() * 0.38), tsc);
      dummy.updateMatrix();
      tallGrassInst.setMatrixAt(tgCount, dummy.matrix);
      color.setHSL(0.23 + (gRand() - 0.5) * 0.05, 0.42 + gRand() * 0.20, 0.38 + gRand() * 0.16);
      tallGrassInst.setColorAt(tgCount, color);
      tgCount++;
    }

    // Leafy forest underbrush shrubs near groves and boulders
    if (sCount < MAX_SHRUBS && trailVal < 0.05 && patchWave > 0.28 && gRand() < 0.085) {
      const ssc = 0.76 + gRand() * 0.64;
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(0, gRand() * Math.PI * 2, 0);
      dummy.scale.set(ssc, ssc * (0.82 + gRand() * 0.35), ssc);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(sCount, dummy.matrix);
      color.setHSL(0.25 + (gRand() - 0.5) * 0.04, 0.38 + gRand() * 0.20, 0.40 + gRand() * 0.14);
      shrubInst.setColorAt(sCount, color);
      sCount++;
    }

    if (fCount < MAX_FLOWERS && gRand() < 0.09) {
      dummy.position.set(gx, gy, gz);
      dummy.scale.setScalar(0.85 + gRand() * 0.55);
      dummy.updateMatrix();
      flowerInst.setMatrixAt(fCount, dummy.matrix);
      color.setHex(flowerPalette[fCount % flowerPalette.length]);
      flowerInst.setColorAt(fCount, color);
      fCount++;
    }
  }

  grassInst.count = gCount;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  tallGrassInst.count = tgCount;
  tallGrassInst.instanceMatrix.needsUpdate = true;
  if (tallGrassInst.instanceColor) tallGrassInst.instanceColor.needsUpdate = true;
  tallGrassInst.computeBoundingSphere();
  group.add(tallGrassInst);

  shrubInst.count = sCount;
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  shrubInst.computeBoundingSphere();
  group.add(shrubInst);

  flowerInst.count = fCount;
  flowerInst.instanceMatrix.needsUpdate = true;
  if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
  flowerInst.computeBoundingSphere();
  group.add(flowerInst);

  // 7. Warp Portals (back to Prontera + adjacent Fields)
  const portalBuilt = buildPortalArchways(
    spec.portals,
    mats,
    (px, pz) => zoneHeightAt(zoneId, px, pz),
  );
  group.add(portalBuilt.group);

  // 8. Field Mobs (Wolves, Goblins, Tree Ents + Slimes/Lunatics)
  const mobsBuilt = buildFieldMobs(mats, zoneId);
  group.add(mobsBuilt.group);

  return {
    group,
    groundPickMesh,
    waterMeshes,
    portals: portalBuilt.portals,
    mobActors: mobsBuilt.actors,
    mobHitTargets: mobsBuilt.hitTargets,
    dispose: () => {
      splatTex.dispose();
      terrainMat.dispose();
      pickMat.dispose();
      for (const geo of disposables) {
        geo.dispose();
      }
      portalBuilt.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
        }
      });
    },
  };
}
