import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  computeAtmosphereState,
  resolveGraphicsProfile,
  todPresetToNormalized,
} from './atmosphere.ts';

test('hardware capability scaling disables heavy post-processing on software WebGL and scales up on GPU', () => {
  const softwareProfile = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, {
    isSoftwareGl: true,
    devicePixelRatio: 2,
    hardwareConcurrency: 8,
    viewportWidth: 1440,
  });
  assert.equal(softwareProfile.tier, 'low');
  assert.equal(softwareProfile.pixelRatio, 1);
  assert.equal(softwareProfile.shadowsEnabled, false);
  assert.equal(softwareProfile.postProcessEnabled, false);
  assert.equal(softwareProfile.waterWaveOctaves, 1);

  const highGpuProfile = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, {
    isSoftwareGl: false,
    devicePixelRatio: 2,
    hardwareConcurrency: 12,
    viewportWidth: 1440,
  });
  assert.equal(highGpuProfile.tier, 'high');
  assert.equal(highGpuProfile.pixelRatio, 2);
  assert.equal(highGpuProfile.shadowsEnabled, true);
  assert.equal(highGpuProfile.postProcessEnabled, true);
  assert.equal(highGpuProfile.bloomEnabled, true);
  assert.equal(highGpuProfile.outlinesEnabled, true);
  assert.equal(highGpuProfile.waterWaveOctaves, 2);

  const mobileProfile = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, {
    isSoftwareGl: false,
    devicePixelRatio: 3,
    hardwareConcurrency: 8,
    viewportWidth: 390,
  });
  assert.equal(mobileProfile.tier, 'medium');
  assert.equal(mobileProfile.bloomHalfRes, true);
  assert.equal(mobileProfile.pixelRatio, 1.5);
});

test('time-of-day and weather cycles shift lighting, surface states, and color grading', () => {
  const zeroSurface = { wetness: 0, snow: 0, corruption: 0 };

  const dawn = computeAtmosphereState(todPresetToNormalized('dawn', 0), 'clear', zeroSurface, 0, 0, true);
  assert.equal(dawn.todLabel, 'Dawn');
  assert.ok(dawn.warmTint[0] > dawn.warmTint[2], 'Dawn grading should skew warm');

  const rain = computeAtmosphereState(todPresetToNormalized('day', 0), 'rain', zeroSurface, 2, 0, true);
  assert.equal(rain.surface.wetness, 1);
  assert.equal(rain.surface.snow, 0);
  assert.ok(rain.fogDensity > 0.011, 'Rain increases atmospheric fog density');

  const snow = computeAtmosphereState(todPresetToNormalized('day', 0), 'snow', zeroSurface, 2, 0, true);
  assert.equal(snow.surface.snow, 1);
  assert.ok(snow.coolTint[2] > snow.coolTint[0], 'Snow grading should skew cool');

  const day = computeAtmosphereState(todPresetToNormalized('day', 0), 'clear', zeroSurface, 0, 0, true);
  const corrupt = computeAtmosphereState(todPresetToNormalized('night', 0), 'corruption', zeroSurface, 2, 2, true);
  assert.equal(corrupt.todLabel, 'Starlight');
  assert.equal(corrupt.surface.corruption, 1);
  assert.ok(corrupt.bloomStrength > 0.55, 'Corruption amplifies bloom strength');
  assert.ok(corrupt.envIntensity < day.envIntensity, 'Night/corruption lowers IBL ambient wash');
});
