import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AccountProfile, GhostPilotStore, QueueSlot, TelegramConfig } from '../lib/types';

interface SimpleAccountsTelegramViewProps {
  store: GhostPilotStore;
  activeAccount: AccountProfile;
  onSaveRawStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onSwitchAccount: (id: string) => void;
  onCreateAccount: (name: string, handle: string) => Promise<void>;
  onOpenNicheWizard: () => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function SimpleAccountsTelegramView({
  store,
  activeAccount,
  onSaveRawStore,
  onReplaceStore,
  onSwitchAccount,
  onCreateAccount,
  onOpenNicheWizard,
  onNotify,
}: SimpleAccountsTelegramViewProps) {
  const existingTg = activeAccount.telegram?.botToken
    ? activeAccount.telegram
    : store.telegramConfig;

  const [botToken, setBotToken] = useState(existingTg?.botToken || '');
  const [chatId, setChatId] = useState(existingTg?.chatId || '');
  const [botUsername, setBotUsername] = useState(existingTg?.botUsername || '');
  const [autoDeliver, setAutoDeliver] = useState(existingTg?.autoDeliverScheduled ?? true);
  const [autoPlugReminder, setAutoPlugReminder] = useState(
    existingTg?.autoPlugReminderEnabled ?? true
  );
  const [evergreenOn, setEvergreenOn] = useState(store.globalAutomationDefaults.evergreenEnabled);
  const [autoRtOn, setAutoRtOn] = useState(store.globalAutomationDefaults.autoRetweetEnabled);
  const [autoDeleteOn, setAutoDeleteOn] = useState(store.globalAutomationDefaults.autoDeleteEnabled);
  const [twoWayInbox, setTwoWayInbox] = useState(existingTg?.twoWayInboxEnabled ?? true);

  const [detectingChat, setDetectingChat] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [pollingInbox, setPollingInbox] = useState(false);

  // Simple daily schedule times
  const [newTime, setNewTime] = useState('18:00');

  // Account & Affiliate Group Offer state
  const [newAccName, setNewAccName] = useState('');
  const [newAccHandle, setNewAccHandle] = useState('');
  const activeOffer = activeAccount.brandBrain?.offers[0] || store.brandBrain.offers[0];
  const [editingWhopUrl, setEditingWhopUrl] = useState(activeOffer?.url || '');
  const [editingWhopName, setEditingWhopName] = useState(activeOffer?.name || '');
  const [editingWhopPrice, setEditingWhopPrice] = useState(activeOffer?.priceLabel || 'Affiliate Group');
  const [editingWhopPromise, setEditingWhopPromise] = useState(activeOffer?.promise || '');

  // Compact Antigravity Bridge state
  const [rawPaste, setRawPaste] = useState('');
  const [syncingAg, setSyncingAg] = useState(false);
  const [creatingAgTask, setCreatingAgTask] = useState(false);

  const uniqueTimes = Array.from(
    new Set(store.queueSlots.filter((s) => s.enabled).map((s) => s.time))
  ).sort();

  const handleAutoDetectChat = async () => {
    if (!botToken.trim()) {
      onNotify('Paste your Bot Token from @BotFather first.', 'error');
      return;
    }
    setDetectingChat(true);
    try {
      const res = await api.detectTelegramChat(botToken.trim());
      setChatId(res.chatId);
      setBotUsername(res.botUsername);
      onNotify(`Found your Telegram Chat ID (${res.chatId}) on @${res.botUsername}! Now click Save & Send Test.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not auto-detect Chat ID.', 'error');
    } finally {
      setDetectingChat(false);
    }
  };

  const handleSaveAndTestTelegram = async () => {
    setTestingTg(true);
    try {
      const res = await api.testTelegram({ botToken: botToken.trim(), chatId: chatId.trim() });
      setBotUsername(res.botUsername);

      // Persist toggles too
      const nextTg: TelegramConfig = {
        enabled: true,
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        botUsername: res.botUsername,
        autoDeliverScheduled: autoDeliver,
        autoPlugReminderEnabled: autoPlugReminder,
        autoPlugDelayMinutes: 30,
        twoWayInboxEnabled: twoWayInbox,
        lastSentAt: new Date().toISOString(),
      };
      const nextAccounts = res.store.accounts.map((a) =>
        a.id === activeAccount.id ? { ...a, telegram: nextTg } : a
      );
      await onSaveRawStore({
        accounts: nextAccounts,
        telegramConfig: nextTg,
        globalAutomationDefaults: {
          ...res.store.globalAutomationDefaults,
          evergreenEnabled: evergreenOn,
          autoPlugEnabled: autoPlugReminder,
        },
      });
      onNotify(`Test message sent to your Telegram from @${res.botUsername}!`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Telegram test failed.', 'error');
    } finally {
      setTestingTg(false);
    }
  };

  const handleSaveAutomationToggles = async (next: {
    autoDeliver?: boolean;
    autoPlugReminder?: boolean;
    evergreenOn?: boolean;
    autoRtOn?: boolean;
    autoDeleteOn?: boolean;
    twoWayInbox?: boolean;
  }) => {
    const ad = next.autoDeliver ?? autoDeliver;
    const ap = next.autoPlugReminder ?? autoPlugReminder;
    const ev = next.evergreenOn ?? evergreenOn;
    const rt = next.autoRtOn ?? autoRtOn;
    const del = next.autoDeleteOn ?? autoDeleteOn;
    const tw = next.twoWayInbox ?? twoWayInbox;

    setAutoDeliver(ad);
    setAutoPlugReminder(ap);
    setEvergreenOn(ev);
    setAutoRtOn(rt);
    setAutoDeleteOn(del);
    setTwoWayInbox(tw);

    const nextTg: TelegramConfig = {
      enabled: Boolean(botToken.trim() && chatId.trim()),
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      botUsername,
      autoDeliverScheduled: ad,
      autoPlugReminderEnabled: ap,
      autoPlugDelayMinutes: 30,
      twoWayInboxEnabled: tw,
    };
    const nextAccounts = store.accounts.map((a) =>
      a.id === activeAccount.id ? { ...a, telegram: nextTg } : a
    );
    await onSaveRawStore({
      accounts: nextAccounts,
      telegramConfig: nextTg,
      globalAutomationDefaults: {
        ...store.globalAutomationDefaults,
        evergreenEnabled: ev,
        autoPlugEnabled: ap,
        autoRetweetEnabled: rt,
        autoDeleteEnabled: del,
      },
    });
    onNotify('Saved your 6-branch $0 TweetHunter automation rules.');
  };

  const handleAddDailyTime = async () => {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    if (uniqueTimes.includes(newTime)) {
      onNotify(`${newTime} is already in your daily schedule.`);
      return;
    }
    const createdSlots: QueueSlot[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      id: `slot-${day}-${newTime}-${Date.now()}`,
      accountId: activeAccount.id,
      dayOfWeek: day,
      time: newTime,
      label: `Daily ${newTime}`,
      enabled: true,
    }));
    await onSaveRawStore({ queueSlots: [...store.queueSlots, ...createdSlots] });
    onNotify(`Added ${newTime} to your daily Telegram posting schedule.`);
  };

  const handleRemoveDailyTime = async (time: string) => {
    const remaining = store.queueSlots.filter((s) => s.time !== time);
    await onSaveRawStore({ queueSlots: remaining });
    onNotify(`Removed ${time} from your daily schedule.`);
  };

  const handlePollTelegramInbox = async () => {
    setPollingInbox(true);
    try {
      const res = await api.pollTelegramInbox();
      onReplaceStore(res.store);
      onNotify(
        res.createdPosts > 0
          ? `Turned ${res.createdPosts} message${res.createdPosts > 1 ? 's' : ''} from your Telegram into queued posts & replied back!`
          : 'Checked Telegram — no new links or ideas sent to your bot yet.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not check Telegram inbox.', 'error');
    } finally {
      setPollingInbox(false);
    }
  };

  const handleSaveWhopOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const brain = activeAccount.brandBrain || store.brandBrain;
    const cleanName = editingWhopName.trim() || 'My Affiliate Group';
    const cleanUrl = editingWhopUrl.trim() || 'https://whop.com';
    const cleanPrice = editingWhopPrice.trim() || 'Affiliate Group';
    const cleanPromise =
      editingWhopPromise.trim() || `Hands-on ${brain.niche} community, templates & live breakdowns.`;

    const offers = brain.offers.length
      ? brain.offers.map((o, idx) =>
          idx === 0
            ? {
                ...o,
                name: cleanName,
                url: cleanUrl,
                priceLabel: cleanPrice,
                promise: cleanPromise,
                autoPlugTemplate: `Want the full system & live group? Check out ${cleanName} here: ${cleanUrl}`,
              }
            : o
        )
      : [
          {
            id: `offer-${Date.now()}`,
            name: cleanName,
            platform: 'Whop' as const,
            url: cleanUrl,
            priceLabel: cleanPrice,
            promise: cleanPromise,
            autoPlugTemplate: `Want the full system & live group? Check out ${cleanName} here: ${cleanUrl}`,
            giveawayKeyword: 'PLAYBOOK',
            clicks: 0,
            leads: 0,
            estimatedRevenue: 0,
          },
        ];

    const updatedBrain = { ...brain, offers };
    const nextAccounts = store.accounts.map((a) =>
      a.id === activeAccount.id ? { ...a, brandBrain: updatedBrain } : a
    );
    await onSaveRawStore({ accounts: nextAccounts, brandBrain: updatedBrain });
    onNotify(`Saved Affiliate Group Offer "${cleanName}" across all PDFs, Auto-Plugs & DM scripts.`);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccHandle.trim()) return;
    await onCreateAccount(newAccName.trim(), newAccHandle.trim());
    setNewAccName('');
    setNewAccHandle('');
  };

  const handleDeleteAccount = async (id: string) => {
    if (store.accounts.length <= 1) {
      onNotify('Keep at least one account in GhostPilot.', 'error');
      return;
    }
    const nextAccounts = store.accounts.filter((a) => a.id !== id);
    const nextActive = id === activeAccount.id ? nextAccounts[0].id : store.activeAccountId;
    await onSaveRawStore({ accounts: nextAccounts, activeAccountId: nextActive });
    onNotify('Removed account.');
  };

  const handleCreateAntigravityTask = async () => {
    setCreatingAgTask(true);
    try {
      const res = await api.createAntigravityTask({
        type: 'weekly-autopilot',
        title: `7-Day Posts + PDF for ${activeAccount.handle}`,
        goal: `Create 7 tweets + 1 free PDF for ${activeAccount.brandBrain?.niche || store.brandBrain.niche}`,
      });
      onReplaceStore(res.store);
      onNotify('Wrote antigravity-sync/tasks.json! Ask Antigravity to fill results.json, then click Sync.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create task.', 'error');
    } finally {
      setCreatingAgTask(false);
    }
  };

  const handleImportAntigravity = async () => {
    setSyncingAg(true);
    try {
      const res = rawPaste.trim()
        ? await api.importAntigravityRaw({ rawText: rawPaste.trim() })
        : await api.syncAntigravityOutbox();
      onReplaceStore(res.store);
      setRawPaste('');
      onNotify(
        `Imported ${res.importedPosts} posts and ${res.importedMagnets} free PDFs into your Queue!`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      setSyncingAg(false);
    }
  };

  const handleExportBackup = async () => {
    const data = await api.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostpilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Downloaded your $0 local backup file.');
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
          Accounts &amp; Free Telegram Autopilot
        </h2>
        <p className="text-sm text-[#6E6E73] dark:text-[#86868B] mt-0.5">
          Set up your $0 Telegram bot once, pick your daily posting times, and manage all your X
          accounts in one place.
        </p>
      </div>

      {/* SECTION 1: FREE TELEGRAM BOT SETUP */}
      <section className="apple-card p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              1. Connect Your Free Telegram Bot ($0 Forever)
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
              {existingTg?.enabled
                ? `Connected to @${botUsername || existingTg.botUsername || 'your_bot'} · Chat ID ${existingTg.chatId}`
                : 'Takes 30 seconds — zero API fees, zero X ban risk.'}
            </p>
          </div>
          {existingTg?.enabled && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] dark:text-[#30D158]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Telegram Active</span>
            </span>
          )}
        </div>

        {/* 4-Step Ultra-Simple @BotFather Guide */}
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-[#515154] dark:text-[#A1A1A6] pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
          <li>
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Step 1.</span> Open
            Telegram, search <span className="font-mono font-semibold">@BotFather</span>, send{' '}
            <span className="font-mono">/newbot</span>.
          </li>
          <li>
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Step 2.</span> Copy
            the <span className="font-semibold">Bot Token</span> it gives you and paste it below.
          </li>
          <li>
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Step 3.</span> Open
            your new bot in Telegram and send <span className="font-mono">hi</span>.
          </li>
          <li>
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Step 4.</span> Click{' '}
            <span className="font-semibold">Auto-Find Chat ID</span> below, then{' '}
            <span className="font-semibold">Save &amp; Send Test</span>.
          </li>
        </ol>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="tg-token"
              className="block text-xs font-medium text-[#515154] dark:text-[#A1A1A6]"
            >
              Telegram Bot Token (from @BotFather)
            </label>
            <input
              id="tg-token"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:AAH..."
              className="apple-input text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="tg-chat"
              className="block text-xs font-medium text-[#515154] dark:text-[#A1A1A6]"
            >
              Your Telegram Chat ID
            </label>
            <div className="flex gap-2">
              <input
                id="tg-chat"
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 512345678"
                className="apple-input flex-1 text-sm font-mono tabular-nums"
              />
              <button
                type="button"
                onClick={handleAutoDetectChat}
                disabled={detectingChat}
                className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0"
              >
                {detectingChat ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Auto-Find Chat ID</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAndTestTelegram}
            disabled={testingTg}
            className="apple-btn-primary px-5 py-2.5 text-sm whitespace-nowrap"
          >
            {testingTg ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{testingTg ? 'Sending Test...' : 'Save & Send Test Message'}</span>
          </button>

          <button
            type="button"
            onClick={handlePollTelegramInbox}
            disabled={pollingInbox || !botToken.trim() || !chatId.trim()}
            className="apple-btn-secondary px-4 py-2.5 text-sm whitespace-nowrap"
          >
            {pollingInbox ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Inbox className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Check Telegram Inbox for Links</span>
          </button>
        </div>

        {/* Daily Posting Times + $0 TweetHunter Automation Toggles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              <Clock className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
              <span>Daily Telegram Drop Times</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {uniqueTimes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleRemoveDailyTime(t)}
                  title="Click to remove time"
                  className="apple-btn-secondary px-3 py-1.5 text-xs font-mono tabular-nums"
                >
                  <span>{t}</span>
                  <span className="text-[#86868B]">×</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="apple-input w-36 text-sm font-mono tabular-nums"
              />
              <button
                type="button"
                onClick={handleAddDailyTime}
                className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Time</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              $0 TweetHunter Automations (via Telegram)
            </div>
            <div className="space-y-2.5 text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDeliver}
                  onChange={(e) => handleSaveAutomationToggles({ autoDeliver: e.target.checked })}
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Auto-send scheduled posts to Telegram on time</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlugReminder}
                  onChange={(e) =>
                    handleSaveAutomationToggles({ autoPlugReminder: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Send 30-min Auto-Plug reply reminder (PDF/Whop link)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRtOn}
                  onChange={(e) => handleSaveAutomationToggles({ autoRtOn: e.target.checked })}
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Auto-Retweet (+8h) &amp; Auto-UnRT (+24h) Telegram alerts</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evergreenOn}
                  onChange={(e) => handleSaveAutomationToggles({ evergreenOn: e.target.checked })}
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Evergreen Recycling (re-queue top winners every 14 days)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDeleteOn}
                  onChange={(e) => handleSaveAutomationToggles({ autoDeleteOn: e.target.checked })}
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>Auto-Delete low-performer review nudge (+48h)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={twoWayInbox}
                  onChange={(e) => handleSaveAutomationToggles({ twoWayInbox: e.target.checked })}
                  className="h-4 w-4 accent-[#0071E3]"
                />
                <span>
                  Two-Way Telegram Bot (<span className="font-mono">/today</span>,{' '}
                  <span className="font-mono">/ideas</span>, <span className="font-mono">/pdf</span>,{' '}
                  <span className="font-mono">/replies</span>, <span className="font-mono">/dm</span>,{' '}
                  <span className="font-mono">/stats</span>)
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: MANAGE ACCOUNTS & AFFILIATE GROUP OFFER */}
      <section className="apple-card p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              2. Your X Accounts &amp; Affiliate Group Offer
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
              Every Paid-Worth PDF, Auto-Plug reply, and 4-Step DM script automatically points warm
              leads to this Affiliate Group link.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNicheWizard}
            className="apple-btn-secondary px-4 py-2 text-xs whitespace-nowrap shrink-0"
          >
            Change Active Account Niche
          </button>
        </div>

        {/* Active Account Affiliate Group Offer Editor */}
        <form
          onSubmit={handleSaveWhopOffer}
          className="space-y-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={editingWhopName}
              onChange={(e) => setEditingWhopName(e.target.value)}
              placeholder="Affiliate Group Name (e.g. AI Builders Guild)"
              className="apple-input text-sm"
            />
            <input
              type="url"
              value={editingWhopUrl}
              onChange={(e) => setEditingWhopUrl(e.target.value)}
              placeholder="https://whop.com/your-affiliate-link"
              className="apple-input text-sm"
            />
            <input
              type="text"
              value={editingWhopPrice}
              onChange={(e) => setEditingWhopPrice(e.target.value)}
              placeholder="Price / Label (e.g. $49/mo Group)"
              className="apple-input text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={editingWhopPromise}
              onChange={(e) => setEditingWhopPromise(e.target.value)}
              placeholder="Why beginners love this group (shown inside every Paid-Worth PDF)"
              className="apple-input flex-1 text-sm"
            />
            <button type="submit" className="apple-btn-primary px-5 py-2.5 text-sm whitespace-nowrap shrink-0">
              Save Affiliate Group Offer
            </button>
          </div>
        </form>

        {/* Account List */}
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
          {store.accounts.map((acc) => {
            const isCurrent = acc.id === activeAccount.id;
            return (
              <div
                key={acc.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {acc.name}{' '}
                    <span className="font-normal text-[#6E6E73] dark:text-[#86868B]">
                      {acc.handle}
                    </span>
                  </div>
                  <div className="text-xs text-[#6E6E73] dark:text-[#86868B]">
                    {acc.nicheProfile?.subNicheName || acc.brandBrain?.niche || 'Niche not set yet'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                      <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchAccount(acc.id)}
                      className="apple-btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
                    >
                      Switch
                    </button>
                  )}
                  {store.accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id)}
                      aria-label={`Delete ${acc.handle}`}
                      className="p-1.5 text-[#86868B] hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Account Inline */}
        <form
          onSubmit={handleAddAccount}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]"
        >
          <input
            type="text"
            value={newAccName}
            onChange={(e) => setNewAccName(e.target.value)}
            placeholder="New Account Name"
            className="apple-input text-sm"
          />
          <input
            type="text"
            value={newAccHandle}
            onChange={(e) => setNewAccHandle(e.target.value)}
            placeholder="@handle"
            className="apple-input text-sm font-mono"
          />
          <button
            type="submit"
            disabled={!newAccName.trim() || !newAccHandle.trim()}
            className="apple-btn-secondary px-4 py-2.5 text-sm whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add New Account</span>
          </button>
        </form>
      </section>

      {/* SECTION 3: LOCAL ANTIGRAVITY IDE BRIDGE & BACKUP */}
      <section className="apple-card p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
            <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              3. Local Antigravity IDE Sync &amp; Backup ($0)
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreateAntigravityTask}
              disabled={creatingAgTask}
              className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
            >
              {creatingAgTask ? 'Writing Task...' : 'Create Antigravity Task'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/skills/pack');
                  const pack = await res.json();
                  const blob = new Blob([JSON.stringify(pack, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ghostpilot-antigravity-skills-pack.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  onNotify(
                    `Exported ${pack.antigravitySkillCount} Antigravity SKILL.md playbooks + ${pack.totalGithubSkills} GitHub skills!`
                  );
                } catch {
                  onNotify('Could not export Antigravity Skills Pack.', 'error');
                }
              }}
              className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export 7 Antigravity Skills</span>
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export Backup</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-[#6E6E73] dark:text-[#86868B]">
          On your laptop, double-click <span className="font-mono">start-ghostpilot.bat</span>{' '}
          (Windows) or run <span className="font-mono">./start-ghostpilot.sh</span> (Mac/Linux) to
          boot GhostPilot + your live Telegram bot at <span className="font-mono">localhost:3000</span>.
          Includes 7 installed <span className="font-mono">antigravity-skills/*/SKILL.md</span>{' '}
          playbooks covering all 6 Tweet Hunter branches.
        </p>

        <textarea
          rows={3}
          value={rawPaste}
          onChange={(e) => setRawPaste(e.target.value)}
          placeholder="Optional: paste tweets or JSON directly from your Antigravity chat here, then click Import..."
          className="apple-input text-xs font-mono"
        />

        <button
          type="button"
          onClick={handleImportAntigravity}
          disabled={syncingAg}
          className="apple-btn-secondary px-4 py-2 text-xs whitespace-nowrap"
        >
          {syncingAg ? 'Importing...' : rawPaste.trim() ? 'Import Pasted Tweets' : 'Sync results.json From Antigravity'}
        </button>
      </section>
    </div>
  );
}
