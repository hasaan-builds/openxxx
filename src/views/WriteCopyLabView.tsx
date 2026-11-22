import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Flame,
  Layers,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { scoreCopy } from '../lib/copyScorer';
import { COPY_FRAMEWORKS } from '../lib/frameworks';
import { countTweetChars, findNextOpenSlot } from '../lib/scheduler';
import type {
  AccountProfile,
  CopyVariation,
  GhostPilotStore,
  PostAutomations,
  PostItem,
} from '../lib/types';

export interface WriterSeedDraft {
  id?: string;
  blocks: string[];
  format?: PostItem['format'];
  frameworkName?: string;
  trigger?: PostItem['trigger'];
  sourceRadarId?: string;
  linkedOfferId?: string;
  linkedLeadMagnetId?: string;
  linkedCarouselId?: string;
  autoPlugText?: string;
  scheduledAt?: string;
}

interface WriteCopyLabViewProps {
  store: GhostPilotStore;
  activeAccount: AccountProfile;
  seedDraft: WriterSeedDraft | null;
  onClearSeed: () => void;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onPublishPost: (postId: string) => Promise<void>;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function WriteCopyLabView({
  store,
  activeAccount,
  seedDraft,
  onClearSeed,
  onSaveStore,
  onPublishPost,
  onNotify,
}: WriteCopyLabViewProps) {
  const defaultOffer = store.brandBrain.offers[0];
  const defaults = store.globalAutomationDefaults;

  const [editingPostId, setEditingPostId] = useState<string | undefined>(undefined);
  const [targetScheduledAt, setTargetScheduledAt] = useState<string | undefined>(undefined);
  const [blocks, setBlocks] = useState<string[]>([
    `You are quietly losing 60% of warm prospects in minute 4 of your ${store.brandBrain.niche.toLowerCase()} process.\n\nMost beginners guess instead of following a system.\n\nTop 1% do this instead:\n1. Diagnose the exact bottleneck\n2. Prove the fix in 60 seconds\n3. Offer 1 free playbook\n\nSave this.`,
  ]);
  const [format, setFormat] = useState<PostItem['format']>('single');
  const [frameworkName, setFrameworkName] = useState<string>('Silent Leak (Loss Aversion)');
  const [trigger, setTrigger] = useState<PostItem['trigger']>('Loss Aversion');
  const [sourceRadarId, setSourceRadarId] = useState<string | undefined>(undefined);

  // TweetHunter signature right-pane inspector tab
  const [rightTab, setRightTab] = useState<'score' | 'inspiration' | 'preview'>('score');
  const [inspoSearch, setInspoSearch] = useState('');

  const [automations, setAutomations] = useState<PostAutomations>({
    threadDelayMinutes: 0,
    autoPlugEnabled: defaults.autoPlugEnabled,
    autoPlugText: defaultOffer?.autoPlugTemplate || '',
    autoPlugDelayMinutes: defaults.autoPlugDelayMinutes,
    autoPlugMinLikes: 5,
    autoRetweetEnabled: defaults.autoRetweetEnabled,
    autoRetweetDelayHours: defaults.autoRetweetDelayHours,
    autoUnretweetAfterHours: defaults.autoUnretweetAfterHours,
    autoDeleteEnabled: defaults.autoDeleteEnabled,
    autoDeleteAfterHours: defaults.autoDeleteAfterHours,
    isEvergreen: false,
    evergreenIntervalDays: defaults.evergreenIntervalDays,
    linkedOfferId: defaultOffer?.id,
  });

  // A/B Arena state
  const [abTopic, setAbTopic] = useState('');
  const [abInsight, setAbInsight] = useState('');
  const [abVariations, setAbVariations] = useState<CopyVariation[]>([]);
  const [abLoading, setAbLoading] = useState(false);
  const [abEngine, setAbEngine] = useState('');
  const [ghostLoading, setGhostLoading] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!seedDraft) return;
    setEditingPostId(seedDraft.id);
    setTargetScheduledAt(seedDraft.scheduledAt);
    setBlocks(seedDraft.blocks.length > 0 ? seedDraft.blocks : ['']);
    setFormat(seedDraft.format ?? (seedDraft.blocks.length > 1 ? 'thread' : 'single'));
    if (seedDraft.frameworkName) setFrameworkName(seedDraft.frameworkName);
    if (seedDraft.trigger) setTrigger(seedDraft.trigger);
    setSourceRadarId(seedDraft.sourceRadarId);
    setAutomations((prev) => ({
      ...prev,
      linkedOfferId: seedDraft.linkedOfferId ?? prev.linkedOfferId,
      linkedLeadMagnetId: seedDraft.linkedLeadMagnetId ?? prev.linkedLeadMagnetId,
      linkedCarouselId: seedDraft.linkedCarouselId ?? prev.linkedCarouselId,
      autoPlugText: seedDraft.autoPlugText ?? prev.autoPlugText,
    }));
    onClearSeed();
  }, [seedDraft, onClearSeed]);

  const activePersona = useMemo(
    () =>
      store.brandBrain.personas.find((p) => p.id === store.brandBrain.activePersonaId) ??
      store.brandBrain.personas[0],
    [store.brandBrain.personas, store.brandBrain.activePersonaId]
  );

  const score = useMemo(
    () => scoreCopy(blocks, { brandBrain: store.brandBrain, persona: activePersona }),
    [blocks, store.brandBrain, activePersona]
  );

  const filteredInspiration = useMemo(() => {
    const q = inspoSearch.trim().toLowerCase();
    return store.viralTweets.filter((t) => {
      if (!q) return true;
      return `${t.text} ${t.niche} ${t.hookFormula} ${t.authorHandle}`.toLowerCase().includes(q);
    });
  }, [store.viralTweets, inspoSearch]);

  const maxChars = activeAccount.isPremium ? 4000 : 280;

  const updateBlock = (idx: number, val: string) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? val : b)));
  };

  const addThreadBlock = () => {
    setBlocks((prev) => [...prev, '']);
    setFormat('thread');
  };

  const removeBlock = (idx: number) => {
    if (blocks.length <= 1) return;
    const next = blocks.filter((_, i) => i !== idx);
    setBlocks(next);
    if (next.length === 1 && format === 'thread') setFormat('single');
  };

  const handleOfferChange = (offerId: string) => {
    const found = store.brandBrain.offers.find((o) => o.id === offerId);
    setAutomations((prev) => ({
      ...prev,
      linkedOfferId: offerId || undefined,
      autoPlugText: found ? found.autoPlugTemplate : prev.autoPlugText,
    }));
  };

  const handleRunAbArena = async () => {
    const topic = abTopic.trim() || blocks[0]?.split('\n')[0]?.slice(0, 80) || store.brandBrain.niche;
    setAbLoading(true);
    try {
      const res = await api.generateAbCopy({
        topic,
        keyInsight: abInsight.trim() || undefined,
        offerId: automations.linkedOfferId,
        useGemini: true,
      });
      setAbVariations(res.variations);
      setAbEngine(res.engine);
      onNotify(
        `Ranked 5 copy variations (Winner scored ${res.variations[0]?.score.total ?? 0}/100 via ${res.engine}).`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'A/B Arena failed.', 'error');
    } finally {
      setAbLoading(false);
    }
  };

  const handleGhostwrite = async (
    action: 'rewrite' | 'finish' | 'expand-thread' | 'hooks' | 'tone-shift'
  ) => {
    const text = blocks.join('\n\n').trim();
    if (!text) {
      onNotify('Write a rough line first so AI Ghostwriter has context.', 'error');
      return;
    }
    setGhostLoading(action);
    try {
      const res = await api.aiGhostwrite({
        action,
        text,
        tone: store.brandBrain.tone,
      });
      if (res.blocks.length > 0) {
        setBlocks(res.blocks);
        if (res.blocks.length > 1) setFormat('thread');
        onNotify(`Applied "${action}" via ${res.engine}.`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Ghostwriter failed.', 'error');
    } finally {
      setGhostLoading(null);
    }
  };

  const buildPostRecord = (status: PostItem['status']): PostItem => {
    const cleanBlocks = blocks.map((b) => b.trim()).filter(Boolean);
    const existing = editingPostId ? store.posts.find((p) => p.id === editingPostId) : undefined;
    const scheduledAt =
      status === 'queued'
        ? targetScheduledAt ||
          existing?.scheduledAt ||
          findNextOpenSlot(store.queueSlots, store.posts)
        : existing?.scheduledAt;

    return {
      id: existing?.id || `post-${Date.now()}`,
      accountId: activeAccount.id,
      blocks: cleanBlocks,
      status,
      format: cleanBlocks.length > 1 ? 'thread' : format,
      scheduledAt,
      publishedAt: existing?.publishedAt,
      frameworkName,
      trigger,
      sourceRadarId,
      predictiveScore: score.total,
      automations,
      metrics: existing?.metrics ?? {
        impressions: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        bookmarks: 0,
        offerClicks: 0,
      },
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
  };

  const handlePersistPost = async (mode: 'draft' | 'queued' | 'publish') => {
    const cleanBlocks = blocks.map((b) => b.trim()).filter(Boolean);
    if (cleanBlocks.length === 0) {
      onNotify('Write at least one post block before saving.', 'error');
      return;
    }
    setSavingAction(mode);
    try {
      const record = buildPostRecord(mode === 'publish' ? 'queued' : mode);
      const exists = store.posts.some((p) => p.id === record.id);
      const nextPosts = exists
        ? store.posts.map((p) => (p.id === record.id ? record : p))
        : [record, ...store.posts];

      await onSaveStore({ posts: nextPosts });
      setEditingPostId(record.id);

      if (mode === 'publish') {
        await onPublishPost(record.id);
      } else if (mode === 'queued') {
        setTargetScheduledAt(undefined);
        onNotify(
          `Added to ${activeAccount.handle} Queue for ${new Date(record.scheduledAt!).toLocaleString(
            [],
            { weekday: 'short', hour: '2-digit', minute: '2-digit' }
          )} (Score ${score.total}/100).`
        );
      } else {
        onNotify('Saved draft to My Queue -> Drafts.');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save post.', 'error');
    } finally {
      setSavingAction(null);
    }
  };

  const gradeTone =
    score.grade === 'S-Tier'
      ? 'text-emerald-600 dark:text-emerald-400'
      : score.grade === 'Strong'
        ? 'text-sky-600 dark:text-sky-400'
        : score.grade === 'Average'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';

  const pillars = [
    { label: 'Hook Stopping Power', value: score.hookScore, max: 25 },
    { label: 'Persuasion Psychology', value: score.persuasionScore, max: 25 },
    { label: 'Scroll Readability', value: score.readabilityScore, max: 25 },
    { label: 'Conversion & Persona Fit', value: score.conversionScore, max: 25 },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar — Strictly ONE primary Apple Blue CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Write &amp; Copy Lab
          </h2>
          <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
            Thread composer paired with 0–100 predictive scoring, Eugene Schwartz awareness diagnostics, and 5x A/B ranking.
          </p>
        </div>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={savingAction !== null}
            onClick={() => handlePersistPost('draft')}
            className="apple-btn-secondary px-4 py-2 text-xs sm:text-sm"
          >
            {savingAction === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="button"
            disabled={savingAction !== null}
            onClick={() => handlePersistPost('publish')}
            className="apple-btn-secondary px-4 py-2 text-xs sm:text-sm"
          >
            <Send className="h-3.5 w-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
            <span>
              {savingAction === 'publish'
                ? 'Publishing...'
                : activeAccount.xMode === 'live'
                  ? 'Publish via X API'
                  : 'Publish (Sandbox)'}
            </span>
          </button>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(blocks[0] || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="apple-btn-secondary px-4 py-2 text-xs sm:text-sm"
          >
            <span>Post on X ($0)</span>
          </a>
          <button
            type="button"
            disabled={savingAction !== null}
            onClick={() => handlePersistPost('queued')}
            className="apple-btn-primary px-5 py-2 text-xs sm:text-sm"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{savingAction === 'queued' ? 'Queuing...' : 'Add to Queue'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Connected-Rail Composer + Automations + 5x A/B Arena */}
        <div className="xl:col-span-7 space-y-6">
          <section className="apple-card p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D]">
                <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {activeAccount.handle}
                </span>
                <span aria-hidden="true">·</span>
                <span>{blocks.length > 1 ? `Thread (${blocks.length} tweets)` : 'Single post'}</span>
                {targetScheduledAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#0071E3] dark:text-[#0A84FF] font-medium tabular-nums">
                      Slot:{' '}
                      {new Date(targetScheduledAt).toLocaleString([], {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </>
                )}
              </div>
              <select
                aria-label="Load copywriting framework skeleton"
                value=""
                onChange={(e) => {
                  const fw = COPY_FRAMEWORKS.find((f) => f.id === e.target.value);
                  if (!fw) return;
                  setFrameworkName(fw.name);
                  setTrigger(fw.trigger);
                  setBlocks([fw.skeleton]);
                  onNotify(`Loaded "${fw.name}" structure.`);
                }}
                className="max-w-[220px] truncate rounded-full bg-[#F5F5F7] dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] px-3.5 py-1.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]"
              >
                <option value="">Insert Copy Framework...</option>
                {COPY_FRAMEWORKS.map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.name} ({fw.trigger})
                  </option>
                ))}
              </select>
            </div>

            {/* AI Ghostwriter Quiet Action Strip */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mr-1 flex items-center gap-1">
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                Ghostwriter
              </span>
              {(
                [
                  { id: 'rewrite', label: 'Sharpen' },
                  { id: 'hooks', label: '3 Hooks' },
                  { id: 'expand-thread', label: 'To Thread' },
                  { id: 'finish', label: 'Finish' },
                  { id: 'tone-shift', label: 'Authority Tone' },
                ] as const
              ).map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  disabled={ghostLoading !== null}
                  onClick={() => handleGhostwrite(tool.id)}
                  className="px-2.5 py-1 rounded-full bg-black/[0.045] hover:bg-black/[0.085] dark:bg-white/[0.07] dark:hover:bg-white/[0.13] text-xs font-medium text-[#1D1D1F] dark:text-[#E5E5EA] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {ghostLoading === tool.id ? 'Working...' : tool.label}
                </button>
              ))}
            </div>

            {/* Connected Avatar-Rail Thread Composer */}
            <div className="space-y-3">
              {blocks.map((block, idx) => {
                const chars = countTweetChars(block);
                const overLimit = chars > maxChars;
                return (
                  <div key={idx} className="flex items-stretch gap-3.5">
                    <div className="flex flex-col items-center shrink-0 pt-2.5">
                      <img
                        src={activeAccount.avatarUrl}
                        alt={activeAccount.name}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
                      />
                      {idx < blocks.length - 1 && (
                        <div className="w-[1.5px] flex-1 bg-black/[0.09] dark:bg-white/[0.12] my-1.5 rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 apple-subsurface p-4 focus-within:bg-white dark:focus-within:bg-[#242426] focus-within:border-[#0071E3] dark:focus-within:border-[#0A84FF] focus-within:ring-4 focus-within:ring-[#0071E3]/10 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {activeAccount.name}
                          </span>{' '}
                          {activeAccount.handle}
                          {blocks.length > 1 ? ` · ${idx + 1}/${blocks.length}` : ''}
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-xs tabular-nums ${
                              overLimit
                                ? 'text-[#FF3B30] dark:text-[#FF453A] font-semibold'
                                : chars > maxChars - 30
                                  ? 'text-[#FF9500] dark:text-[#FF9F0A]'
                                  : 'text-[#86868B]'
                            }`}
                          >
                            {chars} / {maxChars}
                          </span>
                          {blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBlock(idx)}
                              aria-label={`Remove tweet ${idx + 1}`}
                              className="text-[#86868B] hover:text-[#FF3B30] transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={idx === 0 ? 5 : 3}
                        value={block}
                        onChange={(e) => updateBlock(idx, e.target.value)}
                        placeholder={
                          idx === 0
                            ? 'Write your scroll-stopping hook and value here...'
                            : 'Add next tweet to thread...'
                        }
                        className="w-full resize-y bg-transparent text-[14.5px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pl-12 pt-1">
              <button
                type="button"
                onClick={addThreadBlock}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071E3] dark:text-[#0A84FF] hover:opacity-80"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Tweet to Thread</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPostId(undefined);
                  setTargetScheduledAt(undefined);
                  setBlocks(['']);
                  setFormat('single');
                }}
                className="text-xs text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:text-[#F5F5F7]"
              >
                Clear composer
              </button>
            </div>
          </section>

          {/* Per-Post Monetization & Automations */}
          <section className="apple-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Post Monetization &amp; Automations
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                  Linked Offer (Whop / Affiliate / Course)
                </label>
                <select
                  value={automations.linkedOfferId || ''}
                  onChange={(e) => handleOfferChange(e.target.value)}
                  className="apple-input"
                >
                  <option value="">None</option>
                  {store.brandBrain.offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.priceLabel})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                  Thread Delay Between Replies (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={automations.threadDelayMinutes}
                  onChange={(e) =>
                    setAutomations((prev) => ({
                      ...prev,
                      threadDelayMinutes: Number(e.target.value) || 0,
                    }))
                  }
                  className="apple-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Auto-Plug Reply
                  </div>
                  <div className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                    Automatically reply with your offer or Lead Magnet PDF link after posting.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={automations.autoPlugEnabled}
                  onChange={(e) =>
                    setAutomations((prev) => ({ ...prev, autoPlugEnabled: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#0071E3]"
                />
              </label>
              {automations.autoPlugEnabled && (
                <textarea
                  rows={2}
                  value={automations.autoPlugText}
                  onChange={(e) =>
                    setAutomations((prev) => ({ ...prev, autoPlugText: e.target.value }))
                  }
                  placeholder="P.S. Grab the free playbook + offer here..."
                  className="apple-input"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-xs">
              <label className="flex items-center gap-2 text-[#3A3A3C] dark:text-[#E5E5EA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={automations.autoRetweetEnabled}
                  onChange={(e) =>
                    setAutomations((prev) => ({ ...prev, autoRetweetEnabled: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Auto-RT (+{automations.autoRetweetDelayHours}h)</span>
              </label>
              <label className="flex items-center gap-2 text-[#3A3A3C] dark:text-[#E5E5EA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={automations.isEvergreen}
                  onChange={(e) =>
                    setAutomations((prev) => ({ ...prev, isEvergreen: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Evergreen ({automations.evergreenIntervalDays}d)</span>
              </label>
              <label className="flex items-center gap-2 text-[#3A3A3C] dark:text-[#E5E5EA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={automations.autoDeleteEnabled}
                  onChange={(e) =>
                    setAutomations((prev) => ({ ...prev, autoDeleteEnabled: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Auto-Delete ({automations.autoDeleteAfterHours}h)</span>
              </label>
            </div>
          </section>

          {/* 5-Variation A/B Copy Arena */}
          <section className="apple-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#FF9500]" aria-hidden="true" />
                  5-Variation A/B Copy Arena
                </h3>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                  Generate 5 competing angles tailored to {store.brandBrain.niche} and auto-rank the winner.
                </p>
              </div>
              {abEngine && (
                <span className="text-xs font-mono text-[#6E6E73] dark:text-[#98989D]">
                  {abEngine}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={abTopic}
                onChange={(e) => setAbTopic(e.target.value)}
                placeholder={`Topic inside ${store.brandBrain.niche}...`}
                className="md:col-span-5 apple-input"
              />
              <input
                type="text"
                value={abInsight}
                onChange={(e) => setAbInsight(e.target.value)}
                placeholder="Key insight or proof (optional)"
                className="md:col-span-4 apple-input"
              />
              <button
                type="button"
                disabled={abLoading}
                onClick={handleRunAbArena}
                className="md:col-span-3 apple-btn-secondary px-4 py-2.5 text-sm font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>{abLoading ? 'Ranking...' : 'Generate 5x'}</span>
              </button>
            </div>

            {abVariations.length > 0 && (
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
                {abVariations.map((v, i) => (
                  <div key={v.id} className="py-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                          #{i + 1} · {v.score.total}/100
                        </span>
                        {i === 0 && (
                          <span className="text-[#248A3D] dark:text-[#30D158] font-semibold">
                            Top Winner
                          </span>
                        )}
                        <span aria-hidden="true" className="text-[#D1D1D6] dark:text-[#3A3A3C]">·</span>
                        <span className="text-[#6E6E73] dark:text-[#98989D]">{v.frameworkName}</span>
                        <span aria-hidden="true" className="text-[#D1D1D6] dark:text-[#3A3A3C]">·</span>
                        <span className="text-[#6E6E73] dark:text-[#98989D]">{v.score.awarenessStage}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBlocks(v.blocks);
                          setFrameworkName(v.frameworkName);
                          setTrigger(v.trigger);
                          setFormat(v.blocks.length > 1 ? 'thread' : 'single');
                          onNotify(`Loaded variation #${i + 1} (${v.score.total}/100) into composer.`);
                        }}
                        className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline"
                      >
                        Load into Editor
                      </button>
                    </div>
                    <p className="text-sm text-[#3A3A3C] dark:text-[#D1D1D6] whitespace-pre-line line-clamp-4 leading-relaxed">
                      {v.blocks[0]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Apple Segmented 3-Tab Split Inspector */}
        <div className="xl:col-span-5 space-y-4 xl:sticky xl:top-20">
          <div className="apple-segmented grid grid-cols-3 w-full">
            {(
              [
                { id: 'score', label: `Score (${score.total})` },
                { id: 'inspiration', label: 'Viral Inspo' },
                { id: 'preview', label: 'X Preview' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRightTab(t.id)}
                className={`py-1.5 rounded-[9px] text-xs font-medium transition-all ${
                  rightTab === t.id ? 'apple-segment-active' : 'apple-segment-idle'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Predictive Score + Eugene Schwartz Awareness + X Algorithm Signals */}
          {rightTab === 'score' && (
            <section className="apple-card p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                    Predictive Performance Score
                  </div>
                  <div className="mt-1 flex items-baseline gap-2.5">
                    <span className="font-mono text-[2.5rem] leading-none font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                      {score.total}
                    </span>
                    <span className="text-sm font-mono text-[#86868B]">/ 100</span>
                    <span className={`text-sm font-semibold ${gradeTone}`}>{score.grade}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-[#6E6E73] dark:text-[#98989D] space-y-1 tabular-nums">
                  <div>
                    Awareness:{' '}
                    <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {score.awarenessStage}
                    </span>
                  </div>
                  <div>Grade {score.readingGrade} · {activePersona?.name ?? 'Default'}</div>
                </div>
              </div>

              {/* X Algorithm Signal Forecast (Bookmark / Reply / Dwell) */}
              <div className="apple-subsurface grid grid-cols-3 divide-x divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
                {[
                  { label: 'Bookmark Pull', value: score.algorithmSignals.bookmarkPull },
                  { label: 'Reply Pull', value: score.algorithmSignals.replyPull },
                  { label: 'Dwell Pull', value: score.algorithmSignals.dwellPull },
                ].map((sig) => (
                  <div key={sig.label} className="px-3.5 py-3">
                    <div className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
                      {sig.label}
                    </div>
                    <div className="mt-0.5 font-mono text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                      {sig.value}
                      <span className="text-[11px] font-normal text-[#86868B]">%</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-black/[0.07] dark:bg-white/[0.1] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0071E3] dark:bg-[#0A84FF] transition-all"
                        style={{ width: `${sig.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-1">
                {pillars.map((p) => {
                  const pct = Math.round((p.value / p.max) * 100);
                  return (
                    <div key={p.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#515154] dark:text-[#D1D1D6]">{p.label}</span>
                        <span className="font-mono font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                          {p.value} / {p.max}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.09] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 80
                              ? 'bg-[#34C759]'
                              : pct >= 60
                                ? 'bg-[#0071E3] dark:bg-[#0A84FF]'
                                : 'bg-[#FF9500]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {score.clichesFound.length > 0 && (
                <div className="rounded-[12px] border border-[#FF3B30]/25 bg-[#FF3B30]/[0.06] dark:bg-[#FF453A]/10 p-3.5 flex items-start gap-2.5 text-xs text-[#D70015] dark:text-[#FF6961]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-semibold">AI Cliché Alert:</span> Remove{' '}
                    {score.clichesFound.map((c) => `"${c}"`).join(', ')}.
                  </div>
                </div>
              )}

              <div className="space-y-3.5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-xs">
                {score.strengths.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      What&apos;s Working
                    </div>
                    {score.strengths.map((s, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[#515154] dark:text-[#A1A1A6]">
                        <Check className="h-3.5 w-3.5 text-[#34C759] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {score.suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      How to Push Toward 90+
                    </div>
                    {score.suggestions.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[#515154] dark:text-[#A1A1A6]">
                        <span className="text-[#0071E3] dark:text-[#0A84FF] font-bold shrink-0">→</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 2: Side-by-Side Viral Inspiration */}
          {rightTab === 'inspiration' && (
            <section className="apple-card p-5 space-y-3.5">
              <div className="relative">
                <Search
                  className="h-3.5 w-3.5 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={inspoSearch}
                  onChange={(e) => setInspoSearch(e.target.value)}
                  placeholder="Search viral hooks beside your composer..."
                  className="apple-input pl-9 text-xs"
                />
              </div>

              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] max-h-[540px] overflow-y-auto pr-1">
                {filteredInspiration.map((tweet) => (
                  <div key={tweet.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {tweet.authorHandle}
                      </span>
                      <span className="font-mono text-[#248A3D] dark:text-[#30D158] flex items-center gap-1 tabular-nums">
                        <Flame className="h-3 w-3" aria-hidden="true" />
                        {tweet.outlierMultiplier.toFixed(1)}x
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#3A3A3C] dark:text-[#D1D1D6] whitespace-pre-line line-clamp-5">
                      {tweet.text}
                    </p>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="font-mono text-[11px] text-[#86868B] tabular-nums leading-snug">
                        {tweet.likes.toLocaleString()} likes · {tweet.hookFormula}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setBlocks([tweet.text]);
                          setFrameworkName(tweet.hookFormula);
                          setTrigger(tweet.trigger);
                          onNotify(`Loaded viral pattern from ${tweet.authorHandle}.`);
                        }}
                        className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline shrink-0 whitespace-nowrap"
                      >
                        Remix →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB 3: Live X Preview */}
          {rightTab === 'preview' && (
            <section className="apple-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-[#86868B]" aria-hidden="true" />
                  Live X Timeline Preview
                </h3>
                <span className="text-xs text-[#86868B]">Mobile fold ~280 chars</span>
              </div>

              <div className="space-y-4">
                {blocks.map((block, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <img
                        src={activeAccount.avatarUrl}
                        alt={activeAccount.name}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
                      />
                      {idx < blocks.length - 1 && (
                        <div className="w-[1.5px] flex-1 min-h-6 bg-black/[0.1] dark:bg-white/[0.14] mt-1.5 rounded-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                          {activeAccount.name}
                        </span>
                        <span className="text-[#6E6E73] dark:text-[#98989D] truncate">
                          {activeAccount.handle}
                        </span>
                        <span className="text-[#86868B]">· now</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[#1D1D1F] dark:text-[#E5E5EA] whitespace-pre-wrap break-words">
                        {block || 'Your post preview will appear here...'}
                      </p>
                    </div>
                  </div>
                ))}

                {automations.autoPlugEnabled && automations.autoPlugText.trim() && (
                  <div className="ml-13 pt-3 border-t border-dashed border-black/[0.08] dark:border-white/[0.1] text-xs text-[#6E6E73] dark:text-[#98989D]">
                    <span className="font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                      Auto-Plug (+{automations.autoPlugDelayMinutes}m):
                    </span>{' '}
                    {automations.autoPlugText}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
