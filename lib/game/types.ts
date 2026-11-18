export type HeroClass = 'vanguard' | 'arcanist' | 'ranger';

export type EnemyArchetype = 'stalker' | 'acolyte' | 'colossus' | 'warden' | 'thief' | 'batras';

export type EnemyAiPhase = 'patrol' | 'approach' | 'kite' | 'windup' | 'active' | 'recover' | 'ko';

export type CombatStance = 'heavy' | 'balanced' | 'swift';
export type WeaponOilKind = 'none' | 'barrowbane' | 'flame_resin' | 'serpent_venom';
export type ArblastBoltKind = 'standard' | 'fire' | 'poison';
export type MountedManeuverKind = 'dash' | 'turn' | 'spin';
export type PhilosophicalPath = 'athelstane' | 'graymstrum';

export interface PlayerPhilosophyState {
  athelstaneAffinity: number;
  graymstrumAffinity: number;
  activeStance: CombatStance;
  mounted: boolean;
  stamina: number;
  maxStamina: number;
  weaponOil: WeaponOilKind;
  oilCharges: number;
  arblastBolt: ArblastBoltKind;
  boltAmmo: number;
  whetstoneExpiresAt: number;
  potentialScore: number;
  resolvedDilemmas: string[];
  pathAbilityCooldowns: Record<string, number>;
  maneuverCooldown: number;
}

export type CompanionId =
  | 'graymstrum'
  | 'haft'
  | 'worgen'
  | 'krydon'
  | 'hellas'
  | 'rykker'
  | 'proudis';

export type CompanionActionKind =
  | 'escort'
  | 'synthesizing'
  | 'triage'
  | 'cleave'
  | 'swarm_flank'
  | 'volley'
  | 'cavalry_charge';

export interface CompanionState {
  id: CompanionId;
  name: string;
  title: string;
  role: 'Tactician' | 'Veteran Tank' | 'Wild Card' | 'Outrider' | 'Cavalry Flanker';
  x: number;
  z: number;
  facing: number;
  hp: number;
  maxHp: number;
  mounted: boolean;
  action: CompanionActionKind;
  cooldown: number;
  swarmDecisionTimer: number;
  swarmMode: 'attack' | 'flank' | 'evade' | 'taunt';
  accentColor: string;
}

export interface SnapshotCompanion {
  id: CompanionId;
  name: string;
  title: string;
  role: CompanionState['role'];
  x: number;
  z: number;
  facing: number;
  hp: number;
  maxHp: number;
  mounted: boolean;
  action: CompanionActionKind;
  accentColor: string;
}

export interface TacticalAdvice {
  speaker: string;
  headline: string;
  cue: string;
  recommendedStance: CombatStance;
  threatLevel: 'calm' | 'caution' | 'ambush' | 'critical';
  crowAlert: boolean;
  nearbyEnemies: number;
  hiddenAmbushers: number;
}

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type Rarity = 'common' | 'rare' | 'epic' | 'relic';

export type HeroBodyType = 'lithe' | 'balanced' | 'titan';
export type HeroFaceStyle = 'noble' | 'scarred' | 'painted' | 'masked';
export type HeroEyeGlow = 'gold' | 'cyan' | 'emerald' | 'crimson' | 'violet';
export type HeroHairStyle = 'swept' | 'braided' | 'crest' | 'long' | 'hooded';
export type HeroOutfitStyle =
  | 'sanctuary'
  | 'warden'
  | 'astral'
  | 'nomad'
  | 'wolfguard'
  | 'ironbound'
  | 'ashstalker';
export type HeroCloakStyle = 'standard' | 'wolfskin' | 'frostwolf' | 'ragged_ash';
export type HeroWeaponSkin = 'standard' | 'ashen_fang' | 'runeblade' | 'stormcaller';

export interface HeroAppearance {
  bodyType: HeroBodyType;
  skinTone: string;
  faceStyle: HeroFaceStyle;
  eyeGlow: HeroEyeGlow;
  hairStyle: HeroHairStyle;
  hairColor: string;
  outfitStyle: HeroOutfitStyle;
  outfitTint: string;
  cloakStyle: HeroCloakStyle;
  weaponSkin: HeroWeaponSkin;
}

