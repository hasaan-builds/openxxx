import type { MonetizationOffer, PostItem, QueueSlot } from './types';

/**
 * Counts X/Twitter effective character count (URLs count as 23 chars on X).
 */
export function countTweetChars(text: string): number {
  if (!text) return 0;
  const normalized = text.replace(/https?:\/\/\S+/g, 'x'.repeat(23));
  return normalized.length;
}

/**
 * Finds the next available ISO timestamp matching enabled QueueSlots
 * that does not already have a queued post scheduled within 20 minutes.
 */
export function findNextOpenSlot(
  slots: QueueSlot[],
  existingPosts: PostItem[],
  fromDate: Date = new Date()
): string {
  const enabledSlots = slots.filter((s) => s.enabled);
  if (enabledSlots.length === 0) {
    const fallback = new Date(fromDate.getTime() + 60 * 60 * 1000);
    fallback.setMinutes(0, 0, 0);
    return fallback.toISOString();
  }

  const occupiedTimestamps = existingPosts
    .filter((p) => p.status === 'queued' && p.scheduledAt)
    .map((p) => new Date(p.scheduledAt!).getTime());

  // Search up to 30 days ahead
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const candidateDay = new Date(fromDate);
    candidateDay.setDate(candidateDay.getDate() + dayOffset);
    const dow = candidateDay.getDay();

    const daySlots = enabledSlots
      .filter((s) => s.dayOfWeek === dow)
      .sort((a, b) => a.time.localeCompare(b.time));

    for (const slot of daySlots) {
      const [hh, mm] = slot.time.split(':').map(Number);
      const slotDate = new Date(candidateDay);
      slotDate.setHours(hh || 9, mm || 0, 0, 0);

      // Must be at least 5 minutes in the future
      if (slotDate.getTime() <= fromDate.getTime() + 5 * 60 * 1000) {
        continue;
      }

      const isOccupied = occupiedTimestamps.some(
        (ts) => Math.abs(ts - slotDate.getTime()) < 20 * 60 * 1000
      );
      if (!isOccupied) {
        return slotDate.toISOString();
      }
    }
  }

  const fallback = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
  return fallback.toISOString();
}

/**
 * Picks the best published Evergreen post eligible for automatic recycling
 * based on its evergreenIntervalDays cooldown and highest engagement.
 */
export function pickEvergreenCandidate(
  posts: PostItem[],
  now: Date = new Date()
): PostItem | null {
  const eligible = posts.filter((p) => {
    if (p.status !== 'published' || !p.automations.isEvergreen || !p.publishedAt) {
      return false;
    }
    const intervalDays = Math.max(7, p.automations.evergreenIntervalDays || 21);
    const ageMs = now.getTime() - new Date(p.publishedAt).getTime();
    return ageMs >= intervalDays * 24 * 60 * 60 * 1000;
  });

  if (eligible.length === 0) return null;

  return eligible.sort((a, b) => {
    const scoreA = a.metrics.likes + a.metrics.retweets * 2 + a.metrics.bookmarks * 3;
    const scoreB = b.metrics.likes + b.metrics.retweets * 2 + b.metrics.bookmarks * 3;
    return scoreB - scoreA;
  })[0];
}

export interface FrameworkRoiRow {
  frameworkName: string;
  postsCount: number;
  avgPredictiveScore: number;
  avgImpressions: number;
  engagementRate: number;
  totalOfferClicks: number;
}

/**
 * Computes data-driven ROI attribution grouped by Copywriting Framework.
 */
export function computeFrameworkRoi(posts: PostItem[]): FrameworkRoiRow[] {
  const published = posts.filter((p) => p.status === 'published');
  const map = new Map<string, PostItem[]>();

  for (const p of published) {
    const key = p.frameworkName || 'Custom / Freestyle';
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }

  const rows: FrameworkRoiRow[] = [];
  for (const [frameworkName, group] of map.entries()) {
    const postsCount = group.length;
    const totalImpressions = group.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalEngagements = group.reduce(
      (s, p) => s + p.metrics.likes + p.metrics.retweets + p.metrics.replies + p.metrics.bookmarks,
      0
    );
    const avgPredictiveScore = Math.round(
      group.reduce((s, p) => s + p.predictiveScore, 0) / postsCount
    );
    const totalOfferClicks = group.reduce((s, p) => s + p.metrics.offerClicks, 0);

    rows.push({
      frameworkName,
      postsCount,
      avgPredictiveScore,
      avgImpressions: Math.round(totalImpressions / postsCount),
      engagementRate:
        totalImpressions > 0
          ? Math.round((totalEngagements / totalImpressions) * 1000) / 10
          : 0,
      totalOfferClicks,
    });
  }

  return rows.sort((a, b) => b.totalOfferClicks - a.totalOfferClicks || b.avgImpressions - a.avgImpressions);
}

export function summarizeOfferPerformance(offers: MonetizationOffer[]) {
  const totalClicks = offers.reduce((s, o) => s + o.clicks, 0);
  const totalLeads = offers.reduce((s, o) => s + o.leads, 0);
  const totalRevenue = offers.reduce((s, o) => s + o.estimatedRevenue, 0);
  const conversionRate = totalClicks > 0 ? Math.round((totalLeads / totalClicks) * 1000) / 10 : 0;
  return { totalClicks, totalLeads, totalRevenue, conversionRate };
}
