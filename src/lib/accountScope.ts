import { getActiveAccountBrain } from './nicheCatalog';
import type {
  AccountProfile,
  GhostPilotStore,
  NavSection,
  QueueSlot,
} from './types';

function createDefaultSlotsForAccount(accountId: string): QueueSlot[] {
  return [
    { id: `slot-${accountId}-mon-am`, accountId, dayOfWeek: 1, time: '09:00', label: 'Morning Authority', enabled: true },
    { id: `slot-${accountId}-tue-am`, accountId, dayOfWeek: 2, time: '09:00', label: 'Framework Thread', enabled: true },
    { id: `slot-${accountId}-wed-pm`, accountId, dayOfWeek: 3, time: '14:00', label: 'Carousel / Proof', enabled: true },
    { id: `slot-${accountId}-thu-am`, accountId, dayOfWeek: 4, time: '09:00', label: 'Comment-to-PDF Giveaway', enabled: true },
    { id: `slot-${accountId}-fri-pm`, accountId, dayOfWeek: 5, time: '16:00', label: 'Contrarian Take', enabled: true },
    { id: `slot-${accountId}-sun-am`, accountId, dayOfWeek: 0, time: '11:00', label: 'Weekly Playbook', enabled: true },
  ];
}

function belongsToAccount(
  itemAccountId: string | undefined,
  activeAccountId: string,
  primaryAccountId: string
): boolean {
  if (!itemAccountId) {
    return activeAccountId === primaryAccountId;
  }
  return itemAccountId === activeAccountId;
}

/**
 * Returns a strictly isolated view of the GhostPilotStore for a single Twitter/X account.
 * No posts, radar signals, dossiers, PDFs, carousels, CRM leads, or campaigns leak across accounts.
 */
export function scopeStoreToAccount(
  fullStore: GhostPilotStore,
  accountId: string
): GhostPilotStore {
  const primaryId = fullStore.accounts[0]?.id || accountId;
  const targetAccount =
    fullStore.accounts.find((a) => a.id === accountId) || fullStore.accounts[0];
  const brain =
    targetAccount?.brandBrain ??
    (accountId === primaryId
      ? getActiveAccountBrain({ ...fullStore, activeAccountId: accountId })
      : {
          niche: 'Lock Your Deep Niche',
          subNiches: [],
          subreddits: [],
          customRssUrls: [],
          tone: 'Direct, authoritative, proof-driven',
          voiceRules: ['Write at Grade 6–8 readability', 'Lead with proof and real numbers'],
          bannedCliches: ['delve', 'tapestry', 'game-changer', 'unlock the power', "in today's fast-paced world"],
          winningPhrases: ['Here is the exact system:', 'Most people miss this:'],
          weeklyMix: {
            singlePosts: 5,
            threads: 2,
            carousels: 2,
            giveaways: 2,
          },
          personas: [
            {
              id: `persona-${accountId}-default`,
              name: 'Target Buyer',
              role: 'Ideal Niche Buyer',
              fears: ['Wasting months on tactics that do not convert'],
              desires: ['A clear, proven step-by-step system'],
              keywords: ['system', 'playbook', 'proof'],
            },
          ],
          activePersonaId: `persona-${accountId}-default`,
          offers: [],
        });

  const ownSlots = fullStore.queueSlots.filter((s) =>
    belongsToAccount(s.accountId, accountId, primaryId)
  );

  const ownCrmLists = fullStore.crmLists.filter((l) =>
    belongsToAccount(l.accountId, accountId, primaryId)
  );

  return {
    ...fullStore,
    activeAccountId: accountId,
    brandBrain: brain,
    radarItems: fullStore.radarItems.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    dossiers: fullStore.dossiers.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    leadMagnets: fullStore.leadMagnets.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    carousels: fullStore.carousels.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    posts: fullStore.posts.filter((i) => i.accountId === accountId),
    queueSlots: ownSlots.length > 0 ? ownSlots : createDefaultSlotsForAccount(accountId),
    autoDmCampaigns: fullStore.autoDmCampaigns.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    crmLists:
      ownCrmLists.length > 0
        ? ownCrmLists
        : [
            {
              id: `list-${accountId}-buyers`,
              accountId,
              name: 'Warm Buyers & Commenters',
              description: `Leads captured for ${targetAccount?.handle || 'this account'}`,
            },
          ],
    crmContacts: fullStore.crmContacts.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    antigravityTasks: fullStore.antigravityTasks.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    automationLogs: fullStore.automationLogs.filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
    capturedLeads: (fullStore.capturedLeads || []).filter((i) =>
      belongsToAccount(i.accountId, accountId, primaryId)
    ),
  };
}

function mergeScopedCollection<T extends { accountId?: string }>(
  existingAll: T[],
  incomingForAccount: T[],
  accountId: string,
  primaryId: string
): T[] {
  const others = existingAll.filter(
    (item) => !belongsToAccount(item.accountId, accountId, primaryId)
  );
  const taggedIncoming = incomingForAccount.map((item) => ({
    ...item,
    accountId: item.accountId || accountId,
  }));
  return [...taggedIncoming, ...others];
}

/**
 * Merges a partial patch produced by a single-account view back into the full multi-account store
 * without touching any other Twitter account's data.
 */
