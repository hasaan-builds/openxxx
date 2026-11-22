/**
 * Anti-AI-Slop Humanizer & Real X (Twitter) Heavy Ranker Simulator
 *
 * Ingrains proven open-source patterns from:
 * - blader/humanizer & Wikipedia "Signs of AI Writing"
 * - petergyang/no-ai-slop & haidrrrry/humanize-ai-writing
 * - coreyhaines31/marketingskills (Copywriting & Direct Response)
 * - twitter/the-algorithm & twitter/the-algorithm-ml (Heavy Ranker weights)
 */

export interface HumanizeResult {
  cleanedText: string;
  humanScore: number; // 0-100
  detectedTells: string[];
  fixesApplied: string[];
}

export interface XHeavyRankerResult {
  totalScore: number; // 0-100
  grade: 'S' | 'A' | 'B' | 'C';
  estimatedMultiplier: number;
  hasTweetOneLinkPenalty: boolean;
  signals: Array<{
    key: string;
    label: string;
    weight: string;
    active: boolean;
    tip: string;
  }>;
  topFix: string;
}

export interface IngrainedSkillEntry {
  id: string;
  section:
    | 'Research & $0 Scraping'
    | 'Viral Copy & X Algorithm'
    | 'Anti-AI-Slop Humanizer'
    | 'Free PDF & Visual Carousel Factory'
    | 'Telegram & TweetHunter Automation'
    | 'Local Antigravity IDE Bridge';
  repo: string;
  replaces: string;
  ingrainedCapability: string;
}

