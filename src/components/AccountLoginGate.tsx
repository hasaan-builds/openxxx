import React, { useState } from 'react';
import { ArrowRight, Lock, Plus } from 'lucide-react';
import type { AccountProfile } from '../lib/types';

interface AccountLoginGateProps {
  accounts: AccountProfile[];
  onSignInExisting: (accountId: string) => Promise<void>;
  onCreateAndSignIn: (name: string, handle: string) => Promise<void>;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function AccountLoginGate({
  accounts,
  onSignInExisting,
  onCreateAndSignIn,
  onNotify,
}: AccountLoginGateProps) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleInstantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !handle.trim()) {
      onNotify('Enter your X display name and @handle to start your dedicated workspace.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await onCreateAndSignIn(name.trim(), handle.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const journeySteps = [
    { num: '01', title: 'Lock your niche & Whop offer', desc: '16 markets, 41 sub-niches, 164 micro-angles — separate per account.' },
    { num: '02', title: 'Find fresh ideas ($0)', desc: 'Live Reddit, Google News, GitHub, or paste any Whop/competitor URL.' },
    { num: '03', title: 'Build posts & free PDFs', desc: 'Ready-to-post tweets, threads, Auto-Plug replies & Comment-to-PDF packs.' },
    { num: '04', title: 'Deliver via Telegram ($0)', desc: 'Scheduled pushes to your phone with 1-tap Post on X buttons — zero API cost.' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col justify-center px-6 py-12 relative overflow-hidden">
      {/* Subtle Apple studio ceramic overhead wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-white/80 via-white/20 to-transparent dark:from-white/[0.04] dark:via-transparent"
      />

      <div className="relative w-full max-w-[1040px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Editorial Column */}
        <div className="lg:col-span-6 space-y-8">
          <div className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] shadow-sm font-display font-bold text-base tracking-tight">
              GP
            </span>
            <span className="font-display text-xl font-semibold tracking-[-0.02em]">
              GhostPilot
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-4xl sm:text-[44px] font-bold tracking-[-0.035em] leading-[1.08] text-balance text-[#1D1D1F] dark:text-[#F5F5F7]">
              Pick your niche. Get daily posts on Telegram. Pay $0.
            </h1>
            <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] leading-relaxed max-w-lg">
              Every X account gets its own clean, simple workspace — zero paid APIs, zero ban risk, 100% local + Telegram.
            </p>
          </div>

          <ol className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-y border-black/[0.06] dark:border-white/[0.08]">
            {journeySteps.map((step) => (
              <li key={step.num} className="py-3 flex items-baseline gap-4">
                <span className="font-mono text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] tabular-nums shrink-0">
                  {step.num}
                </span>
                <div className="text-sm leading-snug">
                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {step.title}
                  </span>
                  <span className="text-[#6E6E73] dark:text-[#86868B]"> — {step.desc}</span>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-xs text-[#86868B]">
            100% Local $0 Database · Designed for Antigravity IDE (Gemini 3.8 Flash)
          </p>
        </div>

        {/* Right Frosted Ceramic Sign-In Sheet */}
        <div className="lg:col-span-6 apple-card rounded-[24px] p-7 sm:p-9 space-y-7">
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
                Sign In With an Individual X Account
              </h2>
              <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
                Launch a clean, niche-locked workspace for your handle.
              </p>
            </div>

            <form onSubmit={handleInstantLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-name"
                  className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
                >
                  Creator / Brand Display Name
                </label>
                <input
                  id="login-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Hasaan Vibe"
                  className="apple-input h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-handle"
                  className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
                >
                  X (Twitter) Handle
                </label>
                <input
                  id="login-handle"
                  type="text"
                  required
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="e.g., @hasaanvibe"
                  className="apple-input h-11 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="apple-btn-primary w-full h-11 px-5 text-sm"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>
                  {submitting ? 'Creating Workspace...' : 'Continue & Lock Deep Niche →'}
                </span>
              </button>
            </form>
          </div>

          {accounts.length > 0 && (
            <div className="pt-6 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
              <div className="text-xs font-medium text-[#6E6E73] dark:text-[#86868B]">
                Or Resume a Saved Individual Account
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onSignInExisting(acc.id)}
                    className="w-full group flex items-center justify-between gap-3 rounded-[14px] bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBF0] dark:hover:bg-[#242426] px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={acc.avatarUrl}
                        alt={acc.name}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-full object-cover ring-1 ring-black/[0.08] dark:ring-white/[0.12] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                          {acc.name}{' '}
                          <span className="font-normal text-[#6E6E73] dark:text-[#86868B]">
                            {acc.handle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#6E6E73] dark:text-[#86868B] truncate mt-0.5">
                          <Lock className="h-3 w-3 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {acc.nicheProfile?.subNicheName || 'Needs Niche Lock'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 text-[#86868B] group-hover:text-[#1D1D1F] dark:group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
