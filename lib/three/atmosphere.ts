export type TimeOfDayMode = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherMode = 'auto' | 'clear' | 'rain' | 'snow' | 'corruption';
export type ResolvedWeather = 'clear' | 'rain' | 'snow' | 'corruption';
export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';
export type ResolvedQualityTier = 'low' | 'medium' | 'high';

export interface PostProcessOptions {
  bloom: boolean;
  outlines: boolean;
  colorGrading: boolean;
}

export interface GraphicsSettings {
  quality: GraphicsQuality;
  timeOfDay: TimeOfDayMode;
  weather: WeatherMode;
  postProcess: PostProcessOptions;
}

export interface HardwareCapabilities {
  isSoftwareGl: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  viewportWidth: number;
}

export interface ResolvedGraphicsProfile {
  tier: ResolvedQualityTier;
  pixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  postProcessEnabled: boolean;
  bloomEnabled: boolean;
  bloomHalfRes: boolean;
  outlinesEnabled: boolean;
  colorGradingEnabled: boolean;
  volumetricLayers: number;
  precipitationCount: number;
  waterWaveOctaves: 1 | 2;
}

export interface SurfaceAccumulationState {
  wetness: number;
  snow: number;
  corruption: number;
}

export interface AtmosphereComputedState {
  todNormalized: number;
  todLabel: 'Dawn' | 'Daylight' | 'Dusk' | 'Starlight';
  resolvedWeather: ResolvedWeather;
  sunElevationRad: number;
  sunAzimuthRad: number;
  sunDirection: [number, number, number];
  skyTurbidity: number;
  skyRayleigh: number;
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  envIntensity: number;
  fogColor: number;
  fogDensity: number;
  mistColor: number;
  mistOpacity: number;
  shaftColor: number;
  shaftIntensity: number;
  waterShallowColor: number;
  waterDeepColor: number;
  waterFoamColor: number;
  surface: SurfaceAccumulationState;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  outlineStrength: number;
  outlineColor: number;
  exposure: number;
  contrast: number;
  saturation: number;
  warmTint: [number, number, number];
  coolTint: [number, number, number];
  vignetteDarkness: number;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  quality: 'auto',
  timeOfDay: 'day',
  weather: 'clear',
  postProcess: {
    bloom: true,
    outlines: true,
    colorGrading: true,
  },
};

export function todPresetToNormalized(mode: TimeOfDayMode, elapsedSec: number): number {
  switch (mode) {
    case 'dawn':
      return 0.27;
    case 'day':
      return 0.5;
    case 'dusk':
      return 0.74;
    case 'night':
      return 0.04;
    case 'auto':
    default:
      // Complete day/night cycle every 120 seconds, starting near crisp morning/day
      return (0.42 + elapsedSec / 120) % 1;
  }
}

export function resolveWeatherMode(mode: WeatherMode, elapsedSec: number): ResolvedWeather {
  if (mode !== 'auto') return mode;
  const phase = Math.floor((elapsedSec / 45) % 4);
  if (phase === 1) return 'rain';
  if (phase === 2) return 'corruption';
  if (phase === 3) return 'snow';
  return 'clear';
}

