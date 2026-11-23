import type { RadarItem } from '../src/lib/types';

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs = 5500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': 'GhostPilot-Research/1.0 (+https://github.com)',
        ...headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function stripXmlTags(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssItems(xml: string, limit = 6): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return matches.slice(0, limit).map((block) => {
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? stripXmlTags(m[1]) : '';
    };
    return {
      title: getTag('title'),
      link: getTag('link'),
      description: getTag('description'),
      pubDate: getTag('pubDate') || new Date().toISOString(),
    };
  });
}

async function fetchGoogleNews(niche: string): Promise<RadarItem[]> {
  try {
    const q = encodeURIComponent(niche);
    const res = await fetchWithTimeout(
      `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parseRssItems(xml, 5);
    return parsed
      .filter((item) => item.title)
      .map((item, idx) => ({
        id: `gn-${Date.now()}-${idx}`,
        source: 'Google News' as const,
        sourceDetail: `Live News · ${niche}`,
        title: item.title,
        summary: `Fresh breaking news angle in ${niche} — tap Write Post or Make Free PDF to turn this into content.`,
        url: item.link || 'https://news.google.com',
        niche,
        signalScore: Math.max(76, 92 - idx * 3),
        publishedAt: new Date(item.pubDate).toISOString() || new Date().toISOString(),
        painPointTag: 'Breaking Industry Trend',
      }));
  } catch {
    return [];
  }
}

async function fetchRedditPainPoints(subreddits: string[], niche: string): Promise<RadarItem[]> {
  const results: RadarItem[] = [];
  const targets = subreddits.filter(Boolean).slice(0, 3);

  await Promise.all(
    targets.map(async (sub) => {
      const cleanSub = sub.replace(/^r\//i, '').trim();
      if (!cleanSub) return;
      try {
        const res = await fetchWithTimeout(
          `https://www.reddit.com/r/${encodeURIComponent(cleanSub)}/hot.json?limit=6`,
          { Accept: 'application/json' }
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: {
            children?: Array<{
              data?: {
                id?: string;
                title?: string;
                selftext?: string;
                ups?: number;
                num_comments?: number;
                permalink?: string;
                created_utc?: number;
                stickied?: boolean;
              };
            }>;
          };
        };

        const posts = (json.data?.children || [])
          .map((c) => c.data)
          .filter((d): d is NonNullable<typeof d> => Boolean(d && d.title && !d.stickied))
          .slice(0, 3);

        posts.forEach((p, idx) => {
          const ups = p.ups ?? 0;
          const comments = p.num_comments ?? 0;
          const isQuestion = /\?|how|why|help|struggl|advice|mistake|fail/i.test(p.title || '');
          results.push({
            id: `rd-${cleanSub}-${p.id || idx}-${Date.now()}`,
            source: 'Reddit Pain-Point',
            sourceDetail: `r/${cleanSub} · ${ups} upvotes · ${comments} comments`,
            title: p.title || 'Community Discussion',
            summary:
              (p.selftext || '').replace(/\s+/g, ' ').trim().slice(0, 260) ||
              `Active buyer discussion in r/${cleanSub} with ${comments} community replies.`,
            url: p.permalink ? `https://www.reddit.com${p.permalink}` : `https://www.reddit.com/r/${cleanSub}`,
            niche,
            signalScore: Math.min(98, 78 + Math.round(Math.log10(Math.max(10, ups + comments)) * 8)),
            publishedAt: p.created_utc
              ? new Date(p.created_utc * 1000).toISOString()
              : new Date().toISOString(),
            painPointTag: isQuestion ? 'Buyer Question / Pain Point' : 'Community Signal',
          });
        });
      } catch {
        // Direct reddit.com JSON may be blocked on cloud IPs; handled by fallback below
      }
    })
  );

  // Cloud-safe $0 fallback: when Reddit blocks direct .json requests (HTTP 403),
  // pull live Reddit discussions via Google News RSS site:reddit.com search.
  if (results.length === 0) {
    try {
      const subQuery = targets
        .map((s) => `site:reddit.com/r/${s.replace(/^r\//i, '').trim()}`)
        .join(' OR ');
      const shortNiche = niche
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3)
        .join(' ');
      const q = encodeURIComponent(
        subQuery ? `(${subQuery}) ${shortNiche}` : `site:reddit.com ${shortNiche}`
      );
      const rssRes = await fetchWithTimeout(
        `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
        {},
        6000
      );
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const parsed = parseRssItems(xml, 5);
        parsed
          .filter((item) => item.title)
          .forEach((item, idx) => {
            const cleanTitle = item.title.replace(/\s*-\s*Reddit$/i, '').trim();
            const isQuestion = /\?|how|why|help|struggl|advice|mistake|fail/i.test(cleanTitle);
            results.push({
              id: `rd-rss-${Date.now()}-${idx}`,
              source: 'Reddit Pain-Point',
              sourceDetail: `Reddit Live (${targets[0] || 'community'})`,
              title: cleanTitle,
              summary: isQuestion
                ? `Real buyer question surfaced on Reddit for ${niche} — ideal for a contrarian take or Comment-to-PDF giveaway.`
                : `Active Reddit thread in ${niche} — tap Write Post or Make Free PDF to turn this into content.`,
              url: item.link || 'https://www.reddit.com',
              niche,
              signalScore: Math.max(80, 93 - idx * 2),
              publishedAt: new Date(item.pubDate).toISOString() || new Date().toISOString(),
              painPointTag: isQuestion ? 'Buyer Question / Pain Point' : 'Community Signal',
            });
          });
      }
    } catch {
      // Non-fatal
    }
  }

  return results;
}

async function fetchGithubBreakouts(niche: string): Promise<RadarItem[]> {
  try {
    // Extract 1-2 focused core words so multi-word marketing niches still match real GitHub repos
    const stopWords = new Set(['high', 'ticket', 'and', 'for', 'the', 'with', 'setting', 'online', 'digital', 'making']);
    const coreWords = niche
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w))
      .slice(0, 2);
    const searchTerm = coreWords.join(' ') || niche.split(/\s+/)[0] || 'automation';
    const query = encodeURIComponent(`${searchTerm} stars:>150`);
    const res = await fetchWithTimeout(
      `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=4`,
      { Accept: 'application/vnd.github+json' }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id: number;
        full_name: string;
        description: string | null;
        stargazers_count: number;
        language: string | null;
        html_url: string;
        pushed_at: string;
      }>;
    };

    return (data.items || []).map((repo, idx) => ({
      id: `gh-${repo.id}-${Date.now()}`,
      source: 'GitHub Trending' as const,
      sourceDetail: `${repo.stargazers_count.toLocaleString()} ★ · ${repo.language || 'Open Source'}`,
      title: `${repo.full_name} — Trending open-source repository`,
      summary: repo.description || `Fast-growing open-source repository relevant to ${niche}.`,
      url: repo.html_url,
      niche,
      signalScore: Math.min(97, 82 + Math.max(0, 10 - idx * 2)),
      publishedAt: repo.pushed_at || new Date().toISOString(),
      painPointTag: 'Breakout Tool / Repo',
    }));
  } catch {
    return [];
  }
}

async function fetchHackerNews(niche: string): Promise<RadarItem[]> {
  try {
    const q = encodeURIComponent(niche);
    const res = await fetchWithTimeout(
      `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=story&hitsPerPage=3`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: Array<{
        objectID: string;
        title?: string;
        url?: string;
        points?: number;
        num_comments?: number;
        created_at?: string;
      }>;
    };

    return (data.hits || [])
      .filter((h) => h.title)
      .map((h) => ({
        id: `hn-${h.objectID}-${Date.now()}`,
        source: 'Hacker News' as const,
        sourceDetail: `HN · ${h.points || 0} pts · ${h.num_comments || 0} comments`,
        title: h.title!,
        summary: `Trending builder discussion on Hacker News around "${niche}".`,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        niche,
        signalScore: Math.min(95, 75 + Math.min(20, Math.round((h.points || 10) / 10))),
        publishedAt: h.created_at || new Date().toISOString(),
        painPointTag: 'Builder Debate',
      }));
  } catch {
    return [];
  }
}

async function fetchCustomRss(urls: string[], niche: string): Promise<RadarItem[]> {
  const results: RadarItem[] = [];
  await Promise.all(
    urls
      .filter((u) => /^https?:\/\//i.test(u.trim()))
      .slice(0, 3)
      .map(async (url) => {
        try {
          const res = await fetchWithTimeout(url.trim());
          if (!res.ok) return;
          const xml = await res.text();
          const parsed = parseRssItems(xml, 3);
          const host = new URL(url.trim()).hostname.replace(/^www\./, '');
          parsed.forEach((item, idx) => {
            if (!item.title) return;
            results.push({
              id: `rss-${host}-${idx}-${Date.now()}`,
              source: 'Custom RSS',
              sourceDetail: host,
              title: item.title,
              summary: item.description.slice(0, 260) || `Fresh update from ${host}.`,
              url: item.link || url,
              niche,
              signalScore: 85 - idx * 2,
              publishedAt: new Date(item.pubDate).toISOString() || new Date().toISOString(),
              painPointTag: 'Trusted Source',
            });
          });
        } catch {
          // Skip unreachable RSS URL
        }
      })
  );
  return results;
}

async function fetchBlueskySignals(niche: string): Promise<RadarItem[]> {
  const core = niche
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(' ');
  const q = encodeURIComponent(core || niche);

  // 1. Try direct Bluesky Public XRPC search first
  try {
    const res = await fetchWithTimeout(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${q}&sort=top&limit=4`,
      { Accept: 'application/json' },
      3000
    );
    if (res.ok) {
      const data = (await res.json()) as {
        posts?: Array<{
          uri?: string;
          author?: { handle?: string; displayName?: string };
          record?: { text?: string; createdAt?: string };
          likeCount?: number;
          replyCount?: number;
        }>;
      };
      const livePosts = (data.posts || [])
        .filter((p) => (p.record?.text || '').trim().length >= 30)
        .slice(0, 3)
        .map((p, idx) => {
          const text = (p.record?.text || '').replace(/\s+/g, ' ').trim();
          const rkey = (p.uri || '').split('/').pop() || '';
          const handle = p.author?.handle || 'bsky.social';
          return {
            id: `bsky-${Date.now()}-${idx}`,
            source: 'Bluesky Live' as const,
            sourceDetail: `@${handle} · ${p.likeCount || 0} likes · ${p.replyCount || 0} replies`,
            title: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
            summary: `Live public social angle on "${core || niche}" — turn this debate into a contrarian X post or thread.`,
            url: rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : 'https://bsky.app',
            niche,
            signalScore: Math.min(96, 81 + Math.min(14, Math.round(((p.likeCount || 0) + (p.replyCount || 0) * 3) / 5))),
            publishedAt: p.record?.createdAt || new Date().toISOString(),
            painPointTag: 'Live Social Debate',
          };
        });
      if (livePosts.length > 0) return livePosts;
    }
  } catch {
    // Fall back to cloud-safe indexed social search below
  }

  // 2. Cloud-safe $0 fallback: live indexed Bluesky & X viral discussions via Google News RSS
  try {
    const rssQuery = encodeURIComponent(`(site:x.com OR site:bsky.app) ${core || niche}`);
    const rssRes = await fetchWithTimeout(
      `https://news.google.com/rss/search?q=${rssQuery}&hl=en-US&gl=US&ceid=US:en`,
      {},
      5000
    );
    if (!rssRes.ok) return [];
    const xml = await rssRes.text();
    const parsed = parseRssItems(xml, 3);
    return parsed
      .filter((item) => item.title)
      .map((item, idx) => ({
        id: `bsky-rss-${Date.now()}-${idx}`,
        source: 'Bluesky Live' as const,
        sourceDetail: `Live Social Thread (X / Bluesky)`,
        title: item.title.replace(/\s*-\s*(X|Twitter|Bluesky)$/i, '').trim(),
        summary: `Trending social conversation in ${niche} — tap Write Post to quote, counter, or expand this angle.`,
        url: item.link || 'https://bsky.app',
        niche,
        signalScore: Math.max(82, 94 - idx * 3),
        publishedAt: new Date(item.pubDate).toISOString() || new Date().toISOString(),
        painPointTag: 'Live Social Debate',
      }));
  } catch {
    return [];
  }
}

