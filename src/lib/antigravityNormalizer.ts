import type {
  CarouselSlideLayout,
  CarouselThemeId,
  LeadMagnet,
  LeadMagnetSection,
  PostItem,
} from './types';

export interface NormalizedAntigravityPayload {
  posts: Array<{
    blocks: string[];
    format?: PostItem['format'];
    frameworkName?: string;
  }>;
  carousels: Array<{
    title: string;
    themeId?: CarouselThemeId;
    slides: Array<{
      layout?: CarouselSlideLayout;
      eyebrow?: string;
      headline: string;
      body?: string;
      bullets?: string[];
    }>;
  }>;
  leadMagnets: Array<{
    title: string;
    subtitle?: string;
    format?: LeadMagnet['format'];
    giveawayKeyword?: string;
    sections: Array<{
      type?: LeadMagnetSection['type'];
      heading: string;
      body?: string;
      bullets?: string[];
    }>;
  }>;
}

/**
 * Extracts valid JSON from noisy or markdown-wrapped LLM output
 * so weaker/faster models succeed 100% of the time inside Antigravity.
 */
export function extractJsonFromModelOutput(rawText: string): unknown {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    throw new Error('Paste or write JSON output from Antigravity first.');
  }

  // 1. Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to recovery heuristics
  }

  // 2. Try extracting ```json ... ``` or ``` ... ``` fenced block
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // 3. Extract outermost {...} or [...] slice and strip trailing commas
  const firstObj = trimmed.indexOf('{');
  const firstArr = trimmed.indexOf('[');
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  const endObj = trimmed.lastIndexOf('}');
  const endArr = trimmed.lastIndexOf(']');
  const end = Math.max(endObj, endArr);

  if (start !== -1 && end > start) {
    const candidate = trimmed
      .slice(start, end + 1)
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"');
    try {
      return JSON.parse(candidate);
    } catch {
      // Fall through to plain-text fallback
    }
  }

  // 4. Plain-text fallback: if a weaker model ignored JSON and wrote tweets separated by ---, blank lines, or numbered items
  const rawChunks = /\n\s*---+\s*\n|\n{3,}/.test(trimmed)
    ? trimmed.split(/\n\s*---+\s*\n|\n{3,}/)
    : /(?:^|\n)\s*(?:\d+[.)]|Tweet\s+\d+[:.)])\s+/i.test(trimmed)
    ? trimmed.split(/\n(?=\s*(?:\d+[.)]|Tweet\s+\d+[:.)])\s+)/i)
    : trimmed.split(/\n{2,}/);

  const chunks = rawChunks
    .map((c) => c.replace(/^\s*(?:\d+[.)]|Tweet\s+\d+[:.)])\s+/i, '').trim())
    .filter((c) => c.length >= 20);
  if (chunks.length > 0) {
    return {
      posts: chunks.map((chunk) => ({
        blocks: [chunk],
        format: 'single',
        frameworkName: 'Antigravity Plain-Text Recovery',
      })),
    };
  }

  throw new Error('Could not find valid JSON or post drafts in the pasted output.');
}

function normalizeBlocks(rawPost: Record<string, unknown>): string[] {
  if (Array.isArray(rawPost.blocks)) {
    return rawPost.blocks.map((b) => String(b || '').trim()).filter(Boolean);
  }
  if (Array.isArray(rawPost.tweets)) {
    return rawPost.tweets.map((b) => String(b || '').trim()).filter(Boolean);
  }
  const single =
    (typeof rawPost.text === 'string' && rawPost.text) ||
    (typeof rawPost.tweet === 'string' && rawPost.tweet) ||
    (typeof rawPost.content === 'string' && rawPost.content) ||
    (typeof rawPost.body === 'string' && rawPost.body) ||
    '';
  return single.trim() ? [single.trim()] : [];
}

/**
 * Normalizes messy/partial JSON outputs from any model into GhostPilot's strict schema.
 */
