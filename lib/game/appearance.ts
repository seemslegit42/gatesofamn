import type {
  HeroAppearance,
  HeroBodyType,
  HeroClass,
  HeroCloakStyle,
  HeroEyeGlow,
  HeroFaceStyle,
  HeroHairStyle,
  HeroOutfitStyle,
  HeroWeaponSkin,
} from './types.ts';

export const BODY_TYPE_OPTIONS: { id: HeroBodyType; label: string; summary: string }[] = [
  { id: 'lithe', label: 'Lithe', summary: 'Agile, narrow frame' },
  { id: 'balanced', label: 'Balanced', summary: 'Classic adventurer build' },
  { id: 'titan', label: 'Titan', summary: 'Broad, imposing stature' },
];

export const FACE_STYLE_OPTIONS: { id: HeroFaceStyle; label: string }[] = [
  { id: 'noble', label: 'Noble' },
  { id: 'scarred', label: 'Scarred' },
  { id: 'painted', label: 'Warpaint' },
  { id: 'masked', label: 'Half-Mask' },
];

export const EYE_GLOW_OPTIONS: { id: HeroEyeGlow; label: string; hex: string }[] = [
  { id: 'gold', label: 'Solar Gold', hex: '#fde047' },
  { id: 'cyan', label: 'Astral Cyan', hex: '#38bdf8' },
  { id: 'emerald', label: 'Verdant', hex: '#34d399' },
  { id: 'crimson', label: 'Ember', hex: '#fb7185' },
  { id: 'violet', label: 'Rift Violet', hex: '#c084fc' },
];

export const HAIR_STYLE_OPTIONS: { id: HeroHairStyle; label: string }[] = [
  { id: 'swept', label: 'Swept Crown' },
  { id: 'braided', label: 'Twin Braids' },
  { id: 'crest', label: 'War Crest' },
  { id: 'long', label: 'Flowing Mane' },
  { id: 'hooded', label: 'Warden Hood' },
];

export const OUTFIT_STYLE_OPTIONS: {
  id: HeroOutfitStyle;
  label: string;
  summary: string;
  cosmeticId?: string;
}[] = [
  { id: 'sanctuary', label: 'Sanctuary Plate', summary: 'Layered mantle & brass pauldrons' },
  { id: 'warden', label: 'Sunwarden', summary: 'Crested chestguard & heavy cloak' },
  { id: 'astral', label: 'Astral Vestment', summary: 'Runed shoulder fins & flowing sash' },
  { id: 'nomad', label: 'Gale Scout', summary: 'Asymmetric cape & leather harness' },
  {
    id: 'wolfguard',
    label: 'Wolfguard Brigandine',
    summary: 'Riveted iron & wolf-fur pauldrons',
    cosmeticId: 'armor_wolfguard',
  },
  {
    id: 'ashstalker',
    label: 'Ashstalker Leathers',
    summary: 'Scarred hide harness & twin sheaths',
    cosmeticId: 'armor_ashstalker',
  },
  {
    id: 'ironbound',
    label: 'Ironbound Dreadplate',
    summary: 'Spiked darkforge gorget & siege plates',
    cosmeticId: 'armor_ironbound',
  },
];

export const CLOAK_STYLE_OPTIONS: {
  id: HeroCloakStyle;
  label: string;
  summary: string;
  cosmeticId?: string;
}[] = [
  { id: 'standard', label: 'Class Mantle', summary: 'Standard dyed campaign drape' },
  {
    id: 'wolfskin',
    label: 'Timberwolf Pelt',
    summary: 'Thick timberwolf fur ruff & iron clasp',
    cosmeticId: 'cloak_wolfskin',
  },
  {
    id: 'frostwolf',
    label: 'Frostwolf Alpha',
    summary: 'Pale highland wolf mantle & silver pins',
    cosmeticId: 'cloak_frostwolf',
  },
  {
    id: 'ragged_ash',
    label: 'Ashen Marauder',
    summary: 'Frayed charcoal shroud from cinder rifts',
    cosmeticId: 'cloak_ragged_ash',
  },
];

