import type {
  EnemyArchetype,
  PlayerState,
  QuestCategory,
  QuestDefinition,
  QuestObjectiveKind,
  QuestProgress,
} from './types.ts';

export const QUEST_CATALOG: QuestDefinition[] = [
  // MAIN STORY ARC (Sequential Chapters)
  {
    id: 'main-ch1-stalkers',
    category: 'main',
    chapterLabel: 'Chapter I',
    title: 'Whispers at Dawn Spire',
    description: 'Rift Stalkers prowl outside the Sanctuary bridge. Clear the western glade to secure the path.',
    objectiveLabel: 'Defeat Rift Stalkers',
    objectiveKind: 'kill_archetype',
    targetArchetype: 'stalker',
    targetCount: 3,
    targetX: -20,
    targetZ: -2,
    reward: {
      xp: 125,
      gold: 55,
      potions: 1,
      relic: {
        itemKey: 'dawn_guard_charm',
        name: 'Dawn Guard Charm',
        rarity: 'rare',
        slotType: 'charm',
        power: 10,
      },
    },
  },
  {
    id: 'main-ch2-shrine',
    category: 'main',
    chapterLabel: 'Chapter II',
    title: 'Reclamation of Solis',
    description: 'Stand inside the Verdant Altar or Dawn Spire ring to attune a Shrine for Solis.',
    objectiveLabel: 'Capture or Attune a Shrine',
    objectiveKind: 'capture_shrine',
    targetCount: 1,
    prerequisiteQuestId: 'main-ch1-stalkers',
    targetX: 26,
    targetZ: 10,
    reward: {
      xp: 190,
      gold: 85,
      potions: 2,
    },
  },
  {
    id: 'main-ch3-warden',
    category: 'main',
    chapterLabel: 'Chapter III',
    title: 'Heart of Obsidian Reach',
    description: 'Ascend to the northern Obsidian Citadel and defeat Solar Warden Valdris.',
    objectiveLabel: 'Defeat Solar Warden Valdris',
    objectiveKind: 'kill_boss',
    targetCount: 1,
    prerequisiteQuestId: 'main-ch2-shrine',
    targetX: 4,
    targetZ: -49,
    reward: {
      xp: 380,
      gold: 180,
      potions: 2,
      relic: {
        itemKey: 'solis_oathblade',
        name: 'Solis Oathkeeper Relic',
        rarity: 'relic',
        slotType: 'weapon',
        power: 24,
      },
    },
  },

  // SIDE QUESTS
  {
    id: 'side-barrow-scout',
    category: 'side',
    chapterLabel: 'The Easy March',
    title: 'Eyes on the Barrow Mound',
    description: 'Crows gather above the black oaks west of Sanctuary. Scout Barrowlands Ridge with Graymstrum.',
    objectiveLabel: 'Scout Barrowlands Ridge',
    objectiveKind: 'visit_zone',
    targetZone: 'Barrowlands Ridge',
    targetCount: 1,
    targetX: -24,
    targetZ: 21,
    reward: {
      xp: 110,
      gold: 50,
      potions: 1,
    },
  },
  {
    id: 'side-barrow-thieves',
    category: 'side',
    chapterLabel: 'The Easy March',
    title: 'Clear Liar’s Copse',
    description: 'Batras’s Thieves lurk in the thorn cover beneath the mound. Break their ambush.',
    objectiveLabel: 'Defeat Copse Brigands',
    objectiveKind: 'kill_archetype',
    targetArchetype: 'thief',
    targetCount: 3,
    targetX: -21,
    targetZ: 21,
    reward: {
      xp: 160,
      gold: 75,
      relic: {
        itemKey: 'barrow_whetstone_charm',
        name: 'Ironbarrow Signet',
        rarity: 'epic',
        slotType: 'charm',
        power: 15,
      },
    },
  },
  {
    id: 'side-verdant-crossing',
    category: 'side',
    chapterLabel: 'Exploration',
    title: 'Across the Stone Bridge',
    description: 'Cross the Sunstone river bridge eastward and scout Verdant Crossing.',
    objectiveLabel: 'Reach Verdant Crossing',
    objectiveKind: 'visit_zone',
    targetZone: 'Verdant Crossing',
    targetCount: 1,
    targetX: 22,
    targetZ: 8,
    reward: {
      xp: 85,
      gold: 40,
      potions: 1,
    },
  },
  {
    id: 'side-void-acolytes',
    category: 'side',
    chapterLabel: 'Arcane Bounty',
    title: 'Silencing the Void Choir',
    description: 'Void Acolytes channel corrupting bolts across the outer shrines. Disrupt their ranks.',
    objectiveLabel: 'Defeat Void Acolytes',
    objectiveKind: 'kill_archetype',
    targetArchetype: 'acolyte',
    targetCount: 3,
    targetX: -28,
    targetZ: -16,
    reward: {
      xp: 135,
      gold: 60,
    },
  },
  {
    id: 'side-iron-bulwark',
    category: 'side',
    chapterLabel: 'Heavy Contract',
    title: 'Shatter the Colossi',
    description: 'Ancient Iron Colossi patrol the canyon ruins. Break two of the constructs.',
    objectiveLabel: 'Defeat Iron Colossi',
    objectiveKind: 'kill_archetype',
    targetArchetype: 'colossus',
    targetCount: 2,
    targetX: 32,
    targetZ: -10,
    reward: {
      xp: 165,
      gold: 75,
      relic: {
        itemKey: 'colossus_core_charm',
        name: 'Titan Dynamo Charm',
        rarity: 'epic',
        slotType: 'charm',
        power: 16,
      },
    },
  },

  // DAILY REPEATABLE QUESTS
  {
    id: 'daily-valley-patrol',
    category: 'daily',
    chapterLabel: 'Daily Patrol',
    title: 'Sweep of Sunstone Valley',
    description: 'Keep the trade paths clear by defeating hostile forces anywhere in Solis Reach.',
    objectiveLabel: 'Slay Realm Enemies',
    objectiveKind: 'kill_any',
    targetCount: 5,
    targetX: -18,
    targetZ: 2,
    reward: {
      xp: 140,
      gold: 75,
      potions: 1,
    },
  },
  {
    id: 'daily-world-event',
    category: 'daily',
    chapterLabel: 'Daily Convergence',
    title: 'Answering the Beacon',
    description: 'Join fellow heroes to overcome an active Dynamic World Event in the valley.',
    objectiveLabel: 'Complete a World Event',
    objectiveKind: 'world_event',
    targetCount: 1,
    targetX: 0,
    targetZ: -10,
    reward: {
      xp: 200,
      gold: 110,
      potions: 2,
    },
  },

  // WEEKLY REPEATABLE QUEST
  {
    id: 'weekly-solis-conquest',
    category: 'weekly',
    chapterLabel: 'Weekly Mandate',
    title: 'Bastion of the Realm',
    description: 'Prove your enduring mastery by culling 12 enemies across Solis Reach this week.',
    objectiveLabel: 'Slay Enemies (Weekly)',
    objectiveKind: 'kill_any',
    targetCount: 12,
    targetX: 4,
    targetZ: -36,
    reward: {
      xp: 440,
      gold: 250,
      potions: 3,
      relic: {
        itemKey: 'celestial_aegis_charm',
        name: 'Celestial Aegis Seal',
        rarity: 'relic',
        slotType: 'charm',
        power: 26,
      },
    },
  },
];

