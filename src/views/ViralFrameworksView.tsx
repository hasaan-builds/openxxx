import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Flame,
  Plus,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { COPY_FRAMEWORKS } from '../lib/frameworks';
import type {
  CopyFramework,
  GhostPilotStore,
  PsychologicalTrigger,
  ViralTweet,
} from '../lib/types';

interface ViralFrameworksViewProps {
  store: GhostPilotStore;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onRemixTweet: (tweet: ViralTweet) => void;
  onUseFramework: (framework: CopyFramework) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function ViralFrameworksView({
  store,
  onSaveStore,
  onRemixTweet,
  onUseFramework,
  onNotify,
}: ViralFrameworksViewProps) {
  const [tab, setTab] = useState<'library' | 'daily' | 'staff' | 'collections' | 'frameworks'>('library');
  const [search, setSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState('All');
  const [minLikes, setMinLikes] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    store.collections[0]?.id || ''
  );
  const [newCollectionName, setNewCollectionName] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<'All' | PsychologicalTrigger>('All');

  const niches = useMemo(() => {
    const set = new Set(store.viralTweets.map((t) => t.niche));
    return ['All', ...Array.from(set)];
  }, [store.viralTweets]);

  const filteredTweets = useMemo(() => {
    return store.viralTweets.filter((t) => {
      if (tab === 'daily' && !t.isDailyInspiration) return false;
      if (tab === 'staff' && !t.isStaffPick) return false;
      if (tab === 'collections' && selectedCollectionId && !t.collectionIds.includes(selectedCollectionId)) {
        return false;
      }
      if (nicheFilter !== 'All' && t.niche !== nicheFilter) return false;
      if (t.likes < minLikes) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${t.text} ${t.authorName} ${t.authorHandle} ${t.hookFormula} ${t.niche}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [store.viralTweets, tab, selectedCollectionId, nicheFilter, minLikes, search]);

  const filteredFrameworks = useMemo(() => {
    return COPY_FRAMEWORKS.filter((fw) => {
      if (triggerFilter !== 'All' && fw.trigger !== triggerFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return `${fw.name} ${fw.origin} ${fw.whenToUse} ${fw.skeleton}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [triggerFilter, search]);

  const handleToggleCollection = async (tweetId: string, collectionId: string) => {
    const nextTweets = store.viralTweets.map((t) => {
      if (t.id !== tweetId) return t;
      const has = t.collectionIds.includes(collectionId);
      return {
        ...t,
        collectionIds: has
          ? t.collectionIds.filter((c) => c !== collectionId)
          : [...t.collectionIds, collectionId],
      };
    });
    await onSaveStore({ viralTweets: nextTweets });
    onNotify('Updated saved collection.');
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    const col = {
      id: `col-${Date.now()}`,
      name: newCollectionName.trim(),
      description: 'Saved swipe-file inspiration',
    };
    await onSaveStore({ collections: [...store.collections, col] });
    setSelectedCollectionId(col.id);
    setNewCollectionName('');
    onNotify(`Created collection "${col.name}".`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Viral Library & Copy Frameworks
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Reverse-engineered viral winners, outlier scores, TweetHunter collections, and 12 persuasion frameworks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1">
          {(
            [
              { id: 'library', label: 'Viral Library' },
              { id: 'daily', label: 'Daily Inspiration' },
              { id: 'staff', label: 'Staff Picks' },
              { id: 'collections', label: 'Collections' },
              { id: 'frameworks', label: `Frameworks (${COPY_FRAMEWORKS.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'frameworks'
                ? 'Search copywriting frameworks...'
                : 'Search viral tweets, hooks, creators...'
            }
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          />
        </div>

        {tab !== 'frameworks' ? (
          <>
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
            >
              {niches.map((n) => (
                <option key={n} value={n}>
                  Niche: {n}
                </option>
              ))}
            </select>
            <select
              value={minLikes}
              onChange={(e) => setMinLikes(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
            >
              <option value={0}>Any likes</option>
              <option value={500}>500+ likes</option>
              <option value={1500}>1,500+ likes</option>
              <option value={3000}>3,000+ likes</option>
            </select>
          </>
        ) : (
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value as 'All' | PsychologicalTrigger)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Psychological Triggers</option>
            <option value="Hormozi Value Equation">Hormozi Value Equation</option>
            <option value="Loss Aversion">Loss Aversion</option>
            <option value="Contrarian Proof">Contrarian Proof</option>
            <option value="Curiosity Gap">Curiosity Gap</option>
            <option value="Pattern Interrupt">Pattern Interrupt</option>
            <option value="Step-by-Step Playbook">Step-by-Step Playbook</option>
            <option value="Social Proof & Case Study">Social Proof & Case Study</option>
            <option value="Identity Callout">Identity Callout</option>
          </select>
        )}
      </div>

      {/* Collections Sub-bar */}
      {tab === 'collections' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {store.collections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setSelectedCollectionId(col.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  selectedCollectionId === col.id
                    ? 'border-sky-600 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {col.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="New collection name..."
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleCreateCollection}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create</span>
            </button>
          </div>
        </div>
      )}

      {/* VIRAL TWEETS GRID */}
      {tab !== 'frameworks' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredTweets.length === 0 ? (
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No viral tweets match those filters.
            </div>
          ) : (
            filteredTweets.map((tweet) => {
              const targetColId = selectedCollectionId || store.collections[0]?.id;
              const isSaved = targetColId ? tweet.collectionIds.includes(targetColId) : false;
              return (
                <article
                  key={tweet.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={tweet.authorAvatar}
                          alt={tweet.authorName}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {tweet.authorName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {tweet.authorHandle} · {tweet.niche}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs shrink-0 tabular-nums">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                          {tweet.outlierMultiplier.toFixed(1)}x outlier
                        </div>
                        {tweet.isStaffPick && (
                          <div className="text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1 mt-0.5">
                            <Star className="h-3 w-3" aria-hidden="true" />
                            Staff Pick
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
                      {tweet.text}
                    </p>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Why it went viral:
                        </span>{' '}
                        {tweet.anatomyNotes}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        Formula: {tweet.hookFormula} · Trigger: {tweet.trigger}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {tweet.likes.toLocaleString()} likes · {tweet.retweets.toLocaleString()} RTs ·{' '}
                      {tweet.bookmarks.toLocaleString()} saves
                    </div>
                    <div className="flex items-center gap-2">
                      {targetColId && (
                        <button
                          type="button"
                          onClick={() => handleToggleCollection(tweet.id, targetColId)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                            isSaved
                              ? 'border-sky-600 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{isSaved ? 'Saved' : 'Save'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemixTweet(tweet)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remix in Copy Lab</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : (
        /* 12 COPYWRITING FRAMEWORKS */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredFrameworks.map((fw) => (
            <article
              key={fw.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {fw.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {fw.category} · {fw.trigger} · {fw.origin}
                    </div>
                  </div>
                  <BookOpen className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">{fw.whenToUse}</p>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {fw.skeleton}
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onUseFramework(fw)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-sky-700"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Use Framework in Writer</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
