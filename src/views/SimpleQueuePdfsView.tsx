import React, { useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { scoreCopy } from '../lib/copyScorer';
import { countTweetChars, findNextOpenSlot } from '../lib/scheduler';
import { buildXIntentUrl } from '../lib/telegramFormatter';
import type { GhostPilotStore, LeadMagnet, PostItem } from '../lib/types';

interface SimpleQueuePdfsViewProps {
  store: GhostPilotStore;
  initialTab?: 'posts' | 'pdfs' | 'write';
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onGoToTelegramSetup: () => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

function formatWhen(iso?: string): string {
  if (!iso) return 'Unscheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Scheduled';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SimpleQueuePdfsView({
  store,
  initialTab = 'posts',
  onUpdateStore,
  onReplaceStore,
  onGoToTelegramSetup,
  onNotify,
}: SimpleQueuePdfsViewProps) {
  const [tab, setTab] = useState<'posts' | 'pdfs' | 'write'>(initialTab);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Quick Write state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<string[]>(['']);
  const [autoPlugText, setAutoPlugText] = useState(
    store.brandBrain.offers[0]?.autoPlugTemplate || ''
  );
  const [autoPlugEnabled, setAutoPlugEnabled] = useState(true);
  const [aiBusy, setAiBusy] = useState<'rewrite' | 'expand-thread' | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // PDF Creator state
  const [pdfTopic, setPdfTopic] = useState('');
  const [creatingPdf, setCreatingPdf] = useState(false);
  const [sendingPdfId, setSendingPdfId] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const queuedPosts = store.posts
    .filter((p) => p.status === 'queued' || p.status === 'draft')
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));

  const sentPosts = store.posts
    .filter((p) => p.status === 'published')
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    .slice(0, 8);

  const primaryOffer = store.brandBrain.offers[0];

  const handleSendPostToTelegram = async (postId: string) => {
    setSendingId(postId);
    try {
      const res = await api.sendPostToTelegram(postId);
      onReplaceStore(res.store);
      onNotify('Sent to your Telegram! Tap the button in Telegram to post on X ($0).');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Telegram send failed.';
      onNotify(msg, 'error');
      if (msg.toLowerCase().includes('connect')) {
        onGoToTelegramSetup();
      }
    } finally {
      setSendingId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    await onUpdateStore({ posts: store.posts.filter((p) => p.id !== postId) });
    onNotify('Removed post from your queue.');
  };

  const handleStartEdit = (post: PostItem) => {
    setEditingPostId(post.id);
    setDraftBlocks(post.blocks.length ? [...post.blocks] : ['']);
    setAutoPlugText(post.automations.autoPlugText || '');
    setAutoPlugEnabled(post.automations.autoPlugEnabled);
    setTab('write');
  };

  const handleCopy = async (text: string, label = 'Copied text!') => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(label);
    } catch {
      onNotify('Could not copy automatically — select text manually.', 'error');
    }
  };

  const handleAiPolish = async (action: 'rewrite' | 'expand-thread') => {
    const raw = draftBlocks.join('\n\n').trim();
    if (!raw) {
      onNotify('Type a rough idea or sentence first.', 'error');
      return;
    }
    setAiBusy(action);
    try {
      const res = await api.aiGhostwrite({ action, text: raw });
      if (res.blocks.length > 0) {
        setDraftBlocks(res.blocks);
        onNotify(
          action === 'expand-thread'
            ? `Expanded into a ${res.blocks.length}-tweet thread!`
            : 'Polished your tweet for higher hook & clarity.'
        );
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'AI polish failed.', 'error');
    } finally {
      setAiBusy(null);
    }
  };

  const handleSaveToQueue = async (sendImmediately = false) => {
    const cleanBlocks = draftBlocks.map((b) => b.trim()).filter(Boolean);
    if (cleanBlocks.length === 0) {
      onNotify('Write at least one tweet before saving.', 'error');
      return;
    }
    setSavingDraft(true);
    try {
      const score = scoreCopy(cleanBlocks, { brandBrain: store.brandBrain });
      const nextSlot = findNextOpenSlot(store.queueSlots, store.posts, new Date());

      let targetPostId = editingPostId;
      let nextPosts: PostItem[];

      if (editingPostId) {
        nextPosts = store.posts.map((p) =>
          p.id === editingPostId
            ? {
                ...p,
                blocks: cleanBlocks,
                format: cleanBlocks.length > 1 ? 'thread' : 'single',
                predictiveScore: score.total,
                automations: {
                  ...p.automations,
                  autoPlugEnabled,
                  autoPlugText,
                },
              }
            : p
        );
      } else {
        targetPostId = `post-${Date.now()}`;
        const created: PostItem = {
          id: targetPostId,
          accountId: store.activeAccountId,
          blocks: cleanBlocks,
          status: 'queued',
          format: cleanBlocks.length > 1 ? 'thread' : 'single',
          scheduledAt: nextSlot,
          predictiveScore: score.total,
          automations: {
            threadDelayMinutes: 0,
            autoPlugEnabled,
            autoPlugText,
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
        nextPosts = [created, ...store.posts];
      }

      await onUpdateStore({ posts: nextPosts });
      setEditingPostId(null);
      setDraftBlocks(['']);
      setTab('posts');

      if (sendImmediately && targetPostId) {
        await handleSendPostToTelegram(targetPostId);
      } else {
        onNotify(`Saved and scheduled for ${formatWhen(nextSlot)}.`);
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const handleGeneratePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = pdfTopic.trim() || `${store.brandBrain.niche} Playbook`;
    setCreatingPdf(true);
    try {
      const res = await api.generateLeadMagnet({
        topic,
        format: 'Playbook',
        offerId: primaryOffer?.id,
      });
      await onUpdateStore({ leadMagnets: [res.leadMagnet, ...store.leadMagnets] });
      setPdfTopic('');
      onNotify(`Created Free PDF "${res.leadMagnet.title}"!`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'PDF generation failed.', 'error');
    } finally {
      setCreatingPdf(false);
    }
  };

  const handleSendPdfPackToTelegram = async (magnet: LeadMagnet) => {
    setSendingPdfId(magnet.id);
    try {
      const res = await api.sendMagnetToTelegram(magnet.id);
      onReplaceStore(res.store);
      onNotify(
        `Sent "${magnet.title}" + Giveaway Tweet + Comment Reply Templates to your Telegram!`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connect Telegram first.';
      onNotify(msg, 'error');
      if (msg.toLowerCase().includes('connect')) {
        onGoToTelegramSetup();
      }
    } finally {
      setSendingPdfId(null);
    }
  };

  const handleMakeGiveawayTweet = (magnet: LeadMagnet) => {
    const pdfUrl = `${window.location.origin}/r/${magnet.slug}`;
    const bullets = magnet.sections
      .slice(0, 3)
      .map((s) => `• ${s.heading}`)
      .join('\n');
    setEditingPostId(null);
    setDraftBlocks([
      `I just put together the free "${magnet.title}" for ${magnet.niche}.\n\nInside:\n${bullets}\n\nComment "${magnet.giveawayKeyword}" and I'll send you the PDF link free.`,
    ]);
    setAutoPlugEnabled(true);
    setAutoPlugText(
      `Want instant access without waiting? Grab "${magnet.title}" free here: ${pdfUrl}`
    );
    setTab('write');
    onNotify('Loaded your Comment-to-PDF Giveaway Tweet — save to queue or send to Telegram!');
  };

  return (
    <div className="space-y-6">
      {/* Header + Clean 3-Option Segmented Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Queue &amp; Free PDFs
          </h2>
          <p className="text-sm text-[#6E6E73] dark:text-[#86868B] mt-0.5">
            Every post here delivers to your Telegram on schedule — or tap Send to Telegram right now.
          </p>
        </div>

        <div className="apple-segmented self-start sm:self-auto">
          {(
            [
              { id: 'posts', label: `Scheduled Posts (${queuedPosts.length})` },
              { id: 'pdfs', label: `Free PDFs (${store.leadMagnets.length})` },
              { id: 'write', label: editingPostId ? 'Edit Post' : 'Quick Write' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all whitespace-nowrap ${
                tab === item.id ? 'apple-segment-active' : 'apple-segment-idle'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SCHEDULED POSTS */}
      {tab === 'posts' && (
        <div className="space-y-6">
          <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {queuedPosts.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
                  Your queue is empty right now.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('write')}
                  className="apple-btn-primary px-5 py-2.5 text-sm"
                >
                  Write Your First Post
                </button>
              </div>
            ) : (
              queuedPosts.map((post) => (
                <article key={post.id} className="p-5 sm:p-6 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6E73] dark:text-[#86868B]">
                    <div className="flex flex-wrap items-center gap-2 tabular-nums">
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {formatWhen(post.scheduledAt)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {post.blocks.length > 1
                          ? `Thread (${post.blocks.length} tweets)`
                          : 'Single Post'}
                      </span>
                      {post.automations.isEvergreen && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Evergreen ON</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(post)}
                        className="text-[#515154] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white inline-flex items-center gap-1"
                      >
                        <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        aria-label="Delete scheduled post"
                        className="text-[#6E6E73] hover:text-[#DC2626] p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {post.blocks[0]}
                  </div>

                  {post.blocks.length > 1 && (
                    <div className="text-xs text-[#6E6E73] dark:text-[#86868B]">
                      + {post.blocks.length - 1} more tweet{post.blocks.length > 2 ? 's' : ''} in
                      thread
                    </div>
                  )}

                  {post.automations.autoPlugEnabled && post.automations.autoPlugText && (
                    <div className="text-xs text-[#6E6E73] dark:text-[#86868B] pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#D1D1D6]">
                        Auto-Plug Reply (+{post.automations.autoPlugDelayMinutes || 30}m in
                        Telegram):
                      </span>{' '}
                      {post.automations.autoPlugText}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSendPostToTelegram(post.id)}
                      disabled={sendingId === post.id}
                      className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap"
                    >
                      {sendingId === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>Send to Telegram</span>
                    </button>
                    <a
                      href={buildXIntentUrl(post.blocks[0] || '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Post on X ($0)</span>
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(post.blocks.join('\n\n---\n\n'), 'Copied full post!')
                      }
                      className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>

          {sentPosts.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Recently Sent / Published ({sentPosts.length})
              </h3>
              <div className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {sentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs text-[#6E6E73] dark:text-[#86868B] tabular-nums">
                        {post.telegramDeliveredAt
                          ? `Sent to Telegram · ${formatWhen(post.telegramDeliveredAt)}`
                          : `Published · ${formatWhen(post.publishedAt)}`}
                      </div>
                      <p className="text-sm text-[#1D1D1F] dark:text-[#F5F5F7] line-clamp-2">
                        {post.blocks[0]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendPostToTelegram(post.id)}
                      disabled={sendingId === post.id}
                      className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0"
                    >
                      Resend to Telegram
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: FREE GIVEAWAY PDFs */}
      {tab === 'pdfs' && (
        <div className="space-y-6">
          <form onSubmit={handleGeneratePdf} className="apple-card p-5 sm:p-6 space-y-3">
            <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Create a New Free Giveaway PDF (With Your Whop Offer Inside)
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={pdfTopic}
                onChange={(e) => setPdfTopic(e.target.value)}
                placeholder={`Topic (e.g., 7 Scripts for ${store.brandBrain.niche})`}
                className="apple-input flex-1 text-sm"
              />
              <button
                type="submit"
                disabled={creatingPdf}
                className="apple-btn-primary px-5 py-2.5 text-sm whitespace-nowrap shrink-0"
              >
                {creatingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{creatingPdf ? 'Building PDF...' : 'Create Free PDF ($0)'}</span>
              </button>
            </div>
          </form>

          <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {store.leadMagnets.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6E6E73] dark:text-[#86868B]">
                No free PDFs yet. Type any topic above to generate your first giveaway PDF + smart
                landing page.
              </div>
            ) : (
              store.leadMagnets.map((magnet) => {
                const pdfUrl = `${window.location.origin}/r/${magnet.slug}`;
                const replyTemplate = `Just dropped it for you! Grab "${magnet.title}" free here: ${pdfUrl}`;
                return (
                  <article key={magnet.id} className="p-5 sm:p-6 space-y-3.5">
                    <div className="space-y-1">
                      <div className="text-xs text-[#6E6E73] dark:text-[#86868B] flex flex-wrap items-center gap-2">
                        <span>{magnet.format}</span>
                        <span aria-hidden="true">·</span>
                        <span>Comment Keyword: {magnet.giveawayKeyword}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{magnet.sections.length} sections</span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {magnet.title}
                      </h3>
                      <p className="text-sm text-[#515154] dark:text-[#A1A1A6]">
                        {magnet.subtitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSendPdfPackToTelegram(magnet)}
                        disabled={sendingPdfId === magnet.id}
                        className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap"
                      >
                        {sendingPdfId === magnet.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>Send PDF + Reply Pack to Telegram</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMakeGiveawayTweet(magnet)}
                        className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        Make Giveaway Tweet
                      </button>
                      <a
                        href={`/r/${magnet.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Open Free PDF Page</span>
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(replyTemplate, 'Copied Comment-to-PDF reply template!')
                        }
                        className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy Reply Template</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* TAB 3: QUICK WRITE */}
      {tab === 'write' && (
        <section className="apple-card p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingPostId ? 'Edit Scheduled Post' : 'Write a Quick Post or Thread'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAiPolish('rewrite')}
                disabled={Boolean(aiBusy)}
                className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
              >
                {aiBusy === 'rewrite' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>AI Polish</span>
              </button>
              <button
                type="button"
                onClick={() => handleAiPolish('expand-thread')}
                disabled={Boolean(aiBusy)}
                className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
              >
                {aiBusy === 'expand-thread' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Turn Into Thread</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {draftBlocks.map((block, idx) => {
              const chars = countTweetChars(block);
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#6E6E73] dark:text-[#86868B]">
                    <span>
                      {draftBlocks.length > 1 ? `Tweet ${idx + 1} of ${draftBlocks.length}` : 'Tweet Text'}
                    </span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className={chars > 280 ? 'text-[#DC2626] font-semibold' : ''}>
                        {chars} / 280
                      </span>
                      {draftBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftBlocks((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-[#DC2626] hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={block}
                    onChange={(e) =>
                      setDraftBlocks((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                    placeholder="Type a rough thought, tip, or giveaway hook..."
                    className="apple-input text-[15px] leading-relaxed"
                  />
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setDraftBlocks((prev) => [...prev, ''])}
              className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add another tweet (make a thread)</span>
            </button>
          </div>

          {/* Simple Auto-Plug Box */}
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
            <label className="flex items-center gap-2 text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer">
              <input
                type="checkbox"
                checked={autoPlugEnabled}
                onChange={(e) => setAutoPlugEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#0071E3]"
              />
              <span>Auto-Plug Reply (Telegram reminds you 30 mins later with your PDF/Whop link)</span>
            </label>
            {autoPlugEnabled && (
              <input
                type="text"
                value={autoPlugText}
                onChange={(e) => setAutoPlugText(e.target.value)}
                placeholder="Grab the free PDF + Whop resource here: https://..."
                className="apple-input text-sm"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleSaveToQueue(false)}
              disabled={savingDraft}
              className="apple-btn-primary px-5 py-2.5 text-sm whitespace-nowrap"
            >
              {savingDraft ? 'Saving...' : editingPostId ? 'Save Changes' : 'Schedule to Queue'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveToQueue(true)}
              disabled={savingDraft}
              className="apple-btn-secondary px-5 py-2.5 text-sm whitespace-nowrap"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Save &amp; Send to Telegram Now</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