async function fetchDevToSignals(niche: string): Promise<RadarItem[]> {
  try {
    const tag = niche
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .find((w) => ['ai', 'saas', 'productivity', 'marketing', 'startup', 'programming', 'webdev', 'javascript', 'python', 'career', 'fitness'].includes(w));
    const url = tag
      ? `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=14&per_page=3`
      : `https://dev.to/api/articles?top=7&per_page=3`;
    const res = await fetchWithTimeout(url, { Accept: 'application/json' }, 4500);
    if (!res.ok) return [];
    const articles = (await res.json()) as Array<{
      id: number;
      title?: string;
      description?: string;
      url?: string;
      public_reactions_count?: number;
      comments_count?: number;
      published_at?: string;
    }>;
    return (articles || [])
      .filter((a) => a.title)
      .slice(0, 2)
      .map((a, idx) => ({
        id: `devto-${a.id}-${Date.now()}-${idx}`,
        source: 'Dev.to' as const,
        sourceDetail: `Dev.to · ${a.public_reactions_count || 0} reactions · ${a.comments_count || 0} comments`,
        title: a.title!,
        summary: (a.description || '').trim() || `Trending long-form breakdown for ${niche} — easy to distill into a thread or checklist PDF.`,
        url: a.url || 'https://dev.to',
        niche,
        signalScore: Math.min(94, 79 + Math.min(12, Math.round((a.public_reactions_count || 10) / 15))),
        publishedAt: a.published_at || new Date().toISOString(),
        painPointTag: 'Deep-Dive Guide',
      }));
  } catch {
    return [];
  }
}

