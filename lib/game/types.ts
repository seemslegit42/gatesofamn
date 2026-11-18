export type HeroClass = 'vanguard' | 'arcanist' | 'ranger';

export type EnemyArchetype = 'stalker' | 'acolyte' | 'colossus' | 'warden';

export type EnemyAiPhase = 'patrol' | 'approach' | 'kite' | 'windup' | 'active' | 'recover' | 'ko';

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type Rarity = 'common' | 'rare' | 'epic' | 'relic';

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
  lastHitTime: number;
}

export interface EnemyState {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  level: number;
  isBoss: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
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
  kind: 'slash' | 'nova' | 'volley' | 'bolt_hit' | 'dash' | 'level_up' | 'shrine_capture' | 'damage' | 'heal' | 'loot';
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
  kind: 'pillar' | 'boulder' | 'obelisk' | 'tree';
}

export interface SnapshotPlayer {
  id: string;
  name: string;
  heroClass: HeroClass;
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
  inventory?: InventoryItem[];
}

export interface SnapshotEnemy {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  level: number;
  isBoss: boolean;
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
}

export interface WorldSnapshot {
  serverTime: number;
  onlineCount: number;
  dbMode: 'turso-cloud' | 'turso-replica' | 'libsql-local';
  players: SnapshotPlayer[];
  enemies: SnapshotEnemy[];
  shrines: ShrineState[];
  loot: LootDrop[];
  projectiles: ProjectileState[];
  events: WorldEffectEvent[];
}

export type ClientMessage =
  | { type: 'join'; playerId: string; name: string; heroClass: HeroClass }
  | { type: 'input'; moveX: number; moveZ: number; waypointX: number | null; waypointZ: number | null }
  | { type: 'cast'; skillIndex: 0 | 1 | 2; aimX: number; aimZ: number; targetEnemyId?: string | null }
  | { type: 'dash'; dirX: number; dirZ: number }
  | { type: 'target'; enemyId: string | null }
  | { type: 'use_potion' }
  | { type: 'equip_item'; itemId: string }
  | { type: 'respawn' }
  | { type: 'chat'; text: string };

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      dbMode: 'turso-cloud' | 'turso-replica' | 'libsql-local';
      chatHistory: ChatMessage[];
      inventory: InventoryItem[];
    }
  | { type: 'snapshot'; data: WorldSnapshot }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'inventory'; items: InventoryItem[] };
