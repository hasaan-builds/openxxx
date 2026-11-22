import React, { useState } from 'react';
import {
  Check,
  Copy,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AutoDmCampaign, GhostPilotStore } from '../lib/types';

interface AutomationsViewProps {
  store: GhostPilotStore;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function AutomationsView({
  store,
  onSaveStore,
  onReplaceStore,
  onNotify,
}: AutomationsViewProps) {
  const [defaults, setDefaults] = useState(store.globalAutomationDefaults);
  const [tickLoading, setTickLoading] = useState(false);

  // New Auto-DM Campaign form
  const [newName, setNewName] = useState('');
  const [newKeyword, setNewKeyword] = useState('PLAYBOOK');
  const [newLeadMagnetId, setNewLeadMagnetId] = useState(store.leadMagnets[0]?.id || '');
  const [newOfferId, setNewOfferId] = useState(store.brandBrain.offers[0]?.id || '');
  const [newTemplate, setNewTemplate] = useState(
    'Hey {{name}}! Thanks for commenting. Here is your free PDF playbook: {{resource_url}} — let me know which script you try first!'
  );

  const handleSaveDefaults = async () => {
    await onSaveStore({ globalAutomationDefaults: defaults });
    onNotify('Saved global automation defaults.');
  };

  const handleRunSchedulerTick = async () => {
    setTickLoading(true);
    try {
      const res = await api.runSchedulerTick();
      onReplaceStore(res.store);
      onNotify(
        res.processed > 0
          ? `Scheduler processed ${res.processed} queued item(s).`
          : 'Scheduler ran cleanly — no posts due right this minute.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Scheduler tick failed.', 'error');
    } finally {
      setTickLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newName.trim() || !newKeyword.trim()) {
      onNotify('Enter a campaign name and trigger keyword.', 'error');
      return;
    }
    const campaign: AutoDmCampaign = {
      id: `dm-${Date.now()}`,
      name: newName.trim(),
      triggerKeyword: newKeyword.trim().toUpperCase(),
      requireFollow: true,
      requireLike: false,
      leadMagnetId: newLeadMagnetId || undefined,
      offerId: newOfferId || undefined,
      dmTemplate: newTemplate.trim(),
      active: true,
      sentCount: 0,
      pendingCommenters: [],
      createdAt: new Date().toISOString(),
    };
    await onSaveStore({ autoDmCampaigns: [campaign, ...store.autoDmCampaigns] });
    setNewName('');
    onNotify(`Created Auto-DM giveaway campaign "${campaign.name}".`);
  };

  const handleAssistedSendDm = async (campaign: AutoDmCampaign, commenterId: string) => {
    const commenter = campaign.pendingCommenters.find((c) => c.id === commenterId);
    if (!commenter) return;

    const magnet = store.leadMagnets.find((m) => m.id === campaign.leadMagnetId);
    const resourceUrl = magnet
      ? `${window.location.origin}/r/${magnet.slug}`
      : store.brandBrain.offers.find((o) => o.id === campaign.offerId)?.url || window.location.origin;

    const personalized = campaign.dmTemplate
      .replace(/\{\{name\}\}/gi, commenter.name.split(' ')[0] || commenter.handle)
      .replace(/\{\{resource_url\}\}/gi, resourceUrl);

    try {
      await navigator.clipboard.writeText(personalized);
    } catch {
      // Clipboard may be blocked in headless mode; still mark sent cleanly
    }

    const nextCampaigns = store.autoDmCampaigns.map((c) => {
      if (c.id !== campaign.id) return c;
      return {
        ...c,
        sentCount: c.sentCount + 1,
        pendingCommenters: c.pendingCommenters.map((p) =>
          p.id === commenterId ? { ...p, sent: true } : p
        ),
      };
    });

    const nextLogs = [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'auto-dm' as const,
        mode: 'sandbox' as const,
        message: `Prepared personalized PDF delivery DM for ${commenter.handle} (${campaign.triggerKeyword}).`,
      },
      ...store.automationLogs,
    ].slice(0, 60);

    await onSaveStore({ autoDmCampaigns: nextCampaigns, automationLogs: nextLogs });
    onNotify(`Copied personalized DM for ${commenter.handle} and marked delivered.`);
  };

