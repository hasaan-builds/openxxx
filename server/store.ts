import fs from 'node:fs';
import path from 'node:path';
import type { AntigravityTask, GhostPilotStore } from '../src/lib/types';
import { createInitialStore } from './seedData';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ghostpilot-db.json');
const SYNC_DIR = path.resolve(process.cwd(), 'antigravity-sync');
const TASKS_FILE = path.join(SYNC_DIR, 'tasks.json');
const RESULTS_FILE = path.join(SYNC_DIR, 'results.json');

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SYNC_DIR)) fs.mkdirSync(SYNC_DIR, { recursive: true });
}

let cachedStore: GhostPilotStore | null = null;

export function loadStore(): GhostPilotStore {
  ensureDirs();
  if (cachedStore) return cachedStore;

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as GhostPilotStore;
      if (parsed && Array.isArray(parsed.accounts) && parsed.brandBrain) {
        if (!Array.isArray(parsed.capturedLeads)) {
          parsed.capturedLeads = [];
        }
        cachedStore = parsed;
        return cachedStore;
      }
    } catch {
      // Fall back to fresh seed store if file is corrupted
    }
  }

  cachedStore = createInitialStore();
  saveStore(cachedStore);
  syncTasksToDisk(cachedStore.antigravityTasks);
  return cachedStore;
}

export function saveStore(next: GhostPilotStore): GhostPilotStore {
  ensureDirs();
  cachedStore = next;
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
  return next;
}

export function patchStore(patch: Partial<GhostPilotStore>): GhostPilotStore {
  const current = loadStore();
  const merged: GhostPilotStore = { ...current, ...patch };
  return saveStore(merged);
}

export function syncTasksToDisk(tasks: AntigravityTask[]): void {
  ensureDirs();
  const payload = {
    instructionsForAntigravity:
      'You are GhostPilot\'s zero-cost IDE copywriting engine (optimized for Gemini 3.8 Flash). Read the pending tasks below, generate high-converting posts, threads, carousels, or lead magnets matching the Brand Brain and avoiding all banned clichés, and write your JSON output to antigravity-sync/results.json.',
    outputSchemaExample: {
      taskId: 'ag-task-id',
      posts: [
        {
          blocks: ['Tweet 1 hook with concrete number...', 'Tweet 2 breakdown...'],
          format: 'single | thread | giveaway',
          frameworkName: 'S-Tier Comment-to-PDF Giveaway',
          trigger: 'Hormozi Value Equation',
        },
      ],
      carousels: [
        {
          title: 'Carousel Title',
          themeId: 'obsidian',
          slides: [
            {
              layout: 'cover',
              eyebrow: 'PLAYBOOK',
              headline: 'Main Cover Headline',
              body: 'Short hook subtext',
              bullets: [],
            },
          ],
        },
      ],
    },
    pendingTasks: tasks.filter((t) => t.status === 'pending'),
  };
  fs.writeFileSync(TASKS_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  if (!fs.existsSync(RESULTS_FILE)) {
    fs.writeFileSync(
      RESULTS_FILE,
      JSON.stringify({ taskId: '', posts: [], carousels: [], leadMagnets: [] }, null, 2),
      'utf-8'
    );
  }
}

export function readAntigravityResults(): {
  taskId?: string;
  posts?: Array<{
    blocks: string[];
    format?: 'single' | 'thread' | 'giveaway' | 'carousel';
    frameworkName?: string;
  }>;
  carousels?: Array<{
    title: string;
    themeId?: 'obsidian' | 'editorial' | 'cobalt' | 'ivory';
    slides: Array<{
      layout: 'cover' | 'framework' | 'checklist' | 'comparison' | 'quote' | 'cta';
      eyebrow: string;
      headline: string;
      body: string;
      bullets: string[];
    }>;
  }>;
  leadMagnets?: Array<{
    title: string;
    subtitle: string;
    format?: 'Playbook' | 'Swipe File' | 'Checklist' | 'Deep-Dive Report';
    giveawayKeyword?: string;
    sections: Array<{
      type: 'takeaway' | 'framework' | 'checklist' | 'script' | 'offer-callout';
      heading: string;
      body: string;
      bullets: string[];
    }>;
  }>;
} {
  ensureDirs();
  if (!fs.existsSync(RESULTS_FILE)) return {};
  try {
    const raw = fs.readFileSync(RESULTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function clearAntigravityResults(): void {
  ensureDirs();
  fs.writeFileSync(
    RESULTS_FILE,
    JSON.stringify({ taskId: '', posts: [], carousels: [], leadMagnets: [] }, null, 2),
    'utf-8'
  );
}
