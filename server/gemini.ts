import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { scoreCopy } from '../src/lib/copyScorer';
import { humanizeCopy } from '../src/lib/humanizer';
import type {
  AudiencePersona,
  AuthorityDossier,
  BrandBrain,
  CopyVariation,
  LeadMagnet,
  MonetizationOffer,
  RadarItem,
} from '../src/lib/types';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

function getClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: 10000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateStructuredWithFailover(
  ai: GoogleGenAI,
  contents: string,
  responseSchema: Record<string, unknown>
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    if (response.text?.trim()) return response.text.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const isTransient = /503|504|UNAVAILABLE|DEADLINE_EXCEEDED|timeout|high demand/i.test(msg);
    if (!isTransient) throw err;
  }

  // Automatic fast free-tier failover when primary flash model has a 503/504 spike
  const liteRes = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });
  return (liteRes.text ?? '{}').trim();
}

export async function generateAuthorityDossierWithGemini(params: {
  niche: string;
  radarItems: RadarItem[];
  brandBrain: BrandBrain;
}): Promise<AuthorityDossier> {
  const ai = getClient();
  const contextText = params.radarItems
    .slice(0, 10)
    .map((r, i) => `${i + 1}. [${r.source}] ${r.title} — ${r.summary}`)
    .join('\n');

  const offerContext = params.brandBrain.offers
    .map((o) => `- ${o.name} (${o.platform}, ${o.priceLabel}): ${o.promise}`)
    .join('\n');

  const rawJson = await generateStructuredWithFailover(
    ai,
    `Conduct a Stanford STORM-style 5-angle Authority Research Dossier for an S-tier X (Twitter) creator in the "${params.niche}" niche.

Live Scraped Intelligence & Buyer Pain Points:
${contextText || 'General high-ticket industry knowledge'}

Monetization Offers to Bridge Toward:
${offerContext || 'Free PDF Playbook -> High-ticket course'}

Rules:
- Speak like a 10-year operator, zero generic fluff, zero AI clichés (${params.brandBrain.bannedCliches.join(', ')}).
- Make every bullet ultra-specific with numbers, mechanisms, or exact phrasing buyers actually use.`,
    {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        buyerPainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        coreFrameworks: { type: Type.ARRAY, items: { type: Type.STRING } },
        contrarianTruths: { type: Type.ARRAY, items: { type: Type.STRING } },
        scriptsAndProof: { type: Type.ARRAY, items: { type: Type.STRING } },
        offerBridges: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    }
  );

  const parsed = JSON.parse(rawJson || '{}') as {
    title?: string;
    buyerPainPoints?: string[];
    coreFrameworks?: string[];
    contrarianTruths?: string[];
    scriptsAndProof?: string[];
    offerBridges?: string[];
  };

  return {
    id: `dos-${Date.now()}`,
    niche: params.niche,
    title: parsed.title || `${params.niche} — 5-Angle S-Tier Authority Dossier`,
    createdAt: new Date().toISOString(),
    sourceCount: Math.max(1, params.radarItems.length),
    angles: {
      buyerPainPoints: parsed.buyerPainPoints?.slice(0, 5) || [],
      coreFrameworks: parsed.coreFrameworks?.slice(0, 5) || [],
      contrarianTruths: parsed.contrarianTruths?.slice(0, 5) || [],
      scriptsAndProof: parsed.scriptsAndProof?.slice(0, 5) || [],
      offerBridges: parsed.offerBridges?.slice(0, 4) || [],
    },
  };
}

export async function generateABVariationsWithGemini(params: {
  topic: string;
  keyInsight?: string;
  brandBrain: BrandBrain;
  persona?: AudiencePersona;
  offer?: MonetizationOffer;
}): Promise<CopyVariation[]> {
  const ai = getClient();
  const rawJson = await generateStructuredWithFailover(
    ai,
    `Generate 5 distinct high-converting X (Twitter) post variations for this topic: "${params.topic}".
Key Insight / Proof: "${params.keyInsight || 'Use concrete operator-level tactics.'}"
Niche: ${params.brandBrain.niche}
Target Audience: ${params.persona?.name || 'Niche buyers'} (${params.persona?.role || ''})
Tone: ${params.brandBrain.tone}
Offer Keyword (for variation 1 giveaway): "${params.offer?.giveawayKeyword || 'PLAYBOOK'}"
STRICTLY BANNED PHRASES (never use): ${params.brandBrain.bannedCliches.join(', ')}

Produce 5 variations using these exact 5 frameworks:
1. S-Tier Comment-to-PDF Giveaway (trigger: Hormozi Value Equation)
2. Silent Leak (Loss Aversion) (trigger: Loss Aversion)
3. Contrarian Truth + Proof (trigger: Contrarian Proof)
4. BAB (Before-After-Bridge) (trigger: Social Proof & Case Study)
5. Steal My Exact Playbook (trigger: Step-by-Step Playbook)

Keep each tweet punchy, under 280 characters (or 2-3 crisp thread tweets if needed), with short readable lines and blank line breaks.
X ALGORITHM HEAVY RANKER RULES (github.com/twitter/the-algorithm):
- NEVER put an external URL inside Tweet 1 (triggers X link penalty; links go in Auto-Plug reply).
- Optimize for 75x Author-Engaged Reply weight (ask a direct question or comment keyword), 12x Profile Click (use concrete numbers/proof), and 10x Bookmark weight (crisp bullets or numbered steps).
- ZERO AI slop (no "delve", "tapestry", "game-changer", "not just X but Y", no hashtag spam, max 1 em-dash).`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          frameworkName: { type: Type.STRING },
          trigger: { type: Type.STRING },
          blocks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    }
  );

  const raw = JSON.parse(rawJson || '[]') as Array<{
    frameworkName: string;
    trigger: CopyVariation['trigger'];
    blocks: string[];
  }>;

  return raw
    .filter((item) => Array.isArray(item.blocks) && item.blocks.length > 0)
    .slice(0, 5)
    .map((item, idx) => {
      const cleanBlocks = item.blocks.map((b) => humanizeCopy(b).cleanedText || b);
      return {
        id: `gem-var-${Date.now()}-${idx}`,
        frameworkId: `gem-fw-${idx}`,
        frameworkName: item.frameworkName || `Variation ${idx + 1}`,
        trigger: item.trigger || 'Curiosity Gap',
        blocks: cleanBlocks,
        score: scoreCopy(cleanBlocks, { brandBrain: params.brandBrain, persona: params.persona }),
      };
    })
    .sort((a, b) => b.score.total - a.score.total);
}

