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

  const [news, reddit, hn, github, custom] = await Promise.all([
    fetchGoogleNews(niche),
    fetchRedditPainPoints(subreddits, niche),
    fetchHackerNews(niche),
    includeGithub ? fetchGithubBreakouts(niche) : Promise.resolve([]),
    fetchCustomRss(customRssUrls, niche),
  ]);

  const combined = [...reddit, ...news, ...github, ...hn, ...custom].sort(
    (a, b) => b.signalScore - a.signalScore
  );

  const result = {
    items: combined.slice(0, 20),
    liveCount: combined.length,
  };
  if (result.liveCount > 0) {
    scanCache.set(cacheKey, { ...result, cachedAt: Date.now() });
  }
  return result;
}

/**
 * Built-in $0 Open-Source Tool: Jina Reader (github.com/jina-ai/reader, Apache-2.0)
 * Converts any public article, GitHub repo, or Whop offer page into clean LLM-ready Markdown.
 */
export async function extractUrlWithJinaReader(rawUrl: string): Promise<{
  url: string;
  title: string;
  markdown: string;
  keyTakeaways: string[];
  engine: 'jina-reader' | 'direct-html';
}> {
  const cleanUrl = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  new URL(cleanUrl); // Validate URL

  let markdown = '';
  let engine: 'jina-reader' | 'direct-html' = 'jina-reader';

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