export const AI_SLOP_REPLACEMENTS: Array<{ pattern: RegExp; label: string; replaceWith: string }> = [
  { pattern: /\bin today'?s fast-paced (?:world|landscape|digital era)\b,?\s*/gi, label: 'Filler intro ("In today\'s fast-paced world")', replaceWith: '' },
  { pattern: /\blet'?s dive (?:deep )?into\b/gi, label: 'AI cliché ("let\'s dive into")', replaceWith: 'Here is' },
  { pattern: /\bdelve(?:s|d)? into\b/gi, label: 'AI buzzword ("delve into")', replaceWith: 'break down' },
  { pattern: /\bdelve(?:s|d)?\b/gi, label: 'AI buzzword ("delve")', replaceWith: 'dig' },
  { pattern: /\bunlock(?:s|ed|ing)? the (?:full )?power of\b/gi, label: 'AI cliché ("unlock the power of")', replaceWith: 'use' },
  { pattern: /\bgame[- ]changer\b/gi, label: 'AI cliché ("game-changer")', replaceWith: 'edge' },
  { pattern: /\brevolutioniz(?:e|es|ed|ing)\b/gi, label: 'Inflated verb ("revolutionize")', replaceWith: 'change' },
  { pattern: /\bnavigate the (?:complex )?landscape\b/gi, label: 'AI cliché ("navigate the landscape")', replaceWith: 'handle the market' },
  { pattern: /\bever[- ]evolving\b/gi, label: 'AI cliché ("ever-evolving")', replaceWith: 'fast-changing' },
  { pattern: /\bcutting[- ]edge\b/gi, label: 'AI cliché ("cutting-edge")', replaceWith: 'modern' },
  { pattern: /\btestament to\b/gi, label: 'AI cliché ("testament to")', replaceWith: 'proof of' },
  { pattern: /\btapestry of\b/gi, label: 'AI cliché ("tapestry of")', replaceWith: 'mix of' },
  { pattern: /\bleverage the power of\b/gi, label: 'AI cliché ("leverage the power of")', replaceWith: 'use' },
  { pattern: /\bharness(?:es|ed|ing)? the power of\b/gi, label: 'AI cliché ("harness the power of")', replaceWith: 'use' },
  { pattern: /\bunleash(?:es|ed|ing)?\b/gi, label: 'Inflated verb ("unleash")', replaceWith: 'launch' },
  { pattern: /\bparamount\b/gi, label: 'Stiff AI word ("paramount")', replaceWith: 'critical' },
  { pattern: /\bmeticulously\b/gi, label: 'Stiff AI word ("meticulously")', replaceWith: 'carefully' },
  { pattern: /\bpivotal\b/gi, label: 'Stiff AI word ("pivotal")', replaceWith: 'key' },
  { pattern: /\bseamlessly\b/gi, label: 'AI buzzword ("seamlessly")', replaceWith: 'cleanly' },
  { pattern: /\brobust\b/gi, label: 'AI buzzword ("robust")', replaceWith: 'solid' },
  { pattern: /\belevate your\b/gi, label: 'AI cliché ("elevate your")', replaceWith: 'upgrade your' },
  { pattern: /\bembark on a journey\b/gi, label: 'AI cliché ("embark on a journey")', replaceWith: 'start' },
  { pattern: /\bin the realm of\b/gi, label: 'AI cliché ("in the realm of")', replaceWith: 'in' },
  { pattern: /\bfoster(?:s|ed|ing)?\b/gi, label: 'Stiff AI word ("foster")', replaceWith: 'build' },
  { pattern: /\bsupercharge\b/gi, label: 'Hype cliché ("supercharge")', replaceWith: 'speed up' },
  { pattern: /\bsynergy\b/gi, label: 'Corporate buzzword ("synergy")', replaceWith: 'fit' },
  { pattern: /\bhere'?s the kicker:\s*/gi, label: 'AI transition ("here\'s the kicker")', replaceWith: 'The twist: ' },
  { pattern: /\bnot just ([^.,\n]{2,40}),\s*but (?:also )?/gi, label: 'Binary contrast trope ("not just X, but Y")', replaceWith: '$1 and ' },
];

export function detectAiTells(text: string): string[] {
  const tells: string[] = [];
  if (!text.trim()) return tells;

  for (const rule of AI_SLOP_REPLACEMENTS) {
    if (rule.pattern.test(text)) {
      tells.push(rule.label);
    }
    rule.pattern.lastIndex = 0;
  }

  const emDashCount = (text.match(/—/g) || []).length;
  if (emDashCount >= 3) {
    tells.push(`Em-dash spam (${emDashCount} em-dashes in one post)`);
  }

  const hashtagCount = (text.match(/#[a-z0-9_]+/gi) || []).length;
  if (hashtagCount >= 2) {
    tells.push(`Hashtag clutter (${hashtagCount} hashtags reduce X reach)`);
  }

  const emojiSpam = (text.match(/🚀|🔥|💡|✨|📈|💯/g) || []).length;
  if (emojiSpam >= 3) {
    tells.push(`Generic AI emoji spam (${emojiSpam} stock emojis)`);
  }

  return Array.from(new Set(tells));
}

export function humanizeCopy(rawText: string): HumanizeResult {
  if (!rawText.trim()) {
    return { cleanedText: '', humanScore: 0, detectedTells: [], fixesApplied: [] };
  }

  const detectedTells = detectAiTells(rawText);
  const fixesApplied: string[] = [];
  let text = rawText;

  for (const rule of AI_SLOP_REPLACEMENTS) {
    if (rule.pattern.test(text)) {
      text = text.replace(rule.pattern, rule.replaceWith);
      fixesApplied.push(`Replaced ${rule.label}`);
    }
    rule.pattern.lastIndex = 0;
  }

  // Strip hashtag clutter at end of lines (X penalizes hashtag spam)
  const hashtagCount = (text.match(/#[a-z0-9_]+/gi) || []).length;
  if (hashtagCount >= 2) {
    text = text.replace(/(?:\s+#[a-z0-9_]+)+/gi, '');
    fixesApplied.push('Removed hashtag clutter');
  }

  // Tone down excessive em-dash spam (>2 em-dashes -> crisp periods/commas)
  const emDashes = (text.match(/—/g) || []).length;
  if (emDashes >= 3) {
    let seen = 0;
    text = text.replace(/\s*—\s*/g, () => {
      seen++;
      return seen <= 1 ? ' — ' : '. ';
    });
    fixesApplied.push('Replaced excess em-dashes with punchy periods');
  }

  // Clean up spacing & capitalization after stripping filler openings
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*([a-z])/, (_, c: string) => c.toUpperCase())
    .trim();

  const remainingTells = detectAiTells(text);
  const hasSpecificNumbers = /\d+/.test(text);
  const hasShortLineRhythm = text.split('\n').length >= 2;
  const baseScore = 88 - remainingTells.length * 14 + (hasSpecificNumbers ? 7 : 0) + (hasShortLineRhythm ? 5 : 0);
  const humanScore = Math.max(20, Math.min(100, baseScore));

  return {
    cleanedText: text,
    humanScore,
    detectedTells,
    fixesApplied,
  };
}

/**
 * Simulates X's open-sourced Heavy Ranker neural network weights
 * from github.com/twitter/the-algorithm & twitter/the-algorithm-ml:
 * - Author-Engaged Reply: 75.0x
 * - Direct Reply: 13.5x
 * - Profile Click + Engage: 12.0x
 * - Bookmark / 2-min Dwell: 10.0x
 * - Retweet: 1.0x
 * - Like: 0.5x
 * - Tweet 1 External Link Penalty: suppresses non-reply distribution
 */
export function simulateXHeavyRanker(blocks: string[]): XHeavyRankerResult {
  const cleanBlocks = blocks.map((b) => b.trim()).filter(Boolean);
  const firstTweet = cleanBlocks[0] || '';
  const fullText = cleanBlocks.join('\n\n');

  const hasTweetOneLinkPenalty = /https?:\/\/\S+/i.test(firstTweet);
  const hasConversationPrompt =
    /\?|\b(comment|reply)\s+["']?[A-Z0-9]+|\bagree or disagree|\bwhich (one|step)/i.test(fullText);
  const hasAuthorBackAndForthTrigger =
    /\b(comment|reply)\s+["']?[A-Z0-9]{2,}|\bdrop\s+["']?[A-Z0-9]{2,}|\bwhat('?s| is) your/i.test(fullText);
  const hasAuthorityProof =
    /\b(after|spent|audited|analyzed|tested|built)\s+\d+|\$\d+|\d+%|\d+x/i.test(fullText);
  const hasBookmarkStructure =
    cleanBlocks.length > 1 ||
    /(^|\n)\s*([•\-→✅]|\d+\.)\s+/m.test(fullText) ||
    /\b(save|bookmark|playbook|checklist|framework|template|scripts?)\b/i.test(fullText);
  const aiTells = detectAiTells(fullText);
  const isCleanHuman = aiTells.length === 0;

  let score = 46;
  let multiplier = 1.0;

  if (hasAuthorBackAndForthTrigger) {
    score += 22;
    multiplier += 7.5;
  } else if (hasConversationPrompt) {
    score += 14;
    multiplier += 2.7;
  }

  if (hasAuthorityProof) {
    score += 14;
    multiplier += 2.4;
  }

  if (hasBookmarkStructure) {
    score += 13;
    multiplier += 2.0;
  }

  if (isCleanHuman) {
    score += 5;
  } else {
    score -= Math.min(18, aiTells.length * 6);
  }

  if (hasTweetOneLinkPenalty) {
    score -= 18;
    multiplier = Math.max(0.4, multiplier * 0.45);
  }

  const totalScore = Math.max(15, Math.min(100, Math.round(score)));
  const grade: XHeavyRankerResult['grade'] =
    totalScore >= 88 ? 'S' : totalScore >= 74 ? 'A' : totalScore >= 58 ? 'B' : 'C';

  const signals = [
    {
      key: 'author-reply',
      label: 'Author-Engaged Reply Trigger',
      weight: '75.0×',
      active: hasAuthorBackAndForthTrigger,
      tip: 'Ask readers to comment a 1-word keyword or answer a specific question so you can reply back.',
    },
    {
      key: 'reply',
      label: 'Conversation / Reply Prompt',
      weight: '13.5×',
      active: hasConversationPrompt,
      tip: 'End with a direct question or polarizing prompt instead of a flat statement.',
    },
    {
      key: 'profile',
      label: 'Authority Proof (Profile Click)',
      weight: '12.0×',
      active: hasAuthorityProof,
      tip: 'Add concrete numbers (hours spent, audits done, $ result, or % shift) in lines 1-2.',
    },
    {
      key: 'bookmark',
      label: 'Bookmark & 2-Min Dwell Structure',
      weight: '10.0×',
      active: hasBookmarkStructure,
      tip: 'Use numbered steps, bullets, or a multi-tweet thread so people save it.',
    },
    {
      key: 'link-safety',
      label: 'Zero External Link in Tweet 1',
      weight: 'No Penalty',
      active: !hasTweetOneLinkPenalty,
      tip: 'Never put a URL in Tweet 1 — move your Whop/PDF link to your 30-min Auto-Plug reply.',
    },
  ];

  const topFix = hasTweetOneLinkPenalty
    ? 'Move the URL out of Tweet 1 into your Auto-Plug reply to avoid X link throttling.'
    : !hasAuthorBackAndForthTrigger
    ? 'Add a comment keyword (e.g., Comment "PLAYBOOK") or direct question to trigger X\'s 75× author-reply weight.'
    : !hasAuthorityProof
    ? 'Add 1 concrete number or proof point ("After auditing 40...") to lift Profile Clicks (12× weight).'
    : !hasBookmarkStructure
    ? 'Format key steps as 3 crisp bullets or a 3-tweet thread to earn Bookmarks (10× weight).'
    : !isCleanHuman
    ? `Click Humanize ($0) to remove ${aiTells.length} AI writing tell(s).`
    : 'S-Tier X Algorithm fit — ready to push to Telegram & post on X ($0).';

  return {
    totalScore,
    grade,
    estimatedMultiplier: Number(multiplier.toFixed(1)),
    hasTweetOneLinkPenalty,
    signals,
    topFix,
  };
}

/**
 * Transparent registry of real open-source GitHub tools & skills ingrained into GhostPilot
 * across all 5 replaced paid apps ($0/mo).
 */
export const GITHUB_SKILL_REGISTRY: IngrainedSkillEntry[] = [
  // 1. Research & $0 Scraping (Replaces Perplexity Pro / Apify / Exploding Topics)
  {
    id: 'jina-reader',
    section: 'Research & $0 Scraping',
    repo: 'jina-ai/reader',
    replaces: 'Firecrawl / Apify ($49/mo)',
    ingrainedCapability: 'Converts any Whop page, blog, or GitHub repo URL to clean Markdown via r.jina.ai ($0).',
  },
  {
    id: 'youtube-transcript',
    section: 'Research & $0 Scraping',
    repo: 'jdepoix/youtube-transcript-api + vsmutok/ytscrape',
    replaces: 'Paid YouTube summarizers ($29/mo)',
    ingrainedCapability: 'Extracts YouTube video titles & public captions without any YouTube API key ($0).',
  },
  {
    id: 'bluesky-public',
    section: 'Research & $0 Scraping',
    repo: 'bluesky-social/atproto (Public XRPC Search)',
    replaces: 'Paid X/Twitter Search API ($200/mo)',
    ingrainedCapability: 'Live public social discourse search with zero auth or API keys ($0).',
  },
  {
    id: 'rsshub-bypass',
    section: 'Research & $0 Scraping',
    repo: 'DIYgod/RSSHub + Google News RSS Patterns',
    replaces: 'Paid Reddit / News scrapers',
    ingrainedCapability: 'Cloud-safe Reddit buyer pain-point mining + live Google News + Product Hunt RSS ($0).',
  },
  {
    id: 'github-hn-devto',
    section: 'Research & $0 Scraping',
    repo: 'GitHub Search API + Algolia HN + Forem/Dev.to',
    replaces: 'Trend Radar tools ($49/mo)',
    ingrainedCapability: 'Real-time breakout GitHub repos, Hacker News builder debates, and Dev.to guides ($0).',
  },

  // 2. Viral Copy & X Algorithm (Replaces Anyword / Typeshare / Copy.ai)
  {
    id: 'twitter-algorithm',
    section: 'Viral Copy & X Algorithm',
    repo: 'twitter/the-algorithm + twitter/the-algorithm-ml',
    replaces: 'Anyword Predictive Scoring ($99/mo)',
    ingrainedCapability: 'Real Heavy Ranker simulator (75× author reply, 13.5× reply, 12× profile, 10× bookmark, link penalty).',
  },
  {
    id: 'marketingskills',
    section: 'Viral Copy & X Algorithm',
    repo: 'coreyhaines31/marketingskills',
    replaces: 'Copywriting agencies & Jasper ($69/mo)',
    ingrainedCapability: 'Direct-response copywriting, buyer objection mapping, and conversion offer positioning.',
  },
  {
    id: 'x-twitter-growth',
    section: 'Viral Copy & X Algorithm',
    repo: 'x-twitter-growth + Schwartz / Hormozi Frameworks',
    replaces: 'Typeshare ($29/mo)',
    ingrainedCapability: '8 proven viral skeletons, 5 Awareness Stages, Hormozi Value Equation & 5-angle A/B Arena.',
  },

  // 3. Anti-AI-Slop Humanizer (Replaces Undetectable AI / StealthWriter)
  {
    id: 'blader-humanizer',
    section: 'Anti-AI-Slop Humanizer',
    repo: 'blader/humanizer',
    replaces: 'Paid AI Humanizers ($29/mo)',
    ingrainedCapability: 'Wikipedia "Signs of AI Writing" detector + automatic removal of 28+ robotic words & tropes.',
  },
  {
    id: 'no-ai-slop',
    section: 'Anti-AI-Slop Humanizer',
    repo: 'petergyang/no-ai-slop + haidrrrry/humanize-ai-writing',
    replaces: 'Manual editing',
    ingrainedCapability: 'Kills "It\'s not X, it\'s Y" binary contrasts, em-dash spam, hashtag clutter & filler intros.',
  },

  // 4. Free PDF & Visual Carousel Factory (Replaces Gamma / Canva / Designrr / Beacon)
  {
    id: 'ebook-md-pdf',
    section: 'Free PDF & Visual Carousel Factory',
    repo: 'RyanFitzgerald/ebook-generator + IBM/md-to-pdf + jsPDF',
    replaces: 'Designrr / Beacon ($49/mo)',
    ingrainedCapability: 'Magazine-grade multi-page PDF playbooks with cover, TOC, comparison tables, checklists & Whop bridge page.',
  },
  {
    id: 'openslides-carousel',
    section: 'Free PDF & Visual Carousel Factory',
    repo: 'clawnify/OpenSlides + jainmohit2001/carousel-gen + OpenMark',
    replaces: 'Gamma / Canva Pro / PostNitro ($39/mo)',
    ingrainedCapability: '1-click 1080×1350 viral X Carousel PNG slide exporter attached directly to every Free PDF.',
  },

  // 5. Telegram & TweetHunter Automation (Replaces TweetHunter / Hypefury / ManyChat)
  {
    id: 'postiz-patterns',
    section: 'Telegram & TweetHunter Automation',
    repo: 'gitroomhq/postiz-app + inovector/mixpost + getopenpost/openpost',
    replaces: 'TweetHunter / Hypefury ($49-$99/mo)',
    ingrainedCapability: 'Scheduled queue slots, 30-min Auto-Plug replies, Evergreen Winner Recycling & Comment-to-PDF Reply Kits.',
  },
  {
    id: 'telegram-bot-engine',
    section: 'Telegram & TweetHunter Automation',
    repo: 'grammyjs/grammY + telegraf/telegraf Bot Command Patterns',
    replaces: 'Paid X API ($200/mo) + ManyChat ($45/mo)',
    ingrainedCapability: 'Zero-fee Telegram Bot with 1-tap X Web Intent buttons, Auto-Find Chat ID & Two-Way /today /ideas /pdf /stats commands.',
  },

  // 6. Local Antigravity IDE Bridge
  {
    id: 'antigravity-skills',
    section: 'Local Antigravity IDE Bridge',
    repo: 'sickn33/antigravity-awesome-skills + agentskills/agentskills',
    replaces: 'Paid Cloud LLM Subscriptions',
    ingrainedCapability: '6 installable SKILL.md files + deterministic JSON normalizer so even fast/weak local models produce S-Tier output.',
  },
];