export const WEAPON_SKIN_OPTIONS: {
  id: HeroWeaponSkin;
  label: string;
  summary: string;
  cosmeticId?: string;
}[] = [
  { id: 'standard', label: 'Sanctuary Forged', summary: 'Standard guild armament' },
  {
    id: 'ashen_fang',
    label: 'Ashen Fang',
    summary: 'Serrated darkforge & bone silhouette',
    cosmeticId: 'wpn_ashen_fang',
  },
  {
    id: 'runeblade',
    label: 'Solis Runeforge',
    summary: 'Amber rune-etched core & flared guard',
    cosmeticId: 'wpn_runeblade',
  },
  {
    id: 'stormcaller',
    label: 'Stormcaller',
    summary: 'Tempest steel & azure conduit crest',
    cosmeticId: 'wpn_stormcaller',
  },
];

export const SKIN_TONE_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Alabaster', hex: '#f2c9ac' },
  { label: 'Sunlit', hex: '#e0ac84' },
  { label: 'Bronze', hex: '#c68b60' },
  { label: 'Umber', hex: '#9b6442' },
  { label: 'Obsidian', hex: '#68412b' },
  { label: 'Starborn', hex: '#9fb3c8' },
];

export const HAIR_COLOR_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Raven', hex: '#1d222e' },
  { label: 'Chestnut', hex: '#633d28' },
  { label: 'Sunburst', hex: '#dfb04f' },
  { label: 'Crimson', hex: '#b63e31' },
  { label: 'Silverwind', hex: '#e5ebf3' },
  { label: 'Aether Blue', hex: '#38bdf8' },
];

export const OUTFIT_TINT_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Solis Amber', hex: '#c27b2a' },
  { label: 'Astral Cobalt', hex: '#225a94' },
  { label: 'Verdant Moss', hex: '#266c4c' },
  { label: 'Crimson Ash', hex: '#8f2d3b' },
  { label: 'Obsidian Dusk', hex: '#43386b' },
];

export function getDefaultAppearance(heroClass: HeroClass): HeroAppearance {
  if (heroClass === 'arcanist') {
    return {
      bodyType: 'lithe',
      skinTone: '#e0ac84',
      faceStyle: 'painted',
      eyeGlow: 'cyan',
      hairStyle: 'long',
      hairColor: '#e5ebf3',
      outfitStyle: 'astral',
      outfitTint: '#225a94',
      cloakStyle: 'standard',
      weaponSkin: 'standard',
    };
  }
  if (heroClass === 'ranger') {
    return {
      bodyType: 'balanced',
      skinTone: '#c68b60',
      faceStyle: 'masked',
      eyeGlow: 'emerald',
      hairStyle: 'hooded',
      hairColor: '#633d28',
      outfitStyle: 'nomad',
      outfitTint: '#266c4c',
      cloakStyle: 'standard',
      weaponSkin: 'standard',
    };
  }
  return {
    bodyType: 'titan',
    skinTone: '#e0ac84',
    faceStyle: 'scarred',
    eyeGlow: 'gold',
    hairStyle: 'crest',
    hairColor: '#dfb04f',
    outfitStyle: 'sanctuary',
    outfitTint: '#c27b2a',
    cloakStyle: 'standard',
    weaponSkin: 'standard',
  };
}

const VALID_BODIES = new Set<HeroBodyType>(['lithe', 'balanced', 'titan']);
const VALID_FACES = new Set<HeroFaceStyle>(['noble', 'scarred', 'painted', 'masked']);
const VALID_EYES = new Set<HeroEyeGlow>(['gold', 'cyan', 'emerald', 'crimson', 'violet']);
const VALID_HAIRS = new Set<HeroHairStyle>(['swept', 'braided', 'crest', 'long', 'hooded']);
const VALID_OUTFITS = new Set<HeroOutfitStyle>([
  'sanctuary',
  'warden',
  'astral',
  'nomad',
  'wolfguard',
  'ironbound',
  'ashstalker',
]);
const VALID_CLOAKS = new Set<HeroCloakStyle>(['standard', 'wolfskin', 'frostwolf', 'ragged_ash']);
const VALID_WEAPONS = new Set<HeroWeaponSkin>(['standard', 'ashen_fang', 'runeblade', 'stormcaller']);

