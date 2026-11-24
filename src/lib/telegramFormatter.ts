import type { AccountProfile, LeadMagnet, MonetizationOffer, PostItem } from './types';

export interface TelegramInlineButton {
  text: string;
  url: string;
}

export interface FormattedTelegramPayload {
  text: string;
  replyMarkup?: {
    inline_keyboard: TelegramInlineButton[][];
  };
}

export function escapeTelegramHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildXIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent((text || '').trim())}`;
}

export function validateTelegramCredentials(
  botToken: string,
  chatId?: string
): { valid: boolean; error?: string } {
  const token = (botToken || '').trim();
  if (!token) {
    return { valid: false, error: 'Paste your Telegram Bot Token from @BotFather first.' };
  }
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return {
      valid: false,
      error: 'That does not look like a Telegram Bot Token (it looks like 123456789:ABCdef...).',
    };
  }
  if (chatId !== undefined) {
    const cid = chatId.trim();
    if (!cid) {
      return {
        valid: false,
        error: 'Add your Chat ID (or send "hi" to your bot and click Auto-Find Chat ID).',
      };
    }
    if (!/^-?\d+$/.test(cid) && !/^@[A-Za-z0-9_]{4,}$/.test(cid)) {
      return {
        valid: false,
        error: 'Chat ID should be a number (e.g. 512345678) or @channel_username.',
      };
    }
  }
  return { valid: true };
}

export function formatPostForTelegram(params: {
  post: PostItem;
  account: AccountProfile;
  linkedMagnet?: LeadMagnet;
  baseUrl?: string;
}): FormattedTelegramPayload {
  const { post, account, linkedMagnet, baseUrl } = params;
  const cleanBase = (baseUrl || 'http://localhost:3000').replace(/\/$/, '');
  const formatLabel =
    post.format === 'thread'
      ? `Thread (${post.blocks.length} tweets)`
      : post.format === 'giveaway'
        ? 'Comment-to-PDF Giveaway'
        : post.format === 'carousel'
          ? 'Carousel Post'
          : 'Single Post';

  const header = `<b>GhostPilot · ${escapeTelegramHtml(account.handle)}</b>\n<i>${escapeTelegramHtml(formatLabel)} · Ready to post ($0)</i>`;

  const bodyBlocks = post.blocks.map((block, idx) => {
    const prefix = post.blocks.length > 1 ? `<b>Tweet ${idx + 1}/${post.blocks.length}:</b>\n` : '';
    return `${prefix}<pre>${escapeTelegramHtml(block.trim())}</pre>`;
  });

  const extraLines: string[] = [];
  if (post.automations.autoPlugEnabled && post.automations.autoPlugText.trim()) {
    extraLines.push(
      `<b>Auto-Plug Reply (drop ${post.automations.autoPlugDelayMinutes || 30}m later):</b>\n<pre>${escapeTelegramHtml(post.automations.autoPlugText.trim())}</pre>`
    );
  }
  if (linkedMagnet) {
    const pdfUrl = `${cleanBase}/r/${linkedMagnet.slug}`;
    extraLines.push(
      `<b>Comment-to-PDF Reply Template (Keyword: ${escapeTelegramHtml(linkedMagnet.giveawayKeyword)}):</b>\n<pre>${escapeTelegramHtml(
        `Just dropped it for you! Grab "${linkedMagnet.title}" free here: ${pdfUrl}`
      )}</pre>`
    );
  }

  const text = [header, ...bodyBlocks, ...extraLines].join('\n\n');

  const buttons: TelegramInlineButton[][] = [
    [{ text: 'Post Tweet 1 on X ($0)', url: buildXIntentUrl(post.blocks[0] || '') }],
  ];
  if (linkedMagnet && cleanBase.startsWith('https://')) {
    buttons.push([{ text: 'Open Free PDF Page', url: `${cleanBase}/r/${linkedMagnet.slug}` }]);
  }

  return {
    text,
    replyMarkup: { inline_keyboard: buttons },
  };
}

export function formatBranchAlertForTelegram(params: {
  type: 'auto-rt' | 'auto-unrt' | 'auto-delete';
  post: PostItem;
  account: AccountProfile;
  delayLabel: string;
}): FormattedTelegramPayload {
  const { type, post, account, delayLabel } = params;
  const hookPreview = (post.blocks[0] || '').split('\n')[0].slice(0, 100);
  const handleClean = account.handle.replace(/^@/, '');
  const profileUrl = `https://x.com/${encodeURIComponent(handleClean)}`;

  if (type === 'auto-rt') {
    return {
      text: [
        `<b>Auto-Retweet Boost (${delayLabel}) · ${escapeTelegramHtml(account.handle)}</b>`,
        `<i>Give your post a second wave for another time zone:</i>`,
        `<pre>${escapeTelegramHtml(hookPreview)}</pre>`,
        `Tap below to open your profile and Repost it in 2 seconds ($0).`,
      ].join('\n\n'),
      replyMarkup: {
        inline_keyboard: [[{ text: 'Open My X Profile to Repost ($0)', url: profileUrl }]],
      },
    };
  }

  if (type === 'auto-unrt') {
    return {
      text: [
        `<b>Auto-Unretweet Cleanup (${delayLabel}) · ${escapeTelegramHtml(account.handle)}</b>`,
        `<i>Keep your timeline crisp — undo the repost on:</i>`,
        `<pre>${escapeTelegramHtml(hookPreview)}</pre>`,
      ].join('\n\n'),
      replyMarkup: {
        inline_keyboard: [[{ text: 'Open My X Profile ($0)', url: profileUrl }]],
      },
    };
  }

  return {
    text: [
      `<b>Auto-Delete Check (${delayLabel}) · ${escapeTelegramHtml(account.handle)}</b>`,
      `<i>Review this post — if impressions stayed low, delete it to keep your profile signal high:</i>`,
      `<pre>${escapeTelegramHtml(hookPreview)}</pre>`,
    ].join('\n\n'),
    replyMarkup: {
      inline_keyboard: [[{ text: 'Review on My X Profile ($0)', url: profileUrl }]],
    },
  };
}

