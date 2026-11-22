export type NavSection =
  | 'today'
  | 'ideas'
  | 'queue-pdfs'
  | 'accounts-telegram'
  // Legacy aliases kept for seamless cross-view routing
  | 'autopilot'
  | 'research-hub'
  | 'write-hub'
  | 'grow-hub'
  | 'antigravity'
  | 'account-hub'
  | 'brand'
  | 'research'
  | 'lead-magnets'
  | 'carousels'
  | 'write'
  | 'queue'
  | 'viral'
  | 'automations'
  | 'crm'
  | 'analytics'
  | 'settings';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  botUsername?: string;
  autoDeliverScheduled: boolean;
  autoPlugReminderEnabled: boolean;
  autoPlugDelayMinutes: number;
  twoWayInboxEnabled: boolean;
  lastUpdateId?: number;
  lastSentAt?: string;
}

export type PsychologicalTrigger =
  | 'Curiosity Gap'
  | 'Loss Aversion'
  | 'Contrarian Proof'
  | 'Pattern Interrupt'
  | 'Step-by-Step Playbook'
  | 'Hormozi Value Equation'
  | 'Identity Callout'
  | 'Social Proof & Case Study';

export interface AccountNicheProfile {
  locked: boolean;
  marketId: string;
  marketName: string;
  subNicheId: string;
  subNicheName: string;
  microAngle: string;
  buyerGoal: string;
  lockedAt: string;
}

export interface AccountProfile {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  verified: boolean;
  isPremium: boolean;
  xConnected: boolean;
  xMode: 'sandbox' | 'live';
  xAccessToken?: string;
  xRefreshToken?: string;
  xTokenExpiresAt?: string;
  nicheProfile?: AccountNicheProfile;
  brandBrain?: BrandBrain;
  telegram?: TelegramConfig;
}

export interface AudiencePersona {
  id: string;
  name: string;
  role: string;
  fears: string[];
  desires: string[];
  keywords: string[];
}

export interface MonetizationOffer {
  id: string;
  name: string;
  platform: 'Whop' | 'Gumroad' | 'Direct' | 'Affiliate' | 'Newsletter';
  url: string;
  priceLabel: string;
  promise: string;
  autoPlugTemplate: string;
  giveawayKeyword: string;
  clicks: number;
  leads: number;
  estimatedRevenue: number;
}

export interface BrandBrain {
  niche: string;
  subNiches: string[];
  subreddits: string[];
  customRssUrls: string[];
  tone: string;
  voiceRules: string[];
  bannedCliches: string[];
  winningPhrases: string[];
  weeklyMix: {
    singlePosts: number;
    threads: number;
    carousels: number;
    giveaways: number;
  };
  personas: AudiencePersona[];
  activePersonaId: string;
  offers: MonetizationOffer[];
}

export interface RadarItem {
  id: string;
  accountId?: string;
  source:
    | 'Reddit Pain-Point'
    | 'Google News'
    | 'GitHub Trending'
    | 'Hacker News'
    | 'Bluesky Live'
    | 'Dev.to'
    | 'Product Hunt'
    | 'YouTube Transcript'
    | 'Custom RSS';
  sourceDetail: string;
  title: string;
  summary: string;
  url: string;
  niche: string;
  signalScore: number;
  publishedAt: string;
  usedInPostId?: string;
  painPointTag?: string;
}

export interface AuthorityDossier {
  id: string;
  accountId?: string;
  niche: string;
  title: string;
  createdAt: string;
  sourceCount: number;
  angles: {
    buyerPainPoints: string[];
    coreFrameworks: string[];
    contrarianTruths: string[];
    scriptsAndProof: string[];
    offerBridges: string[];
  };
}

export interface LeadMagnetSection {
  id: string;
  type: 'takeaway' | 'framework' | 'checklist' | 'script' | 'offer-callout';
  heading: string;
  body: string;
  bullets: string[];
}

export interface LeadMagnet {
  id: string;
  accountId?: string;
  slug: string;
  title: string;
  subtitle: string;
  format: 'Playbook' | 'Swipe File' | 'Checklist' | 'Deep-Dive Report';
  niche: string;
  themeColor: string;
  authorName: string;
  authorHandle: string;
  linkedOfferId?: string;
  giveawayKeyword: string;
  sections: LeadMagnetSection[];
  views: number;
  downloads: number;
  offerClicks: number;
  createdAt: string;
}

export type CarouselThemeId = 'obsidian' | 'editorial' | 'cobalt' | 'ivory';
export type CarouselSlideLayout =
  | 'cover'
  | 'framework'
  | 'checklist'
  | 'comparison'
  | 'quote'
  | 'cta';

export interface CarouselSlide {
  id: string;
  layout: CarouselSlideLayout;
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  leftLabel?: string;
  rightLabel?: string;
}

export interface CarouselDeck {
  id: string;
  accountId?: string;
  title: string;
  themeId: CarouselThemeId;
  authorName: string;
  authorHandle: string;
  linkedOfferId?: string;
  linkedLeadMagnetId?: string;
  slides: CarouselSlide[];
  createdAt: string;
}

export interface CopyScoreBreakdown {
  total: number;
  grade: 'S-Tier' | 'Strong' | 'Average' | 'Needs Work';
  hookScore: number;
  persuasionScore: number;
  readabilityScore: number;
  conversionScore: number;
  readingGrade: number;
  awarenessStage:
    | 'Unaware'
    | 'Problem Aware'
    | 'Solution Aware'
    | 'Product Aware'
    | 'Most Aware';
  algorithmSignals: {
    bookmarkPull: number;
    replyPull: number;
    dwellPull: number;
  };
  clichesFound: string[];
  strengths: string[];
  suggestions: string[];
}