function safeHex(input: unknown, fallback: string): string {
  if (typeof input === 'string' && /^#[0-9a-fA-F]{6}$/.test(input)) {
    return input.toLowerCase();
  }
  return fallback;
}

export function sanitizeAppearance(
  raw: Partial<HeroAppearance> | null | undefined,
  heroClass: HeroClass,
): HeroAppearance {
  const def = getDefaultAppearance(heroClass);
  if (!raw || typeof raw !== 'object') return def;

  return {
    bodyType: VALID_BODIES.has(raw.bodyType as HeroBodyType) ? (raw.bodyType as HeroBodyType) : def.bodyType,
    skinTone: safeHex(raw.skinTone, def.skinTone),
    faceStyle: VALID_FACES.has(raw.faceStyle as HeroFaceStyle) ? (raw.faceStyle as HeroFaceStyle) : def.faceStyle,
    eyeGlow: VALID_EYES.has(raw.eyeGlow as HeroEyeGlow) ? (raw.eyeGlow as HeroEyeGlow) : def.eyeGlow,
    hairStyle: VALID_HAIRS.has(raw.hairStyle as HeroHairStyle) ? (raw.hairStyle as HeroHairStyle) : def.hairStyle,
    hairColor: safeHex(raw.hairColor, def.hairColor),
    outfitStyle: VALID_OUTFITS.has(raw.outfitStyle as HeroOutfitStyle)
      ? (raw.outfitStyle as HeroOutfitStyle)
      : def.outfitStyle,
    outfitTint: safeHex(raw.outfitTint, def.outfitTint),
    cloakStyle: VALID_CLOAKS.has(raw.cloakStyle as HeroCloakStyle)
      ? (raw.cloakStyle as HeroCloakStyle)
      : def.cloakStyle,
    weaponSkin: VALID_WEAPONS.has(raw.weaponSkin as HeroWeaponSkin)
      ? (raw.weaponSkin as HeroWeaponSkin)
      : def.weaponSkin,
  };
}

export function randomizeAppearance(seedOffset = 0, unlockedOutfits?: HeroOutfitStyle[]): HeroAppearance {
  const pick = <T,>(arr: T[], idx: number): T => arr[Math.abs(idx) % arr.length];
  const r = () => Math.floor(Math.random() * 1000) + seedOffset;
  const outfitPool = unlockedOutfits
    ? OUTFIT_STYLE_OPTIONS.filter((o) => !o.cosmeticId || unlockedOutfits.includes(o.id))
    : OUTFIT_STYLE_OPTIONS.filter((o) => !o.cosmeticId);
  return {
    bodyType: pick(BODY_TYPE_OPTIONS, r()).id,
    skinTone: pick(SKIN_TONE_SWATCHES, r()).hex,
    faceStyle: pick(FACE_STYLE_OPTIONS, r()).id,
    eyeGlow: pick(EYE_GLOW_OPTIONS, r()).id,
    hairStyle: pick(HAIR_STYLE_OPTIONS, r()).id,
    hairColor: pick(HAIR_COLOR_SWATCHES, r()).hex,
    outfitStyle: pick(outfitPool.length > 0 ? outfitPool : OUTFIT_STYLE_OPTIONS, r()).id,
    outfitTint: pick(OUTFIT_TINT_SWATCHES, r()).hex,
    cloakStyle: 'standard',
    weaponSkin: 'standard',
  };
}

export function getEyeGlowHex(eyeGlow: HeroEyeGlow): number {
  const found = EYE_GLOW_OPTIONS.find((e) => e.id === eyeGlow);
  return found ? Number.parseInt(found.hex.slice(1), 16) : 0xfde047;
}