export function formatReplyGuyPackForTelegram(params: {
  account: AccountProfile;
  niche: string;
  targets: Array<{ name: string; handle: string; latestTweet?: string }>;
  sampleReplies: Array<{ angle: string; text: string }>;
}): FormattedTelegramPayload {
  const { account, niche, targets, sampleReplies } = params;
  const targetLines = targets
    .slice(0, 5)
    .map((t, i) => `${i + 1}. <b>${escapeTelegramHtml(t.name)}</b> (${escapeTelegramHtml(t.handle)})`);

  const replyLines = sampleReplies
    .slice(0, 3)
    .map((r) => `<b>${escapeTelegramHtml(r.angle)}:</b>\n<pre>${escapeTelegramHtml(r.text)}</pre>`);

  const firstHandle = (targets[0]?.handle || '').replace(/^@/, '');
  const buttons: TelegramInlineButton[][] = [];
  if (firstHandle) {
    buttons.push([{ text: `Open @${firstHandle} on X ($0)`, url: `https://x.com/${encodeURIComponent(firstHandle)}` }]);
  }

  return {
    text: [
      `<b>Daily Reply-Guy Mission · ${escapeTelegramHtml(account.handle)}</b>`,
      `<i>0-Follower Growth Engine for ${escapeTelegramHtml(niche)} — leave 5–10 sharp replies today:</i>`,
      targetLines.length > 0 ? targetLines.join('\n') : 'Add big accounts in Engage & Auto-DM.',
      ...replyLines,
    ].join('\n\n'),
    replyMarkup: buttons.length ? { inline_keyboard: buttons } : undefined,
  };
}

