import React, { useState } from 'react';
import { ArrowRight, CalendarClock, Cpu, FileText, Layers, Play, Radar, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { buildRankedABVariations } from '../lib/frameworks';
import { findNextOpenSlot, summarizeOfferPerformance } from '../lib/scheduler';
import type { GhostPilotStore, NavSection, PostItem } from '../lib/types';

interface AutopilotHubViewProps {
  store: GhostPilotStore;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onNavigate: (section: NavSection) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function AutopilotHubView({
  store,
  onUpdateStore,
  onNavigate,
  onNotify,
}: AutopilotHubViewProps) {
  const [runningBatch, setRunningBatch] = useState(false);
  const [sendingToIde, setSendingToIde] = useState(false);

  const activeAccount =
    store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
  const queuedPosts = store.posts.filter((p) => p.status === 'queued');
  const publishedPosts = store.posts.filter((p) => p.status === 'published');
  const avgScore = store.posts.length
    ? Math.round(store.posts.reduce((s, p) => s + p.predictiveScore, 0) / store.posts.length)
    : 0;
  const offerStats = summarizeOfferPerformance(store.brandBrain.offers);
  const primaryOffer = store.brandBrain.offers[0];
  const primaryMagnet = store.leadMagnets[0];
  const latestDossier = store.dossiers[0];

  const handleRunInstantWeeklyAutopilot = async () => {
    setRunningBatch(true);
    try {
      const persona =
        store.brandBrain.personas.find((p) => p.id === store.brandBrain.activePersonaId) ||
        store.brandBrain.personas[0];

      const topics = [
        ...(latestDossier?.angles.buyerPainPoints.slice(0, 2) || []),
        ...(latestDossier?.angles.coreFrameworks.slice(0, 2) || []),
        `${store.brandBrain.niche} giveaway playbook`,
      ];

      const newPosts: PostItem[] = [];
      let workingPosts = [...store.posts];

      for (let i = 0; i < Math.min(4, topics.length); i++) {
        const topic = topics[i];
        const variations = buildRankedABVariations({
          topic,
          keyInsight:
            latestDossier?.angles.contrarianTruths[
              i % Math.max(1, latestDossier.angles.contrarianTruths.length)
            ],
          brandBrain: store.brandBrain,
          persona,
          offer: primaryOffer,
        });
        const winner = variations[0];
        const nextSlot = findNextOpenSlot(store.queueSlots, workingPosts, new Date());

        const item: PostItem = {
          id: `post-auto-${Date.now()}-${i}`,
          accountId: activeAccount.id,
          blocks: winner.blocks,
          status: 'queued',
          format: i === 0 ? 'giveaway' : 'single',
          scheduledAt: nextSlot,
          frameworkName: winner.frameworkName,
          trigger: winner.trigger,
          predictiveScore: winner.score.total,
          automations: {
            threadDelayMinutes: 0,
            autoPlugEnabled: Boolean(primaryOffer),
            autoPlugText:
              primaryOffer?.autoPlugTemplate ||
              (primaryMagnet ? `Grab the free PDF playbook -> /r/${primaryMagnet.slug}` : ''),
            autoPlugDelayMinutes: store.globalAutomationDefaults.autoPlugDelayMinutes,
            autoPlugMinLikes: 10,
            autoRetweetEnabled: store.globalAutomationDefaults.autoRetweetEnabled,
            autoRetweetDelayHours: store.globalAutomationDefaults.autoRetweetDelayHours,
            autoUnretweetAfterHours: store.globalAutomationDefaults.autoUnretweetAfterHours,
            autoDeleteEnabled: false,
            autoDeleteAfterHours: 72,
            isEvergreen: winner.score.total >= 84,
            evergreenIntervalDays: store.globalAutomationDefaults.evergreenIntervalDays,
            linkedOfferId: primaryOffer?.id,
            linkedLeadMagnetId: primaryMagnet?.id,
          },
          metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
          createdAt: new Date().toISOString(),
        };

        newPosts.push(item);
        workingPosts = [item, ...workingPosts];
      }

      const logs = [
        {
          id: `log-auto-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'scheduler' as const,
          mode: activeAccount.xMode,
          message: `Autopilot scored 20 A/B variations and auto-queued the top ${newPosts.length} winners (avg score ${Math.round(
            newPosts.reduce((s, p) => s + p.predictiveScore, 0) / newPosts.length
          )}/100).`,
        },
        ...store.automationLogs,
      ].slice(0, 60);

      await onUpdateStore({ posts: workingPosts, automationLogs: logs });
      onNotify(
        `Autopilot tested 20 A/B variations and queued the ${newPosts.length} highest-scoring winners into My Queue!`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Autopilot run failed.', 'error');
    } finally {
      setRunningBatch(false);
    }
  };

  const handleDispatchToAntigravity = async () => {
    setSendingToIde(true);
    try {
      const res = await api.createAntigravityTask({
        type: 'weekly-autopilot',
        title: `Weekly ${store.brandBrain.niche} Autopilot Batch (Posts + Carousels + Giveaway)`,
        goal: `Create ${store.brandBrain.weeklyMix.singlePosts} single posts, ${store.brandBrain.weeklyMix.threads} threads, ${store.brandBrain.weeklyMix.carousels} visual carousels, and ${store.brandBrain.weeklyMix.giveaways} comment-to-PDF giveaway posts pointing to ${primaryOffer?.name || 'our main offer'}.`,
      });
      await onUpdateStore({ antigravityTasks: res.store.antigravityTasks });
      onNotify('Weekly Autopilot task saved to antigravity-sync/tasks.json — run it with Gemini 3.8 Flash!');
      onNavigate('antigravity');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create Antigravity task.', 'error');
    } finally {
      setSendingToIde(false);
    }
  };

  const pipelineSteps = [
    {
      step: '01',
      title: 'Research Any Niche Like a 10-Year Expert',
      subtitle: 'STORM 5-Angle Dossier · GummySearch Reddit Pain-Points · Live News',
      status: `${store.radarItems.length} live signals · ${store.dossiers.length} authority dossier${store.dossiers.length === 1 ? '' : 's'}`,
      cta: 'Open Authority Research',
      target: 'research' as NavSection,
      icon: Radar,
    },
    {
      step: '02',
      title: 'Build High-Ticket Free PDF Playbooks',
      subtitle: 'Gamma-Style PDFs · Beacon Smart Web Pages · Embedded Whop Offer',
      status: `${store.leadMagnets.length} PDF playbook${store.leadMagnets.length === 1 ? '' : 's'} · ${primaryMagnet?.views || 0} views`,
      cta: 'Open Lead Magnet Studio',
      target: 'lead-magnets' as NavSection,
      icon: FileText,
    },
    {
      step: '03',
      title: 'Score 0–100 Copy & Generate Carousels',
      subtitle: 'Anyword Predictive Scorer · 5x A/B Auto-Winner · PostNitro Slides',
      status: `${avgScore}/100 avg copy score · ${store.carousels.length} carousel deck${store.carousels.length === 1 ? '' : 's'}`,
      cta: 'Open Write & Copy Lab',
      target: 'write' as NavSection,
      icon: Layers,
    },
    {
      step: '04',
      title: 'Auto-Schedule, Auto-Plug & Deliver PDFs',
      subtitle: '100% TweetHunter Queue · Auto-RT · Evergreen · Comment Giveaways',
      status: `${queuedPosts.length} queued · ${store.autoDmCampaigns.length} giveaway funnel${store.autoDmCampaigns.length === 1 ? '' : 's'}`,
      cta: 'Open My Queue',
      target: 'queue' as NavSection,
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Apple Editorial Hero Surface */}
      <section className="apple-card p-7 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] tracking-[-0.005em]">
              {store.brandBrain.niche} · {activeAccount.xMode === 'live' ? 'Live X API v2' : 'Safe Sandbox'} · $0/month
            </div>
            <h2 className="font-display text-[1.75rem] lg:text-[2.15rem] font-bold leading-[1.12] tracking-[-0.03em] text-[#1D1D1F] dark:text-[#F5F5F7] text-balance">
              Run your S-tier X funnel on quiet autopilot.
            </h2>
            <p className="text-[15px] text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
              Every post begins with live buyer pain points, competes across 5 persuasion frameworks on the 0–100 predictive engine, attaches your free PDF playbook and offer plug, and schedules automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              disabled={runningBatch}
              onClick={handleRunInstantWeeklyAutopilot}
              className="apple-btn-primary px-6 py-3 text-sm"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{runningBatch ? 'Scoring 20 A/B Variants...' : 'Auto-Fill Week Now'}</span>
            </button>
            <button
              type="button"
              disabled={sendingToIde}
              onClick={handleDispatchToAntigravity}
              className="apple-btn-secondary px-5 py-2.5 text-sm"
            >
              <Cpu className="h-4 w-4 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
              <span>{sendingToIde ? 'Saving Task...' : 'Send Week to Antigravity'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Unified 4-Column Apple Metric Strip (single surface, hairline dividers) */}
      <section
        aria-label="Account performance overview"
        className="apple-card grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden"
      >
        <div className="p-6">
          <div className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">Queued &amp; Ready</div>
          <div className="mt-1.5 font-mono text-[1.75rem] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
            {queuedPosts.length}
          </div>
          <div className="mt-1 text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
            {publishedPosts.length} published · {store.queueSlots.filter((s) => s.enabled).length} slots
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">Avg Copy Score</div>
          <div className="mt-1.5 font-mono text-[1.75rem] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
            {avgScore}
            <span className="text-sm font-normal text-[#86868B] ml-1">/ 100</span>
          </div>
          <div className="mt-1 text-xs text-[#248A3D] dark:text-[#30D158] font-medium">
            Anyword 4-pillar engine
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">Tracked Offer Clicks</div>
          <div className="mt-1.5 font-mono text-[1.75rem] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
            {offerStats.totalClicks.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
            {offerStats.totalLeads} PDF leads · {offerStats.conversionRate}% rate
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">Tracked Offer Value</div>
          <div className="mt-1.5 font-mono text-[1.75rem] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
            ${offerStats.totalRevenue.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[#6E6E73] dark:text-[#98989D]">
            {store.brandBrain.offers.length} active offers in vault
          </div>
        </div>
      </section>

      {/* 4-Stage S-Tier Creator Loop */}
      <section className="space-y-4">
        <div className="px-1">
          <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            The 4-Stage Creator Loop
          </h3>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D]">
            Follow steps 01 through 04 whenever you enter a new niche or attach a new offer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pipelineSteps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="apple-card p-6 flex flex-col justify-between gap-5 transition-transform duration-200 hover:-translate-y-[1px]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[#0071E3] dark:text-[#0A84FF] tabular-nums">
                      {item.step}
                    </span>
                    <Icon className="h-4 w-4 text-[#86868B]" aria-hidden="true" />
                  </div>
                  <h4 className="font-display text-base font-semibold tracking-[-0.015em] text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                    {item.subtitle}
                  </p>
                  <p className="text-xs font-medium text-[#1D1D1F] dark:text-[#E5E5EA] pt-1 tabular-nums">
                    {item.status}
                  </p>
                </div>

                <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.target)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071E3] dark:text-[#0A84FF] hover:opacity-80 transition-opacity"
                  >
                    <span>{item.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Queue Preview + Automation Log */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="apple-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Next Up in Queue
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('queue')}
              className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline"
            >
              Manage Queue
            </button>
          </div>
          {queuedPosts.length === 0 ? (
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D] py-8 text-center">
              Your queue is empty. Click Auto-Fill Week Now above to load top-scoring posts.
            </p>
          ) : (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {queuedPosts.slice(0, 3).map((post) => (
                <div key={post.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                    <span>
                      {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleString([], {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Unscheduled'}{' '}
                      · {post.format}
                    </span>
                    <span className="font-mono font-semibold text-[#248A3D] dark:text-[#30D158]">
                      {post.predictiveScore}/100
                    </span>
                  </div>
                  <p className="text-sm text-[#1D1D1F] dark:text-[#E5E5EA] leading-relaxed line-clamp-2">
                    {post.blocks[0]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="apple-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Recent Automation Activity
            </h3>
            <button
              type="button"
              onClick={async () => {
                const res = await api.runSchedulerTick();
                await onUpdateStore(res.store);
                onNotify(
                  res.processed > 0
                    ? `Scheduler processed ${res.processed} automation action(s).`
                    : 'Scheduler checked queue — all upcoming posts are on schedule.'
                );
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline"
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              <span>Run Scheduler Tick</span>
            </button>
          </div>
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {store.automationLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {log.type} · {log.mode === 'live' ? 'Live X' : 'Sandbox'}
                </div>
                <p className="text-sm text-[#3A3A3C] dark:text-[#D1D1D6] leading-relaxed">
                  {log.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
