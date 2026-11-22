import React, { useState } from 'react';
import { Plus, Save, Trash2, ExternalLink } from 'lucide-react';
import type { BrandBrain, GhostPilotStore, MonetizationOffer } from '../lib/types';

interface BrandVaultViewProps {
  store: GhostPilotStore;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

const NICHE_PRESETS = [
  {
    niche: 'High-Ticket Sales',
    subreddits: ['sales', 'entrepreneur', 'SaaS'],
    tone: 'Direct, tactical, zero-fluff authority — speaks like an operator sharing real call notes.',
  },
  {
    niche: 'AI Tools & GitHub Automation',
    subreddits: ['LocalLLaMA', 'SideProject', 'artificial'],
    tone: 'Curious builder & open-source curator — crisp technical takeaways, zero hype.',
  },
  {
    niche: 'Real Estate Investing',
    subreddits: ['realestateinvesting', 'RealEstate', 'Landlord'],
    tone: 'Calm, numbers-first investor sharing real deal math and avoidable pitfalls.',
  },
  {
    niche: 'Whop Digital Products & Creator Business',
    subreddits: ['Entrepreneur', 'digitalmarketing', 'passive_income'],
    tone: 'Transparent indie creator breaking down free-to-paid funnels and conversion math.',
  },
];

export function BrandVaultView({ store, onUpdateStore, onNotify }: BrandVaultViewProps) {
  const [brain, setBrain] = useState<BrandBrain>(store.brandBrain);
  const [newOfferName, setNewOfferName] = useState('');
  const [newOfferPlatform, setNewOfferPlatform] = useState<MonetizationOffer['platform']>('Whop');
  const [newOfferUrl, setNewOfferUrl] = useState('');
  const [newOfferPrice, setNewOfferPrice] = useState('');
  const [newOfferPromise, setNewOfferPromise] = useState('');
  const [newOfferKeyword, setNewOfferKeyword] = useState('');

  const handleSaveBrand = async () => {
    await onUpdateStore({ brandBrain: brain });
    onNotify('Brand Brain & Offer Vault saved — all 5 engines now use your updated voice and offers.');
  };

  const handleApplyPreset = (preset: (typeof NICHE_PRESETS)[number]) => {
    setBrain((prev) => ({
      ...prev,
      niche: preset.niche,
      subreddits: preset.subreddits,
      tone: preset.tone,
    }));
  };

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfferName.trim() || !newOfferUrl.trim()) {
      onNotify('Please enter both an Offer Name and URL.', 'error');
      return;
    }

    const cleanKw = (newOfferKeyword.trim() || 'GUIDE').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const offer: MonetizationOffer = {
      id: `offer-${Date.now()}`,
      name: newOfferName.trim(),
      platform: newOfferPlatform,
      url: newOfferUrl.trim(),
      priceLabel: newOfferPrice.trim() || 'Free / Affiliate',
      promise: newOfferPromise.trim() || `High-value resource for ${brain.niche}.`,
      autoPlugTemplate: `Want the complete step-by-step system? Check out ${newOfferName.trim()} here -> ${newOfferUrl.trim()}`,
      giveawayKeyword: cleanKw,
      clicks: 0,
      leads: 0,
      estimatedRevenue: 0,
    };

    const updatedBrain = { ...brain, offers: [offer, ...brain.offers] };
    setBrain(updatedBrain);
    await onUpdateStore({ brandBrain: updatedBrain });

