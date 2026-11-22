import React, { useState } from 'react';
import {
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  PenTool,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { findNextOpenSlot } from '../lib/scheduler';
import type { GhostPilotStore, PostItem, RadarItem } from '../lib/types';

interface SimpleIdeasViewProps {
  store: GhostPilotStore;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onOpenQueue: () => void;
  onOpenPdfs: () => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function SimpleIdeasView({
  store,
  onUpdateStore,
  onReplaceStore,
  onOpenQueue,
  onOpenPdfs,
  onNotify,
}: SimpleIdeasViewProps) {
  const [scanning, setScanning] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [extractingUrl, setExtractingUrl] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'post' | 'pdf' | null>(null);

  const activeBrain = store.brandBrain;
  const primaryOffer = activeBrain.offers[0];

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
          ? `Found ${res.liveCount} fresh live ideas across Reddit, News, and GitHub ($0).`
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
          autoRetweetEnabled: false,
          autoRetweetDelayHours: 8,
          autoUnretweetAfterHours: 24,
          autoDeleteEnabled: false,
          autoDeleteAfterHours: 0,
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
      });
      await onUpdateStore({ leadMagnets: [res.leadMagnet, ...store.leadMagnets] });
      onNotify(`Created Free PDF "${res.leadMagnet.title}" with your Whop offer embedded!`);
      onOpenPdfs();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'PDF creation failed.', 'error');
    } finally {
      setBusyItemId(null);
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header + Single Primary Scan CTA */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Find Fresh Ideas ($0)
          </h2>
          <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
            Pull real buyer questions from Reddit, Google News, and GitHub for{' '}
            <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              {activeBrain.niche}
            </span>{' '}
            — or paste any Whop or competitor link below.
          </p>
        </div>

        <button
          type="button"
          onClick={handleScanIdeas}
          disabled={scanning}
          className="apple-btn-primary px-5 py-2.5 text-sm whitespace-nowrap shrink-0"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{scanning ? 'Scanning Live Feeds...' : 'Find Fresh Ideas ($0)'}</span>
        </button>
      </div>

      {/* Paste Any Link ($0 Jina Reader) */}
      <form onSubmit={handleExtractUrl} className="apple-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          <Globe className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
          <span>Turn Any Whop Page, Article, or GitHub Link Into an Idea ($0)</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste https://whop.com/... or any article/repo link"
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

      {/* Clean Scraped Ideas List */}
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
              Find Fresh Ideas ($0)
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
                        ? `Fresh buyer signal in ${activeBrain.niche} — click Write Post or Make Free PDF to turn this into content.`
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
                    <span>{isPdfing ? 'Building...' : 'Make Free PDF'}</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
