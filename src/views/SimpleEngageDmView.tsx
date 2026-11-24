import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  buildFourStepAffiliateDmSequence,
  buildProfileFunnelKit,
  exportCapturedLeadsToCsv,
} from '../lib/branchEngine';
import { buildXIntentUrl } from '../lib/telegramFormatter';
import type {
  AccountProfile,
  AutoDmCampaign,
  CrmContact,
  GhostPilotStore,
} from '../lib/types';

interface SimpleEngageDmViewProps {
  store: GhostPilotStore;
  activeAccount: AccountProfile;
  initialTab?: 'reply-guy' | 'auto-dm' | 'profile-leads';
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onGoToTelegramSetup: () => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

const CRM_STAGES: CrmContact['stage'][] = ['New', 'Engaged', 'DM Sent', 'Buyer'];

export function SimpleEngageDmView({
  store,
  activeAccount,
  initialTab = 'reply-guy',
  onUpdateStore,
  onReplaceStore,
  onGoToTelegramSetup,
  onNotify,
}: SimpleEngageDmViewProps) {
  const [tab, setTab] = useState<'reply-guy' | 'auto-dm' | 'profile-leads'>(initialTab);

  // Branch 5: Reply-Guy & CRM state
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newLatestTopic, setNewLatestTopic] = useState('');
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null);
  const [generatedReplies, setGeneratedReplies] = useState<
    Record<string, Array<{ id: string; angle: string; text: string }>>
  >({});
  const [sendingPack, setSendingPack] = useState<'replies' | 'dm' | null>(null);

  // Branch 4: Auto-DM Campaign & Commenter state
  const [campaignKeyword, setCampaignKeyword] = useState(
    store.leadMagnets[0]?.giveawayKeyword || 'PLAYBOOK'
  );
  const [selectedMagnetId, setSelectedMagnetId] = useState(store.leadMagnets[0]?.id || '');
  const [commenterHandle, setCommenterHandle] = useState('');
  const [commenterNote, setCommenterNote] = useState('');

  const primaryOffer = store.brandBrain.offers[0];
  const activeMagnet =
    store.leadMagnets.find((m) => m.id === selectedMagnetId) || store.leadMagnets[0];
  const capturedLeads = store.capturedLeads || [];

  const fourStepDms = useMemo(
    () =>
      buildFourStepAffiliateDmSequence({
        magnet: activeMagnet,
        offer: primaryOffer,
        niche: store.brandBrain.niche,
        baseUrl: window.location.origin,
      }),
    [activeMagnet, primaryOffer, store.brandBrain.niche]
  );

  const profileKit = useMemo(
    () =>
      buildProfileFunnelKit({
        account: activeAccount,
        brain: store.brandBrain,
        magnet: activeMagnet,
        offer: primaryOffer,
        baseUrl: window.location.origin,
      }),
    [activeAccount, store.brandBrain, activeMagnet, primaryOffer]
  );

  const handleCopy = async (text: string, msg = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(msg);
    } catch {
      onNotify('Select text manually to copy.', 'error');
    }
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = newHandle.trim();
    if (!cleanHandle) {
      onNotify('Enter an X @handle to track.', 'error');
      return;
    }
    const formattedHandle = cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`;
    const contact: CrmContact = {
      id: `crm-${Date.now()}`,
      accountId: activeAccount.id,
      name: newName.trim() || formattedHandle.replace(/^@/, ''),
      handle: formattedHandle,
      avatarUrl: activeAccount.avatarUrl,
      bio: `${store.brandBrain.niche} voice`,
      followers: 25000,
      listId: store.crmLists[0]?.id || `list-${activeAccount.id}-buyers`,
      stage: 'New',
      notes: 'Daily Reply-Guy target',
      latestTweet: newLatestTopic.trim() || `Posting about ${store.brandBrain.niche}`,
      lastInteractedAt: new Date().toISOString(),
    };
    await onUpdateStore({ crmContacts: [contact, ...store.crmContacts] });
    setNewName('');
    setNewHandle('');
    setNewLatestTopic('');
    onNotify(`Added ${formattedHandle} to your Reply-Guy & Warm Lead CRM.`);
  };

  const handleUpdateStage = async (contactId: string, stage: CrmContact['stage']) => {
    const next = store.crmContacts.map((c) =>
      c.id === contactId ? { ...c, stage, lastInteractedAt: new Date().toISOString() } : c
    );
    await onUpdateStore({ crmContacts: next });
    onNotify(`Updated lead stage to ${stage}.`);
  };

  const handleRemoveContact = async (contactId: string) => {
    await onUpdateStore({
      crmContacts: store.crmContacts.filter((c) => c.id !== contactId),
    });
    onNotify('Removed contact from CRM.');
  };

  const handleGenerateReplies = async (contact: CrmContact) => {
    setBusyReplyId(contact.id);
    try {
      const res = await api.generateReplySuggestions({
        targetHandle: contact.handle,
        targetTopic: contact.latestTweet || contact.bio || store.brandBrain.niche,
      });
      setGeneratedReplies((prev) => ({ ...prev, [contact.id]: res.replies }));
      onNotify(`Generated 3 high-signal replies for ${contact.handle} ($0).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not generate replies.', 'error');
    } finally {
      setBusyReplyId(null);
    }
  };

  const handleSendBranchPack = async (pack: 'replies' | 'dm') => {
    setSendingPack(pack);
    try {
      const res = await api.sendBranchPackToTelegram({ pack });
      onReplaceStore(res.store);
      onNotify(
        pack === 'replies'
          ? 'Sent today’s Reply-Guy targets + 3 value replies straight to your Telegram!'
          : 'Sent all 4 Affiliate Group DM closing scripts straight to your Telegram!'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connect Telegram first.';
      onNotify(msg, 'error');
      if (msg.toLowerCase().includes('connect')) {
        onGoToTelegramSetup();
      }
    } finally {
      setSendingPack(null);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const kw = campaignKeyword.trim().toUpperCase() || 'PLAYBOOK';
    const campaign: AutoDmCampaign = {
      id: `dm-${Date.now()}`,
      accountId: activeAccount.id,
      name: `${kw} → ${activeMagnet?.title || 'Free Playbook'}`,
      triggerKeyword: kw,
      requireFollow: true,
      requireLike: false,
      leadMagnetId: activeMagnet?.id,
      offerId: primaryOffer?.id,
      dmTemplate: fourStepDms[0]?.message || '',
      active: true,
      sentCount: 0,
      pendingCommenters: [],
      createdAt: new Date().toISOString(),
    };
    await onUpdateStore({ autoDmCampaigns: [campaign, ...store.autoDmCampaigns] });
    onNotify(`Created Auto-DM Giveaway Campaign for keyword "${kw}".`);
  };

  const handleAddCommenter = async (campaignId: string) => {
    const clean = commenterHandle.trim();
    if (!clean) {
      onNotify('Enter the commenter @handle first.', 'error');
      return;
    }
    const handle = clean.startsWith('@') ? clean : `@${clean}`;
    const nextCampaigns = store.autoDmCampaigns.map((camp) =>
      camp.id === campaignId
        ? {
            ...camp,
            pendingCommenters: [
              {
                id: `comm-${Date.now()}`,
                handle,
                name: handle.replace(/^@/, ''),
                commentText: commenterNote.trim() || camp.triggerKeyword,
                sent: false,
                commentedAt: new Date().toISOString(),
              },
              ...camp.pendingCommenters,
            ],
          }
        : camp
    );
    await onUpdateStore({ autoDmCampaigns: nextCampaigns });
    setCommenterHandle('');
    setCommenterNote('');
    onNotify(`Logged ${handle} in your Giveaway Commenter Queue.`);
  };

  const handleMarkCommenterSent = async (campaignId: string, commenterId: string) => {
    const nextCampaigns = store.autoDmCampaigns.map((camp) => {
      if (camp.id !== campaignId) return camp;
      let newlySent = false;
      const updated = camp.pendingCommenters.map((c) => {
        if (c.id === commenterId && !c.sent) {
          newlySent = true;
          return { ...c, sent: true };
        }
        return c;
      });
      return {
        ...camp,
        sentCount: camp.sentCount + (newlySent ? 1 : 0),
        pendingCommenters: updated,
      };
    });
    await onUpdateStore({ autoDmCampaigns: nextCampaigns });
    onNotify('Marked commenter delivered — follow up with Step 2 in 4–12 hours!');
  };

  const handleExportLeadsCsv = () => {
    if (capturedLeads.length === 0) {
      onNotify('No captured email leads yet. Share your /r/ PDF page first!', 'error');
      return;
    }
    const csv = exportCapturedLeadsToCsv(capturedLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostpilot-leads-${activeAccount.handle.replace(/[^a-z0-9]/gi, '')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Exported ${capturedLeads.length} captured email lead(s) to CSV ($0).`);
  };

  const handleSeedStarterTargets = async () => {
    const nicheSlug = store.brandBrain.niche.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'growth';
    const nowIso = new Date().toISOString();
    const starters: CrmContact[] = [
      {
        id: `crm-${Date.now()}-1`,
        accountId: activeAccount.id,
        name: `${store.brandBrain.niche.split('&')[0].trim()} Playbooks`,
        handle: `@${nicheSlug}daily`,
        avatarUrl: activeAccount.avatarUrl,
        bio: `Daily ${store.brandBrain.niche} teardowns & systems`,
        followers: 64200,
        listId: store.crmLists[0]?.id || `list-${activeAccount.id}-buyers`,
        stage: 'New',
        notes: 'High-reply big niche account — leave 1 sharp addition daily',
        latestTweet: `Most people overcomplicate ${store.brandBrain.niche}. One repeatable daily workflow beats 10 random tactics.`,
        lastInteractedAt: nowIso,
      },
      {
        id: `crm-${Date.now()}-2`,
        accountId: activeAccount.id,
        name: 'Zero-to-One Operators',
        handle: `@${nicheSlug}ops`,
        avatarUrl: activeAccount.avatarUrl,
        bio: `Practical workflows for solo builders & beginners`,
        followers: 38900,
        listId: store.crmLists[0]?.id || `list-${activeAccount.id}-buyers`,
        stage: 'New',
        notes: 'Engaged beginner audience — ideal for profile clicks to your Pinned Free PDF',
        latestTweet: `If I had to start from 0 followers in ${store.brandBrain.niche} with $0 budget, I would focus on 10 sharp replies and 1 free checklist.`,
        lastInteractedAt: nowIso,
      },
      {
        id: `crm-${Date.now()}-3`,
        accountId: activeAccount.id,
        name: 'Solo Funnel Lab',
        handle: `@${nicheSlug}lab`,
        avatarUrl: activeAccount.avatarUrl,
        bio: `Breaking down viral threads, lead magnets & community offers`,
        followers: 51400,
        listId: store.crmLists[0]?.id || `list-${activeAccount.id}-buyers`,
        stage: 'Engaged',
        notes: 'Ask sharp clarifying questions under their viral threads',
        latestTweet: `Your free PDF should feel like a $97 product. That is how beginners earn trust before recommending a paid group.`,
        lastInteractedAt: nowIso,
      },
      {
        id: `crm-${Date.now()}-4`,
        accountId: activeAccount.id,
        name: 'Laptop Systems Club',
        handle: `@laptop${nicheSlug}`,
        avatarUrl: activeAccount.avatarUrl,
        bio: `Bootstrapped systems & zero-cost distribution`,
        followers: 27800,
        listId: store.crmLists[0]?.id || `list-${activeAccount.id}-buyers`,
        stage: 'New',
        notes: 'Swap this handle with any favorite big creator in your niche',
        latestTweet: `Stop paying $100/mo for tools when a simple daily system and consistent value replies get your first 1,000 followers.`,
        lastInteractedAt: nowIso,
      },
    ];
    await onUpdateStore({ crmContacts: [...starters, ...store.crmContacts] });
    onNotify(`Loaded 4 starter ${store.brandBrain.niche} Reply-Guy targets ($0)!`);
  };

  return (
    <div className="space-y-6">
      {/* Header + Clean 3-Option Segmented Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Engage, Reply-Guy &amp; Auto-DM
          </h2>
          <p className="text-sm text-[#6E6E73] dark:text-[#86868B] mt-0.5">
            Grow from 0 followers with targeted replies, deliver paid-worth free PDFs, and guide warm leads into{' '}
            <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              {primaryOffer?.name || 'your Affiliate Group Offer'}
            </span>
            .
          </p>
        </div>

        <div className="apple-segmented shrink-0 flex-nowrap self-start lg:self-auto">
          {(
            [
              { id: 'reply-guy', label: `Reply-Guy (${store.crmContacts.length})` },
              { id: 'auto-dm', label: `Auto-DM (${store.autoDmCampaigns.length})` },
              { id: 'profile-leads', label: `Profile & Leads (${capturedLeads.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                tab === item.id ? 'apple-segment-active' : 'apple-segment-idle'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: REPLY-GUY TARGETS & WARM LEAD CRM (BRANCH 5) */}
      {tab === 'reply-guy' && (
        <div className="space-y-6">
          <form onSubmit={handleAddTarget} className="apple-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Add a Big Niche Account or Warm Lead to Track
                </h3>
                <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
                  Leave 5–10 sharp replies daily under big accounts in {store.brandBrain.niche} to pull traffic straight to your Pinned Freebie.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSendBranchPack('replies')}
                disabled={sendingPack === 'replies'}
                className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0"
              >
                {sendingPack === 'replies' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Send Daily Targets to Telegram</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr_auto] gap-2.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Creator Name"
                className="apple-input text-sm"
              />
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@handle (required)"
                required
                className="apple-input text-sm font-mono"
              />
              <input
                type="text"
                value={newLatestTopic}
                onChange={(e) => setNewLatestTopic(e.target.value)}
                placeholder="Latest tweet or topic they post about"
                className="apple-input text-sm"
              />
              <button
                type="submit"
                className="apple-btn-primary px-4 py-2.5 text-xs whitespace-nowrap"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Target</span>
              </button>
            </div>
          </form>

          <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {store.crmContacts.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
                  No Reply-Guy targets yet. Add 5–10 big {store.brandBrain.niche} accounts above, or load starter targets to test the daily 0-follower reply loop right now.
                </p>
                <button
                  type="button"
                  onClick={handleSeedStarterTargets}
                  className="apple-btn-secondary px-4 py-2 text-xs whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Load 4 Starter Niche Targets ($0)</span>
                </button>
              </div>
            ) : (
              store.crmContacts.map((contact) => {
                const replies = generatedReplies[contact.id];
                const cleanHandle = contact.handle.replace(/^@/, '');
                return (
                  <article key={contact.id} className="p-5 sm:p-6 space-y-3.5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6E73] dark:text-[#86868B]">
                          <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {contact.name}
                          </span>
                          <span className="font-mono">{contact.handle}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {contact.followers.toLocaleString()} followers
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Stage: {contact.stage}</span>
                        </div>
                        <p className="text-sm text-[#515154] dark:text-[#A1A1A6]">
                          {contact.latestTweet || contact.bio}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label htmlFor={`stage-${contact.id}`} className="sr-only">
                          CRM stage for {contact.handle}
                        </label>
                        <select
                          id={`stage-${contact.id}`}
                          value={contact.stage}
                          onChange={(e) =>
                            handleUpdateStage(contact.id, e.target.value as CrmContact['stage'])
                          }
                          className="apple-input py-1.5 px-2.5 text-xs w-auto"
                        >
                          {CRM_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st === 'Buyer' ? 'Affiliate Member' : st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleGenerateReplies(contact)}
                          disabled={busyReplyId === contact.id}
                          className="apple-btn-primary px-3.5 py-2 text-xs whitespace-nowrap"
                        >
                          {busyReplyId === contact.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>Generate 3 Value Replies</span>
                        </button>
                        <a
                          href={`https://x.com/${encodeURIComponent(cleanHandle)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="apple-btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Open on X ($0)</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(contact.id)}
                          aria-label={`Remove ${contact.handle}`}
                          className="p-1.5 text-[#86868B] hover:text-[#DC2626]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {replies && replies.length > 0 && (
                      <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
                        {replies.map((r) => (
                          <div
                            key={r.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm py-1.5"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                                {r.angle}
                              </span>
                              <p className="text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">{r.text}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(r.text, `Copied ${r.angle} reply for ${contact.handle}!`)
                              }
                              className="apple-btn-secondary px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
                            >
                              <Copy className="h-3 w-3" aria-hidden="true" />
                              <span>Copy Reply</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* TAB 2: AUTO-DM GIVEAWAY & 4-STEP AFFILIATE GROUP CLOSING (BRANCH 4) */}
      {tab === 'auto-dm' && (
        <div className="space-y-6">
          {/* 4-Step Affiliate Group DM Sequence */}
          <section className="apple-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  4-Step Free-PDF to Affiliate Group DM Sequence
                </h3>
                <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
                  Message 1 delivers pure paid-worth value (zero pitch). Messages 2–4 naturally qualify &amp; invite warm leads into{' '}
                  <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {primaryOffer?.name || 'your Affiliate Group'}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSendBranchPack('dm')}
                disabled={sendingPack === 'dm'}
                className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap shrink-0"
              >
                {sendingPack === 'dm' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Send All 4 Scripts to Telegram</span>
              </button>
            </div>

            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
              {fourStepDms.map((step) => (
                <div key={step.step} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[#6E6E73] dark:text-[#86868B] flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {step.title}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{step.timing}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(step.message, `Copied ${step.title}!`)}
                      className="apple-btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      <span>Copy Step {step.step}</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#6E6E73] dark:text-[#86868B]">{step.goal}</p>
                  <div className="whitespace-pre-wrap text-sm text-[#1D1D1F] dark:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-white/[0.04] rounded-xl p-3.5 leading-relaxed">
                    {step.message}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Keyword Giveaway Campaign & Commenter Queue */}
          <form onSubmit={handleCreateCampaign} className="apple-card p-5 sm:p-6 space-y-3">
            <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Create a Comment-to-PDF Auto-DM Campaign
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2.5">
              <input
                type="text"
                value={campaignKeyword}
                onChange={(e) => setCampaignKeyword(e.target.value)}
                placeholder="Keyword (e.g. PLAYBOOK)"
                className="apple-input text-sm font-mono uppercase"
              />
              <select
                value={selectedMagnetId}
                onChange={(e) => setSelectedMagnetId(e.target.value)}
                aria-label="Choose Paid-Worth Free PDF"
                className="apple-input text-sm"
              >
                {store.leadMagnets.length === 0 ? (
                  <option value="">Create a Free PDF in Queue &amp; PDFs first</option>
                ) : (
                  store.leadMagnets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.sections.length} chapters)
                    </option>
                  ))
                )}
              </select>
              <button
                type="submit"
                className="apple-btn-primary px-4 py-2.5 text-xs whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Campaign</span>
              </button>
            </div>
          </form>

          <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {store.autoDmCampaigns.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6E6E73] dark:text-[#86868B]">
                No Auto-DM giveaway campaigns yet. Create one above to track commenters and send your 4-step DM sequence fast.
              </div>
            ) : (
              store.autoDmCampaigns.map((camp) => (
                <article key={camp.id} className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-[#6E6E73] dark:text-[#86868B] flex flex-wrap items-center gap-2 tabular-nums">
                        <span className="font-mono font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                          Keyword: {camp.triggerKeyword}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{camp.sentCount} DMs delivered</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {camp.pendingCommenters.filter((c) => !c.sent).length} waiting
                        </span>
                      </div>
                      <h4 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                        {camp.name}
                      </h4>
                    </div>
                  </div>

                  {/* Quick Log Commenter */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={commenterHandle}
                      onChange={(e) => setCommenterHandle(e.target.value)}
                      placeholder="Log commenter @handle"
                      className="apple-input text-xs font-mono sm:w-52"
                    />
                    <input
                      type="text"
                      value={commenterNote}
                      onChange={(e) => setCommenterNote(e.target.value)}
                      placeholder={`Comment text (default: "${camp.triggerKeyword}")`}
                      className="apple-input text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCommenter(camp.id)}
                      className="apple-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Log Commenter</span>
                    </button>
                  </div>

                  {camp.pendingCommenters.length > 0 && (
                    <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06] border-t border-black/[0.05] dark:border-white/[0.06]">
                      {camp.pendingCommenters.slice(0, 8).map((comm) => (
                        <div
                          key={comm.id}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {comm.handle}
                            </span>
                            <span className="text-[#6E6E73] dark:text-[#86868B]">
                              commented &quot;{comm.commentText}&quot;
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {comm.sent ? (
                              <span className="inline-flex items-center gap-1 text-[#16A34A] dark:text-[#30D158] font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Step 1 Sent</span>
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopy(
                                      fourStepDms[0]?.message || camp.dmTemplate,
                                      `Copied Step 1 DM for ${comm.handle}!`
                                    )
                                  }
                                  className="apple-btn-secondary px-2.5 py-1 text-xs whitespace-nowrap"
                                >
                                  Copy Step 1 DM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkCommenterSent(camp.id, comm.id)}
                                  className="apple-btn-primary px-2.5 py-1 text-xs whitespace-nowrap"
                                >
                                  Mark Sent
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}

      {/* TAB 3: X PROFILE FUNNEL KIT & CAPTURED EMAIL LEADS (BRANCHES 5 & 6) */}
      {tab === 'profile-leads' && (
        <div className="space-y-6">
          {/* X Profile Bio + Banner + Pinned Giveaway Tweet Kit */}
          <section className="apple-card p-6 sm:p-7 space-y-5">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                High-Converting X Profile Funnel Kit ({activeAccount.handle})
              </h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
                When Reply-Guy readers click your profile, your Bio + Pinned Giveaway Tweet immediately turns visitors into Free PDF leads &amp; Affiliate Group clicks.
              </p>
            </div>

            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
              {profileKit.bioOptions.map((bio, idx) => (
                <div
                  key={bio.angle}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-[#6E6E73] dark:text-[#86868B] tabular-nums">
                      Bio Option 0{idx + 1} · {bio.angle} · {bio.chars}/160 chars
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {bio.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(bio.text, `Copied Bio Option 0${idx + 1}!`)}
                    className="apple-btn-secondary px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>Copy Bio</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Pinned Giveaway Tweet (Pin This to Top of Your X Profile)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(profileKit.pinnedTweet, 'Copied Pinned Giveaway Tweet!')}
                    className="apple-btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>Copy Tweet</span>
                  </button>
                  <a
                    href={buildXIntentUrl(profileKit.pinnedTweet)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apple-btn-primary px-3.5 py-1.5 text-xs whitespace-nowrap"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span>Post &amp; Pin on X ($0)</span>
                  </a>
                </div>
              </div>
              <div className="whitespace-pre-wrap text-sm text-[#1D1D1F] dark:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-white/[0.04] rounded-xl p-4 leading-relaxed">
                {profileKit.pinnedTweet}
              </div>
            </div>
          </section>

          {/* Captured Email Leads Table + $0 CSV Export */}
          <section className="apple-card p-6 sm:p-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Captured Email Leads ({capturedLeads.length})
                </h3>
                <p className="text-xs text-[#6E6E73] dark:text-[#86868B] mt-0.5">
                  Every visitor who unlocks your Email-Gated Free PDF Vault (/r/...) is saved locally here for $0 — export to CSV anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportLeadsCsv}
                className="apple-btn-primary px-4 py-2 text-xs whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export Leads CSV ($0)</span>
              </button>
            </div>

            {capturedLeads.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#6E6E73] dark:text-[#86868B] border-t border-black/[0.06] dark:border-white/[0.08]">
                No email leads captured yet. Open any Free PDF page from Queue &amp; PDFs and unlock it with an email to test live capture.
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-black/[0.06] dark:border-white/[0.08]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-[#6E6E73] dark:text-[#86868B]">
                      <th className="py-2.5 pr-4 font-medium">Email Address</th>
                      <th className="py-2.5 pr-4 font-medium">Unlocked Free PDF</th>
                      <th className="py-2.5 text-right font-medium">Captured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                    {capturedLeads.map((lead) => (
                      <tr key={lead.id} className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                        <td className="py-2.5 pr-4 font-mono font-medium">{lead.email}</td>
                        <td className="py-2.5 pr-4 text-[#515154] dark:text-[#A1A1A6]">
                          {lead.sourcePdfTitle}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-[#6E6E73] dark:text-[#86868B]">
                          {new Date(lead.capturedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
