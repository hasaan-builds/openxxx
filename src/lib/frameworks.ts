import { scoreCopy } from './copyScorer';
import type {
  AudiencePersona,
  BrandBrain,
  CopyFramework,
  CopyVariation,
  MonetizationOffer,
} from './types';

export const COPY_FRAMEWORKS: CopyFramework[] = [
  {
    id: 'fw-comment-giveaway',
    name: 'S-Tier Comment-to-PDF Giveaway',
    category: 'Giveaway Hook',
    trigger: 'Hormozi Value Equation',
    origin: 'TweetHunter + Whop S-Tier Playbook',
    whenToUse: 'Exploding replies, bookmarks, and DM leads with a free high-ticket PDF playbook.',
    skeleton:
      'I spent [X hours] dissecting [high-status outcome / authority topic].\n\nInside the free [format]:\n• [Specific deliverable 1]\n• [Specific deliverable 2]\n• [Specific deliverable 3]\n\nComment "[KEYWORD]" and I\'ll DM you the full PDF free (must be following).',
    example:
      'I spent 38 hours breaking down 140 recorded $10k+ sales calls.\n\nPut every winning rebuttal into a free 12-page Playbook:\n• The 3-word pause that kills price objections\n• Exact discovery flow (first 7 minutes)\n• 19 word-for-word DM scripts\n\nComment "CLOSE" and I\'ll send you the PDF.',
  },
  {
    id: 'fw-loss-aversion',
    name: 'Silent Leak (Loss Aversion)',
    category: 'Direct Response',
    trigger: 'Loss Aversion',
    origin: 'Anyword Top-1% Ad Hook',
    whenToUse: 'Stopping buyers who do not realize a daily habit is quietly costing them money.',
    skeleton:
      'You are quietly losing [painful metric] every week because of 1 mistake:\n\n[Common wrong habit].\n\nTop 1% [audience] do this instead:\n1. [Actionable shift 1]\n2. [Actionable shift 2]\n3. [Actionable shift 3]\n\nSave this before your next [event].',
    example:
      'You are quietly losing 60% of warm prospects in the first 4 minutes of your sales call.\n\nPitching features before diagnosing urgency kills trust.\n\nTop closers do this instead:\n1. Quantify the cost of doing nothing\n2. Ask "why solve this now?"\n3. Pitch only the gap they named\n\nBookmark this before your next call.',
  },
  {
    id: 'fw-contrarian-proof',
    name: 'Contrarian Truth + Proof',
    category: 'Authority Breakdown',
    trigger: 'Contrarian Proof',
    origin: 'Typeshare Viral Authority Formula',
    whenToUse: 'Standing out instantly from generic advice in saturated niches.',
    skeleton:
      'Unpopular truth about [niche]:\n\n[Mainstream advice] is terrible advice.\n\nAfter [proof / data point], here is what actually works:\n\n→ [Contrarian principle 1]\n→ [Contrarian principle 2]\n→ [Contrarian principle 3]\n\nAgree or disagree?',
    example:
      'Unpopular truth about high-ticket sales:\n\n"Always be closing" ruins more $5k+ deals than it saves.\n\nAfter auditing 200+ closing calls, here is what actually converts:\n\n→ Disqualify fast to build instant status\n→ Diagnose pain 3 layers deep\n→ Let the buyer argue for the solution\n\nWhich step do you see broken most?',
  },
  {
    id: 'fw-pas',
    name: 'PAS (Problem-Agitate-Solve)',
    category: 'Direct Response',
    trigger: 'Loss Aversion',
    origin: 'Eugene Schwartz / Direct Response Classic',
    whenToUse: 'Converting frustrated buyers straight into a Whop course or lead magnet.',
    skeleton:
      'Struggling with [specific problem]?\n\nEvery day you leave it unfixed, [agitate hidden cost].\n\nHere is the exact 3-part fix:\n• Step 1: [Fix 1]\n• Step 2: [Fix 2]\n• Step 3: [Fix 3]\n\nReply "[KEYWORD]" if you want the full checklist.',
    example:
      'Struggling to turn X views into actual product buyers?\n\nPosting daily tips with zero funnel burns 10+ hours a week for $0.\n\nHere is the exact 3-part fix:\n• Mine real buyer pain points first\n• Offer 1 ultra-specific free PDF playbook\n• Embed your offer on page 3 & the final page\n\nReply "SYSTEM" for the full checklist.',
  },
  {
    id: 'fw-bab',
    name: 'BAB (Before-After-Bridge)',
    category: 'Direct Response',
    trigger: 'Social Proof & Case Study',
    origin: 'Copy.ai & Jasper Conversion Playbook',
    whenToUse: 'Showing transformation clearly without sounding hypey.',
    skeleton:
      '6 months ago: [Painful Before state with concrete number].\n\nToday: [Tangible After state with concrete number].\n\nNothing magical changed — just this 3-step bridge:\n1. [Bridge step 1]\n2. [Bridge step 2]\n3. [Bridge step 3]\n\nSave this to copy the playbook.',
    example:
      '6 months ago: 3% cold DM reply rate and 18 ghosted proposals.\n\nToday: 29% reply rate and 4 booked calls every single week.\n\nNothing magical changed — just this 3-step bridge:\n1. Lead with a 1-line observation, never a pitch\n2. Offer a 60-second custom teardown\n3. Send the free playbook before asking for a call\n\nSave this to copy the exact bridge.',
  },
  {
    id: 'fw-aida-thread',
    name: 'AIDA Viral Thread Opener',
    category: 'Viral Thread',
    trigger: 'Curiosity Gap',
    origin: 'Classic Copywriting + X Thread Craft',
    whenToUse: 'High-retention educational threads that end in an Auto-Plug offer.',
    skeleton:
      '[Attention: Bold surprising stat or claim].\n\n[Interest: Why it matters right now to your reader].\n\n[Desire: What they will master in 2 minutes].\n\nHere is the complete breakdown (save this thread) 🧵👇',
    example:
      '92% of beginners fail at high-ticket affiliate marketing on X.\n\nNot because their offer is weak — because they post links instead of authority.\n\nIn the next 90 seconds, you\'ll see the exact 4-post funnel S-tier creators run weekly.\n\nHere is the complete breakdown (bookmark this) 🧵👇',
  },
  {
    id: 'fw-4u-headline',
    name: 'The 4U High-Velocity Hook',
    category: 'Direct Response',
    trigger: 'Pattern Interrupt',
    origin: 'Michael Masterson (Useful, Urgent, Unique, Ultra-Specific)',
    whenToUse: 'Breaking breaking-news or fresh scraped industry intel on X.',
    skeleton:
      'Just dropped: [Specific breaking tool / market shift] changes [niche] in the next 90 days.\n\nWhat most people missed:\n• [Insight 1]\n• [Insight 2]\n• [How to profit from it this week]\n\nBookmark this breakdown before everyone catches on.',
    example:
      'Just dropped: 3 new open-source AI agent repos passed 15,000 stars this week.\n\nWhat most founders missed:\n• They run 100% locally at $0 API cost\n• They automate lead research in 4 minutes\n• Early adopters are already turning them into $2k/mo services\n\nBookmark this breakdown before everyone catches on.',
  },
  {
    id: 'fw-pastor',
    name: 'PASTOR Authority Story',
    category: 'Authority Breakdown',
    trigger: 'Identity Callout',
    origin: 'Ray Edwards Direct Response System',
    whenToUse: 'Deep storytelling posts that make buyers trust you instantly.',
    skeleton:
      'If you\'re a [specific identity] tired of [core frustration], read this.\n\nLast year I saw a client burn [cost] doing [old way].\n\nThe turning point was 1 simple system:\n• [Principle 1]\n• [Principle 2]\n\nResult: [concrete outcome].\n\nWant the exact blueprint? Comment "[KEYWORD]".',
    example:
      'If you\'re a solo creator tired of getting 120 views per post, read this.\n\nLast month a builder burned 40 hours writing generic AI threads nobody saved.\n\nThe turning point was 1 simple shift:\n• Scrape real Reddit complaints before writing\n• Score every hook against proven psychology\n\nResult: 48,000 impressions and 112 PDF leads in 6 days.\n\nComment "BLUEPRINT" for the workflow.',
  },
  {
    id: 'fw-step-playbook',
    name: 'Steal My Exact Playbook',
    category: 'Viral Thread',
    trigger: 'Step-by-Step Playbook',
    origin: 'Typeshare High-Bookmark Architecture',
    whenToUse: 'Maximizing X bookmarks (the #1 algorithmic reach signal).',
    skeleton:
      'How to [desirable outcome] in [short timeframe] (even if [common objection]):\n\nStep 1: [Concrete step]\nStep 2: [Concrete step]\nStep 3: [Concrete step]\nStep 4: [Concrete step]\n\nSave this — you\'ll come back to Step 3.',
    example:
      'How to close a $3,000 deal in the DMs in 20 minutes (even with under 1,000 followers):\n\nStep 1: Trigger interest with a free niche PDF\nStep 2: Ask 2 diagnostic questions after delivery\nStep 3: Send a 90-second voice note solving 1 bottleneck\nStep 4: Share the checkout link only when they ask\n\nSave this — Step 3 triples conversion.',
  },
  {
    id: 'fw-old-vs-new',
    name: 'Old Way vs. S-Tier Way',
    category: 'Authority Breakdown',
    trigger: 'Pattern Interrupt',
    origin: 'High-Ticket Positioning Matrix',
    whenToUse: 'Quickly positioning yourself as an S-tier authority and setting up carousel slides.',
    skeleton:
      'Amateur [audience] vs. S-Tier [audience]:\n\nAmateur: [Old weak behavior]\nS-Tier: [Sharp high-leverage behavior]\n\nAmateur: [Old weak behavior 2]\nS-Tier: [Sharp high-leverage behavior 2]\n\nThe difference isn\'t talent. It\'s the system.',
    example:
      'Amateur X marketers vs. S-Tier X creators:\n\nAmateur: Drops affiliate links with zero context\nS-Tier: Gives away a $97-quality PDF playbook free\n\nAmateur: Guesses what to post every morning\nS-Tier: Mines real buyer pain points and scores every hook\n\nThe difference isn\'t luck. It\'s the system.',
  },
  {
    id: 'fw-teardown-case',
    name: '7-Figure Teardown Thread',
    category: 'Viral Thread',
    trigger: 'Social Proof & Case Study',
    origin: 'Sandcastles Outlier Breakdown Format',
    whenToUse: 'Borrowing authority by dissecting a famous winner in your niche.',
    skeleton:
      'I studied how [top authority / outlier] grew to [impressive result] in [timeframe].\n\nHere are the 5 invisible copywriting & funnel levers they used (so you can steal them today) 🧵👇',
    example:
      'I studied how 3 top Whop sales educators pull $50k+/month purely from X threads.\n\nNo paid ads. No cold calling.\n\nHere are the 5 exact giveaway & objection frameworks they repeat every week (steal this) 🧵👇',
  },
  {
    id: 'fw-identity-callout',
    name: 'Identity Filter Callout',
    category: 'Direct Response',
    trigger: 'Identity Callout',
    origin: 'Anyword Persona-Matched Hook',
    whenToUse: 'Calling out your exact buyer persona so the X algorithm clusters your niche audience.',
    skeleton:
      'This is only for [exact persona] trying to hit [specific goal] in 2026.\n\nIgnore these 3 distractions:\n✕ [Distraction 1]\n✕ [Distraction 2]\n✕ [Distraction 3]\n\nObsess over this 1 metric instead: [North star].',
    example:
      'This is only for appointment setters and closers trying to hit $10k/mo in 2026.\n\nIgnore these 3 distractions:\n✕ Memorizing robotic rebuttal scripts\n✕ Pitching price before urgency\n✕ Chasing unqualified leads\n\nObsess over 1 skill instead: 3-layer pain discovery.',
  },
];

