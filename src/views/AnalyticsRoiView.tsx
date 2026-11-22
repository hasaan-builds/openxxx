import React, { useMemo, useState } from 'react';
import { BarChart3, Download, Repeat, TrendingUp } from 'lucide-react';
import { computeFrameworkRoi, summarizeOfferPerformance } from '../lib/scheduler';
import type { GhostPilotStore, PostItem } from '../lib/types';

interface AnalyticsRoiViewProps {
  store: GhostPilotStore;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_HOURS = ['08:00', '11:00', '14:00', '17:00', '20:00', '22:00'];
const HEATMAP_MATRIX = [
  [82, 65, 74, 91, 68, 42],
  [94, 71, 80, 88, 72, 46],
  [89, 77, 83, 95, 70, 51],
  [92, 73, 79, 90, 66, 48],
  [78, 69, 71, 64, 52, 39],
  [61, 84, 76, 58, 49, 36],
  [67, 88, 82, 79, 73, 44],
];

export function AnalyticsRoiView({ store, onSaveStore, onNotify }: AnalyticsRoiViewProps) {
  const [range, setRange] = useState<'7d' | '30d'>('30d');

  const points = useMemo(() => {
    const all = store.analytics;
    return range === '7d' ? all.slice(-7) : all;
  }, [store.analytics, range]);

  const kpis = useMemo(() => {
    const totalImpressions = points.reduce((s, p) => s + p.impressions, 0);
    const totalEngagements = points.reduce((s, p) => s + p.engagements, 0);
    const totalClicks = points.reduce((s, p) => s + p.offerClicks, 0);
    const followerDelta =
      points.length >= 2 ? points[points.length - 1].followers - points[0].followers : 0;
    const engRate =
      totalImpressions > 0 ? ((totalEngagements / totalImpressions) * 100).toFixed(1) : '0.0';
    return { totalImpressions, totalEngagements, totalClicks, followerDelta, engRate };
  }, [points]);

  const frameworkRows = useMemo(() => computeFrameworkRoi(store.posts), [store.posts]);
  const offerSummary = useMemo(
    () => summarizeOfferPerformance(store.brandBrain.offers),
    [store.brandBrain.offers]
  );

  const topPosts = useMemo(
    () =>
      store.posts
        .filter((p) => p.status === 'published')
        .sort((a, b) => b.metrics.impressions - a.metrics.impressions),
    [store.posts]
  );

  const handlePromoteEvergreen = async (post: PostItem) => {
    const nextPosts = store.posts.map((p) =>
      p.id === post.id
        ? { ...p, automations: { ...p.automations, isEvergreen: !p.automations.isEvergreen } }
        : p
    );
    await onSaveStore({ posts: nextPosts });
    onNotify(
      post.automations.isEvergreen
        ? 'Removed post from Evergreen rotation.'
        : 'Promoted winner to Evergreen recycling queue.'
    );
  };

  const handleExportAnalyticsCsv = () => {
    const header = ['Date', 'Followers', 'Impressions', 'Engagements', 'ProfileVisits', 'OfferClicks'];
    const rows = points.map((p) =>
      [p.date, p.followers, p.impressions, p.engagements, p.profileVisits, p.offerClicks].join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostpilot-analytics-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Exported analytics CSV.');
  };

  // Build responsive SVG polyline coordinates for Impressions
  const chartData = useMemo(() => {
    if (points.length === 0) return { path: '', area: '', maxVal: 1 };
    const w = 680;
    const h = 180;
    const maxVal = Math.max(1, ...points.map((p) => p.impressions));
    const stepX = points.length > 1 ? w / (points.length - 1) : w;
    const coords = points.map((p, idx) => {
      const x = idx * stepX;
      const y = h - (p.impressions / maxVal) * (h - 20) - 10;
      return { x, y };
    });
    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const area = `${path} L${w},${h} L0,${h} Z`;
    return { path, area, maxVal };
  }, [points]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analytics & Offer ROI
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Data-driven attribution showing which Copywriting Frameworks, Lead Magnets, and time slots actually generate Whop & affiliate clicks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1">
            {(['7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium uppercase ${
                  range === r
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExportAnalyticsCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: `Impressions (${range})`,
            value: kpis.totalImpressions.toLocaleString(),
            sub: `${kpis.engRate}% engagement rate`,
          },
          {
            label: `Net Followers (${range})`,
            value: `+${kpis.followerDelta.toLocaleString()}`,
            sub: 'Organic authority growth',
          },
          {
            label: 'Offer & PDF Clicks',
            value: offerSummary.totalClicks.toLocaleString(),
            sub: `${offerSummary.totalLeads} warm DM/PDF leads`,
          },
          {
            label: 'Estimated Offer Revenue',
            value: `$${offerSummary.totalRevenue.toLocaleString()}`,
            sub: `${offerSummary.conversionRate}% click-to-lead rate`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5"
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Impressions Trend Chart + Best Time Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              Daily Reach Trajectory ({range.toUpperCase()})
            </h3>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Peak: {chartData.maxVal.toLocaleString()} views/day
            </span>
          </div>
          <div className="w-full overflow-hidden">
            <svg viewBox="0 0 680 180" className="w-full h-48" role="img" aria-label="Daily impressions line chart">
              <defs>
                <linearGradient id="gpArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="45" x2="680" y2="45" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="680" y2="90" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="4 4" />
              <line x1="0" y1="135" x2="680" y2="135" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="4 4" />
              {chartData.area && <path d={chartData.area} fill="url(#gpArea)" />}
              {chartData.path && (
                <path d={chartData.path} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" />
              )}
            </svg>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
            <span>{points[0]?.date}</span>
            <span>{points[Math.floor(points.length / 2)]?.date}</span>
            <span>{points[points.length - 1]?.date}</span>
          </div>
        </section>

        {/* Best Time to Tweet Heatmap */}
        <section className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              Best Time to Post Heatmap
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Peak: Tue–Thu 08:00 & 17:00</span>
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-7 gap-1.5 text-[11px] font-mono text-slate-400 text-center">
              <div />
              {HEATMAP_HOURS.map((h) => (
                <div key={h}>{h}</div>
              ))}
            </div>
            {HEATMAP_DAYS.map((day, dIdx) => (
              <div key={day} className="grid grid-cols-7 gap-1.5 items-center">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{day}</div>
                {HEATMAP_MATRIX[dIdx].map((val, hIdx) => {
                  const bg =
                    val >= 88
                      ? 'bg-sky-600 text-white'
                      : val >= 75
                        ? 'bg-sky-500/60 text-white'
                        : val >= 60
                          ? 'bg-sky-500/25 text-slate-800 dark:text-slate-200'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
                  return (
                    <div
                      key={hIdx}
                      className={`h-7 rounded-md flex items-center justify-center font-mono text-[11px] tabular-nums ${bg}`}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Framework ROI Attribution Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Copywriting Framework ROI Attribution
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            See exactly which psychological framework drives the highest Predictive Score, views, and real offer clicks.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-3 px-5 font-medium">Framework</th>
              <th className="py-3 px-5 font-medium">Posts</th>
              <th className="py-3 px-5 font-medium">Avg Score</th>
              <th className="py-3 px-5 font-medium">Avg Views</th>
              <th className="py-3 px-5 font-medium">Eng. Rate</th>
              <th className="py-3 px-5 font-medium text-right">Offer Clicks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
            {frameworkRows.map((row) => (
              <tr key={row.frameworkName}>
                <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white">
                  {row.frameworkName}
                </td>
                <td className="py-3.5 px-5 font-mono text-slate-600 dark:text-slate-300">
                  {row.postsCount}
                </td>
                <td className="py-3.5 px-5 font-mono font-semibold text-sky-600 dark:text-sky-400">
                  {row.avgPredictiveScore}/100
                </td>
                <td className="py-3.5 px-5 font-mono text-slate-700 dark:text-slate-300">
                  {row.avgImpressions.toLocaleString()}
                </td>
                <td className="py-3.5 px-5 font-mono text-emerald-600 dark:text-emerald-400">
                  {row.engagementRate}%
                </td>
                <td className="py-3.5 px-5 font-mono font-bold text-slate-900 dark:text-white text-right">
                  {row.totalOfferClicks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Top Performing Tweets + Promote to Evergreen */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Top Performing Posts
          </h3>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {topPosts.map((post) => (
            <div key={post.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {post.metrics.impressions.toLocaleString()} views · {post.metrics.likes} likes ·{' '}
                  {post.metrics.bookmarks} saves · {post.metrics.offerClicks} offer clicks · Score{' '}
                  {post.predictiveScore}/100
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">
                  {post.blocks[0]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePromoteEvergreen(post)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${
                  post.automations.isEvergreen
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{post.automations.isEvergreen ? 'In Evergreen Queue' : 'Promote to Evergreen'}</span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