export function mergeScopedPatchIntoStore(
  fullStore: GhostPilotStore,
  accountId: string,
  patch: Partial<GhostPilotStore>
): Partial<GhostPilotStore> {
  const primaryId = fullStore.accounts[0]?.id || accountId;
  const mergedPatch: Partial<GhostPilotStore> = { ...patch };

  if (patch.brandBrain) {
    const baseAccounts = patch.accounts ?? fullStore.accounts;
    mergedPatch.accounts = baseAccounts.map((acc) =>
      acc.id === accountId ? { ...acc, brandBrain: patch.brandBrain } : acc
    );
  }

  if (patch.posts) {
    const otherPosts = fullStore.posts.filter((p) => p.accountId !== accountId);
    mergedPatch.posts = [
      ...patch.posts.map((p) => ({ ...p, accountId: p.accountId || accountId })),
      ...otherPosts,
    ];
  }

  if (patch.radarItems) {
    mergedPatch.radarItems = mergeScopedCollection(
      fullStore.radarItems,
      patch.radarItems,
      accountId,
      primaryId
    );
  }

  if (patch.dossiers) {
    mergedPatch.dossiers = mergeScopedCollection(
      fullStore.dossiers,
      patch.dossiers,
      accountId,
      primaryId
    );
  }

  if (patch.leadMagnets) {
    mergedPatch.leadMagnets = mergeScopedCollection(
      fullStore.leadMagnets,
      patch.leadMagnets,
      accountId,
      primaryId
    );
  }

  if (patch.carousels) {
    mergedPatch.carousels = mergeScopedCollection(
      fullStore.carousels,
      patch.carousels,
      accountId,
      primaryId
    );
  }

  if (patch.queueSlots) {
    mergedPatch.queueSlots = mergeScopedCollection(
      fullStore.queueSlots,
      patch.queueSlots,
      accountId,
      primaryId
    );
  }

  if (patch.autoDmCampaigns) {
    mergedPatch.autoDmCampaigns = mergeScopedCollection(
      fullStore.autoDmCampaigns,
      patch.autoDmCampaigns,
      accountId,
      primaryId
    );
  }

  if (patch.crmLists) {
    mergedPatch.crmLists = mergeScopedCollection(
      fullStore.crmLists,
      patch.crmLists,
      accountId,
      primaryId
    );
  }

  if (patch.crmContacts) {
    mergedPatch.crmContacts = mergeScopedCollection(
      fullStore.crmContacts,
      patch.crmContacts,
      accountId,
      primaryId
    );
  }

  if (patch.antigravityTasks) {
    mergedPatch.antigravityTasks = mergeScopedCollection(
      fullStore.antigravityTasks,
      patch.antigravityTasks,
      accountId,
      primaryId
    );
  }

  if (patch.automationLogs) {
    mergedPatch.automationLogs = mergeScopedCollection(
      fullStore.automationLogs,
      patch.automationLogs,
      accountId,
      primaryId
    );
  }

  if (patch.capturedLeads) {
    mergedPatch.capturedLeads = mergeScopedCollection(
      fullStore.capturedLeads || [],
      patch.capturedLeads,
      accountId,
      primaryId
    );
  }

  return mergedPatch;
}

export interface GuidedStage {
  step: number;
  id: 'niche' | 'research' | 'asset' | 'queue' | 'launch';
  title: string;
  actionLabel: string;
  targetSection: NavSection;
  completed: boolean;
}

/**
 * Evaluates the exact 5-step guided autopilot progression for one individual X account.
 */
export function computeAccountJourneyProgress(
  scopedStore: GhostPilotStore,
  account: AccountProfile
): {
  stages: GuidedStage[];
  completedCount: number;
  nextStage: GuidedStage | null;
} {
  const nicheDone = Boolean(account.nicheProfile?.locked);
  const researchDone = scopedStore.radarItems.length > 0 && scopedStore.dossiers.length > 0;
  const assetDone = scopedStore.leadMagnets.length > 0 || scopedStore.carousels.length > 0;
  const queueDone = scopedStore.posts.some((p) => p.status === 'queued' || p.status === 'published');
  const launchDone =
    account.xConnected ||
    scopedStore.antigravityTasks.length > 0 ||
    scopedStore.posts.some((p) => p.status === 'published');

  const stages: GuidedStage[] = [
    {
      step: 1,
      id: 'niche',
      title: 'Lock Niche & Offer',
      actionLabel: 'Lock Deep Niche',
      targetSection: 'brand',
      completed: nicheDone,
    },
    {
      step: 2,
      id: 'research',
      title: 'Niche Radar & Dossier',
      actionLabel: 'Run $0 Niche Research',
      targetSection: 'research',
      completed: researchDone,
    },
    {
      step: 3,
      id: 'asset',
      title: 'Free PDF or Carousel',
      actionLabel: 'Create Lead Magnet PDF',
      targetSection: 'lead-magnets',
      completed: assetDone,
    },
    {
      step: 4,
      id: 'queue',
      title: 'Score Copy & Queue',
      actionLabel: 'Write & Queue Winners',
      targetSection: 'write',
      completed: queueDone,
    },
    {
      step: 5,
      id: 'launch',
      title: 'Launch X Autopilot',
      actionLabel: 'Connect X / Antigravity',
      targetSection: 'antigravity',
      completed: launchDone,
    },
  ];

  const completedCount = stages.filter((s) => s.completed).length;
  const nextStage = stages.find((s) => !s.completed) || null;
  return { stages, completedCount, nextStage };
}
