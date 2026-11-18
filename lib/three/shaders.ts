import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { AtmosphereComputedState, ResolvedGraphicsProfile } from './atmosphere';

export interface SharedAtmosphereUniforms {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  uRimStrength: { value: number };
  uSkyColor: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uWetness: { value: number };
  uSnow: { value: number };
  uCorruption: { value: number };
  uWaterShallowColor: { value: THREE.Color };
  uWaterDeepColor: { value: THREE.Color };
  uWaterFoamColor: { value: THREE.Color };
  uWaterOctaves: { value: number };
  uMistColor: { value: THREE.Color };
  uMistOpacity: { value: number };
  uShaftColor: { value: THREE.Color };
  uShaftIntensity: { value: number };
}

export function createSharedAtmosphereUniforms(): SharedAtmosphereUniforms {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.52).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1d6) },
    uRimColor: { value: new THREE.Color(0x7cc4ff) },
    uRimStrength: { value: 0.58 },
    uSkyColor: { value: new THREE.Color(0xa7d1f7) },
    uFogColor: { value: new THREE.Color(0x99bdd4) },
    uFogDensity: { value: 0.0078 },
    uWetness: { value: 0 },
    uSnow: { value: 0 },
    uCorruption: { value: 0.14 },
    uWaterShallowColor: { value: new THREE.Color(0x268ca8) },
    uWaterDeepColor: { value: new THREE.Color(0x0e3b56) },
    uWaterFoamColor: { value: new THREE.Color(0xdff5ff) },
    uWaterOctaves: { value: 2 },
    uMistColor: { value: new THREE.Color(0xd4e8f7) },
    uMistOpacity: { value: 0.22 },
    uShaftColor: { value: new THREE.Color(0xfff3cc) },
    uShaftIntensity: { value: 0.34 },
  };
}

export function syncSharedUniforms(
  uniforms: SharedAtmosphereUniforms,
  atmo: AtmosphereComputedState,
  elapsedSec: number,
  waterOctaves: 1 | 2,
): void {
  uniforms.uTime.value = elapsedSec;
  uniforms.uSunDir.value
    .set(atmo.sunDirection[0], atmo.sunDirection[1], atmo.sunDirection[2])
    .normalize();
  uniforms.uSunColor.value.setHex(atmo.sunColor);
  uniforms.uRimColor.value.setHex(atmo.rimColor);
  uniforms.uRimStrength.value = atmo.rimIntensity;
  uniforms.uSkyColor.value.setHex(atmo.hemiSkyColor);
  uniforms.uFogColor.value.setHex(atmo.fogColor);
  uniforms.uFogDensity.value = atmo.fogDensity;
  uniforms.uWetness.value = atmo.surface.wetness;
  uniforms.uSnow.value = atmo.surface.snow;
  uniforms.uCorruption.value = atmo.surface.corruption;
  uniforms.uWaterShallowColor.value.setHex(atmo.waterShallowColor);
  uniforms.uWaterDeepColor.value.setHex(atmo.waterDeepColor);
  uniforms.uWaterFoamColor.value.setHex(atmo.waterFoamColor);
  uniforms.uWaterOctaves.value = waterOctaves;
  uniforms.uMistColor.value.setHex(atmo.mistColor);
  uniforms.uMistOpacity.value = atmo.mistOpacity;
  uniforms.uShaftColor.value.setHex(atmo.shaftColor);
  uniforms.uShaftIntensity.value = atmo.shaftIntensity;
}

export interface StylizedSurfaceOptions {
  allowSnow?: boolean;
  allowCorruption?: boolean;
  isFoliage?: boolean;
  rimBoost?: number;
}

const SURFACE_GLSL_HELPERS = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uWetness;
uniform float uSnow;
uniform float uCorruption;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

float agHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float agNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = agHash21(i);
  float b = agHash21(i + vec2(1.0, 0.0));
  float c = agHash21(i + vec2(0.0, 1.0));
  float d = agHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float agRainRipple(vec2 wp, float t) {
  vec2 cell = floor(wp * 2.35);
  vec2 local = fract(wp * 2.35) - 0.5;
  float seed = agHash21(cell);
  float phase = fract(t * 1.85 + seed * 5.7);
  float radius = phase * 0.34;
  float dist = length(local);
  float ring = exp(-abs(dist - radius) * 42.0) * (1.0 - phase);
  return ring * step(0.62, seed);
}
`;

export function enhanceStylizedSurfaceMaterial<T extends THREE.MeshStandardMaterial>(
  material: T,
  uniforms: SharedAtmosphereUniforms,
  options: StylizedSurfaceOptions = {},
): T {
  const allowSnow = options.allowSnow ?? true;
  const allowCorruption = options.allowCorruption ?? true;
  const isFoliage = options.isFoliage ?? false;
  const rimBoost = options.rimBoost ?? 1.0;

  material.customProgramCacheKey = () =>
    `ag_stylized_${allowSnow ? 1 : 0}_${allowCorruption ? 1 : 0}_${isFoliage ? 1 : 0}_${rimBoost.toFixed(2)}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uRimColor = uniforms.uRimColor;
    shader.uniforms.uRimStrength = uniforms.uRimStrength;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uSnow = uniforms.uSnow;
    shader.uniforms.uCorruption = uniforms.uCorruption;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
vec4 _agWorldPos = vec4(transformed, 1.0);
vec3 _agWorldNorm = normal;
#ifdef USE_INSTANCING
  _agWorldPos = instanceMatrix * _agWorldPos;
  _agWorldNorm = mat3(instanceMatrix) * _agWorldNorm;
#endif
_agWorldPos = modelMatrix * _agWorldPos;
${
  isFoliage
    ? /* glsl */ `
float _windSway = sin(uTime * 1.85 + _agWorldPos.x * 0.45 + _agWorldPos.z * 0.35) * 0.08 * max(0.0, transformed.y - 1.5);
transformed.x += _windSway;
transformed.z += _windSway * 0.55;
`
    : ''
}
vWorldPos = _agWorldPos.xyz;
vWorldNormal = normalize(mat3(modelMatrix) * _agWorldNorm);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
${SURFACE_GLSL_HELPERS}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
vec3 _agN = normalize(vWorldNormal);
float _agUpMask = smoothstep(0.32, 0.85, _agN.y);
float _agDetailNoise = agNoise2(vWorldPos.xz * 0.42);
float _agWet = clamp(uWetness * (0.45 + 0.55 * _agUpMask), 0.0, 1.0);
diffuseColor.rgb *= mix(1.0, 0.46, _agWet);
if (uCorruption > 0.16) {
  float _corruptTint = clamp((uCorruption - 0.16) * 0.55, 0.0, 0.48);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.68, 0.52, 0.92), _corruptTint);
}
float _agSnowMask = 0.0;
${
  allowSnow
    ? /* glsl */ `
float _snowElev = smoothstep(-0.6, 1.8, vWorldPos.y) * 0.25 + 0.75;
_agSnowMask = clamp(uSnow * smoothstep(0.36, 0.82, _agN.y + (_agDetailNoise - 0.5) * 0.38) * _snowElev, 0.0, 1.0);
float _texLum = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.25, 1.0);
vec3 _snowCol = vec3(0.84, 0.91, 0.98) * mix(0.76, 1.04, _texLum);
diffuseColor.rgb = mix(diffuseColor.rgb, _snowCol, _agSnowMask * 0.84);
`
    : ''
}
`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.14, clamp(uWetness * smoothstep(0.25, 0.85, vWorldNormal.y), 0.0, 1.0));
roughnessFactor = mix(roughnessFactor, 0.68, _agSnowMask);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
vec3 _agViewDir = normalize(cameraPosition - vWorldPos);
float _agNdotV = max(dot(_agN, _agViewDir), 0.0);
float _agRim = pow(1.0 - _agNdotV, 2.7) * uRimStrength * ${rimBoost.toFixed(2)};
float _agSunWrap = smoothstep(-0.15, 0.65, dot(_agN, normalize(uSunDir)));
totalEmissiveRadiance += uRimColor * _agRim * (0.35 + 0.65 * _agSunWrap) * 0.42;

if (uWetness > 0.02 && _agN.y > 0.65) {
  float _rip = agRainRipple(vWorldPos.xz, uTime);
  totalEmissiveRadiance += vec3(0.58, 0.76, 0.94) * _rip * uWetness * 0.18;
}

if (_agSnowMask > 0.15) {
  float _sparkle = smoothstep(0.90, 0.99, agHash21(floor(vWorldPos.xz * 7.0) + floor(uTime * 2.0) * 0.13));
  totalEmissiveRadiance += vec3(0.7, 0.88, 1.0) * _sparkle * _agSnowMask * 0.18;
}

${
  allowCorruption
    ? /* glsl */ `
