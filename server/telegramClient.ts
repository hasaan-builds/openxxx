import type { TelegramInlineButton } from '../src/lib/telegramFormatter';

const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function telegramCall<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const token = botToken.trim();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as TelegramApiResponse<T>;
  if (!res.ok || !data.ok) {
    throw new Error(
      data.description || `Telegram API error (${res.status}). Double-check your Bot Token and Chat ID.`
    );
  }
  return data.result as T;
}

export async function getTelegramBotInfo(botToken: string): Promise<{ id: number; username: string; firstName: string }> {
  const me = await telegramCall<{ id: number; username?: string; first_name?: string }>(botToken, 'getMe');
  return {
    id: me.id,
    username: me.username || 'your_bot',
    firstName: me.first_name || 'GhostPilot Bot',
  };
}

export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] };
}): Promise<{ messageId: number }> {
  const body: Record<string, unknown> = {
    chat_id: params.chatId.trim(),
    text: params.text.slice(0, 4050),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (params.replyMarkup && params.replyMarkup.inline_keyboard.length > 0) {
    body.reply_markup = params.replyMarkup;
  }

  const res = await telegramCall<{ message_id: number }>(params.botToken, 'sendMessage', body);
  return { messageId: res.message_id };
}

interface RawTelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    date?: number;
    chat: {
      id: number;
      username?: string;
      first_name?: string;
      title?: string;
      type: string;
    };
  };
}

/**
 * Calls getUpdates so the user doesn't have to hunt for their numeric Chat ID.
 * They just message "hi" to their bot on Telegram and click "Auto-Find Chat ID".
 */
export async function detectTelegramChatId(botToken: string): Promise<{
  botUsername: string;
  chatId: string;
  chatLabel: string;
  lastUpdateId?: number;
}> {
  const [me, updates] = await Promise.all([
    getTelegramBotInfo(botToken),
    telegramCall<RawTelegramUpdate[]>(botToken, 'getUpdates', { limit: 20 }),
  ]);

  const reversed = [...(updates || [])].reverse();
  const match = reversed.find((u) => u.message?.chat?.id);
  if (!match?.message?.chat) {
    throw new Error(
      `Bot @${me.username} is valid, but has no messages yet! Open Telegram, search @${me.username}, tap Start (or send "hi"), then click Auto-Find Chat ID again.`
    );
  }

  const chat = match.message.chat;
  return {
    botUsername: me.username,
    chatId: String(chat.id),
    chatLabel: chat.username ? `@${chat.username}` : chat.first_name || chat.title || String(chat.id),
    lastUpdateId: match.update_id,
  };
}

/**
 * Two-Way Telegram Inbox ($0): fetches new messages the user texted to their bot
 * (e.g., a Whop product URL, article link, or tweet idea) since lastUpdateId.
 */
export async function fetchTelegramInboxMessages(
  botToken: string,
  chatId: string,
  lastUpdateId?: number
): Promise<{
  messages: Array<{ updateId: number; text: string; url?: string }>;
  nextUpdateId?: number;
}> {
  const updates = await telegramCall<RawTelegramUpdate[]>(botToken, 'getUpdates', {
    offset: typeof lastUpdateId === 'number' ? lastUpdateId + 1 : undefined,
    limit: 20,
  });

  let maxId = lastUpdateId;
  const messages: Array<{ updateId: number; text: string; url?: string }> = [];

  for (const upd of updates || []) {
    if (typeof maxId !== 'number' || upd.update_id > maxId) {
      maxId = upd.update_id;
    }
    const msg = upd.message;
    if (!msg?.text) continue;
    if (String(msg.chat.id) !== chatId.trim()) continue;
    const text = msg.text.trim();
    if (!text || text === '/start' || text.toLowerCase() === 'hi') continue;
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    messages.push({
      updateId: upd.update_id,
      text,
      url: urlMatch ? urlMatch[0] : undefined,
    });
  }

  return { messages, nextUpdateId: maxId };
}
