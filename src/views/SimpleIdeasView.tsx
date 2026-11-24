import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  FileText,
  Flame,
  Globe,
  Loader2,
  PenTool,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { findNextOpenSlot } from '../lib/scheduler';
import type { GhostPilotStore, PostItem, RadarItem, ViralTweet } from '../lib/types';

interface SimpleIdeasViewProps {
  store: GhostPilotStore;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onOpenQueue: () => void;
  onOpenPdfs: () => void;
  onLoadDraftInWrite?: (blocks: string[]) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function SimpleIdeasView({
  store,
  onUpdateStore,
  onReplaceStore,
  onOpenQueue,
  onOpenPdfs,
  onLoadDraftInWrite,
  onNotify,
}: SimpleIdeasViewProps) {
  const [tab, setTab] = useState<'radar' | 'viral'>('radar');
  const [scanning, setScanning] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [extractingUrl, setExtractingUrl] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'post' | 'pdf' | null>(null);

  // Branch 1: Viral Library filter & remix state
  const [viralQuery, setViralQuery] = useState('');
  const [viralFormat, setViralFormat] = useState<'all' | 'single' | 'thread'>('all');
  const [remixingId, setRemixingId] = useState<string | null>(null);

  const activeBrain = store.brandBrain;
  const primaryOffer = activeBrain.offers[0];

  const filteredVirals = useMemo(() => {
    const q = viralQuery.trim().toLowerCase();
    return (store.viralTweets || []).filter((vt) => {
      if (viralFormat !== 'all' && vt.format !== viralFormat) return false;
      if (!q) return true;
      return (
        vt.text.toLowerCase().includes(q) ||
        vt.hookFormula.toLowerCase().includes(q) ||
        vt.niche.toLowerCase().includes(q) ||
        vt.trigger.toLowerCase().includes(q)
      );
    });
  }, [store.viralTweets, viralQuery, viralFormat]);

  const handleScanIdeas = async () => {
    setScanning(true);
    try {
      const res = await api.scanRadar({
        niche: activeBrain.niche,
        subreddits: activeBrain.subreddits,
        customRssUrls: activeBrain.customRssUrls,
        includeGithub: true,
      });
      await onUpdateStore({ radarItems: res.items });
      onNotify(
        res.liveCount > 0
          ? `Found ${res.liveCount} fresh live ideas across 7 free sources ($0).`
          : 'Loaded your saved niche ideas.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Scan failed.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleExtractUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setExtractingUrl(true);
    try {
      const res = await api.extractUrl({ url: urlInput.trim(), saveToRadar: true });
      onReplaceStore(res.store);
      setUrlInput('');
      onNotify(`Extracted "${res.title}" ($0) and added it to the top of your Ideas.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not extract that URL.', 'error');
    } finally {
      setExtractingUrl(false);
    }
  };

  const handleTurnIntoPost = async (item: RadarItem) => {
    setBusyItemId(item.id);
    setBusyAction('post');
    try {
      const res = await api.generateAbCopy({
        topic: item.title,
        keyInsight: item.summary,
        offerId: primaryOffer?.id,
        useGemini: true,
      });
      const best = res.variations[0];
      if (!best) throw new Error('Could not generate a post for that idea.');

      const nextSlot = findNextOpenSlot(store.queueSlots, store.posts, new Date());
      const newPost: PostItem = {
        id: `post-idea-${Date.now()}`,
        accountId: store.activeAccountId,
        blocks: best.blocks,
        status: 'queued',
        format: best.blocks.length > 1 ? 'thread' : 'single',
        scheduledAt: nextSlot,
        frameworkName: best.frameworkName,
        trigger: best.trigger,
        sourceRadarId: item.id,
        predictiveScore: best.score.total,
        automations: {
          threadDelayMinutes: 0,
          autoPlugEnabled: Boolean(primaryOffer?.autoPlugTemplate),
          autoPlugText: primaryOffer?.autoPlugTemplate || '',
          autoPlugDelayMinutes: 30,
          autoPlugMinLikes: 0,
          autoRetweetEnabled: store.globalAutomationDefaults.autoRetweetEnabled,
          autoRetweetDelayHours: 8,
          autoUnretweetAfterHours: 24,
          autoDeleteEnabled: store.globalAutomationDefaults.autoDeleteEnabled,
          autoDeleteAfterHours: 48,
          isEvergreen: true,
          evergreenIntervalDays: 14,
          linkedOfferId: primaryOffer?.id,
        },
        metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
        createdAt: new Date().toISOString(),
      };
      await onUpdateStore({ posts: [newPost, ...store.posts] });
      onNotify('Post written and added to your Queue! Ready to send to Telegram.');
      onOpenQueue();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Post generation failed.', 'error');
    } finally {
      setBusyItemId(null);
      setBusyAction(null);
    }
  };

  const handleMakeFreePdf = async (item: RadarItem) => {
    setBusyItemId(item.id);
    setBusyAction('pdf');
    try {
      const res = await api.generateLeadMagnet({
        topic: item.title,
        format: 'Playbook',
        offerId: primaryOffer?.id,
        requireEmailGate: true,
      });
      await onUpdateStore({ leadMagnets: [res.leadMagnet, ...store.leadMagnets] });
      onNotify(`Created 7-Chapter Paid-Worth PDF "${res.leadMagnet.title}" with your Affiliate Group bridge!`);
      onOpenPdfs();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'PDF creation failed.', 'error');
    } finally {
      setBusyItemId(null);
      setBusyAction(null);
    }
  };

  const handleRemixViral = async (vt: ViralTweet, scheduleNow: boolean) => {
    setRemixingId(vt.id);
    try {
      const res = await api.remixViralTweet({
        viralText: vt.text,
        hookFormula: vt.hookFormula,
        scheduleNow,
      });
      onReplaceStore(res.store);
      if (scheduleNow) {
        onNotify(`Remixed "${vt.hookFormula}" for ${activeBrain.niche} and scheduled to Queue!`);
        onOpenQueue();
      } else if (onLoadDraftInWrite) {
        onLoadDraftInWrite(res.blocks);
        onNotify(`Loaded humanized viral remix into Quick Write!`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Viral remix failed.', 'error');
    } finally {
      setRemixingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + 2-Tab Segmented Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Ideas &amp; Viral Library ($0)
          </h2>
          <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
            Pull fresh live signals from 7 free sources or remix proven viral hooks for{' '}
            <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              {activeBrain.niche}
            </span>
            .
          </p>
        </div>

        <div className="apple-segmented self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab('radar')}
            className={`px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'radar' ? 'apple-segment-active' : 'apple-segment-idle'
            }`}
          >
            Live 7-Source Radar ({store.radarItems.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('viral')}
            className={`px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'viral' ? 'apple-segment-active' : 'apple-segment-idle'
            }`}
          >
            Viral Library &amp; Remix ({store.viralTweets.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE 7-SOURCE RADAR */}
      {tab === 'radar' && (
        <div className="space-y-6">
          <form onSubmit={handleExtractUrl} className="apple-card p-5 sm:p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                <Globe className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>Turn Any YouTube Video, Whop Page, or Link Into Content ($0)</span>
              </div>
              <button
                type="button"
                onClick={handleScanIdeas}
                disabled={scanning}
                className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap shrink-0"
              >
                {scanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{scanning ? 'Scanning 7 Sources...' : 'Scan 7 Live Sources ($0)'}</span>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste https://youtube.com/watch?v=..., https://whop.com/..., or any link"
                className="apple-input flex-1 text-sm"
              />
              <button
                type="submit"
                disabled={extractingUrl || !urlInput.trim()}
                className="apple-btn-secondary px-5 py-2.5 text-sm whitespace-nowrap shrink-0"
              >
                {extractingUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{extractingUrl ? 'Reading Page...' : 'Extract ($0)'}</span>
              </button>
            </div>
          </form>

          <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {store.radarItems.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
                  No ideas loaded for this account yet.
                </p>
                <button
                  type="button"
                  onClick={handleScanIdeas}
                  disabled={scanning}
                  className="apple-btn-primary px-5 py-2.5 text-sm"
                >
                  Scan 7 Live Sources ($0)
                </button>
              </div>
            ) : (
              store.radarItems.slice(0, 14).map((item) => {
                const isWriting = busyItemId === item.id && busyAction === 'post';
                const isPdfing = busyItemId === item.id && busyAction === 'pdf';
                return (
                  <article
                    key={item.id}
                    className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="text-xs text-[#6E6E73] dark:text-[#86868B] flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#1D1D1F] dark:text-[#D1D1D6]">
                          {item.source}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.sourceDetail}</span>
                        {item.url && (
                          <>
                            <span aria-hidden="true">·</span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0071E3] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1"
                            >
                              <span>Source</span>
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          </>
                        )}
                      </div>
                      <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#515154] dark:text-[#A1A1A6] line-clamp-2">
                        {(() => {
                          const clean = (item.summary || '')
                            .replace(/<[^>]*>/g, ' ')
                            .replace(/<[^>]*$/g, ' ')
                            .replace(/&[a-z#0-9]+;?/gi, ' ')
                            .replace(/https?:\/\/news\.google\.com\/rss\/articles\/\S*/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                          const isRedundant =
                            !clean ||
                            clean.length < 24 ||
                            clean.toLowerCase().startsWith(item.title.trim().slice(0, 24).toLowerCase());
                          return isRedundant
                            ? `Fresh buyer signal in ${activeBrain.niche} — click Write Post or Make Paid-Worth PDF to turn this into content.`
                            : clean;
                        })()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTurnIntoPost(item)}
                        disabled={Boolean(busyItemId)}
                        className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap"
                      >
                        {isWriting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <PenTool className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{isWriting ? 'Writing...' : 'Write Post'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMakeFreePdf(item)}
                        disabled={Boolean(busyItemId)}
                        className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        {isPdfing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{isPdfing ? 'Building...' : 'Make Paid-Worth PDF'}</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* TAB 2: VIRAL LIBRARY & 1-CLICK REMIX (TWEET HUNTER BRANCH 1) */}
      {tab === 'viral' && (
        <div className="space-y-6">
          <div className="apple-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search
                className="h-4 w-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={viralQuery}
                onChange={(e) => setViralQuery(e.target.value)}
                placeholder="Search viral hooks, triggers, or frameworks..."
                aria-label="Search viral tweet library"
                className="apple-input pl-10 text-sm"
              />
            </div>
            <div className="apple-segmented self-start sm:self-auto">
              {(['all', 'single', 'thread'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setViralFormat(fmt)}
                  className={`px-3 py-1.5 rounded-[9px] text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                    viralFormat === fmt ? 'apple-segment-active' : 'apple-segment-idle'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {filteredVirals.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6E6E73] dark:text-[#86868B]">
                No viral hooks match that filter. Clear search to view all proven frameworks.
              </div>
            ) : (
              filteredVirals.map((vt) => (
                <article key={vt.id} className="p-5 sm:p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6E73] dark:text-[#86868B] tabular-nums">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {vt.hookFormula}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{vt.trigger}</span>
                      <span aria-hidden="true">·</span>
                      <span>{vt.outlierMultiplier}× Outlier</span>
                      <span aria-hidden="true">·</span>
                      <span>{vt.bookmarks.toLocaleString()} bookmarks</span>
                    </div>
                    <span className="font-mono">{vt.authorHandle}</span>
                  </div>

                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {vt.text}
                  </p>

                  {vt.anatomyNotes && (
                    <p className="text-xs text-[#6E6E73] dark:text-[#86868B]">
                      Why it converts: {vt.anatomyNotes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRemixViral(vt, true)}
                      disabled={remixingId === vt.id}
                      className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap"
                    >
                      {remixingId === vt.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>Remix &amp; Schedule for {activeBrain.niche} ($0)</span>
                    </button>
                    {onLoadDraftInWrite && (
                      <button
                        type="button"
                        onClick={() => handleRemixViral(vt, false)}
                        disabled={remixingId === vt.id}
                        className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        Remix in Quick Write
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}

