import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import {
  BUYER_GOALS,
  MARKET_NICHE_CATALOG,
  buildAccountBrandBrainFromNiche,
  getNicheCatalogStats,
} from '../lib/nicheCatalog';
import type { AccountNicheProfile, AccountProfile, BrandBrain } from '../lib/types';

interface NicheLockdownWizardProps {
  account: AccountProfile;
  canDismiss: boolean;
  onCancel?: () => void;
  onComplete: (result: {
    brandBrain: BrandBrain;
    nicheProfile: AccountNicheProfile;
    accountName?: string;
    accountHandle?: string;
  }) => Promise<void>;
}

export function NicheLockdownWizard({
  account,
  canDismiss,
  onCancel,
  onComplete,
}: NicheLockdownWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [marketId, setMarketId] = useState<string>(account.nicheProfile?.marketId || '');
  const [subNicheId, setSubNicheId] = useState<string>(account.nicheProfile?.subNicheId || '');
  const [microAngle, setMicroAngle] = useState<string>(account.nicheProfile?.microAngle || '');
  const [customAngle, setCustomAngle] = useState<string>('');
  const [buyerGoal, setBuyerGoal] = useState<string>(
    account.nicheProfile?.buyerGoal || BUYER_GOALS[0]
  );

  const [offerName, setOfferName] = useState('');
  const [offerUrl, setOfferUrl] = useState('');
  const [offerPrice, setOfferPrice] = useState('$49');
  const [giveawayKeyword, setGiveawayKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => getNicheCatalogStats(), []);

  const filteredMarkets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MARKET_NICHE_CATALOG;
    return MARKET_NICHE_CATALOG.filter((m) => {
      if (m.name.toLowerCase().includes(q) || m.tagline.toLowerCase().includes(q)) return true;
      return m.subNiches.some(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.microAngles.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [search]);

  const selectedMarket = useMemo(
    () => MARKET_NICHE_CATALOG.find((m) => m.id === marketId),
    [marketId]
  );

  const selectedSubNiche = useMemo(
    () => selectedMarket?.subNiches.find((s) => s.id === subNicheId),
    [selectedMarket, subNicheId]
  );

  const effectiveAngle = customAngle.trim() || microAngle;

  const handleSelectMarket = (id: string) => {
    setMarketId(id);
    setSubNicheId('');
    setMicroAngle('');
    setCustomAngle('');
    setStep(2);
  };

  const handleSelectSubNiche = (id: string) => {
    setSubNicheId(id);
    const sub = selectedMarket?.subNiches.find((s) => s.id === id);
    if (sub) {
      setMicroAngle(sub.microAngles[0] || '');
      setGiveawayKeyword(sub.defaultKeyword);
    }
    setStep(3);
  };

  const handleLockNiche = async () => {
    if (!marketId || !subNicheId || !effectiveAngle) return;
    setSaving(true);
    try {
      const built = buildAccountBrandBrainFromNiche({
        marketId,
        subNicheId,
        microAngle: effectiveAngle,
        buyerGoal,
        offerName: offerName.trim() || undefined,
        offerUrl: offerUrl.trim() || undefined,
        offerPrice: offerPrice.trim() || undefined,
        giveawayKeyword: giveawayKeyword.trim() || undefined,
      });
      await onComplete(built);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="niche-wizard-title"
    >
      <div className="w-full max-w-4xl rounded-[24px] border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#161618]/95 backdrop-blur-2xl shadow-[0_32px_96px_-16px_rgba(0,0,0,0.35)] overflow-hidden my-auto">
        {/* Header */}
        <div className="px-7 py-6 border-b border-black/[0.06] dark:border-white/[0.08] flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Per-Account Niche Lockdown · {account.name} ({account.handle})
              </span>
            </div>
            <h2
              id="niche-wizard-title"
              className="font-display text-2xl font-bold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]"
            >
              {step === 1 && 'Step 1 of 3 — Choose Your Main Market'}
              {step === 2 && `Step 2 of 3 — Drill Down Inside ${selectedMarket?.name}`}
              {step === 3 && 'Step 3 of 3 — Lock Your Exact Micro-Focus & Goal'}
            </h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#86868B]">
              Locks {account.handle} to one sharp niche across radar, copy scoring, PDFs, carousels, and queue ({stats.markets} markets · {stats.subNiches} sub-niches · {stats.microAngles} micro-angles).
            </p>
          </div>
          {canDismiss && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close niche setup"
              className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Apple Step Strip */}
        <div className="px-7 py-3 bg-[#F5F5F7]/70 dark:bg-white/[0.03] border-b border-black/[0.05] dark:border-white/[0.07] flex items-center gap-6 text-xs">
          {[
            { num: 1, label: '1. Main Market' },
            { num: 2, label: '2. Sub-Niche' },
            { num: 3, label: '3. Micro-Focus & Lock' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 font-medium ${
                step === s.num
                  ? 'text-[#0071E3] dark:text-[#0A84FF] font-semibold'
                  : step > s.num
                    ? 'text-[#16A34A] dark:text-[#30D158]'
                    : 'text-[#86868B]'
              }`}
            >
              {step > s.num && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-7 max-h-[62vh] overflow-y-auto space-y-5">
          {step === 1 && (
            <>
              <div className="relative">
                <Search
                  className="h-4 w-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search any market or sub-niche (e.g., Real Estate, Fitness, Whop, Crypto, AI, Sales, Cooking)..."
                  className="apple-input pl-10 h-11"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMarkets.map((market) => (
                  <button
                    key={market.id}
                    type="button"
                    onClick={() => handleSelectMarket(market.id)}
                    className={`group text-left rounded-[16px] p-4 transition-all ${
                      marketId === market.id
                        ? 'bg-[#0071E3]/[0.07] dark:bg-[#0A84FF]/15 ring-2 ring-[#0071E3] dark:ring-[#0A84FF]'
                        : 'bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBF0] dark:hover:bg-[#242426]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {market.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#86868B] group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 text-xs text-[#6E6E73] dark:text-[#86868B] leading-relaxed">
                      {market.tagline}
                    </p>
                    <div className="mt-2.5 text-[11px] font-mono text-[#0071E3] dark:text-[#0A84FF]">
                      {market.subNiches.length} deep sub-niches
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && selectedMarket && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {selectedMarket.subNiches.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectSubNiche(sub.id)}
                  className={`group text-left rounded-[16px] p-5 space-y-2 transition-all ${
                    subNicheId === sub.id
                      ? 'bg-[#0071E3]/[0.07] dark:bg-[#0A84FF]/15 ring-2 ring-[#0071E3] dark:ring-[#0A84FF]'
                      : 'bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBF0] dark:hover:bg-[#242426]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {sub.name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF] group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
                  </div>
                  <div className="text-xs text-[#515154] dark:text-[#A1A1A6]">
                    Buyer: {sub.buyerRole}
                  </div>
                  <div className="text-[11px] font-mono text-[#86868B]">
                    Live $0 Sources: {sub.subreddits.map((r) => `r/${r}`).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 3 && selectedMarket && selectedSubNiche && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  1. Pick Your Exact Micro-Angle Inside {selectedSubNiche.name}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedSubNiche.microAngles.map((angle) => {
                    const active = !customAngle.trim() && microAngle === angle;
                    return (
                      <button
                        key={angle}
                        type="button"
                        onClick={() => {
                          setMicroAngle(angle);
                          setCustomAngle('');
                        }}
                        className={`text-left rounded-[12px] px-4 py-3 text-xs font-medium transition-all ${
                          active
                            ? 'bg-[#0071E3]/[0.08] dark:bg-[#0A84FF]/20 text-[#0071E3] dark:text-[#2997FF] ring-2 ring-[#0071E3] dark:ring-[#0A84FF]'
                            : 'bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#D1D1D6] hover:bg-[#EBEBF0] dark:hover:bg-[#242426]'
                        }`}
                      >
                        {angle}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={customAngle}
                  onChange={(e) => setCustomAngle(e.target.value)}
                  placeholder="Or type your own ultra-specific micro-angle..."
                  className="apple-input text-xs"
                />
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  2. How Will {account.handle} Make Money?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUYER_GOALS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setBuyerGoal(goal)}
                      className={`text-left rounded-[12px] px-3.5 py-2.5 text-xs font-medium transition-all ${
                        buyerGoal === goal
                          ? 'bg-[#0071E3]/[0.08] dark:bg-[#0A84FF]/20 text-[#0071E3] dark:text-[#2997FF] ring-2 ring-[#0071E3] dark:ring-[#0A84FF]'
                          : 'bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[#515154] dark:text-[#A1A1A6] hover:bg-[#EBEBF0] dark:hover:bg-[#242426]'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="apple-subsurface p-4 space-y-3">
                <div className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  3. Optional: Attach Your Whop / Affiliate / Product Link (Auto-Wired into PDFs & Auto-Plugs)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    value={offerName}
                    onChange={(e) => setOfferName(e.target.value)}
                    placeholder={`Offer name (e.g., ${selectedSubNiche.name} Course)`}
                    className="sm:col-span-4 rounded-[10px] bg-white dark:bg-[#161618] border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 text-xs text-[#1D1D1F] dark:text-[#F5F5F7]"
                  />
                  <input
                    type="url"
                    value={offerUrl}
                    onChange={(e) => setOfferUrl(e.target.value)}
                    placeholder="https://whop.com/your-link"
                    className="sm:col-span-4 rounded-[10px] bg-white dark:bg-[#161618] border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 text-xs text-[#1D1D1F] dark:text-[#F5F5F7]"
                  />
                  <input
                    type="text"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder="$49"
                    className="sm:col-span-2 rounded-[10px] bg-white dark:bg-[#161618] border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 text-xs font-mono text-[#1D1D1F] dark:text-[#F5F5F7]"
                  />
                  <input
                    type="text"
                    value={giveawayKeyword}
                    onChange={(e) => setGiveawayKeyword(e.target.value.toUpperCase())}
                    placeholder="KEYWORD"
                    className="sm:col-span-2 rounded-[10px] bg-white dark:bg-[#161618] border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 text-xs font-mono text-[#1D1D1F] dark:text-[#F5F5F7]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7]/70 dark:bg-white/[0.02] flex items-center justify-between gap-3">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="apple-btn-secondary px-4 py-2 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 3 && (
              <button
                type="button"
                disabled={saving || !effectiveAngle}
                onClick={handleLockNiche}
                className="apple-btn-primary px-6 py-2.5 text-sm"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>
                  {saving ? 'Locking Niche...' : `Lock Deep Niche for ${account.handle}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
