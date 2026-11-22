import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  Edit3,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { findNextOpenSlot } from '../lib/scheduler';
import type { GhostPilotStore, PostItem, QueueSlot } from '../lib/types';

interface QueueViewProps {
  store: GhostPilotStore;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onEditPost: (post: PostItem) => void;
  onWriteIntoSlot?: (isoSlotDate: string) => void;
  onPublishPost: (postId: string) => Promise<void>;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function QueueView({
  store,
  onSaveStore,
  onEditPost,
  onWriteIntoSlot,
  onPublishPost,
  onNotify,
}: QueueViewProps) {
  const [tab, setTab] = useState<'queued' | 'calendar' | 'drafts' | 'published' | 'slots'>('queued');
  const [newDay, setNewDay] = useState<number>(1);
  const [newTime, setNewTime] = useState<string>('09:00');
  const [newLabel, setNewLabel] = useState<string>('Morning Authority');
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const activePosts = useMemo(
    () => store.posts.filter((p) => p.accountId === store.activeAccountId),
    [store.posts, store.activeAccountId]
  );

  const queuedPosts = useMemo(
    () =>
      activePosts
        .filter((p) => p.status === 'queued')
        .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || '')),
    [activePosts]
  );

  const draftPosts = useMemo(
    () => activePosts.filter((p) => p.status === 'draft'),
    [activePosts]
  );

  const publishedPosts = useMemo(
    () =>
      activePosts
        .filter((p) => p.status === 'published' || p.status === 'failed')
        .sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt)),
    [activePosts]
  );

  // Build TweetHunter-style 7-day timeline showing BOTH queued posts AND empty open slots
  const dayGroupedTimeline = useMemo(() => {
    const now = new Date();
    const enabledSlots = store.queueSlots.filter((s) => s.enabled);

    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(now);
      day.setDate(now.getDate() + offset);
      const dow = day.getDay();
      const dayKey = day.toISOString().slice(0, 10);
      const dayLabel =
        offset === 0
          ? `Today · ${day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
          : offset === 1
            ? `Tomorrow · ${day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
            : day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

      const postsForDay = queuedPosts.filter(
        (p) => p.scheduledAt && p.scheduledAt.slice(0, 10) === dayKey
      );

      const slotsForDay = enabledSlots
        .filter((s) => s.dayOfWeek === dow)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((slot) => {
          const [hh, mm] = slot.time.split(':').map(Number);
          const slotDate = new Date(day);
          slotDate.setHours(hh || 9, mm || 0, 0, 0);
          const matchedPost = postsForDay.find(
            (p) =>
              p.scheduledAt &&
              Math.abs(new Date(p.scheduledAt).getTime() - slotDate.getTime()) < 35 * 60 * 1000
          );
          return {
            slot,
            iso: slotDate.toISOString(),
            timeLabel: slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            post: matchedPost,
          };
        });

      // Also include any queued posts on this day that aren't tied to an exact standard slot
      const matchedIds = new Set(slotsForDay.map((s) => s.post?.id).filter(Boolean));
      const extraPosts = postsForDay.filter((p) => !matchedIds.has(p.id));

      return { dayKey, dayLabel, slotsForDay, extraPosts };
    });
  }, [queuedPosts, store.queueSlots]);

  const handleDeletePost = async (id: string) => {
    await onSaveStore({ posts: store.posts.filter((p) => p.id !== id) });
    onNotify('Removed post.');
  };

  const handleMoveToQueue = async (post: PostItem) => {
    const slot = findNextOpenSlot(store.queueSlots, store.posts);
    const updated: PostItem = { ...post, status: 'queued', scheduledAt: slot };
    await onSaveStore({
      posts: store.posts.map((p) => (p.id === post.id ? updated : p)),
    });
    onNotify('Moved draft into the next open queue slot.');
  };

  const handleSwapOrder = async (postId: string, direction: -1 | 1) => {
    const index = queuedPosts.findIndex((p) => p.id === postId);
    const targetIdx = index + direction;
    if (index < 0 || targetIdx < 0 || targetIdx >= queuedPosts.length) return;
    const a = queuedPosts[index];
    const b = queuedPosts[targetIdx];
    const nextPosts = store.posts.map((p) => {
      if (p.id === a.id) return { ...p, scheduledAt: b.scheduledAt };
      if (p.id === b.id) return { ...p, scheduledAt: a.scheduledAt };
      return p;
    });
    await onSaveStore({ posts: nextPosts });
    onNotify('Swapped queue slot order.');
  };

  const handlePublishNow = async (postId: string) => {
    setPublishingId(postId);
    try {
      await onPublishPost(postId);
    } finally {
      setPublishingId(null);
    }
  };

  const handleAddSlot = async () => {
    const nextSlot: QueueSlot = {
      id: `slot-${Date.now()}`,
      accountId: store.activeAccountId,
      dayOfWeek: newDay,
      time: newTime,
      label: newLabel.trim() || 'Scheduled Slot',
      enabled: true,
    };
    await onSaveStore({ queueSlots: [...store.queueSlots, nextSlot] });
    onNotify(`Added ${DAY_NAMES[newDay]} ${newTime} posting slot.`);
  };

  const handleToggleSlot = async (id: string) => {
    await onSaveStore({
      queueSlots: store.queueSlots.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    });
  };

  const handleDeleteSlot = async (id: string) => {
    await onSaveStore({
      queueSlots: store.queueSlots.filter((s) => s.id !== id),
    });
    onNotify('Deleted posting slot.');
  };

  const renderPostRow = (post: PostItem, timeLabel?: string) => {
    const idx = queuedPosts.findIndex((p) => p.id === post.id);
    return (
      <div
        key={post.id}
        className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
            <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#0071E3] dark:text-[#0A84FF]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {timeLabel ||
                (post.scheduledAt
                  ? new Date(post.scheduledAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Queued')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Score {post.predictiveScore}/100
            </span>
            <span aria-hidden="true">·</span>
            <span>{post.blocks.length > 1 ? `Thread (${post.blocks.length})` : post.format}</span>
            {post.automations.autoPlugEnabled && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#248A3D] dark:text-[#30D158] font-medium">Auto-Plug ON</span>
              </>
            )}
          </div>
          <p className="text-sm text-[#1D1D1F] dark:text-[#E5E5EA] leading-relaxed whitespace-pre-line line-clamp-3">
            {post.blocks[0]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={idx <= 0}
            onClick={() => handleSwapOrder(post.id, -1)}
            aria-label="Move earlier in queue"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.045] hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-[#515154] dark:text-[#D1D1D6] disabled:opacity-35 transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={idx < 0 || idx >= queuedPosts.length - 1}
            onClick={() => handleSwapOrder(post.id, 1)}
            aria-label="Move later in queue"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.045] hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-[#515154] dark:text-[#D1D1D6] disabled:opacity-35 transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEditPost(post)}
            className="apple-btn-secondary px-3 py-1.5 text-xs"
          >
            <Edit3 className="h-3.5 w-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
            <span>Edit</span>
          </button>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(post.blocks[0] || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="apple-btn-secondary px-3 py-1.5 text-xs"
          >
            Post on X ($0)
          </a>
          <button
            type="button"
            disabled={publishingId === post.id}
            onClick={() => handlePublishNow(post.id)}
            className="apple-btn-primary px-3.5 py-1.5 text-xs"
          >
            <Send className="h-3 w-3" aria-hidden="true" />
            <span>{publishingId === post.id ? 'Sending...' : 'Publish Now'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleDeletePost(post.id)}
            aria-label="Delete queued post"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            My Queue &amp; Calendar
          </h2>
          <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
            Day-by-day slot schedule, 7-day calendar, drafts, and published archive.
          </p>
        </div>

        <div className="apple-segmented">
          {(
            [
              { id: 'queued', label: `Queue (${queuedPosts.length})` },
              { id: 'calendar', label: '7-Day Calendar' },
              { id: 'drafts', label: `Drafts (${draftPosts.length})` },
              { id: 'published', label: `Published (${publishedPosts.length})` },
              { id: 'slots', label: 'Time Slots' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-[9px] text-xs font-medium transition-all whitespace-nowrap ${
                tab === t.id ? 'apple-segment-active' : 'apple-segment-idle'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DAY-BY-DAY QUEUE WITH OPEN SLOTS */}
      {tab === 'queued' && (
        <div className="space-y-4">
          {dayGroupedTimeline.map((day) => {
            if (day.slotsForDay.length === 0 && day.extraPosts.length === 0) return null;
            return (
              <section key={day.dayKey} className="apple-card overflow-hidden">
                <div className="px-5 py-3 bg-black/[0.025] dark:bg-white/[0.03] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs">
                  <span className="font-display font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {day.dayLabel}
                  </span>
                  <span className="font-mono text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                    {day.slotsForDay.filter((s) => s.post).length + day.extraPosts.length} scheduled
                  </span>
                </div>

                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                  {day.slotsForDay.map((entry) =>
                    entry.post ? (
                      renderPostRow(entry.post, entry.timeLabel)
                    ) : (
                      <div
                        key={entry.slot.id + day.dayKey}
                        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6E6E73] dark:text-[#98989D]"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-[#1D1D1F] dark:text-[#E5E5EA] tabular-nums">
                            {entry.timeLabel}
                          </span>
                          <span>·</span>
                          <span>{entry.slot.label}</span>
                          <span>·</span>
                          <span className="text-[#86868B]">Open slot</span>
                        </div>
                        {onWriteIntoSlot && (
                          <button
                            type="button"
                            onClick={() => onWriteIntoSlot(entry.iso)}
                            className="inline-flex items-center gap-1 text-[#0071E3] dark:text-[#0A84FF] font-medium hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Fill Slot</span>
                          </button>
                        )}
                      </div>
                    )
                  )}

                  {day.extraPosts.map((post) => renderPostRow(post))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* 7-DAY CALENDAR */}
      {tab === 'calendar' && (
        <section className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {dayGroupedTimeline.map((day) => {
            const posts = [
              ...day.slotsForDay.map((s) => s.post).filter((p): p is PostItem => Boolean(p)),
              ...day.extraPosts,
            ];
            return (
              <div
                key={day.dayKey}
                className="apple-card p-3.5 flex flex-col gap-3 min-h-[240px]"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                    {day.dayLabel.split(' · ')[0]}
                  </span>
                  <Calendar className="h-3.5 w-3.5 text-[#86868B] shrink-0" aria-hidden="true" />
                </div>
                {posts.length === 0 ? (
                  <div className="text-xs text-[#86868B]">Open day</div>
                ) : (
                  <div className="space-y-2.5">
                    {posts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onEditPost(p)}
                        className="w-full text-left apple-subsurface p-2.5 hover:border-[#0071E3] dark:hover:border-[#0A84FF] transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#0071E3] dark:text-[#0A84FF] tabular-nums">
                          <span>
                            {p.scheduledAt
                              ? new Date(p.scheduledAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                          <span>{p.predictiveScore}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#3A3A3C] dark:text-[#D1D1D6] line-clamp-3">
                          {p.blocks[0]}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* DRAFTS */}
      {tab === 'drafts' && (
        <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
          {draftPosts.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
              No saved drafts right now.
            </div>
          ) : (
            draftPosts.map((post) => (
              <div
                key={post.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                    Score {post.predictiveScore}/100 · {post.frameworkName || 'Custom'}
                  </div>
                  <p className="text-sm text-[#1D1D1F] dark:text-[#E5E5EA] whitespace-pre-line line-clamp-3 leading-relaxed">
                    {post.blocks[0]}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditPost(post)}
                    className="apple-btn-secondary px-3.5 py-1.5 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveToQueue(post)}
                    className="apple-btn-primary px-3.5 py-1.5 text-xs"
                  >
                    Move to Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    aria-label="Delete draft"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* PUBLISHED */}
      {tab === 'published' && (
        <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
          {publishedPosts.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
              No published posts for this X account yet.
            </div>
          ) : (
            publishedPosts.map((post) => (
              <div key={post.id} className="p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                  <div>
                    <span className="font-semibold text-[#248A3D] dark:text-[#30D158]">
                      {post.status === 'published' ? 'Published' : 'Failed'}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>Score {post.predictiveScore}/100</span>
                  </div>
                  <div className="font-mono text-[#3A3A3C] dark:text-[#D1D1D6]">
                    {post.metrics.impressions.toLocaleString()} views · {post.metrics.likes} likes ·{' '}
                    {post.metrics.bookmarks} saves · {post.metrics.offerClicks} offer clicks
                  </div>
                </div>
                <p className="text-sm text-[#1D1D1F] dark:text-[#E5E5EA] whitespace-pre-line leading-relaxed">
                  {post.blocks[0]}
                </p>
              </div>
            ))
          )}
        </section>
      )}

      {/* WEEKLY TIME SLOTS */}
      {tab === 'slots' && (
        <section className="apple-card p-6 space-y-5">
          <div>
            <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Custom Weekly Posting Slots
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              Every post you add to My Queue snaps into the next enabled time slot for this X account.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 pb-5 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                Day
              </label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="apple-input w-auto"
              >
                {DAY_NAMES.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                Time (24h)
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="apple-input w-auto font-mono"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                Slot Purpose
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., Morning Authority / Giveaway"
                className="apple-input"
              />
            </div>
            <button
              type="button"
              onClick={handleAddSlot}
              className="apple-btn-primary px-5 py-2.5 text-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Slot</span>
            </button>
          </div>

          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {store.queueSlots
              .slice()
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time))
              .map((slot) => (
                <div key={slot.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={() => handleToggleSlot(slot.id)}
                      className="h-4 w-4 accent-[#0071E3]"
                    />
                    <span className="font-mono font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] w-24 tabular-nums">
                      {DAY_NAMES[slot.dayOfWeek]} {slot.time}
                    </span>
                    <span className="text-[#6E6E73] dark:text-[#98989D]">{slot.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    aria-label="Delete slot"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