export type CosmeticCategory = 'cloak' | 'armor' | 'weapon';

export interface CosmeticCatalogItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  description: string;
  goldPrice: number;
  usdPrice: string;
  rarity: Rarity;
  statNote: 'Cosmetic Only';
  outfitStyle?: HeroOutfitStyle;
  cloakStyle?: HeroCloakStyle;
  weaponSkin?: HeroWeaponSkin;
  battlePassSource?: string;
}

export type RewardedAdKind = 'swiftness' | 'fury' | 'tribute';

export interface RewardedAdOffer {
  kind: RewardedAdKind;
  title: string;
  benefitLabel: string;
  durationSec: number;
  cooldownSec: number;
  accentColor: string;
}

export interface ActiveAdBuff {
  kind: Exclude<RewardedAdKind, 'tribute'>;
  label: string;
  expiresAt: number;
}

export interface BattlePassRewardEntry {
  kind: 'gold' | 'potions' | 'cosmetic';
  label: string;
  amount?: number;
  cosmeticId?: string;
}

export interface BattlePassTierDef {
  tier: number;
  xpRequired: number;
  freeReward: BattlePassRewardEntry;
  premiumReward: BattlePassRewardEntry;
}

export interface PlayerMonetizationState {
  unlockedCosmetics: string[];
  battlePassPremium: boolean;
  battlePassXp: number;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
  activeAdBuffs: ActiveAdBuff[];
  lastAdClaimAt: number;
  adsWatchedCount: number;
}

export type QuestCategory = 'main' | 'side' | 'daily' | 'weekly';
export type QuestStatus = 'active' | 'completed' | 'claimed';
export type QuestObjectiveKind =
  | 'kill_any'
  | 'kill_archetype'
  | 'kill_boss'
  | 'capture_shrine'
  | 'collect_loot'
  | 'visit_zone'
  | 'world_event';

export interface QuestReward {
  xp: number;
  gold: number;
  potions?: number;
  relic?: {
    itemKey: string;
    name: string;
    rarity: Rarity;
    slotType: 'weapon' | 'charm';
    power: number;
  };
}

export interface QuestDefinition {
  id: string;
  category: QuestCategory;
  chapterLabel: string;
  title: string;
  description: string;
  objectiveLabel: string;
  objectiveKind: QuestObjectiveKind;
  targetArchetype?: EnemyArchetype;
  targetZone?: string;
  targetCount: number;
  prerequisiteQuestId?: string;
  targetX: number;
  targetZ: number;
  reward: QuestReward;
}

export interface QuestProgress {
  questId: string;
  category: QuestCategory;
  status: QuestStatus;
  progress: number;
  targetCount: number;
  periodKey: string;
  updatedAt: number;
}

export type DynamicWorldEventKind = 'invasion' | 'tempest' | 'dungeon_rift' | 'barrow_ambush';
export type DynamicWorldEventStatus = 'active' | 'completed' | 'expired';

export interface DynamicWorldEventState {
  id: string;
  kind: DynamicWorldEventKind;
  title: string;
  subtitle: string;
  zoneName: string;
  x: number;
  z: number;
  radius: number;
  progress: number;
  goal: number;
  startedAt: number;
  expiresAt: number;
  status: DynamicWorldEventStatus;
  participantScores: Record<string, { name: string; score: number }>;
  weatherHint: 'rain' | 'corruption' | 'clear';
  rewardLabel: string;
  ambushPhase?: 1 | 2 | 3;
  whistleTriggered?: boolean;
}

export interface InventoryItem {
  id: string;
  itemKey: string;
  name: string;
  rarity: Rarity;
  slotType: 'weapon' | 'charm' | 'consumable';
  quantity: number;
  power: number;
}

export interface SkillDef {
  index: 0 | 1 | 2;
  keyLabel: string;
  name: string;
  role: string;
  manaCost: number;
  cooldown: number;
  range: number;
  radius: number;
  baseDamage: number;
  kind: 'cleave' | 'bolt' | 'nova' | 'volley' | 'snare' | 'shockwave';
  color: string;
}

