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
  OpenReplyDraftOption,
  OpenReplyGoal,
  PostItem,
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
      timeout: 60000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MASTER_COPY_SYSTEM_INSTRUCTION = `You are a world-class direct-response copywriter and domain operator (combining Alex Hormozi's specificity, Eugene Schwartz's market awareness, and Dan Koe's crisp X readability).

NON-NEGOTIABLE WRITING RULES:
1. ZERO AI SLOP: Never use "delve", "tapestry", "game-changer", "unlock the power", "in today's fast-paced world", "leverage", "dive deep", "revolutionize", "testament to", "navigate the landscape", "ever-evolving", "cutting-edge", or "not just X, it's Y".
2. ZERO PLACEHOLDER BRACKETS: Never output literal placeholders like "[Your Link]", "[low-leverage task]", "[insert X]", or "[specific metric]". Write real, concrete, usable examples and numbers.
3. CONCRETE MECHANISMS OVER VAGUE ADVICE: Never say "focus on one repeatable system" or "stay consistent". Name the exact mechanism, sequence, tool, script, constraint, or metric that makes the outcome happen.
4. HUMAN X CADENCE: Short 1-2 line paragraphs, crisp white space, Grade 6-8 reading level, conversational authority, zero hashtag spam, max 1 em-dash per post.
5. X HEAVY RANKER ALGORITHM: Never put an external URL inside Tweet 1. Drive replies (75x weight), profile clicks (12x weight), and bookmarks (10x weight) through specificity and sharp framing.`;

async function generateStructuredWithFailover(
  ai: GoogleGenAI,
  contents: string,
  responseSchema: Record<string, unknown>,
  options?: { thinkingLevel?: ThinkingLevel; systemInstruction?: string }
): Promise<string> {
  const systemInstruction = options?.systemInstruction || MASTER_COPY_SYSTEM_INSTRUCTION;
  const thinkingLevel = options?.thinkingLevel || ThinkingLevel.LOW;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel },
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

  // Automatic fast failover only on transient 503/504 availability spikes
  const liteRes = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction,
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
    `Conduct a deep operator-grade 5-angle Authority Research Dossier for an X (Twitter) creator in "${params.niche}".

Live Scraped Intelligence & Buyer Signals:
${contextText || 'Use current real-world operator dynamics in this niche.'}

Affiliate Group / Offer to Bridge Toward:
${offerContext || 'Free Paid-Worth Playbook -> Partner Affiliate Community'}

Banned Clichés: ${params.brandBrain.bannedCliches.join(', ')}

Produce 5 sharp, ultra-specific bullets per angle with concrete numbers, named failure modes, real buyer language, and exact scripts.`,
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
    },
    { thinkingLevel: ThinkingLevel.MEDIUM }
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
    title: parsed.title || `${params.niche} — 5-Angle Operator Authority Dossier`,
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
    `Write 5 genuinely distinct, publication-grade X (Twitter) posts about: "${params.topic}".

Real Context / Insight: "${params.keyInsight || 'Draw from concrete, real-world mechanisms in this niche.'}"
Niche: ${params.brandBrain.niche}
Target Audience: ${params.persona?.name || 'Niche practitioners'} (${params.persona?.role || 'operators & beginners'})
Tone: ${params.brandBrain.tone}
Giveaway Keyword (use ONLY in variation 1): "${params.offer?.giveawayKeyword || 'PLAYBOOK'}"
Strictly Banned Phrases: ${params.brandBrain.bannedCliches.join(', ')}

Produce 5 wildly different angles (never reuse the same sentence structure across variations):
1. Comment-to-PDF Giveaway (trigger: Hormozi Value Equation) — describe 3 concrete deliverables inside the free PDF that solve a real pain in "${params.topic}".
2. Silent Leak / Loss Aversion (trigger: Loss Aversion) — expose a specific hidden mistake costing time/money, then show the 3-step fix.
3. Contrarian Truth + Proof (trigger: Contrarian Proof) — challenge a popular myth in ${params.brandBrain.niche} with concrete logic.
4. Before-After-Bridge Micro-Case (trigger: Social Proof & Case Study) — contrast a specific broken workflow vs. the fixed system.
5. Step-by-Step Mini-Thread (2-3 short tweets in blocks[], trigger: Step-by-Step Playbook) — crisp, bookmarkable breakdown where every bullet teaches something concrete.

Each tweet block MUST be under 275 characters, zero URLs in Tweet 1, zero generic filler.`,
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
    },
    { thinkingLevel: ThinkingLevel.MEDIUM }
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