export const QUEST_BY_ID: Record<string, QuestDefinition> = Object.fromEntries(
  QUEST_CATALOG.map((q) => [q.id, q]),
);

export function getDailyPeriodKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `D-${y}-${m}-${day}`;
}

export function getWeeklyPeriodKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W-${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getPeriodKeyForCategory(category: QuestCategory, nowMs = Date.now()): string {
  if (category === 'daily') return getDailyPeriodKey(nowMs);
  if (category === 'weekly') return getWeeklyPeriodKey(nowMs);
  return 'permanent';
}

export function ensurePlayerQuests(player: PlayerState, nowMs = Date.now()): boolean {
  let changed = false;
  if (!Array.isArray(player.quests)) {
    player.quests = [];
    changed = true;
  }

  for (const def of QUEST_CATALOG) {
    const periodKey = getPeriodKeyForCategory(def.category, nowMs);
    const existing = player.quests.find((q) => q.questId === def.id);

    // Check prerequisite for main story chain
    if (def.prerequisiteQuestId) {
      const prereq = player.quests.find((q) => q.questId === def.prerequisiteQuestId);
      if (!prereq || prereq.status !== 'claimed') {
        continue;
      }
    }

    if (!existing) {
      player.quests.push({
        questId: def.id,
        category: def.category,
        status: 'active',
        progress: 0,
        targetCount: def.targetCount,
        periodKey,
        updatedAt: nowMs,
      });
      changed = true;
    } else if (
      (def.category === 'daily' || def.category === 'weekly') &&
      existing.periodKey !== periodKey
    ) {
      existing.status = 'active';
      existing.progress = 0;
      existing.targetCount = def.targetCount;
      existing.periodKey = periodKey;
      existing.updatedAt = nowMs;
      changed = true;
    }
  }

  // Ensure trackedQuestId points to a valid un-claimed quest
  const trackedValid =
    player.trackedQuestId &&
    player.quests.some((q) => q.questId === player.trackedQuestId && q.status !== 'claimed');
  if (!trackedValid) {
    const preferred =
      player.quests.find((q) => q.status === 'completed') ||
      player.quests.find((q) => q.category === 'main' && q.status === 'active') ||
      player.quests.find((q) => q.status !== 'claimed') ||
      null;
    const nextId = preferred ? preferred.questId : null;
    if (player.trackedQuestId !== nextId) {
      player.trackedQuestId = nextId;
      changed = true;
    }
  }

  return changed;
}

export interface QuestProgressEvent {
  kind: QuestObjectiveKind;
  archetype?: EnemyArchetype;
  zoneName?: string;
  count?: number;
}

export function advancePlayerQuests(
  player: PlayerState,
  event: QuestProgressEvent,
  nowMs = Date.now(),
): { updated: boolean; newlyCompleted: QuestDefinition[] } {
  const newlyCompleted: QuestDefinition[] = [];
  let updated = false;
  const amount = event.count ?? 1;

  for (const qp of player.quests) {
    if (qp.status !== 'active') continue;
    const def = QUEST_BY_ID[qp.questId];
    if (!def) continue;

    let matches = false;
    if (def.objectiveKind === event.kind) {
      if (def.objectiveKind === 'kill_archetype') {
        matches = def.targetArchetype === event.archetype;
      } else if (def.objectiveKind === 'visit_zone') {
        matches = def.targetZone === event.zoneName;
      } else {
        matches = true;
      }
    }

    if (!matches) continue;

    const nextProg = Math.min(def.targetCount, qp.progress + amount);
    if (nextProg !== qp.progress) {
      qp.progress = nextProg;
      qp.updatedAt = nowMs;
      updated = true;
      if (qp.progress >= def.targetCount) {
        qp.status = 'completed';
        newlyCompleted.push(def);
      }
    }
  }

  return { updated, newlyCompleted };
}
