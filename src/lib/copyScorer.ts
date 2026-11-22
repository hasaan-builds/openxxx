import type { AudiencePersona, BrandBrain, CopyScoreBreakdown } from './types';

export const DEFAULT_BANNED_CLICHES = [
  'delve',
  'in today\'s fast-paced world',
  'game-changer',
  'game changer',
  'unlock the power',
  'tapestry',
  'leverage the power',
  'dive deep into',
  'let\'s dive in',
  'revolutionize your',
  'testament to',
  'navigate the landscape',
  'ever-evolving',
  'cutting-edge',
];

const POWER_WORDS = [
  'mistake',
  'stop',
  'never',
  'secret',
  'proven',
  'exact',
  'framework',
  'playbook',
  'free',
  'costing',
  'losing',
  'truth',
  'brutal',
  'simple',
  'steal',
  'avoid',
  'actually',
  'hidden',
  'system',
  'blueprint',
  'script',
  'objection',
  'closing',
  'revenue',
  'conversion',
  'minutes',
  'hours',
];

const CURIOSITY_PATTERNS = [
  /here'?s (how|why|what|the)/i,
  /most people/i,
  /nobody talks about/i,
  /stopped doing/i,
  /after \d+/i,
  /i spent \d+/i,
  /\d+\s*(ways|steps|lessons|scripts|mistakes|rules|frameworks|hours|days|months)/i,
  /thread|🧵|👇|↓/i,
  /the difference between/i,
  /why .* fails/i,
];

const CTA_PATTERNS = [
  /comment\s+["'‘’“”]?[a-z0-9]+/i,
  /reply\s+["'‘’“”]?[a-z0-9]+/i,
  /bookmark/i,
  /save this/i,
  /dm me/i,
  /send you/i,
  /grab the/i,
  /link below/i,
  /follow/i,
  /\?$/m,
];

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

export function estimateReadingGrade(text: string): number {
  const words = text
    .replace(/https?:\/\/\S+/g, '')
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-zA-Z0-9]/g, '').length > 0);
  if (words.length === 0) return 0;
  const sentences = Math.max(
    1,
    text.split(/[.!?\n]+/).filter((s) => s.trim().length > 0).length
  );
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(1, Math.min(16, Math.round(grade * 10) / 10));
}

/**
 * Reverse-Engineered Anyword-style 0-100 Predictive Performance Engine.
 * Evaluates copy across 4 transparent linguistic & conversion pillars (25 pts each).
 */