if (uCorruption > 0.02) {
  float _northWeight = smoothstep(10.0, -34.0, vWorldPos.z);
  float _sanctuaryDist = length(vWorldPos.xz - vec2(0.0, 14.0));
  float _sanctuaryFade = mix(0.28, 1.0, smoothstep(5.0, 16.0, _sanctuaryDist));
  float _riftProximity = max(_northWeight, uCorruption * 0.9) * _sanctuaryFade;
  float _n1 = agNoise2(vWorldPos.xz * 0.44 + vec2(uTime * 0.07, -uTime * 0.05));
  float _n2 = agNoise2(vWorldPos.xz * 0.96 - vec2(uTime * 0.11, uTime * 0.08));
  float _vein = 1.0 - smoothstep(0.0, 0.055, abs(_n1 - _n2));
  float _corruptPulse = 0.72 + 0.28 * sin(uTime * 2.6 + vWorldPos.x * 0.35 + vWorldPos.z * 0.35);
  float _corruptGlow = _vein * _riftProximity * uCorruption * _corruptPulse;
  totalEmissiveRadiance += vec3(0.88, 0.24, 1.0) * _corruptGlow * 1.35;
}
`
    : ''
}`,
      );
  };

  material.needsUpdate = true;
  return material;
}

export function createRefractiveWaterMaterial(uniforms: SharedAtmosphereUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: uniforms.uTime,
      uSunDir: uniforms.uSunDir,
      uSunColor: uniforms.uSunColor,
      uSkyColor: uniforms.uSkyColor,
      uFogColor: uniforms.uFogColor,
      uFogDensity: uniforms.uFogDensity,
      uWetness: uniforms.uWetness,
      uSnow: uniforms.uSnow,
      uCorruption: uniforms.uCorruption,
      uWaterShallowColor: uniforms.uWaterShallowColor,
      uWaterDeepColor: uniforms.uWaterDeepColor,
      uWaterFoamColor: uniforms.uWaterFoamColor,
      uWaterOctaves: uniforms.uWaterOctaves,
    },
    vertexShader: /* glsl */ `
uniform float uTime;
uniform float uWaterOctaves;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vWaveHeight;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float w1 = sin(wp.x * 0.55 + uTime * 2.1) * cos(wp.z * 0.45 + uTime * 1.3) * 0.055;
  float w2 = 0.0;
  if (uWaterOctaves > 1.5) {
    w2 = sin(wp.x * 1.35 - uTime * 2.8 + wp.z * 0.9) * 0.025;
  }
  float totalH = w1 + w2;
  wp.y += totalH;
  vWaveHeight = totalH;
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uWetness;
uniform float uSnow;
uniform float uCorruption;
uniform vec3 uWaterShallowColor;
uniform vec3 uWaterDeepColor;
uniform vec3 uWaterFoamColor;
uniform float uWaterOctaves;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vWaveHeight;

float wHash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x),
    mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  // Bank proximity depth (center of river channel is deepest)
  float bankDist = abs(vUv.y - 0.5) * 2.0; // 0 center, 1 bank edge
  float depthFactor = clamp(1.0 - smoothstep(0.35, 0.98, bankDist), 0.0, 1.0);

  // Analytical + scrolling procedural wave normals (smooth across all mesh resolutions)
  vec2 flowUv1 = vWorldPos.xz * 0.55 + vec2(uTime * 0.35, uTime * 0.14);
  vec2 flowUv2 = vWorldPos.xz * 1.15 - vec2(uTime * 0.28, -uTime * 0.22);
  float nx = cos(flowUv1.x * 2.2 + flowUv1.y) * 0.14;
  float nz = sin(flowUv1.y * 2.4 - flowUv1.x) * 0.14;
  if (uWaterOctaves > 1.5) {
    nx += (wNoise(flowUv2 * 2.1) - 0.5) * 0.22;
    nz += (wNoise(flowUv2 * 2.1 + 7.3) - 0.5) * 0.22;
  }
  vec3 N = normalize(vec3(nx, 1.0, nz));
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunDir);

  // Simulated refracted riverbed + caustic shimmer
  vec2 refractCoord = vWorldPos.xz * 0.85 + N.xz * 0.75;
  float c1 = wNoise(refractCoord + vec2(uTime * 0.4, uTime * 0.25));
  float c2 = wNoise(refractCoord * 1.7 - vec2(uTime * 0.32, uTime * 0.18));
  float caustic = pow(clamp(1.0 - abs(c1 - c2) * 3.8, 0.0, 1.0), 3.0);

  vec3 waterBody = mix(uWaterShallowColor, uWaterDeepColor, depthFactor * 0.85 + 0.15);
  waterBody += vec3(0.45, 0.82, 0.95) * caustic * (1.0 - depthFactor * 0.45) * 0.32;

  // Schlick Fresnel sky reflection
  float NdotV = max(dot(N, V), 0.0);
  float fresnel = 0.05 + 0.95 * pow(1.0 - NdotV, 4.0);
  vec3 reflectedSky = mix(uSkyColor, uSunColor, 0.22);
  vec3 col = mix(waterBody, reflectedSky, fresnel * 0.75);

  // Specular sun glints
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 96.0);
  col += uSunColor * spec * 1.35;

  // Shoreline & bridge-pier foam
  float bankFoamNoise = wNoise(vWorldPos.xz * 1.9 + vec2(uTime * 0.55, 0.0));
  float edgeFoam = smoothstep(0.76, 0.98, bankDist + (bankFoamNoise - 0.5) * 0.16);
  float bridgePierDist = abs(abs(vWorldPos.x) - 3.5);
  float bridgeFoam = smoothstep(0.95, 0.05, bridgePierDist + (bankFoamNoise - 0.5) * 0.35) * 0.55;
  float totalFoam = clamp(edgeFoam + bridgeFoam, 0.0, 1.0);
  col = mix(col, uWaterFoamColor, totalFoam * 0.82);

  // Rain surface ripples
  if (uWetness > 0.02) {
    vec2 rCell = floor(vWorldPos.xz * 1.15);
    vec2 rLocal = fract(vWorldPos.xz * 1.15) - 0.5;
    float rSeed = wHash(rCell);
    float rPhase = fract(uTime * 1.8 + rSeed * 6.3);
    float rRing = exp(-abs(length(rLocal) - rPhase * 0.45) * 30.0) * (1.0 - rPhase);
    col += uSkyColor * rRing * uWetness * 0.45 * step(0.4, rSeed);
  }

  // Snow frost rim along banks
  if (uSnow > 0.02) {
    float iceRim = smoothstep(0.68, 0.95, bankDist) * uSnow;
    col = mix(col, vec3(0.88, 0.95, 1.0), iceRim * 0.65);
  }

  // Arcane leyline current glow under corruption
  if (uCorruption > 0.12) {
    float ley = smoothstep(0.62, 0.95, sin(vWorldPos.x * 0.25 + uTime * 1.4 + c1 * 3.0) * 0.5 + 0.5);
    col += vec3(0.78, 0.28, 1.0) * ley * uCorruption * 0.45;
  }

  // Match scene FogExp2 cleanly
  float camDist = length(cameraPosition - vWorldPos);
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * camDist * camDist);
  col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

  float bankFeather = smoothstep(1.0, 0.74, bankDist);
  float alpha = mix(0.76, 0.94, clamp(depthFactor + totalFoam * 0.5 + fresnel * 0.3, 0.0, 1.0)) * bankFeather;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
  });
}

export function createVolumetricMistMaterial(uniforms: SharedAtmosphereUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: uniforms.uTime,
      uMistColor: uniforms.uMistColor,
      uMistOpacity: uniforms.uMistOpacity,
      uFogColor: uniforms.uFogColor,
      uFogDensity: uniforms.uFogDensity,
    },
    vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uMistColor;
uniform float uMistOpacity;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec2 vUv;
varying vec3 vWorldPos;

float mHash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.12);
  return fract(p.x * p.y);
}

float mNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mHash(i), mHash(i + vec2(1.0, 0.0)), f.x),
    mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 drift1 = vWorldPos.xz * 0.052 + vec2(uTime * 0.032, uTime * 0.014);
  vec2 drift2 = vWorldPos.xz * 0.11 - vec2(uTime * 0.022, -uTime * 0.018);
  float fbm = mNoise(drift1) * 0.6 + mNoise(drift2) * 0.4;

  // Radial vignette on plane so edges never show hard quads
  float radial = smoothstep(0.95, 0.22, length((vUv - 0.5) * 2.0));
  // Concentrate mist along the river valley and outer ridge, keeping Sanctuary central plaza clear
  float riverZ = -4.5 + sin(vWorldPos.x * 0.08) * 3.2;
  float riverBand = exp(-abs(vWorldPos.z - riverZ) * 0.14);
  float outerBand = smoothstep(22.0, 52.0, length(vWorldPos.xz));
  float zoneMask = max(riverBand * 0.9, outerBand * 0.85);

  float alpha = smoothstep(0.38, 0.88, fbm) * radial * zoneMask * uMistOpacity * 0.52;
  if (alpha < 0.01) discard;

  float camDist = length(cameraPosition - vWorldPos);
  float fogFade = exp(-uFogDensity * uFogDensity * camDist * camDist * 0.45);
  vec3 col = mix(uFogColor, uMistColor, 0.72);
  gl_FragColor = vec4(col, alpha * fogFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
  });
}

export function createVolumetricShaftMaterial(uniforms: SharedAtmosphereUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: uniforms.uTime,
      uShaftColor: uniforms.uShaftColor,
      uShaftIntensity: uniforms.uShaftIntensity,
    },
    vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uShaftColor;
uniform float uShaftIntensity;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  float horiz = pow(sin(vUv.x * 3.14159265), 1.8);
  float vert = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
  float shimmer = 0.75 + 0.25 * sin(vUv.x * 11.0 + uTime * 0.9 + vWorldPos.x * 0.2);
  float alpha = horiz * vert * shimmer * uShaftIntensity * 0.26;
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(uShaftColor, alpha);
  #include <colorspace_fragment>
}
`,
  });
}

