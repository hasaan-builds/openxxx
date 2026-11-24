import type {
  AntigravityTask,
  AuthorityDossier,
  CopyVariation,
  GhostPilotStore,
  LeadMagnet,
  PostItem,
  RadarItem,
} from './types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getStore: () => requestJson<GhostPilotStore>('/api/store'),
  saveStore: (patch: Partial<GhostPilotStore>) =>
    requestJson<GhostPilotStore>('/api/store', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  exportBackup: () => requestJson<GhostPilotStore>('/api/backup/export'),
  importBackup: (store: GhostPilotStore) =>
    requestJson<GhostPilotStore>('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify(store),
    }),

  // App 1: Live Niche Radar (GummySearch + Google News + GitHub + HN + RSS)
  scanRadar: (payload: {
    niche: string;
    subreddits: string[];
    customRssUrls: string[];
    includeGithub: boolean;
  }) =>
    requestJson<{ items: RadarItem[]; liveCount: number; message: string }>('/api/radar/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  compileDossier: (payload: { niche: string; radarItemIds: string[]; useAntigravity?: boolean }) =>
    requestJson<{ dossier?: AuthorityDossier; task?: AntigravityTask; mode: string }>(
      '/api/research/dossier',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // App 2: Predictive Copywriting & A/B Arena
  generateAbCopy: (payload: {
    topic: string;
    keyInsight?: string;
    offerId?: string;
    useGemini?: boolean;
  }) =>
    requestJson<{ variations: CopyVariation[]; engine: string }>('/api/copy/ab-arena', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  aiGhostwrite: (payload: {
    action: 'rewrite' | 'finish' | 'expand-thread' | 'hooks' | 'tone-shift' | 'reply';
    text: string;
    tone?: string;
  }) =>
    requestJson<{ blocks: string[]; engine: string }>('/api/copy/ghostwrite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // App 4: Lead Magnet Studio
  generateLeadMagnet: (payload: {
    topic: string;
    format: LeadMagnet['format'];
    dossierId?: string;
    offerId?: string;
    requireEmailGate?: boolean;
  }) =>
    requestJson<{ leadMagnet: LeadMagnet; engine: string }>('/api/lead-magnets/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Branch 1: Viral Library 1-Click Remix
  remixViralTweet: (payload: {
    viralText: string;
    hookFormula?: string;
    scheduleNow?: boolean;
  }) =>
    requestJson<{
      blocks: string[];
      post?: PostItem;
      store: GhostPilotStore;
    }>('/api/viral/remix', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Branch 5: Reply-Guy Value Reply Suggestions
  generateReplySuggestions: (payload: { targetHandle: string; targetTopic: string }) =>
    requestJson<{
      replies: Array<{ id: string; angle: string; text: string }>;
      engine: string;
    }>('/api/engage/reply-suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // App 5: Publishing & X OAuth 2.0 PKCE
  publishPostNow: (postId: string) =>
    requestJson<{ post: PostItem; store: GhostPilotStore }>(`/api/posts/${postId}/publish`, {
      method: 'POST',
    }),

  runSchedulerTick: () =>
    requestJson<{ processed: number; store: GhostPilotStore }>('/api/scheduler/tick', {
      method: 'POST',
    }),

  getXConfig: () =>
    requestJson<{
      configured: boolean;
      callbackUrl: string;
      mode: 'sandbox' | 'live';
      geminiConfigured: boolean;
    }>('/api/x/config'),

  getXAuthUrl: (redirectUri: string) =>
    requestJson<{ url: string }>(`/api/x/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`),

  disconnectX: () =>
    requestJson<{ store: GhostPilotStore }>('/api/x/disconnect', { method: 'POST' }),

  // Antigravity IDE Zero-Cost Bridge
  createAntigravityTask: (payload: {
    type: AntigravityTask['type'];
    title: string;
    goal?: string;
  }) =>
    requestJson<{ task: AntigravityTask; store: GhostPilotStore }>('/api/antigravity/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncAntigravityOutbox: () =>
    requestJson<{ importedPosts: number; importedCarousels: number; importedMagnets: number; store: GhostPilotStore }>(
      '/api/antigravity/sync',
      { method: 'POST' }
    ),

  importAntigravityRaw: (payload: { rawText: string; taskId?: string }) =>
    requestJson<{ importedPosts: number; importedCarousels: number; importedMagnets: number; store: GhostPilotStore }>(
      '/api/antigravity/import-raw',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  runLocalTurbo: (payload?: { goal?: string; count?: number }) =>
    requestJson<{ importedPosts: number; importedCarousels: number; importedMagnets: number; store: GhostPilotStore }>(
      '/api/antigravity/run-local-turbo',
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    ),

  extractUrl: (payload: { url: string; saveToRadar?: boolean }) =>
    requestJson<{
      url: string;
      title: string;
      markdown: string;
      keyTakeaways: string[];
      engine: 'jina-reader' | 'direct-html';
      store: GhostPilotStore;
    }>('/api/tools/extract-url', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // $0 Telegram Bot Autopilot
  detectTelegramChat: (botToken: string) =>
    requestJson<{ botUsername: string; chatId: string; chatLabel: string; lastUpdateId?: number }>(
      '/api/telegram/detect-chat',
      {
        method: 'POST',
        body: JSON.stringify({ botToken }),
      }
    ),

  testTelegram: (payload: { botToken: string; chatId: string }) =>
    requestJson<{ ok: boolean; botUsername: string; store: GhostPilotStore }>('/api/telegram/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendPostToTelegram: (postId: string, origin?: string) =>
    requestJson<{ ok: boolean; post: PostItem; store: GhostPilotStore }>(
      `/api/telegram/send-post/${postId}`,
      {
        method: 'POST',
        body: JSON.stringify({ origin: origin || window.location.origin }),
      }
    ),

  sendMagnetToTelegram: (magnetId: string, origin?: string) =>
    requestJson<{ ok: boolean; store: GhostPilotStore }>(`/api/telegram/send-magnet/${magnetId}`, {
      method: 'POST',
      body: JSON.stringify({ origin: origin || window.location.origin }),
    }),

  pollTelegramInbox: (origin?: string) =>
    requestJson<{ checked: number; createdPosts: number; store: GhostPilotStore }>(
      '/api/telegram/poll-inbox',
      {
        method: 'POST',
        body: JSON.stringify({ origin: origin || window.location.origin }),
      }
    ),

  sendBranchPackToTelegram: (payload: { pack: 'replies' | 'dm'; origin?: string }) =>
    requestJson<{ ok: boolean; store: GhostPilotStore }>('/api/telegram/send-branch-pack', {
      method: 'POST',
      body: JSON.stringify({
        pack: payload.pack,
        origin: payload.origin || window.location.origin,
      }),
    }),
};