export function scoreCopy(
  blocks: string[],
  options?: {
    brandBrain?: Pick<BrandBrain, 'bannedCliches' | 'winningPhrases'>;
    persona?: AudiencePersona;
  }
): CopyScoreBreakdown {
  const nonEmptyBlocks = blocks.map((b) => b.trim()).filter(Boolean);
  const fullText = nonEmptyBlocks.join('\n\n');

  if (!fullText) {
    return {
      total: 0,
      grade: 'Needs Work',
      hookScore: 0,
      persuasionScore: 0,
      readabilityScore: 0,
      conversionScore: 0,
      readingGrade: 0,
      awarenessStage: 'Unaware',
      algorithmSignals: {
        bookmarkPull: 0,
        replyPull: 0,
        dwellPull: 0,
      },
      clichesFound: [],
      strengths: [],
      suggestions: ['Start writing your opening hook to see your live Predictive Performance Score.'],
    };
  }

  const firstBlock = nonEmptyBlocks[0];
  const lines = firstBlock.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? '';
  const lowerFull = fullText.toLowerCase();

  const strengths: string[] = [];
  const suggestions: string[] = [];

  // 1. HOOK STOPPING POWER (0-25)
  let hookScore = 6;
  if (firstLine.length >= 25 && firstLine.length <= 115) {
    hookScore += 6;
    strengths.push('Punchy first-line hook length fits cleanly above the fold on mobile.');
  } else if (firstLine.length > 115) {
    hookScore += 2;
    suggestions.push('Tighten your first line under 110 characters so scanners catch the hook instantly.');
  } else {
    suggestions.push('Add specificity to line 1 — hooks under 25 characters rarely create enough tension.');
  }

  if (/\d+/.test(firstLine) || /\$\d+|\d+%|\d+x/i.test(firstBlock)) {
    hookScore += 6;
    strengths.push('Concrete numbers in the hook anchor credibility and stop the scroll.');
  } else {
    suggestions.push('Include a concrete number, timeframe, or dollar/percentage metric in your hook.');
  }

  const curiosityHits = CURIOSITY_PATTERNS.filter((rx) => rx.test(firstBlock)).length;
  if (curiosityHits >= 2) {
    hookScore += 7;
    strengths.push('Strong open-loop curiosity gap compels readers to click "Show more".');
  } else if (curiosityHits === 1) {
    hookScore += 4;
  } else {
    suggestions.push('Open a curiosity loop (e.g., "Most people miss this...", "Here\'s the exact 3-step system:").');
  }
  hookScore = Math.min(25, hookScore);

  // 2. PERSUASION & ATTENTION PSYCHOLOGY (0-25)
  let persuasionScore = 5;
  const powerHits = POWER_WORDS.filter((pw) => lowerFull.includes(pw));
  persuasionScore += Math.min(10, powerHits.length * 2.5);
  if (powerHits.length >= 3) {
    strengths.push(`Uses high-pull persuasion words (${powerHits.slice(0, 3).join(', ')}).`);
  } else {
    suggestions.push('Swap flat verbs for concrete emotional or authority triggers (e.g., "costing", "exact", "framework").');
  }

  const hasContrast = /\b(instead of|don't|stop|not\b.*\bbut\b|vs\.?|wrong|truth)\b/i.test(fullText);
  if (hasContrast) {
    persuasionScore += 5;
    strengths.push('Uses contrast/pattern-interrupt framing to challenge assumptions.');
  } else {
    suggestions.push('Add contrast ("Stop doing X. Do Y instead.") to sharpen your point of view.');
  }

  const hasAudienceCallout = /\b(you|your|founders|closers|creators|sales|buyers|builders|beginners)\b/i.test(firstBlock);
  if (hasAudienceCallout) {
    persuasionScore += 5;
  } else {
    suggestions.push('Speak directly to the reader using "you" or naming your exact audience.');
  }
  persuasionScore = Math.min(25, Math.round(persuasionScore));

  // 3. SCROLL READABILITY & X RHYTHM (0-25)
  let readabilityScore = 8;
  const readingGrade = estimateReadingGrade(fullText);
  if (readingGrade >= 3.5 && readingGrade <= 8.5) {
    readabilityScore += 8;
    strengths.push(`Ideal X reading clarity (Grade ${readingGrade}) — effortless to skim.`);
  } else if (readingGrade > 8.5) {
    readabilityScore += 2;
    suggestions.push(`Reading level is Grade ${readingGrade}. Use shorter words and sentences (target Grade 5-7).`);
  } else {
    readabilityScore += 5;
  }

  const allLines = fullText.split('\n');
  const blankLines = allLines.filter((l) => l.trim() === '').length;
  const hasListOrSpacing = blankLines >= 1 || /[-•→1-9]\./.test(fullText);
  if (hasListOrSpacing) {
    readabilityScore += 9;
    strengths.push('Clean line breaks and white-space rhythm boost dwell time.');
  } else if (firstBlock.length > 130) {
    suggestions.push('Break dense walls of text into 1-2 sentence lines with blank-line breathing room.');
  } else {
    readabilityScore += 5;
  }

  const bannedList = options?.brandBrain?.bannedCliches?.length
    ? options.brandBrain.bannedCliches
    : DEFAULT_BANNED_CLICHES;
  const clichesFound = bannedList.filter((phrase) =>
    lowerFull.includes(phrase.toLowerCase())
  );
  if (clichesFound.length > 0) {
    readabilityScore = Math.max(2, readabilityScore - clichesFound.length * 6);
    suggestions.push(`Remove robotic AI clichés detected: "${clichesFound.join('", "')}".`);
  }
  readabilityScore = Math.min(25, Math.round(readabilityScore));

  // 4. CONVERSION & BRAND COPY INTELLIGENCE (0-25)
  let conversionScore = 6;
  const hasCta = CTA_PATTERNS.some((rx) => rx.test(fullText));
  if (hasCta) {
    conversionScore += 8;
    strengths.push('Clear engagement or giveaway CTA drives replies and saves.');
  } else {
    suggestions.push('End with a clear next step (question, bookmark cue, or "Comment KEYWORD for the PDF").');
  }

  if (nonEmptyBlocks.length >= 2) {
    conversionScore += 4;
    strengths.push(`Multi-part thread (${nonEmptyBlocks.length} tweets) multiplies profile dwell time.`);
  } else if (firstBlock.length >= 90 && firstBlock.length <= 275) {
    conversionScore += 3;
  } else if (firstBlock.length > 280) {
    suggestions.push('Tweet 1 exceeds 280 characters — split into a thread or enable X Premium mode.');
  }

  if (options?.persona?.keywords?.length) {
    const personaMatches = options.persona.keywords.filter((kw) =>
      lowerFull.includes(kw.toLowerCase())
    );
    if (personaMatches.length > 0) {
      conversionScore += Math.min(5, personaMatches.length * 2 + 1);
      strengths.push(`Matches "${options.persona.name}" buyer language (${personaMatches.slice(0, 2).join(', ')}).`);
    }
  } else {
    conversionScore += 2;
  }

  if (options?.brandBrain?.winningPhrases?.length) {
    const intelMatches = options.brandBrain.winningPhrases.filter((p) =>
      lowerFull.includes(p.toLowerCase())
    );
    if (intelMatches.length > 0) {
      conversionScore += Math.min(4, intelMatches.length * 2);
    }
  }

  conversionScore = Math.min(25, Math.round(conversionScore));

  const total = Math.max(0, Math.min(100, hookScore + persuasionScore + readabilityScore + conversionScore));
  const grade: CopyScoreBreakdown['grade'] =
    total >= 84 ? 'S-Tier' : total >= 68 ? 'Strong' : total >= 50 ? 'Average' : 'Needs Work';

  // Eugene Schwartz 5 Stages of Market Awareness Classification
  let awarenessStage: CopyScoreBreakdown['awarenessStage'] = 'Problem Aware';
  if (/comment\s+["'‘’“”]?[a-z0-9]+|grab\s+the|whop|checkout|dm\s+you|link\s+below|free\s+pdf/i.test(lowerFull)) {
    awarenessStage = 'Most Aware';
  } else if (/playbook|framework|blueprint|checklist|system|step\s+1/i.test(lowerFull)) {
    awarenessStage = 'Solution Aware';
  } else if (/course|toolkit|template|program|offer/i.test(lowerFull)) {
    awarenessStage = 'Product Aware';
  } else if (/losing|mistake|struggling|costing|fail|broken|pain|wrong/i.test(lowerFull)) {
    awarenessStage = 'Problem Aware';
  } else {
    awarenessStage = 'Unaware';
  }

  // X Open-Source Recommendation Algorithm Signal Forecast (0-100 each)
  const hasChecklistOrSteps = /step\s*1|1\.|•|→|playbook|checklist|save this|bookmark/i.test(fullText);
  const hasGiveawayPrompt = /comment\s+["'‘’“”]?[a-z0-9]+|reply\s+["'‘’“”]?[a-z0-9]+/i.test(fullText);
  const hasQuestionPrompt = /\?$/m.test(fullText) || /\b(agree|thoughts|what do you|which one)\b/i.test(fullText);
  const bookmarkPull = Math.min(
    99,
    Math.round(
      readabilityScore * 2.1 +
        (hasChecklistOrSteps ? 26 : 6) +
        (nonEmptyBlocks.length >= 2 ? 12 : 0) +
        hookScore * 0.4
    )
  );
  const replyPull = Math.min(
    99,
    Math.round(
      persuasionScore * 1.5 +
        conversionScore * 0.7 +
        (hasGiveawayPrompt ? 46 : hasQuestionPrompt ? 28 : 8) +
        (hasContrast ? 12 : 0)
    )
  );
  const dwellPull = Math.min(
    99,
    Math.round(
      readabilityScore * 1.8 +
        hookScore * 1.4 +
        (nonEmptyBlocks.length >= 2 ? 18 : fullText.length >= 160 ? 10 : 0)
    )
  );

  return {
    total,
    grade,
    hookScore,
    persuasionScore,
    readabilityScore,
    conversionScore,
    readingGrade,
    awarenessStage,
    algorithmSignals: {
      bookmarkPull,
      replyPull,
      dwellPull,
    },
    clichesFound,
    strengths: strengths.slice(0, 4),
    suggestions: suggestions.slice(0, 4),
  };
}