export const AtmospherePostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uOutlinesEnabled: { value: 1.0 },
    uOutlineStrength: { value: 0.42 },
    uOutlineColor: { value: new THREE.Color(0x161c26) },
    uColorGradingEnabled: { value: 1.0 },
    uExposure: { value: 1.06 },
    uContrast: { value: 1.04 },
    uSaturation: { value: 1.05 },
    uWarmTint: { value: new THREE.Vector3(1.03, 1.01, 0.98) },
    uCoolTint: { value: new THREE.Vector3(0.96, 1.0, 1.04) },
    uVignette: { value: 0.34 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uOutlinesEnabled;
uniform float uOutlineStrength;
uniform vec3 uOutlineColor;
uniform float uColorGradingEnabled;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uWarmTint;
uniform vec3 uCoolTint;
uniform float uVignette;

varying vec2 vUv;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec3 col = base.rgb;

  // Stylized Sobel luma outline pass
  if (uOutlinesEnabled > 0.5 && uOutlineStrength > 0.01) {
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    float tl = getLuma(texture2D(tDiffuse, vUv + texel * vec2(-1.0,  1.0)).rgb);
    float tm = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 0.0,  1.0)).rgb);
    float tr = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 1.0,  1.0)).rgb);
    float ml = getLuma(texture2D(tDiffuse, vUv + texel * vec2(-1.0,  0.0)).rgb);
    float mr = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 1.0,  0.0)).rgb);
    float bl = getLuma(texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0)).rgb);
    float bm = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 0.0, -1.0)).rgb);
    float br = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 1.0, -1.0)).rgb);

    float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    float gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
    float edge = sqrt(gx * gx + gy * gy);
    float edgeMask = smoothstep(0.16, 0.48, edge) * uOutlineStrength;
    col = mix(col, uOutlineColor, clamp(edgeMask, 0.0, 0.65));
  }

  // Dynamic Time-of-Day & Weather Color Grading (perceptual mid-gray safe)
  if (uColorGradingEnabled > 0.5) {
    col *= uExposure;
    float lum = getLuma(col);
    vec3 shadowCol = col * uCoolTint;
    vec3 highlightCol = col * uWarmTint;
    col = mix(shadowCol, highlightCol, smoothstep(0.06, 0.78, lum));
    // Apply contrast around 0.18 mid-gray in linear space to preserve HDR bloom highlights
    col = max(col, vec3(0.0));
    col = pow(max(col / 0.18, vec3(0.0)), vec3(uContrast)) * 0.18;
    float finalLum = getLuma(col);
    col = mix(vec3(finalLum), col, uSaturation);
    col = max(col, vec3(0.0));
  }

  // Subtle radial vignette
  vec2 centered = (vUv - 0.5) * 1.4142;
  float distSq = dot(centered, centered);
  col *= 1.0 - distSq * uVignette * 0.38;

  gl_FragColor = vec4(col, base.a);
}
`,
};

export interface PostProcessingStack {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  atmospherePass: ShaderPass;
  outputPass: OutputPass;
  resize: (width: number, height: number, pixelRatio: number, bloomHalfRes: boolean) => void;
  update: (atmo: AtmosphereComputedState, profile: ResolvedGraphicsProfile) => void;
  dispose: () => void;
}

export function createPostProcessingStack(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  profile: ResolvedGraphicsProfile,
): PostProcessingStack {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(profile.pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomScale = profile.bloomHalfRes ? 0.5 : 1;
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, Math.floor(width * bloomScale)), Math.max(1, Math.floor(height * bloomScale))),
    0.36,
    0.42,
    0.78,
  );
  composer.addPass(bloomPass);

  const atmospherePass = new ShaderPass(AtmospherePostShader);
  atmospherePass.uniforms.uResolution.value.set(width * profile.pixelRatio, height * profile.pixelRatio);
  composer.addPass(atmospherePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    bloomPass,
    atmospherePass,
    outputPass,
    resize: (w: number, h: number, pr: number, halfRes: boolean) => {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      const bs = halfRes ? 0.5 : 1;
      bloomPass.resolution.set(Math.max(1, Math.floor(w * bs)), Math.max(1, Math.floor(h * bs)));
      atmospherePass.uniforms.uResolution.value.set(w * pr, h * pr);
    },
    update: (atmo: AtmosphereComputedState, p: ResolvedGraphicsProfile) => {
      bloomPass.enabled = p.bloomEnabled;
      bloomPass.strength = atmo.bloomStrength;
      bloomPass.radius = atmo.bloomRadius;
      bloomPass.threshold = atmo.bloomThreshold;

      atmospherePass.uniforms.uOutlinesEnabled.value = p.outlinesEnabled ? 1.0 : 0.0;
      atmospherePass.uniforms.uOutlineStrength.value = atmo.outlineStrength;
      atmospherePass.uniforms.uOutlineColor.value.setHex(atmo.outlineColor);

      atmospherePass.uniforms.uColorGradingEnabled.value = p.colorGradingEnabled ? 1.0 : 0.0;
      atmospherePass.uniforms.uExposure.value = 1.0;
      atmospherePass.uniforms.uContrast.value = atmo.contrast;
      atmospherePass.uniforms.uSaturation.value = atmo.saturation;
      atmospherePass.uniforms.uWarmTint.value.set(atmo.warmTint[0], atmo.warmTint[1], atmo.warmTint[2]);
      atmospherePass.uniforms.uCoolTint.value.set(atmo.coolTint[0], atmo.coolTint[1], atmo.coolTint[2]);
      atmospherePass.uniforms.uVignette.value = atmo.vignetteDarkness;
    },
    dispose: () => {
      bloomPass.dispose();
      composer.dispose();
    },
  };
}
