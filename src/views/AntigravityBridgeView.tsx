import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Cpu,
  FolderSync,
  Globe,
  Plus,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AntigravityTask, GhostPilotStore } from '../lib/types';

interface AntigravityBridgeViewProps {
  store: GhostPilotStore;
  onReplaceStore: (next: GhostPilotStore) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

const TASK_PRESETS: Array<{ type: AntigravityTask['type']; label: string; desc: string }> = [
  {
    type: 'weekly-autopilot',
    label: 'Full 7-Day Autopilot Pack',
    desc: 'Generate 7 high-scoring posts + 1 giveaway PDF + 1 carousel from your latest radar.',
  },
  {
    type: 'authority-dossier',
    label: 'STORM 5-Angle Dossier',
    desc: 'Turn scraped Reddit/News/GitHub data into a deep niche authority brief.',
  },
  {
    type: 'ab-copy',
    label: '5-Variation A/B Copy Pack',
    desc: 'Have Gemini 3.8 Flash write 5 framework variants ready to import & score.',
  },
  {
    type: 'lead-magnet',
    label: 'High-Ticket Lead Magnet PDF',
    desc: 'Draft a complete 6-section Playbook with embedded Whop offer callouts.',
  },
  {
    type: 'carousel',
    label: '7-Slide Visual Carousel',
    desc: 'Write slide-by-slide headlines & checklists for Carousel Studio.',
  },
  {
    type: 'replies',
    label: 'CRM Authority Reply Batch',
    desc: 'Draft thoughtful replies for your top Twitter CRM contacts.',
  },
];

export function AntigravityBridgeView({
  store,
  onReplaceStore,
  onNotify,
}: AntigravityBridgeViewProps) {
  const [taskType, setTaskType] = useState<AntigravityTask['type']>('weekly-autopilot');
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [runningTurbo, setRunningTurbo] = useState(false);

  // Weak-model-proof instant paste importer
  const [rawPaste, setRawPaste] = useState('');
  const [importingRaw, setImportingRaw] = useState(false);

  // Built-in $0 Jina Reader (r.jina.ai) URL -> Markdown extractor
  const [extractUrlInput, setExtractUrlInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<{
    title: string;
    url: string;
    engine: string;
    keyTakeaways: string[];
  } | null>(null);

  const handleCreateTask = async () => {
    setCreating(true);
    try {
      const preset = TASK_PRESETS.find((p) => p.type === taskType);
      const res = await api.createAntigravityTask({
        type: taskType,
        title: goal.trim() || `${preset?.label || 'Autopilot'} — ${store.brandBrain.niche}`,
        goal: goal.trim() || undefined,
      });
      onReplaceStore(res.store);
      setGoal('');
      onNotify('Saved compact weak-model-proof prompt to antigravity-sync/tasks.json.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create task.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRunLocalTurbo = async () => {
    setRunningTurbo(true);
    try {
      const res = await api.runLocalTurbo({ goal: goal.trim() || undefined });
      onReplaceStore(res.store);
      onNotify(
        `Built-in $0 Turbo Engine scored 20 variants and queued ${res.importedPosts} top posts into My Queue in <1s!`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Local Turbo run failed.', 'error');
    } finally {
      setRunningTurbo(false);
    }
  };

  const handleSyncResults = async () => {
    setSyncing(true);
    try {
      const res = await api.syncAntigravityOutbox();
      onReplaceStore(res.store);
      const total = res.importedPosts + res.importedCarousels + res.importedMagnets;
      onNotify(
        total > 0
          ? `Imported ${res.importedPosts} posts, ${res.importedCarousels} carousels, and ${res.importedMagnets} PDFs from antigravity-sync/results.json.`
          : 'Checked antigravity-sync/results.json — no new results waiting yet. You can also paste model output directly below!'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Sync failed.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleImportRawPaste = async () => {
    if (!rawPaste.trim()) {
      onNotify('Paste any JSON, markdown block, or plain tweets from Antigravity first.', 'error');
      return;
    }
    setImportingRaw(true);
    try {
      const res = await api.importAntigravityRaw({ rawText: rawPaste });
      onReplaceStore(res.store);
      setRawPaste('');
      onNotify(
        `Parsed & queued ${res.importedPosts} posts, ${res.importedCarousels} carousels, and ${res.importedMagnets} PDFs (auto-scored 0–100)!`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not parse pasted text.', 'error');
    } finally {
      setImportingRaw(false);
    }
  };

  const handleExtractUrl = async () => {
    if (!extractUrlInput.trim()) {
      onNotify('Paste any article, Whop product page, or GitHub repo URL first.', 'error');
      return;
    }
    setExtracting(true);
    try {
      const res = await api.extractUrl({ url: extractUrlInput.trim(), saveToRadar: true });
      onReplaceStore(res.store);
      setExtractedPreview({
        title: res.title,
        url: res.url,
        engine: res.engine,
        keyTakeaways: res.keyTakeaways,
      });
      setExtractUrlInput('');
      onNotify(`Extracted "${res.title}" via built-in $0 ${res.engine} and saved to your Niche Radar!`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not read that URL.', 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleCopyPrompt = async (promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
      onNotify('Copied ready-to-paste prompt for Antigravity IDE (Gemini 3.8 Flash).');
    } catch {
      onNotify('Copy blocked by browser — select the prompt text manually.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header — Single dominant Apple Blue CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Antigravity Bridge &amp; Built-In $0 Tools
          </h2>
          <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
            Engineered to run fast and reliably 100% of the time — even with smaller models or 100% locally in under 1 second.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={syncing}
            onClick={handleSyncResults}
            className="apple-btn-secondary px-4 py-2 text-xs sm:text-sm"
          >
            <FolderSync className="h-3.5 w-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
            <span>{syncing ? 'Syncing...' : 'Sync File Outbox'}</span>
          </button>
          <button
            type="button"
            disabled={runningTurbo}
            onClick={handleRunLocalTurbo}
            className="apple-btn-primary px-5 py-2 text-xs sm:text-sm"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{runningTurbo ? 'Generating...' : 'Run Built-In $0 Turbo (<1s)'}</span>
          </button>
        </div>
      </div>

      {/* Built-in $0 Open-Source Tool: Jina Reader (r.jina.ai) Instant URL-to-Markdown */}
      <section className="apple-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
              Built-In $0 Jina Reader — Any URL to Clean Context
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              Powered by open-source <code className="font-mono">jina-ai/reader</code> (r.jina.ai). Paste any Whop sales page, competitor thread, news article, or GitHub repo to feed clean Markdown straight into your Niche Radar &amp; Antigravity tasks.
            </p>
          </div>
          <span className="text-xs font-mono text-[#6E6E73] dark:text-[#98989D]">
            $0 · No API Key · ~1s
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={extractUrlInput}
            onChange={(e) => setExtractUrlInput(e.target.value)}
            placeholder="https://whop.com/... or https://github.com/... or any article URL"
            className="apple-input flex-1"
          />
          <button
            type="button"
            disabled={extracting}
            onClick={handleExtractUrl}
            className="apple-btn-secondary px-5 py-2.5 text-sm font-semibold shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
            <span>{extracting ? 'Reading Page...' : 'Extract to Radar ($0)'}</span>
          </button>
        </div>

        {extractedPreview && (
          <div className="apple-subsurface p-4 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {extractedPreview.title}
              </span>
              <span className="font-mono text-[#248A3D] dark:text-[#30D158]">
                Saved to Radar via {extractedPreview.engine}
              </span>
            </div>
            {extractedPreview.keyTakeaways.length > 0 && (
              <ul className="space-y-1 text-[#515154] dark:text-[#D1D1D6]">
                {extractedPreview.keyTakeaways.slice(0, 3).map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Weak-Model-Proof Instant Paste Importer */}
      <section className="apple-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Weak-Model-Proof Fast Importer (Paste Chat Reply Directly)
          </h3>
        </div>
        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
          If your Antigravity model prints JSON in chat (even with broken commas, markdown fences, or plain text tweets separated by <code className="font-mono">---</code>) instead of editing <code className="font-mono">results.json</code>, paste it right here. GhostPilot auto-recovers it, scores every tweet 0–100, and fills your queue instantly.
        </p>
        <textarea
          rows={4}
          value={rawPaste}
          onChange={(e) => setRawPaste(e.target.value)}
          placeholder='Paste anything your model generated (raw JSON, ```json ... ``` block, or plain tweets separated by ---)...'
          className="apple-input font-mono text-xs"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={importingRaw}
            onClick={handleImportRawPaste}
            className="apple-btn-secondary px-5 py-2 text-xs sm:text-sm font-semibold"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
            <span>{importingRaw ? 'Parsing & Scoring...' : 'Parse, Score & Queue Instantly'}</span>
          </button>
        </div>
      </section>

      {/* Create New Compact Task Pack */}
      <section className="apple-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Create Compact Antigravity Task Pack
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TASK_PRESETS.map((preset) => (
            <button
              key={preset.type}
              type="button"
              onClick={() => setTaskType(preset.type)}
              className={`text-left rounded-[14px] p-4 transition-all border ${
                taskType === preset.type
                  ? 'bg-[#0071E3]/[0.06] dark:bg-[#0A84FF]/15 border-[#0071E3] dark:border-[#0A84FF]'
                  : 'bg-[#F5F5F7] dark:bg-[#1C1C1E] border-black/[0.04] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.15]'
              }`}
            >
              <div className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {preset.label}
              </div>
              <div className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-1 leading-relaxed">
                {preset.desc}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={`Optional focus (e.g., "Promote my ${store.brandBrain.niche} Whop offer using Reddit pain points")`}
            className="apple-input flex-1"
          />
          <button
            type="button"
            disabled={creating}
            onClick={handleCreateTask}
            className="apple-btn-primary px-5 py-2.5 text-sm shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{creating ? 'Writing JSON...' : 'Create Task Pack'}</span>
          </button>
        </div>
      </section>

      {/* Task Queue */}
      <section className="apple-card divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
        <div className="p-6 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Task Packs Written to <code className="font-mono text-xs text-[#0071E3] dark:text-[#0A84FF]">antigravity-sync/tasks.json</code>
          </h3>
          <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
            Short fill-in-the-blank JSON prompts for fast models
          </span>
        </div>
        {store.antigravityTasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
            No task packs yet. Click &quot;Create Task Pack&quot; above — or hit &quot;Run Built-In $0 Turbo&quot; for instant posts.
          </div>
        ) : (
          store.antigravityTasks.map((task) => (
            <div key={task.id} className="p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {task.title}
                  </div>
                  <div className="text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                    {task.type} ·{' '}
                    {new Date(task.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    ·{' '}
                    <span
                      className={
                        task.status === 'imported'
                          ? 'text-[#248A3D] dark:text-[#30D158] font-semibold'
                          : 'text-[#FF9500] dark:text-[#FF9F0A] font-semibold'
                      }
                    >
                      {task.status === 'imported' ? 'Imported' : 'Waiting for Antigravity'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(task.promptForIde)}
                  className="apple-btn-secondary px-4 py-1.5 text-xs font-semibold"
                >
                  {task.status === 'imported' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#248A3D]" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  )}
                  <span>Copy Prompt</span>
                </button>
              </div>
              <pre className="apple-subsurface p-3.5 text-xs font-mono text-[#3A3A3C] dark:text-[#D1D1D6] whitespace-pre-wrap overflow-x-auto">
                {task.promptForIde}
              </pre>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