export function resolveGraphicsProfile(
  settings: GraphicsSettings,
  caps: HardwareCapabilities,
): ResolvedGraphicsProfile {
  let tier: ResolvedQualityTier;
  if (settings.quality === 'auto') {
    if (caps.isSoftwareGl) {
      tier = 'low';
    } else if (caps.hardwareConcurrency <= 4 || caps.viewportWidth < 768) {
      tier = 'medium';
    } else {
      tier = 'high';
    }
  } else {
    tier = settings.quality;
  }

  // On software WebGL, disable multi-pass post-processing to avoid CPU stall while keeping custom shaders active
  const canMultiPass = !caps.isSoftwareGl && tier !== 'low';

  if (tier === 'low') {
    return {
      tier,
      pixelRatio: 1,
      shadowsEnabled: false,
      shadowMapSize: 512,
      postProcessEnabled: false,
      bloomEnabled: false,
      bloomHalfRes: true,
      outlinesEnabled: false,
      colorGradingEnabled: false,
      volumetricLayers: 2,
      precipitationCount: 150,
      waterWaveOctaves: 1,
    };
  }

  if (tier === 'medium') {
    return {
      tier,
      pixelRatio: caps.isSoftwareGl ? 1 : Math.min(caps.devicePixelRatio, 1.5),
      shadowsEnabled: !caps.isSoftwareGl,
      shadowMapSize: 1024,
      postProcessEnabled: canMultiPass,
      bloomEnabled: canMultiPass && settings.postProcess.bloom,
      bloomHalfRes: true,
      outlinesEnabled: canMultiPass && settings.postProcess.outlines,
      colorGradingEnabled: canMultiPass && settings.postProcess.colorGrading,
      volumetricLayers: 3,
      precipitationCount: 340,
      waterWaveOctaves: 2,
    };
  }

  return {
    tier,
    pixelRatio: caps.isSoftwareGl ? 1 : Math.min(caps.devicePixelRatio, 2),
    shadowsEnabled: !caps.isSoftwareGl,
    shadowMapSize: 2048,
    postProcessEnabled: canMultiPass,
    bloomEnabled: canMultiPass && settings.postProcess.bloom,
    bloomHalfRes: false,
    outlinesEnabled: canMultiPass && settings.postProcess.outlines,
    colorGradingEnabled: canMultiPass && settings.postProcess.colorGrading,
    volumetricLayers: 5,
    precipitationCount: 620,
    waterWaveOctaves: 2,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerpHex(c1: number, c2: number, t: number): number {
  const k = clamp01(t);
  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;
  const r = Math.round(lerp(r1, r2, k));
  const g = Math.round(lerp(g1, g2, k));
  const b = Math.round(lerp(b1, b2, k));
  return (r << 16) | (g << 8) | b;
}

function lerpTuple3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

interface TodPalette {
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  fogColor: number;
  fogDensity: number;
  mistColor: number;
  shaftColor: number;
  exposure: number;
  contrast: number;
  saturation: number;
  warmTint: [number, number, number];
  coolTint: [number, number, number];
  bloomStrength: number;
  outlineColor: number;
  envIntensity: number;
}

const PALETTE_NIGHT: TodPalette = {
  sunColor: 0x9bb8ff,
  sunIntensity: 0.95,
  hemiSky: 0x2c4273,
  hemiGround: 0x131a26,
  hemiIntensity: 0.56,
  rimColor: 0x60a5fa,
  rimIntensity: 0.72,
  fogColor: 0x16223b,
  fogDensity: 0.0115,
  mistColor: 0x4b6ba8,
  shaftColor: 0x7aa4ff,
  exposure: 0.92,
  contrast: 1.08,
  saturation: 0.94,
  warmTint: [0.95, 0.96, 1.08],
  coolTint: [0.76, 0.86, 1.16],
  bloomStrength: 0.55,
  outlineColor: 0x0b1120,
  envIntensity: 0.24,
};

const PALETTE_DAWN: TodPalette = {
  sunColor: 0xffb37a,
  sunIntensity: 1.85,
  hemiSky: 0xd6b0c8,
  hemiGround: 0x3b352e,
  hemiIntensity: 0.72,
  rimColor: 0xfca5a5,
  rimIntensity: 0.65,
  fogColor: 0xd9a89d,
  fogDensity: 0.0095,
  mistColor: 0xf4c4b2,
  shaftColor: 0xffc68f,
  exposure: 1.05,
  contrast: 1.04,
  saturation: 1.08,
  warmTint: [1.14, 1.02, 0.94],
  coolTint: [0.92, 0.90, 1.06],
  bloomStrength: 0.42,
  outlineColor: 0x231724,
  envIntensity: 0.46,
};

const PALETTE_DAY: TodPalette = {
  sunColor: 0xfff1d6,
  sunIntensity: 2.15,
  hemiSky: 0xa7d1f7,
  hemiGround: 0x35432e,
  hemiIntensity: 0.76,
  rimColor: 0x7cc4ff,
  rimIntensity: 0.58,
  fogColor: 0x99bdd4,
  fogDensity: 0.0078,
  mistColor: 0xd4e8f7,
  shaftColor: 0xfff3cc,
  exposure: 1.08,
  contrast: 1.03,
  saturation: 1.04,
  warmTint: [1.03, 1.01, 0.98],
  coolTint: [0.96, 1.0, 1.04],
  bloomStrength: 0.34,
  outlineColor: 0x161c26,
  envIntensity: 0.76,
};

const PALETTE_DUSK: TodPalette = {
  sunColor: 0xff8b4d,
  sunIntensity: 1.75,
  hemiSky: 0xb07ca8,
  hemiGround: 0x2d2436,
  hemiIntensity: 0.68,
  rimColor: 0xfb923c,
  rimIntensity: 0.74,
  fogColor: 0xb97b74,
  fogDensity: 0.0102,
  mistColor: 0xe39e86,
  shaftColor: 0xff9a5c,
  exposure: 1.04,
  contrast: 1.07,
  saturation: 1.12,
  warmTint: [1.16, 0.99, 0.9],
  coolTint: [0.9, 0.84, 1.08],
  bloomStrength: 0.46,
  outlineColor: 0x20131d,
  envIntensity: 0.44,
};

function sampleTodPalette(tod: number): { palette: TodPalette; label: AtmosphereComputedState['todLabel'] } {
  const t = ((tod % 1) + 1) % 1;
  // 0.00 Night -> 0.25 Dawn -> 0.50 Day -> 0.75 Dusk -> 1.00 Night
  let a: TodPalette;
  let b: TodPalette;
  let k: number;
  if (t < 0.25) {
    a = PALETTE_NIGHT;
    b = PALETTE_DAWN;
    k = t / 0.25;
  } else if (t < 0.5) {
    a = PALETTE_DAWN;
    b = PALETTE_DAY;
    k = (t - 0.25) / 0.25;
  } else if (t < 0.75) {
    a = PALETTE_DAY;
    b = PALETTE_DUSK;
    k = (t - 0.5) / 0.25;
  } else {
    a = PALETTE_DUSK;
    b = PALETTE_NIGHT;
    k = (t - 0.75) / 0.25;
  }

  const label: AtmosphereComputedState['todLabel'] =
    t >= 0.19 && t < 0.35
      ? 'Dawn'
      : t >= 0.35 && t < 0.67
        ? 'Daylight'
        : t >= 0.67 && t < 0.84
          ? 'Dusk'
          : 'Starlight';

  return {
    label,
    palette: {
      sunColor: lerpHex(a.sunColor, b.sunColor, k),
      sunIntensity: lerp(a.sunIntensity, b.sunIntensity, k),
      hemiSky: lerpHex(a.hemiSky, b.hemiSky, k),
      hemiGround: lerpHex(a.hemiGround, b.hemiGround, k),
      hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, k),
      rimColor: lerpHex(a.rimColor, b.rimColor, k),
      rimIntensity: lerp(a.rimIntensity, b.rimIntensity, k),
      fogColor: lerpHex(a.fogColor, b.fogColor, k),
      fogDensity: lerp(a.fogDensity, b.fogDensity, k),
      mistColor: lerpHex(a.mistColor, b.mistColor, k),
      shaftColor: lerpHex(a.shaftColor, b.shaftColor, k),
      exposure: lerp(a.exposure, b.exposure, k),
      contrast: lerp(a.contrast, b.contrast, k),
      saturation: lerp(a.saturation, b.saturation, k),
      warmTint: lerpTuple3(a.warmTint, b.warmTint, k),
      coolTint: lerpTuple3(a.coolTint, b.coolTint, k),
      bloomStrength: lerp(a.bloomStrength, b.bloomStrength, k),
      outlineColor: lerpHex(a.outlineColor, b.outlineColor, k),
      envIntensity: lerp(a.envIntensity, b.envIntensity, k),
    },
  };
}

export function computeAtmosphereState(
  todNormalized: number,
  resolvedWeather: ResolvedWeather,
  prevSurface: SurfaceAccumulationState,
  dt: number,
  riftShrinesCount = 1,
  snapInstant = false,
): AtmosphereComputedState {
  const { palette, label } = sampleTodPalette(todNormalized);

  const targetWet = resolvedWeather === 'rain' ? 1 : 0;
  const targetSnow = resolvedWeather === 'snow' ? 1 : 0;
  // Base ambient corruption in world rises when Rift shrines are held or Corruption weather is active
  const baseRiftAura = clamp01(riftShrinesCount * 0.14);
  const targetCorrupt = resolvedWeather === 'corruption' ? 1 : baseRiftAura;

  const rate = snapInstant || dt <= 0 ? 1 : 1 - Math.exp(-1.9 * dt);
  const surface: SurfaceAccumulationState = {
    wetness: clamp01(lerp(prevSurface.wetness, targetWet, rate)),
    snow: clamp01(lerp(prevSurface.snow, targetSnow, rate)),
    corruption: clamp01(lerp(prevSurface.corruption, targetCorrupt, rate)),
  };

  // Sun orbital position: zenith at tod=0.5, horizon at 0.22 / 0.78, moonlight arc at night
  const daylightSin = Math.sin((todNormalized - 0.25) * Math.PI * 2);
  const sunElevationRad =
    daylightSin >= -0.05
      ? THREE_CLAMP(0.14 + Math.max(0, daylightSin) * 0.95, 0.14, 1.15)
      : THREE_CLAMP(0.28 + Math.abs(daylightSin) * 0.45, 0.25, 0.78);
  const sunAzimuthRad = 0.55 + todNormalized * Math.PI * 1.45;
  const cosEl = Math.cos(sunElevationRad);
  const sunDirection: [number, number, number] = [
    Math.sin(sunAzimuthRad) * cosEl,
    Math.sin(sunElevationRad),
    Math.cos(sunAzimuthRad) * cosEl,
  ];

  // Weather atmospheric shifts
  let fogColor = palette.fogColor;
  let fogDensity = palette.fogDensity;
  let mistColor = palette.mistColor;
  let mistOpacity = 0.22;
  let shaftColor = palette.shaftColor;
  let shaftIntensity = label === 'Dawn' || label === 'Dusk' ? 0.55 : label === 'Daylight' ? 0.34 : 0.25;
  let sunIntensity = palette.sunIntensity;
  let sunColor = palette.sunColor;
  let hemiSkyColor = palette.hemiSky;
  let envIntensity = palette.envIntensity;
  let skyTurbidity = label === 'Dawn' || label === 'Dusk' ? 9.5 : 5.2;
  let skyRayleigh = label === 'Dawn' || label === 'Dusk' ? 2.8 : label === 'Starlight' ? 0.65 : 1.65;
  let bloomStrength = palette.bloomStrength;
  let bloomThreshold = 0.78;
  let contrast = palette.contrast;
  let saturation = palette.saturation;
  let warmTint = palette.warmTint;
  let coolTint = palette.coolTint;
  let vignetteDarkness = 0.34;
  let waterShallowColor = 0x268ca8;
  let waterDeepColor = 0x0e3b56;
  let waterFoamColor = 0xdff5ff;

  if (surface.wetness > 0.01) {
    const w = surface.wetness;
    fogColor = lerpHex(fogColor, 0x56697d, w * 0.72);
    fogDensity = lerp(fogDensity, 0.0135, w);
    mistColor = lerpHex(mistColor, 0x8ea4ba, w * 0.75);
    mistOpacity = lerp(mistOpacity, 0.34, w);
    sunIntensity = lerp(sunIntensity, sunIntensity * 0.65, w);
    envIntensity = lerp(envIntensity, envIntensity * 0.72, w);
    hemiSkyColor = lerpHex(hemiSkyColor, 0x677d96, w * 0.6);
    skyTurbidity = lerp(skyTurbidity, 14.0, w);
    shaftIntensity = lerp(shaftIntensity, 0.16, w);
    saturation = lerp(saturation, 0.88, w);
    contrast = lerp(contrast, 1.1, w);
    coolTint = lerpTuple3(coolTint, [0.85, 0.95, 1.12], w);
    waterShallowColor = lerpHex(waterShallowColor, 0x29566e, w);
    waterDeepColor = lerpHex(waterDeepColor, 0x0c2130, w);
    vignetteDarkness = lerp(vignetteDarkness, 0.48, w);
  }

  if (surface.snow > 0.01) {
    const s = surface.snow;
    fogColor = lerpHex(fogColor, 0xc7d9eb, s * 0.75);
    fogDensity = lerp(fogDensity, 0.012, s);
    mistColor = lerpHex(mistColor, 0xe8f3fc, s * 0.8);
    mistOpacity = lerp(mistOpacity, 0.30, s);
    hemiSkyColor = lerpHex(hemiSkyColor, 0xd4e6f7, s * 0.65);
    sunColor = lerpHex(sunColor, 0xe8f1ff, s * 0.5);
    envIntensity = lerp(envIntensity, Math.max(envIntensity, 0.62), s);
    saturation = lerp(saturation, 0.84, s);
    coolTint = lerpTuple3(coolTint, [0.92, 0.99, 1.14], s);
    waterShallowColor = lerpHex(waterShallowColor, 0x5c9db8, s);
    waterDeepColor = lerpHex(waterDeepColor, 0x1b4666, s);
    waterFoamColor = lerpHex(waterFoamColor, 0xf4fbff, s);
  }

  if (surface.corruption > 0.18) {
    const c = clamp01((surface.corruption - 0.15) / 0.85);
    fogColor = lerpHex(fogColor, 0x3b214f, c * 0.72);
    fogDensity = lerp(fogDensity, 0.013, c);
    mistColor = lerpHex(mistColor, 0x9b5de5, c * 0.75);
    mistOpacity = lerp(mistOpacity, 0.34, c);
    shaftColor = lerpHex(shaftColor, 0xd946ef, c * 0.75);
    shaftIntensity = lerp(shaftIntensity, 0.52, c);
    envIntensity = lerp(envIntensity, envIntensity * 0.55, c);
    bloomStrength = lerp(bloomStrength, 0.62, c);
    bloomThreshold = lerp(bloomThreshold, 0.68, c);
    warmTint = lerpTuple3(warmTint, [1.12, 0.88, 1.18], c);
    coolTint = lerpTuple3(coolTint, [0.9, 0.78, 1.2], c);
    waterShallowColor = lerpHex(waterShallowColor, 0x7c3aed, c * 0.65);
    waterDeepColor = lerpHex(waterDeepColor, 0x1e0b36, c * 0.8);
    waterFoamColor = lerpHex(waterFoamColor, 0xf0abfc, c * 0.75);
    vignetteDarkness = lerp(vignetteDarkness, 0.52, c);
  }

  return {
    todNormalized,
    todLabel: label,
    resolvedWeather,
    sunElevationRad,
    sunAzimuthRad,
    sunDirection,
    skyTurbidity,
    skyRayleigh,
    sunColor,
    sunIntensity,
    hemiSkyColor,
    hemiGroundColor: palette.hemiGround,
    hemiIntensity: palette.hemiIntensity,
    rimColor: palette.rimColor,
    rimIntensity: palette.rimIntensity,
    envIntensity,
    fogColor,
    fogDensity,
    mistColor,
    mistOpacity,
    shaftColor,
    shaftIntensity,
    waterShallowColor,
    waterDeepColor,
    waterFoamColor,
    surface,
    bloomStrength,
    bloomRadius: 0.42,
    bloomThreshold,
    outlineStrength: resolvedWeather === 'corruption' ? 0.52 : 0.42,
    outlineColor: palette.outlineColor,
    exposure: palette.exposure,
    contrast,
    saturation,
    warmTint,
    coolTint,
    vignetteDarkness,
  };
}

function THREE_CLAMP(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