async function fetchProductHuntRss(niche: string): Promise<RadarItem[]> {
  try {
    const res = await fetchWithTimeout('https://www.producthunt.com/feed', {}, 4500);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    const keywords = niche
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);
    const items = entries.slice(0, 12).map((block, idx) => {
      const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkM = block.match(/<link[^>]*href="([^"]+)"/i);
      const contentM = block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
      const title = titleM ? stripXmlTags(titleM[1]) : '';
      const rawDesc = contentM ? stripXmlTags(contentM[1]) : '';
      const cleanDesc = rawDesc.replace(/Discussion\s*\|\s*Link/gi, '').trim();
      const scoreBoost = keywords.some((kw) => `${title} ${cleanDesc}`.toLowerCase().includes(kw)) ? 8 : 0;
      return {
        id: `ph-${Date.now()}-${idx}`,
        source: 'Product Hunt' as const,
        sourceDetail: 'Product Hunt Launch Feed',
        title,
        summary:
          cleanDesc.slice(0, 220) ||
          `Trending launch on Product Hunt — turn into a "New Tool Breakdown" thread for ${niche}.`,
        url: linkM ? linkM[1] : 'https://www.producthunt.com',
        niche,
        signalScore: 76 + scoreBoost,
        publishedAt: new Date().toISOString(),
        painPointTag: 'Trending Tool Launch',
      };
    });
    return items
      .filter((i) => i.title)
      .sort((a, b) => b.signalScore - a.signalScore)
      .slice(0, 2);
  } catch {
    return [];
  }
}