/**
 * Generates a full batch (4 or 14 posts) of deeply original, varied X posts via Gemini 4
 * instead of repetitive fill-in-the-blank templates.
 */
export async function generateBatchPostsWithGemini(params: {
  count: number;
  brandBrain: BrandBrain;
  persona?: AudiencePersona;
  offer?: MonetizationOffer;
  radarItems: RadarItem[];
  dossier?: AuthorityDossier;
  customGoal?: string;
}): Promise<
  Array<{
    blocks: string[];
    format: PostItem['format'];
    frameworkName: string;
  }>
> {
  const ai = getClient();
  const safeCount = Math.max(1, Math.min(14, params.count));
  const radarLines = params.radarItems
    .slice(0, 8)
    .map((r, i) => `${i + 1}. [${r.source}] ${r.title} (${r.summary.slice(0, 120)})`)
    .join('\n');
  const dossierNotes = params.dossier
    ? `Pain points: ${params.dossier.angles.buyerPainPoints.slice(0, 3).join(' | ')}\nFrameworks: ${params.dossier.angles.coreFrameworks.slice(0, 3).join(' | ')}\nContrarian: ${params.dossier.angles.contrarianTruths.slice(0, 2).join(' | ')}`
    : '';

  const rawJson = await generateStructuredWithFailover(
    ai,
    `Write a ${safeCount}-post high-craft X content batch for a creator in "${params.brandBrain.niche}".

Audience: ${params.persona?.name || 'Practitioners & beginners'} (${params.persona?.role || params.brandBrain.niche})
Voice / Tone: ${params.brandBrain.tone}
Voice Rules: ${params.brandBrain.voiceRules.join(' · ')}
Affiliate Group / Free PDF Offer Context: ${params.offer ? `${params.offer.name} (${params.offer.promise}) | Keyword: ${params.offer.giveawayKeyword}` : 'Free paid-worth PDF playbook'}
${params.customGoal ? `Priority Focus Topic for Post #1: ${params.customGoal}` : ''}
${radarLines ? `\nFresh Live Industry Signals to weave in:\n${radarLines}` : ''}
${dossierNotes ? `\nAuthority Research Notes:\n${dossierNotes}` : ''}

STRICT QUALITY REQUIREMENTS:
- Write exactly ${safeCount} COMPLETELY DIFFERENT posts — NEVER start two posts with the same opening phrase (no repeating "I spent 24 hours..." or "Unpopular truth:").
- Mix formats naturally:
  - ~25% "giveaway" (Comment "${params.offer?.giveawayKeyword || 'PLAYBOOK'}" for a specific free PDF/checklist with 3 real tangible deliverables)
  - ~25% "thread" (2 to 4 crisp connected tweets inside blocks[], teaching a complete concrete method)
  - ~50% "single" (sharp contrarian observations, before/after teardowns, tactical 3-step checklists, or real mistakes costing people results)
- Every single post must teach a REAL, domain-specific insight someone in "${params.brandBrain.niche}" would actually bookmark.
- Keep every tweet block under 275 characters. Zero external links in Tweet 1. Zero clichés or placeholders.`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          format: { type: Type.STRING, description: 'One of: single, thread, giveaway' },
          frameworkName: { type: Type.STRING, description: 'Short descriptive copywriting angle name' },
          blocks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    { thinkingLevel: ThinkingLevel.MEDIUM }
  );

  const parsed = JSON.parse(rawJson || '[]') as Array<{
    format?: string;
    frameworkName?: string;
    blocks?: string[];
  }>;

  const validFormats = new Set(['single', 'thread', 'giveaway']);
  return parsed
    .filter((p) => Array.isArray(p.blocks) && p.blocks.length > 0)
    .slice(0, safeCount)
    .map((p) => {
      const cleanBlocks = (p.blocks || [])
        .map((b) => humanizeCopy(b).cleanedText || b)
        .filter(Boolean);
      const format: PostItem['format'] = validFormats.has(p.format || '')
        ? (p.format as PostItem['format'])
        : cleanBlocks.length > 1
          ? 'thread'
          : 'single';
      return {
        blocks: cleanBlocks,
        format,
        frameworkName: `${p.frameworkName || 'Gemini 4 Operator Post'} (Gemini 4)`,
      };
    });
}

export async function remixViralTweetWithGemini(params: {
  sourceContent: string;
  sourceCategory: string;
  brandBrain: BrandBrain;
  offer?: MonetizationOffer;
}): Promise<{ blocks: string[]; format: PostItem['format']; frameworkName: string }> {
  const ai = getClient();
  const rawJson = await generateStructuredWithFailover(
    ai,
    `Reverse-engineer the psychological structure and rhythm of this viral X post, then write a 100% ORIGINAL post for the "${params.brandBrain.niche}" niche:

Viral Reference (${params.sourceCategory}):
"""
${params.sourceContent}
"""

Creator Tone: ${params.brandBrain.tone}
Offer Keyword (if giveaway structure): ${params.offer?.giveawayKeyword || 'PLAYBOOK'}
Offer Context: ${params.offer ? `${params.offer.name} — ${params.offer.promise}` : params.brandBrain.niche}

Rules:
- Keep ONLY the structural rhythm and hook tension — replace 100% of the topic, numbers, and examples with concrete, real "${params.brandBrain.niche}" substance.
- Do NOT copy sentences verbatim from the reference.
- Keep each tweet block under 275 chars, zero URLs in Tweet 1, zero AI clichés.`,
    {
      type: Type.OBJECT,
      properties: {
        format: { type: Type.STRING, description: 'single, thread, or giveaway' },
        frameworkName: { type: Type.STRING },
        blocks: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    { thinkingLevel: ThinkingLevel.LOW }
  );

  const parsed = JSON.parse(rawJson || '{}') as {
    format?: string;
    frameworkName?: string;
    blocks?: string[];
  };
  const blocks = (parsed.blocks || [])
    .map((b) => humanizeCopy(b).cleanedText || b)
    .filter(Boolean);
  const validFormats = new Set(['single', 'thread', 'giveaway']);
  return {
    blocks: blocks.length ? blocks : [params.sourceContent],
    format: validFormats.has(parsed.format || '')
      ? (parsed.format as PostItem['format'])
      : blocks.length > 1
        ? 'thread'
        : 'single',
    frameworkName: parsed.frameworkName || `Viral Remix (${params.sourceCategory})`,
  };
}

export async function ghostwriteWithGemini(params: {
  action: 'rewrite' | 'finish' | 'expand-thread' | 'hooks' | 'tone-shift' | 'reply';
  text: string;
  tone?: string;
  brandBrain: BrandBrain;
}): Promise<string[]> {
  const ai = getClient();
  const actionMap: Record<typeof params.action, string> = {
    rewrite: 'Rewrite this X post to maximize hook stopping power, concrete specificity, and white-space rhythm under 275 chars.',
    finish: 'Finish this incomplete X post with a sharp, concrete payoff and natural bookmark/reply pull under 275 chars.',
    'expand-thread': 'Expand this idea into a high-retention 4-tweet X thread (each tweet under 270 chars) where every tweet teaches a real tactical step.',
    hooks: 'Write 1 punchy rewritten opening hook tweet with a concrete mechanism or number and clean open loop under 250 chars.',
    'tone-shift': `Rewrite this post in a "${params.tone || 'sharp, contrarian operator'}" voice under 275 chars without losing substance.`,
    reply: 'Write 1 sharp, human, non-sycophantic reply (under 200 chars) that adds a genuine tactical insight directly referencing the input.',
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
    },
    { thinkingLevel: ThinkingLevel.LOW }
  );

  const parsed = JSON.parse(rawJson || '{}') as { blocks?: string[] };
  const rawBlocks = parsed.blocks?.filter(Boolean) || [params.text];
  return rawBlocks.map((b) => humanizeCopy(b).cleanedText || b);
}

/**
 * Open Reply Power (Gemini 4):
 * Reads the actual target tweet and crafts 4 razor-sharp, context-locked human replies
 * designed to trigger 75x Author-Engaged Replies and high-intent profile clicks.
 */
export async function generateOpenRepliesWithGemini(params: {
  targetAuthorHandle: string;
  targetTweetText: string;
  goal: OpenReplyGoal;
  brandBrain: BrandBrain;
  offer?: MonetizationOffer;
  leadMagnetTitle?: string;
  customAngle?: string;
}): Promise<OpenReplyDraftOption[]> {
  const ai = getClient();
  const goalGuide: Record<OpenReplyGoal, string> = {
    authority: 'Position the replier as an experienced practitioner by adding a concrete operational detail, trade-off, or edge case.',
    'author-reply': 'Optimize for X 75x Author-Engaged Reply weight by making the original poster genuinely want to respond.',
    'soft-pdf-bridge': `Add pure value first and optionally hint (ONLY in option 1 or 3, never spammy, zero links) at a free resource or breakdown on "${params.leadMagnetTitle || params.brandBrain.niche}" so curious readers click your profile.`,
    contrarian: 'Politely challenge one specific assumption in the tweet with grounded real-world logic.',
  };

  const rawJson = await generateStructuredWithFailover(
    ai,
    `You are powering "Open Reply" — an elite X (Twitter) Reply-Guy engine.

TARGET TWEET AUTHOR: ${params.targetAuthorHandle || '@creator'}
ACTUAL TWEET TEXT TO REPLY TO:
"""
${params.targetTweetText}
"""

REPLIER NICHE & VOICE:
- Niche: ${params.brandBrain.niche}
- Tone: ${params.brandBrain.tone}
- Goal: ${goalGuide[params.goal]}
${params.customAngle ? `- Specific point the user wants to weave in: ${params.customAngle}` : ''}
${params.offer ? `- Background Offer (DO NOT pitch or drop links in reply): ${params.offer.name}` : ''}

STRICT OPEN REPLY RULES:
1. Reference a SPECIFIC word, claim, number, or tension from the target tweet above so it is 100% obvious a human actually read it.
2. NEVER open with "Great post!", "100% agree!", "So true!", "Love this!", "Spot on!", "This is gold!", or "The piece most beginners miss".
3. Keep each reply punchy, natural, and conversational — between 65 and 215 characters (never a bloated essay, zero hashtags, zero links).
4. Produce exactly 4 distinct options using these exact angles:
   - "Tactical Addition"
   - "Sharp Contrarian"
   - "Micro-Proof"
   - "High-Signal Question"
5. Include a crisp 1-sentence "whyItWorks" explaining the psychological pull.`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          angle: { type: Type.STRING },
          text: { type: Type.STRING },
          whyItWorks: { type: Type.STRING },
        },
      },
    },
    { thinkingLevel: ThinkingLevel.LOW }
  );

  const parsed = JSON.parse(rawJson || '[]') as Array<{
    angle?: string;
    text?: string;
    whyItWorks?: string;
  }>;

  const allowedAngles: OpenReplyDraftOption['angle'][] = [
    'Tactical Addition',
    'Sharp Contrarian',
    'Micro-Proof',
    'High-Signal Question',
  ];

  return parsed
    .filter((item) => item.text?.trim())
    .slice(0, 4)
    .map((item, idx) => {
      const clean = (humanizeCopy(item.text || '').cleanedText || item.text || '').slice(0, 260);
      const matchedAngle =
        allowedAngles.find((a) => a.toLowerCase() === (item.angle || '').toLowerCase()) ||
        allowedAngles[idx % allowedAngles.length];
      return {
        id: `or-opt-${Date.now()}-${idx + 1}`,
        angle: matchedAngle,
        text: clean,
        whyItWorks: item.whyItWorks?.trim() || 'Adds concrete context directly to the original tweet.',
      };
    });
}

/**
 * Generates a TRUE $97-worth, 7-Chapter Editorial PDF Playbook completely tailored
 * to the exact topic with ZERO generic X-growth filler stapled onto the end.
 */
export async function generateLeadMagnetWithGemini(params: {
  topic: string;
  format: LeadMagnet['format'];
  dossier?: AuthorityDossier;
  offer?: MonetizationOffer;
  brandBrain: BrandBrain;
  authorName: string;
  authorHandle: string;
  requireEmailGate?: boolean;
}): Promise<LeadMagnet> {
  const ai = getClient();
  const dossierText = params.dossier
    ? JSON.stringify(params.dossier.angles)
    : `Niche: ${params.brandBrain.niche} | Tone: ${params.brandBrain.tone}`;

  const offerText = params.offer
    ? `Partner Group Offer: "${params.offer.name}" (${params.offer.platform}, ${params.offer.priceLabel}) — Promise: ${params.offer.promise}`
    : 'Recommended implementation community for hands-on feedback and accountability.';

  const rawJson = await generateStructuredWithFailover(
    ai,
    `Write a genuinely PAID-WORTH ($97-grade), publication-quality 7-chapter ${params.format} PDF about:
"${params.topic}"
Niche: ${params.brandBrain.niche}
Author: ${params.authorName} (${params.authorHandle})
Research Context: ${dossierText}
Final Chapter Affiliate Group Bridge: ${offerText}

CRITICAL QUALITY BAR (DO NOT FAIL THIS):
- Readers must feel like they just downloaded a $97 Stripe Press / operator field manual for free.
- EVERY SINGLE CHAPTER must be 100% specific to "${params.topic}" in "${params.brandBrain.niche}". Do NOT write generic X/Twitter tips unless the topic itself is X/Twitter growth!
- ZERO literal brackets like [Your Link] or [insert niche]. Write real, copy-paste-ready prompts, scripts, formulas, and concrete examples.
- Write substantive editorial prose in every chapter's "body" (60–110 words explaining the core mental model and why it works) PLUS 4 to 5 deep, tactical "bullets" (each 20–45 words with real steps, numbers, or exact phrasing).

Produce EXACTLY these 7 chapters in order:
1. type: "takeaway" — "01. Executive Reality Check: ..." (Diagnose the exact hidden bottlenecks & real cost of doing "${params.topic}" the amateur way)
2. type: "framework" — "02. The Complete Operating System: ..." (A named, sequential 4-phase methodology specific to "${params.topic}" with decision rules)
3. type: "comparison" — "03. What 95% Do Wrong vs. The Top 1% Playbook" (Format EVERY bullet strictly as "Amateur: <specific weak habit> -> Top 1%: <specific superior play>" so our PDF renders a crisp 2-column comparison table!)
4. type: "script" — "04. Copy-Paste Swipe File, Prompts & Templates" (4-5 complete, word-for-word usable scripts, AI prompts, checklists, or SOP snippets tailored to "${params.topic}")
5. type: "checklist" — "05. The 7-Day Zero-Fluff Execution Sprint" (Format bullets as "Day 1: ...", "Day 2: ..." through "Day 7: ..." with concrete daily deliverables strictly about "${params.topic}")
6. type: "worksheet" — "06. Diagnostic Troubleshooting & Edge Cases" (Format EVERY bullet as "Symptom: <specific failure>? -> Fix: <exact root-cause solution>")
7. type: "offer-callout" — "07. Ready to Accelerate? Next Steps Inside ${params.offer?.name || 'the Community'}" (Position the partner group naturally as the optional accelerator after readers execute the free manual)`,
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
    },
    { thinkingLevel: ThinkingLevel.MEDIUM }
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

  const title = parsed.title?.trim() || `${params.topic}: The Complete ${params.format}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) +
    '-' +
    String(Date.now()).slice(-4);

  const expectedTypes: LeadMagnet['sections'][number]['type'][] = [
    'takeaway',
    'framework',
    'comparison',
    'script',
    'checklist',
    'worksheet',
    'offer-callout',
  ];
  const validTypes = new Set<string>(expectedTypes);

  const sections = (parsed.sections || []).slice(0, 7).map((s, idx) => ({
    id: `sec-${Date.now()}-${idx + 1}`,
    type: validTypes.has(s.type || '')
      ? (s.type as LeadMagnet['sections'][number]['type'])
      : expectedTypes[idx % expectedTypes.length],
    heading: (s.heading || `0${idx + 1}. Section ${idx + 1}`).trim(),
    body: (humanizeCopy(s.body || '').cleanedText || s.body || '').trim(),
    bullets: Array.isArray(s.bullets)
      ? s.bullets
          .filter(Boolean)
          .map((b) => (humanizeCopy(b).cleanedText || b).trim())
      : [],
  }));

  return {
    id: `lm-${Date.now()}`,
    slug,
    title,
    subtitle:
      parsed.subtitle?.trim() ||
      `A complete ${params.brandBrain.niche} field manual with diagnostic frameworks, copy-paste templates, and a 7-day implementation sprint.`,
    format: params.format,
    niche: params.brandBrain.niche,
    themeColor: '#0071E3',
    authorName: params.authorName,
    authorHandle: params.authorHandle,
    linkedOfferId: params.offer?.id,
    giveawayKeyword: (parsed.giveawayKeyword || params.offer?.giveawayKeyword || 'PLAYBOOK')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 14) || 'PLAYBOOK',
    requireEmailGate: params.requireEmailGate ?? true,
    perceivedValueLabel: '$97 Value · Free Edition',
    views: 0,
    downloads: 0,
    offerClicks: 0,
    createdAt: new Date().toISOString(),
    sections,
  };
}