/**
 * Generates 5 deterministic, framework-backed A/B variations locally (0 API cost)
 * and ranks them highest-to-lowest using our Anyword-style 0-100 Predictive Scorer.
 * Used both as an instant $0 engine and as the structured fallback when Gemini is offline.
 */
export function buildRankedABVariations(params: {
  topic: string;
  keyInsight?: string;
  brandBrain: BrandBrain;
  persona?: AudiencePersona;
  offer?: MonetizationOffer;
}): CopyVariation[] {
  const { topic, keyInsight, brandBrain, persona, offer } = params;
  const cleanTopic = topic.trim() || brandBrain.niche;
  const insight = keyInsight?.trim() || `focusing on one repeatable ${brandBrain.niche.toLowerCase()} system instead of guessing`;
  const audience = persona?.role || `${brandBrain.niche} builders`;
  const keyword = offer?.giveawayKeyword || 'PLAYBOOK';
  const offerName = offer?.name || `${brandBrain.niche} Playbook`;

  const candidates: Array<{ fw: CopyFramework; blocks: string[] }> = [
    {
      fw: COPY_FRAMEWORKS[0], // Comment Giveaway
      blocks: [
        `I spent 24 hours reverse-engineering ${cleanTopic} for ${audience}.\n\nPut the exact system into a free PDF Playbook:\n• Why ${insight} beats 90% of generic advice\n• 3 word-for-word scripts you can use today\n• The complete step-by-step checklist\n\nComment "${keyword}" and I'll send you the PDF free.`,
      ],
    },
    {
      fw: COPY_FRAMEWORKS[1], // Loss Aversion
      blocks: [
        `You are quietly losing hours every week on ${cleanTopic} because of 1 fixable mistake.\n\nMost ${audience} skip the diagnosis and guess.\n\nTop 1% operators do this instead:\n1. Start with ${insight}\n2. Cut 80% of busywork that doesn't convert\n3. Measure one clear outcome every 7 days\n\nBookmark this before your next sprint.`,
      ],
    },
    {
      fw: COPY_FRAMEWORKS[2], // Contrarian Proof
      blocks: [
        `Unpopular truth about ${cleanTopic}:\n\n90% of mainstream advice for ${audience} is backwards.\n\nHere is what actually drives results:\n\n→ Stop chasing hacks; master ${insight}\n→ Build proof before pitching your offer\n→ Turn every question into a reusable asset\n\nWhich mistake do you see most often?`,
      ],
    },
    {
      fw: COPY_FRAMEWORKS[4], // BAB
      blocks: [
        `90 days ago: stuck guessing on ${cleanTopic} with inconsistent results.\n\nToday: a repeatable system producing predictable wins every week.\n\nNothing lucky changed — just this 3-step bridge:\n1. Anchor around ${insight}\n2. Test 5 hook angles before publishing\n3. Funnel every high-intent reader to ${offerName}\n\nSave this to steal the exact bridge.`,
      ],
    },
    {
      fw: COPY_FRAMEWORKS[8], // Step-by-Step Playbook
      blocks: [
        `How to master ${cleanTopic} in 14 days (even if you're starting from scratch):\n\nStep 1: Study the top 5 buyer pain points in ${brandBrain.niche}\nStep 2: Apply ${insight}\nStep 3: Package the shortcut into a 1-page checklist\nStep 4: Share real proof every Tuesday and Thursday\n\nSave this — Step 2 does 80% of the heavy lifting.`,
      ],
    },
  ];

  return candidates
    .map((c, idx) => {
      const score = scoreCopy(c.blocks, { brandBrain, persona });
      return {
        id: `var-${idx + 1}-${c.fw.id}`,
        frameworkId: c.fw.id,
        frameworkName: c.fw.name,
        trigger: c.fw.trigger,
        blocks: c.blocks,
        score,
      };
    })
    .sort((a, b) => b.score.total - a.score.total);
}