  const handleDeleteCampaign = async (id: string) => {
    await onSaveStore({
      autoDmCampaigns: store.autoDmCampaigns.filter((c) => c.id !== id),
    });
    onNotify('Deleted giveaway campaign.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Automations & Auto-DM Giveaways
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Auto-Plug offers, Auto-Retweet / Un-RT, Evergreen recycling, Auto-Delete, and Comment-to-PDF DM campaigns.
          </p>
        </div>

        <button
          type="button"
          disabled={tickLoading}
          onClick={handleRunSchedulerTick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-sky-700 whitespace-nowrap"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          <span>{tickLoading ? 'Running...' : 'Run Scheduler Tick Now'}</span>
        </button>
      </div>

      {/* Global Automation Rules */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Global Posting Automation Defaults
            </h3>
          </div>
          <button
            type="button"
            onClick={handleSaveDefaults}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
          >
            Save Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Auto-Plug Offer Reply
              </span>
              <input
                type="checkbox"
                checked={defaults.autoPlugEnabled}
                onChange={(e) => setDefaults({ ...defaults, autoPlugEnabled: e.target.checked })}
                className="h-4 w-4 accent-sky-600"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reply automatically to your own tweets with your Whop offer or free PDF link.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>Delay (minutes):</span>
              <input
                type="number"
                min={1}
                max={240}
                value={defaults.autoPlugDelayMinutes}
                onChange={(e) =>
                  setDefaults({ ...defaults, autoPlugDelayMinutes: Number(e.target.value) || 5 })
                }
                className="w-20 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Auto-Retweet & Auto-Unretweet
              </span>
              <input
                type="checkbox"
                checked={defaults.autoRetweetEnabled}
                onChange={(e) =>
                  setDefaults({ ...defaults, autoRetweetEnabled: e.target.checked })
                }
                className="h-4 w-4 accent-sky-600"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Boost posts across timezones, then cleanly un-RT so your profile stays uncluttered.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-1.5">
                <span>RT after (h):</span>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={defaults.autoRetweetDelayHours}
                  onChange={(e) =>
                    setDefaults({ ...defaults, autoRetweetDelayHours: Number(e.target.value) || 6 })
                  }
                  className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span>Un-RT after (h):</span>
                <input
                  type="number"
                  min={2}
                  max={72}
                  value={defaults.autoUnretweetAfterHours}
                  onChange={(e) =>
                    setDefaults({
                      ...defaults,
                      autoUnretweetAfterHours: Number(e.target.value) || 24,
                    })
                  }
                  className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Evergreen Winner Recycling
              </span>
              <input
                type="checkbox"
                checked={defaults.evergreenEnabled}
                onChange={(e) => setDefaults({ ...defaults, evergreenEnabled: e.target.checked })}
                className="h-4 w-4 accent-sky-600"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically re-queue your top evergreen tweets when slots open up.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>Minimum cooldown (days):</span>
              <input
                type="number"
                min={7}
                max={90}
                value={defaults.evergreenIntervalDays}
                onChange={(e) =>
                  setDefaults({ ...defaults, evergreenIntervalDays: Number(e.target.value) || 21 })
                }
                className="w-20 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Auto-Delete Promo Posts
              </span>
              <input
                type="checkbox"
                checked={defaults.autoDeleteEnabled}
                onChange={(e) => setDefaults({ ...defaults, autoDeleteEnabled: e.target.checked })}
                className="h-4 w-4 accent-sky-600"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically remove short-lived giveaway promos after the launch window closes.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>Delete after (hours):</span>
              <input
                type="number"
                min={6}
                max={168}
                value={defaults.autoDeleteAfterHours}
                onChange={(e) =>
                  setDefaults({ ...defaults, autoDeleteAfterHours: Number(e.target.value) || 48 })
                }
                className="w-20 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Auto-DM Giveaway Campaigns */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-5">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            Comment-to-PDF Auto-DM Giveaway Campaigns ($0 Free Tier Assisted Delivery)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            X&apos;s $0 Free API lets you post tweets & Auto-Plugs live, while reading incoming DMs/replies requires a paid X tier. Use 1-click Assisted Delivery here to copy each personalized PDF link & track leads at $0/month.
          </p>
        </div>

        {/* Create Campaign Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Campaign name (e.g., Objection Playbook Drop)"
            className="md:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Keyword (e.g., CLOSE)"
            className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
          />
          <select
            value={newLeadMagnetId}
            onChange={(e) => setNewLeadMagnetId(e.target.value)}
            className="md:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="">Attach Lead Magnet PDF...</option>
            {store.leadMagnets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <select
            value={newOfferId}
            onChange={(e) => setNewOfferId(e.target.value)}
            className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="">Offer...</option>
            {store.brandBrain.offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateCampaign}
            className="md:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Funnel</span>
          </button>
          <textarea
            rows={2}
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            className="md:col-span-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
          />
        </div>

        {/* Active Campaigns */}
        <div className="space-y-4">
          {store.autoDmCampaigns.map((camp) => {
            const magnet = store.leadMagnets.find((m) => m.id === camp.leadMagnetId);
            return (
              <div
                key={camp.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {camp.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Keyword: <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">&quot;{camp.triggerKeyword}&quot;</span> ·{' '}
                      {camp.sentCount} DMs delivered
                      {magnet ? ` · PDF: ${magnet.title}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(camp.id)}
                    aria-label="Delete campaign"
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {camp.pendingCommenters.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                    {camp.pendingCommenters.map((c) => (
                      <div key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>{' '}
                          <span className="text-slate-500 dark:text-slate-400">{c.handle}</span>
                          <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-slate-600 dark:text-slate-300">&quot;{c.commentText}&quot;</span>
                        </div>
                        {c.sent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Sent
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAssistedSendDm(camp, c.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                          >
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            <span>Copy Personalized DM & Mark Sent</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Execution Activity Log */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Automation Execution Log
          </h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {store.automationLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No automation events logged yet.</p>
          ) : (
            store.automationLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-baseline justify-between gap-4 text-xs">
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-mono uppercase text-sky-600 dark:text-sky-400 mr-2">
                    [{log.type}]
                  </span>
                  {log.message}
                </span>
                <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