const scanCache = new Map<string, { items: RadarItem[]; liveCount: number; cachedAt: number }>();
const SCAN_CACHE_TTL_MS = 5 * 60 * 1000;

export async function runLiveIndustryScan(params: {
  niche: string;
  subreddits: string[];
  customRssUrls: string[];
  includeGithub: boolean;
  forceRefresh?: boolean;
}): Promise<{ items: RadarItem[]; liveCount: number; fromCache?: boolean }> {
  const { niche, subreddits, customRssUrls, includeGithub, forceRefresh = false } = params;
  const cacheKey = `${niche.toLowerCase()}|${subreddits.join(',').toLowerCase()}|${customRssUrls.join(',')}|${includeGithub}`;
  const cached = scanCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.cachedAt < SCAN_CACHE_TTL_MS) {
    return { items: cached.items, liveCount: cached.liveCount, fromCache: true };
  }

  const [news, reddit, bsky, hn, github, devto, ph, custom] = await Promise.all([
    fetchGoogleNews(niche),
    fetchRedditPainPoints(subreddits, niche),
    fetchBlueskySignals(niche),
    fetchHackerNews(niche),
    includeGithub ? fetchGithubBreakouts(niche) : Promise.resolve([]),
    fetchDevToSignals(niche),
    fetchProductHuntRss(niche),
    fetchCustomRss(customRssUrls, niche),
  ]);

  const combined = [...reddit, ...bsky, ...news, ...github, ...hn, ...devto, ...ph, ...custom].sort(
    (a, b) => b.signalScore - a.signalScore
  );

  const result = {
    items: combined.slice(0, 24),
    liveCount: combined.length,
  };
  if (result.liveCount > 0) {
    scanCache.set(cacheKey, { ...result, cachedAt: Date.now() });
  }
  return result;
}

