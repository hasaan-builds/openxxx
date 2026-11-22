import React, { useState } from 'react';
import { BookOpenCheck, Cpu, ExternalLink, FileText, Layers, PenTool, RefreshCw, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthorityDossier, GhostPilotStore, RadarItem } from '../lib/types';

interface AuthorityResearchViewProps {
  store: GhostPilotStore;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onSendToWriter: (topic: string, insight: string) => void;
  onSendToLeadMagnet: (topic: string, dossierId?: string) => void;
  onSendToCarousel: (title: string, bullets: string[]) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function AuthorityResearchView({
  store,
  onUpdateStore,
  onSendToWriter,
  onSendToLeadMagnet,
  onSendToCarousel,
  onNotify,
}: AuthorityResearchViewProps) {
  const [nicheQuery, setNicheQuery] = useState(store.brandBrain.niche);
  const [subredditsInput, setSubredditsInput] = useState(store.brandBrain.subreddits.join(', '));
  const [rssInput, setRssInput] = useState(store.brandBrain.customRssUrls.join(', '));
  const [includeGithub, setIncludeGithub] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [scanning, setScanning] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [activeDossierId, setActiveDossierId] = useState<string>(store.dossiers[0]?.id || '');

  const activeDossier: AuthorityDossier | undefined =
    store.dossiers.find((d) => d.id === activeDossierId) || store.dossiers[0];

  const handleScanLive = async () => {
    setScanning(true);
    try {
      const subs = subredditsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const rss = rssInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.scanRadar({
        niche: nicheQuery.trim() || store.brandBrain.niche,
        subreddits: subs,
        customRssUrls: rss,
        includeGithub,
      });

      await onUpdateStore({
        radarItems: res.items,
        brandBrain: {
          ...store.brandBrain,
          niche: nicheQuery.trim() || store.brandBrain.niche,
          subreddits: subs,
          customRssUrls: rss,
        },
      });
      onNotify(res.message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Live scan failed.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleCompileDossier = async (useAntigravity: boolean) => {
    setCompiling(true);
    try {
      const res = await api.compileDossier({
        niche: nicheQuery.trim() || store.brandBrain.niche,
        radarItemIds: store.radarItems.slice(0, 8).map((r) => r.id),
        useAntigravity,
      });

      if (useAntigravity && res.task) {
        await onUpdateStore({
          antigravityTasks: [res.task, ...store.antigravityTasks],
        });
        onNotify('STORM Research task exported to Antigravity Bridge ($0 Gemini 3.8 Flash).');
      } else if (res.dossier) {
        const nextDossiers = [res.dossier, ...store.dossiers];
        await onUpdateStore({ dossiers: nextDossiers });
        setActiveDossierId(res.dossier.id);
        onNotify(`Compiled 5-Angle Authority Dossier for "${res.dossier.niche}" (${res.mode}).`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to compile dossier.', 'error');
    } finally {
      setCompiling(false);
    }
  };

  const classifyPainIntent = (item: RadarItem): string => {
    const text = `${item.title} ${item.summary} ${item.painPointTag || ''}`.toLowerCase();
    if (/(money|cost|expensive|revenue|pricing|profit|roi|leak|burn|refund|charge)/.test(text)) {
      return 'Money Leak';
    }
    if (/(tool|software|app|stack|alternative|recommend|best\s+\w+\s+for|github|repo)/.test(text)) {
      return 'Tool Seeking';
    }
    if (/(hate|stuck|struggling|fail|broken|cant|can't|help|problem|pain|ghost|ignore)/.test(text)) {
      return 'Urgent Pain';
    }
    if (/(scam|worth it|skeptic|objection|doubt|overrated|myth|lie)/.test(text)) {
      return 'Objection';
    }
    return 'Breakout Trend';
  };

  const sources = ['ALL', 'Reddit Pain-Point', 'Google News', 'GitHub Trending', 'Hacker News', 'Custom RSS'];
  const filteredRadar =
    sourceFilter === 'ALL'
      ? store.radarItems
      : store.radarItems.filter((item) => item.source === sourceFilter);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Live Niche Radar & GummySearch Pain-Point Miner */}
      <section className="apple-card p-6 lg:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
              Live $0 Niche Radar &amp; Pain-Point Miner
            </h2>
            <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
              Mines real Reddit complaints (GummySearch intent tagging), breaking Google News, GitHub repos, and custom RSS feeds.
            </p>
          </div>
          <button
            type="button"
            disabled={scanning}
            onClick={handleScanLive}
            className="apple-btn-primary px-5 py-2.5 text-sm shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{scanning ? 'Scanning Live Feeds...' : 'Scan Niche Live ($0)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="radar-niche" className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
              Target Niche / Topic
            </label>
            <input
              id="radar-niche"
              type="text"
              value={nicheQuery}
              onChange={(e) => setNicheQuery(e.target.value)}
              placeholder="e.g., High-Ticket Sales, Real Estate, AI Agents"
              className="apple-input"
            />
          </div>
          <div>
            <label htmlFor="radar-subs" className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
              Reddit Subreddits (Pain-Point Mining)
            </label>
            <input
              id="radar-subs"
              type="text"
              value={subredditsInput}
              onChange={(e) => setSubredditsInput(e.target.value)}
              placeholder="sales, entrepreneur, SaaS"
              className="apple-input"
            />
          </div>
          <div>
            <label htmlFor="radar-rss" className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
              Custom Blog / Newsletter RSS URLs (optional)
            </label>
            <input
              id="radar-rss"
              type="text"
              value={rssInput}
              onChange={(e) => setRssInput(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="apple-input"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="apple-segmented">
            {sources.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1.5 rounded-[9px] text-xs font-medium transition-all whitespace-nowrap ${
                  sourceFilter === src ? 'apple-segment-active' : 'apple-segment-idle'
                }`}
              >
                {src}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#515154] dark:text-[#D1D1D6] cursor-pointer">
            <input
              type="checkbox"
              checked={includeGithub}
              onChange={(e) => setIncludeGithub(e.target.checked)}
              className="h-4 w-4 accent-[#0071E3]"
            />
            <span>Include GitHub Breakout Repos</span>
          </label>
        </div>

        {filteredRadar.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#6E6E73] dark:text-[#98989D] apple-subsurface">
            <Search className="h-5 w-5 mx-auto mb-2 text-[#86868B]" aria-hidden="true" />
            No signals match this filter yet. Click <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Scan Niche Live ($0)</strong> above to fetch fresh items.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
            {filteredRadar.slice(0, 10).map((item: RadarItem) => {
              const intent = classifyPainIntent(item);
              return (
                <div
                  key={item.id}
                  className="py-4 first:pt-4 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D]">
                      <span className="font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                        {item.source}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.sourceDetail}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#E5E5EA]">
                        {intent}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Signal {item.signalScore}/100</span>
                      {item.painPointTag && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.painPointTag}</span>
                        </>
                      )}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0071E3] dark:hover:text-[#0A84FF] transition-colors"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#86868B]" aria-hidden="true" />
                    </a>
                    <p className="text-xs text-[#515154] dark:text-[#A1A1A6] leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSendToWriter(item.title, item.summary)}
                      className="apple-btn-secondary px-3.5 py-1.5 text-xs"
                    >
                      <PenTool className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                      <span>5x A/B Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendToCarousel(item.title, [item.summary])}
                      className="apple-btn-secondary px-3.5 py-1.5 text-xs"
                    >
                      <Layers className="h-3.5 w-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
                      <span>Carousel</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* STORM 5-Angle Authority Dossier */}
      <section className="apple-card p-6 lg:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
              STORM 5-Angle Niche Authority Dossier
            </h2>
            <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
              Synthesizes buyer pain points, S-tier frameworks, contrarian truths, proof scripts, and offer bridges. Click <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Draft →</strong> on any finding to open it in Copy Lab.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={compiling}
              onClick={() => handleCompileDossier(true)}
              className="apple-btn-secondary px-4 py-2 text-sm"
            >
              <Cpu className="h-4 w-4 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
              <span>Send to Antigravity</span>
            </button>
            <button
              type="button"
              disabled={compiling}
              onClick={() => handleCompileDossier(false)}
              className="apple-btn-primary px-5 py-2 text-sm"
            >
              <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
              <span>{compiling ? 'Compiling...' : 'Compile 5-Angle Dossier'}</span>
            </button>
          </div>
        </div>

        {activeDossier && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <div className="text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                  {activeDossier.niche} · {activeDossier.sourceCount} sources analyzed · Compiled{' '}
                  {new Date(activeDossier.createdAt).toLocaleDateString()}
                </div>
                <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  {activeDossier.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSendToLeadMagnet(activeDossier.niche, activeDossier.id)}
                  className="apple-btn-secondary px-3.5 py-2 text-xs font-semibold"
                >
                  <FileText className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  <span>Turn into PDF Lead Magnet</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendToCarousel(activeDossier.title, activeDossier.angles.coreFrameworks)
                  }
                  className="apple-btn-secondary px-3.5 py-2 text-xs font-semibold"
                >
                  <Layers className="h-3.5 w-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
                  <span>Turn into Carousel</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: '01. Buyer Pain Points & Exact Complaints', list: activeDossier.angles.buyerPainPoints },
                { title: '02. S-Tier Core Frameworks', list: activeDossier.angles.coreFrameworks },
                { title: '03. Contrarian Authority Truths', list: activeDossier.angles.contrarianTruths },
                { title: '04. Word-for-Word Scripts & Proof', list: activeDossier.angles.scriptsAndProof },
              ].map((block) => (
                <div key={block.title} className="apple-subsurface p-5 space-y-3">
                  <h4 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {block.title}
                  </h4>
                  <ul className="space-y-2.5 text-xs text-[#3A3A3C] dark:text-[#D1D1D6] leading-relaxed">
                    {block.list.map((point, idx) => (
                      <li key={idx} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="font-mono text-[#0071E3] dark:text-[#0A84FF] shrink-0">→</span>
                          <span>{point}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSendToWriter(point, activeDossier.niche)}
                          className="text-[11px] font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline shrink-0 whitespace-nowrap pt-0.5"
                        >
                          Draft →
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-[14px] bg-[#0071E3]/[0.05] dark:bg-[#0A84FF]/[0.1] border border-[#0071E3]/15 dark:border-[#0A84FF]/20 p-5 space-y-2.5">
              <h4 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                05. Monetization &amp; Whop Offer Bridge Map
              </h4>
              <ul className="space-y-2 text-xs text-[#3A3A3C] dark:text-[#E5E5EA] leading-relaxed">
                {activeDossier.angles.offerBridges.map((bridge, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <span>• {bridge}</span>
                    <button
                      type="button"
                      onClick={() => onSendToWriter(bridge, activeDossier.niche)}
                      className="text-[11px] font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline shrink-0 whitespace-nowrap"
                    >
                      Draft →
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