export function normalizeAntigravityResults(rawInput: unknown): NormalizedAntigravityPayload {
  const out: NormalizedAntigravityPayload = {
    posts: [],
    carousels: [],
    leadMagnets: [],
  };

  if (!rawInput) return out;

  // Handle top-level array of posts directly
  if (Array.isArray(rawInput)) {
    for (const item of rawInput) {
      if (typeof item === 'string' && item.trim()) {
        out.posts.push({ blocks: [item.trim()], format: 'single' });
      } else if (item && typeof item === 'object') {
        const blocks = normalizeBlocks(item as Record<string, unknown>);
        if (blocks.length > 0) {
          out.posts.push({
            blocks,
            format: blocks.length > 1 ? 'thread' : 'single',
            frameworkName:
              typeof (item as Record<string, unknown>).frameworkName === 'string'
                ? String((item as Record<string, unknown>).frameworkName)
                : undefined,
          });
        }
      }
    }
    return out;
  }

  if (typeof rawInput !== 'object') return out;
  const obj = rawInput as Record<string, unknown>;

  const rawPosts = Array.isArray(obj.posts)
    ? obj.posts
    : Array.isArray(obj.tweets)
      ? obj.tweets
      : [];

  for (const item of rawPosts) {
    if (typeof item === 'string' && item.trim()) {
      out.posts.push({ blocks: [item.trim()], format: 'single' });
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const blocks = normalizeBlocks(rec);
      if (blocks.length > 0) {
        const fmt = rec.format;
        const validFormat: PostItem['format'] =
          fmt === 'single' || fmt === 'thread' || fmt === 'carousel' || fmt === 'giveaway'
            ? fmt
            : blocks.length > 1
              ? 'thread'
              : 'single';
        out.posts.push({
          blocks,
          format: validFormat,
          frameworkName: typeof rec.frameworkName === 'string' ? rec.frameworkName : undefined,
        });
      }
    }
  }

  if (Array.isArray(obj.carousels)) {
    for (const c of obj.carousels) {
      if (!c || typeof c !== 'object') continue;
      const rec = c as Record<string, unknown>;
      const title = typeof rec.title === 'string' ? rec.title.trim() : '';
      const rawSlides = Array.isArray(rec.slides) ? rec.slides : [];
      const slides = rawSlides
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .map((s, idx) => {
          const layout: CarouselSlideLayout =
            s.layout === 'cover' ||
            s.layout === 'framework' ||
            s.layout === 'checklist' ||
            s.layout === 'comparison' ||
            s.layout === 'quote' ||
            s.layout === 'cta'
              ? s.layout
              : idx === 0
                ? 'cover'
                : 'framework';
          return {
            layout,
            eyebrow: typeof s.eyebrow === 'string' ? s.eyebrow : `SLIDE ${idx + 1}`,
            headline: String(s.headline || s.title || '').trim(),
            body: typeof s.body === 'string' ? s.body : '',
            bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b)).filter(Boolean) : [],
          };
        })
        .filter((s) => s.headline || s.body);

      if (title && slides.length > 0) {
        const themeId: CarouselThemeId =
          rec.themeId === 'obsidian' ||
          rec.themeId === 'editorial' ||
          rec.themeId === 'cobalt' ||
          rec.themeId === 'ivory'
            ? rec.themeId
            : rec.themeId === 'blueprint'
              ? 'cobalt'
              : rec.themeId === 'emerald'
                ? 'ivory'
                : 'obsidian';
        out.carousels.push({
          title,
          themeId,
          slides,
        });
      }
    }
  }

  if (Array.isArray(obj.leadMagnets)) {
    for (const lm of obj.leadMagnets) {
      if (!lm || typeof lm !== 'object') continue;
      const rec = lm as Record<string, unknown>;
      const title = typeof rec.title === 'string' ? rec.title.trim() : '';
      const rawSections = Array.isArray(rec.sections) ? rec.sections : [];
      const sections = rawSections
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .map((s, idx) => {
          const sectionType: LeadMagnetSection['type'] =
            s.type === 'takeaway' ||
            s.type === 'framework' ||
            s.type === 'checklist' ||
            s.type === 'script' ||
            s.type === 'offer-callout'
              ? s.type
              : s.type === 'intro'
                ? 'takeaway'
                : s.type === 'case-study'
                  ? 'script'
                  : 'framework';
          return {
            type: sectionType,
            heading: String(s.heading || s.title || `Section ${idx + 1}`).trim(),
            body: typeof s.body === 'string' ? s.body : '',
            bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b)).filter(Boolean) : [],
          };
        })
        .filter((s) => s.heading || s.body);

      if (title && sections.length > 0) {
        const format: LeadMagnet['format'] =
          rec.format === 'Playbook' ||
          rec.format === 'Checklist' ||
          rec.format === 'Swipe File' ||
          rec.format === 'Deep-Dive Report'
            ? rec.format
            : rec.format === 'Case Study'
              ? 'Deep-Dive Report'
              : 'Playbook';
        out.leadMagnets.push({
          title,
          subtitle: typeof rec.subtitle === 'string' ? rec.subtitle : '',
          format,
          giveawayKeyword:
            typeof rec.giveawayKeyword === 'string' ? rec.giveawayKeyword.toUpperCase() : 'GUIDE',
          sections,
        });
      }
    }
  }

  return out;
}