export interface ClassSpec {
  id: HeroClass;
  name: string;
  title: string;
  summary: string;
  accentColor: string;
  baseHp: number;
  baseMana: number;
  moveSpeed: number;
  skills: [SkillDef, SkillDef, SkillDef];
}

export interface PlayerInputState {
  moveX: number;
  moveZ: number;
  waypointX: number | null;
  waypointZ: number | null;
}

export interface PlayerState {
  id: string;
  name: string;
  heroClass: HeroClass;
  appearance: HeroAppearance;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  gold: number;
  kills: number;
  potions: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  cooldowns: [number, number, number];
  dashCooldown: number;
  dashTimer: number;
  dashDirX: number;
  dashDirZ: number;
  castFlashTimer: number;
  castSkillIndex: number;
  hurtTimer: number;
  invulnTimer: number;
  alive: boolean;
  respawnTimer: number;
  targetEnemyId: string | null;
  weaponPower: number;
  charmPower: number;
  input: PlayerInputState;
  inventory: InventoryItem[];
  quests: QuestProgress[];
  trackedQuestId: string | null;
  visitedZones: string[];
  monetization: PlayerMonetizationState;
  philosophy: PlayerPhilosophyState;
  lastHitTime: number;
}

export interface EnemyState {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  level: number;
  isBoss: boolean;
  eventId?: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  impulseX: number;
  impulseZ: number;
  stunTimer: number;
  homeX: number;
  homeZ: number;
  facing: number;
  hp: number;
  maxHp: number;
  phase: EnemyAiPhase;
  phaseTimer: number;
  koTimer: number;
  respawnTimer: number;
  attackCooldown: number;
  telegraphX: number;
  telegraphZ: number;
  telegraphRadius: number;
  telegraphKind: 'cone' | 'ring' | 'line' | 'bolt';
  targetPlayerId: string | null;
  hurtFlash: number;
  orbitSign: number;
  hiddenInCover?: boolean;
  aiRole?: 'skulk' | 'assault' | 'ranged' | 'retreat' | 'commander';
}

export interface ShrineState {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  controllingFaction: 'solis' | 'rift' | 'neutral';
  captureProgress: number; // -100 (rift) to +100 (solis)
  buffLabel: string;
}

export interface LootDrop {
  id: string;
  x: number;
  z: number;
  kind: 'gold' | 'potion' | 'relic';
  itemKey: string;
  name: string;
  rarity: Rarity;
  power: number;
  amount: number;
  ttl: number;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  fromEnemy: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  ttl: number;
  color: string;
  slowSeconds: number;
}

export interface WorldEffectEvent {
  id: string;
  kind:
    | 'slash'
    | 'nova'
    | 'volley'
    | 'bolt_hit'
    | 'dash'
    | 'level_up'
    | 'shrine_capture'
    | 'damage'
    | 'heal'
    | 'loot'
    | 'quest_complete'
    | 'world_event'
    | 'lightning'
    | 'roar'
    | 'whistle'
    | 'crow_alert'
    | 'whetstone';
  x: number;
  y: number;
  z: number;
  angle?: number;
  radius?: number;
  color: string;
  value?: number;
  label?: string;
  targetId?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  heroClass?: HeroClass | 'system';
  text: string;
  createdAt: number;
}

export interface WorldObstacle {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  kind: 'pillar' | 'boulder' | 'obelisk' | 'tree' | 'barrow' | 'copse';
}

export interface SnapshotPlayer {
  id: string;
  name: string;
  heroClass: HeroClass;
  appearance: HeroAppearance;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  gold: number;
  kills: number;
  potions: number;
  x: number;
  z: number;
  facing: number;
  cooldowns: [number, number, number];
  dashCooldown: number;
  dashTimer: number;
  castFlashTimer: number;
  castSkillIndex: number;
  hurtTimer: number;
  alive: boolean;
  targetEnemyId: string | null;
  waypointX: number | null;
  waypointZ: number | null;
  weaponPower: number;
  charmPower: number;
  trackedQuestId?: string | null;
  activeBuffs?: ActiveAdBuff[];
  inventory?: InventoryItem[];
  activeStance?: CombatStance;
  mounted?: boolean;
  stamina?: number;
  maxStamina?: number;
  weaponOil?: WeaponOilKind;
  oilCharges?: number;
  arblastBolt?: ArblastBoltKind;
  boltAmmo?: number;
  whetstoneActive?: boolean;
  potentialScore?: number;
}

