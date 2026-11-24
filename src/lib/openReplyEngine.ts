import type { OpenReplyItem } from './types';

export interface ParsedXTweetUrl {
  valid: boolean;
  tweetId?: string;
  authorHandle?: string;
  canonicalUrl?: string;
}

/**
 * Parses any X / Twitter status URL (x.com, twitter.com, mobile.x.com, with tracking params)
 * or bare numeric Tweet ID into structured fields for Open Reply.
 */
export function parseXTweetUrl(input: string): ParsedXTweetUrl {
  const raw = (input || '').trim();
  if (!raw) return { valid: false };

  if (/^\d{10,22}$/.test(raw)) {
    return {
      valid: true,
      tweetId: raw,
      canonicalUrl: `https://x.com/i/web/status/${raw}`,
    };
  }

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^mobile\./, '');
    if (host !== 'x.com' && host !== 'twitter.com' && host !== 'fxtwitter.com' && host !== 'vxtwitter.com') {
      return { valid: false };
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const statusIdx = parts.findIndex((p) => p.toLowerCase() === 'status' || p.toLowerCase() === 'statuses');
    if (statusIdx === -1 || !parts[statusIdx + 1]) {
      return { valid: false };
    }
    const tweetId = parts[statusIdx + 1].replace(/\D/g, '');
    if (!/^\d{6,22}$/.test(tweetId)) {
      return { valid: false };
    }
    const handleCandidate = statusIdx >= 1 ? parts[statusIdx - 1] : '';
    const isRealHandle =
      Boolean(handleCandidate) &&
      handleCandidate.toLowerCase() !== 'i' &&
      handleCandidate.toLowerCase() !== 'web';
    const authorHandle = isRealHandle ? `@${handleCandidate.replace(/^@/, '')}` : undefined;
    const canonicalUrl = authorHandle
      ? `https://x.com/${authorHandle.replace(/^@/, '')}/status/${tweetId}`
      : `https://x.com/i/web/status/${tweetId}`;

    return {
      valid: true,
      tweetId,
      authorHandle,
      canonicalUrl,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Builds X's native 1-click Direct Reply intent URL ($0 API cost, 100% X-ToS safe).
 * Opens X straight inside the target tweet's reply composer with the drafted reply pre-filled.
 */
export function buildXDirectReplyUrl(params: {
  tweetId?: string;
  authorHandle?: string;
  replyText: string;
}): string {
  const cleanText = (params.replyText || '').trim();
  const query = new URLSearchParams();
  if (params.tweetId && /^\d{6,22}$/.test(params.tweetId)) {
    query.set('in_reply_to', params.tweetId);
    query.set('text', cleanText);
  } else if (params.authorHandle) {
    const handle = params.authorHandle.startsWith('@')
      ? params.authorHandle
      : `@${params.authorHandle}`;
    query.set('text', cleanText.toLowerCase().startsWith(handle.toLowerCase()) ? cleanText : `${handle} ${cleanText}`);
  } else {
    query.set('text', cleanText);
  }
  return `https://x.com/intent/tweet?${query.toString()}`;
}

/**
 * Cleanly extracts readable tweet text from X's public publish.twitter.com/oembed HTML snippet.
 */
export function extractPlainTextFromOembedHtml(html: string): string {
  if (!html) return '';
  const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const rawSegment = pMatch ? pMatch[1] : html;
  return rawSegment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href="https?:\/\/t\.co\/[^"]*"[^>]*>pic\.twitter\.com\/[^<]*<\/a>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface OpenReplySafetyStatus {
  safeToSendNow: boolean;
  repliesLastHour: number;
  maxPerHour: number;
  nextSafeInSeconds: number;
  statusLabel: string;
}

/**
 * Anti-shadowban safety guard for Antigravity Direct Reply pacing.
 * Enforces max 12 replies/hour and >=45 seconds gap between consecutive replies.
 */
export function evaluateOpenReplySafetyPacing(
  queue: OpenReplyItem[],
  now: Date = new Date()
): OpenReplySafetyStatus {
  const maxPerHour = 12;
  const minGapSeconds = 45;
  const nowMs = now.getTime();
  const oneHourAgo = nowMs - 60 * 60 * 1000;

  const recentReplied = queue
    .filter((item) => item.status === 'replied' && item.repliedAt)
    .map((item) => new Date(item.repliedAt!).getTime())
    .filter((ms) => !Number.isNaN(ms) && ms >= oneHourAgo)
    .sort((a, b) => b - a);

  const repliesLastHour = recentReplied.length;

  if (repliesLastHour >= maxPerHour) {
    const oldestInWindow = recentReplied[recentReplied.length - 1];
    const nextSafeInSeconds = Math.max(1, Math.ceil((oldestInWindow + 60 * 60 * 1000 - nowMs) / 1000));
    return {
      safeToSendNow: false,
      repliesLastHour,
      maxPerHour,
      nextSafeInSeconds,
      statusLabel: `Hourly safety cap reached (${repliesLastHour}/${maxPerHour}). Pause ${Math.ceil(nextSafeInSeconds / 60)}m to protect X reach.`,
    };
  }

  if (recentReplied.length > 0) {
    const secondsSinceLast = Math.floor((nowMs - recentReplied[0]) / 1000);
    if (secondsSinceLast < minGapSeconds) {
      const wait = minGapSeconds - secondsSinceLast;
      return {
        safeToSendNow: false,
        repliesLastHour,
        maxPerHour,
        nextSafeInSeconds: wait,
        statusLabel: `Cooling down ${wait}s between direct replies (anti-spam pacing).`,
      };
    }
  }

  return {
    safeToSendNow: true,
    repliesLastHour,
    maxPerHour,
    nextSafeInSeconds: 0,
    statusLabel: `Safe to reply now (${repliesLastHour}/${maxPerHour} this hour).`,
  };
}

/**
 * Generates a 1-click Chrome Bookmarklet that captures the current X tweet URL + highlighted text
 * and launches GhostPilot's Open Reply studio preloaded with that tweet.
 */
export function buildOpenReplyBookmarklet(appOrigin: string): string {
  const cleanOrigin = (appOrigin || 'http://localhost:3000').replace(/\/$/, '');
  const code = `(() => {
    const url = window.location.href;
    const sel = (window.getSelection ? window.getSelection().toString() : '').trim();
    const articleText = sel || (document.querySelector('article [data-testid="tweetText"]')?.textContent || '').trim();
    const target = '${cleanOrigin}/?openReplyUrl=' + encodeURIComponent(url) + '&openReplyText=' + encodeURIComponent(articleText.slice(0, 420));
    window.open(target, '_blank', 'noopener');
  })();`;
  return `javascript:${encodeURIComponent(code.replace(/\s+/g, ' ').trim())}`;
}
