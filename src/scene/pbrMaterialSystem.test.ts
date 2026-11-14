import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  classifyPbrSurfaceKind,
  computePbrProgramCacheKey,
  createPbrUniforms,
  getPbrSurfaceProfile,
} from './pbrMaterialSystem';

test('getPbrSurfaceProfile returns calibrated physical parameters per surface kind', () => {
  const metal = getPbrSurfaceProfile('metal');
  const stone = getPbrSurfaceProfile('stone');
  const plaster = getPbrSurfaceProfile('plaster');
  const leather = getPbrSurfaceProfile('leather');

  assert.ok(metal.fresnelReflectStrength > plaster.fresnelReflectStrength);
  assert.ok(metal.edgeWearBoost > plaster.edgeWearBoost);
  assert.ok(stone.cavityAoStrength >= 0.4 && stone.cavityAoStrength <= 0.8);
  assert.ok(stone.contactAoHeight > 0.8 && stone.contactAoStrength > 0.25);
  assert.equal(metal.useLocalCoords, true);
  assert.equal(leather.useLocalCoords, true);
  assert.equal(stone.useLocalCoords, false);
});

test('classifyPbrSurfaceKind respects explicit tags, skips unlit/emissive, and infers fallbacks', () => {
  const basic = new THREE.MeshBasicMaterial({ color: 0xffffff });
  assert.equal(classifyPbrSurfaceKind(basic), 'skip');

  const glow = new THREE.MeshStandardMaterial({
    color: 0xffd27a,
    emissive: 0xffa833,
    emissiveIntensity: 1.2,
  });
  assert.equal(classifyPbrSurfaceKind(glow), 'skip');

  const taggedRoof = new THREE.MeshStandardMaterial({ color: 0x4570ab });
  taggedRoof.userData.pbrKind = 'roof';
  assert.equal(classifyPbrSurfaceKind(taggedRoof), 'roof');

  const autoMetal = new THREE.MeshPhysicalMaterial({
    color: 0xc2cbd6,
    metalness: 0.92,
    roughness: 0.25,
  });
  assert.equal(classifyPbrSurfaceKind(autoMetal), 'metal');

  const handledWater = new THREE.MeshPhysicalMaterial({ color: 0x0f72a8 });
  handledWater.userData.pbrHandled = true;
  assert.equal(classifyPbrSurfaceKind(handledWater), 'skip');
});

test('computePbrProgramCacheKey produces deterministic keys for structural weather & sway variants', () => {
  const kNoWeather = computePbrProgramCacheKey('metal');
  const kWeatherStatic = computePbrProgramCacheKey('stone', {
    allowPuddles: true,
    snowAmount: 0.95,
    wetDarken: 0.46,
  });
  const kWeatherSway = computePbrProgramCacheKey('foliage', {
    swayAmp: 0.14,
    swayHeightOffset: 1.8,
  });

  assert.notEqual(kNoWeather, kWeatherStatic);
  assert.notEqual(kWeatherStatic, kWeatherSway);
  // Different surface kinds without sway share compiled programs via uniforms
  assert.equal(
    kWeatherStatic,
    computePbrProgramCacheKey('roof', { allowPuddles: false, snowAmount: 0.5, wetDarken: 0.25 }),
  );
});

test('createPbrUniforms initializes normalized sun vector and mood contrast', () => {
  const u = createPbrUniforms();
  assert.ok(Math.abs(u.uSunDir.value.length() - 1.0) < 0.001);
  assert.equal(u.uMoodContrast.value, 1.0);
});