export async function ghostwriteWithGemini(params: {
  action: 'rewrite' | 'finish' | 'expand-thread' | 'hooks' | 'tone-shift' | 'reply';
  text: string;
  tone?: string;
  brandBrain: BrandBrain;
}): Promise<string[]> {
  const ai = getClient();
  const actionMap: Record<typeof params.action, string> = {
    rewrite: 'Rewrite this X post to maximize hook stopping power, clarity, and white-space rhythm under 280 chars.',
    finish: 'Finish this incomplete X post with a crisp payoff and strong bookmark/reply CTA under 280 chars.',
    'expand-thread': 'Expand this idea into a high-retention 4-tweet X thread (each tweet under 275 chars).',
    hooks: 'Write 1 punchy rewritten opening hook tweet with concrete numbers and a curiosity loop under 260 chars.',
    'tone-shift': `Rewrite this post in a "${params.tone || 'sharp, contrarian operator'}" tone under 280 chars.`,
    reply: 'Write 1 high-authority, insightful, non-sycophantic reply (under 200 chars) that adds a tactical angle.',
  };

  const rawJson = await generateStructuredWithFailover(
    ai,
    `${actionMap[params.action]}
Niche: ${params.brandBrain.niche}
Avoid banned phrases: ${params.brandBrain.bannedCliches.join(', ')}

Input:
${params.text}`,
    {
      type: Type.OBJECT,
      properties: {
        blocks: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    }
  );

  const parsed = JSON.parse(rawJson || '{}') as { blocks?: string[] };
  const rawBlocks = parsed.blocks?.filter(Boolean) || [params.text];
  return rawBlocks.map((b) => humanizeCopy(b).cleanedText || b);
}

export async function generateLeadMagnetWithGemini(params: {
  topic: string;
  format: LeadMagnet['format'];
  dossier?: AuthorityDossier;
  offer?: MonetizationOffer;
  brandBrain: BrandBrain;
  authorName: string;
  authorHandle: string;
}): Promise<LeadMagnet> {
  const ai = getClient();
  const dossierText = params.dossier
    ? JSON.stringify(params.dossier.angles)
    : `Niche: ${params.brandBrain.niche}`;

  const offerText = params.offer
    ? `${params.offer.name} (${params.offer.platform}, ${params.offer.priceLabel}): ${params.offer.promise} URL: ${params.offer.url}`
    : 'Include a helpful next-step callout.';

  const rawJson = await generateStructuredWithFailover(
    ai,
    `Create a high-ticket, Gamma-style ${params.format} PDF Lead Magnet about "${params.topic}" in the "${params.brandBrain.niche}" niche.
Authority Research Context: ${dossierText}
Embedded Offer Callout for Final Section: ${offerText}

Build exactly 5 rich, actionable sections using types: takeaway, framework, script, checklist, offer-callout.
Make the advice tactical, specific, and worth $97 so X commenters feel blown away by the free PDF.`,
    {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        subtitle: { type: Type.STRING },
        giveawayKeyword: { type: Type.STRING },
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              heading: { type: Type.STRING },
              body: { type: Type.STRING },
              bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      },
    }
  );

  const parsed = JSON.parse(rawJson || '{}') as {
    title?: string;
    subtitle?: string;
    giveawayKeyword?: string;
    sections?: Array<{
      type?: LeadMagnet['sections'][number]['type'];
      heading?: string;
      body?: string;
      bullets?: string[];
    }>;
  };

  const title = parsed.title || `The ${params.topic} ${params.format}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) +
    '-' +
    String(Date.now()).slice(-4);

  const validTypes = new Set(['takeaway', 'framework', 'checklist', 'script', 'offer-callout']);

  return {
    id: `lm-${Date.now()}`,
    slug,
    title,
    subtitle: parsed.subtitle || `Tactical ${params.brandBrain.niche} ${params.format.toLowerCase()} engineered for immediate results.`,
    format: params.format,
    niche: params.brandBrain.niche,
    themeColor: '#0284C7',
    authorName: params.authorName,
    authorHandle: params.authorHandle,
    linkedOfferId: params.offer?.id,
    giveawayKeyword: (parsed.giveawayKeyword || params.offer?.giveawayKeyword || 'GUIDE').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    views: 0,
    downloads: 0,
    offerClicks: 0,
    createdAt: new Date().toISOString(),
    sections: (parsed.sections || []).slice(0, 6).map((s, idx) => ({
      id: `sec-${Date.now()}-${idx}`,
      type: validTypes.has(s.type || '') ? (s.type as LeadMagnet['sections'][number]['type']) : 'framework',
      heading: s.heading || `Section ${idx + 1}`,
      body: s.body || '',
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
    })),
  };
}
