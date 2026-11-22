import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Layers, Plus, Send, Trash2 } from 'lucide-react';
import {
  CAROUSEL_THEMES,
  downloadDataUrl,
  renderSlideToPngDataUrl,
} from '../lib/carouselCanvas';
import type {
  CarouselDeck,
  CarouselSlide,
  CarouselSlideLayout,
  CarouselThemeId,
  GhostPilotStore,
} from '../lib/types';

interface CarouselStudioViewProps {
  store: GhostPilotStore;
  onUpdateStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onAttachCarouselToPost: (deck: CarouselDeck) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function CarouselStudioView({
  store,
  onUpdateStore,
  onAttachCarouselToPost,
  onNotify,
}: CarouselStudioViewProps) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(store.carousels[0]?.id || '');
  const [slideIdx, setSlideIdx] = useState(0);

  const activeDeck =
    store.carousels.find((c) => c.id === selectedDeckId) || store.carousels[0];
  const safeSlideIdx = activeDeck
    ? Math.min(slideIdx, Math.max(0, activeDeck.slides.length - 1))
    : 0;
  const activeSlide = activeDeck?.slides[safeSlideIdx];
  const theme = CAROUSEL_THEMES[activeDeck?.themeId || 'obsidian'];

  const updateActiveDeck = async (patch: Partial<CarouselDeck>) => {
    if (!activeDeck) return;
    const next = store.carousels.map((c) =>
      c.id === activeDeck.id ? { ...c, ...patch } : c
    );
    await onUpdateStore({ carousels: next });
  };

  const updateActiveSlide = async (patch: Partial<CarouselSlide>) => {
    if (!activeDeck || !activeSlide) return;
    const slides = activeDeck.slides.map((s, idx) =>
      idx === safeSlideIdx ? { ...s, ...patch } : s
    );
    await updateActiveDeck({ slides });
  };

  const handleNewDeck = async () => {
    const activeAccount =
      store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    const offer = store.brandBrain.offers[0];
    const deck: CarouselDeck = {
      id: `car-${Date.now()}`,
      title: `${store.brandBrain.niche} Authority Carousel`,
      themeId: 'obsidian',
      authorName: activeAccount.name,
      authorHandle: activeAccount.handle,
      linkedOfferId: offer?.id,
      createdAt: new Date().toISOString(),
      slides: [
        {
          id: `sl-${Date.now()}-1`,
          layout: 'cover',
          eyebrow: store.brandBrain.niche.toUpperCase(),
          headline: `The 3-Step ${store.brandBrain.niche} System Nobody Teaches`,
          body: 'Swipe through the exact breakdown top 1% operators run every week.',
          bullets: [],
        },
        {
          id: `sl-${Date.now()}-2`,
          layout: 'framework',
          eyebrow: 'THE SYSTEM',
          headline: 'Follow These 3 Non-Negotiable Steps',
          body: 'Cut out the guesswork and execute in sequence:',
          bullets: [
            'Diagnose the #1 costly bottleneck first',
            'Apply one proven framework instead of 10 random hacks',
            'Package your solution into a repeatable checklist',
          ],
        },
        {
          id: `sl-${Date.now()}-3`,
          layout: 'cta',
          eyebrow: 'FREE PDF PLAYBOOK',
          headline: `Comment "${offer?.giveawayKeyword || 'GUIDE'}" For The Full Playbook`,
          body: 'I put every script and checklist into a clean PDF — drop a comment and I will DM it free.',
          bullets: ['Zero fluff, ready to copy today'],
        },
      ],
    };
    await onUpdateStore({ carousels: [deck, ...store.carousels] });
    setSelectedDeckId(deck.id);
    setSlideIdx(0);
    onNotify('Created new 3-slide visual carousel deck.');
  };

  const handleAddSlide = async () => {
    if (!activeDeck) return;
    const nextSlide: CarouselSlide = {
      id: `sl-${Date.now()}`,
      layout: 'framework',
      eyebrow: `INSIGHT 0${activeDeck.slides.length}`,
      headline: 'Key Tactical Breakdown',
      body: 'Keep each slide focused on one unmistakable idea.',
      bullets: ['Actionable point 1', 'Actionable point 2'],
    };
    await updateActiveDeck({ slides: [...activeDeck.slides, nextSlide] });
    setSlideIdx(activeDeck.slides.length);
  };