function extractYoutubeVideoId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(?:shorts|embed)\/([a-zA-Z0-9_-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Built-in $0 YouTube Transcript & Metadata Extractor
 * Inspired by jdepoix/youtube-transcript-api & vsmutok/ytscrape (ZERO YouTube API key).
 */
async function tryExtractYoutubeTranscript(cleanUrl: string, videoId: string): Promise<{
  title: string;
  markdown: string;
  keyTakeaways: string[];
} | null> {
  try {
    let title = `YouTube Video (${videoId})`;
    let author = '';
    try {
      const oembedRes = await fetchWithTimeout(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`,
        {},
        4500
      );
      if (oembedRes.ok) {
        const meta = (await oembedRes.json()) as { title?: string; author_name?: string };
        if (meta.title) title = meta.title;
        if (meta.author_name) author = meta.author_name;
      }
    } catch {
      // Continue with watch page
    }

    const pageRes = await fetchWithTimeout(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      { 'Accept-Language': 'en-US,en;q=0.9' },
      2800
    );
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    let transcriptText = '';
    const tracksMatch = html.match(/"captionTracks":(\[[\s\S]*?\])/);
    if (tracksMatch) {
      try {
        const tracks = JSON.parse(tracksMatch[1]) as Array<{ baseUrl?: string; languageCode?: string }>;
        const preferred =
          tracks.find((t) => t.languageCode?.startsWith('en')) || tracks[0];
        if (preferred?.baseUrl) {
          const capRes = await fetchWithTimeout(preferred.baseUrl, {}, 5500);
          if (capRes.ok) {
            const xml = await capRes.text();
            const chunks = (xml.match(/<text[^>]*>([\s\S]*?)<\/text>/gi) || []).map((t) =>
              stripXmlTags(t)
            );
            transcriptText = chunks.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
          }
        }
      } catch {
        // Fallback to description
      }
    }

    const descMatch = html.match(/"shortDescription":"([\s\S]*?)"/);
    const shortDesc = descMatch
      ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').slice(0, 1200)
      : '';

    const combined = transcriptText || shortDesc;
    if (!combined) return null;

    const sentences = combined
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 35 && s.length <= 220);

    const keyTakeaways = Array.from(new Set(sentences)).slice(0, 5);
    const markdown = `Title: ${title}${author ? ` (by ${author})` : ''}\nSource: ${cleanUrl}\n\n${combined.slice(0, 7000)}`;

    return { title, markdown, keyTakeaways };
  } catch {
    return null;
  }
}

/**
 * Built-in $0 Open-Source Tools:
 * - Jina Reader (github.com/jina-ai/reader, Apache-2.0)
 * - YouTube Transcript Extractor (inspired by jdepoix/youtube-transcript-api & ytscrape)
 * Converts any public YouTube video, article, GitHub repo, or Whop offer page into clean LLM-ready Markdown.
 */
export async function extractUrlWithJinaReader(rawUrl: string): Promise<{
  url: string;
  title: string;
  markdown: string;
  keyTakeaways: string[];
  engine: 'jina-reader' | 'youtube-transcript' | 'direct-html';
}> {
  const cleanUrl = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  new URL(cleanUrl); // Validate URL

  // 1. If YouTube URL, extract title + public captions with ZERO API key
  const ytId = extractYoutubeVideoId(cleanUrl);
  if (ytId) {
    const yt = await tryExtractYoutubeTranscript(cleanUrl, ytId);
    if (yt) {
      return {
        url: cleanUrl,
        title: yt.title,
        markdown: yt.markdown,
        keyTakeaways: yt.keyTakeaways,
        engine: 'youtube-transcript',
      };
    }
  }

  let markdown = '';
  let engine: 'jina-reader' | 'youtube-transcript' | 'direct-html' = 'jina-reader';

  try {
    const jinaRes = await fetchWithTimeout(
      `https://r.jina.ai/${cleanUrl}`,
      { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
      8000
    );
    if (jinaRes.ok) {
      markdown = (await jinaRes.text()).trim();
    }
  } catch {
    // Fallback below
  }

  if (!markdown) {
    engine = 'direct-html';
    const directRes = await fetchWithTimeout(cleanUrl, {}, 6000);
    if (!directRes.ok) {
      throw new Error(`Could not fetch URL (HTTP ${directRes.status}).`);
    }
    const html = await directRes.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const bodyText = stripXmlTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    );
    markdown = `${titleMatch ? `Title: ${stripXmlTags(titleMatch[1])}\n\n` : ''}${bodyText.slice(0, 6000)}`;
  }

  const titleMatch =
    markdown.match(/^Title:\s*(.+)$/m) ||
    markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim().slice(0, 140) : new URL(cleanUrl).hostname;

  const lines = markdown
    .split('\n')
    .map((l) => l.replace(/^[-*#>\d.\s]+/, '').trim())
    .filter((l) => l.length >= 35 && l.length <= 220 && !/^https?:\/\//i.test(l));

  const keyTakeaways = Array.from(new Set(lines)).slice(0, 5);

  return {
    url: cleanUrl,
    title,
    markdown: markdown.slice(0, 8000),
    keyTakeaways,
    engine,
  };
}