export interface CopyVariation {
  id: string;
  frameworkId: string;
  frameworkName: string;
  trigger: PsychologicalTrigger;
  blocks: string[];
  score: CopyScoreBreakdown;
}

export interface PostAutomations {
  threadDelayMinutes: number;
  autoPlugEnabled: boolean;
  autoPlugText: string;
  autoPlugDelayMinutes: number;
  autoPlugMinLikes: number;
  autoRetweetEnabled: boolean;
  autoRetweetDelayHours: number;
  autoUnretweetAfterHours: number;
  autoDeleteEnabled: boolean;
  autoDeleteAfterHours: number;
  isEvergreen: boolean;
  evergreenIntervalDays: number;
  linkedOfferId?: string;
  linkedLeadMagnetId?: string;
  linkedCarouselId?: string;
}

export interface PostItem {
  id: string;
  accountId: string;
  blocks: string[];
  status: 'draft' | 'queued' | 'published' | 'failed';
  format: 'single' | 'thread' | 'giveaway' | 'carousel';
  scheduledAt?: string;
  publishedAt?: string;
  frameworkName?: string;
  trigger?: PsychologicalTrigger;
  sourceRadarId?: string;
  predictiveScore: number;
  automations: PostAutomations;
  metrics: {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    bookmarks: number;
    offerClicks: number;
  };
  xTweetIds?: string[];
  telegramDeliveredAt?: string;
  telegramAutoPlugSent?: boolean;
  errorMessage?: string;
  createdAt: string;
}

export interface QueueSlot {
  id: string;
  accountId?: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  time: string; // "09:00"
  label: string;
  enabled: boolean;
}

export interface ViralTweet {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  niche: string;
  format: 'single' | 'thread';
  text: string;
  likes: number;
  retweets: number;
  bookmarks: number;
  outlierMultiplier: number;
  hookFormula: string;
  trigger: PsychologicalTrigger;
  anatomyNotes: string;
  isStaffPick: boolean;
  isDailyInspiration: boolean;
  collectionIds: string[];
}

export interface ViralCollection {
  id: string;
  name: string;
  description: string;
}

export interface CopyFramework {
  id: string;
  name: string;
  category: 'Direct Response' | 'Viral Thread' | 'Giveaway Hook' | 'Authority Breakdown';
  trigger: PsychologicalTrigger;
  origin: string;
  whenToUse: string;
  skeleton: string;
  example: string;
}

export interface AutoDmCampaign {
  id: string;
  accountId?: string;
  name: string;
  postId?: string;
  triggerKeyword: string;
  requireFollow: boolean;
  requireLike: boolean;
  leadMagnetId?: string;
  offerId?: string;
  dmTemplate: string;
  active: boolean;
  sentCount: number;
  pendingCommenters: {
    id: string;
    handle: string;
    name: string;
    commentText: string;
    sent: boolean;
    commentedAt: string;
  }[];
  createdAt: string;
}

export interface CrmList {
  id: string;
  accountId?: string;
  name: string;
  description: string;
}

export interface CrmContact {
  id: string;
  accountId?: string;
  name: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  followers: number;
  listId: string;
  stage: 'New' | 'Engaged' | 'DM Sent' | 'Buyer';
  notes: string;
  latestTweet: string;
  lastInteractedAt: string;
}

export interface DailyAnalyticsPoint {
  date: string;
  followers: number;
  impressions: number;
  engagements: number;
  profileVisits: number;
  offerClicks: number;
}

export interface AntigravityTask {
  id: string;
  accountId?: string;
  type: 'weekly-autopilot' | 'authority-dossier' | 'ab-copy' | 'lead-magnet' | 'carousel' | 'replies';
  title: string;
  status: 'pending' | 'imported';
  promptForIde: string;
  contextPayload: Record<string, unknown>;
  createdAt: string;
  importedAt?: string;
}

export interface AutomationLogEntry {
  id: string;
  accountId?: string;
  timestamp: string;
  type: 'publish' | 'auto-plug' | 'auto-rt' | 'auto-unrt' | 'evergreen' | 'auto-delete' | 'auto-dm' | 'scheduler' | 'telegram';
  mode: 'sandbox' | 'live';
  message: string;
  postId?: string;
}

export interface GhostPilotStore {
  accounts: AccountProfile[];
  activeAccountId: string;
  brandBrain: BrandBrain;
  radarItems: RadarItem[];
  dossiers: AuthorityDossier[];
  leadMagnets: LeadMagnet[];
  carousels: CarouselDeck[];
  posts: PostItem[];
  queueSlots: QueueSlot[];
  viralTweets: ViralTweet[];
  collections: ViralCollection[];
  autoDmCampaigns: AutoDmCampaign[];
  crmLists: CrmList[];
  crmContacts: CrmContact[];
  analytics: DailyAnalyticsPoint[];
  antigravityTasks: AntigravityTask[];
  automationLogs: AutomationLogEntry[];
  telegramConfig?: TelegramConfig;
  globalAutomationDefaults: {
    autoPlugEnabled: boolean;
    autoPlugDelayMinutes: number;
    autoRetweetEnabled: boolean;
    autoRetweetDelayHours: number;
    autoUnretweetAfterHours: number;
    evergreenEnabled: boolean;
    evergreenIntervalDays: number;
    autoDeleteEnabled: boolean;
    autoDeleteAfterHours: number;
  };
}