  const handleDeleteSlide = async () => {
    if (!activeDeck || activeDeck.slides.length <= 1) return;
    const slides = activeDeck.slides.filter((_, idx) => idx !== safeSlideIdx);
    await updateActiveDeck({ slides });
    setSlideIdx(Math.max(0, safeSlideIdx - 1));
  };

  const handleDownloadCurrentPng = () => {
    if (!activeDeck || !activeSlide) return;
    const url = renderSlideToPngDataUrl(activeDeck, activeSlide, safeSlideIdx, activeDeck.slides.length);
    downloadDataUrl(url, `${activeDeck.id}-slide-${safeSlideIdx + 1}.png`);
    onNotify(`Exported high-res 1080×1350 PNG for Slide ${safeSlideIdx + 1}.`);
  };

  const handleDownloadAllPngs = () => {
    if (!activeDeck) return;
    activeDeck.slides.forEach((slide, idx) => {
      const url = renderSlideToPngDataUrl(activeDeck, slide, idx, activeDeck.slides.length);
      setTimeout(() => {
        downloadDataUrl(url, `${activeDeck.id}-slide-${idx + 1}.png`);
      }, idx * 180);
    });
    onNotify(`Exporting all ${activeDeck.slides.length} crisp 1080×1350 PNG slides.`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Bar Controls */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Automated Visual Carousel Studio (PostNitro Style)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Design scroll-stopping 1080×1350 swipeable X carousels in seconds — editable manually or generated on autopilot by Antigravity (Gemini 3.8 Flash).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleNewDeck}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Carousel</span>
          </button>
          {activeDeck && (
            <button
              type="button"
              onClick={handleDownloadAllPngs}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold whitespace-nowrap"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Export All Slides (PNG)</span>
            </button>
          )}
        </div>
      </section>

      {/* Deck Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {store.carousels.map((deck) => (
          <button
            key={deck.id}
            type="button"
            onClick={() => {
              setSelectedDeckId(deck.id);
              setSlideIdx(0);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              deck.id === activeDeck?.id
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-600'
                : 'bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {deck.title} ({deck.slides.length} slides)
          </button>
        ))}
      </div>

      {activeDeck && activeSlide && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Slide Editor */}
          <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="car-title" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Carousel Title
                </label>
                <input
                  id="car-title"
                  type="text"
                  value={activeDeck.title}
                  onChange={(e) => updateActiveDeck({ title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="car-theme" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Studio Brand Theme
                </label>
                <select
                  id="car-theme"
                  value={activeDeck.themeId}
                  onChange={(e) => updateActiveDeck({ themeId: e.target.value as CarouselThemeId })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {Object.values(CAROUSEL_THEMES).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Slide Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                {activeDeck.slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlideIdx(idx)}
                    className={`px-2.5 py-1 rounded-md font-mono text-xs font-semibold transition-colors ${
                      idx === safeSlideIdx
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    0{idx + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAddSlide}
                  aria-label="Add slide"
                  className="px-2.5 py-1 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  + Slide
                </button>
              </div>

              {activeDeck.slides.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteSlide}
                  aria-label="Delete current slide"
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete Slide</span>
                </button>
              )}
            </div>

            {/* Current Slide Fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sl-layout" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Slide Layout
                  </label>
                  <select
                    id="sl-layout"
                    value={activeSlide.layout}
                    onChange={(e) =>
                      updateActiveSlide({ layout: e.target.value as CarouselSlideLayout })
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="cover">Cover Hook</option>
                    <option value="framework">Numbered Framework</option>
                    <option value="checklist">Checklist</option>
                    <option value="comparison">Old Way vs S-Tier Way</option>
                    <option value="quote">Authority Quote</option>
                    <option value="cta">Giveaway / Offer CTA</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sl-eyebrow" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Eyebrow Kicker
                  </label>
                  <input
                    id="sl-eyebrow"
                    type="text"
                    value={activeSlide.eyebrow}
                    onChange={(e) => updateActiveSlide({ eyebrow: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sl-headline" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Slide Headline
                </label>
                <input
                  id="sl-headline"
                  type="text"
                  value={activeSlide.headline}
                  onChange={(e) => updateActiveSlide({ headline: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="sl-body" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Supporting Copy
                </label>
                <textarea
                  id="sl-body"
                  rows={2}
                  value={activeSlide.body}
                  onChange={(e) => updateActiveSlide({ body: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="sl-bullets" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Bullet Points / Comparison Columns (one per line)
                </label>
                <textarea
                  id="sl-bullets"
                  rows={4}
                  value={activeSlide.bullets.join('\n')}
                  onChange={(e) =>
                    updateActiveSlide({
                      bullets: e.target.value.split('\n').filter((line) => line.trim().length > 0),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDownloadCurrentPng}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download Slide {safeSlideIdx + 1} PNG</span>
              </button>
              <button
                type="button"
                onClick={() => onAttachCarouselToPost(activeDeck)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-700 text-white text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Send Carousel to X Composer</span>
              </button>
            </div>
          </div>

          {/* Right: Live 4:5 Portrait Slide Visual Preview */}
          <div className="lg:col-span-6 flex flex-col items-center space-y-4">
            <div
              className="w-full max-w-[440px] aspect-[4/5] rounded-xl p-8 flex flex-col justify-between border shadow-sm transition-colors"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                borderColor: theme.border,
              }}
            >
              {/* Top Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-1 w-10" style={{ backgroundColor: theme.accent }} />
                    <div
                      className="text-[11px] font-bold tracking-widest uppercase"
                      style={{ color: theme.accent }}
                    >
                      {activeSlide.eyebrow || `SLIDE ${safeSlideIdx + 1}`}
                    </div>
                  </div>
                  <div className="font-mono text-xs tabular-nums" style={{ color: theme.muted }}>
                    {String(safeSlideIdx + 1).padStart(2, '0')} / {String(activeDeck.slides.length).padStart(2, '0')}
                  </div>
                </div>

                <h3
                  className={`font-display font-bold leading-tight ${
                    activeSlide.layout === 'cover' ? 'text-3xl pt-4' : 'text-2xl'
                  }`}
                >
                  {activeSlide.headline}
                </h3>

                {activeSlide.body && (
                  <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>
                    {activeSlide.body}
                  </p>
                )}

                {activeSlide.layout === 'comparison' && activeSlide.bullets.length >= 2 ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div
                      className="rounded-lg p-3.5 border text-xs space-y-1.5"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      <div className="font-bold tracking-wider" style={{ color: theme.muted }}>
                        {activeSlide.leftLabel || 'OLD WAY'}
                      </div>
                      <p className="leading-relaxed">{activeSlide.bullets[0]}</p>
                    </div>
                    <div
                      className="rounded-lg p-3.5 border text-xs space-y-1.5"
                      style={{ backgroundColor: theme.surface, borderColor: theme.accent }}
                    >
                      <div className="font-bold tracking-wider" style={{ color: theme.accent }}>
                        {activeSlide.rightLabel || 'S-TIER WAY'}
                      </div>
                      <p className="leading-relaxed">{activeSlide.bullets[1]}</p>
                    </div>
                  </div>
                ) : (
                  activeSlide.bullets.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {activeSlide.bullets.slice(0, 4).map((b, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg px-3.5 py-2.5 border text-xs flex items-start gap-2.5"
                          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                          <span className="font-mono font-bold shrink-0" style={{ color: theme.accent }}>
                            {activeSlide.layout === 'checklist' ? '✓' : `0${idx + 1}`}
                          </span>
                          <span className="leading-snug">{b}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Author Footer */}
              <div
                className="pt-4 border-t flex items-center justify-between text-xs"
                style={{ borderColor: theme.border }}
              >
                <div>
                  <div className="font-display font-bold">{activeDeck.authorName}</div>
                  <div className="font-mono text-[11px]" style={{ color: theme.muted }}>
                    {activeDeck.authorHandle}
                  </div>
                </div>
                <div className="font-display font-bold text-[11px] tracking-wider" style={{ color: theme.accent }}>
                  {safeSlideIdx < activeDeck.slides.length - 1 ? 'SWIPE →' : 'BOOKMARK'}
                </div>
              </div>
            </div>

            {/* Prev / Next Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={safeSlideIdx === 0}
                onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                aria-label="Previous slide"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                Slide {safeSlideIdx + 1} of {activeDeck.slides.length}
              </span>
              <button
                type="button"
                disabled={safeSlideIdx >= activeDeck.slides.length - 1}
                onClick={() => setSlideIdx((i) => Math.min(activeDeck.slides.length - 1, i + 1))}
                aria-label="Next slide"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!activeDeck && (
        <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <Layers className="h-6 w-6 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm text-slate-500">No carousel decks yet.</p>
          <button
            type="button"
            onClick={handleNewDeck}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold"
          >
            Create First Carousel
          </button>
        </div>
      )}
    </div>
  );
}