export function formatFourStepDmForTelegram(params: {
  account: AccountProfile;
  steps: Array<{ step: number; title: string; message: string }>;
}): FormattedTelegramPayload {
  const { account, steps } = params;
  const blocks = steps.map(
    (s) => `<b>${escapeTelegramHtml(s.title)}:</b>\n<pre>${escapeTelegramHtml(s.message)}</pre>`
  );

  return {
    text: [
      `<b>4-Step Free-PDF to Affiliate Group DM Scripts · ${escapeTelegramHtml(account.handle)}</b>`,
      `<i>Tap any code box below to copy and paste directly into X DMs ($0):</i>`,
      ...blocks,
    ].join('\n\n'),
  };
}


export function formatAutoPlugReminderForTelegram(params: {
  post: PostItem;
  account: AccountProfile;
}): FormattedTelegramPayload {
  const { post, account } = params;
  const hookPreview = (post.blocks[0] || '').split('\n')[0].slice(0, 90);
  const plugText = post.automations.autoPlugText.trim();

  const text = [
    `<b>Auto-Plug Reminder · ${escapeTelegramHtml(account.handle)}</b>`,
    `<i>Your post "${escapeTelegramHtml(hookPreview)}..." has been live for ${post.automations.autoPlugDelayMinutes || 30}m. Reply to it now with your offer/PDF link:</i>`,
    `<pre>${escapeTelegramHtml(plugText)}</pre>`,
  ].join('\n\n');

  return {
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: 'Open X to Reply ($0)', url: buildXIntentUrl(plugText) }]],
    },
  };
}

export function formatGiveawayPackForTelegram(params: {
  magnet: LeadMagnet;
  offer?: MonetizationOffer;
  account: AccountProfile;
  baseUrl?: string;
}): FormattedTelegramPayload {
  const { magnet, offer, account, baseUrl } = params;
  const cleanBase = (baseUrl || 'http://localhost:3000').replace(/\/$/, '');
  const pdfUrl = `${cleanBase}/r/${magnet.slug}`;
  const keyword = magnet.giveawayKeyword || 'GUIDE';

  const giveawayTweet = `I just built the complete "${magnet.title}" (${magnet.format}) for ${magnet.niche}.\n\nInside:\n${magnet.sections
    .slice(0, 3)
    .map((s) => `• ${s.heading}`)
    .join('\n')}\n\nComment "${keyword}" and I'll send you the free PDF link.`;

  const replyTemplate = `Just sent it! Grab "${magnet.title}" free here: ${pdfUrl}`;
  const dmTemplate = `Hey! Thanks for commenting ${keyword}. Here is your free copy of "${magnet.title}": ${pdfUrl}${
    offer ? `\n\nIf you want the full system, check out ${offer.name}: ${offer.url}` : ''
  }`;

  const text = [
    `<b>Free PDF Giveaway Pack · ${escapeTelegramHtml(account.handle)}</b>`,
    `<b>1. Giveaway Tweet (copy or tap button):</b>\n<pre>${escapeTelegramHtml(giveawayTweet)}</pre>`,
    `<b>2. Public Reply Template (for commenters):</b>\n<pre>${escapeTelegramHtml(replyTemplate)}</pre>`,
    `<b>3. DM Template (for commenters):</b>\n<pre>${escapeTelegramHtml(dmTemplate)}</pre>`,
    `<b>4. Free Hosted PDF Link:</b>\n${escapeTelegramHtml(pdfUrl)}`,
  ].join('\n\n');

  const buttons: TelegramInlineButton[][] = [
    [{ text: 'Post Giveaway Tweet on X ($0)', url: buildXIntentUrl(giveawayTweet) }],
  ];
  if (cleanBase.startsWith('https://')) {
    buttons.push([{ text: 'Open Free PDF Page', url: pdfUrl }]);
  }

  return {
    text,
    replyMarkup: { inline_keyboard: buttons },
  };
}
