import React, { useState } from 'react';
import { Copy, Download, ExternalLink, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { exportLeadMagnetToPdf } from '../lib/pdfExport';
import type { AutoDmCampaign, GhostPilotStore, LeadMagnet, LeadMagnetSection } from '../lib/types';

interface LeadMagnetStudioViewProps {
  store: GhostPilotStore;
  initialTopic?: string;
  initialDossierId?: string;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onCreateGiveawayPost: (magnet: LeadMagnet) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function LeadMagnetStudioView({
  store,
  initialTopic,
  initialDossierId,
  onUpdateStore,
  onCreateGiveawayPost,
  onNotify,
}: LeadMagnetStudioViewProps) {
  const [selectedId, setSelectedId] = useState<string>(store.leadMagnets[0]?.id || '');
  const [genTopic, setGenTopic] = useState(initialTopic || store.brandBrain.niche);
  const [genFormat, setGenFormat] = useState<LeadMagnet['format']>('Playbook');
  const [genOfferId, setGenOfferId] = useState<string>(store.brandBrain.offers[0]?.id || '');
  const [generating, setGenerating] = useState(false);

  const activeMagnet =
    store.leadMagnets.find((m) => m.id === selectedId) || store.leadMagnets[0];
  const linkedOffer = store.brandBrain.offers.find((o) => o.id === activeMagnet?.linkedOfferId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.generateLeadMagnet({
        topic: genTopic.trim() || store.brandBrain.niche,
        format: genFormat,
        dossierId: initialDossierId || store.dossiers[0]?.id,
        offerId: genOfferId || store.brandBrain.offers[0]?.id,
      });
      const updated = [res.leadMagnet, ...store.leadMagnets];
      await onUpdateStore({ leadMagnets: updated });
      setSelectedId(res.leadMagnet.id);
      onNotify(`Generated "${res.leadMagnet.title}" PDF & Smart Resource Page (${res.engine}).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const updateActiveMagnet = async (patch: Partial<LeadMagnet>) => {
    if (!activeMagnet) return;
    const nextList = store.leadMagnets.map((m) =>
      m.id === activeMagnet.id ? { ...m, ...patch } : m
    );
    await onUpdateStore({ leadMagnets: nextList });
  };

  const handleUpdateSection = async (
    secId: string,
    patch: Partial<LeadMagnetSection>
  ) => {
    if (!activeMagnet) return;
    const sections = activeMagnet.sections.map((s) =>
      s.id === secId ? { ...s, ...patch } : s
    );
    await updateActiveMagnet({ sections });
  };

  const handleAddSection = async () => {
    if (!activeMagnet) return;
    const newSec: LeadMagnetSection = {
      id: `sec-${Date.now()}`,
      type: 'framework',
      heading: 'New Actionable Framework',
      body: 'Explain the exact step-by-step system your reader can apply immediately.',
      bullets: ['Step 1: Isolate the core leak', 'Step 2: Apply the exact script'],
    };
    await updateActiveMagnet({ sections: [...activeMagnet.sections, newSec] });
  };

  const handleDeleteSection = async (secId: string) => {
    if (!activeMagnet) return;
    await updateActiveMagnet({
      sections: activeMagnet.sections.filter((s) => s.id !== secId),
    });
  };

  const handleDownloadPdf = async () => {
    if (!activeMagnet) return;
    exportLeadMagnetToPdf(activeMagnet, linkedOffer);
    await updateActiveMagnet({ downloads: activeMagnet.downloads + 1 });
    onNotify(`Downloaded crisp multi-page PDF: ${activeMagnet.slug}.pdf`);
  };

  const handleCopySmartLink = () => {
    if (!activeMagnet) return;
    const url = `${window.location.origin}/r/${activeMagnet.slug}`;
    navigator.clipboard?.writeText(url);
    onNotify(`Copied Smart Resource Page link: ${url}`);
  };

  const handleLaunchGiveawayFunnel = async () => {
    if (!activeMagnet) return;
    // Also auto-create matching Auto-DM campaign if not already present
    const exists = store.autoDmCampaigns.some((c) => c.leadMagnetId === activeMagnet.id);
    if (!exists) {
      const smartLink = `${window.location.origin}/r/${activeMagnet.slug}`;
      const newCampaign: AutoDmCampaign = {
        id: `dm-${Date.now()}`,
        name: `${activeMagnet.title} Giveaway`,
        triggerKeyword: activeMagnet.giveawayKeyword || 'GUIDE',
        requireFollow: true,
        requireLike: true,
        leadMagnetId: activeMagnet.id,
        offerId: activeMagnet.linkedOfferId,
        dmTemplate: `Hey {{name}}! Here is the free ${activeMagnet.title} PDF you commented for -> ${smartLink}\n\nLet me know which framework you try first!`,
        active: true,
        sentCount: 0,
        pendingCommenters: [],
        createdAt: new Date().toISOString(),
      };
      await onUpdateStore({ autoDmCampaigns: [newCampaign, ...store.autoDmCampaigns] });
    }
    onCreateGiveawayPost(activeMagnet);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Generator Bar */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            High-Ticket PDF Lead Magnet & Smart Resource Studio (Gamma + Beacon)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate modern, card-styled PDF Playbooks, Swipe Files, and Checklists with your Whop affiliate link embedded inside—plus a hosted mobile Smart Page (<span className="font-mono">/r/slug</span>) for your comment giveaways.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label htmlFor="lm-topic" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Playbook Topic
            </label>
            <input
              id="lm-topic"
              type="text"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="e.g., High-Ticket Objection Rebuttals"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="lm-format" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Format
            </label>
            <select
              id="lm-format"
              value={genFormat}
              onChange={(e) => setGenFormat(e.target.value as LeadMagnet['format'])}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
            >
              <option value="Playbook">Playbook</option>
              <option value="Swipe File">Swipe File</option>
              <option value="Checklist">Checklist</option>
              <option value="Deep-Dive Report">Deep-Dive Report</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="lm-offer" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Embed Whop / Offer CTA
            </label>
            <select
              id="lm-offer"
              value={genOfferId}
              onChange={(e) => setGenOfferId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
            >
              <option value="">No offer attached</option>
              {store.brandBrain.offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.platform})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{generating ? 'Building Playbook...' : 'Generate Lead Magnet'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Library Tabs + Studio Split */}
      {store.leadMagnets.length > 0 && activeMagnet && (
        <div className="space-y-4">
          {/* Magnet Selector Strip */}
          <div className="flex flex-wrap items-center gap-2">
            {store.leadMagnets.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  m.id === activeMagnet.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-600'
                    : 'bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Structured Editor */}
            <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {activeMagnet.views} views · {activeMagnet.downloads} PDF downloads · {activeMagnet.offerClicks} offer clicks
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add Card Section</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="edit-lm-title" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Cover Title
                  </label>
                  <input
                    id="edit-lm-title"
                    type="text"
                    value={activeMagnet.title}
                    onChange={(e) => updateActiveMagnet({ title: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lm-sub" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Subtitle
                  </label>
                  <textarea
                    id="edit-lm-sub"
                    rows={2}
                    value={activeMagnet.subtitle}
                    onChange={(e) => updateActiveMagnet({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-lm-kw" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Giveaway Keyword
                    </label>
                    <input
                      id="edit-lm-kw"
                      type="text"
                      value={activeMagnet.giveawayKeyword}
                      onChange={(e) =>
                        updateActiveMagnet({ giveawayKeyword: e.target.value.toUpperCase() })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono uppercase text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-lm-offer" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Embedded Offer
                    </label>
                    <select
                      id="edit-lm-offer"
                      value={activeMagnet.linkedOfferId || ''}
                      onChange={(e) => updateActiveMagnet({ linkedOfferId: e.target.value || undefined })}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="">None</option>
                      {store.brandBrain.offers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {activeMagnet.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
                        Card 0{idx + 1} · {sec.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id)}
                        aria-label={`Remove section ${sec.heading}`}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      aria-label={`Section ${idx + 1} heading`}
                      value={sec.heading}
                      onChange={(e) => handleUpdateSection(sec.id, { heading: e.target.value })}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-semibold text-slate-900 dark:text-white"
                    />
                    <textarea
                      rows={2}
                      aria-label={`Section ${idx + 1} body`}
                      value={sec.body}
                      onChange={(e) => handleUpdateSection(sec.id, { body: e.target.value })}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                    />
                    <textarea
                      rows={3}
                      aria-label={`Section ${idx + 1} bullet points`}
                      value={sec.bullets.join('\n')}
                      onChange={(e) =>
                        handleUpdateSection(sec.id, {
                          bullets: e.target.value.split('\n').filter((line) => line.trim().length > 0),
                        })
                      }
                      placeholder="One bullet point per line"
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Live Gamma-Style Document & Smart Page Preview + Actions */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold whitespace-nowrap"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download Real PDF</span>
                </button>
                <a
                  href={`/r/${activeMagnet.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold whitespace-nowrap"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span>Open Smart Page</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopySmartLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Link</span>
                </button>
                <button
                  type="button"
                  onClick={handleLaunchGiveawayFunnel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Create Giveaway Post + Auto-DM</span>
                </button>
              </div>

              {/* Live Visual Playbook Preview */}
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
                {/* Cover Preview */}
                <div className="bg-[#0B1120] text-white p-7 space-y-3">
                  <div className="h-1 w-12 bg-sky-500" />
                  <div className="text-xs font-semibold tracking-wider text-sky-400">
                    {activeMagnet.format.toUpperCase()} · {activeMagnet.niche.toUpperCase()}
                  </div>
                  <h3 className="font-display text-2xl font-bold leading-tight text-balance">
                    {activeMagnet.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{activeMagnet.subtitle}</p>
                  <div className="pt-2 text-xs text-slate-400">
                    By {activeMagnet.authorName} ({activeMagnet.authorHandle}) · Smart Link: /r/{activeMagnet.slug}
                  </div>
                </div>

                {/* Card Sections Preview */}
                <div className="p-6 space-y-4 bg-slate-50 dark:bg-[#0F172A]">
                  {activeMagnet.sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className={`rounded-lg border p-4 space-y-2 ${
                        sec.type === 'offer-callout'
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800'
                          : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                        0{idx + 1}. {sec.type.replace('-', ' ').toUpperCase()}
                      </div>
                      <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {sec.heading}
                      </h4>
                      {sec.body && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {sec.body}
                        </p>
                      )}
                      {sec.bullets.length > 0 && (
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200 pt-1">
                          {sec.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2">
                              <span className="text-sky-600 dark:text-sky-400 shrink-0">
                                {sec.type === 'checklist' ? '☐' : '•'}
                              </span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {linkedOffer && (
                    <div className="rounded-lg bg-slate-900 text-white p-5 space-y-2">
                      <div className="text-xs font-semibold text-sky-400">
                        EMBEDDED MONETIZATION CTA · {linkedOffer.platform.toUpperCase()}
                      </div>
                      <div className="font-display text-base font-bold">
                        {linkedOffer.name} ({linkedOffer.priceLabel})
                      </div>
                      <p className="text-xs text-slate-300">{linkedOffer.promise}</p>
                      <div className="pt-1 text-xs font-semibold text-sky-400">
                        Tracked redirect: /r/{activeMagnet.slug}/go →
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