export interface SnapshotEnemy {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  level: number;
  isBoss: boolean;
  eventId?: string;
  x: number;
  z: number;
  facing: number;
  hp: number;
  maxHp: number;
  phase: EnemyAiPhase;
  phaseTimer: number;
  telegraphX: number;
  telegraphZ: number;
  telegraphRadius: number;
  telegraphKind: 'cone' | 'ring' | 'line' | 'bolt';
  hurtFlash: number;
  hiddenInCover?: boolean;
  aiRole?: EnemyState['aiRole'];
}

export interface WorldSnapshot {
  serverTime: number;
  onlineCount: number;
  dbMode: 'turso-cloud' | 'turso-replica' | 'libsql-local';
  players: SnapshotPlayer[];
  enemies: SnapshotEnemy[];
  companions: SnapshotCompanion[];
  shrines: ShrineState[];
  loot: LootDrop[];
  projectiles: ProjectileState[];
  events: WorldEffectEvent[];
  dynamicEvent: DynamicWorldEventState | null;
  nextEventInSec: number;
  tacticalAdvice: TacticalAdvice;
}

export type PrepCampAction =
  | { kind: 'whetstone' }
  | { kind: 'apply_oil'; oil: Exclude<WeaponOilKind, 'none'> }
  | { kind: 'craft_bolts'; bolt: Exclude<ArblastBoltKind, 'standard'> }
  | { kind: 'field_triage' };

export type ClientMessage =
  | {
      type: 'join';
      playerId: string;
      name: string;
      heroClass: HeroClass;
      appearance?: HeroAppearance;
    }
  | { type: 'update_appearance'; appearance: HeroAppearance }
  | { type: 'input'; moveX: number; moveZ: number; waypointX: number | null; waypointZ: number | null }
  | { type: 'cast'; skillIndex: 0 | 1 | 2; aimX: number; aimZ: number; targetEnemyId?: string | null }
  | { type: 'dash'; dirX: number; dirZ: number }
  | { type: 'target'; enemyId: string | null }
  | { type: 'use_potion' }
  | { type: 'equip_item'; itemId: string }
  | { type: 'claim_quest'; questId: string }
  | { type: 'track_quest'; questId: string | null }
  | { type: 'trigger_world_event'; kind?: DynamicWorldEventKind }
  | { type: 'set_stance'; stance: CombatStance }
  | { type: 'toggle_mount' }
  | { type: 'mounted_maneuver'; maneuver: MountedManeuverKind; dirX?: number; dirZ?: number }
  | { type: 'prepare_camp'; action: PrepCampAction }
  | { type: 'philosophical_choice'; dilemmaId: string; optionId: string }
  | { type: 'use_path_ability'; abilityId: string }
  | { type: 'purchase_cosmetic'; itemId: string; method: 'gold' | 'direct'; autoEquip?: boolean }
  | { type: 'activate_battle_pass'; method: 'gold' | 'subscription' }
  | { type: 'claim_pass_tier'; tier: number; track: 'free' | 'premium' }
  | { type: 'claim_ad_reward'; kind: RewardedAdKind }
  | { type: 'respawn' }
  | { type: 'chat'; text: string };

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      dbMode: 'turso-cloud' | 'turso-replica' | 'libsql-local';
      chatHistory: ChatMessage[];
      inventory: InventoryItem[];
      quests: QuestProgress[];
      trackedQuestId: string | null;
      appearance: HeroAppearance;
      monetization: PlayerMonetizationState;
      philosophy: PlayerPhilosophyState;
    }
  | { type: 'snapshot'; data: WorldSnapshot }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'inventory'; items: InventoryItem[] }
  | { type: 'quests'; quests: QuestProgress[]; trackedQuestId: string | null }
  | {
      type: 'philosophy';
      philosophy: PlayerPhilosophyState;
      notice?: string;
    }
  | {
      type: 'monetization';
      monetization: PlayerMonetizationState;
      appearance?: HeroAppearance;
      notice?: string;
    };