    setNewOfferName('');
    setNewOfferUrl('');
    setNewOfferPrice('');
    setNewOfferPromise('');
    setNewOfferKeyword('');
    onNotify(`Added "${offer.name}" to your Offer Vault.`);
  };

  const handleDeleteOffer = async (id: string) => {
    const updatedBrain = { ...brain, offers: brain.offers.filter((o) => o.id !== id) };
    setBrain(updatedBrain);
    await onUpdateStore({ brandBrain: updatedBrain });
    onNotify('Offer removed from vault.');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Brand Brain & Copy Intelligence
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Set your niche, voice, and banned AI clichés once. Both Antigravity (Gemini 3.8 Flash) and the 0–100 Copy Scorer read this automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveBrand}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>Save Brand Brain</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
            Quick Niche Preset:
          </span>
          {NICHE_PRESETS.map((preset) => (
            <button
              key={preset.niche}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                brain.niche === preset.niche
                  ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/40 dark:text-sky-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {preset.niche}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="brand-niche" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Industry / Niche
            </label>
            <input
              id="brand-niche"
              type="text"
              value={brain.niche}
              onChange={(e) => setBrain({ ...brain, niche: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label htmlFor="brand-subreddits" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Subreddits to Mine for Buyer Pain Points (comma-separated)
            </label>
            <input
              id="brand-subreddits"
              type="text"
              value={brain.subreddits.join(', ')}
              onChange={(e) =>
                setBrain({
                  ...brain,
                  subreddits: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label htmlFor="brand-tone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Authority Voice & Tone
            </label>
            <textarea
              id="brand-tone"
              rows={3}
              value={brain.tone}
              onChange={(e) => setBrain({ ...brain, tone: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label htmlFor="brand-cliches" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Banned Robotic AI Clichés (auto-penalized by Copy Scorer)
            </label>
            <textarea
              id="brand-cliches"
              rows={3}
              value={brain.bannedCliches.join(', ')}
              onChange={(e) =>
                setBrain({
                  ...brain,
                  bannedCliches: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Active Audience Persona (Used by Anyword Predictive Scorer)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {brain.personas.map((persona) => {
              const selected = brain.activePersonaId === persona.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => setBrain({ ...brain, activePersonaId: persona.id })}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    selected
                      ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white">
                    <span>{persona.name}</span>
                    {selected && (
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{persona.role}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                    Buyer keywords: {persona.keywords.join(' · ')}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Monetization & Whop Offer Vault
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add your Whop affiliate links, digital products, or courses here. GhostPilot embeds them automatically inside your free PDF Playbooks, Auto-Plugs, and Giveaway DM funnels.
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          {brain.offers.map((offer) => (
            <div
              key={offer.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#111827]"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-sky-600 dark:text-sky-400">{offer.platform}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{offer.priceLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Keyword: {offer.giveawayKeyword}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {offer.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">{offer.promise}</p>
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline break-all"
                >
                  <span>{offer.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              </div>

              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right font-mono text-xs tabular-nums">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {offer.clicks} clicks · {offer.leads} leads
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400">
                    ${offer.estimatedRevenue.toLocaleString()} est.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteOffer(offer.id)}
                  aria-label={`Delete offer ${offer.name}`}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddOffer} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Add New Whop Course, Affiliate Link, or Digital Product
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="offer-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Offer Name
              </label>
              <input
                id="offer-name"
                type="text"
                placeholder="e.g., Remote Closing Academy (Whop)"
                value={newOfferName}
                onChange={(e) => setNewOfferName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="offer-platform" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Platform
              </label>
              <select
                id="offer-platform"
                value={newOfferPlatform}
                onChange={(e) => setNewOfferPlatform(e.target.value as MonetizationOffer['platform'])}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="Whop">Whop</option>
                <option value="Gumroad">Gumroad</option>
                <option value="Affiliate">Affiliate</option>
                <option value="Direct">Direct Product</option>
                <option value="Newsletter">Newsletter</option>
              </select>
            </div>

            <div>
              <label htmlFor="offer-price" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Price / Commission Label
              </label>
              <input
                id="offer-price"
                type="text"
                placeholder="e.g., $97/mo · 40% Affiliate"
                value={newOfferPrice}
                onChange={(e) => setNewOfferPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="offer-url" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Affiliate or Product URL
              </label>
              <input
                id="offer-url"
                type="url"
                placeholder="https://whop.com/..."
                value={newOfferUrl}
                onChange={(e) => setNewOfferUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="offer-keyword" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Giveaway Comment Keyword
              </label>
              <input
                id="offer-keyword"
                type="text"
                placeholder="e.g., CLOSE"
                value={newOfferKeyword}
                onChange={(e) => setNewOfferKeyword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono uppercase"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="offer-promise" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Core Promise (Embedded in your free PDF Playbooks & Auto-Plugs)
              </label>
              <input
                id="offer-promise"
                type="text"
                placeholder="What concrete result does this course/product deliver?"
                value={newOfferPromise}
                onChange={(e) => setNewOfferPromise(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Offer to Vault</span>
          </button>
        </form>
      </section>
    </div>
  );
}
