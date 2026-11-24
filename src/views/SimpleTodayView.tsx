import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { buildXIntentUrl } from '../lib/telegramFormatter';
import type { AccountProfile, GhostPilotStore, NavSection } from '../lib/types';

interface SimpleTodayViewProps {
  store: GhostPilotStore;
  activeAccount: AccountProfile;
  onReplaceStore: (next: GhostPilotStore) => void;
  onNavigate: (section: NavSection) => void;
  onOpenNicheWizard: () => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

function formatSlotTime(iso?: string): string {
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Scheduled';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SimpleTodayView({
  store,
  activeAccount,
  onReplaceStore,
  onNavigate,
  onOpenNicheWizard,
  onNotify,
}: SimpleTodayViewProps) {
  const [generatingCount, setGeneratingCount] = useState<4 | 14 | null>(null);
  const [sendingPostId, setSendingPostId] = useState<string | null>(null);

  const tg = activeAccount.telegram?.botToken ? activeAccount.telegram : store.telegramConfig;
  const telegramConnected = Boolean(tg?.enabled && tg.botToken && tg.chatId);

  const queuedPosts = store.posts
    .filter((p) => p.status === 'queued' || p.status === 'draft')
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));

  const nextPost = queuedPosts[0];
  const latestPdf = store.leadMagnets[0];
  const primaryOffer = store.brandBrain.offers[0];
  const capturedLeadsCount = (store.capturedLeads || []).length;
  const totalAffiliateClicks = store.leadMagnets.reduce(
    (sum, m) => sum + (m.offerClicks || 0),
    0
  );
  const replyTargets = store.crmContacts.slice(0, 3);
  const nicheTitle =
    activeAccount.nicheProfile?.subNicheName || store.brandBrain.niche || 'Pick your niche';

  const handleGeneratePack = async (count: 4 | 14) => {
    setGeneratingCount(count);
    try {
      const res = await api.runLocalTurbo({
        count,
      });
      onReplaceStore(res.store);
      onNotify(
        count === 14
          ? `Batched ${res.importedPosts} varied posts across your next 14 days ($0)!`
          : `Created ${res.importedPosts} ready posts for ${activeAccount.handle}. Tap Send to Telegram anytime.`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create posts.', 'error');
    } finally {
      setGeneratingCount(null);
    }
  };

  const handleSendToTelegram = async (postId: string) => {
    setSendingPostId(postId);
    try {
      const res = await api.sendPostToTelegram(postId);
      onReplaceStore(res.store);
      onNotify('Sent straight to your Telegram with a 1-tap Post on X ($0) button.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Connect Telegram first.', 'error');
      if (String(err).toLowerCase().includes('connect')) {
        onNavigate('accounts-telegram');
      }
    } finally {
      setSendingPostId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify('Copied tweet text — paste directly into X.');
    } catch {
      onNotify('Copy failed — select text manually.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Main Hero — Clear Primary Action + 14-Day Batch Factory */}
      <section className="apple-card p-7 sm:p-9 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-medium text-[#6E6E73] dark:text-[#86868B] flex flex-wrap items-center gap-2">
              <span>{activeAccount.handle}</span>
              <span aria-hidden="true">·</span>
              <span>{nicheTitle}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  telegramConnected
                    ? 'text-[#16A34A] dark:text-[#30D158] font-semibold'
                    : 'text-[#D97706] dark:text-[#FF9F0A] font-semibold'
                }
              >
                {telegramConnected
                  ? `Telegram Active (@${tg?.botUsername || 'bot'})`
                  : 'Telegram Not Connected Yet'}
              </span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7] text-balance">
              All 6 Tweet Hunter branches running locally for $0.
            </h2>

            <p className="text-[15px] text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
              Batch posts, run Auto-Plug &amp; Auto-RT alerts via Telegram, share paid-worth free
              PDFs, and route warm leads into{' '}
              <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                {primaryOffer?.name || 'your Affiliate Group Offer'}
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleGeneratePack(14)}
              disabled={Boolean(generatingCount)}
              className="apple-btn-primary px-5 py-3 text-sm whitespace-nowrap"
            >
              {generatingCount === 14 ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Layers className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{generatingCount === 14 ? 'Batching 14 Days...' : 'Batch 14 Posts ($0)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleGeneratePack(4)}
              disabled={Boolean(generatingCount)}
              className="apple-btn-secondary px-4 py-3 text-sm whitespace-nowrap"
            >
              {generatingCount === 4 ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{generatingCount === 4 ? 'Creating...' : 'Create 4 Today'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenNicheWizard}
              className="apple-btn-secondary px-4 py-3 text-sm whitespace-nowrap"
            >
              Change Niche
            </button>
          </div>
        </div>

        {/* Clean 4-Stat Funnel Strip — Unboxed Tabular Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#6E6E73] dark:text-[#86868B]">
              Queued Posts
            </div>
            <div className="font-display text-2xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
              {queuedPosts.length}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('queue-pdfs')}
              className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1"
            >
              <span>Open queue</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[#6E6E73] dark:text-[#86868B]">
              Paid-Worth PDFs
            </div>
            <div className="font-display text-2xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
              {store.leadMagnets.length}
            </div>
            <div className="text-xs text-[#6E6E73] dark:text-[#86868B] truncate">
              {latestPdf ? latestPdf.title : 'Create in Queue & PDFs'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[#6E6E73] dark:text-[#86868B]">
              Captured Email Leads
            </div>
            <div className="font-display text-2xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
              {capturedLeadsCount}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('engage-dm')}
              className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1"
            >
              <span>Leads &amp; CSV</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[#6E6E73] dark:text-[#86868B]">
              Affiliate Group Clicks
            </div>
            <div className="font-display text-2xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
              {totalAffiliateClicks}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('accounts-telegram')}
              className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1"
            >
              <span>{nextPost ? `Next: ${formatSlotTime(nextPost.scheduledAt)}` : 'Edit schedule'}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Quick Setup Banner (shown cleanly until Telegram is connected) */}
      {!telegramConnected && (
        <section className="apple-card p-6 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Connect your free Telegram Bot in 30 seconds
              </h3>
              <p className="text-sm text-[#6E6E73] dark:text-[#86868B] mt-0.5">
                Once connected, GhostPilot sends every post, Auto-Plug, Auto-RT boost, and 4-step DM
                script straight to your phone on schedule — $0 forever.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('accounts-telegram')}
              className="apple-btn-primary px-5 py-2.5 text-sm whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Set Up Telegram Now</span>
            </button>
          </div>
        </section>
      )}

      {/* Next Up Post Card — Ready to Send or Post Immediately */}
      <section className="apple-card p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Next Post Ready to Ship
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
              {nextPost
                ? `Scheduled ${formatSlotTime(nextPost.scheduledAt)} · ${nextPost.blocks.length} tweet${nextPost.blocks.length > 1 ? 's' : ''}`
                : 'Click "Batch 14 Posts ($0)" above or remix a viral hook to fill your queue.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('ideas')}
              className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ideas &amp; Viral Library</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('queue-pdfs')}
              className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Queue &amp; PDFs</span>
            </button>
          </div>
        </div>

        {nextPost ? (
          <div className="space-y-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7]">
              {nextPost.blocks[0]}
            </div>
            {nextPost.blocks.length > 1 && (
              <div className="text-xs text-[#6E6E73] dark:text-[#86868B]">
                + {nextPost.blocks.length - 1} more tweet{nextPost.blocks.length > 2 ? 's' : ''} in
                this thread
              </div>
            )}
            {nextPost.automations.autoPlugEnabled && nextPost.automations.autoPlugText && (
              <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-xs text-[#6E6E73] dark:text-[#86868B]">
                <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Auto-Plug reply (+{nextPost.automations.autoPlugDelayMinutes || 30}m):
                </span>{' '}
                {nextPost.automations.autoPlugText}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleSendToTelegram(nextPost.id)}
                disabled={sendingPostId === nextPost.id}
                className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap"
              >
                {sendingPostId === nextPost.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Send to Telegram Now</span>
              </button>
              <a
                href={buildXIntentUrl(nextPost.blocks[0] || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="apple-btn-secondary px-4 py-2 text-xs whitespace-nowrap"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Post on X ($0)</span>
              </a>
              <button
                type="button"
                onClick={() => handleCopy(nextPost.blocks.join('\n\n---\n\n'))}
                className="apple-btn-secondary px-4 py-2 text-xs whitespace-nowrap"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Text</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2 text-sm text-[#6E6E73] dark:text-[#86868B]">
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" aria-hidden="true" />
            <span>No queued posts yet. Tap &quot;Batch 14 Posts ($0)&quot; to fill two full weeks in 1 second.</span>
          </div>
        )}
      </section>

      {/* Daily 0-Follower Reply-Guy Mission Card */}
      <section className="apple-card p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Daily 0-Follower Reply-Guy Mission
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
              Drop 5–10 sharp replies under big {nicheTitle} accounts today so readers click your
              Bio &amp; Pinned Freebie.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('engage-dm')}
            className="apple-btn-secondary px-4 py-2 text-xs whitespace-nowrap shrink-0"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Open Reply-Guy &amp; 4-Step DM</span>
          </button>
        </div>

        {replyTargets.length > 0 ? (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
            {replyTargets.map((target) => {
              const cleanHandle = target.handle.replace(/^@/, '');
              return (
                <div
                  key={target.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {target.name}
                    </span>{' '}
                    <span className="font-mono text-xs text-[#6E6E73] dark:text-[#86868B]">
                      {target.handle}
                    </span>
                    <span className="text-xs text-[#6E6E73] dark:text-[#86868B]">
                      {' '}
                      · {target.stage}
                    </span>
                  </div>
                  <a
                    href={`https://x.com/${encodeURIComponent(cleanHandle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <span>Reply on X ($0)</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-xs text-[#6E6E73] dark:text-[#86868B]">
            Add your first 5 big niche accounts inside Engage &amp; Auto-DM to unlock daily 1-tap
            value replies.
          </div>
        )}
      </section>
    </div>
  );
}
